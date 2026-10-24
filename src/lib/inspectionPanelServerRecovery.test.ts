import {
  buildInspectionPanelServerPhotoState,
  hasExactFormalInspectionSubmission,
  mergeInspectionPanelServerPhotos,
} from './inspectionPanelServerRecovery'

function localMedia(id: string, params?: { local?: boolean; key?: string | null; url?: string | null }) {
  return {
    id,
    local_uri: params?.local === false ? null : `file:///${id}.jpg`,
    thumbnail_uri: null,
    uploaded_key: params?.key || null,
    uploaded_url: params?.url || null,
    name: `${id}.jpg`,
    mime_type: 'image/jpeg',
    captured_at: '2026-10-24T00:30:00.000Z',
  }
}

test('hydrates the exact server batch and preserves local pending photos while deduplicating uploaded media', () => {
  const server = buildInspectionPanelServerPhotoState([
    { area: 'living', url: 'cleaning/source-1/living.jpg', captured_at: '2026-10-24T00:29:00.000Z' },
    { area: 'sofa', url: 'https://media.example/cleaning/source-1/sofa.jpg?signature=test' },
    ...Array.from({ length: 4 }, (_, index) => ({ area: 'bedroom', url: `cleaning/source-1/bedroom-${index + 1}.jpg` })),
  ])
  const merged = mergeInspectionPanelServerPhotos({
    localRoomPhotos: {
      living: [localMedia('living-local', { key: 'cleaning/source-1/living.jpg' })],
      sofa: [],
      bedroom: [localMedia('bedroom-pending')],
      kitchen: [],
      bathroom: [],
      balcony: [],
    },
    localCleaningIssue: [],
    server,
  })

  expect(server.total).toBe(6)
  expect(merged.roomPhotos.living).toHaveLength(1)
  expect(merged.roomPhotos.living[0].local_uri).toBe('file:///living-local.jpg')
  expect(merged.roomPhotos.sofa).toHaveLength(1)
  expect(merged.roomPhotos.bedroom).toHaveLength(5)
  expect(merged.roomPhotos.bedroom[0].id).toBe('bedroom-pending')
  expect(merged.roomPhotos.kitchen).toEqual([])
})

test('server empty or unavailable data never removes local pending and failed media', () => {
  const local = {
    living: [localMedia('pending-living')],
    sofa: [],
    bedroom: [],
    kitchen: [],
    bathroom: [],
    balcony: [],
  }
  const withEmptyServer = mergeInspectionPanelServerPhotos({
    localRoomPhotos: local,
    localCleaningIssue: [localMedia('failed-unclean')],
    server: buildInspectionPanelServerPhotoState([]),
  })
  const withFailedServer = mergeInspectionPanelServerPhotos({
    localRoomPhotos: local,
    localCleaningIssue: [localMedia('failed-unclean')],
    server: null,
  })

  expect(withEmptyServer.roomPhotos.living[0].local_uri).toBe('file:///pending-living.jpg')
  expect(withEmptyServer.cleaningIssue[0].local_uri).toBe('file:///failed-unclean.jpg')
  expect(withFailedServer).toEqual(withEmptyServer)
})

test('only an exact submitted receipt with a submit id unlocks server recovery', () => {
  expect(hasExactFormalInspectionSubmission({
    status: 'submitted',
    submit_id: 'inspection-batch-exact',
    saved_at: '2026-10-24T00:39:02.000Z',
  })).toBe(true)
  expect(hasExactFormalInspectionSubmission({ status: 'submitted', submit_id: null, saved_at: null })).toBe(false)
  expect(hasExactFormalInspectionSubmission({ status: 'none', submit_id: null, saved_at: null })).toBe(false)
  expect(hasExactFormalInspectionSubmission({ status: 'unavailable', submit_id: null, saved_at: null })).toBe(false)
})
