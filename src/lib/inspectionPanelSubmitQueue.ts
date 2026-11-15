import { createDeepCleaningRecordId, deepCleaningRecordOperationId } from './deepCleaningCompletion'
import { getDeepCleaningRecoveryContext, listDeepCleaningExecutors, recordDeepCleaningCompletion as api_recordDeepCleaningCompletion } from './api'
import { getMediaCaptureUserId, assertMediaCaptureSession, guardMediaRequest } from './mediaCaptureIdentity'
import {  ApiError,createPropertyFeedbackBatch as api_createPropertyFeedbackBatch,completePropertyFeedbackProject as api_completePropertyFeedbackProject,saveInspectionPhotos as api_saveInspectionPhotos,saveRestockProof as api_saveRestockProof,uploadCleaningMedia as api_uploadCleaningMedia, type InspectionPhotoArea  } from './api'
import { normalizeCleaningObjectKey } from './cleaningMedia'
import { clearInspectionPanelFeedbackDraft, type InspectionPanelDeepCleaningDraft, type InspectionPanelFeedbackDraftState } from './inspectionPanelFeedbackDraft'
import { clearInspectionPanelDraft } from './inspectionPanelDraft'
import {
  createInspectionThumbnail,
  inspectionThumbnailExists,
} from './inspectionThumbnailCache'
import { draftFileExists, draftMimeTypeFrom, persistDraftMedia } from './localMediaDrafts'
import { withLocalMediaLock } from './localMediaLocks'
import { getOwnedMediaJson as rawGetJson, setOwnedMediaJson as rawSetJson } from './mediaCaptureIdentity'

export type InspectionPanelBatchStatus =
  | 'draft'
  | 'pending_submit'
  | 'syncing'
  | 'partial_failed'
  | 'failed'
  | 'synced'

export type InspectionPanelSubmitStepStatus = 'pending' | 'syncing' | 'succeeded' | 'failed'

export type InspectionPanelBatchMedia = {
  captured_by_user_id?: string
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

export type InspectionPanelRoomPhotoArea = 'living' | 'sofa' | 'bedroom' | 'kitchen' | 'bathroom' | 'balcony'
export type InspectionPanelRoomPhotoMap = Record<Exclude<InspectionPanelRoomPhotoArea, 'balcony'>, InspectionPanelBatchMedia[]>
  & Partial<Record<'balcony', InspectionPanelBatchMedia[]>>
export type InspectionPanelRoomPhotoRequirement = 'required' | 'password_only' | 'guest_arrival_confirmed'

export type InspectionPanelBatchSnapshot = {
  owner_user_id?: string | null
  task_id: string
  cleaning_task_id: string
  property_id?: string | null
  property_code?: string | null
  submitted_at?: string | null
  room_photo_requirement: InspectionPanelRoomPhotoRequirement
  restock_confirmed_sufficient: boolean
  restock: InspectionPanelBatchRestockItem[]
  room_photos: InspectionPanelRoomPhotoMap
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
  captured_by_user_id?: string
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
const MAX_SUBMIT_ID_LENGTH = 96
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

function makeSubmitId() {
  return makeId('inspection_batch')
}

function stableUploadMediaId(submitId: string, value: string) {
  const normalized = cleanText(value)
  if (/^[a-zA-Z0-9_-]{1,96}$/.test(normalized)) return normalized
  let first = 0x811c9dc5
  let second = 0x9e3779b9
  for (let index = 0; index < normalized.length; index++) {
    const code = normalized.charCodeAt(index)
    first = Math.imul(first ^ code, 0x01000193) >>> 0
    second = Math.imul(second ^ (code + index), 0x85ebca6b) >>> 0
  }
  return `${cleanText(submitId).slice(0, 48)}_${first.toString(16).padStart(8, '0')}${second.toString(16).padStart(8, '0')}`
}

function normalizeSubmitId(value: any) {
  const submitId = cleanText(value)
  return submitId.length <= MAX_SUBMIT_ID_LENGTH ? submitId : makeSubmitId()
}

function baseStepState(): InspectionPanelSubmitStepState {
  return { status: 'pending', started_at: null, finished_at: null, error: null, output: null }
}

function baseRoomPhotos() {
  return { living: [], sofa: [], bedroom: [], kitchen: [], bathroom: [], balcony: [] } as Record<InspectionPanelRoomPhotoArea, InspectionPanelBatchMedia[]>
}

function isUploadedReference(value: any) {
  const reference = cleanText(value)
  return !!normalizeCleaningObjectKey(reference) || /^https?:\/\//i.test(reference)
}

function normalizeMedia(item: any): InspectionPanelBatchMedia | null {
  const id = cleanText(item?.id) || makeId('panel_media')
  const localUri = cleanText(item?.local_uri)
  const thumbnailUri = cleanText(item?.thumbnail_uri)
  const uploadedKey = normalizeCleaningObjectKey(item?.uploaded_key)
  const uploadedUrl = cleanText(item?.uploaded_url)
  const name = cleanText(item?.name) || `${id}.jpg`
  const mimeType = cleanText(item?.mime_type) || 'image/jpeg'
  const capturedAt = cleanText(item?.captured_at)
  const watermarkText = cleanText(item?.watermark_text) || null
  const note = cleanText(item?.note) || null
  if (!localUri && !thumbnailUri && !uploadedKey && !uploadedUrl) return null
  return {
    id,
    captured_by_user_id: cleanText(item?.captured_by_user_id),
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
  if (!taskId) return null
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
    owner_user_id: cleanText(raw.owner_user_id) || null,
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
      bathroom: '浴室',
      balcony: '阳台',
    }
    const requiredAreas: InspectionPanelRoomPhotoArea[] = ['living', 'sofa', 'bedroom', 'kitchen', 'bathroom']
    for (const area of requiredAreas) {
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

export type InspectionPanelVideoReadiness = {
  ready: boolean
  reason: string | null
  skipInspectionPhotos: boolean
}

function hasDurableBatchMedia(media: InspectionPanelBatchMedia) {
  const localUri = cleanText(media.local_uri)
  if (localUri && draftFileExists(localUri)) return true
  return !!cleanText(media.uploaded_key) || !!cleanText(media.uploaded_url)
}

export function getInspectionPanelVideoReadiness(item: InspectionPanelSubmitQueueItem | null | undefined): InspectionPanelVideoReadiness {
  const snapshot = item?.snapshot || null
  const skipInspectionPhotos = snapshot?.room_photo_requirement === 'guest_arrival_confirmed'
  if (!item || item.status === 'draft') {
    return {
      ready: false,
      reason: '请先提交本页检查与补充，确保照片已保存到本机。',
      skipInspectionPhotos,
    }
  }
  if (!snapshot) {
    return {
      ready: false,
      reason: '检查与补充批次内容不可用，请返回检查页重新保存。',
      skipInspectionPhotos,
    }
  }
  const validationIssue = findInspectionPanelValidationIssue(snapshot)
  if (validationIssue) {
    return {
      ready: false,
      reason: validationIssue.message,
      skipInspectionPhotos,
    }
  }
  const media = [
    ...Object.values(snapshot.room_photos).flat(),
    ...snapshot.restock.flatMap((entry) => entry.proof_media),
    ...snapshot.cleaning_issue,
  ]
  if (media.some((entry) => !hasDurableBatchMedia(entry))) {
    return {
      ready: false,
      reason: '部分检查或补充照片未成功保存到本机，请返回检查页重拍后再拍视频。',
      skipInspectionPhotos,
    }
  }
  return { ready: true, reason: null, skipInspectionPhotos }
}

function normalizeQueueItem(raw: any): InspectionPanelSubmitQueueItem | null {
  if (!raw || typeof raw !== 'object') return null
  const rawSubmitId = cleanText(raw.submit_id)
  const taskId = cleanText(raw.task_id)
  const cleaningTaskId = cleanText(raw.cleaning_task_id)
  const snapshot = normalizeSnapshot(raw.snapshot)
  if (!rawSubmitId || !taskId || !snapshot) return null
  const submitId = normalizeSubmitId(rawSubmitId)
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
    captured_by_user_id: cleanText(raw.captured_by_user_id),
    submit_id: submitId,
    task_id: taskId,
    cleaning_task_id: cleaningTaskId || cleanText(snapshot.cleaning_task_id),
    property_id: cleanText(raw.property_id) || null,
    property_code: cleanText(raw.property_code) || null,
    status: normalizedStatus,
    created_at: cleanText(raw.created_at) || nowIso(),
    updated_at: cleanText(raw.updated_at) || nowIso(),
    snapshot: withUploadedMediaUrls({
      ...snapshot,
      cleaning_task_id: cleaningTaskId || cleanText(snapshot.cleaning_task_id),
    }, steps.upload_media.output || {}),
    steps,
    last_error: cleanText(raw.last_error) || null,
  }
}

async function loadQueue() {
  const raw = await getJson<any[]>(STORAGE_KEY)
  if (!Array.isArray(raw)) return []
  let migrated = false
  const items = raw.map((rawItem) => {
    const item = normalizeQueueItem(rawItem)
    if (item && cleanText(rawItem?.submit_id) !== item.submit_id) migrated = true
    return item
  }).filter(Boolean) as InspectionPanelSubmitQueueItem[]
  if (migrated) {
    await setJson(STORAGE_KEY, items)
    emit()
  }
  return items
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
  let changed = false
  if (!next) {
    if (idx >= 0) {
      items.splice(idx, 1)
      changed = true
    }
  } else if (idx >= 0) {
    if (next !== current) {
      items[idx] = next
      changed = true
    }
  } else {
    items.push(next)
    changed = true
  }
  if (changed) await saveQueue(items)
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
        captured_by_user_id: cleanText(meta?.captured_by_user_id),
        local_uri: uri,
        thumbnail_uri: null,
        uploaded_key: null,
        uploaded_url: null,
        name: cleanText(meta?.name) || `feedback-${Date.now()}.jpg`,
        mime_type: cleanText(meta?.mime_type) || 'image/jpeg',
        captured_at: cleanText(meta?.captured_at),
        watermark_text: cleanText(meta?.watermark_text) || null,
      },
      meta: { purpose: 'feedback' },
    })
  }
  return list
}

export type InspectionPanelSubmitStepKey = keyof InspectionPanelSubmitQueueItem['steps']

export const INSPECTION_PANEL_STEP_LABELS: Record<InspectionPanelSubmitStepKey, string> = {
  upload_media: '上传照片',
  save_restock_proof: '保存补品照片记录',
  save_inspection_photos: '保存检查照片记录',
  create_feedback_batch: '创建问题反馈批次',
  complete_feedback_projects: '完成问题反馈项目',
}

export type InspectionPanelFailedStepDetail = {
  key: InspectionPanelSubmitStepKey
  label: string
  error: string
}

export function inspectionPanelFailedStepDetails(item: InspectionPanelSubmitQueueItem | null | undefined): InspectionPanelFailedStepDetail[] {
  if (!item) return []
  return (Object.entries(item.steps) as [InspectionPanelSubmitStepKey, InspectionPanelSubmitStepState][])
    .filter(([, step]) => step.status === 'failed')
    .map(([key, step]) => ({
      key,
      label: INSPECTION_PANEL_STEP_LABELS[key],
      error: cleanText(step.error) || '未提供具体错误',
    }))
}

export type InspectionPanelLocalMediaSummary = {
  total: number
  retained: number
  remoteReferenced: number
}

export function inspectionPanelLocalMediaSummary(item: InspectionPanelSubmitQueueItem | null | undefined): InspectionPanelLocalMediaSummary | null {
  if (!item) return null
  const uniqueMedia = new Map<string, InspectionPanelBatchMedia>()
  for (const entry of collectBatchMedia(item.snapshot)) {
    const key = cleanText(entry.media.id) || entry.key
    if (!uniqueMedia.has(key)) uniqueMedia.set(key, entry.media)
  }
  const media = [...uniqueMedia.values()]
  if (!media.length) return null
  return {
    total: media.length,
    retained: media.filter((entry) => !!cleanText(entry.local_uri) || !!cleanText(entry.thumbnail_uri)).length,
    remoteReferenced: media.filter((entry) => !!cleanText(entry.uploaded_key) || !!cleanText(entry.uploaded_url)).length,
  }
}

function uploadedUrlFor(item: InspectionPanelSubmitQueueItem, key: string, fallback?: string | null) {
  const output = item.steps.upload_media.output || {}
  const uploaded = normalizeCleaningObjectKey(output[key]?.remote_key)
    || normalizeCleaningObjectKey(fallback)
    || normalizeCleaningObjectKey(output[key]?.remote_url)
    || cleanText(fallback)
    || cleanText(output[key]?.remote_url)
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
  return {
    items,
    ...(item.snapshot.room_photo_requirement === 'guest_arrival_confirmed' && !items.length
      ? { guest_arrival_confirmed: true }
      : {}),
  }
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

async function markWaitingForTaskInfo(taskId: string) {
  await updateQueueItem(taskId, (current) => current ? {
    ...current,
    status: current.status === 'draft' ? 'draft' : 'pending_submit',
    updated_at: nowIso(),
    last_error: '已保存到本机，等待任务信息刷新后自动同步。',
  } : current)
}

async function processIndependentStep(
  taskId: string,
  step: keyof InspectionPanelSubmitQueueItem['steps'],
  handler: () => Promise<void>,
) {
  try {
    await handler()
    return true
  } catch (error: any) {
    checkQueueSession()
    const message = cleanText(error?.message) || '同步失败'
    await markStep(
      taskId,
      step,
      { status: 'failed', finished_at: nowIso(), error: message },
      'partial_failed',
      message,
    )
    return false
  }
}

function resetFailedStep(step: InspectionPanelSubmitStepState) {
  return step.status === 'failed' ? baseStepState() : step
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
    const up = await withLocalMediaLock(localUri, () => uploadCleaningMedia(
      token,
      { uri: localUri, name: entry.media.name, mimeType: entry.media.mime_type },
      {
        ...entry.meta,
        task_id: cleanText(current.snapshot.cleaning_task_id) || cleanText(current.task_id),
        media_id: stableUploadMediaId(current.submit_id, entry.media.id || entry.key),
        captured_at: entry.media.captured_at,
        captured_by_user_id: entry.media.captured_by_user_id || '',
        watermark: cleanText(entry.media.watermark_text) ? '1' : '',
        watermark_text: cleanText(entry.media.watermark_text) || '',
        property_code: cleanText(current.snapshot.property_code) || undefined,
        note: cleanText(entry.media.note) || undefined,
      },
      { skipAuthInvalidation: true, skipImageCompression: true },
    ))
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
  await cleanupRemoteBackedBatchFiles(taskId)
}

async function cleanupRemoteBackedBatchFiles(taskId: string) {
  const current = await getInspectionPanelBatch(taskId)
  if (!current) return
  const finalized = await prepareSyncedSnapshot(current.snapshot)
  const next = await updateQueueItem(taskId, (item) => item ? {
    ...item,
    updated_at: nowIso(),
    snapshot: finalized.snapshot,
  } : item)
  if (!next) return
  // Keep the private original until delayed local-media housekeeping. The
  // page may still be rendering the file:// URI while the authenticated R2
  // proxy is unavailable on Android; deleting it here leaves only a remote
  // reference that can render as a black image.
  // Global housekeeping prunes thumbnails using all-account retention roots.
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
  const deepPayloads = (feedback.deepCleaningDrafts || []).filter((draft) => !draft.submitAsCompleted && !mapping[draft.client_item_id]).map((draft) => ({
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
      if (entry.kind === 'deep_cleaning') {
        const draft = entry.draft as InspectionPanelDeepCleaningDraft
        const existingId = cleanText(createdMap[draft.client_item_id]?.feedback_id)
        const recordId = existingId || cleanText(draft.completionRecordId)
        if (!recordId || !cleanText(draft.completionAssigneeId)) throw new Error('请返回深清反馈选择实际执行人并重新保存本页')
        const receipt = await recordDeepCleaningCompletion(token, {
          recordId, operationId: deepCleaningRecordOperationId(cleanText(draft.completionRecordId) || recordId),
          assigneeId: cleanText(draft.completionAssigneeId), existingRecord: !!existingId,
          propertyId: cleanText(current.snapshot.property_id), areas: cleanText(draft.area) ? [cleanText(draft.area)] : [],
          detail: cleanText(draft.detail), beforePhotos: feedbackRemoteUrls(current, draft.media), afterPhotos: feedbackRemoteUrls(current, draft.completionAfterPhotos),
          note: cleanText(draft.completionNote), sourceTaskId: current.task_id, clientItemId: draft.client_item_id,
          startedAt: draft.completionStartedAt, endedAt: draft.completionEndedAt,
        })
        if (receipt.workflow_status !== 'pending_review') throw new Error('深清完工回执不完整，请保留批次重试')
        doneMap[draft.client_item_id] = { completed: true, feedback_id: receipt.id || recordId }
        await markStep(taskId, 'complete_feedback_projects', { output: doneMap }, 'syncing', null)
        continue
      }
      const feedbackId = cleanText(createdMap[entry.draft.client_item_id]?.feedback_id)
      if (!feedbackId) throw new Error('缺少反馈映射，无法提交完工信息')
      await completePropertyFeedbackProject(token, entry.kind, feedbackId, `legacy-${feedbackId}`, {
        note: cleanText(entry.draft.completionNote) || undefined,
        detail: cleanText(entry.draft.detail) || undefined,
        source_task_id: current.task_id,
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

export type InspectionPanelBatchResolution = {
  item: InspectionPanelSubmitQueueItem | null
  matched_by: 'display_task_id' | 'source_task_id' | 'none' | 'ambiguous' | 'conflict'
  ambiguous_count: number
}

function inspectionPanelBatchMatchesProperty(
  item: InspectionPanelSubmitQueueItem,
  propertyId?: string | null,
  propertyCode?: string | null,
) {
  const expectedPropertyId = cleanText(propertyId)
  const expectedPropertyCode = cleanText(propertyCode).toLowerCase()
  const itemPropertyId = cleanText(item.property_id || item.snapshot.property_id)
  const itemPropertyCode = cleanText(item.property_code || item.snapshot.property_code).toLowerCase()
  if (expectedPropertyId && itemPropertyId && expectedPropertyId !== itemPropertyId) return false
  if (expectedPropertyCode && itemPropertyCode && expectedPropertyCode !== itemPropertyCode) return false
  return true
}

/**
 * Resolves a local inspection batch without mutating or re-keying the queue.
 * The exact source task id is the only cross-display-id fallback. Room/date
 * similarity is deliberately never used, and multiple source matches fail
 * closed so a different inspection round cannot be borrowed silently.
 */
export async function resolveInspectionPanelBatch(params: {
  task_id: string
  cleaning_task_id?: string | null
  property_id?: string | null
  property_code?: string | null
}): Promise<InspectionPanelBatchResolution> {
  const taskId = cleanText(params.task_id)
  const sourceId = cleanText(params.cleaning_task_id)
  if (!taskId) return { item: null, matched_by: 'none', ambiguous_count: 0 }
  const items = await loadQueue()
  const exact = items.find((item) => item.task_id === taskId) || null
  if (exact) {
    const exactSourceId = cleanText(exact.cleaning_task_id || exact.snapshot.cleaning_task_id)
    const sourceMatches = !sourceId || !exactSourceId || exactSourceId === sourceId
    const propertyMatches = inspectionPanelBatchMatchesProperty(exact, params.property_id, params.property_code)
    if (
      sourceMatches
      && propertyMatches
    ) {
      return { item: exact, matched_by: 'display_task_id', ambiguous_count: 0 }
    }
    // An exact display key with another source/property is a local identity
    // conflict, not an absent batch. Never let a server receipt bypass it.
    return { item: null, matched_by: 'conflict', ambiguous_count: 1 }
  }
  if (!sourceId) return { item: null, matched_by: 'none', ambiguous_count: 0 }
  const sourceCandidates = items.filter((item) => (
    cleanText(item.cleaning_task_id || item.snapshot.cleaning_task_id) === sourceId
  ))
  if (sourceCandidates.length > 1) {
    return { item: null, matched_by: 'ambiguous', ambiguous_count: sourceCandidates.length }
  }
  if (sourceCandidates.length === 1) {
    if (inspectionPanelBatchMatchesProperty(sourceCandidates[0], params.property_id, params.property_code)) {
      return { item: sourceCandidates[0], matched_by: 'source_task_id', ambiguous_count: 0 }
    }
    return { item: null, matched_by: 'conflict', ambiguous_count: 1 }
  }
  return { item: null, matched_by: 'none', ambiguous_count: 0 }
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
    const submitId = normalizeSubmitId(current?.submit_id) || makeSubmitId()
    return {
      captured_by_user_id: current?.captured_by_user_id || getMediaCaptureUserId(),
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

export async function bindInspectionPanelCleaningTaskId(params: {
  task_id: string
  cleaning_task_id: string
  property_id?: string | null
  property_code?: string | null
}) {
  const taskId = cleanText(params.task_id)
  const cleaningTaskId = cleanText(params.cleaning_task_id)
  if (!taskId || !cleaningTaskId) return null
  return await updateQueueItem(taskId, (current) => {
    if (!current) return current
    const existing = cleanText(current.cleaning_task_id || current.snapshot.cleaning_task_id)
    const currentPropertyId = cleanText(current.property_id || current.snapshot.property_id)
    const currentPropertyCode = cleanText(current.property_code || current.snapshot.property_code).toLowerCase()
    const nextPropertyId = cleanText(params.property_id)
    const nextPropertyCode = cleanText(params.property_code).toLowerCase()
    const businessStepSucceeded =
      current.steps.save_restock_proof.status === 'succeeded'
      || current.steps.save_inspection_photos.status === 'succeeded'
      || current.steps.create_feedback_batch.status === 'succeeded'
      || current.steps.complete_feedback_projects.status === 'succeeded'
    // Binding is only a compatibility path for legacy batches that never had
    // a source id. A non-empty different source is an identity conflict and
    // must never be rewritten merely because a screen was opened.
    if (
      existing
      || businessStepSucceeded
      || current.status === 'synced'
      || (currentPropertyId && nextPropertyId && currentPropertyId !== nextPropertyId)
      || (currentPropertyCode && nextPropertyCode && currentPropertyCode !== nextPropertyCode)
    ) return current
    const shouldResetFailedBusinessSteps = current.status === 'failed' || current.status === 'partial_failed'
    return {
      ...current,
      cleaning_task_id: cleaningTaskId,
      property_id: cleanText(params.property_id) || current.property_id || null,
      property_code: cleanText(params.property_code) || current.property_code || null,
      status: shouldResetFailedBusinessSteps ? 'pending_submit' : current.status,
      updated_at: nowIso(),
      snapshot: {
        ...current.snapshot,
        cleaning_task_id: cleaningTaskId,
        property_id: cleanText(params.property_id) || current.snapshot.property_id || null,
        property_code: cleanText(params.property_code) || current.snapshot.property_code || null,
      },
      steps: shouldResetFailedBusinessSteps ? {
        ...current.steps,
        save_restock_proof: resetFailedStep(current.steps.save_restock_proof),
        save_inspection_photos: resetFailedStep(current.steps.save_inspection_photos),
        create_feedback_batch: resetFailedStep(current.steps.create_feedback_batch),
        complete_feedback_projects: resetFailedStep(current.steps.complete_feedback_projects),
      } : current.steps,
      last_error: null,
    }
  })
}

export async function supplementDeepCleaningBatchExecutor(params: {
  token: string; actorId: string; taskId: string; clientItemId: string; assigneeId: string
}) {
  assertMediaCaptureSession(params.token, params.actorId)
  if (processing) throw new Error('批次正在同步，请稍后补选')
  const before = await getInspectionPanelBatch(params.taskId)
  const draft = before?.snapshot.feedback?.deepCleaningDrafts.find((entry) => entry.client_item_id === params.clientItemId)
  if (!before || !draft || !draft.submitAsCompleted || before.status === 'draft' || before.status === 'synced' || before.status === 'syncing') throw new Error('当前批次不允许补选')
  const done = before.steps.complete_feedback_projects.output as Record<string, { completed?: boolean }> | undefined
  if (before.steps.complete_feedback_projects.status === 'succeeded' || done?.[params.clientItemId]?.completed) throw new Error('该深清已提交，不可更换人员')
  if (cleanText(draft.completionAssigneeId) && cleanText(draft.completionRecordId) && cleanText(draft.completionOwnerId || before.snapshot.owner_user_id)) throw new Error('该深清已有完整提交身份，请重试原操作，不可改派')
  const owner = cleanText(draft.completionOwnerId || before.snapshot.owner_user_id)
  if (owner && owner !== params.actorId) throw new Error('此批次属于其他账号，不可补选')
  const mapping = before.steps.create_feedback_batch.output as Record<string, { feedback_id?: string }> | undefined
  const existingId = cleanText(mapping?.[params.clientItemId]?.feedback_id)
  if (!owner && !existingId) throw new Error('旧批次无法确认原提交账号，请保留资料并联系管理员核实')
  const knownId = existingId || cleanText(draft.completionRecordId)
  let alreadySaved = false
  if (knownId) {
    try {
      const context = await getDeepCleaningRecoveryContext(params.token, knownId, before.task_id)
      assertMediaCaptureSession(params.token, params.actorId)
      if (context.record_id !== knownId || context.source_task_id !== before.task_id || context.owner_user_id !== params.actorId) throw new Error('深清恢复归属不匹配')
      if (!context.can_resume) {
        const canonical = new Set(context.completion_photo_urls || [])
        const expected = feedbackRemoteUrls(before, draft.completionAfterPhotos)
        alreadySaved = ['pending_review', 'completed', 'closed'].includes(context.workflow_status) && expected.length > 0 && expected.every((reference) => canonical.has(reference))
        if (!alreadySaved) throw new Error('后台状态已变化，不能自动补选，请保留批次核实')
      }
    } catch (error: any) {
      if (!(error?.status === 404 && owner === params.actorId && !existingId)) throw error
    }
  }
  if (!alreadySaved) {
    const eligible = await listDeepCleaningExecutors(params.token)
    assertMediaCaptureSession(params.token, params.actorId)
    if (!eligible.some((person) => person.id === params.assigneeId)) throw new Error('选择的人员不符合当前派工条件')
  }
  const recordId = knownId || createDeepCleaningRecordId()
  assertMediaCaptureSession(params.token, params.actorId)
  return await updateQueueItem(params.taskId, (current) => {
    assertMediaCaptureSession(params.token, params.actorId)
    const currentDraft = current?.snapshot.feedback?.deepCleaningDrafts.find((entry) => entry.client_item_id === params.clientItemId)
    if (processing || !current || !currentDraft || current.submit_id !== before.submit_id || current.cleaning_task_id !== before.cleaning_task_id || JSON.stringify(currentDraft) !== JSON.stringify(draft)) throw new Error('批次已变化，请刷新后重新确认')
    const output = { ...(current.steps.complete_feedback_projects.output || {}), ...(alreadySaved ? { [params.clientItemId]: { completed: true, feedback_id: knownId } } : {}) }
    return {
      ...current,
      snapshot: { ...current.snapshot, feedback: { ...current.snapshot.feedback!, deepCleaningDrafts: current.snapshot.feedback!.deepCleaningDrafts.map((entry) => entry.client_item_id === params.clientItemId ? { ...entry, completionOwnerId: params.actorId, completionAssigneeId: alreadySaved ? entry.completionAssigneeId : params.assigneeId, completionRecordId: recordId } : entry) } },
      steps: { ...current.steps, complete_feedback_projects: { ...current.steps.complete_feedback_projects, status: 'pending', error: null, output } },
      last_error: null,
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
  captured_by_user_id?: string
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
    captured_by_user_id: params.captured_by_user_id || getMediaCaptureUserId(),
    local_uri: localUri,
    thumbnail_uri: null,
    uploaded_key: null,
    uploaded_url: null,
    name: cleanText(params.name) || `${params.prefix}-${Date.now()}.jpg`,
    mime_type: resolvedMimeType,
    captured_at: params.capturedAt === undefined ? nowIso() : cleanText(params.capturedAt),
    watermark_text: cleanText(params.watermarkText) || null,
    note: cleanText(params.note) || null,
  } satisfies InspectionPanelBatchMedia
}

export async function processInspectionPanelSubmitQueue(token: string, actorId?: string) {
  assertMediaCaptureSession(token, actorId || getMediaCaptureUserId())
  actorId = actorId || getMediaCaptureUserId() || undefined
  if (processing) return { processed: 0, remaining: (await loadQueue()).filter((item) => item.status !== 'draft' && item.status !== 'synced').length }
  processing = true
  queueSessionToken = token
  try {
    const items = (await loadQueue()).filter((item) => item.status !== 'draft' && item.status !== 'synced')
    let processed = 0
    for (const item of items) {
      try {
        const deepMapping = item.steps.create_feedback_batch.output as Record<string, { feedback_id?: string }> | undefined
        const deepDone = item.steps.complete_feedback_projects.output as Record<string, { completed?: boolean }> | undefined
        const foreignOwnedDeep = item.steps.complete_feedback_projects.status !== 'succeeded' && (item.snapshot.feedback?.deepCleaningDrafts || []).some((draft) => draft.submitAsCompleted && !deepDone?.[draft.client_item_id]?.completed && cleanText(draft.completionOwnerId || item.snapshot.owner_user_id) && cleanText(draft.completionOwnerId || item.snapshot.owner_user_id) !== cleanText(actorId))
        if (foreignOwnedDeep) continue // Another account's frozen evidence is never processed or rewritten.
        const blockedLegacyDeep = item.steps.complete_feedback_projects.status !== 'succeeded' && (item.snapshot.feedback?.deepCleaningDrafts || []).some((draft) => draft.submitAsCompleted && !deepDone?.[draft.client_item_id]?.completed && (!cleanText(draft.completionOwnerId || item.snapshot.owner_user_id) || !cleanText(draft.completionAssigneeId) || (!cleanText(draft.completionRecordId) && !cleanText(deepMapping?.[draft.client_item_id]?.feedback_id))))
        if (blockedLegacyDeep) {
          const message = '深清批次缺少实际执行人或稳定提交编号，已停止自动同步。请保留本机批次并联系管理员补选，勿放弃重建。'
          if (item.last_error !== message) await markStep(item.task_id, 'complete_feedback_projects', { status: 'failed', error: message }, 'partial_failed', message)
          continue
        }
        if (!cleanText(item.cleaning_task_id)) {
          await markWaitingForTaskInfo(item.task_id)
          continue
        }
        const validationError = validateInspectionPanelSnapshot(item.snapshot)
        if (validationError) throw new ApiError(validationError, 0, 'INVALID_INSPECTION_PANEL_SNAPSHOT', false)
        await processIndependentStep(item.task_id, 'upload_media', () => processUploadMediaStep(token, item.task_id))
        await processIndependentStep(item.task_id, 'save_restock_proof', () => processRestockStep(token, item.task_id))
        await processIndependentStep(item.task_id, 'save_inspection_photos', () => processInspectionStep(token, item.task_id))
        await processIndependentStep(item.task_id, 'create_feedback_batch', () => processFeedbackCreateStep(token, item.task_id))
        await processIndependentStep(item.task_id, 'complete_feedback_projects', () => processFeedbackCompleteStep(token, item.task_id))
        const current = await getInspectionPanelBatch(item.task_id)
        if (!current) continue
        const allStepsSucceeded = Object.values(current.steps).every((step) => step.status === 'succeeded')
        if (!allStepsSucceeded) {
          const anySucceeded = Object.values(current.steps).some((step) => step.status === 'succeeded')
          await updateQueueItem(item.task_id, (existing) => existing ? {
            ...existing,
            status: anySucceeded ? 'partial_failed' : 'failed',
            updated_at: nowIso(),
          } : existing)
          continue
        }
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
          // Do not delete the local original at business-save time. The
          // authenticated image proxy may still be unavailable, and the
          // existing orphan-media housekeeping can remove this copy later.
          // Global housekeeping prunes thumbnails using all-account retention roots.
          await clearInspectionPanelDraft(next.task_id)
          await clearInspectionPanelFeedbackDraft(next.task_id)
        }
        processed += 1
      } catch (error: any) {
        assertMediaCaptureSession(token)
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
      }
    }
    return { processed, remaining: (await loadQueue()).filter((item) => item.status !== 'draft' && item.status !== 'synced').length }
  } finally {
    queueSessionToken = null
    processing = false
  }
}

const createPropertyFeedbackBatch = guardMediaRequest(api_createPropertyFeedbackBatch)
const completePropertyFeedbackProject = guardMediaRequest(api_completePropertyFeedbackProject)
const saveInspectionPhotos = guardMediaRequest(api_saveInspectionPhotos)
const saveRestockProof = guardMediaRequest(api_saveRestockProof)
const uploadCleaningMedia = guardMediaRequest(api_uploadCleaningMedia, true)


let queueSessionToken: string | null = null
function checkQueueSession() { if (queueSessionToken) assertMediaCaptureSession(queueSessionToken) }
async function getJson<T>(key: string): Promise<T | null> {
  checkQueueSession()
  const result = await rawGetJson<T>(key)
  checkQueueSession()
  return result
}
async function setJson<T>(key: string, value: T) {
  checkQueueSession()
  return rawSetJson(key, value)
}

const recordDeepCleaningCompletion = guardMediaRequest(api_recordDeepCleaningCompletion)
