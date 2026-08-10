import { Directory, File, Paths } from 'expo-file-system'

type CleaningMediaSource = {
  uri?: string
  headers?: Record<string, string>
}

export type CleaningMediaReadFailure = {
  status: number | null
  message: string
  retryable: boolean
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

function sourceCacheKey(source: CleaningMediaSource) {
  return `${cleanText(source?.uri)}\n${cleanText(source?.headers?.Authorization)}`
}

function responseStatus(error: any) {
  const candidates = [error?.status, error?.statusCode, error?.response?.status]
  for (const candidate of candidates) {
    const status = Number(candidate)
    if (Number.isInteger(status) && status >= 100 && status <= 599) return status
  }
  const match = /\b(?:http|status(?:\s*code)?)\s*[:=]?\s*([1-5]\d\d)\b/i.exec(String(error?.message || error || ''))
  return match ? Number(match[1]) : null
}

export function classifyCleaningMediaReadFailure(error: unknown): CleaningMediaReadFailure {
  const status = responseStatus(error as any)
  if (status === 401) return { status, message: '登录已失效，请重新登录后查看', retryable: false }
  if (status === 403) return { status, message: '无查看这张照片的权限', retryable: false }
  if (status === 404) return { status, message: '照片已不可用（文件不存在）', retryable: false }
  if (status === 400) return { status, message: '照片请求无效', retryable: false }
  return { status, message: '网络或服务暂不可用，请稍后重试', retryable: true }
}

function cacheDirectory() {
  const directory = new Directory(Paths.cache, 'mzstay-cleaning-media')
  directory.create({ intermediates: true, idempotent: true })
  return directory
}

/** Download an authenticated image so Android renders a private file URI. */
export async function loadCleaningMediaImage(source: CleaningMediaSource): Promise<{ uri: string | null; failure: CleaningMediaReadFailure | null }> {
  const uri = cleanText(source?.uri)
  if (!isHttpUri(uri)) return { uri: null, failure: null }
  let target: any = null
  try {
    target = new File(cacheDirectory(), `${hashSource(sourceCacheKey(source))}.jpg`)
    const downloaded = await File.downloadFileAsync(uri, target, {
      headers: source.headers,
      idempotent: true,
    })
    return downloaded?.exists ? { uri: downloaded.uri, failure: null } : { uri: null, failure: null }
  } catch (error) {
    const failure = classifyCleaningMediaReadFailure(error)
    if (!failure.retryable) {
      try { target?.delete() } catch {}
      return { uri: null, failure }
    }
    try {
      return target?.exists ? { uri: target.uri, failure: null } : { uri: null, failure }
    } catch {
      return { uri: null, failure }
    }
  }
}

export async function cacheCleaningMediaImage(source: CleaningMediaSource) {
  return (await loadCleaningMediaImage(source)).uri
}
