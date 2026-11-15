import AsyncStorage from '@react-native-async-storage/async-storage'
import { getJson, setJson, remove } from './storage'

let session: { userId: string; token: string } | null = null
export function setMediaCaptureSession(userId: string, token: string) {
  session = userId.trim() && token.trim() ? { userId: userId.trim(), token } : null
}
export function clearMediaCaptureSession() { session = null }
export function getMediaCaptureUserId() { return session?.userId || '' }
export function assertMediaCaptureSession(token: string, owner = getMediaCaptureUserId()) {
  if (!owner || !session || owner !== session.userId || token !== session.token) {
    throw new Error('MEDIA_CAPTURE_OWNER_MISMATCH：原账号媒体已暂停，请使用原账号继续。')
  }
  return token
}
export function mediaCaptureStorageKey(key: string) {
  const owner = getMediaCaptureUserId()
  if (!owner) throw new Error('MEDIA_CAPTURE_OWNER_MISSING：请先登录，照片不会删除。')
  return `mzstay.media_owner.v1:${encodeURIComponent(owner)}:${key}`
}
// Never read/migrate/delete the former shared namespace: its capture owner is unknown.
export async function getOwnedMediaJson<T>(key: string): Promise<T | null> {
  if (!getMediaCaptureUserId()) return null
  const owner = getMediaCaptureUserId()
  const value = await getJson<T>(mediaCaptureStorageKey(key))
  if (owner !== getMediaCaptureUserId()) throw new Error('MEDIA_CAPTURE_SESSION_CHANGED')
  return value
}
export async function setOwnedMediaJson<T>(key: string, value: T) {
  const owner = getMediaCaptureUserId()
  function check(input: unknown) {
    if (!input || typeof input !== 'object') return
    const record = input as Record<string, unknown>
    const capturedBy = String(record.captured_by_user_id || '').trim()
    if (capturedBy && capturedBy !== owner) throw new Error('MEDIA_CAPTURE_OWNER_MISMATCH')
    Object.values(record).forEach(check)
  }
  check(value)
  return setJson(mediaCaptureStorageKey(key), value)
}
export async function removeOwnedMediaJson(key: string) {
  if (!getMediaCaptureUserId()) return
  return remove(mediaCaptureStorageKey(key))
}

export function guardMediaRequest<A extends any[], R>(request: (token: string, ...args: A) => Promise<R>, requireCaptureOwner = false) {
  return async (token: string, ...args: A): Promise<R> => {
    const owner = getMediaCaptureUserId()
    assertMediaCaptureSession(token, owner)
    if (requireCaptureOwner) {
      const metadata = args[1] as { captured_by_user_id?: string } | undefined
      assertMediaCaptureSession(token, String(metadata?.captured_by_user_id || ''))
    }
    const result = await request(token, ...args)
    assertMediaCaptureSession(token, owner)
    return result
  }
}

export async function hasUnownedMediaDrafts(): Promise<boolean> {
  const keys = await AsyncStorage.getAllKeys()
  const legacy = keys.filter(key => /^mzstay\.(inspection_panel_(draft|feedback_draft|submit_queue)|inspection_post_submit_issue_draft|inspection_media_queue|key_upload_queue|day_end_handover_queue|cleaning_consumables_(draft|submit_queue))\./.test(key))
  const records = await AsyncStorage.multiGet(legacy)
  return records.some(([, value]) => {
    if (!value) return false
    try { return hasPendingUnownedMedia(JSON.parse(value)) } catch { return true }
  })
}

export function hasPendingUnownedMedia(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  if (Array.isArray(value)) return value.some(hasPendingUnownedMedia)
  const item = value as Record<string, unknown>
  if (item.status === 'synced' || item.submit_status === 'synced' || item.business_saved === true) return false
  if (item.pending_submit === true) return true
  for (const [key, nested] of Object.entries(item)) {
    if (['local_uri', 'uri', 'thumbnail_uri'].includes(key) && typeof nested === 'string' && nested.startsWith('file://')) return true
    if (hasPendingUnownedMedia(nested)) return true
  }
  return false
}
