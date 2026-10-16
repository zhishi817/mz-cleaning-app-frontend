import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  isDownloadableTaskCacheKey,
  pruneDownloadableTaskCaches,
  utf8ByteLength,
} from './downloadableCacheMaintenance'

beforeEach(async () => {
  await AsyncStorage.clear()
})

function cacheValue(updatedAt: string, payload = '') {
  return JSON.stringify({ updatedAt, items: [{ id: payload }] })
}

async function setPairs(pairs: [string, string][]) {
  for (const [key, value] of pairs) await AsyncStorage.setItem(key, value)
}

test('recognizes only explicitly downloadable task cache keys', () => {
  expect(isDownloadableTaskCacheKey('mzstay.work_tasks.store.v1:prod:user:today')).toBe(true)
  expect(isDownloadableTaskCacheKey('mzstay.tasks.store.v2:legacy')).toBe(true)
  expect(isDownloadableTaskCacheKey('mzstay.inspection_media_queue.v1')).toBe(false)
  expect(isDownloadableTaskCacheKey('mzstay.inspection_panel_draft.v2:task-1')).toBe(false)
})

test('measures utf8 bytes without treating unicode as one byte', () => {
  expect(utf8ByteLength('abc')).toBe(3)
  expect(utf8ByteLength('照片')).toBe(6)
  expect(utf8ByteLength('🎥')).toBe(4)
})

test('removes expired and oldest downloadable buckets while preserving drafts, queues and protected bucket', async () => {
  const oldWork = 'mzstay.work_tasks.store.v1:old'
  const middleWork = 'mzstay.work_tasks.store.v1:middle'
  const currentWork = 'mzstay.work_tasks.store.v1:current'
  const legacy = 'mzstay.tasks.store.v2:legacy'
  const draft = 'mzstay.inspection_panel_draft.v2:task-1'
  const queue = 'mzstay.inspection_media_queue.v1'
  await setPairs([
    [oldWork, cacheValue('2026-09-01T00:00:00.000Z', 'old')],
    [middleWork, cacheValue('2026-10-13T00:00:00.000Z', 'middle')],
    [currentWork, cacheValue('2026-10-15T00:00:00.000Z', 'current')],
    [legacy, cacheValue('2026-10-14T00:00:00.000Z', 'legacy')],
    [draft, JSON.stringify({ task_id: 'task-1', room_photos: [{ local_uri: 'file:///draft.jpg' }] })],
    [queue, JSON.stringify([{ id: 'media-1', local_uri: 'file:///video.mov' }])],
  ])

  const result = await pruneDownloadableTaskCaches({
    now: Date.parse('2026-10-15T12:00:00.000Z'),
    maxAgeMs: 14 * 24 * 60 * 60 * 1000,
    maxEntries: 2,
    maxBytes: 1024 * 1024,
    protectedKeys: [currentWork],
  })

  expect(result.removedKeys.sort()).toEqual([middleWork, oldWork].sort())
  expect(await AsyncStorage.getItem(currentWork)).toBeTruthy()
  expect(await AsyncStorage.getItem(legacy)).toBeTruthy()
  expect(await AsyncStorage.getItem(draft)).toBeTruthy()
  expect(await AsyncStorage.getItem(queue)).toBeTruthy()
})

test('aggressive reclaim removes all downloadable caches but never unknown durable data', async () => {
  const work = 'mzstay.work_tasks.store.v1:one'
  const legacy = 'mzstay.tasks.store.v2:two'
  const durable = 'mzstay.day_end_handover_queue.v2'
  await setPairs([
    [work, cacheValue('2026-10-15T00:00:00.000Z')],
    [legacy, cacheValue('2026-10-15T00:00:00.000Z')],
    [durable, JSON.stringify([{ id: 'keep-me' }])],
  ])

  const result = await pruneDownloadableTaskCaches({ aggressive: true })

  expect(result.removedKeys.sort()).toEqual([legacy, work].sort())
  expect(await AsyncStorage.getItem(work)).toBeNull()
  expect(await AsyncStorage.getItem(legacy)).toBeNull()
  expect(await AsyncStorage.getItem(durable)).toBeTruthy()
})
