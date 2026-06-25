import { inspectionPhotoTaskIdsFromTask } from '../../lib/managerDailyTaskPhotos'

test('inspection photo lookup includes cleaning and inspection source ids', () => {
  expect(
    inspectionPhotoTaskIdsFromTask({
      source_type: 'cleaning_tasks',
      source_id: 'ct-primary',
      source_ids: ['ct-source', 'it-source'],
      cleaning_task_ids: ['ct-cleaning'],
      inspection_task_ids: ['it-inspection'],
    } as any),
  ).toEqual(['it-inspection', 'ct-cleaning', 'ct-source', 'it-source', 'ct-primary'])
})

test('inspection photo lookup ignores non cleaning tasks', () => {
  expect(inspectionPhotoTaskIdsFromTask({ source_type: 'orders', source_id: 'order-1' } as any)).toEqual([])
})
