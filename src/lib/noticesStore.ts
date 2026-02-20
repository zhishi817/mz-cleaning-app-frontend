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

function seed(): Notice[] {
  const now = new Date()
  const at = (minsAgo: number) => new Date(now.getTime() - minsAgo * 60 * 1000).toISOString()
  return [
    {
      id: 'n1',
      type: 'system',
      title: '系统通知：今日清洁安排已更新',
      summary: '请查看路线顺序与优先级标记',
      content: '今日清洁安排已更新，请优先处理标记为「早入住 · 优先」的房源任务。',
      createdAt: at(12),
    },
    {
      id: 'n2',
      type: 'update',
      title: '更新消息：移动端已支持本地登录',
      summary: '无需后端也可预览界面',
      content: '移动端已新增本地测试账号登录能力，便于离线预览与 UI 联调。',
      createdAt: at(90),
    },
    {
      id: 'n3',
      type: 'key',
      title: '备用钥匙：WSP3702A',
      summary: '柜子密码：9876#',
      content: 'WSP3702A 备用钥匙存放于前台柜子，柜子密码：9876#。取用后请归还并确认锁好。',
      createdAt: at(320),
    },
  ]
}

async function persist() {
  await setJson(STORAGE_KEY, state)
}

export async function initNoticesStore() {
  if (initialized) return
  initialized = true
  const saved = await getJson<StoreState>(STORAGE_KEY)
  if (saved?.items?.length) {
    state = { items: saved.items, unreadIds: saved.unreadIds || {} }
  } else {
    const items = seed()
    const unreadIds = Object.fromEntries(items.map(i => [i.id, true])) as Record<string, true>
    state = { items, unreadIds }
    await persist()
  }
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
  return `n${Math.floor(Date.now() / 1000)}`
}

export async function prependNotice(input: Omit<Notice, 'id' | 'createdAt'> & { id?: string; createdAt?: string }) {
  const id = input.id || nextId()
  const createdAt = input.createdAt || isoNow()
  const notice: Notice = { id, createdAt, type: input.type, title: input.title, summary: input.summary, content: input.content }
  state = { ...state, items: [notice, ...state.items], unreadIds: { ...state.unreadIds, [id]: true } }
  await persist()
  emit()
}

export async function refreshNotices() {
  await initNoticesStore()
  if (Math.random() < 0.35) {
    await prependNotice({
      type: 'system',
      title: '系统通知：今日任务有更新',
      summary: '请下拉查看最新公告',
      content: '检测到任务信息更新，请刷新任务列表确认最新状态与时间。',
    })
    return
  }
  emit()
}

export async function loadMoreNotices(count = 10) {
  await initNoticesStore()
  const base = state.items[state.items.length - 1]
  const baseTime = base ? new Date(base.createdAt).getTime() : Date.now()
  const more: Notice[] = Array.from({ length: count }).map((_, idx) => {
    const minutes = 720 + idx * 45
    const createdAt = new Date(baseTime - minutes * 60 * 1000).toISOString()
    return {
      id: `${nextId()}-${idx}`,
      type: idx % 3 === 0 ? 'update' : idx % 3 === 1 ? 'system' : 'key',
      title: idx % 3 === 2 ? `备用钥匙：房源 ${idx + 1}` : idx % 3 === 1 ? `系统通知：提醒 ${idx + 1}` : `更新消息：版本提示 ${idx + 1}`,
      summary: idx % 3 === 2 ? '请妥善保管密码信息' : '点击查看完整内容',
      content: '这是一条用于演示的公告内容（用于上拉加载更多）。',
      createdAt,
    }
  })
  const unreadIds = { ...state.unreadIds }
  for (const n of more) unreadIds[n.id] = true
  state = { ...state, items: [...state.items, ...more], unreadIds }
  await persist()
  emit()
}
