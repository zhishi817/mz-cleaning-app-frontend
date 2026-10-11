export type DailyTaskExecutionCandidate = {
  execution_list_visible?: boolean
  source_type?: unknown
  task_kind?: unknown
  task_type?: unknown
  status?: unknown
  source_workflow_status?: unknown
  maintenance_workflow?: { status?: unknown } | null
  scheduled_date?: unknown
  task_date?: unknown
  date?: unknown
  assignee_id?: unknown
  cleaner_id?: unknown
  inspector_id?: unknown
}

const REVIEW_ONLY_STATUSES = new Set(['pending_review', 'review_pending', 'awaiting_review'])
const TERMINAL_STATUSES = new Set(['cancelled', 'canceled', 'closed'])
const PROPERTY_FOLLOWUP_SOURCES = new Set([
  'property_maintenance',
  'property_deep_cleaning',
  'property_daily_necessities',
])
const REVIEW_COMPLETION_ALIAS_SOURCES = new Set([
  'property_maintenance',
  'external_maintenance_orders',
  'property_deep_cleaning',
])
const MAINTENANCE_REVIEW_ALIASES = new Set(['done', 'completed', 'ready'])
const TURNOVER_TYPES = new Set(['turnover', 'checkout', 'checkin', 'checkout_clean', 'checkin_clean'])

function normalized(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function hasValue(value: unknown) {
  return Boolean(String(value ?? '').trim())
}

function scheduledDate(task: DailyTaskExecutionCandidate) {
  const value = Object.prototype.hasOwnProperty.call(task, 'scheduled_date')
    ? task.scheduled_date
    : (task.task_date || task.date)
  return normalized(value).slice(0, 10)
}

function isTurnoverTask(task: DailyTaskExecutionCandidate) {
  if (normalized(task.source_type) !== 'cleaning_tasks') return false
  return TURNOVER_TYPES.has(normalized(task.task_type)) || TURNOVER_TYPES.has(normalized(task.task_kind))
}

function hasExecutor(task: DailyTaskExecutionCandidate) {
  const source = normalized(task.source_type)
  const kind = normalized(task.task_kind)
  if (source !== 'cleaning_tasks') return hasValue(task.assignee_id)
  if (kind === 'inspection') return hasValue(task.inspector_id) || hasValue(task.assignee_id)
  if (kind === 'cleaning') return hasValue(task.cleaner_id) || hasValue(task.assignee_id)
  return hasValue(task.assignee_id) || hasValue(task.cleaner_id) || hasValue(task.inspector_id)
}

export function isDailyTaskExecutionVisible(task: DailyTaskExecutionCandidate) {
  if (task.execution_list_visible === false) return false

  const source = normalized(task.source_type)
  const workflowStatus = normalized(task.source_workflow_status || task.maintenance_workflow?.status || task.status)
  if (REVIEW_ONLY_STATUSES.has(workflowStatus) || TERMINAL_STATUSES.has(workflowStatus)) return false
  if (REVIEW_COMPLETION_ALIAS_SOURCES.has(source) && MAINTENANCE_REVIEW_ALIASES.has(workflowStatus)) return false
  if (PROPERTY_FOLLOWUP_SOURCES.has(source) && workflowStatus === 'pending_assignment') return false
  if (task.execution_list_visible === true) {
    if (Object.prototype.hasOwnProperty.call(task, 'scheduled_date') && !scheduledDate(task)) return false
    const hasExecutorProjection = ['assignee_id', 'cleaner_id', 'inspector_id']
      .some((field) => Object.prototype.hasOwnProperty.call(task, field))
    if (source && hasExecutorProjection && !isTurnoverTask(task) && !hasExecutor(task)) return false
    return true
  }
  if (!scheduledDate(task)) return false
  if (!isTurnoverTask(task) && !hasExecutor(task)) return false
  return true
}
