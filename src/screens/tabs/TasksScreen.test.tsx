import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import * as Clipboard from 'expo-clipboard'
import { I18nProvider } from '../../lib/i18n'

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
  listCleaningAppTasks: jest.fn(async () => []),
  listWorkTasks: jest.fn(async () => []),
  reorderCleaningTasks: jest.fn(async () => ({})),
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

test('tasks screen shows wifi info and copies wifi password', async () => {
  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>

  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText('AuraWiFi')).toBeTruthy()
    expect(ui.getByText('pw-1234')).toBeTruthy()
  })

  fireEvent.press(ui.getByLabelText('task-collapse-w1'))

  await waitFor(() => {
    expect(ui.queryByText('AuraWiFi')).toBeNull()
    expect(ui.queryByText('pw-1234')).toBeNull()
  })

  fireEvent.press(ui.getByLabelText('task-collapse-w1'))

  await waitFor(() => {
    expect(ui.getByText('AuraWiFi')).toBeTruthy()
    expect(ui.getByText('pw-1234')).toBeTruthy()
  })

  fireEvent.press(ui.getByLabelText('wifi-copy-w1'))

  await waitFor(() => {
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('pw-1234')
    expect(ui.getByLabelText('wifi-copied-w1')).toBeTruthy()
    expect(ui.getAllByText('已复制').length).toBeGreaterThan(0)
  })
})

test('tasks screen shows 晚入住 tag when checkin time is later than 3pm', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  snapshot.items[0].end_time = '4pm'

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

test('customer service hides day-end overview while admin sees staff progress summary', async () => {
  const api = require('../../lib/api')
  const listWorkTasksMock = api.listWorkTasks as jest.Mock
  const listDayEndHandoverMock = api.listDayEndHandover as jest.Mock
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

  fireEvent.press(adminUi.getByLabelText('staff-progress-toggle'))

  await waitFor(() => {
    expect(adminUi.queryByText('清洁A')).toBeNull()
  })

  mockAuthState.user = { id: 'u1', username: 'tester', role: 'cleaner', roles: ['cleaner'] }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = false
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
    expect(ui.getByText('MSQ 仓库钥匙')).toBeTruthy()
  })

  snapshot.items = previousItems
  mockAuthState.user = { id: 'u1', username: 'tester', role: 'cleaner', roles: ['cleaner'] }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = false
})
