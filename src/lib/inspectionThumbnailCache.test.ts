import { selectInspectionThumbnailFilesToDelete } from './inspectionThumbnailCache'

test('evicts oldest unprotected thumbnails until file and byte limits are satisfied', () => {
  const entries = [
    { uri: 'file:///old.jpg', size: 8, modificationTime: 1 },
    { uri: 'file:///protected.jpg', size: 8, modificationTime: 2 },
    { uri: 'file:///new.jpg', size: 8, modificationTime: 3 },
  ]

  expect(selectInspectionThumbnailFilesToDelete(
    entries,
    new Set(['file:///protected.jpg']),
    2,
    16,
  )).toEqual(['file:///old.jpg'])
})

test('continues evicting by age when the byte limit still exceeds the cap', () => {
  const entries = [
    { uri: 'file:///one.jpg', size: 12, modificationTime: 1 },
    { uri: 'file:///two.jpg', size: 12, modificationTime: 2 },
    { uri: 'file:///three.jpg', size: 12, modificationTime: 3 },
  ]

  expect(selectInspectionThumbnailFilesToDelete(entries, new Set(), 10, 12))
    .toEqual(['file:///one.jpg', 'file:///two.jpg'])
})
