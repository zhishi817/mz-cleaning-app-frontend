import {
  activateWorkTasksRealtime,
  deactivateWorkTasksRealtime,
  establishWorkTasksSession,
  eventRequiresGuestReadyAuthorityRefresh,
  getWorkTasksSnapshot,
  initWorkTasksStore,
  isSafePatchEvent,
  makeWorkTasksBucketKey,
  mergePatchIntoTask,
  mergeRemoteWorkTaskItems,
  patchWorkTaskItem,
  projectCleaningStatusForTask,
  reconcileExecutionListVisibilityAfterPatch,
  requestWorkTasksRefresh,
  setWorkTasksRefreshForeground,
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
  storage.setJson.mockClear()
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
  store.getJson.mockResolvedValueOnce({ items: [assignedTask] })
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
  await Promise.resolve()
  await Promise.resolve()
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
