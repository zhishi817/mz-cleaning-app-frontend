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
  draftFileExists: jest.fn(() => true),
  draftMimeTypeFrom: jest.fn((_name: string, mimeType: string) => mimeType || 'image/jpeg'),
  persistDraftMedia: jest.fn(({ sourceUri }: { sourceUri: string }) => sourceUri),
}))

function getAsyncStorage() {
  return require('@react-native-async-storage/async-storage') as {
    clear: () => Promise<void>
    getItem: (key: string) => Promise<string | null>
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
      bathroom: [],
    },
    cleaning_issue: [],
    feedback: null,
  }
}

function localRoomPhoto(id: string) {
  return {
    id,
    local_uri: `file:///${id}.jpg`,
    thumbnail_uri: null,
    uploaded_key: null,
    uploaded_url: null,
    name: `${id}.jpg`,
    mime_type: 'image/jpeg',
    captured_at: '2026-07-25T00:00:00.000Z',
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

test('requires the new bathroom overall photo before submitting inspection photos', async () => {
  const queueMod = require('./inspectionPanelSubmitQueue') as typeof import('./inspectionPanelSubmitQueue')

  await queueMod.saveInspectionPanelDraftBatch({
    task_id: 'task-required-bathroom-photo',
    cleaning_task_id: 'cleaning-task-required-bathroom-photo',
    snapshot: {
      ...baseSnapshot('task-required-bathroom-photo'),
      room_photo_requirement: 'required',
      restock_confirmed_sufficient: true,
      room_photos: {
        living: [localRoomPhoto('living')],
        sofa: [localRoomPhoto('sofa')],
        bedroom: [localRoomPhoto('bedroom')],
        kitchen: [localRoomPhoto('kitchen')],
        bathroom: [],
      },
    },
  })

  await expect(queueMod.submitInspectionPanelBatch('task-required-bathroom-photo'))
    .rejects.toThrow('请拍摄 浴室 检查照片')
})

test('exposes failed sync steps and retained local media for the inspector status panel', async () => {
  const queueMod = require('./inspectionPanelSubmitQueue') as typeof import('./inspectionPanelSubmitQueue')
  const item = {
    submit_id: 'submit-status',
    task_id: 'task-status',
    cleaning_task_id: 'cleaning-task-status',
    property_id: 'property-1',
    property_code: 'A1201',
    status: 'partial_failed' as const,
    created_at: '2026-07-24T00:00:00.000Z',
    updated_at: '2026-07-24T00:00:00.000Z',
    snapshot: {
      ...baseSnapshot('task-status'),
      room_photo_requirement: 'required' as const,
      restock_confirmed_sufficient: true,
      room_photos: {
        living: [{ id: 'local-1', local_uri: 'file:///local-1.jpg', thumbnail_uri: null, uploaded_key: null, uploaded_url: null, name: 'local-1.jpg', mime_type: 'image/jpeg', captured_at: '2026-07-24T00:00:00.000Z' }],
        sofa: [],
        bedroom: [],
        kitchen: [],
        bathroom: [],
      },
      cleaning_issue: [],
      restock: [],
    },
    steps: {
      upload_media: { status: 'succeeded' as const, error: null },
      save_restock_proof: { status: 'succeeded' as const, error: null },
      save_inspection_photos: { status: 'failed' as const, error: '服务器错误，请稍后重试' },
      create_feedback_batch: { status: 'pending' as const, error: null },
      complete_feedback_projects: { status: 'pending' as const, error: null },
    },
    last_error: '服务器错误，请稍后重试',
  }

  expect(queueMod.inspectionPanelFailedStepDetails(item)).toEqual([
    { key: 'save_inspection_photos', label: '保存检查照片记录', error: '服务器错误，请稍后重试' },
  ])
  expect(queueMod.inspectionPanelLocalMediaSummary(item)).toMatchObject({ total: 1, retained: 1, remoteReferenced: 0 })
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

test('only allows video after a formal batch has durable local or remote photo references', async () => {
  const queueMod = require('./inspectionPanelSubmitQueue') as typeof import('./inspectionPanelSubmitQueue')
  const completeSnapshot = {
    ...baseSnapshot('task-video-gate'),
    room_photo_requirement: 'required' as const,
    restock_confirmed_sufficient: true,
    room_photos: {
      living: [localRoomPhoto('living')],
      sofa: [localRoomPhoto('sofa')],
      bedroom: [localRoomPhoto('bedroom')],
      kitchen: [localRoomPhoto('kitchen')],
      bathroom: [localRoomPhoto('bathroom')],
    },
  }

  await queueMod.saveInspectionPanelDraftBatch({
    task_id: 'task-video-gate',
    cleaning_task_id: 'cleaning-task-video-gate',
    snapshot: completeSnapshot,
  })
  await queueMod.submitInspectionPanelBatch('task-video-gate')

  expect(queueMod.getInspectionPanelVideoReadiness(await queueMod.getInspectionPanelBatch('task-video-gate'))).toMatchObject({
    ready: true,
    skipInspectionPhotos: false,
  })

  const localMedia = require('./localMediaDrafts') as { draftFileExists: jest.Mock }
  localMedia.draftFileExists.mockReturnValue(false)
  expect(queueMod.getInspectionPanelVideoReadiness(await queueMod.getInspectionPanelBatch('task-video-gate'))).toMatchObject({
    ready: false,
  })
})

test('guest-arrival-confirmed batch is video-ready without room photos', async () => {
  const queueMod = require('./inspectionPanelSubmitQueue') as typeof import('./inspectionPanelSubmitQueue')

  await queueMod.saveInspectionPanelDraftBatch({
    task_id: 'task-video-guest-arrival',
    cleaning_task_id: 'cleaning-task-video-guest-arrival',
    snapshot: {
      ...baseSnapshot('task-video-guest-arrival'),
      room_photo_requirement: 'guest_arrival_confirmed',
      restock_confirmed_sufficient: true,
    },
  })
  const submitted = await queueMod.submitInspectionPanelBatch('task-video-guest-arrival')

  expect(queueMod.getInspectionPanelVideoReadiness(submitted)).toEqual({
    ready: true,
    reason: null,
    skipInspectionPhotos: true,
  })
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

test('keeps a submitted batch without cleaning task id and syncs after binding the action target', async () => {
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
    task_id: 'task-wait-source',
    cleaning_task_id: '',
    snapshot: {
      ...baseSnapshot('task-wait-source'),
      cleaning_task_id: '',
      restock_confirmed_sufficient: true,
      room_photo_requirement: 'guest_arrival_confirmed',
    },
  })
  await queueMod.submitInspectionPanelBatch('task-wait-source')

  const waiting = await queueMod.processInspectionPanelSubmitQueue('token-wait')

  expect(waiting).toEqual({ processed: 0, remaining: 1 })
  expect(api.saveRestockProof).not.toHaveBeenCalled()
  expect(api.saveInspectionPhotos).not.toHaveBeenCalled()
  expect(await queueMod.getInspectionPanelBatch('task-wait-source')).toMatchObject({
    status: 'pending_submit',
    cleaning_task_id: '',
    last_error: '已保存到本机，等待任务信息刷新后自动同步。',
  })

  await queueMod.bindInspectionPanelCleaningTaskId({
    task_id: 'task-wait-source',
    cleaning_task_id: 'cleaning-action-target',
    property_id: 'property-1',
    property_code: 'A1201',
  })
  const synced = await queueMod.processInspectionPanelSubmitQueue('token-wait')

  expect(synced).toEqual({ processed: 1, remaining: 0 })
  expect(api.saveRestockProof).toHaveBeenCalledWith(
    'token-wait',
    'cleaning-action-target',
    expect.any(Object),
    { skipAuthInvalidation: true },
  )
  expect(api.saveInspectionPhotos).toHaveBeenCalledWith(
    'token-wait',
    'cleaning-action-target',
    expect.objectContaining({ items: [], guest_arrival_confirmed: true }),
    { skipAuthInvalidation: true },
  )
  expect((await queueMod.getInspectionPanelBatch('task-wait-source'))?.status).toBe('synced')
})

test('does not emit a queue update when binding the same action target again', async () => {
  const queueMod = require('./inspectionPanelSubmitQueue') as typeof import('./inspectionPanelSubmitQueue')

  await queueMod.saveInspectionPanelDraftBatch({
    task_id: 'task-stable-bind',
    cleaning_task_id: 'cleaning-task-stable-bind',
    snapshot: baseSnapshot('task-stable-bind'),
  })
  const listener = jest.fn()
  const unsubscribe = queueMod.subscribeInspectionPanelSubmitQueue(listener)

  await queueMod.bindInspectionPanelCleaningTaskId({
    task_id: 'task-stable-bind',
    cleaning_task_id: 'cleaning-task-stable-bind',
    property_id: 'property-1',
    property_code: 'A1201',
  })

  expect(listener).not.toHaveBeenCalled()
  unsubscribe()
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

test('migrates an oversized legacy submit id and retries only failed business steps', async () => {
  const api = require('./api') as {
    saveInspectionPhotos: jest.Mock
    saveRestockProof: jest.Mock
    uploadCleaningMedia: jest.Mock
  }
  api.saveRestockProof.mockResolvedValue({ ok: true })
  api.saveInspectionPhotos.mockResolvedValue({ ok: true })

  const oversizedSubmitId = 'x'.repeat(121)
  await getAsyncStorage().setItem('mzstay.inspection_panel_submit_queue.v1', JSON.stringify([{
    submit_id: oversizedSubmitId,
    task_id: 'legacy-task-long-submit-id',
    cleaning_task_id: 'legacy-cleaning-long-submit-id',
    status: 'partial_failed',
    created_at: '2026-07-25T10:00:00.000Z',
    updated_at: '2026-07-25T10:00:00.000Z',
    snapshot: {
      ...baseSnapshot('legacy-task-long-submit-id'),
      cleaning_task_id: 'legacy-cleaning-long-submit-id',
      restock_confirmed_sufficient: true,
    },
    steps: {
      upload_media: { status: 'succeeded' },
      save_restock_proof: { status: 'failed', error: 'String must contain at most 120 character(s)' },
      save_inspection_photos: { status: 'failed', error: 'String must contain at most 120 character(s)' },
      create_feedback_batch: { status: 'succeeded', output: {} },
      complete_feedback_projects: { status: 'succeeded', output: {} },
    },
  }]))

  const queueMod = require('./inspectionPanelSubmitQueue') as typeof import('./inspectionPanelSubmitQueue')
  const result = await queueMod.processInspectionPanelSubmitQueue('token-legacy-long-submit-id')

  expect(result).toEqual({ processed: 1, remaining: 0 })
  expect(api.uploadCleaningMedia).not.toHaveBeenCalled()
  expect(api.saveRestockProof).toHaveBeenCalledTimes(1)
  expect(api.saveInspectionPhotos).toHaveBeenCalledTimes(1)
  const migratedSubmitId = api.saveRestockProof.mock.calls[0][2].submit_id
  expect(typeof migratedSubmitId).toBe('string')
  expect(migratedSubmitId.length).toBeLessThanOrEqual(96)
  expect(migratedSubmitId).not.toBe(oversizedSubmitId)
  expect(api.saveInspectionPhotos.mock.calls[0][2].submit_id).toBe(migratedSubmitId)
  expect((await queueMod.getInspectionPanelBatch('legacy-task-long-submit-id'))?.status).toBe('synced')

  const persisted = JSON.parse((await getAsyncStorage().getItem('mzstay.inspection_panel_submit_queue.v1')) || '[]')
  expect(persisted).toHaveLength(1)
  expect(persisted[0]).toMatchObject({ status: 'synced', submit_id: migratedSubmitId })
})

test('generates a bounded submit id even when the task id is long', async () => {
  const queueMod = require('./inspectionPanelSubmitQueue') as typeof import('./inspectionPanelSubmitQueue')
  const taskId = `task-${'x'.repeat(180)}`

  await queueMod.saveInspectionPanelDraftBatch({
    task_id: taskId,
    cleaning_task_id: `cleaning-${taskId}`,
    snapshot: baseSnapshot(taskId),
  })

  const batch = await queueMod.getInspectionPanelBatch(taskId)
  expect(batch?.submit_id.length).toBeLessThanOrEqual(96)
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
          proof_url: 'cleaning/restock-proof.jpg',
        }),
      ],
    }),
    { skipAuthInvalidation: true },
  )
  expect(failedBatch?.steps.save_restock_proof.status).toBe('failed')
  expect(api.saveInspectionPhotos).toHaveBeenCalledTimes(1)
  expect(failedBatch?.steps.save_inspection_photos.status).toBe('succeeded')
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
  expect(localMedia.deleteDraftMedia).not.toHaveBeenCalled()
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
        bathroom: [],
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
