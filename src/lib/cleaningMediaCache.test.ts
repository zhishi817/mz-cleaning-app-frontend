const mockDownloadedFiles = new Set<string>()
let mockDownloadError: unknown = null

jest.mock('expo-file-system', () => {
  class Directory {
    uri: string

    constructor(...parts: any[]) {
      this.uri = parts.map((part) => typeof part === 'string' ? part : part?.uri).filter(Boolean).join('/')
    }

    create() {}
  }

  class File {
    uri: string

    constructor(...parts: any[]) {
      this.uri = parts.map((part) => typeof part === 'string' ? part : part?.uri).filter(Boolean).join('/')
    }

    get exists() {
      return mockDownloadedFiles.has(this.uri)
    }

    delete() {
      mockDownloadedFiles.delete(this.uri)
    }

    static async downloadFileAsync(_url: string, target: File) {
      if (mockDownloadError) throw mockDownloadError
      mockDownloadedFiles.add(target.uri)
      return target
    }
  }

  return { Directory, File, Paths: { cache: 'file:///cache' } }
})

beforeEach(() => {
  mockDownloadedFiles.clear()
  mockDownloadError = null
})

test('downloads authenticated remote media to a private file URI', async () => {
  const cache = require('./cleaningMediaCache') as typeof import('./cleaningMediaCache')
  const source = {
    uri: 'https://api.example.com/cleaning-app/media/image?key=cleaning%2Fphoto.jpg',
    headers: { Authorization: 'Bearer test-token' },
  }

  const result = await cache.cacheCleaningMediaImage(source)

  expect(result).toMatch(/^file:\/\/\/cache\/mzstay-cleaning-media\/.+\.jpg$/)
})

test('classifies permission and missing-object responses as terminal media failures', () => {
  const cache = require('./cleaningMediaCache') as typeof import('./cleaningMediaCache')
  expect(cache.classifyCleaningMediaReadFailure({ status: 403 })).toEqual({ status: 403, message: '无查看这张照片的权限', retryable: false })
  expect(cache.classifyCleaningMediaReadFailure(new Error('HTTP 404'))).toEqual({ status: 404, message: '照片已不可用（文件不存在）', retryable: false })
  expect(cache.classifyCleaningMediaReadFailure(new Error('network request failed'))).toEqual({ status: null, message: '网络或服务暂不可用，请稍后重试', retryable: true })
})

test('does not return an old cached photo after a terminal authorization failure', async () => {
  const cache = require('./cleaningMediaCache') as typeof import('./cleaningMediaCache')
  const source = {
    uri: 'https://api.example.com/cleaning-app/media/image?key=cleaning%2Fphoto.jpg',
    headers: { Authorization: 'Bearer test-token' },
  }
  await cache.cacheCleaningMediaImage(source)
  mockDownloadError = { status: 403 }

  await expect(cache.loadCleaningMediaImage(source)).resolves.toEqual({
    uri: null,
    failure: { status: 403, message: '无查看这张照片的权限', retryable: false },
  })
})
