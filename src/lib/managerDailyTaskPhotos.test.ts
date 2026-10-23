import { managerHistoricalMediaRecords, mergeManagerLivingRoomPhotoUrls } from './managerDailyTaskPhotos'

test('manager living-room photos prefer the plural field, retain legacy fallback, and deduplicate', () => {
  expect(mergeManagerLivingRoomPhotoUrls([
    { living_room_photo_urls: ['cleaning/living-1.jpg', 'cleaning/living-2.jpg'] },
    { living_room_photo_url: 'cleaning/living-2.jpg' },
    { living_room_photo_url: 'cleaning/living-3.jpg' },
  ])).toEqual(['cleaning/living-1.jpg', 'cleaning/living-2.jpg', 'cleaning/living-3.jpg'])
})

const baseTask: any = {
  work_record_read_only: true,
  work_record_state: 'reassigned',
  status: 'done',
  execution_state: 'active',
  completed_by_user_id: 'former-cleaner',
  read_only_views: {
    media_scope: 'manager',
    media_source_ids: ['checkout-source'],
    feedback_source_id: 'checkout-source',
  },
  phase_history: [{ source_id: 'checkout-source', actor_user_id: 'former-cleaner', role: 'cleaner' }],
}

const record = (overrides: any = {}) => ({
  id: 'photo-former',
  task_id: 'checkout-source',
  source: 'completion',
  area: 'living',
  url: 'cleaning/former.jpg',
  uploader_id: 'former-cleaner',
  ...overrides,
})

test('reassigned manager history keeps only exact-source media uploaded by the recorded actor', () => {
  const records = managerHistoricalMediaRecords(baseTask, [
    record(),
    record({ id: 'video-former', source: 'lockbox_video', url: 'cleaning/former.mp4' }),
    record({ id: 'photo-replacement', url: 'cleaning/replacement.jpg', uploader_id: 'replacement-cleaner' }),
    record({ id: 'photo-ownerless', url: 'cleaning/ownerless.jpg', uploader_id: null }),
    record({ id: 'photo-unrelated', task_id: 'same-property-other-task', url: 'cleaning/unrelated.jpg' }),
  ] as any)

  expect(records.map((item) => item.id)).toEqual(['photo-former', 'video-former'])
})

test('ordinary completed manager history keeps every authorized exact-source record', () => {
  const task = { ...baseTask, work_record_state: 'completed' }
  const records = managerHistoricalMediaRecords(task, [
    record(),
    record({ id: 'photo-inspector', source: 'inspection', uploader_id: 'inspector-1' }),
    record({ id: 'other-source', task_id: 'same-property-other-task' }),
  ] as any)

  expect(records.map((item) => item.id)).toEqual(['photo-former', 'photo-inspector'])
})

test.each(['cancelled', 'deleted', 'superseded'])('blocked %s history fails closed', (state) => {
  const task = state === 'cancelled'
    ? { ...baseTask, status: state }
    : { ...baseTask, execution_state: state }
  expect(managerHistoricalMediaRecords(task, [record()] as any)).toEqual([])
})

test('reassigned history without a Root-issued exact actor binding fails closed', () => {
  expect(managerHistoricalMediaRecords({
    ...baseTask,
    phase_history: [],
    read_only_views: { ...baseTask.read_only_views, feedback_source_id: null },
  }, [record()] as any)).toEqual([])
})

test('reassigned history uses the exact feedback source when one actor appears in multiple phases', () => {
  const task = {
    ...baseTask,
    read_only_views: {
      ...baseTask.read_only_views,
      media_source_ids: ['checkout-source', 'checkin-source'],
      feedback_source_id: 'checkout-source',
    },
    phase_history: [
      { source_id: 'checkout-source', actor_user_id: 'former-cleaner', role: 'cleaner' },
      { source_id: 'checkin-source', actor_user_id: 'former-cleaner', role: 'inspector' },
    ],
  }
  const records = managerHistoricalMediaRecords(task, [
    record(),
    record({ id: 'other-phase', task_id: 'checkin-source', source: 'inspection', url: 'cleaning/other-phase.jpg' }),
  ] as any)

  expect(records.map((item) => item.id)).toEqual(['photo-former'])
})
