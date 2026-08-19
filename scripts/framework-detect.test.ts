import assert from 'node:assert/strict'

import type { FrameworkHint, PaginationPattern } from '../src/features/frameworkDetect/types'
import { frameworkPageUrl } from '../src/features/frameworkDetect/buildPageUrl'

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
