import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { I18nProvider } from '../../lib/i18n'

const mockNavigate = jest.fn()

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}))

jest.mock('../../lib/auth', () => ({
  useAuth: () => ({
    status: 'signedIn',
    token: 'local:test',
    user: { id: 'u1', username: 'tester', role: 'cleaner', roles: ['cleaner'] },
  }),
}))

jest.mock('../../lib/api', () => ({
  listCompanySecretsForApp: jest.fn(async () => [
    {
      id: 'secret-1',
      title: '883 Locker 14号',
      property_codes: ['831606', '831402'],
      property_ids: ['p-831606', 'p-831402'],
      secret_kind: 'locker',
      box_number: '',
      location: '前台对面的locker箱',
      note: '备用钥匙',
      status: 'active',
      secret: '2468',
      has_key: true,
      updated_at: '2026-07-13T08:00:00.000Z',
    },
  ]),
  listCompanyAnnouncementsForApp: jest.fn(async () => []),
  listCompanyDocsForApp: jest.fn(async () => []),
  listCustomerServiceManualsForApp: jest.fn(async () => []),
  listWarehouseGuidesForApp: jest.fn(async () => []),
  listWorkTasks: jest.fn(async () => []),
  markInboxNotificationsRead: jest.fn(async () => ({})),
}))

jest.mock('../../lib/notificationInbox', () => ({
  syncInboxNotifications: jest.fn(async () => ({ nextCursor: null })),
}))

jest.mock('../../lib/noticesStore', () => ({
  getNoticesSnapshot: () => ({ items: [], unreadIds: {}, readIds: {}, updatedAt: null }),
  initNoticesStore: jest.fn(async () => {}),
  markNoticeRead: jest.fn(async () => {}),
  refreshNotices: jest.fn(async () => {}),
  subscribeNotices: () => () => {},
}))

jest.mock('../../lib/roles', () => ({
  isTaskInspectorUser: () => false,
  isTaskManagerUser: () => false,
  roleNamesOf: (user: any) => Array.isArray(user?.roles) ? user.roles : [user?.role].filter(Boolean),
}))

jest.mock('../../lib/workTasksStore', () => ({
  getWorkTasksSnapshot: () => ({
    items: [
      {
        id: 'task-1',
        property: {
          id: 'p-831402',
          code: '831402',
          address: '883 Collins Street, Docklands',
          wifi_ssid: 'TP-Link',
          wifi_password: 'wifi-123',
          access_guide_link: '',
        },
      },
    ],
  }),
  subscribeWorkTasks: () => () => {},
}))

function renderScreen() {
  const NoticesScreen = require('./NoticesScreen').default as React.ComponentType<any>
  return render(
    <I18nProvider>
      <NoticesScreen
        navigation={{ navigate: mockNavigate, addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'notices', name: 'NoticesList' } as any}
      />
    </I18nProvider>,
  )
}

test('information center search shows offline passwords without copy action', async () => {
  mockNavigate.mockClear()
  const ui = renderScreen()

  fireEvent.changeText(
    ui.getByPlaceholderText('输入关键词搜索房源、线下密码、历史任务、公司文档、仓库指南、公告...'),
    '883',
  )

  await waitFor(() => {
    expect(ui.getByText('线下密码')).toBeTruthy()
    expect(ui.getByText('883 Locker 14号')).toBeTruthy()
    expect(ui.getByText(/密码：2468/)).toBeTruthy()
  })

  fireEvent.press(ui.getByText('883 Locker 14号'))

  expect(mockNavigate).toHaveBeenCalledWith('InfoCenterDetail', expect.objectContaining({
    kind: 'secret',
    title: '883 Locker 14号',
    copyText: null,
    secretId: 'secret-1',
  }))
}, 10000)
