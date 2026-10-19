import { getJson, remove, setJson } from './storage'

type PendingCompletionPhotoSnapshot = {
  work_task_id: string
  owner_id: string
  updated_at: string
  photo_references: string[]
}

const STORAGE_KEY_PREFIX = 'mzstay.work_task_completion_photo_pending.v1:'

function cleanText(value: any) {
  return String(value || '').trim()
}

export function normalizePendingCompletionPhotoReferences(value: any) {
  const values = Array.isArray(value) ? value : []
  return Array.from(new Set(values.map((item) => cleanText(item)).filter(Boolean)))
}

function storageKey(workTaskId: string, ownerId: string) {
  return `${STORAGE_KEY_PREFIX}${encodeURIComponent(cleanText(ownerId))}:${encodeURIComponent(cleanText(workTaskId))}`
}

function normalizeSnapshot(workTaskId: string, ownerId: string, value: any): PendingCompletionPhotoSnapshot | null {
  const taskId = cleanText(workTaskId)
  const userId = cleanText(ownerId)
  if (!taskId || !userId || !value || typeof value !== 'object') return null
  const references = normalizePendingCompletionPhotoReferences(value.photo_references)
  if (!references.length) return null
  return {
    work_task_id: taskId,
    owner_id: userId,
    updated_at: cleanText(value.updated_at) || new Date().toISOString(),
    photo_references: references,
  }
}

export async function getPendingWorkTaskCompletionPhotoReferences(workTaskId: string, ownerId: string) {
  const taskId = cleanText(workTaskId)
  const userId = cleanText(ownerId)
  if (!taskId || !userId) return []
  const snapshot = normalizeSnapshot(taskId, userId, await getJson<any>(storageKey(taskId, userId)))
  return snapshot?.photo_references || []
}

export async function setPendingWorkTaskCompletionPhotoReferences(workTaskId: string, ownerId: string, references: string[]) {
  const taskId = cleanText(workTaskId)
  const userId = cleanText(ownerId)
  if (!taskId || !userId) throw new Error('缺少完成照片待保存归属')
  const normalized = normalizePendingCompletionPhotoReferences(references)
  if (!normalized.length) {
    await remove(storageKey(taskId, userId))
    return []
  }
  const snapshot: PendingCompletionPhotoSnapshot = {
    work_task_id: taskId,
    owner_id: userId,
    updated_at: new Date().toISOString(),
    photo_references: normalized,
  }
  const key = storageKey(taskId, userId)
  await setJson(key, snapshot)
  const verified = normalizeSnapshot(taskId, userId, await getJson<any>(key))
  if (!verified || verified.updated_at !== snapshot.updated_at || verified.photo_references.join('\n') !== normalized.join('\n')) {
    throw new Error('完成照片待保存记录写入校验失败')
  }
  return verified.photo_references
}

export async function clearPendingWorkTaskCompletionPhotoReferences(workTaskId: string, ownerId: string) {
  const taskId = cleanText(workTaskId)
  const userId = cleanText(ownerId)
  if (!taskId || !userId) return
  await remove(storageKey(taskId, userId))
}
