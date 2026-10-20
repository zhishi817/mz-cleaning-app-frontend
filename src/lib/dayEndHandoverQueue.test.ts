jest.mock('./api', () => ({
  isRetryableApiError: jest.fn((error: any) => !!error?.retryable),
  uploadCleaningMedia: jest.fn(),
  uploadDayEndHandover: jest.fn(),
}))

const mockDeletedUris: string[] = []

jest.mock('expo-file-system', () => ({
  Directory: class Directory {},
  File: class File {
    uri: string
    constructor(uri: string) {
      this.uri = uri
    }
    get exists() {
      return true
    }
    delete() {
      mockDeletedUris.push(this.uri)
    }
  },
  Paths: { document: 'file:///documents' },
}))

function getAsyncStorage() {
  return require('@react-native-async-storage/async-storage') as {
    clear: () => Promise<void>
  }
}

beforeEach(async () => {
  jest.resetModules()
  mockDeletedUris.splice(0, mockDeletedUris.length)
  await getAsyncStorage().clear()
})

test('keeps the local day-end photo after object upload when the handover save is retryable', async () => {
  const api = require('./api') as {
    uploadCleaningMedia: jest.Mock
    uploadDayEndHandover: jest.Mock
  }
  api.uploadCleaningMedia.mockResolvedValue({ key: 'cleaning/day-end-key.jpg' })
  api.uploadDayEndHandover.mockRejectedValue(Object.assign(new Error('网络超时'), { code: 'TIMEOUT', retryable: true }))
  const queueMod = require('./dayEndHandoverQueue') as typeof import('./dayEndHandoverQueue')

  await queueMod.saveDayEndHandoverDraft({
    user_id: 'cleaner-1',
    date: '2026-08-12',
    pending_submit: false,
    key_items: [{ id: 'key-local-1', uri: 'file:///local/day-end-key.jpg', captured_at: '2026-08-12T01:00:00.000Z', uploaded_url: null }],
    return_wash_items: [],
    warehouse_key_items: [],
    consumable_items: [],
    reject_items: [],
    updated_at: '2026-08-12T01:00:00.000Z',
  })

  const result = await queueMod.processDayEndHandoverQueue('token-1')

  expect(result).toEqual({ processed: 0, remaining: 1 })
  expect(api.uploadCleaningMedia).toHaveBeenCalledWith(
    'token-1',
    expect.objectContaining({ name: 'key-key-local-1.jpg', mimeType: 'image/jpeg' }),
    expect.objectContaining({
      task_id: 'day-end:cleaner-1:2026-08-12',
      media_id: 'key-local-1',
    }),
    { skipImageCompression: true },
  )
  expect((await queueMod.getDayEndHandoverDraft('cleaner-1', '2026-08-12'))?.key_items[0]).toEqual(expect.objectContaining({
    uri: 'file:///local/day-end-key.jpg',
    uploaded_url: 'cleaning/day-end-key.jpg',
  }))
  expect(mockDeletedUris).toEqual([])
})

test('keeps day-end draft when submit fails with retryable timeout', async () => {
  const api = require('./api') as {
    uploadDayEndHandover: jest.Mock
  }
  api.uploadDayEndHandover.mockRejectedValue(Object.assign(new Error('网络超时，请检查网络后重试'), { code: 'TIMEOUT', retryable: true }))
  const queueMod = require('./dayEndHandoverQueue') as typeof import('./dayEndHandoverQueue')

  await queueMod.saveDayEndHandoverDraft({
    user_id: 'cleaner-1',
    date: '2026-06-29',
    pending_submit: false,
    key_items: [{ id: 'key-1', uri: 'file:///local/key-1.jpg', captured_at: '2026-06-29T01:00:00.000Z', uploaded_url: 'https://cdn.example.com/key-1.jpg' }],
    return_wash_items: [],
    warehouse_key_items: [],
    consumable_items: [],
    reject_items: [],
    updated_at: '2026-06-29T01:00:00.000Z',
  })

  const result = await queueMod.processDayEndHandoverQueue('token-1')

  expect(result).toEqual({ processed: 0, remaining: 1 })
  expect(api.uploadDayEndHandover).toHaveBeenCalledWith('token-1', expect.objectContaining({ section: 'key' }))
  expect(await queueMod.getDayEndHandoverDraft('cleaner-1', '2026-06-29')).toBeTruthy()
})

test('shares one in-flight day-end submission across concurrent maintenance callers', async () => {
  const api = require('./api') as {
    uploadDayEndHandover: jest.Mock
  }
  let finishSubmit!: (value: { ok: boolean }) => void
  let markSubmitStarted!: () => void
  const submitStarted = new Promise<void>((resolve) => {
    markSubmitStarted = resolve
  })
  api.uploadDayEndHandover.mockImplementation(() => new Promise((resolve) => {
    markSubmitStarted()
    finishSubmit = resolve
  }))
  const queueMod = require('./dayEndHandoverQueue') as typeof import('./dayEndHandoverQueue')

  await queueMod.saveDayEndHandoverDraft({
    user_id: 'cleaner-shared',
    date: '2026-06-30',
    pending_submit: false,
    key_items: [{ id: 'key-shared', uri: 'file:///local/key-shared.jpg', captured_at: '2026-06-30T01:00:00.000Z', uploaded_url: 'https://cdn.example.com/key-shared.jpg' }],
    return_wash_items: [],
    warehouse_key_items: [],
    consumable_items: [],
    reject_items: [],
    updated_at: '2026-06-30T01:00:00.000Z',
  })

  const first = queueMod.processDayEndHandoverQueue('token-1')
  const second = queueMod.processDayEndHandoverQueue('token-1')

  expect(second).toBe(first)
  await submitStarted
  finishSubmit({ ok: true })
  await expect(Promise.all([first, second])).resolves.toEqual([
    { processed: 1, remaining: 0 },
    { processed: 1, remaining: 0 },
  ])
  expect(api.uploadDayEndHandover).toHaveBeenCalledTimes(1)
})
