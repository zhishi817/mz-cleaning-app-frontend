import { isRetryableApiError, isTerminalAuthApiError, submitCleaningConsumables, uploadCleaningMedia } from './api'
import {
  deleteCleaningConsumablesPhoto,
  getCleaningConsumablesDraft,
  isLocalCleaningConsumablesPhotoUri,
  removeCleaningConsumablesDraft,
  setCleaningConsumablesDraft,
  type CleaningConsumablesDraft,
} from './cleaningConsumablesDraft'
import { getJson, setJson } from './storage'

const STORAGE_KEY = 'mzstay.cleaning_consumables_submit_queue.v1'

let processing = false

function cleanText(value: any) {
  return String(value || '').trim()
}

function uniq(items: string[]) {
  return Array.from(new Set(items.map((item) => cleanText(item)).filter(Boolean)))
}

async function loadQueueTaskIds() {
  const raw = await getJson<string[]>(STORAGE_KEY)
  return Array.isArray(raw) ? uniq(raw) : []
}

async function saveQueueTaskIds(taskIds: string[]) {
  await setJson(STORAGE_KEY, uniq(taskIds))
}

function buildWatermarkText(propertyCode: string, username: string, iso: string) {
  const d = new Date(String(iso || ''))
  const pad2 = (n: number) => String(n).padStart(2, '0')
  const line1 = `${propertyCode || '未知房号'}${username ? `  ${username}` : ''}`.trim()
  const line2 = Number.isNaN(d.getTime())
    ? String(iso || '').trim()
    : `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  return `${line1}\n${line2}`.trim()
}

export async function enqueueCleaningConsumablesSubmit(taskId: string) {
  const key = cleanText(taskId)
  if (!key) return
  const current = await loadQueueTaskIds()
  current.push(key)
  await saveQueueTaskIds(current)
}

export async function dequeueCleaningConsumablesSubmit(taskId: string) {
  const key = cleanText(taskId)
  if (!key) return
  const current = await loadQueueTaskIds()
  await saveQueueTaskIds(current.filter((item) => item !== key))
}

export async function isCleaningConsumablesSubmitQueued(taskId: string) {
  const key = cleanText(taskId)
  if (!key) return false
  const current = await loadQueueTaskIds()
  return current.includes(key)
}

async function uploadDraftPhotoIfNeeded(
  token: string,
  username: string,
  draft: CleaningConsumablesDraft,
  rawUrl: string,
  fallbackName: string,
  meta: Record<string, any>,
) {
  const current = cleanText(rawUrl)
  if (!current) return ''
  if (!isLocalCleaningConsumablesPhotoUri(current)) return current
  const photoMeta = draft.photo_meta?.[current]
  const capturedAt = cleanText(photoMeta?.captured_at) || new Date().toISOString()
  const name = cleanText(photoMeta?.name) || fallbackName
  const mimeType = cleanText(photoMeta?.mime_type) || 'image/jpeg'
  const watermarkText = cleanText(photoMeta?.watermark_text) || buildWatermarkText(cleanText(draft.property_code), username, capturedAt)
  const up = await uploadCleaningMedia(
    token,
    { uri: current, name, mimeType },
    {
      ...meta,
      captured_at: capturedAt,
      property_code: cleanText(draft.property_code) || undefined,
      watermark: watermarkText ? '1' : '',
      watermark_text: watermarkText || '',
    },
  )
  deleteCleaningConsumablesPhoto(current)
  if (draft.photo_meta?.[current]) {
    const nextPhotoMeta = { ...(draft.photo_meta || {}) }
    delete nextPhotoMeta[current]
    draft.photo_meta = nextPhotoMeta
  }
  return cleanText((up as any)?.url)
}

async function materializeDraftForSubmit(token: string, username: string, draft: CleaningConsumablesDraft) {
  const nextDraft: CleaningConsumablesDraft = {
    ...draft,
    extra_photo_urls: { ...(draft.extra_photo_urls || {}) },
    items: (draft.items || []).map((item) => ({ ...item, photo_urls: Array.isArray(item.photo_urls) ? [...item.photo_urls] : [] })),
    photo_meta: { ...(draft.photo_meta || {}) },
  }

  async function persistProgress() {
    await setCleaningConsumablesDraft(nextDraft.task_id, {
      property_code: nextDraft.property_code || null,
      pending_submit: true,
      living_room_photo_url: nextDraft.living_room_photo_url || null,
      remote_ac_photo_url: nextDraft.remote_ac_photo_url || null,
      remote_tv_photo_url: nextDraft.remote_tv_photo_url || null,
      extra_photo_urls: nextDraft.extra_photo_urls || {},
      items: nextDraft.items,
      photo_meta: nextDraft.photo_meta || {},
    })
  }

  for (const item of nextDraft.items) {
    const nextPhotoUrls: string[] = []
    const sourceUrls = Array.isArray(item.photo_urls) && item.photo_urls.length
      ? item.photo_urls
      : (cleanText(item.photo_url) ? [cleanText(item.photo_url)] : [])
    for (let i = 0; i < sourceUrls.length; i += 1) {
      const uploaded = await uploadDraftPhotoIfNeeded(token, username, nextDraft, sourceUrls[i] || '', `${item.item_id}-${i + 1}.jpg`, { purpose: 'consumable_stock_photo' })
      if (uploaded) nextPhotoUrls.push(uploaded)
    }
    item.photo_urls = nextPhotoUrls
    item.photo_url = nextPhotoUrls[0] || null
    await persistProgress()
  }

  nextDraft.living_room_photo_url = await uploadDraftPhotoIfNeeded(token, username, nextDraft, cleanText(nextDraft.living_room_photo_url), 'living-room.jpg', { purpose: 'consumable_living_room_photo' }) || null
  await persistProgress()
  nextDraft.remote_ac_photo_url = await uploadDraftPhotoIfNeeded(token, username, nextDraft, cleanText(nextDraft.remote_ac_photo_url), 'remote-ac.jpg', { purpose: 'consumable_remote_photo', area: 'ac_remote' }) || null
  await persistProgress()
  nextDraft.remote_tv_photo_url = await uploadDraftPhotoIfNeeded(token, username, nextDraft, cleanText(nextDraft.remote_tv_photo_url), 'remote-tv.jpg', { purpose: 'consumable_remote_photo', area: 'tv_remote' }) || null
  await persistProgress()

  for (const [photoId, rawUrl] of Object.entries(nextDraft.extra_photo_urls || {})) {
    nextDraft.extra_photo_urls![photoId] = await uploadDraftPhotoIfNeeded(token, username, nextDraft, cleanText(rawUrl), `${photoId}.jpg`, { purpose: 'consumable_scene_photo', scene: photoId }) || null
    await persistProgress()
  }

  const out = nextDraft.items.map((item) => ({
    item_id: item.item_id,
    status: (cleanText(item.status) || 'ok') as 'ok' | 'low',
    qty: cleanText(item.status) === 'low' ? Number(item.qty || 0) || undefined : undefined,
    note: cleanText(item.note) || undefined,
    photo_url: cleanText(item.photo_url) || undefined,
    photo_urls: Array.isArray(item.photo_urls) && item.photo_urls.length ? item.photo_urls.map((url) => cleanText(url)).filter(Boolean) : undefined,
  }))

  if (cleanText(nextDraft.remote_ac_photo_url)) {
    out.push({ item_id: 'remote_ac', status: 'ok', photo_url: cleanText(nextDraft.remote_ac_photo_url) } as any)
  }
  if (cleanText(nextDraft.remote_tv_photo_url)) {
    out.push({ item_id: 'remote_tv', status: 'ok', photo_url: cleanText(nextDraft.remote_tv_photo_url) } as any)
  }
  for (const [photoId, url] of Object.entries(nextDraft.extra_photo_urls || {})) {
    const photoUrl = cleanText(url)
    if (!photoUrl) continue
    out.push({ item_id: photoId, status: 'ok', photo_url: photoUrl } as any)
  }

  return {
    living_room_photo_url: cleanText(nextDraft.living_room_photo_url),
    items: out,
  }
}

export async function processCleaningConsumablesSubmitQueue(token: string, username = '') {
  if (processing) return { processed: 0, remaining: (await loadQueueTaskIds()).length }
  processing = true
  try {
    const queueTaskIds = await loadQueueTaskIds()
    let processed = 0
    const remaining = [...queueTaskIds]
    for (const taskId of queueTaskIds) {
      const draft = await getCleaningConsumablesDraft(taskId)
      if (!draft || !draft.pending_submit) {
        await dequeueCleaningConsumablesSubmit(taskId)
        continue
      }
      try {
        const payload = await materializeDraftForSubmit(token, username, draft)
        await submitCleaningConsumables(token, taskId, payload as any)
        await removeCleaningConsumablesDraft(taskId)
        await dequeueCleaningConsumablesSubmit(taskId)
        const idx = remaining.indexOf(taskId)
        if (idx >= 0) remaining.splice(idx, 1)
        processed += 1
      } catch (error) {
        if (isRetryableApiError(error) || isTerminalAuthApiError(error)) break
        break
      }
    }
    return { processed, remaining: remaining.length }
  } finally {
    processing = false
  }
}
