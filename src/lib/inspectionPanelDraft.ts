import { getJson, remove, setJson } from './storage'
import { normalizeCleaningObjectKey } from './cleaningMedia'
import type {
  InspectionPanelBatchMedia,
  InspectionPanelBatchRestockItem,
  InspectionPanelRoomPhotoArea,
  InspectionPanelRoomPhotoRequirement,
} from './inspectionPanelSubmitQueue'

export type InspectionPanelDraftRestockItem = InspectionPanelBatchRestockItem

export type InspectionPanelDraft = {
  task_id: string
  updated_at: string
  property_code?: string | null
  room_photo_requirement: InspectionPanelRoomPhotoRequirement
  restock: InspectionPanelDraftRestockItem[]
  restock_confirmed_sufficient: boolean
  room_photos: Record<InspectionPanelRoomPhotoArea, InspectionPanelBatchMedia[]>
  cleaning_issue: InspectionPanelBatchMedia[]
}

const DRAFT_KEY_PREFIX = 'mzstay.inspection_panel_draft.v2:'

function draftKey(taskId: string) {
  return `${DRAFT_KEY_PREFIX}${String(taskId || '').trim()}`
}

function cleanText(value: any) {
  return String(value || '').trim()
}

function nowIso() {
  return new Date().toISOString()
}

function baseRoomPhotos() {
  return { living: [], sofa: [], bedroom: [], kitchen: [] } as Record<InspectionPanelRoomPhotoArea, InspectionPanelBatchMedia[]>
}

function normalizeMedia(item: any): InspectionPanelBatchMedia | null {
  const id = cleanText(item?.id)
  const localUri = cleanText(item?.local_uri)
  const thumbnailUri = cleanText(item?.thumbnail_uri)
  const uploadedKey = normalizeCleaningObjectKey(item?.uploaded_key)
  const uploadedUrl = cleanText(item?.uploaded_url)
  if (!id || (!localUri && !thumbnailUri && !uploadedKey && !uploadedUrl)) return null
  return {
    id,
    local_uri: localUri || null,
    thumbnail_uri: thumbnailUri || null,
    uploaded_key: uploadedKey || null,
    uploaded_url: uploadedUrl || null,
    name: cleanText(item?.name) || `${id}.jpg`,
    mime_type: cleanText(item?.mime_type) || 'image/jpeg',
    captured_at: cleanText(item?.captured_at) || nowIso(),
    watermark_text: cleanText(item?.watermark_text) || null,
    note: cleanText(item?.note) || null,
  }
}

function normalizeRestockItem(item: any): InspectionPanelDraftRestockItem | null {
  const itemId = cleanText(item?.item_id)
  if (!itemId) return null
  const qty0 = item?.qty == null || cleanText(item?.qty) === '' ? null : Number(item.qty)
  const qty = Number.isFinite(qty0) ? qty0 : null
  const status = cleanText(item?.status)
  return {
    item_id: itemId,
    label: cleanText(item?.label) || itemId,
    qty,
    status: status === 'restocked' || status === 'unavailable' ? status : null,
    source_photo_url: cleanText(item?.source_photo_url) || null,
    proof_media: Array.isArray(item?.proof_media) ? item.proof_media.map(normalizeMedia).filter(Boolean) as InspectionPanelBatchMedia[] : [],
    note: cleanText(item?.note),
    origin: cleanText(item?.origin) === 'manual' ? 'manual' : 'task',
  }
}

function normalizeDraft(taskId: string, raw: any): InspectionPanelDraft | null {
  if (!raw || typeof raw !== 'object') return null
  const roomPhotos = baseRoomPhotos()
  for (const key of Object.keys(roomPhotos) as InspectionPanelRoomPhotoArea[]) {
    roomPhotos[key] = Array.isArray(raw?.room_photos?.[key]) ? raw.room_photos[key].map(normalizeMedia).filter(Boolean) as InspectionPanelBatchMedia[] : []
  }
  const roomPhotoRequirement0 = cleanText(raw.room_photo_requirement)
  const roomPhotoRequirement: InspectionPanelRoomPhotoRequirement =
    roomPhotoRequirement0 === 'password_only' || roomPhotoRequirement0 === 'guest_arrival_confirmed'
      ? roomPhotoRequirement0
      : 'required'
  return {
    task_id: cleanText(raw.task_id) || cleanText(taskId),
    updated_at: cleanText(raw.updated_at) || nowIso(),
    property_code: cleanText(raw.property_code) || null,
    room_photo_requirement: roomPhotoRequirement,
    restock: Array.isArray(raw.restock) ? raw.restock.map(normalizeRestockItem).filter(Boolean) as InspectionPanelDraftRestockItem[] : [],
    restock_confirmed_sufficient: !!raw.restock_confirmed_sufficient,
    room_photos: roomPhotos,
    cleaning_issue: Array.isArray(raw.cleaning_issue) ? raw.cleaning_issue.map(normalizeMedia).filter(Boolean) as InspectionPanelBatchMedia[] : [],
  }
}

export async function getInspectionPanelDraft(taskId: string) {
  const key = cleanText(taskId)
  if (!key) return null
  return normalizeDraft(key, await getJson<InspectionPanelDraft>(draftKey(key)))
}

export async function setInspectionPanelDraft(taskId: string, draft: Omit<InspectionPanelDraft, 'task_id' | 'updated_at'>) {
  const key = cleanText(taskId)
  if (!key) return
  const payload = normalizeDraft(key, {
    ...draft,
    task_id: key,
    updated_at: nowIso(),
  })
  if (!payload) return
  await setJson(draftKey(key), payload)
}

export async function clearInspectionPanelDraft(taskId: string) {
  const key = cleanText(taskId)
  if (!key) return
  await remove(draftKey(key))
}
