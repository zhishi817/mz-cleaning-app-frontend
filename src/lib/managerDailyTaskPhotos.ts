import { cleaningExecutionTaskIdsFromTask, inspectionExecutionTaskIdsFromTask, uniqueTextList } from './turnoverDisplay'
import type { WorkTaskFormPhotoRecord } from './api'

export type ManagerDailyTaskPhotoSource = 'consumables' | 'completion' | 'inspection' | 'restock' | 'unknown'

export type ManagerDailyTaskPhotoLoadIssue = {
  source: ManagerDailyTaskPhotoSource
  source_label: string
  task_id: string
  status: number
  code: string | null
  message: string
  retryable: boolean
}

export type ManagerGuestLuggagePhotoDisplayItem = {
  remoteReference: string
  localUri: string | null
  guestLuggageId: string | null
}

const BLOCKED_HISTORICAL_EXECUTION_STATES = new Set([
  'cancelled',
  'canceled',
  'deleted',
  'removed',
  'superseded',
  'tombstone',
])

function historicalMediaSourceIds(task: any) {
  return uniqueTextList(Array.isArray(task?.read_only_views?.media_source_ids)
    ? task.read_only_views.media_source_ids
    : [])
}

/**
 * Manager roles may read all media for an authorised source task, but a
 * reassigned work-record card represents the former worker's immutable
 * record. Keep that card bound to Root-issued source ids and the recorded
 * actor so media uploaded later by the replacement worker cannot appear in
 * the former worker's history.
 */
export function managerHistoricalMediaRecords(
  task: any,
  records0: WorkTaskFormPhotoRecord[] | null | undefined,
): WorkTaskFormPhotoRecord[] {
  if (task?.work_record_read_only !== true) return []
  const status = String(task?.status || '').trim().toLowerCase()
  const executionState = String(task?.execution_state || '').trim().toLowerCase()
  if (status === 'cancelled' || status === 'canceled' || BLOCKED_HISTORICAL_EXECUTION_STATES.has(executionState)) return []

  const sourceIds = historicalMediaSourceIds(task)
  if (!sourceIds.length || String(task?.read_only_views?.media_scope || '').trim() !== 'manager') return []
  const sourceIdSet = new Set(sourceIds)
  const exactRecords = (Array.isArray(records0) ? records0 : []).filter((record) => (
    !!String(record?.url || '').trim()
    && sourceIdSet.has(String(record?.task_id || '').trim())
  ))
  if (String(task?.work_record_state || '').trim().toLowerCase() !== 'reassigned') return exactRecords

  const actorId = String(task?.completed_by_user_id || '').trim()
  if (!actorId) return []
  const feedbackSourceId = String(task?.read_only_views?.feedback_source_id || '').trim()
  if (!feedbackSourceId || !sourceIdSet.has(feedbackSourceId)) return []
  const hasExactActorBinding = (Array.isArray(task?.phase_history) ? task.phase_history : []).some((phase: any) => (
    String(phase?.source_id || '').trim() === feedbackSourceId
    && String(phase?.actor_user_id || '').trim() === actorId
  ))
  if (!hasExactActorBinding) return []

  return exactRecords.filter((record) => (
    String(record?.task_id || '').trim() === feedbackSourceId
    && String(record?.uploader_id || '').trim() === actorId
  ))
}

const PHOTO_SOURCE_LABEL: Record<ManagerDailyTaskPhotoSource, string> = {
  consumables: '清洁补品照片',
  completion: '清洁完成照片',
  inspection: '检查照片',
  restock: '检查补品照片',
  unknown: '照片读取',
}

function trimErrorMessage(value: any) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 180)
}

export function managerDailyTaskPhotoLoadIssue(
  source: ManagerDailyTaskPhotoSource,
  taskId: string,
  error: any,
): ManagerDailyTaskPhotoLoadIssue {
  const status = Number(error?.status || error?.statusCode || 0)
  const code = trimErrorMessage(error?.code) || null
  const rawMessage = trimErrorMessage(error?.message)
  let message = rawMessage || '请求失败'

  if (status === 403 || code === 'FORBIDDEN') message = '权限不足'
  else if (status === 401 || code === 'UNAUTHORIZED') message = '登录已失效，请重新登录'
  else if (status >= 500 || code === 'SERVER_ERROR') message = status ? `服务器错误（HTTP ${status}）` : '服务器错误'
  else if (code === 'TIMEOUT') message = '网络超时'
  else if (code === 'NETWORK_ERROR') message = '网络异常'
  else if (status === 404) message = '任务或照片接口不存在（HTTP 404）'
  else if (status > 0 && !message.includes(String(status))) message = `${message}（HTTP ${status}）`

  return {
    source,
    source_label: PHOTO_SOURCE_LABEL[source],
    task_id: String(taskId || '').trim() || '-',
    status,
    code,
    message,
    retryable: !!error?.retryable || status === 0 || status >= 500,
  }
}

/**
 * A temporary-notice upload is not readable through the authenticated proxy
 * until its enclosing notice is saved. Preserve the picker URI for that
 * transitional state; only saved references receive the notice read context.
 */
export function managerGuestLuggagePhotoDisplayItems(
  remoteReferences: unknown,
  localPreviewByReference: Record<string, string | null | undefined> | null | undefined,
  savedNoticeId: unknown,
): ManagerGuestLuggagePhotoDisplayItem[] {
  const values = Array.isArray(remoteReferences) ? remoteReferences : remoteReferences ? [remoteReferences] : []
  const seen = new Set<string>()
  const noticeId = String(savedNoticeId || '').trim() || null
  const previewByReference = localPreviewByReference || {}

  return values.flatMap((value) => {
    const remoteReference = String(value || '').trim()
    if (!remoteReference || seen.has(remoteReference)) return []
    seen.add(remoteReference)
    const localUri = String(previewByReference[remoteReference] || '').trim() || null
    return [{
      remoteReference,
      localUri,
      guestLuggageId: localUri ? null : noticeId,
    }]
  })
}

export function inspectionPhotoTaskIdsFromTask(task: any) {
  if (!task || task.source_type !== 'cleaning_tasks') return []
  return uniqueTextList([
    ...inspectionExecutionTaskIdsFromTask(task),
    ...(Array.isArray(task?.inspection_task_ids) ? task.inspection_task_ids : []),
    ...(Array.isArray(task?.cleaning_task_ids) ? task.cleaning_task_ids : []),
    ...(Array.isArray(task?.source_ids) ? task.source_ids : []),
    task?.source_id,
  ])
}

export function completionPhotoTaskIdsFromTask(task: any) {
  if (!task || task.source_type !== 'cleaning_tasks') return []
  return uniqueTextList([
    ...cleaningExecutionTaskIdsFromTask(task),
    ...(Array.isArray(task?.cleaning_task_ids) ? task.cleaning_task_ids : []),
    ...(Array.isArray(task?.source_ids) ? task.source_ids : []),
    task?.source_id,
  ])
}

export type ManagerCompletionPhotoItem = {
  area: string
  url: string
  note?: string | null
}

export function mergeManagerLivingRoomPhotoUrls(responses: (any | null | undefined)[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const response of responses) {
    const values = Array.isArray(response?.living_room_photo_urls)
      ? response.living_room_photo_urls
      : [response?.living_room_photo_url]
    for (const value of values) {
      const url = String(value || '').trim()
      if (!url || seen.has(url)) continue
      seen.add(url)
      out.push(url)
    }
  }
  return out
}

export function mergeManagerCompletionPhotoItems(responses: (any | null | undefined)[]): ManagerCompletionPhotoItem[] {
  const seen = new Set<string>()
  return responses
    .flatMap((response) => (Array.isArray(response?.items) ? response.items : []))
    .map((item) => ({
      area: String(item?.area || '').trim(),
      url: String(item?.url || '').trim(),
      note: item?.note ?? null,
    }))
    .filter((item) => {
      if (!item.url) return false
      const key = `${item.area}|${item.url}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}
