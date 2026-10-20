import {
  clearTaskLoadDiagnostics,
  formatTaskLoadDiagnosticsText,
  getTaskLoadDiagnosticsSnapshot,
  recordTaskLoadStage,
} from './taskLoadDiagnostics'

jest.mock('expo-updates', () => ({ updateId: 'test-update-id' }))

beforeEach(() => {
  clearTaskLoadDiagnostics()
})

test('keeps only bounded in-memory stage metadata without identity or task payloads', () => {
  recordTaskLoadStage('task fetch/body', {
    elapsedMs: 12.4,
    status: 200,
    errorClass: 'network',
  })
  const [entry] = getTaskLoadDiagnosticsSnapshot()

  expect(entry).toMatchObject({
    updateId: 'test-update-id',
    stage: 'task_fetch_body',
    elapsedMs: 12,
    status: 200,
    errorClass: 'network',
  })
  expect(Object.keys(entry || {}).sort()).toEqual([
    'at',
    'elapsedMs',
    'errorClass',
    'stage',
    'status',
    'updateId',
  ])
  expect(JSON.stringify(entry)).not.toMatch(/token|user|task_id|property|address/i)
})

test('returns defensive copies and retains only the latest 80 entries', () => {
  for (let index = 0; index < 85; index += 1) recordTaskLoadStage(`stage.${index}`)
  const snapshot = getTaskLoadDiagnosticsSnapshot()
  expect(snapshot).toHaveLength(80)
  expect(snapshot[0]?.stage).toBe('stage.5')
  snapshot[0]!.stage = 'mutated'
  expect(getTaskLoadDiagnosticsSnapshot()[0]?.stage).toBe('stage.5')
})

test('formats a user-readable privacy-safe report for copying from the task screen', () => {
  recordTaskLoadStage('task_fetch.body_timeout', { elapsedMs: 15001, status: 200, errorClass: 'timeout' })

  const report = formatTaskLoadDiagnosticsText()

  expect(report).toContain('MZStay 任务加载诊断')
  expect(report).toContain('记录数：1/80')
  expect(report).toContain('update=test-update-id')
  expect(report).toContain('stage=task_fetch.body_timeout')
  expect(report).toContain('elapsed_ms=15001')
  expect(report).not.toMatch(/token|user|task_id|property|address/i)
})
