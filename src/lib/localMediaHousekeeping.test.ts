/* eslint-disable import/first */
import AsyncStorage from '@react-native-async-storage/async-storage'

const mockRecoverySnapshots = jest.fn()

jest.mock('./inspectionPanelDraftRecovery', () => ({
  listInspectionPanelDraftRecoverySnapshots: (...args: any[]) => mockRecoverySnapshots(...args),
}))

import { collectLocalFileUris, collectProtectedLocalMediaUris, selectOrphanLocalMediaFilesToDelete } from './localMediaHousekeeping'

beforeEach(async () => {
  jest.restoreAllMocks()
  await AsyncStorage.clear()
  mockRecoverySnapshots.mockReset()
  mockRecoverySnapshots.mockResolvedValue([])
})

test('collects local file references from nested queue snapshots', () => {
  const refs = collectLocalFileUris({
    a: 'file:///documents/mzstay-inspection-media/a.jpg',
    b: ['https://cdn.example.com/b.jpg', { c: 'file:///documents/mzstay-key-uploads/key.jpg' }],
    d: null,
  })

  expect(Array.from(refs).sort()).toEqual([
    'file:///documents/mzstay-inspection-media/a.jpg',
    'file:///documents/mzstay-key-uploads/key.jpg',
  ])
})

test('selects only old unreferenced local media files for orphan cleanup', () => {
  const now = Date.parse('2026-07-04T04:00:00.000Z')
  const protectedUris = new Set(['file:///documents/mzstay-inspection-media/protected.jpg'])

  expect(selectOrphanLocalMediaFilesToDelete([
    { uri: 'file:///documents/mzstay-inspection-media/protected.jpg', modificationTime: now - 10 * 24 * 60 * 60 * 1000 },
    { uri: 'file:///documents/mzstay-inspection-media/fresh.jpg', modificationTime: now - 60 * 60 * 1000 },
    { uri: 'file:///documents/mzstay-inspection-media/missing-time.jpg', modificationTime: null },
    { uri: 'https://cdn.example.com/remote.jpg', modificationTime: now - 10 * 24 * 60 * 60 * 1000 },
    { uri: 'file:///documents/mzstay-inspection-media/orphan.jpg', modificationTime: now - 2 * 24 * 60 * 60 * 1000 },
  ], protectedUris, now, 24 * 60 * 60 * 1000)).toEqual([
    'file:///documents/mzstay-inspection-media/orphan.jpg',
  ])
})

test('protects local media referenced only by a filesystem recovery snapshot', async () => {
  mockRecoverySnapshots.mockResolvedValue([{ draft: { room_photos: { living: [{ local_uri: 'file:///documents/recovered.jpg' }] } } }])

  await expect(collectProtectedLocalMediaUris()).resolves.toEqual(new Set(['file:///documents/recovered.jpg']))
})

test('fails closed when any durable reference cannot be read or parsed', async () => {
  const queueKey = 'mzstay.inspection_media_queue.v1'
  await AsyncStorage.setItem(queueKey, '{invalid-json')
  await expect(collectProtectedLocalMediaUris()).rejects.toThrow('LOCAL_MEDIA_REFERENCE_CORRUPT')

  await AsyncStorage.clear()
  await AsyncStorage.setItem(queueKey, JSON.stringify([{ local_uri: 'file:///documents/queued.mov' }]))
  const getItem = jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('read failed'))
  await expect(collectProtectedLocalMediaUris()).rejects.toThrow('read failed')
  expect(getItem).toHaveBeenCalledWith(queueKey)

  jest.restoreAllMocks()
  mockRecoverySnapshots.mockRejectedValueOnce(new Error('recovery snapshot unreadable'))
  await expect(collectProtectedLocalMediaUris()).rejects.toThrow('recovery snapshot unreadable')
})
