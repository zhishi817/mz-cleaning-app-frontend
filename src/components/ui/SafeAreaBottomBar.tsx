import React from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { layoutTokens } from '../../lib/theme'

type Props = {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
}

export default function SafeAreaBottomBar({ children, style }: Props) {
  const insets = useSafeAreaInsets()
  return (
    <View
      style={[
        {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: layoutTokens.spacing.lg,
          paddingTop: layoutTokens.spacing.md,
          paddingBottom: Math.max(insets.bottom, layoutTokens.spacing.md),
          backgroundColor: 'rgba(255,255,255,0.98)',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
        },
        style,
      ]}
    >
      {children}
    </View>
  )
}
