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
    let id = rawId
    if (seen.has(id)) id = nextId()
    seen.add(id)
    const fixed: Notice = { ...n, id }
    items.push(fixed)
    if (input.unreadIds && (input.unreadIds as any)[rawId]) unreadIds[id] = true
  }
  return { items, unreadIds }
}

function shouldDropNotice(n: any) {
  const type = String(n?.type || '').trim().toLowerCase()
  if (type === 'system') return true
  const title = String(n?.title || '').trim()
  if (title === '已退房' || title === '取消已退房' || title === '任务信息更新') return true
  if (title.startsWith('系统通知')) return true
  if (title.includes('今日任务有更新')) return true
  if (title.includes('今日清洁安排已更新')) return true
  return false
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
  const notice: Notice = { id, createdAt, type: input.type, title: input.title, summary: input.summary, content: input.content }
  state = { ...state, items: [notice, ...state.items], unreadIds: { ...state.unreadIds, [id]: true } }
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
