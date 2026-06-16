jest.mock('./api', () => ({
  listInboxNotifications: jest.fn(),
}))

jest.mock('./noticesStore', () => ({
  upsertNotices: jest.fn(),
}))

jest.mock('./noticeTime', () => ({
  resolveNoticeCreatedAt: jest.fn(() => '2026-06-15T10:18:21.334Z'),
}))

import { listInboxNotifications } from './api'
import { inboxNotificationToNotice, syncInboxNotifications } from './notificationInbox'
import { upsertNotices } from './noticesStore'

test('maps server inbox rows to the single mobile notice shape', () => {
  const notice = inboxNotificationToNotice({
    id: 'server-1',
    event_id: 'manager_fields:Aura2707:2144401991',
    type: 'CLEANING_TASK_UPDATED',
    entity: 'cleaning_task',
    entity_id: 'task-1',
    changes: ['keys'],
    title: '任务信息更新：Aura2707',
    body: '需挂钥匙套数：2（原：1）',
    data: { kind: 'cleaning_task_manager_fields_updated', property_code: 'Aura2707' },
    priority: 'medium',
    created_at: '2026-06-15T10:18:21.334Z',
    read_at: null,
  } as any)

  expect(notice.id).toBe('manager_fields:Aura2707:2144401991')
  expect(notice.type).toBe('key')
  expect(notice.data._server_id).toBe('server-1')
  expect(notice.unread).toBe(true)
})

test('sync writes only server inbox rows into the notice store', async () => {
  ;(listInboxNotifications as jest.Mock).mockResolvedValue({
    items: [
      {
        id: 'server-2',
        event_id: 'event-2',
        type: 'CLEANING_TASK_UPDATED',
        changes: [],
        title: '任务更新',
        body: '内容',
        data: {},
        created_at: '2026-06-15T10:20:00.000Z',
        read_at: null,
      },
    ],
    next_cursor: 'cursor-2',
  })

  const result = await syncInboxNotifications({ token: 'token', replace: true })

  expect(upsertNotices).toHaveBeenCalledWith(
    [expect.objectContaining({ id: 'event-2', data: expect.objectContaining({ _server_id: 'server-2' }) })],
    { replace: true },
  )
  expect(result.nextCursor).toBe('cursor-2')
})

test('checkout remains an update notification even when keys are included', () => {
  const notice = inboxNotificationToNotice({
    id: 'server-checkout',
    event_id: 'checkout-1',
    type: 'CLEANING_TASK_UPDATED',
    changes: ['status', 'keys'],
    title: '已退房：Aura2707',
    body: '已退房（2把钥匙）',
    data: { kind: 'guest_checked_out', property_code: 'Aura2707', keys_required: 2 },
    created_at: '2026-06-15T10:18:21.334Z',
    read_at: null,
  } as any)

  expect(notice.type).toBe('update')
})
