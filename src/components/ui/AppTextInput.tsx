import React from 'react'
import { TextInput, type StyleProp, type TextInputProps, type TextStyle } from 'react-native'
import { layoutTokens } from '../../lib/theme'

type Props = TextInputProps & {
  maxFontSizeMultiplier?: number
  minHeight?: number
  style?: StyleProp<TextStyle>
}

export default function AppTextInput({
  maxFontSizeMultiplier = layoutTokens.maxFontSizeMultiplier,
  minHeight,
  multiline,
  style,
  ...rest
}: Props) {
  const resolvedMinHeight = minHeight ?? (multiline ? 96 : layoutTokens.touchMinSize)
  return (
    <TextInput
      allowFontScaling
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      multiline={multiline}
      placeholderTextColor="#9CA3AF"
      style={[
        {
          minHeight: resolvedMinHeight,
          borderRadius: layoutTokens.radius.md,
          borderWidth: 1,
          borderColor: '#D1D5DB',
          paddingHorizontal: layoutTokens.spacing.md,
          paddingVertical: multiline ? layoutTokens.spacing.sm : 10,
          color: '#111827',
          fontSize: layoutTokens.font.md,
          lineHeight: layoutTokens.lineHeight.md,
          fontWeight: '700',
          textAlignVertical: multiline ? 'top' : 'center',
          backgroundColor: '#FFFFFF',
        },
        style,
      ]}
      {...rest}
    />
  )
}
