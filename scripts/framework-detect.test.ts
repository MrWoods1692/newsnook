import assert from 'node:assert/strict'

import type { FrameworkHint, PaginationPattern } from '../src/features/frameworkDetect/types'
import { frameworkPageUrl } from '../src/features/frameworkDetect/buildPageUrl'
import { detectFramework } from '../src/features/frameworkDetect/detect'

console.log('Testing frameworkPageUrl...')

// query-param: page 0 → no param; page 1 → ?paged=2
const qp: PaginationPattern = { kind: 'query-param', param: 'paged' }
assert.equal(
  frameworkPageUrl('https://example.com/', 0, qp),
  'https://example.com/',
)
assert.equal(
  frameworkPageUrl('https://example.com/', 1, qp),
  'https://example.com/?paged=2',
)
assert.equal(
  frameworkPageUrl('https://example.com/?paged=5', 3, qp),
  'https://example.com/?paged=4',
)

// path-segment
const ps: PaginationPattern = {
  kind: 'path-segment',
  template: 'https://example.com/vod/type/id/1/page/{page}.html',
}
assert.equal(
  frameworkPageUrl('https://example.com/vod/type/id/1.html', 0, ps),
  'https://example.com/vod/type/id/1.html',
)
assert.equal(
  frameworkPageUrl('https://example.com/vod/type/id/1.html', 1, ps),
  'https://example.com/vod/type/id/1/page/2.html',
)
assert.equal(
  frameworkPageUrl('https://example.com/vod/type/id/1.html', 4, ps),
  'https://example.com/vod/type/id/1/page/5.html',
)

// next-link: always returns baseUrl
const nl: PaginationPattern = { kind: 'next-link' }
assert.equal(
  frameworkPageUrl('https://example.com/blog', 5, nl),
  'https://example.com/blog',
)

console.log('✓ frameworkPageUrl tests passed')

// --- MacCMS ---
console.log('Testing MacCMS detection...')
const maccmsHtml = `<html><head><title>Test</title></head><body>
<script>var maccms={"path":"","mid":"","url":"example.com"};</script>
<ul>
<li><a href="/index.php/vod/type/id/1.html">中文字幕</a></li>
<li><a href="/index.php/vod/type/id/2.html">日韩有码</a></li>
<li><a href="/index.php/vod/type/id/4.html">国产</a></li>
</ul>
</body></html>`

const maccms = detectFramework(maccmsHtml, 'https://example.com/index.php')
assert.ok(maccms, 'should detect MacCMS')
assert.equal(maccms!.framework, 'maccms')
assert.equal(maccms!.paginationPattern.kind, 'path-segment')
assert.ok(maccms!.categories && maccms!.categories.length >= 3, 'should find categories')
assert.ok(maccms!.searchTemplate?.includes('{query}'), 'should have search template')
console.log('✓ MacCMS detection passed')

// --- WordPress ---
console.log('Testing WordPress detection...')
const wpHtml = `<html><head>
<meta name="generator" content="WordPress 6.5" />
</head><body><p>Hello</p></body></html>`

const wp = detectFramework(wpHtml, 'https://blog.example.com/')
assert.ok(wp, 'should detect WordPress')
assert.equal(wp!.framework, 'wordpress')
assert.ok(wp!.searchTemplate?.includes('{query}'), 'should have search template')
console.log('✓ WordPress detection passed')

// wp-content fallback
const wpHtml2 = `<html><head></head><body>
<link rel="stylesheet" href="/wp-content/themes/flavor/style.css">
</body></html>`
const wp2 = detectFramework(wpHtml2, 'https://blog2.example.com/')
assert.ok(wp2, 'should detect WordPress via wp-content')
assert.equal(wp2!.framework, 'wordpress')
console.log('✓ WordPress wp-content fallback passed')

// --- Hugo ---
console.log('Testing Hugo detection...')
const hugoHtml = `<html><head>
<meta name="generator" content="Hugo 0.128.0">
</head><body>
<nav><a href="/categories/">Categories</a><a href="/tags/">Tags</a></nav>
</body></html>`

const hugo = detectFramework(hugoHtml, 'https://hugo.example.com/')
assert.ok(hugo, 'should detect Hugo')
assert.equal(hugo!.framework, 'hugo')
assert.equal(hugo!.paginationPattern.kind, 'path-segment')
assert.ok(hugo!.categories && hugo!.categories.length >= 1, 'should find categories/tags links')
assert.equal(hugo!.searchTemplate, undefined, 'Hugo has no search')
console.log('✓ Hugo detection passed')

// --- Hexo ---
console.log('Testing Hexo detection...')
const hexoHtml = `<html><head>
<meta name="generator" content="Hexo 7.0.0">
</head><body>
<nav><a href="/categories/">分类</a></nav>
</body></html>`

const hexo = detectFramework(hexoHtml, 'https://hexo.example.com/')
assert.ok(hexo, 'should detect Hexo')
assert.equal(hexo!.framework, 'hexo')
assert.equal(hexo!.paginationPattern.kind, 'path-segment')
console.log('✓ Hexo detection passed')

// --- Ghost ---
console.log('Testing Ghost detection...')
const ghostHtml = `<html><head>
<meta name="generator" content="Ghost 5.87">
</head><body></body></html>`

const ghost = detectFramework(ghostHtml, 'https://ghost.example.com/')
assert.ok(ghost, 'should detect Ghost')
assert.equal(ghost!.framework, 'ghost')
assert.equal(ghost!.paginationPattern.kind, 'path-segment')
console.log('✓ Ghost detection passed')

// --- Generic rel=next ---
console.log('Testing generic rel=next detection...')
const nextHtml = `<html><head>
<link rel="next" href="https://other.com/articles?page=2">
</head><body></body></html>`

const generic = detectFramework(nextHtml, 'https://other.com/articles')
assert.ok(generic, 'should detect generic next-link')
assert.equal(generic!.framework, 'generic')
assert.equal(generic!.paginationPattern.kind, 'next-link')
console.log('✓ Generic rel=next detection passed')

// --- No framework ---
console.log('Testing no-framework fallback...')
const plainHtml = `<html><head><title>Plain</title></head><body><p>Hello</p></body></html>`
const none = detectFramework(plainHtml, 'https://plain.example.com/')
assert.equal(none, null, 'should return null for unrecognized HTML')
console.log('✓ No-framework fallback passed')
