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

test('adds a separate server-side image variant for thumbnails and previews', () => {
  expect(buildCleaningMediaImageSource('token-1', 'cleaning/photo-1.jpg', 'thumbnail')).toEqual({
    uri: 'https://api.example.com/api/cleaning-app/media/image?key=cleaning%2Fphoto-1.jpg&variant=thumbnail',
    headers: { Authorization: 'Bearer token-1' },
  })
  expect(buildCleaningMediaImageSource('token-1', 'cleaning/photo-1.jpg', 'preview')).toEqual({
    uri: 'https://api.example.com/api/cleaning-app/media/image?key=cleaning%2Fphoto-1.jpg&variant=preview',
    headers: { Authorization: 'Bearer token-1' },
  })
})

test('binds feedback-media reads to the current task source', () => {
  expect(buildCleaningMediaImageSource('token-1', 'cleaning/photo-1.jpg', 'thumbnail', { accessTaskId: 'cleaning-task-1' })).toEqual({
    uri: 'https://api.example.com/api/cleaning-app/media/image?key=cleaning%2Fphoto-1.jpg&variant=thumbnail&source_task_id=cleaning-task-1',
    headers: { Authorization: 'Bearer token-1' },
  })
})

test('binds maintenance feedback-media reads to the current work task', () => {
  expect(buildCleaningMediaImageSource('token-1', 'mzapp/photo-1.jpg', 'thumbnail', { accessWorkTaskId: 'property_maintenance:record-1' })).toEqual({
    uri: 'https://api.example.com/api/cleaning-app/media/image?key=mzapp%2Fphoto-1.jpg&variant=thumbnail&work_task_id=property_maintenance%3Arecord-1',
    headers: { Authorization: 'Bearer token-1' },
  })
})

test('routes a server-owned offline task reference through the authenticated proxy with the exact work task', () => {
  const reference = 'r2://bucket-0123456789abcdef/mzapp/offline-task-photo.jpg'
  expect(buildCleaningMediaImageSource('token-1', reference, 'thumbnail', { accessWorkTaskId: 'cleaning_offline_tasks:task-1' })).toEqual({
    uri: 'https://api.example.com/api/cleaning-app/media/image?url=r2%3A%2F%2Fbucket-0123456789abcdef%2Fmzapp%2Foffline-task-photo.jpg&variant=thumbnail&work_task_id=cleaning_offline_tasks%3Atask-1',
    headers: { Authorization: 'Bearer token-1' },
  })
})

test('routes a historical offline task URL through the authenticated proxy only with explicit offline task context', () => {
  const reference = 'https://current-public-base.r2.dev/historical/offline-task-photo.jpg'
  expect(buildCleaningMediaImageSource('token-1', reference, 'thumbnail', {
    accessWorkTaskId: 'cleaning_offline_tasks:task-1',
    offlineWorkTaskMedia: true,
  })).toEqual({
    uri: 'https://api.example.com/api/cleaning-app/media/image?url=https%3A%2F%2Fcurrent-public-base.r2.dev%2Fhistorical%2Foffline-task-photo.jpg&variant=thumbnail&work_task_id=cleaning_offline_tasks%3Atask-1',
    headers: { Authorization: 'Bearer token-1' },
  })
  expect(buildCleaningMediaImageSource('token-1', reference, 'thumbnail', {
    accessWorkTaskId: 'cleaning_offline_tasks:task-1',
  })).toEqual({ uri: reference })
})

test('routes legacy mzapp feedback media through the authenticated feedback proxy', () => {
  const url = 'https://media.r2.dev/mzapp/photo-1.jpg'
  expect(buildCleaningMediaImageSource('token-1', url, 'preview', { accessTaskId: 'cleaning-task-1' })).toEqual({
    uri: 'https://api.example.com/api/cleaning-app/media/image?url=https%3A%2F%2Fmedia.r2.dev%2Fmzapp%2Fphoto-1.jpg&variant=preview&source_task_id=cleaning-task-1',
    headers: { Authorization: 'Bearer token-1' },
  })
  expect(buildCleaningMediaImageSource('token-1', 'mzapp/photo-1.jpg', 'thumbnail', { accessTaskId: 'cleaning-task-1' })).toEqual({
    uri: 'https://api.example.com/api/cleaning-app/media/image?key=mzapp%2Fphoto-1.jpg&variant=thumbnail&source_task_id=cleaning-task-1',
    headers: { Authorization: 'Bearer token-1' },
  })
})

test('routes web-maintenance feedback media through the authenticated feedback proxy', () => {
  expect(buildCleaningMediaImageSource('token-1', 'maintenance/before-photo.jpg', 'thumbnail')).toEqual({
    uri: 'https://api.example.com/api/cleaning-app/media/image?key=maintenance%2Fbefore-photo.jpg&variant=thumbnail',
    headers: { Authorization: 'Bearer token-1' },
  })
  expect(buildCleaningMediaImageSource('token-1', 'https://media.r2.dev/maintenance/after-photo.jpg', 'preview')).toEqual({
    uri: 'https://api.example.com/api/cleaning-app/media/image?url=https%3A%2F%2Fmedia.r2.dev%2Fmaintenance%2Fafter-photo.jpg&variant=preview',
    headers: { Authorization: 'Bearer token-1' },
  })
})

test('keeps local media direct and rejects unsafe cleaning keys', () => {
  expect(buildCleaningMediaImageSource('token-1', 'file:///tmp/photo.jpg')).toEqual({
    uri: 'file:///tmp/photo.jpg',
  })
  expect(normalizeCleaningObjectKey('cleaning/../secret')).toBe('')
  expect(buildCleaningMediaImageSource('token-1', 'mzapp/../secret')).toEqual({ uri: 'mzapp/../secret' })
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
