import type { WorkTaskFormPhotoRecord } from './api'
import { getCleaningConsumablesDraft, isLocalCleaningConsumablesPhotoUri } from './cleaningConsumablesDraft'
import { normalizeCleaningObjectKey } from './cleaningMedia'
import {
  getInspectionPanelDraft,
  type InspectionPanelDraft,
} from './inspectionPanelDraft'
import {
  listInspectionPanelBatches,
  type InspectionPanelBatchMedia,
  type InspectionPanelSubmitQueueItem,
} from './inspectionPanelSubmitQueue'

export type TaskFormPhotoStatus = 'pending_sync' | 'syncing' | 'sync_failed' | 'synced' | 'synced_unlabeled'

export type TaskFormPhoto = {
  id: string
  task_id: string
  source: 'inspection' | 'restock' | 'consumable' | 'issue' | string
  area?: string | null
  item_id?: string | null
  label?: string | null
  local_uri?: string | null
  thumbnail_uri?: string | null
  local_media_id?: string | null
  queue_item_id?: string | null
  uploaded_key?: string | null
  uploaded_url?: string | null
  captured_at?: string | null
  created_at?: string | null
  status: TaskFormPhotoStatus
  origin: 'server' | 'local'
}

const AREA_LABELS: Record<string, string> = {
  living: '客厅',
  sofa: '沙发',
  bedroom: '卧室',
  kitchen: '厨房',
  bathroom: '浴室',
  toilet: '卫生间',
  shower_drain: '淋浴房下水口',
  unclean: '清洁问题',
}

function cleanText(value: any) {
  return String(value || '').trim()
}

function uniq(values: any[]) {
  return Array.from(new Set(values.map(cleanText).filter(Boolean)))
}

function remoteIdentityFromUrl(value: string) {
  const raw = cleanText(value)
  if (!raw) return ''
  try {
    const parsed = new URL(raw)
    const path = parsed.pathname.replace(/^\/+/, '').replace(/\/+$/, '')
    const cleaningIndex = path.indexOf('cleaning/')
    if (cleaningIndex >= 0) return `key:${path.slice(cleaningIndex)}`
    return `url:${parsed.protocol.toLowerCase()}//${parsed.host.toLowerCase()}${path ? `/${path}` : ''}`
  } catch {
    return `url:${raw.replace(/\/+$/, '')}`
  }
}

export function taskFormPhotoRemoteIdentity(photo: Pick<TaskFormPhoto, 'uploaded_key' | 'uploaded_url'> | Pick<TaskFormPhoto, 'uploaded_key' | 'uploaded_url'> & { url?: string | null }) {
  const key = normalizeCleaningObjectKey(photo.uploaded_key)
  if (key) return `key:${key}`
  return remoteIdentityFromUrl(cleanText(photo.uploaded_url) || cleanText((photo as any).url))
}

function localIdentity(photo: TaskFormPhoto) {
  const localMediaId = cleanText(photo.local_media_id)
  if (localMediaId) return `local_media_id:${localMediaId}`
  const queueItemId = cleanText(photo.queue_item_id)
  if (queueItemId) return `queue_item_id:${queueItemId}`
  const uri = cleanText(photo.local_uri)
  return uri ? `local_uri:${uri}` : ''
}

function statusRank(status: TaskFormPhotoStatus) {
  if (status === 'synced') return 5
  if (status === 'synced_unlabeled') return 4
  if (status === 'sync_failed') return 3
  if (status === 'syncing') return 2
  return 1
}

function preferPhoto(current: TaskFormPhoto, next: TaskFormPhoto) {
  if (current.origin !== next.origin) return current.origin === 'server' ? current : next
  if (statusRank(next.status) > statusRank(current.status)) return next
  return current
}

export function dedupeTaskFormPhotos(photos: TaskFormPhoto[]) {
  const output: TaskFormPhoto[] = []
  const remoteIndexes = new Map<string, number>()
  const localIndexes = new Map<string, number>()
  for (const photo of photos) {
    const remoteId = taskFormPhotoRemoteIdentity(photo)
    const localId = localIdentity(photo)
    const existingIndexes = [
      remoteId ? remoteIndexes.get(remoteId) : undefined,
      localId ? localIndexes.get(localId) : undefined,
    ].filter((index): index is number => index != null)
    const existingIndex = existingIndexes[0]
    if (existingIndex == null) {
      const nextIndex = output.length
      output.push(photo)
      if (remoteId) remoteIndexes.set(remoteId, nextIndex)
      if (localId) localIndexes.set(localId, nextIndex)
      continue
    }
    const preferred = preferPhoto(output[existingIndex], photo)
    output[existingIndex] = preferred
    const preferredRemoteId = taskFormPhotoRemoteIdentity(preferred)
    const preferredLocalId = localIdentity(preferred)
    if (preferredRemoteId) remoteIndexes.set(preferredRemoteId, existingIndex)
    if (preferredLocalId) localIndexes.set(preferredLocalId, existingIndex)
  }
  return output
}

export function taskFormPhotoRelationIds(task: any) {
  return uniq([
    task?.id,
    task?.source_id,
    ...(Array.isArray(task?.source_ids) ? task.source_ids : []),
    ...(Array.isArray(task?.active_source_ids) ? task.active_source_ids : []),
    ...(Array.isArray(task?.all_related_source_ids) ? task.all_related_source_ids : []),
    ...(Array.isArray(task?.cleaning_task_ids) ? task.cleaning_task_ids : []),
    ...(Array.isArray(task?.inspection_task_ids) ? task.inspection_task_ids : []),
    ...(Array.isArray(task?.execution_task_ids) ? task.execution_task_ids : []),
  ])
}

function localStatus(queueStatus?: InspectionPanelSubmitQueueItem['status'] | null, hasRemote = false): TaskFormPhotoStatus {
  if (queueStatus === 'syncing') return 'syncing'
  if (queueStatus === 'partial_failed' || queueStatus === 'failed') return 'sync_failed'
  if (queueStatus === 'synced' && hasRemote) return 'synced'
  return 'pending_sync'
}

function panelMediaPhoto(params: {
  taskId: string
  media: InspectionPanelBatchMedia
  source: 'inspection' | 'restock' | 'issue'
  area?: string | null
  itemId?: string | null
  label?: string | null
  queueStatus?: InspectionPanelSubmitQueueItem['status'] | null
  queueId?: string | null
}): TaskFormPhoto | null {
  const localUri = cleanText(params.media.local_uri)
  const thumbnailUri = cleanText(params.media.thumbnail_uri)
  const uploadedKey = cleanText(params.media.uploaded_key)
  const uploadedUrl = cleanText(params.media.uploaded_url)
  if (!localUri && !thumbnailUri && !uploadedKey && !uploadedUrl) return null
  return {
    id: cleanText(params.media.id) || `queue:${cleanText(params.queueId)}:${localUri || thumbnailUri}`,
    task_id: params.taskId,
    source: params.source,
    area: params.area || null,
    item_id: params.itemId || null,
    label: params.label || (params.area ? AREA_LABELS[params.area] || params.area : params.itemId || null),
    local_uri: localUri || null,
    thumbnail_uri: thumbnailUri || null,
    local_media_id: cleanText(params.media.id) || null,
    queue_item_id: cleanText(params.queueId) || null,
    uploaded_key: uploadedKey || null,
    uploaded_url: uploadedUrl || null,
    captured_at: cleanText(params.media.captured_at) || null,
    status: localStatus(params.queueStatus, !!(uploadedKey || uploadedUrl)),
    origin: 'local',
  }
}

function panelSnapshotPhotos(taskId: string, snapshot: any, queueStatus?: InspectionPanelSubmitQueueItem['status'] | null, queueId?: string | null) {
  const photos: TaskFormPhoto[] = []
  const roomPhotos = snapshot?.room_photos && typeof snapshot.room_photos === 'object' ? snapshot.room_photos : {}
  for (const area of Object.keys(roomPhotos)) {
    for (const media of Array.isArray(roomPhotos[area]) ? roomPhotos[area] : []) {
      const photo = panelMediaPhoto({ taskId, media, source: 'inspection', area, queueStatus, queueId })
      if (photo) photos.push(photo)
    }
  }
  for (const item of Array.isArray(snapshot?.restock) ? snapshot.restock : []) {
    for (const media of Array.isArray(item?.proof_media) ? item.proof_media : []) {
      const photo = panelMediaPhoto({
        taskId,
        media,
        source: 'restock',
        itemId: cleanText(item?.item_id) || null,
        label: cleanText(item?.label) || cleanText(item?.item_id) || null,
        queueStatus,
        queueId,
      })
      if (photo) photos.push(photo)
    }
  }
  for (const media of Array.isArray(snapshot?.cleaning_issue) ? snapshot.cleaning_issue : []) {
    const photo = panelMediaPhoto({ taskId, media, source: 'issue', area: 'unclean', label: '清洁问题', queueStatus, queueId })
    if (photo) photos.push(photo)
  }
  return photos
}

function draftSnapshot(draft: InspectionPanelDraft | null) {
  if (!draft) return null
  return {
    task_id: draft.task_id,
    room_photos: draft.room_photos,
    restock: draft.restock,
    cleaning_issue: draft.cleaning_issue,
  }
}

function consumablePhoto(params: { taskId: string; value: string; source: 'consumable'; label: string; itemId?: string | null; capturedAt?: string; index: number }) {
  const value = cleanText(params.value)
  if (!value) return null
  const local = isLocalCleaningConsumablesPhotoUri(value) ? value : ''
  const remote = local ? '' : value
  return {
    id: `consumable:${params.taskId}:${params.itemId || params.label}:${params.index}`,
    task_id: params.taskId,
    source: params.source,
    item_id: params.itemId || null,
    label: params.label,
    local_uri: local || null,
    local_media_id: null,
    queue_item_id: null,
    uploaded_url: remote || null,
    captured_at: params.capturedAt || null,
    status: 'pending_sync',
    origin: 'local' as const,
  } satisfies TaskFormPhoto
}

function consumableDraftPhotos(taskId: string, draft: any) {
  const photos: TaskFormPhoto[] = []
  let index = 0
  const add = (value: any, label: string, itemId?: string | null) => {
    const photo = consumablePhoto({
      taskId,
      value,
      source: 'consumable',
      label,
      itemId,
      capturedAt: draft?.photo_meta?.[cleanText(value)]?.captured_at,
      index: index++,
    })
    if (photo) photos.push(photo)
  }
  add(draft?.living_room_photo_url, '客厅')
  add(draft?.remote_ac_photo_url, '空调')
  add(draft?.remote_tv_photo_url, '电视')
  for (const [key, value] of Object.entries(draft?.extra_photo_urls || {})) add(value, key)
  for (const item of Array.isArray(draft?.items) ? draft.items : []) {
    const itemId = cleanText(item?.item_id)
    const label = cleanText(item?.item_label) || itemId || '补品'
    const values = Array.isArray(item?.photo_urls) ? item.photo_urls : [item?.photo_url]
    for (const value of values) add(value, label, itemId)
  }
  return photos
}

function serverPhoto(photo: WorkTaskFormPhotoRecord): TaskFormPhoto | null {
  const url = cleanText(photo.url)
  const key = cleanText(photo.uploaded_key)
  if (!url && !key) return null
  const area = cleanText(photo.area) || null
  return {
    id: `server:${cleanText(photo.id)}`,
    task_id: cleanText(photo.task_id),
    source: cleanText(photo.source) || 'inspection',
    area,
    item_id: cleanText(photo.item_id) || null,
    label: cleanText(photo.label) || (area ? AREA_LABELS[area] || area : cleanText(photo.item_id) || null),
    uploaded_key: key || null,
    uploaded_url: url || null,
    captured_at: cleanText(photo.captured_at) || null,
    created_at: cleanText(photo.created_at) || null,
    status: photo.status === 'synced_unlabeled' ? 'synced_unlabeled' : 'synced',
    origin: 'server',
  }
}

export async function loadTaskFormLocalPhotos(task: any) {
  const relationIds = taskFormPhotoRelationIds(task)
  if (!relationIds.length) return []
  const [drafts, batches, consumableDrafts] = await Promise.all([
    Promise.all(relationIds.map((id) => getInspectionPanelDraft(id).catch(() => null))),
    listInspectionPanelBatches().catch(() => []),
    Promise.all(relationIds.map((id) => getCleaningConsumablesDraft(id).catch(() => null))),
  ])
  const photos: TaskFormPhoto[] = []
  for (const draft of drafts) {
    const snapshot = draftSnapshot(draft)
    if (snapshot) photos.push(...panelSnapshotPhotos(cleanText(draft?.task_id), snapshot))
  }
  for (const batch of (Array.isArray(batches) ? batches : []).filter((item) => relationIds.includes(cleanText(item?.task_id)) || relationIds.includes(cleanText(item?.cleaning_task_id)))) {
    photos.push(...panelSnapshotPhotos(cleanText(batch.task_id) || cleanText(batch.cleaning_task_id), batch.snapshot, batch.status, batch.submit_id))
  }
  for (let index = 0; index < consumableDrafts.length; index++) {
    const draft = consumableDrafts[index]
    if (!draft) continue
    const taskId = cleanText(draft.task_id) || relationIds[index]
    photos.push(...consumableDraftPhotos(taskId, draft))
  }
  return dedupeTaskFormPhotos(photos)
}

export function mergeTaskFormPhotos(serverPhotos: WorkTaskFormPhotoRecord[], localPhotos: TaskFormPhoto[]) {
  return dedupeTaskFormPhotos([
    ...(Array.isArray(serverPhotos) ? serverPhotos.map(serverPhoto).filter(Boolean) as TaskFormPhoto[] : []),
    ...(Array.isArray(localPhotos) ? localPhotos : []),
  ])
}
