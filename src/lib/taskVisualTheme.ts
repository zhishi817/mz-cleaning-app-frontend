import { effectiveInspectionMode } from './cleaningInspection'
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

function isDoneLikeStatus(status0: string) {
  const s = String(status0 || '').trim().toLowerCase()
  return s === 'done' || s === 'completed' || s === 'ready' || s === 'keys_hung' || s === 'cleaned' || s === 'restock_pending' || s === 'restocked' || s === 'inspected'
}

function baseStatusMeta(status: string) {
  const s = String(status || '').trim().toLowerCase()
  if (s === 'done' || s === 'completed') return { text: '已完成', tone: 'success' as const }
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

export function getTaskStatusMeta(task: WorkTaskItem, roleNames: string[]) {
  const s = String(task.status || '').trim().toLowerCase()
  const meta = baseStatusMeta(s)
  const source = String(task.source_type || '').trim().toLowerCase()
  const kind = String(task.task_kind || '').trim().toLowerCase()

  if (source === 'cleaning_tasks' && kind === 'inspection') {
    const hasInspector = !!(
      String((task as any).inspector_id || '').trim()
      || String((task as any).inspector_name || '').trim()
      || String((task as any).assignee_id || '').trim()
    )
    if (s === 'cleaned' || s === 'restock_pending' || s === 'restocked') return { text: '待检查', tone: 'pending' as const }
    if ((s === 'todo' || s === 'pending' || s === 'unassigned') && hasInspector) return { text: '已分配', tone: 'normal' as const }
    return meta
  }

  if (source === 'cleaning_tasks' && kind === 'cleaning') {
    const isCleanerView = isCleanerRole(roleNames)
    const cleanerName = String((task as any).cleaner_name || '').trim()
    const inspectorName = String((task as any).inspector_name || '').trim()
    const hasExecutor = !!(cleanerName || inspectorName || String((task as any).cleaner_id || '').trim() || String((task as any).assignee_id || '').trim() || String((task as any).inspector_id || '').trim())
    const inspectionStatus = String((task as any).inspection_status || '').trim().toLowerCase()
    const hasInspection = Array.isArray((task as any).inspection_task_ids) ? (task as any).inspection_task_ids.length > 0 : false
    const inspectionMode = effectiveInspectionMode(task as any)

    if (isDoneLikeStatus(s)) {
      if (isCleanerView) return { text: '已完成', tone: 'success' as const }
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

  return meta
}
