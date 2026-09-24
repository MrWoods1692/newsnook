/**
 * 国际媒体定制列表解析。
 *
 * 只处理公开列表元数据；正文仍交给 resolveBody / 原站访问控制。
 */

import type { NewsSource } from '../../sources/registry'
import type { Article } from '../types'
import { buildArticle, stripTags } from './shared'

function compactDate(raw: string): string {
  if (!/^\d{8}$/.test(raw)) return ''
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
}

/**
 * 联合早报「国际」公开频道。
 *
 * 官网没有可用的第一方 RSS；列表页是服务端输出的 HTML。
 * 同一篇文章会同时出现图片链接和标题链接，因此按 origin URL 去重。
 */
export function parseZaobao(source: NewsSource, html: string, fetchedAt: number): Article[] {
  const articles: Article[] = []
  const seen = new Set<string>()
  const anchor = /<a\b[^>]*>/gi

  let match: RegExpExecArray | null
  while ((match = anchor.exec(html)) !== null) {
    const tag = match[0]
    const href = tag.match(/\bhref=["'](\/news\/world\/story(\d{8})-\d+[^"']*)["']/i)
    const label = tag.match(/\baria-label=["']([^"']+)["']/i)
    if (!href || !label) continue

    const path = href[1].replace(/&amp;/gi, '&')
    const link = new URL(path, 'https://www.zaobao.com.sg').href
    if (seen.has(link)) continue
    seen.add(link)

    const title = stripTags(label[1])
    if (!title) continue

    const article = buildArticle(
      source,
      {
        title,
        link,
        html: '',
        summaryText: title,
        dateRaw: compactDate(href[2]),
      },
      fetchedAt,
    )
    if (article) articles.push(article)
  }

  return articles
}
