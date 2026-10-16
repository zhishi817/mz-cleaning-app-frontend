import AsyncStorage from '@react-native-async-storage/async-storage'
import { getJson, isStorageFullError, setJson } from './storage'

beforeEach(async () => {
  jest.restoreAllMocks()
  await AsyncStorage.clear()
})

async function setPairs(pairs: [string, string][]) {
  for (const [key, value] of pairs) await AsyncStorage.setItem(key, value)
}

test('recognizes Android SQLite full errors without classifying unrelated failures', () => {
  expect(isStorageFullError(new Error('database or disk is full (code 13 SQLITE_FULL)'))).toBe(true)
  expect(isStorageFullError({ code: 'SQLITE_FULL', message: 'write failed' })).toBe(true)
  expect(isStorageFullError(new Error('network timeout'))).toBe(false)
})

test('reclaims only downloadable caches and retries a durable write once after SQLITE_FULL', async () => {
  const workCache = 'mzstay.work_tasks.store.v1:old-range'
  const legacyCache = 'mzstay.tasks.store.v2:old-range'
  const queueKey = 'mzstay.inspection_media_queue.v1'
  const draftKey = 'mzstay.inspection_panel_draft.v2:task-1'
  await setPairs([
    [workCache, JSON.stringify({ updatedAt: '2026-01-01T00:00:00.000Z', items: [{ id: 'downloadable' }] })],
    [legacyCache, JSON.stringify({ updatedAt: '2026-01-01T00:00:00.000Z', items: [{ id: 'legacy' }] })],
    [queueKey, JSON.stringify([{ id: 'queued-video' }])],
  ])
  const setSpy = jest.spyOn(AsyncStorage, 'setItem')
    .mockRejectedValueOnce(new Error('database or disk is full (code 13 SQLITE_FULL)'))
    .mockResolvedValueOnce(undefined)
  setSpy.mockClear()

  await setJson(draftKey, { task_id: 'task-1', room_photos: [] })

  expect(setSpy).toHaveBeenCalledTimes(2)
  expect(await AsyncStorage.getItem(workCache)).toBeNull()
  expect(await AsyncStorage.getItem(legacyCache)).toBeNull()
  expect(await getJson(queueKey)).toEqual([{ id: 'queued-video' }])
  expect(setSpy).toHaveBeenLastCalledWith(draftKey, JSON.stringify({ task_id: 'task-1', room_photos: [] }))
})

test('does not retry non-capacity writes or hide SQLITE_FULL when no cache can be reclaimed', async () => {
  const networkError = new Error('write unavailable')
  jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(networkError)
  await expect(setJson('mzstay.inspection_media_queue.v1', [])).rejects.toBe(networkError)

  jest.restoreAllMocks()
  const fullError = new Error('SQLITE_FULL')
  const setSpy = jest.spyOn(AsyncStorage, 'setItem').mockRejectedValue(fullError)
  setSpy.mockClear()
  await expect(setJson('mzstay.inspection_media_queue.v1', [])).rejects.toBe(fullError)
  expect(setSpy).toHaveBeenCalledTimes(1)
})

test('preserves the original SQLITE_FULL error when cache inventory itself cannot be read', async () => {
  const fullError = new Error('database or disk is full (code 13 SQLITE_FULL)')
  const setSpy = jest.spyOn(AsyncStorage, 'setItem').mockRejectedValue(fullError)
  const keysSpy = jest.spyOn(AsyncStorage, 'getAllKeys').mockRejectedValueOnce(new Error('inventory unavailable'))
  setSpy.mockClear()
  keysSpy.mockClear()

  await expect(setJson('mzstay.inspection_media_queue.v1', [])).rejects.toBe(fullError)
  expect(keysSpy).toHaveBeenCalledTimes(1)
  expect(setSpy).toHaveBeenCalledTimes(1)
})
