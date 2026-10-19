import React from 'react'
import { StyleSheet, Text } from 'react-native'
import { render } from '@testing-library/react-native'
import AppIconButton, { APP_ICON_BUTTON_TOUCH_SIZE, APP_ICON_BUTTON_VISUAL_SIZE } from './AppIconButton'

describe('AppIconButton', () => {
  it('keeps the touch frame at 44pt and the visual frame at 40pt', () => {
    const screen = render(
      <AppIconButton accessibilityLabel="关闭" onPress={() => undefined}>
        <Text>×</Text>
      </AppIconButton>,
    )
    const button = screen.getByRole('button')
    const touchStyle = StyleSheet.flatten(button.props.style)

    expect(touchStyle).toEqual(expect.objectContaining({ width: APP_ICON_BUTTON_TOUCH_SIZE, height: APP_ICON_BUTTON_TOUCH_SIZE }))
    expect(APP_ICON_BUTTON_TOUCH_SIZE).toBe(44)
    expect(APP_ICON_BUTTON_VISUAL_SIZE).toBe(40)
  })
})
