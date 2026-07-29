import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import * as Clipboard from 'expo-clipboard'
import { I18nProvider } from '../../lib/i18n'

jest.mock('react-native-safe-area-context', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    SafeAreaView: (props: any) => React.createElement(View, props),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  }
})

const pad2 = (value: number) => String(value).padStart(2, '0')
const mockToday = new Date()
const mockTodayKey = `${mockToday.getFullYear()}-${pad2(mockToday.getMonth() + 1)}-${pad2(mockToday.getDate())}`
const mockAuthState = {
  status: 'signedIn',
  token: 'local:test',
  user: { id: 'u1', username: 'tester', role: 'cleaner' as string, roles: ['cleaner'] as string[] },
}
const mockRoleState = {
  canSwitchTaskMode: false,
  isTaskManagerUser: false,
}

function flattenRenderedText(node: any): string[] {
  if (node == null || typeof node === 'boolean') return []
  if (typeof node === 'string' || typeof node === 'number') return [String(node)]
  if (Array.isArray(node)) return node.flatMap(flattenRenderedText)
  return flattenRenderedText(node.children || [])
}

function expandTask(ui: ReturnType<typeof render>, taskId: string) {
  fireEvent.press(ui.getByLabelText(`task-collapse-${taskId}`))
}

function flattenTestStyle(style: any): Record<string, any> {
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flattenTestStyle))
  return style && typeof style === 'object' ? style : {}
}

jest.mock('../../components/GuestLuggageCard', () => () => null)

jest.mock('../../lib/auth', () => ({
  useAuth: () => mockAuthState,
}))

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(async () => {}),
}))

jest.mock('../../lib/api', () => ({
  createCleaningOfflineTask: jest.fn(async () => ({})),
  createManualCleaningTask: jest.fn(async () => ({})),
  listCleaningAppPropertyCodes: jest.fn(async () => []),
  listUsers: jest.fn(async () => []),
  listCleaningAppTasks: jest.fn(async () => []),
  listWorkTasks: jest.fn(async () => []),
  reorderCleaningTasks: jest.fn(async () => ({})),
  reorderMixedWorkTasks: jest.fn(async () => ({})),
  reorderWorkTasks: jest.fn(async () => ({})),
  markGuestCheckedOutByOrder: jest.fn(async () => ({})),
  markGuestCheckedOutByTasks: jest.fn(async () => ({})),
  listMzappAlerts: jest.fn(async () => []),
  markMzappAlertRead: jest.fn(async () => ({})),
  getMyProfile: jest.fn(async () => ({ username: 'tester', avatar_url: null })),
  listDayEndHandover: jest.fn(async () => []),
  createWarehouseKeyEvent: jest.fn(async () => ({})),
  getWarehouseKeyStatus: jest.fn(async () => null),
}))

jest.mock('../../lib/dayEndHandoverQueue', () => ({
  processDayEndHandoverQueue: jest.fn(async () => {}),
}))

jest.mock('../../lib/keyUploadQueue', () => ({
  listKeyUploadQueueItems: jest.fn(async () => []),
  processKeyUploadQueue: jest.fn(async () => {}),
  selectKeyPhotoEffectiveState: jest.fn(() => 'missing'),
  subscribeKeyUploadQueue: () => () => {},
}))

jest.mock('../../lib/noticesStore', () => ({
  getNoticesSnapshot: () => ({ items: [], updatedAt: null }),
  initNoticesStore: jest.fn(async () => {}),
  prependNotice: jest.fn(),
  subscribeNotices: () => () => {},
}))

jest.mock('../../lib/profileStore', () => ({
  getProfile: jest.fn(async () => null),
  setProfile: jest.fn(async () => {}),
}))

jest.mock('../../lib/roles', () => ({
  canSwitchTaskMode: () => mockRoleState.canSwitchTaskMode,
  isTaskManagerUser: () => mockRoleState.isTaskManagerUser,
}))

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
        scheduled_date: mockTodayKey,
        start_time: '10am',
        end_time: '3pm',
        assignee_id: 'u1',
        status: 'assigned',
        urgency: 'medium',
        guest_special_request: '请多放两条浴巾',
        property: {
          id: 'p1',
          code: 'Aura2707',
          region: 'CBD',
          address: '123 Collins St',
          unit_type: '2b2b',
          access_guide_link: '',
          wifi_ssid: 'AuraWiFi',
          wifi_password: 'pw-1234',
        },
        date: mockTodayKey,
      },
    ],
    bucketKey: 'bucket',
    updatedAt: null,
    lastFullSyncTimestamp: null,
  }
  return {
    activateWorkTasksRealtime: jest.fn(async () => {}),
    deactivateWorkTasksRealtime: jest.fn(),
    getWorkTasksSnapshot: () => snapshot,
    initWorkTasksStore: jest.fn(async () => {}),
    makeWorkTasksBucketKey: jest.fn(() => 'bucket'),
    patchWorkTaskItem: jest.fn(),
    patchWorkTaskItems: jest.fn(),
    refreshWorkTasksFromServer: jest.fn(async () => {}),
    subscribeWorkTasks: () => () => {},
  }
})

test('tasks screen defaults tasks collapsed, shows guest request, and expands details', async () => {
  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>

  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByLabelText('task-collapse-w1')).toBeTruthy())
  expect(ui.getAllByText('请多放两条浴巾').length).toBeGreaterThan(0)
  expect(ui.queryByText('AuraWiFi')).toBeNull()
  expect(ui.queryByText('pw-1234')).toBeNull()

  expandTask(ui, 'w1')

  await waitFor(() => {
    expect(ui.getByText('AuraWiFi')).toBeTruthy()
    expect(ui.getByText('pw-1234')).toBeTruthy()
  })

  expandTask(ui, 'w1')

  await waitFor(() => {
    expect(ui.queryByText('AuraWiFi')).toBeNull()
    expect(ui.queryByText('pw-1234')).toBeNull()
  })

  expandTask(ui, 'w1')
  await waitFor(() => expect(ui.getByLabelText('wifi-copy-w1')).toBeTruthy())
  fireEvent.press(ui.getByLabelText('wifi-copy-w1'))

  await waitFor(() => {
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('pw-1234')
    expect(ui.getByLabelText('wifi-copied-w1')).toBeTruthy()
    expect(ui.getAllByText('已复制').length).toBeGreaterThan(0)
  })
})

test('周五、周六、周日将日期栏定位到末端，避免今天卡片被裁切', () => {
  const { shouldScrollWeekRowToEnd } = require('./TasksScreen') as typeof import('./TasksScreen')
  expect(shouldScrollWeekRowToEnd(new Date(2026, 6, 23))).toBe(false)
  expect(shouldScrollWeekRowToEnd(new Date(2026, 6, 24))).toBe(true)
  expect(shouldScrollWeekRowToEnd(new Date(2026, 6, 25))).toBe(true)
  expect(shouldScrollWeekRowToEnd(new Date(2026, 6, 26))).toBe(true)
  expect(shouldScrollWeekRowToEnd(new Date(2026, 6, 27))).toBe(false)
})

test('offline task creation can select and submit an executor', async () => {
  const api = require('../../lib/api')
  const previousUser = mockAuthState.user
  const previousRoleState = { ...mockRoleState }
  mockAuthState.user = { id: 'admin-1', username: 'admin-user', role: 'admin', roles: ['admin'] }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = true
  ;(api.listUsers as jest.Mock).mockResolvedValue([
    { id: 'cleaner-2', username: 'alice', role: 'cleaner', display_name: 'Alice' },
  ])
  const createOfflineMock = api.createCleaningOfflineTask as jest.Mock
  createOfflineMock.mockClear()

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-create-offline', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByText('新增')).toBeTruthy())
  fireEvent.press(ui.getByText('新增'))
  fireEvent.press(ui.getByText('线下任务'))

  await waitFor(() => {
    expect(ui.getByText('执行人')).toBeTruthy()
    expect(ui.getByText('未分配')).toBeTruthy()
    expect(ui.getByLabelText('quick-create-assignee')).toBeTruthy()
    expect(ui.queryByText('紧急度')).toBeNull()
  })

  fireEvent.changeText(ui.getByPlaceholderText('例如 临时送物 / 联系客人'), '临时送物')
  fireEvent.press(ui.getByLabelText('quick-create-assignee'))
  await waitFor(() => {
    expect(ui.getByText('Alice')).toBeTruthy()
    expect(ui.getByTestId('quick-create-assignee-options')).toBeTruthy()
    expect(ui.queryByText('清洁人员')).toBeNull()
  })
  fireEvent.press(ui.getByLabelText('quick-create-assignee-cleaner-2'))
  fireEvent.press(ui.getByText('确认新增'))

  await waitFor(() => {
    expect(createOfflineMock).toHaveBeenCalledWith('local:test', expect.objectContaining({
      title: '临时送物',
      assignee_id: 'cleaner-2',
    }))
  })

  mockAuthState.user = previousUser
  mockRoleState.canSwitchTaskMode = previousRoleState.canSwitchTaskMode
  mockRoleState.isTaskManagerUser = previousRoleState.isTaskManagerUser
})

test('saving order keeps offline tasks in the same cleaning execution sequence', async () => {
  const api = require('../../lib/api')
  const store = require('../../lib/workTasksStore')
  const reorderMixedWorkTasksMock = api.reorderMixedWorkTasks as jest.Mock
  const patchWorkTaskItemsMock = store.patchWorkTaskItems as jest.Mock
  const snapshot = store.getWorkTasksSnapshot()
  const previousItems = snapshot.items.slice()
  reorderMixedWorkTasksMock.mockClear()
  patchWorkTaskItemsMock.mockClear()
  snapshot.items = [
    {
      ...previousItems[0],
      id: 'clean-a',
      task_kind: 'cleaning',
      source_type: 'cleaning_tasks',
      source_id: 'ct-clean-a',
      title: 'A 清洁',
      scheduled_date: mockTodayKey,
      assignee_id: 'u1',
      cleaner_id: 'u1',
      inspector_id: null,
      status: 'assigned',
      property: { ...previousItems[0].property, code: 'A1001' },
      date: mockTodayKey,
    },
    {
      id: 'offline-b',
      task_kind: 'offline',
      source_type: 'cleaning_offline_tasks',
      source_id: 'offline-b-source',
      title: 'B 线下',
      summary: '买耗材',
      scheduled_date: mockTodayKey,
      start_time: '',
      end_time: '',
      assignee_id: 'u1',
      assignee_name: 'tester',
      status: 'assigned',
      urgency: 'medium',
      property: null,
      date: mockTodayKey,
    },
    {
      ...previousItems[0],
      id: 'clean-c',
      task_kind: 'cleaning',
      source_type: 'cleaning_tasks',
      source_id: 'ct-clean-c',
      title: 'C 清洁',
      scheduled_date: mockTodayKey,
      assignee_id: 'u1',
      cleaner_id: 'u1',
      inspector_id: null,
      status: 'assigned',
      property: { ...previousItems[0].property, code: 'C1003' },
      date: mockTodayKey,
    },
  ]

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-mixed-reorder', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText('排序')).toBeTruthy()
    expect(ui.getByLabelText('task-card-clean-a')).toBeTruthy()
    expect(ui.getByLabelText('task-card-offline-b')).toBeTruthy()
    expect(ui.getByLabelText('task-card-clean-c')).toBeTruthy()
  })

  fireEvent.press(ui.getByText('排序'))
  fireEvent.press(ui.getByLabelText('task-card-clean-a'))
  fireEvent.press(ui.getByLabelText('task-card-offline-b'))
  fireEvent.press(ui.getByLabelText('task-card-clean-c'))
  fireEvent.press(ui.getByText('保存顺序'))

  await waitFor(() => {
    expect(reorderMixedWorkTasksMock).toHaveBeenCalledWith('local:test', {
      date: mockTodayKey,
      items: [
        { kind: 'cleaner', ids: ['ct-clean-a'], sort_index: 1 },
        { kind: 'work', ids: ['offline-b'], sort_index: 2 },
        { kind: 'cleaner', ids: ['ct-clean-c'], sort_index: 3 },
      ],
    })
  })
  expect(patchWorkTaskItemsMock).toHaveBeenCalledWith([
    { id: 'clean-a', patch: { sort_index: 1, sort_index_cleaner: 1 } },
    { id: 'offline-b', patch: { sort_index: 2 } },
    { id: 'clean-c', patch: { sort_index: 3, sort_index_cleaner: 3 } },
  ])

  snapshot.items = previousItems
})

test('day-end handover stays after ordered offline tasks', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousItems = snapshot.items.slice()
  snapshot.items = [
    {
      ...previousItems[0],
      id: 'clean-a',
      task_kind: 'cleaning',
      source_type: 'cleaning_tasks',
      source_id: 'ct-clean-a',
      title: 'A 清洁',
      scheduled_date: mockTodayKey,
      assignee_id: 'u1',
      cleaner_id: 'u1',
      inspector_id: null,
      status: 'assigned',
      sort_index: 1,
      sort_index_cleaner: 1,
      property: { ...previousItems[0].property, code: 'A1001' },
      date: mockTodayKey,
    },
    {
      ...previousItems[0],
      id: 'clean-b',
      task_kind: 'cleaning',
      source_type: 'cleaning_tasks',
      source_id: 'ct-clean-b',
      title: 'B 清洁',
      scheduled_date: mockTodayKey,
      assignee_id: 'u1',
      cleaner_id: 'u1',
      inspector_id: null,
      status: 'assigned',
      sort_index: 2,
      sort_index_cleaner: 2,
      property: { ...previousItems[0].property, code: 'B1002' },
      date: mockTodayKey,
    },
    {
      ...previousItems[0],
      id: 'clean-c',
      task_kind: 'cleaning',
      source_type: 'cleaning_tasks',
      source_id: 'ct-clean-c',
      title: 'C 清洁',
      scheduled_date: mockTodayKey,
      assignee_id: 'u1',
      cleaner_id: 'u1',
      inspector_id: null,
      status: 'assigned',
      sort_index: 3,
      sort_index_cleaner: 3,
      property: { ...previousItems[0].property, code: 'C1003' },
      date: mockTodayKey,
    },
    {
      id: 'offline-d',
      task_kind: 'offline',
      source_type: 'cleaning_offline_tasks',
      source_id: 'offline-d-source',
      title: 'D 线下',
      summary: '补充线下事项',
      scheduled_date: mockTodayKey,
      start_time: '',
      end_time: '',
      assignee_id: 'u1',
      assignee_name: 'tester',
      status: 'assigned',
      urgency: 'medium',
      sort_index: 4,
      property: null,
      date: mockTodayKey,
    },
  ]

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-day-end-after-offline', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByLabelText('task-card-offline-d')).toBeTruthy()
    expect(ui.getByText('日终交接')).toBeTruthy()
  })

  const rendered = flattenRenderedText(ui.toJSON()).join('\n')
  expect(rendered.indexOf('D 线下')).toBeGreaterThanOrEqual(0)
  expect(rendered.indexOf('日终交接')).toBeGreaterThanOrEqual(0)
  expect(rendered.indexOf('D 线下')).toBeLessThan(rendered.indexOf('日终交接'))

  snapshot.items = previousItems
})

test('key handover execution task shows password-only tag and executor role in list', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousItems = snapshot.items.slice()
  snapshot.items = [
    {
      ...previousItems[0],
      id: 'exec-1',
      task_kind: 'execution',
      execution_role: undefined,
      execution_semantics: undefined,
      task_type: 'checkin_clean',
      inspection_scope: 'password_only',
      inspection_mode: 'same_day',
      source_type: 'cleaning_tasks',
      source_id: 'ct-exec-1',
      assignee_id: 'angela-id',
      assignee_name: 'Angela',
      executor_name: 'Angela',
      cleaner_id: null,
      cleaner_name: null,
      inspector_id: null,
      inspector_name: null,
      start_time: null,
      end_time: '3pm',
      property: {
        ...previousItems[0].property,
        code: 'AU2117',
        region: 'Southbank',
      },
    },
  ]

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-key-handover-exec', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByLabelText('task-collapse-exec-1')).toBeTruthy())
  expandTask(ui, 'exec-1')

  await waitFor(() => {
    expect(ui.getAllByText('执行').length).toBeGreaterThan(0)
    expect(ui.getByText('仅改密码')).toBeTruthy()
    expect(ui.getByText('Angela')).toBeTruthy()
    expect(ui.queryByText('execution')).toBeNull()
  })

  const rendered = flattenRenderedText(ui.toJSON()).join('\n')
  expect(rendered).toContain('执行\nAngela')
  expect(rendered).not.toContain('清洁\nAngela')

  snapshot.items = previousItems
})

test('check-in site execution task shows inspection scope and assignee in list', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousItems = snapshot.items.slice()
  snapshot.items = [
    {
      ...previousItems[0],
      id: 'exec-inspect-1',
      task_kind: 'execution',
      execution_role: 'inspection',
      execution_semantics: 'checkin_inspection',
      task_type: 'checkin_clean',
      inspection_scope: 'inspect_and_hang',
      inspection_mode: 'same_day',
      source_type: 'cleaning_tasks',
      source_id: 'ct-exec-inspect-1',
      assignee_id: 'carrie-id',
      assignee_name: 'Carrie',
      executor_name: null,
      cleaner_id: null,
      cleaner_name: null,
      inspector_id: null,
      inspector_name: null,
      start_time: null,
      end_time: '3pm',
      property: {
        ...previousItems[0].property,
        code: 'FG1003',
        region: '',
      },
    },
  ]

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-checkin-site-exec', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByLabelText('task-collapse-exec-inspect-1')).toBeTruthy())
  expandTask(ui, 'exec-inspect-1')

  await waitFor(() => {
    expect(ui.getAllByText('执行').length).toBeGreaterThan(0)
    expect(ui.getByText('检查后挂钥匙')).toBeTruthy()
    expect(ui.getByText('Carrie')).toBeTruthy()
    expect(ui.queryByText('execution')).toBeNull()
  })

  const rendered = flattenRenderedText(ui.toJSON()).join('\n')
  expect(rendered).toContain('执行\nCarrie')
  expect(rendered).not.toContain('清洁\n-')
  expect(rendered).not.toContain('检查\n-')

  snapshot.items = previousItems
})

test('tasks screen renders primary server actions from available_actions', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousTask = { ...snapshot.items[0] }
  snapshot.items[0] = {
    ...snapshot.items[0],
    task_kind: 'inspection',
    task_type: 'checkin_clean',
    inspection_scope: 'password_only',
    inspection_mode: 'same_day',
    start_time: null,
    end_time: '3pm',
    available_actions: [
      {
        id: 'upload_access_video',
        label: '后端视频动作',
        placement: 'primary',
        enabled: true,
        target: 'InspectionComplete',
        intent: 'site_action',
      },
      {
        id: 'report_issue',
        label: '后端问题反馈',
        placement: 'more',
        enabled: true,
        target: 'FeedbackForm',
        intent: 'issue',
      },
    ],
  }
  const navigation = { navigate: jest.fn(), addListener: jest.fn(() => () => {}) }

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={navigation as any}
        route={{ key: 'tasks-server-actions', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByLabelText('task-collapse-w1')).toBeTruthy())
  expandTask(ui, 'w1')

  await waitFor(() => {
    expect(ui.getByText('后端视频动作')).toBeTruthy()
    expect(ui.queryByText('后端问题反馈')).toBeNull()
    expect(ui.queryByText('上传钥匙')).toBeNull()
  })

  fireEvent.press(ui.getByText('后端视频动作'))

  await waitFor(() => {
    expect(navigation.navigate).toHaveBeenCalledWith('InspectionComplete', { taskId: 'w1', skipInspectionPhotos: true })
  })

  snapshot.items[0] = previousTask
})

test('tasks screen card tap uses the customer-service manager detail for admin roles', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousTask = { ...snapshot.items[0] }
  const previousUser = mockAuthState.user
  const previousRoleState = { ...mockRoleState }
  mockAuthState.user = { id: 'admin-1', username: 'admin-user', role: 'admin', roles: ['admin', 'offline_manager'] }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = true
  snapshot.items[0] = {
    ...snapshot.items[0],
    task_kind: 'inspection',
    task_type: 'checkout_clean',
    inspection_scope: 'inspect_and_hang',
    inspection_mode: 'same_day',
    available_actions: [
      {
        id: 'submit_inspection',
        label: '后端禁用检查',
        placement: 'primary',
        enabled: false,
        disabled_reason: 'not_participant',
        target: 'InspectionPanel',
        intent: 'inspection',
      },
    ],
  }
  const navigation = { navigate: jest.fn(), addListener: jest.fn(() => () => {}) }

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={navigation as any}
        route={{ key: 'tasks-card-server-actions', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByLabelText('task-card-w1')).toBeTruthy()
  })

  fireEvent.press(ui.getByLabelText('task-card-w1'))

  expect(navigation.navigate).toHaveBeenCalledWith('ManagerDailyTask', { taskId: 'w1' })
  expect(navigation.navigate).not.toHaveBeenCalledWith('TaskDetail', { id: 'w1' })
  expect(navigation.navigate).not.toHaveBeenCalledWith('InspectionPanel', { taskId: 'w1' })

  snapshot.items[0] = previousTask
  mockAuthState.user = previousUser
  mockRoleState.canSwitchTaskMode = previousRoleState.canSwitchTaskMode
  mockRoleState.isTaskManagerUser = previousRoleState.isTaskManagerUser
})

test('customer service cleaning task is collapsed by default and opens the original daily cleaning page', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousTask = { ...snapshot.items[0] }
  const previousUser = mockAuthState.user
  const previousRoleState = { ...mockRoleState }
  mockAuthState.user = { id: 'cs-1', username: 'customer-service', role: 'customer_service', roles: ['customer_service'] }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = true
  snapshot.items[0] = {
    ...snapshot.items[0],
    available_actions: [
      {
        id: 'submit_inspection',
        label: '检查与补充',
        placement: 'primary',
        enabled: true,
        target: 'InspectionPanel',
        intent: 'inspection',
      },
      {
        id: 'upload_access_video',
        label: '标记已完成',
        placement: 'primary',
        enabled: true,
        target: 'InspectionComplete',
        intent: 'inspection',
      },
    ],
    task_kind: 'cleaning',
    source_type: 'cleaning_tasks',
  }
  const navigation = { navigate: jest.fn(), addListener: jest.fn(() => () => {}) }

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={navigation as any}
        route={{ key: 'tasks-customer-service-original-card', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByLabelText('task-card-w1')).toBeTruthy()
    expect(ui.getByLabelText('task-collapse-w1')).toBeTruthy()
    expect(ui.queryByText('AuraWiFi')).toBeNull()
    expect(ui.queryByText('pw-1234')).toBeNull()
    expect(ui.getByText('展开')).toBeTruthy()
  })
  fireEvent.press(ui.getByLabelText('task-collapse-w1'))

  await waitFor(() => {
    expect(ui.getByText('AuraWiFi')).toBeTruthy()
    expect(ui.getByText('pw-1234')).toBeTruthy()
    expect(ui.getByText('标记已退房')).toBeTruthy()
    expect(ui.getByText('问题反馈')).toBeTruthy()
    expect(ui.queryByText('检查与补充')).toBeNull()
    expect(ui.queryByText('标记已完成')).toBeNull()
  })
  expect(navigation.navigate).not.toHaveBeenCalled()
  fireEvent.press(ui.getByLabelText('task-card-w1'))

  await waitFor(() => {
    expect(navigation.navigate).toHaveBeenCalledWith('ManagerDailyTask', { taskId: 'w1' })
  })
  expect(navigation.navigate).not.toHaveBeenCalledWith('TaskDetail', { id: 'w1' })

  snapshot.items[0] = previousTask
  mockAuthState.user = previousUser
  mockRoleState.canSwitchTaskMode = previousRoleState.canSwitchTaskMode
  mockRoleState.isTaskManagerUser = previousRoleState.isTaskManagerUser
})

test('marking guest checkout changes the action to a gray checked-out state', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const patchWorkTaskItemMock = store.patchWorkTaskItem as jest.Mock
  const previousTask = { ...snapshot.items[0] }
  const previousUser = mockAuthState.user
  const previousPatchImplementation = patchWorkTaskItemMock.getMockImplementation()
  mockAuthState.user = { id: 'cs-checkout', username: 'customer-service', role: 'customer_service', roles: ['customer_service'] }
  snapshot.items[0] = {
    ...previousTask,
    task_type: 'checkout_clean',
    task_kind: 'cleaning',
    source_type: 'cleaning_tasks',
    source_id: 'checkout-source',
    start_time: '10am',
    end_time: null,
    order_id: 'checkout-order',
    checked_out_at: null,
    available_actions: [
      { id: 'mark_guest_checkout', label: '标记已退房', placement: 'primary', enabled: true, target: 'TaskDetail', intent: 'manager' },
      { id: 'report_issue', label: '问题反馈', placement: 'primary', enabled: true, target: 'FeedbackForm', intent: 'issue' },
    ],
  }
  patchWorkTaskItemMock.mockImplementation(async (id: string, patch: any) => {
    const task = snapshot.items.find((item: any) => item.id === id)
    if (task) Object.assign(task, patch)
  })

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-checkout-state', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByLabelText('task-collapse-w1')).toBeTruthy())
  expandTask(ui, 'w1')
  await waitFor(() => expect(ui.getByText('标记已退房')).toBeTruthy())
  fireEvent.press(ui.getByTestId('task-action-w1-mark_guest_checkout'))

  await waitFor(() => {
    expect(ui.getByText('取消已退房')).toBeTruthy()
    expect(flattenTestStyle(ui.getByTestId('task-action-w1-mark_guest_checkout').props.style)).toEqual(expect.objectContaining({ backgroundColor: '#E5E7EB' }))
    expect(flattenTestStyle(ui.getByText('取消已退房').props.style)).toEqual(expect.objectContaining({ color: '#6B7280' }))
  })

  snapshot.items[0] = previousTask
  mockAuthState.user = previousUser
  if (previousPatchImplementation) patchWorkTaskItemMock.mockImplementation(previousPatchImplementation)
  else patchWorkTaskItemMock.mockReset()
})

test.each([
  ['cleaner', ['cleaner'], false],
  ['cleaning inspector', ['cleaning_inspector'], false],
  ['cleaner inspector', ['cleaner_inspector'], false],
  ['customer service', ['customer_service'], true],
  ['offline manager', ['offline_manager'], true],
  ['admin', ['admin'], true],
])('task cards are collapsed by default for %s', async (_label, roles, isTaskManagerUser) => {
  const previousUser = mockAuthState.user
  const previousRoleState = { ...mockRoleState }
  mockAuthState.user = { id: 'role-test', username: 'role-test', role: roles[0], roles }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = isTaskManagerUser

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: `tasks-default-collapsed-${roles[0]}`, name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByLabelText('task-card-w1')).toBeTruthy()
    expect(ui.getByLabelText('task-collapse-w1')).toBeTruthy()
    expect(ui.queryByText('AuraWiFi')).toBeNull()
    expect(ui.queryByText('pw-1234')).toBeNull()
  })

  snapshotRestoreForRoleTest()

  function snapshotRestoreForRoleTest() {
    mockAuthState.user = previousUser
    mockRoleState.canSwitchTaskMode = previousRoleState.canSwitchTaskMode
    mockRoleState.isTaskManagerUser = previousRoleState.isTaskManagerUser
  }
})

test('inspector fallback card tap passes source id to inspection panel', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousTask = { ...snapshot.items[0] }
  const previousUser = mockAuthState.user
  mockAuthState.user = { id: 'inspector-1', username: 'inspector-user', role: 'cleaning_inspector', roles: ['cleaning_inspector'] }
  snapshot.items[0] = {
    ...snapshot.items[0],
    task_kind: 'inspection',
    task_type: 'checkout_clean',
    inspection_scope: 'inspect_and_hang',
    inspection_mode: 'same_day',
    source_id: 'ct-fallback-source',
    available_actions: undefined,
  }
  const navigation = { navigate: jest.fn(), addListener: jest.fn(() => () => {}) }

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={navigation as any}
        route={{ key: 'tasks-card-inspector-fallback', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByLabelText('task-card-w1')).toBeTruthy()
  })

  fireEvent.press(ui.getByLabelText('task-card-w1'))

  expect(navigation.navigate).toHaveBeenCalledWith('InspectionPanel', { taskId: 'w1', sourceId: 'ct-fallback-source' })

  snapshot.items[0] = previousTask
  mockAuthState.user = previousUser
})

test('tasks screen shows 晚入住 tag when checkin time is later than 6pm', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  snapshot.items[0].end_time = '7pm'

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-late-checkin', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText('晚入住')).toBeTruthy()
  })

  snapshot.items[0].end_time = '3pm'
})

test('property follow-up task prioritizes content before assignee and address', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousItems = snapshot.items.slice()
  snapshot.items = [
    {
      id: 'maintenance-1',
      task_kind: 'maintenance',
      source_type: 'property_maintenance',
      source_id: 'pm-1',
      title: '888312',
      summary: '洗碗机排水不正常',
      scheduled_date: mockTodayKey,
      start_time: '',
      end_time: '',
      assignee_id: 'u1',
      assignee_name: 'Miranda',
      status: 'assigned',
      urgency: 'medium',
      property: {
        id: 'p-maintenance',
        code: '888312',
        region: 'Melbourne',
        address: '888 Collins Street, Melbourne',
        unit_type: '',
        access_guide_link: '',
      },
      date: mockTodayKey,
    },
  ]

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-follow-up-layout', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByLabelText('task-collapse-maintenance-1')).toBeTruthy())
  expandTask(ui, 'maintenance-1')

  await waitFor(() => {
    expect(ui.getByText('任务内容')).toBeTruthy()
    expect(ui.getByText('洗碗机排水不正常')).toBeTruthy()
    expect(ui.getByText('执行人员')).toBeTruthy()
    expect(ui.getByText('Miranda')).toBeTruthy()
    expect(ui.getByText('房源地址')).toBeTruthy()
  })

  const rendered = flattenRenderedText(ui.toJSON()).join('\n')
  expect(rendered.indexOf('洗碗机排水不正常')).toBeLessThan(rendered.indexOf('执行人员'))
  expect(rendered.indexOf('执行人员')).toBeLessThan(rendered.indexOf('888 Collins Street, Melbourne'))

  snapshot.items = previousItems
})

test('manager-only user can switch between 全部 and 我的 without being forced back to 全部', async () => {
  mockAuthState.user = { id: 'u1', username: 'tester', role: 'admin', roles: ['admin', 'offline_manager'] }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = true
  const store = require('../../lib/workTasksStore')
  const refreshMock = store.refreshWorkTasksFromServer as jest.Mock
  refreshMock.mockClear()

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-manager-view', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText('全部')).toBeTruthy()
    expect(ui.getByText('我的')).toBeTruthy()
  })

  await waitFor(() => {
    expect(refreshMock).toHaveBeenCalledWith(expect.objectContaining({ view: 'all' }))
  })

  fireEvent.press(ui.getByText('全部'))

  await waitFor(() => {
    expect(refreshMock).toHaveBeenLastCalledWith(expect.objectContaining({ view: 'all' }))
  })

  fireEvent.press(ui.getByText('我的'))

  await waitFor(() => {
    expect(refreshMock).toHaveBeenLastCalledWith(expect.objectContaining({ view: 'mine' }))
  })

  mockAuthState.user = { id: 'u1', username: 'tester', role: 'cleaner', roles: ['cleaner'] }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = false
})

test('customer service hides day-end overview while admin lazily opens dated staff progress summary', async () => {
  const api = require('../../lib/api')
  const listWorkTasksMock = api.listWorkTasks as jest.Mock
  const listDayEndHandoverMock = api.listDayEndHandover as jest.Mock
  listWorkTasksMock.mockClear()
  listDayEndHandoverMock.mockClear()
  listWorkTasksMock.mockResolvedValue([
    {
      id: 'merged-1',
      task_kind: 'inspection',
      source_type: 'cleaning_tasks',
      source_id: 'ct-1',
      source_ids: ['ct-1', 'ct-2'],
      cleaning_task_ids: ['ct-1'],
      inspection_task_ids: ['ct-2'],
      property_id: 'p1',
      title: 'MQ101',
      summary: null,
      scheduled_date: mockTodayKey,
      start_time: '10am',
      end_time: '3pm',
      assignee_id: 'cleaner-1',
      cleaner_id: null,
      cleaner_name: '清洁A',
      inspector_id: 'inspector-1',
      inspector_name: '检查B',
      status: 'in_progress',
      cleaning_status: 'in_progress',
      inspection_status: 'done',
      urgency: 'medium',
      property: { id: 'p1', code: 'MQ101', address: 'A', unit_type: '2b1b' },
    },
    {
      id: 'merged-2',
      task_kind: 'inspection',
      source_type: 'cleaning_tasks',
      source_id: 'ct-3',
      source_ids: ['ct-3', 'ct-4'],
      cleaning_task_ids: ['ct-3'],
      inspection_task_ids: ['ct-4'],
      property_id: 'p2',
      title: 'MQ102',
      summary: null,
      scheduled_date: mockTodayKey,
      start_time: '10am',
      end_time: '3pm',
      assignee_id: 'inspector-2',
      cleaner_id: null,
      cleaner_name: null,
      inspector_id: 'inspector-2',
      inspector_name: 'zhi-f',
      status: 'to_hang_keys',
      cleaning_status: 'assigned',
      inspection_status: 'to_hang_keys',
      urgency: 'medium',
      property: { id: 'p2', code: 'MQ102', address: 'B', unit_type: '2b1b' },
    },
    {
      id: 'merged-3',
      task_kind: 'cleaning',
      source_type: 'cleaning_tasks',
      source_id: 'ct-5',
      source_ids: ['ct-5'],
      cleaning_task_ids: ['ct-5'],
      inspection_task_ids: [],
      property_id: 'p3',
      title: 'MQ103',
      summary: null,
      scheduled_date: mockTodayKey,
      start_time: '10am',
      end_time: '3pm',
      assignee_id: 'cleaner-3',
      cleaner_id: 'cleaner-3',
      cleaner_name: 'Simon',
      inspector_id: null,
      inspector_name: null,
      status: 'assigned',
      cleaning_status: 'assigned',
      inspection_status: null,
      urgency: 'medium',
      property: { id: 'p3', code: 'MQ103', address: 'C', unit_type: '2b1b' },
    },
    {
      id: 'merged-4',
      task_kind: 'inspection',
      source_type: 'cleaning_tasks',
      source_id: 'ct-6',
      source_ids: ['ct-6'],
      cleaning_task_ids: [],
      inspection_task_ids: ['ct-6'],
      property_id: 'p4',
      title: 'MQ104',
      summary: null,
      scheduled_date: mockTodayKey,
      start_time: '10am',
      end_time: '3pm',
      assignee_id: 'inspector-4',
      cleaner_id: null,
      cleaner_name: null,
      inspector_id: 'inspector-4',
      inspector_name: 'AaronInspector',
      status: 'assigned',
      cleaning_status: null,
      inspection_status: 'assigned',
      urgency: 'medium',
      property: { id: 'p4', code: 'MQ104', address: 'D', unit_type: '2b1b' },
    },
  ])
  listDayEndHandoverMock.mockImplementation(async (_token: string, params: { user_id?: string }) => (
    params?.user_id === 'inspector-1' ? { submitted_at: '2026-06-24T12:00:00.000Z' } : {}
  ))

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>

  mockAuthState.user = { id: 'u2', username: 'customer-service', role: 'customer_service', roles: ['customer_service'] }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = true
  const csUi = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-customer-service', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(csUi.queryByText('今日日终交接总览')).toBeNull()
    expect(csUi.queryByText('今日工作情况')).toBeNull()
  })

  csUi.unmount()

  mockAuthState.user = { id: 'u3', username: 'admin-user', role: 'admin', roles: ['admin', 'offline_manager'] }
  const adminUi = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-admin-day-end', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(adminUi.getByText('今日工作情况')).toBeTruthy()
    expect(adminUi.queryByText('清洁A')).toBeNull()
    expect(listWorkTasksMock).not.toHaveBeenCalled()
  })

  fireEvent.press(adminUi.getByLabelText('staff-progress-toggle'))

  await waitFor(() => {
    expect(adminUi.getByText('清洁A')).toBeTruthy()
    expect(adminUi.getByText('检查B')).toBeTruthy()
    expect(adminUi.getByText('Simon')).toBeTruthy()
    expect(adminUi.getByText('AaronInspector')).toBeTruthy()
    expect(adminUi.getByText('清洁 0/1 · 进行中 MQ101')).toBeTruthy()
    expect(adminUi.getByText('检查 1/1 · 已完成 MQ101')).toBeTruthy()
    expect(adminUi.getByText('zhi-f')).toBeTruthy()
    expect(adminUi.getAllByText('检查 0/1 · 待处理 1').length).toBeGreaterThan(0)
    expect(adminUi.queryByText('检查 1/1 · 进行中 MQ101')).toBeNull()
    expect(adminUi.queryByText('清洁 + 检查')).toBeNull()
    const rendered = flattenRenderedText(adminUi.toJSON()).join('\n')
    expect(rendered.indexOf('清洁A')).toBeGreaterThanOrEqual(0)
    expect(rendered.indexOf('检查B')).toBeGreaterThanOrEqual(0)
    expect(rendered.indexOf('zhi-f')).toBeGreaterThanOrEqual(0)
    expect(rendered.indexOf('Simon')).toBeGreaterThanOrEqual(0)
    expect(rendered.indexOf('AaronInspector')).toBeGreaterThanOrEqual(0)
    expect(rendered.indexOf('清洁A')).toBeLessThan(rendered.indexOf('zhi-f'))
    expect(rendered.indexOf('清洁A')).toBeLessThan(rendered.indexOf('检查B'))
    expect(rendered.indexOf('Simon')).toBeLessThan(rendered.indexOf('AaronInspector'))
    expect(rendered.indexOf('Simon')).toBeLessThan(rendered.indexOf('检查B'))
  })

  expect(listWorkTasksMock).toHaveBeenCalledWith('local:test', {
    date_from: mockTodayKey,
    date_to: mockTodayKey,
    view: 'all',
  })

  fireEvent.press(adminUi.getByText('本月'))
  fireEvent.press(adminUi.getByText('上个月'))
  fireEvent.press(adminUi.getByText('15'))

  const priorMonthMid = new Date(mockToday.getFullYear(), mockToday.getMonth() - 1, 15)
  const priorMonthMidKey = `${priorMonthMid.getFullYear()}-${pad2(priorMonthMid.getMonth() + 1)}-${pad2(priorMonthMid.getDate())}`

  await waitFor(() => {
    expect(adminUi.getByText(`${priorMonthMidKey} 工作情况`)).toBeTruthy()
    expect(listWorkTasksMock).toHaveBeenCalledWith('local:test', {
      date_from: priorMonthMidKey,
      date_to: priorMonthMidKey,
      view: 'all',
    })
  })

  const todayOverviewCallCount = listWorkTasksMock.mock.calls.filter(([, params]) => (
    params?.date_from === mockTodayKey && params?.date_to === mockTodayKey && params?.view === 'all'
  )).length
  fireEvent.press(adminUi.getByText('今天'))

  await waitFor(() => {
    expect(adminUi.getByText('今日工作情况')).toBeTruthy()
    expect(listWorkTasksMock.mock.calls.filter(([, params]) => (
      params?.date_from === mockTodayKey && params?.date_to === mockTodayKey && params?.view === 'all'
    ))).toHaveLength(todayOverviewCallCount)
  })

  adminUi.unmount()
  mockAuthState.user = { id: 'u1', username: 'tester', role: 'cleaner', roles: ['cleaner'] }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = false
})

test('warehouse key latest event uses today, yesterday, then explicit date labels', () => {
  const { formatWarehouseKeyLatestEvent } = require('./TasksScreen') as typeof import('./TasksScreen')
  const referenceDate = new Date(2026, 6, 28, 15, 0)

  expect(formatWarehouseKeyLatestEvent({
    action: 'borrow',
    actor_name: 'Alice',
    created_at: new Date(2026, 6, 28, 9, 5).toISOString(),
  }, referenceDate)).toBe('Alice借出 09:05')
  expect(formatWarehouseKeyLatestEvent({
    action: 'borrow',
    actor_name: 'Bob',
    created_at: new Date(2026, 6, 27, 19, 45).toISOString(),
  }, referenceDate)).toBe('昨天 Bob借出 19:45')
  expect(formatWarehouseKeyLatestEvent({
    action: 'return',
    actor_name: 'Cara',
    created_at: new Date(2026, 6, 26, 8, 6).toISOString(),
  }, referenceDate)).toBe('2026-07-26 Cara归还 08:06')
})

test('admin manager view shows MSQ warehouse key card for Southbank work even when not assigned to admin', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousItems = snapshot.items.slice()
  snapshot.items = [
    {
      ...previousItems[0],
      id: 'southbank-task',
      source_id: 'ct-southbank',
      task_kind: 'cleaning',
      status: 'assigned',
      assignee_id: 'cleaner-2',
      cleaner_id: 'cleaner-2',
      cleaner_name: '清洁B',
      inspector_id: 'inspector-2',
      inspector_name: '检查B',
      property: {
        ...previousItems[0].property,
        id: 'p-southbank',
        code: 'MSQ4504E',
        region: 'Southbank',
        address: '18 Hoff Boulevard, Southbank',
      },
    },
  ]
  mockAuthState.user = { id: 'admin-1', username: 'admin-user', role: 'admin', roles: ['admin', 'offline_manager'] }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = true

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-admin-msq-key', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText('全部')).toBeTruthy()
    expect(ui.getByText('我的')).toBeTruthy()
    expect(ui.getByText('MSQ 仓库钥匙')).toBeTruthy()
  })

  snapshot.items = previousItems
  mockAuthState.user = { id: 'u1', username: 'tester', role: 'cleaner', roles: ['cleaner'] }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = false
})
