import type { WorkTaskAvailableAction } from './api'
import {
  effectiveInspectionMode,
  isKeyHandoverExecutionTask,
  isPasswordOnlyInspectionTask,
  isSelfCompleteMode,
  isStayoverTaskType,
} from './cleaningInspection'
import type { WorkTaskItem } from './workTasksStore'

function cleanText(value: any) {
  return String(value ?? '').trim()
}

function lower(value: any) {
  return cleanText(value).toLowerCase()
}

export function actionDisabledReasonText(reason: any) {
  const value = cleanText(reason)
  if (value === 'missing_base_permission') return '缺少基础权限'
  if (value === 'not_participant') return '你已不再是执行人'
  if (value === 'task_completed') return '任务已完成'
  if (value === 'pending_inspection_decision') return '待确认检查安排'
  if (value === 'already_recorded') return '已记录'
  return value
}

export type WorkTaskActionRoute =
  | { screen: 'TaskDetail'; params: { id: string; action?: 'upload_key' | 'complete' } }
  | { screen: 'SuppliesForm'; params: { taskId: string } }
  | { screen: 'InspectionPanel'; params: { taskId: string; sourceId?: string } }
  | { screen: 'InspectionComplete'; params: { taskId: string; sourceId?: string; skipInspectionPhotos?: boolean } }
  | { screen: 'CleaningSelfComplete'; params: { taskId: string } }
  | { screen: 'FeedbackForm'; params: { taskId: string; source?: 'inspection_panel_batch' } }

function isCleaningWorkSubmitted(status0: any) {
  const status = lower(status0)
  return ['cleaned', 'restock_pending', 'restocked', 'to_inspect', 'to_hang_keys', 'keys_hung', 'done', 'completed', 'ready'].includes(status)
}

function hasServerActions(task: WorkTaskItem | null | undefined) {
  return Array.isArray((task as any)?.available_actions)
}

function legacyAction(params: Omit<WorkTaskAvailableAction, 'enabled'> & { enabled?: boolean }) {
  return { enabled: params.enabled !== false, ...params } as WorkTaskAvailableAction
}

export function availableActionsForTask(task: WorkTaskItem | null | undefined, options?: { roleNames?: string[] }): WorkTaskAvailableAction[] {
  if (!task) return []
  if (hasServerActions(task)) return (((task as any).available_actions || []) as WorkTaskAvailableAction[]).filter(Boolean)

  const roleNames = options?.roleNames || []
  const isCleaningSource = task.source_type === 'cleaning_tasks'
  const taskKind = lower(task.task_kind)
  const taskType = lower((task as any).task_type)
  const isCleaningTask = isCleaningSource && taskKind === 'cleaning'
  const isInspectionTask = isCleaningSource && taskKind === 'inspection'
  const isKeyHandoverTask = isKeyHandoverExecutionTask(task as any)
  const isStayoverTask = isCleaningTask && isStayoverTaskType(taskType)
  const isCheckoutTask = taskType === 'checkout_clean' || !!cleanText((task as any).start_time)
  const inspectionMode = effectiveInspectionMode(task as any)
  const isPasswordOnlyInspection = isPasswordOnlyInspectionTask(task as any)
  const isSelfCompleteEligible = isCleaningTask && isSelfCompleteMode(task as any) && (isCheckoutTask || isStayoverTask)
  const isDirectCompleteEligible = isCleaningTask && (isSelfCompleteEligible || isStayoverTask)
  const isPendingInspectionDecision = isCleaningTask && !isStayoverTask && inspectionMode === 'pending_decision'
  const isCleaningSubmitted = isCleaningTask && isCleaningWorkSubmitted(task.status)
  const isCustomerService = roleNames.includes('customer_service')
  const isInspectorUser = roleNames.includes('cleaning_inspector') || roleNames.includes('cleaner_inspector')
  const actions: WorkTaskAvailableAction[] = []

  if (isKeyHandoverTask) {
    actions.push(legacyAction({ id: 'upload_access_video', label: '上传视频并完成', placement: 'primary', target: 'InspectionComplete', intent: 'site_action' }))
    actions.push(legacyAction({ id: 'report_issue', label: '房源问题反馈', placement: 'more', target: 'FeedbackForm', intent: 'issue' }))
    return actions
  }

  if (isInspectionTask && isInspectorUser) {
    if (!isPasswordOnlyInspection) {
      actions.push(legacyAction({ id: 'submit_inspection', label: '检查与补充', placement: 'primary', target: 'InspectionPanel', intent: 'inspection' }))
    }
    actions.push(legacyAction({ id: 'upload_access_video', label: isPasswordOnlyInspection ? '改密码并完成' : '标记已完成', placement: 'primary', target: 'InspectionComplete', intent: isPasswordOnlyInspection ? 'site_action' : 'inspection' }))
    actions.push(legacyAction({ id: 'report_issue', label: '房源问题反馈', placement: 'more', target: 'FeedbackForm', intent: 'issue' }))
    return actions
  }

  if (isCleaningTask) {
    if (isCustomerService) {
      if (isCheckoutTask) actions.push(legacyAction({ id: 'mark_guest_checkout', label: cleanText((task as any).checked_out_at) ? '取消已退房' : '标记已退房', placement: 'primary', target: 'TaskDetail', intent: 'manager' }))
      actions.push(legacyAction({ id: 'report_issue', label: '房源问题反馈', placement: 'more', target: 'FeedbackForm', intent: 'issue' }))
      return actions
    }
    if (!isStayoverTask) {
      actions.push(legacyAction({
        id: 'upload_key_photo',
        label: isCleaningSubmitted ? '钥匙记录' : '上传钥匙',
        placement: 'primary',
        target: 'TaskDetail',
        intent: 'cleaning',
        enabled: !isCleaningSubmitted,
      }))
    }
    actions.push(legacyAction({
      id: isDirectCompleteEligible ? 'complete_cleaning' : 'fill_supplies',
      label: isPendingInspectionDecision
        ? '待确认检查安排'
        : isCleaningSubmitted
          ? (isDirectCompleteEligible ? '完成记录' : '补品记录')
          : (isStayoverTask ? '标记已完成' : (isSelfCompleteEligible ? '补充与完成' : '补品填报')),
      placement: 'primary',
      target: isDirectCompleteEligible ? 'CleaningSelfComplete' : 'SuppliesForm',
      intent: 'cleaning',
      enabled: !isPendingInspectionDecision,
      ...(isPendingInspectionDecision ? { disabled_reason: 'pending_inspection_decision' } : {}),
    }))
    actions.push(legacyAction({ id: 'report_issue', label: '房源问题反馈', placement: 'more', target: 'FeedbackForm', intent: 'issue' }))
  }

  return actions
}

export function primaryActionsForTask(task: WorkTaskItem | null | undefined, options?: { roleNames?: string[]; limit?: number }) {
  const limit = Math.max(1, options?.limit || 2)
  return availableActionsForTask(task, options)
    .filter((action) => action.placement === 'primary')
    .slice(0, limit)
}

export function navigationForWorkTaskAction(task: WorkTaskItem, action: WorkTaskAvailableAction): WorkTaskActionRoute | null {
  const actionSourceId = cleanText((action as any)?.source_id)
  if (action.id === 'upload_key_photo') return { screen: 'TaskDetail', params: { id: task.id, action: 'upload_key' } }
  if (action.id === 'mark_guest_checkout') return { screen: 'TaskDetail', params: { id: task.id } }
  if (action.id === 'fill_supplies') return { screen: 'SuppliesForm', params: { taskId: task.id } }
  if (action.id === 'complete_cleaning') return { screen: 'CleaningSelfComplete', params: { taskId: task.id } }
  if (action.id === 'submit_inspection') return { screen: 'InspectionPanel', params: { taskId: task.id, ...(actionSourceId ? { sourceId: actionSourceId } : {}) } }
  if (action.id === 'upload_access_video') {
    return {
      screen: 'InspectionComplete',
      params: {
        taskId: task.id,
        ...(actionSourceId ? { sourceId: actionSourceId } : {}),
        skipInspectionPhotos: isPasswordOnlyInspectionTask(task as any) || isKeyHandoverExecutionTask(task as any) || lower(task.task_kind) === 'execution',
      },
    }
  }
  if (action.id === 'report_issue') return { screen: 'FeedbackForm', params: { taskId: task.id } }
  return null
}

function preferredActionIdsForNotice(data0: any): string[] {
  const data = data0 && typeof data0 === 'object' ? data0 : {}
  const kind = lower(data.kind)
  const action = lower(data.action)
  const entity = lower(data.entity)
  const joined = `${kind} ${action} ${entity}`
  if (joined.includes('guest_checked_out')) return ['mark_guest_checkout']
  if (joined.includes('key_photo')) return ['upload_key_photo']
  if (joined.includes('suppl') || joined.includes('restock')) return ['fill_supplies', 'submit_inspection']
  if (joined.includes('inspect')) return ['submit_inspection', 'upload_access_video']
  if (joined.includes('video') || joined.includes('password') || joined.includes('code') || joined.includes('lockbox') || joined.includes('access')) return ['upload_access_video']
  if (joined.includes('issue') || joined.includes('feedback') || joined.includes('repair')) return ['report_issue']
  return []
}

export function preferredNoticeActionForTask(task: WorkTaskItem | null | undefined, data: any, options?: { roleNames?: string[] }) {
  const actions = availableActionsForTask(task, options)
  if (!actions.length) return null
  const preferredIds = preferredActionIdsForNotice(data)
  for (const id of preferredIds) {
    const match = actions.find((action) => action.id === id)
    if (match) return match
  }
  return actions.find((action) => action.placement === 'primary' && action.enabled) || actions.find((action) => action.enabled) || actions[0] || null
}
