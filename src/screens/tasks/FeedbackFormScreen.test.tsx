import React from 'react'
import { Alert, StyleSheet } from 'react-native'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { I18nProvider } from '../../lib/i18n'

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

jest.mock('expo-image-picker', () => ({
  MediaType: { IMAGE: 'images' },
}))

jest.mock('../../lib/auth', () => ({
  useAuth: () => ({ token: 'token-1', user: { id: 'u1', role: 'cleaner', roles: ['cleaner'] } }),
}))

jest.mock('../../lib/storage', () => ({
  getJson: jest.fn(async () => null),
  remove: jest.fn(async () => {}),
  setJson: jest.fn(async () => {}),
}))

jest.mock('../../lib/inspectionPanelFeedbackDraft', () => ({
  clearInspectionPanelFeedbackDraft: jest.fn(async () => {}),
  getInspectionPanelFeedbackDraft: jest.fn(async () => null),
  setInspectionPanelFeedbackDraft: jest.fn(async () => {}),
}))

jest.mock('../../lib/workTasksStore', () => ({
  getWorkTasksSnapshot: () => ({
    items: [{
      id: 'work-task-1',
      source_id: 'cleaning-task-1',
      source_type: 'cleaning_tasks',
      task_kind: 'cleaning',
      property_id: 'property-1',
      property: { id: 'property-1', code: 'MZ001' },
    }],
  }),
}))

jest.mock('../../components/CleaningMediaImage', () => {
  const React = require('react')
  const { View } = require('react-native')
  return (props: any) => React.createElement(View, {
    testID: `feedback-media-${String(props.remoteReference || '')}`,
    accessibilityLabel: String(props.accessTaskId || ''),
  })
})

jest.mock('../../components/CleaningMediaPreview', () => {
  const React = require('react')
  const { View } = require('react-native')
  return (props: any) => React.createElement(View, {
    testID: 'feedback-media-preview',
    accessibilityLabel: String(props.accessTaskId || ''),
  })
})

jest.mock('../../lib/api', () => {
  const actual = jest.requireActual('../../lib/api')
  const feedback = {
    id: 'feedback-1',
    kind: 'maintenance',
    status: 'open',
    title: '水龙头漏水',
    property_id: 'property-1',
    property_code: 'MZ001',
    completion_photo_urls: ['maintenance/completion.jpg'],
    media_urls: [],
    repair_photo_urls: [],
    project_items: [],
  }
  return {
    ...actual,
    createPropertyFeedbackBatch: jest.fn(async () => [{ ok: true, response: { id: 'created-feedback-1' } }]),
    listDailyNecessityOptions: jest.fn(async () => []),
    listPropertyFeedbacks: jest.fn(async () => [feedback]),
  }
})

test('maintenance feedback completion media is rendered through the current source task context', async () => {
  const FeedbackFormScreen = require('./FeedbackFormScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <FeedbackFormScreen
        navigation={{ goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn(), setParams: jest.fn() } as any}
        route={{ key: 'feedback', name: 'FeedbackForm', params: { taskId: 'work-task-1' } } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByTestId('feedback-media-maintenance/completion.jpg').props.accessibilityLabel).toBe('cleaning-task-1')
  })
})

test('feedback cards keep text and thumbnail on the first row, with actions on a second row', async () => {
  const FeedbackFormScreen = require('./FeedbackFormScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <FeedbackFormScreen
        navigation={{ goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn(), setParams: jest.fn() } as any}
        route={{ key: 'feedback-layout', name: 'FeedbackForm', params: { taskId: 'work-task-1' } } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByTestId('feedback-card-primary-row-feedback-1')).toBeTruthy()
    expect(ui.getByTestId('feedback-card-actions-feedback-1')).toBeTruthy()
  })
  fireEvent.press(ui.getAllByText('房源维修')[0])
  await waitFor(() => expect(ui.getByTestId('feedback-photo-upload-actions')).toBeTruthy())

  expect(StyleSheet.flatten(ui.getByTestId('feedback-card-primary-row-feedback-1').props.style)).toEqual(expect.objectContaining({ flexDirection: 'row' }))
  expect(StyleSheet.flatten(ui.getByTestId('feedback-card-actions-feedback-1').props.style)).toEqual(expect.objectContaining({ width: '100%', marginTop: 10 }))
  expect(StyleSheet.flatten(ui.getAllByTestId('feedback-photo-upload-actions')[0].props.style)).toEqual(expect.objectContaining({ width: '100%', justifyContent: 'center' }))
  expect(ui.getAllByTestId('feedback-photo-upload-camera')[0].props.style).toEqual(expect.arrayContaining([expect.objectContaining({ flex: 1, minWidth: 44, alignItems: 'center', justifyContent: 'center' })]))
  expect(ui.getAllByTestId('feedback-photo-upload-library')[0].props.style).toEqual(expect.arrayContaining([expect.objectContaining({ flex: 1, minWidth: 44, alignItems: 'center', justifyContent: 'center' })]))
})

test('feedback submission uses the source cleaning task id and keeps the server failure reason', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  const api = require('../../lib/api')
  api.createPropertyFeedbackBatch.mockResolvedValueOnce([{ ok: false, error: 'source_task_id must reference cleaning_tasks' }])
  const FeedbackFormScreen = require('./FeedbackFormScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <FeedbackFormScreen
        navigation={{ goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn(), setParams: jest.fn() } as any}
        route={{ key: 'feedback-submit', name: 'FeedbackForm', params: { taskId: 'work-task-1' } } as any}
      />
    </I18nProvider>,
  )

  fireEvent.press(ui.getAllByText('房源维修')[0])
  await waitFor(() => expect(ui.getByText('维修记录 1')).toBeTruthy())
  fireEvent.press(ui.getByText('客厅'))
  fireEvent.changeText(ui.getByPlaceholderText('请描述问题'), '水龙头漏水')
  fireEvent.press(ui.getByText('提交记录'))

  await waitFor(() => {
    expect(api.createPropertyFeedbackBatch).toHaveBeenCalledWith('token-1', [expect.objectContaining({
      kind: 'maintenance',
      source_task_id: 'cleaning-task-1',
    })])
    expect(alert).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('source_task_id must reference cleaning_tasks'))
  })
  alert.mockRestore()
})
