import React from 'react'
import { AppState, Text } from 'react-native'
import { render } from '@testing-library/react-native'
import { DevPreviewActivityBoundary } from './DevPreviewActivityBoundary'

jest.mock('../config/env', () => ({
  API_BASE_URL: 'https://api.example.com',
  DEV_PREVIEW_ACTIVITY_ENABLED: false,
}))

describe('DevPreviewActivityBoundary outside fixed Preview', () => {
  it('does not wrap the App, subscribe to AppState, or report activity', () => {
    const addEventListener = jest.spyOn(AppState, 'addEventListener')
    ;(globalThis as any).fetch = jest.fn()

    const screen = render(
      <DevPreviewActivityBoundary><Text>child</Text></DevPreviewActivityBoundary>,
    )

    expect(screen.getByText('child')).toBeTruthy()
    expect(screen.queryByTestId('dev-preview-activity-boundary')).toBeNull()
    expect(addEventListener).not.toHaveBeenCalled()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
