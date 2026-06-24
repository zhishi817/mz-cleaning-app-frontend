import React from 'react'
import { Alert } from 'react-native'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { I18nProvider } from '../../lib/i18n'

let mockKeyQueueItem: any = null
const mockAuthState = { user: { id: 'u1', username: 'tester', role: 'staff' }, token: 't1' }

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

test('task detail shows 晚入住 tag when checkin time is later than 3pm', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  snapshot.items[0].task_kind = 'cleaning'
  snapshot.items[0].task_type = undefined
  snapshot.items[0].inspection_scope = undefined
  snapshot.items[0].inspection_mode = undefined
  snapshot.items[0].start_time = '10am'
  snapshot.items[0].end_time = '4pm'

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
