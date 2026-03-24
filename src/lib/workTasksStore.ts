import { getJson, setJson } from './storage'
import { API_BASE_URL } from '../config/env'
import { listWorkTasks, type WorkTask } from './api'

export type WorkTaskItem = WorkTask & { date: string }

export type WorkTasksView = 'mine' | 'all'

type StoreState = {
  items: WorkTaskItem[]
  bucketKey: string | null
  updatedAt: string | null
}

const STORAGE_PREFIX = 'mzstay.work_tasks.store.v1:'

const listeners = new Set<() => void>()
let state: StoreState = { items: [], bucketKey: null, updatedAt: null }
let initializedKey: string | null = null

function emit() {
  for (const cb of listeners) cb()
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

async function persist() {
  if (!state.bucketKey) return
  await setJson(storageKey(state.bucketKey), state)
}

export async function initWorkTasksStore(params: { bucketKey: string }) {
  const key = String(params.bucketKey || '').trim()
  if (!key) throw new Error('missing bucketKey')
  if (initializedKey === key) return
  initializedKey = key
  state = { items: [], bucketKey: key, updatedAt: null }
  const saved = await getJson<StoreState>(storageKey(key))
  if (saved?.items?.length) state = { items: saved.items, bucketKey: key, updatedAt: saved.updatedAt || null }
  emit()
}

function mapRemoteTask(t: WorkTask): WorkTaskItem {
  const date = String(t.scheduled_date || '').slice(0, 10)
  return { ...t, date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : 'unknown' }
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
  const remote = await listWorkTasks(params.token, { date_from: params.date_from, date_to: params.date_to, view: params.view })
  const items = remote.map(mapRemoteTask).filter(t => t.date !== 'unknown')
  state = { items, bucketKey, updatedAt: new Date().toISOString() }
  await persist()
  emit()
}

