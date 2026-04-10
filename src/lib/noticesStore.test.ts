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
  expect(mod.getNoticesSnapshot().readIds['x1']).toBe(true)

  await mod.prependNotice({ id: 'x1', type: 'update', title: 't1', summary: 's1', content: 'c1' })
  const snap3 = mod.getNoticesSnapshot()
  expect(snap3.items.length).toBe(1)
  expect(snap3.unreadIds['x1']).toBeUndefined()
  expect(snap3.readIds['x1']).toBe(true)

  await mod.refreshNotices()
  const snap4 = mod.getNoticesSnapshot()
  expect(snap4.items.length).toBe(1)

  await mod.loadMoreNotices(5)
  const snap5 = mod.getNoticesSnapshot()
  expect(snap5.items.length).toBe(1)
})

test('locally read notice stays read when server sync still says unread', async () => {
  jest.resetModules()
  const AsyncStorage = require('@react-native-async-storage/async-storage')
  await (AsyncStorage as any).clear()
  const mod = require('./noticesStore') as typeof import('./noticesStore')

  await mod.initNoticesStore()
  await mod.prependNotice({ id: 'evt-1', type: 'update', title: '任务信息更新：CW209', summary: '需要挂钥匙数：1（原：2）', content: 'body' })
  await mod.markNoticeRead('evt-1')

  await mod.upsertNotices([
    {
      id: 'evt-1',
      type: 'update',
      title: '任务信息更新：CW209',
      summary: '需要挂钥匙数：1（原：2）',
      content: 'body',
      createdAt: new Date().toISOString(),
      unread: true,
    },
  ])

  const snap = mod.getNoticesSnapshot()
  expect(snap.unreadIds['evt-1']).toBeUndefined()
  expect(snap.readIds['evt-1']).toBe(true)
})

test('invalid incoming createdAt keeps existing notice time', async () => {
  jest.resetModules()
  const AsyncStorage = require('@react-native-async-storage/async-storage')
  await (AsyncStorage as any).clear()
  const mod = require('./noticesStore') as typeof import('./noticesStore')

  await mod.initNoticesStore()
  await mod.upsertNotices([
    {
      id: 'evt-2',
      type: 'update',
      title: '任务信息更新：8883312',
      summary: '需挂钥匙套数：2（原：1）',
      content: 'body',
      createdAt: '2026-04-10T00:24:00.000Z',
      unread: true,
    },
  ])

  await mod.upsertNotices([
    {
      id: 'evt-2',
      type: 'update',
      title: '任务信息更新：8883312',
      summary: '需挂钥匙套数：2（原：1）',
      content: 'body',
      createdAt: 'invalid-date',
      unread: true,
    },
  ])

  const snap = mod.getNoticesSnapshot()
  expect(snap.items.find((x: any) => x.id === 'evt-2')?.createdAt).toBe('2026-04-10T00:24:00.000Z')
})

test('replace sync drops stale local notices and keeps current remote set', async () => {
  jest.resetModules()
  const AsyncStorage = require('@react-native-async-storage/async-storage')
  await (AsyncStorage as any).clear()
  const mod = require('./noticesStore') as typeof import('./noticesStore')

  await mod.initNoticesStore()
  await mod.prependNotice({ id: 'stale-1', type: 'update', title: '旧通知', summary: 'old', content: 'old' })
  await mod.upsertNotices(
    [
      {
        id: 'remote-1',
        type: 'update',
        title: '新通知',
        summary: 'new',
        content: 'new',
        createdAt: '2026-04-10T01:00:00.000Z',
        unread: true,
      },
    ],
    { replace: true },
  )

  const snap = mod.getNoticesSnapshot()
  expect(snap.items.map((x: any) => x.id)).toEqual(['remote-1'])
  expect(snap.unreadIds['remote-1']).toBe(true)
  expect(snap.unreadIds['stale-1']).toBeUndefined()
})

test('replace sync keeps local-only notices that are not yet on server', async () => {
  jest.resetModules()
  const AsyncStorage = require('@react-native-async-storage/async-storage')
  await (AsyncStorage as any).clear()
  const mod = require('./noticesStore') as typeof import('./noticesStore')

  await mod.initNoticesStore()
  await mod.prependNotice({
    id: 'local-1',
    type: 'update',
    title: '任务信息更新：CW209',
    summary: '退房时间：11:30（原：10am）',
    content: 'body',
    data: { kind: 'cleaning_task_manager_fields_updated', task_ids: ['t1'] },
  } as any)
  await mod.markNoticeRead('local-1')

  await mod.upsertNotices(
    [
      {
        id: 'remote-1',
        type: 'update',
        title: '服务端通知',
        summary: 'new',
        content: 'new',
        createdAt: '2026-04-10T01:00:00.000Z',
        unread: true,
        data: { _server_id: 'server-1' },
      },
    ],
    { replace: true },
  )

  const snap = mod.getNoticesSnapshot()
  expect(snap.items.map((x: any) => x.id).sort()).toEqual(['local-1', 'remote-1'])
  expect(snap.readIds['local-1']).toBe(true)
  expect(snap.unreadIds['local-1']).toBeUndefined()
  expect(snap.unreadIds['remote-1']).toBe(true)
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
      readIds: { n2: true },
    }),
  )
  await mod.initNoticesStore()
  const snap = mod.getNoticesSnapshot()
  expect(snap.items.map(x => x.id)).toEqual(['n2'])
  expect(snap.unreadIds['n1']).toBeUndefined()
  expect(snap.unreadIds['n2']).toBe(true)
  expect(snap.readIds['n2']).toBe(true)
})
