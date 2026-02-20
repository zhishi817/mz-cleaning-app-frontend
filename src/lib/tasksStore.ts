import { getJson, setJson } from './storage'

export type TaskStatus = 'pending_key_photo' | 'cleaning' | 'completed'

export type Task = {
  id: string
  date: string
  title: string
  address: string
  unitType: string
  status: TaskStatus
  checkoutTime: string
  nextCheckinTime: string
  oldCode: string
  masterCode: string
  newCode: string
  keypadCode: string
  keyPhotoUri: string | null
  completedAt: string | null
  completedBy: string | null
  completionNote: string
  completionSupplies: string[]
}

type StoreState = {
  items: Task[]
}

const STORAGE_KEY = 'mzstay.tasks.store.v1'

const listeners = new Set<() => void>()
let state: StoreState = { items: [] }
let initialized = false

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
      address: '45 Green Ln',
      unitType: 'STUDIO',
      status: 'pending_key_photo',
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
      address: '12 King St',
      unitType: '1BR',
      status: 'pending_key_photo',
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
      address: '8 Harbour Rd',
      unitType: '2BR',
      status: 'pending_key_photo',
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
      address: '99 Ocean Ave',
      unitType: 'STUDIO',
      status: 'pending_key_photo',
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
  await setJson(STORAGE_KEY, state)
}

export async function initTasksStore() {
  if (initialized) return
  initialized = true
  const saved = await getJson<StoreState>(STORAGE_KEY)
  if (saved?.items?.length) {
    state = { items: saved.items }
  } else {
    state = { items: seed() }
    await persist()
  }
}

export function subscribeTasks(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function getTasksSnapshot() {
  return state
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
  state = { items: nextItems }
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
  state = { items: nextItems }
  await persist()
  emit()
}
