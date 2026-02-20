import AsyncStorage from '@react-native-async-storage/async-storage'

test('tasks store uploads key photo and sets status to cleaning', async () => {
  jest.resetModules()
  await (AsyncStorage as any).clear()
  const mod = require('./tasksStore') as typeof import('./tasksStore')

  await mod.initTasksStore()
  const first = mod.getTasksSnapshot().items[0]!
  expect(first.status).toBe('pending_key_photo')
  expect(first.keyPhotoUri).toBeNull()

  await mod.setTaskKeyPhotoUploaded(first.id, 'file://photo.jpg')
  const updated = mod.getTasksSnapshot().items.find((t: any) => t.id === first.id)!
  expect(updated.status).toBe('cleaning')
  expect(updated.keyPhotoUri).toBe('file://photo.jpg')
})

test('tasks store completes task and records metadata', async () => {
  jest.resetModules()
  await (AsyncStorage as any).clear()
  const mod = require('./tasksStore') as typeof import('./tasksStore')

  await mod.initTasksStore()
  const first = mod.getTasksSnapshot().items[0]!

  await mod.completeTask({
    taskId: first.id,
    supplies: ['shampoo'],
    note: 'ok',
    completedAt: '2026-01-01T00:00:00.000Z',
    completedBy: 'tester',
  })

  const updated = mod.getTasksSnapshot().items.find((t: any) => t.id === first.id)!
  expect(updated.status).toBe('completed')
  expect(updated.completedBy).toBe('tester')
  expect(updated.completedAt).toBe('2026-01-01T00:00:00.000Z')
  expect(updated.completionSupplies).toEqual(['shampoo'])
  expect(updated.completionNote).toBe('ok')
})
