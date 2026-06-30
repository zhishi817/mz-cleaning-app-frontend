import { Directory, File, Paths } from 'expo-file-system'
import type { InspectionPhotoArea } from './api'
import { ApiError, isRetryableApiError, uploadCleaningMedia, uploadCleaningVideo, uploadLockboxVideo } from './api'
import { getJson, setJson } from './storage'

export type InspectionQueueKind = 'inspection_photo' | 'restock_proof' | 'lockbox_video'
export type UploadQueueStatus =
  | 'pending'
  | 'uploading'
  | 'uploaded'
  | 'failed_retryable'
  | 'failed_terminal'
  | 'expired_local_cleaned'

export type InspectionMediaQueueItem = {
  id: string
  task_id: string
  kind: InspectionQueueKind
  local_uri: string
  name: string
  mime_type: string
  created_at: string
  captured_at: string
  uploaded_url: string | null
  upload_status: UploadQueueStatus
  business_saved: boolean
  uploaded_at?: string | null
  business_saved_at?: string | null
  retain_until: string
  local_file_deleted_at?: string | null
  last_error?: string | null
  meta?: {
    area?: InspectionPhotoArea | string
    note?: string
    item_id?: string
    property_code?: string
    watermark_text?: string
  }
}

const STORAGE_KEY = 'mzstay.inspection_media_queue.v1'
const RETAIN_MS = 7 * 24 * 60 * 60 * 1000
const listeners = new Set<() => void>()
const inFlightLocalUris = new Set<string>()

function emit() {
  for (const listener of listeners) {
    try {
      listener()
    } catch {}
  }
}

function nowIso() {
  return new Date().toISOString()
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function fileExtFrom(name: string, mimeType: string) {
  const ext = String(name || '').trim().match(/\.[a-z0-9]+$/i)?.[0]
  if (ext) return ext.toLowerCase()
  const mime = String(mimeType || '').trim().toLowerCase()
  if (mime === 'image/jpeg') return '.jpg'
  if (mime === 'image/png') return '.png'
  if (mime === 'image/webp') return '.webp'
  if (mime === 'video/mp4') return '.mp4'
  if (mime === 'video/quicktime') return '.mov'
  return ''
}

async function loadQueue(): Promise<InspectionMediaQueueItem[]> {
  const raw = await getJson<InspectionMediaQueueItem[]>(STORAGE_KEY)
  return Array.isArray(raw) ? raw : []
}

async function saveQueue(items: InspectionMediaQueueItem[]) {
  await setJson(STORAGE_KEY, items)
  emit()
}

function ensurePrivateDir() {
  const dir = new Directory(Paths.document, 'mzstay-inspection-media')
  dir.create({ intermediates: true, idempotent: true })
  return dir
}

function fileExists(uri: string) {
  const localUri = String(uri || '').trim()
  if (!localUri) return false
  try {
    return new File(localUri).exists
  } catch {
    return false
  }
}

function copyToPrivateDir(sourceUri: string, name: string, mimeType: string, kind: InspectionQueueKind) {
  if (!fileExists(sourceUri)) throw new ApiError('原始文件不存在，请重新拍摄', 0, 'SOURCE_FILE_MISSING', false)
  const dir = ensurePrivateDir()
  const ext = fileExtFrom(name, mimeType)
  const prefix = kind === 'lockbox_video' ? 'video' : 'photo'
  const target = new File(dir, `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`)
  new File(sourceUri).copy(target)
  if (!target.exists) throw new ApiError('本地文件保存失败，请重新拍摄', 0, 'PRIVATE_COPY_FAILED', false)
  return target.uri
}

function deleteLocalFile(uri: string) {
  const localUri = String(uri || '').trim()
  if (!localUri || inFlightLocalUris.has(localUri)) return
  try {
    new File(localUri).delete()
  } catch {}
}

function shouldExpire(item: InspectionMediaQueueItem, now: number) {
  if (item.business_saved) return false
  if (item.local_file_deleted_at) return false
  const retainAt = new Date(String(item.retain_until || '')).getTime()
  return Number.isFinite(retainAt) && retainAt <= now
}

function isRetryableStatus(item: InspectionMediaQueueItem) {
  return item.upload_status === 'pending' || item.upload_status === 'uploading' || item.upload_status === 'failed_retryable' || (item.kind === 'lockbox_video' && !!item.uploaded_url && !item.business_saved)
}

async function updateQueueItem(id: string, updater: (item: InspectionMediaQueueItem) => InspectionMediaQueueItem | null) {
  const items = await loadQueue()
  let changed = false
  const next = items.flatMap((item) => {
    if (item.id !== id) return [item]
    changed = true
    const updated = updater(item)
    return updated ? [updated] : []
  })
  if (changed) await saveQueue(next)
}

export function subscribeInspectionMediaQueue(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export async function listInspectionMediaQueueItems() {
  return await loadQueue()
}

export async function listInspectionMediaQueueItemsForTask(taskId: string, kinds?: InspectionQueueKind[]) {
  const items = await loadQueue()
  const kindSet = kinds?.length ? new Set(kinds) : null
  return items.filter((item) => item.task_id === taskId && (!kindSet || kindSet.has(item.kind)))
}

export async function enqueueInspectionMediaItem(params: {
  task_id: string
  kind: InspectionQueueKind
  source_uri: string
  name: string
  mime_type: string
  captured_at?: string
  meta?: InspectionMediaQueueItem['meta']
}) {
  const createdAt = nowIso()
  const capturedAt = String(params.captured_at || createdAt)
  const localUri = copyToPrivateDir(params.source_uri, params.name, params.mime_type, params.kind)
  const item: InspectionMediaQueueItem = {
    id: makeId(params.kind),
    task_id: String(params.task_id || '').trim(),
    kind: params.kind,
    local_uri: localUri,
    name: String(params.name || '').trim() || `${params.kind}-${Date.now()}`,
    mime_type: String(params.mime_type || '').trim() || 'application/octet-stream',
    created_at: createdAt,
    captured_at: capturedAt,
    uploaded_url: null,
    upload_status: 'pending',
    business_saved: false,
    retain_until: new Date(new Date(capturedAt).getTime() + RETAIN_MS).toISOString(),
    local_file_deleted_at: null,
    last_error: null,
    meta: params.meta ? { ...params.meta } : undefined,
  }
  const items = await loadQueue()
  items.push(item)
  await saveQueue(items)
  return item
}

export async function updateInspectionMediaItem(id: string, patch: Partial<InspectionMediaQueueItem>) {
  await updateQueueItem(id, (item) => ({ ...item, ...patch, meta: patch.meta ? { ...(item.meta || {}), ...patch.meta } : item.meta }))
}

export async function removeInspectionMediaItem(id: string, options?: { deleteLocalFile?: boolean }) {
  const shouldDelete = options?.deleteLocalFile !== false
  await updateQueueItem(id, (item) => {
    if (shouldDelete && !item.local_file_deleted_at) deleteLocalFile(item.local_uri)
    return null
  })
}

export async function completeInspectionMediaItems(ids: string[]) {
  const idSet = new Set((ids || []).map((id) => String(id || '').trim()).filter(Boolean))
  if (!idSet.size) return
  const items = await loadQueue()
  const next = items.filter((item) => {
    if (!idSet.has(item.id)) return true
    if (!item.local_file_deleted_at) deleteLocalFile(item.local_uri)
    return false
  })
  await saveQueue(next)
}

export async function pruneExpiredInspectionMediaItems(now = Date.now()) {
  const items = await loadQueue()
  let changed = false
  const next = items.map((item) => {
    if (!shouldExpire(item, now)) return item
    changed = true
    deleteLocalFile(item.local_uri)
    return {
      ...item,
      local_file_deleted_at: nowIso(),
      upload_status: item.uploaded_url ? item.upload_status : 'expired_local_cleaned',
      last_error: item.uploaded_url ? item.last_error : '本地文件已过期清理，请重新拍摄',
    }
  })
  if (changed) await saveQueue(next)
  return next
}

function isMissingLocalFileError(error: unknown) {
  const message = String((error as any)?.message || error || '').toLowerCase()
  return message.includes('no such file') || message.includes('not found')
}

function uploadMeta(item: InspectionMediaQueueItem) {
  const meta = item.meta || {}
  if (item.kind === 'lockbox_video') return null
  if (item.kind === 'restock_proof') {
    return {
      purpose: 'restock_proof',
      watermark: meta.watermark_text ? '1' : '',
      watermark_text: meta.watermark_text || '',
      property_code: meta.property_code || '',
      captured_at: item.captured_at,
    }
  }
  return {
    purpose: 'inspection_photo',
    area: meta.area || undefined,
    watermark: meta.watermark_text ? '1' : '',
    watermark_text: meta.watermark_text || '',
    property_code: meta.property_code || '',
    captured_at: item.captured_at,
  }
}

async function uploadQueueItem(token: string, item: InspectionMediaQueueItem) {
  const localUri = String(item.local_uri || '').trim()
  if (!localUri) throw new ApiError('缺少本地文件', 0, 'MISSING_LOCAL_FILE', false)
  if (!fileExists(localUri)) throw new ApiError('本地文件已丢失，请重新拍摄', 0, 'MISSING_LOCAL_FILE', false)
  if (item.kind === 'lockbox_video') {
    return await uploadCleaningVideo(token, { uri: localUri, name: item.name, mimeType: item.mime_type })
  }
  return await uploadCleaningMedia(token, { uri: localUri, name: item.name, mimeType: item.mime_type }, uploadMeta(item) || undefined)
}

export async function processInspectionMediaQueue(token: string) {
  await pruneExpiredInspectionMediaItems()
  const items = await loadQueue()
  const ordered = [...items].sort((a, b) => {
    if (a.kind === b.kind) return a.created_at.localeCompare(b.created_at)
    if (a.kind === 'lockbox_video') return 1
    if (b.kind === 'lockbox_video') return -1
    return a.created_at.localeCompare(b.created_at)
  })
  let processed = 0
  for (const item of ordered) {
    if (item.business_saved || !isRetryableStatus(item) || item.local_file_deleted_at) continue
    const localUri = String(item.local_uri || '').trim()
    if (!localUri || inFlightLocalUris.has(localUri)) continue
    inFlightLocalUris.add(localUri)
    try {
      const alreadyUploadedUrl = String(item.uploaded_url || '').trim()
      if (!alreadyUploadedUrl) {
        await updateQueueItem(item.id, (current) => ({ ...current, upload_status: 'uploading', last_error: null }))
      }
      const up = alreadyUploadedUrl ? { url: alreadyUploadedUrl } : await uploadQueueItem(token, item)
      const uploadedUrl = String(up.url || '').trim() || alreadyUploadedUrl
      processed++
      await updateQueueItem(item.id, (current) => ({
        ...current,
        uploaded_url: uploadedUrl || current.uploaded_url,
        upload_status: 'uploaded',
        uploaded_at: nowIso(),
        last_error: null,
      }))
      if (item.kind === 'lockbox_video' && uploadedUrl) {
        await uploadLockboxVideo(token, item.task_id, { media_url: uploadedUrl })
        if (!item.local_file_deleted_at) deleteLocalFile(item.local_uri)
        await updateQueueItem(item.id, (current) => ({
          ...current,
          uploaded_url: uploadedUrl,
          upload_status: 'uploaded',
          business_saved: true,
          business_saved_at: nowIso(),
          local_file_deleted_at: current.local_file_deleted_at || nowIso(),
          last_error: null,
        }))
      }
    } catch (error: any) {
      const message = String(error?.message || '上传失败')
      const retryable = isRetryableApiError(error)
      const status = error instanceof ApiError && (error.status === 401 || error.status === 403)
        ? 'failed_terminal'
        : retryable
          ? 'failed_retryable'
          : isMissingLocalFileError(error)
            ? 'expired_local_cleaned'
            : 'failed_terminal'
      await updateQueueItem(item.id, (current) => ({
        ...current,
        upload_status: status,
        last_error: message,
        local_file_deleted_at: status === 'expired_local_cleaned' ? nowIso() : current.local_file_deleted_at,
      }))
    } finally {
      inFlightLocalUris.delete(localUri)
    }
  }
  return { processed, remaining: (await loadQueue()).filter((item) => !item.business_saved).length }
}
