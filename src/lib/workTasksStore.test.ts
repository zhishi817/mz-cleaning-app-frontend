import { isSafePatchEvent, mergePatchIntoTask, mergeRemoteWorkTaskItems, projectCleaningStatusForTask, type WorkTaskItem } from './workTasksStore'

jest.mock('react-native-sse', () => jest.fn())
jest.mock('../config/env', () => ({ API_BASE_URL: 'https://api.example.com/api' }))
jest.mock('./storage', () => ({ getJson: jest.fn(), setJson: jest.fn() }))
jest.mock('./api', () => ({ listWorkTasks: jest.fn() }))
jest.mock('./authEvents', () => ({ notifyAuthInvalidated: jest.fn() }))

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
