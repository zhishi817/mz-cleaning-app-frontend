export type InspectionMode = 'pending_decision' | 'same_day' | 'self_complete' | 'deferred'

export function isStayoverTaskType(taskType: any) {
  return String(taskType || '').trim().toLowerCase() === 'stayover_clean'
}

export function normalizeInspectionMode(value: any): InspectionMode | null {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'pending_decision' || raw === 'same_day' || raw === 'self_complete' || raw === 'deferred') return raw
  return null
}

export function effectiveInspectionMode(task: {
  task_type?: any
  inspection_mode?: any
  inspector_id?: any
}): InspectionMode {
  const explicit = normalizeInspectionMode(task?.inspection_mode)
  if (explicit) return explicit
  const taskType = String(task?.task_type || '').trim().toLowerCase()
  if (taskType === 'stayover_clean') return 'self_complete'
  if (taskType === 'checkin_clean') return 'same_day'
  if (String(task?.inspector_id || '').trim()) return 'same_day'
  return 'pending_decision'
}

export function inspectionModeLabel(mode: InspectionMode, dueDate?: string | null) {
  if (mode === 'pending_decision') return '待确认检查安排'
  if (mode === 'same_day') return '同日检查'
  if (mode === 'self_complete') return '自完成'
  const due = String(dueDate || '').trim()
  return due ? `延后检查 ${due}` : '延后检查'
}

export function isSelfCompleteMode(task: { task_type?: any; inspection_mode?: any; inspector_id?: any }) {
  if (isStayoverTaskType(task?.task_type)) return true
  return effectiveInspectionMode(task) === 'self_complete'
}

