import { isDailyTaskExecutionVisible } from './dailyTaskExecutionVisibility'
import { dailyTaskGroupCounts } from './dailyTaskPresentation'

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
})
