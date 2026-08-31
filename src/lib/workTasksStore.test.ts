import {
  activateWorkTasksRealtime,
  deactivateWorkTasksRealtime,
  establishWorkTasksSession,
  getWorkTasksSnapshot,
  initWorkTasksStore,
  isSafePatchEvent,
  makeWorkTasksBucketKey,
  mergePatchIntoTask,
  mergeRemoteWorkTaskItems,
  patchWorkTaskItem,
  projectCleaningStatusForTask,
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
  const storage = require('./storage')
  const api = require('./api')
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
  expect(mergePatchIntoTask(task, event).restock_items).toEqual(task.restock_items)
})
