import { collectLocalFileUris, selectOrphanLocalMediaFilesToDelete } from './localMediaHousekeeping'

test('collects local file references from nested queue snapshots', () => {
  const refs = collectLocalFileUris({
    a: 'file:///documents/mzstay-inspection-media/a.jpg',
    b: ['https://cdn.example.com/b.jpg', { c: 'file:///documents/mzstay-key-uploads/key.jpg' }],
    d: null,
  })

  expect(Array.from(refs).sort()).toEqual([
    'file:///documents/mzstay-inspection-media/a.jpg',
    'file:///documents/mzstay-key-uploads/key.jpg',
  ])
})

test('selects only old unreferenced local media files for orphan cleanup', () => {
  const now = Date.parse('2026-07-04T04:00:00.000Z')
  const protectedUris = new Set(['file:///documents/mzstay-inspection-media/protected.jpg'])

  expect(selectOrphanLocalMediaFilesToDelete([
    { uri: 'file:///documents/mzstay-inspection-media/protected.jpg', modificationTime: now - 10 * 24 * 60 * 60 * 1000 },
    { uri: 'file:///documents/mzstay-inspection-media/fresh.jpg', modificationTime: now - 60 * 60 * 1000 },
    { uri: 'file:///documents/mzstay-inspection-media/missing-time.jpg', modificationTime: null },
    { uri: 'https://cdn.example.com/remote.jpg', modificationTime: now - 10 * 24 * 60 * 60 * 1000 },
    { uri: 'file:///documents/mzstay-inspection-media/orphan.jpg', modificationTime: now - 2 * 24 * 60 * 60 * 1000 },
  ], protectedUris, now, 24 * 60 * 60 * 1000)).toEqual([
    'file:///documents/mzstay-inspection-media/orphan.jpg',
  ])
})
