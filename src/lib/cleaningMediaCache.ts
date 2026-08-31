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

type CleaningMediaCacheSession = {
  accountId: string
  accessFingerprint: string
  epoch: number
}

type CleaningMediaReadResult = {
  uri: string | null
  failure: CleaningMediaReadFailure | null
}

const CACHE_ROOT_DIRECTORY = 'mzstay-cleaning-media'
const CACHE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000
const CACHE_MAX_BYTES = 300 * 1024 * 1024
const CACHE_TARGET_BYTES = 250 * 1024 * 1024
const PARTIAL_MAX_AGE_MS = 60 * 60 * 1000

let activeSession: CleaningMediaCacheSession | null = null
let cacheEpoch = 0
const cacheListeners = new Set<() => void>()
const inFlightReads = new Map<string, Promise<CleaningMediaReadResult>>()

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

function sourceCacheKey(uri: string) {
  // The proxy URI already carries the exact key/url, variant and read context.
  // Bearer tokens authenticate a download but must not fragment the file cache.
  return cleanText(uri)
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

function notifyCacheChanged() {
  cacheEpoch += 1
  for (const listener of cacheListeners) listener()
}

function accessFingerprint(input: { role?: string | null; roles?: string[] | null; permissions?: string[] | null }) {
  const roles = Array.from(new Set([
    cleanText(input.role),
    ...(Array.isArray(input.roles) ? input.roles.map(cleanText) : []),
  ].filter(Boolean))).sort()
  const permissions = Array.from(new Set((Array.isArray(input.permissions) ? input.permissions.map(cleanText) : []).filter(Boolean))).sort()
  return `${roles.join(',')}\n${permissions.join(',')}`
}

function cacheRootDirectory() {
  const directory = new Directory(Paths.cache, CACHE_ROOT_DIRECTORY)
  directory.create({ intermediates: true, idempotent: true })
  return directory
}

function accountDirectory(session: CleaningMediaCacheSession) {
  const account = new Directory(cacheRootDirectory(), hashSource(session.accountId))
  const directory = new Directory(account, hashSource(session.accessFingerprint))
  directory.create({ intermediates: true, idempotent: true })
  return directory
}

function accountRootDirectory(accountId: string) {
  return new Directory(cacheRootDirectory(), hashSource(accountId))
}

function activeSessionMatches(session: CleaningMediaCacheSession) {
  return activeSession?.epoch === session.epoch
    && activeSession.accountId === session.accountId
    && activeSession.accessFingerprint === session.accessFingerprint
}

function fileInfo(file: any) {
  try {
    const info = file?.info?.() || {}
    return {
      size: Number(info?.size || 0),
      modificationTime: Number(info?.modificationTime || 0),
    }
  } catch {
    return { size: 0, modificationTime: 0 }
  }
}

function isCompleteFile(file: any) {
  try {
    return Boolean(file?.exists) && fileInfo(file).size > 0
  } catch {
    return false
  }
}

function safeDelete(file: any) {
  try {
    if (file?.exists) file.delete()
  } catch {}
}

function currentReadKey(source: CleaningMediaSource, session: CleaningMediaCacheSession) {
  return `${session.epoch}:${hashSource(session.accountId)}:${hashSource(session.accessFingerprint)}:${hashSource(sourceCacheKey(cleanText(source?.uri)))}`
}

function fileForSource(source: CleaningMediaSource, session: CleaningMediaCacheSession) {
  return new File(accountDirectory(session), `${hashSource(sourceCacheKey(cleanText(source?.uri)))}.jpg`)
}

export function getCleaningMediaCacheEpoch() {
  return cacheEpoch
}

export function subscribeCleaningMediaCache(listener: () => void) {
  cacheListeners.add(listener)
  return () => {
    cacheListeners.delete(listener)
  }
}

/** Establishes the locally cached private-media scope without using a token as identity. */
export async function establishCleaningMediaCacheSession(input: {
  userId: string
  role?: string | null
  roles?: string[] | null
  permissions?: string[] | null
}) {
  const accountId = cleanText(input.userId)
  if (!accountId) {
    await clearCleaningMediaCache()
    return
  }
  const nextFingerprint = accessFingerprint(input)
  const previous = activeSession
  const changed = !previous
    || previous.accountId !== accountId
    || previous.accessFingerprint !== nextFingerprint

  if (!changed) return
  if (previous) safeDelete(accountRootDirectory(previous.accountId))
  activeSession = { accountId, accessFingerprint: nextFingerprint, epoch: cacheEpoch + 1 }
  inFlightReads.clear()
  notifyCacheChanged()
}

/** Removes all files readable by the current account, including any stale partial download. */
export async function clearCleaningMediaCache() {
  const previous = activeSession
  activeSession = null
  inFlightReads.clear()
  if (previous) safeDelete(accountRootDirectory(previous.accountId))
  // A force-quit erases module state. On the next signed-out bootstrap we no
  // longer know the previous account, so delete the private cache root rather
  // than leaving any account's bytes behind.
  else safeDelete(cacheRootDirectory())
  notifyCacheChanged()
}

/** Use when task membership/visibility is revoked or an SSE resync makes media visibility uncertain. */
export async function invalidateCleaningMediaCache() {
  const session = activeSession
  if (!session) return
  activeSession = { ...session, epoch: cacheEpoch + 1 }
  inFlightReads.clear()
  safeDelete(accountRootDirectory(session.accountId))
  notifyCacheChanged()
}

/** Removes one unreadable cached file without treating a local rendering failure as a permission change. */
export async function removeCleaningMediaCachedImage(source: CleaningMediaSource) {
  const session = activeSession
  if (!session || !isHttpUri(cleanText(source?.uri))) return
  safeDelete(fileForSource(source, session))
}

async function loadCurrentSessionImage(source: CleaningMediaSource, session: CleaningMediaCacheSession): Promise<CleaningMediaReadResult> {
  const uri = cleanText(source?.uri)
  const target = fileForSource(source, session)
  const partial = new File(accountDirectory(session), `${hashSource(sourceCacheKey(uri))}.${session.epoch}.${Date.now()}.partial`)
  if (isCompleteFile(target)) return { uri: target.uri, failure: null }
  safeDelete(target)
  safeDelete(partial)
  try {
    const downloaded = await File.downloadFileAsync(uri, partial, {
      headers: source.headers,
      idempotent: false,
    })
    if (!activeSessionMatches(session)) {
      safeDelete(partial)
      return { uri: null, failure: null }
    }
    if (!isCompleteFile(downloaded) || !isCompleteFile(partial)) {
      safeDelete(partial)
      return { uri: null, failure: { status: null, message: '照片下载不完整，请点击重试', retryable: true } }
    }
    safeDelete(target)
    partial.move(target)
    if (!isCompleteFile(target)) {
      safeDelete(partial)
      return { uri: null, failure: { status: null, message: '照片下载不完整，请点击重试', retryable: true } }
    }
    return { uri: target.uri, failure: null }
  } catch (error) {
    safeDelete(partial)
    const failure = classifyCleaningMediaReadFailure(error)
    if (!failure.retryable) safeDelete(target)
    return { uri: null, failure }
  }
}

/** Download an authenticated image once so native Image receives only a local file URI. */
export async function loadCleaningMediaImage(source: CleaningMediaSource): Promise<CleaningMediaReadResult> {
  const uri = cleanText(source?.uri)
  if (!isHttpUri(uri)) return { uri: null, failure: null }
  const session = activeSession
  if (!session) return { uri: null, failure: { status: null, message: '登录状态正在恢复，请稍后重试', retryable: true } }
  const readKey = currentReadKey(source, session)
  const existing = inFlightReads.get(readKey)
  if (existing) return existing
  const pending = loadCurrentSessionImage(source, session)
  inFlightReads.set(readKey, pending)
  try {
    return await pending
  } finally {
    if (inFlightReads.get(readKey) === pending) inFlightReads.delete(readKey)
  }
}

export async function cacheCleaningMediaImage(source: CleaningMediaSource) {
  return (await loadCleaningMediaImage(source)).uri
}

/** Background-only retention cleanup; never call from a render path. */
export async function runCleaningMediaCacheMaintenance(now = Date.now()) {
  const session = activeSession
  if (!session) return { scanned: 0, deleted: 0, bytes: 0 }
  let entries: any[] = []
  try {
    entries = accountDirectory(session).list().filter((entry: any) => entry instanceof File)
  } catch {
    return { scanned: 0, deleted: 0, bytes: 0 }
  }
  const metadata = entries.map((file) => ({ file, ...fileInfo(file) }))
  let deleted = 0
  for (const entry of metadata) {
    const age = now - entry.modificationTime
    const partial = entry.file.uri.endsWith('.partial')
    if ((partial && age >= PARTIAL_MAX_AGE_MS) || (!partial && age >= CACHE_MAX_AGE_MS)) {
      safeDelete(entry.file)
      deleted += 1
    }
  }
  const retained = metadata
    .filter((entry) => entry.file.exists && !entry.file.uri.endsWith('.partial'))
    .sort((a, b) => a.modificationTime - b.modificationTime)
  let bytes = retained.reduce((sum, entry) => sum + Math.max(0, entry.size), 0)
  if (bytes > CACHE_MAX_BYTES) {
    for (const entry of retained) {
      if (bytes <= CACHE_TARGET_BYTES) break
      safeDelete(entry.file)
      bytes -= Math.max(0, entry.size)
      deleted += 1
    }
  }
  return { scanned: metadata.length, deleted, bytes: Math.max(0, bytes) }
}
