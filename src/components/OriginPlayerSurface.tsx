import { useEffect, useRef, useState, type MutableRefObject } from 'react'

import { prepareNativeMediaPlayback, setNativeLiveSessionVisible, startNativeLiveSniffSession } from '../features/mediaSniffer/native'
import { reduceLiveObservations } from '../features/mediaSniffer/liveCandidate'
import type { MediaDescriptor, MediaObservation } from '../features/mediaSniffer/types'
import { InkVideoPlayer } from './InkVideoPlayer'

type Mode = 'origin' | 'custom'

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
    <div className="page-x mt-5">
      {mode === 'custom' && candidate ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-[14px] bg-[#0c0d10]">
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
        </div>
      ) : (
        <div
          className={`reader-video-sniff-placeholder${poster ? ' has-poster' : ''}${sessionError ? ' is-failed' : ''}`}
          role={sessionError ? 'alert' : 'status'}
          aria-live="polite"
        >
          {poster ? (
            <img
              className="reader-video-sniff-poster"
              src={poster}
              alt=""
              loading="eager"
              decoding="async"
              referrerPolicy="no-referrer"
            />
          ) : null}

          {sessionError ? (
            <div className="reader-video-sniff-failed-stack">
              <p className="reader-video-sniff-failed-text">{sessionError}</p>
              {openOriginal && (
                <button type="button" className="reader-video-sniff-retry" onClick={openOriginal}>
                  打开原文
                </button>
              )}
            </div>
          ) : (
            <span className="reader-video-sniff-pill">
              {candidate ? null : <span className="reader-video-sniff-dot" />}
              {candidate ? '已识别正片' : '原站播放中'}
            </span>
          )}

          {candidate && !sessionError && (
            <button
              type="button"
              onClick={() => void openCustom()}
              className="reader-video-sniff-retry absolute bottom-3 right-3 z-10"
            >
              用阅读器播放
            </button>
          )}
        </div>
      )}
      {mode === 'custom' && (
        <button
          type="button"
          onClick={backToOrigin}
          className="mt-2 text-[12px] text-paper-muted underline-offset-2 hover:underline"
        >
          返回原站播放器
        </button>
      )}
    </div>
  )
}
