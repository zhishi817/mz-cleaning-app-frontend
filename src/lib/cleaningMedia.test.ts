import {
  buildCleaningMediaImageSource,
  cleaningMediaReference,
  normalizeCleaningObjectKey,
  selectCleaningMediaReference,
} from './cleaningMedia'

jest.mock('../config/env', () => ({
  API_BASE_URL: 'https://api.example.com/api',
}))

test('prefers the stable cleaning object key returned by upload', () => {
  expect(cleaningMediaReference({
    key: 'cleaning/photo-1.jpg',
    url: 'https://private.r2.cloudflarestorage.com/bucket/cleaning/photo-1.jpg',
  })).toBe('cleaning/photo-1.jpg')
})

test('builds an authenticated proxy image source for a cleaning object key', () => {
  expect(buildCleaningMediaImageSource('token-1', 'cleaning/photo-1.jpg')).toEqual({
    uri: 'https://api.example.com/api/cleaning-app/media/image?key=cleaning%2Fphoto-1.jpg',
    headers: { Authorization: 'Bearer token-1' },
  })
})

test('keeps local media direct and rejects unsafe cleaning keys', () => {
  expect(buildCleaningMediaImageSource('token-1', 'file:///tmp/photo.jpg')).toEqual({
    uri: 'file:///tmp/photo.jpg',
  })
  expect(normalizeCleaningObjectKey('cleaning/../secret')).toBe('')
})

test('prefers remote media online and falls back to thumbnail offline or after remote failure', () => {
  const base = {
    localUri: null,
    thumbnailUri: 'file:///thumbnail.jpg',
    remoteReference: 'cleaning/photo-1.jpg',
  }
  expect(selectCleaningMediaReference({ ...base, isOnline: true })).toEqual({
    reference: 'cleaning/photo-1.jpg',
    kind: 'remote',
  })
  expect(selectCleaningMediaReference({ ...base, isOnline: false })).toEqual({
    reference: 'file:///thumbnail.jpg',
    kind: 'thumbnail',
  })
  expect(selectCleaningMediaReference({ ...base, isOnline: true, remoteFailed: true })).toEqual({
    reference: 'file:///thumbnail.jpg',
    kind: 'thumbnail',
  })
})
