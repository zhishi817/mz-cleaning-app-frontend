import { deleteDraftMedia, draftFileExists } from './localMediaDrafts'
import { getJson, remove, setJson } from './storage'

export type MaintenanceCompletionPhotoUploadState = 'local_persisted' | 'uploading' | 'remote_stored' | 'failed' | 'blocked_local_missing'

export type MaintenanceCompletionPhotoDraft = {
  media_id: string
  local_uri: string | null
  remote_reference: string | null
  name: string
  mime_type: string
  captured_at: string
  upload_state: MaintenanceCompletionPhotoUploadState
  error_code: string | null
}
type MaintenanceCompletionPhotoSnapshot = {
  task_id: string
  owner_id: string
  updated_at: string
  photos: MaintenanceCompletionPhotoDraft[]
}

const DRAFT_KEY_PREFIX = 'mzstay.maintenance_completion_photo_draft.v1:'

function cleanText(value: any) {
  return String(value || '').trim()
}

function draftKey(taskId: string, ownerId: string) {
  return `${DRAFT_KEY_PREFIX}${encodeURIComponent(cleanText(ownerId))}:${encodeURIComponent(cleanText(taskId))}`
}

function validUploadState(value: any): MaintenanceCompletionPhotoUploadState {
  const state = cleanText(value)
  if (state === 'uploading' || state === 'remote_stored' || state === 'failed' || state === 'blocked_local_missing') return state
  return 'local_persisted'
}

function normalizePhoto(value: any): MaintenanceCompletionPhotoDraft | null {
  const mediaId = cleanText(value?.media_id)
  const localUri = cleanText(value?.local_uri)
  const remoteReference = cleanText(value?.remote_reference)
  if (!mediaId || (!localUri && !remoteReference)) return null
  return {
    media_id: mediaId,
    local_uri: localUri && draftFileExists(localUri) ? localUri : null,
    remote_reference: remoteReference || null,
    name: cleanText(value?.name) || `${mediaId}.jpg`,
    mime_type: cleanText(value?.mime_type) || 'image/jpeg',
    captured_at: cleanText(value?.captured_at) || new Date().toISOString(),
    upload_state: validUploadState(value?.upload_state),
    error_code: cleanText(value?.error_code) || null,
  }
}

function normalizePhotos(value: any) {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const photos: MaintenanceCompletionPhotoDraft[] = []
  for (const raw of value) {
    const photo = normalizePhoto(raw)
    if (!photo || seen.has(photo.media_id)) continue
    seen.add(photo.media_id)
    photos.push(photo)
  }
  return photos
}

function normalizeSnapshot(taskId: string, ownerId: string, raw: any): MaintenanceCompletionPhotoSnapshot | null {
  const task = cleanText(taskId)
  const owner = cleanText(ownerId)
  if (!task || !owner || !raw || typeof raw !== 'object') return null
  return {
    task_id: task,
    owner_id: owner,
    updated_at: cleanText(raw.updated_at) || new Date().toISOString(),
    photos: normalizePhotos(raw.photos),
  }
}

async function writeVerifiedSnapshot(taskId: string, ownerId: string, photos: MaintenanceCompletionPhotoDraft[]) {
  const task = cleanText(taskId)
  const owner = cleanText(ownerId)
  if (!task || !owner) throw new Error('缺少维修照片草稿归属')
  const snapshot: MaintenanceCompletionPhotoSnapshot = {
    task_id: task,
    owner_id: owner,
    updated_at: new Date().toISOString(),
    photos: normalizePhotos(photos),
  }
  const key = draftKey(task, owner)
  await setJson(key, snapshot)
  const verified = normalizeSnapshot(task, owner, await getJson<any>(key))
  if (!verified || verified.updated_at !== snapshot.updated_at) {
    throw new Error('维修照片本地草稿写入校验失败，请保留照片后重试')
  }
  return verified.photos
}

export function createMaintenanceCompletionPhotoMediaId() {
  return `maintenance-photo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export async function getMaintenanceCompletionPhotoDraft(taskId: string, ownerId: string) {
  const task = cleanText(taskId)
  const owner = cleanText(ownerId)
  if (!task || !owner) return []
  const snapshot = normalizeSnapshot(task, owner, await getJson<any>(draftKey(task, owner)))
  return snapshot?.photos || []
}

export async function setMaintenanceCompletionPhotoDraft(taskId: string, ownerId: string, photos: MaintenanceCompletionPhotoDraft[]) {
  return writeVerifiedSnapshot(taskId, ownerId, photos)
}

export async function removeMaintenanceCompletionPhotoDraft(taskId: string, ownerId: string, mediaId: string) {
  const current = await getMaintenanceCompletionPhotoDraft(taskId, ownerId)
  const targetId = cleanText(mediaId)
  const removed = current.find((photo) => photo.media_id === targetId)
  const next = current.filter((photo) => photo.media_id !== targetId)
  if (next.length) await writeVerifiedSnapshot(taskId, ownerId, next)
  else await remove(draftKey(taskId, ownerId))
  if (removed?.local_uri) deleteDraftMedia(removed.local_uri)
  return next
}

export async function clearMaintenanceCompletionPhotoDraft(taskId: string, ownerId: string, options?: { deleteLocalFiles?: boolean }) {
  const current = await getMaintenanceCompletionPhotoDraft(taskId, ownerId)
  await remove(draftKey(taskId, ownerId))
  if (options?.deleteLocalFiles) {
    for (const photo of current) {
      if (photo.local_uri) deleteDraftMedia(photo.local_uri)
    }
  }
}
