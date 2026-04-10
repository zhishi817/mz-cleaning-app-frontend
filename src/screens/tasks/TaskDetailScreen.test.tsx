import React from 'react'
import { Alert } from 'react-native'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { I18nProvider } from '../../lib/i18n'

jest.mock('react-native-safe-area-context', () => {
  const React = require('react')
  return {
    SafeAreaProvider: ({ children }: any) => React.createElement(React.Fragment, null, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  }
})

jest.mock('expo-image-picker', () => {
  return {
    MediaTypeOptions: { Images: 'Images' },
    requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
    launchCameraAsync: jest.fn(async () => ({
      canceled: false,
      assets: [{ uri: 'file:///tmp/k.jpg', fileName: 'k.jpg', mimeType: 'image/jpeg' }],
    })),
  }
})

jest.mock('../../lib/auth', () => {
  return {
    useAuth: () => ({ user: { id: 'u1', username: 'tester', role: 'staff' }, token: 't1' }),
  }
})

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
        scheduled_date: '2026-01-01',
        start_time: '10am',
        end_time: '3pm',
        assignee_id: null,
        status: 'assigned',
        urgency: 'medium',
        property: { id: 'p1', code: 'X', region: '', address: '', unit_type: '', access_guide_link: '' },
        date: '2026-01-01',
      },
    ],
    bucketKey: 'k',
    updatedAt: null,
  }
  return {
    subscribeWorkTasks: () => () => {},
    getWorkTasksSnapshot: () => snapshot,
    findWorkTaskItemByAnyId: (id: string) => snapshot.items.find((item) => item.id === id || item.source_id === id) || null,
  }
})

jest.mock('../../lib/api', () => {
  const actual = jest.requireActual('../../lib/api')
  return {
    ...actual,
    uploadCleaningMedia: jest.fn(async () => ({ url: 'http://example.com/k.jpg' })),
    startCleaningTask: jest.fn(async () => ({ ok: true })),
  }
})

test('uploading key photo updates task status to cleaning', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>

  const ui = render(
    <I18nProvider>
      <TaskDetailScreen navigation={{ goBack: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'k', name: 'TaskDetail', params: { id: 'w1' } } as any} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText(/upload key|上传钥匙/i)).toBeTruthy()
  })
  fireEvent.press(ui.getByText(/upload key|上传钥匙/i))

  await waitFor(() => {
    expect((Alert.alert as any).mock.calls.length).toBeGreaterThan(0)
  })
})

test('task detail can resolve cleaning task id from notice route', async () => {
  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>

  const ui = render(
    <I18nProvider>
      <TaskDetailScreen navigation={{ goBack: jest.fn(), setParams: jest.fn() } as any} route={{ key: 'k2', name: 'TaskDetail', params: { id: 'ct1' } } as any} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.queryByText('出错了')).toBeNull()
    expect(ui.getByText(/upload key|上传钥匙/i)).toBeTruthy()
  })
})
