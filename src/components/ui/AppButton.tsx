import React from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps, type StyleProp, type ViewStyle, View } from 'react-native'
import { layoutTokens } from '../../lib/theme'

type Tone = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'destructive'
type Size = 'standard' | 'compact'

type Props = Omit<PressableProps, 'style'> & {
  disabled?: boolean
  fullWidth?: boolean
  label: string
  loading?: boolean
  minHeight?: number
  size?: Size
  style?: StyleProp<ViewStyle>
  tone?: Tone
}

const toneStyles: Record<Tone, { bg: string; border: string; text: string; disabledBg: string; disabledBorder: string; disabledText: string }> = {
  primary: { bg: '#2563EB', border: '#2563EB', text: '#FFFFFF', disabledBg: '#BFDBFE', disabledBorder: '#93C5FD', disabledText: '#FFFFFF' },
  secondary: { bg: '#F3F4F6', border: '#E5E7EB', text: '#111827', disabledBg: '#E5E7EB', disabledBorder: '#D1D5DB', disabledText: '#9CA3AF' },
  ghost: { bg: '#FFFFFF', border: '#D1D5DB', text: '#111827', disabledBg: '#F9FAFB', disabledBorder: '#E5E7EB', disabledText: '#9CA3AF' },
  danger: { bg: '#DC2626', border: '#DC2626', text: '#FFFFFF', disabledBg: '#FCA5A5', disabledBorder: '#FCA5A5', disabledText: '#FFFFFF' },
  outline: { bg: '#FFFFFF', border: '#D1D5DB', text: '#111827', disabledBg: '#F9FAFB', disabledBorder: '#E5E7EB', disabledText: '#9CA3AF' },
  destructive: { bg: '#DC2626', border: '#DC2626', text: '#FFFFFF', disabledBg: '#FCA5A5', disabledBorder: '#FCA5A5', disabledText: '#FFFFFF' },
}

export default function AppButton({
  disabled = false,
  fullWidth = false,
  label,
  loading = false,
  minHeight,
  size = 'standard',
  style,
  tone = 'primary',
  ...rest
}: Props) {
  const palette = toneStyles[tone]
  const effectiveDisabled = disabled || loading
  const resolvedMinHeight = minHeight ?? (size === 'compact' ? layoutTokens.button.compactHeight : layoutTokens.button.height)
  const { accessibilityState, ...pressableProps } = rest
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ ...accessibilityState, disabled: effectiveDisabled, busy: loading }}
      disabled={effectiveDisabled}
      style={({ pressed }) => [
        {
          minHeight: resolvedMinHeight,
          minWidth: fullWidth ? undefined : 132,
          paddingHorizontal: layoutTokens.button.horizontalPadding,
          paddingVertical: 0,
          borderRadius: layoutTokens.button.radius,
          borderWidth: 1,
          borderColor: effectiveDisabled ? palette.disabledBorder : palette.border,
          backgroundColor: effectiveDisabled ? palette.disabledBg : palette.bg,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.92 : effectiveDisabled ? 0.82 : 1,
          flexShrink: 1,
        },
        fullWidth ? { width: '100%' } : null,
        style,
      ]}
      {...pressableProps}
    >
      <View style={styles.content}>
        <Text
          allowFontScaling
          maxFontSizeMultiplier={layoutTokens.maxFontSizeMultiplier}
          style={{
            color: effectiveDisabled ? palette.disabledText : palette.text,
            fontSize: layoutTokens.font.md,
            lineHeight: layoutTokens.button.textLineHeight,
            fontWeight: '900',
            textAlign: 'center',
            opacity: loading ? 0 : 1,
          }}
        >
          {label}
        </Text>
        {loading ? <ActivityIndicator style={StyleSheet.absoluteFillObject} color={palette.text} /> : null}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: { minHeight: layoutTokens.button.textLineHeight, alignItems: 'center', justifyContent: 'center' },
})
