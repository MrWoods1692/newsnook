import type { PaginationPattern } from './types'

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
