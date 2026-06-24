import { Directory, File, Paths } from 'expo-file-system'

function cleanText(value: any) {
  return String(value || '').trim()
}

function extFromText(value: string) {
  return cleanText(value).match(/\.([a-z0-9]+)(?:[?#].*)?$/i)?.[0]?.toLowerCase() || ''
}

export function draftFileExists(uri: string) {
  const localUri = cleanText(uri)
  if (!localUri) return false
  try {
    return new File(localUri).exists
  } catch {
    return false
  }
}

export function draftFileExtFrom(name: string, mimeType: string, sourceUri?: string) {
  const ext = extFromText(name) || extFromText(sourceUri || '')
  if (ext) return ext
  const mime = cleanText(mimeType).toLowerCase()
  if (mime === 'image/heic') return '.heic'
  if (mime === 'image/heif') return '.heif'
  if (mime === 'image/jpeg') return '.jpg'
  if (mime === 'image/png') return '.png'
  if (mime === 'image/webp') return '.webp'
  if (mime === 'video/mp4') return '.mp4'
  if (mime === 'video/quicktime') return '.mov'
  return ''
}

export function draftMimeTypeFrom(name: string, mimeType: string, sourceUri?: string) {
  const explicitMime = cleanText(mimeType).toLowerCase()
  if (explicitMime && explicitMime !== 'application/octet-stream') return explicitMime
  const ext = draftFileExtFrom(name, mimeType, sourceUri)
  if (ext === '.heic') return 'image/heic'
  if (ext === '.heif') return 'image/heif'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.png') return 'image/png'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.mp4') return 'video/mp4'
  if (ext === '.mov') return 'video/quicktime'
  return explicitMime || 'application/octet-stream'
}

export function ensureDraftMediaDir(dirName: string) {
  const dir = new Directory(Paths.document, cleanText(dirName) || 'mzstay-drafts')
  dir.create({ intermediates: true, idempotent: true })
  return dir
}

export function persistDraftMedia(params: {
  dirName: string
  prefix: string
  sourceUri: string
  name: string
  mimeType: string
}) {
  const sourceUri = cleanText(params.sourceUri)
  if (!draftFileExists(sourceUri)) throw new Error('原始文件不存在，请重新拍摄')
  const dir = ensureDraftMediaDir(params.dirName)
  const ext = draftFileExtFrom(params.name, params.mimeType, sourceUri)
  const target = new File(
    dir,
    `${cleanText(params.prefix) || 'media'}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`,
  )
  new File(sourceUri).copy(target)
  if (!target.exists) throw new Error('本地文件保存失败，请重新拍摄')
  return target.uri
}

export function deleteDraftMedia(uri: string) {
  const localUri = cleanText(uri)
  if (!localUri || !localUri.startsWith('file://')) return
  try {
    const file = new File(localUri)
    if (file.exists) file.delete()
  } catch {}
}
