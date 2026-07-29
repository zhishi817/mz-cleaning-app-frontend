import { Directory, File, Paths } from 'expo-file-system'

type CleaningMediaSource = {
  uri?: string
  headers?: Record<string, string>
}

function cleanText(value: any) {
  return String(value || '').trim()
}

function isHttpUri(value: string) {
  return /^https?:\/\//i.test(value)
}

function hashSource(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function cacheDirectory() {
  const directory = new Directory(Paths.cache, 'mzstay-cleaning-media')
  directory.create({ intermediates: true, idempotent: true })
  return directory
}

/** Download an authenticated image so Android renders a private file URI. */
export async function cacheCleaningMediaImage(source: CleaningMediaSource) {
  const uri = cleanText(source?.uri)
  if (!isHttpUri(uri)) return null
  try {
    const target = new File(cacheDirectory(), `${hashSource(uri)}.jpg`)
    const downloaded = await File.downloadFileAsync(uri, target, {
      headers: source.headers,
      idempotent: true,
    })
    return downloaded?.exists ? downloaded.uri : null
  } catch {
    try {
      const target = new File(cacheDirectory(), `${hashSource(uri)}.jpg`)
      return target.exists ? target.uri : null
    } catch {
      return null
    }
  }
}
