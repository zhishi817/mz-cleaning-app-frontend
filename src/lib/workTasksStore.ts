import { getJson, setJson } from './storage'
import { API_BASE_URL } from '../config/env'
import { listWorkTasks, type WorkTask } from './api'
import { prependNotice } from './noticesStore'

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
  const remote = await listWorkTasks(params.token, { date_from: params.date_from, date_to: params.date_to, view: params.view })
  const items = remote.map(mapRemoteTask).filter(t => t.date !== 'unknown')

  try {
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
        await prependNotice({ id: `guest_checked_out:${code}:${nextCheckedOut}`, type: 'update', title: `已退房：${code}`, summary: '已退房', content: body || '已退房' })
      }
      if (prevCheckedOut && !nextCheckedOut) {
        const body = [code ? `房源：${code}` : '', addr ? `地址：${addr}` : '', '状态：已取消退房'].filter(Boolean).join('\n')
        await prependNotice({ id: `guest_checked_out_cancelled:${code}:${prevCheckedOut}`, type: 'update', title: `取消退房：${code}`, summary: '已取消退房', content: body || '已取消退房' })
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
        })
      }
    }
  } catch {}

  state = { items, bucketKey, updatedAt: new Date().toISOString() }
  await persist()
  emit()
}
