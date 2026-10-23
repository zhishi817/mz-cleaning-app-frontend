import {
  dedupeTaskFormPhotos,
  taskFormPhotoReadOnlyRelationIds,
  taskFormPhotoRelationIds,
  taskFormPhotoRemoteIdentity,
  type TaskFormPhoto,
} from './taskFormPhotos'

function photo(overrides: Partial<TaskFormPhoto>): TaskFormPhoto {
  return {
    id: 'media-1',
    task_id: 'task-1',
    source: 'inspection',
    local_uri: null,
    thumbnail_uri: null,
    uploaded_key: null,
    uploaded_url: null,
    captured_at: null,
    created_at: null,
    status: 'pending_sync',
    origin: 'local',
    ...overrides,
  }
}

test('uses uploaded key or canonical remote URL as the remote identity', () => {
  expect(taskFormPhotoRemoteIdentity(photo({ uploaded_key: 'cleaning/a/b.jpg' }))).toBe('key:cleaning/a/b.jpg')
  expect(taskFormPhotoRemoteIdentity(photo({ uploaded_url: 'https://cdn.example.com/cleaning/a/b.jpg?signature=one' }))).toBe('key:cleaning/a/b.jpg')
  expect(taskFormPhotoRemoteIdentity(photo({ uploaded_url: 'https://cdn.example.com/a/b.jpg?signature=one' }))).toBe('url:https://cdn.example.com/a/b.jpg')
})

test('read-only media relation excludes display ids and superseded same-property candidates', () => {
  expect(taskFormPhotoReadOnlyRelationIds({
    work_record_read_only: true,
    id: 'cleaning_tasks_merged:2026-07-24:RM-1001',
    source_id: 'checkin-1',
    source_ids: ['checkin-1'],
    active_source_ids: ['checkin-1'],
    read_only_views: { media_source_ids: ['cleaning-1', 'checkin-1'] },
    all_related_source_ids: ['cleaning-1', 'checkin-1', 'cancelled-old-task'],
    superseded_source_ids: ['cancelled-old-task'],
  })).toEqual(['cleaning-1', 'checkin-1'])
})

test('read-only media never falls back to broad display relations without an explicit server capability', () => {
  expect(taskFormPhotoReadOnlyRelationIds({
    work_record_read_only: true,
    id: 'cleaning_tasks_cleaner:checkout-1::record:completed:2026-10-21',
    source_id: 'checkout-1',
    source_ids: ['checkout-1'],
    all_related_source_ids: ['checkout-1', 'unrelated-same-day'],
    read_only_views: { media_source_ids: [] },
  })).toEqual([])
})

test('server photo wins when the same photo exists in local draft and remote records', () => {
  const result = dedupeTaskFormPhotos([
    photo({ id: 'server:1', uploaded_url: 'https://cdn.example.com/cleaning/a.jpg', origin: 'server', status: 'synced' }),
    photo({ id: 'local-media-1', local_uri: 'file:///tmp/a.jpg', uploaded_key: 'cleaning/a.jpg', origin: 'local', status: 'syncing' }),
  ])
  expect(result).toHaveLength(1)
  expect(result[0]).toMatchObject({ origin: 'server', id: 'server:1' })
})

test('does not dedupe photos only because their file names are equal', () => {
  const result = dedupeTaskFormPhotos([
    photo({ id: 'local-a', local_uri: 'file:///one/room.jpg' }),
    photo({ id: 'local-b', local_uri: 'file:///two/room.jpg' }),
  ])
  expect(result).toHaveLength(2)
})

test('uses stable local media id, queue item id, or file URI for local dedupe', () => {
  expect(dedupeTaskFormPhotos([
    photo({ id: 'draft-id', local_media_id: 'media-1', local_uri: 'file:///one/a.jpg' }),
    photo({ id: 'queue-id', local_media_id: 'media-1', queue_item_id: 'submit-1', local_uri: 'file:///one/a.jpg' }),
  ])).toHaveLength(1)
  expect(dedupeTaskFormPhotos([
    photo({ id: 'draft-a', local_uri: 'file:///one/a.jpg' }),
    photo({ id: 'draft-b', local_uri: 'file:///one/a.jpg' }),
  ])).toHaveLength(1)
  expect(dedupeTaskFormPhotos([
    photo({ id: 'draft-id', local_media_id: 'media-2', local_uri: 'file:///one/b.jpg' }),
    photo({ id: 'queue-id', local_media_id: 'media-2', uploaded_url: 'https://cdn.example.com/b.jpg', status: 'syncing' }),
  ])).toHaveLength(1)
})

test('collects the canonical task relation ids used by merged and role-specific cards', () => {
  expect(taskFormPhotoRelationIds({
    id: 'cleaning_tasks_merged:2026-07-24:RM-1001',
    source_id: 'cleaning-1',
    source_ids: ['cleaning-1'],
    all_related_source_ids: ['cleaning-1', 'cleaning-legacy'],
    cleaning_task_ids: ['cleaning-1'],
    inspection_task_ids: ['inspection-1'],
  })).toEqual([
    'cleaning_tasks_merged:2026-07-24:RM-1001',
    'cleaning-1',
    'cleaning-legacy',
    'inspection-1',
  ])
})
