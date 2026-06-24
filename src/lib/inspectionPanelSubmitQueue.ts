import { ApiError, createPropertyFeedbackBatch, completePropertyFeedbackProject, isRetryableApiError, saveInspectionPhotos, saveRestockProof, uploadCleaningMedia, type InspectionPhotoArea } from './api'
import { normalizeCleaningObjectKey } from './cleaningMedia'
import { clearInspectionPanelFeedbackDraft, type InspectionPanelDeepCleaningDraft, type InspectionPanelFeedbackDraftState } from './inspectionPanelFeedbackDraft'
import { clearInspectionPanelDraft } from './inspectionPanelDraft'
import {
  createInspectionThumbnail,
  inspectionThumbnailExists,
  pruneInspectionThumbnailCache,
} from './inspectionThumbnailCache'
import { deleteDraftMedia, draftMimeTypeFrom, persistDraftMedia } from './localMediaDrafts'
import { getJson, setJson } from './storage'

export type InspectionPanelBatchStatus =
  | 'draft'
  | 'pending_submit'
  | 'syncing'
  | 'partial_failed'
  | 'failed'
  | 'synced'

export type InspectionPanelSubmitStepStatus = 'pending' | 'syncing' | 'succeeded' | 'failed'

export type InspectionPanelBatchMedia = {
  id: string
  local_uri: string | null
  thumbnail_uri?: string | null
  uploaded_key?: string | null
  uploaded_url: string | null
  name: string
  mime_type: string
  captured_at: string
  watermark_text?: string | null
  note?: string | null
}

export type InspectionPanelBatchRestockItem = {
  item_id: string
  label: string
  qty: number | null
  status: 'restocked' | 'carry_forward' | 'unavailable' | null
  source_photo_url: string | null
  proof_media: InspectionPanelBatchMedia[]
  note: string
  origin: 'task' | 'manual'
}

export type InspectionPanelRoomPhotoArea = 'living' | 'sofa' | 'bedroom' | 'kitchen'
export type InspectionPanelRoomPhotoRequirement = 'required' | 'password_only' | 'guest_arrival_confirmed'

export type InspectionPanelBatchSnapshot = {
  task_id: string
  cleaning_task_id: string
  property_id?: string | null
  property_code?: string | null
  submitted_at?: string | null
  room_photo_requirement: InspectionPanelRoomPhotoRequirement
  restock_confirmed_sufficient: boolean
  restock: InspectionPanelBatchRestockItem[]
  room_photos: Record<InspectionPanelRoomPhotoArea, InspectionPanelBatchMedia[]>
  cleaning_issue: InspectionPanelBatchMedia[]
  feedback: InspectionPanelFeedbackDraftState | null
}

export type InspectionPanelValidationIssue = {
  section: 'restock' | 'photos'
  message: string
  item_id?: string
  room_area?: InspectionPanelRoomPhotoArea
}

export type InspectionPanelSubmitStepState = {
  status: InspectionPanelSubmitStepStatus
  started_at?: string | null
  finished_at?: string | null
  error?: string | null
  output?: Record<string, any> | null
}

export type InspectionPanelSubmitQueueItem = {
  submit_id: string
  task_id: string
  cleaning_task_id: string
  property_id?: string | null
  property_code?: string | null
  status: InspectionPanelBatchStatus
  created_at: string
  updated_at: string
  snapshot: InspectionPanelBatchSnapshot
  steps: {
    upload_media: InspectionPanelSubmitStepState
    save_restock_proof: InspectionPanelSubmitStepState
    save_inspection_photos: InspectionPanelSubmitStepState
    create_feedback_batch: InspectionPanelSubmitStepState
    complete_feedback_projects: InspectionPanelSubmitStepState
  }
  last_error?: string | null
}

const STORAGE_KEY = 'mzstay.inspection_panel_submit_queue.v1'
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

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function baseStepState(): InspectionPanelSubmitStepState {
  return { status: 'pending', started_at: null, finished_at: null, error: null, output: null }
}

function baseRoomPhotos() {
  return { living: [], sofa: [], bedroom: [], kitchen: [] } as Record<InspectionPanelRoomPhotoArea, InspectionPanelBatchMedia[]>
}

function isUploadedReference(value: any) {
  const reference = cleanText(value)
  return !!normalizeCleaningObjectKey(reference) || /^https?:\/\//i.test(reference)
}

function isNetworkishError(error: unknown) {
  return isRetryableApiError(error) || String((error as any)?.message || '').toLowerCase().includes('network request failed')
}

function normalizeMedia(item: any): InspectionPanelBatchMedia | null {
  const id = cleanText(item?.id) || makeId('panel_media')
  const localUri = cleanText(item?.local_uri)
  const thumbnailUri = cleanText(item?.thumbnail_uri)
  const uploadedKey = normalizeCleaningObjectKey(item?.uploaded_key)
  const uploadedUrl = cleanText(item?.uploaded_url)
  const name = cleanText(item?.name) || `${id}.jpg`
  const mimeType = cleanText(item?.mime_type) || 'image/jpeg'
  const capturedAt = cleanText(item?.captured_at) || nowIso()
  const watermarkText = cleanText(item?.watermark_text) || null
  const note = cleanText(item?.note) || null
  if (!localUri && !thumbnailUri && !uploadedKey && !uploadedUrl) return null
  return {
    id,
    local_uri: localUri || null,
    thumbnail_uri: thumbnailUri || null,
    uploaded_key: uploadedKey || null,
    uploaded_url: uploadedUrl || null,
    name,
    mime_type: mimeType,
    captured_at: capturedAt,
    watermark_text: watermarkText,
    note,
  }
}

function normalizeRestockItem(item: any): InspectionPanelBatchRestockItem | null {
  const itemId = cleanText(item?.item_id)
  if (!itemId) return null
  const qty0 = item?.qty == null || cleanText(item?.qty) === '' ? null : Number(item.qty)
  const qty = Number.isFinite(qty0) ? qty0 : null
  const status = cleanText(item?.status)
  return {
    item_id: itemId,
    label: cleanText(item?.label) || itemId,
    qty,
    status: status === 'restocked' || status === 'carry_forward' || status === 'unavailable' ? status : null,
    source_photo_url: cleanText(item?.source_photo_url) || null,
    proof_media: Array.isArray(item?.proof_media) ? item.proof_media.map(normalizeMedia).filter(Boolean) as InspectionPanelBatchMedia[] : [],
    note: cleanText(item?.note),
    origin: cleanText(item?.origin) === 'manual' ? 'manual' : 'task',
  }
}

function normalizeSnapshot(raw: any): InspectionPanelBatchSnapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const taskId = cleanText(raw.task_id)
  const cleaningTaskId = cleanText(raw.cleaning_task_id)
  if (!taskId || !cleaningTaskId) return null
  const room = baseRoomPhotos()
  for (const key of Object.keys(room) as InspectionPanelRoomPhotoArea[]) {
    room[key] = Array.isArray(raw?.room_photos?.[key]) ? raw.room_photos[key].map(normalizeMedia).filter(Boolean) as InspectionPanelBatchMedia[] : []
  }
  const roomPhotoRequirement0 = cleanText(raw.room_photo_requirement)
  const roomPhotoRequirement: InspectionPanelRoomPhotoRequirement =
    roomPhotoRequirement0 === 'password_only' || roomPhotoRequirement0 === 'guest_arrival_confirmed'
      ? roomPhotoRequirement0
      : 'required'
  return {
    task_id: taskId,
    cleaning_task_id: cleaningTaskId,
    property_id: cleanText(raw.property_id) || null,
    property_code: cleanText(raw.property_code) || null,
    submitted_at: cleanText(raw.submitted_at) || null,
    room_photo_requirement: roomPhotoRequirement,
    restock_confirmed_sufficient: !!raw.restock_confirmed_sufficient,
    restock: Array.isArray(raw.restock) ? raw.restock.map(normalizeRestockItem).filter(Boolean) as InspectionPanelBatchRestockItem[] : [],
    room_photos: room,
    cleaning_issue: Array.isArray(raw.cleaning_issue) ? raw.cleaning_issue.map(normalizeMedia).filter(Boolean) as InspectionPanelBatchMedia[] : [],
    feedback: raw.feedback && typeof raw.feedback === 'object' ? raw.feedback as InspectionPanelFeedbackDraftState : null,
  }
}

export function findInspectionPanelValidationIssue(snapshot: InspectionPanelBatchSnapshot): InspectionPanelValidationIssue | null {
  if (snapshot.room_photo_requirement === 'password_only') return null
  if (!snapshot.restock.length && !snapshot.restock_confirmed_sufficient) {
    return { section: 'restock', message: '请先确认消耗品是否充足，或添加下次退房要补充的项目。' }
  }
  for (const item of snapshot.restock) {
    if (!item.status) return { section: 'restock', item_id: item.item_id, message: `请确认：${item.label}` }
    if (item.status === 'restocked' && !item.proof_media.length) {
      return { section: 'restock', item_id: item.item_id, message: `请补充：${item.label} 的库存照片` }
    }
  }
  if (snapshot.room_photo_requirement === 'required') {
    const labels: Record<InspectionPanelRoomPhotoArea, string> = {
      living: '客厅',
      sofa: '沙发',
      bedroom: '卧室',
      kitchen: '厨房',
    }
    for (const area of Object.keys(labels) as InspectionPanelRoomPhotoArea[]) {
      if (!(snapshot.room_photos[area] || []).length) {
        return { section: 'photos', room_area: area, message: `请拍摄 ${labels[area]} 检查照片` }
      }
    }
  }
  return null
}

export function validateInspectionPanelSnapshot(snapshot: InspectionPanelBatchSnapshot) {
  return findInspectionPanelValidationIssue(snapshot)?.message || null
}

function normalizeQueueItem(raw: any): InspectionPanelSubmitQueueItem | null {
  if (!raw || typeof raw !== 'object') return null
  const submitId = cleanText(raw.submit_id)
  const taskId = cleanText(raw.task_id)
  const cleaningTaskId = cleanText(raw.cleaning_task_id)
  const snapshot = normalizeSnapshot(raw.snapshot)
  if (!submitId || !taskId || !cleaningTaskId || !snapshot) return null
  const status = cleanText(raw.status)
  const steps = {
    upload_media: raw?.steps?.upload_media || baseStepState(),
    save_restock_proof: raw?.steps?.save_restock_proof || baseStepState(),
    save_inspection_photos: raw?.steps?.save_inspection_photos || baseStepState(),
    create_feedback_batch: raw?.steps?.create_feedback_batch || baseStepState(),
    complete_feedback_projects: raw?.steps?.complete_feedback_projects || baseStepState(),
  }
  const normalizedStatus = status === 'draft' || status === 'pending_submit' || status === 'syncing' || status === 'partial_failed' || status === 'failed' || status === 'synced' ? status : 'draft'
  return {
    submit_id: submitId,
    task_id: taskId,
    cleaning_task_id: cleaningTaskId,
    property_id: cleanText(raw.property_id) || null,
    property_code: cleanText(raw.property_code) || null,
    status: normalizedStatus,
    created_at: cleanText(raw.created_at) || nowIso(),
    updated_at: cleanText(raw.updated_at) || nowIso(),
    snapshot: withUploadedMediaUrls(snapshot, steps.upload_media.output || {}),
    steps,
    last_error: cleanText(raw.last_error) || null,
  }
}

async function loadQueue() {
  const raw = await getJson<InspectionPanelSubmitQueueItem[]>(STORAGE_KEY)
  return Array.isArray(raw) ? raw.map(normalizeQueueItem).filter(Boolean) as InspectionPanelSubmitQueueItem[] : []
}

async function saveQueue(items: InspectionPanelSubmitQueueItem[]) {
  await setJson(STORAGE_KEY, items)
  emit()
}

async function updateQueueItem(taskId: string, updater: (item: InspectionPanelSubmitQueueItem | null) => InspectionPanelSubmitQueueItem | null) {
  const items = await loadQueue()
  const idx = items.findIndex((item) => item.task_id === cleanText(taskId))
  const current = idx >= 0 ? items[idx] : null
  const next = updater(current)
  if (!next) {
    if (idx >= 0) items.splice(idx, 1)
  } else if (idx >= 0) {
    items[idx] = next
  } else {
    items.push(next)
  }
  await saveQueue(items)
  return next
}

function collectBatchMedia(snapshot: InspectionPanelBatchSnapshot) {
  const list: Array<{ key: string; media: InspectionPanelBatchMedia; meta?: Record<string, any> }> = []
  for (const [area, items] of Object.entries(snapshot.room_photos) as Array<[InspectionPanelRoomPhotoArea, InspectionPanelBatchMedia[]]>) {
    for (const item of items) {
      list.push({ key: item.id, media: item, meta: { purpose: 'inspection_photo', area } })
    }
  }
  for (const item of snapshot.cleaning_issue) {
    list.push({ key: item.id, media: item, meta: { purpose: 'inspection_photo', area: 'unclean', note: item.note || undefined } })
  }
  for (const item of snapshot.restock.flatMap((restock) => restock.proof_media)) {
    list.push({ key: item.id, media: item, meta: { purpose: 'restock_proof' } })
  }
  const feedback = snapshot.feedback
  const photoMeta = feedback?.photo_meta || {}
  const feedbackMediaSets = [
    ...(feedback?.maintenanceDrafts || []).flatMap((draft) => [...draft.media, ...draft.completionAfterPhotos]),
    ...(feedback?.deepCleaningDrafts || []).flatMap((draft) => [...draft.media, ...draft.completionAfterPhotos]),
    ...(feedback?.dailyDrafts || []).flatMap((draft) => draft.media),
  ]
  for (const uri of feedbackMediaSets.map((value) => cleanText(value)).filter(Boolean)) {
    if (isUploadedReference(uri)) continue
    const meta = photoMeta[uri]
    list.push({
      key: uri,
      media: {
        id: uri,
        local_uri: uri,
        thumbnail_uri: null,
        uploaded_key: null,
        uploaded_url: null,
        name: cleanText(meta?.name) || `feedback-${Date.now()}.jpg`,
        mime_type: cleanText(meta?.mime_type) || 'image/jpeg',
        captured_at: cleanText(meta?.captured_at) || nowIso(),
        watermark_text: cleanText(meta?.watermark_text) || null,
      },
      meta: { purpose: 'feedback' },
    })
  }
  return list
}

function uploadedUrlFor(item: InspectionPanelSubmitQueueItem, key: string, fallback?: string | null) {
  const output = item.steps.upload_media.output || {}
  const uploaded = cleanText(output[key]?.remote_url) || cleanText(fallback) || cleanText(output[key]?.remote_key)
  return uploaded || null
}

function withUploadedMediaUrls(
  snapshot: InspectionPanelBatchSnapshot,
  uploadedByKey: Record<string, { remote_key?: string; remote_url?: string }>,
  options?: { clearLocalUri?: boolean },
): InspectionPanelBatchSnapshot {
  const applyMedia = (media: InspectionPanelBatchMedia): InspectionPanelBatchMedia => {
    const remoteKey = normalizeCleaningObjectKey(uploadedByKey[media.id]?.remote_key) || normalizeCleaningObjectKey(media.uploaded_key)
    const remoteUrl = cleanText(uploadedByKey[media.id]?.remote_url) || cleanText(media.uploaded_url)
    const remoteReference = remoteKey || remoteUrl
    return {
      ...media,
      local_uri: options?.clearLocalUri && remoteReference ? null : media.local_uri,
      uploaded_key: remoteKey || null,
      uploaded_url: remoteUrl || media.uploaded_url,
    }
  }
  const roomPhotos = baseRoomPhotos()
  for (const key of Object.keys(roomPhotos) as InspectionPanelRoomPhotoArea[]) {
    roomPhotos[key] = (snapshot.room_photos[key] || []).map(applyMedia)
  }
  return {
    ...snapshot,
    room_photos: roomPhotos,
    cleaning_issue: (snapshot.cleaning_issue || []).map(applyMedia),
    restock: (snapshot.restock || []).map((item) => ({
      ...item,
      proof_media: (item.proof_media || []).map(applyMedia),
    })),
  }
}

async function prepareSyncedSnapshot(snapshot: InspectionPanelBatchSnapshot) {
  const originalUris = new Set<string>()
  const thumbnailUris = new Set<string>()
  const applyMedia = async (media: InspectionPanelBatchMedia): Promise<InspectionPanelBatchMedia> => {
    const localUri = cleanText(media.local_uri)
    const remoteReference = normalizeCleaningObjectKey(media.uploaded_key) || cleanText(media.uploaded_url)
    if (!localUri || !remoteReference) return media
    const existingThumbnail = cleanText(media.thumbnail_uri)
    const thumbnailUri = existingThumbnail && inspectionThumbnailExists(existingThumbnail)
      ? existingThumbnail
      : await createInspectionThumbnail(localUri, media.id)
    if (!thumbnailUri) return media
    originalUris.add(localUri)
    thumbnailUris.add(thumbnailUri)
    return {
      ...media,
      local_uri: null,
      thumbnail_uri: thumbnailUri,
    }
  }

  const roomPhotos = baseRoomPhotos()
  for (const key of Object.keys(roomPhotos) as InspectionPanelRoomPhotoArea[]) {
    const next: InspectionPanelBatchMedia[] = []
    for (const media of snapshot.room_photos[key] || []) next.push(await applyMedia(media))
    roomPhotos[key] = next
  }
  const cleaningIssue: InspectionPanelBatchMedia[] = []
  for (const media of snapshot.cleaning_issue || []) cleaningIssue.push(await applyMedia(media))
  const restock: InspectionPanelBatchRestockItem[] = []
  for (const item of snapshot.restock || []) {
    const proofMedia: InspectionPanelBatchMedia[] = []
    for (const media of item.proof_media || []) proofMedia.push(await applyMedia(media))
    restock.push({ ...item, proof_media: proofMedia })
  }

  return {
    snapshot: {
      ...snapshot,
      room_photos: roomPhotos,
      cleaning_issue: cleaningIssue,
      restock,
    },
    originalUris: [...originalUris],
    thumbnailUris: [...thumbnailUris],
  }
}

function buildRestockPayloadFromBatch(item: InspectionPanelSubmitQueueItem) {
  return {
    items: item.snapshot.restock.map((restock) => ({
      item_id: restock.item_id,
      label: cleanText(restock.label) || restock.item_id,
      status: restock.status as 'restocked' | 'carry_forward' | 'unavailable',
      qty: restock.qty == null ? null : Number(restock.qty),
      note: cleanText(restock.note) || null,
      proof_url:
        restock.status === 'unavailable' || restock.status === 'carry_forward'
          ? 'no_photo'
          : cleanText(
              uploadedUrlFor(
                item,
                restock.proof_media.find((media) => !!uploadedUrlFor(item, media.id, media.uploaded_key || media.uploaded_url))?.id || '',
              ),
            ) || null,
      proof_urls:
        restock.status === 'unavailable' || restock.status === 'carry_forward'
          ? []
          : restock.proof_media
              .map((media) => uploadedUrlFor(item, media.id, media.uploaded_key || media.uploaded_url))
              .filter(Boolean) as string[],
    })),
    confirmed_sufficient: item.snapshot.restock_confirmed_sufficient,
  }
}

function buildInspectionPayloadFromBatch(item: InspectionPanelSubmitQueueItem) {
  const items: Array<{ area: InspectionPhotoArea; url: string; note?: string | null; captured_at?: string }> = []
  for (const [area, mediaList] of Object.entries(item.snapshot.room_photos) as Array<[InspectionPanelRoomPhotoArea, InspectionPanelBatchMedia[]]>) {
    for (const media of mediaList) {
      const remoteUrl = uploadedUrlFor(item, media.id, media.uploaded_key || media.uploaded_url)
      if (!remoteUrl) continue
      items.push({ area: area as InspectionPhotoArea, url: remoteUrl, note: null, captured_at: media.captured_at })
    }
  }
  for (const media of item.snapshot.cleaning_issue) {
    const remoteUrl = uploadedUrlFor(item, media.id, media.uploaded_key || media.uploaded_url)
    if (!remoteUrl) continue
    items.push({ area: 'unclean', url: remoteUrl, note: cleanText(media.note) || null, captured_at: media.captured_at })
  }
  return { items }
}

function feedbackRemoteUrls(item: InspectionPanelSubmitQueueItem, urls: string[]) {
  return urls
    .map((value) => {
      const raw = cleanText(value)
      if (!raw) return ''
      if (isUploadedReference(raw)) return raw
      return cleanText(uploadedUrlFor(item, raw))
    })
    .filter(Boolean)
}

async function markStep(taskId: string, step: keyof InspectionPanelSubmitQueueItem['steps'], patch: Partial<InspectionPanelSubmitStepState>, batchStatus?: InspectionPanelBatchStatus, lastError?: string | null) {
  await updateQueueItem(taskId, (current) => {
    if (!current) return current
    return {
      ...current,
      status: batchStatus || current.status,
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

async function markActiveStepFailed(taskId: string, errorMessage: string) {
  await updateQueueItem(taskId, (current) => {
    if (!current) return current
    const activeEntry = (Object.entries(current.steps) as [keyof InspectionPanelSubmitQueueItem['steps'], InspectionPanelSubmitStepState][])
      .find(([, step]) => step.status === 'syncing')
    if (!activeEntry) return current
    const [stepKey, stepState] = activeEntry
    return {
      ...current,
      updated_at: nowIso(),
      steps: {
        ...current.steps,
        [stepKey]: {
          ...stepState,
          status: 'failed',
          finished_at: nowIso(),
          error: errorMessage,
        },
      },
    }
  })
}

async function processUploadMediaStep(token: string, taskId: string) {
  const item = (await getInspectionPanelBatch(taskId))
  if (!item) return
  if (item.steps.upload_media.status === 'succeeded') return
  await markStep(taskId, 'upload_media', { status: 'syncing', started_at: nowIso(), error: null }, 'syncing', null)
  const current = (await getInspectionPanelBatch(taskId))
  if (!current) return
  const uploadedByKey: Record<string, { remote_key?: string; remote_url?: string }> = { ...(current.steps.upload_media.output || {}) }
  for (const entry of collectBatchMedia(current.snapshot)) {
    if (uploadedByKey[entry.key]?.remote_key || uploadedByKey[entry.key]?.remote_url) continue
    const localUri = cleanText(entry.media.local_uri)
    const remoteKey = normalizeCleaningObjectKey(entry.media.uploaded_key)
    const remoteUrl = cleanText(entry.media.uploaded_url)
    if (remoteKey || remoteUrl) {
      uploadedByKey[entry.key] = {
        remote_key: remoteKey || undefined,
        remote_url: remoteUrl || undefined,
      }
      continue
    }
    if (!localUri) continue
    const up = await uploadCleaningMedia(
      token,
      { uri: localUri, name: entry.media.name, mimeType: entry.media.mime_type },
      {
        ...entry.meta,
        captured_at: entry.media.captured_at,
        watermark: cleanText(entry.media.watermark_text) ? '1' : '',
        watermark_text: cleanText(entry.media.watermark_text) || '',
        property_code: cleanText(current.snapshot.property_code) || undefined,
        note: cleanText(entry.media.note) || undefined,
      },
      { skipAuthInvalidation: true },
    )
    uploadedByKey[entry.key] = {
      remote_key: normalizeCleaningObjectKey(up.key) || undefined,
      remote_url: cleanText(up.url) || undefined,
    }
    await markStep(taskId, 'upload_media', { output: uploadedByKey }, 'syncing', null)
  }
  await updateQueueItem(taskId, (latest) => latest ? {
    ...latest,
    updated_at: nowIso(),
    snapshot: withUploadedMediaUrls(latest.snapshot, uploadedByKey),
  } : latest)
  await markStep(taskId, 'upload_media', { status: 'succeeded', finished_at: nowIso(), output: uploadedByKey, error: null }, 'syncing', null)
}

async function processRestockStep(token: string, taskId: string) {
  const item = await getInspectionPanelBatch(taskId)
  if (!item) return
  if (item.steps.save_restock_proof.status === 'succeeded') return
  await markStep(taskId, 'save_restock_proof', { status: 'syncing', started_at: nowIso(), error: null }, 'syncing', null)
  const current = await getInspectionPanelBatch(taskId)
  if (!current) return
  const payload = buildRestockPayloadFromBatch(current)
  await saveRestockProof(token, current.cleaning_task_id, {
    ...payload,
    submit_id: current.submit_id,
    step_key: 'save_restock_proof',
  } as any, { skipAuthInvalidation: true })
  await markStep(taskId, 'save_restock_proof', { status: 'succeeded', finished_at: nowIso(), output: { ok: true }, error: null }, 'syncing', null)
}

async function processInspectionStep(token: string, taskId: string) {
  const item = await getInspectionPanelBatch(taskId)
  if (!item) return
  if (item.steps.save_inspection_photos.status === 'succeeded') return
  await markStep(taskId, 'save_inspection_photos', { status: 'syncing', started_at: nowIso(), error: null }, 'syncing', null)
  const current = await getInspectionPanelBatch(taskId)
  if (!current) return
  const payload = buildInspectionPayloadFromBatch(current)
  await saveInspectionPhotos(token, current.cleaning_task_id, {
    ...payload,
    submit_id: current.submit_id,
    step_key: 'save_inspection_photos',
  } as any, { skipAuthInvalidation: true })
  await markStep(taskId, 'save_inspection_photos', { status: 'succeeded', finished_at: nowIso(), output: { ok: true }, error: null }, 'syncing', null)
}

async function processFeedbackCreateStep(token: string, taskId: string) {
  const item = await getInspectionPanelBatch(taskId)
  if (!item) return
  if (item.steps.create_feedback_batch.status === 'succeeded') return
  await markStep(taskId, 'create_feedback_batch', { status: 'syncing', started_at: nowIso(), error: null }, 'syncing', null)
  const current = await getInspectionPanelBatch(taskId)
  if (!current) return
  const feedback = current.snapshot.feedback
  const mapping: Record<string, { feedback_id: string }> = { ...(current.steps.create_feedback_batch.output || {}) }
  if (!feedback) {
    await markStep(taskId, 'create_feedback_batch', { status: 'succeeded', finished_at: nowIso(), output: mapping, error: null }, 'syncing', null)
    return
  }

  const maintenancePayloads = (feedback.maintenanceDrafts || []).filter((draft) => !mapping[draft.client_item_id]).map((draft) => ({
    client_item_id: draft.client_item_id,
    kind: 'maintenance' as const,
    property_id: cleanText(current.snapshot.property_id),
    source_task_id: current.task_id,
    area: cleanText(draft.area) || undefined,
    detail: cleanText(draft.detail),
    media_urls: feedbackRemoteUrls(current, draft.media),
  }))
  const deepPayloads = (feedback.deepCleaningDrafts || []).filter((draft) => !mapping[draft.client_item_id]).map((draft) => ({
    client_item_id: draft.client_item_id,
    kind: 'deep_cleaning' as const,
    property_id: cleanText(current.snapshot.property_id),
    source_task_id: current.task_id,
    areas: cleanText(draft.area) ? [cleanText(draft.area)] : [],
    detail: cleanText(draft.detail),
    media_urls: feedbackRemoteUrls(current, draft.media),
  }))
  const dailyPayloads = (feedback.dailyDrafts || []).filter((draft) => !mapping[draft.client_item_id]).map((draft) => ({
    client_item_id: draft.client_item_id,
    kind: 'daily_necessities' as const,
    property_id: cleanText(current.snapshot.property_id),
    source_task_id: current.task_id,
    status: draft.status,
    item_name: cleanText(draft.itemName),
    quantity: Math.trunc(Number(draft.qty || 1) || 1),
    note: cleanText(draft.note),
    media_urls: feedbackRemoteUrls(current, draft.media),
  }))
  const payloads = [...maintenancePayloads, ...deepPayloads, ...dailyPayloads]
  if (!payloads.length) {
    await markStep(taskId, 'create_feedback_batch', { status: 'succeeded', finished_at: nowIso(), output: mapping, error: null }, 'syncing', null)
    return
  }
  const results = await createPropertyFeedbackBatch(token, {
    submit_id: current.submit_id,
    step_key: 'create_feedback_batch',
    items: payloads,
  } as any)
  let firstError = ''
  for (let idx = 0; idx < results.length; idx += 1) {
    const result = results[idx]
    const source = payloads[idx]
    if (!result?.ok) {
      firstError = cleanText(result?.error) || '反馈提交失败'
      continue
    }
    const feedbackId = cleanText(result?.response?.id || result?.response?.existing_id)
    if (!feedbackId) {
      firstError = firstError || '反馈提交成功但未返回 id'
      continue
    }
    mapping[source.client_item_id] = { feedback_id: feedbackId }
    await markStep(taskId, 'create_feedback_batch', { output: mapping }, 'syncing', null)
  }
  if (firstError) {
    await markStep(taskId, 'create_feedback_batch', { output: mapping }, 'syncing', null)
    throw new Error(firstError)
  }
  await markStep(taskId, 'create_feedback_batch', { status: 'succeeded', finished_at: nowIso(), output: mapping, error: null }, 'syncing', null)
}

async function processFeedbackCompleteStep(token: string, taskId: string) {
  const item = await getInspectionPanelBatch(taskId)
  if (!item) return
  if (item.steps.complete_feedback_projects.status === 'succeeded') return
  await markStep(taskId, 'complete_feedback_projects', { status: 'syncing', started_at: nowIso(), error: null }, 'syncing', null)
  const current = await getInspectionPanelBatch(taskId)
  if (!current) return
  const feedback = current.snapshot.feedback
  const createdMap = (current.steps.create_feedback_batch.output || {}) as Record<string, { feedback_id: string }>
  const doneMap = { ...(current.steps.complete_feedback_projects.output || {}) }
  if (feedback) {
    const completionDrafts = [
      ...(feedback.maintenanceDrafts || []).map((draft) => ({ kind: 'maintenance' as const, draft })),
      ...(feedback.deepCleaningDrafts || []).map((draft) => ({ kind: 'deep_cleaning' as const, draft })),
    ]
    for (const entry of completionDrafts) {
      if (!entry.draft.submitAsCompleted) continue
      if (doneMap[entry.draft.client_item_id]?.completed) continue
      const feedbackId = cleanText(createdMap[entry.draft.client_item_id]?.feedback_id)
      if (!feedbackId) throw new Error('缺少反馈映射，无法提交完工信息')
      await completePropertyFeedbackProject(token, entry.kind, feedbackId, `legacy-${feedbackId}`, {
        note: cleanText(entry.draft.completionNote) || undefined,
        detail: cleanText(entry.draft.detail) || undefined,
        source_task_id: current.task_id,
        started_at: entry.kind === 'deep_cleaning' ? cleanText((entry.draft as InspectionPanelDeepCleaningDraft).completionStartedAt) || undefined : undefined,
        ended_at: entry.kind === 'deep_cleaning' ? cleanText((entry.draft as InspectionPanelDeepCleaningDraft).completionEndedAt) || undefined : undefined,
        before_photos: feedbackRemoteUrls(current, entry.draft.media),
        after_photos: feedbackRemoteUrls(current, entry.draft.completionAfterPhotos),
      })
      doneMap[entry.draft.client_item_id] = { completed: true, feedback_id: feedbackId }
      await markStep(taskId, 'complete_feedback_projects', { output: doneMap }, 'syncing', null)
    }
  }
  await markStep(taskId, 'complete_feedback_projects', { status: 'succeeded', finished_at: nowIso(), output: doneMap, error: null }, 'syncing', null)
}

export function subscribeInspectionPanelSubmitQueue(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export async function listInspectionPanelBatches() {
  return await loadQueue()
}

export async function getInspectionPanelBatch(taskId: string) {
  const key = cleanText(taskId)
  if (!key) return null
  return (await loadQueue()).find((item) => item.task_id === key) || null
}

export async function saveInspectionPanelDraftBatch(params: {
  task_id: string
  cleaning_task_id: string
  property_id?: string | null
  property_code?: string | null
  snapshot: InspectionPanelBatchSnapshot
}) {
  const taskId = cleanText(params.task_id)
  if (!taskId) return null
  return await updateQueueItem(taskId, (current) => {
    if (current && current.status !== 'draft') return current
    const snapshot = normalizeSnapshot(params.snapshot)
    if (!snapshot) return current
    const submitId = current?.submit_id || makeId(`inspection_batch_${taskId}`)
    return {
      submit_id: submitId,
      task_id: taskId,
      cleaning_task_id: cleanText(params.cleaning_task_id),
      property_id: cleanText(params.property_id) || null,
      property_code: cleanText(params.property_code) || null,
      status: 'draft',
      created_at: current?.created_at || nowIso(),
      updated_at: nowIso(),
      snapshot,
      steps: current?.steps || {
        upload_media: baseStepState(),
        save_restock_proof: baseStepState(),
        save_inspection_photos: baseStepState(),
        create_feedback_batch: baseStepState(),
        complete_feedback_projects: baseStepState(),
      },
      last_error: current?.last_error || null,
    }
  })
}

export async function submitInspectionPanelBatch(taskId: string) {
  const key = cleanText(taskId)
  if (!key) return null
  return await updateQueueItem(key, (current) => {
    if (!current) return null
    if (current.status !== 'draft') return current
    const validationError = validateInspectionPanelSnapshot(current.snapshot)
    if (validationError) throw new ApiError(validationError, 0, 'INVALID_INSPECTION_PANEL_SNAPSHOT', false)
    return {
      ...current,
      status: 'pending_submit',
      updated_at: nowIso(),
      snapshot: {
        ...current.snapshot,
        submitted_at: nowIso(),
      },
      last_error: null,
    }
  })
}

export async function discardInspectionPanelBatch(taskId: string) {
  const item = await updateQueueItem(taskId, () => null)
  await clearInspectionPanelDraft(taskId)
  await clearInspectionPanelFeedbackDraft(taskId)
  return item || null
}

export async function hasInspectionPanelFormalSubmission(taskId: string) {
  const item = await getInspectionPanelBatch(taskId)
  if (!item) return false
  return item.status !== 'draft'
}

export function createInspectionPanelLocalMedia(params: {
  sourceUri: string
  name: string
  mimeType: string
  prefix: string
  capturedAt?: string
  watermarkText?: string
  note?: string
}) {
  const resolvedMimeType = draftMimeTypeFrom(params.name, params.mimeType, params.sourceUri)
  const localUri = persistDraftMedia({
    dirName: 'mzstay-inspection-panel-batch',
    prefix: params.prefix,
    sourceUri: params.sourceUri,
    name: params.name,
    mimeType: resolvedMimeType,
  })
  return {
    id: makeId(params.prefix),
    local_uri: localUri,
    thumbnail_uri: null,
    uploaded_key: null,
    uploaded_url: null,
    name: cleanText(params.name) || `${params.prefix}-${Date.now()}.jpg`,
    mime_type: resolvedMimeType,
    captured_at: cleanText(params.capturedAt) || nowIso(),
    watermark_text: cleanText(params.watermarkText) || null,
    note: cleanText(params.note) || null,
  } satisfies InspectionPanelBatchMedia
}

export async function processInspectionPanelSubmitQueue(token: string) {
  if (processing) return { processed: 0, remaining: (await loadQueue()).filter((item) => item.status !== 'draft' && item.status !== 'synced').length }
  processing = true
  try {
    const items = (await loadQueue()).filter((item) => item.status !== 'draft' && item.status !== 'synced')
    let processed = 0
    for (const item of items) {
      try {
        const validationError = validateInspectionPanelSnapshot(item.snapshot)
        if (validationError) throw new ApiError(validationError, 0, 'INVALID_INSPECTION_PANEL_SNAPSHOT', false)
        await processUploadMediaStep(token, item.task_id)
        await processRestockStep(token, item.task_id)
        await processInspectionStep(token, item.task_id)
        await processFeedbackCreateStep(token, item.task_id)
        await processFeedbackCompleteStep(token, item.task_id)
        const current = await getInspectionPanelBatch(item.task_id)
        if (!current) continue
        const finalized = await prepareSyncedSnapshot(current.snapshot)
        const next = await updateQueueItem(item.task_id, (current) => {
          if (!current) return null
          return {
            ...current,
            status: 'synced',
            updated_at: nowIso(),
            last_error: null,
            snapshot: finalized.snapshot,
          }
        })
        if (next) {
          for (const uri of finalized.originalUris) deleteDraftMedia(uri)
          pruneInspectionThumbnailCache(finalized.thumbnailUris)
          await clearInspectionPanelDraft(next.task_id)
          await clearInspectionPanelFeedbackDraft(next.task_id)
        }
        processed += 1
      } catch (error: any) {
        const stepError = cleanText(error?.message) || '同步失败'
        const current = await getInspectionPanelBatch(item.task_id)
        if (current) {
          await markActiveStepFailed(item.task_id, stepError)
          const latest = await getInspectionPanelBatch(item.task_id)
          const basis = latest || current
          const anySucceeded = Object.values(basis.steps).some((step) => step.status === 'succeeded')
          await updateQueueItem(item.task_id, (existing) => existing ? {
            ...existing,
            status: anySucceeded ? 'partial_failed' : 'failed',
            updated_at: nowIso(),
            last_error: stepError,
          } : existing)
        }
        if (isNetworkishError(error) || error instanceof ApiError) break
      }
    }
    return { processed, remaining: (await loadQueue()).filter((item) => item.status !== 'draft' && item.status !== 'synced').length }
  } finally {
    processing = false
  }
}
