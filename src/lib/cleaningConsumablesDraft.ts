import { Directory, File, Paths } from 'expo-file-system'
import { compressImageForLocalStorage, isCompressibleImageMimeType } from './imageCompression'
import { draftMimeTypeFrom } from './localMediaDrafts'
import { isLocalMediaLocked } from './localMediaLocks'
import { getJson, remove, setJson } from './storage'

export type CleaningConsumablesUploadStatus = 'local' | 'uploading' | 'uploaded' | 'missing' | 'failed'

export type CleaningConsumablesSubmitStatus =
  | 'draft'
  | 'ready_to_submit'
  | 'uploading'
  | 'submitting'
  | 'waiting_sync'
  | 'failed'
  | 'blocked'
  | 'synced'

export type CleaningConsumablesDraftItem = {
  item_id: string
  label?: string | null
  qty?: number | null
  note?: string | null
  status?: string | null
  restock_status?: 'restocked' | 'carry_forward' | 'unavailable' | null
  photo_url?: string | null
  photo_urls?: string[]
}

export type CleaningConsumablesPhotoMetaMap = Record<string, {
  name?: string
  mime_type?: string
  captured_at?: string
  watermark_text?: string
}>

export type CleaningConsumablesMedia = {
  media_id: string
  slot: string
  media_kind?: 'consumable' | 'completion_photo'
  area?: string | null
  local_uri?: string | null
  remote_url?: string | null
  upload_status: CleaningConsumablesUploadStatus
  upload_error_code?: string | null
  name?: string | null
  mime_type?: string | null
  captured_at?: string | null
  watermark_text?: string | null
}

export type CleaningConsumablesDraft = {
  task_id: string
  draft_id: string
  queue_item_id: string
  submit_id: string
  revision: number
  updated_at: string
  property_code?: string | null
  pending_submit?: boolean
  submit_consumables?: boolean
  restock_submit_enabled?: boolean
  completion_submit_enabled?: boolean
  consumables_business_saved?: boolean
  restock_business_saved?: boolean
  completion_business_saved?: boolean
  submit_status: CleaningConsumablesSubmitStatus
  last_error_code?: string | null
  last_error_message?: string | null
  retry_count?: number
  next_retry_at?: string | null
  living_room_photo_url?: string | null
  remote_ac_photo_url?: string | null
  remote_tv_photo_url?: string | null
  extra_photo_urls?: Record<string, string | null>
  items: CleaningConsumablesDraftItem[]
  photo_meta?: CleaningConsumablesPhotoMetaMap
  media: CleaningConsumablesMedia[]
}

export type CleaningConsumablesDraftPatch = Partial<Omit<CleaningConsumablesDraft, 'task_id' | 'updated_at'>> & {
  items?: CleaningConsumablesDraftItem[]
}

export type CleaningConsumablesCleanupTask = {
  uri: string
  queued_at: string
  attempts: number
}

const DRAFT_KEY_PREFIX = 'mzstay.cleaning_consumables_draft.v2:'
const LEGACY_DRAFT_KEY_PREFIX = 'mzstay.cleaning_consumables_draft.v1:'
export const CLEANING_CONSUMABLES_CLEANUP_STORAGE_KEY = 'mzstay.cleaning_consumables_media_cleanup.v1'

function draftKey(taskId: string) {
  return `${DRAFT_KEY_PREFIX}${String(taskId || '').trim()}`
}

function legacyDraftKey(taskId: string) {
  return `${LEGACY_DRAFT_KEY_PREFIX}${String(taskId || '').trim()}`
}

function cleanText(value: any) {
  return String(value || '').trim()
}

function makeStableId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function isLocalUri(value: any) {
  return cleanText(value).startsWith('file://')
}

function normalizePhotoList(raw: any, fallback?: any) {
  const list = Array.isArray(raw) ? raw.map((item) => cleanText(item)).filter(Boolean) : []
  const first = cleanText(fallback)
  if (first) list.unshift(first)
  return Array.from(new Set(list))
}

function normalizeItems(raw: any) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      const itemId = cleanText(item?.item_id)
      if (!itemId) return null
      const note = cleanText(item?.note)
      const status = cleanText(item?.status) || null
      const qty0 = item?.qty == null || cleanText(item?.qty) === '' ? null : Number(item.qty)
      const qty = Number.isFinite(qty0) ? qty0 : null
      const photoUrls = normalizePhotoList(item?.photo_urls, item?.photo_url)
      return {
        item_id: itemId,
        label: cleanText(item?.label) || null,
        qty,
        note: note || null,
        status,
        restock_status:
          item?.restock_status === 'restocked' ||
          item?.restock_status === 'carry_forward' ||
          item?.restock_status === 'unavailable'
            ? item.restock_status
            : null,
        photo_url: photoUrls[0] || null,
        photo_urls: photoUrls,
      } satisfies CleaningConsumablesDraftItem
    })
    .filter(Boolean) as CleaningConsumablesDraftItem[]
}

function normalizeExtraPhotoUrls(raw: any) {
  if (!raw || typeof raw !== 'object') return {}
  return Object.fromEntries(
    Object.entries(raw)
      .map(([key, value]) => [cleanText(key), cleanText(value) || null] as const)
      .filter(([key]) => !!key),
  )
}

function normalizePhotoMeta(raw: any): CleaningConsumablesPhotoMetaMap {
  if (!raw || typeof raw !== 'object') return {}
  const next: CleaningConsumablesPhotoMetaMap = {}
  for (const [uri, meta] of Object.entries(raw)) {
    const key = cleanText(uri)
    if (!key) continue
    next[key] = {
      name: cleanText((meta as any)?.name) || undefined,
      mime_type: cleanText((meta as any)?.mime_type) || undefined,
      captured_at: cleanText((meta as any)?.captured_at) || undefined,
      watermark_text: cleanText((meta as any)?.watermark_text) || undefined,
    }
  }
  return next
}

function normalizeSubmitStatus(raw: any, pendingSubmit: boolean) {
  const status = cleanText(raw)
  if (status === 'draft' || status === 'ready_to_submit' || status === 'uploading' || status === 'submitting' || status === 'waiting_sync' || status === 'failed' || status === 'blocked' || status === 'synced') {
    return status as CleaningConsumablesSubmitStatus
  }
  return pendingSubmit ? 'waiting_sync' : 'draft'
}

function normalizeUploadStatus(raw: any, localUri: string, remoteUrl: string) {
  const status = cleanText(raw) as CleaningConsumablesUploadStatus
  if (remoteUrl) return 'uploaded'
  if (!localUri) return 'missing'
  if (status === 'missing') return 'missing'
  if (status === 'failed') return 'failed'
  return 'local'
}

function normalizeMedia(raw: any): CleaningConsumablesMedia[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((entry) => {
      const mediaId = cleanText(entry?.media_id) || makeStableId('media')
      const slot = cleanText(entry?.slot)
      const localUri = cleanText(entry?.local_uri)
      const remoteUrl = cleanText(entry?.remote_url)
      if (!slot || (!localUri && !remoteUrl)) return null
      return {
        media_id: mediaId,
        slot,
        media_kind: entry?.media_kind === 'completion_photo' ? 'completion_photo' : 'consumable',
        area: cleanText(entry?.area) || null,
        local_uri: localUri || null,
        remote_url: remoteUrl || null,
        upload_status: normalizeUploadStatus(entry?.upload_status, localUri, remoteUrl),
        upload_error_code: cleanText(entry?.upload_error_code) || null,
        name: cleanText(entry?.name) || null,
        mime_type: cleanText(entry?.mime_type) || null,
        captured_at: cleanText(entry?.captured_at) || null,
        watermark_text: cleanText(entry?.watermark_text) || null,
      } satisfies CleaningConsumablesMedia
    })
    .filter(Boolean) as CleaningConsumablesMedia[]
}

type LegacyPhotoEntry = {
  slot: string
  uri: string
  meta?: CleaningConsumablesPhotoMetaMap[string]
}

function collectLegacyPhotoEntries(raw: any): LegacyPhotoEntry[] {
  const entries: LegacyPhotoEntry[] = []
  const items = normalizeItems(raw?.items)
  for (const item of items) {
    for (const [index, uri] of (item.photo_urls || []).entries()) {
      const value = cleanText(uri)
      if (!value) continue
      entries.push({
        slot: `item:${item.item_id}:${index}`,
        uri: value,
        meta: normalizePhotoMeta(raw?.photo_meta)[value],
      })
    }
  }
  const topLevel: [string, any][] = [
    ['living_room', raw?.living_room_photo_url],
    ['remote_ac', raw?.remote_ac_photo_url],
    ['remote_tv', raw?.remote_tv_photo_url],
  ]
  for (const [slot, rawUri] of topLevel) {
    const uri = cleanText(rawUri)
    if (!uri) continue
    entries.push({ slot, uri, meta: normalizePhotoMeta(raw?.photo_meta)[uri] })
  }
  for (const [key, rawUri] of Object.entries(normalizeExtraPhotoUrls(raw?.extra_photo_urls))) {
    const uri = cleanText(rawUri)
    if (!uri) continue
    entries.push({ slot: `extra:${key}`, uri, meta: normalizePhotoMeta(raw?.photo_meta)[uri] })
  }
  return entries
}

function mediaFromLegacy(raw: any): CleaningConsumablesMedia[] {
  return collectLegacyPhotoEntries(raw).map((entry) => ({
    media_id: makeStableId('media'),
    slot: entry.slot,
    media_kind: 'consumable' as const,
    area: null,
    local_uri: isLocalUri(entry.uri) ? entry.uri : null,
    remote_url: isLocalUri(entry.uri) ? null : entry.uri,
    upload_status: isLocalUri(entry.uri) ? 'local' : 'uploaded',
    upload_error_code: null,
    name: entry.meta?.name || null,
    mime_type: entry.meta?.mime_type || null,
    captured_at: entry.meta?.captured_at || null,
    watermark_text: entry.meta?.watermark_text || null,
  }))
}

function mediaDisplayUri(media: CleaningConsumablesMedia) {
  return cleanText(media.remote_url) || cleanText(media.local_uri)
}

function applyMediaToLegacy(draft: CleaningConsumablesDraft): CleaningConsumablesDraft {
  const items = draft.items.map((item) => ({ ...item, photo_url: null as string | null, photo_urls: [] as string[] }))
  const itemMap = new Map(items.map((item) => [item.item_id, item]))
  const extraPhotoUrls: Record<string, string | null> = {}
  let livingRoomPhotoUrl: string | null = null
  let remoteAcPhotoUrl: string | null = null
  let remoteTvPhotoUrl: string | null = null

  for (const media of draft.media) {
    if (media.media_kind === 'completion_photo') continue
    const uri = mediaDisplayUri(media)
    if (!uri) continue
    const itemMatch = /^item:(.*):(\d+)$/.exec(media.slot)
    if (itemMatch) {
      const item = itemMap.get(itemMatch[1])
      if (item) {
        const index = Number(itemMatch[2])
        item.photo_urls = item.photo_urls || []
        item.photo_urls[index] = uri
        item.photo_urls = item.photo_urls.filter(Boolean)
        item.photo_url = item.photo_urls[0] || null
      }
      continue
    }
    if (media.slot === 'living_room') livingRoomPhotoUrl = uri
    else if (media.slot === 'remote_ac') remoteAcPhotoUrl = uri
    else if (media.slot === 'remote_tv') remoteTvPhotoUrl = uri
    else if (media.slot.startsWith('extra:')) extraPhotoUrls[media.slot.slice('extra:'.length)] = uri
  }

  return {
    ...draft,
    items,
    living_room_photo_url: livingRoomPhotoUrl,
    remote_ac_photo_url: remoteAcPhotoUrl,
    remote_tv_photo_url: remoteTvPhotoUrl,
    extra_photo_urls: extraPhotoUrls,
  }
}

function mergeMediaWithLegacy(currentMedia: CleaningConsumablesMedia[], raw: any, currentStatus: CleaningConsumablesSubmitStatus) {
  const incoming = collectLegacyPhotoEntries(raw)
  const currentBySlot = new Map(currentMedia.map((media) => [media.slot, media]))
  const legacyMedia = incoming.map((entry) => {
    const existing = currentBySlot.get(entry.slot)
    const isSameUri = existing && (entry.uri === existing.local_uri || entry.uri === existing.remote_url)
    if (existing && isSameUri) return { ...existing }

    // A screen may still hold the pre-upload legacy URL while the queue has
    // already checkpointed the remote URL. Do not regress a non-draft item.
    if (existing && currentStatus !== 'draft' && existing.remote_url) return { ...existing }

    return {
      media_id: existing && existing.upload_status !== 'uploaded' ? existing.media_id : makeStableId('media'),
      slot: entry.slot,
      media_kind: 'consumable' as const,
      area: null,
      local_uri: isLocalUri(entry.uri) ? entry.uri : null,
      remote_url: isLocalUri(entry.uri) ? null : entry.uri,
      upload_status: isLocalUri(entry.uri) ? 'local' : 'uploaded',
      upload_error_code: null,
      name: entry.meta?.name || null,
      mime_type: entry.meta?.mime_type || null,
      captured_at: entry.meta?.captured_at || null,
      watermark_text: entry.meta?.watermark_text || null,
    } satisfies CleaningConsumablesMedia
  })
  return [
    ...legacyMedia,
    ...currentMedia.filter((media) => media.media_kind === 'completion_photo'),
  ]
}

function normalizeDraft(taskId: string, raw: any): CleaningConsumablesDraft | null {
  if (!raw || typeof raw !== 'object') return null
  const pendingSubmit = !!raw.pending_submit
  const submitStatus = normalizeSubmitStatus(raw.submit_status, pendingSubmit)
  const items = normalizeItems(raw.items)
  const base: CleaningConsumablesDraft = {
    task_id: cleanText(raw.task_id) || cleanText(taskId),
    draft_id: cleanText(raw.draft_id) || makeStableId('draft'),
    queue_item_id: cleanText(raw.queue_item_id) || makeStableId('queue'),
    submit_id: cleanText(raw.submit_id) || makeStableId('submit'),
    revision: Number.isFinite(Number(raw.revision)) ? Number(raw.revision) : 0,
    updated_at: cleanText(raw.updated_at) || new Date().toISOString(),
    property_code: cleanText(raw.property_code) || null,
    pending_submit: submitStatus !== 'draft' && submitStatus !== 'synced',
    submit_consumables: raw.submit_consumables == null ? true : raw.submit_consumables !== false,
    restock_submit_enabled: raw.restock_submit_enabled === true,
    completion_submit_enabled: raw.completion_submit_enabled === true,
    consumables_business_saved: raw.consumables_business_saved === true,
    restock_business_saved: raw.restock_business_saved === true,
    completion_business_saved: raw.completion_business_saved === true,
    submit_status: submitStatus,
    last_error_code: cleanText(raw.last_error_code) || null,
    last_error_message: cleanText(raw.last_error_message) || null,
    retry_count: Number.isFinite(Number(raw.retry_count)) ? Number(raw.retry_count) : 0,
    next_retry_at: cleanText(raw.next_retry_at) || null,
    living_room_photo_url: cleanText(raw.living_room_photo_url) || null,
    remote_ac_photo_url: cleanText(raw.remote_ac_photo_url) || null,
    remote_tv_photo_url: cleanText(raw.remote_tv_photo_url) || null,
    extra_photo_urls: normalizeExtraPhotoUrls(raw.extra_photo_urls),
    items,
    photo_meta: normalizePhotoMeta(raw.photo_meta),
    media: normalizeMedia(raw.media),
  }

  if (!base.media.length) base.media = mediaFromLegacy(base)
  return applyMediaToLegacy(base)
}

async function readStoredDraft(taskId: string) {
  const key = cleanText(taskId)
  if (!key) return null
  const current = await getJson<any>(draftKey(key))
  if (current) return normalizeDraft(key, current)
  const legacy = await getJson<any>(legacyDraftKey(key))
  return normalizeDraft(key, legacy)
}

function statusFromPatch(current: CleaningConsumablesDraft | null, patch: CleaningConsumablesDraftPatch) {
  if (patch.submit_status) return patch.submit_status
  if (patch.pending_submit === true) {
    if (current && current.submit_status !== 'draft' && current.submit_status !== 'synced') return current.submit_status
    return 'waiting_sync'
  }
  if (patch.pending_submit === false) return 'draft'
  return current?.submit_status || 'draft'
}

function buildDraft(taskId: string, patch: CleaningConsumablesDraftPatch, current: CleaningConsumablesDraft | null) {
  const normalizedPatch = normalizeDraft(taskId, {
    ...patch,
    task_id: taskId,
    updated_at: new Date().toISOString(),
    submit_status: statusFromPatch(current, patch),
  })
  if (!normalizedPatch) return null

  const hasMediaPatch = Object.prototype.hasOwnProperty.call(patch, 'media')
  const hasItemsPatch = Object.prototype.hasOwnProperty.call(patch, 'items')
  const hasPhotoMetaPatch = Object.prototype.hasOwnProperty.call(patch, 'photo_meta')
  const hasExtraPhotoPatch = Object.prototype.hasOwnProperty.call(patch, 'extra_photo_urls')
  const hasSubmitConsumablesPatch = Object.prototype.hasOwnProperty.call(patch, 'submit_consumables')
  const hasRestockEnabledPatch = Object.prototype.hasOwnProperty.call(patch, 'restock_submit_enabled')
  const hasCompletionEnabledPatch = Object.prototype.hasOwnProperty.call(patch, 'completion_submit_enabled')
  const hasConsumablesSavedPatch = Object.prototype.hasOwnProperty.call(patch, 'consumables_business_saved')
  const hasRestockSavedPatch = Object.prototype.hasOwnProperty.call(patch, 'restock_business_saved')
  const hasCompletionSavedPatch = Object.prototype.hasOwnProperty.call(patch, 'completion_business_saved')
  const media = hasMediaPatch
    ? normalizedPatch.media
    : mergeMediaWithLegacy(current?.media || [], normalizedPatch, current?.submit_status || 'draft')
  const submitStatus = statusFromPatch(current, patch)
  const next: CleaningConsumablesDraft = {
    ...(current || normalizedPatch),
    ...normalizedPatch,
    items: hasItemsPatch ? normalizedPatch.items : current?.items || normalizedPatch.items,
    photo_meta: hasPhotoMetaPatch ? normalizedPatch.photo_meta : current?.photo_meta || normalizedPatch.photo_meta,
    extra_photo_urls: hasExtraPhotoPatch ? normalizedPatch.extra_photo_urls : current?.extra_photo_urls || normalizedPatch.extra_photo_urls,
    submit_consumables: hasSubmitConsumablesPatch ? normalizedPatch.submit_consumables : current?.submit_consumables ?? normalizedPatch.submit_consumables,
    restock_submit_enabled: hasRestockEnabledPatch ? normalizedPatch.restock_submit_enabled : current?.restock_submit_enabled ?? normalizedPatch.restock_submit_enabled,
    completion_submit_enabled: hasCompletionEnabledPatch ? normalizedPatch.completion_submit_enabled : current?.completion_submit_enabled ?? normalizedPatch.completion_submit_enabled,
    consumables_business_saved: hasConsumablesSavedPatch ? normalizedPatch.consumables_business_saved : current?.consumables_business_saved ?? normalizedPatch.consumables_business_saved,
    restock_business_saved: hasRestockSavedPatch ? normalizedPatch.restock_business_saved : current?.restock_business_saved ?? normalizedPatch.restock_business_saved,
    completion_business_saved: hasCompletionSavedPatch ? normalizedPatch.completion_business_saved : current?.completion_business_saved ?? normalizedPatch.completion_business_saved,
    draft_id: cleanText(patch.draft_id) || current?.draft_id || normalizedPatch.draft_id,
    queue_item_id: cleanText(patch.queue_item_id) || current?.queue_item_id || normalizedPatch.queue_item_id,
    submit_id: cleanText(patch.submit_id) || current?.submit_id || normalizedPatch.submit_id,
    revision: (current?.revision || 0) + 1,
    submit_status: submitStatus,
    pending_submit: submitStatus !== 'draft' && submitStatus !== 'synced',
    media,
  }
  return applyMediaToLegacy(next)
}

async function writeVerifiedDraft(draft: CleaningConsumablesDraft) {
  const payload = {
    ...draft,
    updated_at: new Date().toISOString(),
  }
  await setJson(draftKey(draft.task_id), payload)
  const verified = await getJson<any>(draftKey(draft.task_id))
  if (!verified || verified.draft_id !== payload.draft_id || Number(verified.revision) !== Number(payload.revision)) {
    throw new Error('本地草稿写入校验失败，请保留照片后重试')
  }
  // Successful v2 persistence is the migration boundary. Only then can the
  // legacy snapshot be removed.
  await remove(legacyDraftKey(draft.task_id))
  return normalizeDraft(draft.task_id, verified) as CleaningConsumablesDraft
}

export async function getCleaningConsumablesDraft(taskId: string) {
  return readStoredDraft(taskId)
}

export async function setCleaningConsumablesDraft(taskId: string, draft: CleaningConsumablesDraftPatch) {
  const key = cleanText(taskId)
  if (!key) return null
  const current = await readStoredDraft(key)
  const next = buildDraft(key, draft, current)
  if (!next) return null
  return writeVerifiedDraft(next)
}

export async function updateCleaningConsumablesDraft(taskId: string, updater: (draft: CleaningConsumablesDraft) => CleaningConsumablesDraft) {
  const current = await readStoredDraft(taskId)
  if (!current) return null
  const next = applyMediaToLegacy({
    ...updater(current),
    task_id: current.task_id,
    draft_id: current.draft_id,
    queue_item_id: current.queue_item_id,
    submit_id: current.submit_id,
    revision: current.revision + 1,
    updated_at: new Date().toISOString(),
  })
  return writeVerifiedDraft(next)
}

export async function removeCleaningConsumablesDraft(taskId: string) {
  const key = cleanText(taskId)
  if (!key) return
  await remove(draftKey(key))
  await remove(legacyDraftKey(key))
}

function ensurePrivateDir() {
  const dir = new Directory(Paths.document, 'mzstay-consumables-media')
  dir.create({ intermediates: true, idempotent: true })
  return dir
}

function fileExists(uri: string) {
  const localUri = cleanText(uri)
  if (!localUri) return false
  try {
    return new File(localUri).exists
  } catch {
    return false
  }
}

function fileExtFrom(name: string, mimeType: string) {
  const ext = cleanText(name).match(/\.[a-z0-9]+$/i)?.[0]
  if (ext) return ext.toLowerCase()
  const mime = cleanText(mimeType).toLowerCase()
  if (mime === 'image/jpeg') return '.jpg'
  if (mime === 'image/png') return '.png'
  if (mime === 'image/webp') return '.webp'
  return ''
}

export function isLocalCleaningConsumablesPhotoUri(raw: any) {
  const value = cleanText(raw)
  return value.startsWith('file://')
}

export function persistCleaningConsumablesPhoto(sourceUri: string, name: string, mimeType: string, prefix: string) {
  const source = cleanText(sourceUri)
  if (!fileExists(source)) throw new Error('原始文件不存在，请重新拍摄')
  const dir = ensurePrivateDir()
  const ext = fileExtFrom(name, mimeType)
  const target = new File(dir, `${cleanText(prefix) || 'photo'}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`)
  new File(source).copy(target)
  if (!target.exists) throw new Error('本地文件保存失败，请重新拍摄')
  return target.uri
}

export async function persistCompressedCleaningConsumablesPhoto(sourceUri: string, name: string, mimeType: string, prefix: string) {
  const resolvedMimeType = draftMimeTypeFrom(name, mimeType, sourceUri)
  const shouldCompress = isCompressibleImageMimeType(resolvedMimeType)
  const preparedUri = shouldCompress
    ? await compressImageForLocalStorage(sourceUri, { maxWidth: 1800, quality: 0.72 })
    : sourceUri
  const finalName = shouldCompress ? `${cleanText(prefix) || 'photo'}-${Date.now()}.jpg` : name
  const finalMimeType = shouldCompress ? 'image/jpeg' : resolvedMimeType
  return {
    localUri: persistCleaningConsumablesPhoto(preparedUri, finalName, finalMimeType, prefix),
    name: finalName,
    mimeType: finalMimeType,
  }
}

export function deleteCleaningConsumablesPhoto(uri: string) {
  const localUri = cleanText(uri)
  if (!isLocalCleaningConsumablesPhotoUri(localUri)) return true
  if (isLocalMediaLocked(localUri)) return false
  try {
    const file = new File(localUri)
    if (file.exists) file.delete()
    return !file.exists
  } catch {
    return false
  }
}

export async function enqueueCleaningConsumablesMediaCleanup(uri: string) {
  const localUri = cleanText(uri)
  if (!isLocalCleaningConsumablesPhotoUri(localUri)) return
  const current = await getJson<CleaningConsumablesCleanupTask[]>(CLEANING_CONSUMABLES_CLEANUP_STORAGE_KEY) || []
  if (current.some((task) => task.uri === localUri)) return
  await setJson(CLEANING_CONSUMABLES_CLEANUP_STORAGE_KEY, [
    ...current,
    { uri: localUri, queued_at: new Date().toISOString(), attempts: 0 },
  ])
}

export async function processCleaningConsumablesMediaCleanup() {
  const current = await getJson<CleaningConsumablesCleanupTask[]>(CLEANING_CONSUMABLES_CLEANUP_STORAGE_KEY) || []
  if (!current.length) return 0
  const remaining: CleaningConsumablesCleanupTask[] = []
  let removed = 0
  for (const task of current) {
    if (deleteCleaningConsumablesPhoto(task.uri)) removed += 1
    else remaining.push({ ...task, attempts: task.attempts + 1 })
  }
  if (remaining.length) await setJson(CLEANING_CONSUMABLES_CLEANUP_STORAGE_KEY, remaining)
  else await remove(CLEANING_CONSUMABLES_CLEANUP_STORAGE_KEY)
  return removed
}
