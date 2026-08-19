import type { FrameworkHint, FrameworkSortOption } from '../types'
import { extractCategoryLinks } from './shared'

const FYFCMS_SORT_OPTIONS: FrameworkSortOption[] = [
  { key: 'default', label: '默认' },
  { key: 'time', label: '更新' },
  { key: 'hits', label: '热度' },
  { key: 'score', label: '评分' },
]

/**
 * 飞飞CMS (FYFCMS) — 老牌中文视频 CMS。
 *
 * 探测信号：模板路径含 `/template/feifeicms/` 或 JS 中含 `fyfcms` /
 *           全局变量 `var cms_player`。
 *
 * 默认 URL 规则：
 *   分类列表  index.php?s=/vod-show-id-ID.html
 *   翻页      index.php?s=/vod-show-id-ID-p-PAGE.html
 *   搜索      index.php?s=/vod-search-wd-{query}.html
 */
export function detectFyfcms(html: string, pageUrl: string): FrameworkHint | null {
  const hasSignal =
    /\/template\/feifeicms\//i.test(html) ||
    /var\s+cms_player\s*=/.test(html) ||
    /fyfcms/i.test(html) && /ff_url/i.test(html)

  if (!hasSignal) return null

  const base = new URL(pageUrl)
  const themeVariant = detectFyfcmsThemeVariant(html)
  const categories = extractFyfcmsCategories(html, pageUrl)

  return {
    framework: 'fyfcms',
    themeVariant,
    paginationPattern: {
      kind: 'path-segment',
      template: `${base.origin}/index.php?s=/vod-show-id-0-p-{page}.html`,
    },
    categories: categories.length > 0 ? categories : undefined,
    searchTemplate: `${base.origin}/index.php?s=/vod-search-wd-{query}.html`,
    sortOptions: FYFCMS_SORT_OPTIONS,
  }
}

function detectFyfcmsThemeVariant(html: string): string | undefined {
  const pathMatch = html.match(/\/template\/feifeicms\/([^/"']+)\//i)
  if (pathMatch?.[1]) return pathMatch[1].toLowerCase()
  if (/stui-header__menu/i.test(html)) return 'stui-like'
  return undefined
}

function extractFyfcmsCategories(
  html: string,
  pageUrl: string,
): { title: string; url: string }[] {
  // 飞飞CMS 分类链接：/index.php?s=/vod-show-id-ID.html 或伪静态 /video/channel/ID
  return extractCategoryLinks(html, pageUrl, [
    /<a\b[^>]+href=["']([^"']*\/vod-show-id-\d+\.html)["'][^>]*>([\s\S]*?)<\/a>/gi,
    /<a\b[^>]+href=["']([^"']*index\.php\?s=\/vod-show-id-\d+\.html)["'][^>]*>([\s\S]*?)<\/a>/gi,
    /<a\b[^>]+href=["']([^"']*\/video\/channel\/\d+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    /<a\b[^>]+href=["']([^"']*\/vod-type-id-\d+\.html)["'][^>]*>([\s\S]*?)<\/a>/gi,
  ])
}
