import { getJson, setJson } from './storage'
import { API_BASE_URL } from '../config/env'
import { listWorkTasks, type WorkTask } from './api'
import EventSource from 'react-native-sse'
import { notifyAuthInvalidated } from './authEvents'
import { invalidateCleaningMediaCache } from './cleaningMediaCache'

export type WorkTaskItem = WorkTask & {
  date: string
  _taskVersion?: number
  _sequenceNo?: number
}

export type WorkTasksView = 'mine' | 'all'
export type WorkTasksRealtimeState = 'idle' | 'connecting' | 'open' | 'error'
export type WorkTasksRefreshMode = 'passive' | 'consistency' | 'force'

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
  occurred_at?: string
  caused_by_user_id?: string | null
}

const STORAGE_PREFIX = 'mzstay.work_tasks.store.v1:'
const RECONNECT_DELAY_MS = 1500
const HEALTH_CHECK_INTERVAL_MS = 15000
const STREAM_IDLE_TIMEOUT_MS = 65000
const FULL_REFRESH_COOLDOWN_MS = 60_000
const SAFE_PATCH_FIELDS = new Set([
  'status',
  'scheduled_date',
  'start_time',
  'end_time',
  'checkout_time',
  'checkin_time',
  'urgency',
  'title',
  'summary',
  'photo_urls',
  'completion_photo_urls',
  'completion_note',
  'completion_reason',
  'old_code',
  'new_code',
  'guest_special_request',
  'guest_request_checkout',
  'guest_request_checkin',
  'guest_request_summary',
  'guest_luggage',
  'note',
  'checked_out_at',
  'key_photo_url',
  'lockbox_video_url',
  'lockbox_video_uploaded_at',
  'sort_index',
  'sort_index_cleaner',
  'sort_index_inspector',
  'cleaner_name',
  'inspector_name',
  'capabilities',
  'available_actions',
  'participants',
  'inspection_mode',
  'inspection_scope',
  'inspection_due_date',
  'keys_required',
  'keys_required_checkout',
  'keys_required_checkin',
  'key_tags',
  'active_source_ids',
  'superseded_source_ids',
  'all_related_source_ids',
  'is_late_checkout',
  'is_early_checkin',
  'is_late_checkin',
  'display_conflicts',
  'turnover_display',
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
let workTasksHydrationGeneration = 0
let workTasksSessionIdentity: StreamIdentity | null = null
let workTasksSessionEpoch = 0
let activeRealtimeParams: ActiveRealtimeParams | null = null
let activeStreamIdentity: StreamIdentity | null = null
let streamEs: EventSource<'connected' | 'ping' | 'resync_required' | 'work_task_event'> | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let healthTimer: ReturnType<typeof setInterval> | null = null
let lastStreamActivityAt = 0
const refreshWorkTasksInFlight = new Map<string, Promise<boolean>>()
let localPatchRevision = 0
const localPatchRevisionsByBucket = new Map<string, Map<string, number>>()
let workTasksRefreshForeground = true
let refreshCoordinatorEpoch = 0

type WorkTasksRefreshParams = {
  token: string
  userId: string
  date_from: string
  date_to: string
  view: WorkTasksView
}

type RefreshWaiter = {
  generation: number
  resolve: (applied: boolean) => void
  reject: (error: unknown) => void
}

type RefreshCoordinatorScope = {
  params: WorkTasksRefreshParams
  running: boolean
  runningGeneration: number
  completedGeneration: number
  cooldownUntil: number
  pendingConsistency: boolean
  pendingForce: boolean
  timer: ReturnType<typeof setTimeout> | null
  waiters: RefreshWaiter[]
}

const refreshCoordinatorScopes = new Map<string, RefreshCoordinatorScope>()

function isRefreshCoordinatorScopeCurrent(scopeKey: string, scope: RefreshCoordinatorScope, epoch: number) {
  return refreshCoordinatorEpoch === epoch && refreshCoordinatorScopes.get(scopeKey) === scope
}

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

function isCurrentWorkTasksSession(params: { token: string; userId: string }, epoch: number = workTasksSessionEpoch) {
  return workTasksSessionEpoch === epoch && sameStreamIdentity(workTasksSessionIdentity, {
    token: String(params.token || '').trim(),
    userId: String(params.userId || '').trim(),
  })
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

function closeStream() {
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

export function deactivateWorkTasksRealtime() {
  workTasksSessionIdentity = null
  workTasksSessionEpoch += 1
  activeRealtimeParams = null
  activeStreamIdentity = null
  closeStream()
  stopHealthTimer()
  clearWorkTasksRefreshCoordinator()
  lastStreamActivityAt = 0
  setConnectionState('idle')
}

export function establishWorkTasksSession(params: { token: string; userId: string }) {
  const next: StreamIdentity = {
    token: String(params.token || '').trim(),
    userId: String(params.userId || '').trim(),
  }
  if (!next.token || !next.userId) {
    deactivateWorkTasksRealtime()
    return false
  }
  if (sameStreamIdentity(workTasksSessionIdentity, next)) return true
  deactivateWorkTasksRealtime()
  workTasksSessionIdentity = next
  return true
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
    ...(Array.isArray((task as any).active_source_ids) ? (task as any).active_source_ids : []),
    ...(Array.isArray((task as any).all_related_source_ids) ? (task as any).all_related_source_ids : []),
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

export function isSafePatchEvent(event: WorkTaskStreamEvent) {
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

export function mergePatchIntoTask(task: WorkTaskItem, event: WorkTaskStreamEvent) {
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
    ;(next as any)[field] = field === 'status' ? projectCleaningStatusForTask(next, value) : value
  }
  if (changedFields.includes('checkout_time') && !changedFields.includes('start_time')) {
    ;(next as any).start_time = (next as any).checkout_time ?? null
  }
  if (changedFields.includes('checkin_time') && !changedFields.includes('end_time')) {
    ;(next as any).end_time = (next as any).checkin_time ?? null
  }
  if (
    !changedFields.includes('summary') &&
    (changedFields.includes('checkout_time') || changedFields.includes('checkin_time') || changedFields.includes('start_time') || changedFields.includes('end_time'))
  ) {
    const checkoutTime = String((next as any).start_time || (next as any).checkout_time || '').trim()
    const checkinTime = String((next as any).end_time || (next as any).checkin_time || '').trim()
    ;(next as any).summary = checkoutTime && checkinTime
      ? `${checkoutTime}退房 ${checkinTime}入住`
      : checkoutTime
        ? `${checkoutTime}退房`
        : checkinTime
          ? `${checkinTime}入住`
          : (next as any).summary
  }
  const date = String(next.scheduled_date || '').slice(0, 10)
  next.date = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : task.date
  return next
}

export function projectCleaningStatusForTask(task: WorkTaskItem, value: any) {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return value
  if (String(task.source_type || '').trim().toLowerCase() !== 'cleaning_tasks') return value
  const kind = String(task.task_kind || '').trim().toLowerCase()
  if (kind === 'inspection') {
    if (raw === 'keys_hung') return 'keys_hung'
    if (raw === 'inspected') {
      return String((task as any).inspection_scope || '').trim().toLowerCase() === 'password_only' ? 'done' : 'to_hang_keys'
    }
    if (raw === 'done' || raw === 'completed' || raw === 'ready') return 'done'
    if (raw === 'cleaned' || raw === 'restock_pending' || raw === 'restocked') return 'to_inspect'
    if (raw === 'in_progress' || String((task as any).key_photo_url || '').trim()) return 'in_progress'
    if (raw === 'assigned' || String((task as any).inspector_id || '').trim()) return 'assigned'
    return raw
  }
  if (kind === 'cleaning') {
    if (raw === 'cleaned' || raw === 'restock_pending' || raw === 'restocked') return 'done'
    if (raw === 'inspected' || raw === 'ready' || raw === 'keys_hung') return 'done'
  }
  return value
}

function findTaskIndexesForEvent(event: WorkTaskStreamEvent) {
  const ids = Array.from(
    new Set(
      [event.task_id, ...(Array.isArray(event.source_ref_ids) ? event.source_ref_ids : [])]
        .map((v) => String(v || '').trim())
        .filter(Boolean),
    ),
  )
  if (!ids.length) return []
  const indexes: number[] = []
  state.items.forEach((task, index) => {
    if (matchTaskIds(task, ids)) indexes.push(index)
  })
  return indexes
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

function normalizeRefreshParams(params: WorkTasksRefreshParams): WorkTasksRefreshParams | null {
  const next: WorkTasksRefreshParams = {
    token: String(params.token || '').trim(),
    userId: String(params.userId || '').trim(),
    date_from: String(params.date_from || '').trim(),
    date_to: String(params.date_to || '').trim(),
    view: params.view === 'all' ? 'all' : 'mine',
  }
  return next.token && next.userId && next.date_from && next.date_to ? next : null
}

function refreshScopeKey(params: WorkTasksRefreshParams) {
  return makeWorkTasksBucketKey(params)
}

function getRefreshCoordinatorScope(params: WorkTasksRefreshParams) {
  const key = refreshScopeKey(params)
  let scope = refreshCoordinatorScopes.get(key)
  if (!scope) {
    scope = {
      params,
      running: false,
      runningGeneration: 0,
      completedGeneration: 0,
      cooldownUntil: 0,
      pendingConsistency: false,
      pendingForce: false,
      timer: null,
      waiters: [],
    }
    refreshCoordinatorScopes.set(key, scope)
  } else {
    scope.params = params
  }
  return { key, scope }
}

function settleRefreshWaiters(scope: RefreshCoordinatorScope, generation: number, applied: boolean, error: unknown) {
  const ready = scope.waiters.filter((waiter) => waiter.generation <= generation)
  scope.waiters = scope.waiters.filter((waiter) => waiter.generation > generation)
  for (const waiter of ready) {
    if (error) waiter.reject(error)
    else waiter.resolve(applied)
  }
}

function waitForRefreshGeneration(scope: RefreshCoordinatorScope, generation: number) {
  if (scope.completedGeneration >= generation) return Promise.resolve(true)
  return new Promise<boolean>((resolve, reject) => {
    scope.waiters.push({ generation, resolve, reject })
  })
}

function clearRefreshCoordinatorTimer(scope: RefreshCoordinatorScope) {
  if (!scope.timer) return
  clearTimeout(scope.timer)
  scope.timer = null
}

function armConsistencyRefresh(scopeKey: string, scope: RefreshCoordinatorScope) {
  if (!scope.pendingConsistency || scope.running || !workTasksRefreshForeground) return
  const delay = Math.max(0, scope.cooldownUntil - Date.now())
  if (delay <= 0) {
    startCoordinatedRefresh(scopeKey, scope)
    return
  }
  if (scope.timer) return
  scope.timer = setTimeout(() => {
    scope.timer = null
    if (!scope.pendingConsistency || scope.running || !workTasksRefreshForeground) return
    startCoordinatedRefresh(scopeKey, scope)
  }, delay)
}

function finishCoordinatedRefresh(scopeKey: string, scope: RefreshCoordinatorScope, generation: number, error: unknown) {
  scope.running = false
  scope.completedGeneration = generation
  settleRefreshWaiters(scope, generation, true, error)
  if (scope.pendingForce) {
    scope.pendingForce = false
    scope.pendingConsistency = false
    clearRefreshCoordinatorTimer(scope)
    if (workTasksRefreshForeground) startCoordinatedRefresh(scopeKey, scope)
    return
  }
  armConsistencyRefresh(scopeKey, scope)
}

function discardCoordinatedRefresh(scope: RefreshCoordinatorScope, generation: number) {
  scope.running = false
  scope.completedGeneration = generation
  scope.pendingForce = false
  scope.pendingConsistency = false
  clearRefreshCoordinatorTimer(scope)
  settleRefreshWaiters(scope, generation, false, null)
}

function startCoordinatedRefresh(scopeKey: string, scope: RefreshCoordinatorScope) {
  if (scope.running || !workTasksRefreshForeground) return
  clearRefreshCoordinatorTimer(scope)
  scope.pendingConsistency = false
  scope.running = true
  scope.runningGeneration += 1
  const generation = scope.runningGeneration
  const epoch = refreshCoordinatorEpoch
  const sessionEpoch = workTasksSessionEpoch
  const isCurrent = () => (
    isRefreshCoordinatorScopeCurrent(scopeKey, scope, epoch)
    && isCurrentWorkTasksSession(scope.params, sessionEpoch)
  )
  scope.cooldownUntil = Date.now() + FULL_REFRESH_COOLDOWN_MS
  void executeWorkTasksRefresh(scope.params, isCurrent)
    .then((applied) => {
      if (!isCurrent()) return
      if (!applied) {
        discardCoordinatedRefresh(scope, generation)
        return
      }
      finishCoordinatedRefresh(scopeKey, scope, generation, null)
    })
    .catch((error) => {
      if (isCurrent()) finishCoordinatedRefresh(scopeKey, scope, generation, error)
    })
}

function requestActiveWorkTasksRefresh(mode: WorkTasksRefreshMode, reason: string) {
  if (!activeRealtimeParams) return Promise.resolve()
  return requestWorkTasksRefresh({ ...activeRealtimeParams, mode, reason })
}

export function setWorkTasksRefreshForeground(isForeground: boolean) {
  workTasksRefreshForeground = isForeground
  if (!isForeground) {
    for (const scope of refreshCoordinatorScopes.values()) clearRefreshCoordinatorTimer(scope)
    return
  }
  for (const [scopeKey, scope] of refreshCoordinatorScopes.entries()) {
    if (scope.pendingForce && !scope.running) {
      scope.pendingForce = false
      scope.pendingConsistency = false
      startCoordinatedRefresh(scopeKey, scope)
      continue
    }
    armConsistencyRefresh(scopeKey, scope)
  }
}

export function requestWorkTasksRefresh(params: WorkTasksRefreshParams & { mode: WorkTasksRefreshMode; reason: string }) {
  const next = normalizeRefreshParams(params)
  if (!next || !isCurrentWorkTasksSession(next)) return Promise.resolve(false)
  const { key, scope } = getRefreshCoordinatorScope(next)
  const mode = params.mode
  const reason = String(params.reason || mode).trim() || mode
  const bucketKey = state.bucketKey
  if (bucketKey === key) markBucketDirty(bucketKey, reason)

  if (mode === 'passive') {
    if (!workTasksRefreshForeground || scope.running || Date.now() < scope.cooldownUntil) return Promise.resolve(false)
    const generation = scope.runningGeneration + 1
    startCoordinatedRefresh(key, scope)
    return waitForRefreshGeneration(scope, generation)
  }

  if (mode === 'consistency') {
    scope.pendingConsistency = true
    if (!scope.running && workTasksRefreshForeground && Date.now() >= scope.cooldownUntil) startCoordinatedRefresh(key, scope)
    else armConsistencyRefresh(key, scope)
    return Promise.resolve(true)
  }

  scope.pendingConsistency = false
  clearRefreshCoordinatorTimer(scope)
  if (!workTasksRefreshForeground) {
    scope.pendingForce = true
    return Promise.resolve(true)
  }
  if (scope.running) {
    scope.pendingForce = true
    return waitForRefreshGeneration(scope, scope.runningGeneration + 1)
  }
  const generation = scope.runningGeneration + 1
  startCoordinatedRefresh(key, scope)
  return waitForRefreshGeneration(scope, generation)
}

function clearWorkTasksRefreshCoordinator() {
  refreshCoordinatorEpoch += 1
  workTasksHydrationGeneration += 1
  initializedKey = null
  refreshWorkTasksInFlight.clear()
  for (const scope of refreshCoordinatorScopes.values()) {
    clearRefreshCoordinatorTimer(scope)
    for (const waiter of scope.waiters) waiter.resolve(false)
    scope.waiters = []
  }
  refreshCoordinatorScopes.clear()
}

function applyWorkTaskEvent(event: WorkTaskStreamEvent) {
  updateLastReceivedEventId(String(event.event_id || '').trim() || null)
  const eventType = String(event.event_type || '').trim()
  const scope = String(event.change_scope || '').trim()
  if (scope === 'membership' || eventType === 'TASK_CREATED' || eventType === 'TASK_REMOVED' || eventType === 'TASK_ASSIGNMENT_CHANGED') {
    if (scope === 'membership' || eventType === 'TASK_REMOVED' || eventType === 'TASK_ASSIGNMENT_CHANGED') {
      void invalidateCleaningMediaCache()
    }
    void requestActiveWorkTasksRefresh('consistency', eventType || 'membership')
    return
  }
  if (!isSafePatchEvent(event)) {
    void requestActiveWorkTasksRefresh('consistency', eventType || 'unsafe_patch')
    return
  }
  const indexes = findTaskIndexesForEvent(event)
  if (!indexes.length) {
    void requestActiveWorkTasksRefresh('consistency', 'task_missing_for_patch')
    return
  }
  const items = state.items.slice()
  let changed = false
  for (const index of indexes) {
    const prev = items[index]
    if (!prev) continue
    if (shouldIgnoreByVersion(prev, event)) continue
    items[index] = mergePatchIntoTask(prev, event)
    changed = true
  }
  if (!changed) return
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
    void invalidateCleaningMediaCache()
    void requestActiveWorkTasksRefresh('force', String((data as any)?.reason || 'resync_required')).catch(() => {})
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

  closeStream()
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
      setConnectionState('error')
      deactivateWorkTasksRealtime()
      notifyAuthInvalidated('session_expired')
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
  if (!next.token || !next.userId || !next.date_from || !next.date_to) return false
  const sessionEpoch = workTasksSessionEpoch
  const isCurrent = () => isCurrentWorkTasksSession(next, sessionEpoch)
  if (!isCurrent()) return false
  const nextIdentity: StreamIdentity = { token: next.token, userId: next.userId }
  const streamChanged = !sameStreamIdentity(activeStreamIdentity, nextIdentity)
  if (streamChanged) clearWorkTasksRefreshCoordinator()
  const bucketKey = makeWorkTasksBucketKey(next)
  if (state.bucketKey !== bucketKey) {
    const initialized = await initWorkTasksStore({ bucketKey, session: next, canApply: isCurrent })
    if (!initialized || !isCurrent()) return false
  }
  if (!isCurrent()) return false
  activeRealtimeParams = next
  activeStreamIdentity = nextIdentity
  if (streamChanged || !streamEs) connectWorkTasksRealtime(streamChanged)
  return true
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
  recordLocalTaskPatch(state.bucketKey, next.id)
  state = { ...state, items, updatedAt: new Date().toISOString() }
  await persist()
  emit()
}

export async function patchWorkTaskItems(patches0: Array<{ id: string; patch: Partial<WorkTaskItem> }>) {
  const patches = (Array.isArray(patches0) ? patches0 : [])
    .map((item) => ({ id: String(item?.id || '').trim(), patch: item?.patch || {} }))
    .filter((item) => !!item.id && item.patch && typeof item.patch === 'object' && Object.keys(item.patch).length > 0)
  if (!patches.length) return
  const patchById = new Map<string, Partial<WorkTaskItem>>()
  for (const item of patches) patchById.set(item.id, { ...(patchById.get(item.id) || {}), ...item.patch })
  let changed = false
  const items = state.items.map((task) => {
    const patch = patchById.get(String(task.id || '').trim())
    if (!patch) return task
    changed = true
    const next = { ...task, ...patch }
    recordLocalTaskPatch(state.bucketKey, next.id)
    return next
  })
  if (!changed) return
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

export async function initWorkTasksStore(params: { bucketKey: string; session: { token: string; userId: string }; canApply?: () => boolean }) {
  const key = String(params.bucketKey || '').trim()
  if (!key) throw new Error('missing bucketKey')
  const sessionEpoch = workTasksSessionEpoch
  const canApply = params.canApply || (() => true)
  const canApplyCurrentSession = () => canApply() && isCurrentWorkTasksSession(params.session, sessionEpoch)
  if (!canApplyCurrentSession()) return false
  if (initializedKey === key && state.bucketKey === key) return true
  const hydrationGeneration = ++workTasksHydrationGeneration
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
  if (!canApplyCurrentSession() || hydrationGeneration !== workTasksHydrationGeneration) return false
  state = buildStateFromSaved(saved, key)
  emit()
  return true
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

function workTaskIdentityValues(task: Partial<WorkTaskItem> | WorkTask) {
  return [
    (task as any)?.id,
    (task as any)?.task_id,
    (task as any)?.source_id,
    ...((Array.isArray((task as any)?.source_ids) ? (task as any).source_ids : [])),
    ...((Array.isArray((task as any)?.active_source_ids) ? (task as any).active_source_ids : [])),
    ...((Array.isArray((task as any)?.superseded_source_ids) ? (task as any).superseded_source_ids : [])),
    ...((Array.isArray((task as any)?.all_related_source_ids) ? (task as any).all_related_source_ids : [])),
    ...((Array.isArray((task as any)?.cleaning_task_ids) ? (task as any).cleaning_task_ids : [])),
    ...((Array.isArray((task as any)?.inspection_task_ids) ? (task as any).inspection_task_ids : [])),
    ...((Array.isArray((task as any)?.execution_task_ids) ? (task as any).execution_task_ids : [])),
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
}

function recordLocalTaskPatch(bucketKey: string | null, taskId0: string) {
  const bucket = String(bucketKey || '').trim()
  const taskId = String(taskId0 || '').trim()
  if (!bucket || !taskId) return
  const revisions = localPatchRevisionsByBucket.get(bucket) || new Map<string, number>()
  revisions.set(taskId, ++localPatchRevision)
  localPatchRevisionsByBucket.set(bucket, revisions)
}

function taskIdsPatchedAfter(bucketKey: string, revision: number) {
  const revisions = localPatchRevisionsByBucket.get(bucketKey)
  if (!revisions) return new Set<string>()
  return new Set(Array.from(revisions.entries())
    .filter(([, patchedRevision]) => patchedRevision > revision)
    .map(([taskId]) => taskId))
}

function clearPatchedTaskIdsThrough(bucketKey: string, revision: number) {
  const revisions = localPatchRevisionsByBucket.get(bucketKey)
  if (!revisions) return
  for (const [taskId, patchedRevision] of revisions.entries()) {
    if (patchedRevision <= revision) revisions.delete(taskId)
  }
  if (!revisions.size) localPatchRevisionsByBucket.delete(bucketKey)
}

export function mergeRemoteWorkTaskItems(
  remote: WorkTaskItem[],
  previous: WorkTaskItem[],
  options?: { retainLocalTaskIds?: Iterable<string> },
) {
  const previousByIdentity = new Map<string, WorkTaskItem>()
  const previousItemsByIdentity = new Map<string, WorkTaskItem>()
  for (const item of Array.isArray(previous) ? previous : []) {
    for (const identity of workTaskIdentityValues(item)) {
      if (!previousItemsByIdentity.has(identity)) previousItemsByIdentity.set(identity, item)
      if (String((item as any)?.checked_out_at || '').trim() && !previousByIdentity.has(identity)) previousByIdentity.set(identity, item)
    }
  }

  const retainLocalTaskIds = new Set(Array.from(options?.retainLocalTaskIds || []).map((id) => String(id || '').trim()).filter(Boolean))
  return (Array.isArray(remote) ? remote : []).map((item) => {
    const locallyPatchedItem = workTaskIdentityValues(item)
      .map((identity) => retainLocalTaskIds.has(identity) ? previousItemsByIdentity.get(identity) : null)
      .find(Boolean)
    if (locallyPatchedItem) return locallyPatchedItem
    if (String((item as any)?.source_type || '').trim() !== 'cleaning_tasks') return item
    if (Object.prototype.hasOwnProperty.call(item, 'checked_out_at')) return item
    const previousItem = workTaskIdentityValues(item)
      .map((identity) => previousByIdentity.get(identity))
      .find(Boolean)
    const checkedOutAt = String((previousItem as any)?.checked_out_at || '').trim()
    return checkedOutAt ? { ...item, checked_out_at: checkedOutAt } : item
  })
}

async function executeWorkTasksRefresh(params: WorkTasksRefreshParams, canApply: () => boolean = () => true) {
  const bucketKey = makeWorkTasksBucketKey({ userId: params.userId, date_from: params.date_from, date_to: params.date_to, view: params.view })
  if (!canApply()) return false
  const inFlight = refreshWorkTasksInFlight.get(bucketKey)
  if (inFlight) return inFlight

  const run = (async () => {
    const initialized = await initWorkTasksStore({ bucketKey, session: params, canApply })
    if (!initialized || !canApply() || state.bucketKey !== bucketKey) return false
    const refreshStartPatchRevision = localPatchRevision
    const remote = await listWorkTasks(params.token, { date_from: params.date_from, date_to: params.date_to, view: params.view })
    if (!canApply() || state.bucketKey !== bucketKey) return false
    const mappedRemote = remote.map(mapRemoteTask).filter((t) => t.date !== 'unknown')
    const locallyPatchedTaskIds = taskIdsPatchedAfter(bucketKey, refreshStartPatchRevision)
    const items = mergeRemoteWorkTaskItems(mappedRemote, state.items, { retainLocalTaskIds: locallyPatchedTaskIds })
    clearPatchedTaskIdsThrough(bucketKey, refreshStartPatchRevision)

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
    emit()
    return true
  })()

  refreshWorkTasksInFlight.set(bucketKey, run)
  try {
    return await run
  } finally {
    if (refreshWorkTasksInFlight.get(bucketKey) === run) refreshWorkTasksInFlight.delete(bucketKey)
  }
}

// An executor receipt is authoritative, but a task-list request may have been
// sent before that receipt returned. Let that stale request settle under the
// local-patch guard, then refresh the same active bucket once for canonical
// server data. Do not switch a task detail into its fallback date bucket.
export async function reconcileActiveWorkTasksAfterLocalPatch() {
  const params = activeRealtimeParams ? { ...activeRealtimeParams } : null
  if (!params) return false
  const bucketKey = makeWorkTasksBucketKey(params)
  if (state.bucketKey !== bucketKey) return false
  const inFlight = refreshWorkTasksInFlight.get(bucketKey)
  if (inFlight) {
    try {
      await inFlight
    } catch {
      // The next refresh still gives the receipt a chance to reconcile.
    }
  }
  if (!sameRealtimeParams(activeRealtimeParams, params) || state.bucketKey !== bucketKey) return false
  await requestWorkTasksRefresh({ ...params, mode: 'force', reason: 'local_patch_reconcile' })
  return true
}
