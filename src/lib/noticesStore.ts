import { getJson, setJson } from './storage'
import { reconcileNoticeCreatedAt } from './noticeTime'

export type NoticeType = 'system' | 'update' | 'key'

export type Notice = {
  id: string
  type: NoticeType
  title: string
  summary: string
  content: string
  data?: any
  createdAt: string
}

type StoreState = {
  items: Notice[]
  unreadIds: Record<string, true>
  readIds: Record<string, true>
}

const STORAGE_KEY = 'mzstay.notices.store.v1'
export const NOTICES_STORAGE_KEY = STORAGE_KEY

const listeners = new Set<() => void>()

let state: StoreState = { items: [], unreadIds: {}, readIds: {} }
let initialized = false

const MAX_ITEMS = 200

function emit() {
  for (const cb of listeners) cb()
}

function isoNow() {
  return new Date().toISOString()
}

function normalizeCreatedAt(...candidates: any[]) {
  return reconcileNoticeCreatedAt(...candidates) || isoNow()
}

async function persist() {
  await setJson(STORAGE_KEY, state)
}

function dedupeLoadedState(input: StoreState) {
  const seen = new Set<string>()
  const unreadIds: Record<string, true> = {}
  const readIds: Record<string, true> = {}
  const items: Notice[] = []
  for (const n of input.items || []) {
    const rawId = String(n?.id || '').trim() || nextId()
    const id = rawId
    if (seen.has(id)) continue
    seen.add(id)
    const fixed: Notice = { ...n, id }
    items.push(fixed)
    if (input.unreadIds && (input.unreadIds as any)[rawId]) unreadIds[id] = true
    if (input.readIds && (input.readIds as any)[rawId]) readIds[id] = true
  }
  return { items, unreadIds, readIds }
}

function shouldDropNotice(n: any) {
  const type = String(n?.type || '').trim().toLowerCase()
  return type === 'system'
}

function normText(v: any) {
  return String(v ?? '').replace(/\s+/g, ' ').trim()
}

function noticeSig(n: { type?: any; title?: any; summary?: any; content?: any }) {
  const title = normText(n.title).slice(0, 80)
  const summary = normText(n.summary).slice(0, 80)
  const content = normText(n.content).slice(0, 160)
  return `${title}|${summary}|${content}`
}

function noticeSemanticKey(n: { id?: any; title?: any; summary?: any; content?: any; data?: any }) {
  const data = n && typeof n === 'object' ? (n as any).data : null
  const kind = String(data?.kind || '').trim()
  const propertyCode = normText(data?.property_code)
  const checkedOutAt = normText(data?.checked_out_at)
  const fieldsKey = normText(data?.fields_key)
  if (kind === 'guest_checked_out' && propertyCode && checkedOutAt) return `guest_checked_out:${propertyCode}:${checkedOutAt}`
  if (kind === 'guest_checked_out_cancelled' && propertyCode) return `guest_checked_out_cancelled:${propertyCode}:${checkedOutAt}`
  if (kind === 'cleaning_task_manager_fields_updated' && propertyCode && fieldsKey) return `manager_fields:${propertyCode}:${fieldsKey}`
  return noticeSig(n)
}

function isLocalOnlyNotice(n: Notice | null | undefined) {
  if (!n) return false
  const data = (n as any).data
  const serverId = String(data?._server_id || '').trim()
  const kind = String(data?.kind || '').trim()
  if (serverId) return false
  return kind === 'cleaning_task_manager_fields_updated' || kind === 'guest_checked_out' || kind === 'guest_checked_out_cancelled'
}

export async function initNoticesStore() {
  if (initialized) return
  initialized = true
  const saved = await getJson<StoreState>(STORAGE_KEY)
  const loaded = saved?.items?.length
    ? dedupeLoadedState({ items: saved.items, unreadIds: saved.unreadIds || {}, readIds: saved.readIds || {} })
    : { items: [], unreadIds: {} as Record<string, true>, readIds: {} as Record<string, true> }
  const keptItems = loaded.items.filter(n => !shouldDropNotice(n))
  const keptUnreadIds: Record<string, true> = {}
  const keptReadIds: Record<string, true> = {}
  for (const n of keptItems) {
    if (loaded.unreadIds[n.id]) keptUnreadIds[n.id] = true
    if (loaded.readIds[n.id]) keptReadIds[n.id] = true
  }
  state = { items: keptItems, unreadIds: keptUnreadIds, readIds: keptReadIds }
  await persist()
}

export function subscribeNotices(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function getNoticesSnapshot() {
  return state
}

export async function markNoticeRead(id: string) {
  const unreadIds = { ...state.unreadIds }
  delete unreadIds[id]
  state = { ...state, unreadIds, readIds: { ...state.readIds, [id]: true } }
  await persist()
  emit()
}

function nextId() {
  const rand = Math.random().toString(36).slice(2, 8)
  return `n${Date.now()}-${rand}`
}

export async function prependNotice(input: Omit<Notice, 'id' | 'createdAt'> & { id?: string; createdAt?: string }) {
  const id = input.id || nextId()
  const existing = state.items.find(n => n.id === id) || null
  const createdAt = normalizeCreatedAt(input.createdAt, id, (input as any)?.data?.event_id, existing?.createdAt)
  const exists = state.items.some(n => n.id === id)
  if (exists) {
    if (!state.unreadIds[id] && !state.readIds[id]) {
      state = { ...state, unreadIds: { ...state.unreadIds, [id]: true } }
      await persist()
      emit()
    }
    return
  }
  const semanticKey = noticeSemanticKey(input)
  const recent = state.items.slice(0, 60)
  const dup = recent.find(n => noticeSemanticKey(n) === semanticKey)
  if (dup) {
    const did = dup.id
    if (!state.unreadIds[did] && !state.readIds[did]) {
      state = { ...state, unreadIds: { ...state.unreadIds, [did]: true } }
      await persist()
      emit()
    }
    return
  }
  const notice: Notice = { id, createdAt, type: input.type, title: input.title, summary: input.summary, content: input.content, data: (input as any).data }
  const items = [notice, ...state.items].slice(0, MAX_ITEMS)
  const keepIds = new Set(items.map(n => n.id))
  const unreadIds: Record<string, true> = { ...state.unreadIds, [id]: true }
  const readIds: Record<string, true> = { ...state.readIds }
  delete readIds[id]
  for (const k of Object.keys(unreadIds)) {
    if (!keepIds.has(k)) delete unreadIds[k]
  }
  for (const k of Object.keys(readIds)) {
    if (!keepIds.has(k)) delete readIds[k]
  }
  state = { ...state, items, unreadIds, readIds }
  await persist()
  emit()
}

export async function upsertNotices(inputs: Array<Omit<Notice, 'createdAt'> & { createdAt: string; unread?: boolean }>, options?: { replace?: boolean }) {
  await initNoticesStore()
  const replace = options?.replace === true
  const map = new Map<string, Notice>()
  const semanticIdMap = new Map<string, string>()
  if (!replace) {
    for (const n of state.items) {
      const id = String(n.id)
      map.set(id, n)
      semanticIdMap.set(noticeSemanticKey(n), id)
    }
  } else {
    for (const n of state.items) {
      if (isLocalOnlyNotice(n)) {
        const id = String(n.id)
        map.set(id, n)
        semanticIdMap.set(noticeSemanticKey(n), id)
      }
    }
  }

  const unreadIds: Record<string, true> = replace ? {} : { ...state.unreadIds }
  const readIds: Record<string, true> = { ...state.readIds }

  for (const raw of inputs || []) {
    const rawId = String((raw as any)?.id || '').trim()
    if (!rawId) continue
    const semanticKey = noticeSemanticKey(raw as any)
    const semanticExistingId = semanticIdMap.get(semanticKey) || ''
    const id = semanticExistingId || rawId
    const existing = map.get(id) || null
    const createdAt = normalizeCreatedAt((raw as any)?.createdAt, id, (raw as any)?.data?.event_id, existing?.createdAt)
    const type = (String((raw as any)?.type || 'update') as NoticeType) || 'update'
    const title = String((raw as any)?.title || '').trim() || '通知'
    const summary = String((raw as any)?.summary || '').trim()
    const content = String((raw as any)?.content || '').trim()
    const data = (raw as any)?.data
    if (semanticExistingId && semanticExistingId !== rawId) {
      map.delete(semanticExistingId)
      delete unreadIds[semanticExistingId]
    }
    map.set(id, { id, createdAt, type, title, summary, content, data })
    semanticIdMap.set(semanticKey, id)
    const unread = (raw as any)?.unread === true
    if (unread) {
      if (!readIds[id]) unreadIds[id] = true
      else delete unreadIds[id]
    } else {
      delete unreadIds[id]
      delete readIds[id]
    }
  }

  const items = Array.from(map.values())
    .filter(n => !shouldDropNotice(n))
    .sort((a, b) => {
      const ta = String(a.createdAt || '')
      const tb = String(b.createdAt || '')
      if (ta === tb) return String(b.id).localeCompare(String(a.id))
      return String(tb).localeCompare(String(ta))
    })
    .slice(0, MAX_ITEMS)

  const keepIds = new Set(items.map(n => n.id))
  for (const k of Object.keys(unreadIds)) {
    if (!keepIds.has(k)) delete unreadIds[k]
  }
  for (const k of Object.keys(readIds)) {
    if (!keepIds.has(k)) delete readIds[k]
  }

  state = { items, unreadIds, readIds }
  await persist()
  emit()
}

export async function refreshNotices() {
  await initNoticesStore()
  emit()
}

export async function loadMoreNotices(count = 10) {
  await initNoticesStore()
  emit()
}
