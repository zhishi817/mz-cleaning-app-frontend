import { reconcileNoticeCreatedAt, resolveNoticeCreatedAt } from './noticeTime'

test('prefers explicit created_at when valid', () => {
  expect(resolveNoticeCreatedAt('2026-03-31T09:53:42.782Z', 'ORDER_UPDATED_order_x_2026-04-10T02:08:49.472Z')).toBe('2026-03-31T09:53:42.782Z')
})

test('falls back to timestamp embedded in event id', () => {
  expect(resolveNoticeCreatedAt(null, 'ORDER_UPDATED_order_b91d9f6d-dd11-4882-a2d3-c19bd53a9451_2026-03-31T09:53:42.067Z')).toBe('2026-03-31T09:53:42.067Z')
})

test('falls back to database-style timestamp embedded in event id', () => {
  expect(resolveNoticeCreatedAt(null, 'CLEANING_TASK_UPDATED_cleaning_task_ed9ce41a-1507-4cde-ad84-7ab453aac92a_2026-03-31 05:18:26.021444+00')).toBe('2026-03-31T05:18:26.021Z')
})

test('returns null when no valid timestamp exists', () => {
  expect(resolveNoticeCreatedAt('', 'guest_checked_out:CW209:not-a-date')).toBeNull()
})

test('reconciles to the earliest valid notice timestamp', () => {
  expect(reconcileNoticeCreatedAt('2026-04-10T02:17:47.157Z', 'ORDER_UPDATED_order_b91d9f6d-dd11-4882-a2d3-c19bd53a9451_2026-03-31T09:53:42.067Z')).toBe('2026-03-31T09:53:42.067Z')
})
