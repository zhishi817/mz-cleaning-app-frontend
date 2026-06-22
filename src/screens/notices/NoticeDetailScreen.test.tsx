import React from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { render, waitFor } from '@testing-library/react-native'
import { Image } from 'react-native'
import { I18nProvider } from '../../lib/i18n'
import { initNoticesStore, NOTICES_STORAGE_KEY, upsertNotices } from '../../lib/noticesStore'
import NoticeDetailScreen from './NoticeDetailScreen'

jest.mock('../../lib/workTasksStore', () => ({
  findWorkTaskItemByAnyId: jest.fn(() => null),
  findWorkTaskItemByAnyIds: jest.fn(() => null),
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
