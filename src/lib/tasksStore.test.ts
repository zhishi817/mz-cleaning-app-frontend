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

test('tasks store merges same property same day and preserves checkout/checkin presence', async () => {
  jest.resetModules()
  const mod = require('./tasksStore') as typeof import('./tasksStore')
  type Task = import('./tasksStore').Task
  const date = '2026-02-27'
  const a: Task = {
    id: 'a',
    date,
    title: 'X1',
    region: 'CBD',
    address: 'addr',
    unitType: '1BR',
    status: 'pending_key_photo',
    guideUrl: null,
    hasCheckout: true,
    hasCheckin: false,
    checkoutTime: '11:00',
    nextCheckinTime: null,
    oldCode: '1111',
    masterCode: null,
    newCode: null,
    keypadCode: null,
    keyPhotoUri: null,
    completedAt: null,
    completedBy: null,
    completionNote: '',
    completionSupplies: [],
  }
  const b: Task = {
    ...a,
    id: 'b',
    hasCheckout: false,
    hasCheckin: true,
    checkoutTime: null,
    nextCheckinTime: '14:00',
    oldCode: null,
    newCode: '2222',
  }
  const c: Task = {
    ...a,
    id: 'c',
    hasCheckout: true,
    hasCheckin: true,
    checkoutTime: '10:00',
    nextCheckinTime: '15:00',
    oldCode: '3333',
    newCode: '4444',
  }
  const merged = mod.mergeSamePropertySameDay([a, b, c])
  expect(merged).toHaveLength(1)
  expect(merged[0]!.hasCheckout).toBe(true)
  expect(merged[0]!.hasCheckin).toBe(true)
  expect(merged[0]!.checkoutTime).toBe('11:00')
  expect(merged[0]!.nextCheckinTime).toBe('14:00')
  expect(merged[0]!.oldCode).toBe('1111')
  expect(merged[0]!.newCode).toBe('2222')
})
