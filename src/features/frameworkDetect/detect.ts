import { detectMaccms } from './adapters/maccms'
import { detectWordpress } from './adapters/wordpress'
import { detectHugo } from './adapters/hugo'
import { detectHexo } from './adapters/hexo'
import { detectGhost } from './adapters/ghost'
import { detectGenericNextLink } from './adapters/generic'
import type { FrameworkHint } from './types'

export function detectFramework(html: string, pageUrl: string): FrameworkHint | null {
  return (
    detectMaccms(html, pageUrl) ??
    detectWordpress(html, pageUrl) ??
    detectHugo(html, pageUrl) ??
    detectHexo(html, pageUrl) ??
    detectGhost(html, pageUrl) ??
    detectGenericNextLink(html, pageUrl) ??
    null
  )
}
