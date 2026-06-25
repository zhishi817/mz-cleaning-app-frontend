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
