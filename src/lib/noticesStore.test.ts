test('notices store supports add/read/dedupe', async () => {
  jest.resetModules()
  const AsyncStorage = require('@react-native-async-storage/async-storage')
  await (AsyncStorage as any).clear()
  const mod = require('./noticesStore') as typeof import('./noticesStore')

  await mod.initNoticesStore()
  const snap1 = mod.getNoticesSnapshot()
  expect(snap1.items.length).toBe(0)
  expect(Object.keys(snap1.unreadIds).length).toBe(0)

  await mod.prependNotice({ id: 'x1', type: 'update', title: 't1', summary: 's1', content: 'c1' })
  const snap2 = mod.getNoticesSnapshot()
  expect(snap2.items.length).toBe(1)
  expect(snap2.items[0]!.id).toBe('x1')
  expect(snap2.unreadIds['x1']).toBe(true)

  await mod.markNoticeRead('x1')
  expect(mod.getNoticesSnapshot().unreadIds['x1']).toBeUndefined()

  await mod.prependNotice({ id: 'x1', type: 'update', title: 't1', summary: 's1', content: 'c1' })
  const snap3 = mod.getNoticesSnapshot()
  expect(snap3.items.length).toBe(1)
  expect(snap3.unreadIds['x1']).toBe(true)

  await mod.refreshNotices()
  const snap4 = mod.getNoticesSnapshot()
  expect(snap4.items.length).toBe(1)

  await mod.loadMoreNotices(5)
  const snap5 = mod.getNoticesSnapshot()
  expect(snap5.items.length).toBe(1)
})

test('notices store drops system notices from legacy state', async () => {
  jest.resetModules()
  const AsyncStorage = require('@react-native-async-storage/async-storage')
  await (AsyncStorage as any).clear()
  const mod = require('./noticesStore') as typeof import('./noticesStore')
  await (AsyncStorage as any).setItem(
    mod.NOTICES_STORAGE_KEY,
    JSON.stringify({
      items: [
        { id: 'n1', type: 'system', title: '系统通知：今日任务有更新', summary: 'x', content: 'y', createdAt: new Date().toISOString() },
        { id: 'n2', type: 'update', title: 'ok', summary: 'a', content: 'b', createdAt: new Date().toISOString() },
      ],
      unreadIds: { n1: true, n2: true },
    }),
  )
  await mod.initNoticesStore()
  const snap = mod.getNoticesSnapshot()
  expect(snap.items.map(x => x.id)).toEqual(['n2'])
  expect(snap.unreadIds['n1']).toBeUndefined()
  expect(snap.unreadIds['n2']).toBe(true)
})
