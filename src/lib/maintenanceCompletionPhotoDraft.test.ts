import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  clearMaintenanceCompletionPhotoDraft,
  createMaintenanceCompletionPhotoMediaId,
  getMaintenanceCompletionPhotoDraft,
  removeMaintenanceCompletionPhotoDraft,
  setMaintenanceCompletionPhotoDraft,
} from './maintenanceCompletionPhotoDraft'
import { deleteDraftMedia } from './localMediaDrafts'

jest.mock('./localMediaDrafts', () => ({
  draftFileExists: jest.fn(() => true),
  deleteDraftMedia: jest.fn(),
}))

beforeEach(async () => {
  await AsyncStorage.clear()
  jest.mocked(deleteDraftMedia).mockClear()
})
test('persists a maintenance completion photo before business save and restores its remote reference', async () => {
  const mediaId = createMaintenanceCompletionPhotoMediaId()
  await setMaintenanceCompletionPhotoDraft('property_maintenance:record-1', 'executor-1', [{
    media_id: mediaId,
    local_uri: 'file:///documents/maintenance-photo.jpg',
    remote_reference: 'https://private.example/mzapp/maintenance-photo.jpg',
    name: 'maintenance-photo.jpg',
    mime_type: 'image/jpeg',
    captured_at: '2026-08-08T00:00:00.000Z',
    upload_state: 'remote_stored',
    error_code: null,
  }])

  await expect(getMaintenanceCompletionPhotoDraft('property_maintenance:record-1', 'executor-1')).resolves.toEqual([
    expect.objectContaining({
      media_id: mediaId,
      local_uri: 'file:///documents/maintenance-photo.jpg',
      remote_reference: 'https://private.example/mzapp/maintenance-photo.jpg',
      upload_state: 'remote_stored',
    }),
  ])
})

test('removing or clearing an unsynced maintenance draft cleans only its owned local copy', async () => {
  const first = createMaintenanceCompletionPhotoMediaId()
  const second = createMaintenanceCompletionPhotoMediaId()
  await setMaintenanceCompletionPhotoDraft('property_maintenance:record-2', 'executor-2', [
    {
      media_id: first,
      local_uri: 'file:///documents/first.jpg',
      remote_reference: null,
      name: 'first.jpg',
      mime_type: 'image/jpeg',
      captured_at: '2026-08-08T00:00:00.000Z',
      upload_state: 'local_persisted',
      error_code: null,
    },
    {
      media_id: second,
      local_uri: 'file:///documents/second.jpg',
      remote_reference: null,
      name: 'second.jpg',
      mime_type: 'image/jpeg',
      captured_at: '2026-08-08T00:00:00.000Z',
      upload_state: 'local_persisted',
      error_code: null,
    },
  ])

  await removeMaintenanceCompletionPhotoDraft('property_maintenance:record-2', 'executor-2', first)
  expect(deleteDraftMedia).toHaveBeenCalledWith('file:///documents/first.jpg')
  await clearMaintenanceCompletionPhotoDraft('property_maintenance:record-2', 'executor-2', { deleteLocalFiles: true })
  expect(deleteDraftMedia).toHaveBeenCalledWith('file:///documents/second.jpg')
  await expect(getMaintenanceCompletionPhotoDraft('property_maintenance:record-2', 'executor-2')).resolves.toEqual([])
})


test('deep-cleaning draft cleanup cannot clear another source or another owner', async () => {
  const photo = { media_id: 'isolated', local_uri: 'file:///documents/deep-only.jpg', remote_reference: 'mzapp/deep-only.jpg', name: 'deep.jpg', mime_type: 'image/jpeg', captured_at: '', upload_state: 'remote_stored' as const, error_code: null }
  await setMaintenanceCompletionPhotoDraft('property_deep_cleaning:same-id', 'owner-a', [photo])
  await setMaintenanceCompletionPhotoDraft('property_maintenance:same-id', 'owner-a', [{ ...photo, local_uri: 'file:///documents/maintenance-only.jpg' }])
  await setMaintenanceCompletionPhotoDraft('property_deep_cleaning:same-id', 'owner-b', [{ ...photo, local_uri: 'file:///documents/other-owner.jpg' }])
  await clearMaintenanceCompletionPhotoDraft('property_deep_cleaning:same-id', 'owner-a', { deleteLocalFiles: true })
  expect(await getMaintenanceCompletionPhotoDraft('property_maintenance:same-id', 'owner-a')).toHaveLength(1)
  expect(await getMaintenanceCompletionPhotoDraft('property_deep_cleaning:same-id', 'owner-b')).toHaveLength(1)
})

test('deep before draft key separates task, source and completion phase', () => {
  const { deepCleaningBeforeDraftKey } = require('./deepCleaningCompletion')
  const before = deepCleaningBeforeDraftKey('work-1', 'source-1')
  expect(before).not.toBe('work-1')
  expect(before).not.toBe(deepCleaningBeforeDraftKey('work-1', 'source-2'))
  expect(before).not.toBe(deepCleaningBeforeDraftKey('work-2', 'source-1'))
})

test('clearing before evidence preserves after phase, another owner and another source', async () => {
  const { deepCleaningBeforeDraftKey } = require('./deepCleaningCompletion')
  const key = deepCleaningBeforeDraftKey('work-1', 'source-1')
  const other = deepCleaningBeforeDraftKey('work-1', 'source-2')
  const photo = { media_id: 'before', local_uri: 'file:///documents/before.jpg', remote_reference: 'mzapp/before.jpg', name: 'before.jpg', mime_type: 'image/jpeg', captured_at: '', upload_state: 'remote_stored' as const, error_code: null }
  await setMaintenanceCompletionPhotoDraft(key, 'owner-a', [photo])
  await setMaintenanceCompletionPhotoDraft('work-1', 'owner-a', [{ ...photo, local_uri: 'file:///documents/after.jpg' }])
  await setMaintenanceCompletionPhotoDraft(key, 'owner-b', [{ ...photo, local_uri: 'file:///documents/other-owner.jpg' }])
  await setMaintenanceCompletionPhotoDraft(other, 'owner-a', [{ ...photo, local_uri: 'file:///documents/other-source.jpg' }])
  await clearMaintenanceCompletionPhotoDraft(key, 'owner-a', { deleteLocalFiles: true })
  expect(await getMaintenanceCompletionPhotoDraft('work-1', 'owner-a')).toHaveLength(1)
  expect(await getMaintenanceCompletionPhotoDraft(key, 'owner-b')).toHaveLength(1)
  expect(await getMaintenanceCompletionPhotoDraft(other, 'owner-a')).toHaveLength(1)
})
