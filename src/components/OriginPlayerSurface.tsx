import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { X } from 'lucide-react'

import {
  prepareNativeMediaPlayback,
  setNativeLiveSessionBounds,
  setNativeLiveSessionVisible,
  startNativeLiveSniffSession,
} from '../features/mediaSniffer/native'
import { reduceLiveObservations } from '../features/mediaSniffer/liveCandidate'
import type { MediaDescriptor, MediaObservation } from '../features/mediaSniffer/types'
import { InkVideoPlayer } from './InkVideoPlayer'

type Mode = 'origin' | 'custom'

/** Match Tailwind `rounded-xl` used by Reader cover / related cards. */
const SLOT_CORNER_RADIUS_PX = 12

export type OriginPlayerCloseHandle = {
  /** Returns true when the custom layer was closed. */
  closeCustom: () => boolean
}

interface Props {
  pageUrl: string
  referrer?: string
  title: string
  poster?: string
  openOriginal?: () => void
  closeHandleRef?: MutableRefObject<OriginPlayerCloseHandle | null>
}

/**
 * Android custom-source video: visible origin WebView (native) + live sniff.
 * Float button switches to InkVideoPlayer only after an eligible descriptor.
 */
export function OriginPlayerSurface({
  pageUrl,
  referrer,
  title,
  poster,
  openOriginal,
  closeHandleRef,
}: Props) {
  const [mode, setMode] = useState<Mode>('origin')
  const [candidate, setCandidate] = useState<MediaDescriptor | null>(null)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const observationsRef = useRef<MediaObservation[]>([])
  const slotRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!closeHandleRef) return
    closeHandleRef.current = {
      closeCustom: () => {
        if (mode !== 'custom') return false
        setMode('origin')
        void setNativeLiveSessionVisible(true)
        return true
      },
    }
    return () => {
      closeHandleRef.current = null
    }
  }, [closeHandleRef, mode])

  useEffect(() => {
    let stopped = false
    let stopSession: (() => Promise<void>) | undefined
    observationsRef.current = []
    setCandidate(null)
    setSessionError(null)
    setMode('origin')

    void startNativeLiveSniffSession({
      url: pageUrl,
      referrer,
      onObservation: (observation) => {
        if (stopped) return
        observationsRef.current.push(observation)
        const next = reduceLiveObservations(observationsRef.current)
        if (next) setCandidate(next)
      },
    })
      .then((session) => {
        if (stopped) {
          void session.stop()
          return
        }
        stopSession = session.stop
      })
      .catch(() => {
        if (!stopped) setSessionError('原站播放器未能启动')
      })

    return () => {
      stopped = true
      void stopSession?.()
    }
  }, [pageUrl, referrer])

  useEffect(() => {
    if (mode !== 'origin') return

    const syncBounds = () => {
      const el = slotRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      void setNativeLiveSessionBounds({
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        cornerRadius: SLOT_CORNER_RADIUS_PX,
      })
    }

    syncBounds()
    const el = slotRef.current
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncBounds) : null
    if (el && ro) ro.observe(el)
    window.addEventListener('scroll', syncBounds, true)
    window.addEventListener('resize', syncBounds)
    return () => {
      ro?.disconnect()
      window.removeEventListener('scroll', syncBounds, true)
      window.removeEventListener('resize', syncBounds)
    }
  }, [mode, pageUrl])

  const openCustom = async () => {
    if (!candidate) return
    await prepareNativeMediaPlayback({
      url: candidate.url,
      sourcePage: candidate.pageUrl,
      format: candidate.type,
      headers: candidate.requestHeaders,
      origins: candidate.origins,
      extraUrls: candidate.relatedUrls,
    }).catch(() => undefined)
    await setNativeLiveSessionVisible(false)
    setMode('custom')
  }

  const backToOrigin = () => {
    setMode('origin')
    void setNativeLiveSessionVisible(true)
  }

  return (
    <div className="mt-5 page-x lg:px-8">
      <div className="overflow-hidden rounded-xl border border-haze bg-ink-raised/80">
        <div ref={slotRef} className="relative aspect-video w-full bg-[#0c0d10]">
          {mode === 'custom' && candidate ? (
            <InkVideoPlayer
              src={candidate.url}
              poster={poster}
              title={title}
              format={candidate.type}
              sourcePage={candidate.pageUrl}
              requestHeaders={candidate.requestHeaders}
              extraUrls={candidate.relatedUrls}
              resources={candidate.resources}
              onRefreshSource={backToOrigin}
              onPlaybackError={backToOrigin}
            />
          ) : null}
        </div>

        {mode === 'origin' && (
          <div className="flex items-center gap-2 px-2.5 py-2.5">
            {sessionError ? (
              <>
                <p className="min-w-0 flex-1 text-[12px] leading-snug text-paper-muted" role="alert">
                  {sessionError}
                </p>
                {openOriginal && (
                  <button
                    type="button"
                    onClick={openOriginal}
                    className="shrink-0 rounded-lg border border-haze bg-ink px-3 py-1.5 font-mono text-[11px] text-paper-muted hover:text-paper active:scale-95 transition-all"
                  >
                    打开原文
                  </button>
                )}
              </>
            ) : (
              <>
                <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 font-mono text-[11px] tracking-[0.04em] text-paper-muted">
                  {candidate ? null : (
                    <span className="size-1.5 shrink-0 rounded-full bg-cinnabar-soft animate-pulse" />
                  )}
                  <span className="truncate">{candidate ? '已识别正片' : '原站播放中'}</span>
                </span>
                {candidate ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void openCustom()}
                      className="shrink-0 rounded-lg bg-cinnabar px-3 py-1.5 font-mono text-[11px] font-medium text-white hover:bg-cinnabar-soft active:scale-95 transition-all"
                    >
                      用阅读器播放
                    </button>
                    <button
                      type="button"
                      onClick={() => void openCustom()}
                      aria-label="关闭原站并使用阅读器播放"
                      title="关闭原站并使用阅读器播放"
                      className="shrink-0 rounded-lg p-1.5 text-paper-muted hover:bg-ink hover:text-paper active:scale-95 transition-all"
                    >
                      <X size={15} strokeWidth={2} />
                    </button>
                  </>
                ) : null}
              </>
            )}
          </div>
        )}
      </div>

      {mode === 'custom' && (
        <button
          type="button"
          onClick={backToOrigin}
          className="mt-2 px-0.5 text-[12px] text-paper-muted underline-offset-2 hover:underline"
        >
          返回原站播放器
        </button>
      )}
    </div>
  )
}
