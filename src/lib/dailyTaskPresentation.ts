import type { WorkTask } from './api'
import { isDailyTaskExecutionVisible, type DailyTaskExecutionVisibilityOptions } from './dailyTaskExecutionVisibility'

export type DailyTaskSection = 'active' | 'overdue' | 'history' | 'cancelled'

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

function isReadOnlyWorkRecord(task: WorkTask) {
  return task.work_record_visible === true && task.work_record_read_only === true
}

function normalizedValues(values: unknown) {
  return Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => String(value || '').trim())
      .filter(Boolean),
  )).sort()
}

function activeSourceIdentity(task: WorkTask) {
  const activeIds = normalizedValues(task.active_source_ids)
  if (activeIds.length) return activeIds.join(',')
  const sourceIds = normalizedValues(task.source_ids)
  if (sourceIds.length) return sourceIds.join(',')
  return String(task.source_id || '').trim()
}

function taskRoleIdentity(task: WorkTask) {
  return normalizedStatus(task.execution_role) || normalizedStatus(task.task_kind)
}

function recordBaseId(task: WorkTask) {
  const id = String(task.id || '').trim()
  const marker = id.indexOf('::record:')
  return marker > 0 ? id.slice(0, marker) : id
}

function businessIdentityKeys(task: WorkTask) {
  const keys = new Set<string>()
  const id = recordBaseId(task)
  const mediaId = String(task.media_access_work_task_id || '').trim()
  const sources = activeSourceIdentity(task)
  if (id) keys.add(`id:${id}`)
  if (mediaId) keys.add(`media:${mediaId}`)
  if (sources) keys.add(`sources:${sources}`)
  return keys
}

function isSameBusinessTask(current: WorkTask, record: WorkTask) {
  if (normalizedStatus(current.source_type) !== normalizedStatus(record.source_type)) return false
  if (taskRoleIdentity(current) !== taskRoleIdentity(record)) return false

  const currentProperty = String(current.property_id || '').trim()
  const recordProperty = String(record.property_id || '').trim()
  if (currentProperty && recordProperty && currentProperty !== recordProperty) return false

  const currentKeys = businessIdentityKeys(current)
  return Array.from(businessIdentityKeys(record)).some((key) => currentKeys.has(key))
}

/**
 * A deleted source row may briefly remain in a hydrated cache. Treat only
 * explicit deletion/tombstone markers as hidden. Cancellation is also kept
 * out of the mobile task list by `reconcileDailyTaskDisplay`; database and
 * audit retention remain a server concern.
 */
export function isDailyTaskTombstone(task: WorkTask) {
  const raw = task as WorkTask & {
    deleted?: boolean
    is_deleted?: boolean
    tombstone?: boolean
    deleted_at?: string | null
    lifecycle_state?: string | null
  }
  if (raw.deleted === true || raw.is_deleted === true || raw.tombstone === true) return true
  if (String(raw.deleted_at || '').trim()) return true
  return [raw.lifecycle_state, raw.status, raw.work_record_state]
    .map(normalizedStatus)
    .some((state) => state === 'deleted' || state === 'removed' || state === 'tombstone')
}

/**
 * Current manager projections may only be folded when cards share the same
 * strong source or media identity. Property, order and `daily_stats_key` are
 * deliberately excluded: one room can have multiple legitimate tasks.
 */
export function dailyTaskCurrentIdentityKey(task: WorkTask) {
  const source = normalizedStatus(task.source_type)
  const sourceIds = activeSourceIdentity(task)
  if (source && sourceIds) return `sources:${source}:${sourceIds}`
  const mediaId = String(task.media_access_work_task_id || '').trim()
  return source && mediaId ? `media:${source}:${mediaId}` : ''
}

/**
 * Reconcile only a live projection with its immutable terminal record. The
 * terminal record wins because it is the dated work history. Separate change
 * events and distinct tasks at the same property intentionally pass through.
 */
export function reconcileDailyTaskDisplay<T extends WorkTask>(tasks: T[]) {
  const visible = (Array.isArray(tasks) ? tasks : []).filter((task) => (
    !isDailyTaskTombstone(task) && !isDailyTaskCancelled(task)
  ))
  const terminalRecords = visible.filter((task) => (
    isReadOnlyWorkRecord(task)
    && isDailyTaskCompleted(task)
  ))
  if (!terminalRecords.length) return visible
  return visible.filter((task) => (
    isReadOnlyWorkRecord(task)
    || !terminalRecords.some((record) => isSameBusinessTask(task, record))
  ))
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
  if (isDailyTaskCancelled(task)) return 'cancelled'
  if (isDailyTaskCompleted(task) || isDailyTaskChangedRecord(task)) {
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
  const sections: DailyTaskSections<T> = { active: [], overdue: [], history: [], cancelled: [] }
  for (const task of Array.isArray(tasks) ? tasks : []) {
    if (isDailyTaskCancelled(task)) continue
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
  return dailyTaskCurrentIdentityKey(task)
    || recordId
    || [task.source_type, task.source_id, task.scheduled_date].map(normalizedStatus).join(':')
}

/**
 * Status totals use the same date/permission-scoped task set as the screen.
 * Current projections dedupe only with an exact source/media identity;
 * `daily_stats_key` is a date/property aggregation key and is not unique.
 * Immutable records dedupe only exact record IDs so separate change events
 * remain visible.
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
    if (isDailyTaskCancelled(task)) continue
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
  }
  return counts
}

/** Count only the server-authorized execution set and dedupe merged turnover
 * cards with exact source/media identity. Root's `daily_stats_key` is not used
 * because separate tasks at one property/date can legitimately share it.
 * Search text never participates in this calculation. */
export function dailyTaskGroupCounts(
  tasks: WorkTask[],
  options: DailyTaskExecutionVisibilityOptions = {},
) {
  const turnover = new Set<string>()
  const offline = new Set<string>()
  for (const task of Array.isArray(tasks) ? tasks : []) {
    if (isDailyTaskCancelled(task)) continue
    if (!isDailyTaskExecutionVisible(task, options)) continue
    const group = task.daily_stats_group
    const key = dailyTaskCurrentIdentityKey(task) || `id:${String(task.id || '').trim()}`
    if (!key) continue
    if (group === 'turnover') turnover.add(key)
    if (group === 'offline') offline.add(key)
  }
  return { turnover: turnover.size, offline: offline.size }
}
