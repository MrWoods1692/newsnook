import type { FrameworkHint, PaginationPattern } from '../types'

export function detectMaccms(html: string, pageUrl: string): FrameworkHint | null {
  if (!/var\s+maccms\s*=/.test(html)) return null

  const base = new URL(pageUrl)
  const variant = detectMaccmsVariant(html)
  const categories = extractMaccmsNavCategories(html, pageUrl, variant)

  let paginationPattern: PaginationPattern
  let searchTemplate: string

  if (variant === 'wntheme') {
    // 文尼主题：首页是分类展示页不可翻页，分类内用 /vodtype/ID-PAGE/
    paginationPattern = {
      kind: 'path-segment',
      template: `${base.origin}/vodshow/-------{page}---/`,
    }
    searchTemplate = `${base.origin}/vodsearch/-------------/?wd={query}`
  } else {
    const pathBase = base.pathname.replace(/\.html$/i, '')
    paginationPattern = {
      kind: 'path-segment',
      template: `${base.origin}${pathBase}/page/{page}.html`,
    }
    searchTemplate = `${base.origin}/index.php/vod/search.html?wd={query}`
  }

  return {
    framework: 'maccms',
    paginationPattern,
    categories: categories.length > 0 ? categories : undefined,
    searchTemplate,
  }
}

type MaccmsVariant = 'classic' | 'wntheme'

function detectMaccmsVariant(html: string): MaccmsVariant {
  if (/\/template\/wntheme\d*\//.test(html) || /var\s+wntheme\s*=/.test(html)) {
    return 'wntheme'
  }
  return 'classic'
}

function extractMaccmsNavCategories(
  html: string,
  pageUrl: string,
  variant: MaccmsVariant,
): { title: string; url: string }[] {
  const results: { title: string; url: string }[] = []
  const seen = new Set<string>()

  const patterns =
    variant === 'wntheme'
      ? [/<a\b[^>]+href=["']([^"']*\/vodtype\/\d+\/)["'][^>]*>([\s\S]*?)<\/a>/gi]
      : [/<a\b[^>]+href=["']([^"']*\/vod\/type\/id\/\d+\.html)["'][^>]*>([\s\S]*?)<\/a>/gi]

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const rawHref = match[1]
      const rawTitle = match[2]?.replace(/<[^>]+>/g, '').trim() ?? ''
      if (!rawTitle || !rawHref) continue
      try {
        const url = new URL(rawHref, pageUrl).href
        if (seen.has(url)) continue
        seen.add(url)
        results.push({ title: rawTitle, url })
      } catch {
        continue
      }
    }
  }

  return results
}
