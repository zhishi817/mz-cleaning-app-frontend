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
  if (!key.startsWith('mzapp/') && !key.startsWith('maintenance/') && !key.startsWith('deep-cleaning/') && !key.startsWith('deep-cleaning-upload/') && !key.startsWith('inventory/')) return ''
  if (key.includes('..') || key.includes('\\') || /[?#]/.test(key)) return ''
  return key
}

export function cleaningMediaReference(upload: { key?: string | null; url?: string | null }) {
  return normalizeCleaningObjectKey(upload?.key) || cleanText(upload?.url)
}

export function normalizeGuestLuggageNoticeId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const id = value.trim().toLowerCase()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id) ? id : null
}

export function normalizeCleaningTaskNoticeId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const id = value.trim()
  return id && id.length <= 160 ? id : null
}

export type CleaningMediaImageVariant = 'original' | 'thumbnail' | 'preview'

export type CleaningMediaAccessOptions = {
  accessTaskId?: string | null
  accessWorkTaskId?: string | null
  guestLuggageId?: string | null
  offlineWorkTaskMedia?: boolean
  dayEndUserId?: string | null
  dayEndDate?: string | null
}

function cleaningMediaProxyUrl(reference: string, variant: CleaningMediaImageVariant = 'original', options?: CleaningMediaAccessOptions) {
  const base = normalizeBase(API_BASE_URL)
  const apiRoot = base.replace(/\/auth\/?$/g, '')
  if (!apiRoot) return ''
  const key = normalizePrivateFeedbackObjectKey(reference)
  const query = key ? `key=${encodeURIComponent(key)}` : `url=${encodeURIComponent(reference)}`
  const variantQuery = variant === 'original' ? '' : `&variant=${variant}`
  const taskId = cleanText(options?.accessTaskId)
  const taskQuery = taskId ? `&source_task_id=${encodeURIComponent(taskId)}` : ''
  const workTaskId = cleanText(options?.accessWorkTaskId)
  const workTaskQuery = workTaskId ? `&work_task_id=${encodeURIComponent(workTaskId)}` : ''
  const guestLuggage = cleanText(options?.guestLuggageId)
  const guestLuggageQuery = guestLuggage ? `&guest_luggage_id=${encodeURIComponent(guestLuggage)}` : ''
  const dayEndUserId = cleanText(options?.dayEndUserId)
  const dayEndDate = cleanText(options?.dayEndDate)
  const dayEndQuery = dayEndUserId && dayEndDate
    ? `&day_end_user_id=${encodeURIComponent(dayEndUserId)}&day_end_date=${encodeURIComponent(dayEndDate)}`
    : ''
  return `${apiRoot}/cleaning-app/media/image?${query}${variantQuery}${taskQuery}${workTaskQuery}${guestLuggageQuery}${dayEndQuery}`
}

function isLegacyPrivateR2Url(value: string) {
  if (!/^https?:\/\//i.test(value)) return false
  try {
    const url = new URL(value)
    const hostname = url.hostname.toLowerCase()
    const pathname = url.pathname
    return hostname.endsWith('.r2.dev')
      || pathname.includes('/cleaning/')
      || pathname.includes('/mzapp/')
      || pathname.includes('/maintenance/')
      || pathname.includes('/deep-cleaning/')
      || pathname.includes('/deep-cleaning-upload/')
      || pathname.includes('/inventory/')
  } catch {
    return false
  }
}

function isServerManagedMzappTaskReference(value: string) {
  const match = /^r2:\/\/([a-z0-9][a-z0-9._-]{0,119})\/(mzapp\/.*)$/i.exec(value)
  return Boolean(match && normalizePrivateFeedbackObjectKey(match[2]))
}

export function isAuthenticatedCleaningMediaReference(value: any) {
  const reference = cleanText(value)
  return Boolean(
    normalizePrivateFeedbackObjectKey(reference)
    || isLegacyPrivateR2Url(reference)
    || isServerManagedMzappTaskReference(reference),
  )
}

export function buildCleaningMediaImageSource(
  token: string | null | undefined,
  rawReference: any,
  variant: CleaningMediaImageVariant = 'original',
  options?: CleaningMediaAccessOptions,
) {
  const reference = cleanText(rawReference)
  if (!reference) return { uri: '' }
  const key = normalizePrivateFeedbackObjectKey(reference)
  if (isAuthenticatedCleaningMediaReference(reference)) {
    return {
      uri: cleaningMediaProxyUrl(key || reference, variant, options),
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }
  }
  if (reference.startsWith('file:')) return { uri: reference }
  return { uri: '' }
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
