import { API_BASE_URL } from '../config/env'

function cleanText(value: any) {
  return String(value || '').trim()
}

function normalizeBase(base: string) {
  return cleanText(base).replace(/\/+$/g, '')
}

export function normalizeCleaningObjectKey(value: any) {
  const key = cleanText(value).replace(/^\/+/, '')
  if (!key.startsWith('cleaning/')) return ''
  if (key.includes('..') || key.includes('\\')) return ''
  return key
}

export function cleaningMediaReference(upload: { key?: string | null; url?: string | null }) {
  return normalizeCleaningObjectKey(upload?.key) || cleanText(upload?.url)
}

function cleaningMediaProxyUrl(reference: string) {
  const base = normalizeBase(API_BASE_URL)
  const apiRoot = base.replace(/\/auth\/?$/g, '')
  if (!apiRoot) return ''
  const key = normalizeCleaningObjectKey(reference)
  const query = key ? `key=${encodeURIComponent(key)}` : `url=${encodeURIComponent(reference)}`
  return `${apiRoot}/cleaning-app/media/image?${query}`
}

function isLegacyPrivateR2Url(value: string) {
  if (!/^https?:\/\//i.test(value)) return false
  if (value.includes('.r2.cloudflarestorage.com/') || value.includes('.r2.dev/')) return true
  try {
    return new URL(value).pathname.includes('/cleaning/')
  } catch {
    return false
  }
}

export function buildCleaningMediaImageSource(token: string | null | undefined, rawReference: any) {
  const reference = cleanText(rawReference)
  if (!reference) return { uri: '' }
  const key = normalizeCleaningObjectKey(reference)
  if (key || isLegacyPrivateR2Url(reference)) {
    return {
      uri: cleaningMediaProxyUrl(key || reference),
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }
  }
  if (reference.startsWith('//')) return { uri: `https:${reference}` }
  if (/^[a-z][a-z0-9+.-]*:/i.test(reference)) return { uri: reference }

  const base = normalizeBase(API_BASE_URL)
  const root = base.replace(/\/auth\/?$/g, '').replace(/\/api\/?$/g, '')
  return { uri: reference.startsWith('/') && root ? `${root}${reference}` : reference }
}

export function selectCleaningMediaReference(params: {
  localUri?: string | null
  thumbnailUri?: string | null
  remoteReference?: string | null
  isOnline: boolean
  remoteFailed?: boolean
  thumbnailFailed?: boolean
}) {
  const local = cleanText(params.localUri)
  const thumbnail = cleanText(params.thumbnailUri)
  const remote = cleanText(params.remoteReference)
  if (local) return { reference: local, kind: 'local' as const }
  if (params.isOnline && remote && !params.remoteFailed) {
    return { reference: remote, kind: 'remote' as const }
  }
  if (thumbnail && !params.thumbnailFailed) {
    return { reference: thumbnail, kind: 'thumbnail' as const }
  }
  return { reference: remote, kind: 'remote' as const }
}
