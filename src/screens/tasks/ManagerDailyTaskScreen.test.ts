import { completionPhotoTaskIdsFromTask, inspectionPhotoTaskIdsFromTask, mergeManagerCompletionPhotoItems } from '../../lib/managerDailyTaskPhotos'

test('inspection photo lookup includes active and related cleaning task ids when canonical display is available', () => {
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
  ).toEqual(['ct-active', 'it-inspection', 'ct-cleaning', 'ct-source', 'it-source', 'ct-primary'])
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

test('completion photo lookup includes active and all related cleaning task ids for merged manager cards', () => {
  expect(
    completionPhotoTaskIdsFromTask({
      source_type: 'cleaning_tasks',
      source_id: 'ct-primary',
      active_source_ids: ['ct-active'],
      source_ids: ['ct-source'],
      cleaning_task_ids: ['ct-cleaning'],
    } as any),
  ).toEqual(['ct-active', 'ct-cleaning', 'ct-source', 'ct-primary'])
})

test('successful completion photo responses remain visible when another related task response failed', () => {
  expect(
    mergeManagerCompletionPhotoItems([
      { items: [{ area: 'living', url: 'cleaning/completion/living.jpg' }] },
      null,
      { items: [{ area: 'living', url: 'cleaning/completion/living.jpg' }, { area: 'remote_tv', url: 'cleaning/completion/remote.jpg' }] },
    ]),
  ).toEqual([
    { area: 'living', url: 'cleaning/completion/living.jpg', note: null },
    { area: 'remote_tv', url: 'cleaning/completion/remote.jpg', note: null },
  ])
})
