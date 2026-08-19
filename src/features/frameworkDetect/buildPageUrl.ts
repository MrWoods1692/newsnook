import type { FrameworkHint, PaginationPattern } from './types'

export function frameworkPageUrl(
  baseUrl: string,
  page: number,
  pattern: PaginationPattern,
): string {
  const pageNum = page + 1
  switch (pattern.kind) {
    case 'query-param': {
      const url = new URL(baseUrl)
      if (pageNum <= 1) url.searchParams.delete(pattern.param)
      else url.searchParams.set(pattern.param, String(pageNum))
      return url.href
    }
    case 'path-segment':
      if (pageNum <= 1) return baseUrl
      return pattern.template.replace('{page}', String(pageNum))
    case 'next-link':
      return baseUrl
  }
}

/**
 * Build a paginated URL for a specific category within a framework site.
 * Handles different MacCMS URL variants (classic vs wntheme).
 */
export function frameworkCategoryPageUrl(
  catUrl: string,
  page: number,
  hint: FrameworkHint,
): string {
  if (page <= 0) return catUrl

  const pageNum = page + 1

  // wntheme MacCMS: /vodtype/ID/ → /vodtype/ID-PAGE/
  if (hint.framework === 'maccms' && /\/vodtype\/\d+\/?$/.test(new URL(catUrl).pathname)) {
    const base = catUrl.replace(/\/$/, '')
    return `${base}-${pageNum}/`
  }

  // classic MacCMS: /vod/type/id/ID.html → /vod/type/id/ID/page/PAGE.html
  const catBase = catUrl.replace(/\.html$/i, '')
  return `${catBase}/page/${pageNum}.html`
}
