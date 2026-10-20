import { canLoadLiveSourceMediaForDailyTask, isDailyTaskExecutionVisible, isDailyTaskListVisible, isOrdinaryOfflineDailyTask } from './dailyTaskExecutionVisibility'

const scheduled = '2026-10-09'
const cases = [
  { id: 'maintenance-assigned', source_type: 'property_maintenance', status: 'assigned', source_workflow_status: 'assigned', scheduled_date: scheduled, assignee_id: 'staff-1' },
  { id: 'maintenance-progress', source_type: 'property_maintenance', status: 'in_progress', source_workflow_status: 'in_progress', scheduled_date: scheduled, assignee_id: 'staff-1' },
  { id: 'maintenance-review', source_type: 'property_maintenance', status: 'pending_review', source_workflow_status: 'pending_review', scheduled_date: scheduled, assignee_id: 'staff-1' },
  { id: 'maintenance-review-pending-alias', source_type: 'property_maintenance', status: 'review_pending', scheduled_date: scheduled, assignee_id: 'staff-1' },
  { id: 'maintenance-closed-mapped-done', source_type: 'property_maintenance', status: 'done', source_workflow_status: 'closed', scheduled_date: scheduled, assignee_id: 'staff-1' },
  { id: 'external-maintenance-assigned', source_type: 'external_maintenance_orders', status: 'assigned', scheduled_date: scheduled, assignee_id: 'staff-1' },
  { id: 'external-maintenance-unassigned', source_type: 'external_maintenance_orders', task_kind: 'maintenance', status: 'todo', scheduled_date: scheduled, assignee_id: null },
  { id: 'external-maintenance-unassigned-mislabeled', source_type: 'external_maintenance_orders', task_kind: 'offline', status: 'todo', scheduled_date: scheduled, assignee_id: null },
  { id: 'external-maintenance-closed-mapped-done', source_type: 'external_maintenance_orders', status: 'done', scheduled_date: scheduled, assignee_id: 'staff-1' },
  { id: 'deep-cleaning-review', source_type: 'property_deep_cleaning', status: 'pending_review', scheduled_date: scheduled, assignee_id: 'staff-2' },
  { id: 'deep-cleaning-awaiting-review-alias', source_type: 'property_deep_cleaning', status: 'awaiting_review', scheduled_date: scheduled, assignee_id: 'staff-2' },
  { id: 'deep-cleaning-completed-review-alias', source_type: 'property_deep_cleaning', status: 'done', scheduled_date: scheduled, assignee_id: 'staff-2' },
  { id: 'daily-necessities-unassigned', source_type: 'property_daily_necessities', status: 'todo', scheduled_date: scheduled, assignee_id: null },
  { id: 'daily-necessities-done', source_type: 'property_daily_necessities', status: 'done', scheduled_date: scheduled, assignee_id: 'staff-2' },
  { id: 'offline-done', source_type: 'cleaning_offline_tasks', task_kind: 'offline', status: 'done', scheduled_date: scheduled, assignee_id: 'staff-3' },
  { id: 'offline-ready', source_type: 'cleaning_offline_tasks', task_kind: 'offline', status: 'ready', scheduled_date: scheduled, assignee_id: 'staff-3' },
  { id: 'offline-assigned', source_type: 'cleaning_offline_tasks', task_kind: 'offline', status: 'assigned', scheduled_date: scheduled, assignee_id: 'staff-3' },
  { id: 'offline-progress', source_type: 'cleaning_offline_tasks', task_kind: 'offline', status: 'in_progress', scheduled_date: scheduled, assignee_id: 'staff-3' },
  { id: 'offline-unassigned', source_type: 'cleaning_offline_tasks', task_kind: 'offline', task_type: 'company', status: 'todo', scheduled_date: scheduled, assignee_id: null },
  { id: 'offline-cancelled', source_type: 'cleaning_offline_tasks', task_kind: 'offline', status: 'cancelled', scheduled_date: scheduled, assignee_id: 'staff-3' },
  { id: 'offline-canceled-alias', source_type: 'cleaning_offline_tasks', task_kind: 'offline', status: 'canceled', scheduled_date: scheduled, assignee_id: 'staff-3' },
  { id: 'offline-unscheduled', source_type: 'cleaning_offline_tasks', task_kind: 'offline', status: 'assigned', scheduled_date: null, task_date: scheduled, date: scheduled, assignee_id: 'staff-3' },
  { id: 'turnover-unassigned-ready', source_type: 'cleaning_tasks', task_type: 'turnover', task_kind: 'cleaning', status: 'ready', scheduled_date: scheduled, assignee_id: null },
  { id: 'checkin-unassigned', source_type: 'cleaning_tasks', task_type: 'checkin', task_kind: 'cleaning', status: 'assigned', scheduled_date: scheduled, assignee_id: null },
  { id: 'checkout-unassigned', source_type: 'cleaning_tasks', task_type: 'checkout', task_kind: 'cleaning', status: 'assigned', scheduled_date: scheduled, assignee_id: null },
  { id: 'stayover-unassigned', source_type: 'cleaning_tasks', task_type: 'stayover_clean', task_kind: 'cleaning', status: 'assigned', scheduled_date: scheduled, assignee_id: null },
]

const expectedVisible = [
  'maintenance-assigned',
  'maintenance-progress',
  'external-maintenance-assigned',
  'daily-necessities-done',
  'offline-done',
  'offline-ready',
  'offline-assigned',
  'offline-progress',
  'turnover-unassigned-ready',
  'checkin-unassigned',
  'checkout-unassigned',
]

describe('daily task execution visibility', () => {
  it.each(['admin', 'offline_manager', 'customer_service'])('keeps the same execution matrix for %s', () => {
    expect(cases.filter((task) => isDailyTaskExecutionVisible(task, { includeManagerUnassignedOffline: true })).map((task) => task.id)).toEqual([
      ...expectedVisible.slice(0, 8),
      'offline-unassigned',
      ...expectedVisible.slice(8),
    ])
  })

  it('keeps partner/self projection assignment-scoped and management categories assignment-first', () => {
    const unassignedOffline = cases.find((task) => task.id === 'offline-unassigned')!
    const unassignedNecessities = cases.find((task) => task.id === 'daily-necessities-unassigned')!
    expect(isOrdinaryOfflineDailyTask(unassignedOffline)).toBe(true)
    expect(isDailyTaskExecutionVisible(unassignedOffline)).toBe(false)
    expect(isDailyTaskExecutionVisible(unassignedNecessities, { includeManagerUnassignedOffline: true })).toBe(false)
    expect(isDailyTaskExecutionVisible(cases.find((task) => task.id === 'external-maintenance-unassigned')!, { includeManagerUnassignedOffline: true })).toBe(false)
    expect(isDailyTaskExecutionVisible(cases.find((task) => task.id === 'external-maintenance-unassigned-mislabeled')!, { includeManagerUnassignedOffline: true })).toBe(false)
  })

  it('keeps every ordinary offline assignment state across past, current and future selected dates', () => {
    const matrix = ['2026-10-08', '2026-10-09', '2026-10-10'].flatMap((date) => ([
      { source_type: 'cleaning_offline_tasks', task_kind: 'offline', status: 'todo', scheduled_date: date, assignee_id: null },
      { source_type: 'cleaning_offline_tasks', task_kind: 'offline', status: 'assigned', scheduled_date: date, assignee_id: 'staff-1' },
      { source_type: 'cleaning_offline_tasks', task_kind: 'offline', status: 'in_progress', scheduled_date: date, assignee_id: 'staff-1' },
      { source_type: 'cleaning_offline_tasks', task_kind: 'offline', status: 'done', scheduled_date: date, assignee_id: 'staff-1' },
    ]))
    expect(matrix.filter((task) => isDailyTaskExecutionVisible(task, { includeManagerUnassignedOffline: true }))).toHaveLength(12)
  })

  it('uses the server projection as authority and fails closed on explicit hidden items', () => {
    expect(isDailyTaskListVisible({
      execution_list_visible: false,
      work_record_visible: true,
      work_record_read_only: true,
      source_type: 'property_maintenance',
      status: 'pending_review',
      scheduled_date: '2026-10-19',
      assignee_id: 'flora',
    })).toBe(true)
    expect(isDailyTaskExecutionVisible({
      execution_list_visible: false,
      work_record_visible: true,
      work_record_read_only: true,
      source_type: 'property_maintenance',
      status: 'pending_review',
      scheduled_date: '2026-10-19',
      assignee_id: 'flora',
    })).toBe(false)
    expect(isDailyTaskListVisible({
      execution_list_visible: false,
      work_record_visible: true,
      source_type: 'property_maintenance',
      status: 'pending_review',
      scheduled_date: '2026-10-19',
      assignee_id: 'flora',
    })).toBe(false)
    expect(isDailyTaskExecutionVisible({
      execution_list_visible: false,
      source_type: 'cleaning_offline_tasks',
      status: 'assigned',
      scheduled_date: scheduled,
      assignee_id: 'staff-1',
    })).toBe(false)
    expect(isDailyTaskExecutionVisible({ execution_list_visible: true })).toBe(true)
    expect(isDailyTaskExecutionVisible({
      execution_list_visible: true,
      source_type: 'property_maintenance',
      status: 'pending_review',
      scheduled_date: scheduled,
      assignee_id: 'staff-1',
    })).toBe(false)
    expect(isDailyTaskExecutionVisible({
      execution_list_visible: true,
      source_type: 'cleaning_offline_tasks',
      status: 'assigned',
      scheduled_date: scheduled,
      assignee_id: null,
    })).toBe(false)
    expect(isDailyTaskExecutionVisible({
      execution_list_visible: true,
      source_type: 'cleaning_offline_tasks',
      task_kind: 'offline',
      status: 'assigned',
      scheduled_date: scheduled,
      assignee_id: null,
    }, { includeManagerUnassignedOffline: true })).toBe(true)
  })

  it('does not refetch current-assignee media for a former executor record', () => {
    expect(canLoadLiveSourceMediaForDailyTask({ work_record_read_only: true, work_record_state: 'reassigned' })).toBe(false)
    expect(canLoadLiveSourceMediaForDailyTask({ work_record_read_only: true, work_record_state: 'completed' })).toBe(true)
    expect(canLoadLiveSourceMediaForDailyTask({ work_record_read_only: false, work_record_state: 'reassigned' })).toBe(true)
  })
})
