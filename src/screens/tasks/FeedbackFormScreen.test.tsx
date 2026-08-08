import React from 'react'
import { render, waitFor } from '@testing-library/react-native'
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
