import React from 'react'
import { StyleSheet } from 'react-native'
import { render } from '@testing-library/react-native'
import AppButton from './AppButton'

describe('AppButton', () => {
  it('uses the standard 44pt minimum height and shared horizontal padding', () => {
    const screen = render(<AppButton label="提交" onPress={() => undefined} />)
    const button = screen.getByRole('button')
    const style = StyleSheet.flatten(button.props.style)

    expect(style).toEqual(expect.objectContaining({
      minHeight: 44,
      paddingHorizontal: 16,
      paddingVertical: 0,
      borderRadius: 12,
    }))
  })

  it('supports compact visual height without changing the button contract API', () => {
    const screen = render(<AppButton label="筛选" size="compact" onPress={() => undefined} />)
    const button = screen.getByRole('button')
    const style = StyleSheet.flatten(button.props.style)

    expect(style).toEqual(expect.objectContaining({ minHeight: 36 }))
  })

  it('keeps the original label layout and disables repeat presses while loading', () => {
    const screen = render(<AppButton label="提交检查结果" loading onPress={() => undefined} />)
    const button = screen.getByRole('button')

    expect(screen.getByText('提交检查结果')).toBeTruthy()
    expect(button.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true, busy: true }))
  })
})
