const mockFileSet = new Set<string>(['file:///camera/lock-1.mov'])

jest.mock('expo-file-system', () => {
  class Directory {
    uri: string

    constructor(base: string, name: string) {
      this.uri = `${String(base || '').replace(/\/+$/g, '')}/${String(name || '').replace(/^\/+/g, '')}`
    }

    create() {}
  }

  class File {
    uri: string

    constructor(parentOrUri: any, name?: string) {
      if (parentOrUri && typeof parentOrUri === 'object' && 'uri' in parentOrUri && name) {
        this.uri = `${String(parentOrUri.uri || '').replace(/\/+$/g, '')}/${String(name || '').replace(/^\/+/g, '')}`
      } else {
        this.uri = String(parentOrUri || '')
      }
    }

    get exists() {
      return mockFileSet.has(this.uri)
    }

    copy(target: { uri: string }) {
      mockFileSet.add(String(target.uri || ''))
    }

    delete() {
      mockFileSet.delete(this.uri)
    }
  }

  return {
    Directory,
    File,
    Paths: {
      document: 'file:///documents',
    },
  }
})

jest.mock('./api', () => ({
  ApiError: class ApiError extends Error {
    status: number
    code: string
    retryable: boolean

    constructor(message: string, status = 0, code = 'ERR', retryable = false) {
      super(message)
      this.status = status
      this.code = code
      this.retryable = retryable
    }
  },
  isRetryableApiError: jest.fn(() => false),
  uploadCleaningMedia: jest.fn(),
  uploadCleaningVideo: jest.fn(),
  uploadLockboxVideo: jest.fn(),
  uploadSelfLockboxVideo: jest.fn(),
}))

function getAsyncStorage() {
  return require('@react-native-async-storage/async-storage') as {
    clear: () => Promise<void>
    setItem: (key: string, value: string) => Promise<void>
  }
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: any) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

beforeEach(async () => {
  jest.resetModules()
  jest.clearAllMocks()
  mockFileSet.clear()
  mockFileSet.add('file:///camera/lock-1.mov')
  await getAsyncStorage().clear()
})

test('retries lockbox business save without re-uploading the local video', async () => {
  const api = require('./api') as {
    uploadCleaningVideo: jest.Mock
    uploadLockboxVideo: jest.Mock
  }
  api.uploadCleaningVideo.mockResolvedValue({ url: 'https://cdn.example.com/lock-1.mov' })
  api.uploadLockboxVideo
    .mockRejectedValueOnce(new Error('save lockbox failed'))
    .mockResolvedValueOnce({ ok: true })

  const queueMod = require('./inspectionMediaQueue') as typeof import('./inspectionMediaQueue')

  const item = await queueMod.enqueueInspectionMediaItem({
    task_id: 'cleaning-task-1',
    kind: 'lockbox_video',
    source_uri: 'file:///camera/lock-1.mov',
    name: 'lock-1.mov',
    mime_type: 'video/quicktime',
  })

  const first = await queueMod.processInspectionMediaQueue('token-1')

  expect(first).toEqual({ processed: 1, remaining: 1 })
  expect(api.uploadCleaningVideo).toHaveBeenCalledTimes(1)
  expect(api.uploadLockboxVideo).toHaveBeenCalledTimes(1)
  expect(api.uploadCleaningVideo).toHaveBeenCalledWith('token-1', expect.any(Object), {
    task_id: 'cleaning-task-1',
    media_id: item.id,
    purpose: 'lockbox_video',
    captured_at: item.captured_at,
  })
  expect(api.uploadLockboxVideo).toHaveBeenLastCalledWith('token-1', 'cleaning-task-1', {
    media_url: 'https://cdn.example.com/lock-1.mov',
    operation_id: item.id,
  })

  const queuedAfterFirst = await queueMod.listInspectionMediaQueueItemsForTask('cleaning-task-1', ['lockbox_video'])
  expect(queuedAfterFirst[0]).toMatchObject({
    uploaded_url: 'https://cdn.example.com/lock-1.mov',
    business_saved: false,
    local_file_deleted_at: null,
  })

  const second = await queueMod.processInspectionMediaQueue('token-1')

  expect(second).toEqual({ processed: 1, remaining: 0 })
  expect(api.uploadCleaningVideo).toHaveBeenCalledTimes(1)
  expect(api.uploadLockboxVideo).toHaveBeenCalledTimes(2)

  const queuedAfterSecond = await queueMod.listInspectionMediaQueueItemsForTask('cleaning-task-1', ['lockbox_video'])
  expect(queuedAfterSecond[0]).toMatchObject({
    uploaded_url: 'https://cdn.example.com/lock-1.mov',
    business_saved: true,
  })
  expect(queuedAfterSecond[0]?.local_file_deleted_at).toBeTruthy()
})

test('uses the self-complete business route while retaining the same local-first video queue', async () => {
  const capturedAt = new Date().toISOString()
  const api = require('./api') as {
    uploadCleaningVideo: jest.Mock
    uploadLockboxVideo: jest.Mock
    uploadSelfLockboxVideo: jest.Mock
  }
  api.uploadCleaningVideo.mockResolvedValue({ url: 'https://cdn.example.com/self-complete-lock.mov' })
  api.uploadSelfLockboxVideo.mockResolvedValue({ ok: true })

  const queueMod = require('./inspectionMediaQueue') as typeof import('./inspectionMediaQueue')
  const item = await queueMod.enqueueInspectionMediaItem({
    task_id: 'self-complete-task',
    kind: 'lockbox_video',
    source_uri: 'file:///camera/lock-1.mov',
    name: 'self-complete-lock.mov',
    mime_type: 'video/quicktime',
    captured_at: capturedAt,
    meta: { lockbox_submission_mode: 'self_complete' },
  })

  await queueMod.processInspectionMediaQueue('token-self-complete')

  expect(api.uploadCleaningVideo).toHaveBeenCalledTimes(1)
  expect(api.uploadSelfLockboxVideo).toHaveBeenCalledWith('token-self-complete', 'self-complete-task', {
    media_url: 'https://cdn.example.com/self-complete-lock.mov',
    operation_id: item.id,
    captured_at: capturedAt,
  })
  expect(api.uploadLockboxVideo).not.toHaveBeenCalled()
  const [queued] = await queueMod.listInspectionMediaQueueItemsForTask('self-complete-task', ['lockbox_video'])
  expect(queued).toMatchObject({ business_saved: true, uploaded_url: 'https://cdn.example.com/self-complete-lock.mov' })
})

test('retries an interrupted uploading lockbox video after recovery', async () => {
  const api = require('./api') as {
    uploadCleaningVideo: jest.Mock
    uploadLockboxVideo: jest.Mock
  }
  api.uploadCleaningVideo.mockResolvedValue({ url: 'https://cdn.example.com/lock-recovered.mov' })
  api.uploadLockboxVideo.mockResolvedValue({ ok: true })

  const queueMod = require('./inspectionMediaQueue') as typeof import('./inspectionMediaQueue')

  const item = await queueMod.enqueueInspectionMediaItem({
    task_id: 'cleaning-task-2',
    kind: 'lockbox_video',
    source_uri: 'file:///camera/lock-1.mov',
    name: 'lock-1.mov',
    mime_type: 'video/quicktime',
  })
  await queueMod.updateInspectionMediaItem(item.id, {
    upload_status: 'uploading',
    last_error: null,
  })

  const result = await queueMod.processInspectionMediaQueue('token-1')

  expect(result).toEqual({ processed: 1, remaining: 0 })
  expect(api.uploadCleaningVideo).toHaveBeenCalledTimes(1)
  expect(api.uploadLockboxVideo).toHaveBeenCalledTimes(1)
  expect(api.uploadCleaningVideo).toHaveBeenCalledWith('token-1', expect.any(Object), {
    task_id: 'cleaning-task-2',
    media_id: item.id,
    purpose: 'lockbox_video',
    captured_at: item.captured_at,
  })
  expect(api.uploadLockboxVideo).toHaveBeenCalledWith('token-1', 'cleaning-task-2', {
    media_url: 'https://cdn.example.com/lock-recovered.mov',
    operation_id: item.id,
  })

  const queuedAfterRecovery = await queueMod.listInspectionMediaQueueItemsForTask('cleaning-task-2', ['lockbox_video'])
  expect(queuedAfterRecovery[0]).toMatchObject({
    uploaded_url: 'https://cdn.example.com/lock-recovered.mov',
    upload_status: 'uploaded',
    business_saved: true,
  })
})

test('reuses the persisted media and operation ids after an app restart', async () => {
  const persistedId = 'lockbox_video_persisted_operation'
  const capturedAt = '2026-10-09T01:02:03.000Z'
  mockFileSet.add('file:///camera/lock-1.mov')
  await getAsyncStorage().setItem('mzstay.inspection_media_queue.v1', JSON.stringify([{
    id: persistedId,
    task_id: 'cleaning-task-restart',
    kind: 'lockbox_video',
    local_uri: 'file:///camera/lock-1.mov',
    name: 'lock-1.mov',
    mime_type: 'video/quicktime',
    created_at: capturedAt,
    captured_at: capturedAt,
    uploaded_url: null,
    upload_status: 'uploading',
    business_saved: false,
    retain_until: '2026-11-09T01:02:03.000Z',
    local_file_deleted_at: null,
    last_error: null,
  }]))

  const api = require('./api') as {
    uploadCleaningVideo: jest.Mock
    uploadLockboxVideo: jest.Mock
  }
  api.uploadCleaningVideo.mockResolvedValue({ url: 'https://cdn.example.com/restart.mov' })
  api.uploadLockboxVideo.mockResolvedValue({ ok: true })
  const queueMod = require('./inspectionMediaQueue') as typeof import('./inspectionMediaQueue')

  await expect(queueMod.processInspectionMediaQueue('token-restart')).resolves.toEqual({ processed: 1, remaining: 0 })
  expect(api.uploadCleaningVideo).toHaveBeenCalledWith('token-restart', expect.any(Object), {
    task_id: 'cleaning-task-restart',
    media_id: persistedId,
    purpose: 'lockbox_video',
    captured_at: capturedAt,
  })
  expect(api.uploadLockboxVideo).toHaveBeenCalledWith('token-restart', 'cleaning-task-restart', {
    media_url: 'https://cdn.example.com/restart.mov',
    operation_id: persistedId,
  })
})

test('keeps one upload owner after waiter timeouts and persists the late success', async () => {
  jest.useFakeTimers()
  const api = require('./api') as {
    uploadCleaningVideo: jest.Mock
    uploadLockboxVideo: jest.Mock
    isRetryableApiError: jest.Mock
  }
  api.isRetryableApiError.mockImplementation((error: any) => !!error?.retryable)
  const upload = deferred<{ url: string }>()
  api.uploadCleaningVideo.mockReturnValue(upload.promise)
  api.uploadLockboxVideo.mockResolvedValue({ ok: true })

  const queueMod = require('./inspectionMediaQueue') as typeof import('./inspectionMediaQueue')

  await queueMod.enqueueInspectionMediaItem({
    task_id: 'cleaning-task-timeout',
    kind: 'lockbox_video',
    source_uri: 'file:///camera/lock-1.mov',
    name: 'lock-1.mov',
    mime_type: 'video/quicktime',
  })

  const firstProcessing = queueMod.processInspectionMediaQueue('token-timeout')
  const secondProcessing = queueMod.processInspectionMediaQueue('token-timeout')
  await jest.advanceTimersByTimeAsync(0)
  expect(api.uploadCleaningVideo).toHaveBeenCalledTimes(1)

  await jest.advanceTimersByTimeAsync(75_100)
  const [firstResult, secondResult] = await Promise.all([firstProcessing, secondProcessing])

  expect(firstResult).toEqual({ processed: 0, remaining: 1 })
  expect(secondResult).toEqual({ processed: 0, remaining: 1 })
  expect(api.uploadCleaningVideo).toHaveBeenCalledTimes(1)
  expect(api.uploadLockboxVideo).not.toHaveBeenCalled()

  const queuedAfterTimeout = await queueMod.listInspectionMediaQueueItemsForTask('cleaning-task-timeout', ['lockbox_video'])
  expect(queuedAfterTimeout[0]).toMatchObject({
    upload_status: 'failed_retryable',
    uploaded_url: null,
    business_saved: false,
  })
  expect(queuedAfterTimeout[0].last_error).toContain('视频上传超时')
  expect(queuedAfterTimeout[0].last_attempt_at).toBeTruthy()

  const resumedProcessing = queueMod.processInspectionMediaQueue('token-timeout')
  upload.resolve({ url: 'https://cdn.example.com/late-lock.mov' })
  await expect(resumedProcessing).resolves.toEqual({ processed: 1, remaining: 0 })

  expect(api.uploadCleaningVideo).toHaveBeenCalledTimes(1)
  expect(api.uploadLockboxVideo).toHaveBeenCalledTimes(1)
  const queuedAfterLateSuccess = await queueMod.listInspectionMediaQueueItemsForTask('cleaning-task-timeout', ['lockbox_video'])
  expect(queuedAfterLateSuccess[0]).toMatchObject({
    upload_status: 'uploaded',
    uploaded_url: 'https://cdn.example.com/late-lock.mov',
    business_saved: true,
    last_error: null,
  })
  expect(queuedAfterLateSuccess[0]?.local_file_deleted_at).toBeTruthy()

  jest.useRealTimers()
})

test('keeps one business-save owner after timeout and accepts its late success', async () => {
  jest.useFakeTimers()
  const api = require('./api') as {
    uploadCleaningVideo: jest.Mock
    uploadLockboxVideo: jest.Mock
    isRetryableApiError: jest.Mock
  }
  api.isRetryableApiError.mockImplementation((error: any) => !!error?.retryable)
  api.uploadCleaningVideo.mockResolvedValue({ url: 'https://cdn.example.com/lock-save-late.mov' })
  const businessSave = deferred<{ ok: true }>()
  api.uploadLockboxVideo.mockReturnValue(businessSave.promise)

  const queueMod = require('./inspectionMediaQueue') as typeof import('./inspectionMediaQueue')
  await queueMod.enqueueInspectionMediaItem({
    task_id: 'cleaning-task-save-timeout',
    kind: 'lockbox_video',
    source_uri: 'file:///camera/lock-1.mov',
    name: 'lock-1.mov',
    mime_type: 'video/quicktime',
  })

  const firstProcessing = queueMod.processInspectionMediaQueue('token-save-timeout')
  await jest.advanceTimersByTimeAsync(0)
  expect(api.uploadCleaningVideo).toHaveBeenCalledTimes(1)
  expect(api.uploadLockboxVideo).toHaveBeenCalledTimes(1)
  await jest.advanceTimersByTimeAsync(30_100)
  await expect(firstProcessing).resolves.toEqual({ processed: 1, remaining: 1 })

  const queuedAfterTimeout = await queueMod.listInspectionMediaQueueItemsForTask('cleaning-task-save-timeout', ['lockbox_video'])
  expect(queuedAfterTimeout[0]).toMatchObject({
    upload_status: 'failed_retryable',
    uploaded_url: 'https://cdn.example.com/lock-save-late.mov',
    business_saved: false,
    local_file_deleted_at: null,
  })
  expect(queuedAfterTimeout[0].last_error).toContain('保存任务超时')

  const resumedProcessing = queueMod.processInspectionMediaQueue('token-save-timeout')
  businessSave.resolve({ ok: true })
  await expect(resumedProcessing).resolves.toEqual({ processed: 0, remaining: 0 })

  expect(api.uploadCleaningVideo).toHaveBeenCalledTimes(1)
  expect(api.uploadLockboxVideo).toHaveBeenCalledTimes(1)
  const queuedAfterLateSuccess = await queueMod.listInspectionMediaQueueItemsForTask('cleaning-task-save-timeout', ['lockbox_video'])
  expect(queuedAfterLateSuccess[0]).toMatchObject({
    upload_status: 'uploaded',
    business_saved: true,
    last_error: null,
  })
  expect(queuedAfterLateSuccess[0]?.local_file_deleted_at).toBeTruthy()

  jest.useRealTimers()
})

test('maps an external local-media lock collision to a retryable user-safe state', async () => {
  const api = require('./api') as {
    uploadCleaningVideo: jest.Mock
  }
  const queueMod = require('./inspectionMediaQueue') as typeof import('./inspectionMediaQueue')
  const localLocks = require('./localMediaLocks') as typeof import('./localMediaLocks')
  const releaseLock = deferred<void>()

  const item = await queueMod.enqueueInspectionMediaItem({
    task_id: 'cleaning-task-external-lock',
    kind: 'lockbox_video',
    source_uri: 'file:///camera/lock-1.mov',
    name: 'lock-1.mov',
    mime_type: 'video/quicktime',
  })
  const holdingLock = localLocks.withLocalMediaLock(item.local_uri, () => releaseLock.promise)
  await Promise.resolve()

  await expect(queueMod.processInspectionMediaQueue('token-external-lock')).resolves.toEqual({ processed: 0, remaining: 1 })
  expect(api.uploadCleaningVideo).not.toHaveBeenCalled()
  const [queued] = await queueMod.listInspectionMediaQueueItemsForTask('cleaning-task-external-lock', ['lockbox_video'])
  expect(queued).toMatchObject({
    upload_status: 'failed_retryable',
    uploaded_url: null,
    business_saved: false,
  })
  expect(queued.last_error).toContain('本地视频正在处理中')
  expect(queued.last_error).not.toContain('LOCAL_MEDIA_LOCKED')

  releaseLock.resolve()
  await holdingLock
})
