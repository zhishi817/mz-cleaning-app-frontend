import React, { useMemo, useState } from 'react'
import { Text, type StyleProp, type TextProps, type TextStyle } from 'react-native'
import { layoutTokens } from '../../lib/theme'

type Variant = 'title' | 'section' | 'body' | 'caption' | 'button' | 'label'

const variantStyles: Record<Variant, TextStyle> = {
  title: { fontSize: layoutTokens.font.xl, lineHeight: layoutTokens.lineHeight.xl, fontWeight: '900', color: '#111827' },
  section: { fontSize: layoutTokens.font.lg, lineHeight: layoutTokens.lineHeight.lg, fontWeight: '900', color: '#111827' },
  body: { fontSize: layoutTokens.font.md, lineHeight: layoutTokens.lineHeight.md, fontWeight: '700', color: '#374151' },
  caption: { fontSize: layoutTokens.font.sm, lineHeight: layoutTokens.lineHeight.sm, fontWeight: '700', color: '#6B7280' },
  button: { fontSize: layoutTokens.font.md, lineHeight: layoutTokens.lineHeight.md, fontWeight: '900', color: '#111827', textAlign: 'center' },
  label: { fontSize: layoutTokens.font.sm, lineHeight: layoutTokens.lineHeight.sm, fontWeight: '900', color: '#111827' },
}

type Props = TextProps & {
  expandable?: boolean
  expandedLabel?: string
  collapsedLabel?: string
  maxFontSizeMultiplier?: number
  style?: StyleProp<TextStyle>
  variant?: Variant
}

export default function AppText({
  children,
  expandable = false,
  expandedLabel = '收起',
  collapsedLabel = '展开',
  maxFontSizeMultiplier = layoutTokens.maxFontSizeMultiplier,
  numberOfLines,
  style,
  variant = 'body',
  ...rest
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const resolvedNumberOfLines = expandable ? (expanded ? undefined : numberOfLines || 2) : numberOfLines
  const resolvedStyle = useMemo(() => [variantStyles[variant], style], [style, variant])

  return (
    <>
      <Text
        allowFontScaling
        maxFontSizeMultiplier={maxFontSizeMultiplier}
        numberOfLines={resolvedNumberOfLines}
        style={resolvedStyle}
        {...rest}
      >
        {children}
      </Text>
      {expandable ? (
        <Text
          allowFontScaling
          maxFontSizeMultiplier={maxFontSizeMultiplier}
          onPress={() => setExpanded((value) => !value)}
          style={[variantStyles.caption, { color: '#2563EB', marginTop: layoutTokens.spacing.xs }]}
        >
          {expanded ? expandedLabel : collapsedLabel}
        </Text>
      ) : null}
    </>
  )
}
