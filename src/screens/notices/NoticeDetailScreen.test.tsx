import React from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { Alert, Image } from 'react-native'
import { I18nProvider } from '../../lib/i18n'
import { initNoticesStore, NOTICES_STORAGE_KEY, upsertNotices } from '../../lib/noticesStore'
import NoticeDetailScreen from './NoticeDetailScreen'

let mockWorkTask: any = null
const mockStoredUser: any = { id: 'admin-1', username: 'admin-user', role: 'admin', roles: ['admin', 'cleaning_inspector'] }

jest.mock('../../lib/workTasksStore', () => ({
  findWorkTaskItemByAnyId: jest.fn(() => mockWorkTask),
  findWorkTaskItemByAnyIds: jest.fn(() => null),
  refreshWorkTasksFromServer: jest.fn(async () => {}),
}))

jest.mock('../../lib/authStorage', () => ({
  getAuthToken: jest.fn(async () => 't1'),
  getStoredUser: jest.fn(async () => mockStoredUser),
}))

test('loads a persisted notice before deciding the detail is missing', async () => {
  await AsyncStorage.setItem(
    NOTICES_STORAGE_KEY,
    JSON.stringify({
      items: [
        {
          id: 'persisted-1',
          type: 'update',
          title: '任务信息更新',
          summary: '房源信息有更新',
          content: '房源：TEST01',
          createdAt: '2026-06-15T00:00:00.000Z',
        },
      ],
      unreadIds: { 'persisted-1': true },
      readIds: {},
    }),
  )

  const ui = render(
    <I18nProvider>
      <NoticeDetailScreen
        navigation={{ setOptions: jest.fn(), canGoBack: () => true, goBack: jest.fn() } as any}
        route={{ key: 'notice', name: 'NoticeDetail', params: { id: 'persisted-1' } } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText('任务信息更新')).toBeTruthy()
    expect(ui.queryByText('出错了')).toBeNull()
  })
})

test('issue notice detail shows property code and photos', async () => {
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
        photo_urls: ['https://example.com/issue-1.jpg'],
      },
    },
  ], { replace: true })

  const ui = render(
    <I18nProvider>
      <NoticeDetailScreen
        navigation={{ setOptions: jest.fn(), canGoBack: () => true, goBack: jest.fn() } as any}
        route={{ key: 'notice', name: 'NoticeDetail', params: { id: 'issue-1' } } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText('Docklands CW209 · 发现房源问题')).toBeTruthy()
    expect(ui.getByText('房源')).toBeTruthy()
    expect(ui.getByText('Docklands CW209')).toBeTruthy()
    expect(ui.UNSAFE_getAllByType(Image).length).toBeGreaterThan(0)
  })
})

test('notice task entry does not bypass disabled server action for privileged roles', async () => {
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
    expect(Alert.alert).toHaveBeenCalledWith('暂不可操作', '你已不再是执行人')
    expect(navigation.navigate).toHaveBeenCalledWith('TaskDetail', { id: 'w-disabled' })
  })
  expect(navigation.navigate).not.toHaveBeenCalledWith('InspectionPanel', { taskId: 'w-disabled' })
  expect(navigation.navigate).not.toHaveBeenCalledWith('InspectionComplete', expect.anything())

  mockWorkTask = null
})
