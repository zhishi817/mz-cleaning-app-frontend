function fixtureToken(token: string) { require('./mediaCaptureIdentity').setMediaCaptureSession('cleaner-1', token); return token }
jest.mock('./api', () => ({
  startCleaningTask: jest.fn(),
  uploadCleaningMedia: jest.fn(),
}))

jest.mock('./localMediaDrafts', () => ({
  deleteDraftMedia: jest.fn(),
  draftMimeTypeFrom: jest.fn((_name: string, mimeType: string) => mimeType || 'image/jpeg'),
  persistDraftMedia: jest.fn(({ sourceUri }: { sourceUri: string }) => `file:///drafts/${String(sourceUri || '').split('/').pop() || 'photo.jpg'}`),
  persistCompressedDraftMedia: jest.fn(async ({ sourceUri, name, mimeType }: { sourceUri: string; name: string; mimeType: string }) => ({
    localUri: `file:///drafts/${String(sourceUri || '').split('/').pop() || 'photo.jpg'}`,
    name,
    mimeType,
  })),
}))

function getAsyncStorage() {
  return require('@react-native-async-storage/async-storage') as {
    clear: () => Promise<void>
  }
}

beforeEach(async () => {
  jest.resetModules()
  await getAsyncStorage().clear()
  require('./mediaCaptureIdentity').setMediaCaptureSession('cleaner-1', 'token-1')
})

test('retries key upload from start_cleaning_task without re-uploading media', async () => {
  const api = require('./api') as {
    startCleaningTask: jest.Mock
    uploadCleaningMedia: jest.Mock
  }
  api.uploadCleaningMedia.mockResolvedValue({
    key: 'cleaning/media/cleaning-task-1/key-1',
    url: 'https://cdn.example.com/cleaning/media/cleaning-task-1/key-1',
  })
  api.startCleaningTask
    .mockRejectedValueOnce(new Error('start task failed'))
    .mockResolvedValueOnce({ ok: true })

  const queueMod = require('./keyUploadQueue') as typeof import('./keyUploadQueue')

  const queuedItem = await queueMod.enqueueKeyUpload({
    cleaning_task_id: 'cleaning-task-1',
    source_uri: 'file:///camera/key-1.heic',
    property_code: 'A1201',
    captured_at: '2026-06-23T11:00:00.000Z',
    mime_type: 'image/heic',
    file_name: 'key-1.heic',
  })

  const first = await queueMod.processKeyUploadQueue(fixtureToken('token-1'))

  expect(first).toEqual({ processed: 0, remaining: 1 })
  expect(api.uploadCleaningMedia).toHaveBeenCalledTimes(1)
  expect(api.uploadCleaningMedia).toHaveBeenCalledWith(
    'token-1',
    expect.any(Object),
    expect.objectContaining({
      task_id: 'cleaning-task-1',
      media_id: queuedItem?.id,
    }),
    { skipImageCompression: true },
  )
  expect(api.startCleaningTask).toHaveBeenCalledTimes(1)
  expect(api.startCleaningTask).toHaveBeenNthCalledWith(1, 'token-1', 'cleaning-task-1', expect.objectContaining({
    media_url: 'cleaning/media/cleaning-task-1/key-1',
  }))
  const failedItem = await queueMod.getKeyUploadQueueItem('cleaning-task-1')
  expect(failedItem?.status).toBe('failed')
  expect(failedItem?.steps.upload_media.status).toBe('succeeded')
  expect(failedItem?.steps.start_cleaning_task.status).toBe('failed')
  expect(queueMod.selectKeyPhotoEffectiveState({ key_photo_url: null, has_local_pending: true })).toBe('pending_sync')

  const second = await queueMod.processKeyUploadQueue(fixtureToken('token-1'))

  expect(second).toEqual({ processed: 1, remaining: 0 })
  expect(api.uploadCleaningMedia).toHaveBeenCalledTimes(1)
  expect(api.startCleaningTask).toHaveBeenCalledTimes(2)
  expect(require('./localMediaDrafts').deleteDraftMedia).not.toHaveBeenCalled()
  expect(await queueMod.getKeyUploadQueueItem('cleaning-task-1')).toBeNull()
  expect(queueMod.selectKeyPhotoEffectiveState({ key_photo_url: 'cleaning/media/cleaning-task-1/key-1', has_local_pending: true })).toBe('recorded')
})

test('shares one in-flight key upload run across concurrent maintenance callers', async () => {
  const api = require('./api') as {
    startCleaningTask: jest.Mock
    uploadCleaningMedia: jest.Mock
  }
  let finishUpload!: (value: { key: string; url: string }) => void
  let markUploadStarted!: () => void
  const uploadStarted = new Promise<void>((resolve) => {
    markUploadStarted = resolve
  })
  api.uploadCleaningMedia.mockImplementation(() => new Promise((resolve) => {
    markUploadStarted()
    finishUpload = resolve
  }))
  api.startCleaningTask.mockResolvedValue({ ok: true })
  const queueMod = require('./keyUploadQueue') as typeof import('./keyUploadQueue')

  await queueMod.enqueueKeyUpload({
    cleaning_task_id: 'cleaning-task-shared',
    source_uri: 'file:///camera/key-shared.jpg',
    property_code: 'A1201',
    captured_at: '2026-06-23T11:00:00.000Z',
    mime_type: 'image/jpeg',
    file_name: 'key-shared.jpg',
  })

  const first = queueMod.processKeyUploadQueue(fixtureToken('token-1'))
  const second = queueMod.processKeyUploadQueue(fixtureToken('token-1'))

  expect(second).toBe(first)
  await uploadStarted
  finishUpload({ key: 'cleaning/media/cleaning-task-shared/key', url: 'https://cdn.example.com/key' })
  await expect(Promise.all([first, second])).resolves.toEqual([
    { processed: 1, remaining: 0 },
    { processed: 1, remaining: 0 },
  ])
  expect(api.uploadCleaningMedia).toHaveBeenCalledTimes(1)
  expect(api.startCleaningTask).toHaveBeenCalledTimes(1)
})


test('account switch during upload cannot mutate the other account queue or submit old media', async () => {
  const identity = require('./mediaCaptureIdentity')
  const queue = require('./keyUploadQueue')
  const api = require('./api')
  identity.setMediaCaptureSession('B', 'tokenB')
  await queue.enqueueKeyUpload({ cleaning_task_id: 'same-task', source_uri: 'file:///B.jpg', captured_by_user_id: 'B' })
  const beforeB = await queue.listKeyUploadQueueItems()
  identity.setMediaCaptureSession('A', 'tokenA')
  await queue.enqueueKeyUpload({ cleaning_task_id: 'same-task', source_uri: 'file:///A.jpg', captured_by_user_id: 'A' })
  let resolve!: (value: unknown) => void
  api.uploadCleaningMedia.mockImplementationOnce(() => new Promise((r) => { resolve = r }))
  const pending = queue.processKeyUploadQueue('tokenA')
  while (!resolve) await Promise.resolve()
  identity.setMediaCaptureSession('B', 'tokenB')
  resolve({ url: 'https://example.com/A.jpg' })
  await expect(pending).rejects.toThrow('OWNER_MISMATCH')
  expect(await queue.listKeyUploadQueueItems()).toEqual(beforeB)
  expect(api.startCleaningTask).not.toHaveBeenCalled()
  identity.setMediaCaptureSession('A', 'tokenA')
  expect(await queue.listKeyUploadQueueItems()).toEqual(expect.arrayContaining([expect.objectContaining({ captured_by_user_id: 'A', local_uri: expect.stringContaining('A.jpg') })]))
})
