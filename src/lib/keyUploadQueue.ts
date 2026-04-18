import { Directory, File, Paths } from 'expo-file-system'
import { getJson, setJson } from './storage'
import { startCleaningTask, uploadCleaningMedia } from './api'

type QueueItem = {
  id: string
  cleaning_task_id: string
  local_uri: string
  property_code?: string
  captured_at?: string
  watermark_text?: string
  created_at: string
}

const STORAGE_KEY = 'mzstay.key_upload_queue.v1'

let processing = false

function isNetworkishError(e: any) {
  const m = String(e?.message || e || '').toLowerCase()
  if (!m) return false
  if (m.includes('network request failed')) return true
  if (m.includes('timeout')) return true
  if (m.includes('timed out')) return true
  if (m.includes('aborted')) return true
  return false
}

async function loadQueue(): Promise<QueueItem[]> {
  const q = await getJson<QueueItem[]>(STORAGE_KEY)
  return Array.isArray(q) ? q : []
}

async function saveQueue(q: QueueItem[]) {
  await setJson(STORAGE_KEY, q)
}

async function ensurePersistedUri(sourceUri: string) {
  const dir = new Directory(Paths.document, 'mzstay-key-uploads')
  dir.create({ intermediates: true, idempotent: true })
  const name = `key-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
  const target = new File(dir, name)
  new File(sourceUri).copy(target)
  return target.uri
}

export async function enqueueKeyUpload(params: {
  cleaning_task_id: string
  source_uri: string
  property_code?: string
  captured_at?: string
  watermark_text?: string
}) {
  const local_uri = await ensurePersistedUri(params.source_uri)
  const q = await loadQueue()
  const item: QueueItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    cleaning_task_id: String(params.cleaning_task_id),
    local_uri,
    property_code: params.property_code ? String(params.property_code) : undefined,
    captured_at: params.captured_at ? String(params.captured_at) : undefined,
    watermark_text: params.watermark_text ? String(params.watermark_text) : undefined,
    created_at: new Date().toISOString(),
  }
  q.push(item)
  await saveQueue(q)
  return item
}

export async function getKeyUploadQueueLength() {
  const q = await loadQueue()
  return q.length
}

export async function processKeyUploadQueue(token: string) {
  if (processing) return { processed: 0, remaining: await getKeyUploadQueueLength() }
  processing = true
  try {
    let q = await loadQueue()
    if (!q.length) return { processed: 0, remaining: 0 }
    let processed = 0

    const remaining: QueueItem[] = []
    for (const item of q) {
      try {
        const uri = String(item.local_uri || '').trim()
        if (!uri) continue
        const up = await uploadCleaningMedia(
          token,
          { uri, name: 'key.jpg', mimeType: 'image/jpeg' },
          {
            purpose: 'key_photo',
            watermark: item.watermark_text ? '1' : '',
            watermark_text: item.watermark_text || '',
            property_code: item.property_code || '',
            captured_at: item.captured_at || '',
          },
        )
        await startCleaningTask(token, String(item.cleaning_task_id), { media_url: up.url, captured_at: item.captured_at || undefined })
        processed++
        try {
          new File(uri).delete()
        } catch {}
      } catch (e: any) {
        if (isNetworkishError(e)) {
          remaining.push(item)
          break
        }
        remaining.push(item)
      }
    }

    if (processed) {
      const left = q.slice(processed)
      if (remaining.length) {
        const leftSet = new Set(remaining.map(x => x.id))
        q = left.filter(x => leftSet.has(x.id))
      } else {
        q = left
      }
    } else {
      q = remaining.length ? remaining : q
    }

    await saveQueue(q)
    return { processed, remaining: q.length }
  } finally {
    processing = false
  }
}
