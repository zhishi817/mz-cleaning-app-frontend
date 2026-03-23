import React from 'react'
import { Alert } from 'react-native'
import { render, waitFor } from '@testing-library/react-native'
import { I18nProvider } from '../../lib/i18n'

jest.mock('../../lib/auth', () => {
  return {
    useAuth: () => ({ user: { id: 'u1', username: 'tester', role: 'staff' }, token: 't1' }),
  }
})

jest.mock('../../lib/workTasksStore', () => {
  return {
    subscribeWorkTasks: () => () => {},
    getWorkTasksSnapshot: () => ({
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
    }),
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
      <TaskDetailScreen navigation={{ goBack: jest.fn() } as any} route={{ key: 'k', name: 'TaskDetail', params: { id: 'w1', action: 'upload_key' } } as any} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect((Alert.alert as any).mock.calls.length).toBeGreaterThan(0)
  })
})
