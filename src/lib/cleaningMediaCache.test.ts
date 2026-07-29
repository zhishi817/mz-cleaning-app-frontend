const mockDownloadedFiles = new Set<string>()

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

    static async downloadFileAsync(_url: string, target: File) {
      mockDownloadedFiles.add(target.uri)
      return target
    }
  }

  return { Directory, File, Paths: { cache: 'file:///cache' } }
})

beforeEach(() => {
  mockDownloadedFiles.clear()
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
