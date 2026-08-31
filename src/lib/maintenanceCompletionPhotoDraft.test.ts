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
