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

function normalizePrivateFeedbackObjectKey(value: any) {
  const key = cleanText(value).replace(/^\/+/, '')
  if (normalizeCleaningObjectKey(key)) return key
  if (!key.startsWith('mzapp/') && !key.startsWith('maintenance/')) return ''
  if (key.includes('..') || key.includes('\\') || /[?#]/.test(key)) return ''
  return key
}

export function cleaningMediaReference(upload: { key?: string | null; url?: string | null }) {
  return normalizeCleaningObjectKey(upload?.key) || cleanText(upload?.url)
}

export type CleaningMediaImageVariant = 'original' | 'thumbnail' | 'preview'

function cleaningMediaProxyUrl(reference: string, variant: CleaningMediaImageVariant = 'original', accessTaskId?: string | null, accessWorkTaskId?: string | null) {
  const base = normalizeBase(API_BASE_URL)
  const apiRoot = base.replace(/\/auth\/?$/g, '')
  if (!apiRoot) return ''
  const key = normalizePrivateFeedbackObjectKey(reference)
  const query = key ? `key=${encodeURIComponent(key)}` : `url=${encodeURIComponent(reference)}`
  const variantQuery = variant === 'original' ? '' : `&variant=${variant}`
  const taskId = cleanText(accessTaskId)
  const taskQuery = taskId ? `&source_task_id=${encodeURIComponent(taskId)}` : ''
  const workTaskId = cleanText(accessWorkTaskId)
  const workTaskQuery = workTaskId ? `&work_task_id=${encodeURIComponent(workTaskId)}` : ''
  return `${apiRoot}/cleaning-app/media/image?${query}${variantQuery}${taskQuery}${workTaskQuery}`
}

function isLegacyPrivateR2Url(value: string) {
  if (!/^https?:\/\//i.test(value)) return false
  try {
    const pathname = new URL(value).pathname
    return pathname.includes('/cleaning/') || pathname.includes('/mzapp/') || pathname.includes('/maintenance/')
  } catch {
    return false
  }
}

function isServerManagedMzappTaskReference(value: string) {
  const match = /^r2:\/\/([a-z0-9][a-z0-9._-]{0,119})\/(mzapp\/.*)$/i.exec(value)
  return Boolean(match && normalizePrivateFeedbackObjectKey(match[2]))
}

export function buildCleaningMediaImageSource(
  token: string | null | undefined,
  rawReference: any,
  variant: CleaningMediaImageVariant = 'original',
  options?: { accessTaskId?: string | null; accessWorkTaskId?: string | null; offlineWorkTaskMedia?: boolean },
) {
  const reference = cleanText(rawReference)
  if (!reference) return { uri: '' }
  const key = normalizePrivateFeedbackObjectKey(reference)
  const forceOfflineWorkTaskProxy = Boolean(options?.offlineWorkTaskMedia && cleanText(options?.accessWorkTaskId) && /^https:\/\//i.test(reference))
  if (key || isLegacyPrivateR2Url(reference) || isServerManagedMzappTaskReference(reference) || forceOfflineWorkTaskProxy) {
    return {
      uri: cleaningMediaProxyUrl(key || reference, variant, options?.accessTaskId, options?.accessWorkTaskId),
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
