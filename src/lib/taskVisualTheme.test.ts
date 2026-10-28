import { getKeyHandoverPendingNotice, getTaskStatusMeta } from './taskVisualTheme'
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

test('legacy password-only check-in projection uses its assigned execution status', () => {
  const meta = getTaskStatusMeta(
    makeTask({
      task_kind: 'cleaning',
      task_type: 'checkin_clean',
      inspection_scope: 'password_only',
      assignee_id: 'oscar-id',
      assignee_name: 'Oscar',
      cleaner_id: null,
      cleaner_name: 'Oscar',
      status: 'pending',
    }),
    ['cleaner'],
    'oscar-id',
  )
  expect(meta).toEqual({ text: '已分配', tone: 'normal' })
})

test('inspection task with a checkout marker displays checked out', () => {
  const meta = getTaskStatusMeta(
    makeTask({ checked_out_at: '2026-07-25T04:00:00.000Z', inspector_id: 'inspector-1' }),
    ['cleaning_inspector'],
  )
  expect(meta).toEqual({ text: '已退房', tone: 'special' })
})

test('incoming task status is not overwritten by that booking later checking out', () => {
  const unassigned = getTaskStatusMeta(
    makeTask({
      task_kind: 'cleaning',
      task_type: 'checkin_clean',
      status: 'pending',
      checked_out_at: '2026-10-15T00:00:00.000Z',
    }),
    ['admin'],
  )
  expect(unassigned).toEqual({ text: '未分配', tone: 'pending' })

  const assigned = getTaskStatusMeta(
    makeTask({
      task_kind: 'cleaning',
      task_type: 'checkin_clean',
      status: 'assigned',
      assignee_id: 'inspector-1',
      assignee_name: 'Angela',
      checked_out_at: '2026-10-15T00:00:00.000Z',
    }),
    ['admin'],
  )
  expect(assigned).toEqual({ text: '已分配', tone: 'normal' })
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

test('BO717 authoritative self-complete progress is not replaced by its incoming pending inspection', () => {
  const task = makeTask({
    task_kind: 'inspection',
    task_type: 'turnover',
    status: 'to_inspect',
    inspection_mode: 'self_complete',
    cleaning_status: 'done',
    inspection_status: 'assigned',
    cleaner_id: 'cleaner-simon',
    inspector_id: null,
    active_source_ids: ['bo717-checkout', 'bo717-checkin'],
    self_complete_progress: {
      authoritative: true,
      source_task_id: 'bo717-checkout',
      source_task_ids: ['bo717-checkout', 'bo717-checkin'],
      status: 'to_hang_keys',
    },
  } as any)

  expect(getTaskStatusMeta(task, ['admin'], 'manager-1')).toEqual({ text: '待挂钥匙', tone: 'pending' })
})

test('self-complete progress fails closed for missing authority, source mismatch, conflict and ordinary inspection', () => {
  const base = makeTask({
    task_kind: 'inspection',
    task_type: 'turnover',
    status: 'to_inspect',
    inspection_mode: 'self_complete',
    cleaning_status: 'done',
    inspection_status: 'assigned',
    active_source_ids: ['checkout-1', 'checkin-1'],
    self_complete_progress: {
      authoritative: true,
      source_task_id: 'checkout-1',
      source_task_ids: ['checkout-1', 'checkin-1'],
      status: 'to_hang_keys',
    },
  } as any)

  expect(getTaskStatusMeta({ ...base, self_complete_progress: null } as any, ['admin'])).toEqual({ text: '待检查', tone: 'pending' })
  expect(getTaskStatusMeta({ ...base, active_source_ids: ['checkout-1', 'different-checkin'] } as any, ['admin'])).toEqual({ text: '待检查', tone: 'pending' })
  expect(getTaskStatusMeta({ ...base, inspection_assignment_conflict: { reasons: ['assignee_mismatch'] } } as any, ['admin'])).toEqual({ text: '待检查', tone: 'pending' })
  expect(getTaskStatusMeta({ ...base, inspection_mode: 'same_day' } as any, ['admin'])).toEqual({ text: '待检查', tone: 'pending' })
  expect(getTaskStatusMeta({ ...base, status: 'cancelled' } as any, ['admin'])).toEqual({ text: '已取消', tone: 'neutral' })
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

test('explicit current key handover fact outranks unfinished shared workflow state', () => {
  const task = makeTask({
    task_kind: 'cleaning',
    status: 'in_progress',
    cleaner_id: 'cleaner-1',
    cleaner_name: '清洁A',
    cleaning_submission_ready: false,
    key_handover: {
      state: 'completed',
      source_task_id: 'ct-1',
      completed_at: '2026-10-20T02:32:15.623Z',
      workflow_finalization_pending: true,
      missing_requirements: ['cleaning_consumables', 'cleaning_property_photo'],
    },
  } as any)

  for (const roles of [['admin'], ['customer_service'], ['offline_manager'], ['cleaner'], ['cleaning_inspector']]) {
    expect(getTaskStatusMeta(task, roles, 'viewer-1')).toEqual({ text: '已挂钥匙', tone: 'success' })
  }
  expect(getKeyHandoverPendingNotice(task)).toBe('资料待补：补品记录、房源照片')
})

test('self-complete label ignores a related phase handover until the exact source is completed', () => {
  const relatedOnly = makeTask({
    task_kind: 'cleaning',
    status: 'to_hang_keys',
    inspection_mode: 'self_complete',
    cleaner_id: 'cleaner-1',
    cleaner_name: '清洁A',
    source_key_handover_completed: false,
    key_handover: {
      state: 'completed',
      source_task_id: 'related-checkin',
      completed_at: '2026-10-22T01:00:00.000Z',
      workflow_finalization_pending: false,
      missing_requirements: [],
    },
  } as any)
  expect(getTaskStatusMeta(relatedOnly, ['cleaner'])).toEqual({ text: '待挂钥匙', tone: 'pending' })
  expect(getKeyHandoverPendingNotice(relatedOnly, { activeRole: 'cleaner' })).toBeNull()

  const exactSourceDone = { ...relatedOnly, source_key_handover_completed: true }
  expect(getTaskStatusMeta(exactSourceDone as any, ['cleaner'])).toEqual({ text: '已挂钥匙', tone: 'success' })
})

test('pending handover notice only shows responsibilities for the active role', () => {
  const task = makeTask({
    status: 'in_progress',
    key_handover: {
      state: 'completed',
      source_task_id: 'ct-1',
      completed_at: '2026-10-20T02:32:15.623Z',
      workflow_finalization_pending: true,
      missing_requirements: ['cleaning_consumables', 'cleaning_property_photo', 'inspection_photos'],
    },
  } as any)

  expect(getKeyHandoverPendingNotice(task, { activeRole: 'cleaner' })).toBe('资料待补：补品记录、房源照片')
  expect(getKeyHandoverPendingNotice(task, { activeRole: 'cleaning_inspector' })).toBe('资料待补：检查照片')
  expect(getKeyHandoverPendingNotice(task, { activeRole: 'admin', managerView: true })).toBe('资料待补：补品记录、房源照片、检查照片')
})

test('cleaner does not see an inspection-only pending notice', () => {
  const task = makeTask({
    key_handover: {
      state: 'completed',
      source_task_id: 'ct-1',
      completed_at: '2026-10-20T02:32:15.623Z',
      workflow_finalization_pending: true,
      missing_requirements: ['inspection_photos'],
    },
  } as any)
  expect(getKeyHandoverPendingNotice(task, { activeRole: 'cleaner' })).toBeNull()
})

test('cancelled or tombstoned tasks cannot be promoted by a retained key handover field', () => {
  const keyHandover = {
    state: 'completed',
    source_task_id: 'ct-1',
    completed_at: '2026-10-20T02:32:15.623Z',
    workflow_finalization_pending: true,
    missing_requirements: ['cleaning_consumables'],
  }
  const cancelled = makeTask({ status: 'cancelled', key_handover: keyHandover } as any)
  const tombstoned = makeTask({ status: 'in_progress', key_handover: keyHandover, lifecycle_state: 'tombstone' } as any)

  expect(getTaskStatusMeta(cancelled, ['admin'])).toEqual({ text: '已取消', tone: 'neutral' })
  expect(getKeyHandoverPendingNotice(cancelled)).toBeNull()
  expect(getTaskStatusMeta(tombstoned, ['admin'])).toEqual({ text: '进行中', tone: 'normal' })
  expect(getKeyHandoverPendingNotice(tombstoned)).toBeNull()
})

test('explicit null key handover blocks legacy raw keys_hung from manufacturing a missing Root fact', () => {
  const task = makeTask({
    task_kind: 'inspection',
    status: 'keys_hung',
    inspection_status: 'keys_hung',
    inspector_id: 'inspector-1',
    key_handover: null,
  } as any)

  expect(getTaskStatusMeta(task, ['admin'])).toEqual({ text: '已分配', tone: 'normal' })
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
  expect(meta).toEqual({ text: '清洁已完成', tone: 'success' })
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

test('work-record lifecycle never replaces a more specific business status', () => {
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
  expect(getTaskStatusMeta({ ...base, work_record_state: 'completed' }, ['admin'], 'manager-1')).toEqual({ text: '待审核', tone: 'pending' })
  expect(getTaskStatusMeta({ ...base, work_record_state: 'cancelled' }, ['customer_service'], 'cs-1')).toEqual({ text: '已取消', tone: 'neutral' })
  expect(getTaskStatusMeta({ ...base, work_record_state: 'rescheduled', rescheduled_to_date: '2026-10-22' } as any, ['offline_manager'], 'manager-2')).toEqual({ text: '延期至10-22', tone: 'neutral' })
  expect(getTaskStatusMeta({ ...base, work_record_state: 'reassigned' }, ['cleaner'], 'former-executor')).toEqual({ text: '已改派', tone: 'neutral' })
})

test.each([
  ['admin', 'manager-1'],
  ['customer_service', 'cs-1'],
  ['offline_manager', 'manager-2'],
  ['cleaning_inspector', 'inspector-1'],
])('completed keys-hung work records preserve the business status for %s', (role, viewerUserId) => {
  const base = makeTask({
    status: 'keys_hung',
    work_record_visible: true,
    work_record_read_only: true,
    work_record_state: 'completed',
    work_record_date: '2026-10-20',
    original_scheduled_date: '2026-10-19',
  } as any)

  expect(getTaskStatusMeta(base, [role], viewerUserId)).toEqual({ text: '已挂钥匙', tone: 'success' })
  expect(getTaskStatusMeta({ ...base, status: 'done', inspection_status: 'keys_hung' } as any, [role], viewerUserId)).toEqual({ text: '已挂钥匙', tone: 'success' })
})

test('cleaner completion label distinguishes cleaning from the later inspection phase', () => {
  const task = makeTask({
    task_kind: 'cleaning',
    status: 'done',
    cleaner_id: 'cleaner-1',
    cleaner_name: '清洁A',
    inspection_mode: 'deferred',
    inspection_status: 'assigned',
    work_record_visible: true,
    work_record_read_only: true,
    work_record_state: 'completed',
    work_record_date: '2026-10-20',
  } as any)

  expect(getTaskStatusMeta(task, ['cleaner'], 'cleaner-1')).toEqual({ text: '清洁已完成', tone: 'success' })
  expect(getTaskStatusMeta(task, ['admin'], 'manager-1')).toEqual({ text: '待检查', tone: 'pending' })
  expect(getTaskStatusMeta(task, ['admin', 'cleaner'], 'manager-1')).toEqual({ text: '待检查', tone: 'pending' })
  expect(getTaskStatusMeta(task, ['admin', 'cleaner'], 'manager-1', { managerView: true })).toEqual({ text: '待检查', tone: 'pending' })
})

test('restock-pending cleaning keeps phase-specific labels without ending the whole task', () => {
  const task = makeTask({
    task_kind: 'cleaning',
    status: 'restock_pending',
    cleaner_id: 'cleaner-1',
    cleaner_name: '清洁A',
    inspection_mode: 'deferred',
    inspection_status: 'assigned',
  } as any)

  expect(getTaskStatusMeta(task, ['cleaner'], 'cleaner-1')).toEqual({ text: '清洁已完成', tone: 'success' })
  expect(getTaskStatusMeta(task, ['admin'], 'manager-1')).toEqual({ text: '待补品', tone: 'pending' })
  expect(getTaskStatusMeta(task, ['cleaning_inspector'], 'inspector-1')).toEqual({ text: '待补品', tone: 'pending' })
})

test('completed record state remains a fallback for an unknown source status', () => {
  const task = makeTask({
    source_type: 'manual_work_task',
    task_kind: 'offline',
    status: 'archived_unknown',
    work_record_visible: true,
    work_record_read_only: true,
    work_record_state: 'completed',
    work_record_date: '2026-10-20',
  } as any)

  expect(getTaskStatusMeta(task, ['offline_manager'], 'manager-1')).toEqual({ text: '已完成', tone: 'success' })
})
