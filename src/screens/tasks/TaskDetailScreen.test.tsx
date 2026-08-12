import React from 'react'
import { Alert, StyleSheet } from 'react-native'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { I18nProvider } from '../../lib/i18n'

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
    refreshWorkTasksFromServer: jest.fn(async () => {}),
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

jest.mock('../../lib/maintenanceCompletionPhotoDraft', () => ({
  clearMaintenanceCompletionPhotoDraft: jest.fn(async () => {}),
  createMaintenanceCompletionPhotoMediaId: jest.fn(() => 'media-1'),
  getMaintenanceCompletionPhotoDraft: jest.fn(async () => []),
  removeMaintenanceCompletionPhotoDraft: jest.fn(async () => {}),
  setMaintenanceCompletionPhotoDraft: jest.fn(async (_taskId: string, _ownerId: string, photos: any[]) => photos),
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
  mockKeyQueueItem = null
  mockPendingCompletionPhotoReferences = []
  require('../../lib/api').getWorkTaskFormPhotos.mockClear()
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
  workTasksStore.refreshWorkTasksFromServer.mockClear()
  fireEvent.press(ui.getByText(/upload key|上传钥匙/i))

  await waitFor(() => {
    expect(keyQueue.enqueueKeyUpload).toHaveBeenCalledWith(expect.objectContaining({ cleaning_task_id: 'ct1', source_uri: 'file:///tmp/k.jpg' }))
    expect(keyQueue.processKeyUploadQueue).toHaveBeenCalledWith('t1')
    expect(workTasksStore.refreshWorkTasksFromServer).toHaveBeenCalledWith(
      expect.objectContaining({ token: 't1', userId: 'u1', view: 'mine' }),
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
  const refreshMock = store.refreshWorkTasksFromServer as jest.Mock
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
  const refreshMock = store.refreshWorkTasksFromServer as jest.Mock
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
    expect(ui.getByText('执行')).toBeTruthy()
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
    expect(ui.getByText('执行')).toBeTruthy()
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
      expect(api.uploadMzappMedia).toHaveBeenCalledWith('t1', expect.objectContaining({ uri: 'file:///tmp/k.jpg' }))
      expect(api.appendWorkTaskCompletionPhotos).toHaveBeenCalledWith('t1', 'w1', { photo_urls: ['mzapp/completion-photo.jpg'] })
      expect(store.patchWorkTaskItem).toHaveBeenCalledWith('w1', { completion_photo_urls: ['mzapp/completion-photo.jpg'] })
    })
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
      expect(ui.queryByTestId('maintenance-action-photo-0')).toBeNull()
      expect(ui.queryByLabelText('删除标记照片')).toBeNull()
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
  fireEvent.changeText(ui.getByDisplayValue('送暖气'), '送暖气（已确认）')
  fireEvent.changeText(ui.getByLabelText('offline-edit-date'), '2026-07-24')
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
        assignee_id: 'cleaner-2',
      }),
    )
  })

  updateMock.mockRestore()
  ;(api.listUsers as jest.Mock).mockRestore()
  ;(api.listCleaningAppPropertyCodes as jest.Mock).mockRestore()
  snapshot.items[0] = previousTask
  mockAuthState.user = previousUser
})
