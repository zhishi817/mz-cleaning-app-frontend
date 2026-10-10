import React from 'react'
import { Text, AppState } from 'react-native'
import { act, fireEvent, render } from '@testing-library/react-native'
import { buildDevPreviewActivityUrl, DevPreviewActivityBoundary } from './DevPreviewActivityBoundary'

jest.mock('../config/env', () => ({
  API_BASE_URL: 'http://192.168.50.248:4002',
  DEV_PREVIEW_ACTIVITY_ENABLED: true,
}))

describe('DevPreviewActivityBoundary', () => {
  let appStateListener: ((state: string) => void) | null = null
  let now = 10_000

  beforeEach(() => {
    now = 10_000
    jest.spyOn(Date, 'now').mockImplementation(() => now)
    ;(globalThis as any).fetch = jest.fn().mockResolvedValue({ ok: true })
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event: any, listener: any) => {
      appStateListener = listener
      return { remove: jest.fn() } as any
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    appStateListener = null
  })

  it('builds the Preview-only activity endpoint without changing the API base', () => {
    expect(buildDevPreviewActivityUrl('http://192.168.50.248:4002/')).toBe('http://192.168.50.248:4002/health/dev-preview-activity')
  })

  it('reports mount, debounced touches, and foreground activation without a timer heartbeat', async () => {
    const screen = render(
      <DevPreviewActivityBoundary><Text>child</Text></DevPreviewActivityBoundary>,
    )
    await act(async () => undefined)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)

    fireEvent(screen.getByTestId('dev-preview-activity-boundary'), 'touchStart')
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)

    now += 5_000
    fireEvent(screen.getByTestId('dev-preview-activity-boundary'), 'touchStart')
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)

    now += 5_000
    act(() => appStateListener?.('background'))
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    act(() => appStateListener?.('active'))
    expect(globalThis.fetch).toHaveBeenCalledTimes(3)
  })
})
