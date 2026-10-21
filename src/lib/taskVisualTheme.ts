import { effectiveInspectionMode, isCheckinSiteExecutionTask } from './cleaningInspection'
import type { WorkTaskItem } from './workTasksStore'

export type TaskTone = 'normal' | 'special' | 'pending' | 'danger' | 'success' | 'info' | 'neutral'

export const TASK_TONE_COLORS: Record<TaskTone, { bg: string; border: string; text: string; dot: string }> = {
  normal: { bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8', dot: '#3B82F6' },
  special: { bg: '#F5F3FF', border: '#DDD6FE', text: '#6D28D9', dot: '#8B5CF6' },
  pending: { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', dot: '#F59E0B' },
  danger: { bg: '#FEF2F2', border: '#FECACA', text: '#B91C1C', dot: '#EF4444' },
  success: { bg: '#ECFDF5', border: '#A7F3D0', text: '#047857', dot: '#10B981' },
  info: { bg: '#ECFEFF', border: '#A5F3FC', text: '#0E7490', dot: '#06B6D4' },
  neutral: { bg: '#F3F4F6', border: '#D1D5DB', text: '#6B7280', dot: '#9CA3AF' },
}

export function getTaskKindTone(kind: string): TaskTone {
  const s = String(kind || '').trim().toLowerCase()
  if (s === 'maintenance' || s === 'deep_cleaning' || s === 'offline') return 'special'
  return 'normal'
}

export function getInspectionModeTone(mode: string | null | undefined): TaskTone {
  const s = String(mode || '').trim().toLowerCase()
  if (s === 'checked_done') return 'success'
  if (s === 'self_complete') return 'special'
  if (s === 'deferred' || s === 'pending_decision') return 'pending'
  return 'normal'
}

export function getInspectionScopeTone(isPasswordOnlyInspection: boolean): TaskTone {
  return isPasswordOnlyInspection ? 'pending' : 'success'
}

function isCleanerRole(roleNames: string[]) {
  const rs = (roleNames || []).map((x) => String(x || '').trim()).filter(Boolean)
  return rs.includes('cleaner') || rs.includes('cleaner_inspector')
}

function hasManagementRole(roleNames: string[]) {
  const rs = (roleNames || []).map((x) => String(x || '').trim()).filter(Boolean)
  return rs.includes('admin') || rs.includes('offline_manager') || rs.includes('customer_service') || rs.includes('inventory_manager')
}

function isDoneLikeStatus(status0: string) {
  const s = String(status0 || '').trim().toLowerCase()
  return s === 'done' || s === 'completed' || s === 'ready' || s === 'keys_hung' || s === 'cleaned' || s === 'restock_pending' || s === 'restocked' || s === 'inspected'
}

function isPendingInspectionStatus(status0: string) {
  const s = String(status0 || '').trim().toLowerCase()
  return s === 'todo' || s === 'pending' || s === 'unassigned' || s === 'assigned'
}

export function isTaskWorkflowProgressStatus(status0: string) {
  const s = String(status0 || '').trim().toLowerCase()
  return s === 'in_progress' || s === 'to_inspect' || s === 'to_hang_keys' || s === 'to_complete'
}

export function getEffectiveTaskStatus(task: Partial<WorkTaskItem> | null | undefined, status0?: string) {
  const status = String(status0 ?? task?.status ?? '').trim().toLowerCase()
  const source = String(task?.source_type || '').trim().toLowerCase()
  const kind = String(task?.task_kind || '').trim().toLowerCase()
  const isCheckinSiteExecution = isCheckinSiteExecutionTask(task as any)
  if (source === 'cleaning_tasks' && kind === 'cleaning' && !isCheckinSiteExecution && (task as any)?.cleaning_submission_ready === false) {
    const cleaningStatus = String((task as any)?.cleaning_status || '').trim().toLowerCase()
    if (status === 'cancelled' || status === 'canceled') return status
    if (cleaningStatus && !isDoneLikeStatus(cleaningStatus)) return cleaningStatus
    if (status === 'in_progress' || status === 'cleaning' || String((task as any)?.key_photo_url || '').trim()) {
      return 'in_progress'
    }
    const hasCleaner = !!(
      String((task as any)?.cleaner_id || '').trim()
      || String((task as any)?.cleaner_name || '').trim()
      || String((task as any)?.assignee_id || '').trim()
    )
    return hasCleaner ? 'assigned' : 'todo'
  }
  if (source === 'cleaning_tasks' && kind === 'inspection') {
    const cleaningStatus = String((task as any)?.cleaning_status || '').trim().toLowerCase()
    const inspectionStatus = String((task as any)?.inspection_status || '').trim().toLowerCase()
    if (cleaningStatus === 'in_progress' || inspectionStatus === 'in_progress') return 'in_progress'
    if (isDoneLikeStatus(cleaningStatus) && isPendingInspectionStatus(inspectionStatus)) return 'to_inspect'
  }
  return status
}

function baseStatusMeta(status: string) {
  const s = String(status || '').trim().toLowerCase()
  if (s === 'done' || s === 'completed' || s === 'ready' || s === 'closed') return { text: '已完成', tone: 'success' as const }
  if (s === 'to_inspect') return { text: '待检查', tone: 'pending' as const }
  if (s === 'to_hang_keys') return { text: '待挂钥匙', tone: 'pending' as const }
  if (s === 'to_complete') return { text: '待完成', tone: 'pending' as const }
  if (s === 'keys_hung') return { text: '已挂钥匙', tone: 'success' as const }
  if (s === 'in_progress') return { text: '进行中', tone: 'normal' as const }
  if (s === 'assigned') return { text: '已分配', tone: 'normal' as const }
  if (s === 'todo' || s === 'pending' || s === 'unassigned') return { text: '未分配', tone: 'pending' as const }
  if (s === 'cancelled' || s === 'canceled') return { text: '已取消', tone: 'neutral' as const }
  return { text: '待处理', tone: 'pending' as const }
}

function isMaintenanceSource(source: string) {
  return source === 'property_maintenance' || source === 'external_maintenance_orders'
}

/**
 * `pending_review` is the server-side lifecycle state after an executor submits
 * a maintenance result. The assignee has completed their work, while anyone
 * else reviewing the task still needs the explicit review-pending signal.
 */
function isMaintenancePendingReview(task: WorkTaskItem, status: string, source: string) {
  if (!isMaintenanceSource(source)) return false
  const workflowStatus = String(task.maintenance_workflow?.status || '').trim().toLowerCase()
  return workflowStatus === 'pending_review' || status === 'pending_review'
}

export function hasCompletedKeyHandover(task: Partial<WorkTaskItem> | null | undefined) {
  const status = String(task?.status || '').trim().toLowerCase()
  const workRecordState = String(task?.work_record_state || '').trim().toLowerCase()
  const lifecycleState = String((task as any)?.lifecycle_state || '').trim().toLowerCase()
  if (status === 'cancelled' || status === 'canceled' || ['cancelled', 'rescheduled', 'reassigned'].includes(workRecordState)) return false
  if (['deleted', 'removed', 'tombstone', 'superseded'].includes(lifecycleState)) return false
  return String((task as any)?.key_handover?.state || '').trim().toLowerCase() === 'completed'
}

/**
 * New Root payloads include `key_handover`, using `null` when Root has no
 * evidence-backed handover fact for this exact source task. In that case a
 * legacy raw status is not allowed to manufacture one on the client.
 * Only payloads that omit the property entirely may use the legacy raw-status
 * compatibility path.
 */
export function hasAuthoritativeKeyHandoverProjection(task: Partial<WorkTaskItem> | null | undefined) {
  return !!task && Object.prototype.hasOwnProperty.call(task, 'key_handover')
}

const KEY_HANDOVER_REQUIREMENT_LABELS: Record<string, string> = {
  cleaning_consumables: '补品记录',
  cleaning_property_photo: '房源照片',
  inspection_photos: '检查照片',
}

export function getKeyHandoverPendingNotice(task: Partial<WorkTaskItem> | null | undefined) {
  if (!hasCompletedKeyHandover(task)) return null
  const keyHandover = (task as any)?.key_handover
  if (keyHandover?.workflow_finalization_pending !== true) return null
  const labels = Array.from(new Set(
    (Array.isArray(keyHandover?.missing_requirements) ? keyHandover.missing_requirements : [])
      .map((requirement: unknown) => KEY_HANDOVER_REQUIREMENT_LABELS[String(requirement || '').trim().toLowerCase()] || '')
      .filter(Boolean),
  ))
  return labels.length ? `资料待补：${labels.join('、')}` : '资料待补'
}

export function getTaskStatusMeta(
  task: WorkTaskItem,
  roleNames: string[],
  viewerUserId?: string | null,
  context: { managerView?: boolean } = {},
) {
  let isCompletedWorkRecord = false
  if (task.work_record_visible === true) {
    const state = String(task.work_record_state || '').trim().toLowerCase()
    if (state === 'pending_review') return { text: '待审核', tone: 'pending' as const }
    isCompletedWorkRecord = state === 'completed'
    if (state === 'cancelled') return { text: '已取消', tone: 'neutral' as const }
    if (state === 'rescheduled') {
      const toDate = String(task.rescheduled_to_date || '').trim().slice(0, 10)
      return { text: toDate ? `延期至${toDate.slice(5)}` : '已延期', tone: 'neutral' as const }
    }
    if (state === 'reassigned') return { text: '已改派', tone: 'neutral' as const }
  }
  if (hasCompletedKeyHandover(task)) return { text: '已挂钥匙', tone: 'success' as const }
  const authoritativeHandoverWasInvalidated = hasAuthoritativeKeyHandoverProjection(task)
    && String((task as any)?.key_handover?.state || '').trim().toLowerCase() !== 'completed'
  const effectiveStatus = getEffectiveTaskStatus(task)
  // A present-but-null projection is an explicit Root decision. Do not let a
  // raw `keys_hung` value manufacture a fact Root did not return.
  const s = authoritativeHandoverWasInvalidated && effectiveStatus === 'keys_hung'
    ? 'assigned'
    : effectiveStatus
  const meta = baseStatusMeta(s)
  const source = String(task.source_type || '').trim().toLowerCase()
  const kind = String(task.task_kind || '').trim().toLowerCase()
  const isCheckinSiteExecution = isCheckinSiteExecutionTask(task as any)

  if (isMaintenancePendingReview(task, s, source)) {
    const assigneeId = String(task.assignee_id || '').trim()
    const viewerId = String(viewerUserId || '').trim()
    if (assigneeId && viewerId && assigneeId === viewerId) return { text: '已完成', tone: 'success' as const }
    return { text: '待审核', tone: 'pending' as const }
  }

  if (source === 'cleaning_tasks' && isCheckinSiteExecution && (s === 'todo' || s === 'pending' || s === 'unassigned')) {
    const hasExecutor = !!(
      String((task as any).executor_name || '').trim()
      || String((task as any).assignee_name || '').trim()
      || String((task as any).assignee_id || '').trim()
      || String((task as any).inspector_name || '').trim()
      || String((task as any).inspector_id || '').trim()
      || String((task as any).cleaner_name || '').trim()
      || String((task as any).cleaner_id || '').trim()
    )
    if (hasExecutor) return { text: '已分配', tone: 'normal' as const }
  }

  if (source === 'cleaning_tasks' && kind === 'inspection') {
    const checkedOutAt = String((task as any).checked_out_at || '').trim()
    const inspectionStatus0 = String((task as any).inspection_status || '').trim().toLowerCase()
    const inspectionStatus = authoritativeHandoverWasInvalidated && inspectionStatus0 === 'keys_hung'
      ? ''
      : inspectionStatus0
    const hasInspector = !!(
      String((task as any).inspector_id || '').trim()
      || String((task as any).inspector_name || '').trim()
      || String((task as any).assignee_id || '').trim()
    )
    if (s === 'keys_hung' || inspectionStatus === 'keys_hung') return { text: '已挂钥匙', tone: 'success' as const }
    if (s === 'cleaned' || s === 'restock_pending' || s === 'restocked') return { text: '待检查', tone: 'pending' as const }
    if (checkedOutAt && !isTaskWorkflowProgressStatus(s) && !isDoneLikeStatus(s) && s !== 'cancelled' && s !== 'canceled') return { text: '已退房', tone: 'special' as const }
    if ((s === 'todo' || s === 'pending' || s === 'unassigned') && hasInspector) return { text: '已分配', tone: 'normal' as const }
    return meta
  }

  if (source === 'cleaning_tasks' && kind === 'cleaning' && !isCheckinSiteExecution) {
    const isCleanerView = context.managerView !== true && !hasManagementRole(roleNames) && isCleanerRole(roleNames)
    const cleanerName = String((task as any).cleaner_name || '').trim()
    const inspectorName = String((task as any).inspector_name || '').trim()
    const hasExecutor = !!(cleanerName || inspectorName || String((task as any).cleaner_id || '').trim() || String((task as any).assignee_id || '').trim() || String((task as any).inspector_id || '').trim())
    const inspectionStatus0 = String((task as any).inspection_status || '').trim().toLowerCase()
    const inspectionStatus = authoritativeHandoverWasInvalidated && inspectionStatus0 === 'keys_hung'
      ? ''
      : inspectionStatus0
    const hasInspection = Array.isArray((task as any).inspection_task_ids) ? (task as any).inspection_task_ids.length > 0 : false
    const inspectionMode = effectiveInspectionMode(task as any)

    if (isDoneLikeStatus(s)) {
      if (isCleanerView) return { text: '清洁已完成', tone: 'success' as const }
      if (s === 'restock_pending') return { text: '待补品', tone: 'pending' as const }
      if (inspectionMode === 'same_day' || inspectionMode === 'deferred' || hasInspection || inspectionStatus) {
        if (inspectionStatus === 'keys_hung' || inspectionStatus === 'done' || inspectionStatus === 'completed') {
          return { text: '已挂钥匙', tone: 'success' as const }
        }
        return { text: '待检查', tone: 'pending' as const }
      }
      return { text: '已完成', tone: 'success' as const }
    }

    const checkedOutAt = String((task as any).checked_out_at || '').trim()
    if (s === 'in_progress' || s === 'cleaning') return { text: '进行中', tone: 'normal' as const }
    if (!hasExecutor && !checkedOutAt) return { text: '未分配', tone: 'pending' as const }
    if (s !== 'cancelled' && s !== 'canceled') {
      if (checkedOutAt) return { text: '已退房', tone: 'special' as const }
      return { text: '已分配', tone: 'normal' as const }
    }
  }

  // `work_record_state` marks the record lifecycle, but must not erase a more
  // specific business status above. It remains the fallback only when the
  // source did not provide a status that this client understands.
  if (isCompletedWorkRecord && meta.text === '待处理') return { text: '已完成', tone: 'success' as const }
  return meta
}
