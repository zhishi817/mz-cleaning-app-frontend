import { isEarlyCheckinTime, isLateCheckinTime, isLateCheckoutTime } from './taskTime'

export type TurnoverDisplay = {
  checkout_time?: string | null
  checkin_time?: string | null
  is_late_checkout?: boolean
  is_early_checkin?: boolean
  is_late_checkin?: boolean
  guest_request_checkout?: string | null
  guest_request_checkin?: string | null
  guest_request_summary?: string | null
  old_code?: string | null
  new_code?: string | null
  active_source_ids?: string[]
  superseded_source_ids?: string[]
  all_related_source_ids?: string[]
  conflicts?: any[]
}

function cleanText(value: any) {
  return String(value ?? '').trim()
}

export function uniqueTextList(values: any[]) {
  return Array.from(new Set((values || []).map((value) => cleanText(value)).filter(Boolean)))
}

export function turnoverDisplayOf(task: any): TurnoverDisplay | null {
  const value = task?.turnover_display
  return value && typeof value === 'object' ? value as TurnoverDisplay : null
}

export function activeSourceIdsFromTask(task: any) {
  const display = turnoverDisplayOf(task)
  const active = uniqueTextList([
    ...(Array.isArray(display?.active_source_ids) ? display.active_source_ids : []),
    ...(Array.isArray(task?.active_source_ids) ? task.active_source_ids : []),
  ])
  if (active.length) return active
  return uniqueTextList([
    ...(Array.isArray(task?.source_ids) ? task.source_ids : []),
    task?.source_id,
  ])
}

export function allRelatedSourceIdsFromTask(task: any) {
  const display = turnoverDisplayOf(task)
  return uniqueTextList([
    ...(Array.isArray(display?.all_related_source_ids) ? display.all_related_source_ids : []),
    ...(Array.isArray(task?.all_related_source_ids) ? task.all_related_source_ids : []),
    ...(Array.isArray(display?.superseded_source_ids) ? display.superseded_source_ids : []),
    ...(Array.isArray(task?.superseded_source_ids) ? task.superseded_source_ids : []),
    ...activeSourceIdsFromTask(task),
  ])
}

export function cleaningExecutionTaskIdsFromTask(task: any) {
  const active = activeSourceIdsFromTask(task)
  if (active.length) return active
  return uniqueTextList(Array.isArray(task?.cleaning_task_ids) ? task.cleaning_task_ids : [])
}

export function inspectionExecutionTaskIdsFromTask(task: any) {
  const active = activeSourceIdsFromTask(task)
  if (active.length) return active
  return uniqueTextList(Array.isArray(task?.inspection_task_ids) ? task.inspection_task_ids : [])
}

export function executionTaskIdsForRole(task: any, roleKind?: any) {
  const kind = cleanText(roleKind || task?.task_kind).toLowerCase()
  if (kind === 'inspection') return inspectionExecutionTaskIdsFromTask(task)
  if (kind === 'cleaning') return cleaningExecutionTaskIdsFromTask(task)
  return activeSourceIdsFromTask(task)
}

export function checkoutTimeForDisplay(task: any) {
  const display = turnoverDisplayOf(task)
  return cleanText(display?.checkout_time) || cleanText(task?.start_time || task?.checkout_time)
}

export function checkinTimeForDisplay(task: any) {
  const display = turnoverDisplayOf(task)
  return cleanText(display?.checkin_time) || cleanText(task?.end_time || task?.checkin_time)
}

export function guestRequestForDisplay(task: any) {
  const display = turnoverDisplayOf(task)
  return cleanText(display?.guest_request_summary) || cleanText(task?.guest_special_request || task?.note)
}

export function isLateCheckoutDisplay(task: any, checkoutTime?: string) {
  const display = turnoverDisplayOf(task)
  if (typeof display?.is_late_checkout === 'boolean') return display.is_late_checkout
  const value = cleanText(checkoutTime) || checkoutTimeForDisplay(task)
  return !!value && isLateCheckoutTime(value)
}

export function isEarlyCheckinDisplay(task: any, checkinTime?: string) {
  const display = turnoverDisplayOf(task)
  if (typeof display?.is_early_checkin === 'boolean') return display.is_early_checkin
  const value = cleanText(checkinTime) || checkinTimeForDisplay(task)
  return !!value && isEarlyCheckinTime(value)
}

export function isLateCheckinDisplay(task: any, checkinTime?: string) {
  const display = turnoverDisplayOf(task)
  if (typeof display?.is_late_checkin === 'boolean') return display.is_late_checkin
  const value = cleanText(checkinTime) || checkinTimeForDisplay(task)
  return !!value && isLateCheckinTime(value)
}
