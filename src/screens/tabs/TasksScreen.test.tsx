import React from 'react'
import { Alert, AppState, Keyboard, Modal, Platform, RefreshControl, ScrollView } from 'react-native'
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native'
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
const mockNow = new Date('2026-10-11T13:26:00.000Z')
const actualTaskBusinessDate = jest.requireActual('../../lib/taskBusinessDate') as typeof import('../../lib/taskBusinessDate')
const mockTodayKey = actualTaskBusinessDate.taskBusinessDateKey(mockNow)
const [mockTodayYear, mockTodayMonth, mockTodayDay] = mockTodayKey.split('-').map(Number)
const mockToday = new Date(mockTodayYear, mockTodayMonth - 1, mockTodayDay, 12)
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

jest.mock('../../lib/taskBusinessDate', () => {
  const actual = jest.requireActual('../../lib/taskBusinessDate') as typeof import('../../lib/taskBusinessDate')
  const fixedNow = new Date('2026-10-11T13:26:00.000Z')
  return {
    ...actual,
    taskBusinessDateKey: (date: Date = fixedNow) => actual.taskBusinessDateKey(date),
    millisecondsUntilNextTaskBusinessDate: (date: Date = fixedNow) => actual.millisecondsUntilNextTaskBusinessDate(date),
  }
})

jest.mock('../../lib/auth', () => ({
  useAuth: () => mockAuthState,
}))

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(async () => {}),
}))

jest.mock('../../lib/api', () => ({
  createCleaningOfflineTask: jest.fn(async () => ({})),
  createManualCleaningTask: jest.fn(async () => ({})),
  listManualCheckinLinkCandidates: jest.fn(async () => []),
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
          code: 'FIXTURE-PROP-001',
          region: 'CBD',
          address: '1 Example Avenue, Testville',
          unit_type: '2b2b',
          access_guide_link: '',
          wifi_ssid: 'FIXTURE_WIFI_NAME',
          wifi_password: 'NOT_A_REAL_PASSWORD',
        },
        date: mockTodayKey,
      },
    ],
    bucketKey: 'bucket',
    projectionKey: 'projection',
    ready: true,
    updatedAt: null,
    lastFullSyncTimestamp: null,
  }
  return {
    activateWorkTasksRealtime: jest.fn(async () => true),
    canViewReadOnlyWorkRecordLockCodes: (task: any) => task?.work_record_read_only !== true || (
      task?.source_type === 'cleaning_tasks'
      && task?.read_only_views?.lock_codes === true
      && ['completed', 'reassigned'].includes(String(task?.work_record_state || '').toLowerCase())
      && !['cancelled', 'canceled'].includes(String(task?.status || '').toLowerCase())
      && !['cancelled', 'canceled', 'deleted', 'removed', 'superseded', 'tombstone'].includes(String(task?.execution_state || '').toLowerCase())
    ),
    deactivateWorkTasksRealtime: jest.fn(),
    getWorkTasksSnapshot: () => snapshot,
    initWorkTasksStore: jest.fn(async () => true),
    makeWorkTasksBucketKey: jest.fn(() => 'bucket'),
    makeWorkTasksProjectionKey: jest.fn(() => 'projection'),
    patchWorkTaskItem: jest.fn(),
    patchWorkTaskItems: jest.fn(),
    requestWorkTasksRefresh: jest.fn(async () => true),
    setWorkTasksRefreshForeground: jest.fn(),
    subscribeWorkTasks: () => () => {},
  }
})

test('tasks fixtures use the fixed Melbourne business date when UTC is still the previous day', () => {
  expect(mockNow.toISOString().slice(0, 10)).toBe('2026-10-11')
  expect(mockTodayKey).toBe('2026-10-12')
})

test('an explicitly ready current-scope bucket is not hidden by a redundant pending init call', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const initMock = store.initWorkTasksStore as jest.Mock
  const refreshMock = store.requestWorkTasksRefresh as jest.Mock
  const previousBucketKey = snapshot.bucketKey
  const previousLastFullSyncTimestamp = snapshot.lastFullSyncTimestamp
  const focusCallbacks: (() => unknown)[] = []
  let finishHydration!: (value: boolean) => void
  initMock.mockImplementationOnce(() => new Promise<boolean>((resolve) => {
    finishHydration = resolve
  }))
  snapshot.bucketKey = 'bucket'
  snapshot.lastFullSyncTimestamp = '2026-10-20T01:56:00.000Z'

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{
          navigate: jest.fn(),
          addListener: jest.fn((event: string, listener: () => unknown) => {
            if (event === 'focus') focusCallbacks.push(listener)
            return () => {}
          }),
        } as any}
        route={{ key: 'tasks-cache-during-hydration', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  try {
    await waitFor(() => expect(ui.getByLabelText('task-collapse-w1')).toBeTruthy())
    expect(ui.queryByText('加载中…')).toBeNull()
    refreshMock.mockRejectedValueOnce(new Error('offline'))
    await act(async () => {
      for (const callback of focusCallbacks) await callback()
    })
    await waitFor(() => {
      expect(ui.getByText('本地缓存')).toBeTruthy()
      expect(ui.getByLabelText('task-collapse-w1')).toBeTruthy()
    })
    expect(ui.queryByText('加载中…')).toBeNull()
  } finally {
    ui.unmount()
    finishHydration(false)
    initMock.mockImplementation(async () => true)
    refreshMock.mockImplementation(async () => true)
    snapshot.bucketKey = previousBucketKey
    snapshot.lastFullSyncTimestamp = previousLastFullSyncTimestamp
  }
}, 15_000)

test('pending notice hydration does not block task-store hydration or the task read', async () => {
  const notices = require('../../lib/noticesStore')
  const store = require('../../lib/workTasksStore')
  const noticesInit = notices.initNoticesStore as jest.Mock
  const taskInit = store.initWorkTasksStore as jest.Mock
  const taskRefresh = store.requestWorkTasksRefresh as jest.Mock
  const initCalls = taskInit.mock.calls.length
  const refreshCalls = taskRefresh.mock.calls.length
  let releaseNotices!: () => void
  noticesInit.mockImplementationOnce(() => new Promise<void>((resolve) => {
    releaseNotices = resolve
  }))

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-notices-independent', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  try {
    await waitFor(() => expect(taskInit.mock.calls.length).toBeGreaterThan(initCalls))
    await waitFor(() => expect(taskRefresh.mock.calls.length).toBeGreaterThan(refreshCalls))
  } finally {
    releaseNotices()
    noticesInit.mockImplementation(async () => {})
    ui.unmount()
  }
})

test('a cached task from a different identity or date scope stays behind the loading gate', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const initMock = store.initWorkTasksStore as jest.Mock
  const previousBucketKey = snapshot.bucketKey
  let finishHydration!: (value: boolean) => void
  initMock.mockImplementationOnce(() => new Promise<boolean>((resolve) => {
    finishHydration = resolve
  }))
  snapshot.bucketKey = 'other-user-or-range-bucket'

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-stale-cache-scope', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  try {
    await waitFor(() => expect(ui.getByText('加载中…')).toBeTruthy())
    expect(ui.queryByLabelText('task-collapse-w1')).toBeNull()
  } finally {
    ui.unmount()
    finishHydration(false)
    initMock.mockImplementation(async () => true)
    snapshot.bucketKey = previousBucketKey
  }
})

test('loading users can open, read and copy the bounded privacy-safe diagnostics', async () => {
  const store = require('../../lib/workTasksStore')
  const diagnostics = require('../../lib/taskLoadDiagnostics')
  const snapshot = store.getWorkTasksSnapshot()
  const previous = {
    items: snapshot.items,
    bucketKey: snapshot.bucketKey,
    projectionKey: snapshot.projectionKey,
    ready: snapshot.ready,
  }
  snapshot.items = []
  snapshot.bucketKey = 'bucket'
  snapshot.projectionKey = 'projection'
  snapshot.ready = false
  diagnostics.clearTaskLoadDiagnostics()
  diagnostics.recordTaskLoadStage('task_fetch.body_timeout', {
    elapsedMs: 15001,
    status: 200,
    errorClass: 'timeout',
  })
  ;(Clipboard.setStringAsync as jest.Mock).mockClear()

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-loading-diagnostics', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  try {
    await waitFor(() => expect(ui.getByLabelText('查看任务加载诊断')).toBeTruthy())
    fireEvent.press(ui.getByLabelText('查看任务加载诊断'))
    expect(ui.getByText('任务加载诊断')).toBeTruthy()
    expect(String(ui.getByTestId('task-load-diagnostics-text').props.children)).toContain('stage=task_fetch.body_timeout')

    fireEvent.press(ui.getByLabelText('复制任务加载诊断'))
    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith(expect.stringContaining('stage=task_fetch.body_timeout')))
    expect(ui.getByText('已复制')).toBeTruthy()
  } finally {
    ui.unmount()
    snapshot.items = previous.items
    snapshot.bucketKey = previous.bucketKey
    snapshot.projectionKey = previous.projectionKey
    snapshot.ready = previous.ready
    diagnostics.clearTaskLoadDiagnostics()
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
  expect(ui.queryByText('FIXTURE_WIFI_NAME')).toBeNull()
  expect(ui.queryByText('NOT_A_REAL_PASSWORD')).toBeNull()

  expandTask(ui, 'w1')

  await waitFor(() => {
    expect(ui.getByText('FIXTURE_WIFI_NAME')).toBeTruthy()
    expect(ui.getByText('NOT_A_REAL_PASSWORD')).toBeTruthy()
  })

  expandTask(ui, 'w1')

  await waitFor(() => {
    expect(ui.queryByText('FIXTURE_WIFI_NAME')).toBeNull()
    expect(ui.queryByText('NOT_A_REAL_PASSWORD')).toBeNull()
  })

  expandTask(ui, 'w1')
  await waitFor(() => expect(ui.getByLabelText('wifi-copy-w1')).toBeTruthy())
  fireEvent.press(ui.getByLabelText('wifi-copy-w1'))

  await waitFor(() => {
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('NOT_A_REAL_PASSWORD')
    expect(ui.getByLabelText('wifi-copied-w1')).toBeTruthy()
    expect(ui.getAllByText('已复制').length).toBeGreaterThan(0)
  })
  ui.unmount()
}, 20_000)

test.each([
  [391, 1, false],
  [390, 1, true],
  [430, 1.19, false],
  [430, 1.2, true],
])('Wi-Fi details stacking responds to width %s and font scale %s', (width, fontScale, expected) => {
  const { shouldStackWifiDetails } = require('./TasksScreen') as typeof import('./TasksScreen')
  expect(shouldStackWifiDetails(width, fontScale)).toBe(expected)
})

test('long Wi-Fi name wraps fully on a narrow screen with large text and password copy remains unchanged', async () => {
  const reactNative = require('react-native') as typeof import('react-native')
  const dimensionsSpy = jest.spyOn(reactNative, 'useWindowDimensions').mockReturnValue({
    width: 320,
    height: 640,
    scale: 2,
    fontScale: 1.4,
  })
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousProperty = snapshot.items[0].property
  const longWifiName = 'FIXTURE_WIFI_LONG_NAME_FOR_LAYOUT_ONLY'
  const testPassword = 'NOT_A_REAL_PASSWORD'
  snapshot.items[0].property = {
    ...previousProperty,
    wifi_ssid: longWifiName,
    wifi_password: testPassword,
  }
  ;(Clipboard.setStringAsync as jest.Mock).mockClear()

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-wifi-responsive', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  try {
    await waitFor(() => expect(ui.getByLabelText('task-collapse-w1')).toBeTruthy())
    expandTask(ui, 'w1')

    await waitFor(() => expect(ui.getByText(longWifiName)).toBeTruthy())
    expect(ui.getByTestId('wifi-name-w1').props.numberOfLines).toBeUndefined()
    expect(flattenTestStyle(ui.getByTestId('wifi-details-w1').props.style)).toMatchObject({ flexDirection: 'column' })

    fireEvent.press(ui.getByLabelText('wifi-copy-w1'))
    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith(testPassword))
  } finally {
    ui.unmount()
    snapshot.items[0].property = previousProperty
    dimensionsSpy.mockRestore()
  }
}, 20_000)

test('tasks screen routes initial, focus and foreground reads through the shared refresh coordinator', async () => {
  const store = require('../../lib/workTasksStore')
  const refreshMock = store.requestWorkTasksRefresh as jest.Mock
  const foregroundMock = store.setWorkTasksRefreshForeground as jest.Mock
  refreshMock.mockClear()
  foregroundMock.mockClear()
  const focusCallbacks: (() => unknown)[] = []
  const appStateCallbacks: ((nextState: string) => unknown)[] = []
  const addAppStateListener = jest.spyOn(AppState, 'addEventListener').mockImplementation((event: any, listener: any) => {
    if (event === 'change') appStateCallbacks.push(listener)
    return { remove: jest.fn() } as any
  })
  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>

  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{
          navigate: jest.fn(),
          addListener: jest.fn((event: string, listener: () => unknown) => {
            if (event === 'focus') focusCallbacks.push(listener)
            return () => {}
          }),
        } as any}
        route={{ key: 'tasks-refresh-coordinator', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(refreshMock).toHaveBeenCalledWith(expect.objectContaining({ mode: 'force', reason: 'tasks_initial_load' }))
  })
  refreshMock.mockClear()

  await act(async () => {
    for (const callback of focusCallbacks) await callback()
  })
  await waitFor(() => {
    expect(refreshMock).toHaveBeenCalledWith(expect.objectContaining({ mode: 'passive', reason: 'tasks_screen_focus' }))
  })
  refreshMock.mockClear()

  await act(async () => {
    for (const callback of appStateCallbacks) await callback('active')
  })
  await waitFor(() => {
    expect(refreshMock).toHaveBeenCalledWith(expect.objectContaining({ mode: 'passive', reason: 'tasks_app_active' }))
  })

  refreshMock.mockClear()
  foregroundMock.mockClear()
  await act(async () => {
    for (const callback of appStateCallbacks) await callback('inactive')
  })
  expect(foregroundMock).toHaveBeenCalledWith(true)
  expect(refreshMock).not.toHaveBeenCalled()

  foregroundMock.mockClear()
  const refreshControl = ui.UNSAFE_getByType(RefreshControl)
  await act(async () => {
    refreshControl.props.onRefresh()
    await Promise.resolve()
  })
  await waitFor(() => {
    expect(refreshMock).toHaveBeenCalledWith(expect.objectContaining({ mode: 'force', reason: 'tasks_screen_refresh' }))
  })
  expect(foregroundMock).toHaveBeenCalledWith(true)
  expect(foregroundMock.mock.invocationCallOrder[0]).toBeLessThan(refreshMock.mock.invocationCallOrder[0])
  ui.unmount()
  addAppStateListener.mockRestore()
})

test('manual task refresh does not wait for offline write queues to finish uploading', async () => {
  const store = require('../../lib/workTasksStore')
  const keyQueue = require('../../lib/keyUploadQueue').processKeyUploadQueue as jest.Mock
  const dayEndQueue = require('../../lib/dayEndHandoverQueue').processDayEndHandoverQueue as jest.Mock
  const refreshMock = store.requestWorkTasksRefresh as jest.Mock
  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>

  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-upload-queue-refresh', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(refreshMock).toHaveBeenCalledWith(expect.objectContaining({ reason: 'tasks_initial_load' }))
  })

  keyQueue.mockImplementationOnce(() => new Promise(() => {}))
  dayEndQueue.mockImplementationOnce(() => new Promise(() => {}))
  refreshMock.mockClear()

  await act(async () => {
    ui.UNSAFE_getByType(RefreshControl).props.onRefresh()
    await Promise.resolve()
  })

  await waitFor(() => {
    expect(refreshMock).toHaveBeenCalledWith(expect.objectContaining({ reason: 'tasks_screen_refresh' }))
    expect(ui.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(false)
  })

  ui.unmount()
})

test('successful background upload schedules an authoritative refresh even while the other queue remains pending', async () => {
  const store = require('../../lib/workTasksStore')
  const keyQueue = require('../../lib/keyUploadQueue').processKeyUploadQueue as jest.Mock
  const dayEndQueue = require('../../lib/dayEndHandoverQueue').processDayEndHandoverQueue as jest.Mock
  const refreshMock = store.requestWorkTasksRefresh as jest.Mock
  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  let finishKeyQueue!: (value: { processed: number; remaining: number }) => void

  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-upload-queue-reconcile', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(refreshMock).toHaveBeenCalledWith(expect.objectContaining({ reason: 'tasks_initial_load' }))
  })
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })

  keyQueue.mockImplementationOnce(() => new Promise((resolve) => {
    finishKeyQueue = resolve
  }))
  dayEndQueue.mockImplementationOnce(() => new Promise(() => {}))
  refreshMock.mockClear()

  await act(async () => {
    ui.UNSAFE_getByType(RefreshControl).props.onRefresh()
    await Promise.resolve()
  })

  await waitFor(() => {
    expect(refreshMock).toHaveBeenCalledWith(expect.objectContaining({ reason: 'tasks_screen_refresh', mode: 'force' }))
    expect(ui.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(false)
  })
  expect(refreshMock).not.toHaveBeenCalledWith(expect.objectContaining({ reason: 'offline_queue_reconciled' }))

  await act(async () => {
    finishKeyQueue({ processed: 1, remaining: 0 })
    await Promise.resolve()
  })

  await waitFor(() => {
    expect(refreshMock).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'force',
      reason: 'offline_queue_reconciled',
    }))
  })
  expect(refreshMock.mock.calls.filter(([params]) => params.reason === 'offline_queue_reconciled')).toHaveLength(1)
  ui.unmount()
})

test('one rejected background queue does not suppress reconciliation for the other successful queue', async () => {
  const store = require('../../lib/workTasksStore')
  const keyQueue = require('../../lib/keyUploadQueue').processKeyUploadQueue as jest.Mock
  const dayEndQueue = require('../../lib/dayEndHandoverQueue').processDayEndHandoverQueue as jest.Mock
  const refreshMock = store.requestWorkTasksRefresh as jest.Mock
  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>

  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-upload-queue-rejection', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(refreshMock).toHaveBeenCalledWith(expect.objectContaining({ reason: 'tasks_initial_load' }))
  })
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })

  keyQueue.mockRejectedValueOnce(new Error('background upload failed'))
  dayEndQueue.mockResolvedValueOnce({ processed: 1, remaining: 0 })
  refreshMock.mockClear()

  await act(async () => {
    ui.UNSAFE_getByType(RefreshControl).props.onRefresh()
    await Promise.resolve()
  })

  await waitFor(() => {
    expect(refreshMock).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'force',
      reason: 'offline_queue_reconciled',
    }))
  })
  ui.unmount()
})

test('failed authoritative refresh schedules one bounded consistency retry after upload success', async () => {
  const store = require('../../lib/workTasksStore')
  const keyQueue = require('../../lib/keyUploadQueue').processKeyUploadQueue as jest.Mock
  const dayEndQueue = require('../../lib/dayEndHandoverQueue').processDayEndHandoverQueue as jest.Mock
  const refreshMock = store.requestWorkTasksRefresh as jest.Mock
  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  let finishKeyQueue!: (value: { processed: number; remaining: number }) => void

  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-upload-authority-retry', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(refreshMock).toHaveBeenCalledWith(expect.objectContaining({ reason: 'tasks_initial_load' }))
  })
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })

  keyQueue.mockImplementationOnce(() => new Promise((resolve) => {
    finishKeyQueue = resolve
  }))
  dayEndQueue.mockImplementationOnce(() => new Promise(() => {}))
  refreshMock.mockClear()

  await act(async () => {
    ui.UNSAFE_getByType(RefreshControl).props.onRefresh()
    await Promise.resolve()
  })
  await waitFor(() => {
    expect(refreshMock).toHaveBeenCalledWith(expect.objectContaining({ reason: 'tasks_screen_refresh' }))
  })

  refreshMock.mockRejectedValueOnce(new Error('authority GET failed'))
  await act(async () => {
    finishKeyQueue({ processed: 1, remaining: 0 })
    await Promise.resolve()
  })

  await waitFor(() => {
    expect(refreshMock).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'force',
      reason: 'offline_queue_reconciled',
    }))
    expect(refreshMock).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'consistency',
      reason: 'offline_queue_reconcile_retry',
    }))
  })
  expect(refreshMock.mock.calls.filter(([params]) => params.reason === 'offline_queue_reconcile_retry')).toHaveLength(1)
  ui.unmount()
})

test('successful day-end upload invalidates the self handover state and reads submitted status again', async () => {
  const api = require('../../lib/api')
  const store = require('../../lib/workTasksStore')
  const keyQueue = require('../../lib/keyUploadQueue').processKeyUploadQueue as jest.Mock
  const dayEndQueue = require('../../lib/dayEndHandoverQueue').processDayEndHandoverQueue as jest.Mock
  const refreshMock = store.requestWorkTasksRefresh as jest.Mock
  const dayEndReadMock = api.listDayEndHandover as jest.Mock
  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  let finishDayEndQueue!: (value: { processed: number; remaining: number }) => void

  dayEndReadMock.mockReset()
  dayEndReadMock
    .mockResolvedValueOnce({ submitted_at: null })
    .mockResolvedValueOnce({ submitted_at: null })
    .mockResolvedValue({ submitted_at: '2026-10-12T12:00:00.000Z' })
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-day-end-queue-reconcile', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(dayEndReadMock).toHaveBeenCalledTimes(1)
    expect(ui.getByText('待交接')).toBeTruthy()
  })
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })

  keyQueue.mockImplementationOnce(() => new Promise(() => {}))
  dayEndQueue.mockImplementationOnce(() => new Promise((resolve) => {
    finishDayEndQueue = resolve
  }))
  refreshMock.mockClear()

  await act(async () => {
    ui.UNSAFE_getByType(RefreshControl).props.onRefresh()
    await Promise.resolve()
  })
  await waitFor(() => {
    expect(refreshMock).toHaveBeenCalledWith(expect.objectContaining({ reason: 'tasks_screen_refresh' }))
    expect(dayEndReadMock).toHaveBeenCalledTimes(2)
    expect(ui.getByText('待交接')).toBeTruthy()
  })
  const readsBeforeCompletion = dayEndReadMock.mock.calls.length

  await act(async () => {
    finishDayEndQueue({ processed: 1, remaining: 0 })
    await Promise.resolve()
  })

  await waitFor(() => {
    expect(refreshMock).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'force',
      reason: 'offline_queue_reconciled',
    }))
    expect(dayEndReadMock.mock.calls.length).toBeGreaterThan(readsBeforeCompletion)
    expect(ui.getByText('已提交')).toBeTruthy()
  })
  ui.unmount()
  dayEndReadMock.mockReset().mockResolvedValue([])
})

test('background upload completion does not refresh the task scope after component unmount', async () => {
  const store = require('../../lib/workTasksStore')
  const keyQueue = require('../../lib/keyUploadQueue').processKeyUploadQueue as jest.Mock
  const dayEndQueue = require('../../lib/dayEndHandoverQueue').processDayEndHandoverQueue as jest.Mock
  const refreshMock = store.requestWorkTasksRefresh as jest.Mock
  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  let finishKeyQueue!: (value: { processed: number; remaining: number }) => void

  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-upload-queue-unmount', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(refreshMock).toHaveBeenCalledWith(expect.objectContaining({ reason: 'tasks_initial_load' }))
  })
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })

  keyQueue.mockImplementationOnce(() => new Promise((resolve) => {
    finishKeyQueue = resolve
  }))
  dayEndQueue.mockResolvedValueOnce({ processed: 0, remaining: 0 })
  refreshMock.mockClear()

  await act(async () => {
    ui.UNSAFE_getByType(RefreshControl).props.onRefresh()
    await Promise.resolve()
  })
  await waitFor(() => {
    expect(refreshMock).toHaveBeenCalledWith(expect.objectContaining({ reason: 'tasks_screen_refresh' }))
  })

  ui.unmount()
  await act(async () => {
    finishKeyQueue({ processed: 1, remaining: 0 })
    await Promise.resolve()
    await Promise.resolve()
  })

  expect(refreshMock).not.toHaveBeenCalledWith(expect.objectContaining({ reason: 'offline_queue_reconciled' }))
})

test('background upload completion refreshes the latest date scope within the same signed-in session', async () => {
  const store = require('../../lib/workTasksStore')
  const keyQueue = require('../../lib/keyUploadQueue').processKeyUploadQueue as jest.Mock
  const dayEndQueue = require('../../lib/dayEndHandoverQueue').processDayEndHandoverQueue as jest.Mock
  const refreshMock = store.requestWorkTasksRefresh as jest.Mock
  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  let finishKeyQueue!: (value: { processed: number; remaining: number }) => void

  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-upload-queue-scope-change', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(refreshMock).toHaveBeenCalledWith(expect.objectContaining({ reason: 'tasks_initial_load' }))
  })
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })

  keyQueue.mockImplementationOnce(() => new Promise((resolve) => {
    finishKeyQueue = resolve
  }))
  dayEndQueue.mockImplementationOnce(() => new Promise(() => {}))
  refreshMock.mockClear()

  await act(async () => {
    ui.UNSAFE_getByType(RefreshControl).props.onRefresh()
    await Promise.resolve()
  })
  await waitFor(() => {
    expect(refreshMock).toHaveBeenCalledWith(expect.objectContaining({ reason: 'tasks_screen_refresh' }))
  })

  refreshMock.mockClear()
  fireEvent.press(ui.getByText('本月'))
  await waitFor(() => {
    expect(refreshMock).toHaveBeenCalledWith(expect.objectContaining({
      reason: 'tasks_initial_load',
      date_from: '2026-10-01',
      date_to: '2026-10-31',
    }))
  })
  refreshMock.mockClear()

  await act(async () => {
    finishKeyQueue({ processed: 1, remaining: 0 })
    await Promise.resolve()
  })

  await waitFor(() => {
    expect(refreshMock).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'force',
      reason: 'offline_queue_reconciled',
      date_from: '2026-10-01',
      date_to: '2026-10-31',
      view: 'mine',
    }))
  })
  ui.unmount()
})

test('pending SLA read does not mark an unseen alert read after task screen unmount', async () => {
  const api = require('../../lib/api')
  const listAlertsMock = api.listMzappAlerts as jest.Mock
  const markAlertReadMock = api.markMzappAlertRead as jest.Mock
  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  let finishAlerts!: (value: any[]) => void

  listAlertsMock.mockImplementationOnce(() => new Promise((resolve) => {
    finishAlerts = resolve
  }))
  markAlertReadMock.mockClear()
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-sla-unmount', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => expect(listAlertsMock).toHaveBeenCalled())
  ui.unmount()
  await act(async () => {
    finishAlerts([{ id: 'sla-unseen', level: 'warning', payload: { property_code: 'A1201' } }])
    await Promise.resolve()
    await Promise.resolve()
  })

  expect(markAlertReadMock).not.toHaveBeenCalledWith('local:test', 'sla-unseen')
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
    { id: 'cleaner-2', username: 'alice', role: 'cleaner', display_name: 'Fixture User A' },
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
    expect(ui.getByText('Fixture User A')).toBeTruthy()
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

test('quick create uses a keyboard-safe shared shell and preserves drafts while dismissing the keyboard', async () => {
  const previousUser = mockAuthState.user
  const previousRoleState = { ...mockRoleState }
  mockAuthState.user = { id: 'admin-1', username: 'admin-user', role: 'admin', roles: ['admin'] }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = true
  const dismissKeyboard = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {})

  const tasksModule = require('./TasksScreen') as typeof import('./TasksScreen')
  const TasksScreen = tasksModule.default as React.ComponentType<any>
  expect(tasksModule.quickCreateKeyboardBehavior('ios')).toBe('padding')
  expect(tasksModule.quickCreateKeyboardBehavior('android')).toBe('height')
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-create-keyboard-safe', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByText('新增')).toBeTruthy())
  fireEvent.press(ui.getByText('新增'))

  const keyboardAvoider = ui.getByTestId('quick-create-keyboard-avoider')
  const modalCard = ui.getByTestId('quick-create-modal-card')
  const formScroll = ui.getByTestId('quick-create-scroll')
  expect(keyboardAvoider).toBeTruthy()
  expect(formScroll.props.keyboardDismissMode).toBe(Platform.OS === 'ios' ? 'interactive' : 'on-drag')
  expect(formScroll.props.keyboardShouldPersistTaps).toBe('handled')
  expect(flattenTestStyle(modalCard.props.style)).toEqual(expect.objectContaining({ maxHeight: '86%', flexShrink: 1 }))
  expect(flattenTestStyle(formScroll.props.style)).toEqual(expect.objectContaining({ flexShrink: 1 }))
  expect(ui.getByTestId('quick-create-submit')).toBeTruthy()

  fireEvent.press(ui.getByText('线下任务'))
  fireEvent.changeText(ui.getByLabelText('quick-create-offline-title'), '修门锁')
  fireEvent.changeText(ui.getByLabelText('quick-create-offline-content'), '中文拼音候选展开时仍保留的内容')
  expect(ui.getByLabelText('quick-create-offline-content').props.submitBehavior).toBe('newline')
  fireEvent.press(ui.getByText('房源任务'))
  fireEvent.press(ui.getByText('公司任务'))
  fireEvent.press(ui.getByText('其他任务'))
  expect(ui.getByDisplayValue('中文拼音候选展开时仍保留的内容')).toBeTruthy()

  fireEvent.press(ui.getByText('待同步退房'))
  expect(ui.getByLabelText('quick-create-time')).toBeTruthy()
  fireEvent.press(ui.getByText('待同步入住'))
  expect(ui.getByLabelText('quick-create-guest-note')).toBeTruthy()
  fireEvent.press(ui.getByText('线下任务'))
  expect(ui.getByDisplayValue('修门锁')).toBeTruthy()
  expect(ui.getByDisplayValue('中文拼音候选展开时仍保留的内容')).toBeTruthy()

  dismissKeyboard.mockClear()
  fireEvent(ui.getByLabelText('quick-create-offline-title'), 'submitEditing')
  fireEvent(ui.getByTestId('quick-create-scroll'), 'scrollBeginDrag')
  fireEvent.press(ui.getByTestId('quick-create-dismiss-keyboard-backdrop'))
  fireEvent.press(ui.getByTestId('quick-create-dismiss-keyboard'))
  expect(dismissKeyboard).toHaveBeenCalledTimes(4)
  expect(ui.getByDisplayValue('中文拼音候选展开时仍保留的内容')).toBeTruthy()
  expect(ui.getByTestId('quick-create-submit')).toBeTruthy()

  fireEvent.press(ui.getByLabelText('关闭新增任务'))
  expect(dismissKeyboard).toHaveBeenCalledTimes(5)
  await waitFor(() => expect(ui.queryByTestId('quick-create-keyboard-avoider')).toBeNull())

  fireEvent.press(ui.getByText('新增'))
  expect(ui.getByTestId('quick-create-keyboard-avoider')).toBeTruthy()
  fireEvent.press(ui.getByText('线下任务'))
  expect(ui.getByLabelText('quick-create-offline-title').props.value).toBe('')
  expect(ui.getByLabelText('quick-create-offline-content').props.value).toBe('')
  expect(ui.getByTestId('quick-create-submit')).toBeTruthy()
  fireEvent.press(ui.getByLabelText('关闭新增任务'))

  dismissKeyboard.mockRestore()
  mockAuthState.user = previousUser
  mockRoleState.canSwitchTaskMode = previousRoleState.canSwitchTaskMode
  mockRoleState.isTaskManagerUser = previousRoleState.isTaskManagerUser
})

test('quick-create focus geometry keeps the measured field above the keyboard-adjusted viewport footer', () => {
  const { quickCreateFocusedFieldScrollTarget } = require('./TasksScreen') as typeof import('./TasksScreen')
  const fieldTop = 520
  const fieldHeight = 108
  const viewportHeight = 320
  const bottomGap = 16
  const target = quickCreateFocusedFieldScrollTarget({
    fieldTop,
    fieldHeight,
    viewportHeight,
    currentOffset: 0,
    bottomGap,
  })

  expect(target).toBe(324)
  expect(fieldTop + fieldHeight).toBeLessThanOrEqual((target || 0) + viewportHeight - bottomGap)
  expect(quickCreateFocusedFieldScrollTarget({
    fieldTop,
    fieldHeight,
    viewportHeight,
    currentOffset: target || 0,
    bottomGap,
  })).toBeNull()
  expect(quickCreateFocusedFieldScrollTarget({
    fieldTop: 12,
    fieldHeight: 60,
    viewportHeight,
    currentOffset: 220,
  })).toBe(0)
})

test('quick create consumes an iOS keyboard frame-only resize without waiting for another viewport layout', async () => {
  const previousUser = mockAuthState.user
  const previousRoleState = { ...mockRoleState }
  const previousPlatform = Platform.OS
  mockAuthState.user = { id: 'admin-1', username: 'admin-user', role: 'admin', roles: ['admin'] }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = true
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' })
  const keyboardListeners = new Map<string, (event: any) => void>()
  const addKeyboardListener = jest.spyOn(Keyboard, 'addListener').mockImplementation((event, listener) => {
    keyboardListeners.set(String(event), listener as (keyboardEvent: any) => void)
    return { remove: jest.fn() } as any
  })
  const getNativeScrollRef = jest.spyOn(ScrollView.prototype, 'getNativeScrollRef').mockReturnValue({
    measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => callback(0, 100, 340, 320),
  } as any)
  const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {})
  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-create-frame-only-resize', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  try {
    await waitFor(() => expect(ui.getByText('新增')).toBeTruthy())
    fireEvent.press(ui.getByText('新增'))
    fireEvent.press(ui.getByText('线下任务'))
    const scroll = ui.getByTestId('quick-create-scroll')
    fireEvent(scroll, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 340, height: 320 } } })
    fireEvent(ui.getByTestId('quick-create-field-offline-content'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 220, width: 340, height: 60 } },
    })
    fireEvent(ui.getByLabelText('quick-create-offline-content'), 'focus')
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) })
    expect(scrollTo).not.toHaveBeenCalledWith({ y: 46, animated: true })

    const frameListener = keyboardListeners.get('keyboardWillChangeFrame')
    expect(frameListener).toBeTruthy()
    act(() => {
      frameListener?.({ endCoordinates: { screenY: 350, height: 494, width: 390, screenX: 0 } })
    })
    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ y: 46, animated: true }))

    fireEvent.press(ui.getByLabelText('关闭新增任务'))
    await waitFor(() => expect(ui.queryByTestId('quick-create-scroll')).toBeNull())
    scrollTo.mockClear()
    fireEvent.press(ui.getByText('新增'))
    fireEvent.press(ui.getByText('线下任务'))
    const reopenedScroll = ui.getByTestId('quick-create-scroll')
    fireEvent(reopenedScroll, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 340, height: 320 } } })
    fireEvent(ui.getByTestId('quick-create-field-offline-content'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 220, width: 340, height: 60 } },
    })
    fireEvent(ui.getByLabelText('quick-create-offline-content'), 'focus')
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) })
    expect(scrollTo).not.toHaveBeenCalledWith({ y: 46, animated: true })
  } finally {
    ui.unmount()
    scrollTo.mockRestore()
    getNativeScrollRef.mockRestore()
    addKeyboardListener.mockRestore()
    Object.defineProperty(Platform, 'OS', { configurable: true, value: previousPlatform })
    mockAuthState.user = previousUser
    mockRoleState.canSwitchTaskMode = previousRoleState.canSwitchTaskMode
    mockRoleState.isTaskManagerUser = previousRoleState.isTaskManagerUser
  }
})

test('quick create scrolls measured low fields above the fixed footer in all modes and follows multiline growth', async () => {
  const previousUser = mockAuthState.user
  const previousRoleState = { ...mockRoleState }
  mockAuthState.user = { id: 'admin-1', username: 'admin-user', role: 'admin', roles: ['admin'] }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = true
  const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {})
  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-create-focus-visible', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByText('新增')).toBeTruthy())
  fireEvent.press(ui.getByText('新增'))
  fireEvent.press(ui.getByText('线下任务'))
  const scroll = ui.getByTestId('quick-create-scroll')
  expect(flattenTestStyle(scroll.props.contentContainerStyle).paddingBottom).toBeGreaterThanOrEqual(80)
  fireEvent(scroll, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 340, height: 320 } } })
  fireEvent(ui.getByTestId('quick-create-field-offline-content'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 520, width: 340, height: 108 } },
  })
  fireEvent(ui.getByLabelText('quick-create-offline-content'), 'focus')
  await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ y: 324, animated: true }))

  fireEvent(ui.getByTestId('quick-create-field-offline-content'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 520, width: 340, height: 160 } },
  })
  fireEvent(ui.getByLabelText('quick-create-offline-content'), 'contentSizeChange', {
    nativeEvent: { contentSize: { width: 320, height: 132 } },
  })
  await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ y: 376, animated: true }))

  fireEvent.press(ui.getByText('待同步入住'))
  expect(scrollTo).toHaveBeenCalledWith({ y: 0, animated: false })
  const checkinScroll = ui.getByTestId('quick-create-scroll')
  fireEvent(checkinScroll, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 340, height: 300 } } })
  fireEvent(ui.getByTestId('quick-create-field-guest-note'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 640, width: 340, height: 110 } },
  })
  fireEvent(ui.getByLabelText('quick-create-guest-note'), 'focus')
  await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ y: 466, animated: true }))

  fireEvent.press(ui.getByText('待同步退房'))
  const checkoutScroll = ui.getByTestId('quick-create-scroll')
  fireEvent(checkoutScroll, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 340, height: 300 } } })
  fireEvent(ui.getByTestId('quick-create-field-lock-code'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 390, width: 340, height: 70 } },
  })
  fireEvent(ui.getByLabelText('quick-create-lock-code'), 'focus')
  await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ y: 176, animated: true }))

  const callCount = scrollTo.mock.calls.length
  fireEvent(ui.getByLabelText('quick-create-lock-code'), 'focus')
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) })
  expect(scrollTo).toHaveBeenCalledTimes(callCount)

  fireEvent.press(ui.getByLabelText('关闭新增任务'))
  expect(scrollTo).toHaveBeenLastCalledWith({ y: 0, animated: false })
  await waitFor(() => expect(ui.queryByTestId('quick-create-scroll')).toBeNull())
  fireEvent.press(ui.getByText('新增'))
  expect(ui.getByTestId('quick-create-scroll')).toBeTruthy()
  fireEvent.press(ui.getByLabelText('关闭新增任务'))
  await waitFor(() => expect(ui.queryByTestId('quick-create-scroll')).toBeNull())

  scrollTo.mockRestore()
  mockAuthState.user = previousUser
  mockRoleState.canSwitchTaskMode = previousRoleState.canSwitchTaskMode
  mockRoleState.isTaskManagerUser = previousRoleState.isTaskManagerUser
})

test('quick create ignores a queued focus scroll after mode change or cancel', async () => {
  const previousUser = mockAuthState.user
  const previousRoleState = { ...mockRoleState }
  mockAuthState.user = { id: 'admin-1', username: 'admin-user', role: 'admin', roles: ['admin'] }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = true
  const callbacks: FrameRequestCallback[] = []
  const requestFrame = jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
    callbacks.push(callback)
    return callbacks.length
  })
  const cancelFrame = jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {})
  const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {})
  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-create-focus-session', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByText('新增')).toBeTruthy())
  fireEvent.press(ui.getByText('新增'))
  fireEvent.press(ui.getByText('线下任务'))
  fireEvent(ui.getByTestId('quick-create-scroll'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 340, height: 300 } } })
  fireEvent(ui.getByTestId('quick-create-field-offline-content'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 520, width: 340, height: 108 } },
  })
  fireEvent(ui.getByLabelText('quick-create-offline-content'), 'focus')
  const staleModeCallback = callbacks[callbacks.length - 1]
  fireEvent.press(ui.getByText('待同步入住'))
  staleModeCallback(0)
  expect(scrollTo).not.toHaveBeenCalledWith({ y: 344, animated: true })
  expect(cancelFrame).toHaveBeenCalled()

  fireEvent(ui.getByTestId('quick-create-scroll'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 340, height: 300 } } })
  fireEvent(ui.getByTestId('quick-create-field-guest-note'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 640, width: 340, height: 110 } },
  })
  fireEvent(ui.getByLabelText('quick-create-guest-note'), 'focus')
  const staleCloseCallback = callbacks[callbacks.length - 1]
  fireEvent.press(ui.getByLabelText('关闭新增任务'))
  staleCloseCallback(0)
  expect(scrollTo).not.toHaveBeenCalledWith({ y: 466, animated: true })

  scrollTo.mockRestore()
  requestFrame.mockRestore()
  cancelFrame.mockRestore()
  mockAuthState.user = previousUser
  mockRoleState.canSwitchTaskMode = previousRoleState.canSwitchTaskMode
  mockRoleState.isTaskManagerUser = previousRoleState.isTaskManagerUser
})

test('manual quick create sends only the password field applicable to the selected task type', async () => {
  const api = require('../../lib/api')
  const previousUser = mockAuthState.user
  const previousRoleState = { ...mockRoleState }
  mockAuthState.user = { id: 'admin-1', username: 'admin-user', role: 'admin', roles: ['admin'] }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = true
  const listPropertiesMock = api.listCleaningAppPropertyCodes as jest.Mock
  const createManualMock = api.createManualCleaningTask as jest.Mock
  listPropertiesMock.mockResolvedValue([{ id: 'FIXTURE-PROPERTY-LINK-001', code: 'FIXTURE-PROP-CODE-LINK-001' }])
  createManualMock.mockClear()
  createManualMock.mockResolvedValue({})

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-create-password-applicability', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  try {
    await waitFor(() => expect(ui.getByTestId('quick-create-open')).toBeTruthy())
    fireEvent.press(ui.getByTestId('quick-create-open'))
    await waitFor(() => expect(listPropertiesMock).toHaveBeenCalled())
    fireEvent.changeText(ui.getByLabelText('quick-create-property'), 'FIXTURE-PROP-CODE-LINK-001')
    fireEvent.changeText(ui.getByLabelText('quick-create-lock-code'), 'synthetic-checkin-code')
    await waitFor(() => expect(ui.getByTestId('quick-create-link-empty')).toBeTruthy())
    fireEvent.press(ui.getByTestId('quick-create-submit'))

    await waitFor(() => expect(createManualMock).toHaveBeenCalledTimes(1))
    const checkinPayload = createManualMock.mock.calls[0][1]
    expect(checkinPayload).toEqual(expect.objectContaining({
      create_mode: 'checkin',
      property_id: 'FIXTURE-PROPERTY-LINK-001',
      new_code: 'synthetic-checkin-code',
      linked_checkout_task_id: null,
      checkin_link_decision: 'independent',
    }))
    expect(Object.prototype.hasOwnProperty.call(checkinPayload, 'old_code')).toBe(false)
    await waitFor(() => expect(ui.queryByTestId('quick-create-keyboard-avoider')).toBeNull())

    fireEvent.press(ui.getByTestId('quick-create-open'))
    fireEvent.press(ui.getByText('待同步退房'))
    fireEvent.changeText(ui.getByLabelText('quick-create-property'), 'FIXTURE-PROP-CODE-LINK-001')
    fireEvent.changeText(ui.getByLabelText('quick-create-lock-code'), 'synthetic-checkout-code')
    fireEvent.press(ui.getByTestId('quick-create-submit'))

    await waitFor(() => expect(createManualMock).toHaveBeenCalledTimes(2))
    const checkoutPayload = createManualMock.mock.calls[1][1]
    expect(checkoutPayload).toEqual(expect.objectContaining({
      create_mode: 'checkout',
      property_id: 'FIXTURE-PROPERTY-LINK-001',
      old_code: 'synthetic-checkout-code',
    }))
    expect(Object.prototype.hasOwnProperty.call(checkoutPayload, 'new_code')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(checkoutPayload, 'linked_checkout_task_id')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(checkoutPayload, 'checkin_link_decision')).toBe(false)

    await waitFor(() => expect(ui.queryByTestId('quick-create-keyboard-avoider')).toBeNull())
    fireEvent.press(ui.getByTestId('quick-create-open'))
    fireEvent.changeText(ui.getByLabelText('quick-create-property'), 'FIXTURE-PROP-CODE-LINK-001')
    await waitFor(() => expect(ui.getByTestId('quick-create-link-empty')).toBeTruthy())
    fireEvent.press(ui.getByTestId('quick-create-submit'))
    await waitFor(() => expect(createManualMock).toHaveBeenCalledTimes(3))
    const blankCheckinPayload = createManualMock.mock.calls[2][1]
    expect(blankCheckinPayload.new_code).toBeNull()
    expect(Object.prototype.hasOwnProperty.call(blankCheckinPayload, 'old_code')).toBe(false)

    await waitFor(() => expect(ui.queryByTestId('quick-create-keyboard-avoider')).toBeNull())
    fireEvent.press(ui.getByTestId('quick-create-open'))
    fireEvent.press(ui.getByText('待同步退房'))
    fireEvent.changeText(ui.getByLabelText('quick-create-property'), 'FIXTURE-PROP-CODE-LINK-001')
    fireEvent.press(ui.getByTestId('quick-create-submit'))
    await waitFor(() => expect(createManualMock).toHaveBeenCalledTimes(4))
    const blankCheckoutPayload = createManualMock.mock.calls[3][1]
    expect(blankCheckoutPayload.old_code).toBeNull()
    expect(Object.prototype.hasOwnProperty.call(blankCheckoutPayload, 'new_code')).toBe(false)
  } finally {
    ui.unmount()
    mockAuthState.user = previousUser
    mockRoleState.canSwitchTaskMode = previousRoleState.canSwitchTaskMode
    mockRoleState.isTaskManagerUser = previousRoleState.isTaskManagerUser
  }
})

test.each(['keys_hung', 'completed'])('checkin quick create auto-links the sole %s checkout candidate without inheriting its password', async (status) => {
  const api = require('../../lib/api')
  const previousUser = mockAuthState.user
  const previousRoleState = { ...mockRoleState }
  mockAuthState.user = { id: 'admin-1', username: 'admin-user', role: 'admin', roles: ['admin'] }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = true
  const listPropertiesMock = api.listCleaningAppPropertyCodes as jest.Mock
  const listCandidatesMock = api.listManualCheckinLinkCandidates as jest.Mock
  const createManualMock = api.createManualCleaningTask as jest.Mock
  listPropertiesMock.mockResolvedValue([{ id: 'FIXTURE-PROPERTY-LINK-001', code: 'FIXTURE-PROP-CODE-LINK-001' }])
  listCandidatesMock.mockReset()
  listCandidatesMock.mockResolvedValue([{
    id: `checkout-${status}`,
    property_id: 'FIXTURE-PROPERTY-LINK-001',
    property_code: 'FIXTURE-PROP-CODE-LINK-001',
    task_date: mockTodayKey,
    checkout_time: '10am',
    status,
  }])
  createManualMock.mockReset()
  createManualMock.mockResolvedValue({})

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: `tasks-create-link-${status}`, name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  try {
    fireEvent.press(await ui.findByTestId('quick-create-open'))
    await waitFor(() => expect(listPropertiesMock).toHaveBeenCalled())
    fireEvent.changeText(ui.getByLabelText('quick-create-property'), 'FIXTURE-PROP-CODE-LINK-001')
    await waitFor(() => expect(ui.getByLabelText(`关联退房任务-checkout-${status}`)).toBeTruthy())
    fireEvent.press(ui.getByTestId('quick-create-submit'))
    await waitFor(() => expect(createManualMock).toHaveBeenCalledTimes(1))
    const payload = createManualMock.mock.calls[0][1]
    expect(payload).toEqual(expect.objectContaining({
      create_mode: 'checkin',
      linked_checkout_task_id: `checkout-${status}`,
      checkin_link_decision: 'link',
    }))
    expect(Object.prototype.hasOwnProperty.call(payload, 'old_code')).toBe(false)
  } finally {
    ui.unmount()
    listCandidatesMock.mockReset()
    listCandidatesMock.mockResolvedValue([])
    mockAuthState.user = previousUser
    mockRoleState.canSwitchTaskMode = previousRoleState.canSwitchTaskMode
    mockRoleState.isTaskManagerUser = previousRoleState.isTaskManagerUser
  }
})

test('multiple checkout candidates require an explicit link or independent decision', async () => {
  const api = require('../../lib/api')
  const previousUser = mockAuthState.user
  const previousRoleState = { ...mockRoleState }
  mockAuthState.user = { id: 'admin-1', username: 'admin-user', role: 'admin', roles: ['admin'] }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = true
  const listPropertiesMock = api.listCleaningAppPropertyCodes as jest.Mock
  const listCandidatesMock = api.listManualCheckinLinkCandidates as jest.Mock
  const createManualMock = api.createManualCleaningTask as jest.Mock
  listPropertiesMock.mockResolvedValue([{ id: 'FIXTURE-PROPERTY-LINK-001', code: 'FIXTURE-PROP-CODE-LINK-001' }])
  listCandidatesMock.mockReset()
  listCandidatesMock.mockResolvedValue(['a', 'b'].map((id, index) => ({
    id: `checkout-${id}`,
    property_id: 'FIXTURE-PROPERTY-LINK-001',
    property_code: 'FIXTURE-PROP-CODE-LINK-001',
    task_date: mockTodayKey,
    checkout_time: index ? '11am' : '10am',
    status: index ? 'completed' : 'keys_hung',
  })))
  createManualMock.mockReset()
  createManualMock.mockResolvedValue({})

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-create-link-multiple', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  try {
    fireEvent.press(await ui.findByTestId('quick-create-open'))
    await waitFor(() => expect(listPropertiesMock).toHaveBeenCalled())
    fireEvent.changeText(ui.getByLabelText('quick-create-property'), 'FIXTURE-PROP-CODE-LINK-001')
    await waitFor(() => expect(ui.getByTestId('quick-create-link-decision-required')).toBeTruthy())
    expect(ui.getByTestId('quick-create-submit').props.accessibilityState?.disabled).toBe(true)
    fireEvent.press(ui.getByLabelText('关联退房任务-checkout-b'))
    expect(ui.getByTestId('quick-create-submit').props.accessibilityState?.disabled).not.toBe(true)
    fireEvent.press(ui.getByLabelText('创建独立入住任务'))
    fireEvent.press(ui.getByTestId('quick-create-submit'))
    await waitFor(() => expect(createManualMock).toHaveBeenCalledTimes(1))
    expect(createManualMock.mock.calls[0][1]).toEqual(expect.objectContaining({
      linked_checkout_task_id: null,
      checkin_link_decision: 'independent',
    }))
  } finally {
    ui.unmount()
    listCandidatesMock.mockReset()
    listCandidatesMock.mockResolvedValue([])
    mockAuthState.user = previousUser
    mockRoleState.canSwitchTaskMode = previousRoleState.canSwitchTaskMode
    mockRoleState.isTaskManagerUser = previousRoleState.isTaskManagerUser
  }
})

test('candidate loading fails closed and retry keeps the current quick-create input', async () => {
  const api = require('../../lib/api')
  const previousUser = mockAuthState.user
  const previousRoleState = { ...mockRoleState }
  mockAuthState.user = { id: 'admin-1', username: 'admin-user', role: 'admin', roles: ['admin'] }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = true
  const listPropertiesMock = api.listCleaningAppPropertyCodes as jest.Mock
  const listCandidatesMock = api.listManualCheckinLinkCandidates as jest.Mock
  const createManualMock = api.createManualCleaningTask as jest.Mock
  listPropertiesMock.mockResolvedValue([{ id: 'FIXTURE-PROPERTY-LINK-001', code: 'FIXTURE-PROP-CODE-LINK-001' }])
  listCandidatesMock.mockReset()
  listCandidatesMock.mockRejectedValueOnce(new Error('候选服务暂不可用')).mockResolvedValueOnce([])
  createManualMock.mockReset()

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-create-link-retry', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  try {
    fireEvent.press(await ui.findByTestId('quick-create-open'))
    await waitFor(() => expect(listPropertiesMock).toHaveBeenCalled())
    fireEvent.changeText(ui.getByLabelText('quick-create-property'), 'FIXTURE-PROP-CODE-LINK-001')
    fireEvent.changeText(ui.getByLabelText('quick-create-guest-note'), '临时入住备注不能丢')
    await waitFor(() => expect(ui.getByTestId('quick-create-link-error')).toBeTruthy())
    expect(ui.getByTestId('quick-create-submit').props.accessibilityState?.disabled).toBe(true)
    expect(createManualMock).not.toHaveBeenCalled()
    fireEvent.press(ui.getByLabelText('重试加载退房关联候选'))
    await waitFor(() => expect(ui.getByTestId('quick-create-link-empty')).toBeTruthy())
    expect(ui.getByDisplayValue('临时入住备注不能丢')).toBeTruthy()
  } finally {
    ui.unmount()
    listCandidatesMock.mockReset()
    listCandidatesMock.mockResolvedValue([])
    mockAuthState.user = previousUser
    mockRoleState.canSwitchTaskMode = previousRoleState.canSwitchTaskMode
    mockRoleState.isTaskManagerUser = previousRoleState.isTaskManagerUser
  }
})

test('late candidate responses cannot overwrite a newer property scope', async () => {
  const api = require('../../lib/api')
  const previousUser = mockAuthState.user
  const previousRoleState = { ...mockRoleState }
  mockAuthState.user = { id: 'admin-1', username: 'admin-user', role: 'admin', roles: ['admin'] }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = true
  const listPropertiesMock = api.listCleaningAppPropertyCodes as jest.Mock
  const listCandidatesMock = api.listManualCheckinLinkCandidates as jest.Mock
  listPropertiesMock.mockResolvedValue([
    { id: 'FIXTURE-PROPERTY-LINK-001', code: 'FIXTURE-PROP-CODE-LINK-001' },
    { id: 'property-other', code: 'OTHER' },
  ])
  let resolveCwg!: (items: any[]) => void
  let resolveOther!: (items: any[]) => void
  listCandidatesMock.mockReset()
  listCandidatesMock.mockImplementation((_token: string, params: { property_id: string }) => new Promise<any[]>((resolve) => {
    if (params.property_id === 'FIXTURE-PROPERTY-LINK-001') resolveCwg = resolve
    else resolveOther = resolve
  }))

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-create-link-stale', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  try {
    fireEvent.press(await ui.findByTestId('quick-create-open'))
    await waitFor(() => expect(listPropertiesMock).toHaveBeenCalled())
    fireEvent.changeText(ui.getByLabelText('quick-create-property'), 'FIXTURE-PROP-CODE-LINK-001')
    await waitFor(() => expect(listCandidatesMock).toHaveBeenCalledWith('local:test', expect.objectContaining({ property_id: 'FIXTURE-PROPERTY-LINK-001' })))
    fireEvent.changeText(ui.getByLabelText('quick-create-property'), 'OTHER')
    await waitFor(() => expect(listCandidatesMock).toHaveBeenCalledWith('local:test', expect.objectContaining({ property_id: 'property-other' })))
    await act(async () => {
      resolveOther([{
        id: 'checkout-other',
        property_id: 'property-other',
        property_code: 'OTHER',
        task_date: mockTodayKey,
        checkout_time: '10am',
        status: 'completed',
      }])
      await Promise.resolve()
    })
    await waitFor(() => expect(ui.getByLabelText('关联退房任务-checkout-other')).toBeTruthy())
    await act(async () => {
      resolveCwg([{
        id: 'FIXTURE-CHECKOUT-STALE-001',
        property_id: 'FIXTURE-PROPERTY-LINK-001',
        property_code: 'FIXTURE-PROP-CODE-LINK-001',
        task_date: mockTodayKey,
        checkout_time: '10am',
        status: 'completed',
      }])
      await Promise.resolve()
    })
    expect(ui.queryByLabelText('关联退房任务-FIXTURE-CHECKOUT-STALE-001')).toBeNull()
    expect(ui.getByLabelText('关联退房任务-checkout-other')).toBeTruthy()
  } finally {
    ui.unmount()
    listCandidatesMock.mockReset()
    listCandidatesMock.mockResolvedValue([])
    mockAuthState.user = previousUser
    mockRoleState.canSwitchTaskMode = previousRoleState.canSwitchTaskMode
    mockRoleState.isTaskManagerUser = previousRoleState.isTaskManagerUser
  }
})

test('a link conflict refreshes candidates and retains input for a safe retry', async () => {
  const api = require('../../lib/api')
  const previousUser = mockAuthState.user
  const previousRoleState = { ...mockRoleState }
  mockAuthState.user = { id: 'admin-1', username: 'admin-user', role: 'admin', roles: ['admin'] }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = true
  const listPropertiesMock = api.listCleaningAppPropertyCodes as jest.Mock
  const listCandidatesMock = api.listManualCheckinLinkCandidates as jest.Mock
  const createManualMock = api.createManualCleaningTask as jest.Mock
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  listPropertiesMock.mockResolvedValue([{ id: 'FIXTURE-PROPERTY-LINK-001', code: 'FIXTURE-PROP-CODE-LINK-001' }])
  const candidate = (id: string) => [{
    id,
    property_id: 'FIXTURE-PROPERTY-LINK-001',
    property_code: 'FIXTURE-PROP-CODE-LINK-001',
    task_date: mockTodayKey,
    checkout_time: '10am',
    status: 'completed',
  }]
  listCandidatesMock.mockReset()
  let resolveReplacement!: (items: ReturnType<typeof candidate>) => void
  listCandidatesMock.mockResolvedValueOnce(candidate('checkout-first')).mockImplementationOnce(() => new Promise((resolve) => {
    resolveReplacement = resolve
  }))
  createManualMock.mockReset()
  createManualMock.mockRejectedValueOnce(Object.assign(new Error('该退房任务已被关联'), {
    code: 'manual_checkin_checkout_link_conflict',
    status: 409,
  })).mockResolvedValueOnce({})

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-create-link-conflict', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  try {
    fireEvent.press(await ui.findByTestId('quick-create-open'))
    await waitFor(() => expect(listPropertiesMock).toHaveBeenCalled())
    fireEvent.changeText(ui.getByLabelText('quick-create-property'), 'FIXTURE-PROP-CODE-LINK-001')
    fireEvent.changeText(ui.getByLabelText('quick-create-guest-note'), '冲突后保留输入')
    await waitFor(() => expect(ui.getByLabelText('关联退房任务-checkout-first')).toBeTruthy())
    fireEvent.press(ui.getByTestId('quick-create-submit'))
    await waitFor(() => expect(listCandidatesMock).toHaveBeenCalledTimes(2))
    expect(ui.getByTestId('quick-create-link-loading')).toBeTruthy()
    expect(ui.getByTestId('quick-create-submit').props.accessibilityState?.disabled).toBe(true)
    expect(ui.getByDisplayValue('冲突后保留输入')).toBeTruthy()
    await act(async () => {
      resolveReplacement(candidate('checkout-replacement'))
      await Promise.resolve()
    })
    await waitFor(() => expect(ui.getByLabelText('关联退房任务-checkout-replacement')).toBeTruthy())
    expect(ui.getByDisplayValue('冲突后保留输入')).toBeTruthy()
    fireEvent.press(ui.getByTestId('quick-create-submit'))
    await waitFor(() => expect(createManualMock).toHaveBeenCalledTimes(2))
    expect(createManualMock.mock.calls[1][1]).toEqual(expect.objectContaining({
      linked_checkout_task_id: 'checkout-replacement',
      checkin_link_decision: 'link',
      guest_special_request: '冲突后保留输入',
    }))
  } finally {
    ui.unmount()
    alertSpy.mockRestore()
    listCandidatesMock.mockReset()
    listCandidatesMock.mockResolvedValue([])
    mockAuthState.user = previousUser
    mockRoleState.canSwitchTaskMode = previousRoleState.canSwitchTaskMode
    mockRoleState.isTaskManagerUser = previousRoleState.isTaskManagerUser
  }
})

test('failed checkin quick create keeps its applicable input and remains single-flight for retry', async () => {
  const api = require('../../lib/api')
  const previousUser = mockAuthState.user
  const previousRoleState = { ...mockRoleState }
  mockAuthState.user = { id: 'admin-1', username: 'admin-user', role: 'admin', roles: ['admin'] }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = true
  const listPropertiesMock = api.listCleaningAppPropertyCodes as jest.Mock
  const createManualMock = api.createManualCleaningTask as jest.Mock
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  listPropertiesMock.mockResolvedValue([{ id: 'FIXTURE-PROPERTY-LINK-001', code: 'FIXTURE-PROP-CODE-LINK-001' }])
  createManualMock.mockClear()
  let rejectCreate!: (reason: Error) => void
  createManualMock.mockImplementationOnce(() => new Promise((_resolve, reject) => {
    rejectCreate = reject
  }))

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-create-checkin-retry', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  try {
    await waitFor(() => expect(ui.getByTestId('quick-create-open')).toBeTruthy())
    fireEvent.press(ui.getByTestId('quick-create-open'))
    await waitFor(() => expect(listPropertiesMock).toHaveBeenCalled())
    fireEvent.changeText(ui.getByLabelText('quick-create-property'), 'FIXTURE-PROP-CODE-LINK-001')
    fireEvent.changeText(ui.getByLabelText('quick-create-time'), '4pm')
    fireEvent.changeText(ui.getByLabelText('quick-create-lock-code'), 'synthetic-checkin-code')
    fireEvent.changeText(ui.getByLabelText('quick-create-guest-note'), '保留这条入住备注')
    await waitFor(() => expect(ui.getByTestId('quick-create-link-empty')).toBeTruthy())

    const submit = ui.getByTestId('quick-create-submit')
    fireEvent.press(submit)
    fireEvent.press(submit)
    expect(createManualMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      rejectCreate(new Error('password_field_not_applicable'))
      await Promise.resolve()
    })
    await waitFor(() => expect(ui.getByTestId('quick-create-submit').props.accessibilityState?.disabled).not.toBe(true))
    expect(ui.getByDisplayValue('FIXTURE-PROP-CODE-LINK-001')).toBeTruthy()
    expect(ui.getByDisplayValue('4pm')).toBeTruthy()
    expect(ui.getByDisplayValue('synthetic-checkin-code')).toBeTruthy()
    expect(ui.getByDisplayValue('保留这条入住备注')).toBeTruthy()

    createManualMock.mockResolvedValueOnce({})
    fireEvent.press(ui.getByTestId('quick-create-submit'))
    await waitFor(() => expect(createManualMock).toHaveBeenCalledTimes(2))
    const retryPayload = createManualMock.mock.calls[1][1]
    expect(retryPayload).toEqual(expect.objectContaining({
      create_mode: 'checkin',
      property_id: 'FIXTURE-PROPERTY-LINK-001',
      checkin_time: '4pm',
      new_code: 'synthetic-checkin-code',
      guest_special_request: '保留这条入住备注',
    }))
    expect(Object.prototype.hasOwnProperty.call(retryPayload, 'old_code')).toBe(false)
  } finally {
    ui.unmount()
    alertSpy.mockRestore()
    mockAuthState.user = previousUser
    mockRoleState.canSwitchTaskMode = previousRoleState.canSwitchTaskMode
    mockRoleState.isTaskManagerUser = previousRoleState.isTaskManagerUser
  }
})

test('quick create ignores repeated saves and keeps input after an async failure', async () => {
  const api = require('../../lib/api')
  const previousUser = mockAuthState.user
  const previousRoleState = { ...mockRoleState }
  mockAuthState.user = { id: 'admin-1', username: 'admin-user', role: 'admin', roles: ['admin'] }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = true
  const createOfflineMock = api.createCleaningOfflineTask as jest.Mock
  createOfflineMock.mockClear()
  let rejectCreate!: (reason: Error) => void
  createOfflineMock.mockImplementationOnce(() => new Promise((_resolve, reject) => {
    rejectCreate = reject
  }))

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-create-single-flight', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByText('新增')).toBeTruthy())
  fireEvent.press(ui.getByText('新增'))
  fireEvent.press(ui.getByText('线下任务'))
  fireEvent.changeText(ui.getByLabelText('quick-create-offline-title'), '修门锁')
  fireEvent.changeText(ui.getByLabelText('quick-create-offline-content'), '保存失败后不能丢失')

  const submit = ui.getByTestId('quick-create-submit')
  fireEvent.press(submit)
  fireEvent.press(submit)
  expect(createOfflineMock).toHaveBeenCalledTimes(1)

  await act(async () => {
    rejectCreate(new Error('mocked create failed'))
    await Promise.resolve()
  })
  await waitFor(() => expect(ui.getByText('确认新增')).toBeTruthy())
  expect(ui.getByDisplayValue('修门锁')).toBeTruthy()
  expect(ui.getByDisplayValue('保存失败后不能丢失')).toBeTruthy()
  expect(ui.getByTestId('quick-create-submit').props.accessibilityState?.disabled).not.toBe(true)

  createOfflineMock.mockResolvedValueOnce({})
  fireEvent.press(ui.getByTestId('quick-create-submit'))
  await waitFor(() => expect(createOfflineMock).toHaveBeenCalledTimes(2))
  expect(createOfflineMock).toHaveBeenLastCalledWith('local:test', expect.objectContaining({
    title: '修门锁',
    content: '保存失败后不能丢失',
  }))

  mockAuthState.user = previousUser
  mockRoleState.canSwitchTaskMode = previousRoleState.canSwitchTaskMode
  mockRoleState.isTaskManagerUser = previousRoleState.isTaskManagerUser
})

test('quick create cannot reopen during its post-create refresh and Android back can close while busy', async () => {
  const api = require('../../lib/api')
  const store = require('../../lib/workTasksStore')
  const previousUser = mockAuthState.user
  const previousRoleState = { ...mockRoleState }
  mockAuthState.user = { id: 'admin-1', username: 'admin-user', role: 'admin', roles: ['admin'] }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = true
  const createOfflineMock = api.createCleaningOfflineTask as jest.Mock
  const refreshMock = store.requestWorkTasksRefresh as jest.Mock
  createOfflineMock.mockClear()
  refreshMock.mockClear()
  let finishCreate!: (value: Record<string, never>) => void
  let finishRefresh!: (value: boolean) => void
  createOfflineMock.mockImplementationOnce(() => new Promise<Record<string, never>>((resolve) => {
    finishCreate = resolve
  }))

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-create-refresh-lock', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  try {
    await waitFor(() => expect(refreshMock).toHaveBeenCalled())
    refreshMock.mockClear()
    refreshMock.mockImplementationOnce(() => new Promise<boolean>((resolve) => {
      finishRefresh = resolve
    }))

    fireEvent.press(ui.getByTestId('quick-create-open'))
    fireEvent.press(ui.getByText('线下任务'))
    fireEvent.changeText(ui.getByLabelText('quick-create-offline-title'), '挂锁后刷新')
    fireEvent.press(ui.getByTestId('quick-create-submit'))
    await waitFor(() => expect(createOfflineMock).toHaveBeenCalledTimes(1))

    const visibleBusyModal = ui.UNSAFE_getAllByType(Modal).find((modal) => modal.props.visible === true)
    expect(visibleBusyModal).toBeTruthy()
    act(() => visibleBusyModal?.props.onRequestClose())
    await waitFor(() => expect(ui.queryByTestId('quick-create-keyboard-avoider')).toBeNull())

    await act(async () => {
      finishCreate({})
      await Promise.resolve()
    })
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1))
    const openWhileRefreshing = ui.getByTestId('quick-create-open')
    expect(openWhileRefreshing.props.accessibilityState?.disabled ?? openWhileRefreshing.props.disabled).toBe(true)
    fireEvent.press(openWhileRefreshing)
    expect(ui.queryByTestId('quick-create-keyboard-avoider')).toBeNull()

    await act(async () => {
      finishRefresh(true)
      await Promise.resolve()
    })
    await waitFor(() => {
      const openAfterRefresh = ui.getByTestId('quick-create-open')
      expect(openAfterRefresh.props.accessibilityState?.disabled ?? openAfterRefresh.props.disabled).not.toBe(true)
    })
    fireEvent.press(ui.getByTestId('quick-create-open'))
    expect(ui.getByTestId('quick-create-keyboard-avoider')).toBeTruthy()
    const visibleIdleModal = ui.UNSAFE_getAllByType(Modal).find((modal) => modal.props.visible === true)
    act(() => visibleIdleModal?.props.onRequestClose())
    await waitFor(() => expect(ui.queryByTestId('quick-create-keyboard-avoider')).toBeNull())
  } finally {
    ui.unmount()
    mockAuthState.user = previousUser
    mockRoleState.canSwitchTaskMode = previousRoleState.canSwitchTaskMode
    mockRoleState.isTaskManagerUser = previousRoleState.isTaskManagerUser
  }
})

test('a failed post-create refresh does not report creation failure or leave quick create locked', async () => {
  const api = require('../../lib/api')
  const store = require('../../lib/workTasksStore')
  const previousUser = mockAuthState.user
  const previousRoleState = { ...mockRoleState }
  mockAuthState.user = { id: 'admin-1', username: 'admin-user', role: 'admin', roles: ['admin'] }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = true
  const createOfflineMock = api.createCleaningOfflineTask as jest.Mock
  const refreshMock = store.requestWorkTasksRefresh as jest.Mock
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  createOfflineMock.mockClear()
  createOfflineMock.mockResolvedValueOnce({})
  refreshMock.mockClear()

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-create-refresh-failure', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  try {
    await waitFor(() => expect(refreshMock).toHaveBeenCalled())
    refreshMock.mockClear()
    refreshMock.mockRejectedValueOnce(new Error('mocked refresh failed after create'))

    fireEvent.press(ui.getByTestId('quick-create-open'))
    fireEvent.press(ui.getByText('线下任务'))
    fireEvent.changeText(ui.getByLabelText('quick-create-offline-title'), '已创建但刷新失败')
    fireEvent.press(ui.getByTestId('quick-create-submit'))

    await waitFor(
      () => expect(ui.queryByTestId('quick-create-keyboard-avoider')).toBeNull(),
      { timeout: 5_000 },
    )
    await waitFor(() => {
      const openAfterFailure = ui.getByTestId('quick-create-open')
      expect(openAfterFailure.props.accessibilityState?.disabled ?? openAfterFailure.props.disabled).not.toBe(true)
    })
    expect(ui.getByText('已新增')).toBeTruthy()
    expect(alertSpy).not.toHaveBeenCalledWith(expect.anything(), expect.stringContaining('新增失败'))

    fireEvent.press(ui.getByTestId('quick-create-open'))
    expect(ui.getByTestId('quick-create-keyboard-avoider')).toBeTruthy()
    fireEvent.press(ui.getByLabelText('关闭新增任务'))
  } finally {
    ui.unmount()
    alertSpy.mockRestore()
    mockAuthState.user = previousUser
    mockRoleState.canSwitchTaskMode = previousRoleState.canSwitchTaskMode
    mockRoleState.isTaskManagerUser = previousRoleState.isTaskManagerUser
  }
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

test('password-only check-in execution joins the owner mixed order and shows a selectable order circle', async () => {
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
      id: 'clean-owner',
      task_kind: 'cleaning',
      execution_role: 'cleaning',
      source_type: 'cleaning_tasks',
      source_id: 'ct-clean-owner',
      active_source_ids: ['ct-clean-owner'],
      title: 'A 清洁',
      scheduled_date: mockTodayKey,
      assignee_id: 'u1',
      cleaner_id: 'u1',
      inspector_id: null,
      status: 'assigned',
      property: { ...previousItems[0].property, id: 'p-clean', code: 'A1001' },
      date: mockTodayKey,
    },
    {
      ...previousItems[0],
      id: 'password-owner',
      task_kind: 'execution',
      execution_role: 'execution',
      execution_semantics: 'key_or_password_action',
      task_type: 'checkin_clean',
      inspection_scope: 'password_only',
      source_type: 'cleaning_tasks',
      source_id: 'ct-password-owner',
      active_source_ids: ['ct-password-owner'],
      title: 'B 仅改密码',
      scheduled_date: mockTodayKey,
      assignee_id: 'u1',
      executor_id: 'u1',
      executor_reorderable: true,
      execution_state: 'active',
      cleaner_id: null,
      inspector_id: null,
      status: 'assigned',
      property: { ...previousItems[0].property, id: 'p-password', code: 'B1002' },
      date: mockTodayKey,
    },
    {
      id: 'offline-owner',
      task_kind: 'offline',
      source_type: 'cleaning_offline_tasks',
      source_id: 'offline-owner-source',
      title: 'C 线下',
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
  ]

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-password-only-mixed-reorder', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  try {
    await waitFor(() => {
      expect(ui.getByText('排序')).toBeTruthy()
      expect(ui.getByLabelText('task-card-password-owner')).toBeTruthy()
    })
    expect(within(ui.getByLabelText('task-card-password-owner')).getByText('·')).toBeTruthy()

    fireEvent.press(ui.getByText('排序'))
    fireEvent.press(ui.getByLabelText('task-card-password-owner'))
    fireEvent.press(ui.getByLabelText('task-card-offline-owner'))
    fireEvent.press(ui.getByLabelText('task-card-clean-owner'))
    fireEvent.press(ui.getByText('保存顺序'))

    await waitFor(() => {
      expect(reorderMixedWorkTasksMock).toHaveBeenCalledWith('local:test', {
        date: mockTodayKey,
        items: [
          { kind: 'executor', ids: ['ct-password-owner'], sort_index: 1 },
          { kind: 'work', ids: ['offline-owner'], sort_index: 2 },
          { kind: 'cleaner', ids: ['ct-clean-owner'], sort_index: 3 },
        ],
      })
    })
    expect(patchWorkTaskItemsMock).toHaveBeenCalledWith([
      { id: 'password-owner', patch: { sort_index: 1, sort_index_inspector: 1 } },
      { id: 'offline-owner', patch: { sort_index: 2 } },
      { id: 'clean-owner', patch: { sort_index: 3, sort_index_cleaner: 3 } },
    ])
  } finally {
    ui.unmount()
    snapshot.items = previousItems
  }
})

test('another executor password-only task stays visible but cannot be reordered', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousItems = snapshot.items.slice()
  snapshot.items = [{
    ...previousItems[0],
    id: 'password-other',
    task_kind: 'execution',
    execution_role: 'execution',
    execution_semantics: 'key_or_password_action',
    task_type: 'checkin_clean',
    inspection_scope: 'password_only',
    source_type: 'cleaning_tasks',
    source_id: 'ct-password-other',
    active_source_ids: ['ct-password-other'],
    title: '他人仅改密码',
    scheduled_date: mockTodayKey,
    assignee_id: 'other-user',
    executor_id: 'other-user',
    executor_reorderable: true,
    execution_state: 'active',
    cleaner_id: null,
    inspector_id: null,
    status: 'assigned',
    date: mockTodayKey,
  }]

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-password-only-other-owner', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  try {
    await waitFor(() => expect(ui.getByLabelText('task-card-password-other')).toBeTruthy())
    expect(ui.queryByText('排序')).toBeNull()
    expect(within(ui.getByLabelText('task-card-password-other')).queryByText('·')).toBeNull()
  } finally {
    ui.unmount()
    snapshot.items = previousItems
  }
})

test('legacy password-only executor fallback stays visible without receiving source-assignee reorder ownership', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousItems = snapshot.items.slice()
  snapshot.items = [{
    ...previousItems[0],
    id: 'password-legacy-fallback',
    task_kind: 'execution',
    execution_role: 'execution',
    execution_semantics: 'key_or_password_action',
    task_type: 'checkin_clean',
    inspection_scope: 'password_only',
    source_type: 'cleaning_tasks',
    source_id: 'ct-password-legacy-fallback',
    active_source_ids: ['ct-password-legacy-fallback'],
    title: '兼容执行人仅改密码',
    scheduled_date: mockTodayKey,
    assignee_id: 'u1',
    executor_id: 'u1',
    executor_reorderable: false,
    execution_state: 'active',
    cleaner_id: null,
    inspector_id: 'u1',
    status: 'assigned',
    date: mockTodayKey,
  }]

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-password-only-legacy-fallback', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  try {
    await waitFor(() => expect(ui.getByLabelText('task-card-password-legacy-fallback')).toBeTruthy())
    expect(ui.queryByText('排序')).toBeNull()
    expect(within(ui.getByLabelText('task-card-password-legacy-fallback')).queryByText('·')).toBeNull()
  } finally {
    ui.unmount()
    snapshot.items = previousItems
  }
})

test('a terminal password-only card never shows the reorder circle even with a stale reorder capability', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousItems = snapshot.items.slice()
  snapshot.items = [{
    ...previousItems[0],
    id: 'password-terminal',
    task_kind: 'execution',
    execution_role: 'execution',
    execution_semantics: 'key_or_password_action',
    task_type: 'checkin_clean',
    inspection_scope: 'password_only',
    source_type: 'cleaning_tasks',
    source_id: 'ct-password-terminal',
    active_source_ids: ['ct-password-terminal'],
    title: '已完成仅改密码',
    scheduled_date: mockTodayKey,
    assignee_id: 'u1',
    executor_id: 'u1',
    executor_reorderable: true,
    execution_state: 'active',
    cleaner_id: null,
    inspector_id: null,
    status: 'done',
    date: mockTodayKey,
  }]

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-password-only-terminal', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  try {
    await waitFor(() => expect(ui.getByLabelText('task-card-password-terminal')).toBeTruthy())
    expect(ui.queryByText('排序')).toBeNull()
    expect(within(ui.getByLabelText('task-card-password-terminal')).queryByText('·')).toBeNull()
  } finally {
    ui.unmount()
    snapshot.items = previousItems
  }
})

test('password-only reorder suppresses a duplicate save and applies no local order after an API failure', async () => {
  const api = require('../../lib/api')
  const store = require('../../lib/workTasksStore')
  const reorderMixedWorkTasksMock = api.reorderMixedWorkTasks as jest.Mock
  const patchWorkTaskItemsMock = store.patchWorkTaskItems as jest.Mock
  const snapshot = store.getWorkTasksSnapshot()
  const previousItems = snapshot.items.slice()
  reorderMixedWorkTasksMock.mockClear()
  patchWorkTaskItemsMock.mockClear()
  snapshot.items = [{
    ...previousItems[0],
    id: 'password-retry',
    task_kind: 'execution',
    execution_role: 'execution',
    execution_semantics: 'key_or_password_action',
    task_type: 'checkin_clean',
    inspection_scope: 'password_only',
    source_type: 'cleaning_tasks',
    source_id: 'ct-password-retry',
    active_source_ids: ['ct-password-retry'],
    title: '重试仅改密码',
    scheduled_date: mockTodayKey,
    assignee_id: 'u1',
    executor_id: 'u1',
    executor_reorderable: true,
    execution_state: 'active',
    cleaner_id: null,
    inspector_id: null,
    status: 'assigned',
    date: mockTodayKey,
  }]

  let rejectSave!: (error: Error) => void
  reorderMixedWorkTasksMock.mockImplementationOnce(() => new Promise((_resolve, reject) => {
    rejectSave = reject
  }))
  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-password-only-retry', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  try {
    await waitFor(() => expect(ui.getByText('排序')).toBeTruthy())
    fireEvent.press(ui.getByText('排序'))
    fireEvent.press(ui.getByLabelText('task-card-password-retry'))
    fireEvent.press(ui.getByText('保存顺序'))
    fireEvent.press(ui.getByText('保存顺序'))
    expect(reorderMixedWorkTasksMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      rejectSave(new Error('offline'))
      await Promise.resolve()
    })
    await waitFor(() => expect(ui.getByText('保存顺序')).toBeTruthy())
    expect(patchWorkTaskItemsMock).not.toHaveBeenCalled()

    reorderMixedWorkTasksMock.mockResolvedValueOnce({})
    fireEvent.press(ui.getByText('保存顺序'))
    await waitFor(() => expect(reorderMixedWorkTasksMock).toHaveBeenCalledTimes(2))
    expect(patchWorkTaskItemsMock).toHaveBeenCalledWith([
      { id: 'password-retry', patch: { sort_index: 1, sort_index_inspector: 1 } },
    ])
  } finally {
    reorderMixedWorkTasksMock.mockImplementation(async () => ({}))
    ui.unmount()
    snapshot.items = previousItems
  }
})

test('a day containing only read-only work records does not offer task reordering', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousItems = snapshot.items.slice()
  snapshot.items = [{
    ...previousItems[0],
    id: 'completed-record',
    status: 'done',
    execution_list_visible: false,
    work_record_visible: true,
    work_record_state: 'completed',
    work_record_date: mockTodayKey,
    work_record_read_only: true,
    source_type: 'cleaning_tasks',
    old_code: 'NOT_A_REAL_OLD_CODE',
    new_code: 'NOT_A_REAL_NEW_CODE',
    read_only_views: {
      property_access: true,
      lock_codes: true,
      cleaner_photos: true,
      inspection_photos: false,
      guest_key_photo: true,
      media_scope: 'cleaner',
    },
    counts_as_active_task: false,
    date: mockTodayKey,
  }]

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-read-only-record', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  try {
    await waitFor(() => expect(ui.getByLabelText('task-card-completed-record')).toBeTruthy())
    expandTask(ui, 'completed-record')
    expect(ui.getByText('NOT_A_REAL_OLD_CODE')).toBeTruthy()
    expect(ui.getByText('NOT_A_REAL_NEW_CODE')).toBeTruthy()
    expect(ui.queryByText('排序')).toBeNull()
  } finally {
    snapshot.items = previousItems
    ui.unmount()
  }
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

test('day-end statistics and insertion distinguish structured handover from explicit no-fact raw keys_hung', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousItems = snapshot.items.slice()
  const base = previousItems[0]
  snapshot.items = [
    {
      ...base,
      id: 'active-cleaning',
      source_id: 'active-cleaning-source',
      title: 'A 未完成清洁',
      status: 'assigned',
      cleaner_id: 'u1',
      sort_index: 1,
      sort_index_cleaner: 1,
      property: { ...base.property, id: 'active-property', code: 'ACTIVE1001' },
    },
    {
      ...base,
      id: 'explicit-no-handover',
      source_id: 'explicit-no-handover-source',
      title: 'B 明确无挂钥匙事实',
      status: 'keys_hung',
      cleaner_id: 'u1',
      sort_index: 2,
      sort_index_cleaner: 2,
      key_handover: null,
      property: { ...base.property, id: 'no-fact-property', code: 'NOFACT1002' },
    },
    {
      ...base,
      id: 'structured-handover',
      source_id: 'structured-handover-source',
      title: 'C 结构化已挂钥匙',
      status: 'in_progress',
      cleaner_id: 'u1',
      sort_index: 3,
      sort_index_cleaner: 3,
      key_handover: {
        state: 'completed',
        source_task_id: 'structured-handover-source',
        completed_at: '2026-10-21T01:02:03.000Z',
      },
      property: { ...base.property, id: 'handover-property', code: 'HANDOVER1003' },
    },
  ]

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-day-end-structured-key-handover', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  try {
    await waitFor(() => {
      expect(ui.getByText('在办 3 · 完成 0')).toBeTruthy()
      expect(ui.getByText('日终交接')).toBeTruthy()
      expect(ui.getByLabelText('task-card-structured-handover')).toBeTruthy()
    })

    const rendered = flattenRenderedText(ui.toJSON()).join('\n')
    const activeIndex = rendered.indexOf('ACTIVE1001')
    const explicitNoFactIndex = rendered.indexOf('NOFACT1002')
    const dayEndIndex = rendered.indexOf('日终交接')
    const structuredIndex = rendered.indexOf('HANDOVER1003')
    expect(activeIndex).toBeGreaterThanOrEqual(0)
    expect(explicitNoFactIndex).toBeGreaterThan(activeIndex)
    expect(dayEndIndex).toBeGreaterThan(explicitNoFactIndex)
    expect(structuredIndex).toBeGreaterThan(dayEndIndex)
  } finally {
    ui.unmount()
    snapshot.items = previousItems
  }
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
      assignee_name: 'Fixture User D',
      executor_name: 'Fixture User D',
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
    expect(ui.getByText('Fixture User D')).toBeTruthy()
    expect(ui.queryByText('execution')).toBeNull()
  })

  const rendered = flattenRenderedText(ui.toJSON()).join('\n')
  expect(rendered).toContain('检查/挂钥匙')
  expect(rendered).toContain('执行\nFixture User D')
  expect(rendered).not.toContain('清洁\nFixture User D')

  snapshot.items = previousItems
})

test('legacy password-only check-in card shows generic executor instead of cleaner', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousItems = snapshot.items.slice()
  snapshot.items = [
    {
      ...previousItems[0],
      id: 'eq3401-password-only',
      task_kind: 'cleaning',
      execution_role: undefined,
      execution_semantics: undefined,
      task_type: 'checkin_clean',
      inspection_scope: 'password_only',
      inspection_mode: 'same_day',
      source_type: 'cleaning_tasks',
      source_id: 'ct-eq3401',
      assignee_id: 'u1',
      assignee_name: 'Fixture User E',
      executor_name: null,
      cleaner_id: null,
      cleaner_name: 'Fixture User E',
      inspector_id: null,
      inspector_name: null,
      status: 'pending',
      start_time: null,
      end_time: '3pm',
      property: {
        ...previousItems[0].property,
        code: 'EQ3401',
        region: '',
      },
    },
  ]

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-eq3401-password-only', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  try {
    await waitFor(() => expect(ui.getByLabelText('task-collapse-eq3401-password-only')).toBeTruthy())
    expandTask(ui, 'eq3401-password-only')

    await waitFor(() => {
      expect(ui.getByText('检查/挂钥匙')).toBeTruthy()
      expect(ui.getByText('仅改密码')).toBeTruthy()
      expect(ui.getByText('已分配')).toBeTruthy()
      expect(ui.getByText('Fixture User E')).toBeTruthy()
    })

    const rendered = flattenRenderedText(ui.toJSON()).join('\n')
    expect(rendered).toContain('执行\nFixture User E')
    expect(rendered).not.toContain('清洁\nFixture User E')
    expect(rendered).not.toContain('未分配')
  } finally {
    snapshot.items = previousItems
  }
})

test('inspect-and-hang semantics never show a generic assignee as cleaning staff', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousItems = snapshot.items.slice()
  snapshot.items = [
    {
      ...previousItems[0],
      id: 'inspect-and-hang-generic-executor',
      task_kind: 'cleaning',
      execution_role: undefined,
      execution_semantics: 'checkin_inspection',
      task_type: 'checkin_clean',
      inspection_scope: 'inspect_and_hang',
      inspection_mode: 'same_day',
      source_type: 'cleaning_tasks',
      source_id: 'ct-inspect-and-hang',
      assignee_id: 'oscar-id',
      assignee_name: 'Fixture User E',
      executor_id: 'oscar-id',
      executor_name: 'Fixture User E',
      cleaner_id: null,
      cleaner_name: 'Fixture User E',
      inspector_id: null,
      inspector_name: null,
      status: 'pending',
      start_time: null,
      end_time: '3pm',
      property: {
        ...previousItems[0].property,
        code: 'INSPECT1402',
        region: '',
      },
    },
  ]

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-inspect-and-hang-generic-executor', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  try {
    await waitFor(() => expect(ui.getByLabelText('task-collapse-inspect-and-hang-generic-executor')).toBeTruthy())
    expandTask(ui, 'inspect-and-hang-generic-executor')

    await waitFor(() => {
      expect(ui.getByText('检查/挂钥匙')).toBeTruthy()
      expect(ui.getByText('检查后挂钥匙')).toBeTruthy()
      expect(ui.getByText('Fixture User E')).toBeTruthy()
    })

    const rendered = flattenRenderedText(ui.toJSON()).join('\n')
    expect(rendered).toContain('执行\nFixture User E')
    expect(rendered).not.toContain('清洁\nFixture User E')
  } finally {
    snapshot.items = previousItems
  }
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
      assignee_name: 'Fixture User F',
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
    expect(ui.getByText('Fixture User F')).toBeTruthy()
    expect(ui.queryByText('execution')).toBeNull()
  })

  const rendered = flattenRenderedText(ui.toJSON()).join('\n')
  expect(rendered).toContain('执行\nFixture User F')
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

test('tasks screen shows original checkout and blocks silent inspection reassignment', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousTask = { ...snapshot.items[0] }
  snapshot.items[0] = {
    ...snapshot.items[0],
    task_kind: 'inspection',
    task_type: 'checkout_clean',
    inspection_mode: 'deferred',
    inspection_due_date: '2026-10-18',
    inspection_original_checkout_date: '2026-10-16',
    inspection_assignment_conflict: {
      reasons: ['checkin_inspector_mismatch', 'checkin_participant_mismatch'],
      planned_inspector_id: 'oscar',
      planned_inspector_name: 'Fixture User E',
      checkin_inspector_id: 'barbara',
      checkin_inspector_name: 'Fixture User I',
      checkin_assignee_id: 'oscar',
      checkin_assignee_name: 'Fixture User E',
      deferred_task_id: 'checkout-8508',
      checkin_task_id: 'checkin-8508',
    },
  }

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-inspection-conflict', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText('原退房 2026-10-16')).toBeTruthy()
    expect(ui.getByText('检查安排冲突')).toBeTruthy()
    expect(ui.getByText('计划检查：Fixture User E；入住检查：Fixture User I；入住执行：Fixture User E。不会自动改派或转移检查费。')).toBeTruthy()
  })

  snapshot.items[0] = previousTask
})

test.each([
  ['admin', ['admin']],
  ['offline manager', ['offline_manager']],
  ['customer service', ['customer_service']],
])('manager merged deferred/check-in card shows the merge label and check-in assignment for %s', async (_label, roles) => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousItems = snapshot.items
  const previousUser = mockAuthState.user
  const previousRoleState = { ...mockRoleState }
  const base = previousItems[0]
  snapshot.items = [{
    ...base,
    id: `deferred-checkin-${roles[0]}`,
    source_type: 'cleaning_tasks',
    source_id: 'checkin-406',
    source_ids: ['checkout-406', 'checkin-406'],
    task_kind: 'inspection',
    task_type: 'checkin_clean',
    title: 'FIXTURE-VISIBILITY-001',
    scheduled_date: mockTodayKey,
    status: 'assigned',
    assignee_id: 'mia-id',
    inspector_id: null,
    assignee_name: 'Fixture User J',
    inspection_mode: 'deferred',
    inspection_scope: 'inspect_and_hang',
    inspection_original_checkout_date: '2026-10-23',
    deferred_inspection_merged: true,
    deferred_inspection_effective_date: mockTodayKey,
    deferred_inspection_current_day_checkout: false,
    start_time: '10am',
    end_time: '3pm',
    inspection_assignment_conflict: null,
    property: { ...base.property, code: 'FIXTURE-VISIBILITY-001' },
  }]
  mockAuthState.user = { id: `${roles[0]}-075`, username: `${roles[0]}-075`, role: roles[0], roles }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = true

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: `tasks-mz075-${roles[0]}`, name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  try {
    await waitFor(() => {
      expect(ui.getByText('是延期检查')).toBeTruthy()
      expect(ui.getByText('FIXTURE-VISIBILITY-001 入住')).toBeTruthy()
      expect(ui.queryByText('FIXTURE-VISIBILITY-001 退房 入住')).toBeNull()
      expect(ui.getByText(`原退房 2026-10-23 → 本次检查 ${mockTodayKey}`)).toBeTruthy()
      expect(ui.queryByText('检查安排冲突')).toBeNull()
    })
    expandTask(ui, `deferred-checkin-${roles[0]}`)
    await waitFor(() => expect(ui.getByText('Fixture User J')).toBeTruthy())
  } finally {
    ui.unmount()
    snapshot.items = previousItems
    mockAuthState.user = previousUser
    mockRoleState.canSwitchTaskMode = previousRoleState.canSwitchTaskMode
    mockRoleState.isTaskManagerUser = previousRoleState.isTaskManagerUser
  }
})

test('a genuinely unassigned merged card stays unassigned and an ordinary check-in has no deferred label', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousItems = snapshot.items
  const previousUser = mockAuthState.user
  const previousRoleState = { ...mockRoleState }
  const base = previousItems[0]
  snapshot.items = [
    {
      ...base,
      id: 'deferred-checkin-unassigned',
      source_type: 'cleaning_tasks',
      source_id: 'checkin-unassigned',
      source_ids: ['checkout-deferred', 'checkin-unassigned'],
      task_kind: 'inspection',
      task_type: 'checkin_clean',
      title: '未分配入住',
      scheduled_date: mockTodayKey,
      status: 'pending',
      assignee_id: null,
      inspector_id: null,
      assignee_name: null,
      inspection_mode: 'pending_decision',
      inspection_scope: 'inspect_and_hang',
      inspection_original_checkout_date: '2026-10-23',
      deferred_inspection_merged: true,
      deferred_inspection_effective_date: mockTodayKey,
      deferred_inspection_current_day_checkout: false,
      start_time: '10am',
      end_time: '3pm',
      property: { ...base.property, code: 'UNASSIGNED' },
    },
    {
      ...base,
      id: 'ordinary-checkin',
      source_type: 'cleaning_tasks',
      source_id: 'ordinary-checkin-source',
      source_ids: ['ordinary-checkin-source'],
      task_kind: 'inspection',
      task_type: 'checkin_clean',
      title: '普通入住',
      scheduled_date: mockTodayKey,
      status: 'assigned',
      assignee_id: 'mia-id',
      assignee_name: 'Fixture User J',
      inspection_mode: 'same_day',
      inspection_scope: 'inspect_and_hang',
      inspection_original_checkout_date: null,
      deferred_inspection_merged: false,
      deferred_inspection_effective_date: null,
      property: { ...base.property, code: 'ORDINARY' },
    },
  ]
  mockAuthState.user = { id: 'admin-mz075-boundaries', username: 'admin-mz075-boundaries', role: 'admin', roles: ['admin'] }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = true

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-mz075-boundaries', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  try {
    await waitFor(() => {
      expect(ui.getByText('是延期检查')).toBeTruthy()
      expect(ui.getByText('未分配')).toBeTruthy()
      expect(ui.getByLabelText('task-card-ordinary-checkin')).toBeTruthy()
    })
    expect(ui.getAllByText('是延期检查')).toHaveLength(1)
  } finally {
    ui.unmount()
    snapshot.items = previousItems
    mockAuthState.user = previousUser
    mockRoleState.canSwitchTaskMode = previousRoleState.canSwitchTaskMode
    mockRoleState.isTaskManagerUser = previousRoleState.isTaskManagerUser
  }
})

test('manager keeps FIXTURE-DEFERRED-001 reopened overdue inspection separate from the current turnover', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousItems = snapshot.items.slice()
  const previousUser = mockAuthState.user
  const previousRoleState = { ...mockRoleState }
  mockAuthState.user = { id: 'jt-id', username: 'JT', role: 'customer_service', roles: ['customer_service'] }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = true
  snapshot.items = [
    {
      ...previousItems[0],
      id: 'fixture-deferred-001-current',
      source_id: 'fixture-deferred-001-current-checkout',
      source_ids: ['fixture-deferred-001-current-checkout'],
      task_kind: 'inspection',
      task_type: 'checkout_clean',
      inspection_mode: 'same_day',
      inspection_due_date: null,
      inspection_original_checkout_date: null,
      scheduled_date: mockTodayKey,
      start_time: '10am',
      end_time: null,
      status: 'assigned',
      assignee_id: 'oscar-id',
      inspector_id: 'oscar-id',
      inspector_name: 'Fixture User E',
      cleaner_name: 'Fixture User I',
      lockbox_video_url: null,
      property_id: 'fixture-deferred-001-property',
      property: { ...previousItems[0].property, id: 'fixture-deferred-001-property', code: 'FIXTURE-DEFERRED-001', region: 'Southbank' },
      date: mockTodayKey,
    },
    {
      ...previousItems[0],
      id: 'fixture-deferred-001-overdue',
      source_id: 'fixture-deferred-001-deferred-2026-10-11',
      source_ids: ['fixture-deferred-001-deferred-2026-10-11'],
      task_kind: 'inspection',
      task_type: 'checkout_clean',
      inspection_mode: 'deferred',
      inspection_due_date: '2026-10-13',
      inspection_original_checkout_date: null,
      scheduled_date: mockTodayKey,
      start_time: '10am',
      end_time: null,
      status: 'assigned',
      assignee_id: 'angela-id',
      inspector_id: 'angela-id',
      inspector_name: 'Fixture User D',
      cleaner_name: 'Fixture User I',
      key_photo_url: 'https://example.invalid/historical-key.jpg',
      lockbox_video_url: 'https://example.invalid/historical-lockbox.mp4',
      property_id: 'fixture-deferred-001-property',
      property: { ...previousItems[0].property, id: 'fixture-deferred-001-property', code: 'FIXTURE-DEFERRED-001', region: 'Southbank' },
      date: mockTodayKey,
    },
  ]

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-fixture-deferred-001-source-isolation', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText('FIXTURE-DEFERRED-001 退房')).toBeTruthy()
    expect(ui.getByText('FIXTURE-DEFERRED-001 延期检查')).toBeTruthy()
    expect(ui.getAllByText('已分配')).toHaveLength(2)
    expect(ui.queryByText('已挂钥匙')).toBeNull()
  })

  expandTask(ui, 'fixture-deferred-001-current')
  expandTask(ui, 'fixture-deferred-001-overdue')
  await waitFor(() => {
    expect(ui.getByText('Fixture User E')).toBeTruthy()
    expect(ui.getByText('Fixture User D')).toBeTruthy()
  })

  ui.unmount()
  snapshot.items = previousItems
  mockAuthState.user = previousUser
  mockRoleState.canSwitchTaskMode = previousRoleState.canSwitchTaskMode
  mockRoleState.isTaskManagerUser = previousRoleState.isTaskManagerUser
})

test('FIXTURE-KEY-001-style pending finalization shows key handover fact and separate missing-material notice', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousItems = snapshot.items.slice()
  const previousUser = mockAuthState.user
  const previousRoleState = { ...mockRoleState }
  mockAuthState.user = { id: 'manager-1', username: 'Manager', role: 'admin', roles: ['admin'] }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = true
  snapshot.items = [{
    ...previousItems[0],
    id: 'fixture-key-001-current',
    source_id: 'fixture-key-001-checkout',
    source_ids: ['fixture-key-001-checkout'],
    task_kind: 'inspection',
    task_type: 'checkout_clean',
    status: 'in_progress',
    cleaning_status: 'in_progress',
    inspection_status: 'in_progress',
    cleaning_submission_ready: false,
    lockbox_video_url: 'https://example.invalid/fixture-key-001-lockbox.mp4',
    key_handover: {
      state: 'completed',
      source_task_id: 'fixture-key-001-checkout',
      completed_at: '2026-10-20T02:32:15.623Z',
      workflow_finalization_pending: true,
      missing_requirements: ['cleaning_consumables', 'cleaning_property_photo'],
    },
    property_id: 'fixture-key-001-property',
    property: { ...previousItems[0].property, id: 'fixture-key-001-property', code: 'FIXTURE-KEY-001', region: 'Southbank' },
    scheduled_date: mockTodayKey,
    date: mockTodayKey,
  }]

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-fixture-key-001-key-fact', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  try {
    await waitFor(() => {
      expect(ui.getByText('已挂钥匙')).toBeTruthy()
      expect(ui.getByText('挂钥匙已完成')).toBeTruthy()
      expect(ui.getByText('资料待补：补品记录、房源照片')).toBeTruthy()
    })
  } finally {
    ui.unmount()
    snapshot.items = previousItems
    mockAuthState.user = previousUser
    mockRoleState.canSwitchTaskMode = previousRoleState.canSwitchTaskMode
    mockRoleState.isTaskManagerUser = previousRoleState.isTaskManagerUser
  }
})

test('manager keeps separate readonly change records for the same property and stable task key', async () => {
  // Match this test file's existing late-bound mocked-module pattern.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const store = jest.requireMock('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousItems = snapshot.items.slice()
  const previousUser = mockAuthState.user
  const previousRoleState = { ...mockRoleState }
  const base = previousItems[0]
  mockAuthState.user = { id: 'admin-history', username: 'admin-history', role: 'admin', roles: ['admin', 'cleaner'] }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = true
  snapshot.items = [
    {
      ...base,
      id: 'record-reassigned',
      source_id: 'same-cleaning-source',
      daily_stats_key: `turnover:${mockTodayKey}:same-property`,
      work_record_visible: true,
      work_record_read_only: true,
      work_record_state: 'reassigned',
      work_record_date: mockTodayKey,
      original_scheduled_date: mockTodayKey,
      scheduled_date: mockTodayKey,
      status: 'assigned',
      date: mockTodayKey,
    },
    {
      ...base,
      id: 'record-rescheduled',
      source_id: 'same-cleaning-source',
      daily_stats_key: `turnover:${mockTodayKey}:same-property`,
      work_record_visible: true,
      work_record_read_only: true,
      work_record_state: 'rescheduled',
      work_record_date: mockTodayKey,
      original_scheduled_date: mockTodayKey,
      rescheduled_to_date: '2026-10-14',
      scheduled_date: mockTodayKey,
      status: 'assigned',
      date: mockTodayKey,
    },
  ]

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const TasksScreen = jest.requireActual('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-manager-work-record-events', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  try {
    await waitFor(() => {
      expect(ui.getByLabelText('task-card-record-reassigned')).toBeTruthy()
      expect(ui.getByLabelText('task-card-record-rescheduled')).toBeTruthy()
      expect(ui.getByText('已改派')).toBeTruthy()
      expect(ui.getByText('延期至10-14')).toBeTruthy()
      expect(ui.getByText('历史 2')).toBeTruthy()
    })
  } finally {
    ui.unmount()
    snapshot.items = previousItems
    mockAuthState.user = previousUser
    mockRoleState.canSwitchTaskMode = previousRoleState.canSwitchTaskMode
    mockRoleState.isTaskManagerUser = previousRoleState.isTaskManagerUser
  }
})

test('task list keeps the immutable completion record instead of a duplicate live card', async () => {
  const store = jest.requireMock('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousItems = snapshot.items.slice()
  const previousUser = mockAuthState.user
  const previousRoleState = { ...mockRoleState }
  const base = previousItems[0]
  const currentId = `cleaning_tasks_cleaner_turnover:${mockTodayKey}:p1:u1`
  mockAuthState.user = { id: 'admin-history', username: 'admin-history', role: 'admin', roles: ['admin', 'cleaner'] }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = true
  snapshot.items = [
    {
      ...base,
      id: currentId,
      source_id: 'checkout-duplicate',
      source_ids: ['checkout-duplicate', 'checkin-duplicate'],
      active_source_ids: ['checkout-duplicate', 'checkin-duplicate'],
      order_id_checkout: 'order-out-duplicate',
      order_id_checkin: 'order-in-duplicate',
      task_kind: 'cleaning',
      execution_role: 'cleaning',
      execution_list_visible: true,
      daily_stats_group: 'turnover',
      daily_stats_key: `turnover:${mockTodayKey}:p1`,
      scheduled_date: mockTodayKey,
      status: 'assigned',
      date: mockTodayKey,
    },
    {
      ...base,
      id: `${currentId}::record:completed:${mockTodayKey}`,
      source_id: 'checkout-duplicate',
      source_ids: ['checkout-duplicate', 'checkin-duplicate'],
      active_source_ids: ['checkout-duplicate', 'checkin-duplicate'],
      order_id_checkout: 'order-out-duplicate',
      order_id_checkin: 'order-in-duplicate',
      task_kind: 'cleaning',
      execution_role: 'cleaning',
      execution_list_visible: false,
      work_record_visible: true,
      work_record_read_only: true,
      work_record_state: 'completed',
      work_record_date: mockTodayKey,
      original_scheduled_date: mockTodayKey,
      counts_as_active_task: false,
      scheduled_date: mockTodayKey,
      status: 'completed',
      date: mockTodayKey,
    },
  ]

  const TasksScreen = jest.requireActual('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-terminal-record-reconciliation', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  try {
    await waitFor(() => {
      expect(ui.queryByLabelText(`task-card-${currentId}`)).toBeNull()
      expect(ui.getByLabelText(`task-card-${currentId}::record:completed:${mockTodayKey}`)).toBeTruthy()
      expect(ui.getByText('入住＋退房 0 · 线下 0')).toBeTruthy()
      expect(ui.getByText('在办 0 · 完成 1')).toBeTruthy()
    })
  } finally {
    ui.unmount()
    snapshot.items = previousItems
    mockAuthState.user = previousUser
    mockRoleState.canSwitchTaskMode = previousRoleState.canSwitchTaskMode
    mockRoleState.isTaskManagerUser = previousRoleState.isTaskManagerUser
  }
})

test('task list preserves a prior-day current projection while bucketing a genuine later record separately', async () => {
  const store = jest.requireMock('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousItems = snapshot.items.slice()
  const previousUser = mockAuthState.user
  const previousRoleState = { ...mockRoleState }
  const base = previousItems[0]
  const previousDate = mockTodayKey
  const completionDate = '2026-10-13'
  const currentId = `cleaning_tasks_cleaner_turnover:${previousDate}:p1:u1`
  mockAuthState.user = { id: 'admin-cross-day-history', username: 'admin-cross-day-history', role: 'admin', roles: ['admin', 'cleaner'] }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = true
  snapshot.items = [
    {
      ...base,
      id: currentId,
      source_id: 'checkout-cross-day',
      source_ids: ['checkout-cross-day', 'checkin-cross-day'],
      active_source_ids: ['checkout-cross-day', 'checkin-cross-day'],
      task_kind: 'cleaning',
      execution_role: 'cleaning',
      execution_list_visible: true,
      daily_stats_group: 'turnover',
      daily_stats_key: `turnover:${previousDate}:p1`,
      scheduled_date: previousDate,
      status: 'assigned',
      date: previousDate,
    },
    {
      ...base,
      id: `${currentId}::record:completed:${completionDate}`,
      source_id: 'checkout-cross-day',
      source_ids: ['checkout-cross-day', 'checkin-cross-day'],
      active_source_ids: ['checkout-cross-day', 'checkin-cross-day'],
      task_kind: 'cleaning',
      execution_role: 'cleaning',
      execution_list_visible: false,
      work_record_visible: true,
      work_record_read_only: true,
      work_record_state: 'completed',
      work_record_date: completionDate,
      original_scheduled_date: previousDate,
      counts_as_active_task: false,
      scheduled_date: previousDate,
      status: 'completed',
      date: completionDate,
    },
  ]

  const TasksScreen = jest.requireActual('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-cross-day-terminal-record-reconciliation', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  try {
    await waitFor(() => {
      expect(ui.getByLabelText(`task-card-${currentId}`)).toBeTruthy()
      expect(ui.queryByLabelText(`task-card-${currentId}::record:completed:${completionDate}`)).toBeNull()
      expect(ui.getByText('在办 1 · 完成 0')).toBeTruthy()
    })

    fireEvent.press(ui.getByText('13'))

    await waitFor(() => {
      expect(ui.queryByLabelText(`task-card-${currentId}`)).toBeNull()
      expect(ui.getByLabelText(`task-card-${currentId}::record:completed:${completionDate}`)).toBeTruthy()
      expect(ui.getByText('在办 0 · 完成 1')).toBeTruthy()
    })
  } finally {
    ui.unmount()
    snapshot.items = previousItems
    mockAuthState.user = previousUser
    mockRoleState.canSwitchTaskMode = previousRoleState.canSwitchTaskMode
    mockRoleState.isTaskManagerUser = previousRoleState.isTaskManagerUser
  }
})

test('manager keeps two FIXTURE-SOURCES-001 tasks that share a property and order but have different sources', async () => {
  const store = jest.requireMock('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousItems = snapshot.items.slice()
  const previousUser = mockAuthState.user
  const previousRoleState = { ...mockRoleState }
  const base = previousItems[0]
  mockAuthState.user = { id: 'admin-FIXTURE-SOURCES-001', username: 'admin-FIXTURE-SOURCES-001', role: 'admin', roles: ['admin', 'cleaner'] }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = true
  snapshot.items = [
    {
      ...base,
      id: 'FIXTURE-SOURCES-001-cleaning-a',
      source_id: 'FIXTURE-SOURCES-001-source-a',
      source_ids: ['FIXTURE-SOURCES-001-source-a'],
      order_id_checkout: 'FIXTURE-SOURCES-001-shared-order',
      property_id: 'property-FIXTURE-SOURCES-001',
      property: { ...base.property, id: 'property-FIXTURE-SOURCES-001', code: 'FIXTURE-SOURCES-001' },
      execution_list_visible: true,
      daily_stats_group: 'turnover',
      daily_stats_key: `turnover:${mockTodayKey}:property-FIXTURE-SOURCES-001`,
      scheduled_date: mockTodayKey,
      status: 'assigned',
      date: mockTodayKey,
    },
    {
      ...base,
      id: 'FIXTURE-SOURCES-001-cleaning-b',
      source_id: 'FIXTURE-SOURCES-001-source-b',
      source_ids: ['FIXTURE-SOURCES-001-source-b'],
      order_id_checkout: 'FIXTURE-SOURCES-001-shared-order',
      property_id: 'property-FIXTURE-SOURCES-001',
      property: { ...base.property, id: 'property-FIXTURE-SOURCES-001', code: 'FIXTURE-SOURCES-001' },
      execution_list_visible: true,
      daily_stats_group: 'turnover',
      daily_stats_key: `turnover:${mockTodayKey}:property-FIXTURE-SOURCES-001`,
      scheduled_date: mockTodayKey,
      status: 'assigned',
      date: mockTodayKey,
    },
  ]

  const TasksScreen = jest.requireActual('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-FIXTURE-SOURCES-001-distinct-sources', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  try {
    await waitFor(() => {
      expect(ui.getByLabelText('task-card-FIXTURE-SOURCES-001-cleaning-a')).toBeTruthy()
      expect(ui.getByLabelText('task-card-FIXTURE-SOURCES-001-cleaning-b')).toBeTruthy()
      expect(ui.getByText('入住＋退房 2 · 线下 0')).toBeTruthy()
      expect(ui.getByText('在办 2 · 完成 0')).toBeTruthy()
    })
  } finally {
    ui.unmount()
    snapshot.items = previousItems
    mockAuthState.user = previousUser
    mockRoleState.canSwitchTaskMode = previousRoleState.canSwitchTaskMode
    mockRoleState.isTaskManagerUser = previousRoleState.isTaskManagerUser
  }
})

test('cancelled work history is absent from the mobile task list and totals', async () => {
  const store = jest.requireMock('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousItems = snapshot.items.slice()
  const base = previousItems[0]
  snapshot.items = [
    {
      ...base,
      id: 'completed-history',
      source_id: 'completed-history-source',
      status: 'completed',
      scheduled_date: mockTodayKey,
      date: mockTodayKey,
    },
    {
      ...base,
      id: 'cancelled-history',
      source_id: 'cancelled-history-source',
      status: 'cancelled',
      work_record_visible: true,
      work_record_read_only: true,
      work_record_state: 'cancelled',
      work_record_date: mockTodayKey,
      scheduled_date: mockTodayKey,
      date: mockTodayKey,
    },
  ]

  const TasksScreen = jest.requireActual('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-cancelled-history-bottom', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  try {
    await waitFor(() => {
      expect(ui.getByText('历史 1')).toBeTruthy()
      expect(ui.getByText('在办 0 · 完成 1')).toBeTruthy()
      expect(ui.queryByText(/取消历史/)).toBeNull()
      expect(ui.queryByLabelText('task-card-cancelled-history')).toBeNull()
    })
    const taskCardLabels = ui.getAllByRole('button')
      .map((node) => String(node.props.accessibilityLabel || ''))
      .filter((label) => label.startsWith('task-card-'))
    expect(taskCardLabels).toEqual(['task-card-completed-history'])
  } finally {
    ui.unmount()
    snapshot.items = previousItems
  }
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
        id: 'mark_guest_checkout',
        label: '标记已退房',
        placement: 'primary',
        enabled: true,
        target: 'TaskDetail',
        intent: 'manager',
        source_id: 'checkout-source',
      },
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
    task_type: 'turnover',
    order_id_checkout: 'checkout-source',
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
    expect(ui.queryByText('FIXTURE_WIFI_NAME')).toBeNull()
    expect(ui.queryByText('NOT_A_REAL_PASSWORD')).toBeNull()
    expect(ui.getByText('展开')).toBeTruthy()
  })
  fireEvent.press(ui.getByLabelText('task-collapse-w1'))

  await waitFor(() => {
    expect(ui.getByText('FIXTURE_WIFI_NAME')).toBeTruthy()
    expect(ui.getByText('NOT_A_REAL_PASSWORD')).toBeTruthy()
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

test('customer service keeps the original manager editor when an outside-key action is available', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousTask = { ...snapshot.items[0] }
  const previousUser = mockAuthState.user
  const previousRoleState = { ...mockRoleState }
  mockAuthState.user = { id: 'cs-outside-key', username: 'customer-service', role: 'customer_service', roles: ['customer_service'] }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = true
  snapshot.items[0] = {
    ...snapshot.items[0],
    task_kind: 'cleaning',
    task_type: 'turnover',
    source_type: 'cleaning_tasks',
    guest_ready_outside_key: {
      order_id: 'checkin-order',
      required: false,
      registered_at: null,
      registered_by_user_id: null,
      registered_by_name: null,
      version: 0,
    },
    available_actions: [
      {
        id: 'register_guest_ready_outside_key',
        label: '登记钥匙外挂',
        placement: 'more',
        enabled: true,
        target: 'TaskDetail',
        intent: 'manager',
        source_id: 'checkin-order',
      },
    ],
  }
  const navigation = { navigate: jest.fn(), addListener: jest.fn(() => () => {}) }

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={navigation as any}
        route={{ key: 'tasks-customer-service-outside-key', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByLabelText('task-card-w1')).toBeTruthy())
  fireEvent.press(ui.getByLabelText('task-card-w1'))

  expect(navigation.navigate).toHaveBeenCalledWith('ManagerDailyTask', { taskId: 'w1' })
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

test('completed key-handover card still exposes the exact order-bound guest-notified action', async () => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousTask = { ...snapshot.items[0] }
  const previousUser = mockAuthState.user
  const previousRoleState = { ...mockRoleState }
  mockAuthState.user = { id: 'cs-completed', username: 'customer-service', role: 'customer_service', roles: ['customer_service'] }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = true
  snapshot.items[0] = {
    ...previousTask,
    task_kind: 'execution',
    task_type: 'checkin_clean',
    source_type: 'cleaning_tasks',
    source_id: 'checkin-source',
    status: 'done',
    order_id_checkin: 'checkin-order-1',
    work_record_visible: true,
    work_record_read_only: true,
    work_record_state: 'completed',
    read_only_views: { guest_context: true },
    available_actions: [
      { id: 'record_guest_ready_notified', label: '已通知客人', placement: 'primary', enabled: true, target: 'TaskDetail', intent: 'manager', source_type: 'orders', source_id: 'checkin-order-1' },
      { id: 'report_issue', label: '问题反馈', placement: 'more', enabled: true, target: 'FeedbackForm', intent: 'issue', source_type: 'cleaning_tasks', source_id: 'checkin-source' },
    ],
  }

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-completed-key-handover', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  try {
    await waitFor(() => expect(ui.getByLabelText('task-collapse-w1')).toBeTruthy())
    expandTask(ui, 'w1')
    await waitFor(() => expect(ui.getByTestId('task-action-w1-record_guest_ready_notified')).toBeTruthy())
    expect(ui.queryByTestId('task-action-w1-report_issue')).toBeNull()
  } finally {
    ui.unmount()
    snapshot.items[0] = previousTask
    mockAuthState.user = previousUser
    mockRoleState.canSwitchTaskMode = previousRoleState.canSwitchTaskMode
    mockRoleState.isTaskManagerUser = previousRoleState.isTaskManagerUser
  }
})

test('customer-service merged task card submits the guest-checkout action source ID instead of its top-level source', async () => {
  const store = require('../../lib/workTasksStore')
  const api = require('../../lib/api')
  const snapshot = store.getWorkTasksSnapshot()
  const patchWorkTaskItemMock = store.patchWorkTaskItem as jest.Mock
  const previousTask = { ...snapshot.items[0] }
  const previousUser = mockAuthState.user
  const previousPatchImplementation = patchWorkTaskItemMock.getMockImplementation()
  const markGuestCheckedOutByTasksMock = api.markGuestCheckedOutByTasks as jest.Mock
  mockAuthState.user = { id: 'cs-checkout-source', username: 'customer-service', role: 'customer_service', roles: ['customer_service'] }
  snapshot.items[0] = {
    ...previousTask,
    task_type: 'turnover',
    task_kind: 'cleaning',
    source_type: 'cleaning_tasks',
    source_id: 'checkin-source',
    order_id_checkout: 'checkout-order',
    checked_out_at: null,
    available_actions: [
      { id: 'mark_guest_checkout', label: '标记已退房', placement: 'primary', enabled: true, target: 'TaskDetail', intent: 'manager', source_id: 'checkout-source' },
    ],
  }
  patchWorkTaskItemMock.mockImplementation(async (id: string, patch: any) => {
    const task = snapshot.items.find((item: any) => item.id === id)
    if (task) Object.assign(task, patch)
  })
  markGuestCheckedOutByTasksMock.mockClear()

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-merged-checkout-source', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByLabelText('task-collapse-w1')).toBeTruthy())
  expandTask(ui, 'w1')
  await waitFor(() => expect(ui.getByTestId('task-action-w1-mark_guest_checkout')).toBeTruthy())
  fireEvent.press(ui.getByTestId('task-action-w1-mark_guest_checkout'))

  await waitFor(() => {
    expect(markGuestCheckedOutByTasksMock).toHaveBeenCalledWith('local:test', {
      task_ids: ['checkout-source'],
      action: 'set',
    })
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
    expect(ui.queryByText('FIXTURE_WIFI_NAME')).toBeNull()
    expect(ui.queryByText('NOT_A_REAL_PASSWORD')).toBeNull()
  })

  snapshotRestoreForRoleTest()

  function snapshotRestoreForRoleTest() {
    mockAuthState.user = previousUser
    mockRoleState.canSwitchTaskMode = previousRoleState.canSwitchTaskMode
    mockRoleState.isTaskManagerUser = previousRoleState.isTaskManagerUser
  }
})

test.each([
  ['admin', ['admin']],
  ['offline manager', ['offline_manager']],
  ['customer service', ['customer_service']],
])('manager turnover card keeps the explicit self-complete tag for %s when the canonical representative is inspection', async (_label, roles) => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousItems = snapshot.items
  const previousUser = mockAuthState.user
  const previousRoleState = { ...mockRoleState }
  const base = previousItems[0]

  snapshot.items = [{
    ...base,
    id: `la910-self-complete-${roles[0]}`,
    source_type: 'cleaning_tasks',
    source_id: 'la910-checkout',
    source_ids: ['la910-checkout', 'la910-inspection'],
    cleaning_task_ids: ['la910-checkout'],
    inspection_task_ids: ['la910-inspection'],
    task_kind: 'inspection',
    task_type: 'turnover',
    title: 'LA910',
    inspection_mode: 'self_complete',
    inspection_scope: null,
    status: 'assigned',
    property: { ...base.property, code: 'LA910' },
  }]
  mockAuthState.user = { id: `${roles[0]}-la910`, username: `${roles[0]}-la910`, role: roles[0], roles }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = true

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: `tasks-la910-self-complete-${roles[0]}`, name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  try {
    await waitFor(() => {
      expect(ui.getByLabelText(`task-card-la910-self-complete-${roles[0]}`)).toBeTruthy()
      expect(ui.getByText('自完成')).toBeTruthy()
    })
  } finally {
    ui.unmount()
    snapshot.items = previousItems
    mockAuthState.user = previousUser
    mockRoleState.canSwitchTaskMode = previousRoleState.canSwitchTaskMode
    mockRoleState.isTaskManagerUser = previousRoleState.isTaskManagerUser
  }
})

test.each([
  ['ordinary inspection', 'turnover', 'same_day', 'inspect_and_hang'],
  ['password-only inspection', 'checkin_clean', 'self_complete', 'password_only'],
  ['inspection-representative stayover', 'stayover_clean', null, 'inspect_and_hang'],
])('%s cards are not mislabeled as self-complete', async (_label, taskType, inspectionMode, inspectionScope) => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousItems = snapshot.items
  const base = previousItems[0]

  snapshot.items = [{
    ...base,
    id: `non-self-complete-${taskType}`,
    source_type: 'cleaning_tasks',
    source_id: `non-self-complete-${taskType}-source`,
    task_kind: 'inspection',
    task_type: taskType,
    title: `非自完成 ${taskType}`,
    inspection_mode: inspectionMode,
    inspection_scope: inspectionScope,
    status: 'assigned',
  }]

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-ordinary-inspection-mode', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  try {
    await waitFor(() => expect(ui.getByLabelText(`task-card-non-self-complete-${taskType}`)).toBeTruthy())
    expect(ui.queryByText('自完成')).toBeNull()
  } finally {
    ui.unmount()
    snapshot.items = previousItems
  }
})

test.each([
  ['admin', ['admin']],
  ['offline manager', ['offline_manager']],
  ['customer service', ['customer_service']],
])('daily execution list applies the server visibility projection for %s', async (_label, roles) => {
  const store = require('../../lib/workTasksStore')
  const snapshot = store.getWorkTasksSnapshot()
  const previousItems = snapshot.items
  const previousUser = mockAuthState.user
  const previousRoleState = { ...mockRoleState }
  const base = previousItems[0]

  snapshot.items = [
    {
      ...base,
      id: 'maintenance-assigned-visible',
      source_type: 'property_maintenance',
      source_id: 'maintenance-assigned-visible',
      task_kind: 'maintenance',
      title: '已安排维修',
      status: 'assigned',
      source_workflow_status: 'assigned',
      assignee_id: 'staff-1',
      execution_list_visible: true,
    },
    {
      ...base,
      id: 'offline-done-visible',
      source_type: 'cleaning_offline_tasks',
      source_id: 'offline-done-visible',
      task_kind: 'offline',
      title: '当日已完成线下任务',
      status: 'done',
      assignee_id: 'staff-2',
      execution_list_visible: true,
    },
    {
      ...base,
      id: 'turnover-unassigned-visible',
      source_type: 'cleaning_tasks',
      source_id: 'turnover-unassigned-visible',
      task_kind: 'cleaning',
      task_type: 'turnover',
      title: '未分配周转任务',
      status: 'ready',
      assignee_id: null,
      cleaner_id: null,
      inspector_id: null,
      execution_list_visible: true,
    },
    {
      ...base,
      id: 'maintenance-review-hidden',
      source_type: 'property_maintenance',
      source_id: 'maintenance-review-hidden',
      task_kind: 'maintenance',
      title: '待审核维修',
      status: 'pending_review',
      assignee_id: 'staff-1',
      execution_list_visible: false,
    },
    {
      ...base,
      id: 'maintenance-closed-hidden',
      source_type: 'property_maintenance',
      source_id: 'maintenance-closed-hidden',
      task_kind: 'maintenance',
      title: '已关闭维修',
      status: 'done',
      source_workflow_status: 'closed',
      assignee_id: 'staff-1',
      execution_list_visible: false,
    },
    {
      ...base,
      id: 'necessities-unassigned-hidden',
      source_type: 'property_daily_necessities',
      source_id: 'necessities-unassigned-hidden',
      task_kind: 'daily_necessities',
      title: '未分配日用品任务',
      status: 'todo',
      assignee_id: null,
      execution_list_visible: false,
    },
  ]
  mockAuthState.user = { id: 'role-test', username: 'role-test', role: roles[0], roles }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = true

  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: `daily-execution-${roles[0]}`, name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByLabelText('task-card-maintenance-assigned-visible')).toBeTruthy()
    expect(ui.getByLabelText('task-card-offline-done-visible')).toBeTruthy()
    expect(ui.getByLabelText('task-card-turnover-unassigned-visible')).toBeTruthy()
    expect(ui.queryByLabelText('task-card-maintenance-review-hidden')).toBeNull()
    expect(ui.queryByLabelText('task-card-maintenance-closed-hidden')).toBeNull()
    expect(ui.queryByLabelText('task-card-necessities-unassigned-hidden')).toBeNull()
  })

  ui.unmount()
  snapshot.items = previousItems
  mockAuthState.user = previousUser
  mockRoleState.canSwitchTaskMode = previousRoleState.canSwitchTaskMode
  mockRoleState.isTaskManagerUser = previousRoleState.isTaskManagerUser
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
      title: 'FIXTURE-MAINT-001',
      summary: '洗碗机排水不正常',
      scheduled_date: mockTodayKey,
      start_time: '',
      end_time: '',
      assignee_id: 'u1',
      assignee_name: 'Fixture User G',
      status: 'assigned',
      urgency: 'medium',
      property: {
        id: 'p-maintenance',
        code: 'FIXTURE-MAINT-001',
        region: 'Melbourne',
        address: '1 Example Maintenance Road, Testville',
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
    expect(ui.getByText('Fixture User G')).toBeTruthy()
    expect(ui.getByText('房源地址')).toBeTruthy()
  })

  const rendered = flattenRenderedText(ui.toJSON()).join('\n')
  expect(rendered.indexOf('洗碗机排水不正常')).toBeLessThan(rendered.indexOf('执行人员'))
  expect(rendered.indexOf('执行人员')).toBeLessThan(rendered.indexOf('1 Example Maintenance Road, Testville'))

  snapshot.items = previousItems
})

test('manager-only user can switch between 全部 and 我的 without being forced back to 全部', async () => {
  mockAuthState.user = { id: 'u1', username: 'tester', role: 'admin', roles: ['admin', 'offline_manager'] }
  mockRoleState.canSwitchTaskMode = false
  mockRoleState.isTaskManagerUser = true
  const store = require('../../lib/workTasksStore')
  const refreshMock = store.requestWorkTasksRefresh as jest.Mock
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
      inspector_name: 'Fixture Inspector F',
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
      cleaner_name: 'Fixture User H',
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
      inspector_name: 'Fixture Inspector H',
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
    expect(adminUi.getByText('Fixture User H')).toBeTruthy()
    expect(adminUi.getByText('Fixture Inspector H')).toBeTruthy()
    expect(adminUi.getByText('清洁 0/1 · 进行中 MQ101')).toBeTruthy()
    expect(adminUi.getByText('检查 1/1 · 已完成 MQ101')).toBeTruthy()
    expect(adminUi.getByText('Fixture Inspector F')).toBeTruthy()
    expect(adminUi.getAllByText('检查 0/1 · 待处理 1').length).toBeGreaterThan(0)
    expect(adminUi.queryByText('检查 1/1 · 进行中 MQ101')).toBeNull()
    expect(adminUi.queryByText('清洁 + 检查')).toBeNull()
    const rendered = flattenRenderedText(adminUi.toJSON()).join('\n')
    expect(rendered.indexOf('清洁A')).toBeGreaterThanOrEqual(0)
    expect(rendered.indexOf('检查B')).toBeGreaterThanOrEqual(0)
    expect(rendered.indexOf('Fixture Inspector F')).toBeGreaterThanOrEqual(0)
    expect(rendered.indexOf('Fixture User H')).toBeGreaterThanOrEqual(0)
    expect(rendered.indexOf('Fixture Inspector H')).toBeGreaterThanOrEqual(0)
    expect(rendered.indexOf('清洁A')).toBeLessThan(rendered.indexOf('Fixture Inspector F'))
    expect(rendered.indexOf('清洁A')).toBeLessThan(rendered.indexOf('检查B'))
    expect(rendered.indexOf('Fixture User H')).toBeLessThan(rendered.indexOf('Fixture Inspector H'))
    expect(rendered.indexOf('Fixture User H')).toBeLessThan(rendered.indexOf('检查B'))
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
    actor_name: 'Fixture User A',
    created_at: new Date(2026, 6, 28, 9, 5).toISOString(),
  }, referenceDate)).toBe('Fixture User A借出 09:05')
  expect(formatWarehouseKeyLatestEvent({
    action: 'borrow',
    actor_name: 'Fixture User B',
    created_at: new Date(2026, 6, 27, 19, 45).toISOString(),
  }, referenceDate)).toBe('昨天 Fixture User B借出 19:45')
  expect(formatWarehouseKeyLatestEvent({
    action: 'return',
    actor_name: 'Fixture User C',
    created_at: new Date(2026, 6, 26, 8, 6).toISOString(),
  }, referenceDate)).toBe('2026-07-26 Fixture User C归还 08:06')
})

test('today week strip follows the selected Melbourne business date across a Monday boundary', () => {
  const { taskWeekDateKeys } = require('./TasksScreen') as typeof import('./TasksScreen')

  expect(taskWeekDateKeys('2026-10-05')).toEqual([
    '2026-10-05',
    '2026-10-06',
    '2026-10-07',
    '2026-10-08',
    '2026-10-09',
    '2026-10-10',
    '2026-10-11',
  ])
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
        code: 'FIXTURE-WAREHOUSE-001',
        region: 'Southbank',
        address: '2 Example Warehouse Road, Testville',
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
