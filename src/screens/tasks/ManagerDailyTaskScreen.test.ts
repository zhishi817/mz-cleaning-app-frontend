import { completionPhotoTaskIdsFromTask, inspectionPhotoTaskIdsFromTask, managerGuestLuggagePhotoDisplayItems, managerInspectionPhotoGroups, mergeManagerCompletionPhotoItems } from '../../lib/managerDailyTaskPhotos'

test('MZ119 preserves current, historical and unknown returned inspection areas without duplicating issue photos', () => {
  const items = [
    { area: 'bathroom', url: 'cleaning/bathroom1.jpg', note: 'first' },
    { area: 'bathroom', url: 'cleaning/bathroom2.jpg', note: 'second' },
    { area: 'balcony', url: 'cleaning/balcony.jpg' },
    { area: 'toilet', url: 'cleaning/legacy.jpg' },
    { area: 'shower_drain', url: 'cleaning/drain.jpg' },
    { area: 'future_area', url: 'cleaning/other.jpg' },
    { area: 'unclean', url: 'cleaning/issue.jpg' },
    { area: 'empty_area', url: '' },
  ]
  const groups = managerInspectionPhotoGroups(items)
  expect(groups.map((group) => group.area)).toEqual(['living', 'sofa', 'bedroom', 'kitchen', 'bathroom', 'balcony', 'toilet', 'shower_drain', 'future_area'])
  expect(groups.find((group) => group.area === 'bathroom')?.inspectorItems).toEqual(items.slice(0, 2))
  expect(groups.flatMap((group) => group.inspectorItems)).toEqual(items.slice(0, 6))
  expect(managerInspectionPhotoGroups(items)).toEqual(groups)
})

test('MZ119 empty inspection list has stable empty room sections, not stale media', () => {
  expect(managerInspectionPhotoGroups([])).toEqual(
    ['living', 'sofa', 'bedroom', 'kitchen', 'bathroom', 'balcony'].map((area) => ({ area, inspectorItems: [] })),
  )
})

test('temporary notice retains a local preview until save and attaches notice context only afterwards', () => {
  expect(
    managerGuestLuggagePhotoDisplayItems(
      ['cleaning/guest-luggage/new-photo.jpg'],
      { 'cleaning/guest-luggage/new-photo.jpg': 'file:///picker/new-photo.jpg' },
      'saved-notice-id',
    ),
  ).toEqual([{
    remoteReference: 'cleaning/guest-luggage/new-photo.jpg',
    localUri: 'file:///picker/new-photo.jpg',
    guestLuggageId: null,
  }])

  expect(
    managerGuestLuggagePhotoDisplayItems(
      ['cleaning/guest-luggage/saved-photo.jpg'],
      {},
      'saved-notice-id',
    ),
  ).toEqual([{
    remoteReference: 'cleaning/guest-luggage/saved-photo.jpg',
    localUri: null,
    guestLuggageId: 'saved-notice-id',
  }])
})

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
