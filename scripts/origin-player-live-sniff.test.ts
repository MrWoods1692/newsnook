import assert from 'node:assert/strict'

import { reduceLiveObservations } from '../src/features/mediaSniffer/liveCandidate'
import {
  isFloatButtonEligible,
  shouldUseOriginPlayerSurface,
} from '../src/features/mediaSniffer/originPlayerGate'
import type { MediaDescriptor } from '../src/features/mediaSniffer/types'

assert.equal(
  shouldUseOriginPlayerSurface({ sourceId: 'custom_abc', contentType: 'video', platform: 'android' }),
  true,
)
assert.equal(
  shouldUseOriginPlayerSurface({ sourceId: 'netease', contentType: 'video', platform: 'android' }),
  false,
)
assert.equal(
  shouldUseOriginPlayerSurface({ sourceId: 'custom_abc', contentType: 'video', platform: 'web' }),
  false,
)
assert.equal(
  shouldUseOriginPlayerSurface({ sourceId: 'custom_abc', contentType: 'article', platform: 'android' }),
  false,
)

function baseDescriptor(
  overrides: Partial<MediaDescriptor> & Pick<MediaDescriptor, 'type' | 'url'>,
): MediaDescriptor {
  return {
    pageUrl: 'https://play.example/1',
    score: 80,
    videoTracks: [],
    audioTracks: [],
    subtitles: [],
    drm: false,
    drmKeySystems: [],
    ...overrides,
  }
}

const ad = baseDescriptor({
  type: 'progressive',
  url: 'https://cdn.example/ad/preroll.mp4',
  isAd: true,
})
const hls = baseDescriptor({
  type: 'hls',
  url: 'https://cdn.example/index.m3u8',
  isAd: false,
})
const unmarkedAdUrl = baseDescriptor({
  type: 'progressive',
  url: 'https://cdn.example/preroll/spot.mp4',
})
const drmHls = baseDescriptor({
  type: 'hls',
  url: 'https://cdn.example/protected.m3u8',
  drm: true,
})

assert.equal(isFloatButtonEligible(null), false)
assert.equal(isFloatButtonEligible(ad), false)
assert.equal(isFloatButtonEligible(hls), true)
assert.equal(isFloatButtonEligible(unmarkedAdUrl), false)
assert.equal(isFloatButtonEligible(drmHls), false)

const withAdPrimaryResource = baseDescriptor({
  type: 'hls',
  url: 'https://cdn.example/index.m3u8',
  resources: [ad, hls],
})
assert.equal(
  isFloatButtonEligible(withAdPrimaryResource),
  false,
  'resources[0] 为广告时不得亮浮钮',
)

assert.equal(
  reduceLiveObservations([
    {
      url: 'https://cdn.example/ad/preroll.mp4',
      pageUrl: 'https://play.example/1',
      source: 'network',
      mimeType: 'video/mp4',
    },
  ]),
  null,
)
const withHls = reduceLiveObservations([
  {
    url: 'https://cdn.example/ad/preroll.mp4',
    pageUrl: 'https://play.example/1',
    source: 'network',
    mimeType: 'video/mp4',
  },
  {
    url: 'https://cdn.example/index.m3u8',
    pageUrl: 'https://play.example/1',
    source: 'network',
  },
])
assert.equal(withHls?.type, 'hls')
assert.equal(withHls?.url, 'https://cdn.example/index.m3u8')

console.log('origin-player-live-sniff tests passed')
