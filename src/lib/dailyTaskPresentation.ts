import type { WorkTask } from './api'
import { isDailyTaskExecutionVisible, type DailyTaskExecutionVisibilityOptions } from './dailyTaskExecutionVisibility'

export type DailyTaskSection = 'active' | 'overdue' | 'history'

export type DailyTaskSections<T extends WorkTask = WorkTask> = Record<DailyTaskSection, T[]>

export type DailyTaskStatusCounts = {
  active: number
  overdue: number
  completed: number
  cancelled: number
  changed: number
}

function normalizedStatus(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

function validDate(value: unknown) {
  const date = String(value || '').trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : ''
}

function workRecordState(task: WorkTask) {
  return normalizedStatus(task.work_record_state)
}

function taskStatuses(task: WorkTask) {
  return [
    normalizedStatus(task.status),
    normalizedStatus(task.source_workflow_status),
    normalizedStatus(task.maintenance_workflow?.status),
    normalizedStatus(task.cleaning_status),
    normalizedStatus(task.inspection_status),
  ].filter(Boolean)
}

const KNOWN_NON_TERMINAL_STATUSES = new Set([
  'todo',
  'pending',
  'unassigned',
  'assigned',
  'in_progress',
  'cleaning',
  'pending_review',
  'to_inspect',
  'to_hang_keys',
  'to_complete',
  'cleaned',
  'restock_pending',
  'restocked',
  'inspected',
])

const VERIFIED_TERMINAL_STATUSES = new Set(['done', 'completed', 'ready', 'keys_hung', 'closed'])
const VERIFIED_INSPECTION_TERMINAL_STATUSES = new Set(['done', 'completed', 'ready', 'keys_hung'])

export function isDailyTaskCancelled(task: WorkTask) {
  if (workRecordState(task) === 'cancelled') return true
  return taskStatuses(task).some((status) => status === 'cancelled' || status === 'canceled')
}

/**
 * Only verified terminal states belong here. Cleaning phases such as
 * `cleaned`, `restock_pending`, `restocked`, and `inspected` remain active
 * because another business phase may still be required.
 */
export function isDailyTaskCompleted(task: WorkTask) {
  const status = normalizedStatus(task.status)
  const sourceWorkflowStatus = normalizedStatus(task.source_workflow_status)
  const maintenanceStatus = normalizedStatus(task.maintenance_workflow?.status)
  const cleaningStatus = normalizedStatus(task.cleaning_status)
  const inspectionStatus = normalizedStatus(task.inspection_status)

  // Top-level restock/review states are current obligations, not historical
  // upstream snapshots, so they remain open even if another phase is done.
  if (status === 'restock_pending' || status === 'pending_review') return false
  if (sourceWorkflowStatus && KNOWN_NON_TERMINAL_STATUSES.has(sourceWorkflowStatus)) return false
  if (maintenanceStatus && KNOWN_NON_TERMINAL_STATUSES.has(maintenanceStatus)) return false

  // Inspection is downstream of cleaning. Once it reaches a verified terminal
  // state it wins over retained upstream values such as `cleaned`.
  if (inspectionStatus && VERIFIED_INSPECTION_TERMINAL_STATUSES.has(inspectionStatus)) return true
  if (inspectionStatus && KNOWN_NON_TERMINAL_STATUSES.has(inspectionStatus)) return false

  const source = normalizedStatus(task.source_type)
  const kind = normalizedStatus(task.task_kind)
  const inspectionMode = normalizedStatus(task.inspection_mode)
  const hasInspectionProjection = Array.isArray(task.inspection_task_ids) && task.inspection_task_ids.length > 0
  const hasOpenInspectionPlan = source === 'cleaning_tasks'
    && kind === 'cleaning'
    && (
      inspectionMode === 'pending_decision'
      || inspectionMode === 'same_day'
      || inspectionMode === 'deferred'
      || hasInspectionProjection
    )
  if (hasOpenInspectionPlan && (status === 'done' || status === 'completed' || cleaningStatus === 'done' || cleaningStatus === 'completed')) {
    return false
  }

  if (VERIFIED_TERMINAL_STATUSES.has(status)) return true
  if (VERIFIED_TERMINAL_STATUSES.has(sourceWorkflowStatus) || VERIFIED_TERMINAL_STATUSES.has(maintenanceStatus)) return true
  if (status && KNOWN_NON_TERMINAL_STATUSES.has(status)) return false
  if (cleaningStatus && VERIFIED_TERMINAL_STATUSES.has(cleaningStatus)) return true
  if (cleaningStatus && KNOWN_NON_TERMINAL_STATUSES.has(cleaningStatus)) return false
  if (workRecordState(task) !== 'completed') return false
  // A completed record is only a fallback when the source has no understood
  // business phase. Known open phases remain active and keep their concrete
  // label instead of being counted as whole-task completion.
  return true
}

export function isDailyTaskChangedRecord(task: WorkTask) {
  const state = workRecordState(task)
  return state === 'rescheduled' || state === 'reassigned'
}

function overdueBasisDate(task: WorkTask) {
  const inspectionMode = normalizedStatus(task.inspection_mode)
  return (inspectionMode === 'deferred' ? validDate(task.inspection_due_date) : '')
    || validDate(task.scheduled_date)
    || validDate((task as any).date)
}

export function dailyTaskSection(task: WorkTask, selectedDate: string): DailyTaskSection {
  if (isDailyTaskCancelled(task) || isDailyTaskCompleted(task) || isDailyTaskChangedRecord(task)) {
    return 'history'
  }

  // Immutable records stay in the selected day's activity until their
  // business state becomes terminal. Their original plan date is context,
  // not a reason to reclassify the record as an overdue executable task.
  if (task.work_record_visible === true && task.work_record_read_only === true) return 'active'

  const selected = validDate(selectedDate)
  const due = overdueBasisDate(task)
  if (selected && due && due < selected) return 'overdue'
  return 'active'
}

export function partitionDailyTasks<T extends WorkTask>(tasks: T[], selectedDate: string): DailyTaskSections<T> {
  const sections: DailyTaskSections<T> = { active: [], overdue: [], history: [] }
  for (const task of Array.isArray(tasks) ? tasks : []) {
    sections[dailyTaskSection(task, selectedDate)].push(task)
  }
  return sections
}

function stableCountKey(task: WorkTask) {
  const recordId = String(task.id || '').trim()
  if (task.work_record_visible === true && task.work_record_read_only === true) {
    // Each immutable record is a separate business event. Using source_id or
    // daily_stats_key here would swallow successive reassign/reschedule events.
    return recordId || [task.source_type, task.source_id, task.work_record_date, task.work_record_state].map(normalizedStatus).join(':')
  }
  return String(task.daily_stats_key || '').trim()
    || recordId
    || [task.source_type, task.source_id, task.scheduled_date].map(normalizedStatus).join(':')
}

/**
 * Status totals use the same date/permission-scoped task set as the screen.
 * Current projections dedupe with Root's stable daily key; immutable records
 * dedupe only exact record IDs so separate change events remain visible.
 */
export function dailyTaskStatusCounts(tasks: WorkTask[], selectedDate: string): DailyTaskStatusCounts {
  const counts: DailyTaskStatusCounts = {
    active: 0,
    overdue: 0,
    completed: 0,
    cancelled: 0,
    changed: 0,
  }

  const groups = new Map<string, WorkTask[]>()
  for (const task of Array.isArray(tasks) ? tasks : []) {
    const key = stableCountKey(task)
    const group = groups.get(key) || []
    group.push(task)
    groups.set(key, group)
  }

  for (const group of groups.values()) {
    const current = group.filter((task) => (
      !isDailyTaskCancelled(task)
      && !isDailyTaskCompleted(task)
      && !isDailyTaskChangedRecord(task)
    ))
    if (current.length) {
      if (current.some((task) => dailyTaskSection(task, selectedDate) === 'overdue')) counts.overdue += 1
      else counts.active += 1
      continue
    }
    // Change records use their own immutable IDs, so this precedence retains
    // the event even if its source snapshot also carries a terminal status.
    if (group.some(isDailyTaskChangedRecord)) {
      counts.changed += 1
      continue
    }
    if (group.some(isDailyTaskCompleted)) {
      counts.completed += 1
      continue
    }
    if (group.some(isDailyTaskCancelled)) counts.cancelled += 1
  }
  return counts
}

/** Count only the server-authorized execution set and dedupe merged turnover
 * cards with the stable keys supplied by Root. Search text never participates
 * in this calculation. */
export function dailyTaskGroupCounts(
  tasks: WorkTask[],
  options: DailyTaskExecutionVisibilityOptions = {},
) {
  const turnover = new Set<string>()
  const offline = new Set<string>()
  for (const task of Array.isArray(tasks) ? tasks : []) {
    if (!isDailyTaskExecutionVisible(task, options)) continue
    const group = task.daily_stats_group
    const key = String(task.daily_stats_key || '').trim()
    if (!key) continue
    if (group === 'turnover') turnover.add(key)
    if (group === 'offline') offline.add(key)
  }
  return { turnover: turnover.size, offline: offline.size }
}
