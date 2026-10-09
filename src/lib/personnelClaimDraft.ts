import { deleteDraftMedia, draftFileExists, persistCompressedDraftMedia } from './localMediaDrafts'
import { getJson, remove, setJson } from './storage'
import type { PersonnelClaimPayload, PersonnelClaimType } from './api'

export type PersonnelClaimDraftMedia = {
  media_id: string
  local_uri: string
  name: string
  mime_type: string
  state: 'local_only' | 'uploading' | 'associated'
  evidence_id?: string | null
  error?: string | null
}

export type PersonnelClaimDraft = {
  request_id: string
  claim_id?: string | null
  service_date: string
  claim_type: PersonnelClaimType
  property_id: string
  started_at: string
  ended_at: string
  duration_minutes: string
  requested_quantity: string
  requested_amount: string
  note: string
  media: PersonnelClaimDraftMedia[]
  updated_at: string
}

const KEY_PREFIX = 'personnel-claim-draft:v1:'

function cleanId(value: unknown) {
  return String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100)
}

export function personnelClaimDraftKey(userId: string, scope = 'default') {
  const value = cleanId(userId)
  if (!value) throw new Error('user_id_required')
  const scoped = cleanId(scope)
  return scoped && scoped !== 'default' ? `${KEY_PREFIX}${value}:${scoped}` : `${KEY_PREFIX}${value}`
}

export function makePersonnelClaimLocalId(prefix: 'claim' | 'media') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`
}

export function emptyPersonnelClaimDraft(serviceDate: string): PersonnelClaimDraft {
  return {
    request_id: makePersonnelClaimLocalId('claim'),
    claim_id: null,
    service_date: String(serviceDate || '').slice(0, 10),
    claim_type: 'subsidy_amount',
    property_id: '',
    started_at: '',
    ended_at: '',
    duration_minutes: '',
    requested_quantity: '',
    requested_amount: '',
    note: '',
    media: [],
    updated_at: new Date().toISOString(),
  }
}

export async function loadPersonnelClaimDraft(userId: string, scope = 'default') {
  const draft = await getJson<PersonnelClaimDraft>(personnelClaimDraftKey(userId, scope))
  if (!draft?.request_id) return null
  return {
    ...draft,
    media: (Array.isArray(draft.media) ? draft.media : []).map((item) => (
      item.state === 'uploading' ? { ...item, state: 'local_only' as const, error: '上次上传中断，请重试' } : item
    )),
  }
}

export async function savePersonnelClaimDraft(userId: string, draft: PersonnelClaimDraft, scope = 'default') {
  const next = { ...draft, updated_at: new Date().toISOString() }
  await setJson(personnelClaimDraftKey(userId, scope), next)
  return next
}

export async function addPersonnelClaimDraftPhoto(
  userId: string,
  draft: PersonnelClaimDraft,
  file: { uri: string; name: string; mimeType: string },
  scope = 'default',
) {
  if (draft.media.length >= 5) throw new Error('每次工作量反馈最多上传 5 张证明照片')
  const mediaId = makePersonnelClaimLocalId('media')
  const saved = await persistCompressedDraftMedia({
    dirName: 'personnel-claim-drafts',
    prefix: mediaId,
    sourceUri: file.uri,
    name: file.name,
    mimeType: file.mimeType,
    kind: 'photo',
    maxWidth: 1920,
    quality: 0.76,
  })
  return savePersonnelClaimDraft(userId, {
    ...draft,
    media: [...draft.media, {
      media_id: mediaId,
      local_uri: saved.localUri,
      name: saved.name,
      mime_type: saved.mimeType,
      state: 'local_only',
      evidence_id: null,
      error: null,
    }],
  }, scope)
}

export async function removePersonnelClaimDraftPhoto(userId: string, draft: PersonnelClaimDraft, mediaId: string, scope = 'default') {
  const media = draft.media.find((item) => item.media_id === mediaId)
  if (!media) return draft
  if (media.state === 'associated') throw new Error('该照片已关联申报，不能从草稿中删除')
  deleteDraftMedia(media.local_uri)
  return savePersonnelClaimDraft(userId, {
    ...draft,
    media: draft.media.filter((item) => item.media_id !== mediaId),
  }, scope)
}

export function personnelClaimDraftMissingMedia(draft: PersonnelClaimDraft) {
  return draft.media.filter((item) => item.state !== 'associated' && !draftFileExists(item.local_uri))
}

export function personnelClaimPayloadFromDraft(draft: PersonnelClaimDraft): PersonnelClaimPayload {
  const amount = String(draft.requested_amount || '').trim()
  const quantity = String(draft.requested_quantity || '').trim()
  const duration = String(draft.duration_minutes || '').trim()
  return {
    client_request_id: draft.claim_id ? undefined : draft.request_id,
    service_date: draft.service_date,
    claim_type: draft.claim_type,
    property_id: draft.property_id.trim() || null,
    started_at: draft.started_at.trim() || null,
    ended_at: draft.ended_at.trim() || null,
    duration_minutes: duration ? Math.round(Number(duration) * 60) : null,
    requested_quantity: quantity || null,
    requested_amount_cents: amount ? Math.round(Number(amount) * 100) : null,
    note: draft.note.trim(),
  }
}

export async function clearPersonnelClaimDraft(userId: string, draft: PersonnelClaimDraft, scope = 'default') {
  for (const item of draft.media) deleteDraftMedia(item.local_uri)
  await remove(personnelClaimDraftKey(userId, scope))
}
