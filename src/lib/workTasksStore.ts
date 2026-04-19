import { getJson, setJson } from './storage'
import { API_BASE_URL } from '../config/env'
import { listWorkTasks, type WorkTask } from './api'
import { prependNotice } from './noticesStore'
import EventSource from 'react-native-sse'
import { notifyAuthInvalidated } from './authEvents'

export type WorkTaskItem = WorkTask & {
  date: string
  _taskVersion?: number
  _sequenceNo?: number
}

export type WorkTasksView = 'mine' | 'all'
export type WorkTasksRealtimeState = 'idle' | 'connecting' | 'open' | 'error'

type StoreState = {
  items: WorkTaskItem[]
  bucketKey: string | null
  updatedAt: string | null
  lastReceivedEventId: string | null
  lastFullSyncTimestamp: string | null
  dirtyBuckets: Record<string, string>
  sseConnectionState: WorkTasksRealtimeState
}

type ActiveRealtimeParams = {
  token: string
  userId: string
  date_from: string
  date_to: string
  view: WorkTasksView
}

type StreamIdentity = {
  token: string
  userId: string
}

type WorkTaskStreamEvent = {
  event_id?: string
  sequence_no?: number
  task_id?: string
  task_version?: number
  source_type?: string
  source_ref_ids?: string[]
  event_type?: string
  change_scope?: string
  changed_fields?: string[]
  payload?: Record<string, any> | null
}

const STORAGE_PREFIX = 'mzstay.work_tasks.store.v1:'
const RECONNECT_DELAY_MS = 1500
const HEALTH_CHECK_INTERVAL_MS = 15000
const STREAM_IDLE_TIMEOUT_MS = 65000
const RESYNC_DEBOUNCE_MS = 500
const SAFE_PATCH_FIELDS = new Set([
  'status',
  'scheduled_date',
  'start_time',
  'end_time',
  'urgency',
  'title',
  'summary',
  'completion_photo_urls',
  'completion_note',
  'completion_reason',
  'old_code',
  'new_code',
  'guest_special_request',
  'note',
  'checked_out_at',
  'key_photo_url',
  'lockbox_video_url',
  'sort_index',
  'sort_index_cleaner',
  'sort_index_inspector',
  'cleaner_name',
  'inspector_name',
  'inspection_mode',
  'inspection_due_date',
  'keys_required',
  'keys_required_checkout',
  'keys_required_checkin',
  'key_tags',
  'restock_items',
  'completion_photos_ok',
  'property.address',
  'property.access_guide_link',
  'property.wifi_ssid',
  'property.wifi_password',
  'property.router_location',
])

const listeners = new Set<() => void>()
let state: StoreState = {
  items: [],
  bucketKey: null,
  updatedAt: null,
  lastReceivedEventId: null,
  lastFullSyncTimestamp: null,
  dirtyBuckets: {},
  sseConnectionState: 'idle',
}
let initializedKey: string | null = null
const hydratedBuckets = new Set<string>()
let activeRealtimeParams: ActiveRealtimeParams | null = null
let activeStreamIdentity: StreamIdentity | null = null
let streamEs: EventSource<'connected' | 'ping' | 'resync_required' | 'work_task_event'> | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let resyncTimer: ReturnType<typeof setTimeout> | null = null
let healthTimer: ReturnType<typeof setInterval> | null = null
let lastStreamActivityAt = 0
let fullSyncPromise: Promise<void> | null = null
let fullSyncQueued = false

function emit() {
  for (const cb of listeners) cb()
}

function normalizeBase(base: string) {
  return String(base || '').trim().replace(/\/+$/g, '')
}

function uniq(items: string[]) {
  return Array.from(new Set(items)).filter(Boolean)
}

function buildUrlCandidates(path: string) {
  const base = normalizeBase(API_BASE_URL)
  if (!base) return []
  const raw = base
  const stripAuth = raw.replace(/\/auth\/?$/g, '')
  const stripApi = stripAuth.replace(/\/api\/?$/g, '')
  const p = String(path || '').replace(/^\/+/g, '')
  return uniq([`${raw}/${p}`, `${stripAuth}/${p}`, `${stripApi}/${p}`].map((u) => u.replace(/([^:]\/)\/+/g, '$1')))
}

function envKey() {
  const b = normalizeBase(API_BASE_URL)
  return b ? `remote:${b}` : 'local'
}

function storageKey(bucketKey: string) {
  return `${STORAGE_PREFIX}${bucketKey}`
}

function buildStateFromSaved(saved: Partial<StoreState> | null | undefined, bucketKey: string): StoreState {
  return {
    items: Array.isArray(saved?.items) ? (saved?.items as WorkTaskItem[]) : [],
    bucketKey,
    updatedAt: saved?.updatedAt || null,
    lastReceivedEventId: saved?.lastReceivedEventId || null,
    lastFullSyncTimestamp: saved?.lastFullSyncTimestamp || null,
    dirtyBuckets: saved?.dirtyBuckets && typeof saved.dirtyBuckets === 'object' ? saved.dirtyBuckets : {},
    sseConnectionState: state.sseConnectionState,
  }
}

function sameRealtimeParams(a: ActiveRealtimeParams | null, b: ActiveRealtimeParams | null) {
  if (!a || !b) return false
  return a.token === b.token && a.userId === b.userId && a.date_from === b.date_from && a.date_to === b.date_to && a.view === b.view
}

function sameStreamIdentity(a: StreamIdentity | null, b: StreamIdentity | null) {
  if (!a || !b) return false
  return a.token === b.token && a.userId === b.userId
}

function setConnectionState(next: WorkTasksRealtimeState) {
  if (state.sseConnectionState === next) return
  state = { ...state, sseConnectionState: next, updatedAt: new Date().toISOString() }
  void persist()
  emit()
}

function markBucketDirty(bucketKey: string, reason: string) {
  if (!bucketKey) return
  state = {
    ...state,
    dirtyBuckets: { ...state.dirtyBuckets, [bucketKey]: `${reason}:${new Date().toISOString()}` },
    updatedAt: new Date().toISOString(),
  }
  void persist()
  emit()
}

function clearBucketDirty(bucketKey: string) {
  if (!bucketKey || !state.dirtyBuckets[bucketKey]) return
  const nextDirty = { ...state.dirtyBuckets }
  delete nextDirty[bucketKey]
  state = { ...state, dirtyBuckets: nextDirty, updatedAt: new Date().toISOString() }
}

function touchStreamActivity() {
  lastStreamActivityAt = Date.now()
}

function startHealthTimer() {
  if (healthTimer) return
  healthTimer = setInterval(() => {
    if (!activeRealtimeParams) return
    if (!lastStreamActivityAt) return
    if (Date.now() - lastStreamActivityAt < STREAM_IDLE_TIMEOUT_MS) return
    connectWorkTasksRealtime(true)
  }, HEALTH_CHECK_INTERVAL_MS)
}

function stopHealthTimer() {
  if (!healthTimer) return
  clearInterval(healthTimer)
  healthTimer = null
}

function closeStream(advanceRequestId = true) {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (streamEs) {
    try {
      streamEs.removeAllEventListeners()
      streamEs.close()
    } catch {}
  }
  streamEs = null
}

function scheduleReconnect() {
  if (!activeRealtimeParams) return
  if (reconnectTimer) return
  setConnectionState('error')
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connectWorkTasksRealtime(true)
  }, RECONNECT_DELAY_MS)
}

function buildStreamUrlCandidates(lastEventId: string | null, accessToken: string | null) {
  return buildUrlCandidates('mzapp/work-task-events/stream').map((baseUrl) => {
    const qs = new URLSearchParams()
    if (lastEventId) qs.set('last_event_id', lastEventId)
    if (accessToken) qs.set('access_token', accessToken)
    const serialized = qs.toString()
    if (!serialized) return baseUrl
    const joiner = baseUrl.includes('?') ? '&' : '?'
    return `${baseUrl}${joiner}${serialized}`
  })
}

function updateLastReceivedEventId(eventId: string | null) {
  if (!eventId) return
  if (state.lastReceivedEventId === eventId) return
  state = { ...state, lastReceivedEventId: eventId, updatedAt: new Date().toISOString() }
  void persist()
  emit()
}

function normalizeTaskIds(task: WorkTaskItem, event: WorkTaskStreamEvent) {
  const ids = [
    String(task.id || '').trim(),
    String(task.source_id || '').trim(),
    ...(Array.isArray(task.source_ids) ? task.source_ids : []),
    ...(Array.isArray(task.cleaning_task_ids) ? task.cleaning_task_ids : []),
    ...(Array.isArray(task.inspection_task_ids) ? task.inspection_task_ids : []),
    String(event.task_id || '').trim(),
    ...(Array.isArray(event.source_ref_ids) ? event.source_ref_ids : []),
  ]
    .map((v) => String(v || '').trim())
    .filter(Boolean)
  return new Set(ids)
}

function matchTaskIds(task: WorkTaskItem, ids: string[]) {
  const candidates = normalizeTaskIds(task, {})
  return ids.some((id) => candidates.has(id))
}

function isSafePatchEvent(event: WorkTaskStreamEvent) {
  const eventType = String(event.event_type || '').trim()
  const scope = String(event.change_scope || '').trim()
  if (!['TASK_UPDATED', 'TASK_COMPLETED', 'TASK_DETAIL_ASSET_CHANGED'].includes(eventType)) return false
  if (!(scope === 'list' || scope === 'detail')) return false
  const fields = Array.isArray(event.changed_fields) ? event.changed_fields.map((x) => String(x || '').trim()).filter(Boolean) : []
  if (!fields.length) return false
  return fields.every((field) => SAFE_PATCH_FIELDS.has(field))
}

function getPatchValue(patch: Record<string, any>, key: string) {
  if (Object.prototype.hasOwnProperty.call(patch, key)) return patch[key]
  const parts = key.split('.')
  let cursor: any = patch
  for (const part of parts) {
    if (!cursor || typeof cursor !== 'object' || !Object.prototype.hasOwnProperty.call(cursor, part)) return undefined
    cursor = cursor[part]
  }
  return cursor
}

function mergePatchIntoTask(task: WorkTaskItem, event: WorkTaskStreamEvent) {
  const payload = event.payload && typeof event.payload === 'object' ? event.payload : {}
  const patch = payload.patch && typeof payload.patch === 'object' ? payload.patch : {}
  const changedFields = Array.isArray(event.changed_fields) ? event.changed_fields.map((x) => String(x || '').trim()).filter(Boolean) : []
  const next: WorkTaskItem = {
    ...task,
    _taskVersion: Number(event.task_version || task._taskVersion || 0),
    _sequenceNo: Number(event.sequence_no || task._sequenceNo || 0),
  }
  for (const field of changedFields) {
    const value = getPatchValue(patch, field)
    if (typeof value === 'undefined') continue
    if (field.startsWith('property.')) {
      const key = field.slice('property.'.length)
      next.property = { ...(next.property || { id: '', code: '', address: '', unit_type: '' }), [key]: value }
      continue
    }
    ;(next as any)[field] = value
  }
  const date = String(next.scheduled_date || '').slice(0, 10)
  next.date = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : task.date
  return next
}

function findTaskIndexForEvent(event: WorkTaskStreamEvent) {
  const ids = Array.from(
    new Set(
      [event.task_id, ...(Array.isArray(event.source_ref_ids) ? event.source_ref_ids : [])]
        .map((v) => String(v || '').trim())
        .filter(Boolean),
    ),
  )
  if (!ids.length) return -1
  return state.items.findIndex((task) => matchTaskIds(task, ids))
}

function shouldIgnoreByVersion(task: WorkTaskItem, event: WorkTaskStreamEvent) {
  const localVersion = Number(task._taskVersion || 0)
  const nextVersion = Number(event.task_version || 0)
  if (nextVersion && localVersion && nextVersion < localVersion) return true
  if (nextVersion && localVersion && nextVersion === localVersion) {
    const localSequence = Number(task._sequenceNo || 0)
    const nextSequence = Number(event.sequence_no || 0)
    if (localSequence && nextSequence && nextSequence <= localSequence) return true
  }
  return false
}

async function forceFullSync() {
  if (!activeRealtimeParams) return
  if (fullSyncPromise) {
    fullSyncQueued = true
    return fullSyncPromise
  }
  const params = activeRealtimeParams
  fullSyncPromise = refreshWorkTasksFromServer(params)
    .catch(() => {})
    .finally(() => {
      fullSyncPromise = null
    })
  await fullSyncPromise
  if (fullSyncQueued) {
    fullSyncQueued = false
    await forceFullSync()
  }
}

function scheduleFullSync(reason: string) {
  const bucketKey = state.bucketKey
  if (bucketKey) markBucketDirty(bucketKey, reason)
  if (resyncTimer) return
  resyncTimer = setTimeout(() => {
    resyncTimer = null
    void forceFullSync()
  }, RESYNC_DEBOUNCE_MS)
}

function applyWorkTaskEvent(event: WorkTaskStreamEvent) {
  updateLastReceivedEventId(String(event.event_id || '').trim() || null)
  const eventType = String(event.event_type || '').trim()
  const scope = String(event.change_scope || '').trim()
  if (scope === 'membership' || eventType === 'TASK_CREATED' || eventType === 'TASK_REMOVED' || eventType === 'TASK_ASSIGNMENT_CHANGED') {
    scheduleFullSync(eventType || 'membership')
    return
  }
  if (!isSafePatchEvent(event)) {
    scheduleFullSync(eventType || 'unsafe_patch')
    return
  }
  const index = findTaskIndexForEvent(event)
  if (index < 0) {
    scheduleFullSync('task_missing_for_patch')
    return
  }
  const prev = state.items[index]
  if (shouldIgnoreByVersion(prev, event)) return
  const nextTask = mergePatchIntoTask(prev, event)
  const items = state.items.slice()
  items[index] = nextTask
  state = {
    ...state,
    items,
    updatedAt: new Date().toISOString(),
  }
  void persist()
  emit()
}

function processSseBlock(block: { type?: string; data?: string | null; lastEventId?: string | null }) {
  const eventName = String((block as any)?.type || 'message').trim()
  const eventId = String((block as any)?.lastEventId || '').trim()
  const rawData = String((block as any)?.data || '').trim()
  let data: any = null
  if (rawData) {
    try {
      data = JSON.parse(rawData)
    } catch {
      data = rawData
    }
  }
  touchStreamActivity()
  if (eventName === 'connected' || eventName === 'ping') {
    setConnectionState('open')
    return
  }
  if (eventName === 'resync_required') {
    setConnectionState('open')
    scheduleFullSync(String((data as any)?.reason || 'resync_required'))
    return
  }
  if (eventName !== 'work_task_event') return
  setConnectionState('open')
  const normalizedEvent = data && typeof data === 'object' ? ({ ...data, event_id: (data as any).event_id || eventId } as WorkTaskStreamEvent) : ({ event_id: eventId } as WorkTaskStreamEvent)
  applyWorkTaskEvent(normalizedEvent)
}

function connectWorkTasksRealtime(forceReconnect = false) {
  if (!activeRealtimeParams) return
  const urls = buildStreamUrlCandidates(state.lastReceivedEventId, activeRealtimeParams.token)
  if (!urls.length) return
  if (!forceReconnect && streamEs) return

  closeStream(false)
  stopHealthTimer()
  setConnectionState('connecting')
  touchStreamActivity()
  startHealthTimer()

  const url = urls[0]
  const es = new EventSource<'connected' | 'ping' | 'resync_required' | 'work_task_event'>(url, {
    headers: {
      Accept: 'text/event-stream',
      'Cache-Control': 'no-cache',
      Authorization: {
        toString() {
          return `Bearer ${activeRealtimeParams?.token || ''}`
        },
      },
      ...(state.lastReceivedEventId
        ? {
            'Last-Event-ID': {
              toString() {
                return String(state.lastReceivedEventId || '')
              },
            },
          }
        : {}),
    },
    timeout: 0,
    timeoutBeforeConnection: 0,
    pollingInterval: 0,
  })
  streamEs = es

  es.addEventListener('open', () => {
    if (streamEs !== es) return
    setConnectionState('open')
    touchStreamActivity()
  })
  es.addEventListener('connected', (event) => {
    if (streamEs !== es) return
    processSseBlock(event)
  })
  es.addEventListener('ping', (event) => {
    if (streamEs !== es) return
    processSseBlock(event)
  })
  es.addEventListener('resync_required', (event) => {
    if (streamEs !== es) return
    processSseBlock(event)
  })
  es.addEventListener('work_task_event', (event) => {
    if (streamEs !== es) return
    processSseBlock(event)
  })
  es.addEventListener('error', (event) => {
    if (streamEs !== es) return
    const xhrStatus = Number((event as any)?.xhrStatus || 0)
    if (xhrStatus === 401 || xhrStatus === 403) {
      if (xhrStatus === 401) notifyAuthInvalidated('session_expired')
      setConnectionState('error')
      closeStream(false)
      stopHealthTimer()
      return
    }
    streamEs = null
    scheduleReconnect()
  })
  es.addEventListener('close', () => {
    if (streamEs !== es) return
    streamEs = null
    scheduleReconnect()
  })
}

export function makeWorkTasksBucketKey(params: { userId: string; date_from: string; date_to: string; view: WorkTasksView }) {
  const u = String(params.userId || '').trim() || 'unknown'
  const df = String(params.date_from || '').trim()
  const dt = String(params.date_to || '').trim()
  const view = params.view === 'all' ? 'all' : 'mine'
  return `${envKey()}:${u}:${df}~${dt}:${view}`
}

export function subscribeWorkTasks(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function getWorkTasksSnapshot() {
  return state
}

export async function activateWorkTasksRealtime(params: ActiveRealtimeParams) {
  const next: ActiveRealtimeParams = {
    token: String(params.token || '').trim(),
    userId: String(params.userId || '').trim(),
    date_from: String(params.date_from || '').trim(),
    date_to: String(params.date_to || '').trim(),
    view: params.view === 'all' ? 'all' : 'mine',
  }
  if (!next.token || !next.userId || !next.date_from || !next.date_to) return
  const nextIdentity: StreamIdentity = { token: next.token, userId: next.userId }
  const streamChanged = !sameStreamIdentity(activeStreamIdentity, nextIdentity)
  activeRealtimeParams = next
  activeStreamIdentity = nextIdentity
  const bucketKey = makeWorkTasksBucketKey(next)
  if (state.bucketKey !== bucketKey) await initWorkTasksStore({ bucketKey })
  if (streamChanged || !streamEs) connectWorkTasksRealtime(streamChanged)
}

export function findWorkTaskItemByAnyId(id0: string) {
  const id = String(id0 || '').trim()
  if (!id) return null
  return state.items.find((task) => matchTaskIds(task, [id])) || null
}

export function findWorkTaskItemByAnyIds(ids0: any[]) {
  const ids = Array.from(new Set((Array.isArray(ids0) ? ids0 : []).map((v) => String(v || '').trim()).filter(Boolean)))
  if (!ids.length) return null
  return state.items.find((task) => matchTaskIds(task, ids)) || null
}

export async function patchWorkTaskItem(id0: string, patch: Partial<WorkTaskItem>) {
  const id = String(id0 || '').trim()
  if (!id) return
  const idx = state.items.findIndex((x) => x.id === id)
  if (idx < 0) return
  const prev = state.items[idx]
  const next = { ...prev, ...patch }
  const items = state.items.slice()
  items[idx] = next
  state = { ...state, items, updatedAt: new Date().toISOString() }
  await persist()
  emit()
}

async function persist() {
  if (!state.bucketKey) return
  const toSave: StoreState = {
    ...state,
    sseConnectionState: 'idle',
  }
  await setJson(storageKey(state.bucketKey), toSave)
}

export async function initWorkTasksStore(params: { bucketKey: string }) {
  const key = String(params.bucketKey || '').trim()
  if (!key) throw new Error('missing bucketKey')
  if (initializedKey === key) return
  initializedKey = key
  state = {
    items: [],
    bucketKey: key,
    updatedAt: null,
    lastReceivedEventId: null,
    lastFullSyncTimestamp: null,
    dirtyBuckets: {},
    sseConnectionState: state.sseConnectionState,
  }
  const saved = await getJson<StoreState>(storageKey(key))
  state = buildStateFromSaved(saved, key)
  emit()
}

function mapRemoteTask(t: WorkTask): WorkTaskItem {
  const date = String(t.scheduled_date || '').slice(0, 10)
  return {
    ...t,
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : 'unknown',
    _taskVersion: Number((t as any)._taskVersion || 0) || undefined,
    _sequenceNo: Number((t as any)._sequenceNo || 0) || undefined,
  }
}

function titleForTask(t: WorkTaskItem) {
  const code = String(t?.property?.code || '').trim()
  if (code) return code
  const title = String(t?.title || '').trim()
  if (title) return title
  return '任务'
}

function hashText(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return String(h)
}

function normalizeLine(s: any) {
  return String(s ?? '').replace(/\s+/g, ' ').trim()
}

function formatUpdatedFields(prev: WorkTaskItem, next: WorkTaskItem) {
  const prevCheckout = normalizeLine((prev as any)?.start_time)
  const nextCheckout = normalizeLine((next as any)?.start_time)
  const prevCheckin = normalizeLine((prev as any)?.end_time)
  const nextCheckin = normalizeLine((next as any)?.end_time)
  const prevOld = normalizeLine((prev as any)?.old_code)
  const nextOld = normalizeLine((next as any)?.old_code)
  const prevNew = normalizeLine((prev as any)?.new_code)
  const nextNew = normalizeLine((next as any)?.new_code)
  const prevNeed = normalizeLine((prev as any)?.guest_special_request)
  const nextNeed = normalizeLine((next as any)?.guest_special_request)

  const lines: string[] = []
  if (prevCheckout !== nextCheckout) lines.push(`退房时间：${nextCheckout || '-'}（原：${prevCheckout || '-'}）`)
  if (prevCheckin !== nextCheckin) lines.push(`入住时间：${nextCheckin || '-'}（原：${prevCheckin || '-'}）`)
  if (prevOld !== nextOld) lines.push(`旧密码：${nextOld || '-'}（原：${prevOld || '-'}）`)
  if (prevNew !== nextNew) lines.push(`新密码：${nextNew || '-'}（原：${prevNew || '-'}）`)
  if (prevNeed !== nextNeed) lines.push(`客人需求：${nextNeed || '-'}（原：${prevNeed || '-'}）`)
  return { lines, nextFieldsKey: hashText(JSON.stringify({ nextCheckout, nextCheckin, nextOld, nextNew, nextNeed })) }
}

export async function refreshWorkTasksFromServer(params: {
  token: string
  userId: string
  date_from: string
  date_to: string
  view: WorkTasksView
}) {
  const bucketKey = makeWorkTasksBucketKey({ userId: params.userId, date_from: params.date_from, date_to: params.date_to, view: params.view })
  await initWorkTasksStore({ bucketKey })
  const prevItems = state.items || []
  const shouldEmitDiffNotices = hydratedBuckets.has(bucketKey)
  const remote = await listWorkTasks(params.token, { date_from: params.date_from, date_to: params.date_to, view: params.view })
  const items = remote.map(mapRemoteTask).filter((t) => t.date !== 'unknown')

  try {
    if (shouldEmitDiffNotices) {
      const prevById = new Map(prevItems.map((x) => [x.id, x]))
      for (const it of items) {
        const prev = prevById.get(it.id) || null
        if (!prev) continue
        if (String(it.source_type || '').toLowerCase() !== 'cleaning_tasks') continue
        const code = titleForTask(it)
        const addr = String(it?.property?.address || '').trim()

        const prevCheckedOut = String((prev as any)?.checked_out_at || '').trim()
        const nextCheckedOut = String((it as any)?.checked_out_at || '').trim()
        if (!prevCheckedOut && nextCheckedOut) {
          const body = [code ? `房源：${code}` : '', addr ? `地址：${addr}` : '', '状态：已退房'].filter(Boolean).join('\n')
          await prependNotice({
            id: `guest_checked_out:${code}:${nextCheckedOut}`,
            type: 'update',
            title: `已退房：${code}`,
            summary: '已退房',
            content: body || '已退房',
            data: {
              kind: 'guest_checked_out',
              task_ids: Array.isArray((it as any)?.source_ids) ? (it as any).source_ids : [],
              property_code: code,
              checked_out_at: nextCheckedOut,
            },
          })
        }
        if (prevCheckedOut && !nextCheckedOut) {
          const body = [code ? `房源：${code}` : '', addr ? `地址：${addr}` : '', '状态：房源还未退房，待退房'].filter(Boolean).join('\n')
          await prependNotice({
            id: `guest_checked_out_cancelled:${code}:${prevCheckedOut}`,
            type: 'update',
            title: `待退房：${code}`,
            summary: '房源还未退房，待退房',
            content: body || '房源还未退房，待退房',
            data: {
              kind: 'guest_checked_out_cancelled',
              task_ids: Array.isArray((it as any)?.source_ids) ? (it as any).source_ids : [],
              property_code: code,
              checked_out_at: prevCheckedOut,
            },
          })
        }

        const prevFields = JSON.stringify({
          checkout_time: String((prev as any)?.start_time || ''),
          checkin_time: String((prev as any)?.end_time || ''),
          old_code: String((prev as any)?.old_code || ''),
          new_code: String((prev as any)?.new_code || ''),
          guest_special_request: String((prev as any)?.guest_special_request || ''),
        })
        const nextFields = JSON.stringify({
          checkout_time: String((it as any)?.start_time || ''),
          checkin_time: String((it as any)?.end_time || ''),
          old_code: String((it as any)?.old_code || ''),
          new_code: String((it as any)?.new_code || ''),
          guest_special_request: String((it as any)?.guest_special_request || ''),
        })
        if (prevFields !== nextFields) {
          const detail = formatUpdatedFields(prev as any, it as any)
          const body = [
            code ? `房源：${code}` : '',
            addr ? `地址：${addr}` : '',
            '任务信息已更新：',
            ...(detail.lines.length ? detail.lines : ['时间/密码/客需（已更新）']),
          ]
            .filter(Boolean)
            .join('\n')
          await prependNotice({
            id: `manager_fields:${code}:${detail.nextFieldsKey}`,
            type: 'update',
            title: `任务信息更新：${code}`,
            summary: detail.lines[0] ? detail.lines[0].slice(0, 30) : '信息已更新',
            content: body,
            data: {
              kind: 'cleaning_task_manager_fields_updated',
              entity: 'cleaning_task',
              entityId: String((it as any)?.source_id || it.id || ''),
              task_ids: Array.isArray((it as any)?.source_ids) ? (it as any).source_ids : [],
              property_code: code,
              fields_key: detail.nextFieldsKey,
              event_id: `manager_fields:${code}:${detail.nextFieldsKey}`,
            },
          })
        }
      }
    }
  } catch {}

  const now = new Date().toISOString()
  clearBucketDirty(bucketKey)
  state = {
    ...state,
    items,
    bucketKey,
    updatedAt: now,
    lastFullSyncTimestamp: now,
  }
  await persist()
  hydratedBuckets.add(bucketKey)
  emit()
}
