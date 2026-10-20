import { getTaskStatusMeta } from './taskVisualTheme'
import type { WorkTaskItem } from './workTasksStore'

function makeTask(patch: Partial<WorkTaskItem>): WorkTaskItem {
  return {
    id: 'task-1',
    task_kind: 'inspection',
    source_type: 'cleaning_tasks',
    source_id: 'ct-1',
    property_id: 'p1',
    title: 'MQ101',
    summary: null,
    scheduled_date: '2026-06-25',
    start_time: null,
    end_time: null,
    assignee_id: null,
    status: 'pending',
    urgency: 'medium',
    property: { id: 'p1', code: 'MQ101', address: '', unit_type: '' },
    date: '2026-06-25',
    ...patch,
  } as WorkTaskItem
}

test('inspection task with an assigned inspector does not display unassigned', () => {
  const meta = getTaskStatusMeta(makeTask({ inspector_id: 'inspector-1', inspector_name: 'MingXue' }), ['admin'])
  expect(meta).toEqual({ text: '已分配', tone: 'normal' })
})

test('pending cleaning task with an executor does not display unassigned', () => {
  const meta = getTaskStatusMeta(
    makeTask({
      task_kind: 'cleaning',
      cleaner_id: 'cleaner-1',
      cleaner_name: '清洁A',
    }),
    ['admin'],
  )
  expect(meta).toEqual({ text: '已分配', tone: 'normal' })
})

test('pending cleaning task without an executor still displays unassigned', () => {
  const meta = getTaskStatusMeta(makeTask({ task_kind: 'cleaning' }), ['admin'])
  expect(meta).toEqual({ text: '未分配', tone: 'pending' })
})

test('inspection task with a checkout marker displays checked out', () => {
  const meta = getTaskStatusMeta(
    makeTask({ checked_out_at: '2026-07-25T04:00:00.000Z', inspector_id: 'inspector-1' }),
    ['cleaning_inspector'],
  )
  expect(meta).toEqual({ text: '已退房', tone: 'special' })
})

test('merged inspection task keeps cleaning progress ahead of checkout marker', () => {
  const meta = getTaskStatusMeta(
    makeTask({
      status: 'assigned',
      cleaning_status: 'in_progress',
      inspection_status: 'assigned',
      checked_out_at: '2026-07-25T04:00:00.000Z',
      inspector_id: 'inspector-1',
    }),
    ['admin'],
  )
  expect(meta).toEqual({ text: '进行中', tone: 'normal' })
})

test('merged inspection task shows pending inspection after cleaning is complete', () => {
  const meta = getTaskStatusMeta(
    makeTask({
      status: 'assigned',
      cleaning_status: 'done',
      inspection_status: 'assigned',
      checked_out_at: '2026-07-25T04:00:00.000Z',
      inspector_id: 'inspector-1',
    }),
    ['admin'],
  )
  expect(meta).toEqual({ text: '待检查', tone: 'pending' })
})

test('inspector lockbox video does not mark unfinished cleaning complete', () => {
  const meta = getTaskStatusMeta(
    makeTask({
      task_kind: 'cleaning',
      status: 'keys_hung',
      cleaner_id: 'cleaner-1',
      cleaner_name: '清洁A',
      key_photo_url: 'private://key-photo',
      cleaning_submission_ready: false,
    }),
    ['cleaner'],
  )
  expect(meta).toEqual({ text: '进行中', tone: 'normal' })
})

test('unfinished cleaning without progress remains assigned after inspection completion', () => {
  const meta = getTaskStatusMeta(
    makeTask({
      task_kind: 'cleaning',
      status: 'keys_hung',
      cleaner_id: 'cleaner-1',
      cleaner_name: '清洁A',
      cleaning_submission_ready: false,
    }),
    ['cleaner'],
  )
  expect(meta).toEqual({ text: '已分配', tone: 'normal' })
})

test('submitted cleaning may still display complete after keys are hung', () => {
  const meta = getTaskStatusMeta(
    makeTask({
      task_kind: 'cleaning',
      status: 'keys_hung',
      cleaner_id: 'cleaner-1',
      cleaner_name: '清洁A',
      cleaning_submission_ready: true,
    }),
    ['cleaner'],
  )
  expect(meta).toEqual({ text: '已完成', tone: 'success' })
})

test('maintenance executor sees completed after submitting while management sees pending review', () => {
  const task = makeTask({
    task_kind: 'maintenance',
    source_type: 'property_maintenance',
    assignee_id: 'executor-1',
    status: 'pending_review',
    maintenance_workflow: { domain: 'internal', status: 'pending_review', available_actions: [] },
  })

  expect(getTaskStatusMeta(task, ['cleaner'], 'executor-1')).toEqual({ text: '已完成', tone: 'success' })
  expect(getTaskStatusMeta(task, ['admin'], 'manager-1')).toEqual({ text: '待审核', tone: 'pending' })
})

test('server-authorized work records use one status vocabulary for every role', () => {
  const base = makeTask({
    source_type: 'property_maintenance',
    task_kind: 'maintenance',
    status: 'pending_review',
    work_record_visible: true,
    work_record_read_only: true,
    work_record_date: '2026-10-19',
    original_scheduled_date: '2026-10-19',
  } as any)

  expect(getTaskStatusMeta({ ...base, work_record_state: 'pending_review' }, ['cleaner'], 'executor-1')).toEqual({ text: '待审核', tone: 'pending' })
  expect(getTaskStatusMeta({ ...base, work_record_state: 'completed' }, ['admin'], 'manager-1')).toEqual({ text: '已完成', tone: 'success' })
  expect(getTaskStatusMeta({ ...base, work_record_state: 'cancelled' }, ['customer_service'], 'cs-1')).toEqual({ text: '已取消', tone: 'neutral' })
  expect(getTaskStatusMeta({ ...base, work_record_state: 'rescheduled', rescheduled_to_date: '2026-10-22' } as any, ['offline_manager'], 'manager-2')).toEqual({ text: '延期至10-22', tone: 'neutral' })
  expect(getTaskStatusMeta({ ...base, work_record_state: 'reassigned' }, ['cleaner'], 'former-executor')).toEqual({ text: '已改派', tone: 'neutral' })
})
