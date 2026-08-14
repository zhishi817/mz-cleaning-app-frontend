import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { I18nProvider } from '../../lib/i18n'

const mockNavigate = jest.fn()
let mockNoticeItems: any[] = []

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
  getNoticesSnapshot: () => ({ items: mockNoticeItems, unreadIds: {}, readIds: {}, updatedAt: null }),
  initNoticesStore: jest.fn(async () => {}),
  markNoticeRead: jest.fn(async () => {}),
  refreshNotices: jest.fn(async () => {}),
  subscribeNotices: () => () => {},
}))

jest.mock('../../components/CleaningMediaImage', () => {
  const mockReact = require('react')
  const mockView = require('react-native').View
  return (props: any) => mockReact.createElement(mockView, {
    testID: props.testID || 'cleaning-media-image',
    accessibilityLabel: JSON.stringify({ guestLuggageId: props.guestLuggageId || null, accessTaskId: props.accessTaskId || null }),
  })
})

jest.mock('../../lib/roles', () => ({
  isTaskInspectorUser: () => false,
  isTaskManagerUser: () => false,
  roleNamesOf: (user: any) => Array.isArray(user?.roles) ? user.roles : [user?.role].filter(Boolean),
}))

jest.mock('../../lib/workTasksStore', () => ({
  findWorkTaskItemByAnyId: () => null,
  findWorkTaskItemByAnyIds: () => null,
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

test('temporary-notice thumbnails keep the saved notice id for authenticated media reads', async () => {
  mockNoticeItems = [{
    id: '4a0dbea0-cbaf-4eef-87ec-2f4bb038703e',
    type: 'update',
    title: '当天任务临时通知：TEST01',
    summary: '请勿移动客人物品',
    content: '请勿移动客人物品',
    createdAt: '2026-08-14T00:00:00.000Z',
    images: ['mzapp/guest-luggage.jpg'],
    data: {
      kind: 'guest_luggage_updated',
      guest_luggage_id: '4a0dbea0-cbaf-4eef-87ec-2f4bb038703e',
      photo_urls: ['mzapp/guest-luggage.jpg'],
    },
  }]

  const ui = renderScreen()
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })

  await waitFor(() => expect(ui.getByTestId('guest-luggage-notice-thumbnail')).toBeTruthy())
  expect(JSON.parse(ui.getByTestId('guest-luggage-notice-thumbnail').props.accessibilityLabel)).toEqual({ guestLuggageId: '4a0dbea0-cbaf-4eef-87ec-2f4bb038703e', accessTaskId: null })
  mockNoticeItems = []
})

test('keys-hung thumbnail keeps the Inbox task id for authenticated media reads', async () => {
  mockNoticeItems = [{
    id: 'keys-hung-1',
    type: 'update',
    title: 'TEST01 · 房间已挂钥匙',
    summary: '挂钥匙视频已上传，房间钥匙已挂好',
    content: '挂钥匙视频已上传，房间钥匙已挂好',
    createdAt: '2026-08-15T00:00:00.000Z',
    images: ['cleaning/inspection-photo.jpg'],
    data: {
      kind: 'keys_hung',
      task_id: 'cleaning-task-1',
      photo_urls: ['cleaning/inspection-photo.jpg'],
    },
  }]

  const ui = renderScreen()
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })

  await waitFor(() => expect(ui.getByTestId('keys-hung-notice-thumbnail')).toBeTruthy())
  expect(JSON.parse(ui.getByTestId('keys-hung-notice-thumbnail').props.accessibilityLabel)).toEqual({ guestLuggageId: null, accessTaskId: 'cleaning-task-1' })
  mockNoticeItems = []
})

test('keys-hung thumbnail does not render private media without a string task id', async () => {
  mockNoticeItems = [{
    id: 'keys-hung-missing-task-id',
    type: 'update',
    title: 'TEST02 · 房间已挂钥匙',
    summary: '挂钥匙视频已上传，房间钥匙已挂好',
    content: '挂钥匙视频已上传，房间钥匙已挂好',
    createdAt: '2026-08-15T00:00:00.000Z',
    images: ['cleaning/inspection-photo.jpg'],
    data: {
      kind: 'keys_hung',
      task_id: { id: 'cleaning-task-1' },
      photo_urls: ['cleaning/inspection-photo.jpg'],
    },
  }]

  const ui = renderScreen()
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })

  await waitFor(() => expect(ui.getByText('房间已挂钥匙')).toBeTruthy())
  expect(ui.queryByTestId('keys-hung-notice-thumbnail')).toBeNull()
  mockNoticeItems = []
})

test('temporary-notice thumbnails do not render private media when the notice id is missing', async () => {
  mockNoticeItems = [{
    id: 'guest-luggage-missing-id',
    type: 'update',
    title: '当天任务临时通知：TEST02',
    summary: '请勿移动客人物品',
    content: '请勿移动客人物品',
    createdAt: '2026-08-14T00:00:00.000Z',
    images: ['mzapp/guest-luggage.jpg'],
    data: {
      kind: 'guest_luggage_updated',
      photo_urls: ['mzapp/guest-luggage.jpg'],
    },
  }]

  const ui = renderScreen()
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })

  await waitFor(() => expect(ui.getByText('当天临时通知')).toBeTruthy())
  expect(ui.queryByTestId('guest-luggage-notice-thumbnail')).toBeNull()
  mockNoticeItems = []
})

test('temporary-notice thumbnails do not render private media when the notice id is invalid', async () => {
  mockNoticeItems = [{
    id: 'guest-luggage-invalid-id',
    type: 'update',
    title: '当天任务临时通知：TEST03',
    summary: '请勿移动客人物品',
    content: '请勿移动客人物品',
    createdAt: '2026-08-14T00:00:00.000Z',
    images: ['mzapp/guest-luggage.jpg'],
    data: {
      kind: 'guest_luggage_updated',
      guest_luggage_id: { id: '4a0dbea0-cbaf-4eef-87ec-2f4bb038703e' },
      photo_urls: ['mzapp/guest-luggage.jpg'],
    },
  }]

  const ui = renderScreen()
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })

  await waitFor(() => expect(ui.getByText('当天临时通知')).toBeTruthy())
  expect(ui.queryByTestId('guest-luggage-notice-thumbnail')).toBeNull()
  mockNoticeItems = []
})
