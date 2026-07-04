const lockedUris = new Set<string>()

function cleanText(value: any) {
  return String(value || '').trim()
}

export function isLocalMediaLocked(uri: string) {
  return lockedUris.has(cleanText(uri))
}

export async function withLocalMediaLock<T>(uri: string, work: () => Promise<T> | T): Promise<T> {
  const key = cleanText(uri)
  if (!key) return await work()
  if (lockedUris.has(key)) throw new Error('LOCAL_MEDIA_LOCKED')
  lockedUris.add(key)
  try {
    return await work()
  } finally {
    lockedUris.delete(key)
  }
}

export async function tryWithLocalMediaLock<T>(uri: string, work: () => Promise<T> | T): Promise<{ ok: true; value: T } | { ok: false; locked: true }> {
  const key = cleanText(uri)
  if (key && lockedUris.has(key)) return { ok: false, locked: true }
  if (!key) return { ok: true, value: await work() }
  lockedUris.add(key)
  try {
    return { ok: true, value: await work() }
  } finally {
    lockedUris.delete(key)
  }
}
