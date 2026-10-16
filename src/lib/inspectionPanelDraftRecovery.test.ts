/* eslint-disable import/first */
const mockRecoveryFiles = new Map<string, string>()

jest.mock('expo-file-system', () => {
  class Directory {
    uri: string
    exists = true

    constructor(...parts: any[]) {
      this.uri = parts.map((part) => String(part?.uri || part || '').replace(/^\/+|\/+$/g, '')).filter(Boolean).join('/')
      if (!this.uri.startsWith('file://')) this.uri = `file:///${this.uri}`
    }

    create() {}

    list() {
      const prefix = `${this.uri.replace(/\/+$/g, '')}/`
      return Array.from(mockRecoveryFiles.keys()).filter((uri) => uri.startsWith(prefix)).map((uri) => new File(uri))
    }
  }

  class File {
    uri: string

    constructor(...parts: any[]) {
      this.uri = parts.map((part) => String(part?.uri || part || '').replace(/^\/+|\/+$/g, '')).filter(Boolean).join('/')
      if (!this.uri.startsWith('file://')) this.uri = `file:///${this.uri}`
    }

    get exists() {
      return mockRecoveryFiles.has(this.uri)
    }

    write(content: string) {
      mockRecoveryFiles.set(this.uri, String(content))
    }

    async text() {
      return mockRecoveryFiles.get(this.uri) || ''
    }

    delete() {
      mockRecoveryFiles.delete(this.uri)
    }

    move(target: { uri: string }) {
      const value = mockRecoveryFiles.get(this.uri)
      if (value == null) throw new Error('missing temporary file')
      mockRecoveryFiles.set(String(target.uri), value)
      mockRecoveryFiles.delete(this.uri)
    }
  }

  return { Directory, File, Paths: { document: 'file:///documents' } }
})

import {
  clearInspectionPanelDraftRecovery,
  listInspectionPanelDraftRecoverySnapshots,
  readInspectionPanelDraftRecovery,
  writeInspectionPanelDraftRecovery,
} from './inspectionPanelDraftRecovery'

beforeEach(() => {
  mockRecoveryFiles.clear()
})

test('writes, reads, lists and clears a task-scoped recovery snapshot', async () => {
  await writeInspectionPanelDraftRecovery('task/one', { updated_at: '2026-10-15T00:00:00.000Z', room_photos: { living: [] } })

  const recovered = await readInspectionPanelDraftRecovery<any>('task/one')
  expect(recovered).toMatchObject({
    version: 1,
    task_id: 'task/one',
    draft: { updated_at: '2026-10-15T00:00:00.000Z' },
  })
  expect(await listInspectionPanelDraftRecoverySnapshots()).toHaveLength(1)

  await clearInspectionPanelDraftRecovery('task/one')
  expect(await readInspectionPanelDraftRecovery('task/one')).toBeNull()
})

test('fails closed when a recovery snapshot is malformed', async () => {
  await writeInspectionPanelDraftRecovery('task-bad', { updated_at: '2026-10-15T00:00:00.000Z' })
  const [uri] = Array.from(mockRecoveryFiles.keys()).filter((key) => key.endsWith('.json'))
  mockRecoveryFiles.set(uri, '{not-json')

  await expect(readInspectionPanelDraftRecovery('task-bad')).rejects.toThrow('INSPECTION_DRAFT_RECOVERY_CORRUPT')
  await expect(listInspectionPanelDraftRecoverySnapshots()).rejects.toThrow('INSPECTION_DRAFT_RECOVERY_CORRUPT')
})

test('can recover a complete temporary snapshot left before its final rename', async () => {
  await writeInspectionPanelDraftRecovery('task-interrupted', { updated_at: '2026-10-15T00:00:00.000Z', marker: 'older' })
  const [jsonUri] = Array.from(mockRecoveryFiles.keys()).filter((key) => key.endsWith('.json'))
  const tempUri = jsonUri.replace(/\.json$/, '-interrupted.tmp')
  mockRecoveryFiles.set(tempUri, JSON.stringify({
    version: 1,
    task_id: 'task-interrupted',
    saved_at: '2099-10-15T02:00:00.000Z',
    draft: { updated_at: '2099-10-15T02:00:00.000Z', marker: 'newer-temp' },
  }))

  await expect(readInspectionPanelDraftRecovery<any>('task-interrupted')).resolves.toMatchObject({
    draft: { marker: 'newer-temp' },
  })
})

test('ignores a truncated temporary snapshot when a valid task snapshot remains', async () => {
  await writeInspectionPanelDraftRecovery('task-interrupted', { updated_at: '2026-10-15T00:00:00.000Z', marker: 'valid-json' })
  const [jsonUri] = Array.from(mockRecoveryFiles.keys()).filter((key) => key.endsWith('.json'))
  mockRecoveryFiles.set(jsonUri.replace(/\.json$/, '-interrupted.tmp'), '{"version":1')

  await expect(readInspectionPanelDraftRecovery<any>('task-interrupted')).resolves.toMatchObject({
    draft: { marker: 'valid-json' },
  })
  await expect(listInspectionPanelDraftRecoverySnapshots()).rejects.toThrow('INSPECTION_DRAFT_RECOVERY_CORRUPT')
})
