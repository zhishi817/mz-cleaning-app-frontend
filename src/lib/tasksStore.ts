import { getJson, setJson } from './storage'
import { API_BASE_URL } from '../config/env'
import { listCleaningAppTasks, type CleaningAppTask } from './api'

export type TaskStatus = 'pending_key_photo' | 'cleaning' | 'completed'

export type Task = {
  id: string
  date: string
  title: string
  region: string
  address: string
  unitType: string
  status: TaskStatus
  routeOrder?: number | null
  guideUrl?: string | null
  hasCheckout: boolean
  hasCheckin: boolean
  checkoutTime: string | null
  nextCheckinTime: string | null
  oldCode: string | null
  masterCode: string | null
  newCode: string | null
  keypadCode: string | null
  keyPhotoUri: string | null
  completedAt: string | null
  completedBy: string | null
  completionNote: string
  completionSupplies: string[]
}

export type TasksView = 'mine' | 'all'

type StoreState = {
  items: Task[]
  bucketKey: string | null
  updatedAt: string | null
}

const STORAGE_PREFIX = 'mzstay.tasks.store.v2:'
const ROUTE_META_PREFIX = 'mzstay.tasks.route.v1:'

const listeners = new Set<() => void>()
let state: StoreState = { items: [], bucketKey: null, updatedAt: null }
let initializedKey: string | null = null

function emit() {
  for (const cb of listeners) cb()
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function addDays(d: Date, days: number) {
  const nd = new Date(d)
  nd.setDate(nd.getDate() + days)
  return nd
}

function normalizeBase(base: string) {
  return String(base || '').trim().replace(/\/+$/g, '')
}

function envKey() {
  const b = normalizeBase(API_BASE_URL)
  return b ? `remote:${b}` : 'local'
}

function storageKey(bucketKey: string) {
  return `${STORAGE_PREFIX}${bucketKey}`
}

function routeMetaKey(userId: string) {
  const u = String(userId || '').trim() || 'unknown'
  return `${ROUTE_META_PREFIX}${envKey()}:${u}`
}

export function makeTasksBucketKey(params: { userId: string; date_from: string; date_to: string; view: TasksView }) {
  const u = String(params.userId || '').trim() || 'unknown'
  const df = String(params.date_from || '').trim()
  const dt = String(params.date_to || '').trim()
  const view = params.view === 'all' ? 'all' : 'mine'
  return `${envKey()}:${u}:${df}~${dt}:${view}`
}

function seed(): Task[] {
  const base = new Date()
  const d0 = ymd(base)
  const d1 = ymd(addDays(base, 1))
  const d2 = ymd(addDays(base, 3))
  const d3 = ymd(addDays(base, 10))
  return [
    {
      id: 't1',
      date: d0,
      title: 'WSP3702A',
      region: 'CBD',
      address: '45 Green Ln',
      unitType: 'STUDIO',
      status: 'pending_key_photo',
      guideUrl: null,
      hasCheckout: true,
      hasCheckin: true,
      checkoutTime: '10:00',
      nextCheckinTime: '13:00',
      oldCode: '4321',
      masterCode: '8888',
      newCode: '8765',
      keypadCode: '9876#',
      keyPhotoUri: null,
      completedAt: null,
      completedBy: null,
      completionNote: '',
      completionSupplies: [],
    },
    {
      id: 't2',
      date: d1,
      title: 'WSP1290B',
      region: 'CBD',
      address: '12 King St',
      unitType: '1BR',
      status: 'pending_key_photo',
      guideUrl: null,
      hasCheckout: true,
      hasCheckin: true,
      checkoutTime: '09:30',
      nextCheckinTime: '14:00',
      oldCode: '2211',
      masterCode: '8888',
      newCode: '9900',
      keypadCode: '5544#',
      keyPhotoUri: null,
      completedAt: null,
      completedBy: null,
      completionNote: '',
      completionSupplies: [],
    },
    {
      id: 't3',
      date: d2,
      title: 'WSP4401C',
      region: 'Docklands',
      address: '8 Harbour Rd',
      unitType: '2BR',
      status: 'pending_key_photo',
      guideUrl: null,
      hasCheckout: true,
      hasCheckin: true,
      checkoutTime: '11:00',
      nextCheckinTime: '15:00',
      oldCode: '1357',
      masterCode: '8888',
      newCode: '2468',
      keypadCode: '1122#',
      keyPhotoUri: null,
      completedAt: null,
      completedBy: null,
      completionNote: '',
      completionSupplies: [],
    },
    {
      id: 't4',
      date: d3,
      title: 'WSP7820D',
      region: 'CBD',
      address: '99 Ocean Ave',
      unitType: 'STUDIO',
      status: 'pending_key_photo',
      guideUrl: null,
      hasCheckout: true,
      hasCheckin: true,
      checkoutTime: '10:00',
      nextCheckinTime: '13:00',
      oldCode: '1234',
      masterCode: '8888',
      newCode: '5678',
      keypadCode: '9988#',
      keyPhotoUri: null,
      completedAt: null,
      completedBy: null,
      completionNote: '',
      completionSupplies: [],
    },
  ]
}

async function persist() {
  if (!state.bucketKey) return
  await setJson(storageKey(state.bucketKey), state)
}

export async function initTasksStore(params: { bucketKey: string; allowSeed?: boolean }) {
  const key = String(params.bucketKey || '').trim()
  if (!key) throw new Error('missing bucketKey')
  if (initializedKey === key) return
  initializedKey = key
  state = { items: [], bucketKey: key, updatedAt: null }
  const saved = await getJson<StoreState>(storageKey(key))
  if (saved?.items?.length) {
    state = { items: mergeSamePropertySameDay(saved.items), bucketKey: key, updatedAt: saved.updatedAt || null }
  } else if (params.allowSeed) {
    state = { items: mergeSamePropertySameDay(seed()), bucketKey: key, updatedAt: new Date().toISOString() }
    await persist()
  } else {
    state = { items: [], bucketKey: key, updatedAt: null }
  }
  emit()
}

export function subscribeTasks(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function getTasksSnapshot() {
  return state
}

function mapStatus(raw: string): TaskStatus {
  const s = String(raw || '').trim().toLowerCase()
  if (!s) return 'pending_key_photo'
  if (s === 'in_progress' || s === 'restock_pending') return 'cleaning'
  if (s === 'cleaned' || s === 'restocked' || s === 'inspected' || s === 'ready') return 'completed'
  return 'pending_key_photo'
}

function mapRemoteTask(t: CleaningAppTask): Task {
  const date = String(t.task_date || t.date || '').slice(0, 10)
  const code = t.property?.code || ''
  const region = String(t.property?.region || '').trim()
  const address = t.property?.address || ''
  const unitType = t.property?.unit_type || ''
  const guideUrl = t.property?.access_guide_link ? String(t.property.access_guide_link) : null
  const checkoutTime = typeof t.checkout_time === 'string' && t.checkout_time.trim() ? t.checkout_time.trim() : null
  const nextCheckinTime = typeof t.checkin_time === 'string' && t.checkin_time.trim() ? t.checkin_time.trim() : null
  const oldCode = typeof t.old_code === 'string' && t.old_code.trim() ? t.old_code.trim() : null
  const newCode = typeof t.new_code === 'string' && t.new_code.trim() ? t.new_code.trim() : null
  const access = typeof t.access_code === 'string' && t.access_code.trim() ? t.access_code.trim() : null
  const hasCheckout = !!(checkoutTime || oldCode)
  const hasCheckin = !!(nextCheckinTime || newCode)
  const title = code || (t.id ? `ID:${String(t.id).slice(0, 6)}` : '')
  return {
    id: t.id,
    date,
    title,
    region,
    address,
    unitType,
    status: mapStatus(t.status),
    routeOrder: null,
    guideUrl,
    hasCheckout,
    hasCheckin,
    checkoutTime,
    nextCheckinTime,
    oldCode,
    masterCode: access,
    newCode,
    keypadCode: access ? `${access}#` : null,
    keyPhotoUri: null,
    completedAt: null,
    completedBy: null,
    completionNote: '',
    completionSupplies: [],
  }
}

function statusRank(status: TaskStatus) {
  if (status === 'pending_key_photo') return 0
  if (status === 'cleaning') return 1
  return 2
}

function maxTime(a: string | null, b: string | null) {
  if (!a) return b
  if (!b) return a
  return a >= b ? a : b
}

function minTime(a: string | null, b: string | null) {
  if (!a) return b
  if (!b) return a
  return a <= b ? a : b
}

export function mergeSamePropertySameDay(items: Task[]): Task[] {
  const groups = new Map<string, Task[]>()
  for (const t of items) {
    const key = `${t.date}|${t.title}`
    const arr = groups.get(key)
    if (arr) arr.push(t)
    else groups.set(key, [t])
  }

  const merged: Task[] = []
  for (const arr of groups.values()) {
    if (arr.length === 1) {
      merged.push(arr[0]!)
      continue
    }
    const base = arr.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)))[0]!
    let status = base.status
    let hasCheckout = base.hasCheckout
    let hasCheckin = base.hasCheckin
    let checkoutTime = base.checkoutTime
    let nextCheckinTime = base.nextCheckinTime
    let oldCode = base.oldCode
    let newCode = base.newCode
    let masterCode = base.masterCode
    let keypadCode = base.keypadCode
    let guideUrl = base.guideUrl ?? null
    let region = base.region
    let address = base.address
    let unitType = base.unitType

    for (const t of arr) {
      if (statusRank(t.status) < statusRank(status)) status = t.status
      hasCheckout = hasCheckout || t.hasCheckout
      hasCheckin = hasCheckin || t.hasCheckin
      if (t.hasCheckout) checkoutTime = maxTime(checkoutTime, t.checkoutTime)
      if (t.hasCheckin) nextCheckinTime = minTime(nextCheckinTime, t.nextCheckinTime)
      if (!region && t.region) region = t.region
      if (!address && t.address) address = t.address
      if (!unitType && t.unitType) unitType = t.unitType
      if (!guideUrl && t.guideUrl) guideUrl = t.guideUrl
      if (!newCode && t.newCode) newCode = t.newCode
      if (!oldCode && t.oldCode) oldCode = t.oldCode
      if (!masterCode && t.masterCode) masterCode = t.masterCode
      if (!keypadCode && t.keypadCode) keypadCode = t.keypadCode
    }

    merged.push({
      ...base,
      status,
      hasCheckout,
      hasCheckin,
      region,
      address,
      unitType,
      guideUrl,
      checkoutTime,
      nextCheckinTime,
      oldCode,
      newCode,
      masterCode,
      keypadCode,
    })
  }
  return merged
}

export async function refreshTasksFromServer(params: {
  token: string
  userId: string
  date_from: string
  date_to: string
  view: TasksView
}) {
  const bucketKey = makeTasksBucketKey({ userId: params.userId, date_from: params.date_from, date_to: params.date_to, view: params.view })
  await initTasksStore({ bucketKey, allowSeed: String(params.token || '').startsWith('local:') })
  if (String(params.token || '').startsWith('local:')) return
  const prevById = new Map(state.items.map(i => [i.id, i] as const))
  const routeMeta = (await getJson<Record<string, number>>(routeMetaKey(params.userId))) || {}
  const remote = await listCleaningAppTasks(params.token, {
    date_from: params.date_from,
    date_to: params.date_to,
    assignee_id: params.view === 'mine' ? params.userId : undefined,
  })
  const items0 = remote.map((rt) => {
    const mapped = mapRemoteTask(rt)
    const prev = prevById.get(mapped.id)
    const metaOrder = routeMeta[mapped.id]
    return {
      ...mapped,
      routeOrder: typeof metaOrder === 'number' ? metaOrder : prev?.routeOrder || mapped.routeOrder || null,
      keyPhotoUri: prev?.keyPhotoUri ?? mapped.keyPhotoUri,
      completedAt: prev?.completedAt ?? mapped.completedAt,
      completedBy: prev?.completedBy ?? mapped.completedBy,
      completionNote: prev?.completionNote ?? mapped.completionNote,
      completionSupplies: prev?.completionSupplies ?? mapped.completionSupplies,
    }
  })
  const items = mergeSamePropertySameDay(items0)
  state = { items, bucketKey, updatedAt: new Date().toISOString() }
  await persist()
  emit()
}

export async function setTaskRouteOrders(params: { userId: string; updates: Array<{ taskId: string; routeOrder: number | null }> }) {
  const userId = String(params.userId || '').trim()
  if (!userId) throw new Error('missing userId')
  const updates = params.updates || []
  if (!updates.length) return

  const routeMeta = (await getJson<Record<string, number>>(routeMetaKey(userId))) || {}
  for (const u of updates) {
    const id = String(u.taskId || '').trim()
    if (!id) continue
    if (typeof u.routeOrder === 'number' && Number.isFinite(u.routeOrder) && u.routeOrder > 0) routeMeta[id] = u.routeOrder
    else delete routeMeta[id]
  }
  await setJson(routeMetaKey(userId), routeMeta)

  const patchMap = new Map(updates.map(u => [String(u.taskId || '').trim(), u.routeOrder] as const).filter(x => x[0]))
  const nextItems = state.items.map((t) => {
    const ro = patchMap.get(t.id)
    if (ro === undefined) return t
    return { ...t, routeOrder: ro }
  })
  state = { ...state, items: nextItems, updatedAt: new Date().toISOString() }
  await persist()
  emit()
}

export async function setTaskKeyPhotoUploaded(taskId: string, uri: string) {
  const nextItems = state.items.map(t =>
    t.id === taskId
      ? {
          ...t,
          keyPhotoUri: uri,
          status: (t.status === 'completed' ? 'completed' : 'cleaning') as TaskStatus,
        }
      : t,
  )
  state = { ...state, items: nextItems, updatedAt: new Date().toISOString() }
  await persist()
  emit()
}

export async function completeTask(params: {
  taskId: string
  supplies: string[]
  note: string
  completedAt: string
  completedBy: string
}) {
  const nextItems = state.items.map(t =>
    t.id === params.taskId
      ? {
          ...t,
          status: 'completed' as const,
          completedAt: params.completedAt,
          completedBy: params.completedBy,
          completionNote: params.note,
          completionSupplies: params.supplies,
        }
      : t,
  )
  state = { ...state, items: nextItems, updatedAt: new Date().toISOString() }
  await persist()
  emit()
}
