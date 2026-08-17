import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { Alert } from 'react-native'
import { I18nProvider } from '../../lib/i18n'
import { initNoticesStore, upsertNotices } from '../../lib/noticesStore'
import NoticeDetailScreen from './NoticeDetailScreen'

let mockWorkTask: any = null
const mockStoredUser: any = { id: 'admin-1', username: 'admin-user', role: 'admin', roles: ['admin', 'cleaning_inspector'] }
const mockNoticeStorage = new Map<string, unknown>()

jest.mock('../../lib/storage', () => ({
  getJson: jest.fn(async (key: string) => mockNoticeStorage.get(key) || null),
  setJson: jest.fn(async (key: string, value: unknown) => { mockNoticeStorage.set(key, value) }),
}))

jest.mock('../../lib/workTasksStore', () => ({
  findWorkTaskItemByAnyId: jest.fn(() => mockWorkTask),
  findWorkTaskItemByAnyIds: jest.fn(() => null),
  refreshWorkTasksFromServer: jest.fn(async () => {}),
}))

jest.mock('../../lib/authStorage', () => ({
  getAuthToken: jest.fn(async () => 't1'),
  getStoredUser: jest.fn(async () => mockStoredUser),
}))

jest.mock('../../components/CleaningMediaImage', () => {
  const mockReact = require('react')
  const mockView = require('react-native').View
  return (props: any) => {
    const mediaContext: any = { guestLuggageId: props.guestLuggageId || null, accessTaskId: props.accessTaskId || null }
    if (props.accessWorkTaskId || props.offlineWorkTaskMedia) {
      mediaContext.accessWorkTaskId = props.accessWorkTaskId || null
      mediaContext.offlineWorkTaskMedia = Boolean(props.offlineWorkTaskMedia)
    }
    return mockReact.createElement(mockView, {
      testID: props.testID || 'cleaning-media-image',
      accessibilityLabel: JSON.stringify(mediaContext),
    })
  }
})

jest.mock('../../components/CleaningMediaPreview', () => {
  const mockReact = require('react')
  const mockView = require('react-native').View
  return (props: any) => {
    const mediaContext: any = { guestLuggageId: props.guestLuggageId || null, accessTaskId: props.accessTaskId || null }
    if (props.accessWorkTaskId || props.offlineWorkTaskMedia) {
      mediaContext.accessWorkTaskId = props.accessWorkTaskId || null
      mediaContext.offlineWorkTaskMedia = Boolean(props.offlineWorkTaskMedia)
    }
    return mockReact.createElement(mockView, {
      testID: props.testID || 'cleaning-media-preview',
      accessibilityLabel: JSON.stringify(mediaContext),
    })
  }
})

test('loads an available notice before deciding the detail is missing', async () => {
  await initNoticesStore()
  await upsertNotices([
    {
      id: 'persisted-1',
      type: 'update',
      title: '任务信息更新',
      summary: '房源信息有更新',
      content: '房源：TEST01',
      createdAt: '2026-06-15T00:00:00.000Z',
    },
  ], { replace: true })

  const ui = render(
    <I18nProvider>
      <NoticeDetailScreen
        navigation={{ setOptions: jest.fn(), canGoBack: () => true, goBack: jest.fn() } as any}
        route={{ key: 'notice', name: 'NoticeDetail', params: { id: 'persisted-1' } } as any}
      />
    </I18nProvider>,
  )
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })

  await waitFor(() => {
    expect(ui.getByText('任务信息更新')).toBeTruthy()
    expect(ui.queryByText('出错了')).toBeNull()
  })
})

test('property-feedback issue detail and preview use authenticated media without task context', async () => {
  await initNoticesStore()
  await upsertNotices([
    {
      id: 'issue-1',
      type: 'update',
      title: '房源问题反馈：维修',
      summary: '收到新的维修反馈：射灯坏一个',
      content: '收到新的维修反馈：射灯坏一个',
      createdAt: '2026-06-22T07:32:00.000Z',
      unread: true,
      data: {
        kind: 'issue_reported',
        property_code: 'Docklands CW209',
        issue_title: '维修',
        issue_detail: '射灯坏一个',
        photo_urls: ['cleaning/feedback-issue-1.jpg'],
      },
    },
  ], { replace: true })

  const ui = render(
    <I18nProvider>
      <NoticeDetailScreen
        navigation={{ setOptions: jest.fn(), canGoBack: () => true, goBack: jest.fn(), navigate: jest.fn() } as any}
        route={{ key: 'notice', name: 'NoticeDetail', params: { id: 'issue-1' } } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText('Docklands CW209 · 发现房源问题')).toBeTruthy()
    expect(ui.getByText('房源')).toBeTruthy()
    expect(ui.getByText('Docklands CW209')).toBeTruthy()
    expect(ui.getByTestId('issue-reported-notice-image')).toBeTruthy()
  })
  expect(JSON.parse(ui.getByTestId('issue-reported-notice-image').props.accessibilityLabel)).toEqual({ guestLuggageId: null, accessTaskId: null })

  fireEvent.press(ui.getByTestId('issue-reported-notice-image'))
  await waitFor(() => expect(ui.getByTestId('issue-reported-notice-preview')).toBeTruthy())
  expect(JSON.parse(ui.getByTestId('issue-reported-notice-preview').props.accessibilityLabel)).toEqual({ guestLuggageId: null, accessTaskId: null })
})

test('task-bound issue detail and preview preserve the Inbox task context', async () => {
  await initNoticesStore()
  await upsertNotices([
    {
      id: 'task-issue-1',
      type: 'update',
      title: 'TEST01 · 房源问题反馈',
      summary: '收到新的问题反馈：浴室漏水',
      content: '收到新的问题反馈：浴室漏水',
      createdAt: '2026-08-16T00:00:00.000Z',
      unread: true,
      data: {
        kind: 'issue_reported',
        task_id: 'cleaning-task-1',
        issue_title: '浴室漏水',
        photo_url: 'cleaning/task-issue-1.jpg',
      },
    },
  ], { replace: true })

  const ui = render(
    <I18nProvider>
      <NoticeDetailScreen
        navigation={{ setOptions: jest.fn(), canGoBack: () => true, goBack: jest.fn(), navigate: jest.fn() } as any}
        route={{ key: 'task-issue', name: 'NoticeDetail', params: { id: 'task-issue-1' } } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByTestId('issue-reported-notice-image')).toBeTruthy())
  expect(JSON.parse(ui.getByTestId('issue-reported-notice-image').props.accessibilityLabel)).toEqual({ guestLuggageId: null, accessTaskId: 'cleaning-task-1' })

  fireEvent.press(ui.getByTestId('issue-reported-notice-image'))
  await waitFor(() => expect(ui.getByTestId('issue-reported-notice-preview')).toBeTruthy())
  expect(JSON.parse(ui.getByTestId('issue-reported-notice-preview').props.accessibilityLabel)).toEqual({ guestLuggageId: null, accessTaskId: 'cleaning-task-1' })
})

test('temporary-notice detail and preview preserve the saved notice id', async () => {
  await initNoticesStore()
  await upsertNotices([
    {
      id: '4a0dbea0-cbaf-4eef-87ec-2f4bb038703e',
      type: 'update',
      title: '当天任务临时通知：TEST01',
      summary: '请把行李放在前台',
      content: '请把行李放在前台',
      createdAt: '2026-08-14T00:00:00.000Z',
      unread: true,
      data: {
        kind: 'guest_luggage_updated',
        guest_luggage_id: '4a0dbea0-cbaf-4eef-87ec-2f4bb038703e',
        photo_urls: ['mzapp/guest-luggage.jpg'],
      },
    },
  ], { replace: true })

  const ui = render(
    <I18nProvider>
      <NoticeDetailScreen
        navigation={{ setOptions: jest.fn(), canGoBack: () => true, goBack: jest.fn(), navigate: jest.fn() } as any}
        route={{ key: 'guest-luggage', name: 'NoticeDetail', params: { id: '4a0dbea0-cbaf-4eef-87ec-2f4bb038703e' } } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByTestId('guest-luggage-notice-image')).toBeTruthy())
  expect(JSON.parse(ui.getByTestId('guest-luggage-notice-image').props.accessibilityLabel)).toEqual({ guestLuggageId: '4a0dbea0-cbaf-4eef-87ec-2f4bb038703e', accessTaskId: null })

  fireEvent.press(ui.getByTestId('guest-luggage-notice-image'))
  await waitFor(() => expect(ui.getByTestId('guest-luggage-notice-preview')).toBeTruthy())
  expect(JSON.parse(ui.getByTestId('guest-luggage-notice-preview').props.accessibilityLabel)).toEqual({ guestLuggageId: '4a0dbea0-cbaf-4eef-87ec-2f4bb038703e', accessTaskId: null })
})

test('keys-hung detail and preview keep the Inbox task id for authenticated media reads', async () => {
  await initNoticesStore()
  await upsertNotices([
    {
      id: 'keys-hung-1',
      type: 'update',
      title: 'TEST01 · 房间已挂钥匙',
      summary: '挂钥匙视频已上传，房间钥匙已挂好',
      content: '挂钥匙视频已上传，房间钥匙已挂好',
      createdAt: '2026-08-15T00:00:00.000Z',
      unread: true,
      data: {
        kind: 'keys_hung',
        task_id: 'cleaning-task-1',
        photo_urls: ['cleaning/inspection-photo.jpg'],
      },
    },
  ], { replace: true })

  const ui = render(
    <I18nProvider>
      <NoticeDetailScreen
        navigation={{ setOptions: jest.fn(), canGoBack: () => true, goBack: jest.fn(), navigate: jest.fn() } as any}
        route={{ key: 'keys-hung', name: 'NoticeDetail', params: { id: 'keys-hung-1' } } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByTestId('key-media-notice-image')).toBeTruthy())
  expect(JSON.parse(ui.getByTestId('key-media-notice-image').props.accessibilityLabel)).toEqual({ guestLuggageId: null, accessTaskId: 'cleaning-task-1' })

  fireEvent.press(ui.getByTestId('key-media-notice-image'))
  await waitFor(() => expect(ui.getByTestId('key-media-notice-preview')).toBeTruthy())
  expect(JSON.parse(ui.getByTestId('key-media-notice-preview').props.accessibilityLabel)).toEqual({ guestLuggageId: null, accessTaskId: 'cleaning-task-1' })
})

test('key-photo-uploaded detail and preview keep the Inbox task id for authenticated media reads', async () => {
  await initNoticesStore()
  await upsertNotices([
    {
      id: 'key-photo-uploaded-1',
      type: 'key',
      title: 'TEST01 · 钥匙照片已上传',
      summary: '清洁员已上传钥匙照片',
      content: '清洁员已上传钥匙照片',
      createdAt: '2026-08-16T00:00:00.000Z',
      unread: true,
      data: {
        kind: 'key_photo_uploaded',
        task_id: 'cleaning-task-1',
        photo_url: 'cleaning/key-photo.jpg',
      },
    },
  ], { replace: true })

  const ui = render(
    <I18nProvider>
      <NoticeDetailScreen
        navigation={{ setOptions: jest.fn(), canGoBack: () => true, goBack: jest.fn(), navigate: jest.fn() } as any}
        route={{ key: 'key-photo-uploaded', name: 'NoticeDetail', params: { id: 'key-photo-uploaded-1' } } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByTestId('key-media-notice-image')).toBeTruthy())
  expect(JSON.parse(ui.getByTestId('key-media-notice-image').props.accessibilityLabel)).toEqual({ guestLuggageId: null, accessTaskId: 'cleaning-task-1' })

  fireEvent.press(ui.getByTestId('key-media-notice-image'))
  await waitFor(() => expect(ui.getByTestId('key-media-notice-preview')).toBeTruthy())
  expect(JSON.parse(ui.getByTestId('key-media-notice-preview').props.accessibilityLabel)).toEqual({ guestLuggageId: null, accessTaskId: 'cleaning-task-1' })
})

test('keys-hung detail does not render or open private media without a string task id', async () => {
  await initNoticesStore()
  await upsertNotices([
    {
      id: 'keys-hung-missing-task-id',
      type: 'update',
      title: 'TEST02 · 房间已挂钥匙',
      summary: '挂钥匙视频已上传，房间钥匙已挂好',
      content: '挂钥匙视频已上传，房间钥匙已挂好',
      createdAt: '2026-08-15T00:00:00.000Z',
      unread: true,
      data: {
        kind: 'keys_hung',
        task_id: { id: 'cleaning-task-1' },
        photo_urls: ['cleaning/inspection-photo.jpg'],
      },
    },
  ], { replace: true })

  const ui = render(
    <I18nProvider>
      <NoticeDetailScreen
        navigation={{ setOptions: jest.fn(), canGoBack: () => true, goBack: jest.fn(), navigate: jest.fn() } as any}
        route={{ key: 'keys-hung-missing-task-id', name: 'NoticeDetail', params: { id: 'keys-hung-missing-task-id' } } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByText('房间已挂钥匙')).toBeTruthy())
  expect(ui.queryByTestId('key-media-notice-image')).toBeNull()
  expect(ui.queryByTestId('key-media-notice-preview')).toBeNull()
})

test('key-photo-uploaded detail fails closed without a string task id', async () => {
  await initNoticesStore()
  await upsertNotices([
    {
      id: 'key-photo-uploaded-missing-task-id',
      type: 'key',
      title: 'TEST02 · 钥匙照片已上传',
      summary: '清洁员已上传钥匙照片',
      content: '清洁员已上传钥匙照片',
      createdAt: '2026-08-16T00:00:00.000Z',
      unread: true,
      data: {
        kind: 'key_photo_uploaded',
        task_id: { id: 'cleaning-task-1' },
        photo_url: 'cleaning/key-photo.jpg',
      },
    },
  ], { replace: true })

  const ui = render(
    <I18nProvider>
      <NoticeDetailScreen
        navigation={{ setOptions: jest.fn(), canGoBack: () => true, goBack: jest.fn(), navigate: jest.fn() } as any}
        route={{ key: 'key-photo-uploaded-missing-task-id', name: 'NoticeDetail', params: { id: 'key-photo-uploaded-missing-task-id' } } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByText('钥匙照片已上传')).toBeTruthy())
  expect(ui.queryByTestId('key-media-notice-image')).toBeNull()
  expect(ui.queryByTestId('key-media-notice-preview')).toBeNull()
})

test('consumables detail and preview keep the Inbox task id for authenticated media reads', async () => {
  await initNoticesStore()
  await upsertNotices([{
    id: 'consumables-1', type: 'update', title: 'TEST01 · 清洁已完成', summary: '待补货：卷纸 x1', content: '待补货：卷纸 x1', createdAt: '2026-08-16T00:00:00.000Z', unread: true,
    data: { kind: 'consumables_submitted', task_id: 'cleaning-task-1', photo_urls: ['cleaning/consumables-photo.jpg'] },
  }], { replace: true })

  const ui = render(
    <I18nProvider><NoticeDetailScreen navigation={{ setOptions: jest.fn(), canGoBack: () => true, goBack: jest.fn(), navigate: jest.fn() } as any} route={{ key: 'consumables', name: 'NoticeDetail', params: { id: 'consumables-1' } } as any} /></I18nProvider>,
  )

  await waitFor(() => expect(ui.getByTestId('consumables-notice-image')).toBeTruthy())
  expect(JSON.parse(ui.getByTestId('consumables-notice-image').props.accessibilityLabel)).toEqual({ guestLuggageId: null, accessTaskId: 'cleaning-task-1' })
  fireEvent.press(ui.getByTestId('consumables-notice-image'))
  await waitFor(() => expect(ui.getByTestId('consumables-notice-preview')).toBeTruthy())
  expect(JSON.parse(ui.getByTestId('consumables-notice-preview').props.accessibilityLabel)).toEqual({ guestLuggageId: null, accessTaskId: 'cleaning-task-1' })
})

test('consumables detail fails closed without a string task id', async () => {
  await initNoticesStore()
  await upsertNotices([{
    id: 'consumables-missing-task-id', type: 'update', title: 'TEST02 · 补品记录已更新', summary: '待补货：卷纸 x1', content: '待补货：卷纸 x1', createdAt: '2026-08-16T00:00:00.000Z', unread: true,
    data: { kind: 'consumables_updated', task_id: { id: 'cleaning-task-1' }, photo_urls: ['cleaning/consumables-photo.jpg'] },
  }], { replace: true })

  const ui = render(
    <I18nProvider><NoticeDetailScreen navigation={{ setOptions: jest.fn(), canGoBack: () => true, goBack: jest.fn(), navigate: jest.fn() } as any} route={{ key: 'consumables-missing-task-id', name: 'NoticeDetail', params: { id: 'consumables-missing-task-id' } } as any} /></I18nProvider>,
  )
  await waitFor(() => expect(ui.getByText('补品记录已更新')).toBeTruthy())
  expect(ui.queryByTestId('consumables-notice-image')).toBeNull()
  expect(ui.queryByTestId('consumables-notice-preview')).toBeNull()
})

test('offline work-task completion detail and preview keep the exact Inbox work task id', async () => {
  await initNoticesStore()
  await upsertNotices([{
    id: 'offline-work-task-completed-1', type: 'update', title: '收 202 密码盒，7988 · 线下任务已完成', summary: '收取密码盒', content: '收取密码盒', createdAt: '2026-08-16T07:55:00.000Z', unread: true,
    data: { kind: 'work_task_completed', task_id: 'cleaning_offline_tasks:offline-task-1', photo_urls: ['https://legacy-media.r2.dev/mzapp/offline-completion.jpg'] },
  }], { replace: true })

  const ui = render(
    <I18nProvider><NoticeDetailScreen navigation={{ setOptions: jest.fn(), canGoBack: () => true, goBack: jest.fn(), navigate: jest.fn() } as any} route={{ key: 'offline-work-task-completed', name: 'NoticeDetail', params: { id: 'offline-work-task-completed-1' } } as any} /></I18nProvider>,
  )

  await waitFor(() => expect(ui.getByTestId('offline-work-task-completed-notice-image')).toBeTruthy())
  expect(JSON.parse(ui.getByTestId('offline-work-task-completed-notice-image').props.accessibilityLabel)).toEqual({
    guestLuggageId: null, accessTaskId: null, accessWorkTaskId: 'cleaning_offline_tasks:offline-task-1', offlineWorkTaskMedia: true,
  })
  fireEvent.press(ui.getByTestId('offline-work-task-completed-notice-image'))
  await waitFor(() => expect(ui.getByTestId('offline-work-task-completed-notice-preview')).toBeTruthy())
  expect(JSON.parse(ui.getByTestId('offline-work-task-completed-notice-preview').props.accessibilityLabel)).toEqual({
    guestLuggageId: null, accessTaskId: null, accessWorkTaskId: 'cleaning_offline_tasks:offline-task-1', offlineWorkTaskMedia: true,
  })
})

test('offline work-task completion detail fails closed without an exact offline work-task id', async () => {
  await initNoticesStore()
  await upsertNotices([{
    id: 'offline-work-task-completed-missing-id', type: 'update', title: '收 202 密码盒，7988 · 线下任务已完成', summary: '收取密码盒', content: '收取密码盒', createdAt: '2026-08-16T07:55:00.000Z', unread: true,
    data: { kind: 'work_task_completed', task_id: 'work-task-1', photo_urls: ['https://legacy-media.r2.dev/mzapp/offline-completion.jpg'] },
  }], { replace: true })

  const ui = render(
    <I18nProvider><NoticeDetailScreen navigation={{ setOptions: jest.fn(), canGoBack: () => true, goBack: jest.fn(), navigate: jest.fn() } as any} route={{ key: 'offline-work-task-completed-missing-id', name: 'NoticeDetail', params: { id: 'offline-work-task-completed-missing-id' } } as any} /></I18nProvider>,
  )
  await waitFor(() => expect(ui.getByText('线下任务已完成')).toBeTruthy())
  expect(ui.queryByTestId('offline-work-task-completed-notice-image')).toBeNull()
  expect(ui.queryByTestId('offline-work-task-completed-notice-preview')).toBeNull()
})

test('temporary-notice detail does not render or open private media when the notice id is missing', async () => {
  await initNoticesStore()
  await upsertNotices([
    {
      id: 'guest-luggage-missing-id',
      type: 'update',
      title: '当天任务临时通知：TEST02',
      summary: '请把行李放在前台',
      content: '请把行李放在前台',
      createdAt: '2026-08-14T00:00:00.000Z',
      unread: true,
      data: {
        kind: 'guest_luggage_updated',
        photo_urls: ['mzapp/guest-luggage.jpg'],
      },
    },
  ], { replace: true })

  const ui = render(
    <I18nProvider>
      <NoticeDetailScreen
        navigation={{ setOptions: jest.fn(), canGoBack: () => true, goBack: jest.fn(), navigate: jest.fn() } as any}
        route={{ key: 'guest-luggage-missing-id', name: 'NoticeDetail', params: { id: 'guest-luggage-missing-id' } } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByText('当天临时通知')).toBeTruthy())
  expect(ui.queryByTestId('guest-luggage-notice-image')).toBeNull()
  expect(ui.queryByTestId('guest-luggage-notice-preview')).toBeNull()
})

test('temporary-notice detail does not render or open private media when the notice id is invalid', async () => {
  await initNoticesStore()
  await upsertNotices([
    {
      id: 'guest-luggage-invalid-id',
      type: 'update',
      title: '当天任务临时通知：TEST03',
      summary: '请把行李放在前台',
      content: '请把行李放在前台',
      createdAt: '2026-08-14T00:00:00.000Z',
      unread: true,
      data: {
        kind: 'guest_luggage_updated',
        guest_luggage_id: { id: '4a0dbea0-cbaf-4eef-87ec-2f4bb038703e' },
        photo_urls: ['mzapp/guest-luggage.jpg'],
      },
    },
  ], { replace: true })

  const ui = render(
    <I18nProvider>
      <NoticeDetailScreen
        navigation={{ setOptions: jest.fn(), canGoBack: () => true, goBack: jest.fn(), navigate: jest.fn() } as any}
        route={{ key: 'guest-luggage-invalid-id', name: 'NoticeDetail', params: { id: 'guest-luggage-invalid-id' } } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByText('当天临时通知')).toBeTruthy())
  expect(ui.queryByTestId('guest-luggage-notice-image')).toBeNull()
  expect(ui.queryByTestId('guest-luggage-notice-preview')).toBeNull()
})

test('notice task entry uses the manager detail for admin cleaning tasks', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  mockWorkTask = {
    id: 'w-disabled',
    task_kind: 'inspection',
    source_type: 'cleaning_tasks',
    source_id: 'ct-disabled',
    title: 'X 检查',
    scheduled_date: '2026-07-03',
    task_type: 'checkout_clean',
    status: 'to_inspect',
    available_actions: [
      {
        id: 'submit_inspection',
        label: '检查与补充',
        placement: 'primary',
        enabled: false,
        disabled_reason: 'not_participant',
        target: 'InspectionPanel',
        intent: 'inspection',
      },
    ],
    property: { id: 'p1', code: 'X' },
  }
  await initNoticesStore()
  await upsertNotices([
    {
      id: 'task-disabled-1',
      type: 'update',
      title: '检查任务提醒',
      summary: '请处理检查任务',
      content: '房源：X',
      createdAt: '2026-07-03T00:00:00.000Z',
      unread: true,
      data: {
        kind: 'inspect',
        task_id: 'w-disabled',
        date: '2026-07-03',
      },
    },
  ], { replace: true })
  const navigation = { setOptions: jest.fn(), canGoBack: () => true, goBack: jest.fn(), navigate: jest.fn() }

  const ui = render(
    <I18nProvider>
      <NoticeDetailScreen
        navigation={navigation as any}
        route={{ key: 'notice-disabled', name: 'NoticeDetail', params: { id: 'task-disabled-1' } } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText('查看任务')).toBeTruthy()
  })

  fireEvent.press(ui.getByText('查看任务'))

  await waitFor(() => {
    expect(navigation.navigate).toHaveBeenCalledWith('ManagerDailyTask', { taskId: 'w-disabled' })
  })
  expect(Alert.alert).not.toHaveBeenCalledWith('暂不可操作', '你已不再是执行人')
  expect(navigation.navigate).not.toHaveBeenCalledWith('TaskDetail', { id: 'w-disabled' })

  mockWorkTask = null
})
