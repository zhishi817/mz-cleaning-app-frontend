import { startCleaningTask, uploadCleaningMedia } from './api'
import { deleteDraftMedia, draftMimeTypeFrom, persistDraftMedia } from './localMediaDrafts'
import { getJson, setJson } from './storage'

export type KeyUploadStepStatus = 'pending' | 'syncing' | 'succeeded' | 'failed'

export type KeyUploadStepState = {
  status: KeyUploadStepStatus
  started_at?: string | null
  finished_at?: string | null
  error?: string | null
  output?: Record<string, any> | null
}

export type KeyUploadQueueItem = {
  id: string
  cleaning_task_id: string
  local_uri: string
  name: string
  mime_type: string
  property_code?: string
  captured_at?: string
  watermark_text?: string
  created_at: string
  updated_at: string
  status: 'pending' | 'syncing' | 'failed' | 'synced'
  uploaded_url?: string | null
  last_error?: string | null
  steps: {
    upload_media: KeyUploadStepState
    start_cleaning_task: KeyUploadStepState
  }
}

export type KeyPhotoEffectiveState = 'missing' | 'pending_sync' | 'recorded'

const STORAGE_KEY = 'mzstay.key_upload_queue.v2'
const listeners = new Set<() => void>()
let processing = false

function emit() {
  for (const listener of listeners) {
    try {
      listener()
    } catch {}
  }
}

function cleanText(value: any) {
  return String(value || '').trim()
}

function nowIso() {
  return new Date().toISOString()
}

function baseStepState(): KeyUploadStepState {
  return { status: 'pending', started_at: null, finished_at: null, error: null, output: null }
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function isNetworkishError(e: any) {
  const m = String(e?.message || e || '').toLowerCase()
  if (!m) return false
  return m.includes('network request failed') || m.includes('timeout') || m.includes('timed out') || m.includes('aborted')
}

export function getKeyUploadVisibleError(error: any) {
  const message = cleanText(error)
  if (!message) return null
  return isNetworkishError(message) ? null : message
}

function normalizeItem(raw: any): KeyUploadQueueItem | null {
  if (!raw || typeof raw !== 'object') return null
  const id = cleanText(raw.id)
  const cleaningTaskId = cleanText(raw.cleaning_task_id)
  const localUri = cleanText(raw.local_uri)
  if (!id || !cleaningTaskId || !localUri) return null
  const status = cleanText(raw.status)
  return {
    id,
    cleaning_task_id: cleaningTaskId,
    local_uri: localUri,
    name: cleanText(raw.name) || 'key.jpg',
    mime_type: cleanText(raw.mime_type) || 'image/jpeg',
    property_code: cleanText(raw.property_code) || undefined,
    captured_at: cleanText(raw.captured_at) || undefined,
    watermark_text: cleanText(raw.watermark_text) || undefined,
    created_at: cleanText(raw.created_at) || nowIso(),
    updated_at: cleanText(raw.updated_at) || nowIso(),
    status: status === 'syncing' || status === 'failed' || status === 'synced' ? status : 'pending',
    uploaded_url: cleanText(raw.uploaded_url) || null,
    last_error: cleanText(raw.last_error) || null,
    steps: {
      upload_media: raw?.steps?.upload_media || baseStepState(),
      start_cleaning_task: raw?.steps?.start_cleaning_task || baseStepState(),
    },
  }
}

async function loadQueue(): Promise<KeyUploadQueueItem[]> {
  const q = await getJson<KeyUploadQueueItem[]>(STORAGE_KEY)
  return Array.isArray(q) ? q.map(normalizeItem).filter(Boolean) as KeyUploadQueueItem[] : []
}

async function saveQueue(q: KeyUploadQueueItem[]) {
  await setJson(STORAGE_KEY, q)
  emit()
}

async function updateQueueItem(cleaningTaskId: string, updater: (item: KeyUploadQueueItem | null) => KeyUploadQueueItem | null) {
  const queue = await loadQueue()
  const idx = queue.findIndex((item) => item.cleaning_task_id === cleanText(cleaningTaskId))
  const current = idx >= 0 ? queue[idx] : null
  const next = updater(current)
  if (!next) {
    if (idx >= 0) queue.splice(idx, 1)
  } else if (idx >= 0) {
    queue[idx] = next
  } else {
    queue.push(next)
  }
  await saveQueue(queue)
  return next
}

async function removeQueueItem(cleaningTaskId: string, options?: { deleteLocalFile?: boolean }) {
  const queue = await loadQueue()
  const idx = queue.findIndex((item) => item.cleaning_task_id === cleanText(cleaningTaskId))
  const current = idx >= 0 ? queue[idx] : null
  if (!current) return null
  queue.splice(idx, 1)
  await saveQueue(queue)
  if (options?.deleteLocalFile && current.local_uri) deleteDraftMedia(current.local_uri)
  return current
}

async function markStep(cleaningTaskId: string, step: keyof KeyUploadQueueItem['steps'], patch: Partial<KeyUploadStepState>, status?: KeyUploadQueueItem['status'], lastError?: string | null) {
  await updateQueueItem(cleaningTaskId, (current) => {
    if (!current) return current
    return {
      ...current,
      status: status || current.status,
      updated_at: nowIso(),
      last_error: lastError === undefined ? current.last_error : lastError,
      steps: {
        ...current.steps,
        [step]: {
          ...current.steps[step],
          ...patch,
        },
      },
    }
  })
}

export function subscribeKeyUploadQueue(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export async function listKeyUploadQueueItems() {
  return await loadQueue()
}

export async function getKeyUploadQueueItem(cleaningTaskId: string) {
  return (await loadQueue()).find((item) => item.cleaning_task_id === cleanText(cleaningTaskId)) || null
}

export async function enqueueKeyUpload(params: {
  cleaning_task_id: string
  source_uri: string
  property_code?: string
  captured_at?: string
  watermark_text?: string
  file_name?: string
  mime_type?: string
}) {
  const cleaningTaskId = cleanText(params.cleaning_task_id)
  if (!cleaningTaskId) return null
  const existing = await getKeyUploadQueueItem(cleaningTaskId)
  const fallbackName = cleanText(params.file_name) || cleanText(params.source_uri.split('/').pop()) || 'key'
  const resolvedMimeType = draftMimeTypeFrom(fallbackName, cleanText(params.mime_type), params.source_uri)
  const localUri = persistDraftMedia({
    dirName: 'mzstay-key-uploads',
    prefix: 'key',
    sourceUri: params.source_uri,
    name: fallbackName,
    mimeType: resolvedMimeType,
  })
  const next = await updateQueueItem(cleaningTaskId, (current) => ({
    id: current?.id || makeId('key_upload'),
    cleaning_task_id: cleaningTaskId,
    local_uri: localUri,
    name: fallbackName,
    mime_type: resolvedMimeType,
    property_code: cleanText(params.property_code) || undefined,
    captured_at: cleanText(params.captured_at) || undefined,
    watermark_text: cleanText(params.watermark_text) || undefined,
    created_at: current?.created_at || nowIso(),
    updated_at: nowIso(),
    status: 'pending',
    uploaded_url: current?.uploaded_url || null,
    last_error: null,
    steps: {
      upload_media: current?.steps?.upload_media?.status === 'succeeded' ? baseStepState() : (current?.steps?.upload_media || baseStepState()),
      start_cleaning_task: current?.steps?.start_cleaning_task?.status === 'succeeded' ? baseStepState() : (current?.steps?.start_cleaning_task || baseStepState()),
    },
  }))
  if (existing?.local_uri && existing.local_uri !== localUri) deleteDraftMedia(existing.local_uri)
  return next
}

export async function discardKeyUpload(cleaningTaskId: string, options?: { deleteLocalFile?: boolean }) {
  return await removeQueueItem(cleaningTaskId, options)
}

export async function getKeyUploadQueueLength() {
  return (await loadQueue()).length
}

export function selectKeyPhotoEffectiveState(params: { key_photo_url?: string | null; has_local_pending: boolean }): KeyPhotoEffectiveState {
  if (cleanText(params.key_photo_url)) return 'recorded'
  if (params.has_local_pending) return 'pending_sync'
  return 'missing'
}

export async function processKeyUploadQueue(token: string) {
  if (processing) return { processed: 0, remaining: await getKeyUploadQueueLength() }
  processing = true
  try {
    const queue = await loadQueue()
    let processed = 0
    for (const item of queue) {
      try {
        if (item.steps.upload_media.status !== 'succeeded') {
          await markStep(item.cleaning_task_id, 'upload_media', { status: 'syncing', started_at: nowIso(), error: null }, 'syncing', null)
          const up = await uploadCleaningMedia(
            token,
            { uri: item.local_uri, name: item.name, mimeType: item.mime_type },
            {
              purpose: 'key_photo',
              watermark: cleanText(item.watermark_text) ? '1' : '',
              watermark_text: item.watermark_text || '',
              property_code: item.property_code || '',
              captured_at: item.captured_at || '',
            },
          )
          await updateQueueItem(item.cleaning_task_id, (current) => current ? {
            ...current,
            status: 'syncing',
            updated_at: nowIso(),
            uploaded_url: cleanText(up.url) || null,
            last_error: null,
            steps: {
              ...current.steps,
              upload_media: {
                status: 'succeeded',
                started_at: current.steps.upload_media.started_at || nowIso(),
                finished_at: nowIso(),
                error: null,
                output: { remote_url: cleanText(up.url) || null },
              },
            },
          } : current)
        }

        const current = await getKeyUploadQueueItem(item.cleaning_task_id)
        const remoteUrl = cleanText(current?.uploaded_url || current?.steps?.upload_media?.output?.remote_url)
        if (!remoteUrl) throw new Error('钥匙照片上传成功但未返回远端地址')
        if (current?.steps.start_cleaning_task.status !== 'succeeded') {
          await markStep(item.cleaning_task_id, 'start_cleaning_task', { status: 'syncing', started_at: nowIso(), error: null }, 'syncing', null)
          await startCleaningTask(token, item.cleaning_task_id, { media_url: remoteUrl, captured_at: item.captured_at || undefined })
          const finalItem = await updateQueueItem(item.cleaning_task_id, (existing) => existing ? {
            ...existing,
            status: 'synced',
            updated_at: nowIso(),
            last_error: null,
            steps: {
              ...existing.steps,
              start_cleaning_task: {
                status: 'succeeded',
                started_at: existing.steps.start_cleaning_task.started_at || nowIso(),
                finished_at: nowIso(),
                error: null,
                output: { ok: true },
              },
            },
          } : existing)
          if (finalItem) deleteDraftMedia(finalItem.local_uri)
          await removeQueueItem(item.cleaning_task_id)
        }
        processed += 1
      } catch (e: any) {
        const msg = cleanText(e?.message) || '钥匙照片同步失败'
        await updateQueueItem(item.cleaning_task_id, (current) => current ? {
          ...current,
          status: 'failed',
          updated_at: nowIso(),
          last_error: msg,
          steps: {
            ...current.steps,
            upload_media: current.steps.upload_media.status === 'syncing'
              ? { ...current.steps.upload_media, status: 'failed', finished_at: nowIso(), error: msg }
              : current.steps.upload_media,
            start_cleaning_task: current.steps.start_cleaning_task.status === 'syncing'
              ? { ...current.steps.start_cleaning_task, status: 'failed', finished_at: nowIso(), error: msg }
              : current.steps.start_cleaning_task,
          },
        } : current)
        if (isNetworkishError(e)) break
      }
    }
    return { processed, remaining: await getKeyUploadQueueLength() }
  } finally {
    processing = false
  }
}
