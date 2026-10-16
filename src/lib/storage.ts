import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  isDownloadableTaskCacheKey,
  pruneDownloadableTaskCaches,
} from './downloadableCacheMaintenance'

export function isStorageFullError(error: unknown) {
  const value = [
    (error as any)?.code,
    (error as any)?.message,
    error,
  ].map((item) => String(item || '')).join(' ')
  return /SQLITE_FULL|database or disk is full|(?:code\s*[:=]?\s*13\b)/i.test(value)
}

export async function setJson<T>(key: string, value: T) {
  const serialized = JSON.stringify(value)
  try {
    await AsyncStorage.setItem(key, serialized)
  } catch (error) {
    if (!isStorageFullError(error)) throw error
    let reclaimed = null
    try {
      reclaimed = await pruneDownloadableTaskCaches({ aggressive: true })
    } catch {
      throw error
    }
    if (!reclaimed.removedKeys.length) throw error
    await AsyncStorage.setItem(key, serialized)
  }
  if (isDownloadableTaskCacheKey(key)) {
    try {
      await pruneDownloadableTaskCaches({ protectedKeys: [key] })
    } catch {
      // The cache write already succeeded. Maintenance is best-effort and must not make callers retry it.
    }
  }
}

export async function getJson<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function remove(key: string) {
  await AsyncStorage.removeItem(key)
}

