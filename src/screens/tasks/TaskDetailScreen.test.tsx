import React from 'react'
import { Alert } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { I18nProvider } from '../../lib/i18n'

jest.mock('../../lib/auth', () => {
  return {
    useAuth: () => ({ user: { username: 'tester', role: 'staff' } }),
  }
})

test('uploading key photo updates task status to cleaning', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})

  await (AsyncStorage as any).clear()
  const tasks = require('../../lib/tasksStore') as typeof import('../../lib/tasksStore')
  await tasks.initTasksStore()
  const id = tasks.getTasksSnapshot().items[0]!.id

  const TaskDetailScreen = require('./TaskDetailScreen').default as React.ComponentType<any>

  const ui = render(
    <I18nProvider>
      <TaskDetailScreen navigation={{} as any} route={{ key: 'k', name: 'TaskDetail', params: { id } } as any} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByLabelText('pick-key-photo')).toBeTruthy()
  })
  fireEvent.press(ui.getByLabelText('pick-key-photo'))

  await waitFor(() => {
    expect(ui.getByLabelText('confirm-upload-key')).toBeTruthy()
  })
  fireEvent.press(ui.getByLabelText('confirm-upload-key'))

  await waitFor(() => {
    expect(ui.getByText('清洁中')).toBeTruthy()
  })
})
