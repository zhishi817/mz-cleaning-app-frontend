jest.mock('./api', () => ({
  isRetryableApiError: jest.fn(),
  isTerminalAuthApiError: jest.fn(),
  saveCompletionPhotos: jest.fn(),
  saveRestockProof: jest.fn(),
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
  api.uploadCleaningMedia.mockResolvedValue({ key: 'cleaning/media/task-1/stock-1', url: 'https://cdn.example.com/cleaning/media/task-1/stock-1' })
  api.submitCleaningConsumables.mockResolvedValue({ ok: true })

  const draftMod = require('./cleaningConsumablesDraft') as typeof import('./cleaningConsumablesDraft')
  const deleteLocalPhoto = jest.spyOn(draftMod, 'deleteCleaningConsumablesPhoto')
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

  expect(result).toEqual({ processed: 1, remaining: 0, succeeded_task_ids: ['task-1'] })
  expect(api.uploadCleaningMedia).toHaveBeenCalledTimes(4)
  expect(api.submitCleaningConsumables).toHaveBeenCalledWith('token-1', 'task-1', {
    living_room_photo_url: 'cleaning/media/task-1/stock-1',
    items: [
      {
        item_id: 'toilet_paper',
        status: 'low',
        qty: 2,
        note: '只剩一点',
        photo_url: 'cleaning/media/task-1/stock-1',
        photo_urls: ['cleaning/media/task-1/stock-1'],
      },
      {
        item_id: 'remote_tv',
        status: 'ok',
        photo_url: 'cleaning/media/task-1/stock-1',
      },
      {
        item_id: 'shower_drain_photo_1',
        status: 'ok',
        photo_url: 'cleaning/media/task-1/stock-1',
      },
    ],
    submit_id: expect.any(String),
  })
  expect(deleteLocalPhoto).not.toHaveBeenCalled()
  expect(await draftMod.getCleaningConsumablesDraft('task-1')).toBeNull()
  expect(await queueMod.isCleaningConsumablesSubmitQueued('task-1')).toBe(false)
})

test('omits an optional living-room photo field when the self-complete draft has no photo', async () => {
  const api = require('./api') as {
    isRetryableApiError: jest.Mock
    isTerminalAuthApiError: jest.Mock
    submitCleaningConsumables: jest.Mock
  }
  api.isRetryableApiError.mockReturnValue(false)
  api.isTerminalAuthApiError.mockReturnValue(false)
  api.submitCleaningConsumables.mockResolvedValue({ ok: true })

  const draftMod = require('./cleaningConsumablesDraft') as typeof import('./cleaningConsumablesDraft')
  const queueMod = require('./cleaningConsumablesSubmitQueue') as typeof import('./cleaningConsumablesSubmitQueue')
  await draftMod.setCleaningConsumablesDraft('task-without-living-photo', {
    pending_submit: true,
    items: [{ item_id: 'tissue', status: 'ok', photo_urls: [] }],
  })
  await queueMod.enqueueCleaningConsumablesSubmit('task-without-living-photo')

  await queueMod.processCleaningConsumablesSubmitQueue('token', 'cleaner')

  const payload = api.submitCleaningConsumables.mock.calls[0][2]
  expect(payload).toMatchObject({
    items: [{ item_id: 'tissue', status: 'ok' }],
    submit_id: expect.any(String),
  })
  expect(Object.prototype.hasOwnProperty.call(payload, 'living_room_photo_url')).toBe(false)
})

test('writes self-complete restock proof only after its photo has a remote reference', async () => {
  const api = require('./api') as {
    isRetryableApiError: jest.Mock
    isTerminalAuthApiError: jest.Mock
    saveRestockProof: jest.Mock
    submitCleaningConsumables: jest.Mock
    uploadCleaningMedia: jest.Mock
  }
  api.isRetryableApiError.mockReturnValue(false)
  api.isTerminalAuthApiError.mockReturnValue(false)
  api.uploadCleaningMedia.mockResolvedValue({ key: 'cleaning/media/task-restock/proof-1' })
  api.submitCleaningConsumables.mockResolvedValue({ ok: true })
  api.saveRestockProof.mockResolvedValue({ ok: true })

  const draftMod = require('./cleaningConsumablesDraft') as typeof import('./cleaningConsumablesDraft')
  const queueMod = require('./cleaningConsumablesSubmitQueue') as typeof import('./cleaningConsumablesSubmitQueue')
  await draftMod.setCleaningConsumablesDraft('task-restock', {
    pending_submit: true,
    submit_consumables: true,
    restock_submit_enabled: true,
    items: [
      {
        item_id: 'toilet_paper',
        label: '卷纸',
        status: 'ok',
        restock_status: 'restocked',
        qty: 2,
        note: '已补两卷',
        photo_urls: ['file:///tmp/restock-proof.jpg'],
      },
      {
        item_id: 'dishsoap',
        label: '洗洁精',
        status: 'ok',
        restock_status: 'carry_forward',
        qty: 1,
        note: '下次退房补',
        photo_urls: [],
      },
    ],
    photo_meta: {
      'file:///tmp/restock-proof.jpg': { name: 'restock-proof.jpg', mime_type: 'image/jpeg', captured_at: '2026-07-28T01:02:03.000Z' },
    },
  })
  await queueMod.enqueueCleaningConsumablesSubmit('task-restock')

  const result = await queueMod.processCleaningConsumablesSubmitQueue('token', 'cleaner')

  expect(result.succeeded_task_ids).toEqual(['task-restock'])
  expect(api.saveRestockProof).toHaveBeenCalledWith('token', 'task-restock', {
    items: [
      {
        item_id: 'toilet_paper',
        label: '卷纸',
        status: 'restocked',
        qty: 2,
        note: '已补两卷',
        proof_url: 'cleaning/media/task-restock/proof-1',
        proof_urls: ['cleaning/media/task-restock/proof-1'],
      },
      {
        item_id: 'dishsoap',
        label: '洗洁精',
        status: 'carry_forward',
        qty: 1,
        note: '下次退房补',
        proof_url: null,
        proof_urls: undefined,
      },
    ],
    submit_id: expect.any(String),
    step_key: 'self_complete_restock',
  })
})

test('keeps staged completion photos local while a separate consumables submit succeeds', async () => {
  const api = require('./api') as {
    isRetryableApiError: jest.Mock
    isTerminalAuthApiError: jest.Mock
    saveCompletionPhotos: jest.Mock
    submitCleaningConsumables: jest.Mock
    uploadCleaningMedia: jest.Mock
  }
  api.isRetryableApiError.mockReturnValue(false)
  api.isTerminalAuthApiError.mockReturnValue(false)
  api.submitCleaningConsumables.mockResolvedValue({ ok: true })

  const draftMod = require('./cleaningConsumablesDraft') as typeof import('./cleaningConsumablesDraft')
  const queueMod = require('./cleaningConsumablesSubmitQueue') as typeof import('./cleaningConsumablesSubmitQueue')
  await draftMod.setCleaningConsumablesDraft('task-staged-completion', {
    pending_submit: true,
    submit_consumables: true,
    completion_submit_enabled: false,
    items: [{ item_id: 'tissue', status: 'ok', photo_urls: [] }],
    media: [{
      media_id: 'completion-local-1',
      slot: 'completion:living:completion-local-1',
      media_kind: 'completion_photo',
      area: 'living',
      local_uri: 'file:///tmp/staged-living.jpg',
      remote_url: null,
      upload_status: 'local',
    }],
  })
  await queueMod.enqueueCleaningConsumablesSubmit('task-staged-completion')

  await queueMod.processCleaningConsumablesSubmitQueue('token', 'cleaner')

  expect(api.uploadCleaningMedia).not.toHaveBeenCalled()
  expect(api.saveCompletionPhotos).not.toHaveBeenCalled()
  expect(await draftMod.getCleaningConsumablesDraft('task-staged-completion')).toMatchObject({
    consumables_business_saved: true,
    completion_submit_enabled: false,
    completion_business_saved: false,
    submit_status: 'draft',
    pending_submit: false,
    media: [{ media_kind: 'completion_photo', local_uri: 'file:///tmp/staged-living.jpg', upload_status: 'local' }],
  })
})

test('keeps cleaner completion photo draft until idempotent business save succeeds', async () => {
  const api = require('./api') as {
    isRetryableApiError: jest.Mock
    isTerminalAuthApiError: jest.Mock
    saveCompletionPhotos: jest.Mock
    submitCleaningConsumables: jest.Mock
    uploadCleaningMedia: jest.Mock
  }
  api.isRetryableApiError.mockImplementation((error: any) => String(error?.message || '').includes('网络'))
  api.isTerminalAuthApiError.mockReturnValue(false)
  api.uploadCleaningMedia.mockResolvedValue({ url: 'https://cdn.example.com/completion-living.jpg' })
  api.saveCompletionPhotos
    .mockRejectedValueOnce(new Error('网络中断'))
    .mockResolvedValueOnce({ ok: true })

  const draftMod = require('./cleaningConsumablesDraft') as typeof import('./cleaningConsumablesDraft')
  const queueMod = require('./cleaningConsumablesSubmitQueue') as typeof import('./cleaningConsumablesSubmitQueue')
  await draftMod.setCleaningConsumablesDraft('completion-task-1', {
    pending_submit: true,
    submit_consumables: false,
    completion_submit_enabled: true,
    items: [],
    media: [{
      media_id: 'completion-media-1',
      slot: 'completion:living:completion-media-1',
      media_kind: 'completion_photo',
      area: 'living',
      local_uri: 'file:///tmp/completion-living.jpg',
      remote_url: null,
      upload_status: 'local',
      name: 'completion-living.jpg',
      mime_type: 'image/jpeg',
      captured_at: '2026-07-26T01:02:03.000Z',
    }],
  })
  await queueMod.enqueueCleaningConsumablesSubmit('completion-task-1')

  await queueMod.processCleaningConsumablesSubmitQueue('token', 'cleaner')
  expect(api.uploadCleaningMedia).toHaveBeenCalledTimes(1)
  expect(api.saveCompletionPhotos).toHaveBeenCalledWith('token', 'completion-task-1', expect.objectContaining({
    submit_id: expect.any(String),
    step_key: 'completion_photos',
    items: [{ area: 'living', url: 'https://cdn.example.com/completion-living.jpg', captured_at: '2026-07-26T01:02:03.000Z' }],
  }))
  expect(await draftMod.getCleaningConsumablesDraft('completion-task-1')).toMatchObject({
    completion_submit_enabled: true,
    completion_business_saved: false,
    media: [{ local_uri: 'file:///tmp/completion-living.jpg', remote_url: 'https://cdn.example.com/completion-living.jpg' }],
  })

  await queueMod.enqueueCleaningConsumablesSubmit('completion-task-1')
  await queueMod.processCleaningConsumablesSubmitQueue('token', 'cleaner')
  expect(api.uploadCleaningMedia).toHaveBeenCalledTimes(1)
  expect(api.saveCompletionPhotos).toHaveBeenCalledTimes(2)
  expect(await draftMod.getCleaningConsumablesDraft('completion-task-1')).toBeNull()
  expect(await queueMod.isCleaningConsumablesSubmitQueued('completion-task-1')).toBe(false)
})

test('does not clear an unsubmitted consumables draft when completion photos sync first', async () => {
  const api = require('./api') as {
    isRetryableApiError: jest.Mock
    isTerminalAuthApiError: jest.Mock
    saveCompletionPhotos: jest.Mock
    submitCleaningConsumables: jest.Mock
    uploadCleaningMedia: jest.Mock
  }
  api.isRetryableApiError.mockReturnValue(false)
  api.isTerminalAuthApiError.mockReturnValue(false)
  api.uploadCleaningMedia.mockResolvedValue({ url: 'https://cdn.example.com/completion-sofa.jpg' })
  api.saveCompletionPhotos.mockResolvedValue({ ok: true })

  const draftMod = require('./cleaningConsumablesDraft') as typeof import('./cleaningConsumablesDraft')
  const queueMod = require('./cleaningConsumablesSubmitQueue') as typeof import('./cleaningConsumablesSubmitQueue')
  await draftMod.setCleaningConsumablesDraft('completion-task-2', {
    pending_submit: true,
    submit_consumables: false,
    completion_submit_enabled: true,
    items: [{ item_id: 'stock', status: 'low', qty: 1, photo_urls: ['file:///tmp/stock-pending.jpg'] }],
    media: [
      {
        media_id: 'completion-media-2',
        slot: 'completion:sofa:completion-media-2',
        media_kind: 'completion_photo',
        area: 'sofa',
        local_uri: 'file:///tmp/completion-sofa.jpg',
        remote_url: null,
        upload_status: 'local',
      },
      {
        media_id: 'stock-media-2',
        slot: 'item:stock:0',
        media_kind: 'consumable',
        local_uri: 'file:///tmp/stock-pending.jpg',
        remote_url: null,
        upload_status: 'local',
      },
    ],
  })
  await queueMod.enqueueCleaningConsumablesSubmit('completion-task-2')
  await queueMod.processCleaningConsumablesSubmitQueue('token', 'cleaner')

  expect(api.uploadCleaningMedia).toHaveBeenCalledTimes(1)
  expect(api.submitCleaningConsumables).not.toHaveBeenCalled()
  expect(await draftMod.getCleaningConsumablesDraft('completion-task-2')).toMatchObject({
    submit_status: 'draft',
    pending_submit: false,
    completion_submit_enabled: false,
    media: [{ media_kind: 'consumable', local_uri: 'file:///tmp/stock-pending.jpg' }],
  })
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

  expect(result).toEqual({ processed: 0, remaining: 1, succeeded_task_ids: [] })
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

  expect(result).toEqual({ processed: 0, remaining: 1, succeeded_task_ids: [] })
  expect(await draftMod.getCleaningConsumablesDraft('task-3')).toMatchObject({
    task_id: 'task-3',
    pending_submit: true,
    living_room_photo_url: 'https://cdn.example.com/living-room-3.jpg',
    remote_tv_photo_url: 'file:///tmp/remote-tv-3.jpg',
  })
  expect(await queueMod.isCleaningConsumablesSubmitQueued('task-3')).toBe(true)
})

test('checkpoints each photo and retries only the failed photo', async () => {
  const api = require('./api') as {
    isRetryableApiError: jest.Mock
    isTerminalAuthApiError: jest.Mock
    submitCleaningConsumables: jest.Mock
    uploadCleaningMedia: jest.Mock
  }
  api.isRetryableApiError.mockImplementation((error: any) => String(error?.message || '').includes('Network'))
  api.isTerminalAuthApiError.mockReturnValue(false)
  api.uploadCleaningMedia
    .mockResolvedValueOnce({ url: 'https://cdn.example.com/photo-1.jpg' })
    .mockRejectedValueOnce(new Error('Network request failed'))
  api.submitCleaningConsumables.mockResolvedValue({ ok: true })

  const draftMod = require('./cleaningConsumablesDraft') as typeof import('./cleaningConsumablesDraft')
  const queueMod = require('./cleaningConsumablesSubmitQueue') as typeof import('./cleaningConsumablesSubmitQueue')
  await draftMod.setCleaningConsumablesDraft('task-partial', {
    pending_submit: true,
    items: [{ item_id: 'stock', status: 'low', qty: 1, photo_urls: ['file:///tmp/photo-1.jpg', 'file:///tmp/photo-2.jpg'] }],
    photo_meta: {},
  })
  await queueMod.enqueueCleaningConsumablesSubmit('task-partial')
  await queueMod.processCleaningConsumablesSubmitQueue('token', 'cleaner')

  const partial = await draftMod.getCleaningConsumablesDraft('task-partial')
  expect(partial?.items[0]?.photo_urls).toEqual(['https://cdn.example.com/photo-1.jpg', 'file:///tmp/photo-2.jpg'])
  expect(partial?.media.find((entry) => entry.slot === 'item:stock:0')).toMatchObject({ upload_status: 'uploaded', remote_url: 'https://cdn.example.com/photo-1.jpg' })
  expect(partial?.media.find((entry) => entry.slot === 'item:stock:1')).toMatchObject({ upload_status: 'failed', local_uri: 'file:///tmp/photo-2.jpg' })
  expect(api.submitCleaningConsumables).not.toHaveBeenCalled()

  await queueMod.enqueueCleaningConsumablesSubmit('task-partial')
  api.uploadCleaningMedia.mockResolvedValueOnce({ url: 'https://cdn.example.com/photo-2.jpg' })
  await queueMod.processCleaningConsumablesSubmitQueue('token', 'cleaner')
  expect(api.uploadCleaningMedia).toHaveBeenCalledTimes(3)
  expect(api.submitCleaningConsumables).toHaveBeenCalledTimes(1)
})

test('does not reupload photos after a business submit timeout', async () => {
  const api = require('./api') as {
    isRetryableApiError: jest.Mock
    isTerminalAuthApiError: jest.Mock
    submitCleaningConsumables: jest.Mock
    uploadCleaningMedia: jest.Mock
  }
  api.isRetryableApiError.mockImplementation((error: any) => String(error?.message || '').includes('Network'))
  api.isTerminalAuthApiError.mockReturnValue(false)
  api.uploadCleaningMedia.mockResolvedValue({ url: 'https://cdn.example.com/living-room.jpg' })
  api.submitCleaningConsumables
    .mockRejectedValueOnce(new Error('Network request failed'))
    .mockResolvedValueOnce({ ok: true })

  const draftMod = require('./cleaningConsumablesDraft') as typeof import('./cleaningConsumablesDraft')
  const queueMod = require('./cleaningConsumablesSubmitQueue') as typeof import('./cleaningConsumablesSubmitQueue')
  await draftMod.setCleaningConsumablesDraft('task-timeout', {
    pending_submit: true,
    living_room_photo_url: 'file:///tmp/living-room-timeout.jpg',
    items: [],
    photo_meta: {},
  })
  await queueMod.enqueueCleaningConsumablesSubmit('task-timeout')
  await queueMod.processCleaningConsumablesSubmitQueue('token', 'cleaner')
  await queueMod.enqueueCleaningConsumablesSubmit('task-timeout')
  const result = await queueMod.processCleaningConsumablesSubmitQueue('token', 'cleaner')

  expect(result.succeeded_task_ids).toEqual(['task-timeout'])
  expect(api.uploadCleaningMedia).toHaveBeenCalledTimes(1)
  expect(api.submitCleaningConsumables).toHaveBeenCalledTimes(2)
})

test('deduplicates repeated enqueue and prevents concurrent workers', async () => {
  const api = require('./api') as {
    isRetryableApiError: jest.Mock
    isTerminalAuthApiError: jest.Mock
    submitCleaningConsumables: jest.Mock
    uploadCleaningMedia: jest.Mock
  }
  api.isRetryableApiError.mockReturnValue(false)
  api.isTerminalAuthApiError.mockReturnValue(false)
  api.submitCleaningConsumables.mockResolvedValue({ ok: true })

  const draftMod = require('./cleaningConsumablesDraft') as typeof import('./cleaningConsumablesDraft')
  const queueMod = require('./cleaningConsumablesSubmitQueue') as typeof import('./cleaningConsumablesSubmitQueue')
  await draftMod.setCleaningConsumablesDraft('task-double-tap', { pending_submit: true, items: [], photo_meta: {} })
  const firstDraft = await draftMod.getCleaningConsumablesDraft('task-double-tap')
  await queueMod.enqueueCleaningConsumablesSubmit('task-double-tap')
  await queueMod.enqueueCleaningConsumablesSubmit('task-double-tap')
  const secondDraft = await draftMod.getCleaningConsumablesDraft('task-double-tap')
  const results = await Promise.all([
    queueMod.processCleaningConsumablesSubmitQueue('token', 'cleaner'),
    queueMod.processCleaningConsumablesSubmitQueue('token', 'cleaner'),
  ])

  expect(secondDraft).toMatchObject({
    draft_id: firstDraft?.draft_id,
    queue_item_id: firstDraft?.queue_item_id,
    submit_id: firstDraft?.submit_id,
  })
  expect(api.submitCleaningConsumables).toHaveBeenCalledTimes(1)
  expect(results.reduce((sum, result) => sum + result.processed, 0)).toBe(1)
})

test('blocks terminal 400 errors instead of retrying forever', async () => {
  const api = require('./api') as {
    isRetryableApiError: jest.Mock
    isTerminalAuthApiError: jest.Mock
    submitCleaningConsumables: jest.Mock
    uploadCleaningMedia: jest.Mock
  }
  api.isRetryableApiError.mockReturnValue(false)
  api.isTerminalAuthApiError.mockReturnValue(false)
  api.submitCleaningConsumables.mockRejectedValue({ status: 400, message: '补品记录参数错误' })

  const draftMod = require('./cleaningConsumablesDraft') as typeof import('./cleaningConsumablesDraft')
  const queueMod = require('./cleaningConsumablesSubmitQueue') as typeof import('./cleaningConsumablesSubmitQueue')
  await draftMod.setCleaningConsumablesDraft('task-blocked', { pending_submit: true, items: [], photo_meta: {} })
  await queueMod.enqueueCleaningConsumablesSubmit('task-blocked')
  await queueMod.processCleaningConsumablesSubmitQueue('token', 'cleaner')

  expect(await draftMod.getCleaningConsumablesDraft('task-blocked')).toMatchObject({
    submit_status: 'blocked',
    last_error_code: 'HTTP_400',
    last_error_message: '补品记录参数错误',
  })
  await queueMod.processCleaningConsumablesSubmitQueue('token', 'cleaner')
  expect(api.submitCleaningConsumables).toHaveBeenCalledTimes(1)
})

test('marks a missing local file and identifies the affected photo', async () => {
  const api = require('./api') as {
    isRetryableApiError: jest.Mock
    isTerminalAuthApiError: jest.Mock
    submitCleaningConsumables: jest.Mock
    uploadCleaningMedia: jest.Mock
  }
  api.isRetryableApiError.mockReturnValue(false)
  api.isTerminalAuthApiError.mockReturnValue(false)
  api.uploadCleaningMedia.mockRejectedValue(Object.assign(new Error('本地文件已丢失，请重新拍摄'), { code: 'MISSING_LOCAL_FILE' }))

  const draftMod = require('./cleaningConsumablesDraft') as typeof import('./cleaningConsumablesDraft')
  const queueMod = require('./cleaningConsumablesSubmitQueue') as typeof import('./cleaningConsumablesSubmitQueue')
  await draftMod.setCleaningConsumablesDraft('task-missing', {
    pending_submit: true,
    items: [{ item_id: 'stock', status: 'low', qty: 1, photo_urls: ['file:///tmp/missing.jpg'] }],
    photo_meta: {},
  })
  await queueMod.enqueueCleaningConsumablesSubmit('task-missing')
  await queueMod.processCleaningConsumablesSubmitQueue('token', 'cleaner')

  expect(await draftMod.getCleaningConsumablesDraft('task-missing')).toMatchObject({
    submit_status: 'blocked',
    last_error_code: 'MISSING_LOCAL_FILE',
    media: [{ slot: 'item:stock:0', upload_status: 'missing', local_uri: 'file:///tmp/missing.jpg' }],
  })
  expect(api.submitCleaningConsumables).not.toHaveBeenCalled()
})

test.each([400, 401, 403, 409])('blocks HTTP %s without automatic retry', async (status) => {
  const api = require('./api') as {
    isRetryableApiError: jest.Mock
    isTerminalAuthApiError: jest.Mock
    submitCleaningConsumables: jest.Mock
    uploadCleaningMedia: jest.Mock
  }
  api.isRetryableApiError.mockReturnValue(false)
  api.isTerminalAuthApiError.mockReturnValue(status === 401 || status === 403)
  api.submitCleaningConsumables.mockRejectedValue({ status, message: `HTTP ${status} reason` })

  const draftMod = require('./cleaningConsumablesDraft') as typeof import('./cleaningConsumablesDraft')
  const queueMod = require('./cleaningConsumablesSubmitQueue') as typeof import('./cleaningConsumablesSubmitQueue')
  const taskId = `task-http-${status}`
  await draftMod.setCleaningConsumablesDraft(taskId, { pending_submit: true, items: [], photo_meta: {} })
  await queueMod.enqueueCleaningConsumablesSubmit(taskId)
  await queueMod.processCleaningConsumablesSubmitQueue('token', 'cleaner')
  await queueMod.processCleaningConsumablesSubmitQueue('token', 'cleaner')

  expect(await draftMod.getCleaningConsumablesDraft(taskId)).toMatchObject({ submit_status: 'blocked', last_error_code: `HTTP_${status}` })
  expect(api.submitCleaningConsumables).toHaveBeenCalledTimes(1)
})

test('backs off 5xx failures and keeps the draft for a later retry', async () => {
  const api = require('./api') as {
    isRetryableApiError: jest.Mock
    isTerminalAuthApiError: jest.Mock
    submitCleaningConsumables: jest.Mock
    uploadCleaningMedia: jest.Mock
  }
  api.isRetryableApiError.mockReturnValue(false)
  api.isTerminalAuthApiError.mockReturnValue(false)
  api.submitCleaningConsumables.mockRejectedValue({ status: 503, message: '服务暂不可用' })

  const draftMod = require('./cleaningConsumablesDraft') as typeof import('./cleaningConsumablesDraft')
  const queueMod = require('./cleaningConsumablesSubmitQueue') as typeof import('./cleaningConsumablesSubmitQueue')
  await draftMod.setCleaningConsumablesDraft('task-503', { pending_submit: true, items: [], photo_meta: {} })
  await queueMod.enqueueCleaningConsumablesSubmit('task-503')
  await queueMod.processCleaningConsumablesSubmitQueue('token', 'cleaner')

  expect(await draftMod.getCleaningConsumablesDraft('task-503')).toMatchObject({
    submit_status: 'waiting_sync',
    last_error_code: 'HTTP_503',
    retry_count: 1,
  })
  expect(new Date((await draftMod.getCleaningConsumablesDraft('task-503'))?.next_retry_at || 0).getTime()).toBeGreaterThan(Date.now())
  await queueMod.processCleaningConsumablesSubmitQueue('token', 'cleaner')
  expect(api.submitCleaningConsumables).toHaveBeenCalledTimes(1)
})

test('persists the same queue and draft ids across a storage reload boundary', async () => {
  const draftMod = require('./cleaningConsumablesDraft') as typeof import('./cleaningConsumablesDraft')
  const queueMod = require('./cleaningConsumablesSubmitQueue') as typeof import('./cleaningConsumablesSubmitQueue')
  await draftMod.setCleaningConsumablesDraft('task-restart', { pending_submit: true, items: [], photo_meta: {} })
  const beforeDraft = await draftMod.getCleaningConsumablesDraft('task-restart')
  await queueMod.enqueueCleaningConsumablesSubmit('task-restart')
  const beforeQueue = await queueMod.getCleaningConsumablesSubmitQueueItem('task-restart')

  expect(await draftMod.getCleaningConsumablesDraft('task-restart')).toMatchObject({
    draft_id: beforeDraft?.draft_id,
    queue_item_id: beforeDraft?.queue_item_id,
    submit_id: beforeDraft?.submit_id,
  })
  expect(await queueMod.getCleaningConsumablesSubmitQueueItem('task-restart')).toMatchObject({
    draft_id: beforeQueue?.draft_id,
    queue_item_id: beforeQueue?.queue_item_id,
    submit_id: beforeQueue?.submit_id,
    status: 'active',
  })
})
