import React from 'react'
import { Pressable, type PressableProps, Text, type StyleProp, type ViewStyle } from 'react-native'
import { layoutTokens } from '../../lib/theme'

type Tone = 'primary' | 'secondary' | 'ghost' | 'danger'

type Props = Omit<PressableProps, 'style'> & {
  disabled?: boolean
  fullWidth?: boolean
  label: string
  loading?: boolean
  minHeight?: number
  style?: StyleProp<ViewStyle>
  tone?: Tone
}

const toneStyles: Record<Tone, { bg: string; border: string; text: string }> = {
  primary: { bg: '#2563EB', border: '#2563EB', text: '#FFFFFF' },
  secondary: { bg: '#F3F4F6', border: '#E5E7EB', text: '#111827' },
  ghost: { bg: '#FFFFFF', border: '#D1D5DB', text: '#111827' },
  danger: { bg: '#DC2626', border: '#DC2626', text: '#FFFFFF' },
}

export default function AppButton({
  disabled = false,
  fullWidth = false,
  label,
  loading = false,
  minHeight = layoutTokens.touchMinSize,
  style,
  tone = 'primary',
  ...rest
}: Props) {
  const palette = toneStyles[tone]
  const effectiveDisabled = disabled || loading
  return (
    <Pressable
      accessibilityRole="button"
      disabled={effectiveDisabled}
      style={({ pressed }) => [
        {
          minHeight,
          minWidth: fullWidth ? undefined : 132,
          paddingHorizontal: layoutTokens.spacing.lg,
          paddingVertical: layoutTokens.spacing.sm,
          borderRadius: layoutTokens.radius.md,
          borderWidth: 1,
          borderColor: palette.border,
          backgroundColor: effectiveDisabled ? '#BFDBFE' : palette.bg,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.92 : 1,
          flexShrink: 1,
        },
        fullWidth ? { width: '100%' } : null,
        style,
      ]}
      {...rest}
    >
      <Text
        allowFontScaling
        maxFontSizeMultiplier={layoutTokens.maxFontSizeMultiplier}
        style={{
          color: tone === 'primary' && effectiveDisabled ? '#FFFFFF' : palette.text,
          fontSize: layoutTokens.font.md,
          lineHeight: layoutTokens.lineHeight.md,
          fontWeight: '900',
          textAlign: 'center',
        }}
      >
        {loading ? '加载中…' : label}
      </Text>
    </Pressable>
  )
}
