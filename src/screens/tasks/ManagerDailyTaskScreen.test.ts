import { inspectionPhotoTaskIdsFromTask } from '../../lib/managerDailyTaskPhotos'

test('inspection photo lookup uses active source ids when canonical display is available', () => {
  expect(
    inspectionPhotoTaskIdsFromTask({
      source_type: 'cleaning_tasks',
      source_id: 'ct-primary',
      active_source_ids: ['ct-active'],
      superseded_source_ids: ['ct-manual'],
      source_ids: ['ct-source', 'it-source'],
      cleaning_task_ids: ['ct-cleaning'],
      inspection_task_ids: ['it-inspection'],
    } as any),
  ).toEqual(['ct-active'])
})

test('inspection photo lookup falls back to source ids for older cached tasks', () => {
  expect(
    inspectionPhotoTaskIdsFromTask({
      source_type: 'cleaning_tasks',
      source_id: 'ct-primary',
      source_ids: ['ct-source', 'it-source'],
    } as any),
  ).toEqual(['ct-source', 'it-source', 'ct-primary'])
})

test('inspection photo lookup ignores non cleaning tasks', () => {
  expect(inspectionPhotoTaskIdsFromTask({ source_type: 'orders', source_id: 'order-1' } as any)).toEqual([])
})
