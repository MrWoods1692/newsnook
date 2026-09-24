import assert from 'node:assert/strict'

import { parseSourcePayload } from '../src/lib/parseFeed'
import { CATEGORIES, uncoveredSourceIds } from '../src/sources/categories'
import { normalizeSnapshot } from '../src/sources/presets'
import { normalizePreferences } from '../src/sources/preferences/normalize'
import { findSource } from '../src/sources/registry'

const chineseIds = [
  'bbc-zh',
  'nytimes-zh',
  'rfi-zh',
  'dw-top',
  'ftchinese',
  'zaobao-world',
  'voa-zh',
  'cna-intl-zh',
  'theinitium',
] as const

const englishNewsIds = [
  'bbc-world',
  'dw-en',
  'nytimes-world',
  'wsj-world',
  'nikkei-asia',
  'channelnewsasia-world',
  'scmp-china',
  'scmp-news',
  'npr',
  'guardian-world',
  'france24',
  'aljazeera',
  'gnews-world',
] as const

const englishDepthIds = [
  'foreign-affairs',
  'nyrb',
  'bloomberg-opinion',
  'project-syndicate',
  'sinocism',
] as const

for (const id of [...chineseIds, ...englishNewsIds, ...englishDepthIds]) {
  const source = findSource(id)
  assert.ok(source, `${id} must be registered`)
  assert.equal(source.group, 'intl', `${id} must use intl for proxy/network routing`)
}

assert.equal(findSource('bbc-zh-china')?.id, 'bbc-zh', 'legacy BBC China id should resolve to the canonical source')
assert.equal(findSource('bbc-zh-world')?.id, 'bbc-zh', 'legacy BBC World-Chinese id should resolve to the canonical source')

const migratedPrefs = normalizePreferences({
  categorySources: { intl: ['bbc-zh-world', 'bbc-zh-china', 'bbc-zh'] },
  favoriteSourceIds: ['bbc-zh-world', 'bbc-zh'],
})
assert.deepEqual(migratedPrefs.categorySources.intl, ['bbc-zh'])
assert.deepEqual(migratedPrefs.favoriteSourceIds, ['bbc-zh'])

const migratedSnapshot = normalizeSnapshot({
  categoryOrder: ['intl'],
  hiddenCategoryIds: [],
  categorySources: { intl: ['bbc-zh-china', 'bbc-zh-world'] },
  customCategories: [],
  enabledSourceIds: ['bbc-zh-world'],
  favoriteSourceIds: ['bbc-zh-china'],
})
assert.deepEqual(migratedSnapshot.categorySources.intl, ['bbc-zh'])
assert.deepEqual(migratedSnapshot.enabledSourceIds, ['bbc-zh'])
assert.deepEqual(migratedSnapshot.favoriteSourceIds, ['bbc-zh'])

const dwZh = findSource('dw-top')!
assert.equal(dwZh.kind, 'feed')
assert.equal(dwZh.url, 'https://rss.dw.com/rdf/rss-chi-all')
assert.notEqual(dwZh.url, findSource('dw-en')!.url)

for (const id of ['nytimes-zh', 'rfi-zh', 'ftchinese', 'voa-zh', 'cna-intl-zh'] as const) {
  assert.equal(findSource(id)!.kind, 'feed', `${id} should use the generic first-party feed parser`)
}
assert.equal(findSource('zaobao-world')!.kind, 'zaobao', 'Zaobao has no usable first-party RSS and needs its first-party HTML adapter')

const intlZh = CATEGORIES.find((category) => category.id === 'intl')!
const intlEn = CATEGORIES.find((category) => category.id === 'intl-world')!
const intlDepth = CATEGORIES.find((category) => category.id === 'intl-depth-world')!

assert.equal(intlZh.label, '国际中文')
assert.equal(intlEn.label, '国际英文')
assert.equal(intlDepth.label, '国际英文·深读')

for (const id of chineseIds) assert.ok(intlZh.sourceIds?.includes(id), `${id} must be in 国际中文`)
for (const id of englishNewsIds) assert.ok(intlEn.sourceIds?.includes(id), `${id} must be in 国际英文`)
for (const id of englishDepthIds) assert.ok(intlDepth.sourceIds?.includes(id), `${id} must be in 国际英文·深读`)

assert.ok(!intlZh.sourceIds?.includes('scmp-china'), 'SCMP China is an English China beat, not a Chinese-language source')
assert.ok(!intlEn.sourceIds?.includes('foreign-affairs'), 'general English news must not mix with commentary/think tanks')
assert.ok(!intlDepth.sourceIds?.includes('bbc-world'), 'deep-reading rail must not mix with general news')
assert.deepEqual(uncoveredSourceIds(), [], 'all built-in sources must remain assigned to a category')

const zaobao = findSource('zaobao-world')!
const zaobaoHtml = `
<ul>
  <li>
    <a class="content-image" aria-label="胡塞军事顾问：若美军支持沙特 胡塞将打击美国利益" href="/news/world/story20260924-9726057"></a>
    <a href="/news/world/story20260924-9726057" aria-label="胡塞军事顾问：若美军支持沙特 胡塞将打击美国利益"><h3>duplicate link</h3></a>
  </li>
  <li>
    <a href="/news/world/story20260923-9725921?ref=listing&amp;src=web" aria-label="克宫：将考虑美国邀请普京参加G20峰会一事"></a>
  </li>
</ul>
`
const parsed = parseSourcePayload(zaobao, zaobaoHtml)
assert.equal(parsed.length, 2, 'Zaobao parser should deduplicate repeated image/title anchors')
assert.equal(parsed[0].title, '胡塞军事顾问：若美军支持沙特 胡塞将打击美国利益')
assert.equal(parsed[0].originUrl, 'https://www.zaobao.com.sg/news/world/story20260924-9726057')
assert.equal(new Date(parsed[0].publishedAt).toISOString().slice(0, 10), '2026-09-24')
assert.equal(parsed[0].hasRealDate, true)
assert.equal(
  parsed[1].originUrl,
  'https://www.zaobao.com.sg/news/world/story20260923-9725921?ref=listing&src=web',
)
assert.equal(new Date(parsed[1].publishedAt).toISOString().slice(0, 10), '2026-09-23')

console.log('international-sources: ok')
