import React, { type ReactNode } from 'react'
import { Pressable, type PressableProps, StyleSheet, type StyleProp, type ViewStyle, View } from 'react-native'
import { layoutTokens } from '../../lib/theme'

type Props = Omit<PressableProps, 'children' | 'style'> & {
  accessibilityLabel: string
  children: ReactNode
  style?: StyleProp<ViewStyle>
  visualStyle?: StyleProp<ViewStyle>
}

export const APP_ICON_BUTTON_TOUCH_SIZE = layoutTokens.button.iconTouchSize
export const APP_ICON_BUTTON_VISUAL_SIZE = layoutTokens.button.iconVisualSize

export default function AppIconButton({ accessibilityLabel, children, disabled = false, style, visualStyle, ...rest }: Props) {
  const { accessibilityState, ...pressableProps } = rest
  const effectiveDisabled = disabled === true
  return (
    <Pressable
      {...pressableProps}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ ...accessibilityState, disabled: effectiveDisabled }}
      disabled={effectiveDisabled}
      style={({ pressed }) => [styles.touchFrame, pressed ? styles.pressed : null, effectiveDisabled ? styles.disabled : null, style]}
    >
      <View style={[styles.visualFrame, visualStyle]}>{children}</View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  touchFrame: {
    width: APP_ICON_BUTTON_TOUCH_SIZE,
    height: APP_ICON_BUTTON_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visualFrame: {
    width: APP_ICON_BUTTON_VISUAL_SIZE,
    height: APP_ICON_BUTTON_VISUAL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.55 },
})
