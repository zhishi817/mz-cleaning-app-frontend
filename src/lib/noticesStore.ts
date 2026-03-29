import { getJson, setJson } from './storage'

export type NoticeType = 'system' | 'update' | 'key'

export type Notice = {
  id: string
  type: NoticeType
  title: string
  summary: string
  content: string
  createdAt: string
}

type StoreState = {
  items: Notice[]
  unreadIds: Record<string, true>
}

const STORAGE_KEY = 'mzstay.notices.store.v1'
export const NOTICES_STORAGE_KEY = STORAGE_KEY

const listeners = new Set<() => void>()

let state: StoreState = { items: [], unreadIds: {} }
let initialized = false

const MAX_ITEMS = 200

function emit() {
  for (const cb of listeners) cb()
}

function isoNow() {
  return new Date().toISOString()
}

async function persist() {
  await setJson(STORAGE_KEY, state)
}

function dedupeLoadedState(input: StoreState) {
  const seen = new Set<string>()
  const unreadIds: Record<string, true> = {}
  const items: Notice[] = []
  for (const n of input.items || []) {
    const rawId = String(n?.id || '').trim() || nextId()
    const id = rawId
    if (seen.has(id)) continue
    seen.add(id)
    const fixed: Notice = { ...n, id }
    items.push(fixed)
    if (input.unreadIds && (input.unreadIds as any)[rawId]) unreadIds[id] = true
  }
  return { items, unreadIds }
}

function shouldDropNotice(n: any) {
  void n
  return false
}

function normText(v: any) {
  return String(v ?? '').replace(/\s+/g, ' ').trim()
}

function noticeSig(n: { type?: any; title?: any; summary?: any; content?: any }) {
  const type = normText(n.type)
  const title = normText(n.title).slice(0, 80)
  const summary = normText(n.summary).slice(0, 80)
  const content = normText(n.content).slice(0, 160)
  return `${type}|${title}|${summary}|${content}`
}

export async function initNoticesStore() {
  if (initialized) return
  initialized = true
  const saved = await getJson<StoreState>(STORAGE_KEY)
  const loaded = saved?.items?.length ? dedupeLoadedState({ items: saved.items, unreadIds: saved.unreadIds || {} }) : { items: [], unreadIds: {} as Record<string, true> }
  const keptItems = loaded.items.filter(n => !shouldDropNotice(n))
  const keptUnreadIds: Record<string, true> = {}
  for (const n of keptItems) {
    if (loaded.unreadIds[n.id]) keptUnreadIds[n.id] = true
  }
  state = { items: keptItems, unreadIds: keptUnreadIds }
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
  if (!state.unreadIds[id]) return
  const unreadIds = { ...state.unreadIds }
  delete unreadIds[id]
  state = { ...state, unreadIds }
  await persist()
  emit()
}

function nextId() {
  const rand = Math.random().toString(36).slice(2, 8)
  return `n${Date.now()}-${rand}`
}

export async function prependNotice(input: Omit<Notice, 'id' | 'createdAt'> & { id?: string; createdAt?: string }) {
  const id = input.id || nextId()
  const createdAt = input.createdAt || isoNow()
  const exists = state.items.some(n => n.id === id)
  if (exists) {
    if (!state.unreadIds[id]) {
      state = { ...state, unreadIds: { ...state.unreadIds, [id]: true } }
      await persist()
      emit()
    }
    return
  }
  const sig = noticeSig(input)
  const recent = state.items.slice(0, 60)
  const dup = recent.find(n => noticeSig(n) === sig)
  if (dup) {
    const did = dup.id
    if (!state.unreadIds[did]) {
      state = { ...state, unreadIds: { ...state.unreadIds, [did]: true } }
      await persist()
      emit()
    }
    return
  }
  const notice: Notice = { id, createdAt, type: input.type, title: input.title, summary: input.summary, content: input.content }
  const items = [notice, ...state.items].slice(0, MAX_ITEMS)
  const keepIds = new Set(items.map(n => n.id))
  const unreadIds: Record<string, true> = { ...state.unreadIds, [id]: true }
  for (const k of Object.keys(unreadIds)) {
    if (!keepIds.has(k)) delete unreadIds[k]
  }
  state = { ...state, items, unreadIds }
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
