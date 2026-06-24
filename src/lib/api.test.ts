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
      headers: expect.objectContaining({
        Authorization: 'Bearer expired-token',
        'X-Skip-Auth-Invalidation': '1',
      }),
    }),
  )
})
