import { getPresentedNotice, isPersonnelSettlementNoticeData } from './noticePresentation'

jest.mock('./workTasksStore', () => ({
  findWorkTaskItemByAnyId: jest.fn(() => null),
  findWorkTaskItemByAnyIds: jest.fn(() => null),
}))

test('费用结算通知显示确认语义且导航到本人结算页', () => {
  const notice = getPresentedNotice({
    id: 'notice-1',
    type: 'system',
    title: '通知',
    summary: '',
    content: '',
    createdAt: '2026-09-14T00:05:00.000Z',
    read: false,
    data: {
      kind: 'personnel_settlement_confirmation_requested',
      action: 'open_personnel_settlement',
      week_start: '2026-09-07',
      week_end: '2026-09-13',
    },
  } as any)
  expect(notice.title).toBe('请确认上周费用结算')
  expect(notice.summary).toContain('2026-09-07 至 2026-09-13')

  expect(isPersonnelSettlementNoticeData(notice.data)).toBe(true)
  expect(isPersonnelSettlementNoticeData({ action: 'open_task' })).toBe(false)
})
