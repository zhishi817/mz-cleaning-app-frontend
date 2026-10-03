import { useSyncExternalStore } from 'react'
import { listChecklistItems, type ChecklistItem } from './api'
import { getJson, setJson } from './storage'

type SuppliesCatalogCacheRecord = {
  items: ChecklistItem[]
  updated_at: string
}

export type SuppliesCatalogState = {
  items: ChecklistItem[]
  hydrated: boolean
  loading: boolean
  refreshing: boolean
  error: string | null
  isFromCache: boolean
  lastSyncedAt: string | null
}

const CACHE_KEY = 'mzstay.checklist_items_cache.v1'
const LEGACY_CACHE_KEY = 'supplies_checklist_v1'

const listeners = new Set<() => void>()

let state: SuppliesCatalogState = {
  items: [],
  hydrated: false,
  loading: false,
  refreshing: false,
  error: null,
  isFromCache: false,
  lastSyncedAt: null,
}

let hydratePromise: Promise<void> | null = null
let refreshPromise: Promise<void> | null = null

function emit() {
  for (const cb of listeners) cb()
}

function setState(next: Partial<SuppliesCatalogState>) {
  state = { ...state, ...next }
  emit()
}

function normalizeChecklistItems(raw: any) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      id: String(item.id || '').trim(),
      label: String(item.label || '').trim(),
      kind: String(item.kind || '').trim(),
      required: !!item.required,
      requires_photo_when_low: !!item.requires_photo_when_low,
    }))
    .filter((item) => !!item.id)
}

function readCachePayload(raw: any): { items: ChecklistItem[]; updatedAt: string | null } {
  if (Array.isArray(raw)) return { items: normalizeChecklistItems(raw), updatedAt: null }
  if (!raw || typeof raw !== 'object') return { items: [], updatedAt: null }
  const items = normalizeChecklistItems((raw as SuppliesCatalogCacheRecord).items)
  const updatedAt = String((raw as SuppliesCatalogCacheRecord).updated_at || '').trim() || null
  return { items, updatedAt }
}

async function writeCache(items: ChecklistItem[]) {
  const payload: SuppliesCatalogCacheRecord = {
    items: normalizeChecklistItems(items),
    updated_at: new Date().toISOString(),
  }
  await setJson(CACHE_KEY, payload)
  return payload.updated_at
}

async function readCachedItems() {
  const primary = readCachePayload(await getJson<any>(CACHE_KEY))
  if (primary.items.length) return primary
  const legacyRaw = await getJson<any>(LEGACY_CACHE_KEY)
  const legacy = readCachePayload(legacyRaw)
  if (!legacy.items.length) return legacy
  const updatedAt = await writeCache(legacy.items)
  return { items: legacy.items, updatedAt }
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function getSuppliesCatalogSnapshot() {
  return state
}

export async function hydrateSuppliesCatalog() {
  if (state.hydrated) return
  if (hydratePromise) return hydratePromise
  hydratePromise = (async () => {
    const cached = await readCachedItems()
    state = {
      ...state,
      items: cached.items,
      hydrated: true,
      error: null,
      isFromCache: cached.items.length > 0,
      lastSyncedAt: cached.updatedAt,
    }
    emit()
  })().finally(() => {
    hydratePromise = null
  })
  return hydratePromise
}

export async function refreshSuppliesCatalog(token: string) {
  const accessToken = String(token || '').trim()
  if (!accessToken) return
  await hydrateSuppliesCatalog()
  if (refreshPromise) return refreshPromise
  const hasCachedItems = state.items.length > 0
  setState({
    loading: !hasCachedItems,
    refreshing: hasCachedItems,
    error: null,
    isFromCache: hasCachedItems,
  })
  refreshPromise = (async () => {
    try {
      const items = normalizeChecklistItems(await listChecklistItems(accessToken))
      const updatedAt = await writeCache(items)
      state = {
        ...state,
        items,
        hydrated: true,
        loading: false,
        refreshing: false,
        error: null,
        isFromCache: false,
        lastSyncedAt: updatedAt,
      }
      emit()
    } catch (error: any) {
      state = {
        ...state,
        hydrated: true,
        loading: false,
        refreshing: false,
        error: String(error?.message || '加载失败'),
        isFromCache: state.items.length > 0,
      }
      emit()
      throw error
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}

export async function ensureSuppliesCatalogLoaded(token: string) {
  await hydrateSuppliesCatalog()
  if (state.items.length > 0) {
    void refreshSuppliesCatalog(token)
    return
  }
  await refreshSuppliesCatalog(token)
}

export async function retrySuppliesCatalog(token: string) {
  await hydrateSuppliesCatalog()
  await refreshSuppliesCatalog(token)
}

export function useSuppliesCatalogStore() {
  return useSyncExternalStore(subscribe, getSuppliesCatalogSnapshot, getSuppliesCatalogSnapshot)
}

export function resetSuppliesCatalogStoreForTests() {
  state = {
    items: [],
    hydrated: false,
    loading: false,
    refreshing: false,
    error: null,
    isFromCache: false,
    lastSyncedAt: null,
  }
  hydratePromise = null
  refreshPromise = null
  listeners.clear()
}
