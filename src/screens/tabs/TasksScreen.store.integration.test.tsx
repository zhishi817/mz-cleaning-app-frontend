import React from 'react'
import { render, waitFor } from '@testing-library/react-native'
import { I18nProvider } from '../../lib/i18n'

jest.mock('react-native-safe-area-context', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    SafeAreaView: (props: any) => React.createElement(View, props),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  }
})
jest.mock('../../components/GuestLuggageCard', () => () => null)
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => {}) }))
jest.mock('react-native-sse', () => jest.fn().mockImplementation(() => ({
  addEventListener: jest.fn(),
  removeAllEventListeners: jest.fn(),
  close: jest.fn(),
})))

const fixedDate = '2026-10-20'
const authState = {
  status: 'signedIn',
  token: 'local:integration',
  user: { id: 'integration-user', username: 'tester', role: 'cleaner', roles: ['cleaner'], permissions: [] },
}

jest.mock('../../lib/taskBusinessDate', () => {
  const actual = jest.requireActual('../../lib/taskBusinessDate') as typeof import('../../lib/taskBusinessDate')
  return {
    ...actual,
    taskBusinessDateKey: () => fixedDate,
    millisecondsUntilNextTaskBusinessDate: () => 60_000,
  }
})
jest.mock('../../lib/auth', () => ({ useAuth: () => authState }))
jest.mock('../../lib/storage', () => ({ getJson: jest.fn(), setJson: jest.fn(async () => {}) }))
jest.mock('../../lib/api', () => ({
  createCleaningOfflineTask: jest.fn(async () => ({})),
  createManualCleaningTask: jest.fn(async () => ({})),
  listCleaningAppPropertyCodes: jest.fn(async () => []),
  listUsers: jest.fn(async () => []),
  listWorkTasks: jest.fn(),
  reorderMixedWorkTasks: jest.fn(async () => ({})),
  markGuestCheckedOutByOrder: jest.fn(async () => ({})),
  markGuestCheckedOutByTasks: jest.fn(async () => ({})),
  listMzappAlerts: jest.fn(async () => []),
  markMzappAlertRead: jest.fn(async () => ({})),
  getMyProfile: jest.fn(async () => ({ username: 'tester', avatar_url: null })),
  listDayEndHandover: jest.fn(async () => []),
  createWarehouseKeyEvent: jest.fn(async () => ({})),
  getWarehouseKeyStatus: jest.fn(async () => null),
}))
jest.mock('../../lib/dayEndHandoverQueue', () => ({ processDayEndHandoverQueue: jest.fn(async () => {}) }))
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

test('the screen follows actual store readiness from pending hydration through cached render', async () => {
  const storage = require('../../lib/storage')
  const api = require('../../lib/api')
  const store = require('../../lib/workTasksStore') as typeof import('../../lib/workTasksStore')
  const TasksScreen = require('./TasksScreen').default as React.ComponentType<any>
  const projectionKey = store.makeWorkTasksProjectionKey({
    roles: ['cleaner'],
    permissions: [],
    activeRole: 'cleaner',
    view: 'mine',
  })
  let releaseCache!: (value: any) => void
  let releaseNetwork!: (value: any[]) => void
  storage.getJson.mockImplementationOnce(() => new Promise((resolve: (value: any) => void) => {
    releaseCache = resolve
  }))
  api.listWorkTasks.mockImplementationOnce(() => new Promise((resolve: (value: any[]) => void) => {
    releaseNetwork = resolve
  }))
  store.establishWorkTasksSession({ token: authState.token, userId: authState.user.id })

  const ui = render(
    <I18nProvider>
      <TasksScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'tasks-real-store-readiness', name: 'TasksList' } as any}
      />
    </I18nProvider>,
  )

  try {
    await waitFor(() => expect(ui.getByText('加载中…')).toBeTruthy())
    expect(store.getWorkTasksSnapshot().ready).toBe(false)
    releaseCache({
      projectionKey,
      ready: true,
      items: [{
        id: 'real-store-task',
        task_kind: 'cleaning',
        source_type: 'cleaning_tasks',
        source_id: 'real-store-source',
        property_id: 'property-1',
        title: '真实 Store 缓存任务',
        summary: null,
        scheduled_date: fixedDate,
        status: 'assigned',
        urgency: 'medium',
        date: fixedDate,
        assignee_id: authState.user.id,
        property: { id: 'property-1', code: '801', address: 'Test address' },
      }],
      updatedAt: '2026-10-20T01:00:00.000Z',
      lastFullSyncTimestamp: '2026-10-20T01:00:00.000Z',
      lastReceivedEventId: null,
      dirtyBuckets: {},
    })

    await waitFor(() => expect(ui.getByLabelText('task-collapse-real-store-task')).toBeTruthy())
    expect(ui.queryByText('加载中…')).toBeNull()
    expect(store.getWorkTasksSnapshot()).toMatchObject({ projectionKey, ready: true })
  } finally {
    ui.unmount()
    releaseNetwork?.([])
    store.deactivateWorkTasksRealtime()
  }
})
