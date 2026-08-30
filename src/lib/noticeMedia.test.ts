import { isNoticeMediaReferenceEligible, resolveNoticeMediaContext } from './noticeMedia'

test('task-bound notice sources retain their authenticated task context', () => {
  expect(resolveNoticeMediaContext({ kind: 'keys_hung', task_id: 'cleaning-task-1' })).toEqual({
    testIdPrefix: 'key-media-notice', access: { accessTaskId: 'cleaning-task-1' },
  })
  expect(resolveNoticeMediaContext({ kind: 'issue_reported', task_id: 'cleaning-task-2' })).toEqual({
    testIdPrefix: 'issue-reported-notice', access: { accessTaskId: 'cleaning-task-2' },
  })
})

test('guest luggage and offline work-task notices retain their exact source context', () => {
  expect(resolveNoticeMediaContext({ kind: 'guest_luggage_updated', guest_luggage_id: '4a0dbea0-cbaf-4eef-87ec-2f4bb038703e' })).toEqual({
    testIdPrefix: 'guest-luggage-notice', access: { guestLuggageId: '4a0dbea0-cbaf-4eef-87ec-2f4bb038703e' },
  })
  expect(resolveNoticeMediaContext({ kind: 'work_task_completed', task_id: 'cleaning_offline_tasks:work-1' })).toEqual({
    testIdPrefix: 'offline-work-task-completed-notice', access: { accessWorkTaskId: 'cleaning_offline_tasks:work-1', offlineWorkTaskMedia: true },
  })
})

test('missing context, unsupported notice kinds, and raw URLs are not eligible for display', () => {
  expect(resolveNoticeMediaContext({ kind: 'issue_reported' })).toBeNull()
  expect(resolveNoticeMediaContext({ kind: 'unknown' })).toBeNull()
  expect(isNoticeMediaReferenceEligible({ kind: 'keys_hung', task_id: 'cleaning-task-1' }, 'https://example.invalid/private.jpg')).toBe(false)
  expect(isNoticeMediaReferenceEligible({ kind: 'keys_hung', task_id: 'cleaning-task-1' }, 'cleaning/key.jpg')).toBe(true)
})
