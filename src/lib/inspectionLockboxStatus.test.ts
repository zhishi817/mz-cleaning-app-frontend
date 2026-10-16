import { inspectionLockboxUiStatus } from './inspectionLockboxStatus'

function item(patch: Record<string, any>) {
  return {
    id: 'video-1',
    task_id: 'task-1',
    kind: 'lockbox_video',
    local_uri: 'file:///documents/video.mov',
    name: 'video.mov',
    mime_type: 'video/quicktime',
    created_at: '2026-10-15T00:00:00.000Z',
    captured_at: '2026-10-15T00:00:00.000Z',
    uploaded_url: null,
    upload_status: 'pending',
    business_saved: false,
    retain_until: '2026-11-15T00:00:00.000Z',
    local_file_deleted_at: null,
    last_error: null,
    ...patch,
  } as any
}

test.each([
  [item({ upload_status: 'pending' }), 'local_pending', '已保存本机 · 待上传', '删除本机待上传视频'],
  [item({ upload_status: 'uploading' }), 'uploading', '上传中', '删除本机待上传视频'],
  [item({ upload_status: 'failed_retryable', last_error: '网络不可用' }), 'failed', '上传失败', '删除本机待上传视频'],
  [item({ uploaded_url: 'https://cdn/video.mov', upload_status: 'uploaded' }), 'uploaded_pending_save', '已上传 · 待保存任务', '移除待保存视频'],
  [item({ uploaded_url: 'https://cdn/video.mov', upload_status: 'uploaded', business_saved: true }), 'synced', '已同步', '删除已同步视频'],
])('maps queue state to an accurate user-visible phase', (queueItem, phase, label, deleteLabel) => {
  expect(inspectionLockboxUiStatus(queueItem)).toMatchObject({ phase, label, deleteLabel })
})

test('does not expose a legacy LOCAL_MEDIA_LOCKED value and does not call it uploaded', () => {
  const status = inspectionLockboxUiStatus(item({ upload_status: 'failed_retryable', last_error: 'LOCAL_MEDIA_LOCKED' }))
  expect(status.phase).toBe('failed')
  expect(status.hint).toContain('本地视频正在处理中')
  expect(status.hint).not.toContain('LOCAL_MEDIA_LOCKED')
  expect(status.deleteLabel).toBe('删除本机待上传视频')
})

test('treats a server task URL as synced even without a local queue item', () => {
  expect(inspectionLockboxUiStatus(null, { serverUrl: 'https://cdn/server.mov' })).toMatchObject({
    phase: 'synced',
    label: '已同步',
    deleteLabel: '删除已同步视频',
  })
})
