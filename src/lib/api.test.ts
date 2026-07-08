jest.mock('./authEvents', () => ({
  notifyAuthInvalidated: jest.fn(),
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
