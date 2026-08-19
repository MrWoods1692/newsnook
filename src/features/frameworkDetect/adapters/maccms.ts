import type { FrameworkHint } from '../types'

export function detectMaccms(html: string, pageUrl: string): FrameworkHint | null {
  if (!/var\s+maccms\s*=/.test(html)) return null

  const categories = extractMaccmsNavCategories(html, pageUrl)

  const base = new URL(pageUrl)
  const pathBase = base.pathname.replace(/\.html$/i, '')
  const template = `${base.origin}${pathBase}/page/{page}.html`

  return {
    framework: 'maccms',
    paginationPattern: { kind: 'path-segment', template },
    categories: categories.length > 0 ? categories : undefined,
    searchTemplate: `${base.origin}/index.php/vod/search.html?wd={query}`,
  }
}

function extractMaccmsNavCategories(
  html: string,
  pageUrl: string,
): { title: string; url: string }[] {
  const results: { title: string; url: string }[] = []
  const seen = new Set<string>()

  for (const match of html.matchAll(
    /<a\b[^>]+href=["']([^"']*\/vod\/type\/id\/\d+\.html)["'][^>]*>([\s\S]*?)<\/a>/gi,
  )) {
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

  return results
}
