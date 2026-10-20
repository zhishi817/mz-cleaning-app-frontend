import * as Updates from 'expo-updates'

export type TaskLoadErrorClass = 'auth' | 'http' | 'network' | 'parse' | 'stale' | 'storage' | 'timeout' | 'unknown'

export type TaskLoadDiagnostic = {
  at: string
  updateId: string | null
  stage: string
  elapsedMs: number | null
  status: number | null
  errorClass: TaskLoadErrorClass | null
}

const MAX_ENTRIES = 80
const entries: TaskLoadDiagnostic[] = []

function finiteNonNegative(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : null
}

function safeStatus(value: unknown) {
  const status = Number(value)
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : null
}

export function recordTaskLoadStage(
  stage0: string,
  details?: { elapsedMs?: number | null; status?: number | null; errorClass?: TaskLoadErrorClass | null },
) {
  const stage = String(stage0 || '').replace(/[^a-z0-9_.:-]/gi, '_').slice(0, 64) || 'unknown'
  entries.push({
    at: new Date().toISOString(),
    updateId: String(Updates.updateId || '').trim() || null,
    stage,
    elapsedMs: finiteNonNegative(details?.elapsedMs),
    status: safeStatus(details?.status),
    errorClass: details?.errorClass || null,
  })
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES)
}

export function getTaskLoadDiagnosticsSnapshot() {
  return entries.map((entry) => ({ ...entry }))
}

export function formatTaskLoadDiagnosticsText(snapshot: TaskLoadDiagnostic[] = getTaskLoadDiagnosticsSnapshot()) {
  const safeEntries = snapshot.slice(-MAX_ENTRIES)
  const lines = [
    'MZStay 任务加载诊断',
    '仅包含时间、版本、阶段、耗时、HTTP 状态和错误类别；不包含账号、房源或任务内容。',
    `记录数：${safeEntries.length}/${MAX_ENTRIES}`,
  ]
  if (!safeEntries.length) return [...lines, '暂无加载诊断记录。'].join('\n')
  return [
    ...lines,
    ...safeEntries.map((entry) => [
      entry.at,
      `update=${entry.updateId || '-'}`,
      `stage=${entry.stage}`,
      `elapsed_ms=${entry.elapsedMs ?? '-'}`,
      `status=${entry.status ?? '-'}`,
      `error=${entry.errorClass || '-'}`,
    ].join(' | ')),
  ].join('\n')
}

export function clearTaskLoadDiagnostics() {
  entries.splice(0, entries.length)
}
