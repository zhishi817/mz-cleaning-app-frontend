jest.mock('./api', () => ({
  ApiError: class ApiError extends Error {},
  completePropertyFeedbackProject: jest.fn(),
  createPropertyFeedbackBatch: jest.fn(),
  isRetryableApiError: jest.fn(),
  saveInspectionPhotos: jest.fn(),
  saveRestockProof: jest.fn(),
  uploadCleaningMedia: jest.fn(),
}))

jest.mock('./inspectionThumbnailCache', () => ({
  createInspectionThumbnail: jest.fn(async () => null),
  inspectionThumbnailExists: jest.fn(() => false),
  pruneInspectionThumbnailCache: jest.fn(),
}))

jest.mock('./localMediaDrafts', () => ({
  deleteDraftMedia: jest.fn(),
  draftMimeTypeFrom: jest.fn((_name: string, mimeType: string) => mimeType || 'image/jpeg'),
  persistDraftMedia: jest.fn(({ sourceUri }: { sourceUri: string }) => sourceUri),
}))

function getAsyncStorage() {
  return require('@react-native-async-storage/async-storage') as {
    clear: () => Promise<void>
    setItem: (key: string, value: string) => Promise<void>
  }
}

beforeEach(async () => {
  jest.clearAllMocks()
  jest.resetModules()
  await getAsyncStorage().clear()
})

function baseSnapshot(taskId: string) {
  return {
    task_id: taskId,
    cleaning_task_id: `cleaning-${taskId}`,
    property_id: 'property-1',
    property_code: 'A1201',
    room_photo_requirement: 'password_only' as const,
    restock_confirmed_sufficient: false,
    restock: [],
    room_photos: {
      living: [],
      sofa: [],
      bedroom: [],
      kitchen: [],
    },
    cleaning_issue: [],
    feedback: null,
  }
}

test('rejects a required-photo snapshot when any room area is missing', async () => {
  const queueMod = require('./inspectionPanelSubmitQueue') as typeof import('./inspectionPanelSubmitQueue')

  await queueMod.saveInspectionPanelDraftBatch({
    task_id: 'task-required-photos',
    cleaning_task_id: 'cleaning-task-required-photos',
    snapshot: {
      ...baseSnapshot('task-required-photos'),
      room_photo_requirement: 'required',
      restock_confirmed_sufficient: true,
    },
  })

  await expect(queueMod.submitInspectionPanelBatch('task-required-photos'))
    .rejects.toThrow('请拍摄 客厅 检查照片')
  expect((await queueMod.getInspectionPanelBatch('task-required-photos'))?.status).toBe('draft')
})

test('allows missing room photos only after guest arrival skip is explicitly recorded', async () => {
  const queueMod = require('./inspectionPanelSubmitQueue') as typeof import('./inspectionPanelSubmitQueue')

  await queueMod.saveInspectionPanelDraftBatch({
    task_id: 'task-guest-arrived',
    cleaning_task_id: 'cleaning-task-guest-arrived',
    snapshot: {
      ...baseSnapshot('task-guest-arrived'),
      room_photo_requirement: 'guest_arrival_confirmed',
      restock_confirmed_sufficient: true,
    },
  })

  const submitted = await queueMod.submitInspectionPanelBatch('task-guest-arrived')
  expect(submitted?.status).toBe('pending_submit')
})

test('allows carry-forward restock items without proof photos and persists the next-checkout label', async () => {
  const api = require('./api') as {
    isRetryableApiError: jest.Mock
    saveInspectionPhotos: jest.Mock
    saveRestockProof: jest.Mock
    uploadCleaningMedia: jest.Mock
  }
  api.isRetryableApiError.mockReturnValue(false)
  api.saveRestockProof.mockResolvedValue({ ok: true })
  api.saveInspectionPhotos.mockResolvedValue({ ok: true })

  const queueMod = require('./inspectionPanelSubmitQueue') as typeof import('./inspectionPanelSubmitQueue')

  await queueMod.saveInspectionPanelDraftBatch({
    task_id: 'task-carry-forward',
    cleaning_task_id: 'cleaning-task-carry-forward',
    property_id: 'property-1',
    property_code: 'A1201',
    snapshot: {
      ...baseSnapshot('task-carry-forward'),
      restock: [
        {
          item_id: 'dish_detergent',
          label: '洗洁精',
          qty: 2,
          status: 'carry_forward',
          source_photo_url: null,
          proof_media: [],
          note: '下次退房补',
          origin: 'manual',
        },
      ],
    },
  })

  await queueMod.submitInspectionPanelBatch('task-carry-forward')
  const result = await queueMod.processInspectionPanelSubmitQueue('token-carry')

  expect(result).toEqual({ processed: 1, remaining: 0 })
  expect(api.uploadCleaningMedia).not.toHaveBeenCalled()
  expect(api.saveRestockProof).toHaveBeenCalledWith(
    'token-carry',
    'cleaning-task-carry-forward',
    expect.objectContaining({
      items: [
        expect.objectContaining({
          item_id: 'dish_detergent',
          label: '洗洁精',
          status: 'carry_forward',
          proof_url: 'no_photo',
          proof_urls: [],
        }),
      ],
    }),
    expect.objectContaining({ skipAuthInvalidation: true }),
  )
})

test('blocks a legacy pending batch with missing required photos before any API call', async () => {
  const api = require('./api') as {
    saveInspectionPhotos: jest.Mock
    saveRestockProof: jest.Mock
    uploadCleaningMedia: jest.Mock
  }
  await getAsyncStorage().setItem('mzstay.inspection_panel_submit_queue.v1', JSON.stringify([{
    submit_id: 'legacy-submit-1',
    task_id: 'legacy-task-1',
    cleaning_task_id: 'legacy-cleaning-1',
    status: 'pending_submit',
    created_at: '2026-06-23T10:00:00.000Z',
    updated_at: '2026-06-23T10:00:00.000Z',
    snapshot: {
      ...baseSnapshot('legacy-task-1'),
      cleaning_task_id: 'legacy-cleaning-1',
      room_photo_requirement: 'required',
      restock_confirmed_sufficient: true,
    },
    steps: {
      upload_media: { status: 'pending' },
      save_restock_proof: { status: 'pending' },
      save_inspection_photos: { status: 'pending' },
      create_feedback_batch: { status: 'pending' },
      complete_feedback_projects: { status: 'pending' },
    },
  }]))
  const queueMod = require('./inspectionPanelSubmitQueue') as typeof import('./inspectionPanelSubmitQueue')

  const result = await queueMod.processInspectionPanelSubmitQueue('token-legacy')

  expect(result).toEqual({ processed: 0, remaining: 1 })
  expect((await queueMod.getInspectionPanelBatch('legacy-task-1'))).toMatchObject({
    status: 'failed',
    last_error: '请拍摄 客厅 检查照片',
  })
  expect(api.uploadCleaningMedia).not.toHaveBeenCalled()
  expect(api.saveRestockProof).not.toHaveBeenCalled()
  expect(api.saveInspectionPhotos).not.toHaveBeenCalled()
})

test('persists partial feedback mapping and retries only missing client_item_id items', async () => {
  const api = require('./api') as {
    completePropertyFeedbackProject: jest.Mock
    createPropertyFeedbackBatch: jest.Mock
    isRetryableApiError: jest.Mock
    saveInspectionPhotos: jest.Mock
    saveRestockProof: jest.Mock
    uploadCleaningMedia: jest.Mock
  }
  api.isRetryableApiError.mockReturnValue(false)
  api.uploadCleaningMedia.mockResolvedValue({ url: 'https://cdn.example.com/media.jpg' })
  api.saveRestockProof.mockResolvedValue({ ok: true })
  api.saveInspectionPhotos.mockResolvedValue({ ok: true })
  api.completePropertyFeedbackProject.mockResolvedValue({ ok: true })
  api.createPropertyFeedbackBatch
    .mockResolvedValueOnce([
      { ok: true, response: { id: 'fb-1' } },
      { ok: false, error: 'daily failed' },
      { ok: true, response: { id: 'fb-3' } },
    ])
    .mockResolvedValueOnce([
      { ok: true, response: { id: 'fb-2' } },
    ])

  const queueMod = require('./inspectionPanelSubmitQueue') as typeof import('./inspectionPanelSubmitQueue')

  await queueMod.saveInspectionPanelDraftBatch({
    task_id: 'task-feedback',
    cleaning_task_id: 'cleaning-task-feedback',
    property_id: 'property-1',
    property_code: 'A1201',
    snapshot: {
      ...baseSnapshot('task-feedback'),
      feedback: {
        task_id: 'task-feedback',
        updated_at: '2026-06-23T10:00:00.000Z',
        kind: 'maintenance',
        maintenanceDrafts: [
          { clientId: 'm-1', client_item_id: 'm-1', area: 'kitchen', detail: 'fix tap', media: [], submitAsCompleted: false, completionNote: '', completionAfterPhotos: [] },
        ],
        deepCleaningDrafts: [
          { clientId: 'd-1', client_item_id: 'd-1', area: 'bedroom', detail: 'deep clean carpet', media: [], submitAsCompleted: false, completionNote: '', completionAfterPhotos: [], completionStartedAt: null, completionEndedAt: null },
        ],
        dailyDrafts: [
          { clientId: 'n-1', client_item_id: 'n-1', status: 'need_replace', itemName: 'Soap', qty: '1', note: '', media: [] },
        ],
        photo_meta: {},
      },
    },
  })
  await queueMod.submitInspectionPanelBatch('task-feedback')

  const first = await queueMod.processInspectionPanelSubmitQueue('token-1')

  expect(first).toEqual({ processed: 0, remaining: 1 })
  const failedBatch = await queueMod.getInspectionPanelBatch('task-feedback')
  expect(failedBatch?.status).toBe('partial_failed')
  expect(failedBatch?.steps.create_feedback_batch.status).toBe('failed')
  expect(failedBatch?.steps.create_feedback_batch.output).toMatchObject({
    'm-1': { feedback_id: 'fb-1' },
    'n-1': { feedback_id: 'fb-3' },
  })
  expect(api.createPropertyFeedbackBatch).toHaveBeenNthCalledWith(1, 'token-1', expect.objectContaining({
    submit_id: failedBatch?.submit_id,
    step_key: 'create_feedback_batch',
    items: [
      expect.objectContaining({ client_item_id: 'm-1' }),
      expect.objectContaining({ client_item_id: 'd-1' }),
      expect.objectContaining({ client_item_id: 'n-1' }),
    ],
  }))

  const second = await queueMod.processInspectionPanelSubmitQueue('token-1')

  expect(second).toEqual({ processed: 1, remaining: 0 })
  expect(api.createPropertyFeedbackBatch).toHaveBeenNthCalledWith(2, 'token-1', expect.objectContaining({
    items: [expect.objectContaining({ client_item_id: 'd-1' })],
  }))
  const syncedBatch = await queueMod.getInspectionPanelBatch('task-feedback')
  expect(syncedBatch?.status).toBe('synced')
  expect(syncedBatch?.steps.create_feedback_batch.status).toBe('succeeded')
  expect(syncedBatch?.steps.create_feedback_batch.output).toMatchObject({
    'm-1': { feedback_id: 'fb-1' },
    'd-1': { feedback_id: 'fb-2' },
    'n-1': { feedback_id: 'fb-3' },
  })
})

test('does not re-upload media when restock save retries after upload_media already succeeded', async () => {
  const api = require('./api') as {
    completePropertyFeedbackProject: jest.Mock
    createPropertyFeedbackBatch: jest.Mock
    isRetryableApiError: jest.Mock
    saveInspectionPhotos: jest.Mock
    saveRestockProof: jest.Mock
    uploadCleaningMedia: jest.Mock
  }
  api.isRetryableApiError.mockReturnValue(false)
  api.uploadCleaningMedia.mockResolvedValue({
    key: 'cleaning/restock-proof.jpg',
    url: 'https://private.r2.cloudflarestorage.com/bucket/cleaning/restock-proof.jpg',
  })
  api.saveInspectionPhotos.mockResolvedValue({ ok: true })
  api.completePropertyFeedbackProject.mockResolvedValue({ ok: true })
  api.createPropertyFeedbackBatch.mockResolvedValue([])
  api.saveRestockProof
    .mockRejectedValueOnce(new Error('restock failed'))
    .mockResolvedValueOnce({ ok: true })
  const thumbnailCache = require('./inspectionThumbnailCache') as {
    createInspectionThumbnail: jest.Mock
    pruneInspectionThumbnailCache: jest.Mock
  }
  thumbnailCache.createInspectionThumbnail.mockResolvedValue('file:///cache/restock-proof-thumb.jpg')
  const localMedia = require('./localMediaDrafts') as {
    deleteDraftMedia: jest.Mock
  }

  const queueMod = require('./inspectionPanelSubmitQueue') as typeof import('./inspectionPanelSubmitQueue')

  await queueMod.saveInspectionPanelDraftBatch({
    task_id: 'task-restock',
    cleaning_task_id: 'cleaning-task-restock',
    property_id: 'property-1',
    property_code: 'A1201',
    snapshot: {
      ...baseSnapshot('task-restock'),
      restock: [
        {
          item_id: 'toilet-paper',
          label: 'Toilet Paper',
          qty: 2,
          status: 'restocked',
          source_photo_url: null,
          proof_media: [
            {
              id: 'proof-1',
              local_uri: 'file:///tmp/proof-1.heic',
              uploaded_url: null,
              name: 'proof-1.heic',
              mime_type: 'image/heic',
              captured_at: '2026-06-23T10:00:00.000Z',
              watermark_text: null,
              note: null,
            },
          ],
          note: '',
          origin: 'task',
        },
      ],
    },
  })
  await queueMod.submitInspectionPanelBatch('task-restock')

  const first = await queueMod.processInspectionPanelSubmitQueue('token-2')

  expect(first).toEqual({ processed: 0, remaining: 1 })
  expect(api.uploadCleaningMedia).toHaveBeenCalledTimes(1)
  const failedBatch = await queueMod.getInspectionPanelBatch('task-restock')
  expect(failedBatch?.steps.upload_media.status).toBe('succeeded')
  expect(failedBatch?.snapshot.restock[0]?.proof_media[0]?.uploaded_key).toBe('cleaning/restock-proof.jpg')
  expect(api.saveRestockProof).toHaveBeenNthCalledWith(
    1,
    'token-2',
    'cleaning-task-restock',
    expect.objectContaining({
      items: [
        expect.objectContaining({
          proof_url: 'https://private.r2.cloudflarestorage.com/bucket/cleaning/restock-proof.jpg',
        }),
      ],
    }),
    { skipAuthInvalidation: true },
  )
  expect(failedBatch?.steps.save_restock_proof.status).toBe('failed')
  expect(failedBatch?.status).toBe('partial_failed')

  const second = await queueMod.processInspectionPanelSubmitQueue('token-2')

  expect(second).toEqual({ processed: 1, remaining: 0 })
  expect(api.uploadCleaningMedia).toHaveBeenCalledTimes(1)
  expect(api.saveRestockProof).toHaveBeenCalledTimes(2)
  const syncedBatch = await queueMod.getInspectionPanelBatch('task-restock')
  expect(syncedBatch?.status).toBe('synced')
  expect(syncedBatch?.steps.save_restock_proof.status).toBe('succeeded')
  expect(syncedBatch?.snapshot.restock[0]?.proof_media[0]).toMatchObject({
    local_uri: null,
    thumbnail_uri: 'file:///cache/restock-proof-thumb.jpg',
    uploaded_key: 'cleaning/restock-proof.jpg',
  })
  expect(localMedia.deleteDraftMedia).toHaveBeenCalledWith('file:///tmp/proof-1.heic')
  expect(thumbnailCache.pruneInspectionThumbnailCache)
    .toHaveBeenCalledWith(['file:///cache/restock-proof-thumb.jpg'])
})

test('keeps the original file when thumbnail generation fails after sync', async () => {
  const api = require('./api') as {
    completePropertyFeedbackProject: jest.Mock
    createPropertyFeedbackBatch: jest.Mock
    isRetryableApiError: jest.Mock
    saveInspectionPhotos: jest.Mock
    saveRestockProof: jest.Mock
    uploadCleaningMedia: jest.Mock
  }
  api.isRetryableApiError.mockReturnValue(false)
  api.uploadCleaningMedia.mockResolvedValue({
    key: 'cleaning/living-room.jpg',
    url: 'https://private.r2.cloudflarestorage.com/bucket/cleaning/living-room.jpg',
  })
  api.saveInspectionPhotos.mockResolvedValue({ ok: true })
  api.saveRestockProof.mockResolvedValue({ ok: true })
  api.completePropertyFeedbackProject.mockResolvedValue({ ok: true })
  api.createPropertyFeedbackBatch.mockResolvedValue([])
  const thumbnailCache = require('./inspectionThumbnailCache') as {
    createInspectionThumbnail: jest.Mock
  }
  thumbnailCache.createInspectionThumbnail.mockResolvedValue(null)
  const localMedia = require('./localMediaDrafts') as {
    deleteDraftMedia: jest.Mock
  }
  const queueMod = require('./inspectionPanelSubmitQueue') as typeof import('./inspectionPanelSubmitQueue')

  await queueMod.saveInspectionPanelDraftBatch({
    task_id: 'task-thumbnail-failed',
    cleaning_task_id: 'cleaning-thumbnail-failed',
    snapshot: {
      ...baseSnapshot('task-thumbnail-failed'),
      room_photos: {
        living: [{
          id: 'living-1',
          local_uri: 'file:///tmp/living-1.jpg',
          uploaded_url: null,
          name: 'living-1.jpg',
          mime_type: 'image/jpeg',
          captured_at: '2026-06-23T10:00:00.000Z',
        }],
        sofa: [],
        bedroom: [],
        kitchen: [],
      },
    },
  })
  await queueMod.submitInspectionPanelBatch('task-thumbnail-failed')
  await queueMod.processInspectionPanelSubmitQueue('token-3')

  const syncedBatch = await queueMod.getInspectionPanelBatch('task-thumbnail-failed')
  expect(syncedBatch?.status).toBe('synced')
  expect(syncedBatch?.snapshot.room_photos.living[0]).toMatchObject({
    local_uri: 'file:///tmp/living-1.jpg',
    thumbnail_uri: null,
    uploaded_key: 'cleaning/living-room.jpg',
  })
  expect(localMedia.deleteDraftMedia).not.toHaveBeenCalled()
})
