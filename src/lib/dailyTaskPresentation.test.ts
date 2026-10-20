import { isDailyTaskExecutionVisible } from './dailyTaskExecutionVisibility'
import { dailyTaskGroupCounts, dailyTaskStatusCounts, partitionDailyTasks } from './dailyTaskPresentation'

const base: any = {
  id: 'task-1',
  source_type: 'cleaning_tasks',
  source_id: 'source-1',
  property_id: 'property-1',
  title: 'P1',
  summary: null,
  scheduled_date: '2026-10-04',
  start_time: null,
  end_time: null,
  assignee_id: null,
  status: 'assigned',
  urgency: 'medium',
  property: null,
}

describe('dailyTaskPresentation', () => {
  it('keeps MZ-021 server-authoritative visibility and legacy fail-closed rules', () => {
    expect(isDailyTaskExecutionVisible({ ...base, task_type: 'turnover', execution_list_visible: true })).toBe(true)
    expect(isDailyTaskExecutionVisible({ ...base, source_type: 'property_maintenance', task_kind: 'maintenance', assignee_id: 'worker-1', status: 'done' })).toBe(false)
    expect(isDailyTaskExecutionVisible({ ...base, source_type: 'manual_work_task', task_kind: 'offline', assignee_id: null })).toBe(false)
  })

  it('uses server keys to keep counts independent from search and dedupe turnover roles', () => {
    expect(dailyTaskGroupCounts([
      { ...base, id: 'cleaner', task_type: 'turnover', execution_list_visible: true, daily_stats_group: 'turnover', daily_stats_key: 'turnover:2026-10-04:p1' },
      { ...base, id: 'inspector', task_type: 'turnover', execution_list_visible: true, daily_stats_group: 'turnover', daily_stats_key: 'turnover:2026-10-04:p1' },
      { ...base, id: 'offline', source_type: 'manual_work_task', assignee_id: 'worker-1', execution_list_visible: true, daily_stats_group: 'offline', daily_stats_key: 'offline:2026-10-04:w1' },
      { ...base, id: 'review', source_type: 'property_maintenance', assignee_id: 'worker-1', status: 'pending_review', execution_list_visible: false, daily_stats_group: null, daily_stats_key: null },
    ])).toEqual({ turnover: 1, offline: 1 })
  })

  it('counts the same unassigned ordinary offline card shown in manager all view', () => {
    const unassigned = {
      ...base,
      id: 'offline-unassigned',
      source_type: 'cleaning_offline_tasks',
      task_kind: 'offline',
      assignee_id: null,
      execution_list_visible: true,
      daily_stats_group: 'offline' as const,
      daily_stats_key: 'offline:2026-10-04:cleaning_offline_tasks:offline-unassigned',
    }
    expect(dailyTaskGroupCounts([unassigned], { includeManagerUnassignedOffline: true })).toEqual({ turnover: 0, offline: 1 })
    expect(dailyTaskGroupCounts([unassigned])).toEqual({ turnover: 0, offline: 0 })
  })

  it('partitions active, overdue, and terminal history without treating cleaning phases as complete', () => {
    const active = { ...base, id: 'active', scheduled_date: '2026-10-19', status: 'assigned' }
    const overdue = { ...base, id: 'overdue', scheduled_date: '2026-08-27', inspection_mode: 'deferred', inspection_due_date: '2026-08-29', status: 'restock_pending' }
    const completed = { ...base, id: 'completed', scheduled_date: '2026-10-19', status: 'done' }
    const cancelled = { ...base, id: 'cancelled', scheduled_date: '2026-10-19', status: 'cancelled' }

    expect(partitionDailyTasks([active, overdue, completed, cancelled], '2026-10-19')).toEqual({
      active: [active],
      overdue: [overdue],
      history: [completed, cancelled],
    })
    expect(dailyTaskStatusCounts([active, overdue, completed, cancelled], '2026-10-19')).toEqual({
      active: 1,
      overdue: 1,
      completed: 1,
      cancelled: 1,
      changed: 0,
    })
  })

  it('keeps a cross-day completed record in the selected record-day history', () => {
    const record = {
      ...base,
      id: 'record-completed',
      scheduled_date: '2026-10-18',
      original_scheduled_date: '2026-10-18',
      work_record_date: '2026-10-19',
      work_record_visible: true,
      work_record_read_only: true,
      work_record_state: 'completed',
      status: 'completed',
    }

    expect(partitionDailyTasks([record], '2026-10-19')).toEqual({ active: [], overdue: [], history: [record] })
  })

  it('keeps pending-review records active while terminal and change records stay in history', () => {
    const pendingReview = {
      ...base,
      id: 'record-review',
      work_record_visible: true,
      work_record_read_only: true,
      work_record_state: 'pending_review',
      work_record_date: '2026-10-19',
      original_scheduled_date: '2026-10-18',
      status: 'pending_review',
    }
    const reassigned = { ...pendingReview, id: 'record-reassigned', work_record_state: 'reassigned', status: 'assigned' }
    const rescheduled = { ...pendingReview, id: 'record-rescheduled', work_record_state: 'rescheduled', status: 'assigned' }

    expect(partitionDailyTasks([pendingReview, reassigned, rescheduled], '2026-10-19')).toEqual({
      active: [pendingReview],
      overdue: [],
      history: [reassigned, rescheduled],
    })
    expect(dailyTaskStatusCounts([pendingReview, reassigned, rescheduled], '2026-10-19')).toEqual({
      active: 1,
      overdue: 0,
      completed: 0,
      cancelled: 0,
      changed: 2,
    })
  })

  it('dedupes merged current projections but never swallows separate change records', () => {
    const cleaner = { ...base, id: 'cleaner', scheduled_date: '2026-10-19', daily_stats_key: 'turnover:2026-10-19:p1', status: 'done' }
    const inspector = { ...base, id: 'inspector', task_kind: 'inspection', scheduled_date: '2026-10-19', daily_stats_key: 'turnover:2026-10-19:p1', status: 'assigned' }
    const changedBase = {
      ...base,
      source_id: 'same-source',
      daily_stats_key: 'offline:2026-10-19:same-source',
      work_record_visible: true,
      work_record_read_only: true,
      work_record_date: '2026-10-19',
      status: 'assigned',
    }
    const reassigned = { ...changedBase, id: 'event-1', work_record_state: 'reassigned' }
    const rescheduled = { ...changedBase, id: 'event-2', work_record_state: 'rescheduled', status: 'done' }

    expect(dailyTaskStatusCounts([cleaner, inspector, reassigned, rescheduled], '2026-10-19')).toEqual({
      active: 1,
      overdue: 0,
      completed: 0,
      cancelled: 0,
      changed: 2,
    })
  })

  it('does not let a completed record marker override a known open business phase', () => {
    const pendingInspection = {
      ...base,
      id: 'record-pending-inspection',
      task_kind: 'cleaning',
      status: 'done',
      inspection_status: 'assigned',
      inspection_mode: 'deferred',
      work_record_visible: true,
      work_record_read_only: true,
      work_record_state: 'completed',
      work_record_date: '2026-10-19',
    }
    const pendingRestock = {
      ...pendingInspection,
      id: 'record-pending-restock',
      status: 'restock_pending',
      inspection_status: null,
    }

    expect(partitionDailyTasks([pendingInspection, pendingRestock], '2026-10-19')).toEqual({
      active: [pendingInspection, pendingRestock],
      overdue: [],
      history: [],
    })
    expect(dailyTaskStatusCounts([pendingInspection, pendingRestock], '2026-10-19')).toEqual({
      active: 2,
      overdue: 0,
      completed: 0,
      cancelled: 0,
      changed: 0,
    })
  })

  it('lets terminal downstream inspection override a retained upstream cleaning phase', () => {
    const keysHung = {
      ...base,
      id: 'merged-keys-hung',
      task_kind: 'cleaning',
      status: 'keys_hung',
      cleaning_status: 'cleaned',
      inspection_status: 'keys_hung',
      inspection_mode: 'deferred',
    }

    expect(partitionDailyTasks([keysHung], '2026-10-19')).toEqual({ active: [], overdue: [], history: [keysHung] })
    expect(dailyTaskStatusCounts([keysHung], '2026-10-19')).toEqual({
      active: 0,
      overdue: 0,
      completed: 1,
      cancelled: 0,
      changed: 0,
    })
  })
})
