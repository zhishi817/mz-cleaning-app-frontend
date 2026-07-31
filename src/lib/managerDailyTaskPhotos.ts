import { cleaningExecutionTaskIdsFromTask, inspectionExecutionTaskIdsFromTask, uniqueTextList } from './turnoverDisplay'

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
