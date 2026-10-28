export type InspectionMode = 'pending_decision' | 'same_day' | 'deferred' | 'self_complete' | 'checked_done'
export type InspectionScope = 'inspect_and_hang' | 'password_only'
export type TaskExecutionSemantics =
  | 'cleaning_execution'
  | 'checkin_inspection'
  | 'inspection_execution'
  | 'key_or_password_action'
  | 'mixed_cleaning_inspection'
  | 'work_task'

const VALID_TASK_EXECUTION_SEMANTICS = new Set<TaskExecutionSemantics>([
  'cleaning_execution',
  'checkin_inspection',
  'inspection_execution',
  'key_or_password_action',
  'mixed_cleaning_inspection',
  'work_task',
])

export function normalizeTaskExecutionSemantics(value: any): TaskExecutionSemantics | null {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return null
  if (raw === 'key_handover_execution') return 'key_or_password_action'
  return VALID_TASK_EXECUTION_SEMANTICS.has(raw as TaskExecutionSemantics) ? (raw as TaskExecutionSemantics) : null
}

export function isStayoverTaskType(taskType: any) {
  return String(taskType || '').trim().toLowerCase() === 'stayover_clean'
}

export function normalizeInspectionMode(value: any): InspectionMode | null {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'pending_decision' || raw === 'same_day' || raw === 'deferred' || raw === 'self_complete' || raw === 'checked_done') return raw
  return null
}

export function isInspectionModeAllowedForTask(params: {
  task_type?: any
  inspection_scope?: any
  inspection_mode?: InspectionMode | null | undefined
}) {
  const mode = params.inspection_mode || 'pending_decision'
  const taskType = String(params.task_type || '').trim().toLowerCase()
  if (taskType !== 'checkin_clean') return true
  if (normalizeInspectionScope(params.inspection_scope) !== 'password_only') return true
  return mode !== 'self_complete' && mode !== 'checked_done'
}

export function effectiveInspectionMode(task: {
  task_type?: any
  inspection_mode?: any
  inspection_scope?: any
  inspector_id?: any
}): InspectionMode {
  const explicit = normalizeInspectionMode(task?.inspection_mode)
  if (explicit) {
    return isInspectionModeAllowedForTask({
      task_type: task?.task_type,
      inspection_scope: task?.inspection_scope,
      inspection_mode: explicit,
    })
      ? explicit
      : 'same_day'
  }
  const taskType = String(task?.task_type || '').trim().toLowerCase()
  if (taskType === 'stayover_clean') return 'self_complete'
  if (taskType === 'checkin_clean') return 'same_day'
  if (String(task?.inspector_id || '').trim()) return 'same_day'
  return 'pending_decision'
}

export function inspectionModeLabel(mode: InspectionMode, dueDate?: string | null) {
  if (mode === 'pending_decision') return '待确认检查安排'
  if (mode === 'same_day') return '同日检查'
  if (mode === 'checked_done') return '已检查'
  if (mode === 'self_complete') return '自完成'
  const due = String(dueDate || '').trim()
  return due ? `延期检查 ${due}` : '延期检查'
}

export function normalizeInspectionScope(value: any): InspectionScope {
  return String(value || '').trim().toLowerCase() === 'password_only' ? 'password_only' : 'inspect_and_hang'
}

export function inspectionScopeLabel(scope: any) {
  return normalizeInspectionScope(scope) === 'password_only' ? '仅改密码' : '检查后挂钥匙'
}

export function taskExecutionRole(task: {
  execution_role?: any
  execution_semantics?: any
  source_type?: any
  task_kind?: any
}) {
  const explicit = String(task?.execution_role || '').trim().toLowerCase()
  if (explicit === 'cleaning' || explicit === 'inspection' || explicit === 'execution' || explicit === 'mixed' || explicit === 'work') return explicit
  const semantics = normalizeTaskExecutionSemantics(task?.execution_semantics)
  if (semantics === 'cleaning_execution') return 'cleaning'
  if (semantics === 'key_or_password_action') return 'execution'
  if (semantics === 'checkin_inspection' || semantics === 'inspection_execution') return 'inspection'
  if (semantics === 'mixed_cleaning_inspection') return 'mixed'
  const sourceType = String(task?.source_type || '').trim().toLowerCase()
  const taskKind = String(task?.task_kind || '').trim().toLowerCase()
  if (sourceType !== 'cleaning_tasks') return 'work'
  if (taskKind === 'execution') return 'execution'
  if (taskKind === 'cleaning' || taskKind === 'inspection') return taskKind
  return 'mixed'
}

export function isCleaningExecutionTask(task: {
  execution_role?: any
  execution_semantics?: any
  source_type?: any
  task_kind?: any
}) {
  const role = taskExecutionRole(task)
  return role === 'cleaning' || role === 'mixed'
}

export function isInspectionExecutionTask(task: {
  execution_role?: any
  execution_semantics?: any
  source_type?: any
  task_kind?: any
}) {
  const role = taskExecutionRole(task)
  return role === 'inspection' || role === 'mixed'
}

export function isKeyHandoverExecutionTask(task: {
  execution_role?: any
  execution_semantics?: any
  source_type?: any
  task_kind?: any
}) {
  return taskExecutionRole(task) === 'execution'
}

export function isCheckinSiteExecutionTask(task: {
  execution_role?: any
  execution_semantics?: any
  source_type?: any
  task_kind?: any
  task_type?: any
  inspection_scope?: any
}) {
  const sourceType = String(task?.source_type || '').trim().toLowerCase()
  const taskType = String(task?.task_type || '').trim().toLowerCase()
  if (sourceType !== 'cleaning_tasks' || taskType !== 'checkin_clean') return false
  const semantics = normalizeTaskExecutionSemantics(task?.execution_semantics)
  // Explicit Root semantics outrank legacy `task_kind`. This prevents an
  // inspect-and-hang/check-password assignee from being presented as a cleaner
  // merely because an older projection still says `task_kind=cleaning`.
  if (semantics === 'key_or_password_action' || semantics === 'checkin_inspection' || semantics === 'inspection_execution') return true
  if (semantics === 'cleaning_execution' || semantics === 'mixed_cleaning_inspection') return false
  // A password-only check-in is a site action performed by the generic
  // assignee, never cleaning work. Older projections may still label it as
  // `task_kind=cleaning`; prefer the business semantics so those records do
  // not present the generic executor as a cleaner.
  if (normalizeInspectionScope(task?.inspection_scope) === 'password_only') return true
  const taskKind = String(task?.task_kind || '').trim().toLowerCase()
  if (taskKind === 'cleaning') return false
  if (taskKind === 'inspection' || taskKind === 'execution') return true
  const role = taskExecutionRole(task)
  return role === 'inspection' || role === 'execution'
}

export type TaskPersonnelPresentation = {
  mode: 'execution' | 'cleaning_inspection'
  executorName: string
  cleanerName: string
  inspectorName: string
}

/**
 * Keep personnel labels tied to authoritative roles. `assignee_*` is a generic
 * executor and may only populate the execution row; it never backfills the
 * cleaner row. Root's dedicated cleaner/inspector fields remain authoritative.
 */
export function taskPersonnelPresentation(task: {
  execution_role?: any
  execution_semantics?: any
  source_type?: any
  task_kind?: any
  task_type?: any
  inspection_scope?: any
  executor_id?: any
  executor_name?: any
  assignee_id?: any
  assignee_name?: any
  cleaner_id?: any
  cleaner_name?: any
  inspector_id?: any
  inspector_name?: any
}): TaskPersonnelPresentation {
  const executionMode = isKeyHandoverExecutionTask(task) || isCheckinSiteExecutionTask(task)
  const executorName = executionMode
    ? String(task?.executor_name || task?.assignee_name || task?.executor_id || task?.assignee_id || '').trim()
    : ''
  return {
    mode: executionMode ? 'execution' : 'cleaning_inspection',
    executorName,
    cleanerName: String(task?.cleaner_name || task?.cleaner_id || '').trim(),
    inspectorName: String(task?.inspector_name || task?.inspector_id || '').trim(),
  }
}

export function isPasswordOnlyInspectionTask(task: {
  execution_role?: any
  execution_semantics?: any
  source_type?: any
  task_kind?: any
  task_type?: any
  inspection_scope?: any
}) {
  return isCheckinSiteExecutionTask(task) && normalizeInspectionScope(task?.inspection_scope) === 'password_only'
}

export function shouldUseDeferredInspectionTitle(task: {
  source_type?: any
  task_kind?: any
  task_type?: any
  inspection_mode?: any
  inspector_id?: any
}) {
  const sourceType = String(task?.source_type || '').trim().toLowerCase()
  const taskKind = String(task?.task_kind || '').trim().toLowerCase()
  return sourceType === 'cleaning_tasks' && taskKind === 'inspection' && effectiveInspectionMode(task) === 'deferred'
}

export function unlinkedDeferredInspectionDisplayIdentity(task: {
  id?: any
  source_id?: any
  source_type?: any
  task_kind?: any
  task_type?: any
  inspection_mode?: any
  inspector_id?: any
  inspection_original_checkout_date?: any
}) {
  if (!shouldUseDeferredInspectionTitle(task)) return null
  if (String(task?.inspection_original_checkout_date || '').trim()) return null
  const sourceId = String(task?.source_id || task?.id || '').trim()
  return sourceId ? `deferred:${sourceId}` : null
}

export function cleaningTaskTitleSuffix(task: {
  source_type?: any
  task_kind?: any
  task_type?: any
  inspection_mode?: any
  inspector_id?: any
  start_time?: any
  end_time?: any
  checkout_time?: any
  checkin_time?: any
  deferred_inspection_merged?: any
  deferred_inspection_current_day_checkout?: any
}) {
  const checkoutTime = String(task?.start_time ?? task?.checkout_time ?? '').trim()
  const checkinTime = String(task?.end_time ?? task?.checkin_time ?? '').trim()
  const deferredInspectionMerged = task?.deferred_inspection_merged === true
  const authoritativeCurrentDayCheckout = task?.deferred_inspection_current_day_checkout

  // A reliable execution-day merge describes the work happening today, even
  // though the retained source arrangement is still `deferred`. Evaluate the
  // Root-owned display-day fact before the generic deferred-title fallback so
  // the historical checkout does not hide today's real check-in.
  if (deferredInspectionMerged && typeof authoritativeCurrentDayCheckout === 'boolean') {
    const hasCheckout = authoritativeCurrentDayCheckout
    const hasCheckin = !!checkinTime
    if (!hasCheckout && !hasCheckin) return '延期检查'
    return `${hasCheckout ? '退房' : ''}${hasCheckout && hasCheckin ? ' ' : ''}${hasCheckin ? '入住' : ''}`
  }

  if (shouldUseDeferredInspectionTitle(task)) return '延期检查'
  const hasCheckout = deferredInspectionMerged && typeof authoritativeCurrentDayCheckout === 'boolean'
    ? authoritativeCurrentDayCheckout
    : !!checkoutTime
  const hasCheckin = !!checkinTime
  if (deferredInspectionMerged && !hasCheckout && !hasCheckin) return '延期检查'
  if (!hasCheckout && !hasCheckin) return ''
  return `${hasCheckout ? '退房' : ''}${hasCheckout && hasCheckin ? ' ' : ''}${hasCheckin ? '入住' : ''}`
}

export function isSelfCompleteMode(task: { task_type?: any; inspection_mode?: any; inspector_id?: any }) {
  if (isStayoverTaskType(task?.task_type)) return true
  return effectiveInspectionMode(task) === 'self_complete'
}
