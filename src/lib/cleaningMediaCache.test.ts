const mockFiles = new Map<string, { size: number; modificationTime: number }>()
let mockDownloadError: unknown = null
let mockDownloadCalls = 0
let mockHoldDownload: Promise<void> | null = null
let mockDownloadedFileSize = 1024

jest.mock('expo-file-system', () => {
  function join(parts: any[]) {
    return parts.map((part) => typeof part === 'string' ? part : part?.uri).filter(Boolean).join('/').replace(/([^:]\/)\/+?/g, '$1')
  }

  class Directory {
    uri: string

    constructor(...parts: any[]) {
      this.uri = join(parts)
    }

    create() {}

    get exists() {
      return Array.from(mockFiles.keys()).some((uri) => uri.startsWith(`${this.uri}/`))
    }

    delete() {
      for (const uri of Array.from(mockFiles.keys())) {
        if (uri.startsWith(`${this.uri}/`)) mockFiles.delete(uri)
      }
    }

    list() {
      return Array.from(mockFiles.keys())
        .filter((uri) => uri.startsWith(`${this.uri}/`) && !uri.slice(this.uri.length + 1).includes('/'))
        .map((uri) => new File(uri))
    }
  }

  class File {
    uri: string

    constructor(...parts: any[]) {
      this.uri = join(parts)
    }

    get exists() {
      return mockFiles.has(this.uri)
    }

    info() {
      const entry = mockFiles.get(this.uri)
      return entry ? { ...entry } : { size: 0, modificationTime: 0 }
    }

    delete() {
      mockFiles.delete(this.uri)
    }

    move(target: File) {
      const entry = mockFiles.get(this.uri)
      if (!entry) throw new Error('missing_source')
      mockFiles.set(target.uri, entry)
      mockFiles.delete(this.uri)
    }

    static async downloadFileAsync(_url: string, target: File) {
      mockDownloadCalls += 1
      if (mockHoldDownload) await mockHoldDownload
      if (mockDownloadError) throw mockDownloadError
      mockFiles.set(target.uri, { size: mockDownloadedFileSize, modificationTime: Date.now() })
      return target
    }
  }

  return { Directory, File, Paths: { cache: 'file:///cache' } }
})

const source = {
  uri: 'https://api.example.com/cleaning-app/media/image?key=cleaning%2Fphoto.jpg&variant=thumbnail',
  headers: { Authorization: 'Bearer token-one' },
}

beforeEach(async () => {
  const cache = require('./cleaningMediaCache') as typeof import('./cleaningMediaCache')
  await cache.clearCleaningMediaCache()
  await cache.establishCleaningMediaCacheSession({ userId: 'user-1', role: 'cleaner', roles: ['cleaner'] })
  mockFiles.clear()
  mockDownloadError = null
  mockDownloadCalls = 0
  mockHoldDownload = null
  mockDownloadedFileSize = 1024
})

test('uses one per-account file for the same proxy request even when the bearer token changes', async () => {
  const cache = require('./cleaningMediaCache') as typeof import('./cleaningMediaCache')

  const first = await cache.cacheCleaningMediaImage(source)
  const second = await cache.cacheCleaningMediaImage({ ...source, headers: { Authorization: 'Bearer token-two' } })

  expect(first).toMatch(/^file:\/\/\/?cache\/mzstay-cleaning-media\/.+\.jpg$/)
  expect(second).toBe(first)
  expect(mockDownloadCalls).toBe(1)
})

test('deduplicates concurrent downloads for the same authenticated proxy request', async () => {
  const cache = require('./cleaningMediaCache') as typeof import('./cleaningMediaCache')
  let release: () => void = () => undefined
  mockHoldDownload = new Promise<void>((resolve) => { release = resolve })

  const first = cache.loadCleaningMediaImage(source)
  const second = cache.loadCleaningMediaImage({ ...source, headers: { Authorization: 'Bearer refreshed-token' } })
  await Promise.resolve()
  expect(mockDownloadCalls).toBe(1)
  release()

  await expect(Promise.all([first, second])).resolves.toEqual([
    expect.objectContaining({ uri: expect.stringMatching(/^file:\/\//), failure: null }),
    expect.objectContaining({ uri: expect.stringMatching(/^file:\/\//), failure: null }),
  ])
})

test('never promotes a failed partial download to the final cache file', async () => {
  const cache = require('./cleaningMediaCache') as typeof import('./cleaningMediaCache')
  mockDownloadError = new Error('network request failed')

  await expect(cache.loadCleaningMediaImage(source)).resolves.toEqual({
    uri: null,
    failure: { status: null, message: '网络或服务暂不可用，请稍后重试', retryable: true },
  })
  expect(Array.from(mockFiles.keys()).some((uri) => uri.endsWith('.jpg'))).toBe(false)
  expect(Array.from(mockFiles.keys()).some((uri) => uri.endsWith('.partial'))).toBe(false)
})

test('clears the current account cache on visibility invalidation, so the next read rechecks the proxy', async () => {
  const cache = require('./cleaningMediaCache') as typeof import('./cleaningMediaCache')
  await cache.cacheCleaningMediaImage(source)
  await cache.invalidateCleaningMediaCache()
  mockDownloadError = { status: 403 }

  await expect(cache.loadCleaningMediaImage(source)).resolves.toEqual({
    uri: null,
    failure: { status: 403, message: '无查看这张照片的权限', retryable: false },
  })
  expect(mockDownloadCalls).toBe(2)
  expect(Array.from(mockFiles.keys()).some((uri) => uri.endsWith('.jpg'))).toBe(false)
})

test('separates cache identity when the same account receives a different role scope', async () => {
  const cache = require('./cleaningMediaCache') as typeof import('./cleaningMediaCache')
  const first = await cache.cacheCleaningMediaImage(source)
  await cache.establishCleaningMediaCacheSession({ userId: 'user-1', role: 'manager', roles: ['manager'] })
  const second = await cache.cacheCleaningMediaImage(source)

  expect(second).not.toBe(first)
  expect(mockDownloadCalls).toBe(2)
})

test('classifies permission and missing-object responses as terminal media failures', () => {
  const cache = require('./cleaningMediaCache') as typeof import('./cleaningMediaCache')
  expect(cache.classifyCleaningMediaReadFailure({ status: 403 })).toEqual({ status: 403, message: '无查看这张照片的权限', retryable: false })
  expect(cache.classifyCleaningMediaReadFailure(new Error('HTTP 404'))).toEqual({ status: 404, message: '照片已不可用（文件不存在）', retryable: false })
  expect(cache.classifyCleaningMediaReadFailure(new Error('network request failed'))).toEqual({ status: null, message: '网络或服务暂不可用，请稍后重试', retryable: true })
})

test('cold-start signed-out cleanup removes the private cache root without an in-memory session', async () => {
  const cache = require('./cleaningMediaCache') as typeof import('./cleaningMediaCache')
  await cache.cacheCleaningMediaImage(source)
  expect(mockFiles.size).toBeGreaterThan(0)

  jest.resetModules()
  const coldStartCache = require('./cleaningMediaCache') as typeof import('./cleaningMediaCache')
  await coldStartCache.clearCleaningMediaCache()

  expect(mockFiles.size).toBe(0)
})

test('maintenance removes expired partial/final files and trims the active cache below its target', async () => {
  const cache = require('./cleaningMediaCache') as typeof import('./cleaningMediaCache')
  await cache.establishCleaningMediaCacheSession({ userId: 'user-1', role: 'cleaner', roles: ['cleaner'] })
  const now = Date.now()
  const first = await cache.cacheCleaningMediaImage(source)
  if (!first) throw new Error('expected cached file')
  const stalePartial = first.replace(/\.jpg$/, '.stale.partial')
  mockFiles.set(first, { size: 1024, modificationTime: now - 15 * 24 * 60 * 60 * 1000 })
  mockFiles.set(stalePartial, { size: 1024, modificationTime: now - 2 * 60 * 60 * 1000 })

  const expiredResult = await cache.runCleaningMediaCacheMaintenance(now)
  expect(expiredResult.deleted).toBe(2)
  expect(mockFiles.size).toBe(0)

  mockDownloadedFileSize = 180 * 1024 * 1024
  const retained = await cache.cacheCleaningMediaImage(source)
  const second = await cache.cacheCleaningMediaImage({
    ...source,
    uri: 'https://api.example.com/cleaning-app/media/image?key=cleaning%2Fsecond-photo.jpg&variant=thumbnail',
  })
  if (!retained || !second) throw new Error('expected cached files')
  const trimmedResult = await cache.runCleaningMediaCacheMaintenance(now)
  expect(trimmedResult.bytes).toBeLessThanOrEqual(250 * 1024 * 1024)
  expect(Array.from(mockFiles.keys()).filter((uri) => uri.endsWith('.jpg'))).toHaveLength(1)
})
