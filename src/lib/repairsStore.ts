import { getJson, setJson } from './storage'

export type RepairUrgency = 'low' | 'medium' | 'high'

export type RepairTicket = {
  id: string
  taskId: string
  propertyTitle: string
  address: string
  type: string
  description: string
  urgency: RepairUrgency
  contact: string
  createdAt: string
  createdBy: string
}

type StoreState = {
  items: RepairTicket[]
}

const STORAGE_KEY = 'mzstay.repairs.store.v1'

let state: StoreState = { items: [] }
let initialized = false
const listeners = new Set<() => void>()

function emit() {
  for (const cb of listeners) cb()
}

async function persist() {
  await setJson(STORAGE_KEY, state)
}

export async function initRepairsStore() {
  if (initialized) return
  initialized = true
  const saved = await getJson<StoreState>(STORAGE_KEY)
  if (saved?.items) state = { items: saved.items }
  else state = { items: [] }
}

export function getRepairsSnapshot() {
  return state
}

export function subscribeRepairs(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export async function createRepairTicket(params: Omit<RepairTicket, 'id'>) {
  const ticket: RepairTicket = { ...params, id: `r_${Date.now()}` }
  state = { items: [ticket, ...state.items] }
  await persist()
  emit()
  return ticket
}

