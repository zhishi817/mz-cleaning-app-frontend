const mockRecords = new Map<string, any>()

jest.mock('./storage', () => ({
  getJson: jest.fn(async (key: string) => mockRecords.get(key) ?? null),
  remove: jest.fn(async (key: string) => { mockRecords.delete(key) }),
  setJson: jest.fn(async (key: string, value: any) => { mockRecords.set(key, value) }),
}))

beforeEach(() => {
  mockRecords.clear()
})

test('persists task-and-owner-scoped remote references before a completion-record retry', async () => {
  const pending = require('./workTaskCompletionPhotoPending')

  const saved = await pending.setPendingWorkTaskCompletionPhotoReferences('work-1', 'user-1', [
    ' mzapp/one.jpg ',
    'mzapp/one.jpg',
    'r2://bucket/mzapp/two.jpg',
  ])

  expect(saved).toEqual(['mzapp/one.jpg', 'r2://bucket/mzapp/two.jpg'])
  await expect(pending.getPendingWorkTaskCompletionPhotoReferences('work-1', 'user-1')).resolves.toEqual(saved)
  await expect(pending.getPendingWorkTaskCompletionPhotoReferences('work-1', 'user-2')).resolves.toEqual([])
})

test('clears the pending remote references only after the completion record is confirmed', async () => {
  const pending = require('./workTaskCompletionPhotoPending')
  await pending.setPendingWorkTaskCompletionPhotoReferences('work-1', 'user-1', ['mzapp/one.jpg'])

  await pending.clearPendingWorkTaskCompletionPhotoReferences('work-1', 'user-1')

  await expect(pending.getPendingWorkTaskCompletionPhotoReferences('work-1', 'user-1')).resolves.toEqual([])
})
