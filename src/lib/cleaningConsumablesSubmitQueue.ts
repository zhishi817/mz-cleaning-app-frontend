import { isRetryableApiError, isTerminalAuthApiError, saveCompletionPhotos, saveRestockProof, submitCleaningConsumables, uploadCleaningMedia, type CompletionPhotoArea } from './api'
import { cleaningMediaReference } from './cleaningMedia'
import {
  getCleaningConsumablesDraft,
  isLocalCleaningConsumablesPhotoUri,
  removeCleaningConsumablesDraft,
  updateCleaningConsumablesDraft,
  type CleaningConsumablesDraft,
  type CleaningConsumablesMedia,
} from './cleaningConsumablesDraft'
import { withLocalMediaLock } from './localMediaLocks'
import { getJson, remove, setJson } from './storage'

export type CleaningConsumablesQueueItem = {
  queue_item_id: string
  draft_id: string
  submit_id: string
  task_id: string
  status: 'active' | 'blocked' | 'failed' | 'synced'
  retry_count: number
  next_retry_at?: string | null
  last_error_code?: string | null
  last_error_message?: string | null
  updated_at: string
}

export type CleaningConsumablesQueueResult = {
  processed: number
  remaining: number
  succeeded_task_ids: string[]
}

const STORAGE_KEY = 'mzstay.cleaning_consumables_submit_queue.v2'
const LEGACY_STORAGE_KEY = 'mzstay.cleaning_consumables_submit_queue.v1'
const MAX_RETRIES = 6
const RETRY_BASE_MS = 30_000

let processing = false
const queueListeners = new Set<(taskId: string) => void>()

function cleanText(value: any) {
  return String(value || '').trim()
}

function notifyQueueChanged(taskId: string) {
  for (const listener of queueListeners) {
    try {
      listener(taskId)
    } catch {}
  }
}

export function subscribeCleaningConsumablesSubmitQueue(listener: (taskId: string) => void) {
  queueListeners.add(listener)
  return () => {
    queueListeners.delete(listener)
  }
}

function normalizeQueueItem(raw: any): CleaningConsumablesQueueItem | null {
  const taskId = cleanText(raw?.task_id)
  if (!taskId) return null
  const status = cleanText(raw?.status)
  return {
    queue_item_id: cleanText(raw?.queue_item_id) || `queue-${taskId}`,
    draft_id: cleanText(raw?.draft_id),
    submit_id: cleanText(raw?.submit_id),
    task_id: taskId,
    status: status === 'blocked' || status === 'failed' || status === 'synced' ? status : 'active',
    retry_count: Number.isFinite(Number(raw?.retry_count)) ? Number(raw.retry_count) : 0,
    next_retry_at: cleanText(raw?.next_retry_at) || null,
    last_error_code: cleanText(raw?.last_error_code) || null,
    last_error_message: cleanText(raw?.last_error_message) || null,
    updated_at: cleanText(raw?.updated_at) || new Date().toISOString(),
  }
}

function dedupeQueue(items: CleaningConsumablesQueueItem[]) {
  const byTask = new Map<string, CleaningConsumablesQueueItem>()
  for (const item of items) {
    const normalized = normalizeQueueItem(item)
    if (!normalized) continue
    byTask.set(normalized.task_id, normalized)
  }
  return Array.from(byTask.values())
}

async function saveQueue(items: CleaningConsumablesQueueItem[]) {
  const next = dedupeQueue(items)
  await setJson(STORAGE_KEY, next)
  const verified = await getJson<CleaningConsumablesQueueItem[]>(STORAGE_KEY)
  if (!Array.isArray(verified) || verified.length !== next.length) throw new Error('提交队列写入校验失败')
  return next
}

async function loadQueue() {
  const current = await getJson<any>(STORAGE_KEY)
  if (Array.isArray(current)) return dedupeQueue(current)

  const legacyTaskIds = await getJson<string[]>(LEGACY_STORAGE_KEY)
  if (!Array.isArray(legacyTaskIds) || !legacyTaskIds.length) return []
  const migrated: CleaningConsumablesQueueItem[] = []
  for (const taskId of Array.from(new Set(legacyTaskIds.map(cleanText).filter(Boolean)))) {
    const draft = await getCleaningConsumablesDraft(taskId)
    if (!draft) continue
    migrated.push({
      queue_item_id: draft.queue_item_id,
      draft_id: draft.draft_id,
      submit_id: draft.submit_id,
      task_id: taskId,
      status: 'active',
      retry_count: draft.retry_count || 0,
      next_retry_at: draft.next_retry_at || null,
      last_error_code: draft.last_error_code || null,
      last_error_message: draft.last_error_message || null,
      updated_at: new Date().toISOString(),
    })
  }
  if (migrated.length) await saveQueue(migrated)
  await remove(LEGACY_STORAGE_KEY)
  return migrated
}

async function updateQueueItem(taskId: string, patch: Partial<CleaningConsumablesQueueItem>) {
  const current = await loadQueue()
  const next = current.map((item) => item.task_id === taskId
    ? { ...item, ...patch, updated_at: new Date().toISOString() }
    : item)
  await saveQueue(next)
  notifyQueueChanged(taskId)
  return next.find((item) => item.task_id === taskId) || null
}

export async function enqueueCleaningConsumablesSubmit(taskId: string) {
  const key = cleanText(taskId)
  if (!key) return null
  const draft = await getCleaningConsumablesDraft(key)
  if (!draft) throw new Error('补品草稿不存在，请重新填写')
  const current = await loadQueue()
  const existing = current.find((item) => item.task_id === key)
  const item: CleaningConsumablesQueueItem = {
    queue_item_id: draft.queue_item_id,
    draft_id: draft.draft_id,
    submit_id: draft.submit_id,
    task_id: key,
    status: 'active',
    retry_count: existing?.retry_count || draft.retry_count || 0,
    next_retry_at: null,
    last_error_code: null,
    last_error_message: null,
    updated_at: new Date().toISOString(),
  }
  await saveQueue([...current.filter((entry) => entry.task_id !== key), item])
  notifyQueueChanged(key)
  return item
}

export async function dequeueCleaningConsumablesSubmit(taskId: string) {
  const key = cleanText(taskId)
  if (!key) return
  const current = await loadQueue()
  await saveQueue(current.filter((item) => item.task_id !== key))
  notifyQueueChanged(key)
}

export async function isCleaningConsumablesSubmitQueued(taskId: string) {
  const key = cleanText(taskId)
  if (!key) return false
  const current = await loadQueue()
  return current.some((item) => item.task_id === key && item.status !== 'synced')
}

export async function getCleaningConsumablesSubmitQueueItem(taskId: string) {
  const key = cleanText(taskId)
  if (!key) return null
  return (await loadQueue()).find((item) => item.task_id === key) || null
}

function buildWatermarkText(propertyCode: string, username: string, iso: string) {
  const d = new Date(String(iso || ''))
  const pad2 = (n: number) => String(n).padStart(2, '0')
  const line1 = `${propertyCode || '未知房号'}${username ? `  ${username}` : ''}`.trim()
  const line2 = Number.isNaN(d.getTime())
    ? String(iso || '').trim()
    : `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  return `${line1}\n${line2}`.trim()
}

function errorCode(error: any) {
  return cleanText(error?.code) || (Number(error?.status) ? `HTTP_${Number(error.status)}` : 'UNKNOWN_ERROR')
}

function errorMessage(error: any) {
  return cleanText(error?.message) || '同步失败，请稍后重试'
}

function isTerminalError(error: any) {
  const status = Number(error?.status)
  return isTerminalAuthApiError(error) || status === 400 || status === 401 || status === 403 || status === 409 || ['LOCAL_MEDIA_MISSING', 'MISSING_LOCAL_FILE', 'IDEMPOTENCY_CONFLICT'].includes(errorCode(error))
}

function isRetryableError(error: any) {
  const status = Number(error?.status)
  return isRetryableApiError(error) || status === 408 || status === 429 || status >= 500 || ['TIMEOUT', 'NETWORK_ERROR'].includes(errorCode(error))
}

function retryDelayMs(retryCount: number) {
  return RETRY_BASE_MS * (2 ** Math.min(Math.max(retryCount - 1, 0), 5))
}

function toUploadMeta(draft: CleaningConsumablesDraft, username: string, media: CleaningConsumablesMedia, fallbackName: string) {
  const photoMeta = media.local_uri ? draft.photo_meta?.[media.local_uri] : undefined
  const capturedAt = cleanText(media.captured_at) || cleanText(photoMeta?.captured_at) || new Date().toISOString()
  const name = cleanText(media.name) || cleanText(photoMeta?.name) || fallbackName
  const mimeType = cleanText(media.mime_type) || cleanText(photoMeta?.mime_type) || 'image/jpeg'
  const watermarkText = cleanText(media.watermark_text) || cleanText(photoMeta?.watermark_text) || buildWatermarkText(cleanText(draft.property_code), username, capturedAt)
  return {
    file: { uri: media.local_uri || '', name, mimeType },
    metadata: {
      task_id: cleanText(draft.task_id),
      media_id: cleanText(media.media_id),
      captured_at: capturedAt,
      property_code: cleanText(draft.property_code) || undefined,
      watermark: watermarkText ? '1' : '',
      watermark_text: watermarkText || '',
    },
  }
}

async function markMedia(draft: CleaningConsumablesDraft, mediaId: string, patch: Partial<CleaningConsumablesMedia>) {
  return updateCleaningConsumablesDraft(draft.task_id, (current) => ({
    ...current,
    media: current.media.map((media) => media.media_id === mediaId ? { ...media, ...patch } : media),
  }))
}

async function uploadOneMedia(token: string, username: string, draft: CleaningConsumablesDraft, media: CleaningConsumablesMedia, index: number): Promise<CleaningConsumablesDraft> {
  if (media.upload_status === 'uploaded' && cleanText(media.remote_url)) return (await getCleaningConsumablesDraft(draft.task_id)) || draft
  const localUri = cleanText(media.local_uri)
  if (!localUri || !isLocalCleaningConsumablesPhotoUri(localUri)) {
    const error: any = new Error(`照片 ${media.slot} 的本地文件已丢失，请重新拍摄`)
    error.code = 'LOCAL_MEDIA_MISSING'
    error.media_id = media.media_id
    error.slot = media.slot
    await markMedia(draft, media.media_id, { upload_status: 'missing', upload_error_code: error.code })
    throw error
  }

  await markMedia(draft, media.media_id, { upload_status: 'uploading', upload_error_code: null })
  try {
    const latest = await getCleaningConsumablesDraft(draft.task_id)
    if (!latest) throw new Error('补品草稿不存在，请保留照片后重试')
    const { file, metadata } = toUploadMeta(latest, username, media, `${media.slot.replace(/[^a-z0-9_-]+/gi, '-') || 'photo'}-${index + 1}.jpg`)
    const up = await withLocalMediaLock(localUri, () => uploadCleaningMedia(token, file, {
      ...metadata,
      purpose: media.media_kind === 'completion_photo'
        ? 'completion_photo'
        : media.slot.startsWith('item:') ? 'consumable_stock_photo' : 'consumable_scene_photo',
      media_id: media.media_id,
    }, { skipImageCompression: true }))
    const uploadedReference = cleaningMediaReference(up)
    if (!uploadedReference) throw new Error('照片上传成功但未返回远端地址')

    // The remote URL and uploaded state are durable before local deletion.
    const saved = await markMedia(latest, media.media_id, {
      remote_url: uploadedReference,
      upload_status: 'uploaded',
      upload_error_code: null,
    })
    if (!saved) throw new Error('照片上传进度保存失败，请保留本地文件后重试')

    return saved
  } catch (error) {
    const code = errorCode(error)
    await markMedia(draft, media.media_id, {
      upload_status: ['LOCAL_MEDIA_MISSING', 'MISSING_LOCAL_FILE'].includes(code) ? 'missing' : 'failed',
      upload_error_code: code,
    }).catch(() => {})
    throw error
  }
}

function completionAreaOf(media: CleaningConsumablesMedia) {
  const explicit = cleanText(media.area)
  if (explicit) return explicit as CompletionPhotoArea
  const parts = cleanText(media.slot).split(':')
  return cleanText(parts[1]) as CompletionPhotoArea
}

function buildCompletionPhotoPayload(draft: CleaningConsumablesDraft) {
  return draft.media
    .filter((media) => media.media_kind === 'completion_photo' && cleanText(media.remote_url))
    .map((media) => ({
      area: completionAreaOf(media),
      url: cleanText(media.remote_url),
      captured_at: cleanText(media.captured_at) || undefined,
    }))
    .filter((item) => !!item.area && !!item.url)
}

function buildRestockProofPayload(draft: CleaningConsumablesDraft) {
  return draft.items
    .filter((item) => item.restock_status === 'restocked' || item.restock_status === 'carry_forward')
    .map((item) => {
      const proofUrls = (item.photo_urls || []).map((url) => cleanText(url)).filter(Boolean)
      return {
        item_id: item.item_id,
        label: cleanText(item.label) || null,
        status: item.restock_status as 'restocked' | 'carry_forward',
        qty: Number(item.qty || 0) || undefined,
        note: cleanText(item.note) || undefined,
        proof_url: item.restock_status === 'restocked' ? proofUrls[0] || null : null,
        proof_urls: item.restock_status === 'restocked' && proofUrls.length ? proofUrls : undefined,
      }
    })
}

function hasPendingConsumablesContent(draft: CleaningConsumablesDraft) {
  return draft.items.length > 0
    || !!cleanText(draft.living_room_photo_url)
    || !!cleanText(draft.remote_ac_photo_url)
    || !!cleanText(draft.remote_tv_photo_url)
    || Object.values(draft.extra_photo_urls || {}).some((url) => !!cleanText(url))
    || draft.media.some((media) => media.media_kind !== 'completion_photo')
}

function buildSubmitPayload(draft: CleaningConsumablesDraft) {
  const livingRoomPhotoUrl = cleanText(draft.living_room_photo_url)
  const out = draft.items.map((item) => ({
    item_id: item.item_id,
    status: (cleanText(item.status) || 'ok') as 'ok' | 'low',
    qty: cleanText(item.status) === 'low' ? Number(item.qty || 0) || undefined : undefined,
    note: cleanText(item.note) || undefined,
    photo_url: cleanText(item.photo_url) || undefined,
    photo_urls: Array.isArray(item.photo_urls) && item.photo_urls.length ? item.photo_urls.map((url) => cleanText(url)).filter(Boolean) : undefined,
  }))

  if (cleanText(draft.remote_ac_photo_url)) out.push({ item_id: 'remote_ac', status: 'ok', photo_url: cleanText(draft.remote_ac_photo_url) } as any)
  if (cleanText(draft.remote_tv_photo_url)) out.push({ item_id: 'remote_tv', status: 'ok', photo_url: cleanText(draft.remote_tv_photo_url) } as any)
  for (const [photoId, url] of Object.entries(draft.extra_photo_urls || {})) {
    if (cleanText(url)) out.push({ item_id: photoId, status: 'ok', photo_url: cleanText(url) } as any)
  }
  return {
    ...(livingRoomPhotoUrl ? { living_room_photo_url: livingRoomPhotoUrl } : {}),
    items: out,
  }
}

async function materializeDraftForSubmit(token: string, username: string, initialDraft: CleaningConsumablesDraft) {
  let draft = await updateCleaningConsumablesDraft(initialDraft.task_id, (current) => ({
    ...current,
    submit_status: 'uploading',
    pending_submit: true,
    last_error_code: null,
    last_error_message: null,
  })) || initialDraft

  const uploadMedia = draft.media.filter((media) => {
    if (media.media_kind === 'completion_photo') return draft.completion_submit_enabled === true
    return draft.submit_consumables !== false && !draft.consumables_business_saved
  })
  for (let i = 0; i < uploadMedia.length; i += 1) {
    const media = uploadMedia[i]
    draft = await uploadOneMedia(token, username, draft, media, i)
  }

  draft = await updateCleaningConsumablesDraft(draft.task_id, (current) => ({
    ...current,
    submit_status: 'submitting',
    pending_submit: true,
  })) || draft
  return { draft, payload: buildSubmitPayload(draft) }
}

async function recordFailure(taskId: string, error: any) {
  const code = errorCode(error)
  const terminal = isTerminalError(error)
  const retryable = isRetryableError(error)
  const current = await getCleaningConsumablesDraft(taskId)
  const retryCount = (current?.retry_count || 0) + 1
  const boundedRetryCount = Math.min(retryCount, MAX_RETRIES)
  const shouldWait = retryable && boundedRetryCount <= MAX_RETRIES
  const status = terminal ? 'blocked' : shouldWait ? 'waiting_sync' : 'failed'
  const nextRetryAt = shouldWait ? new Date(Date.now() + retryDelayMs(boundedRetryCount)).toISOString() : null
  await updateCleaningConsumablesDraft(taskId, (draft) => ({
    ...draft,
    submit_status: status,
    pending_submit: true,
    retry_count: boundedRetryCount,
    next_retry_at: nextRetryAt,
    last_error_code: code,
    last_error_message: errorMessage(error),
  })).catch(() => {})
  await updateQueueItem(taskId, {
    status: terminal ? 'blocked' : shouldWait ? 'active' : 'failed',
    retry_count: boundedRetryCount,
    next_retry_at: nextRetryAt,
    last_error_code: code,
    last_error_message: errorMessage(error),
  })
}

export async function processCleaningConsumablesSubmitQueue(token: string, username = ''): Promise<CleaningConsumablesQueueResult> {
  if (processing) return { processed: 0, remaining: (await loadQueue()).length, succeeded_task_ids: [] }
  processing = true
  try {
    const queueItems = await loadQueue()
    let processed = 0
    const succeededTaskIds: string[] = []
    for (const item of queueItems) {
      if (item.status !== 'active') continue
      if (item.next_retry_at && new Date(item.next_retry_at).getTime() > Date.now()) continue
      const draft = await getCleaningConsumablesDraft(item.task_id)
      if (!draft) {
        await dequeueCleaningConsumablesSubmit(item.task_id)
        continue
      }
      if (draft.submit_status === 'synced') {
        await dequeueCleaningConsumablesSubmit(item.task_id)
        continue
      }
      if (draft.submit_status === 'blocked' || draft.submit_status === 'failed') {
        await updateQueueItem(item.task_id, { status: draft.submit_status === 'blocked' ? 'blocked' : 'failed' })
        continue
      }
      try {
        const materialized = await materializeDraftForSubmit(token, username, draft)
        let latestDraft = materialized.draft
        if (latestDraft.submit_consumables !== false && !latestDraft.consumables_business_saved) {
          await submitCleaningConsumables(token, item.task_id, {
            ...(materialized.payload as any),
            submit_id: latestDraft.submit_id,
          })
          latestDraft = await updateCleaningConsumablesDraft(item.task_id, (current) => ({
            ...current,
            consumables_business_saved: true,
          })) || latestDraft
        }
        if (latestDraft.restock_submit_enabled && !latestDraft.restock_business_saved) {
          const restockItems = buildRestockProofPayload(latestDraft)
          if (!restockItems.length) {
            const error: any = new Error('补货记录为空，请重新选择补货结果后重试')
            error.code = 'RESTOCK_RECORD_MISSING'
            throw error
          }
          await saveRestockProof(token, item.task_id, {
            items: restockItems,
            submit_id: latestDraft.submit_id,
            step_key: 'self_complete_restock',
          })
          latestDraft = await updateCleaningConsumablesDraft(item.task_id, (current) => ({
            ...current,
            restock_business_saved: true,
          })) || latestDraft
        }
        if (latestDraft.completion_submit_enabled && !latestDraft.completion_business_saved) {
          await saveCompletionPhotos(token, item.task_id, {
            items: buildCompletionPhotoPayload(latestDraft),
            submit_id: latestDraft.submit_id,
            step_key: 'completion_photos',
          })
          latestDraft = await updateCleaningConsumablesDraft(item.task_id, (current) => ({
            ...current,
            completion_business_saved: true,
          })) || latestDraft
        }
        const retainDraftForConsumables = latestDraft.submit_consumables === false && hasPendingConsumablesContent(latestDraft)
        const retainCompletionDraft = latestDraft.media.some((media) => media.media_kind === 'completion_photo')
          && !latestDraft.completion_submit_enabled
          && !latestDraft.completion_business_saved
        // Keep the private local copy until the page has had a chance to
        // replace its file:// reference with the saved remote key. The
        // existing 24-hour orphan-media housekeeping removes unreferenced
        // copies later; deleting here makes an already-rendered Android
        // thumbnail disappear immediately after a successful upload.
        if (retainDraftForConsumables || retainCompletionDraft) {
          await updateCleaningConsumablesDraft(item.task_id, (current) => ({
            ...current,
            media: current.media.filter((media) => (
              (retainDraftForConsumables && media.media_kind !== 'completion_photo')
              || (retainCompletionDraft && media.media_kind === 'completion_photo')
            )),
            completion_submit_enabled: retainCompletionDraft || retainDraftForConsumables ? false : current.completion_submit_enabled,
            completion_business_saved: retainCompletionDraft || retainDraftForConsumables ? false : current.completion_business_saved,
            submit_status: 'draft',
            pending_submit: false,
            last_error_code: null,
            last_error_message: null,
            next_retry_at: null,
          })).catch(() => null)
          await updateQueueItem(item.task_id, { status: 'synced', next_retry_at: null }).catch(() => null)
          await dequeueCleaningConsumablesSubmit(item.task_id).catch(() => null)
          succeededTaskIds.push(item.task_id)
          processed += 1
          continue
        }
        await updateCleaningConsumablesDraft(item.task_id, (current) => ({
          ...current,
          submit_status: 'synced',
          pending_submit: false,
          last_error_code: null,
          last_error_message: null,
          next_retry_at: null,
        })).catch(() => null)
        await updateQueueItem(item.task_id, { status: 'synced', next_retry_at: null }).catch(() => null)
        await removeCleaningConsumablesDraft(item.task_id).catch(() => null)
        await dequeueCleaningConsumablesSubmit(item.task_id).catch(() => null)
        succeededTaskIds.push(item.task_id)
        processed += 1
      } catch (error) {
        await recordFailure(item.task_id, error)
      }
    }
    const remaining = (await loadQueue()).filter((item) => item.status !== 'synced').length
    return { processed, remaining, succeeded_task_ids: succeededTaskIds }
  } finally {
    processing = false
  }
}

export async function enqueueAndProcessCleaningConsumablesSubmit(token: string, username: string, taskId: string) {
  await enqueueCleaningConsumablesSubmit(taskId)
  return processCleaningConsumablesSubmitQueue(token, username)
}
