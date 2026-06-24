import { Directory, File, Paths } from 'expo-file-system'

const CACHE_DIR_NAME = 'mzstay-inspection-thumbnails'
export const INSPECTION_THUMBNAIL_MAX_FILES = 96
export const INSPECTION_THUMBNAIL_MAX_BYTES = 24 * 1024 * 1024

type ThumbnailFileEntry = {
  uri: string
  size: number
  modificationTime: number
}

type ImageManipulatorModule = {
  manipulateAsync?: (
    uri: string,
    actions: { resize: { width: number } }[],
    saveOptions: { compress: number; format: string },
  ) => Promise<{ uri?: string | null }>
  SaveFormat?: { JPEG?: string }
}

function cleanText(value: any) {
  return String(value || '').trim()
}

function cacheDirectory() {
  const dir = new Directory(Paths.document, CACHE_DIR_NAME)
  dir.create({ intermediates: true, idempotent: true })
  return dir
}

function safeFileName(value: string) {
  return cleanText(value).replace(/[^a-z0-9_-]+/gi, '-').slice(0, 80) || 'inspection'
}

export async function createInspectionThumbnail(localUri: string, mediaId: string) {
  const sourceUri = cleanText(localUri)
  if (!sourceUri) return null
  try {
    const source = new File(sourceUri)
    if (!source.exists) return null
    const mod = (await import('expo-image-manipulator')) as ImageManipulatorModule
    if (typeof mod.manipulateAsync !== 'function') return null
    const result = await mod.manipulateAsync(
      sourceUri,
      [{ resize: { width: 480 } }],
      { compress: 0.55, format: mod.SaveFormat?.JPEG || 'jpeg' },
    )
    const generatedUri = cleanText(result?.uri)
    if (!generatedUri) return null
    const generated = new File(generatedUri)
    if (!generated.exists) return null
    const target = new File(
      cacheDirectory(),
      `${safeFileName(mediaId)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`,
    )
    generated.copy(target)
    if (!target.exists) return null
    if (generatedUri !== sourceUri) {
      try {
        generated.delete()
      } catch {}
    }
    return target.uri
  } catch {
    return null
  }
}

export function inspectionThumbnailExists(uri: string) {
  const value = cleanText(uri)
  if (!value) return false
  try {
    return new File(value).exists
  } catch {
    return false
  }
}

export function selectInspectionThumbnailFilesToDelete(
  entries: ThumbnailFileEntry[],
  protectedUris: Set<string>,
  maxFiles = INSPECTION_THUMBNAIL_MAX_FILES,
  maxBytes = INSPECTION_THUMBNAIL_MAX_BYTES,
) {
  let remainingFiles = entries.length
  let remainingBytes = entries.reduce((sum, entry) => sum + Math.max(0, entry.size), 0)
  const selected: string[] = []
  const oldestFirst = [...entries].sort((a, b) => a.modificationTime - b.modificationTime)
  for (const entry of oldestFirst) {
    if (remainingFiles <= maxFiles && remainingBytes <= maxBytes) break
    if (protectedUris.has(entry.uri)) continue
    selected.push(entry.uri)
    remainingFiles -= 1
    remainingBytes -= Math.max(0, entry.size)
  }
  return selected
}

export function pruneInspectionThumbnailCache(protectedUris: string[] = []) {
  try {
    const dir = cacheDirectory()
    const entries = dir.list()
      .filter((entry): entry is File => entry instanceof File && entry.exists)
      .map((file) => ({
        uri: file.uri,
        size: Number(file.size || 0),
        modificationTime: Number(file.modificationTime || 0),
      }))
    const protectedSet = new Set(protectedUris.map(cleanText).filter(Boolean))
    for (const uri of selectInspectionThumbnailFilesToDelete(entries, protectedSet)) {
      try {
        const file = new File(uri)
        if (file.exists) file.delete()
      } catch {}
    }
  } catch {}
}
