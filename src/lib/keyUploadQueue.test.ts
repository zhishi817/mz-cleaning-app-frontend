jest.mock('./api', () => ({
  startCleaningTask: jest.fn(),
  uploadCleaningMedia: jest.fn(),
}))

jest.mock('./localMediaDrafts', () => ({
  deleteDraftMedia: jest.fn(),
  draftMimeTypeFrom: jest.fn((_name: string, mimeType: string) => mimeType || 'image/jpeg'),
  persistDraftMedia: jest.fn(({ sourceUri }: { sourceUri: string }) => `file:///drafts/${String(sourceUri || '').split('/').pop() || 'photo.jpg'}`),
}))

function getAsyncStorage() {
  return require('@react-native-async-storage/async-storage') as {
    clear: () => Promise<void>
  }
}

beforeEach(async () => {
  jest.resetModules()
  await getAsyncStorage().clear()
})

test('retries key upload from start_cleaning_task without re-uploading media', async () => {
  const api = require('./api') as {
    startCleaningTask: jest.Mock
    uploadCleaningMedia: jest.Mock
  }
  api.uploadCleaningMedia.mockResolvedValue({ url: 'https://cdn.example.com/key-1.heic' })
  api.startCleaningTask
    .mockRejectedValueOnce(new Error('start task failed'))
    .mockResolvedValueOnce({ ok: true })

  const queueMod = require('./keyUploadQueue') as typeof import('./keyUploadQueue')

  await queueMod.enqueueKeyUpload({
    cleaning_task_id: 'cleaning-task-1',
    source_uri: 'file:///camera/key-1.heic',
    property_code: 'A1201',
    captured_at: '2026-06-23T11:00:00.000Z',
    mime_type: 'image/heic',
    file_name: 'key-1.heic',
  })

  const first = await queueMod.processKeyUploadQueue('token-1')

  expect(first).toEqual({ processed: 0, remaining: 1 })
  expect(api.uploadCleaningMedia).toHaveBeenCalledTimes(1)
  expect(api.startCleaningTask).toHaveBeenCalledTimes(1)
  const failedItem = await queueMod.getKeyUploadQueueItem('cleaning-task-1')
  expect(failedItem?.status).toBe('failed')
  expect(failedItem?.steps.upload_media.status).toBe('succeeded')
  expect(failedItem?.steps.start_cleaning_task.status).toBe('failed')
  expect(queueMod.selectKeyPhotoEffectiveState({ key_photo_url: null, has_local_pending: true })).toBe('pending_sync')

  const second = await queueMod.processKeyUploadQueue('token-1')

  expect(second).toEqual({ processed: 1, remaining: 0 })
  expect(api.uploadCleaningMedia).toHaveBeenCalledTimes(1)
  expect(api.startCleaningTask).toHaveBeenCalledTimes(2)
  expect(await queueMod.getKeyUploadQueueItem('cleaning-task-1')).toBeNull()
  expect(queueMod.selectKeyPhotoEffectiveState({ key_photo_url: 'https://cdn.example.com/key-1.heic', has_local_pending: true })).toBe('recorded')
})
