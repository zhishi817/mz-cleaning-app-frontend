type Source = 'system'

export type ContactItem = {
  id: string
  source: Source
  name: string
  phone_au: string | null
  username: string | null
  role: string | null
}

type Snapshot = {
  items: ContactItem[]
  updated_at: number
}

let snapshot: Snapshot = { items: [], updated_at: 0 }
const listeners = new Set<() => void>()

export function getContactsSnapshot() {
  return snapshot
}

export function setContactsSnapshot(next: Snapshot) {
  snapshot = next
  for (const fn of Array.from(listeners)) fn()
}

export function subscribeContactsSnapshot(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
