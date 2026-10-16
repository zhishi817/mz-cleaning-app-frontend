import AsyncStorage from '@react-native-async-storage/async-storage'

export const DOWNLOADABLE_TASK_CACHE_PREFIXES = [
  'mzstay.work_tasks.store.v1:',
  'mzstay.tasks.store.v2:',
] as const

export const DOWNLOADABLE_TASK_CACHE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000
export const DOWNLOADABLE_TASK_CACHE_MAX_ENTRIES = 12
export const DOWNLOADABLE_TASK_CACHE_MAX_BYTES = 2 * 1024 * 1024

type CacheEntry = {
  key: string
  value: string | null
  bytes: number
  updatedAtMs: number | null
  valid: boolean
}

export type DownloadableCacheMaintenanceResult = {
  scanned: number
  removedKeys: string[]
  removedBytes: number
  retainedKeys: string[]
}

function cleanText(value: unknown) {
  return String(value || '').trim()
}

export function isDownloadableTaskCacheKey(key: string) {
  const value = cleanText(key)
  return DOWNLOADABLE_TASK_CACHE_PREFIXES.some((prefix) => value.startsWith(prefix))
}

export function utf8ByteLength(value: string) {
  let bytes = 0
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code < 0x80) bytes += 1
    else if (code < 0x800) bytes += 2
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4
        index += 1
      } else {
        bytes += 3
      }
    } else bytes += 3
  }
  return bytes
}

function inspectCacheEntry(key: string, value: string | null): CacheEntry {
  if (!value) return { key, value, bytes: 0, updatedAtMs: null, valid: false }
  try {
    const parsed = JSON.parse(value)
    const updatedAtRaw = parsed?.updatedAt || parsed?.lastFullSyncTimestamp || parsed?.updated_at
    const updatedAt = new Date(String(updatedAtRaw || '')).getTime()
    return {
      key,
      value,
      bytes: utf8ByteLength(key) + utf8ByteLength(value),
      updatedAtMs: Number.isFinite(updatedAt) ? updatedAt : null,
      valid: !!parsed && typeof parsed === 'object',
    }
  } catch {
    return { key, value, bytes: utf8ByteLength(key) + utf8ByteLength(value), updatedAtMs: null, valid: false }
  }
}

async function readEntries(keys: string[]) {
  if (!keys.length) return []
  const multiGet = (AsyncStorage as any).multiGet
  if (typeof multiGet === 'function') {
    const pairs = await multiGet.call(AsyncStorage, keys)
    const values = new Map<string, string | null>(Array.isArray(pairs) ? pairs : [])
    return keys.map((key) => inspectCacheEntry(key, values.get(key) ?? null))
  }
  return await Promise.all(keys.map(async (key) => inspectCacheEntry(key, await AsyncStorage.getItem(key))))
}

async function removeKeys(keys: string[]) {
  if (!keys.length) return
  const multiRemove = (AsyncStorage as any).multiRemove
  if (typeof multiRemove === 'function') {
    await multiRemove.call(AsyncStorage, keys)
    return
  }
  for (const key of keys) await AsyncStorage.removeItem(key)
}

export async function pruneDownloadableTaskCaches(options?: {
  now?: number
  maxAgeMs?: number
  maxEntries?: number
  maxBytes?: number
  protectedKeys?: Iterable<string>
  aggressive?: boolean
}): Promise<DownloadableCacheMaintenanceResult> {
  const allKeys = await AsyncStorage.getAllKeys()
  const cacheKeys = (Array.isArray(allKeys) ? allKeys : []).filter(isDownloadableTaskCacheKey)
  const entries = await readEntries(cacheKeys)
  const protectedKeys = new Set(Array.from(options?.protectedKeys || []).map(cleanText).filter(Boolean))
  const now = Number.isFinite(options?.now) ? Number(options?.now) : Date.now()
  const maxAgeMs = Number.isFinite(options?.maxAgeMs) ? Math.max(0, Number(options?.maxAgeMs)) : DOWNLOADABLE_TASK_CACHE_MAX_AGE_MS
  const maxEntries = Number.isFinite(options?.maxEntries) ? Math.max(0, Number(options?.maxEntries)) : DOWNLOADABLE_TASK_CACHE_MAX_ENTRIES
  const maxBytes = Number.isFinite(options?.maxBytes) ? Math.max(0, Number(options?.maxBytes)) : DOWNLOADABLE_TASK_CACHE_MAX_BYTES
  const removable = entries
    .filter((entry) => !protectedKeys.has(entry.key))
    .sort((left, right) => (left.updatedAtMs ?? 0) - (right.updatedAtMs ?? 0) || left.key.localeCompare(right.key))
  const removed = new Set<string>()

  if (options?.aggressive) {
    for (const entry of removable) removed.add(entry.key)
  } else {
    for (const entry of removable) {
      if (!entry.valid || (entry.updatedAtMs != null && now - entry.updatedAtMs > maxAgeMs)) removed.add(entry.key)
    }

    let retained = entries.filter((entry) => !removed.has(entry.key))
    let retainedBytes = retained.reduce((total, entry) => total + entry.bytes, 0)
    const remainingRemovable = removable.filter((entry) => !removed.has(entry.key))
    while ((retained.length > maxEntries || retainedBytes > maxBytes) && remainingRemovable.length) {
      const entry = remainingRemovable.shift() as CacheEntry
      removed.add(entry.key)
      retained = retained.filter((candidate) => candidate.key !== entry.key)
      retainedBytes -= entry.bytes
    }
  }

  const removedKeys = entries.filter((entry) => removed.has(entry.key)).map((entry) => entry.key)
  await removeKeys(removedKeys)
  return {
    scanned: entries.length,
    removedKeys,
    removedBytes: entries.filter((entry) => removed.has(entry.key)).reduce((total, entry) => total + entry.bytes, 0),
    retainedKeys: entries.filter((entry) => !removed.has(entry.key)).map((entry) => entry.key),
  }
}
