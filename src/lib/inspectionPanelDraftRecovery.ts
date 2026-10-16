import { Directory, File, Paths } from 'expo-file-system'

const RECOVERY_DIR_NAME = 'mzstay-inspection-panel-draft-recovery'
const RECOVERY_VERSION = 1

export type InspectionPanelDraftRecoveryEnvelope<T = any> = {
  version: number
  task_id: string
  saved_at: string
  draft: T
}

function cleanText(value: unknown) {
  return String(value || '').trim()
}

function stableHash(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function recoveryFilePrefix(taskId: string) {
  const key = cleanText(taskId)
  const safe = key.replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 64) || 'task'
  return `${safe}-${stableHash(key)}`
}

function ensureRecoveryDir() {
  const dir = new Directory(Paths.document, RECOVERY_DIR_NAME)
  dir.create({ intermediates: true, idempotent: true })
  return dir
}

function recoveryFiles(dir: Directory, taskId: string) {
  const prefix = `${recoveryFilePrefix(taskId)}-`
  return dir.list().filter((entry): entry is File => entry instanceof File
    && entry.exists
    && entry.uri.split('/').pop()?.startsWith(prefix) === true
    && (entry.uri.endsWith('.json') || entry.uri.endsWith('.tmp')))
}

function parseRecoveryEnvelope(raw: string, expectedTaskId?: string): InspectionPanelDraftRecoveryEnvelope {
  let parsed: any = null
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('INSPECTION_DRAFT_RECOVERY_CORRUPT')
  }
  const taskId = cleanText(parsed?.task_id)
  if (parsed?.version !== RECOVERY_VERSION || !taskId || !parsed?.draft || typeof parsed.draft !== 'object') {
    throw new Error('INSPECTION_DRAFT_RECOVERY_CORRUPT')
  }
  if (expectedTaskId && taskId !== cleanText(expectedTaskId)) throw new Error('INSPECTION_DRAFT_RECOVERY_TASK_MISMATCH')
  return {
    version: RECOVERY_VERSION,
    task_id: taskId,
    saved_at: cleanText(parsed.saved_at),
    draft: parsed.draft,
  }
}

export async function writeInspectionPanelDraftRecovery<T>(taskId: string, draft: T) {
  const key = cleanText(taskId)
  if (!key) throw new Error('INSPECTION_DRAFT_RECOVERY_TASK_MISSING')
  const dir = ensureRecoveryDir()
  const previous = recoveryFiles(dir, key)
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const target = new File(dir, `${recoveryFilePrefix(key)}-${unique}.json`)
  const temporary = new File(dir, `${recoveryFilePrefix(key)}-${unique}.tmp`)
  const envelope: InspectionPanelDraftRecoveryEnvelope<T> = {
    version: RECOVERY_VERSION,
    task_id: key,
    saved_at: new Date().toISOString(),
    draft,
  }
  temporary.write(JSON.stringify(envelope))
  temporary.move(target)
  if (!target.exists) throw new Error('INSPECTION_DRAFT_RECOVERY_WRITE_FAILED')
  for (const entry of previous) {
    try {
      if (entry.exists) entry.delete()
    } catch {}
  }
  return target.uri
}

export async function readInspectionPanelDraftRecovery<T>(taskId: string): Promise<InspectionPanelDraftRecoveryEnvelope<T> | null> {
  const key = cleanText(taskId)
  if (!key) return null
  const files = recoveryFiles(ensureRecoveryDir(), key)
  if (!files.length) return null
  const snapshots: InspectionPanelDraftRecoveryEnvelope<T>[] = []
  let firstReadError: unknown = null
  for (const file of files) {
    try {
      snapshots.push(parseRecoveryEnvelope(await file.text(), key) as InspectionPanelDraftRecoveryEnvelope<T>)
    } catch (error) {
      firstReadError ||= error
    }
  }
  if (!snapshots.length && firstReadError) throw firstReadError
  return snapshots.sort((left, right) => new Date(right.saved_at).getTime() - new Date(left.saved_at).getTime())[0] || null
}

export async function clearInspectionPanelDraftRecovery(taskId: string) {
  const key = cleanText(taskId)
  if (!key) return
  for (const file of recoveryFiles(ensureRecoveryDir(), key)) {
    if (file.exists) file.delete()
  }
}

export async function listInspectionPanelDraftRecoverySnapshots() {
  const dir = ensureRecoveryDir()
  const snapshots: InspectionPanelDraftRecoveryEnvelope[] = []
  for (const entry of dir.list()) {
    if (!(entry instanceof File) || !entry.exists || (!entry.uri.endsWith('.json') && !entry.uri.endsWith('.tmp'))) continue
    snapshots.push(parseRecoveryEnvelope(await entry.text()))
  }
  return snapshots
}
