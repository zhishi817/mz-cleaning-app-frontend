import React from 'react'
import { Alert } from 'react-native'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { I18nProvider } from '../../lib/i18n'

let mockKeyQueueItem: any = null
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

jest.mock('../../lib/workTasksStore', () => {
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
    subscribeWorkTasks: () => () => {},
    getWorkTasksSnapshot: () => snapshot,
    patchWorkTaskItem: jest.fn(async () => {}),
    refreshWorkTasksFromServer: jest.fn(async () => {}),
    findWorkTaskItemByAnyId: (id: string) => snapshot.items.find((item) => item.id === id || item.source_id === id) || null,
  }
})

jest.mock('../../lib/api', () => {
  const actual = jest.requireActual('../../lib/api')
  return {
    ...actual,
    uploadCleaningMedia: jest.fn(async () => ({ url: 'http://example.com/k.jpg' })),
    markWorkTask: jest.fn(async () => ({ ok: true })),
    startCleaningTask: jest.fn(async () => ({ ok: true })),
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

beforeEach(() => {
  mockKeyQueueItem = null
})

test('uploading key photo updates task status to cleaning', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>

  const ui = render(
    <I18nProvider>
      <TaskDetailScreen navigation={{ goBack: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'k', name: 'TaskDetail', params: { id: 'w1' } } as any} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText(/upload key|上传钥匙/i)).toBeTruthy()
  })
  fireEvent.press(ui.getByText(/upload key|上传钥匙/i))

  await waitFor(() => {
    expect((Alert.alert as any).mock.calls.length).toBeGreaterThan(0)
  })
})

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
  })

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
