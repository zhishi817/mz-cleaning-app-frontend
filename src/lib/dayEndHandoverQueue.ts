import { Directory, File, Paths } from 'expo-file-system'
import { getJson, setJson } from './storage'
import { uploadCleaningMedia, uploadDayEndHandover } from './api'

export type DayEndDraftPhoto = {
  id: string
  uri: string
  captured_at: string
  uploaded_url: string | null
  watermark_text?: string
}

export type DayEndRejectDraftItem = {
  id: string
  linen_type: string
  quantity: number
  used_room: string
  photos: DayEndDraftPhoto[]
}

export type DayEndHandoverDraft = {
  user_id: string
  date: string
  pending_submit: boolean
  key_items: DayEndDraftPhoto[]
  return_wash_items: DayEndDraftPhoto[]
  reject_items: DayEndRejectDraftItem[]
  updated_at: string
}

const STORAGE_KEY = 'mzstay.day_end_handover_queue.v2'
let processing = false

function keyOf(userId: string, date: string) {
  return `${String(userId || '').trim()}::${String(date || '').slice(0, 10)}`
}

function isNetworkishError(e: any) {
  const m = String(e?.message || e || '').toLowerCase()
  if (!m) return false
  if (m.includes('network request failed')) return true
  if (m.includes('timeout')) return true
  if (m.includes('timed out')) return true
  if (m.includes('aborted')) return true
  return false
}

async function loadAllDrafts(): Promise<Record<string, DayEndHandoverDraft>> {
  const raw = await getJson<Record<string, DayEndHandoverDraft>>(STORAGE_KEY)
  return raw && typeof raw === 'object' ? raw : {}
}

async function saveAllDrafts(drafts: Record<string, DayEndHandoverDraft>) {
  await setJson(STORAGE_KEY, drafts)
}

async function ensurePersistedUri(sourceUri: string, prefix: string) {
  const dir = new Directory(Paths.document, 'mzstay-day-end-handover')
  dir.create({ intermediates: true, idempotent: true })
  const name = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
  const target = new File(dir, name)
  new File(sourceUri).copy(target)
  return target.uri
}

function normalizeDraft(raw: any): DayEndHandoverDraft | null {
  if (!raw || typeof raw !== 'object') return null
  return {
    user_id: String(raw.user_id || ''),
    date: String(raw.date || '').slice(0, 10),
    pending_submit: !!raw.pending_submit,
    key_items: Array.isArray(raw.key_items) ? raw.key_items : [],
    return_wash_items: Array.isArray(raw.return_wash_items)
      ? raw.return_wash_items
      : (Array.isArray(raw.dirty_items) ? raw.dirty_items : []),
    reject_items: Array.isArray(raw.reject_items) ? raw.reject_items : [],
    updated_at: String(raw.updated_at || new Date().toISOString()),
  }
}

export async function getDayEndHandoverDraft(userId: string, date: string) {
  const drafts = await loadAllDrafts()
  return normalizeDraft(drafts[keyOf(userId, date)])
}

export async function saveDayEndHandoverDraft(draft: DayEndHandoverDraft) {
  const drafts = await loadAllDrafts()
  drafts[keyOf(draft.user_id, draft.date)] = { ...draft, updated_at: new Date().toISOString() }
  await saveAllDrafts(drafts)
}

export async function clearDayEndHandoverDraft(userId: string, date: string) {
  const drafts = await loadAllDrafts()
  const k = keyOf(userId, date)
  const draft = normalizeDraft(drafts[k])
  delete drafts[k]
  await saveAllDrafts(drafts)
  const allPhotos = [
    ...(draft?.key_items || []),
    ...(draft?.return_wash_items || []),
    ...((draft?.reject_items || []).flatMap((item) => item.photos || [])),
  ]
  for (const item of allPhotos) {
    const localUri = String(item.uri || '').trim()
    if (!localUri || /^https?:\/\//i.test(localUri)) continue
    try { new File(localUri).delete() } catch {}
  }
}

export async function persistDayEndDraftPhoto(params: {
  user_id: string
  date: string
  bucket: 'key' | 'return_wash' | 'reject'
  source_uri: string
  captured_at: string
  watermark_text?: string
}) {
  const existing = (await getDayEndHandoverDraft(params.user_id, params.date)) || {
    user_id: String(params.user_id),
    date: String(params.date).slice(0, 10),
    pending_submit: false,
    key_items: [],
    return_wash_items: [],
    reject_items: [],
    updated_at: new Date().toISOString(),
  }
  const localUri = await ensurePersistedUri(params.source_uri, params.bucket)
  const item: DayEndDraftPhoto = {
    id: `${params.bucket}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    uri: localUri,
    captured_at: params.captured_at,
    uploaded_url: null,
    watermark_text: params.watermark_text,
  }
  if (params.bucket === 'key') {
    await saveDayEndHandoverDraft({ ...existing, key_items: [item, ...(existing.key_items || [])] })
  } else if (params.bucket === 'return_wash') {
    await saveDayEndHandoverDraft({ ...existing, return_wash_items: [item, ...(existing.return_wash_items || [])] })
  }
  return item
}

export async function processDayEndHandoverQueue(token: string) {
  if (processing) return { processed: 0, remaining: 0 }
  processing = true
  try {
    const drafts = await loadAllDrafts()
    const entries = Object.entries(drafts)
    let processed = 0

    const uploadItems = async (purpose: string, prefix: string, items: DayEndDraftPhoto[]) => {
      const out: DayEndDraftPhoto[] = []
      for (const item of items || []) {
        if (item.uploaded_url) {
          out.push(item)
          continue
        }
        try {
          const up = await uploadCleaningMedia(
            token,
            { uri: item.uri, name: `${prefix}-${item.id}.jpg`, mimeType: 'image/jpeg' },
            {
              purpose,
              captured_at: item.captured_at,
              watermark: item.watermark_text ? '1' : '',
              watermark_text: item.watermark_text || '',
            },
          )
          out.push({ ...item, uploaded_url: up.url })
        } catch (e: any) {
          if (isNetworkishError(e)) throw e
          out.push(item)
        }
      }
      return out
    }

    for (const [k, rawDraft] of entries) {
      const draft = normalizeDraft(rawDraft)
      if (!draft) continue
      try {
        const keyItems = await uploadItems('backup_key_return', 'key', draft.key_items || [])
        const returnWashItems = await uploadItems('return_wash_linen', 'return-wash', draft.return_wash_items || [])
        const rejectItems: DayEndRejectDraftItem[] = []
        for (const item of draft.reject_items || []) {
          const photos = await uploadItems('reject_linen_return', `reject-${item.id}`, item.photos || [])
          rejectItems.push({ ...item, photos })
        }
        const nextDraft: DayEndHandoverDraft = {
          ...draft,
          key_items: keyItems,
          return_wash_items: returnWashItems,
          reject_items: rejectItems,
          updated_at: new Date().toISOString(),
        }

        if (nextDraft.pending_submit) {
          const payload = {
            date: nextDraft.date,
            key_photos: (nextDraft.key_items || []).map((x) => ({ url: String(x.uploaded_url || '').trim(), captured_at: x.captured_at })).filter((x) => !!x.url),
            return_wash_photos: (nextDraft.return_wash_items || []).map((x) => ({ url: String(x.uploaded_url || '').trim(), captured_at: x.captured_at })).filter((x) => !!x.url),
            dirty_linen_photos: (nextDraft.return_wash_items || []).map((x) => ({ url: String(x.uploaded_url || '').trim(), captured_at: x.captured_at })).filter((x) => !!x.url),
            reject_items: (nextDraft.reject_items || [])
              .map((item) => ({
                linen_type: String(item.linen_type || '').trim(),
                quantity: Number(item.quantity || 0) || 0,
                used_room: String(item.used_room || '').trim(),
                photos: (item.photos || []).map((p) => ({ url: String(p.uploaded_url || '').trim(), captured_at: p.captured_at })).filter((p) => !!p.url),
              }))
              .filter((item) => item.linen_type && item.quantity > 0 && item.used_room && item.photos.length > 0),
          }
          if (payload.key_photos.length && payload.return_wash_photos.length) {
            await uploadDayEndHandover(token, payload)
            await clearDayEndHandoverDraft(nextDraft.user_id, nextDraft.date)
            processed++
            continue
          }
        }

        drafts[k] = nextDraft
        await saveAllDrafts(drafts)
      } catch (e: any) {
        if (isNetworkishError(e)) break
      }
    }

    const latest = await loadAllDrafts()
    return { processed, remaining: Object.keys(latest).length }
  } finally {
    processing = false
  }
}
