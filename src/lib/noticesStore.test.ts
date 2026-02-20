import AsyncStorage from '@react-native-async-storage/async-storage'

test('notices store seeds and supports read/update/load more', async () => {
  jest.resetModules()
  await (AsyncStorage as any).clear()
  const mod = require('./noticesStore') as typeof import('./noticesStore')

  await mod.initNoticesStore()
  const snap1 = mod.getNoticesSnapshot()
  expect(snap1.items.length).toBeGreaterThan(0)
  expect(Object.keys(snap1.unreadIds).length).toBeGreaterThan(0)

  const firstId = snap1.items[0]!.id
  await mod.markNoticeRead(firstId)
  const snap2 = mod.getNoticesSnapshot()
  expect(snap2.unreadIds[firstId]).toBeUndefined()

  const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.1)
  await mod.refreshNotices()
  randomSpy.mockRestore()
  const snap3 = mod.getNoticesSnapshot()
  expect(snap3.items[0]!.id).not.toBe(firstId)

  const before = snap3.items.length
  await mod.loadMoreNotices(5)
  const after = mod.getNoticesSnapshot().items.length
  expect(after).toBe(before + 5)
})
