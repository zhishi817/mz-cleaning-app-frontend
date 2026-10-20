jest.mock('./authEvents', () => ({
  notifyAuthInvalidated: jest.fn(),
}))

jest.mock('expo-file-system', () => ({
  File: class File {
    get exists() {
      return true
    }
  },
}))

function response(status: number, body: unknown) {
  const text = JSON.stringify(body)
  return {
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn(async () => text),
    json: jest.fn(async () => body),
  } as any
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.useRealTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

test('queue request can handle 401 without invalidating the global session', async () => {
  const fetchMock = jest.fn(async () => response(401, { message: 'token expired' }))
  globalThis.fetch = fetchMock as any
  const authEvents = require('./authEvents') as { notifyAuthInvalidated: jest.Mock }
  const api = require('./api') as typeof import('./api')

  await expect(api.saveInspectionPhotos(
    'expired-token',
    'cleaning-task-1',
    { items: [] },
    { skipAuthInvalidation: true },
  )).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' })

  expect(authEvents.notifyAuthInvalidated).not.toHaveBeenCalled()
  expect(fetchMock).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      cache: 'no-store',
    }),
  )
  const sentHeaders = (fetchMock as jest.Mock).mock.calls[0]?.[1]?.headers as Headers
  expect(sentHeaders.get('Authorization')).toBe('Bearer expired-token')
  expect(sentHeaders.get('X-Skip-Auth-Invalidation')).toBe('1')
  expect(sentHeaders.get('Cache-Control')).toBe('no-cache')
  expect(sentHeaders.get('Pragma')).toBe('no-cache')
})

test('mzapp upload exposes the server-owned task-photo reference without replacing the legacy url field', async () => {
  const fetchMock = jest.fn(async () => response(201, {
    url: 'https://current-media.r2.dev/mzapp/task-photo.jpg',
    key: 'mzapp/task-photo.jpg',
    remote_reference: 'r2://bucket-current/mzapp/task-photo.jpg',
  }))
  globalThis.fetch = fetchMock as any
  const api = require('./api') as typeof import('./api')

  await expect(api.uploadMzappMedia(
    'token',
    { uri: 'file:///task-photo.jpg', name: 'task-photo.jpg', mimeType: 'image/jpeg' },
    undefined,
    { skipImageCompression: true },
  )).resolves.toEqual({
    url: 'https://current-media.r2.dev/mzapp/task-photo.jpg',
    key: 'mzapp/task-photo.jpg',
    remoteReference: 'r2://bucket-current/mzapp/task-photo.jpg',
  })
})

test('task-list timeout aborts a fetch that never returns headers', async () => {
  jest.useFakeTimers()
  globalThis.fetch = jest.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => {
      const error = new Error('aborted')
      error.name = 'AbortError'
      reject(error)
    })
  })) as any
  const api = require('./api') as typeof import('./api')

  const request = api.listWorkTasks('token', { date_from: '2026-10-20', date_to: '2026-10-20', view: 'mine' })
  const rejected = expect(request).rejects.toMatchObject({ status: 0, code: 'TIMEOUT', retryable: true })
  await jest.advanceTimersByTimeAsync(15_000)
  await rejected
})

test('task-list timeout also bounds a response body that never finishes', async () => {
  jest.useFakeTimers()
  const body = new Promise<string>(() => {})
  globalThis.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    text: jest.fn(() => body),
  })) as any
  const api = require('./api') as typeof import('./api')

  const request = api.listWorkTasks('token', { date_from: '2026-10-20', date_to: '2026-10-20', view: 'mine' })
  const rejected = expect(request).rejects.toMatchObject({ status: 0, code: 'TIMEOUT', retryable: true })
  await Promise.resolve()
  await jest.advanceTimersByTimeAsync(15_000)
  await rejected
})

test.each([401, 403])('task-list permission status %s fails before reading a pending body', async (status) => {
  const text = jest.fn(() => new Promise<string>(() => {}))
  globalThis.fetch = jest.fn(async () => ({ ok: false, status, text })) as any
  const api = require('./api') as typeof import('./api')

  await expect(api.listWorkTasks('token', {
    date_from: '2026-10-20',
    date_to: '2026-10-20',
    view: 'mine',
  })).rejects.toMatchObject({ status, code: status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN', retryable: false })
  expect(text).not.toHaveBeenCalled()
})
