import { isDailyTaskExecutionVisible } from './dailyTaskExecutionVisibility'
import {
  dailyTaskCurrentIdentityKey,
  dailyTaskGroupCounts,
  dailyTaskPhaseHistoryLines,
  dailyTaskStatusCounts,
  partitionDailyTasks,
  reconcileDailyTaskDisplay,
} from './dailyTaskPresentation'

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
    const active = { ...base, id: 'active', source_id: 'active-source', scheduled_date: '2026-10-19', status: 'assigned' }
    const overdue = { ...base, id: 'overdue', source_id: 'overdue-source', scheduled_date: '2026-08-27', inspection_mode: 'deferred', inspection_due_date: '2026-08-29', status: 'restock_pending' }
    const completed = { ...base, id: 'completed', source_id: 'completed-source', scheduled_date: '2026-10-19', status: 'done' }
    const cancelled = { ...base, id: 'cancelled', source_id: 'cancelled-source', scheduled_date: '2026-10-19', status: 'cancelled' }

    expect(partitionDailyTasks([active, overdue, completed, cancelled], '2026-10-19')).toEqual({
      active: [active],
      overdue: [overdue],
      handover: [],
      history: [completed],
      cancelled: [],
    })
    expect(dailyTaskStatusCounts([active, overdue, completed, cancelled], '2026-10-19')).toEqual({
      active: 1,
      overdue: 1,
      completed: 1,
      cancelled: 0,
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

    expect(partitionDailyTasks([record], '2026-10-19')).toEqual({ active: [], overdue: [], handover: [], history: [record], cancelled: [] })
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
      handover: [],
      history: [reassigned, rescheduled],
      cancelled: [],
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
    const cleaner = { ...base, id: 'cleaner', business_identity: 'turnover:order-out:order-in', scheduled_date: '2026-10-19', daily_stats_key: 'turnover:2026-10-19:p1', status: 'done' }
    const inspector = { ...base, id: 'inspector', business_identity: 'turnover:order-out:order-in', task_kind: 'inspection', scheduled_date: '2026-10-19', daily_stats_key: 'turnover:2026-10-19:p1', status: 'assigned' }
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
      handover: [],
      history: [],
      cancelled: [],
    })
    expect(dailyTaskStatusCounts([pendingInspection, pendingRestock], '2026-10-19')).toEqual({
      active: 2,
      overdue: 0,
      completed: 0,
      cancelled: 0,
      changed: 0,
    })
  })

  it('places raw keys_hung in the same handover stage without claiming overall completion', () => {
    const keysHung = {
      ...base,
      id: 'merged-keys-hung',
      task_kind: 'cleaning',
      status: 'keys_hung',
      cleaning_status: 'cleaned',
      inspection_status: 'keys_hung',
      inspection_mode: 'deferred',
    }

    expect(partitionDailyTasks([keysHung], '2026-10-19')).toEqual({ active: [], overdue: [], handover: [keysHung], history: [], cancelled: [] })
    expect(dailyTaskStatusCounts([keysHung], '2026-10-19')).toEqual({
      active: 1,
      overdue: 0,
      completed: 0,
      cancelled: 0,
      changed: 0,
    })
  })

  it('fails closed when Root explicitly returns no evidence-backed handover fact', () => {
    const invalidated = {
      ...base,
      id: 'reopened-keys-hung',
      task_kind: 'inspection',
      status: 'keys_hung',
      inspection_status: 'keys_hung',
      key_handover: null,
    }

    expect(partitionDailyTasks([invalidated], '2026-10-19')).toEqual({ active: [], overdue: [invalidated], handover: [], history: [], cancelled: [] })
    expect(dailyTaskStatusCounts([invalidated], '2026-10-19')).toEqual({
      active: 0,
      overdue: 1,
      completed: 0,
      cancelled: 0,
      changed: 0,
    })
  })

  it('keeps one immutable terminal record instead of a duplicate live projection', () => {
    const current = {
      ...base,
      id: 'cleaning_tasks_cleaner_turnover:2026-10-19:p1:worker-1',
      task_kind: 'cleaning',
      execution_role: 'cleaning',
      source_ids: ['checkout-1', 'checkin-1'],
      active_source_ids: ['checkout-1', 'checkin-1'],
      order_id_checkout: 'order-out-1',
      order_id_checkin: 'order-in-1',
      scheduled_date: '2026-10-19',
      status: 'assigned',
      execution_list_visible: true,
      daily_stats_group: 'turnover' as const,
      daily_stats_key: 'turnover:2026-10-19:p1',
    }
    const record = {
      ...current,
      id: `${current.id}::record:completed:2026-10-19`,
      status: 'completed',
      execution_list_visible: false,
      work_record_visible: true,
      work_record_read_only: true,
      work_record_state: 'completed',
      work_record_date: '2026-10-19',
      counts_as_active_task: false,
    }

    const reconciled = reconcileDailyTaskDisplay([current, record])
    expect(reconciled).toEqual([record])
    expect(dailyTaskGroupCounts(reconciled)).toEqual({ turnover: 0, offline: 0 })
    expect(dailyTaskStatusCounts(reconciled, '2026-10-19')).toEqual({
      active: 0,
      overdue: 0,
      completed: 1,
      cancelled: 0,
      changed: 0,
    })
  })

  it('does not use property or a shared order to fold separate tasks such as 831606', () => {
    const first = {
      ...base,
      id: '831606-cleaning-a',
      source_id: 'cleaning-source-a-831606',
      source_ids: ['cleaning-source-a-831606'],
      order_id_checkout: 'shared-order-831606',
      property_id: 'property-831606',
      title: '831606',
      daily_stats_group: 'turnover' as const,
      daily_stats_key: 'turnover:2026-10-19:property-831606',
      execution_list_visible: true,
    }
    const second = {
      ...base,
      id: '831606-cleaning-b::record:completed:2026-10-19',
      source_id: 'cleaning-source-b-831606',
      source_ids: ['cleaning-source-b-831606'],
      order_id_checkout: 'shared-order-831606',
      property_id: 'property-831606',
      title: '831606',
      status: 'completed',
      work_record_visible: true,
      work_record_read_only: true,
      work_record_state: 'completed',
      work_record_date: '2026-10-19',
      daily_stats_group: 'turnover' as const,
      daily_stats_key: 'turnover:2026-10-19:property-831606',
    }

    expect(dailyTaskCurrentIdentityKey(first)).not.toBe(dailyTaskCurrentIdentityKey(second))
    expect(reconcileDailyTaskDisplay([first, second])).toEqual([first, second])
  })

  it('counts separate active tasks even when Root gives them the same property/day stats key', () => {
    const first = {
      ...base,
      id: '831606-active-a',
      source_id: '831606-source-a',
      source_ids: ['831606-source-a'],
      task_type: 'turnover',
      scheduled_date: '2026-10-19',
      execution_list_visible: true,
      daily_stats_group: 'turnover' as const,
      daily_stats_key: 'turnover:2026-10-19:property-831606',
    }
    const second = {
      ...first,
      id: '831606-active-b',
      source_id: '831606-source-b',
      source_ids: ['831606-source-b'],
    }

    expect(dailyTaskGroupCounts([first, second])).toEqual({ turnover: 2, offline: 0 })
    expect(dailyTaskStatusCounts([first, second], '2026-10-19')).toEqual({
      active: 2,
      overdue: 0,
      completed: 0,
      cancelled: 0,
      changed: 0,
    })
  })

  it('keeps an original-day task when a genuinely later work record has a different display date', () => {
    const current = {
      ...base,
      id: 'turnover-cross-day',
      source_id: 'cross-day-source',
      source_ids: ['cross-day-source'],
      scheduled_date: '2026-10-19',
      status: 'assigned',
    }
    const record = {
      ...current,
      id: 'turnover-cross-day::record:completed:2026-10-20',
      status: 'completed',
      work_record_visible: true,
      work_record_read_only: true,
      work_record_state: 'completed',
      work_record_date: '2026-10-20',
      original_scheduled_date: '2026-10-19',
    }

    const reconciled = reconcileDailyTaskDisplay([current, record])
    expect(reconciled).toEqual([current, record])
    expect(dailyTaskStatusCounts(reconciled, '2026-10-20')).toEqual({
      active: 0,
      overdue: 1,
      completed: 1,
      cancelled: 0,
      changed: 0,
    })
  })

  it('keeps changed and completed records while hiding tombstones and cancellations', () => {
    const active = { ...base, id: 'active', source_id: 'active-source', scheduled_date: '2026-10-19', status: 'assigned' }
    const changed = {
      ...base,
      id: 'changed',
      source_id: 'changed-source',
      work_record_visible: true,
      work_record_read_only: true,
      work_record_state: 'reassigned',
      work_record_date: '2026-10-19',
    }
    const completed = { ...base, id: 'completed', source_id: 'completed-source', status: 'completed' }
    const cancelled = {
      ...base,
      id: 'cancelled-record',
      source_id: 'cancelled-source',
      status: 'cancelled',
      work_record_visible: true,
      work_record_read_only: true,
      work_record_state: 'cancelled',
      work_record_date: '2026-10-19',
    }
    const tombstone = { ...base, id: 'deleted-task', deleted_at: '2026-10-19T12:00:00Z' }

    const reconciled = reconcileDailyTaskDisplay([cancelled, tombstone, active, changed, completed])
    expect(reconciled).toEqual([active, changed, completed])
    expect(partitionDailyTasks(reconciled, '2026-10-19')).toEqual({
      active: [active],
      overdue: [],
      handover: [],
      history: [changed, completed],
      cancelled: [],
    })
  })

  it('places a completed key-handover stage after unfinished and overdue work without calling the whole workflow complete', () => {
    const active = { ...base, id: 'active-stage', source_id: 'active-stage', status: 'assigned', scheduled_date: '2026-10-19' }
    const overdue = { ...base, id: 'overdue-stage', source_id: 'overdue-stage', status: 'assigned', scheduled_date: '2026-10-18' }
    const handedOver = {
      ...base,
      id: 'handover-stage',
      source_id: 'handover-stage',
      status: 'restock_pending',
      key_handover: {
        state: 'completed',
        source_task_id: 'handover-stage',
        completed_at: '2026-10-19T10:00:00.000Z',
        workflow_finalization_pending: true,
        missing_requirements: ['cleaning_consumables'],
      },
    }

    expect(partitionDailyTasks([handedOver, overdue, active], '2026-10-19')).toEqual({
      active: [active],
      overdue: [overdue],
      handover: [handedOver],
      history: [],
      cancelled: [],
    })
    expect(dailyTaskStatusCounts([handedOver, overdue, active], '2026-10-19')).toEqual({
      active: 2,
      overdue: 1,
      completed: 0,
      cancelled: 0,
      changed: 0,
    })
  })

  it('uses Root business identity for one canonical turnover while keeping unrelated same-room tasks separate', () => {
    const checkout = {
      ...base,
      id: 'checkout-card',
      source_id: 'checkout-source',
      business_identity: 'turnover:checkout-order:checkin-order',
      task_type: 'turnover',
      execution_list_visible: true,
      daily_stats_group: 'turnover' as const,
    }
    const checkin = {
      ...checkout,
      id: 'checkin-card',
      source_id: 'checkin-source',
      task_kind: 'inspection',
    }
    const independent = {
      ...checkout,
      id: 'independent-card',
      source_id: 'independent-source',
      business_identity: 'cleaning_task:independent-source',
      daily_stats_key: 'turnover:2026-10-04:property-1',
    }

    expect(dailyTaskCurrentIdentityKey(checkout)).toBe('business:turnover:checkout-order:checkin-order')
    expect(dailyTaskCurrentIdentityKey(checkin)).toBe(dailyTaskCurrentIdentityKey(checkout))
    expect(dailyTaskCurrentIdentityKey(independent)).not.toBe(dailyTaskCurrentIdentityKey(checkout))
    expect(dailyTaskGroupCounts([checkout, checkin, independent])).toEqual({ turnover: 2, offline: 0 })
    expect(dailyTaskStatusCounts([checkout, checkin, independent], '2026-10-04')).toEqual({
      active: 2,
      overdue: 0,
      completed: 0,
      cancelled: 0,
      changed: 0,
    })
  })

  it('never treats an unordered source collection as a business identity fallback', () => {
    const first = {
      ...base,
      id: 'source-set-a',
      source_id: 'source-a',
      source_ids: ['checkout-source', 'checkin-source'],
    }
    const second = {
      ...first,
      id: 'source-set-b',
      source_id: 'source-b',
      source_ids: ['checkin-source', 'checkout-source'],
    }

    expect(dailyTaskCurrentIdentityKey(first)).not.toBe(dailyTaskCurrentIdentityKey(second))
  })

  it('reconciles live and immutable cards by authoritative business identity across role projections', () => {
    const current = {
      ...base,
      id: 'canonical-current',
      source_id: 'checkout-source',
      task_kind: 'cleaning',
      execution_role: 'cleaning',
      business_identity: 'turnover:checkout-order:checkin-order',
      scheduled_date: '2026-10-19',
      status: 'assigned',
    }
    const record = {
      ...base,
      id: 'canonical-record::record:completed:2026-10-20',
      source_id: 'checkin-source',
      task_kind: 'inspection',
      execution_role: 'inspection',
      business_identity: 'turnover:checkout-order:checkin-order',
      scheduled_date: '2026-10-19',
      status: 'completed',
      work_record_visible: true,
      work_record_read_only: true,
      work_record_state: 'completed',
      work_record_date: '2026-10-19',
    }

    expect(reconcileDailyTaskDisplay([current, record])).toEqual([record])
  })

  it('renders only the canonical phase trajectory supplied by Root', () => {
    const task = {
      ...base,
      phase_history: [
        {
          source_id: 'checkout-source',
          task_type: 'checkout_clean',
          role: 'cleaner' as const,
          status: 'cleaned',
          scheduled_date: '2026-10-19',
          work_record_state: null,
          occurred_at: null,
          actor_user_id: null,
        },
        {
          source_id: 'checkin-source',
          task_type: 'checkin_clean',
          role: 'inspector' as const,
          status: 'keys_hung',
          scheduled_date: '2026-10-19',
          work_record_state: 'completed',
          occurred_at: '2026-10-19T12:00:00Z',
          actor_user_id: 'inspector-1',
        },
        {
          source_id: 'offline-source',
          task_type: 'offline',
          role: 'executor' as const,
          status: 'completed',
          scheduled_date: '2026-10-19',
          work_record_state: 'completed',
          occurred_at: '2026-10-19T13:00:00Z',
          actor_user_id: 'executor-1',
        },
      ],
    }

    expect(dailyTaskPhaseHistoryLines(task)).toEqual([
      '清洁 · 退房 · 清洁已完成 · 2026-10-19',
      '检查 · 入住 · 已挂钥匙 · 2026-10-19',
      '执行 · offline · 已完成记录 · 2026-10-19',
    ])
    expect(dailyTaskPhaseHistoryLines({ ...base, property_id: 'same-room' })).toEqual([])
  })
})
