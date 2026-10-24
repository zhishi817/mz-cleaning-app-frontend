import { normalizeCleaningObjectKey } from './cleaningMedia'
import type {
  InspectionPanelBatchMedia,
  InspectionPanelRoomPhotoArea,
  InspectionPanelRoomPhotoMap,
} from './inspectionPanelSubmitQueue'

export type InspectionPanelServerSubmission = {
  status: 'submitted' | 'none' | 'unavailable'
  submit_id: string | null
  saved_at: string | null
  guest_arrival_confirmed?: boolean
}

export type InspectionPanelServerPhotoItem = {
  area: string
  url: string
  note?: string | null
  captured_at?: string | null
  created_at?: string | null
}

export type InspectionPanelServerPhotoState = {
  roomPhotos: Record<InspectionPanelRoomPhotoArea, InspectionPanelBatchMedia[]>
  cleaningIssue: InspectionPanelBatchMedia[]
  total: number
}

function cleanText(value: unknown) {
  return String(value || '').trim()
}

export function emptyInspectionPanelRoomPhotos() {
  return {
    living: [],
    sofa: [],
    bedroom: [],
    kitchen: [],
    bathroom: [],
    balcony: [],
  } as Record<InspectionPanelRoomPhotoArea, InspectionPanelBatchMedia[]>
}

function remoteReferenceIdentity(value: unknown) {
  const raw = cleanText(value)
  if (!raw) return ''
  const directKey = normalizeCleaningObjectKey(raw)
  if (directKey) return `key:${directKey}`
  if (/^https?:\/\//i.test(raw)) {
    try {
      const pathKey = normalizeCleaningObjectKey(new URL(raw).pathname.replace(/^\/+/, ''))
      if (pathKey) return `key:${pathKey}`
    } catch {}
  }
  return `url:${raw}`
}

function mediaRemoteIdentity(media: InspectionPanelBatchMedia) {
  return remoteReferenceIdentity(media.uploaded_key) || remoteReferenceIdentity(media.uploaded_url)
}

export function buildInspectionPanelServerPhotoState(items: InspectionPanelServerPhotoItem[]) {
  const roomPhotos = emptyInspectionPanelRoomPhotos()
  const cleaningIssue: InspectionPanelBatchMedia[] = []
  for (const [index, item] of (Array.isArray(items) ? items : []).entries()) {
    const url = cleanText(item?.url)
    const area = cleanText(item?.area).toLowerCase()
    if (!url || (!Object.prototype.hasOwnProperty.call(roomPhotos, area) && area !== 'unclean')) continue
    const key = normalizeCleaningObjectKey(url)
    const media: InspectionPanelBatchMedia = {
      id: `server-inspection-${area}-${index}`,
      local_uri: null,
      thumbnail_uri: null,
      uploaded_key: key || null,
      uploaded_url: key ? null : url,
      name: `已同步${area}检查照片`,
      mime_type: 'image/jpeg',
      captured_at: cleanText(item?.captured_at) || cleanText(item?.created_at) || '1970-01-01T00:00:00.000Z',
      note: cleanText(item?.note) || null,
    }
    if (area === 'unclean') cleaningIssue.push(media)
    else roomPhotos[area as InspectionPanelRoomPhotoArea].push(media)
  }
  return {
    roomPhotos,
    cleaningIssue,
    total: Object.values(roomPhotos).reduce((sum, values) => sum + values.length, 0) + cleaningIssue.length,
  } satisfies InspectionPanelServerPhotoState
}

function mergeMedia(localItems: InspectionPanelBatchMedia[], serverItems: InspectionPanelBatchMedia[]) {
  const merged = localItems.map((item) => ({ ...item }))
  const byRemoteIdentity = new Map<string, number>()
  for (const [index, item] of merged.entries()) {
    const identity = mediaRemoteIdentity(item)
    if (identity && !byRemoteIdentity.has(identity)) byRemoteIdentity.set(identity, index)
  }
  for (const serverItem of serverItems) {
    const identity = mediaRemoteIdentity(serverItem)
    const existingIndex = identity ? byRemoteIdentity.get(identity) : undefined
    if (existingIndex == null) {
      if (identity) byRemoteIdentity.set(identity, merged.length)
      merged.push({ ...serverItem })
      continue
    }
    const current = merged[existingIndex]
    merged[existingIndex] = {
      ...current,
      uploaded_key: current.uploaded_key || serverItem.uploaded_key || null,
      uploaded_url: current.uploaded_url || serverItem.uploaded_url || null,
      captured_at: cleanText(current.captured_at) || serverItem.captured_at,
      note: current.note || serverItem.note || null,
    }
  }
  return merged
}

export function mergeInspectionPanelServerPhotos(params: {
  localRoomPhotos?: InspectionPanelRoomPhotoMap | null
  localCleaningIssue?: InspectionPanelBatchMedia[] | null
  server: InspectionPanelServerPhotoState | null
}) {
  const localRoomPhotos: Partial<InspectionPanelRoomPhotoMap> = params.localRoomPhotos || {}
  const roomPhotos = emptyInspectionPanelRoomPhotos()
  for (const area of Object.keys(roomPhotos) as InspectionPanelRoomPhotoArea[]) {
    roomPhotos[area] = mergeMedia(localRoomPhotos[area] || [], params.server?.roomPhotos[area] || [])
  }
  return {
    roomPhotos,
    cleaningIssue: mergeMedia(params.localCleaningIssue || [], params.server?.cleaningIssue || []),
  }
}

export function hasExactFormalInspectionSubmission(value: InspectionPanelServerSubmission | null | undefined) {
  return value?.status === 'submitted' && !!cleanText(value.submit_id)
}
