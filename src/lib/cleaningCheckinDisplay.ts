import type { WorkTask } from './api'

export function hasActualCheckinTask(task: Partial<WorkTask> | null | undefined): boolean {
  if (!task) return false
  if (typeof task.has_checkin_task === 'boolean') return task.has_checkin_task
  const taskType = String(task.task_type || '').trim().toLowerCase()
  if (taskType === 'checkin_clean' || taskType === 'turnover') return true
  return (Array.isArray(task.phase_history) ? task.phase_history : [])
    .some((phase) => String(phase?.task_type || '').trim().toLowerCase() === 'checkin_clean')
}

export function cleaningSummaryWithCheckinAuthority(params: {
  checkoutTime: string | null
  checkinTime: string | null
  hasCheckinTask: boolean
}) {
  const checkout = String(params.checkoutTime || '').trim()
  const checkin = String(params.checkinTime || '').trim()
  if (checkout && checkin && params.hasCheckinTask) return `${checkout}退房 ${checkin}入住`
  if (checkout) return `${checkout}退房`
  if (checkin && params.hasCheckinTask) return `${checkin}入住`
  return null
}

export function checkinTimeDisplayPatch(task: Partial<WorkTask>, checkinTime: string | null) {
  const hasCheckinTask = hasActualCheckinTask(task)
  return hasCheckinTask
    ? { has_checkin_task: true, checkin_time_note: null, end_time: checkinTime }
    : { has_checkin_task: false, checkin_time_note: checkinTime, end_time: null }
}

export function checkinTimeNoteLabel(task: Partial<WorkTask> | null | undefined) {
  const note = String(task?.checkin_time_note || '').trim()
  return note ? `入住时间备注：${note}（未创建入住任务）` : null
}
