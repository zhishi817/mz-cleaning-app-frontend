import { Directory, File, Paths } from 'expo-file-system'
import { getJson, remove, setJson } from './storage'

export type CleaningConsumablesDraftItem = {
  item_id: string
  qty?: number | null
  note?: string | null
  status?: string | null
  photo_url?: string | null
  photo_urls?: string[]
}

export type CleaningConsumablesPhotoMetaMap = Record<string, {
  name?: string
  mime_type?: string
  captured_at?: string
  watermark_text?: string
}>

export type CleaningConsumablesDraft = {
  task_id: string
  updated_at: string
  property_code?: string | null
  pending_submit?: boolean
  living_room_photo_url?: string | null
  remote_ac_photo_url?: string | null
  remote_tv_photo_url?: string | null
  extra_photo_urls?: Record<string, string | null>
  items: CleaningConsumablesDraftItem[]
  photo_meta?: CleaningConsumablesPhotoMetaMap
}

const DRAFT_KEY_PREFIX = 'mzstay.cleaning_consumables_draft.v1:'

function draftKey(taskId: string) {
  return `${DRAFT_KEY_PREFIX}${String(taskId || '').trim()}`
}

function cleanText(value: any) {
  return String(value || '').trim()
}

function normalizePhotoList(raw: any, fallback?: any) {
  const list = Array.isArray(raw) ? raw.map((item) => cleanText(item)).filter(Boolean) : []
  const first = cleanText(fallback)
  if (first) list.unshift(first)
  return Array.from(new Set(list))
}

function normalizeItems(raw: any) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      const itemId = cleanText(item?.item_id)
      if (!itemId) return null
      const note = cleanText(item?.note)
      const status = cleanText(item?.status) || null
      const qty0 = item?.qty == null || cleanText(item?.qty) === '' ? null : Number(item.qty)
      const qty = Number.isFinite(qty0) ? qty0 : null
      const photoUrls = normalizePhotoList(item?.photo_urls, item?.photo_url)
      return {
        item_id: itemId,
        qty,
        note: note || null,
        status,
        photo_url: photoUrls[0] || null,
        photo_urls: photoUrls,
      } satisfies CleaningConsumablesDraftItem
    })
    .filter(Boolean) as CleaningConsumablesDraftItem[]
}

function normalizeExtraPhotoUrls(raw: any) {
  if (!raw || typeof raw !== 'object') return {}
  return Object.fromEntries(
    Object.entries(raw)
      .map(([key, value]) => [cleanText(key), cleanText(value) || null] as const)
      .filter(([key]) => !!key),
  )
}

function normalizePhotoMeta(raw: any): CleaningConsumablesPhotoMetaMap {
  if (!raw || typeof raw !== 'object') return {}
  const next: CleaningConsumablesPhotoMetaMap = {}
  for (const [uri, meta] of Object.entries(raw)) {
    const key = cleanText(uri)
    if (!key) continue
    next[key] = {
      name: cleanText((meta as any)?.name) || undefined,
      mime_type: cleanText((meta as any)?.mime_type) || undefined,
      captured_at: cleanText((meta as any)?.captured_at) || undefined,
      watermark_text: cleanText((meta as any)?.watermark_text) || undefined,
    }
  }
  return next
}

function normalizeDraft(taskId: string, raw: any): CleaningConsumablesDraft | null {
  if (!raw || typeof raw !== 'object') return null
  return {
    task_id: cleanText(raw.task_id) || cleanText(taskId),
    updated_at: cleanText(raw.updated_at) || new Date().toISOString(),
    property_code: cleanText(raw.property_code) || null,
    pending_submit: !!raw.pending_submit,
    living_room_photo_url: cleanText(raw.living_room_photo_url) || null,
    remote_ac_photo_url: cleanText(raw.remote_ac_photo_url) || null,
    remote_tv_photo_url: cleanText(raw.remote_tv_photo_url) || null,
    extra_photo_urls: normalizeExtraPhotoUrls(raw.extra_photo_urls),
    items: normalizeItems(raw.items),
    photo_meta: normalizePhotoMeta(raw.photo_meta),
  }
}

export async function getCleaningConsumablesDraft(taskId: string) {
  const key = cleanText(taskId)
  if (!key) return null
  const raw = await getJson<CleaningConsumablesDraft>(draftKey(key))
  return normalizeDraft(key, raw)
}

export async function setCleaningConsumablesDraft(taskId: string, draft: Omit<CleaningConsumablesDraft, 'task_id' | 'updated_at'>) {
  const key = cleanText(taskId)
  if (!key) return
  const payload = normalizeDraft(key, {
    ...draft,
    task_id: key,
    updated_at: new Date().toISOString(),
  })
  if (!payload) return
  await setJson(draftKey(key), payload)
}

export async function removeCleaningConsumablesDraft(taskId: string) {
  const key = cleanText(taskId)
  if (!key) return
  await remove(draftKey(key))
}

function ensurePrivateDir() {
  const dir = new Directory(Paths.document, 'mzstay-consumables-media')
  dir.create({ intermediates: true, idempotent: true })
  return dir
}

function fileExists(uri: string) {
  const localUri = cleanText(uri)
  if (!localUri) return false
  try {
    return new File(localUri).exists
  } catch {
    return false
  }
}

function fileExtFrom(name: string, mimeType: string) {
  const ext = cleanText(name).match(/\.[a-z0-9]+$/i)?.[0]
  if (ext) return ext.toLowerCase()
  const mime = cleanText(mimeType).toLowerCase()
  if (mime === 'image/jpeg') return '.jpg'
  if (mime === 'image/png') return '.png'
  if (mime === 'image/webp') return '.webp'
  return ''
}

export function isLocalCleaningConsumablesPhotoUri(raw: any) {
  const value = cleanText(raw)
  return value.startsWith('file://')
}

export function persistCleaningConsumablesPhoto(sourceUri: string, name: string, mimeType: string, prefix: string) {
  const source = cleanText(sourceUri)
  if (!fileExists(source)) throw new Error('原始文件不存在，请重新拍摄')
  const dir = ensurePrivateDir()
  const ext = fileExtFrom(name, mimeType)
  const target = new File(dir, `${cleanText(prefix) || 'photo'}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`)
  new File(source).copy(target)
  if (!target.exists) throw new Error('本地文件保存失败，请重新拍摄')
  return target.uri
}

export function deleteCleaningConsumablesPhoto(uri: string) {
  const localUri = cleanText(uri)
  if (!isLocalCleaningConsumablesPhotoUri(localUri)) return
  try {
    const file = new File(localUri)
    if (file.exists) file.delete()
  } catch {}
}
