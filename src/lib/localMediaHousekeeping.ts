import AsyncStorage from '@react-native-async-storage/async-storage'
import { Directory, File, Paths } from 'expo-file-system'
import { pruneInspectionThumbnailCache } from './inspectionThumbnailCache'
import { tryWithLocalMediaLock } from './localMediaLocks'

const LOCAL_MEDIA_DIR_NAMES = [
  'mzstay-inspection-media',
  'mzstay-inspection-panel-batch',
  'mzstay-inspection-feedback-drafts',
  'mzstay-key-uploads',
  'mzstay-day-end-handover',
  'mzstay-consumables-media',
  'mzstay-inspection-thumbnails',
]

const REFERENCE_STORAGE_KEYS = [
  'mzstay.inspection_media_queue.v1',
  'mzstay.inspection_panel_submit_queue.v1',
  'mzstay.key_upload_queue.v2',
  'mzstay.day_end_handover_queue.v2',
  'mzstay.cleaning_consumables_submit_queue.v1',
]

const REFERENCE_STORAGE_KEY_PREFIXES = [
  'mzstay.inspection_panel_draft.v2:',
  'mzstay.inspection_panel_feedback_draft.v1:',
  'mzstay.cleaning_consumables_draft.v1:',
]

const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000

export type LocalMediaFileEntry = {
  uri: string
  size?: number
  modificationTime?: number | null
}

function cleanText(value: any) {
  return String(value || '').trim()
}

function isLocalFileUri(value: any) {
  return cleanText(value).startsWith('file://')
}

export function isLocalMediaReferenceStorageKey(key: string) {
  const value = cleanText(key)
  return REFERENCE_STORAGE_KEYS.includes(value)
    || REFERENCE_STORAGE_KEY_PREFIXES.some((prefix) => value.startsWith(prefix))
}

export function collectLocalFileUris(value: any, out = new Set<string>()) {
  if (typeof value === 'string') {
    if (isLocalFileUri(value)) out.add(cleanText(value))
    return out
  }
  if (Array.isArray(value)) {
    for (const item of value) collectLocalFileUris(item, out)
    return out
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectLocalFileUris(item, out)
  }
  return out
}

function parseStoredValue(raw: string | null) {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

export async function collectProtectedLocalMediaUris() {
  const protectedUris = new Set<string>()
  const getAllKeys = (AsyncStorage as any).getAllKeys
  const keys = typeof getAllKeys === 'function' ? await getAllKeys() : REFERENCE_STORAGE_KEYS
  const relevantKeys = (Array.isArray(keys) ? keys : []).filter(isLocalMediaReferenceStorageKey)
  for (const key of relevantKeys) {
    try {
      collectLocalFileUris(parseStoredValue(await AsyncStorage.getItem(key)), protectedUris)
    } catch {}
  }
  return protectedUris
}

function listKnownLocalMediaFiles() {
  const entries: LocalMediaFileEntry[] = []
  for (const dirName of LOCAL_MEDIA_DIR_NAMES) {
    try {
      const dir = new Directory(Paths.document, dirName)
      if (!dir.exists) continue
      for (const entry of dir.list()) {
        if (!(entry instanceof File) || !entry.exists) continue
        let info: any = null
        try {
          info = entry.info()
        } catch {}
        entries.push({
          uri: entry.uri,
          size: Number(info?.size || 0),
          modificationTime: Number(info?.modificationTime || 0) || null,
        })
      }
    } catch {}
  }
  return entries
}

export function selectOrphanLocalMediaFilesToDelete(
  entries: LocalMediaFileEntry[],
  protectedUris: Set<string>,
  now = Date.now(),
  graceMs = ORPHAN_GRACE_MS,
) {
  return entries
    .filter((entry) => isLocalFileUri(entry.uri))
    .filter((entry) => !protectedUris.has(cleanText(entry.uri)))
    .filter((entry) => {
      const modifiedAt = Number(entry.modificationTime || 0)
      return Number.isFinite(modifiedAt) && modifiedAt > 0 && now - modifiedAt >= graceMs
    })
    .map((entry) => cleanText(entry.uri))
}

export async function runLocalMediaHousekeeping(options?: { now?: number; orphanGraceMs?: number }) {
  const protectedUris = await collectProtectedLocalMediaUris()
  pruneInspectionThumbnailCache(Array.from(protectedUris))

  const entries = listKnownLocalMediaFiles()
  const selected = selectOrphanLocalMediaFilesToDelete(
    entries,
    protectedUris,
    options?.now || Date.now(),
    options?.orphanGraceMs || ORPHAN_GRACE_MS,
  )
  let deleted = 0
  for (const uri of selected) {
    const result = await tryWithLocalMediaLock(uri, () => {
      try {
        const file = new File(uri)
        if (file.exists) {
          file.delete()
          deleted += 1
        }
      } catch {}
    })
    if (!result.ok) continue
  }
  return { scanned: entries.length, deleted, protected: protectedUris.size }
}
