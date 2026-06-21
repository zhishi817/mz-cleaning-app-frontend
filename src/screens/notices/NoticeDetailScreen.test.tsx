import React from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { render, waitFor } from '@testing-library/react-native'
import { I18nProvider } from '../../lib/i18n'
import { NOTICES_STORAGE_KEY } from '../../lib/noticesStore'
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
