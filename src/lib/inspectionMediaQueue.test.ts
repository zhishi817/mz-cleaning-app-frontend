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
}))

function getAsyncStorage() {
  return require('@react-native-async-storage/async-storage') as {
    clear: () => Promise<void>
  }
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

  await queueMod.enqueueInspectionMediaItem({
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

  const queuedAfterFirst = await queueMod.listInspectionMediaQueueItemsForTask('cleaning-task-1', ['lockbox_video'])
  expect(queuedAfterFirst[0]).toMatchObject({
    uploaded_url: 'https://cdn.example.com/lock-1.mov',
    business_saved: false,
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
})
