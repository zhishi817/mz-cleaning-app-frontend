import type { InspectionMediaQueueItem } from './inspectionMediaQueue'

export type InspectionLockboxUiStatus = {
  phase: 'none' | 'local_pending' | 'uploading' | 'failed' | 'uploaded_pending_save' | 'synced' | 'missing_local'
  label: string
  hint: string
  tone: 'pending' | 'warn' | 'ok'
  deleteLabel: string
}

function cleanText(value: unknown) {
  return String(value || '').trim()
}

function safeQueueError(value: unknown) {
  const error = cleanText(value)
  if (error === 'LOCAL_MEDIA_LOCKED') return '本地视频正在处理中，系统会继续等待并自动重试'
  return error
}

export function inspectionLockboxUiStatus(
  item: InspectionMediaQueueItem | null,
  options?: { serverUrl?: string | null; stale?: boolean },
): InspectionLockboxUiStatus {
  const serverUrl = cleanText(options?.serverUrl)
  const uploadedUrl = cleanText(item?.uploaded_url)
  const localUri = cleanText(item?.local_uri)
  const error = safeQueueError(item?.last_error)
  const synced = !!serverUrl || item?.business_saved === true

  if (synced) {
    return {
      phase: 'synced',
      label: '已同步',
      hint: '挂钥匙视频已同步完成。',
      tone: 'ok',
      deleteLabel: '删除已同步视频',
    }
  }
  if (uploadedUrl) {
    return {
      phase: error ? 'failed' : 'uploaded_pending_save',
      label: error ? '已上传 · 任务保存失败' : '已上传 · 待保存任务',
      hint: error
        ? `视频文件已上传，但任务记录保存失败：${error}。请点击“点击完成”重试。`
        : '视频文件已上传，但任务记录尚未保存。请点击“点击完成”完成保存；系统也会自动重试。',
      tone: error ? 'warn' : 'pending',
      deleteLabel: '移除待保存视频',
    }
  }
  if (item?.local_file_deleted_at && !uploadedUrl) {
    return {
      phase: 'missing_local',
      label: '本地文件已失效',
      hint: error || '本地视频已过期清理，请重新拍摄。',
      tone: 'warn',
      deleteLabel: '移除失效视频记录',
    }
  }
  if (error || item?.upload_status === 'failed_retryable' || item?.upload_status === 'failed_terminal') {
    return {
      phase: 'failed',
      label: '上传失败',
      hint: error || '视频上传失败，请重试。',
      tone: 'warn',
      deleteLabel: localUri ? '删除本机待上传视频' : '移除失败视频记录',
    }
  }
  if (item?.upload_status === 'uploading') {
    return {
      phase: 'uploading',
      label: options?.stale ? '上传可能已卡住' : '上传中',
      hint: options?.stale
        ? '视频上传可能已卡住，视频仍保存在本机，可点击重试上传。'
        : '视频已保存在本机，正在自动上传。',
      tone: options?.stale ? 'warn' : 'pending',
      deleteLabel: '删除本机待上传视频',
    }
  }
  if (item && localUri) {
    return {
      phase: 'local_pending',
      label: '已保存本机 · 待上传',
      hint: '视频已保存到本机，正在等待自动上传。',
      tone: 'pending',
      deleteLabel: '删除本机待上传视频',
    }
  }
  return {
    phase: 'none',
    label: '未拍摄',
    hint: '',
    tone: 'pending',
    deleteLabel: '移除视频记录',
  }
}
