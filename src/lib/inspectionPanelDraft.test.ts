/* eslint-disable import/first */
const mockGetJson = jest.fn()
const mockSetJson = jest.fn()
const mockRemove = jest.fn()
const mockReadRecovery = jest.fn()
const mockWriteRecovery = jest.fn()
const mockClearRecovery = jest.fn()

jest.mock('./storage', () => ({
  getJson: (...args: any[]) => mockGetJson(...args),
  setJson: (...args: any[]) => mockSetJson(...args),
  remove: (...args: any[]) => mockRemove(...args),
}))
jest.mock('./inspectionPanelDraftRecovery', () => ({
  readInspectionPanelDraftRecovery: (...args: any[]) => mockReadRecovery(...args),
  writeInspectionPanelDraftRecovery: (...args: any[]) => mockWriteRecovery(...args),
  clearInspectionPanelDraftRecovery: (...args: any[]) => mockClearRecovery(...args),
}))
jest.mock('./cleaningMedia', () => ({ normalizeCleaningObjectKey: (value: any) => String(value || '').trim() }))

import { getInspectionPanelDraft, setInspectionPanelDraft } from './inspectionPanelDraft'

function draft(updatedAt = '2026-10-15T00:00:00.000Z', localUri = 'file:///documents/photo.jpg') {
  return {
    task_id: 'task-1',
    updated_at: updatedAt,
    property_code: 'A1',
    room_photo_requirement: 'required',
    restock: [],
    restock_confirmed_sufficient: false,
    room_photos: {
      living: [{ id: 'photo-1', local_uri: localUri, uploaded_url: null, name: 'photo.jpg', mime_type: 'image/jpeg', captured_at: updatedAt }],
      sofa: [], bedroom: [], kitchen: [], bathroom: [], balcony: [],
    },
    cleaning_issue: [],
  } as any
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetJson.mockResolvedValue(null)
  mockSetJson.mockResolvedValue(undefined)
  mockRemove.mockResolvedValue(undefined)
  mockReadRecovery.mockResolvedValue(null)
  mockWriteRecovery.mockResolvedValue('file:///documents/recovery/task-1.json')
  mockClearRecovery.mockResolvedValue(undefined)
})

test('writes a recovery snapshot and reports protected recovery when AsyncStorage remains full', async () => {
  const storageError = new Error('database or disk is full (code 13 SQLITE_FULL)')
  mockSetJson.mockRejectedValue(storageError)

  await expect(setInspectionPanelDraft('task-1', draft() as any)).rejects.toMatchObject({
    code: 'INSPECTION_DRAFT_RECOVERED',
  })
  expect(mockWriteRecovery).toHaveBeenCalledWith('task-1', expect.objectContaining({
    task_id: 'task-1',
    room_photos: expect.objectContaining({ living: [expect.objectContaining({ local_uri: 'file:///documents/photo.jpg' })] }),
  }))
  expect(mockClearRecovery).not.toHaveBeenCalled()
})

test('loads a newer recovery snapshot and clears it only after a later database write succeeds', async () => {
  mockGetJson.mockResolvedValue(draft('2026-10-15T00:00:00.000Z', 'file:///documents/older.jpg'))
  mockReadRecovery.mockResolvedValue({
    version: 1,
    task_id: 'task-1',
    saved_at: '2026-10-15T01:00:00.000Z',
    draft: draft('2026-10-15T01:00:00.000Z', 'file:///documents/recovered.jpg'),
  })

  const recovered = await getInspectionPanelDraft('task-1')
  expect(recovered?.room_photos.living[0]?.local_uri).toBe('file:///documents/recovered.jpg')

  await setInspectionPanelDraft('task-1', recovered as any)
  expect(mockClearRecovery).toHaveBeenCalledWith('task-1')
})

test('keeps the original persistence error visible when both database and recovery storage fail', async () => {
  mockSetJson.mockRejectedValue(new Error('SQLITE_FULL'))
  mockWriteRecovery.mockRejectedValue(new Error('disk full'))

  await expect(setInspectionPanelDraft('task-1', draft() as any)).rejects.toMatchObject({
    code: 'INSPECTION_DRAFT_RECOVERY_FAILED',
  })
})
