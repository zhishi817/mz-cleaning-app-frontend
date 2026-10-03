import React from 'react'
import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native'
import { layoutTokens } from '../../lib/theme'

type Props = ViewProps & {
  style?: StyleProp<ViewStyle>
}

export default function ResponsiveCard({ children, style, ...rest }: Props) {
  return (
    <View
      style={[
        {
          backgroundColor: '#FFFFFF',
          borderRadius: layoutTokens.radius.lg,
          padding: layoutTokens.spacing.lg,
          borderWidth: 1,
          borderColor: '#E6ECF5',
          gap: layoutTokens.spacing.md,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  )
}
