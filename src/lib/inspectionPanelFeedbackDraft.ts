import { getJson, remove, setJson } from './storage'

export type InspectionPanelFeedbackKind = 'maintenance' | 'deep_cleaning' | 'daily_necessities'

export type InspectionPanelFeedbackPhotoMetaMap = Record<string, {
  name?: string
  mime_type?: string
  captured_at?: string
  watermark_text?: string
}>

export type InspectionPanelMaintenanceDraft = {
  clientId: string
  client_item_id: string
  area: string | null
  detail: string
  media: string[]
  submitAsCompleted: boolean
  completionNote: string
  completionAfterPhotos: string[]
}

export type InspectionPanelDeepCleaningDraft = {
  clientId: string
  client_item_id: string
  area: string | null
  detail: string
  media: string[]
  submitAsCompleted: boolean
  completionNote: string
  completionAfterPhotos: string[]
  completionStartedAt: string | null
  completionEndedAt: string | null
}

export type InspectionPanelDailyDraft = {
  clientId: string
  client_item_id: string
  status: 'need_replace' | 'replaced' | 'no_action'
  itemName: string
  itemSku?: string | null
  qty: string
  note: string
  media: string[]
}

export type InspectionPanelFeedbackDraftState = {
  task_id: string
  updated_at: string
  kind: InspectionPanelFeedbackKind
  maintenanceDrafts: InspectionPanelMaintenanceDraft[]
  deepCleaningDrafts: InspectionPanelDeepCleaningDraft[]
  dailyDrafts: InspectionPanelDailyDraft[]
  photo_meta?: InspectionPanelFeedbackPhotoMetaMap
}

const DRAFT_KEY_PREFIX = 'mzstay.inspection_panel_feedback_draft.v1:'

function draftKey(taskId: string) {
  return `${DRAFT_KEY_PREFIX}${String(taskId || '').trim()}`
}

function cleanText(value: any) {
  return String(value || '').trim()
}

function normalizePhotoMeta(raw: any): InspectionPanelFeedbackPhotoMetaMap {
  if (!raw || typeof raw !== 'object') return {}
  const next: InspectionPanelFeedbackPhotoMetaMap = {}
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

function normalizeMaintenanceDraft(item: any): InspectionPanelMaintenanceDraft | null {
  const clientId = cleanText(item?.clientId)
  const clientItemId = cleanText(item?.client_item_id) || clientId
  if (!clientId || !clientItemId) return null
  return {
    clientId,
    client_item_id: clientItemId,
    area: cleanText(item?.area) || null,
    detail: cleanText(item?.detail),
    media: Array.isArray(item?.media) ? item.media.map((x: any) => cleanText(x)).filter(Boolean) : [],
    submitAsCompleted: !!item?.submitAsCompleted,
    completionNote: cleanText(item?.completionNote),
    completionAfterPhotos: Array.isArray(item?.completionAfterPhotos) ? item.completionAfterPhotos.map((x: any) => cleanText(x)).filter(Boolean) : [],
  }
}

function normalizeDeepCleaningDraft(item: any): InspectionPanelDeepCleaningDraft | null {
  const clientId = cleanText(item?.clientId)
  const clientItemId = cleanText(item?.client_item_id) || clientId
  if (!clientId || !clientItemId) return null
  return {
    clientId,
    client_item_id: clientItemId,
    area: cleanText(item?.area) || null,
    detail: cleanText(item?.detail),
    media: Array.isArray(item?.media) ? item.media.map((x: any) => cleanText(x)).filter(Boolean) : [],
    submitAsCompleted: !!item?.submitAsCompleted,
    completionNote: cleanText(item?.completionNote),
    completionAfterPhotos: Array.isArray(item?.completionAfterPhotos) ? item.completionAfterPhotos.map((x: any) => cleanText(x)).filter(Boolean) : [],
    completionStartedAt: cleanText(item?.completionStartedAt) || null,
    completionEndedAt: cleanText(item?.completionEndedAt) || null,
  }
}

function normalizeDailyDraft(item: any): InspectionPanelDailyDraft | null {
  const clientId = cleanText(item?.clientId)
  const clientItemId = cleanText(item?.client_item_id) || clientId
  if (!clientId || !clientItemId) return null
  const status = cleanText(item?.status)
  return {
    clientId,
    client_item_id: clientItemId,
    status: status === 'replaced' || status === 'no_action' ? status : 'need_replace',
    itemName: cleanText(item?.itemName),
    itemSku: cleanText(item?.itemSku) || null,
    qty: cleanText(item?.qty) || '1',
    note: cleanText(item?.note),
    media: Array.isArray(item?.media) ? item.media.map((x: any) => cleanText(x)).filter(Boolean) : [],
  }
}

function normalizeState(taskId: string, raw: any): InspectionPanelFeedbackDraftState | null {
  if (!raw || typeof raw !== 'object') return null
  const kind = cleanText(raw.kind)
  if (kind !== 'maintenance' && kind !== 'deep_cleaning' && kind !== 'daily_necessities') return null
  return {
    task_id: cleanText(raw.task_id) || cleanText(taskId),
    updated_at: cleanText(raw.updated_at) || new Date().toISOString(),
    kind,
    maintenanceDrafts: Array.isArray(raw.maintenanceDrafts) ? raw.maintenanceDrafts.map(normalizeMaintenanceDraft).filter(Boolean) as InspectionPanelMaintenanceDraft[] : [],
    deepCleaningDrafts: Array.isArray(raw.deepCleaningDrafts) ? raw.deepCleaningDrafts.map(normalizeDeepCleaningDraft).filter(Boolean) as InspectionPanelDeepCleaningDraft[] : [],
    dailyDrafts: Array.isArray(raw.dailyDrafts) ? raw.dailyDrafts.map(normalizeDailyDraft).filter(Boolean) as InspectionPanelDailyDraft[] : [],
    photo_meta: normalizePhotoMeta(raw.photo_meta),
  }
}

export async function getInspectionPanelFeedbackDraft(taskId: string) {
  const key = cleanText(taskId)
  if (!key) return null
  return normalizeState(key, await getJson<InspectionPanelFeedbackDraftState>(draftKey(key)))
}

export async function setInspectionPanelFeedbackDraft(taskId: string, draft: Omit<InspectionPanelFeedbackDraftState, 'task_id' | 'updated_at'>) {
  const key = cleanText(taskId)
  if (!key) return
  const payload = normalizeState(key, {
    ...draft,
    task_id: key,
    updated_at: new Date().toISOString(),
  })
  if (!payload) return
  await setJson(draftKey(key), payload)
}

export async function clearInspectionPanelFeedbackDraft(taskId: string) {
  const key = cleanText(taskId)
  if (!key) return
  await remove(draftKey(key))
}
