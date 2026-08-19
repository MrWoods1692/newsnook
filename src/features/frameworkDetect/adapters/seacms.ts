import type { FrameworkHint, FrameworkSortOption } from '../types'
import { extractCategoryLinks } from './shared'

const SEACMS_SORT_OPTIONS: FrameworkSortOption[] = [
  { key: 'default', label: '默认' },
  { key: 'time', label: '更新' },
  { key: 'hits', label: '热度' },
  { key: 'score', label: '评分' },
]

/**
 * 海洋CMS (SeaCMS) — 中文视频站常用 CMS。
 *
 * 探测信号：页面中含 `Powered by SeaCMS` / `seacms.js` 引用 /
 *           全局变量 `var player_` 配合 `/js/player` 脚本路径。
 *
 * 默认 URL 规则：
 *   分类列表  /type/ID.html       翻页 /type/ID-PAGE.html
 *   搜索      /search.php?searchword={query}
 */
export function detectSeacms(html: string, pageUrl: string): FrameworkHint | null {
  const hasSignal =
    /Powered\s+by\s+SeaCMS/i.test(html) ||
    /seacms/i.test(html) && /\/js\/player/i.test(html) ||
    /var\s+player_\w+\s*=/.test(html) && /seacms/i.test(html)

  if (!hasSignal) return null

  const base = new URL(pageUrl)
  const themeVariant = detectSeacmsThemeVariant(html)
  const categories = extractSeacmsCategories(html, pageUrl)

  return {
    framework: 'seacms',
    themeVariant,
    paginationPattern: {
      kind: 'path-segment',
      template: `${base.origin}${base.pathname.replace(/\.html$/i, '')}/page/{page}.html`,
    },
    categories: categories.length > 0 ? categories : undefined,
    searchTemplate: `${base.origin}/search.php?searchword={query}`,
    sortOptions: SEACMS_SORT_OPTIONS,
  }
}

function detectSeacmsThemeVariant(html: string): string | undefined {
  if (/\/template\/vfed\//i.test(html) || /fed-list-info|fed-navs/i.test(html)) {
    return 'vfed'
  }
  if (/\/template\/stui\//i.test(html) || /stui-header__menu/i.test(html)) {
    return 'stui'
  }
  if (/\/template\/conch\//i.test(html) || /hl-vod-list|hl-nav/i.test(html)) {
    return 'conch'
  }
  if (/\/template\/default\//i.test(html)) {
    return 'default'
  }
  return undefined
}

function extractSeacmsCategories(
  html: string,
  pageUrl: string,
): { title: string; url: string }[] {
  // SeaCMS 分类链接常见格式：/type/ID.html 或 /video/type/id/ID.html
  return extractCategoryLinks(html, pageUrl, [
    /<a\b[^>]+href=["']([^"']*\/type\/\d+\.html)["'][^>]*>([\s\S]*?)<\/a>/gi,
    /<a\b[^>]+href=["']([^"']*\/video\/type\/id\/\d+\.html)["'][^>]*>([\s\S]*?)<\/a>/gi,
    /<a\b[^>]+href=["']([^"']*\/list\/?[^"']+\.html)["'][^>]*>([\s\S]*?)<\/a>/gi,
  ])
}
