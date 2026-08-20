import { collectMediaCandidates } from './core'
import { isHttpUrl } from './classifier'
import { originOf } from './originHeaders'
import type { MediaObservation } from './types'

const MAX_EMBEDDED_PAGES = 3
const MAX_SECONDARY_TARGETS = 3
const JSONLD_MEDIA_TYPES = /(?:VideoObject|Movie|TVSeries|TVEpisode|BroadcastEvent)/i
export const PLAYBACK_PATH_PATTERN =
  /(?:^|\/)(?:play|player|watch|embed|vodplay|vod\/play|video\/play)(?:\/|$|[?#])/i

export type SniffTarget = {
  url: string
  referrer?: string
  budgetMs: number
}

function jsonLdType(record: Record<string, unknown>): string {
  const value = record['@type']
  return Array.isArray(value) ? value.join(' ') : String(value ?? '')
}

function collectJsonLdPlaybackUrls(payload: unknown, baseUrl: string, out: string[]): void {
  if (!payload || typeof payload !== 'object') return
  const record = payload as Record<string, unknown>
  const pushUrl = (value: unknown): void => {
    if (typeof value !== 'string' || !value.trim()) return
    try {
      const absolute = new URL(value, baseUrl).href
      if (isHttpUrl(absolute) && absolute !== baseUrl) out.push(absolute)
    } catch {
      // 无效 URL 直接忽略
    }
  }
  if (JSONLD_MEDIA_TYPES.test(jsonLdType(record))) {
    pushUrl(record.embedUrl)
    pushUrl(record.contentUrl)
  }
  const action = record.potentialAction
  if (action && typeof action === 'object') {
    const actionRecord = action as Record<string, unknown>
    if (/WatchAction/i.test(jsonLdType(actionRecord))) {
      const target = actionRecord.target
      if (typeof target === 'string') pushUrl(target)
      else if (target && typeof target === 'object') {
        pushUrl((target as Record<string, unknown>).urlTemplate)
      }
    }
  }
}

/** 从 HTML 提取 iframe 嵌入页作为独立嗅探目标。 */
export function embeddedPageUrlsInHtml(html: string, pageUrl: string): string[] {
  const urls: string[] = []
  const seen = new Set<string>()
  for (const match of html.matchAll(/<iframe\b[^>]*>/gi)) {
    const tag = match[0]
    const value = tag
      .match(/\b(?:src|data-src|data-video-src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)
      ?.slice(1)
      .find((item): item is string => item !== undefined)
    if (!value) continue
    try {
      const url = new URL(value.replace(/&amp;/g, '&'), pageUrl)
      if (!/^https?:$/.test(url.protocol) || seen.has(url.href)) continue
      seen.add(url.href)
      urls.push(url.href)
      if (urls.length >= MAX_EMBEDDED_PAGES) break
    } catch {
      // A malformed embed cannot be loaded safely and is left to the fallback.
    }
  }
  return urls
}

/**
 * 提取详情页指向的独立播放页（schema.org + 同站通用播放路径）。
 * 信号优先级：JSON-LD embedUrl/WatchAction > 正文同站播放路径链接。
 */
export function secondaryPlaybackUrlsInHtml(html: string, pageUrl: string): string[] {
  const urls: string[] = []
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const payload: unknown = JSON.parse(match[1])
      const roots: unknown[] = Array.isArray(payload)
        ? payload
        : payload && typeof payload === 'object' && (payload as Record<string, unknown>)['@graph'] !== undefined
          ? (payload as Record<string, unknown>)['@graph'] as unknown[]
          : [payload]
      for (const root of roots) collectJsonLdPlaybackUrls(root, pageUrl, urls)
    } catch {
      // 单个无效 JSON-LD 块不影响其他信号
    }
  }
  const pageOrigin = originOf(pageUrl)
  for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
    const value = match[1] ?? match[2] ?? match[3]
    if (!value) continue
    try {
      const absolute = new URL(value.replace(/&amp;/g, '&'), pageUrl)
      if (!isHttpUrl(absolute) || absolute.href === pageUrl) continue
      if (pageOrigin && originOf(absolute) !== pageOrigin) continue
      if (!PLAYBACK_PATH_PATTERN.test(absolute.pathname + absolute.search + absolute.hash)) continue
      urls.push(absolute.href)
    } catch {
      // 忽略无效链接
    }
  }
  const seen = new Set<string>()
  const result: string[] = []
  for (const url of urls) {
    if (seen.has(url) || result.length >= MAX_SECONDARY_TARGETS) continue
    seen.add(url)
    result.push(url)
  }
  return result
}

/** 规划 SniffSession 探测目标与预算分配。 */
export function planSniffTargets(input: {
  pageUrl: string
  html?: string
  staticObservations: MediaObservation[]
  totalTimeoutMs?: number
}): SniffTarget[] {
  const totalTimeoutMs = input.totalTimeoutMs ?? 6000
  const iframeUrls = input.html ? embeddedPageUrlsInHtml(input.html, input.pageUrl) : []
  const hasDirectMedia = collectMediaCandidates(input.staticObservations).some(
    (candidate) => candidate.format !== 'segment',
  )

  if (hasDirectMedia) {
    const urls = [...iframeUrls, input.pageUrl]
    const budgetMs = Math.max(1500, Math.floor(totalTimeoutMs / Math.max(urls.length, 1)))
    return urls.map((url) => ({
      url,
      referrer: url === input.pageUrl ? undefined : input.pageUrl,
      budgetMs,
    }))
  }

  const secondary = input.html
    ? secondaryPlaybackUrlsInHtml(input.html, input.pageUrl)
    : []
  if (secondary.length) {
    return [{
      url: secondary[0],
      referrer: input.pageUrl,
      budgetMs: totalTimeoutMs,
    }]
  }

  return [{ url: input.pageUrl, budgetMs: totalTimeoutMs }]
}

/** 已知 embed 协议页追加 autoplay/mute 参数；不改写其他站点签名 URL。 */
export function runtimeProbePageUrl(pageUrl: string): string {
  try {
    const url = new URL(pageUrl)
    const host = url.hostname.toLowerCase()
    if (
      /^(?:www\.)?youtube(?:-nocookie)?\.com$/.test(host) &&
      /^\/embed\//i.test(url.pathname)
    ) {
      url.searchParams.set('autoplay', '1')
      url.searchParams.set('mute', '1')
      url.searchParams.set('playsinline', '1')
    } else if (host === 'player.vimeo.com' && /^\/video\//i.test(url.pathname)) {
      url.searchParams.set('autoplay', '1')
      url.searchParams.set('muted', '1')
      url.searchParams.set('playsinline', '1')
    }
    return url.href
  } catch {
    return pageUrl
  }
}
