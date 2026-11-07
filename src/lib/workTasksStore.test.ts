import {
  __workTasksLocalPatchEntryCountForTests,
  applyManagerTaskSaveReceipt,
  activateWorkTasksRealtime,
  beginManagerTaskSaveOperation,
  canViewReadOnlyWorkRecordLockCodes,
  deactivateWorkTasksRealtime,
  establishWorkTasksSession,
  eventRequiresGuestReadyAuthorityRefresh,
  eventRequiresKeyHandoverAuthorityRefresh,
  findWorkTaskItemByAnyId,
  failManagerTaskSaveOperation,
  getWorkTasksSnapshot,
  initWorkTasksStore,
  isSafePatchEvent,
  makeWorkTasksBucketKey,
  makeWorkTasksProjectionKey,
  mergePatchIntoTask,
  mergeRemoteWorkTaskItems,
  patchWorkTaskItem,
  projectCleaningStatusForTask,
  redactReadOnlyWorkRecord,
  reconcileExecutionListVisibilityAfterPatch,
  requestWorkTasksRefresh,
  setWorkTasksRefreshForeground,
  subscribeWorkTasks,
  type WorkTaskItem,
} from './workTasksStore'

const mockStreamListeners: Record<string, Array<(event: any) => void>> = {}

jest.mock('react-native-sse', () => jest.fn().mockImplementation(() => ({
  addEventListener: jest.fn((name: string, listener: (event: any) => void) => {
    mockStreamListeners[name] = [...(mockStreamListeners[name] || []), listener]
  }),
  close: jest.fn(),
})))
jest.mock('../config/env', () => ({ API_BASE_URL: 'https://api.example.com/api' }))
jest.mock('./storage', () => ({ getJson: jest.fn(), setJson: jest.fn() }))
jest.mock('./api', () => ({ listWorkTasks: jest.fn() }))
jest.mock('./authEvents', () => ({ notifyAuthInvalidated: jest.fn() }))
jest.mock('./cleaningMediaCache', () => ({ invalidateCleaningMediaCache: jest.fn(async () => {}) }))

beforeEach(() => {
  jest.useRealTimers()
  const EventSource = require('react-native-sse')
  const storage = require('./storage')
  const api = require('./api')
  EventSource.mockClear()
  storage.getJson.mockReset()
  storage.getJson.mockResolvedValue(null)
  storage.setJson.mockReset()
  storage.setJson.mockResolvedValue(undefined)
  api.listWorkTasks.mockReset()
  api.listWorkTasks.mockResolvedValue([])
  for (const key of Object.keys(mockStreamListeners)) delete mockStreamListeners[key]
  const mediaCache = require('./cleaningMediaCache')
  mediaCache.invalidateCleaningMediaCache.mockClear()
  deactivateWorkTasksRealtime()
  establishWorkTasksSession({ token: 't1', userId: 'refresh-user' })
  setWorkTasksRefreshForeground(true)
})

afterEach(() => {
  deactivateWorkTasksRealtime()
  jest.useRealTimers()
})

function makeTask(patch: Partial<WorkTaskItem>): WorkTaskItem {
  return {
    id: 'task-1',
    task_kind: 'cleaning',
    source_type: 'cleaning_tasks',
    source_id: 'checkout-1',
    property_id: 'property-1',
    title: 'A1',
    summary: null,
    scheduled_date: '2026-07-25',
    status: 'assigned',
    urgency: 'medium',
    date: '2026-07-25',
    ...patch,
  } as WorkTaskItem
}

test('permission projection changes across roles, permissions, view and manager-unassigned scope', () => {
  const base = makeWorkTasksProjectionKey({
    roles: ['cleaner'],
    permissions: [],
    activeRole: 'cleaner',
    view: 'mine',
  })
  const variants = [
    makeWorkTasksProjectionKey({ roles: ['admin'], permissions: [], activeRole: 'admin', view: 'mine' }),
    makeWorkTasksProjectionKey({ roles: ['cleaner'], permissions: ['tasks.manage'], activeRole: 'cleaner', view: 'mine' }),
    makeWorkTasksProjectionKey({ roles: ['cleaner'], permissions: [], activeRole: 'cleaner', view: 'all' }),
    makeWorkTasksProjectionKey({ roles: ['cleaner'], permissions: [], activeRole: 'cleaner', view: 'mine', includeManagerUnassignedOffline: true }),
  ]
  expect(new Set([base, ...variants])).toHaveProperty('size', 5)
  expect(makeWorkTasksProjectionKey({
    roles: ['cleaner', 'admin', 'cleaner'],
    permissions: ['b', 'a', 'a'],
    activeRole: 'admin',
    view: 'all',
  })).toBe(makeWorkTasksProjectionKey({
    roles: ['admin', 'cleaner'],
    permissions: ['a', 'b'],
    activeRole: 'admin',
    view: 'all',
  }))
})

test('recomputes a cached visible projection when local or SSE visibility inputs change', () => {
  const maintenance = makeTask({
    id: 'property_maintenance:m-visibility',
    task_kind: 'maintenance',
    source_type: 'property_maintenance',
    source_id: 'm-visibility',
    execution_list_visible: true,
    assignee_id: 'staff-1',
    source_workflow_status: 'assigned',
    maintenance_workflow: { domain: 'internal', status: 'assigned', available_actions: ['executor_complete'] },
  } as any)
  expect(reconcileExecutionListVisibilityAfterPatch({
    ...maintenance,
    status: 'pending_review',
    maintenance_workflow: { domain: 'internal', status: 'pending_review', available_actions: [] },
  }, ['status', 'maintenance_workflow'])).toMatchObject({
    source_workflow_status: 'pending_review',
    execution_list_visible: false,
  })
  expect(reconcileExecutionListVisibilityAfterPatch({
    ...maintenance,
    status: 'pending_review',
  }, ['status'])).toMatchObject({
    source_workflow_status: 'pending_review',
    execution_list_visible: false,
  })
  expect(reconcileExecutionListVisibilityAfterPatch({
    ...maintenance,
    maintenance_workflow: { domain: 'internal', status: 'pending_review', available_actions: [] },
  }, ['maintenance_workflow'])).toMatchObject({
    source_workflow_status: 'pending_review',
    execution_list_visible: false,
  })

  const offline = makeTask({
    id: 'offline:visibility',
    task_kind: 'offline',
    source_type: 'cleaning_offline_tasks',
    execution_list_visible: true,
    assignee_id: 'staff-2',
  } as any)
  expect(reconcileExecutionListVisibilityAfterPatch(
    { ...offline, assignee_id: null },
    ['assignee_id'],
  ).execution_list_visible).toBe(false)
  expect(reconcileExecutionListVisibilityAfterPatch(
    { ...offline, assignee_id: null },
    ['assignee_id'],
    { includeManagerUnassignedOffline: true },
  ).execution_list_visible).toBe(true)
  expect(reconcileExecutionListVisibilityAfterPatch(
    { ...offline, scheduled_date: null },
    ['scheduled_date'],
  ).execution_list_visible).toBe(false)

  const statusPatch = {
    event_type: 'TASK_UPDATED',
    change_scope: 'list',
    changed_fields: ['status'],
    payload: { patch: { status: 'in_progress' } },
  }
  expect(mergePatchIntoTask(
    { ...offline, assignee_id: null },
    statusPatch,
    { includeManagerUnassignedOffline: true },
  ).execution_list_visible).toBe(true)
  expect(mergePatchIntoTask({ ...offline, assignee_id: null }, statusPatch).execution_list_visible).toBe(false)
})

test('keeps authoritative self-complete progress current across a safe realtime patch', () => {
  const task = makeTask({
    id: 'cleaning_tasks_manager_turnover:bo717',
    task_kind: 'inspection',
    task_type: 'turnover',
    status: 'to_inspect',
    inspection_mode: 'self_complete',
    active_source_ids: ['bo717-checkout', 'bo717-checkin'],
    self_complete_progress: {
      authoritative: true,
      source_task_id: 'bo717-checkout',
      source_task_ids: ['bo717-checkout', 'bo717-checkin'],
      status: 'to_hang_keys',
    },
  } as any)
  const event = {
    event_type: 'TASK_UPDATED',
    change_scope: 'list',
    changed_fields: ['self_complete_progress'],
    payload: {
      patch: {
        self_complete_progress: {
          authoritative: true,
          source_task_id: 'bo717-checkout',
          source_task_ids: ['bo717-checkout', 'bo717-checkin'],
          status: 'keys_hung',
        },
      },
    },
  } as any

  expect(isSafePatchEvent(event)).toBe(true)
  expect(mergePatchIntoTask(task, event).self_complete_progress).toEqual({
    authoritative: true,
    source_task_id: 'bo717-checkout',
    source_task_ids: ['bo717-checkout', 'bo717-checkin'],
    status: 'keys_hung',
  })
})

test('applies a manager save receipt without a list request and suppresses its duplicate SSE events', async () => {
  const api = require('./api')
  api.listWorkTasks.mockResolvedValueOnce([makeTask({
    id: 'cleaning_tasks_manager_turnover:receipt-1',
    source_ids: ['checkout-receipt-1', 'checkin-receipt-1'],
    active_source_ids: ['checkout-receipt-1', 'checkin-receipt-1'],
    turnover_display: {
      old_code_task_id: 'checkout-receipt-1',
      new_code_task_id: 'checkin-receipt-1',
      old_code: 'OLD-BEFORE',
      new_code: 'NEW-BEFORE',
    },
  } as any)])
  await activateWorkTasksRealtime({ token: 't1', userId: 'refresh-user', date_from: '2026-07-25', date_to: '2026-07-25', view: 'all' })
  await requestWorkTasksRefresh({ token: 't1', userId: 'refresh-user', date_from: '2026-07-25', date_to: '2026-07-25', view: 'all', mode: 'force', reason: 'seed' })
  api.listWorkTasks.mockClear()

  expect(beginManagerTaskSaveOperation('mobile-manager-save-receipt-1')).toBe(true)
  const passwordEvent = {
    event_id: 'evt-manager-receipt-1',
    task_id: 'cleaning_task:checkout-receipt-1',
    source_ref_ids: ['checkout-receipt-1'],
    event_type: 'TASK_UPDATED',
    change_scope: 'detail',
    changed_fields: ['old_code', 'password_authority'],
    payload: {
      patch: { password_authority: { old_code_status: 'source_linked' } },
      password_sync: { request_id: 'mobile-manager-save-receipt-1' },
    },
  }
  mockStreamListeners.work_task_event?.[0]?.({ type: 'work_task_event', data: JSON.stringify(passwordEvent), lastEventId: passwordEvent.event_id })
  await Promise.resolve()
  expect(api.listWorkTasks).not.toHaveBeenCalled()

  const result = await applyManagerTaskSaveReceipt({
    operation_id: 'mobile-manager-save-receipt-1',
    manager_fields_receipt_version: 1,
    projection_refresh_required: false,
    authoritative_updates: [{
      task_id: 'checkout-receipt-1',
      task_type: 'checkout_clean',
      old_code: 'OLD-AFTER',
      old_code_authority_status: 'source_linked',
      old_code_source_task_id: 'checkin-receipt-1',
      old_code_source_order_id: 'order-receipt-1',
      old_code_source_field: 'new_code',
      guest_special_request: 'receipt-current',
      sequence_no: 501,
    }],
  })
  expect(result).toMatchObject({ supported: true, appliedItems: 1, persisted: true, projectionRefreshRequired: false })
  expect(findWorkTaskItemByAnyId('checkout-receipt-1')).toMatchObject({
    old_code: 'OLD-AFTER',
    guest_special_request: 'receipt-current',
    turnover_display: { old_code: 'OLD-AFTER', old_code_authority_status: 'source_linked' },
  })
  expect(api.listWorkTasks).not.toHaveBeenCalled()

  mockStreamListeners.work_task_event?.[0]?.({ type: 'work_task_event', data: JSON.stringify({
    ...passwordEvent,
    event_id: 'evt-manager-receipt-1-late',
  }), lastEventId: 'evt-manager-receipt-1-late' })
  await Promise.resolve()
  expect(api.listWorkTasks).not.toHaveBeenCalled()

  const staleOtherOperationEvent = {
    ...passwordEvent,
    event_id: 'evt-manager-other-operation-stale',
    sequence_no: 500,
    changed_fields: ['status'],
    payload: {
      patch: { status: 'in_progress' },
      manager_fields: { operation_id: 'some-other-operation' },
    },
  }
  mockStreamListeners.work_task_event?.[0]?.({
    type: 'work_task_event',
    data: JSON.stringify(staleOtherOperationEvent),
    lastEventId: staleOtherOperationEvent.event_id,
  })
  await Promise.resolve()
  expect(findWorkTaskItemByAnyId('checkout-receipt-1')).toMatchObject({
    status: 'assigned',
    guest_special_request: 'receipt-current',
  })
  expect(Object.values(getWorkTasksSnapshot().dirtyBuckets).some((value) => (
    String(value).startsWith('manager_receipt_event_order_conflict:')
  ))).toBe(true)
})

test('coalesces a projection-required manager receipt and its same-sequence guest-ready SSE echo into one list request', async () => {
  jest.useFakeTimers()
  const api = require('./api')
  const task = makeTask({
    id: 'cleaning_tasks_manager_turnover:projection-coalesce',
    source_ids: ['checkout-projection-coalesce', 'checkin-projection-coalesce'],
    active_source_ids: ['checkout-projection-coalesce', 'checkin-projection-coalesce'],
    turnover_display: {
      old_code_task_id: 'checkout-projection-coalesce',
      new_code_task_id: 'checkin-projection-coalesce',
    },
  } as any)
  api.listWorkTasks.mockResolvedValueOnce([task])
  await activateWorkTasksRealtime({ token: 't1', userId: 'refresh-user', date_from: '2026-07-20', date_to: '2026-08-03', view: 'all' })
  await requestWorkTasksRefresh({ token: 't1', userId: 'refresh-user', date_from: '2026-07-20', date_to: '2026-08-03', view: 'all', mode: 'force', reason: 'seed' })
  await jest.advanceTimersByTimeAsync(60_001)
  api.listWorkTasks.mockClear()

  expect(beginManagerTaskSaveOperation('mobile-manager-save-projection-coalesce')).toBe(true)
  await expect(applyManagerTaskSaveReceipt({
    operation_id: 'mobile-manager-save-projection-coalesce',
    manager_fields_receipt_version: 1,
    projection_refresh_required: true,
    authoritative_updates: [{
      task_id: 'checkin-projection-coalesce',
      task_type: 'checkin_clean',
      checkin_time: '2:45pm',
      sequence_no: 901,
    }],
  })).resolves.toMatchObject({ supported: true, accepted: true, projectionRefreshRequired: true })

  let releaseProjectionRefresh!: (items: WorkTaskItem[]) => void
  api.listWorkTasks.mockImplementationOnce(() => new Promise<WorkTaskItem[]>((resolve) => {
    releaseProjectionRefresh = resolve
  }))
  await requestWorkTasksRefresh({
    token: 't1',
    userId: 'refresh-user',
    date_from: '2026-07-20',
    date_to: '2026-08-03',
    view: 'all',
    mode: 'consistency',
    reason: 'manager_task_projection_reconcile',
  })
  expect(api.listWorkTasks).toHaveBeenCalledTimes(1)

  mockStreamListeners.work_task_event?.[0]?.({
    type: 'work_task_event',
    data: JSON.stringify({
      event_id: 'evt-projection-coalesce-same-sequence',
      event_type: 'TASK_UPDATED',
      change_scope: 'list',
      task_id: 'cleaning_task:checkin-projection-coalesce',
      source_ref_ids: ['checkin-projection-coalesce'],
      sequence_no: 901,
      changed_fields: ['checkin_time', 'end_time', 'guest_ready_notification'],
      payload: { patch: { checkin_time: '2:45pm', end_time: '2:45pm' } },
    }),
  })
  await Promise.resolve()
  await Promise.resolve()
  expect(api.listWorkTasks).toHaveBeenCalledTimes(1)

  releaseProjectionRefresh([{ ...task, checkin_time: '2:45pm', end_time: '2:45pm' } as any])
  await Promise.resolve()
  await Promise.resolve()
  expect(api.listWorkTasks).toHaveBeenCalledTimes(1)
})

test('queues a second authoritative list request for a newer guest-ready sequence during manager projection reconciliation', async () => {
  jest.useFakeTimers()
  const api = require('./api')
  const task = makeTask({
    id: 'cleaning_tasks_manager_turnover:projection-newer',
    source_ids: ['checkout-projection-newer', 'checkin-projection-newer'],
    active_source_ids: ['checkout-projection-newer', 'checkin-projection-newer'],
    turnover_display: {
      old_code_task_id: 'checkout-projection-newer',
      new_code_task_id: 'checkin-projection-newer',
    },
  } as any)
  api.listWorkTasks.mockResolvedValueOnce([task])
  await activateWorkTasksRealtime({ token: 't1', userId: 'refresh-user', date_from: '2026-07-20', date_to: '2026-08-03', view: 'all' })
  await requestWorkTasksRefresh({ token: 't1', userId: 'refresh-user', date_from: '2026-07-20', date_to: '2026-08-03', view: 'all', mode: 'force', reason: 'seed' })
  await jest.advanceTimersByTimeAsync(60_001)
  api.listWorkTasks.mockClear()

  expect(beginManagerTaskSaveOperation('mobile-manager-save-projection-newer')).toBe(true)
  await applyManagerTaskSaveReceipt({
    operation_id: 'mobile-manager-save-projection-newer',
    manager_fields_receipt_version: 1,
    projection_refresh_required: true,
    authoritative_updates: [{
      task_id: 'checkin-projection-newer',
      task_type: 'checkin_clean',
      checkin_time: '2:45pm',
      sequence_no: 901,
    }],
  })

  let releaseProjectionRefresh!: (items: WorkTaskItem[]) => void
  let confirmNewerRefreshStarted!: () => void
  const newerRefreshStarted = new Promise<void>((resolve) => {
    confirmNewerRefreshStarted = resolve
  })
  api.listWorkTasks
    .mockImplementationOnce(() => new Promise<WorkTaskItem[]>((resolve) => {
      releaseProjectionRefresh = resolve
    }))
    .mockImplementationOnce(async () => {
      confirmNewerRefreshStarted()
      return [{ ...task, checkin_time: '3:00pm', end_time: '3:00pm' } as any]
    })
  await requestWorkTasksRefresh({
    token: 't1',
    userId: 'refresh-user',
    date_from: '2026-07-20',
    date_to: '2026-08-03',
    view: 'all',
    mode: 'consistency',
    reason: 'manager_task_projection_reconcile',
  })

  mockStreamListeners.work_task_event?.[0]?.({
    type: 'work_task_event',
    data: JSON.stringify({
      event_id: 'evt-projection-newer-sequence',
      event_type: 'TASK_UPDATED',
      change_scope: 'list',
      task_id: 'cleaning_task:checkin-projection-newer',
      source_ref_ids: ['checkin-projection-newer'],
      sequence_no: 902,
      changed_fields: ['checkin_time', 'end_time', 'guest_ready_notification'],
      payload: { patch: { checkin_time: '3:00pm', end_time: '3:00pm' } },
    }),
  })
  await Promise.resolve()
  expect(api.listWorkTasks).toHaveBeenCalledTimes(1)

  releaseProjectionRefresh([{ ...task, checkin_time: '2:45pm', end_time: '2:45pm' } as any])
  await newerRefreshStarted
  expect(api.listWorkTasks).toHaveBeenCalledTimes(2)
  for (let attempt = 0; attempt < 20 && (getWorkTasksSnapshot().items[0] as any)?.checkin_time !== '3:00pm'; attempt += 1) await Promise.resolve()
  expect(getWorkTasksSnapshot().items[0]).toMatchObject({ checkin_time: '3:00pm', end_time: '3:00pm' })
})

test('rejects late versioned and legacy manager responses after the session changes', async () => {
  const storage = require('./storage')
  expect(beginManagerTaskSaveOperation('old-session-save')).toBe(true)
  deactivateWorkTasksRealtime()
  establishWorkTasksSession({ token: 'new-token', userId: 'new-session-user', role: 'cleaner' })
  storage.setJson.mockClear()

  await expect(applyManagerTaskSaveReceipt({
    operation_id: 'old-session-save',
    manager_fields_receipt_version: 1,
    authoritative_updates: [{
      task_id: 'checkout-1',
      task_type: 'checkout_clean',
      old_code: 'MUST-NOT-CROSS-SESSIONS',
      sequence_no: 600,
    }],
  })).resolves.toMatchObject({ supported: true, accepted: false, appliedItems: 0, persisted: false, projectionRefreshRequired: true })
  await expect(applyManagerTaskSaveReceipt({ operation_id: 'old-session-save' })).resolves.toMatchObject({
    supported: false,
    accepted: false,
    appliedItems: 0,
    persisted: false,
    projectionRefreshRequired: true,
  })
  expect(storage.setJson).not.toHaveBeenCalled()
})

test.each([
  { manager_fields_receipt_version: 2, authoritative_updates: [] },
  { manager_fields_receipt_version: 1 },
])('falls back to authority refresh for an unknown or incomplete receipt: %j', async (receipt) => {
  const storage = require('./storage')
  const operationId = `unsupported-receipt-${receipt.manager_fields_receipt_version}`
  expect(beginManagerTaskSaveOperation(operationId)).toBe(true)
  await expect(applyManagerTaskSaveReceipt({ operation_id: operationId, ...receipt })).resolves.toMatchObject({
    supported: false,
    accepted: true,
    appliedItems: 0,
    persisted: false,
    projectionRefreshRequired: true,
  })
  expect(storage.setJson).not.toHaveBeenCalled()
})

test('fails closed when the session changes while an authoritative receipt is awaiting storage', async () => {
  const api = require('./api')
  const storage = require('./storage')
  const params = { token: 't1', userId: 'refresh-user', date_from: '2026-07-29', date_to: '2026-07-29', view: 'all' as const }
  api.listWorkTasks.mockResolvedValueOnce([makeTask({
    id: 'session-race-card',
    source_id: 'session-race-source',
    date: '2026-07-29',
    scheduled_date: '2026-07-29',
    old_code: 'OLD-SESSION-VALUE',
    turnover_display: { old_code_task_id: 'session-race-source', old_code: 'OLD-SESSION-VALUE' },
  } as any)])
  await activateWorkTasksRealtime(params)
  await requestWorkTasksRefresh({ ...params, mode: 'force', reason: 'session-race-seed' })

  let releaseMarker!: () => void
  storage.setJson.mockClear()
  storage.setJson.mockImplementation((key: string) => (
    String(key).includes('manager_fields_authority')
      ? new Promise<void>((resolve) => { releaseMarker = resolve })
      : Promise.resolve()
  ))
  expect(beginManagerTaskSaveOperation('session-race-save')).toBe(true)
  const applying = applyManagerTaskSaveReceipt({
    operation_id: 'session-race-save',
    manager_fields_receipt_version: 1,
    authoritative_updates: [{
      task_id: 'session-race-source',
      task_type: 'checkout_clean',
      old_code: 'MUST-NOT-APPLY-AFTER-SWITCH',
      sequence_no: 620,
    }],
  })
  expect(storage.setJson.mock.calls.filter((call: any[]) => String(call[0]).includes('manager_fields_authority'))).toHaveLength(1)
  deactivateWorkTasksRealtime()
  establishWorkTasksSession({ token: 'new-token', userId: 'new-session-user' })
  releaseMarker()

  await expect(applying).resolves.toMatchObject({ supported: true, accepted: false, appliedItems: 0, persisted: false })
  expect(findWorkTaskItemByAnyId('session-race-source')).toBeNull()
  expect(storage.setJson.mock.calls.filter((call: any[]) => String(call[0]).includes('manager_fields_authority'))).toHaveLength(1)
})

test('fails closed when the active date bucket changes while a receipt is awaiting storage', async () => {
  const api = require('./api')
  const storage = require('./storage')
  const first = { token: 't1', userId: 'refresh-user', date_from: '2026-07-30', date_to: '2026-07-30', view: 'all' as const }
  api.listWorkTasks.mockResolvedValueOnce([makeTask({
    id: 'bucket-race-card',
    source_id: 'bucket-race-source',
    date: '2026-07-30',
    scheduled_date: '2026-07-30',
    guest_special_request: 'first-bucket',
  } as any)])
  await activateWorkTasksRealtime(first)
  await requestWorkTasksRefresh({ ...first, mode: 'force', reason: 'bucket-race-first-seed' })

  let releaseMarker!: () => void
  storage.setJson.mockClear()
  storage.setJson.mockImplementation((key: string) => (
    String(key).includes('manager_fields_authority')
      ? new Promise<void>((resolve) => { releaseMarker = resolve })
      : Promise.resolve()
  ))
  expect(beginManagerTaskSaveOperation('bucket-race-save')).toBe(true)
  const applying = applyManagerTaskSaveReceipt({
    operation_id: 'bucket-race-save',
    manager_fields_receipt_version: 1,
    authoritative_updates: [{
      task_id: 'bucket-race-source',
      task_type: 'checkout_clean',
      guest_special_request: 'must-not-cross-buckets',
      sequence_no: 630,
    }],
  })

  const second = { ...first, date_from: '2026-07-31', date_to: '2026-07-31' }
  api.listWorkTasks.mockResolvedValueOnce([makeTask({
    id: 'second-bucket-card',
    source_id: 'second-bucket-source',
    date: '2026-07-31',
    scheduled_date: '2026-07-31',
    guest_special_request: 'second-bucket-safe',
  } as any)])
  await activateWorkTasksRealtime(second)
  await requestWorkTasksRefresh({ ...second, mode: 'force', reason: 'bucket-race-second-seed' })
  releaseMarker()

  await expect(applying).resolves.toMatchObject({ supported: true, accepted: false, appliedItems: 0, persisted: false })
  expect(getWorkTasksSnapshot().bucketKey).toBe(makeWorkTasksBucketKey(second))
  expect(findWorkTaskItemByAnyId('second-bucket-source')).toMatchObject({ guest_special_request: 'second-bucket-safe' })
  expect(findWorkTaskItemByAnyId('bucket-race-source')).toBeNull()
})

test('composes concurrent authoritative receipts after their marker writes settle', async () => {
  const api = require('./api')
  const storage = require('./storage')
  const params = { token: 't1', userId: 'refresh-user', date_from: '2026-08-01', date_to: '2026-08-01', view: 'all' as const }
  api.listWorkTasks.mockResolvedValueOnce([makeTask({
    id: 'concurrent-receipt-card',
    source_id: 'concurrent-checkout',
    source_ids: ['concurrent-checkout', 'concurrent-checkin'],
    active_source_ids: ['concurrent-checkout', 'concurrent-checkin'],
    date: '2026-08-01',
    scheduled_date: '2026-08-01',
    turnover_display: {
      old_code_task_id: 'concurrent-checkout',
      new_code_task_id: 'concurrent-checkin',
      old_code: 'OLD-BEFORE',
      new_code: 'NEW-BEFORE',
    },
  } as any)])
  await activateWorkTasksRealtime(params)
  await requestWorkTasksRefresh({ ...params, mode: 'force', reason: 'concurrent-receipt-seed' })

  const markerResolvers: Array<() => void> = []
  storage.setJson.mockImplementation((key: string) => {
    if (String(key).includes('manager_fields_authority')) {
      return new Promise<void>((resolve) => markerResolvers.push(resolve))
    }
    return Promise.resolve()
  })
  expect(beginManagerTaskSaveOperation('concurrent-save-a')).toBe(true)
  expect(beginManagerTaskSaveOperation('concurrent-save-b')).toBe(true)
  const applyingA = applyManagerTaskSaveReceipt({
    operation_id: 'concurrent-save-a',
    manager_fields_receipt_version: 1,
    authoritative_updates: [{
      task_id: 'concurrent-checkout',
      task_type: 'checkout_clean',
      old_code: 'OLD-AFTER-A',
      sequence_no: 640,
    }],
  })
  const applyingB = applyManagerTaskSaveReceipt({
    operation_id: 'concurrent-save-b',
    manager_fields_receipt_version: 1,
    authoritative_updates: [{
      task_id: 'concurrent-checkin',
      task_type: 'checkin_clean',
      new_code: 'NEW-AFTER-B',
      sequence_no: 641,
    }],
  })
  expect(markerResolvers).toHaveLength(2)
  markerResolvers[0]()
  await expect(applyingA).resolves.toMatchObject({ accepted: true, appliedItems: 1, persisted: true })
  markerResolvers[1]()
  await expect(applyingB).resolves.toMatchObject({ accepted: true, appliedItems: 1, persisted: true })

  expect(findWorkTaskItemByAnyId('concurrent-receipt-card')).toMatchObject({
    old_code: 'OLD-AFTER-A',
    new_code: 'NEW-AFTER-B',
    turnover_display: { old_code: 'OLD-AFTER-A', new_code: 'NEW-AFTER-B' },
  })
})

test('marks a supported receipt with no active-card match for background coordination', async () => {
  expect(beginManagerTaskSaveOperation('receipt-no-active-match')).toBe(true)
  await expect(applyManagerTaskSaveReceipt({
    operation_id: 'receipt-no-active-match',
    manager_fields_receipt_version: 1,
    authoritative_updates: [{
      task_id: 'related-task-in-another-bucket',
      task_type: 'checkout_clean',
      old_code: 'SYNTHETIC-OTHER-BUCKET',
      sequence_no: 610,
    }],
  })).resolves.toMatchObject({
    supported: true,
    accepted: true,
    appliedItems: 0,
    persisted: true,
    projectionRefreshRequired: true,
  })
})

test('schedules bounded recovery when both the manager response and its SSE are lost', async () => {
  const api = require('./api')
  await activateWorkTasksRealtime({ token: 't1', userId: 'refresh-user', date_from: '2026-07-25', date_to: '2026-07-25', view: 'all' })
  api.listWorkTasks.mockClear()
  jest.useFakeTimers()
  expect(beginManagerTaskSaveOperation('response-and-event-lost')).toBe(true)
  failManagerTaskSaveOperation('response-and-event-lost')
  await jest.advanceTimersByTimeAsync(30_000)
  expect(api.listWorkTasks).toHaveBeenCalledTimes(1)
})

test('merges only a post-request local patch over a stale list response', () => {
  const remote = makeTask({
    id: 'task-merge-local-patch',
    guest_special_request: 'remote-old',
    status: 'in_progress',
    unrelated_remote_field: 'new-from-server',
    turnover_display: { old_code: 'REMOTE', unrelated_projection_field: 'server-new' },
  } as any)
  const previous = makeTask({
    id: 'task-merge-local-patch',
    guest_special_request: 'local-new',
    status: 'assigned',
    unrelated_remote_field: 'stale-local',
    turnover_display: { old_code: 'LOCAL', unrelated_projection_field: 'stale-local' },
  } as any)
  const merged = mergeRemoteWorkTaskItems([remote], [previous], {
    retainLocalTaskIds: ['task-merge-local-patch'],
    localPatches: new Map([['task-merge-local-patch', {
      guest_special_request: 'local-new',
      turnover_display: { old_code: 'LOCAL' },
    } as any]]),
  })[0] as any
  expect(merged).toMatchObject({
    guest_special_request: 'local-new',
    status: 'in_progress',
    unrelated_remote_field: 'new-from-server',
    turnover_display: { old_code: 'LOCAL', unrelated_projection_field: 'server-new' },
  })
})

test('does not relabel a pre-request field as post-request when another local field changes during refresh', async () => {
  const api = require('./api')
  const params = { token: 't1', userId: 'refresh-user', date_from: '2026-07-27', date_to: '2026-07-27', view: 'all' as const }
  api.listWorkTasks.mockResolvedValueOnce([makeTask({
    id: 'revision-boundary-card',
    source_id: 'revision-boundary-source',
    date: '2026-07-27',
    scheduled_date: '2026-07-27',
    guest_special_request: 'seed',
    checkout_time: '10am',
  } as any)])
  await activateWorkTasksRealtime(params)
  await requestWorkTasksRefresh({ ...params, mode: 'force', reason: 'revision-boundary-seed' })
  await patchWorkTaskItem('revision-boundary-card', { guest_special_request: 'local-before-request' } as any)
  expect(__workTasksLocalPatchEntryCountForTests()).toBe(0)

  let resolveList!: (items: WorkTaskItem[]) => void
  api.listWorkTasks.mockImplementationOnce(() => new Promise((resolve) => { resolveList = resolve }))
  const refresh = requestWorkTasksRefresh({ ...params, mode: 'force', reason: 'revision-boundary-refresh' })
  await Promise.resolve()
  await patchWorkTaskItem('revision-boundary-card', { checkout_time: '11am' } as any)
  expect(__workTasksLocalPatchEntryCountForTests()).toBe(1)
  resolveList([makeTask({
    id: 'revision-boundary-card',
    source_id: 'revision-boundary-source',
    date: '2026-07-27',
    scheduled_date: '2026-07-27',
    guest_special_request: 'remote-after-request-started',
    checkout_time: '10am',
    unrelated_remote_field: 'keep-remote',
  } as any)])
  await refresh
  expect(__workTasksLocalPatchEntryCountForTests()).toBe(0)

  expect(findWorkTaskItemByAnyId('revision-boundary-card')).toMatchObject({
    guest_special_request: 'remote-after-request-started',
    checkout_time: '11am',
    unrelated_remote_field: 'keep-remote',
  })
})

test('keeps the new-session patch capture owner when an old same-bucket request settles', async () => {
  const api = require('./api')
  const userId = 'same-user-token-rotation'
  const oldParams = { token: 'old-token', userId, date_from: '2026-07-27', date_to: '2026-07-27', view: 'all' as const }
  const currentTask = makeTask({
    id: 'token-rotation-card',
    source_id: 'token-rotation-source',
    date: '2026-07-27',
    scheduled_date: '2026-07-27',
    old_code: 'OLD-BEFORE',
    turnover_display: { old_code_task_id: 'token-rotation-source', old_code: 'OLD-BEFORE' },
  } as any)
  establishWorkTasksSession({ token: oldParams.token, userId })
  api.listWorkTasks.mockResolvedValueOnce([currentTask])
  await requestWorkTasksRefresh({ ...oldParams, mode: 'force', reason: 'token-rotation-seed' })

  let resolveOldList!: (items: WorkTaskItem[]) => void
  api.listWorkTasks.mockImplementationOnce(() => new Promise((resolve) => { resolveOldList = resolve }))
  const oldRefresh = requestWorkTasksRefresh({ ...oldParams, mode: 'force', reason: 'old-token-in-flight' })
  await Promise.resolve()

  const newParams = { ...oldParams, token: 'new-token' }
  establishWorkTasksSession({ token: newParams.token, userId })
  let resolveNewList!: (items: WorkTaskItem[]) => void
  api.listWorkTasks.mockImplementationOnce(() => new Promise((resolve) => { resolveNewList = resolve }))
  const newRefresh = requestWorkTasksRefresh({ ...newParams, mode: 'force', reason: 'new-token-in-flight' })
  await Promise.resolve()

  resolveOldList([currentTask])
  await expect(oldRefresh).resolves.toBe(false)

  expect(beginManagerTaskSaveOperation('token-rotation-save')).toBe(true)
  await expect(applyManagerTaskSaveReceipt({
    operation_id: 'token-rotation-save',
    manager_fields_receipt_version: 1,
    authoritative_updates: [{
      task_id: 'token-rotation-source',
      task_type: 'checkout_clean',
      old_code: 'OLD-AFTER-RECEIPT',
      sequence_no: 710,
    }],
  })).resolves.toMatchObject({ supported: true, accepted: true, appliedItems: 1, persisted: true })

  resolveNewList([currentTask])
  await expect(newRefresh).resolves.toBe(true)
  expect(findWorkTaskItemByAnyId('token-rotation-card')).toMatchObject({
    old_code: 'OLD-AFTER-RECEIPT',
    turnover_display: { old_code: 'OLD-AFTER-RECEIPT' },
  })
  expect(__workTasksLocalPatchEntryCountForTests()).toBe(0)

  expect(beginManagerTaskSaveOperation('token-rotation-save-after-refresh')).toBe(true)
  await expect(applyManagerTaskSaveReceipt({
    operation_id: 'token-rotation-save-after-refresh',
    manager_fields_receipt_version: 1,
    authoritative_updates: [{
      task_id: 'token-rotation-source',
      task_type: 'checkout_clean',
      old_code: 'OLD-AFTER-ALL-REFRESHES',
      sequence_no: 711,
    }],
  })).resolves.toMatchObject({ supported: true, accepted: true, appliedItems: 1, persisted: true })
  expect(__workTasksLocalPatchEntryCountForTests()).toBe(0)
})

test('carries an in-flight local patch across a canonical card id change through shared source identity', async () => {
  const api = require('./api')
  const params = { token: 't1', userId: 'refresh-user', date_from: '2026-07-28', date_to: '2026-07-28', view: 'all' as const }
  api.listWorkTasks.mockResolvedValueOnce([makeTask({
    id: 'old-canonical-card',
    source_id: 'canonical-source',
    source_ids: ['canonical-source', 'canonical-related'],
    date: '2026-07-28',
    scheduled_date: '2026-07-28',
    guest_special_request: 'seed',
  } as any)])
  await activateWorkTasksRealtime(params)
  await requestWorkTasksRefresh({ ...params, mode: 'force', reason: 'canonical-change-seed' })

  let resolveList!: (items: WorkTaskItem[]) => void
  api.listWorkTasks.mockImplementationOnce(() => new Promise((resolve) => { resolveList = resolve }))
  const refresh = requestWorkTasksRefresh({ ...params, mode: 'force', reason: 'canonical-change-refresh' })
  await Promise.resolve()
  await patchWorkTaskItem('old-canonical-card', { guest_special_request: 'local-during-refresh' } as any)
  resolveList([makeTask({
    id: 'new-canonical-card',
    source_id: 'canonical-source',
    source_ids: ['canonical-source', 'canonical-related'],
    date: '2026-07-28',
    scheduled_date: '2026-07-28',
    guest_special_request: 'remote-stale',
    unrelated_remote_field: 'new-server-field',
  } as any)])
  await refresh

  expect(findWorkTaskItemByAnyId('new-canonical-card')).toMatchObject({
    id: 'new-canonical-card',
    guest_special_request: 'local-during-refresh',
    unrelated_remote_field: 'new-server-field',
  })
})

test('merges patches from two old source cards when a stale response combines them into one canonical card', () => {
  const previous = [
    makeTask({ id: 'old-checkout-card', source_id: 'source-checkout', source_ids: ['source-checkout'] } as any),
    makeTask({ id: 'old-checkin-card', source_id: 'source-checkin', source_ids: ['source-checkin'] } as any),
  ]
  const remote = [makeTask({
    id: 'new-turnover-card',
    source_id: 'source-checkout',
    source_ids: ['source-checkout', 'source-checkin'],
    guest_special_request: 'remote-stale',
    checkout_time: '10am',
    unrelated_remote_field: 'keep-server',
  } as any)]
  const merged = mergeRemoteWorkTaskItems(remote, previous, {
    localPatches: new Map([
      ['old-checkout-card', { revision: 20, patch: { checkout_time: '11am' } }],
      ['old-checkin-card', { revision: 21, patch: { guest_special_request: 'local-both-sources' } }],
    ]),
  })

  expect(merged[0]).toMatchObject({
    id: 'new-turnover-card',
    checkout_time: '11am',
    guest_special_request: 'local-both-sources',
    unrelated_remote_field: 'keep-server',
  })
})

test('invalidates an older cached date bucket after a manager authority receipt', async () => {
  const storage = require('./storage')
  storage.getJson.mockImplementation(async (key: string) => {
    if (String(key).includes('manager_fields_authority')) return { updatedAt: '2026-11-06T10:00:01.000Z' }
    return {
      items: [makeTask({ id: 'stale-other-date' })],
      bucketKey: makeWorkTasksBucketKey({ userId: 'refresh-user', date_from: '2026-07-26', date_to: '2026-07-26', view: 'all' }),
      projectionKey: 'unscoped-v1:all',
      ready: true,
      updatedAt: '2026-11-06T10:00:00.000Z',
      lastReceivedEventId: null,
      lastFullSyncTimestamp: '2026-11-06T10:00:00.000Z',
      dirtyBuckets: {},
      sseConnectionState: 'idle',
    }
  })
  const bucketKey = makeWorkTasksBucketKey({ userId: 'refresh-user', date_from: '2026-07-26', date_to: '2026-07-26', view: 'all' })
  await initWorkTasksStore({ bucketKey, projectionKey: 'unscoped-v1:all', session: { token: 't1', userId: 'refresh-user' } })
  expect(getWorkTasksSnapshot().items).toEqual([])
})

test('keeps a local checkout marker when the refreshed cleaning payload omits the field', () => {
  const previous = [makeTask({ id: 'old-merged-card', source_ids: ['checkout-1', 'checkin-1'], checked_out_at: '2026-07-25T01:00:00.000Z' } as any)]
  const remote = [makeTask({ id: 'new-merged-card', source_ids: ['checkout-1', 'checkin-1'] } as any)]

  expect(mergeRemoteWorkTaskItems(remote, previous)[0]?.checked_out_at).toBe('2026-07-25T01:00:00.000Z')
})

test('accepts an explicit server null and never copies a marker to an unrelated task', () => {
  const previous = [makeTask({ checked_out_at: '2026-07-25T01:00:00.000Z' } as any)]
  const explicitClear = [makeTask({ checked_out_at: null } as any)]
  const unrelated = [makeTask({ id: 'other-task', source_id: 'other-source' } as any)]

  expect(mergeRemoteWorkTaskItems(explicitClear, previous)[0]?.checked_out_at).toBeNull()
  expect(Object.prototype.hasOwnProperty.call(mergeRemoteWorkTaskItems(unrelated, previous)[0], 'checked_out_at')).toBe(false)
})

test('preserves an active task and its read-only transition record as separate server rows', () => {
  const active = makeTask({
    id: 'work-task-1',
    source_type: 'work_tasks',
    source_id: 'source-1',
    scheduled_date: '2026-10-22',
    date: '2026-10-22',
    status: 'assigned',
  } as any)
  const record = makeTask({
    id: 'work-task-1::rescheduled::event-1',
    source_type: 'work_tasks',
    source_id: 'source-1',
    scheduled_date: '2026-10-19',
    date: '2026-10-19',
    status: 'rescheduled',
    work_record_state: 'rescheduled',
    work_record_visible: true,
    work_record_read_only: true,
    counts_as_active_task: false,
  } as any)

  const merged = mergeRemoteWorkTaskItems([active, record], [])
  expect(merged).toHaveLength(2)
  expect(merged[0]).toMatchObject({ id: 'work-task-1', date: '2026-10-22' })
  expect(merged[0]?.work_record_read_only).toBeUndefined()
  expect(merged[1]).toMatchObject({
    id: 'work-task-1::rescheduled::event-1',
    date: '2026-10-19',
    work_record_state: 'rescheduled',
    work_record_read_only: true,
    available_actions: [],
    old_code: null,
    new_code: null,
  })
})

test('scrubs live credentials, guest state and actions when an SSE patch turns an active card into a work record', () => {
  const active = makeTask({
    old_code: '1111',
    new_code: '2222',
    guest_special_request: '提前入住',
    guest_request_checkout: '延迟退房',
    guest_request_checkin: '提前入住',
    guest_request_summary: '住客要求',
    guest_luggage: { status: 'pending' },
    guest_ready_notification: { status: 'not_notified' },
    guest_ready_outside_key: { required: true },
    participants: [{ user_id: 'staff-1', role: 'cleaner' }],
    capabilities: { base_permissions: { finish: true } },
    available_actions: [{ id: 'complete', label: '完成', enabled: true }],
    maintenance_workflow: { status: 'assigned', available_actions: ['executor_complete'] },
    turnover_display: {
      checkin_time: '3pm',
      old_code: '1111',
      new_code: '2222',
      guest_request_summary: '住客要求',
      conflicts: [
        { field: 'old_code', canonical_value: '1111', manual_value: '9999' },
        { field: 'checkout_time', canonical_value: '10am', manual_value: '11am' },
      ],
    },
    display_conflicts: [
      { field: 'new_code', canonical_value: '2222', manual_value: '3333' },
      { field: 'checkout_time', canonical_value: '10am', manual_value: '11am' },
    ],
    property: {
      id: 'property-1',
      code: 'A1',
      address: '1 Example St',
      unit_type: 'unit',
      access_guide_link: 'https://secret.example/access',
      wifi_ssid: 'private-network',
      wifi_password: 'private-password',
      router_location: 'inside cupboard',
    },
  } as any)
  const event = {
    event_type: 'TASK_COMPLETED',
    change_scope: 'list',
    changed_fields: [
      'status',
      'work_record_visible',
      'work_record_state',
      'work_record_date',
      'work_record_read_only',
      'counts_as_active_task',
    ],
    payload: {
      patch: {
        status: 'done',
        work_record_visible: true,
        work_record_state: 'completed',
        work_record_date: '2026-07-25',
        work_record_read_only: true,
        counts_as_active_task: false,
      },
    },
  } as any

  expect(isSafePatchEvent(event)).toBe(true)
  expect(mergePatchIntoTask(active, event)).toMatchObject({
    old_code: null,
    new_code: null,
    guest_special_request: null,
    guest_request_checkout: null,
    guest_request_checkin: null,
    guest_request_summary: null,
    guest_luggage: null,
    guest_ready_notification: null,
    guest_ready_outside_key: null,
    participants: null,
    capabilities: null,
    available_actions: [],
    maintenance_workflow: { status: 'assigned', available_actions: [] },
    turnover_display: {
      checkin_time: '3pm',
      old_code: null,
      new_code: null,
      guest_request_summary: null,
      conflicts: [{ field: 'checkout_time', canonical_value: '10am', manual_value: '11am' }],
    },
    display_conflicts: [{ field: 'checkout_time', canonical_value: '10am', manual_value: '11am' }],
    property: {
      access_guide_link: null,
      wifi_ssid: null,
      wifi_password: null,
      router_location: null,
    },
  })
})

test('keeps synthetic lock codes only for an authorized immutable cleaning record capability', () => {
  const completed = makeTask({
    work_record_read_only: true,
    work_record_visible: true,
    work_record_state: 'completed',
    status: 'done',
    old_code: '1357',
    new_code: '2468',
    read_only_views: {
      property_access: true,
      guest_context: true,
      lock_codes: true,
      cleaner_photos: true,
      inspection_photos: false,
      guest_key_photo: true,
      media_scope: 'cleaner',
    },
    turnover_display: {
      old_code: '1357',
      new_code: '2468',
      guest_request_summary: 'late arrival',
    },
    guest_special_request: 'leave luggage first',
    order_note: 'call before entry',
    guest_luggage: { id: 'luggage-1', note: 'two bags' },
    order_id_checkin: 'order-1',
    guest_ready_notification: { status: 'notified', order_id: 'order-1', version: 1 },
    available_actions: [
      { id: 'complete', label: '完成', enabled: true },
      { id: 'report_issue', label: '问题反馈与报修记录', enabled: true, source_type: 'cleaning_tasks', source_id: 'cleaning-1' },
      { id: 'revoke_guest_ready_notified', label: '撤销已通知客人', placement: 'primary', enabled: true, source_type: 'orders', source_id: 'order-1' },
      { id: 'record_guest_ready_notified', label: '错误订单', placement: 'primary', enabled: true, source_type: 'orders', source_id: 'order-2' },
      { id: 'report_issue', label: '错误来源', enabled: true, source_type: 'work_tasks', source_id: 'work-1' },
    ],
    property: {
      id: 'property-1',
      code: 'A1',
      access_guide_link: 'https://example.test/guide',
      wifi_ssid: 'Guest Network',
      wifi_password: 'synthetic-password',
      router_location: 'hall cupboard',
    },
  } as any)

  expect(redactReadOnlyWorkRecord(completed)).toMatchObject({
    old_code: '1357',
    new_code: '2468',
    guest_special_request: 'leave luggage first',
    order_note: 'call before entry',
    guest_luggage: { id: 'luggage-1', note: 'two bags' },
    guest_ready_notification: { status: 'notified', order_id: 'order-1', version: 1 },
    property: {
      access_guide_link: 'https://example.test/guide',
      wifi_ssid: 'Guest Network',
      wifi_password: 'synthetic-password',
      router_location: 'hall cupboard',
    },
    available_actions: [
      { id: 'report_issue', label: '问题反馈与报修记录', enabled: true, source_type: 'cleaning_tasks', source_id: 'cleaning-1' },
      { id: 'revoke_guest_ready_notified', label: '撤销已通知客人', placement: 'primary', enabled: true, source_type: 'orders', source_id: 'order-1' },
    ],
    turnover_display: {
      old_code: '1357',
      new_code: '2468',
      guest_request_summary: 'late arrival',
    },
  })
  expect(canViewReadOnlyWorkRecordLockCodes(completed)).toBe(true)
  expect(redactReadOnlyWorkRecord({ ...completed, work_record_state: 'reassigned', status: 'assigned' } as any)).toMatchObject({
    old_code: '1357',
    new_code: '2468',
    available_actions: [
      { id: 'report_issue', source_type: 'cleaning_tasks', source_id: 'cleaning-1' },
    ],
  })
  expect(redactReadOnlyWorkRecord({ ...completed, work_record_state: 'pending_review', status: 'pending_review' } as any).available_actions).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'revoke_guest_ready_notified', source_type: 'orders', source_id: 'order-1' }),
  ]))

  for (const denied of [
    { read_only_views: { ...completed.read_only_views, lock_codes: false, property_access: false, guest_context: false } },
    { work_record_state: 'cancelled', status: 'cancelled' },
    { work_record_state: 'rescheduled', status: 'assigned' },
    { execution_state: 'deleted' },
    { execution_state: 'superseded' },
  ]) {
    expect(redactReadOnlyWorkRecord({ ...completed, ...denied } as any)).toMatchObject({
      old_code: null,
      new_code: null,
      guest_special_request: null,
      order_note: null,
      property: { wifi_ssid: null, wifi_password: null },
      available_actions: [
        { id: 'report_issue', source_type: 'cleaning_tasks', source_id: 'cleaning-1' },
      ],
      turnover_display: { old_code: null, new_code: null },
    })
    expect(canViewReadOnlyWorkRecordLockCodes({ ...completed, ...denied } as any)).toBe(false)
  }
})

test('retains only the exact task-bound notification action for an unlinked completed check-in record', () => {
  const manualCheckin = makeTask({
    id: 'cleaning_tasks_customer_service:manual-checkin-1::record:completed:2026-11-01',
    source_type: 'cleaning_tasks',
    source_id: 'manual-checkin-1',
    source_ids: ['manual-checkin-1'],
    order_id_checkin: null,
    work_record_read_only: true,
    work_record_visible: true,
    work_record_state: 'completed',
    status: 'done',
    read_only_views: {
      property_access: true,
      guest_context: true,
      lock_codes: false,
      cleaner_photos: false,
      inspection_photos: false,
      guest_key_photo: true,
      media_scope: 'customer_service',
    },
    guest_ready_notification: {
      source_type: 'cleaning_tasks',
      source_id: 'manual-checkin-1',
      order_id: null,
      task_id: 'manual-checkin-1',
      association_state: 'manual_unlinked',
      status: 'not_notified',
      version: 0,
    },
    available_actions: [
      { id: 'record_guest_ready_notified', label: '已通知客人', enabled: true, source_type: 'cleaning_tasks', source_id: 'manual-checkin-1' },
      { id: 'record_guest_ready_notified', label: '错误任务', enabled: true, source_type: 'cleaning_tasks', source_id: 'manual-checkin-2' },
      { id: 'record_guest_ready_notified', label: '错误订单', enabled: true, source_type: 'orders', source_id: 'order-1' },
    ],
  } as any)

  expect(redactReadOnlyWorkRecord(manualCheckin).available_actions).toEqual([
    expect.objectContaining({
      id: 'record_guest_ready_notified',
      source_type: 'cleaning_tasks',
      source_id: 'manual-checkin-1',
    }),
  ])
  expect(redactReadOnlyWorkRecord({
    ...manualCheckin,
    guest_ready_notification: { ...manualCheckin.guest_ready_notification, task_id: 'manual-checkin-2' },
  } as any).available_actions).toEqual([])
  expect(redactReadOnlyWorkRecord({
    ...manualCheckin,
    order_id_checkin: 'order-1',
  } as any).available_actions).toEqual([])
  expect(redactReadOnlyWorkRecord({
    ...manualCheckin,
    read_only_views: { ...manualCheckin.read_only_views, guest_context: false },
  } as any).available_actions).toEqual([])
})

test('revokes cached read-only capabilities before a membership refresh that fails', async () => {
  const api = require('./api')
  const params = refreshParams({ date_from: '2026-10-19', date_to: '2026-10-19', view: 'all' })
  const record = makeTask({
    id: 'cleaning_tasks_cleaner:checkout-sensitive::record:completed:2026-10-19',
    source_id: 'checkout-sensitive',
    source_ids: ['checkout-sensitive'],
    all_related_source_ids: ['checkout-sensitive'],
    work_record_read_only: true,
    work_record_visible: true,
    work_record_state: 'completed',
    status: 'done',
    old_code: '1357',
    new_code: '2468',
    guest_special_request: 'late arrival',
    order_note: 'call before entry',
    guest_luggage: { id: 'luggage-1', note: 'two bags' },
    property: {
      id: 'property-1',
      code: 'A1',
      wifi_ssid: 'Guest Network',
      wifi_password: 'synthetic-password',
      access_guide_link: 'https://example.test/guide',
    },
    read_only_views: {
      property_access: true,
      guest_context: true,
      lock_codes: true,
      cleaner_photos: true,
      inspection_photos: false,
      guest_key_photo: true,
      media_scope: 'cleaner',
    },
    turnover_display: { old_code: '1357', new_code: '2468' },
  } as any)
  api.listWorkTasks.mockResolvedValueOnce([record])
  await requestWorkTasksRefresh({ ...params, mode: 'force', reason: 'seed_sensitive_record' })
  await activateWorkTasksRealtime(params)
  api.listWorkTasks.mockReset()
  api.listWorkTasks.mockRejectedValue(new Error('offline during revocation refresh'))

  mockStreamListeners.work_task_event?.[0]({
    type: 'work_task_event',
    data: JSON.stringify({
      event_id: 'evt-sensitive-source-removed',
      event_type: 'TASK_REMOVED',
      change_scope: 'membership',
      task_id: 'cleaning_task:checkout-sensitive',
      source_ref_ids: ['checkout-sensitive'],
      changed_fields: ['execution_state'],
      payload: { patch: { execution_state: 'superseded' } },
    }),
  })
  await Promise.resolve()
  await Promise.resolve()

  const cached = findWorkTaskItemByAnyId('checkout-sensitive') as any
  expect(api.listWorkTasks).toHaveBeenCalledTimes(1)
  expect(cached).toMatchObject({
    old_code: null,
    new_code: null,
    guest_special_request: null,
    order_note: null,
    guest_luggage: null,
    property: { wifi_ssid: null, wifi_password: null, access_guide_link: null },
    read_only_views: { lock_codes: false, property_access: false, guest_context: false },
    turnover_display: { old_code: null, new_code: null },
  })
  expect(canViewReadOnlyWorkRecordLockCodes(cached)).toBe(false)
})

test('keeps authorized read-only property and guest context through cache hydration, refresh and safe patches', async () => {
  const storage = require('./storage')
  const api = require('./api')
  const params = refreshParams({ date_from: '2026-10-21', date_to: '2026-10-21' })
  const bucketKey = makeWorkTasksBucketKey(params)
  const projectionKey = 'unscoped-v1:mine'
  const record = makeTask({
    id: 'cleaning_tasks_cleaner:cache-record::record:completed:2026-10-21',
    source_id: 'cache-record',
    source_ids: ['cache-record'],
    work_record_read_only: true,
    work_record_visible: true,
    work_record_state: 'completed',
    status: 'done',
    guest_special_request: 'late arrival',
    order_note: 'call before entry',
    property: {
      id: 'property-1',
      code: 'A1',
      wifi_ssid: 'Guest Network',
      wifi_password: 'synthetic-password',
      access_guide_link: 'https://example.test/guide',
    },
    read_only_views: {
      property_access: true,
      guest_context: true,
      lock_codes: false,
      cleaner_photos: true,
      inspection_photos: false,
      guest_key_photo: true,
      media_scope: 'cleaner',
      media_source_ids: ['cache-record'],
    },
  } as any)
  storage.getJson.mockResolvedValueOnce({
    items: [record],
    projectionKey,
    ready: true,
  })
  establishWorkTasksSession({ token: params.token, userId: params.userId })
  await initWorkTasksStore({ bucketKey, projectionKey, session: params })
  expect(getWorkTasksSnapshot().items[0]).toMatchObject({
    guest_special_request: 'late arrival',
    order_note: 'call before entry',
    property: { wifi_ssid: 'Guest Network', access_guide_link: 'https://example.test/guide' },
  })

  api.listWorkTasks.mockResolvedValueOnce([record])
  await requestWorkTasksRefresh({ ...params, projectionKey, mode: 'force', reason: 'readonly_context_refresh' })
  expect(getWorkTasksSnapshot().items[0]).toMatchObject({
    guest_special_request: 'late arrival',
    order_note: 'call before entry',
    property: { wifi_ssid: 'Guest Network', access_guide_link: 'https://example.test/guide' },
  })

  const patched = mergePatchIntoTask(getWorkTasksSnapshot().items[0], {
    event_type: 'TASK_UPDATED',
    change_scope: 'list',
    changed_fields: ['status'],
    payload: { patch: { status: 'done' } },
  } as any)
  expect(patched).toMatchObject({
    guest_special_request: 'late arrival',
    order_note: 'call before entry',
    property: { wifi_ssid: 'Guest Network', access_guide_link: 'https://example.test/guide' },
  })
})

test('does not retain current-assignee media when a cached card becomes a reassigned record', () => {
  const record = reconcileExecutionListVisibilityAfterPatch(makeTask({
    work_record_read_only: true,
    work_record_visible: true,
    work_record_state: 'reassigned',
    photo_urls: ['current/photo.jpg'],
    completion_photo_urls: ['current/completion.jpg'],
    key_photo_url: 'current/key.jpg',
    lockbox_video_url: 'current/lockbox.mp4',
    living_room_photo_urls: ['current/living.jpg'],
    living_room_photo_url: 'current/living-single.jpg',
    restock_items: [{ item_id: 'stock-1', label: '纸巾', qty: 1, note: null, photo_url: 'current/stock.jpg', status: 'low' }],
  } as any), [])

  expect(record).toMatchObject({
    photo_urls: [],
    completion_photo_urls: [],
    key_photo_url: null,
    lockbox_video_url: null,
    living_room_photo_urls: [],
    living_room_photo_url: null,
    restock_items: [],
  })
})

test('retains only server-attributed immutable event media on a reassigned record', () => {
  const record = reconcileExecutionListVisibilityAfterPatch(makeTask({
    work_record_read_only: true,
    work_record_visible: true,
    work_record_state: 'reassigned',
    work_record_media_attributed: true,
    media_access_work_task_id: 'canonical-work-task-1',
    photo_urls: ['current/photo.jpg'],
    completion_photo_urls: ['history/executor-a-proof.jpg'],
    key_photo_url: 'current/key.jpg',
    lockbox_video_url: 'current/lockbox.mp4',
  } as any), [])

  expect(record).toMatchObject({
    media_access_work_task_id: 'canonical-work-task-1',
    photo_urls: [],
    completion_photo_urls: ['history/executor-a-proof.jpg'],
    key_photo_url: null,
    lockbox_video_url: null,
  })
})

test('keeps a maintenance receipt when a task-list response started before that receipt returns', () => {
  const receiptTask = makeTask({
    id: 'property_maintenance:m1',
    task_kind: 'maintenance',
    source_type: 'property_maintenance',
    source_id: 'm1',
    status: 'pending_review',
    maintenance_workflow: { status: 'pending_review', available_actions: [] },
  } as any)
  const staleRemote = makeTask({
    id: 'property_maintenance:m1',
    task_kind: 'maintenance',
    source_type: 'property_maintenance',
    source_id: 'm1',
    status: 'assigned',
    maintenance_workflow: { status: 'assigned', available_actions: ['executor_complete', 'executor_unfinished'] },
  } as any)

  expect(mergeRemoteWorkTaskItems([staleRemote], [receiptTask], { retainLocalTaskIds: ['property_maintenance:m1'] })[0]).toEqual(receiptTask)
})

test('does not let an in-flight stale list response overwrite a maintenance receipt', async () => {
  const store = require('./storage')
  const api = require('./api')
  const userId = 'receipt-race-user'
  const bucketKey = makeWorkTasksBucketKey({ userId, date_from: '2026-08-08', date_to: '2026-08-08', view: 'mine' })
  const assignedTask = makeTask({
    id: 'property_maintenance:m-race',
    task_kind: 'maintenance',
    source_type: 'property_maintenance',
    source_id: 'm-race',
    scheduled_date: '2026-08-08',
    date: '2026-08-08',
    status: 'assigned',
    maintenance_workflow: { status: 'assigned', available_actions: ['executor_complete', 'executor_unfinished'] },
  } as any)
  let resolveRemote: (items: WorkTaskItem[]) => void = () => {}
  const staleResponse = new Promise<WorkTaskItem[]>((resolve) => {
    resolveRemote = resolve
  })
  store.getJson.mockResolvedValueOnce({
    items: [assignedTask],
    projectionKey: 'unscoped-v1:mine',
    ready: true,
  })
  api.listWorkTasks.mockReturnValueOnce(staleResponse)
  establishWorkTasksSession({ token: 't1', userId })
  await initWorkTasksStore({ bucketKey, session: { token: 't1', userId } })

  const refresh = requestWorkTasksRefresh({ token: 't1', userId, date_from: '2026-08-08', date_to: '2026-08-08', view: 'mine', mode: 'force', reason: 'stale_receipt_test' })
  await Promise.resolve()
  await patchWorkTaskItem('property_maintenance:m-race', {
    status: 'pending_review',
    maintenance_workflow: { status: 'pending_review', available_actions: [] },
  } as any)
  resolveRemote([assignedTask])
  await refresh

  expect(getWorkTasksSnapshot().items[0]).toMatchObject({
    id: 'property_maintenance:m-race',
    status: 'pending_review',
    maintenance_workflow: { status: 'pending_review', available_actions: [] },
  })
})

function refreshParams(overrides: Partial<{ token: string; userId: string; date_from: string; date_to: string; view: 'mine' | 'all' }> = {}) {
  return {
    token: 't1',
    userId: 'refresh-user',
    date_from: '2026-08-30',
    date_to: '2026-08-30',
    view: 'mine' as const,
    ...overrides,
  }
}

test('buckets a cross-day work record by the server work-record date, not the planned date', async () => {
  const api = require('./api')
  const params = refreshParams({ date_from: '2026-10-20', date_to: '2026-10-20' })
  api.listWorkTasks.mockResolvedValueOnce([makeTask({
    id: 'cross-day-record',
    scheduled_date: '2026-10-19',
    date: '2026-10-19',
    original_scheduled_date: '2026-10-19',
    work_record_date: '2026-10-20',
    work_record_visible: true,
    work_record_read_only: true,
    work_record_state: 'completed',
    status: 'done',
    daily_stats_group: null,
    daily_stats_key: null,
  } as any)])

  await requestWorkTasksRefresh({ ...params, mode: 'force', reason: 'cross_day_record_test' })
  expect(getWorkTasksSnapshot().items[0]).toMatchObject({
    id: 'cross-day-record',
    date: '2026-10-20',
    scheduled_date: '2026-10-19',
    original_scheduled_date: '2026-10-19',
    work_record_read_only: true,
  })
})

test('keeps an authorized manager-all unassigned offline card visible after a local status patch', async () => {
  const api = require('./api')
  const params = refreshParams({ userId: 'manager-patch-user', view: 'all' })
  const task = makeTask({
    id: 'offline-manager-patch',
    source_type: 'cleaning_offline_tasks',
    task_kind: 'offline',
    source_id: 'offline-manager-patch',
    scheduled_date: params.date_from,
    date: params.date_from,
    status: 'todo',
    assignee_id: null,
    execution_list_visible: true,
  } as any)
  api.listWorkTasks.mockResolvedValue([task])
  establishWorkTasksSession({ token: params.token, userId: params.userId })

  await requestWorkTasksRefresh({ ...params, mode: 'force', reason: 'manager_patch_initial' })
  await activateWorkTasksRealtime({ ...params, includeManagerUnassignedOffline: true })
  await patchWorkTaskItem(task.id, { status: 'in_progress' })

  expect(getWorkTasksSnapshot().items).toHaveLength(1)
  expect(getWorkTasksSnapshot().items[0]).toMatchObject({
    id: task.id,
    status: 'in_progress',
    execution_list_visible: true,
  })
})

test('replaces one date bucket on repeated full refreshes without appending duplicate task cards', async () => {
  const api = require('./api')
  const params = refreshParams({ userId: 'dedupe-user', view: 'all' })
  const task = makeTask({
    id: 'offline-1',
    source_type: 'cleaning_offline_tasks',
    task_kind: 'offline',
    source_id: 'offline-1',
    scheduled_date: params.date_from,
    date: params.date_from,
    assignee_id: null,
    execution_list_visible: true,
  } as any)
  api.listWorkTasks.mockResolvedValue([task])
  establishWorkTasksSession({ token: params.token, userId: params.userId })

  await requestWorkTasksRefresh({ ...params, mode: 'force', reason: 'initial_load' })
  await requestWorkTasksRefresh({ ...params, mode: 'force', reason: 'manual_refresh' })

  expect(api.listWorkTasks).toHaveBeenCalledTimes(2)
  expect(getWorkTasksSnapshot().items.map((item) => item.id)).toEqual(['offline-1'])
})

test('switches selected date buckets without retaining tasks from the previous window', async () => {
  const api = require('./api')
  const past = refreshParams({ userId: 'date-window-user', date_from: '2026-08-29', date_to: '2026-08-29', view: 'all' })
  const future = refreshParams({ userId: 'date-window-user', date_from: '2026-08-31', date_to: '2026-08-31', view: 'all' })
  api.listWorkTasks
    .mockResolvedValueOnce([makeTask({ id: 'past-task', scheduled_date: past.date_from, date: past.date_from })])
    .mockResolvedValueOnce([makeTask({ id: 'future-task', scheduled_date: future.date_from, date: future.date_from })])
  establishWorkTasksSession({ token: past.token, userId: past.userId })

  await requestWorkTasksRefresh({ ...past, mode: 'force', reason: 'past_selected' })
  await requestWorkTasksRefresh({ ...future, mode: 'force', reason: 'future_selected' })

  expect(getWorkTasksSnapshot().items.map((item) => item.id)).toEqual(['future-task'])
})

test('keeps the 60 second passive cooldown scoped to one user and date window', async () => {
  const api = require('./api')
  const today = refreshParams({ userId: 'scope-user', date_from: '2026-08-30', date_to: '2026-08-30' })
  const tomorrow = refreshParams({ userId: 'scope-user', date_from: '2026-08-31', date_to: '2026-08-31' })
  establishWorkTasksSession({ token: today.token, userId: today.userId })

  await requestWorkTasksRefresh({ ...today, mode: 'force', reason: 'initial' })
  await requestWorkTasksRefresh({ ...today, mode: 'passive', reason: 'focus' })
  await requestWorkTasksRefresh({ ...tomorrow, mode: 'passive', reason: 'date_changed' })

  expect(api.listWorkTasks).toHaveBeenCalledTimes(2)
})

test('coalesces continuous consistency events into one bounded trailing refresh', async () => {
  jest.useFakeTimers()
  const api = require('./api')
  const params = refreshParams({ userId: 'consistency-user' })
  establishWorkTasksSession({ token: params.token, userId: params.userId })

  await requestWorkTasksRefresh({ ...params, mode: 'force', reason: 'initial' })
  for (let index = 0; index < 12; index += 1) {
    await requestWorkTasksRefresh({ ...params, mode: 'consistency', reason: `sse_${index}` })
  }

  await jest.advanceTimersByTimeAsync(59_999)
  expect(api.listWorkTasks).toHaveBeenCalledTimes(1)
  await jest.advanceTimersByTimeAsync(1)
  expect(api.listWorkTasks).toHaveBeenCalledTimes(2)
})

test('drops repeated focus refreshes during cooldown without scheduling a trailing refresh', async () => {
  jest.useFakeTimers()
  const api = require('./api')
  const params = refreshParams({ userId: 'focus-user' })
  establishWorkTasksSession({ token: params.token, userId: params.userId })

  await requestWorkTasksRefresh({ ...params, mode: 'force', reason: 'initial' })
  for (let index = 0; index < 10; index += 1) {
    await requestWorkTasksRefresh({ ...params, mode: 'passive', reason: 'screen_focus' })
  }

  await jest.advanceTimersByTimeAsync(60_000)
  expect(api.listWorkTasks).toHaveBeenCalledTimes(1)
})

test('collapses force requests received while a refresh is running into one follow-up', async () => {
  const api = require('./api')
  const params = refreshParams({ userId: 'force-user' })
  establishWorkTasksSession({ token: params.token, userId: params.userId })
  let releaseFirstRequest: (items: WorkTaskItem[]) => void = () => {}
  const firstRequest = new Promise<WorkTaskItem[]>((resolve) => {
    releaseFirstRequest = resolve
  })
  api.listWorkTasks.mockReturnValueOnce(firstRequest).mockResolvedValue([])

  const initial = requestWorkTasksRefresh({ ...params, mode: 'force', reason: 'initial' })
  const forceRequests = Array.from({ length: 10 }, () => requestWorkTasksRefresh({ ...params, mode: 'force', reason: 'manual_refresh' }))
  releaseFirstRequest([])
  await Promise.all([initial, ...forceRequests])

  expect(api.listWorkTasks).toHaveBeenCalledTimes(2)
})

test('rejects queued force waiters without an immediate retry when the running refresh fails', async () => {
  const api = require('./api')
  const params = refreshParams({ userId: 'failed-force-user' })
  establishWorkTasksSession({ token: params.token, userId: params.userId })
  let rejectFirstRequest: (error: Error) => void = () => {}
  const firstRequest = new Promise<WorkTaskItem[]>((_resolve, reject) => {
    rejectFirstRequest = reject
  })
  let releaseManualRetry: (items: WorkTaskItem[]) => void = () => {}
  const manualRetryRequest = new Promise<WorkTaskItem[]>((resolve) => {
    releaseManualRetry = resolve
  })
  api.listWorkTasks.mockReturnValueOnce(firstRequest).mockReturnValueOnce(manualRetryRequest)

  const initial = requestWorkTasksRefresh({ ...params, mode: 'force', reason: 'initial' })
  const forceRequests = Array.from({ length: 10 }, () => requestWorkTasksRefresh({ ...params, mode: 'force', reason: 'manual_refresh' }))
  const outcomes = Promise.allSettled([initial, ...forceRequests])
  rejectFirstRequest(Object.assign(new Error('request timed out'), { code: 'TIMEOUT' }))

  const settled = await outcomes
  expect(settled.every((outcome) => outcome.status === 'rejected')).toBe(true)
  expect(api.listWorkTasks).toHaveBeenCalledTimes(1)

  let manualRetrySettled = false
  const manualRetry = requestWorkTasksRefresh({ ...params, mode: 'force', reason: 'manual_retry' }).then((applied) => {
    manualRetrySettled = true
    return applied
  })
  await Promise.resolve()
  expect(api.listWorkTasks).toHaveBeenCalledTimes(2)
  expect(manualRetrySettled).toBe(false)
  releaseManualRetry([])
  await expect(manualRetry).resolves.toBe(true)
})

test('preserves one cooldown consistency retry when a running refresh and queued force both fail', async () => {
  jest.useFakeTimers()
  const api = require('./api')
  const params = refreshParams({ userId: 'failed-force-consistency-user' })
  establishWorkTasksSession({ token: params.token, userId: params.userId })
  let rejectFirstRequest: (error: Error) => void = () => {}
  const firstRequest = new Promise<WorkTaskItem[]>((_resolve, reject) => {
    rejectFirstRequest = reject
  })
  api.listWorkTasks.mockReturnValueOnce(firstRequest).mockResolvedValueOnce([])

  const initial = requestWorkTasksRefresh({ ...params, mode: 'force', reason: 'initial' })
  const queuedForce = requestWorkTasksRefresh({ ...params, mode: 'force', reason: 'manual_refresh' })
  await requestWorkTasksRefresh({ ...params, mode: 'consistency', reason: 'sse_during_refresh' })
  const outcomes = Promise.allSettled([initial, queuedForce])
  rejectFirstRequest(new Error('request timed out'))

  expect((await outcomes).every((outcome) => outcome.status === 'rejected')).toBe(true)
  expect(api.listWorkTasks).toHaveBeenCalledTimes(1)
  await jest.advanceTimersByTimeAsync(59_999)
  expect(api.listWorkTasks).toHaveBeenCalledTimes(1)
  await jest.advanceTimersByTimeAsync(1)
  expect(api.listWorkTasks).toHaveBeenCalledTimes(2)
})

test('keeps a backgrounded queued force waiter until foreground after the running refresh fails', async () => {
  const api = require('./api')
  const params = refreshParams({ userId: 'backgrounded-failed-force-user' })
  establishWorkTasksSession({ token: params.token, userId: params.userId })
  let rejectFirstRequest: (error: Error) => void = () => {}
  const firstRequest = new Promise<WorkTaskItem[]>((_resolve, reject) => {
    rejectFirstRequest = reject
  })
  let releaseForegroundRetry: (items: WorkTaskItem[]) => void = () => {}
  const foregroundRetry = new Promise<WorkTaskItem[]>((resolve) => {
    releaseForegroundRetry = resolve
  })
  api.listWorkTasks.mockReturnValueOnce(firstRequest).mockReturnValueOnce(foregroundRetry)

  const initial = requestWorkTasksRefresh({ ...params, mode: 'force', reason: 'initial' })
  setWorkTasksRefreshForeground(false)
  let queuedSettled = false
  const queuedForce = requestWorkTasksRefresh({
    ...params,
    mode: 'force',
    reason: 'background_queue',
    waitForForeground: true,
  }).then((applied) => {
    queuedSettled = true
    return applied
  })
  const initialOutcome = expect(initial).rejects.toThrow('request timed out')
  rejectFirstRequest(new Error('request timed out'))

  await initialOutcome
  await Promise.resolve()
  expect(api.listWorkTasks).toHaveBeenCalledTimes(1)
  expect(queuedSettled).toBe(false)

  setWorkTasksRefreshForeground(true)
  await Promise.resolve()
  expect(api.listWorkTasks).toHaveBeenCalledTimes(2)
  expect(queuedSettled).toBe(false)
  releaseForegroundRetry([])
  await expect(queuedForce).resolves.toBe(true)
})

test('clears pending timers on logout so a new account does not inherit its refresh state', async () => {
  jest.useFakeTimers()
  const api = require('./api')
  const accountA = refreshParams({ userId: 'account-a' })
  const accountB = refreshParams({ userId: 'account-b' })
  establishWorkTasksSession({ token: accountA.token, userId: accountA.userId })

  await requestWorkTasksRefresh({ ...accountA, mode: 'force', reason: 'initial' })
  await requestWorkTasksRefresh({ ...accountA, mode: 'consistency', reason: 'sse_unknown' })
  deactivateWorkTasksRealtime()
  await jest.advanceTimersByTimeAsync(60_000)
  establishWorkTasksSession({ token: accountB.token, userId: accountB.userId })
  await requestWorkTasksRefresh({ ...accountB, mode: 'passive', reason: 'screen_focus' })

  expect(api.listWorkTasks).toHaveBeenCalledTimes(2)
})

test('drops an old account response after logout without scheduling its queued follow-up', async () => {
  const api = require('./api')
  const accountA = refreshParams({ token: 'token-a', userId: 'account-a' })
  const accountB = refreshParams({ token: 'token-b', userId: 'account-b' })
  const oldTask = makeTask({ id: 'old-account-task', scheduled_date: accountA.date_from, date: accountA.date_from })
  const newTask = makeTask({ id: 'new-account-task', scheduled_date: accountB.date_from, date: accountB.date_from })
  let releaseOldRequest: (items: WorkTaskItem[]) => void = () => {}
  const oldResponse = new Promise<WorkTaskItem[]>((resolve) => {
    releaseOldRequest = resolve
  })
  api.listWorkTasks.mockReturnValueOnce(oldResponse).mockResolvedValueOnce([newTask])
  establishWorkTasksSession({ token: accountA.token, userId: accountA.userId })

  const oldRequest = requestWorkTasksRefresh({ ...accountA, mode: 'force', reason: 'initial' })
  for (let attempt = 0; attempt < 20 && api.listWorkTasks.mock.calls.length < 1; attempt += 1) await Promise.resolve()
  expect(api.listWorkTasks).toHaveBeenCalledTimes(1)
  const queuedOldFollowUp = requestWorkTasksRefresh({ ...accountA, mode: 'force', reason: 'manual_refresh' })
  deactivateWorkTasksRealtime()
  establishWorkTasksSession({ token: accountB.token, userId: accountB.userId })
  await requestWorkTasksRefresh({ ...accountB, mode: 'force', reason: 'account_switched' })
  releaseOldRequest([oldTask])
  await Promise.all([oldRequest, queuedOldFollowUp])
  await Promise.resolve()
  await Promise.resolve()

  expect(getWorkTasksSnapshot().items.map((task) => task.id)).toEqual(['new-account-task'])
  expect(api.listWorkTasks).toHaveBeenCalledTimes(2)
  expect(api.listWorkTasks.mock.calls.map((call: any[]) => call[0])).toEqual(['token-a', 'token-b'])
})

test('switching accounts with the same authority hides the old account before new hydration', async () => {
  const storage = require('./storage')
  const accountA = { token: 'same-role-token-a', userId: 'same-role-account-a' }
  const accountB = { token: 'same-role-token-b', userId: 'same-role-account-b' }
  const projectionKey = makeWorkTasksProjectionKey({
    roles: ['cleaner'],
    permissions: [],
    activeRole: 'cleaner',
    view: 'mine',
  })
  const bucketKeyA = makeWorkTasksBucketKey({
    userId: accountA.userId,
    date_from: '2026-10-20',
    date_to: '2026-10-20',
    view: 'mine',
  })
  storage.getJson.mockResolvedValueOnce({
    items: [makeTask({ id: 'account-a-cache', scheduled_date: '2026-10-20', date: '2026-10-20' })],
    projectionKey,
    ready: true,
  })
  establishWorkTasksSession({ ...accountA, role: 'cleaner', roles: ['cleaner'], permissions: [] })
  await initWorkTasksStore({ bucketKey: bucketKeyA, projectionKey, session: accountA })
  expect(findWorkTaskItemByAnyId('account-a-cache')).toMatchObject({ id: 'account-a-cache' })

  establishWorkTasksSession({ ...accountB, role: 'cleaner', roles: ['cleaner'], permissions: [] })

  expect(getWorkTasksSnapshot()).toMatchObject({ bucketKey: null, projectionKey: null, ready: false, items: [] })
  expect(findWorkTaskItemByAnyId('account-a-cache')).toBeNull()
})

test('rejects a queue-delayed old account caller after a new account session starts', async () => {
  const api = require('./api')
  const EventSource = require('react-native-sse')
  const accountA = refreshParams({ token: 'token-a', userId: 'account-a' })
  const accountB = refreshParams({ token: 'token-b', userId: 'account-b' })
  let releaseOldQueue: () => void = () => {}
  const oldQueue = new Promise<void>((resolve) => {
    releaseOldQueue = resolve
  })
  establishWorkTasksSession({ token: accountA.token, userId: accountA.userId })

  const delayedOldCaller = (async () => {
    await oldQueue
    const refreshed = await requestWorkTasksRefresh({ ...accountA, mode: 'force', reason: 'tasks_screen_refresh' })
    const realtimeActive = await activateWorkTasksRealtime(accountA)
    return { refreshed, realtimeActive }
  })()

  deactivateWorkTasksRealtime()
  establishWorkTasksSession({ token: accountB.token, userId: accountB.userId })
  await requestWorkTasksRefresh({ ...accountB, mode: 'force', reason: 'account_switched' })
  releaseOldQueue()

  await expect(delayedOldCaller).resolves.toEqual({ refreshed: false, realtimeActive: false })
  expect(api.listWorkTasks.mock.calls.map((call: any[]) => call[0])).toEqual(['token-b'])
  expect(EventSource).not.toHaveBeenCalled()
})

test('revokes current-account media files before membership, assignment and resync refreshes', async () => {
  const mediaCache = require('./cleaningMediaCache')
  await activateWorkTasksRealtime({ token: 't1', userId: 'refresh-user', date_from: '2026-08-30', date_to: '2026-08-30', view: 'mine' })

  mockStreamListeners.work_task_event?.[0]({
    type: 'work_task_event',
    data: JSON.stringify({ event_type: 'TASK_ASSIGNMENT_CHANGED', change_scope: 'list' }),
  })
  mockStreamListeners.resync_required?.[0]({
    type: 'resync_required',
    data: JSON.stringify({ reason: 'sequence_gap' }),
  })
  await Promise.resolve()

  expect(mediaCache.invalidateCleaningMediaCache).toHaveBeenCalledTimes(2)
})

test('does not patch a same-source immutable reassignment record when the active assignee completes by SSE', async () => {
  const api = require('./api')
  const params = refreshParams({ date_from: '2026-10-19', date_to: '2026-10-19', view: 'all' })
  const active = makeTask({
    id: 'external_maintenance_orders:order-1',
    task_kind: 'maintenance',
    source_type: 'external_maintenance_orders',
    source_id: 'order-1',
    status: 'assigned',
    completion_photo_urls: [],
  } as any)
  const immutableRecord = makeTask({
    id: 'external_maintenance_orders:order-1::reassigned::event-a',
    task_kind: 'maintenance',
    source_type: 'external_maintenance_orders',
    source_id: 'order-1',
    status: 'reassigned',
    work_record_visible: true,
    work_record_read_only: true,
    work_record_state: 'reassigned',
    work_record_date: '2026-10-19',
    work_record_media_attributed: true,
    media_access_work_task_id: 'external_maintenance_orders:order-1',
    completion_photo_urls: ['maintenance/executor-a-proof.jpg'],
    counts_as_active_task: false,
  } as any)
  api.listWorkTasks.mockResolvedValueOnce([active, immutableRecord])
  await requestWorkTasksRefresh({ ...params, mode: 'force', reason: 'same_source_history_seed' })
  await activateWorkTasksRealtime(params)

  mockStreamListeners.work_task_event?.[0]({
    type: 'work_task_event',
    data: JSON.stringify({
      event_id: 'event-b-completed',
      event_type: 'TASK_COMPLETED',
      change_scope: 'list',
      task_id: 'external_maintenance_orders:order-1',
      source_ref_ids: ['order-1'],
      changed_fields: ['status', 'completion_photo_urls', 'completed_at'],
      payload: {
        patch: {
          status: 'completed',
          completion_photo_urls: ['maintenance/executor-b-proof.jpg'],
          completed_at: '2026-10-19T12:00:00.000Z',
        },
      },
    }),
  })
  await Promise.resolve()

  const items = getWorkTasksSnapshot().items
  expect(items).toHaveLength(2)
  expect(items.find((item) => item.id === active.id)).toMatchObject({
    status: 'completed',
    completion_photo_urls: ['maintenance/executor-b-proof.jpg'],
  })
  expect(items.find((item) => item.id === immutableRecord.id)).toMatchObject({
    status: 'reassigned',
    work_record_state: 'reassigned',
    work_record_read_only: true,
    work_record_media_attributed: true,
    media_access_work_task_id: 'external_maintenance_orders:order-1',
    work_record_date: '2026-10-19',
    completion_photo_urls: ['maintenance/executor-a-proof.jpg'],
    counts_as_active_task: false,
  })
})

test('refreshes a directly targeted canonical read-only record after server-side review approval', async () => {
  const api = require('./api')
  const params = refreshParams({ date_from: '2026-10-19', date_to: '2026-10-19', view: 'mine' })
  const pendingReview = makeTask({
    id: 'property_maintenance:m-approval',
    task_kind: 'maintenance',
    source_type: 'property_maintenance',
    source_id: 'm-approval',
    status: 'pending_review',
    work_record_visible: true,
    work_record_read_only: true,
    work_record_state: 'pending_review',
    work_record_date: '2026-10-19',
    counts_as_active_task: false,
  } as any)
  const approved = {
    ...pendingReview,
    status: 'closed',
    work_record_state: 'completed',
  } as any
  api.listWorkTasks.mockResolvedValueOnce([pendingReview])
  await requestWorkTasksRefresh({ ...params, mode: 'force', reason: 'canonical_readonly_seed' })
  await activateWorkTasksRealtime(params)
  api.listWorkTasks.mockClear()
  api.listWorkTasks.mockResolvedValueOnce([approved])

  mockStreamListeners.work_task_event?.[0]({
    type: 'work_task_event',
    data: JSON.stringify({
      event_id: 'event-review-approved',
      event_type: 'TASK_UPDATED',
      change_scope: 'list',
      task_id: 'work_task:property_maintenance:m-approval',
      source_ref_ids: ['property_maintenance:m-approval', 'm-approval'],
      changed_fields: ['status', 'work_record_state'],
      payload: { patch: { status: 'closed', work_record_state: 'completed' } },
    }),
  })
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (getWorkTasksSnapshot().items[0]?.work_record_state === 'completed') break
    await new Promise((resolve) => setTimeout(resolve, 5))
  }

  expect(api.listWorkTasks).toHaveBeenCalledTimes(1)
  expect(getWorkTasksSnapshot().items).toHaveLength(1)
  expect(getWorkTasksSnapshot().items[0]).toMatchObject({
    id: 'property_maintenance:m-approval',
    status: 'closed',
    work_record_state: 'completed',
    work_record_read_only: true,
    counts_as_active_task: false,
  })
})

test('refreshes a synthetic read-only record after an exact-source guest-luggage event revokes cached capabilities', async () => {
  const api = require('./api')
  const params = refreshParams({ date_from: '2026-10-19', date_to: '2026-10-19', view: 'mine' })
  const record = makeTask({
    id: 'cleaning_tasks_cleaner:source-authority::record:completed:2026-10-19',
    source_id: 'source-authority',
    source_ids: ['source-authority'],
    all_related_source_ids: ['source-authority'],
    work_record_read_only: true,
    work_record_visible: true,
    work_record_state: 'completed',
    status: 'done',
    property: {
      id: 'property-1',
      code: 'A1',
      wifi_ssid: 'Guest Network',
      wifi_password: 'synthetic-password',
      access_guide_link: 'https://example.test/guide',
    },
    guest_special_request: 'leave luggage inside',
    read_only_views: {
      property_access: true,
      guest_context: true,
      lock_codes: false,
      cleaner_photos: true,
      inspection_photos: false,
      guest_key_photo: true,
      media_scope: 'cleaner',
      media_source_ids: ['source-authority'],
    },
  } as any)
  api.listWorkTasks.mockResolvedValueOnce([record])
  await requestWorkTasksRefresh({ ...params, mode: 'force', reason: 'source_authority_seed' })
  await activateWorkTasksRealtime(params)
  api.listWorkTasks.mockClear()
  api.listWorkTasks.mockResolvedValueOnce([record])

  mockStreamListeners.work_task_event?.[0]({
    type: 'work_task_event',
    data: JSON.stringify({
      event_id: 'event-source-authority-changed',
      event_type: 'TASK_UPDATED',
      change_scope: 'list',
      task_id: 'source-authority',
      source_ref_ids: ['source-authority'],
      changed_fields: ['guest_luggage'],
      payload: { patch: { guest_luggage: { id: 'notice-2', note: 'updated notice' } } },
    }),
  })
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (api.listWorkTasks.mock.calls.length > 0) break
    await new Promise((resolve) => setTimeout(resolve, 5))
  }

  expect(api.listWorkTasks).toHaveBeenCalledTimes(1)
  expect(findWorkTaskItemByAnyId('source-authority')).toMatchObject({
    read_only_views: { property_access: true, guest_context: true },
    guest_special_request: 'leave luggage inside',
    property: { wifi_ssid: 'Guest Network', access_guide_link: 'https://example.test/guide' },
  })
})

test('keeps a non-password inspection task pending key video after the realtime inspected event', () => {
  const task = makeTask({
    task_kind: 'inspection',
    inspection_scope: 'inspect_and_hang',
    status: 'to_inspect',
  } as any)

  expect(projectCleaningStatusForTask(task, 'inspected')).toBe('to_hang_keys')
  expect(projectCleaningStatusForTask({ ...task, inspection_scope: 'password_only' } as any, 'inspected')).toBe('done')
})

test('treats key re-upload as an incremental event so existing consumable photos stay in the task cache', () => {
  const task = makeTask({
    status: 'done',
    restock_items: [{ item_id: 'stock-1', label: '纸巾', qty: 2, note: null, photo_url: 'cleaning/task-1/stock-1.jpg', status: 'low' }],
  } as any)
  const event = {
    event_type: 'TASK_UPDATED',
    change_scope: 'list',
    changed_fields: ['key_photo_url'],
    payload: { patch: { key_photo_url: 'cleaning/task-1/key.jpg' } },
  } as any

  expect(isSafePatchEvent({
    event_type: 'TASK_UPDATED',
    change_scope: 'list',
    changed_fields: ['key_photo_url'],
    payload: { patch: { key_photo_url: 'cleaning/task-1/key.jpg' } },
  })).toBe(true)
  expect(isSafePatchEvent({
    event_type: 'TASK_UPDATED',
    change_scope: 'list',
    changed_fields: ['status', 'started_at', 'key_photo_uploaded_at'],
    payload: { patch: { status: 'in_progress', started_at: '2026-07-27T00:00:00.000Z', key_photo_uploaded_at: '2026-07-27T00:00:00.000Z' } },
  })).toBe(false)
  expect(isSafePatchEvent({
    event_type: 'TASK_UPDATED',
    change_scope: 'list',
    changed_fields: ['guest_ready_notification', 'available_actions'],
    payload: { patch: { guest_ready_notification: { status: 'notified' } } },
  })).toBe(false)
  expect(isSafePatchEvent({
    event_type: 'TASK_UPDATED',
    change_scope: 'detail',
    changed_fields: ['old_code', 'password_authority'],
    payload: { patch: { password_authority: { old_code_status: 'manual_confirmed' } } },
  })).toBe(false)
  expect(eventRequiresGuestReadyAuthorityRefresh({
    event_type: 'TASK_UPDATED',
    change_scope: 'list',
    changed_fields: ['checkin_time'],
    payload: { patch: { checkin_time: '2:30pm' } },
  })).toBe(true)
  expect(isSafePatchEvent({
    event_type: 'TASK_UPDATED',
    change_scope: 'list',
    changed_fields: ['checkin_time'],
    payload: { patch: { checkin_time: '2:30pm' } },
  })).toBe(false)
  expect(mergePatchIntoTask(task, event).restock_items).toEqual(task.restock_items)
})

test('forces authoritative refresh for key handover instead of patching a merged card', async () => {
  const api = require('./api')
  await activateWorkTasksRealtime({ token: 't1', userId: 'refresh-user', date_from: '2026-08-30', date_to: '2026-08-30', view: 'all' })
  api.listWorkTasks.mockClear()
  const keyHandover = {
    state: 'completed',
    source_task_id: 'cleaning-1',
    completed_at: '2026-10-20T02:32:15.623Z',
    workflow_finalization_pending: true,
    missing_requirements: ['cleaning_consumables', 'cleaning_property_photo'],
  }
  const event = {
    event_id: 'evt-key-handover-authority',
    event_type: 'TASK_UPDATED',
    change_scope: 'list',
    task_id: 'cleaning_task:checkout-1',
    source_ref_ids: ['checkout-1'],
    changed_fields: ['status', 'key_handover'],
    payload: { patch: { status: 'in_progress', key_handover: keyHandover } },
  } as any

  expect(eventRequiresKeyHandoverAuthorityRefresh(event)).toBe(true)
  expect(isSafePatchEvent(event)).toBe(false)
  mockStreamListeners.work_task_event?.[0]({
    type: 'work_task_event',
    data: JSON.stringify(event),
  })
  await Promise.resolve()
  await Promise.resolve()

  expect(api.listWorkTasks).toHaveBeenCalledTimes(1)
})

test('forces an authoritative refresh instead of merging a partial guest-ready qualification event', async () => {
  const api = require('./api')
  await activateWorkTasksRealtime({ token: 't1', userId: 'refresh-user', date_from: '2026-08-30', date_to: '2026-08-30', view: 'all' })
  api.listWorkTasks.mockClear()

  mockStreamListeners.work_task_event?.[0]({
    type: 'work_task_event',
    data: JSON.stringify({
      event_id: 'evt-checkin-time',
      event_type: 'TASK_UPDATED',
      change_scope: 'list',
      task_id: 'cleaning_task:task-1',
      changed_fields: ['checkin_time'],
      payload: { patch: { checkin_time: '2:30pm' } },
    }),
  })
  await Promise.resolve()
  await Promise.resolve()

  expect(api.listWorkTasks).toHaveBeenCalledTimes(1)
})

test('forces guest-ready authority before handling a sync membership removal', async () => {
  const api = require('./api')
  const mediaCache = require('./cleaningMediaCache')
  await activateWorkTasksRealtime({ token: 't1', userId: 'refresh-user', date_from: '2026-08-30', date_to: '2026-08-30', view: 'all' })
  api.listWorkTasks.mockClear()

  mockStreamListeners.work_task_event?.[0]({
    type: 'work_task_event',
    data: JSON.stringify({
      event_id: 'evt-sync-checkin-removed',
      event_type: 'TASK_REMOVED',
      change_scope: 'membership',
      task_id: 'cleaning_task:task-1',
      changed_fields: ['execution_state', 'order_id_checkin', 'guest_ready_notification'],
      payload: { patch: {} },
    }),
  })
  await Promise.resolve()
  await Promise.resolve()

  expect(mediaCache.invalidateCleaningMediaCache).toHaveBeenCalledTimes(1)
  expect(api.listWorkTasks).toHaveBeenCalledTimes(1)
})

test('forces membership changes through cooldown and moves the task across a month boundary', async () => {
  const api = require('./api')
  const params = refreshParams({
    userId: 'refresh-user', date_from: '2026-08-31', date_to: '2026-09-06', view: 'all',
  })
  api.listWorkTasks.mockResolvedValueOnce([
    makeTask({ id: 'month-move', scheduled_date: '2026-08-31', date: '2026-08-31' } as any),
  ])
  await requestWorkTasksRefresh({ ...params, mode: 'force', reason: 'initial_month_bucket' })
  await activateWorkTasksRealtime({
    token: 't1', userId: 'refresh-user', date_from: '2026-08-31', date_to: '2026-09-06', view: 'all',
  })
  api.listWorkTasks.mockClear()
  api.listWorkTasks.mockResolvedValueOnce([
    makeTask({ id: 'month-move', scheduled_date: '2026-09-01', date: '2026-09-01' } as any),
  ])

  mockStreamListeners.work_task_event?.[0]({
    type: 'work_task_event',
    data: JSON.stringify({
      event_id: 'evt-membership-month-move',
      event_type: 'TASK_ASSIGNMENT_CHANGED',
      change_scope: 'membership',
      task_id: 'cleaning_task:checkout-1',
      changed_fields: ['inspection_mode', 'inspection_due_date'],
      payload: { patch: { inspection_mode: 'deferred', inspection_due_date: '2026-09-01' } },
    }),
  })
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (getWorkTasksSnapshot().items.find((item) => item.id === 'month-move')?.scheduled_date === '2026-09-01') break
    await new Promise((resolve) => setTimeout(resolve, 5))
  }

  expect(api.listWorkTasks).toHaveBeenCalledTimes(1)
  expect(getWorkTasksSnapshot().items.find((item) => item.id === 'month-move')?.scheduled_date).toBe('2026-09-01')
})

test('bounds and consumes a failed guest-ready refresh before one consistency retry', async () => {
  jest.useFakeTimers()
  const api = require('./api')
  api.listWorkTasks.mockRejectedValueOnce(new Error('temporary network failure')).mockResolvedValue([])
  await activateWorkTasksRealtime({ token: 't1', userId: 'refresh-user', date_from: '2026-08-30', date_to: '2026-08-30', view: 'all' })

  mockStreamListeners.work_task_event?.[0]({
    type: 'work_task_event',
    data: JSON.stringify({
      event_id: 'evt-checkin-time-retry',
      event_type: 'TASK_UPDATED',
      change_scope: 'list',
      changed_fields: ['checkin_time'],
      payload: { patch: { checkin_time: '2:30pm' } },
    }),
  })
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  expect(api.listWorkTasks).toHaveBeenCalledTimes(1)

  await jest.advanceTimersByTimeAsync(60_000)
  expect(api.listWorkTasks).toHaveBeenCalledTimes(2)
})

test('retries once when a background membership refresh fails after returning to foreground', async () => {
  jest.useFakeTimers()
  const api = require('./api')
  api.listWorkTasks.mockRejectedValueOnce(new Error('resume network failure')).mockResolvedValue([])
  await activateWorkTasksRealtime({ token: 't1', userId: 'refresh-user', date_from: '2026-08-30', date_to: '2026-08-30', view: 'all' })
  setWorkTasksRefreshForeground(false)

  mockStreamListeners.work_task_event?.[0]({
    type: 'work_task_event',
    data: JSON.stringify({
      event_id: 'evt-background-membership-retry',
      event_type: 'TASK_ASSIGNMENT_CHANGED',
      change_scope: 'membership',
      task_id: 'cleaning_task:checkout-background',
      changed_fields: ['inspection_mode', 'inspection_due_date', 'inspector_id'],
      payload: { patch: {} },
    }),
  })
  await Promise.resolve()
  expect(api.listWorkTasks).not.toHaveBeenCalled()

  setWorkTasksRefreshForeground(true)
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  expect(api.listWorkTasks).toHaveBeenCalledTimes(1)

  await jest.advanceTimersByTimeAsync(60_000)
  expect(api.listWorkTasks).toHaveBeenCalledTimes(2)
})

test('does not leave a user-triggered force refresh pending while iOS reports the app inactive', async () => {
  const api = require('./api')
  const params = refreshParams()
  setWorkTasksRefreshForeground(false)

  let settled = false
  let result: boolean | undefined
  const refresh = requestWorkTasksRefresh({
    ...params,
    mode: 'force',
    reason: 'tasks_screen_refresh',
  }).then((value) => {
    settled = true
    result = value
    return value
  })
  await Promise.resolve()

  expect(settled).toBe(true)
  expect(result).toBe(false)
  expect(api.listWorkTasks).not.toHaveBeenCalled()

  setWorkTasksRefreshForeground(true)
  await refresh
  for (let attempt = 0; attempt < 20 && api.listWorkTasks.mock.calls.length < 1; attempt += 1) await Promise.resolve()
  expect(api.listWorkTasks).toHaveBeenCalledTimes(1)
})

test('shares one real hydration promise and marks an empty current projection ready', async () => {
  const storage = require('./storage')
  const userId = 'shared-hydration-user'
  const bucketKey = makeWorkTasksBucketKey({ userId, date_from: '2026-10-20', date_to: '2026-10-20', view: 'mine' })
  const projectionKey = makeWorkTasksProjectionKey({ roles: ['cleaner'], permissions: [], activeRole: 'cleaner', view: 'mine' })
  let releaseStorage!: (value: null) => void
  storage.getJson.mockImplementationOnce(() => new Promise<null>((resolve) => {
    releaseStorage = resolve
  }))
  establishWorkTasksSession({ token: 't1', userId })

  const first = initWorkTasksStore({ bucketKey, projectionKey, session: { token: 't1', userId } })
  const second = initWorkTasksStore({ bucketKey, projectionKey, session: { token: 't1', userId } })
  expect(storage.getJson).toHaveBeenCalledTimes(2)
  expect(storage.getJson.mock.calls.some((call: any[]) => String(call[0]).includes('manager_fields_authority'))).toBe(true)
  expect(getWorkTasksSnapshot()).toMatchObject({ bucketKey, projectionKey, ready: false, items: [] })

  releaseStorage(null)
  await expect(Promise.all([first, second])).resolves.toEqual([true, true])
  expect(getWorkTasksSnapshot()).toMatchObject({ bucketKey, projectionKey, ready: true, items: [] })
})

test('bounds a pending cache read and ignores its late result', async () => {
  jest.useFakeTimers()
  const storage = require('./storage')
  const userId = 'late-hydration-user'
  const bucketKey = makeWorkTasksBucketKey({ userId, date_from: '2026-10-20', date_to: '2026-10-20', view: 'mine' })
  const projectionKey = makeWorkTasksProjectionKey({ roles: ['cleaner'], permissions: [], activeRole: 'cleaner', view: 'mine' })
  const lateTask = makeTask({ id: 'late-cache-task', scheduled_date: '2026-10-20', date: '2026-10-20' })
  let releaseStorage!: (value: any) => void
  storage.getJson.mockImplementationOnce(() => new Promise((resolve) => {
    releaseStorage = resolve
  }))
  establishWorkTasksSession({ token: 't1', userId })

  const hydration = initWorkTasksStore({ bucketKey, projectionKey, session: { token: 't1', userId } })
  await jest.advanceTimersByTimeAsync(3_000)
  await expect(hydration).resolves.toBe(true)
  expect(getWorkTasksSnapshot()).toMatchObject({ bucketKey, projectionKey, ready: true, items: [] })

  releaseStorage({ items: [lateTask], projectionKey, ready: true })
  await Promise.resolve()
  await Promise.resolve()
  expect(getWorkTasksSnapshot().items).toEqual([])
})

test('fails closed when a saved bucket belongs to a broader role or permission projection', async () => {
  const storage = require('./storage')
  const userId = 'permission-narrowing-user'
  const bucketKey = makeWorkTasksBucketKey({ userId, date_from: '2026-10-20', date_to: '2026-10-20', view: 'all' })
  const broadProjection = makeWorkTasksProjectionKey({ roles: ['admin'], permissions: ['tasks.manage'], activeRole: 'admin', view: 'all' })
  const narrowProjection = makeWorkTasksProjectionKey({ roles: ['customer_service'], permissions: [], activeRole: 'customer_service', view: 'all' })
  storage.getJson.mockResolvedValueOnce({
    items: [makeTask({ id: 'admin-only-cache', scheduled_date: '2026-10-20', date: '2026-10-20' })],
    projectionKey: broadProjection,
    ready: true,
  })
  establishWorkTasksSession({ token: 't1', userId })

  await expect(initWorkTasksStore({ bucketKey, projectionKey: narrowProjection, session: { token: 't1', userId } })).resolves.toBe(true)
  expect(getWorkTasksSnapshot()).toMatchObject({ bucketKey, projectionKey: narrowProjection, ready: true, items: [] })
})

test('same-account permission narrowing immediately hides old cache from global detail getters', async () => {
  const storage = require('./storage')
  const api = require('./api')
  const token = 'same-account-token'
  const userId = 'same-account-user'
  const params = refreshParams({ token, userId, date_from: '2026-10-20', date_to: '2026-10-20', view: 'all' })
  const bucketKey = makeWorkTasksBucketKey(params)
  const broadProjection = makeWorkTasksProjectionKey({ roles: ['admin'], permissions: ['tasks.manage'], activeRole: 'admin', view: 'all' })
  const broadTask = makeTask({ id: 'previous-admin-task', scheduled_date: '2026-10-20', date: '2026-10-20' })
  storage.getJson.mockResolvedValueOnce({ items: [broadTask], projectionKey: broadProjection, ready: true })
  establishWorkTasksSession({
    token,
    userId,
    role: 'admin',
    roles: ['admin'],
    permissions: ['tasks.manage'],
  })
  await initWorkTasksStore({ bucketKey, projectionKey: broadProjection, session: { token, userId } })
  expect(findWorkTaskItemByAnyId('previous-admin-task')).toMatchObject({ id: 'previous-admin-task' })

  establishWorkTasksSession({
    token,
    userId,
    role: 'customer_service',
    roles: ['customer_service'],
    permissions: [],
  })
  expect(getWorkTasksSnapshot()).toMatchObject({ ready: false, items: [] })
  expect(findWorkTaskItemByAnyId('previous-admin-task')).toBeNull()

  api.listWorkTasks.mockRejectedValueOnce(new Error('offline after permission change'))
  await expect(requestWorkTasksRefresh({ ...params, mode: 'force', reason: 'permission_narrowed_offline' })).rejects.toThrow('offline after permission change')
  expect(findWorkTaskItemByAnyId('previous-admin-task')).toBeNull()
})

test('deactivation immediately hides the prior account cache and emits while already idle', async () => {
  const storage = require('./storage')
  const token = 'sign-out-token'
  const userId = 'sign-out-user'
  const bucketKey = makeWorkTasksBucketKey({
    userId,
    date_from: '2026-10-20',
    date_to: '2026-10-20',
    view: 'mine',
  })
  const projectionKey = makeWorkTasksProjectionKey({
    roles: ['cleaner'],
    permissions: [],
    activeRole: 'cleaner',
    view: 'mine',
  })
  storage.getJson.mockResolvedValueOnce({
    items: [makeTask({ id: 'prior-account-task', scheduled_date: '2026-10-20', date: '2026-10-20' })],
    projectionKey,
    ready: true,
  })
  establishWorkTasksSession({ token, userId, role: 'cleaner', roles: ['cleaner'], permissions: [] })
  await initWorkTasksStore({ bucketKey, projectionKey, session: { token, userId } })
  expect(findWorkTaskItemByAnyId('prior-account-task')).toMatchObject({ id: 'prior-account-task' })

  const listener = jest.fn()
  const unsubscribe = subscribeWorkTasks(listener)
  deactivateWorkTasksRealtime()

  expect(listener).toHaveBeenCalledTimes(1)
  expect(getWorkTasksSnapshot()).toMatchObject({ ready: false, items: [] })
  expect(findWorkTaskItemByAnyId('prior-account-task')).toBeNull()
  unsubscribe()
})

test.each([401, 403])('clears current cached tasks when the authority read returns %s', async (status) => {
  const storage = require('./storage')
  const api = require('./api')
  const userId = `authority-${status}-user`
  const params = refreshParams({ userId, date_from: '2026-10-20', date_to: '2026-10-20' })
  const bucketKey = makeWorkTasksBucketKey(params)
  const projectionKey = makeWorkTasksProjectionKey({ roles: ['cleaner'], permissions: [], activeRole: 'cleaner', view: 'mine' })
  storage.getJson.mockResolvedValueOnce({
    items: [makeTask({ id: `cached-${status}`, scheduled_date: '2026-10-20', date: '2026-10-20' })],
    projectionKey,
    ready: true,
  })
  establishWorkTasksSession({ token: params.token, userId })
  await initWorkTasksStore({ bucketKey, projectionKey, session: params })
  api.listWorkTasks.mockRejectedValueOnce(Object.assign(new Error('permission changed'), { status }))

  await expect(requestWorkTasksRefresh({
    ...params,
    projectionKey,
    mode: 'force',
    reason: `authority_${status}`,
  })).rejects.toMatchObject({ status })
  expect(getWorkTasksSnapshot()).toMatchObject({ bucketKey, projectionKey, ready: true, items: [] })
})

test('a late 403 still clears the current projection after its screen guard becomes stale', async () => {
  const storage = require('./storage')
  const api = require('./api')
  const userId = 'late-403-user'
  const params = refreshParams({ userId, date_from: '2026-10-20', date_to: '2026-10-20' })
  const bucketKey = makeWorkTasksBucketKey(params)
  const projectionKey = makeWorkTasksProjectionKey({ roles: ['cleaner'], permissions: [], activeRole: 'cleaner', view: 'mine' })
  storage.getJson.mockResolvedValueOnce({
    items: [makeTask({ id: 'revoked-cache', scheduled_date: '2026-10-20', date: '2026-10-20' })],
    projectionKey,
    ready: true,
  })
  let rejectRemote!: (error: Error & { status: number }) => void
  api.listWorkTasks.mockImplementationOnce(() => new Promise((_resolve, reject) => {
    rejectRemote = reject
  }))
  establishWorkTasksSession({ token: params.token, userId })
  await initWorkTasksStore({ bucketKey, projectionKey, session: params })
  let screenIsCurrent = true

  const refresh = requestWorkTasksRefresh({
    ...params,
    projectionKey,
    isCurrent: () => screenIsCurrent,
    mode: 'force',
    reason: 'authority_revoked_while_unmounting',
  })
  for (let attempt = 0; attempt < 20 && api.listWorkTasks.mock.calls.length < 1; attempt += 1) await Promise.resolve()
  expect(api.listWorkTasks).toHaveBeenCalledTimes(1)
  screenIsCurrent = false
  rejectRemote(Object.assign(new Error('permission changed'), { status: 403 }))

  await expect(refresh).resolves.toBe(false)
  expect(getWorkTasksSnapshot()).toMatchObject({ bucketKey, projectionKey, ready: true, items: [] })
  expect(findWorkTaskItemByAnyId('revoked-cache')).toBeNull()
})

test('publishes fresh tasks before a cache write settles and bounds the caller wait', async () => {
  jest.useFakeTimers()
  const storage = require('./storage')
  const api = require('./api')
  const params = refreshParams({ userId: 'persist-pending-user', date_from: '2026-10-20', date_to: '2026-10-20' })
  const projectionKey = makeWorkTasksProjectionKey({ roles: ['cleaner'], permissions: [], activeRole: 'cleaner', view: 'mine' })
  let releaseWrite!: () => void
  storage.setJson.mockImplementationOnce(() => new Promise<void>((resolve) => {
    releaseWrite = resolve
  }))
  api.listWorkTasks.mockResolvedValueOnce([makeTask({ id: 'fresh-before-persist', scheduled_date: '2026-10-20', date: '2026-10-20' })])
  establishWorkTasksSession({ token: params.token, userId: params.userId })
  const listener = jest.fn()
  const unsubscribe = subscribeWorkTasks(listener)

  const refresh = requestWorkTasksRefresh({ ...params, projectionKey, mode: 'force', reason: 'persist_pending' })
  for (let attempt = 0; attempt < 30 && getWorkTasksSnapshot().items[0]?.id !== 'fresh-before-persist'; attempt += 1) await Promise.resolve()
  expect(getWorkTasksSnapshot().items[0]?.id).toBe('fresh-before-persist')
  expect(listener).toHaveBeenCalled()
  let settled = false
  void refresh.then(() => { settled = true })
  await Promise.resolve()
  expect(settled).toBe(false)

  await jest.advanceTimersByTimeAsync(1_500)
  await expect(refresh).resolves.toBe(true)
  releaseWrite()
  await Promise.resolve()
  unsubscribe()
})

test('does not roll back fresh state when cache persistence rejects', async () => {
  const storage = require('./storage')
  const api = require('./api')
  const params = refreshParams({ userId: 'persist-error-user', date_from: '2026-10-20', date_to: '2026-10-20' })
  const projectionKey = makeWorkTasksProjectionKey({ roles: ['cleaner'], permissions: [], activeRole: 'cleaner', view: 'mine' })
  storage.setJson.mockRejectedValueOnce(new Error('disk full'))
  api.listWorkTasks.mockResolvedValueOnce([makeTask({ id: 'fresh-despite-persist-error', scheduled_date: '2026-10-20', date: '2026-10-20' })])
  establishWorkTasksSession({ token: params.token, userId: params.userId })

  await expect(requestWorkTasksRefresh({ ...params, projectionKey, mode: 'force', reason: 'persist_error' })).resolves.toBe(true)
  expect(getWorkTasksSnapshot().items[0]?.id).toBe('fresh-despite-persist-error')
})

test('does not apply a late response after the same bucket changes permission projection', async () => {
  const api = require('./api')
  const params = refreshParams({ userId: 'projection-race-user', date_from: '2026-10-20', date_to: '2026-10-20', view: 'all' })
  const broadProjection = makeWorkTasksProjectionKey({ roles: ['admin'], permissions: ['tasks.manage'], activeRole: 'admin', view: 'all' })
  const narrowProjection = makeWorkTasksProjectionKey({ roles: ['customer_service'], permissions: [], activeRole: 'customer_service', view: 'all' })
  const broadTask = makeTask({ id: 'broad-late-task', scheduled_date: '2026-10-20', date: '2026-10-20' })
  const narrowTask = makeTask({ id: 'narrow-current-task', scheduled_date: '2026-10-20', date: '2026-10-20' })
  let releaseBroad!: (items: WorkTaskItem[]) => void
  api.listWorkTasks
    .mockImplementationOnce(() => new Promise<WorkTaskItem[]>((resolve) => { releaseBroad = resolve }))
    .mockResolvedValueOnce([narrowTask])
  establishWorkTasksSession({ token: params.token, userId: params.userId })
  let activeProjection = broadProjection

  const broadRefresh = requestWorkTasksRefresh({
    ...params,
    projectionKey: broadProjection,
    isCurrent: () => activeProjection === broadProjection,
    mode: 'force',
    reason: 'broad_started_first',
  })
  for (let attempt = 0; attempt < 20 && api.listWorkTasks.mock.calls.length < 1; attempt += 1) await Promise.resolve()
  activeProjection = narrowProjection
  const narrowRefresh = requestWorkTasksRefresh({
    ...params,
    projectionKey: narrowProjection,
    isCurrent: () => activeProjection === narrowProjection,
    mode: 'force',
    reason: 'permission_narrowed',
  })
  for (let attempt = 0; attempt < 30 && getWorkTasksSnapshot().items[0]?.id !== 'narrow-current-task'; attempt += 1) await Promise.resolve()
  expect(api.listWorkTasks).toHaveBeenCalledTimes(2)
  expect(getWorkTasksSnapshot().items[0]?.id).toBe('narrow-current-task')
  await expect(narrowRefresh).resolves.toBe(true)

  releaseBroad([broadTask])
  await expect(broadRefresh).resolves.toBe(false)
  expect(getWorkTasksSnapshot()).toMatchObject({ projectionKey: narrowProjection, ready: true })
  expect(getWorkTasksSnapshot().items.map((task) => task.id)).toEqual(['narrow-current-task'])
})

test('a new caller for the same scope can adopt an in-flight refresh from an unmounted caller', async () => {
  const api = require('./api')
  const params = refreshParams({ userId: 'same-scope-handoff-user', date_from: '2026-10-20', date_to: '2026-10-20' })
  const projectionKey = makeWorkTasksProjectionKey({ roles: ['cleaner'], permissions: [], activeRole: 'cleaner', view: 'mine' })
  const freshTask = makeTask({ id: 'same-scope-fresh-task', scheduled_date: '2026-10-20', date: '2026-10-20' })
  let releaseRemote!: (items: WorkTaskItem[]) => void
  api.listWorkTasks.mockImplementationOnce(() => new Promise<WorkTaskItem[]>((resolve) => {
    releaseRemote = resolve
  }))
  establishWorkTasksSession({ token: params.token, userId: params.userId })
  let currentCaller = 'old'

  const oldRefresh = requestWorkTasksRefresh({
    ...params,
    projectionKey,
    isCurrent: () => currentCaller === 'old',
    mode: 'force',
    reason: 'old_component_initial',
  })
  for (let attempt = 0; attempt < 20 && api.listWorkTasks.mock.calls.length < 1; attempt += 1) await Promise.resolve()
  expect(api.listWorkTasks).toHaveBeenCalledTimes(1)

  currentCaller = 'new'
  await expect(requestWorkTasksRefresh({
    ...params,
    projectionKey,
    isCurrent: () => currentCaller === 'new',
    mode: 'passive',
    reason: 'new_component_focus',
  })).resolves.toBe(false)
  releaseRemote([freshTask])

  await expect(oldRefresh).resolves.toBe(true)
  expect(getWorkTasksSnapshot().items.map((task) => task.id)).toEqual(['same-scope-fresh-task'])
})

test('an already stale same-scope caller cannot replace the current in-flight guard', async () => {
  const api = require('./api')
  const params = refreshParams({ userId: 'same-scope-stale-caller-user', date_from: '2026-10-20', date_to: '2026-10-20' })
  const projectionKey = makeWorkTasksProjectionKey({ roles: ['cleaner'], permissions: [], activeRole: 'cleaner', view: 'mine' })
  const freshTask = makeTask({ id: 'current-caller-task', scheduled_date: '2026-10-20', date: '2026-10-20' })
  let releaseRemote!: (items: WorkTaskItem[]) => void
  api.listWorkTasks.mockImplementationOnce(() => new Promise<WorkTaskItem[]>((resolve) => {
    releaseRemote = resolve
  }))
  establishWorkTasksSession({ token: params.token, userId: params.userId })

  const currentRefresh = requestWorkTasksRefresh({
    ...params,
    projectionKey,
    isCurrent: () => true,
    mode: 'force',
    reason: 'current_caller_started_first',
  })
  for (let attempt = 0; attempt < 20 && api.listWorkTasks.mock.calls.length < 1; attempt += 1) await Promise.resolve()
  expect(api.listWorkTasks).toHaveBeenCalledTimes(1)

  const staleRefresh = requestWorkTasksRefresh({
    ...params,
    projectionKey,
    isCurrent: () => false,
    mode: 'force',
    reason: 'already_stale_caller',
  })
  await expect(staleRefresh).resolves.toBe(false)

  releaseRemote([freshTask])
  await expect(currentRefresh).resolves.toBe(true)
  expect(api.listWorkTasks).toHaveBeenCalledTimes(1)
  expect(getWorkTasksSnapshot().items.map((task) => task.id)).toEqual(['current-caller-task'])
})
