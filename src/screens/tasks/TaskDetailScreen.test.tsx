import React from 'react'
import { Alert, Keyboard, Platform, StyleSheet } from 'react-native'
import { act, fireEvent, fireEventAsync, render, waitFor } from '@testing-library/react-native'
import { I18nProvider } from '../../lib/i18n'

let mockCompletionDrafts: Record<string, any[]> = {}
let mockCompletionMediaSequence = 0
let mockKeyQueueItem: any = null
let mockPendingCompletionPhotoReferences: string[] = []
const mockAuthState: any = { user: { id: 'u1', username: 'tester', role: 'staff' }, token: 't1' }

jest.mock('react-native-safe-area-context', () => {
  const React = require('react')
  return {
    SafeAreaProvider: ({ children }: any) => React.createElement(React.Fragment, null, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  }
})

jest.mock('expo-image-picker', () => {
  return {
    MediaType: { IMAGE: 'images', VIDEO: 'videos' },
    requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
    requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
    launchImageLibraryAsync: jest.fn(async () => ({ canceled: true })),
    launchCameraAsync: jest.fn(async () => ({
      canceled: false,
      assets: [{ uri: 'file:///tmp/k.jpg', fileName: 'k.jpg', mimeType: 'image/jpeg' }],
    })),
  }
})

jest.mock('../../lib/auth', () => {
  return {
    useAuth: () => mockAuthState,
  }
})

jest.mock('../../components/CleaningMediaImage', () => {
  const React = require('react')
  return {
    __esModule: true,
    default: (props: any) => React.createElement('CleaningMediaImage', {
      ...props,
      accessibilityLabel: `${String(props.remoteReference || '')}|${String(props.accessWorkTaskId || '')}`,
    }),
  }
})

jest.mock('../../components/CleaningMediaPreview', () => {
  const React = require('react')
  return {
    __esModule: true,
    default: (props: any) => React.createElement('CleaningMediaPreview', {
      ...props,
    testID: 'cleaning-media-preview',
    accessibilityLabel: `${String(props.reference || '')}|${String(props.accessWorkTaskId || '')}`,
    }),
  }
})

jest.mock('../../lib/workTasksStore', () => {
  const listeners = new Set<() => void>()
  const snapshot = {
    items: [
      {
        id: 'w1',
        task_kind: 'cleaning',
        source_type: 'cleaning_tasks',
        source_id: 'ct1',
        title: 'T',
        summary: null,
        scheduled_date: '2026-01-01',
        start_time: '10am',
        end_time: '3pm',
        assignee_id: null,
        status: 'assigned',
        urgency: 'medium',
        property: { id: 'p1', code: 'X', region: '', address: '', unit_type: '', access_guide_link: '' },
        date: '2026-01-01',
      },
    ],
    bucketKey: 'k',
    updatedAt: null,
  }
  return {
    canViewReadOnlyWorkRecordLockCodes: (task: any) => task?.work_record_read_only !== true || (
      task?.source_type === 'cleaning_tasks'
      && task?.read_only_views?.lock_codes === true
      && ['completed', 'reassigned'].includes(String(task?.work_record_state || '').toLowerCase())
      && !['cancelled', 'canceled'].includes(String(task?.status || '').toLowerCase())
      && !['cancelled', 'canceled', 'deleted', 'removed', 'superseded', 'tombstone'].includes(String(task?.execution_state || '').toLowerCase())
    ),
    subscribeWorkTasks: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getWorkTasksSnapshot: () => snapshot,
    patchWorkTaskItem: jest.fn(async (id: string, patch: Record<string, any>) => {
      const index = snapshot.items.findIndex((item) => item.id === id)
      if (index < 0) return
      snapshot.items = snapshot.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)
      for (const listener of listeners) listener()
    }),
    requestWorkTasksRefresh: jest.fn(async () => {}),
    reconcileActiveWorkTasksAfterLocalPatch: jest.fn(async () => {}),
    findWorkTaskItemByAnyId: (id: string) => snapshot.items.find((item) => item.id === id || item.source_id === id) || null,
  }
})

jest.mock('../../lib/api', () => {
  const actual = jest.requireActual('../../lib/api')
  return {
    ...actual,
    uploadCleaningMedia: jest.fn(async () => ({ url: 'http://example.com/k.jpg' })),
    getWorkTaskFormPhotos: jest.fn(async () => ({ items: [] })),
    markWorkTask: jest.fn(async () => ({ ok: true })),
    submitDeepCleaningCompletion: jest.fn(async () => ({ ok: true, status: 'pending_review', workflow_status: 'pending_review', available_actions: [], repair_photo_urls: ['mzapp/deep-after.jpg'], work_record_state: 'pending_review', work_record_read_only: true, counts_as_active_task: false })),
    submitMaintenanceExecutorAction: jest.fn(async () => ({ status: 'pending_review', available_actions: [] })),
    appendWorkTaskCompletionPhotos: jest.fn(async () => ({ ok: true, completion_photo_urls: ['mzapp/completion-photo.jpg'] })),
    startCleaningTask: jest.fn(async () => ({ ok: true })),
    uploadMzappMedia: jest.fn(async () => ({ remoteReference: 'mzapp/completion-photo.jpg', url: 'mzapp/completion-photo.jpg' })),
  }
})

jest.mock('../../lib/keyUploadQueue', () => ({
  discardKeyUpload: jest.fn(async () => null),
  enqueueKeyUpload: jest.fn(async () => ({})),
  getKeyUploadQueueItem: jest.fn(async () => mockKeyQueueItem),
  getKeyUploadVisibleError: jest.fn((error: any) => {
    const message = String(error || '').trim()
    if (!message) return null
    const lower = message.toLowerCase()
    return lower.includes('network request failed') || lower.includes('timeout') || lower.includes('timed out') || lower.includes('aborted')
      ? null
      : message
  }),
  processKeyUploadQueue: jest.fn(async () => ({ processed: 0, remaining: mockKeyQueueItem ? 1 : 0 })),
  selectKeyPhotoEffectiveState: jest.fn(({ key_photo_url, has_local_pending }) => (key_photo_url ? 'recorded' : has_local_pending ? 'pending_sync' : 'missing')),
  subscribeKeyUploadQueue: jest.fn(() => () => {}),
}))

jest.mock('../../lib/localMediaDrafts', () => ({
  draftFileExists: jest.fn(() => true),
  persistCompressedDraftMedia: jest.fn(async (options: any) => ({ localUri: 'file:///persistent/completion.jpg', name: options.name, mimeType: options.mimeType })),
}))

jest.mock('../../lib/maintenanceCompletionPhotoDraft', () => ({
  clearMaintenanceCompletionPhotoDraft: jest.fn(async (taskId: string, ownerId: string) => { delete mockCompletionDrafts[`${taskId}:${ownerId}`] }),
  createMaintenanceCompletionPhotoMediaId: jest.fn(() => `media-${++mockCompletionMediaSequence}`),
  getMaintenanceCompletionPhotoDraft: jest.fn(async (taskId: string, ownerId: string) => mockCompletionDrafts[`${taskId}:${ownerId}`] || []),
  removeMaintenanceCompletionPhotoDraft: jest.fn(async (taskId: string, ownerId: string, mediaId: string) => {
    mockCompletionDrafts[`${taskId}:${ownerId}`] = (mockCompletionDrafts[`${taskId}:${ownerId}`] || []).filter((photo: any) => photo.media_id !== mediaId)
  }),
  setMaintenanceCompletionPhotoDraft: jest.fn(async (taskId: string, ownerId: string, photos: any[]) => {
    mockCompletionDrafts[`${taskId}:${ownerId}`] = photos.map((photo) => ({ ...photo }))
    return mockCompletionDrafts[`${taskId}:${ownerId}`]
  }),
}))

jest.mock('../../lib/workTaskCompletionPhotoPending', () => ({
  clearPendingWorkTaskCompletionPhotoReferences: jest.fn(async () => { mockPendingCompletionPhotoReferences = [] }),
  getPendingWorkTaskCompletionPhotoReferences: jest.fn(async () => mockPendingCompletionPhotoReferences),
  normalizePendingCompletionPhotoReferences: jest.fn((values: any[]) => Array.from(new Set((Array.isArray(values) ? values : []).map((item) => String(item || '').trim()).filter(Boolean)))),
  setPendingWorkTaskCompletionPhotoReferences: jest.fn(async (_taskId: string, _ownerId: string, values: string[]) => {
    mockPendingCompletionPhotoReferences = values
    return values
  }),
}))

beforeEach(() => {
  mockCompletionDrafts = {}
  const local = require('../../lib/localMediaDrafts')
  local.draftFileExists.mockReset().mockReturnValue(true)
  local.persistCompressedDraftMedia.mockReset().mockImplementation(async (options: any) => ({ localUri: 'file:///persistent/completion.jpg', name: options.name, mimeType: options.mimeType }))
  const drafts = require('../../lib/maintenanceCompletionPhotoDraft')
  drafts.getMaintenanceCompletionPhotoDraft.mockReset().mockImplementation(async (taskId: string, ownerId: string) => mockCompletionDrafts[`${taskId}:${ownerId}`] || [])
  drafts.setMaintenanceCompletionPhotoDraft.mockReset().mockImplementation(async (taskId: string, ownerId: string, photos: any[]) => {
    mockCompletionDrafts[`${taskId}:${ownerId}`] = photos.map((photo: any) => ({ ...photo }))
    return mockCompletionDrafts[`${taskId}:${ownerId}`]
  })
  mockCompletionMediaSequence = 0
  require('expo-image-picker').launchCameraAsync.mockReset().mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///tmp/k.jpg', fileName: 'k.jpg', mimeType: 'image/jpeg' }] })
  require('expo-image-picker').launchImageLibraryAsync.mockReset().mockResolvedValue({ canceled: true })
  require('../../lib/api').uploadMzappMedia.mockReset().mockResolvedValue({ url: 'mzapp/completion-photo.jpg' })
  mockKeyQueueItem = null
  mockPendingCompletionPhotoReferences = []
  require('../../lib/api').getWorkTaskFormPhotos.mockClear()
  require('../../lib/api').submitMaintenanceExecutorAction.mockClear()
  require('../../lib/workTaskCompletionPhotoPending').clearPendingWorkTaskCompletionPhotoReferences.mockClear()
  require('../../lib/workTaskCompletionPhotoPending').getPendingWorkTaskCompletionPhotoReferences.mockClear()
  require('../../lib/workTaskCompletionPhotoPending').setPendingWorkTaskCompletionPhotoReferences.mockClear()
})

test('uploading key photo queues sync and refreshes the task projection', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>
  const keyQueue = require('../../lib/keyUploadQueue')
  const workTasksStore = require('../../lib/workTasksStore')

  const ui = render(
    <I18nProvider>
      <TaskDetailScreen navigation={{ goBack: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'k', name: 'TaskDetail', params: { id: 'w1' } } as any} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText(/upload key|上传钥匙/i)).toBeTruthy()
  })
  keyQueue.enqueueKeyUpload.mockClear()
  keyQueue.processKeyUploadQueue.mockClear()
  workTasksStore.requestWorkTasksRefresh.mockClear()
  fireEvent.press(ui.getByText(/upload key|上传钥匙/i))

  await waitFor(() => {
    expect(keyQueue.enqueueKeyUpload).toHaveBeenCalledWith(expect.objectContaining({ cleaning_task_id: 'ct1', source_uri: 'file:///tmp/k.jpg' }))
    expect(keyQueue.processKeyUploadQueue).toHaveBeenCalledWith('t1')
    expect(workTasksStore.requestWorkTasksRefresh).toHaveBeenCalledWith(
      expect.objectContaining({ token: 't1', userId: 'u1', view: 'mine', mode: 'force', reason: 'task_detail_key_upload' }),
    )
  })
}, 15_000)

test('canceling key photo capture restores upload button state', async () => {
  const picker = require('expo-image-picker')
  picker.launchCameraAsync.mockResolvedValueOnce({ canceled: true, assets: null })
  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>

  const ui = render(
    <I18nProvider>
      <TaskDetailScreen navigation={{ goBack: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'k-cancel', name: 'TaskDetail', params: { id: 'w1' } } as any} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText(/upload key|上传钥匙/i)).toBeTruthy()
  })

  fireEvent.press(ui.getByText(/upload key|上传钥匙/i))

  await waitFor(() => {
    expect(ui.getByText(/upload key|上传钥匙/i)).toBeTruthy()
  })
})

test('task detail can resolve cleaning task id from notice route', async () => {
  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>

  const ui = render(
    <I18nProvider>
      <TaskDetailScreen navigation={{ goBack: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'k2', name: 'TaskDetail', params: { id: 'ct1' } } as any} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.queryByText('出错了')).toBeNull()
    expect(ui.getByText(/upload key|上传钥匙/i)).toBeTruthy()
  })
})

test('task detail does not load the supplies photo endpoint', async () => {
  const api = require('../../lib/api')
  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>

  const ui = render(
    <I18nProvider>
      <TaskDetailScreen navigation={{ goBack: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'k-no-form-photos', name: 'TaskDetail', params: { id: 'w1' } } as any} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText(/upload key|上传钥匙/i)).toBeTruthy()
  })
  expect(api.getWorkTaskFormPhotos).not.toHaveBeenCalled()
  expect(ui.queryByText('补品填报 / 房间照片')).toBeNull()
  expect(ui.queryByText('照片加载中...')).toBeNull()
})

test('cleaner completed record keeps property access and shows only cleaner photo categories read-only', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousTask = { ...snapshot.items[0] }
  const previousUser = { ...mockAuthState.user }
  const api = require('../../lib/api')
  mockAuthState.user = { id: 'u1', username: 'tester', role: 'cleaner' }
  snapshot.items[0] = {
    ...previousTask,
    work_record_read_only: true,
    work_record_visible: true,
    work_record_state: 'completed',
    completed_by_user_id: 'u1',
    execution_role: 'cleaning',
    old_code: '1357',
    new_code: '2468',
    source_ids: ['ct1'],
    active_source_ids: ['ct1'],
    available_actions: [],
    read_only_views: {
      property_access: true,
      guest_context: true,
      lock_codes: true,
      cleaner_photos: true,
      inspection_photos: false,
      guest_key_photo: true,
      media_scope: 'cleaner',
      media_source_ids: ['ct1'],
    },
    property: {
      ...previousTask.property,
      access_guide_link: 'https://example.com/guide',
      wifi_ssid: 'Guest WiFi',
      wifi_password: 'secret',
    },
    guest_special_request: 'Please leave luggage inside',
    order_note: 'Call before entry',
    guest_luggage: {
      id: 'notice-1',
      note: 'Leave luggage inside',
      photo_urls: [],
      current_user_acknowledged: false,
      acknowledgements: { cleaners: [], inspectors: [] },
    },
    guest_ready_notification: {
      order_id: 'order-1',
      status: 'notified',
      notified_at: '2026-10-21T01:00:00.000Z',
      notified_by_name: 'Support',
      version: 1,
      requirement_reasons: ['early_arrival'],
    },
  }
  api.getWorkTaskFormPhotos.mockResolvedValueOnce({
    items: [
      { id: 'completion-1', task_id: 'ct1', source: 'completion', area: 'bedroom', url: 'mzapp/completion-1.jpg' },
      { id: 'inspection-1', task_id: 'ct1', source: 'inspection', area: 'living', url: 'mzapp/inspection-1.jpg' },
    ],
  })
  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>

  try {
    const ui = render(
      <I18nProvider>
        <TaskDetailScreen navigation={{ goBack: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'completed-cleaner', name: 'TaskDetail', params: { id: 'w1' } } as any} />
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(api.getWorkTaskFormPhotos).toHaveBeenCalledWith('t1', 'w1', ['ct1'], 'cleaner')
      expect(ui.getByTestId('task-detail-read-only-photos')).toBeTruthy()
      expect(ui.getByTestId('task-detail-read-only-photo-0')).toBeTruthy()
      expect(ui.queryByTestId('task-detail-read-only-photo-1')).toBeNull()
      expect(ui.getByText(/Guest WiFi/)).toBeTruthy()
      expect(ui.getByText('查看入住指南')).toBeTruthy()
      expect(ui.getByText('客人需求：Please leave luggage inside')).toBeTruthy()
      expect(ui.getByText('订单备注：Call before entry')).toBeTruthy()
      expect(ui.getByText('Leave luggage inside')).toBeTruthy()
      expect(ui.queryByText('我已知晓')).toBeNull()
      expect(ui.getByText(/客人入住通知：已由 Support/)).toBeTruthy()
      expect(ui.getByText('旧密码：1357  新密码：2468')).toBeTruthy()
      expect(ui.getByText('只读查看，不提供删除、重拍或补传操作。')).toBeTruthy()
      expect(ui.queryByText(/上传钥匙/i)).toBeNull()
    })
  } finally {
    snapshot.items[0] = previousTask
    mockAuthState.user = previousUser
  }
})

test('non-customer-service read-only record does not reveal the new ordinary check-in notification projection', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousTask = { ...snapshot.items[0] }
  const previousUser = { ...mockAuthState.user }
  mockAuthState.user = { id: 'u1', username: 'tester', role: 'cleaner' }
  snapshot.items[0] = {
    ...previousTask,
    work_record_read_only: true,
    work_record_visible: true,
    work_record_state: 'completed',
    completed_by_user_id: 'u1',
    execution_role: 'cleaning',
    available_actions: [],
    read_only_views: { guest_context: true, media_scope: 'cleaner', media_source_ids: [] },
    guest_ready_notification: {
      order_id: 'order-ordinary',
      status: 'notified',
      notified_at: '2026-11-01T01:00:00.000Z',
      notified_by_name: 'Support',
      version: 1,
      requirement_reasons: [],
    },
  }

  try {
    const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>
    const ui = render(
      <I18nProvider>
        <TaskDetailScreen navigation={{ goBack: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'ordinary-notification-role-boundary', name: 'TaskDetail', params: { id: 'w1' } } as any} />
      </I18nProvider>,
    )
    await waitFor(() => expect(ui.getByText('只读工作记录')).toBeTruthy())
    expect(ui.queryByText(/客人入住通知/)).toBeNull()
    expect(ui.queryByText('已通知客人')).toBeNull()
  } finally {
    snapshot.items[0] = previousTask
    mockAuthState.user = previousUser
  }
})

test('non-customer-service special read-only status never reveals linked-before task notification history', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousTask = { ...snapshot.items[0] }
  const previousUser = { ...mockAuthState.user }
  mockAuthState.user = { id: 'u1', username: 'tester', role: 'cleaner' }
  snapshot.items[0] = {
    ...previousTask,
    work_record_read_only: true,
    work_record_visible: true,
    work_record_state: 'completed',
    completed_by_user_id: 'u1',
    execution_role: 'cleaning',
    available_actions: [],
    read_only_views: { guest_context: true, media_scope: 'cleaner', media_source_ids: [] },
    guest_ready_notification: {
      source_type: 'orders',
      source_id: 'order-special',
      order_id: 'order-special',
      task_id: null,
      association_state: 'order_bound',
      status: 'notified',
      notified_at: '2026-11-01T01:00:00.000Z',
      notified_by_name: 'Support',
      version: 1,
      requirement_reasons: ['early_arrival'],
      prior_task_notification: {
        task_id: 'manual-checkin-1',
        status: 'notified',
        notified_at: '2026-11-01T00:30:00.000Z',
        notified_by_user_id: 'cs-1',
        notified_by_name: 'Private Support',
        version: 1,
        last_action: 'mark',
        last_action_at: '2026-11-01T00:30:00.000Z',
        last_actor_user_id: 'cs-1',
        last_actor_name: 'Private Support',
        read_only_reason: 'linked_to_order',
      },
    },
  }

  try {
    const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>
    const ui = render(
      <I18nProvider>
        <TaskDetailScreen navigation={{ goBack: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'special-notification-role-boundary', name: 'TaskDetail', params: { id: 'w1' } } as any} />
      </I18nProvider>,
    )
    await waitFor(() => expect(ui.getByText(/客人入住通知：已由 Support/)).toBeTruthy())
    expect(ui.queryByTestId('guest-ready-prior-task-record')).toBeNull()
    expect(ui.queryByText(/Private Support/)).toBeNull()
  } finally {
    snapshot.items[0] = previousTask
    mockAuthState.user = previousUser
  }
})

test('inspector completed record can view inspection photos and the exact-task guest key photo without edit controls', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousTask = { ...snapshot.items[0] }
  const previousUser = { ...mockAuthState.user }
  const api = require('../../lib/api')
  mockAuthState.user = { id: 'u1', username: 'tester', role: 'cleaning_inspector' }
  snapshot.items[0] = {
    ...previousTask,
    work_record_read_only: true,
    work_record_visible: true,
    work_record_state: 'completed',
    completed_by_user_id: 'u1',
    execution_role: 'inspection',
    source_ids: ['ct1'],
    active_source_ids: ['ct1'],
    key_photo_url: 'mzapp/key-photo.jpg',
    available_actions: [],
    read_only_views: {
      property_access: true,
      lock_codes: true,
      lockbox_video: true,
      cleaner_photos: false,
      inspection_photos: true,
      guest_key_photo: true,
      media_scope: 'inspector',
      media_source_ids: ['checkout-ct', 'ct1'],
    },
  }
  api.getWorkTaskFormPhotos.mockResolvedValueOnce({
    items: [
      { id: 'inspection-1', task_id: 'ct1', source: 'inspection', area: 'living', url: 'mzapp/inspection-1.jpg' },
      { id: 'inspection-video', task_id: 'ct1', source: 'lockbox_video', area: 'key_handover', url: 'cleaning/inspection-lockbox.mp4' },
    ],
  })
  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>

  try {
    const ui = render(
      <I18nProvider>
        <TaskDetailScreen navigation={{ goBack: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'completed-inspector', name: 'TaskDetail', params: { id: 'w1' } } as any} />
      </I18nProvider>,
    )
    await waitFor(() => {
      expect(api.getWorkTaskFormPhotos).toHaveBeenCalledWith('t1', 'w1', ['checkout-ct', 'ct1'], 'inspector', { includeVideos: true })
      expect(ui.getByTestId('task-detail-key-photo')).toBeTruthy()
      expect(ui.getByTestId('task-detail-read-only-photo-0')).toBeTruthy()
      expect(ui.getByTestId('task-detail-lockbox-video')).toBeTruthy()
      expect(ui.queryByTestId('task-detail-delete-key-photo')).toBeNull()
    })
  } finally {
    snapshot.items[0] = previousTask
    mockAuthState.user = previousUser
  }
})

test('password-only execution history shows its exact lockbox video without cleaner photos or edit controls', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousTask = { ...snapshot.items[0] }
  const previousUser = { ...mockAuthState.user }
  const api = require('../../lib/api')
  mockAuthState.user = { id: 'mia-1', username: 'Mia', role: 'cleaning_inspector' }
  snapshot.items[0] = {
    ...previousTask,
    id: 'password-only-record',
    task_kind: 'execution',
    task_type: 'checkin_clean',
    inspection_scope: 'password_only',
    execution_role: 'execution',
    execution_semantics: 'key_or_password_action',
    source_id: 'password-only-source',
    source_ids: ['password-only-source'],
    active_source_ids: ['password-only-source'],
    work_record_read_only: true,
    work_record_visible: true,
    work_record_state: 'completed',
    completed_by_user_id: 'mia-1',
    available_actions: [],
    read_only_views: {
      property_access: true,
      guest_context: true,
      lock_codes: false,
      lockbox_video: true,
      cleaner_photos: false,
      inspection_photos: false,
      guest_key_photo: false,
      media_scope: 'inspector',
      media_source_ids: ['password-only-source'],
    },
  }
  api.getWorkTaskFormPhotos.mockResolvedValueOnce({
    items: [
      { id: 'password-only-video', task_id: 'password-only-source', source: 'lockbox_video', area: 'key_handover', url: 'cleaning/password-only-lockbox.mov' },
      { id: 'cleaner-completion', task_id: 'password-only-source', source: 'completion', area: 'living', url: 'cleaning/cleaner-completion.jpg' },
      { id: 'inspection-photo', task_id: 'password-only-source', source: 'inspection', label: '检查照片不应显示', url: 'cleaning/inspection.jpg' },
      { id: 'restock-photo', task_id: 'password-only-source', source: 'restock', label: '补品照片不应显示', url: 'cleaning/restock.jpg' },
    ],
  })
  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>

  try {
    const ui = render(
      <I18nProvider>
        <TaskDetailScreen navigation={{ goBack: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'password-only-record', name: 'TaskDetail', params: { id: 'password-only-record' } } as any} />
      </I18nProvider>,
    )
    await waitFor(() => {
      expect(api.getWorkTaskFormPhotos).toHaveBeenCalledWith('t1', 'password-only-record', ['password-only-source'], 'inspector', { includeVideos: true })
      expect(ui.getByTestId('task-detail-lockbox-video')).toBeTruthy()
      expect(ui.queryByTestId('task-detail-read-only-photos')).toBeNull()
      expect(ui.queryByText('检查照片不应显示')).toBeNull()
      expect(ui.queryByText('补品照片不应显示')).toBeNull()
      expect(ui.queryByTestId('task-detail-delete-key-photo')).toBeNull()
      expect(ui.getByText('这是只读工作记录，不提供执行操作。')).toBeTruthy()
    })
  } finally {
    snapshot.items[0] = previousTask
    mockAuthState.user = previousUser
  }
})

test('cleaning task with empty server actions does not fall back to generic mark flow', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousActions = snapshot.items[0].available_actions
  snapshot.items[0].available_actions = []
  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>

  const ui = render(
    <I18nProvider>
      <TaskDetailScreen navigation={{ goBack: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'k-empty-cleaning-actions', name: 'TaskDetail', params: { id: 'w1' } } as any} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText('当前任务暂无可用操作，请刷新任务后重试。')).toBeTruthy()
    expect(ui.queryByText('拍照上传')).toBeNull()
    expect(ui.queryByText('标记完成')).toBeNull()
  })

  snapshot.items[0].available_actions = previousActions
})

test('maintenance executor complete and unfinished controls share the same flexible width', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousTask = { ...snapshot.items[0] }
  snapshot.items[0] = {
    ...previousTask,
    id: 'property_maintenance:m1',
    task_kind: 'maintenance',
    source_type: 'property_maintenance',
    source_id: 'm1',
    status: 'assigned',
    available_actions: [],
    maintenance_workflow: { status: 'assigned', available_actions: ['executor_complete', 'executor_unfinished'] },
  }
  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>

  try {
    const ui = render(
      <I18nProvider>
        <TaskDetailScreen navigation={{ goBack: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'maintenance-width', name: 'TaskDetail', params: { id: 'property_maintenance:m1' } } as any} />
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(ui.getByTestId('maintenance-task-complete')).toBeTruthy()
      expect(ui.getByTestId('maintenance-task-not-complete')).toBeTruthy()
    })

    const completeStyle = StyleSheet.flatten(ui.getByTestId('maintenance-task-complete').props.style)
    const unfinishedStyle = StyleSheet.flatten(ui.getByTestId('maintenance-task-not-complete').props.style)
    expect(completeStyle).toEqual(expect.objectContaining({ flex: 1, flexBasis: 0, minWidth: 0 }))
    expect(unfinishedStyle).toEqual(expect.objectContaining({ flex: 1, flexBasis: 0, minWidth: 0 }))
  } finally {
    snapshot.items[0] = previousTask
  }
})

test('maintenance executor completion uses the dedicated workflow action instead of generic task marking', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousTask = { ...snapshot.items[0] }
  const api = require('../../lib/api')
  const photoDraft = require('../../lib/maintenanceCompletionPhotoDraft')
  const navigation = { goBack: jest.fn(), setParams: jest.fn() }
  snapshot.items[0] = {
    ...previousTask,
    id: 'property_maintenance:m1',
    task_kind: 'maintenance',
    source_type: 'property_maintenance',
    source_id: 'm1',
    status: 'assigned',
    available_actions: [],
    maintenance_workflow: { status: 'assigned', available_actions: ['executor_complete', 'executor_unfinished'] },
  }
  photoDraft.getMaintenanceCompletionPhotoDraft.mockResolvedValueOnce([{
    media_id: 'maintenance-photo-1',
    local_uri: 'file:///tmp/maintenance-completion.jpg',
    remote_reference: 'mzapp/maintenance-completion.jpg',
    name: 'maintenance-completion.jpg',
    mime_type: 'image/jpeg',
    captured_at: '2026-08-19T00:00:00.000Z',
  }])
  api.markWorkTask.mockClear()

  try {
    const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>
    const ui = render(
      <I18nProvider>
        <TaskDetailScreen navigation={navigation as any} route={{ key: 'maintenance-workflow-complete', name: 'TaskDetail', params: { id: 'property_maintenance:m1' } } as any} />
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(ui.getByText('已上传 1 张照片，可继续追加或删除')).toBeTruthy()
    })
    fireEvent.press(ui.getByTestId('maintenance-task-complete'))

    await waitFor(() => {
      expect(api.submitMaintenanceExecutorAction).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({
          domain: 'internal',
          recordId: 'm1',
          action: 'executor_complete',
          completionPhotoUrls: ['mzapp/maintenance-completion.jpg'],
        }),
      )
      expect(navigation.goBack).toHaveBeenCalled()
    })
    expect(api.markWorkTask).not.toHaveBeenCalled()
  } finally {
    snapshot.items[0] = previousTask
  }
})

test('task detail hides weak-network key sync error text while keeping pending state', async () => {
  mockKeyQueueItem = {
    cleaning_task_id: 'ct1',
    local_uri: 'file:///tmp/key.jpg',
    last_error: 'Network request failed',
  }
  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>

  const ui = render(
    <I18nProvider>
      <TaskDetailScreen navigation={{ goBack: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'k-network', name: 'TaskDetail', params: { id: 'w1' } } as any} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText('钥匙照片待同步')).toBeTruthy()
  })

  expect(ui.queryByText('Network request failed')).toBeNull()
})

test('key recorded and supplies actions use compact equal-width buttons', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousTask = { ...snapshot.items[0] }
  const previousUser = mockAuthState.user
  mockAuthState.user = { id: 'inspector-1', username: 'inspector', role: 'cleaning_inspector', roles: ['cleaning_inspector'] }
  snapshot.items[0] = {
    ...previousTask,
    key_photo_url: 'https://example.com/key.jpg',
    lockbox_video_url: 'https://example.com/lockbox.mp4',
    available_actions: [
      { id: 'upload_key_photo', label: '上传钥匙', placement: 'primary', enabled: false, disabled_reason: 'already_recorded', target: 'TaskDetail', intent: 'cleaning' },
      { id: 'fill_supplies', label: '补品填报', placement: 'primary', enabled: true, target: 'SuppliesForm', intent: 'cleaning' },
      { id: 'report_issue', label: '房源问题反馈', placement: 'more', enabled: true, target: 'FeedbackForm', intent: 'issue' },
    ],
  }
  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>

  try {
    const ui = render(
      <I18nProvider>
        <TaskDetailScreen navigation={{ goBack: jest.fn(), navigate: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'k-key-actions', name: 'TaskDetail', params: { id: 'w1' } } as any} />
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(ui.getByText('钥匙已记录')).toBeTruthy()
      expect(ui.queryByText('已记录')).toBeNull()
      expect(ui.getByText('补品填报')).toBeTruthy()
      expect(ui.getByText('房源问题反馈')).toBeTruthy()
    })

    const keyPhotoStyle = StyleSheet.flatten(ui.getByTestId('task-detail-key-photo').props.style)
    const videoStyle = StyleSheet.flatten(ui.getByTestId('task-detail-lockbox-video').props.style)
    expect(keyPhotoStyle).toEqual(expect.objectContaining({ width: '100%', height: videoStyle.height }))

    expect(ui.getByTestId('task-detail-action-w1-upload_key_photo').props.style).toEqual(expect.arrayContaining([
      expect.objectContaining({ flex: 1, flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 }),
      expect.objectContaining({ minHeight: 44, paddingVertical: 0 }),
    ]))
    expect(ui.getByTestId('task-detail-action-w1-fill_supplies').props.style).toEqual(expect.arrayContaining([
      expect.objectContaining({ flex: 1, flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 }),
      expect.objectContaining({ minHeight: 44, paddingVertical: 0 }),
    ]))
    expect(ui.getByTestId('task-detail-action-w1-report_issue').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ width: '100%', flexBasis: '100%' })]))
  } finally {
    snapshot.items[0] = previousTask
    mockAuthState.user = previousUser
  }
})

test('inspection lockbox completion keeps unfinished cleaning supplies action active', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousTask = { ...snapshot.items[0] }
  const navigation = { goBack: jest.fn(), navigate: jest.fn(), setParams: jest.fn() }
  snapshot.items[0] = {
    ...previousTask,
    status: 'keys_hung',
    cleaning_status: 'assigned',
    cleaning_submission_ready: false,
    lockbox_video_url: 'https://example.com/lockbox.mp4',
    key_handover: {
      state: 'completed',
      source_task_id: 'ct-1',
      completed_at: '2026-10-20T02:32:15.623Z',
      workflow_finalization_pending: true,
      missing_requirements: ['cleaning_consumables', 'cleaning_property_photo'],
    },
    available_actions: [
      { id: 'fill_supplies', label: '补品填报', placement: 'primary', enabled: true, target: 'SuppliesForm', intent: 'cleaning' },
    ],
  }
  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>

  try {
    const ui = render(
      <I18nProvider>
        <TaskDetailScreen navigation={navigation as any} route={{ key: 'k-unfinished-cleaning', name: 'TaskDetail', params: { id: 'w1' } } as any} />
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(ui.getByText('已挂钥匙')).toBeTruthy()
      expect(ui.getByText('挂钥匙已完成')).toBeTruthy()
      expect(ui.getByText('资料待补：补品记录、房源照片')).toBeTruthy()
      expect(ui.getByText('任务整体仍未完成，请按下方操作补齐资料。')).toBeTruthy()
      expect(ui.getByText('补品填报')).toBeTruthy()
      expect(ui.queryByText('补品已记录')).toBeNull()
    })
    expect(ui.getByTestId('task-detail-action-w1-fill_supplies').props.disabled).not.toBe(true)
    fireEvent.press(ui.getByTestId('task-detail-action-w1-fill_supplies'))
    expect(navigation.navigate).toHaveBeenCalledWith('SuppliesForm', { taskId: 'w1' })
  } finally {
    snapshot.items[0] = previousTask
  }
})

test('ordinary cleaner cannot see lockbox video in task detail', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousTask = { ...snapshot.items[0] }
  const previousUser = mockAuthState.user
  mockAuthState.user = { id: 'cleaner-1', username: 'cleaner', role: 'cleaner', roles: ['cleaner'] }
  snapshot.items[0] = {
    ...previousTask,
    source_type: 'cleaning_tasks',
    task_kind: 'cleaning',
    lockbox_video_url: 'https://example.com/lockbox.mp4',
  }
  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>

  try {
    const ui = render(
      <I18nProvider>
        <TaskDetailScreen navigation={{ goBack: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'k-cleaner-lockbox', name: 'TaskDetail', params: { id: 'w1' } } as any} />
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(ui.queryByText('执行人上传的视频')).toBeNull()
      expect(ui.queryByTestId('task-detail-lockbox-video')).toBeNull()
    })
  } finally {
    snapshot.items[0] = previousTask
    mockAuthState.user = previousUser
  }
})

test('self-complete cleaner can replay only the exact-source historical lockbox video', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousTask = { ...snapshot.items[0] }
  const previousUser = mockAuthState.user
  const api = require('../../lib/api')
  mockAuthState.user = { id: 'cleaner-1', username: 'cleaner', role: 'cleaner', roles: ['cleaner'] }
  api.getWorkTaskFormPhotos.mockResolvedValueOnce({
    items: [
      {
        id: 'self-lockbox-video',
        task_id: 'self-complete-source',
        source: 'lockbox_video',
        area: 'key_handover',
        label: '挂钥匙视频',
        url: 'cleaning/self-complete-lockbox.mp4',
      },
    ],
  })
  snapshot.items[0] = {
    ...previousTask,
    id: 'self-complete-history',
    source_type: 'cleaning_tasks',
    source_id: 'self-complete-source',
    task_kind: 'cleaning',
    task_type: 'checkout_clean',
    status: 'done',
    inspection_mode: 'self_complete',
    work_record_visible: true,
    work_record_state: 'completed',
    work_record_read_only: true,
    read_only_views: {
      property_access: true,
      guest_context: true,
      lock_codes: true,
      lockbox_video: true,
      cleaner_photos: true,
      inspection_photos: false,
      guest_key_photo: true,
      media_scope: 'cleaner',
      media_source_ids: ['self-complete-source'],
    },
  }
  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>

  try {
    const ui = render(
      <I18nProvider>
        <TaskDetailScreen navigation={{ goBack: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'self-complete-history-video', name: 'TaskDetail', params: { id: 'self-complete-history' } } as any} />
      </I18nProvider>,
    )

    await waitFor(() => expect(ui.getByTestId('task-detail-lockbox-video')).toBeTruthy())
    expect(api.getWorkTaskFormPhotos).toHaveBeenCalledWith(
      't1',
      'self-complete-history',
      ['self-complete-source'],
      'cleaner',
      { includeVideos: true },
    )
    const video = ui.getByTestId('task-detail-lockbox-video').findByType(require('expo-av').Video)
    expect(video.props.source).toEqual({
      uri: expect.stringContaining('variant=source'),
      headers: { Authorization: 'Bearer t1', 'Cache-Control': 'no-cache, no-store', Pragma: 'no-cache' },
    })
    expect(String(video.props.source.uri)).toContain('source_task_id=self-complete-source')
    expect(String(video.props.source.uri)).toContain('media_scope=cleaner')
    expect(ui.queryByTestId('task-detail-read-only-photo-0')).toBeNull()
  } finally {
    snapshot.items[0] = previousTask
    mockAuthState.user = previousUser
  }
})

test('completed supplies action is gray, uses one label, and opens read-only photo view', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousTask = { ...snapshot.items[0] }
  const navigation = { goBack: jest.fn(), navigate: jest.fn(), setParams: jest.fn() }
  snapshot.items[0] = {
    ...previousTask,
    status: 'completed',
    available_actions: [
      { id: 'fill_supplies', label: '补品记录', placement: 'primary', enabled: false, disabled_reason: 'task_completed', target: 'SuppliesForm', intent: 'cleaning' },
      { id: 'report_issue', label: '房源问题反馈', placement: 'more', enabled: true, target: 'FeedbackForm', intent: 'issue' },
    ],
  }
  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>

  try {
    const ui = render(
      <I18nProvider>
        <TaskDetailScreen navigation={navigation as any} route={{ key: 'k-completed-supplies', name: 'TaskDetail', params: { id: 'w1' } } as any} />
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(ui.getByText('补品已记录')).toBeTruthy()
      expect(ui.queryByTestId('task-detail-supplies-status')).toBeNull()
      expect(ui.queryByText('任务已完成')).toBeNull()
    })
    expect(ui.getByTestId('task-detail-action-w1-fill_supplies').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ backgroundColor: '#E5E7EB' })]))

    fireEvent.press(ui.getByTestId('task-detail-action-w1-fill_supplies'))
    expect(navigation.navigate).toHaveBeenCalledWith('SuppliesForm', { taskId: 'w1', readOnly: true })
  } finally {
    snapshot.items[0] = previousTask
  }
})

test('self-complete cleaned task keeps exact-source key handover and read-only supplies actions', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousTask = { ...snapshot.items[0] }
  const navigation = { goBack: jest.fn(), navigate: jest.fn(), setParams: jest.fn() }
  snapshot.items[0] = {
    ...previousTask,
    source_id: 'cleaning-la910',
    source_type: 'cleaning_tasks',
    task_kind: 'cleaning',
    task_type: 'checkout_clean',
    status: 'to_hang_keys',
    inspection_mode: 'self_complete',
    cleaning_submission_ready: true,
    work_record_read_only: false,
    available_actions: [
      { id: 'fill_supplies', label: '补品记录', placement: 'primary', enabled: false, disabled_reason: 'task_completed', read_only: true, target: 'SuppliesForm', intent: 'cleaning', source_type: 'cleaning_tasks', source_id: 'cleaning-la910' },
      { id: 'upload_access_video', label: '挂钥匙并完成', placement: 'primary', enabled: true, target: 'InspectionComplete', intent: 'site_action', source_type: 'cleaning_tasks', source_id: 'cleaning-la910' },
      { id: 'report_issue', label: '问题反馈与报修记录', placement: 'more', enabled: true, target: 'FeedbackForm', intent: 'issue', source_type: 'cleaning_tasks', source_id: 'cleaning-la910' },
    ],
  }
  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>

  try {
    const ui = render(
      <I18nProvider>
        <TaskDetailScreen navigation={navigation as any} route={{ key: 'k-self-complete-handover', name: 'TaskDetail', params: { id: 'w1' } } as any} />
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(ui.getByText('补品已记录')).toBeTruthy()
      expect(ui.getByText('挂钥匙并完成')).toBeTruthy()
      expect(ui.getByText('问题反馈与报修记录')).toBeTruthy()
    })
    fireEvent.press(ui.getByTestId('task-detail-action-w1-fill_supplies'))
    expect(navigation.navigate).toHaveBeenCalledWith('SuppliesForm', { taskId: 'w1', readOnly: true })
    fireEvent.press(ui.getByTestId('task-detail-action-w1-upload_access_video'))
    expect(navigation.navigate).toHaveBeenCalledWith('InspectionComplete', {
      taskId: 'w1',
      sourceId: 'cleaning-la910',
      skipInspectionPhotos: true,
    })
  } finally {
    snapshot.items[0] = previousTask
  }
})

test('deleted key photo remains re-uploadable after cleaning submission', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousTask = { ...snapshot.items[0] }
  snapshot.items[0] = {
    ...previousTask,
    status: 'done',
    key_photo_url: null,
    available_actions: [
      { id: 'upload_key_photo', label: '上传钥匙', placement: 'primary', enabled: true, target: 'TaskDetail', intent: 'cleaning' },
      { id: 'fill_supplies', label: '补品记录', placement: 'primary', enabled: false, disabled_reason: 'task_completed', target: 'SuppliesForm', intent: 'cleaning' },
    ],
  }
  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>

  try {
    const ui = render(
      <I18nProvider>
        <TaskDetailScreen navigation={{ goBack: jest.fn(), navigate: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'k-deleted-key', name: 'TaskDetail', params: { id: 'w1' } } as any} />
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(ui.getByText('上传钥匙')).toBeTruthy()
      expect(ui.getByTestId('task-detail-action-w1-upload_key_photo').props.disabled).not.toBe(true)
    })
  } finally {
    snapshot.items[0] = previousTask
  }
})

test('completed task action uses one gray label without disabled reason text', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousTask = { ...snapshot.items[0] }
  snapshot.items[0] = {
    ...previousTask,
    task_kind: 'execution',
    status: 'completed',
    available_actions: [
      { id: 'upload_access_video', label: '上传视频并完成', placement: 'primary', enabled: false, disabled_reason: 'task_completed', target: 'InspectionComplete', intent: 'site_action' },
    ],
  }
  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>

  try {
    const ui = render(
      <I18nProvider>
        <TaskDetailScreen navigation={{ goBack: jest.fn(), navigate: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'k-completed-action', name: 'TaskDetail', params: { id: 'w1' } } as any} />
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(ui.getByText('任务已完成')).toBeTruthy()
      expect(ui.queryByText('上传视频并完成')).toBeNull()
    })
    expect(ui.getByTestId('task-detail-action-w1-upload_access_video').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ backgroundColor: '#E5E7EB' })]))
  } finally {
    snapshot.items[0] = previousTask
  }
})

test('completed inspection keeps one completion button and opens read-only inspection photos', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousTask = { ...snapshot.items[0] }
  const navigation = { goBack: jest.fn(), navigate: jest.fn(), setParams: jest.fn() }
  snapshot.items[0] = {
    ...previousTask,
    task_kind: 'inspection',
    task_type: 'checkout_clean',
    inspection_scope: 'inspect_and_hang',
    status: 'keys_hung',
    available_actions: [
      { id: 'submit_inspection', label: '检查与补充', placement: 'primary', enabled: false, disabled_reason: 'task_completed', read_only: true, target: 'InspectionPanel', intent: 'inspection', source_id: 'ct-inspection' },
      { id: 'upload_access_video', label: '挂钥匙并完成', placement: 'primary', enabled: false, disabled_reason: 'task_completed', target: 'InspectionComplete', intent: 'site_action', source_id: 'ct-inspection' },
    ],
  }
  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>

  try {
    const ui = render(
      <I18nProvider>
        <TaskDetailScreen navigation={navigation as any} route={{ key: 'k-completed-inspection', name: 'TaskDetail', params: { id: 'w1' } } as any} />
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(ui.getByText('查看检查照片')).toBeTruthy()
      expect(ui.getByText('任务已完成')).toBeTruthy()
      expect(ui.queryByText('检查与补充')).toBeNull()
    })

    fireEvent.press(ui.getByTestId('task-detail-action-w1-submit_inspection'))
    expect(navigation.navigate).toHaveBeenCalledWith('InspectionPanel', { taskId: 'w1', sourceId: 'ct-inspection', readOnly: true })
  } finally {
    snapshot.items[0] = previousTask
  }
})

test('stayover cleaning task hides key upload and shows stayover label', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  snapshot.items[0].task_type = 'stayover_clean'
  snapshot.items[0].start_time = null
  snapshot.items[0].end_time = null
  snapshot.items[0].status = 'assigned'
  snapshot.items[0].note = '10点可以去'

  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TaskDetailScreen navigation={{ goBack: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'k3', name: 'TaskDetail', params: { id: 'w1' } } as any} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText('入住中清洁')).toBeTruthy()
    expect(ui.queryByText(/upload key|上传钥匙/i)).toBeNull()
    expect(ui.queryByText('自完成')).toBeNull()
    expect(ui.getByText('标记已完成')).toBeTruthy()
    expect(ui.getByText(/备注：10点可以去/)).toBeTruthy()
  })

  snapshot.items[0].task_type = undefined
  snapshot.items[0].start_time = '10am'
  snapshot.items[0].end_time = '3pm'
  snapshot.items[0].note = undefined
})

test('deferred inspection task uses 延期检查 title instead of 退房', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  snapshot.items[0].task_kind = 'inspection'
  snapshot.items[0].inspection_mode = 'deferred'
  snapshot.items[0].status = 'assigned'
  snapshot.items[0].start_time = '10am'
  snapshot.items[0].end_time = null

  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TaskDetailScreen navigation={{ goBack: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'k4', name: 'TaskDetail', params: { id: 'w1' } } as any} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText('X 延期检查')).toBeTruthy()
    expect(ui.queryByText('X 退房')).toBeNull()
  })

  snapshot.items[0].task_kind = 'cleaning'
  snapshot.items[0].inspection_mode = undefined
})

test('merged deferred inspection uses the authoritative execution-day check-in title', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousTask = { ...snapshot.items[0] }
  snapshot.items[0].task_kind = 'inspection'
  snapshot.items[0].task_type = 'checkin_clean'
  snapshot.items[0].inspection_mode = 'deferred'
  snapshot.items[0].status = 'assigned'
  snapshot.items[0].start_time = '10am'
  snapshot.items[0].end_time = '3pm'
  snapshot.items[0].deferred_inspection_merged = true
  snapshot.items[0].deferred_inspection_current_day_checkout = false

  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TaskDetailScreen navigation={{ goBack: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'k4-merged', name: 'TaskDetail', params: { id: 'w1' } } as any} />
    </I18nProvider>,
  )

  try {
    await waitFor(() => {
      expect(ui.getByText('X 入住')).toBeTruthy()
      expect(ui.queryByText('X 延期检查')).toBeNull()
      expect(ui.queryByText('X 退房 入住')).toBeNull()
    })
  } finally {
    ui.unmount()
    snapshot.items[0] = previousTask
  }
})

test('password-only inspection task shows explicit execution scope', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  snapshot.items[0].task_kind = 'inspection'
  snapshot.items[0].task_type = 'checkin_clean'
  snapshot.items[0].inspection_scope = 'password_only'
  snapshot.items[0].inspection_mode = 'same_day'
  snapshot.items[0].status = 'assigned'
  snapshot.items[0].start_time = null
  snapshot.items[0].end_time = '3pm'

  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TaskDetailScreen navigation={{ goBack: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'k5', name: 'TaskDetail', params: { id: 'w1' } } as any} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText('检查执行方式：仅改密码')).toBeTruthy()
    expect(ui.queryByText('同日检查')).toBeNull()
    expect(ui.queryByText('自完成')).toBeNull()
    expect(ui.queryByText('已检查')).toBeNull()
  })

  snapshot.items[0].task_kind = 'cleaning'
  snapshot.items[0].task_type = undefined
  snapshot.items[0].inspection_scope = undefined
  snapshot.items[0].inspection_mode = undefined
  snapshot.items[0].start_time = '10am'
  snapshot.items[0].end_time = '3pm'
})

test('customer service password-only task hides checkout and shows executor video', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousTask = { ...snapshot.items[0] }
  const previousUser = mockAuthState.user
  mockAuthState.user = { id: 'cs-1', username: 'customer-service', role: 'customer_service', roles: ['customer_service'] }
  snapshot.items[0] = {
    ...previousTask,
    task_kind: 'inspection',
    task_type: 'checkin_clean',
    inspection_scope: 'password_only',
    inspection_mode: 'same_day',
    status: 'keys_hung',
    start_time: null,
    end_time: '3pm',
    order_id: 'order-checkin-only',
    lockbox_video_url: 'https://example.test/executor-password-video.mp4',
    available_actions: [
      { id: 'report_issue', label: '问题反馈', placement: 'primary', enabled: true, target: 'FeedbackForm', intent: 'issue' },
    ],
  }

  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TaskDetailScreen navigation={{ goBack: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'k-cs-password-only', name: 'TaskDetail', params: { id: 'w1' } } as any} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.queryByText('标记已退房')).toBeNull()
    expect(ui.getByText('问题反馈')).toBeTruthy()
    expect(ui.getByText('执行人上传的视频')).toBeTruthy()
  })

  snapshot.items[0] = previousTask
  mockAuthState.user = previousUser
})

test('offline task photos force a historical HTTPS reference through the exact-task authenticated reader', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousTask = { ...snapshot.items[0] }
  const offlineTaskId = 'cleaning_offline_tasks:offline-historical-task-photo'
  const taskPhotoReference = 'https://current-public-base.r2.dev/historical/offline-task-photo.jpg'
  snapshot.items[0] = {
    ...previousTask,
    id: offlineTaskId,
    task_kind: 'offline',
    source_type: 'cleaning_offline_tasks',
    source_id: 'offline-historical-task-photo-source',
    status: 'todo',
    photo_urls: [taskPhotoReference],
    completion_photo_urls: [],
  }

  try {
    const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>
    const ui = render(
      <I18nProvider>
        <TaskDetailScreen navigation={{ goBack: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'offline-historical-task-photo', name: 'TaskDetail', params: { id: offlineTaskId } } as any} />
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(ui.getByLabelText(`${taskPhotoReference}|${offlineTaskId}`)).toHaveProp('offlineWorkTaskMedia', true)
    })
    fireEvent.press(ui.getByLabelText(`${taskPhotoReference}|${offlineTaskId}`))
    await waitFor(() => {
      expect(ui.getByTestId('cleaning-media-preview')).toHaveProp('offlineWorkTaskMedia', true)
      expect(ui.getByTestId('cleaning-media-preview')).toHaveProp('accessibilityLabel', `${taskPhotoReference}|${offlineTaskId}`)
    })
  } finally {
    snapshot.items[0] = previousTask
  }
})

test('internal maintenance detail refreshes a cached task once and renders returned before-repair photos', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousTask = { ...snapshot.items[0] }
  const refreshMock = store.requestWorkTasksRefresh as jest.Mock
  snapshot.items[0] = {
    ...previousTask,
    task_kind: 'maintenance',
    source_type: 'property_maintenance',
    source_id: 'maintenance-stale-cache-1',
    title: 'R-20260803-GHCG',
    summary: '洗衣房门故障',
    maintenance_before_photo_urls: undefined,
    available_actions: [],
  }
  refreshMock.mockClear()
  refreshMock.mockImplementationOnce(async () => {
    await store.patchWorkTaskItem('w1', {
      maintenance_before_photo_urls: ['mzapp/maintenance-before-refreshed.jpg'],
    })
  })
  try {
    const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>
    const ui = render(
      <I18nProvider>
        <TaskDetailScreen navigation={{ goBack: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'maintenance-before-refresh', name: 'TaskDetail', params: { id: 'w1' } } as any} />
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalledTimes(1)
      expect(refreshMock).toHaveBeenCalledWith(expect.objectContaining({ token: 't1', userId: 'u1', view: 'mine' }))
      expect(snapshot.items[0].maintenance_before_photo_urls).toEqual(['mzapp/maintenance-before-refreshed.jpg'])
      expect(ui.getByText('维修前照片')).toBeTruthy()
      expect(ui.getByTestId('maintenance-before-photo-0')).toBeTruthy()
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(refreshMock).toHaveBeenCalledTimes(1)
  } finally {
    refreshMock.mockReset()
    refreshMock.mockImplementation(async () => {})
    snapshot.items[0] = previousTask
  }
})

test('internal maintenance detail keeps the cached task usable when its one refresh fails', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousTask = { ...snapshot.items[0] }
  const refreshMock = store.requestWorkTasksRefresh as jest.Mock
  snapshot.items[0] = {
    ...previousTask,
    task_kind: 'maintenance',
    source_type: 'property_maintenance',
    source_id: 'maintenance-refresh-failure-1',
    title: 'R-20260803-GHCG',
    summary: '洗衣房门故障',
    maintenance_before_photo_urls: undefined,
    available_actions: [],
  }
  refreshMock.mockClear()
  refreshMock.mockRejectedValueOnce(new Error('network unavailable'))
  try {
    const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>
    const ui = render(
      <I18nProvider>
        <TaskDetailScreen navigation={{ goBack: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'maintenance-before-refresh-failure', name: 'TaskDetail', params: { id: 'w1' } } as any} />
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalledTimes(1)
      expect(ui.getByText('洗衣房门故障')).toBeTruthy()
      expect(ui.queryByText('维修前照片')).toBeNull()
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(refreshMock).toHaveBeenCalledTimes(1)
    expect(snapshot.items[0].source_id).toBe('maintenance-refresh-failure-1')
  } finally {
    refreshMock.mockReset()
    refreshMock.mockImplementation(async () => {})
    snapshot.items[0] = previousTask
  }
})

test('key handover execution task shows user-facing password-only label and video action', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  snapshot.items[0].task_kind = 'execution'
  snapshot.items[0].execution_role = undefined
  snapshot.items[0].execution_semantics = undefined
  snapshot.items[0].task_type = 'checkin_clean'
  snapshot.items[0].inspection_scope = 'password_only'
  snapshot.items[0].inspection_mode = 'same_day'
  snapshot.items[0].status = 'assigned'
  snapshot.items[0].start_time = null
  snapshot.items[0].end_time = '3pm'

  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TaskDetailScreen navigation={{ goBack: jest.fn(), navigate: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'k-exec', name: 'TaskDetail', params: { id: 'w1' } } as any} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText('检查/挂钥匙')).toBeTruthy()
    expect(ui.getByText('检查执行方式：仅改密码')).toBeTruthy()
    expect(ui.getByText('上传视频并完成')).toBeTruthy()
    expect(ui.queryByText('execution')).toBeNull()
  })

  snapshot.items[0].task_kind = 'cleaning'
  snapshot.items[0].execution_role = undefined
  snapshot.items[0].execution_semantics = undefined
  snapshot.items[0].task_type = undefined
  snapshot.items[0].inspection_scope = undefined
  snapshot.items[0].inspection_mode = undefined
  snapshot.items[0].start_time = '10am'
  snapshot.items[0].end_time = '3pm'
})

test('check-in site execution task shows scope and assignee in detail', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  snapshot.items[0].task_kind = 'execution'
  snapshot.items[0].execution_role = 'inspection'
  snapshot.items[0].execution_semantics = 'checkin_inspection'
  snapshot.items[0].task_type = 'checkin_clean'
  snapshot.items[0].inspection_scope = 'inspect_and_hang'
  snapshot.items[0].inspection_mode = 'same_day'
  snapshot.items[0].status = 'assigned'
  snapshot.items[0].start_time = null
  snapshot.items[0].end_time = '3pm'
  snapshot.items[0].assignee_id = 'carrie-id'
  snapshot.items[0].assignee_name = 'Carrie'
  snapshot.items[0].executor_name = null
  snapshot.items[0].cleaner_name = null
  snapshot.items[0].inspector_name = null

  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TaskDetailScreen navigation={{ goBack: jest.fn(), navigate: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'k-checkin-exec', name: 'TaskDetail', params: { id: 'w1' } } as any} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText('检查/挂钥匙')).toBeTruthy()
    expect(ui.getByText('检查执行方式：检查后挂钥匙')).toBeTruthy()
    expect(ui.getByText('执行人员：Carrie')).toBeTruthy()
    expect(ui.queryByText('execution')).toBeNull()
  })

  snapshot.items[0].task_kind = 'cleaning'
  snapshot.items[0].execution_role = undefined
  snapshot.items[0].execution_semantics = undefined
  snapshot.items[0].task_type = undefined
  snapshot.items[0].inspection_scope = undefined
  snapshot.items[0].inspection_mode = undefined
  snapshot.items[0].start_time = '10am'
  snapshot.items[0].end_time = '3pm'
  snapshot.items[0].assignee_id = null
  snapshot.items[0].assignee_name = undefined
  snapshot.items[0].executor_name = undefined
  snapshot.items[0].cleaner_name = undefined
  snapshot.items[0].inspector_name = undefined
})

test('legacy password-only check-in detail shows generic executor instead of cleaner', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousTask = { ...snapshot.items[0] }
  snapshot.items[0] = {
    ...previousTask,
    task_kind: 'cleaning',
    execution_role: undefined,
    execution_semantics: undefined,
    task_type: 'checkin_clean',
    inspection_scope: 'password_only',
    inspection_mode: 'same_day',
    status: 'pending',
    start_time: null,
    end_time: '3pm',
    assignee_id: 'oscar-id',
    assignee_name: 'Oscar',
    executor_name: null,
    cleaner_id: null,
    cleaner_name: 'Oscar',
    inspector_id: null,
    inspector_name: null,
    property: { ...previousTask.property, code: 'EQ3401' },
  }

  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TaskDetailScreen navigation={{ goBack: jest.fn(), navigate: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'k-eq3401-password-only', name: 'TaskDetail', params: { id: 'w1' } } as any} />
    </I18nProvider>,
  )

  try {
    await waitFor(() => {
      expect(ui.getByText('检查/挂钥匙')).toBeTruthy()
      expect(ui.getByText('检查执行方式：仅改密码')).toBeTruthy()
      expect(ui.getByText('执行人员：Oscar')).toBeTruthy()
      expect(ui.getByText('已分配')).toBeTruthy()
      expect(ui.getByText('改密码并完成')).toBeTruthy()
      expect(ui.queryByText('清洁人员：Oscar')).toBeNull()
      expect(ui.queryByText('未分配')).toBeNull()
      expect(ui.queryByText('上传钥匙')).toBeNull()
      expect(ui.queryByText('补品填报')).toBeNull()
    })
  } finally {
    snapshot.items[0] = previousTask
  }
})

test('task detail uses server available actions and shows disabled reason', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  snapshot.items[0].available_actions = [
    {
      id: 'submit_inspection',
      label: '后端检查入口',
      placement: 'primary',
      enabled: false,
      disabled_reason: 'not_participant',
      target: 'InspectionPanel',
      intent: 'inspection',
    },
    {
      id: 'report_issue',
      label: '后端问题反馈',
      placement: 'more',
      enabled: true,
      target: 'FeedbackForm',
      intent: 'issue',
    },
  ]

  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TaskDetailScreen navigation={{ goBack: jest.fn(), navigate: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'k-server-actions', name: 'TaskDetail', params: { id: 'w1' } } as any} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText('后端检查入口')).toBeTruthy()
    expect(ui.getByText('你已不再是执行人')).toBeTruthy()
    expect(ui.getByText('后端问题反馈')).toBeTruthy()
    expect(ui.queryByText(/upload key|上传钥匙/i)).toBeNull()
  })

  snapshot.items[0].available_actions = undefined
})

test('empty server available_actions disables legacy task detail actions', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousTask = { ...snapshot.items[0] }
  snapshot.items[0] = {
    ...snapshot.items[0],
    task_kind: 'cleaning',
    task_type: 'checkout_clean',
    status: 'assigned',
    available_actions: [],
  }

  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TaskDetailScreen navigation={{ goBack: jest.fn(), navigate: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'k-empty-server-actions', name: 'TaskDetail', params: { id: 'w1' } } as any} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.queryByText(/upload key|上传钥匙/i)).toBeNull()
    expect(ui.queryByText('补品填报')).toBeNull()
    expect(ui.queryByText('房源问题反馈')).toBeNull()
  })

  snapshot.items[0] = previousTask
})

test('admin can enter inspection flow when submit_inspection is authorized by server action', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousUser = mockAuthState.user
  const previousTask = { ...snapshot.items[0] }
  mockAuthState.user = { id: 'admin-1', username: 'admin-user', role: 'admin', roles: ['admin'] }
  snapshot.items[0] = {
    ...snapshot.items[0],
    task_kind: 'inspection',
    task_type: 'checkout_clean',
    inspection_scope: 'inspect_and_hang',
    inspection_mode: 'same_day',
    status: 'to_inspect',
    available_actions: [
	      {
	        id: 'submit_inspection',
	        label: '开始检查',
	        placement: 'primary',
	        enabled: true,
	        target: 'InspectionPanel',
	        intent: 'inspection',
	        source_id: 'ct-inspection-target',
	      },
	    ],
	  }
  const navigation = { goBack: jest.fn(), navigate: jest.fn(), setParams: jest.fn() }

  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TaskDetailScreen navigation={navigation as any} route={{ key: 'k-admin-inspection', name: 'TaskDetail', params: { id: 'w1' } } as any} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText('开始检查')).toBeTruthy()
  })

  fireEvent.press(ui.getByText('开始检查'))

	expect(navigation.navigate).toHaveBeenCalledWith('InspectionPanel', { taskId: 'w1', sourceId: 'ct-inspection-target' })

  snapshot.items[0] = previousTask
  mockAuthState.user = previousUser
})

test('cleaner can enter password-only access video flow from server action', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousUser = mockAuthState.user
  const previousTask = { ...snapshot.items[0] }
  mockAuthState.user = { id: 'cleaner-1', username: 'cleaner-user', role: 'cleaner', roles: ['cleaner'] }
  snapshot.items[0] = {
    ...snapshot.items[0],
    task_kind: 'inspection',
    task_type: 'checkin_clean',
    inspection_scope: 'password_only',
    inspection_mode: 'same_day',
    status: 'to_hang_keys',
    start_time: null,
    end_time: '3pm',
    available_actions: [
	      {
	        id: 'upload_access_video',
	        label: '改密码视频入口',
	        placement: 'primary',
	        enabled: true,
	        target: 'InspectionComplete',
	        intent: 'site_action',
	        source_id: 'ct-password-target',
	      },
	    ],
	  }
  const navigation = { goBack: jest.fn(), navigate: jest.fn(), setParams: jest.fn() }

  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TaskDetailScreen navigation={navigation as any} route={{ key: 'k-cleaner-video', name: 'TaskDetail', params: { id: 'w1' } } as any} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText('改密码视频入口')).toBeTruthy()
  })

  fireEvent.press(ui.getByText('改密码视频入口'))

	expect(navigation.navigate).toHaveBeenCalledWith('InspectionComplete', { taskId: 'w1', sourceId: 'ct-password-target', skipInspectionPhotos: true })

  snapshot.items[0] = previousTask
  mockAuthState.user = previousUser
})

test('non-participant server disabled action does not navigate even for admin role', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousUser = mockAuthState.user
  const previousTask = { ...snapshot.items[0] }
  mockAuthState.user = { id: 'admin-2', username: 'admin-no-task', role: 'admin', roles: ['admin'] }
  snapshot.items[0] = {
    ...snapshot.items[0],
    task_kind: 'inspection',
    task_type: 'checkout_clean',
    inspection_scope: 'inspect_and_hang',
    inspection_mode: 'same_day',
    status: 'to_inspect',
    available_actions: [
      {
        id: 'submit_inspection',
        label: '不可进入检查',
        placement: 'primary',
        enabled: false,
        disabled_reason: 'not_participant',
        target: 'InspectionPanel',
        intent: 'inspection',
      },
    ],
  }
  const navigation = { goBack: jest.fn(), navigate: jest.fn(), setParams: jest.fn() }

  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TaskDetailScreen navigation={navigation as any} route={{ key: 'k-admin-denied', name: 'TaskDetail', params: { id: 'w1' } } as any} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText('不可进入检查')).toBeTruthy()
    expect(ui.getByText('你已不再是执行人')).toBeTruthy()
  })

  fireEvent.press(ui.getByText('不可进入检查'))

  expect(navigation.navigate).not.toHaveBeenCalled()
  expect(Alert.alert).toHaveBeenCalledWith('暂不可操作', '你已不再是执行人')

  snapshot.items[0] = previousTask
  mockAuthState.user = previousUser
})

test('task detail shows 晚入住 tag when checkin time is later than 6pm', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  snapshot.items[0].task_kind = 'cleaning'
  snapshot.items[0].task_type = undefined
  snapshot.items[0].inspection_scope = undefined
  snapshot.items[0].inspection_mode = undefined
  snapshot.items[0].start_time = '10am'
  snapshot.items[0].end_time = '7pm'

  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TaskDetailScreen navigation={{ goBack: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'k6', name: 'TaskDetail', params: { id: 'w1' } } as any} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText('晚入住')).toBeTruthy()
  })

  snapshot.items[0].end_time = '3pm'
})

test('offline task can be marked done without uploading photos first', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  snapshot.items[0].task_kind = 'offline'
  snapshot.items[0].source_type = 'work_tasks'
  snapshot.items[0].source_id = 'off1'
  snapshot.items[0].status = 'todo'
  snapshot.items[0].start_time = null
  snapshot.items[0].end_time = null
  snapshot.items[0].summary = '联系客人确认入住'
  const api = require('../../lib/api')
  ;(api.markWorkTask as jest.Mock).mockClear()

  const navigation = { goBack: jest.fn(), setParams: jest.fn() }
  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TaskDetailScreen navigation={navigation as any} route={{ key: 'k-offline', name: 'TaskDetail', params: { id: 'w1' } } as any} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText('照片可选，可直接提交，也可补充拍照留档')).toBeTruthy()
    expect(ui.getByTestId('offline-task-photo-camera')).toBeTruthy()
    expect(ui.getByTestId('offline-task-photo-library')).toBeTruthy()
    expect(ui.getByTestId('offline-task-mark-camera')).toBeTruthy()
    expect(ui.getByTestId('offline-task-mark-library')).toBeTruthy()
    expect(ui.getByTestId('offline-task-complete')).toBeTruthy()
    expect(ui.getByTestId('offline-task-not-complete')).toBeTruthy()
  })

  for (const testID of ['offline-task-complete', 'offline-task-not-complete']) {
    const style = ui.getByTestId(testID).props.style
    const resolvedStyle = typeof style === 'function' ? style({ pressed: false }) : style
    expect(StyleSheet.flatten(resolvedStyle)).toEqual(expect.objectContaining({
      flex: 1,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
    }))
  }

  fireEvent.press(ui.getByText('标记完成'))

  await waitFor(() => {
    expect(api.markWorkTask).toHaveBeenCalledWith(
      't1',
      'w1',
      expect.objectContaining({
        action: 'done',
        photo_url: null,
        photo_urls: [],
      }),
    )
    expect(navigation.goBack).toHaveBeenCalled()
  })

  snapshot.items[0].task_kind = 'cleaning'
  snapshot.items[0].source_type = 'cleaning_tasks'
  snapshot.items[0].source_id = 'ct1'
  snapshot.items[0].status = 'assigned'
  snapshot.items[0].start_time = '10am'
  snapshot.items[0].end_time = '3pm'
  snapshot.items[0].summary = null
})

test('completed non-maintenance task saves supplemental completion photos only through the server action', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousTask = { ...snapshot.items[0] }
  const api = require('../../lib/api')
  api.uploadMzappMedia.mockClear()
  api.appendWorkTaskCompletionPhotos.mockClear()
  snapshot.items[0] = {
    ...previousTask,
    task_kind: 'offline',
    source_type: 'cleaning_offline_tasks',
    source_id: 'offline-completed-1',
    assignee_id: 'u1',
    status: 'done',
    completion_photo_urls: ['r2://bucket-test/mzapp/completion-existing.jpg'],
    available_actions: [
      { id: 'append_completion_photo', label: '补充完成记录照片', placement: 'more', enabled: true, target: 'TaskDetail', intent: 'completion' },
    ],
  }
  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>

  try {
    const ui = render(
      <I18nProvider>
        <TaskDetailScreen navigation={{ goBack: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'completed-photo-append', name: 'TaskDetail', params: { id: 'w1' } } as any} />
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(ui.getByText('已保存 1 张完成记录照片，可继续补充')).toBeTruthy()
      expect(ui.getByText('补充拍照')).toBeTruthy()
      expect(ui.queryByText('标记完成')).toBeNull()
      expect(ui.getByTestId('maintenance-action-photo-0').props.accessWorkTaskId).toBe('w1')
      expect(ui.queryByLabelText('删除标记照片')).toBeNull()
    })
    fireEvent.press(ui.getByTestId('offline-task-mark-camera'))

    await waitFor(() => {
      expect(api.uploadMzappMedia).toHaveBeenCalledWith('t1', expect.objectContaining({ uri: 'file:///persistent/completion.jpg' }), undefined, { skipImageCompression: true })
      expect(api.appendWorkTaskCompletionPhotos).toHaveBeenCalledWith('t1', 'w1', { photo_urls: ['mzapp/completion-photo.jpg'] })
      expect(store.patchWorkTaskItem).toHaveBeenCalledWith('w1', { completion_photo_urls: ['mzapp/completion-photo.jpg'] })
    })
  } finally {
    snapshot.items[0] = previousTask
  }
})

test('reassigned work record previews actor-bound evidence with the canonical work-task id', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousTask = { ...snapshot.items[0] }
  const syntheticRecordId = 'work-1::record:reassigned:2026-10-19:executor-a'
  const canonicalWorkTaskId = 'work-1'
  const historyPhoto = 'mzapp/history/executor-a-proof.jpg'
  snapshot.items[0] = {
    ...previousTask,
    id: syntheticRecordId,
    media_access_work_task_id: canonicalWorkTaskId,
    task_kind: 'maintenance',
    source_type: 'property_maintenance',
    source_id: 'maintenance-1',
    status: 'done',
    work_record_visible: true,
    work_record_state: 'reassigned',
    work_record_read_only: true,
    work_record_media_attributed: true,
    completion_photo_urls: [historyPhoto],
    available_actions: [],
  }

  try {
    const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>
    const ui = render(
      <I18nProvider>
        <TaskDetailScreen navigation={{ goBack: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'reassigned-record-media', name: 'TaskDetail', params: { id: syntheticRecordId } } as any} />
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(ui.getByTestId('maintenance-action-photo-0')).toHaveProp('accessibilityLabel', `${historyPhoto}|${canonicalWorkTaskId}`)
      expect(ui.queryByText('标记完成')).toBeNull()
    })
    fireEvent.press(ui.getByTestId('maintenance-action-photo-0'))
    await waitFor(() => {
      expect(ui.getByTestId('cleaning-media-preview')).toHaveProp('accessibilityLabel', `${historyPhoto}|${canonicalWorkTaskId}`)
    })
  } finally {
    snapshot.items[0] = previousTask
  }
})

test('历史清洁记录只显示服务端签发的任务级问题反馈入口', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousTask = { ...snapshot.items[0] }
  const api = require('../../lib/api')
  api.getWorkTaskFormPhotos.mockResolvedValueOnce({
    items: Array.from({ length: 6 }, (_, index) => ({
      id: `completion-${index + 1}`,
      task_id: 'cleaning-source-1',
      source: 'completion',
      area: index % 2 === 0 ? 'bedroom' : 'living',
      url: `mzapp/completion-${index + 1}.jpg`,
    })),
  })
  snapshot.items[0] = {
    ...previousTask,
    id: 'historical-cleaning-record',
    source_type: 'cleaning_tasks',
    source_id: 'cleaning-source-1',
    task_kind: 'cleaning',
    status: 'done',
    work_record_visible: true,
    work_record_state: 'completed',
    work_record_read_only: true,
    read_only_views: {
      cleaner_photos: true,
      inspection_photos: false,
      media_scope: 'cleaner',
      media_source_ids: ['cleaning-source-1'],
    },
    available_actions: [{
      id: 'report_issue',
      label: '问题反馈与报修记录',
      placement: 'more',
      enabled: true,
      read_only: false,
      target: 'FeedbackForm',
      intent: 'issue',
      source_type: 'cleaning_tasks',
      source_id: 'cleaning-source-1',
    }],
  }
  const navigation = { navigate: jest.fn(), goBack: jest.fn(), setParams: jest.fn() }

  try {
    const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>
    const ui = render(
      <I18nProvider>
        <TaskDetailScreen navigation={navigation as any} route={{ key: 'historical-feedback', name: 'TaskDetail', params: { id: 'historical-cleaning-record' } } as any} />
      </I18nProvider>,
    )
    const button = await ui.findByTestId('task-detail-action-historical-cleaning-record-report_issue')
    await ui.findByTestId('task-detail-read-only-photo-5')
    const rendered = JSON.stringify(ui.toJSON())
    expect(rendered.indexOf('task-detail-feedback-before-photos')).toBeGreaterThanOrEqual(0)
    expect(rendered.indexOf('task-detail-feedback-before-photos')).toBeLessThan(rendered.indexOf('task-detail-read-only-photos'))
    fireEvent.press(button)
    expect(navigation.navigate).toHaveBeenCalledWith('FeedbackForm', {
      taskId: 'historical-cleaning-record',
      sourceTaskId: 'cleaning-source-1',
    })
    expect(ui.queryByText('标记完成')).toBeNull()
  } finally {
    snapshot.items[0] = previousTask
  }
})

test('completed supplemental-photo append failure persists an uploaded reference and retries the business save without re-uploading', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousTask = { ...snapshot.items[0] }
  const api = require('../../lib/api')
  const pendingStore = require('../../lib/workTaskCompletionPhotoPending')
  api.uploadMzappMedia.mockClear()
  api.appendWorkTaskCompletionPhotos.mockClear()
  api.appendWorkTaskCompletionPhotos.mockRejectedValueOnce(new Error('completion_photo_append_failed'))
  store.patchWorkTaskItem.mockClear()
  snapshot.items[0] = {
    ...previousTask,
    task_kind: 'offline',
    source_type: 'cleaning_offline_tasks',
    source_id: 'offline-completed-append-fail',
    assignee_id: 'u1',
    status: 'done',
    completion_photo_urls: [],
    available_actions: [
      { id: 'append_completion_photo', label: '补充完成记录照片', placement: 'more', enabled: true, target: 'TaskDetail', intent: 'completion' },
    ],
  }
  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>

  try {
    const ui = render(
      <I18nProvider>
        <TaskDetailScreen navigation={{ goBack: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'completed-photo-append-fail', name: 'TaskDetail', params: { id: 'w1' } } as any} />
      </I18nProvider>,
    )
    await waitFor(() => expect(ui.getByText('任务已完成，可补充完成记录照片')).toBeTruthy())
    fireEvent.press(ui.getByTestId('offline-task-mark-camera'))

    await waitFor(() => {
      expect(api.appendWorkTaskCompletionPhotos).toHaveBeenCalledWith('t1', 'w1', { photo_urls: ['mzapp/completion-photo.jpg'] })
      expect(store.patchWorkTaskItem).not.toHaveBeenCalled()
      expect(ui.getByTestId('maintenance-action-photo-0').props.localUri).toBe('file:///persistent/completion.jpg')
      expect(pendingStore.setPendingWorkTaskCompletionPhotoReferences).toHaveBeenCalledWith('w1', 'u1', ['mzapp/completion-photo.jpg'])
      expect(ui.getByText('已有 1 张照片已上传，等待保存到完成记录')).toBeTruthy()
      expect(ui.getByTestId('offline-task-completion-photo-retry-save')).toBeTruthy()
      expect(alertSpy).toHaveBeenCalledWith('出错了', '照片已上传，尚未保存到完成记录：completion_photo_append_failed。可点击重试保存，无需重新上传。')
    })

    fireEvent.press(ui.getByTestId('offline-task-completion-photo-retry-save'))

    await waitFor(() => {
      expect(api.uploadMzappMedia).toHaveBeenCalledTimes(1)
      expect(api.appendWorkTaskCompletionPhotos).toHaveBeenCalledTimes(2)
      expect(store.patchWorkTaskItem).toHaveBeenCalledWith('w1', { completion_photo_urls: ['mzapp/completion-photo.jpg'] })
      expect(pendingStore.clearPendingWorkTaskCompletionPhotoReferences).toHaveBeenCalledWith('w1', 'u1')
      expect(ui.queryByTestId('offline-task-completion-photo-retry-save')).toBeNull()
    })
  } finally {
    snapshot.items[0] = previousTask
    alertSpy.mockRestore()
  }
})

test('completed supplemental-photo retry reloads a persisted remote reference without requesting the camera again', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousTask = { ...snapshot.items[0] }
  const api = require('../../lib/api')
  const pendingStore = require('../../lib/workTaskCompletionPhotoPending')
  mockPendingCompletionPhotoReferences = ['mzapp/completion-resume.jpg']
  api.uploadMzappMedia.mockClear()
  api.appendWorkTaskCompletionPhotos.mockClear()
  store.patchWorkTaskItem.mockClear()
  snapshot.items[0] = {
    ...previousTask,
    task_kind: 'offline',
    source_type: 'cleaning_offline_tasks',
    source_id: 'offline-completed-resume',
    assignee_id: 'u1',
    status: 'done',
    completion_photo_urls: [],
    available_actions: [
      { id: 'append_completion_photo', label: '补充完成记录照片', placement: 'more', enabled: true, target: 'TaskDetail', intent: 'completion' },
    ],
  }
  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>

  try {
    const ui = render(
      <I18nProvider>
        <TaskDetailScreen navigation={{ goBack: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'completed-photo-append-resume', name: 'TaskDetail', params: { id: 'w1' } } as any} />
      </I18nProvider>,
    )
    await waitFor(() => {
      expect(pendingStore.getPendingWorkTaskCompletionPhotoReferences).toHaveBeenCalledWith('w1', 'u1')
      expect(ui.getByTestId('offline-task-completion-photo-retry-save')).toBeTruthy()
    })

    fireEvent.press(ui.getByTestId('offline-task-completion-photo-retry-save'))

    await waitFor(() => {
      expect(api.uploadMzappMedia).not.toHaveBeenCalled()
      expect(api.appendWorkTaskCompletionPhotos).toHaveBeenCalledWith('t1', 'w1', { photo_urls: ['mzapp/completion-resume.jpg'] })
      expect(store.patchWorkTaskItem).toHaveBeenCalledWith('w1', { completion_photo_urls: ['mzapp/completion-photo.jpg'] })
    })
  } finally {
    snapshot.items[0] = previousTask
  }
})

test('completed non-maintenance task hides supplemental photo controls without the server capability', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousTask = { ...snapshot.items[0] }
  snapshot.items[0] = {
    ...previousTask,
    task_kind: 'offline',
    source_type: 'cleaning_offline_tasks',
    source_id: 'offline-completed-no-capability',
    assignee_id: 'u1',
    status: 'done',
    available_actions: [],
  }
  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>

  try {
    const ui = render(
      <I18nProvider>
        <TaskDetailScreen navigation={{ goBack: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'completed-photo-no-capability', name: 'TaskDetail', params: { id: 'w1' } } as any} />
      </I18nProvider>,
    )
    await waitFor(() => {
      expect(ui.getByText('任务已完成；当前账号没有补充完成记录照片权限。')).toBeTruthy()
      expect(ui.queryByTestId('offline-task-mark-camera')).toBeNull()
      expect(ui.queryByTestId('offline-task-mark-library')).toBeNull()
    })
  } finally {
    snapshot.items[0] = previousTask
  }
})

test('customer service can edit an offline task and save its executor', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  const dismissKeyboard = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {})
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousTask = { ...snapshot.items[0] }
  const previousUser = mockAuthState.user
  const api = require('../../lib/api')
  mockAuthState.user = {
    id: 'cs-1',
    username: 'customer-service',
    role: 'customer_service',
    roles: ['customer_service'],
  }
  snapshot.items[0] = {
    ...previousTask,
    task_kind: 'offline',
    source_type: 'cleaning_offline_tasks',
    source_id: 'offline-1',
    title: '送暖气',
    summary: '联系客人确认送达',
    scheduled_date: '2026-07-23',
    date: '2026-07-23',
    property_id: 'p1',
    assignee_id: null,
    status: 'todo',
    urgency: 'medium',
  }
  const updateMock = jest.spyOn(api, 'updateCleaningOfflineTask').mockResolvedValue({
    id: 'offline-1',
    date: '2026-07-24',
    title: '送暖气（已确认）',
    content: '已和客人确认时间',
    property_id: 'p1',
    assignee_id: 'cleaner-2',
    status: 'assigned',
  })
  jest.spyOn(api, 'listUsers').mockResolvedValue([
    { id: 'cleaner-2', username: 'zhi-f', display_name: 'zhi-f', role: 'cleaner' },
  ])
  jest.spyOn(api, 'listCleaningAppPropertyCodes').mockResolvedValue([
    { id: 'p1', code: 'WSP3709B', region: 'CBD' },
  ])

  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TaskDetailScreen navigation={{ goBack: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'k-offline-edit', name: 'TaskDetail', params: { id: 'w1' } } as any} />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByTestId('offline-edit-button')).toBeTruthy())
  fireEvent.press(ui.getByTestId('offline-edit-button'))
  await waitFor(() => expect(ui.getByDisplayValue('送暖气')).toBeTruthy())
  expect(ui.getByTestId('offline-edit-keyboard-avoider')).toBeTruthy()
  expect(ui.getByTestId('offline-edit-scroll').props.keyboardShouldPersistTaps).toBe('always')
  expect(ui.getByTestId('offline-edit-scroll').props.keyboardDismissMode).toBe(Platform.OS === 'ios' ? 'interactive' : 'on-drag')
  fireEvent.changeText(ui.getByDisplayValue('送暖气'), '送暖气（已确认）')
  fireEvent.changeText(ui.getByLabelText('offline-edit-date'), '2026-07-24')
  fireEvent.changeText(ui.getByLabelText('offline-edit-content'), '中文 English 内容保留')
  expect(ui.getByLabelText('offline-edit-content').props.submitBehavior).toBe('newline')
  fireEvent(ui.getByDisplayValue('送暖气（已确认）'), 'submitEditing')
  expect(dismissKeyboard).toHaveBeenCalled()
  expect(ui.getByDisplayValue('中文 English 内容保留')).toBeTruthy()
  fireEvent.press(ui.getByTestId('offline-edit-dismiss-keyboard'))
  expect(dismissKeyboard).toHaveBeenCalledTimes(2)
  expect(ui.getByTestId('offline-edit-save').props.accessibilityState?.disabled).not.toBe(true)
  expect(ui.queryByText('紧急度')).toBeNull()
  fireEvent.press(ui.getByLabelText('offline-edit-assignee'))
  await waitFor(() => expect(ui.getByText('zhi-f')).toBeTruthy())
  fireEvent.press(ui.getByLabelText('offline-edit-assignee-cleaner-2'))
  fireEvent.press(ui.getByTestId('offline-edit-save'))

  await waitFor(() => {
    expect(updateMock).toHaveBeenCalledWith(
      't1',
      'offline-1',
      expect.objectContaining({
        date: '2026-07-24',
        title: '送暖气（已确认）',
        content: '中文 English 内容保留',
        assignee_id: 'cleaner-2',
      }),
    )
  })

  updateMock.mockRestore()
  ;(api.listUsers as jest.Mock).mockRestore()
  ;(api.listCleaningAppPropertyCodes as jest.Mock).mockRestore()
  dismissKeyboard.mockRestore()
  snapshot.items[0] = previousTask
  mockAuthState.user = previousUser
})


describe('deep-cleaning assigned workflow', () => {
  const after = 'mzapp/deep-after.jpg'
  let previousTask: any
  let snapshot: any
  beforeEach(() => {
    snapshot = require('../../lib/workTasksStore').getWorkTasksSnapshot()
    previousTask = snapshot.items[0]
    snapshot.items[0] = {
      id: 'property_deep_cleaning:d1', source_id: 'd1', title: '深度清洁',
      property: { id: 'deep-property', code: 'DEEP-115', address: '合成深清房源' },
      scheduled_date: '2026-01-01', date: '2026-01-01', urgency: 'medium',
      source_type: 'property_deep_cleaning', task_kind: 'deep_cleaning', status: 'assigned',
      assignee_id: 'u1', work_record_read_only: false,
      photo_urls: ['mzapp/deep-before.jpg'], completion_photo_urls: [],
      summary: '原始反馈 photo: mzapp/not-an-after-photo.jpg', available_actions: [],
      deep_cleaning_workflow: { status: 'assigned', available_actions: ['complete'] },
    }
    const api = require('../../lib/api')
    api.markWorkTask.mockClear()
    api.submitDeepCleaningCompletion.mockClear()
    const draft = require('../../lib/maintenanceCompletionPhotoDraft')
    draft.getMaintenanceCompletionPhotoDraft.mockReset().mockResolvedValue([])
    draft.clearMaintenanceCompletionPhotoDraft.mockClear()
    jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  })
  afterEach(() => { snapshot.items[0] = previousTask })
  function renderDeep() {
    const navigation = { goBack: jest.fn(), setParams: jest.fn() }
    const Screen = require('./TaskDetailScreen').default
    return { navigation, ui: render(<I18nProvider><Screen navigation={navigation} route={{ key: 'deep-d1', name: 'TaskDetail', params: { id: 'property_deep_cleaning:d1' } }} /></I18nProvider>) }
  }
  function seedDraft() {
    require('../../lib/maintenanceCompletionPhotoDraft').getMaintenanceCompletionPhotoDraft.mockResolvedValueOnce([{
      media_id: 'deep-media', local_uri: 'file:///documents/deep-after.jpg', remote_reference: after,
      name: 'deep.jpg', mime_type: 'image/jpeg', captured_at: '', upload_state: 'remote_stored', error_code: null,
    }])
  }
  test('combined before upload keeps acknowledged remote after temporary draft storage failure', async () => {
    const drafts = require('../../lib/maintenanceCompletionPhotoDraft')
    drafts.getMaintenanceCompletionPhotoDraft.mockImplementation(async (key: string, owner: string) => mockCompletionDrafts[`${key}:${owner}`] || [])
    let failOnce = true
    drafts.setMaintenanceCompletionPhotoDraft.mockImplementation(async (key: string, owner: string, photos: any[]) => {
      if (failOnce && photos.some((photo) => photo.remote_reference)) { failOnce = false; throw new Error('temporary storage failure') }
      mockCompletionDrafts[`${key}:${owner}`] = photos
      return photos
    })
    const picker = require('expo-image-picker')
    picker.launchImageLibraryAsync.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///before.jpg', fileName: 'before.jpg', mimeType: 'image/jpeg' }] })
    const api = require('../../lib/api')
    api.uploadMzappMedia.mockReset().mockResolvedValue({ remoteReference: 'mzapp/ack-before.jpg' })
    const { ui } = renderDeep()
    await waitFor(() => expect(ui.getByTestId('deep-before-library').props.accessibilityState.disabled).toBe(false))
    fireEvent.press(ui.getByTestId('deep-before-library'))
    const key = require('../../lib/deepCleaningCompletion').deepCleaningBeforeDraftKey('property_deep_cleaning:d1', 'd1')
    await waitFor(() => expect(mockCompletionDrafts[`${key}:u1`]?.[0]?.remote_reference).toBe('mzapp/ack-before.jpg'))
    expect(api.uploadMzappMedia).toHaveBeenCalledTimes(1)
    expect(ui.queryByText('重试前图上传')).toBeNull()
  })

  test('combined before upload ignores same-owner stale token receipt UI but retains old draft acknowledgment', async () => {
    const drafts = require('../../lib/maintenanceCompletionPhotoDraft')
    drafts.getMaintenanceCompletionPhotoDraft.mockImplementation(async (key: string, owner: string) => mockCompletionDrafts[`${key}:${owner}`] || [])
    const api = require('../../lib/api')
    let finish: (value: any) => void = () => {}
    api.uploadMzappMedia.mockReset().mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    require('expo-image-picker').launchImageLibraryAsync.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///before.jpg', fileName: 'before.jpg', mimeType: 'image/jpeg' }] })
    const { ui, navigation } = renderDeep()
    await waitFor(() => expect(ui.getByTestId('deep-before-library').props.accessibilityState.disabled).toBe(false))
    fireEvent.press(ui.getByTestId('deep-before-library'))
    await waitFor(() => expect(api.uploadMzappMedia).toHaveBeenCalledTimes(1))
    const previousToken = mockAuthState.token
    try {
      mockAuthState.token = 'new-token'
      const Screen = require('./TaskDetailScreen').default
      ui.rerender(<I18nProvider><Screen navigation={navigation} route={{ params: { id: 'property_deep_cleaning:d1' } }} /></I18nProvider>)
      await act(async () => { finish({ remoteReference: 'mzapp/old-token-before.jpg' }) })
      const key = require('../../lib/deepCleaningCompletion').deepCleaningBeforeDraftKey('property_deep_cleaning:d1', 'd1')
      expect(mockCompletionDrafts[`${key}:u1`]?.[0]?.remote_reference).toBe('mzapp/old-token-before.jpg')
      expect(api.submitDeepCleaningCompletion).not.toHaveBeenCalled()
      expect(navigation.goBack).not.toHaveBeenCalled()
      await waitFor(() => expect(ui.getByTestId('deep-before-library').props.accessibilityState.disabled).toBe(false))
      const readsBeforeRetry = drafts.getMaintenanceCompletionPhotoDraft.mock.calls.length
      const writesBeforeRetry = drafts.setMaintenanceCompletionPhotoDraft.mock.calls.length
      // Retry reads the acknowledged draft asynchronously. Flush that interaction,
      // rather than relying on a later 1-second UI poll to flush React's updates.
      await waitFor(() => expect(ui.getByTestId('deep-before-retry').props.accessibilityState.disabled).toBe(false))
      await fireEventAsync.press(ui.getByTestId('deep-before-retry'))
      expect(drafts.getMaintenanceCompletionPhotoDraft.mock.calls.length).toBeGreaterThan(readsBeforeRetry)
      expect(drafts.setMaintenanceCompletionPhotoDraft.mock.calls.length).toBeGreaterThan(writesBeforeRetry)
      expect(drafts.setMaintenanceCompletionPhotoDraft).toHaveBeenLastCalledWith(key, 'u1', expect.arrayContaining([
        expect.objectContaining({ remote_reference: 'mzapp/old-token-before.jpg' }),
      ]))
      expect(ui.queryByTestId('deep-before-retry')).toBeNull()
      expect(api.uploadMzappMedia).toHaveBeenCalledTimes(1)
      expect(api.submitDeepCleaningCompletion).not.toHaveBeenCalled()
      expect(navigation.goBack).not.toHaveBeenCalled()
    } finally {
      mockAuthState.token = previousToken
    }
  })

  test.each(['account', 'token', 'task'])('combined deep completion ignores delayed receipt after %s change', async (change) => {
    seedDraft()
    const api = require('../../lib/api')
    let finish: (value: any) => void = () => {}
    api.submitDeepCleaningCompletion.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    const { ui, navigation } = renderDeep()
    await waitFor(() => expect(ui.getByTestId('maintenance-action-photo-0')).toBeTruthy())
    fireEvent.press(ui.getByTestId('deep-cleaning-task-complete'))
    await waitFor(() => expect(api.submitDeepCleaningCompletion).toHaveBeenCalledTimes(1))
    const previousUser = mockAuthState.user
    if (change === 'account') mockAuthState.user = { ...previousUser, id: 'u2' }
    if (change !== 'task') mockAuthState.token = 't2'
    const nextId = change === 'task' ? 'property_deep_cleaning:d2' : 'property_deep_cleaning:d1'
    if (change === 'task') snapshot.items[0] = { ...snapshot.items[0], id: nextId, source_id: 'd2' }
    const Screen = require('./TaskDetailScreen').default
    ui.rerender(<I18nProvider><Screen navigation={navigation} route={{ params: { id: nextId } }} /></I18nProvider>)
    await act(async () => { finish({ status: 'pending_review', workflow_status: 'pending_review', completion_photo_urls: [after] }) })
    expect(snapshot.items[0].status).toBe('assigned')
    expect(navigation.goBack).not.toHaveBeenCalled()
    await waitFor(() => expect(ui.getByTestId('deep-before-library').props.accessibilityState.disabled).toBe(false))
    expect(require('../../lib/maintenanceCompletionPhotoDraft').clearMaintenanceCompletionPhotoDraft).not.toHaveBeenCalled()
    mockAuthState.user = previousUser
    mockAuthState.token = 't1'
  })

  test('deep task never adopts turnover title, times, tags or guide even with contaminated fields', async () => {
    snapshot.items[0] = { ...snapshot.items[0], start_time: '10am', end_time: '8pm', checkout_time: '10am', checkin_time: '8pm', property: { ...snapshot.items[0].property, access_guide_link: 'https://fixture.invalid/guide' } }
    const { ui } = renderDeep()
    await waitFor(() => expect(ui.getByText('清洁前照片')).toBeTruthy())
    expect(ui.getByText('DEEP-115')).toBeTruthy()
    expect(ui.queryByText(/退房|入住|晚退|早入住|晚入住/)).toBeNull()
  })
  test('pure deep task has no empty check-in guide prompt', async () => {
    const { ui } = renderDeep()
    await waitFor(() => expect(ui.getByText('清洁前照片')).toBeTruthy())
    expect(ui.queryByText(/退房|入住/)).toBeNull()
  })
  test('empty before-photo section offers capture only for server-authorized deep task', async () => {
    snapshot.items[0].photo_urls = []
    const { ui } = renderDeep()
    await waitFor(() => expect(ui.getByTestId('deep-before-camera')).toBeTruthy())
    expect(ui.getByText('清洁前照片')).toBeTruthy()
    expect(ui.getByTestId('deep-before-library')).toBeTruthy()
    expect(StyleSheet.flatten(ui.getByPlaceholderText('备注').props.style)).toMatchObject({ textAlignVertical: 'center', paddingVertical: 0 })
    for (const [before, after] of [['deep-before-camera', 'offline-task-mark-camera'], ['deep-before-library', 'offline-task-mark-library']]) {
      expect(StyleSheet.flatten(ui.getByTestId(before).props.style)).toEqual(StyleSheet.flatten(ui.getByTestId(after).props.style))
    }
  })

  test('before and after evidence submit atomically, retain both on failure and clear only canonical receipt', async () => {
    const drafts = require('../../lib/maintenanceCompletionPhotoDraft')
    const beforeKey = require('../../lib/deepCleaningCompletion').deepCleaningBeforeDraftKey('property_deep_cleaning:d1', 'd1')
    const before = { media_id: 'before-1', local_uri: 'file:///before.jpg', remote_reference: 'mzapp/new-before.jpg', name: 'before.jpg', mime_type: 'image/jpeg', upload_state: 'remote_stored' }
    const afterDraft = { ...before, media_id: 'after-1', remote_reference: after }
    drafts.getMaintenanceCompletionPhotoDraft.mockImplementation(async (key: string) => key === beforeKey ? [before] : [afterDraft])
    const api = require('../../lib/api')
    api.submitDeepCleaningCompletion.mockRejectedValueOnce(new Error('unknown receipt')).mockResolvedValueOnce({ status: 'pending_review', workflow_status: 'pending_review', available_actions: [], photo_urls: ['mzapp/deep-before.jpg', before.remote_reference], repair_photo_urls: [after], work_record_read_only: true, counts_as_active_task: false })
    const { ui, navigation } = renderDeep()
    await waitFor(() => expect(ui.getByTestId('deep-before-draft-before-1')).toBeTruthy())
    expect(ui.getByTestId('deep-before-draft-before-1').props.remoteReference).toBeUndefined()
    const uploads = api.uploadMzappMedia.mock.calls.length
    fireEvent.press(ui.getByTestId('deep-cleaning-task-complete'))
    await waitFor(() => expect(api.submitDeepCleaningCompletion).toHaveBeenCalledTimes(1))
    expect(drafts.clearMaintenanceCompletionPhotoDraft).not.toHaveBeenCalled()
    await waitFor(() => expect(ui.getByTestId('deep-cleaning-task-complete').props.accessibilityState?.disabled).not.toBe(true))
    fireEvent.press(ui.getByTestId('deep-cleaning-task-complete'))
    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled())
    const first = api.submitDeepCleaningCompletion.mock.calls[0][1]
    expect(first).toMatchObject({ beforePhotoUrls: [before.remote_reference], completionPhotoUrls: [after] })
    expect(api.submitDeepCleaningCompletion.mock.calls[1][1]).toEqual(first)
    expect(api.uploadMzappMedia.mock.calls.length).toBe(uploads)
    expect(drafts.clearMaintenanceCompletionPhotoDraft).toHaveBeenCalledWith(beforeKey, 'u1', { deleteLocalFiles: true })
    expect(snapshot.items[0].photo_urls).toEqual(['mzapp/deep-before.jpg', before.remote_reference])
    expect(ui.queryByTestId('deep-before-camera')).toBeNull()
  })

  test('missing local before draft never renders an unassociated private remote reference', async () => {
    const drafts = require('../../lib/maintenanceCompletionPhotoDraft')
    drafts.getMaintenanceCompletionPhotoDraft.mockImplementation(async (key: string) => key.startsWith('deep-cleaning-before:') ? [{ media_id: 'lost-before', local_uri: null, remote_reference: 'mzapp/private-before.jpg', upload_state: 'remote_stored' }] : [])
    const { ui } = renderDeep()
    await waitFor(() => expect(ui.getByTestId('deep-before-local-missing')).toBeTruthy())
    expect(ui.queryByLabelText('mzapp/private-before.jpg|property_deep_cleaning:d1')).toBeNull()
  })

  test('new before capture persists phase-isolated evidence and never mutates source before completion', async () => {
    const local = require('../../lib/localMediaDrafts')
    const persist = jest.spyOn(local, 'persistCompressedDraftMedia').mockResolvedValue({ localUri: 'file:///durable-before.jpg', name: 'before.jpg', mimeType: 'image/jpeg' })
    const exists = jest.spyOn(local, 'draftFileExists').mockReturnValue(true)
    const drafts = require('../../lib/maintenanceCompletionPhotoDraft')
    const cache = new Map<string, any[]>()
    drafts.getMaintenanceCompletionPhotoDraft.mockImplementation(async (key: string) => cache.get(key) || [])
    drafts.setMaintenanceCompletionPhotoDraft.mockImplementation(async (key: string, _owner: string, photos: any[]) => { cache.set(key, photos); return photos })
    const picker = require('expo-image-picker')
    picker.launchCameraAsync.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///new-before.jpg', fileName: 'before.jpg', mimeType: 'image/jpeg' }] }).mockResolvedValueOnce({ canceled: true })
    const api = require('../../lib/api')
    const { ui } = renderDeep()
    await waitFor(() => expect(ui.getByTestId('deep-before-camera').props.accessibilityState?.disabled).not.toBe(true))
    fireEvent.press(ui.getByTestId('deep-before-camera'))
    await waitFor(() => expect(ui.getByTestId('deep-before-draft-media-1')).toBeTruthy())
    await waitFor(() => expect(Array.from(cache.values()).some((photos) => photos.some((photo) => photo.remote_reference))).toBe(true))
    expect(Array.from(cache.keys())).toEqual([require('../../lib/deepCleaningCompletion').deepCleaningBeforeDraftKey('property_deep_cleaning:d1', 'd1')])
    expect(api.submitDeepCleaningCompletion).not.toHaveBeenCalled()
    expect(snapshot.items[0].photo_urls).toEqual(['mzapp/deep-before.jpg'])
    expect(picker.launchCameraAsync.mock.calls.at(-1)[0].allowsEditing).toBe(false)
    drafts.removeMaintenanceCompletionPhotoDraft.mockResolvedValueOnce([])
    await waitFor(() => expect(ui.getByTestId('deep-before-remove-media-1').props.accessibilityState?.disabled).not.toBe(true))
    fireEvent.press(ui.getByTestId('deep-before-remove-media-1'))
    await waitFor(() => expect(ui.queryByTestId('deep-before-draft-media-1')).toBeNull())
    expect(drafts.removeMaintenanceCompletionPhotoDraft).toHaveBeenCalledWith(require('../../lib/deepCleaningCompletion').deepCleaningBeforeDraftKey('property_deep_cleaning:d1', 'd1'), 'u1', 'media-1')
    expect(snapshot.items[0].photo_urls).toEqual(['mzapp/deep-before.jpg'])
    drafts.setMaintenanceCompletionPhotoDraft.mockImplementation(async (_key: string, _owner: string, photos: any[]) => photos)
    persist.mockRestore()
    exists.mockRestore()
  })

  test.each([false, true])('before cleanup on readonly reentry requires canonical association=%s', async (associated) => {
    const key = require('../../lib/deepCleaningCompletion').deepCleaningBeforeDraftKey('property_deep_cleaning:d1', 'd1')
    const drafts = require('../../lib/maintenanceCompletionPhotoDraft')
    drafts.getMaintenanceCompletionPhotoDraft.mockImplementation(async (id: string) => id === key ? [{ media_id: 'before-reentry', local_uri: 'file:///before.jpg', remote_reference: 'mzapp/new-before.jpg', upload_state: 'remote_stored' }] : [])
    snapshot.items[0] = { ...snapshot.items[0], status: 'pending_review', work_record_read_only: true, deep_cleaning_workflow: { status: 'pending_review', available_actions: [] }, photo_urls: associated ? ['mzapp/new-before.jpg'] : [] }
    const { ui } = renderDeep()
    await waitFor(() => expect(ui.getByText('清洁前照片')).toBeTruthy())
    expect(ui.queryByTestId('deep-before-camera')).toBeNull()
    if (associated) await waitFor(() => expect(drafts.clearMaintenanceCompletionPhotoDraft).toHaveBeenCalledWith(key, 'u1', { deleteLocalFiles: true }))
    else expect(drafts.clearMaintenanceCompletionPhotoDraft).not.toHaveBeenCalledWith(key, 'u1', expect.anything())
  })

  test('before evidence alone never satisfies required after evidence', async () => {
    const drafts = require('../../lib/maintenanceCompletionPhotoDraft')
    drafts.getMaintenanceCompletionPhotoDraft.mockImplementation(async (id: string) => id.startsWith('deep-cleaning-before:') ? [{ media_id: 'before-only', local_uri: 'file:///before.jpg', remote_reference: 'mzapp/before-only.jpg', upload_state: 'remote_stored' }] : [])
    const { ui } = renderDeep()
    await waitFor(() => expect(ui.getByTestId('deep-before-draft-before-only')).toBeTruthy())
    fireEvent.press(ui.getByTestId('deep-cleaning-task-complete'))
    expect(require('../../lib/api').submitDeepCleaningCompletion).not.toHaveBeenCalled()
    expect(Alert.alert).toHaveBeenCalledWith('出错了', '请先拍照上传')
  })

  test('unread before drafts block completion rather than silently omitting evidence', async () => {
    const drafts = require('../../lib/maintenanceCompletionPhotoDraft')
    drafts.getMaintenanceCompletionPhotoDraft.mockImplementation(async (key: string) => {
      if (key.startsWith('deep-cleaning-before:')) throw new Error('fixture read unavailable')
      return [{ media_id: 'after-ready', local_uri: 'file:///after.jpg', remote_reference: after, upload_state: 'remote_stored' }]
    })
    const { ui } = renderDeep()
    await waitFor(() => expect(ui.getByText('前图草稿读取失败，请重新打开任务重试；原资料未删除。')).toBeTruthy())
    expect(ui.getByTestId('deep-cleaning-task-complete').props.accessibilityState.disabled).toBe(true)
    expect(ui.getByTestId('deep-before-camera').props.accessibilityState.disabled).toBe(true)
    expect(require('../../lib/api').submitDeepCleaningCompletion).not.toHaveBeenCalled()
    expect(drafts.clearMaintenanceCompletionPhotoDraft).not.toHaveBeenCalled()
  })

  test.each(['task', 'owner'])('before cleanup never uses old photos to clear a new %s bucket during delayed hydration', async (change) => {
    const drafts = require('../../lib/maintenanceCompletionPhotoDraft')
    const keyFor = require('../../lib/deepCleaningCompletion').deepCleaningBeforeDraftKey
    const oldUser = mockAuthState.user
    const nextId = change === 'task' ? 'property_deep_cleaning:d2' : 'property_deep_cleaning:d1'
    const nextSource = change === 'task' ? 'd2' : 'd1'
    const nextOwner = change === 'owner' ? 'u2' : 'u1'
    const nextKey = keyFor(nextId, nextSource)
    let release: ((photos: any[]) => void) | undefined
    let switched = false
    drafts.getMaintenanceCompletionPhotoDraft.mockImplementation(async (key: string, owner: string) => {
      if (switched && key === nextKey && owner === nextOwner) return await new Promise((resolve) => { release = resolve })
      return key.startsWith('deep-cleaning-before:') ? [{ media_id: 'old-before', local_uri: 'file:///old-before.jpg', remote_reference: 'mzapp/old-before.jpg', upload_state: 'remote_stored' }] : []
    })
    const { ui } = renderDeep()
    try {
      await waitFor(() => expect(ui.getByTestId('deep-before-draft-old-before')).toBeTruthy())
      switched = true
      mockAuthState.user = { ...oldUser, id: nextOwner }
      snapshot.items[0] = { ...snapshot.items[0], id: nextId, source_id: nextSource, status: 'pending_review', work_record_read_only: true, photo_urls: ['mzapp/old-before.jpg'], deep_cleaning_workflow: { status: 'pending_review', available_actions: [] } }
      const Screen = require('./TaskDetailScreen').default
      ui.rerender(<I18nProvider><Screen navigation={{ goBack: jest.fn(), setParams: jest.fn() }} route={{ params: { id: nextId } }} /></I18nProvider>)
      await waitFor(() => expect(release).toBeDefined())
      expect(drafts.clearMaintenanceCompletionPhotoDraft).not.toHaveBeenCalledWith(nextKey, nextOwner, expect.anything())
      await require('@testing-library/react-native').act(async () => { release!([{ media_id: 'new-unsynced', local_uri: 'file:///new-unsynced.jpg', remote_reference: null, upload_state: 'local_persisted' }]) })
      expect(drafts.clearMaintenanceCompletionPhotoDraft).not.toHaveBeenCalledWith(nextKey, nextOwner, expect.anything())
      expect(ui.queryByTestId('deep-before-draft-old-before')).toBeNull()
      expect(require('../../lib/api').submitDeepCleaningCompletion).not.toHaveBeenCalled()
    } finally { mockAuthState.user = oldUser; ui.unmount() }
  })

  test.each(['before', 'after'])('local draft big preview opens without private remote for %s phase', async (phase) => {
    const drafts = require('../../lib/maintenanceCompletionPhotoDraft')
    const localUri = `file:///${phase}-preview.jpg`
    drafts.getMaintenanceCompletionPhotoDraft.mockImplementation(async (key: string) => (key.startsWith('deep-cleaning-before:') === (phase === 'before')) ? [{ media_id: 'local-preview', local_uri: localUri, remote_reference: `mzapp/unassociated-${phase}.jpg`, upload_state: 'remote_stored' }] : [])
    const { ui } = renderDeep()
    const id = phase === 'before' ? 'deep-before-draft-local-preview' : 'maintenance-action-photo-0'
    await waitFor(() => expect(ui.getByTestId(id)).toBeTruthy())
    fireEvent.press(ui.getByTestId(id))
    expect(ui.getByTestId('cleaning-media-preview')).toHaveProp('localUri', localUri)
    expect(ui.getByTestId('cleaning-media-preview')).toHaveProp('reference', '')
    expect(ui.getByTestId('cleaning-media-preview')).toHaveProp('accessWorkTaskId', 'property_deep_cleaning:d1')
    const oldUser = mockAuthState.user
    try {
      mockAuthState.user = { ...oldUser, id: 'other-viewer' }
      const Screen = require('./TaskDetailScreen').default
      ui.rerender(<I18nProvider><Screen navigation={{ goBack: jest.fn(), setParams: jest.fn() }} route={{ params: { id: 'property_deep_cleaning:d1' } }} /></I18nProvider>)
      expect(ui.queryByTestId('cleaning-media-preview')).toBeNull()
    } finally { mockAuthState.user = oldUser; ui.unmount() }
  })

  test.each(['task', 'owner'])('after cleanup does not clear an unread new %s bucket using old photos', async (change) => {
    const drafts = require('../../lib/maintenanceCompletionPhotoDraft')
    const oldUser = mockAuthState.user
    const nextId = change === 'task' ? 'property_deep_cleaning:d2' : 'property_deep_cleaning:d1'
    const nextOwner = change === 'owner' ? 'u2' : 'u1'
    let switched = false
    let release: ((photos: any[]) => void) | undefined
    drafts.getMaintenanceCompletionPhotoDraft.mockImplementation(async (key: string, owner: string) => {
      if (key.startsWith('deep-cleaning-before:')) return []
      if (switched && key === nextId && owner === nextOwner) return await new Promise((resolve) => { release = resolve })
      return [{ media_id: 'old-after', local_uri: 'file:///old-after.jpg', remote_reference: 'mzapp/old-after.jpg', upload_state: 'remote_stored' }]
    })
    const { ui } = renderDeep()
    try {
      await waitFor(() => expect(ui.getByTestId('maintenance-action-photo-0')).toHaveProp('localUri', 'file:///old-after.jpg'))
      switched = true
      mockAuthState.user = { ...oldUser, id: nextOwner }
      snapshot.items[0] = { ...snapshot.items[0], id: nextId, source_id: change === 'task' ? 'd2' : 'd1', status: 'pending_review', work_record_read_only: true, completion_photo_urls: ['mzapp/old-after.jpg'], deep_cleaning_workflow: { status: 'pending_review', available_actions: [] } }
      const Screen = require('./TaskDetailScreen').default
      ui.rerender(<I18nProvider><Screen navigation={{ goBack: jest.fn(), setParams: jest.fn() }} route={{ params: { id: nextId } }} /></I18nProvider>)
      await waitFor(() => expect(release).toBeDefined())
      expect(drafts.clearMaintenanceCompletionPhotoDraft).not.toHaveBeenCalledWith(nextId, nextOwner, expect.anything())
      await require('@testing-library/react-native').act(async () => { release!([{ media_id: 'new-unsynced-after', local_uri: 'file:///unsynced-after.jpg', remote_reference: null, upload_state: 'local_persisted' }]) })
      expect(drafts.clearMaintenanceCompletionPhotoDraft).not.toHaveBeenCalledWith(nextId, nextOwner, expect.anything())
    } finally { mockAuthState.user = oldUser; ui.unmount() }
  })

  test.each(['admin', 'staff'])('associated r2 before/after previews preserve server work-task context for %s pending record', async (role) => {
    const previousUser = mockAuthState.user
    mockAuthState.user = { id: 'u1', username: 'fixture', role }
    const before = 'r2://fixture-bucket/mzapp/before.jpg'
    const completed = 'r2://fixture-bucket/mzapp/after.jpg'
    snapshot.items[0] = { ...snapshot.items[0], status: 'pending_review', work_record_read_only: true, media_access_work_task_id: 'work_task:media-owner', photo_urls: [before], completion_photo_urls: [completed], deep_cleaning_workflow: { status: 'pending_review', available_actions: [] } }
    const { ui } = renderDeep()
    try {
      fireEvent.press(ui.getByTestId('deep-cleaning-before-photo-0'))
      expect(ui.getByTestId('cleaning-media-preview')).toHaveProp('reference', before)
      expect(ui.getByTestId('cleaning-media-preview')).toHaveProp('accessWorkTaskId', 'work_task:media-owner')
      fireEvent.press(ui.getByText('关闭'))
      fireEvent.press(ui.getByTestId('maintenance-action-photo-0'))
      expect(ui.getByTestId('cleaning-media-preview')).toHaveProp('reference', completed)
      expect(ui.getByTestId('cleaning-media-preview')).toHaveProp('accessWorkTaskId', 'work_task:media-owner')
      expect(ui.queryByTestId('deep-cleaning-task-complete')).toBeNull()
      expect(ui.queryByTestId('deep-before-camera')).toBeNull()
    } finally { mockAuthState.user = previousUser; ui.unmount() }
  })

  test('late after draft load cannot replace the new owner photos', async () => {
    const drafts = require('../../lib/maintenanceCompletionPhotoDraft')
    const previousUser = mockAuthState.user
    let release: ((photos: any[]) => void) | undefined
    drafts.getMaintenanceCompletionPhotoDraft.mockImplementation(async (key: string, owner: string) => {
      if (key.startsWith('deep-cleaning-before:')) return []
      if (owner === 'u1') return await new Promise((resolve) => { release = resolve })
      return [{ media_id: 'new-owner', local_uri: 'file:///new-owner.jpg', remote_reference: 'mzapp/new-owner.jpg', upload_state: 'remote_stored' }]
    })
    const { ui } = renderDeep()
    try {
      await waitFor(() => expect(release).toBeDefined())
      mockAuthState.user = { ...previousUser, id: 'u2' }
      const Screen = require('./TaskDetailScreen').default
      ui.rerender(<I18nProvider><Screen navigation={{ goBack: jest.fn(), setParams: jest.fn() }} route={{ params: { id: 'property_deep_cleaning:d1' } }} /></I18nProvider>)
      await waitFor(() => expect(ui.getByTestId('maintenance-action-photo-0')).toHaveProp('localUri', 'file:///new-owner.jpg'))
      await require('@testing-library/react-native').act(async () => { release!([{ media_id: 'old-owner', local_uri: 'file:///old-owner.jpg', remote_reference: 'mzapp/old-owner.jpg', upload_state: 'remote_stored' }]) })
      expect(ui.getByTestId('maintenance-action-photo-0')).toHaveProp('localUri', 'file:///new-owner.jpg')
    } finally { mockAuthState.user = previousUser; ui.unmount() }
  })

  test('late after capture result is ignored after owner switch', async () => {
    const picker = require('expo-image-picker')
    let release: ((result: any) => void) | undefined
    picker.launchCameraAsync.mockImplementationOnce(async () => await new Promise((resolve) => { release = resolve }))
    const previousUser = mockAuthState.user
    const drafts = require('../../lib/maintenanceCompletionPhotoDraft')
    drafts.setMaintenanceCompletionPhotoDraft.mockClear()
    const api = require('../../lib/api')
    const uploads = api.uploadMzappMedia.mock.calls.length
    const { ui } = renderDeep()
    try {
      await waitFor(() => expect(ui.getByTestId('deep-cleaning-task-complete').props.accessibilityState.disabled).toBe(false))
      fireEvent.press(ui.getByTestId('offline-task-mark-camera'))
      await waitFor(() => expect(release).toBeDefined())
      mockAuthState.user = { ...previousUser, id: 'u2' }
      const Screen = require('./TaskDetailScreen').default
      ui.rerender(<I18nProvider><Screen navigation={{ goBack: jest.fn(), setParams: jest.fn() }} route={{ params: { id: 'property_deep_cleaning:d1' } }} /></I18nProvider>)
      await require('@testing-library/react-native').act(async () => { release!({ canceled: false, assets: [{ uri: 'file:///old-capture.jpg', mimeType: 'image/jpeg' }] }) })
      expect(api.uploadMzappMedia.mock.calls.length).toBe(uploads)
      expect(drafts.setMaintenanceCompletionPhotoDraft).not.toHaveBeenCalled()
      expect(ui.queryByTestId('maintenance-action-photo-0')).toBeNull()
    } finally { mockAuthState.user = previousUser; ui.unmount() }
  })

  test('late after upload acknowledgment persists only to original owner and never renders for new owner', async () => {
    const local = require('../../lib/localMediaDrafts')
    const persist = jest.spyOn(local, 'persistCompressedDraftMedia').mockResolvedValue({ localUri: 'file:///old-after.jpg', name: 'after.jpg', mimeType: 'image/jpeg' })
    const exists = jest.spyOn(local, 'draftFileExists').mockReturnValue(true)
    const drafts = require('../../lib/maintenanceCompletionPhotoDraft')
    const cache = new Map<string, any[]>()
    drafts.getMaintenanceCompletionPhotoDraft.mockImplementation(async (key: string, owner: string) => cache.get(`${owner}|${key}`) || [])
    drafts.setMaintenanceCompletionPhotoDraft.mockImplementation(async (key: string, owner: string, photos: any[]) => { cache.set(`${owner}|${key}`, photos); return photos })
    const api = require('../../lib/api')
    let release: ((result: any) => void) | undefined
    api.uploadMzappMedia.mockImplementationOnce(async () => await new Promise((resolve) => { release = resolve }))
    require('expo-image-picker').launchCameraAsync.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///capture.jpg', mimeType: 'image/jpeg' }] })
    const previousUser = mockAuthState.user
    const { ui } = renderDeep()
    try {
      await waitFor(() => expect(ui.getByTestId('deep-cleaning-task-complete').props.accessibilityState.disabled).toBe(false))
      fireEvent.press(ui.getByTestId('offline-task-mark-camera'))
      await waitFor(() => expect(release).toBeDefined())
      mockAuthState.user = { ...previousUser, id: 'u2' }
      const Screen = require('./TaskDetailScreen').default
      ui.rerender(<I18nProvider><Screen navigation={{ goBack: jest.fn(), setParams: jest.fn() }} route={{ params: { id: 'property_deep_cleaning:d1' } }} /></I18nProvider>)
      await require('@testing-library/react-native').act(async () => { release!({ url: 'mzapp/old-owner-upload.jpg' }) })
      expect(cache.get('u1|property_deep_cleaning:d1')?.[0].remote_reference).toBe('mzapp/old-owner-upload.jpg')
      expect(cache.has('u2|property_deep_cleaning:d1')).toBe(false)
      expect(ui.queryByTestId('maintenance-action-photo-0')).toBeNull()
    } finally {
      mockAuthState.user = previousUser; ui.unmount(); persist.mockRestore(); exists.mockRestore()
      drafts.setMaintenanceCompletionPhotoDraft.mockImplementation(async (_key: string, _owner: string, photos: any[]) => photos)
    }
  })

  test('after draft read failure blocks completion and preserves stored evidence', async () => {
    const drafts = require('../../lib/maintenanceCompletionPhotoDraft')
    drafts.getMaintenanceCompletionPhotoDraft.mockImplementation(async (key: string) => {
      if (!key.startsWith('deep-cleaning-before:')) throw new Error('fixture after read failed')
      return []
    })
    const { ui } = renderDeep()
    await waitFor(() => expect(ui.getByText('后图草稿读取失败，请重新打开任务重试；原资料未删除。')).toBeTruthy())
    expect(ui.getByTestId('deep-cleaning-task-complete').props.accessibilityState.disabled).toBe(true)
    expect(drafts.clearMaintenanceCompletionPhotoDraft).not.toHaveBeenCalled()
    expect(require('../../lib/api').submitDeepCleaningCompletion).not.toHaveBeenCalled()
  })

  test.each(['before', 'after'])('missing %s local file without upload is not described as uploaded evidence', async (phase) => {
    const drafts = require('../../lib/maintenanceCompletionPhotoDraft')
    drafts.getMaintenanceCompletionPhotoDraft.mockImplementation(async (key: string) => (key.startsWith('deep-cleaning-before:') === (phase === 'before')) ? [{ media_id: 'missing-file', local_uri: null, remote_reference: null, upload_state: 'blocked_local_missing' }] : [])
    const { ui } = renderDeep()
    await waitFor(() => expect(ui.getByText(phase === 'before' ? '本地前图已丢失且未上传，请移除此草稿后重新拍摄' : '本地后图已丢失且未上传，请移除此草稿后重新拍摄。')).toBeTruthy())
    expect(require('../../lib/api').submitDeepCleaningCompletion).not.toHaveBeenCalled()
  })

  test('original photos use exact shared reader context and never become after evidence', async () => {
    const { ui } = renderDeep()
    await waitFor(() => expect(ui.getByText('清洁前照片')).toBeTruthy())
    expect(ui.getByText('清洁后照片')).toBeTruthy()
    expect(ui.queryByTestId('maintenance-action-photo-0')).toBeNull()
    expect(ui.getByTestId('deep-cleaning-before-photo-0')).toBeTruthy()
    const before = ui.getByLabelText('mzapp/deep-before.jpg|property_deep_cleaning:d1')
    expect(before.props.resizeMode).toBe('contain')
    fireEvent.press(ui.getByTestId('deep-cleaning-before-photo-0'))
    expect(ui.getByTestId('cleaning-media-preview')).toHaveProp('accessibilityLabel', 'mzapp/deep-before.jpg|property_deep_cleaning:d1')
  })
  test('completion uses dedicated no-price action and authoritative pending-review receipt', async () => {
    seedDraft()
    const { ui, navigation } = renderDeep()
    await waitFor(() => expect(ui.getByTestId('maintenance-action-photo-0')).toBeTruthy())
    expect(ui.getByTestId('maintenance-action-photo-0').props.localUri).toBe('file:///documents/deep-after.jpg')
    fireEvent.press(ui.getByTestId('deep-cleaning-task-complete'))
    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled())
    const api = require('../../lib/api')
    expect(api.markWorkTask).not.toHaveBeenCalled()
    expect(api.submitDeepCleaningCompletion).toHaveBeenCalledWith('t1', expect.objectContaining({ recordId: 'd1', completionPhotoUrls: [after], operationId: expect.any(String) }))
    expect(api.submitDeepCleaningCompletion.mock.calls.at(-1)[1]).not.toHaveProperty('amount')
    expect(snapshot.items[0]).toMatchObject({ status: 'pending_review', source_workflow_status: 'pending_review', deep_cleaning_workflow: { status: 'pending_review', available_actions: [] }, counts_as_active_task: false })
    expect(ui.getByText('待审核')).toBeTruthy()
    expect(ui.queryByText('待处理')).toBeNull()
    expect(snapshot.items[0].work_record_visible).toBe(false)
  })
  test.each(['finance', 'hr'])('server-authorized assigned deep completion is not hidden for %s role', async (role) => {
    const previousUser = mockAuthState.user
    mockAuthState.user = { id: 'u1', username: 'synthetic-executor', role }
    try {
      seedDraft()
      const { ui, navigation } = renderDeep()
      await waitFor(() => expect(ui.getByTestId('maintenance-action-photo-0')).toBeTruthy())
      fireEvent.press(ui.getByTestId('deep-cleaning-task-complete'))
      await waitFor(() => expect(navigation.goBack).toHaveBeenCalled())
      expect(require('../../lib/api').submitDeepCleaningCompletion).toHaveBeenCalledWith('t1', expect.objectContaining({ recordId: 'd1' }))
      expect(ui.getByText('待审核')).toBeTruthy()
      expect(ui.queryByTestId('deep-cleaning-task-complete')).toBeNull()
      ui.unmount()
    } finally { mockAuthState.user = previousUser }
  })
  test('save failure retains uploaded draft and retry uses same operation without reupload', async () => {
    seedDraft()
    const api = require('../../lib/api')
    api.submitDeepCleaningCompletion.mockRejectedValueOnce(new Error('offline'))
    const uploadsBefore = api.uploadMzappMedia.mock.calls.length
    const { ui } = renderDeep()
    await waitFor(() => expect(ui.getByTestId('maintenance-action-photo-0')).toBeTruthy())
    fireEvent.press(ui.getByTestId('deep-cleaning-task-complete'))
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith(expect.any(String), 'offline'))
    expect(require('../../lib/maintenanceCompletionPhotoDraft').clearMaintenanceCompletionPhotoDraft).not.toHaveBeenCalled()
    fireEvent.press(ui.getByTestId('deep-cleaning-task-complete'))
    await waitFor(() => expect(api.submitDeepCleaningCompletion).toHaveBeenCalledTimes(2))
    expect(api.submitDeepCleaningCompletion.mock.calls[0][1].operationId).toBe(api.submitDeepCleaningCompletion.mock.calls[1][1].operationId)
    expect(api.uploadMzappMedia.mock.calls.length).toBe(uploadsBefore)
  })
  test('mixed saved and new photos retain canonical readonly evidence', async () => {
    snapshot.items[0].completion_photo_urls = ['mzapp/already-saved.jpg']
    seedDraft()
    const { ui } = renderDeep()
    await waitFor(() => expect(ui.getByTestId('maintenance-action-photo-1')).toBeTruthy())
    expect(ui.getByTestId('maintenance-action-photo-0').props.remoteReference).toBe('mzapp/already-saved.jpg')
    expect(ui.getByTestId('maintenance-action-photo-1').props.remoteReference).toBe('')
    expect(ui.getAllByLabelText('删除标记照片')).toHaveLength(1)
    fireEvent.press(ui.getByLabelText('删除标记照片'))
    expect(require('../../lib/maintenanceCompletionPhotoDraft').removeMaintenanceCompletionPhotoDraft).toHaveBeenCalledWith('property_deep_cleaning:d1', 'u1', 'deep-media')
    expect(ui.getByTestId('maintenance-action-photo-0').props.remoteReference).toBe('mzapp/already-saved.jpg')
  })
  test('missing local unsaved photo never requests unassociated remote bytes', async () => {
    require('../../lib/maintenanceCompletionPhotoDraft').getMaintenanceCompletionPhotoDraft.mockResolvedValueOnce([{
      media_id: 'missing-deep-media', local_uri: null, remote_reference: after,
      name: 'deep.jpg', mime_type: 'image/jpeg', captured_at: '', upload_state: 'remote_stored', error_code: null,
    }])
    const { ui } = renderDeep()
    await waitFor(() => expect(ui.getByTestId('deep-cleaning-photo-local-missing')).toBeTruthy())
    expect(ui.queryByLabelText(`${after}|property_deep_cleaning:d1`)).toBeNull()
    expect(require('../../lib/maintenanceCompletionPhotoDraft').clearMaintenanceCompletionPhotoDraft).not.toHaveBeenCalled()
  })
  test.each(['pending_review', 'completed', 'assigned'])('cached/direct %s without server action cannot mutate', async (status) => {
    snapshot.items[0] = { ...snapshot.items[0], status, completion_photo_urls: [after], deep_cleaning_workflow: { status, available_actions: [] } }
    const { ui } = renderDeep()
    await waitFor(() => expect(ui.getByText('清洁后照片')).toBeTruthy())
    expect(ui.queryByTestId('deep-cleaning-task-complete')).toBeNull()
    expect(ui.queryByTestId('offline-task-mark-camera')).toBeNull()
    expect(ui.queryByLabelText('删除标记照片')).toBeNull()
    expect(ui.queryByText('未完成')).toBeNull()
    expect(require('../../lib/api').submitDeepCleaningCompletion).not.toHaveBeenCalled()
  })
})

test.each(['property_maintenance', 'cleaning_offline_tasks'])('completion photo refresh preserves unsaved %s notes and unfinished draft', async (source_type) => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previous = snapshot.items[0]
  snapshot.items[0] = { id: 'draft-isolation', source_id: 'draft-fixture', source_type, task_kind: source_type === 'property_maintenance' ? 'maintenance' : 'offline', title: 'Fixture', property: { code: 'DRAFT' }, status: 'assigned', scheduled_date: '2026-01-01', available_actions: [], completion_photo_urls: [], maintenance_workflow: { status: 'assigned', available_actions: ['executor_complete', 'executor_unfinished'] } }
  const Screen = require('./TaskDetailScreen').default
  try {
    const ui = render(<I18nProvider><Screen navigation={{ goBack: jest.fn(), setParams: jest.fn() }} route={{ params: { id: 'draft-isolation' } }} /></I18nProvider>)
    await waitFor(() => expect(ui.getByPlaceholderText('备注')).toBeTruthy())
    fireEvent.changeText(ui.getByPlaceholderText('备注'), '尚未保存的备注')
    fireEvent.press(ui.getByText('未完成'))
    fireEvent.changeText(ui.getByPlaceholderText('未完成原因'), '尚未保存的原因')
    await require('@testing-library/react-native').act(async () => { await store.patchWorkTaskItem('draft-isolation', { completion_photo_urls: ['fixture/remote.jpg'] }) })
    expect(ui.getByPlaceholderText('备注').props.value).toBe('尚未保存的备注')
    expect(ui.getByPlaceholderText('未完成原因').props.value).toBe('尚未保存的原因')
    ui.unmount()
  } finally { snapshot.items[0] = previous }
})

test.each([
  ['cleaning_tasks', 'cleaning', 'checkout_clean'],
  ['cleaning_tasks', 'cleaning', 'stayover_clean'],
  ['cleaning_tasks', 'inspection', 'checkout_clean'],
  ['property_maintenance', 'maintenance', ''],
])('deep scope fix preserves existing %s/%s/%s turnover display', async (source_type, task_kind, task_type) => {
  const snapshot = require('../../lib/workTasksStore').getWorkTasksSnapshot()
  const previous = snapshot.items[0]
  snapshot.items[0] = { id: 'normal-scope', source_id: 'normal-source', source_type, task_kind, task_type, title: 'Fixture', property: { code: 'NORMAL' }, status: 'assigned', start_time: '10am', end_time: '3pm', scheduled_date: '2026-01-01', available_actions: [] }
  const Screen = require('./TaskDetailScreen').default
  try {
    const ui = render(<I18nProvider><Screen navigation={{ goBack: jest.fn(), setParams: jest.fn() }} route={{ params: { id: 'normal-scope' } }} /></I18nProvider>)
    expect(ui.getByText('NORMAL 退房 入住')).toBeTruthy()
    expect(ui.getByText('退房时间：10am  入住时间：3pm')).toBeTruthy()
    expect(ui.getByText('无入住指南，请联系管理员')).toBeTruthy()
    if (task_type === 'stayover_clean') expect(ui.getByText('入住中清洁')).toBeTruthy()
    ui.unmount()
  } finally { snapshot.items[0] = previous }
})

describe('MZ118 ordinary offline task private completion photo lifecycle', () => {
  let previousTask: any
  let alertSpy: jest.SpyInstance
  const mount = () => {
    const TaskDetailScreen = require('./TaskDetailScreen').default
    return render(<I18nProvider><TaskDetailScreen navigation={{ goBack: jest.fn(), setParams: jest.fn() }} route={{ key: 'mz118', name: 'TaskDetail', params: { id: 'w1' } }} /></I18nProvider>)
  }
  beforeEach(() => {
    const snapshot = require('../../lib/workTasksStore').getWorkTasksSnapshot()
    previousTask = { ...snapshot.items[0] }
    snapshot.items[0] = { ...previousTask, source_type: 'cleaning_offline_tasks', source_id: 'offline-118', task_kind: 'offline', assignee_id: 'u1', status: 'assigned', available_actions: undefined, completion_photo_urls: [], work_record_read_only: false }
    mockAuthState.user = { id: 'u1', username: 'tester', role: 'staff' }
    const api = require('../../lib/api')
    api.uploadMzappMedia.mockReset().mockResolvedValue({ remoteReference: 'mzapp/completion-photo.jpg', url: 'mzapp/completion-photo.jpg' })
    api.markWorkTask.mockReset().mockResolvedValue({ ok: true })
    api.appendWorkTaskCompletionPhotos.mockClear()
    mockAuthState.token = 't1'
    api.submitMaintenanceExecutorAction.mockClear()
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  })
  afterEach(() => {
    require('../../lib/workTasksStore').getWorkTasksSnapshot().items[0] = previousTask
    mockAuthState.user = { id: 'u1', username: 'tester', role: 'staff' }
    mockAuthState.token = 't1'
    require('../../lib/localMediaDrafts').draftFileExists.mockReturnValue(true)
    alertSpy.mockRestore()
  })

  test('uploaded but unsubmitted photo previews local durable file and submits using ordinary mark endpoint', async () => {
    const api = require('../../lib/api')
    const ui = mount()
    fireEvent.press(await ui.findByTestId('offline-task-mark-camera'))
    await waitFor(() => expect(ui.getByTestId('maintenance-action-photo-0').props.localUri).toBe('file:///persistent/completion.jpg'))
    expect(mockCompletionDrafts['w1:u1'][0].remote_reference).toBe('mzapp/completion-photo.jpg')
    expect(ui.getByTestId('maintenance-action-photo-0').props.remoteReference).toBe('')
    fireEvent.press(ui.getByTestId('maintenance-action-photo-0'))
    await waitFor(() => expect(ui.getByTestId('cleaning-media-preview').props.localUri).toBe('file:///persistent/completion.jpg'))
    expect(ui.getByTestId('cleaning-media-preview').props.reference).toBe('')
    fireEvent.press(ui.getByText('关闭'))
    expect(api.markWorkTask).not.toHaveBeenCalled()
    fireEvent.press(ui.getByTestId('offline-task-complete'))
    await waitFor(() => expect(api.markWorkTask).toHaveBeenCalledWith('t1', 'w1', expect.objectContaining({ action: 'done', photo_urls: ['mzapp/completion-photo.jpg'] })))
    expect(api.submitMaintenanceExecutorAction).not.toHaveBeenCalled()
  })

  test('failed upload retains local preview and retry uses same persisted photo', async () => {
    const api = require('../../lib/api')
    api.uploadMzappMedia.mockRejectedValueOnce(new Error('upload_failed'))
    const ui = mount()
    fireEvent.press(await ui.findByTestId('offline-task-mark-camera'))
    await waitFor(() => expect(mockCompletionDrafts['w1:u1']?.[0]?.upload_state).toBe('failed'))
    expect(ui.getByTestId('maintenance-action-photo-0').props.localUri).toBe('file:///persistent/completion.jpg')
    fireEvent.press(ui.getByTestId('maintenance-photo-retry-upload'))
    await waitFor(() => expect(mockCompletionDrafts['w1:u1'][0].remote_reference).toBe('mzapp/completion-photo.jpg'))
    expect(api.uploadMzappMedia).toHaveBeenCalledTimes(2)
    expect(api.markWorkTask).not.toHaveBeenCalled()
  })

  test('saved task photos use the exact work-task authorized remote reference after reentry', async () => {
    const snapshot = require('../../lib/workTasksStore').getWorkTasksSnapshot()
    snapshot.items[0].completion_photo_urls = ['mzapp/saved.jpg']
    const ui = mount()
    const photo = await ui.findByTestId('maintenance-action-photo-0')
    expect(photo.props.remoteReference).toBe('mzapp/saved.jpg')
    expect(photo.props.accessWorkTaskId).toBe('w1')
    expect(photo.props.localUri).toBeNull()
  })

  test('an unsaved draft with missing local file never falls back to unassociated remote media', async () => {
    mockCompletionDrafts['w1:u1'] = [{ media_id: 'missing', local_uri: 'file:///gone.jpg', remote_reference: 'mzapp/not-associated.jpg', name: 'x.jpg', mime_type: 'image/jpeg', captured_at: '', upload_state: 'remote_stored' }]
    require('../../lib/localMediaDrafts').draftFileExists.mockReturnValue(false)
    const ui = mount()
    await ui.findByTestId('completion-photo-local-missing-0')
    expect(ui.queryByTestId('maintenance-action-photo-0')).toBeNull()
    expect(require('../../lib/api').uploadMzappMedia).not.toHaveBeenCalled()
    expect(mockCompletionDrafts['w1:u1'][0].remote_reference).toBe('mzapp/not-associated.jpg')
  })

  test('ordinary unfinished submission persists its photo association and reopens with authorized remote media', async () => {
    const api = require('../../lib/api')
    let ui = mount()
    fireEvent.press(await ui.findByTestId('offline-task-mark-camera'))
    await waitFor(() => expect(mockCompletionDrafts['w1:u1']?.[0]?.remote_reference).toBe('mzapp/completion-photo.jpg'))
    fireEvent.press(ui.getByTestId('offline-task-not-complete'))
    fireEvent.changeText(ui.getByPlaceholderText('未完成原因'), '客人还在房间')
    fireEvent.press(ui.getByText('提交'))
    await waitFor(() => expect(api.markWorkTask).toHaveBeenCalledWith('t1', 'w1', expect.objectContaining({ action: 'defer', reason: '客人还在房间', photo_urls: ['mzapp/completion-photo.jpg'] })))
    await waitFor(() => expect(require('../../lib/workTasksStore').getWorkTasksSnapshot().items[0].completion_photo_urls).toEqual(['mzapp/completion-photo.jpg']))
    ui.unmount()
    ui = mount()
    await waitFor(() => expect(ui.getByTestId('maintenance-action-photo-0').props.remoteReference).toBe('mzapp/completion-photo.jpg'))
    expect(ui.getByTestId('maintenance-action-photo-0').props.accessWorkTaskId).toBe('w1')
    expect(api.submitMaintenanceExecutorAction).not.toHaveBeenCalled()
    expect(api.uploadMzappMedia).toHaveBeenCalledTimes(1)
  })

  test('deleting a mixed canonical/draft display removes the selected draft identity, not a shifted index', async () => {
    const snapshot = require('../../lib/workTasksStore').getWorkTasksSnapshot()
    snapshot.items[0].completion_photo_urls = ['mzapp/saved-first.jpg']
    mockCompletionDrafts['w1:u1'] = [{ media_id: 'new-draft', local_uri: 'file:///persistent/new.jpg', remote_reference: 'mzapp/new-draft.jpg', name: 'x.jpg', mime_type: 'image/jpeg', captured_at: '', upload_state: 'remote_stored' }]
    const ui = mount()
    await waitFor(() => expect(ui.getAllByLabelText('删除标记照片')).toHaveLength(2))
    fireEvent.press(ui.getAllByLabelText('删除标记照片')[1])
    await waitFor(() => expect(mockCompletionDrafts['w1:u1']).toEqual([]))
    expect(ui.getByTestId('maintenance-action-photo-0').props.remoteReference).toBe('mzapp/saved-first.jpg')
    expect(snapshot.items[0].completion_photo_urls).toEqual(['mzapp/saved-first.jpg'])
  })

  test('completed task resumes an acknowledged draft without a pending queue through explicit append retry', async () => {
    const snapshot = require('../../lib/workTasksStore').getWorkTasksSnapshot()
    snapshot.items[0].status = 'done'
    snapshot.items[0].available_actions = [{ id: 'append_completion_photo', label: '补充完成记录照片', placement: 'more', enabled: true, target: 'TaskDetail', intent: 'completion' }]
    mockCompletionDrafts['w1:u1'] = [{ media_id: 'interrupted', local_uri: 'file:///persistent/new.jpg', remote_reference: 'mzapp/completion-photo.jpg', name: 'x.jpg', mime_type: 'image/jpeg', captured_at: '', upload_state: 'remote_stored' }]
    const api = require('../../lib/api')
    const pendingStore = require('../../lib/workTaskCompletionPhotoPending')
    const ui = mount()
    const retry = await ui.findByTestId('offline-task-completion-photo-retry-save')
    expect(api.appendWorkTaskCompletionPhotos).not.toHaveBeenCalled()
    expect(api.uploadMzappMedia).not.toHaveBeenCalled()
    fireEvent.press(retry)
    await waitFor(() => expect(api.appendWorkTaskCompletionPhotos).toHaveBeenCalledWith('t1', 'w1', { photo_urls: ['mzapp/completion-photo.jpg'] }))
    expect(pendingStore.setPendingWorkTaskCompletionPhotoReferences).toHaveBeenCalledWith('w1', 'u1', ['mzapp/completion-photo.jpg'])
    expect(pendingStore.setPendingWorkTaskCompletionPhotoReferences.mock.invocationCallOrder[0]).toBeLessThan(api.appendWorkTaskCompletionPhotos.mock.invocationCallOrder[0])
    expect(api.uploadMzappMedia).not.toHaveBeenCalled()
  })

  test('completed task can discard a failed local draft without deleting its saved business photos', async () => {
    const snapshot = require('../../lib/workTasksStore').getWorkTasksSnapshot()
    snapshot.items[0].status = 'done'
    snapshot.items[0].completion_photo_urls = ['mzapp/saved-completed.jpg']
    snapshot.items[0].available_actions = [{ id: 'append_completion_photo', label: '补充完成记录照片', placement: 'more', enabled: true, target: 'TaskDetail', intent: 'completion' }]
    mockCompletionDrafts['w1:u1'] = [{ media_id: 'failed-missing', local_uri: 'file:///gone.jpg', remote_reference: null, name: 'x.jpg', mime_type: 'image/jpeg', captured_at: '', upload_state: 'failed' }]
    require('../../lib/localMediaDrafts').draftFileExists.mockReturnValue(false)
    const api = require('../../lib/api')
    const ui = mount()
    await ui.findByTestId('completion-photo-local-missing-1')
    expect(ui.getAllByLabelText('删除标记照片')).toHaveLength(1)
    fireEvent.press(ui.getByLabelText('删除标记照片'))
    await waitFor(() => expect(mockCompletionDrafts['w1:u1']).toEqual([]))
    expect(snapshot.items[0].completion_photo_urls).toEqual(['mzapp/saved-completed.jpg'])
    expect(ui.queryByLabelText('删除标记照片')).toBeNull()
    expect(api.appendWorkTaskCompletionPhotos).not.toHaveBeenCalled()
    expect(api.markWorkTask).not.toHaveBeenCalled()
  })

  test('an upload acknowledgement arriving after account switch cannot populate the next account', async () => {
    const api = require('../../lib/api')
    let finishUpload: (value: any) => void = () => {}
    api.uploadMzappMedia.mockImplementationOnce(() => new Promise((resolve) => { finishUpload = resolve }))
    const ui = mount()
    fireEvent.press(await ui.findByTestId('offline-task-mark-camera'))
    await waitFor(() => expect(api.uploadMzappMedia).toHaveBeenCalledTimes(1))
    mockAuthState.user = { id: 'u2', username: 'other', role: 'staff' }
    mockAuthState.token = 't2'
    const TaskDetailScreen = require('./TaskDetailScreen').default
    ui.rerender(<I18nProvider><TaskDetailScreen navigation={{ goBack: jest.fn(), setParams: jest.fn() }} route={{ key: 'mz118', name: 'TaskDetail', params: { id: 'w1' } }} /></I18nProvider>)
    await act(async () => { finishUpload({ remoteReference: 'mzapp/old-account.jpg', url: 'mzapp/old-account.jpg' }) })
    await waitFor(() => expect(ui.queryByTestId('maintenance-action-photo-0')).toBeNull())
    expect(mockCompletionDrafts['w1:u2']).toBeUndefined()
    expect(api.markWorkTask).not.toHaveBeenCalled()
    expect(api.appendWorkTaskCompletionPhotos).not.toHaveBeenCalled()
  })

  test.each(['done', 'defer'])('combined ordinary %s completion ignores late receipt after account switch', async (action) => {
    const api = require('../../lib/api')
    let finish: (value: any) => void = () => {}
    api.markWorkTask.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    const navigation = { goBack: jest.fn(), setParams: jest.fn() }
    const Screen = require('./TaskDetailScreen').default
    const ui = render(<I18nProvider><Screen navigation={navigation} route={{ params: { id: 'w1' } }} /></I18nProvider>)
    if (action === 'defer') {
      fireEvent.press(ui.getByText('未完成'))
      fireEvent.changeText(ui.getByPlaceholderText('未完成原因'), 'fixture reason')
      fireEvent.press(ui.getByText('提交'))
    } else fireEvent.press(await ui.findByTestId('offline-task-complete'))
    await waitFor(() => expect(api.markWorkTask).toHaveBeenCalledTimes(1))
    mockAuthState.user = { id: 'u2', username: 'other', role: 'staff' }
    mockAuthState.token = 't2'
    ui.rerender(<I18nProvider><Screen navigation={navigation} route={{ params: { id: 'w1' } }} /></I18nProvider>)
    await act(async () => { finish({ ok: true }) })
    expect(require('../../lib/workTasksStore').getWorkTasksSnapshot().items[0].status).toBe('assigned')
    expect(navigation.goBack).not.toHaveBeenCalled()
  })

  test('business save failure retains acknowledged upload across reentry and never shares it with another owner', async () => {
    const api = require('../../lib/api')
    api.markWorkTask.mockRejectedValueOnce(new Error('business_save_failed'))
    let ui = mount()
    fireEvent.press(await ui.findByTestId('offline-task-mark-camera'))
    await waitFor(() => expect(mockCompletionDrafts['w1:u1']?.[0]?.remote_reference).toBe('mzapp/completion-photo.jpg'))
    fireEvent.press(ui.getByTestId('offline-task-complete'))
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('business_save_failed')))
    ui.unmount()
    ui = mount()
    await waitFor(() => expect(ui.getByTestId('maintenance-action-photo-0').props.localUri).toBe('file:///persistent/completion.jpg'))
    expect(api.uploadMzappMedia).toHaveBeenCalledTimes(1)
    ui.unmount()
    mockAuthState.user = { id: 'u2', username: 'other', role: 'staff' }
    ui = mount()
    await waitFor(() => expect(require('../../lib/maintenanceCompletionPhotoDraft').getMaintenanceCompletionPhotoDraft).toHaveBeenCalledWith('w1', 'u2'))
    expect(ui.queryByTestId('maintenance-action-photo-0')).toBeNull()
    expect(mockCompletionDrafts['w1:u1'][0].remote_reference).toBe('mzapp/completion-photo.jpg')
    expect(api.submitMaintenanceExecutorAction).not.toHaveBeenCalled()
  })
})
