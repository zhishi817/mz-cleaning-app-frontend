jest.mock('./api', () => ({
  isRetryableApiError: jest.fn(),
  isTerminalAuthApiError: jest.fn(),
  submitCleaningConsumables: jest.fn(),
  uploadCleaningMedia: jest.fn(),
}))

function getAsyncStorage() {
  return require('@react-native-async-storage/async-storage') as {
    clear: () => Promise<void>
  }
}

beforeEach(async () => {
  jest.resetModules()
  await getAsyncStorage().clear()
})

test('queues consumables draft and flushes it after network recovery', async () => {
  const api = require('./api') as {
    isRetryableApiError: jest.Mock
    isTerminalAuthApiError: jest.Mock
    submitCleaningConsumables: jest.Mock
    uploadCleaningMedia: jest.Mock
  }
  api.isRetryableApiError.mockReturnValue(false)
  api.isTerminalAuthApiError.mockReturnValue(false)
  api.uploadCleaningMedia.mockResolvedValue({ url: 'https://cdn.example.com/stock-1.jpg' })
  api.submitCleaningConsumables.mockResolvedValue({ ok: true })

  const draftMod = require('./cleaningConsumablesDraft') as typeof import('./cleaningConsumablesDraft')
  const queueMod = require('./cleaningConsumablesSubmitQueue') as typeof import('./cleaningConsumablesSubmitQueue')

  await draftMod.setCleaningConsumablesDraft('task-1', {
    property_code: 'A1201',
    pending_submit: true,
    living_room_photo_url: 'file:///tmp/living-room.jpg',
    remote_ac_photo_url: null,
    remote_tv_photo_url: 'file:///tmp/remote-tv.jpg',
    extra_photo_urls: {
      shower_drain_photo_1: 'file:///tmp/shower-1.jpg',
    },
    items: [
      {
        item_id: 'toilet_paper',
        status: 'low',
        qty: 2,
        note: '只剩一点',
        photo_url: 'file:///tmp/stock-1.jpg',
        photo_urls: ['file:///tmp/stock-1.jpg'],
      },
    ],
    photo_meta: {
      'file:///tmp/living-room.jpg': {
        name: 'living-room.jpg',
        mime_type: 'image/jpeg',
        captured_at: '2026-06-23T01:02:03.000Z',
        watermark_text: 'A1201 cleaner\n2026-06-23 01:02',
      },
      'file:///tmp/remote-tv.jpg': {
        name: 'remote-tv.jpg',
        mime_type: 'image/jpeg',
        captured_at: '2026-06-23T01:02:04.000Z',
        watermark_text: 'A1201 cleaner\n2026-06-23 01:02',
      },
      'file:///tmp/shower-1.jpg': {
        name: 'shower-1.jpg',
        mime_type: 'image/jpeg',
        captured_at: '2026-06-23T01:02:05.000Z',
        watermark_text: 'A1201 cleaner\n2026-06-23 01:02',
      },
      'file:///tmp/stock-1.jpg': {
        name: 'stock-1.jpg',
        mime_type: 'image/jpeg',
        captured_at: '2026-06-23T01:02:06.000Z',
        watermark_text: 'A1201 cleaner\n2026-06-23 01:02',
      },
    },
  })
  await queueMod.enqueueCleaningConsumablesSubmit('task-1')

  expect(await queueMod.isCleaningConsumablesSubmitQueued('task-1')).toBe(true)

  const result = await queueMod.processCleaningConsumablesSubmitQueue('token-1', 'cleaner')

  expect(result).toEqual({ processed: 1, remaining: 0 })
  expect(api.uploadCleaningMedia).toHaveBeenCalledTimes(4)
  expect(api.submitCleaningConsumables).toHaveBeenCalledWith('token-1', 'task-1', {
    living_room_photo_url: 'https://cdn.example.com/stock-1.jpg',
    items: [
      {
        item_id: 'toilet_paper',
        status: 'low',
        qty: 2,
        note: '只剩一点',
        photo_url: 'https://cdn.example.com/stock-1.jpg',
        photo_urls: ['https://cdn.example.com/stock-1.jpg'],
      },
      {
        item_id: 'remote_tv',
        status: 'ok',
        photo_url: 'https://cdn.example.com/stock-1.jpg',
      },
      {
        item_id: 'shower_drain_photo_1',
        status: 'ok',
        photo_url: 'https://cdn.example.com/stock-1.jpg',
      },
    ],
  })
  expect(await draftMod.getCleaningConsumablesDraft('task-1')).toBeNull()
  expect(await queueMod.isCleaningConsumablesSubmitQueued('task-1')).toBe(false)
})

test('keeps queued draft when retryable submit still fails', async () => {
  const api = require('./api') as {
    isRetryableApiError: jest.Mock
    isTerminalAuthApiError: jest.Mock
    submitCleaningConsumables: jest.Mock
    uploadCleaningMedia: jest.Mock
  }
  api.isRetryableApiError.mockImplementation((error: any) => String(error?.message || '').includes('离线'))
  api.isTerminalAuthApiError.mockReturnValue(false)
  api.uploadCleaningMedia.mockResolvedValue({ url: 'https://cdn.example.com/living-room.jpg' })
  api.submitCleaningConsumables.mockRejectedValue(new Error('离线'))

  const draftMod = require('./cleaningConsumablesDraft') as typeof import('./cleaningConsumablesDraft')
  const queueMod = require('./cleaningConsumablesSubmitQueue') as typeof import('./cleaningConsumablesSubmitQueue')

  await draftMod.setCleaningConsumablesDraft('task-2', {
    property_code: 'B2302',
    pending_submit: true,
    living_room_photo_url: 'file:///tmp/living-room-2.jpg',
    remote_ac_photo_url: null,
    remote_tv_photo_url: null,
    extra_photo_urls: {},
    items: [],
    photo_meta: {
      'file:///tmp/living-room-2.jpg': {
        name: 'living-room-2.jpg',
        mime_type: 'image/jpeg',
        captured_at: '2026-06-23T02:03:04.000Z',
      },
    },
  })
  await queueMod.enqueueCleaningConsumablesSubmit('task-2')

  const result = await queueMod.processCleaningConsumablesSubmitQueue('token-2', 'cleaner')

  expect(result).toEqual({ processed: 0, remaining: 1 })
  expect(await queueMod.isCleaningConsumablesSubmitQueued('task-2')).toBe(true)
  expect(await draftMod.getCleaningConsumablesDraft('task-2')).toMatchObject({
    task_id: 'task-2',
    pending_submit: true,
    living_room_photo_url: 'https://cdn.example.com/living-room.jpg',
  })
})

test('persists partially uploaded remote urls when retryable upload fails mid-queue', async () => {
  const api = require('./api') as {
    isRetryableApiError: jest.Mock
    isTerminalAuthApiError: jest.Mock
    submitCleaningConsumables: jest.Mock
    uploadCleaningMedia: jest.Mock
  }
  api.isRetryableApiError.mockImplementation((error: any) => String(error?.message || '').includes('Network request failed'))
  api.isTerminalAuthApiError.mockReturnValue(false)
  api.uploadCleaningMedia
    .mockResolvedValueOnce({ url: 'https://cdn.example.com/living-room-3.jpg' })
    .mockRejectedValueOnce(new Error('Network request failed'))
  api.submitCleaningConsumables.mockResolvedValue({ ok: true })

  const draftMod = require('./cleaningConsumablesDraft') as typeof import('./cleaningConsumablesDraft')
  const queueMod = require('./cleaningConsumablesSubmitQueue') as typeof import('./cleaningConsumablesSubmitQueue')

  await draftMod.setCleaningConsumablesDraft('task-3', {
    property_code: 'C3303',
    pending_submit: true,
    living_room_photo_url: 'file:///tmp/living-room-3.jpg',
    remote_ac_photo_url: null,
    remote_tv_photo_url: 'file:///tmp/remote-tv-3.jpg',
    extra_photo_urls: {},
    items: [],
    photo_meta: {
      'file:///tmp/living-room-3.jpg': {
        name: 'living-room-3.jpg',
        mime_type: 'image/jpeg',
        captured_at: '2026-06-24T01:02:03.000Z',
      },
      'file:///tmp/remote-tv-3.jpg': {
        name: 'remote-tv-3.jpg',
        mime_type: 'image/jpeg',
        captured_at: '2026-06-24T01:02:04.000Z',
      },
    },
  })
  await queueMod.enqueueCleaningConsumablesSubmit('task-3')

  const result = await queueMod.processCleaningConsumablesSubmitQueue('token-3', 'cleaner')

  expect(result).toEqual({ processed: 0, remaining: 1 })
  expect(await draftMod.getCleaningConsumablesDraft('task-3')).toMatchObject({
    task_id: 'task-3',
    pending_submit: true,
    living_room_photo_url: 'https://cdn.example.com/living-room-3.jpg',
    remote_tv_photo_url: 'file:///tmp/remote-tv-3.jpg',
  })
  expect(await queueMod.isCleaningConsumablesSubmitQueued('task-3')).toBe(true)
})
