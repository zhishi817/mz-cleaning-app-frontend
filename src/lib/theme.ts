export const layoutTokens = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    pill: 999,
  },
  font: {
    xs: 12,
    sm: 13,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 20,
    hero: 24,
  },
  lineHeight: {
    xs: 16,
    sm: 18,
    md: 20,
    lg: 22,
    xl: 24,
    xxl: 28,
    hero: 32,
  },
  breakpoints: {
    compactPhone: 360,
    phone: 768,
    largePhone: 430,
    tablet: 768,
  },
  touchMinSize: 44,
  bottomBarMinHeight: 56,
  maxFontSizeMultiplier: 1.35,
} as const

export type LayoutTokens = typeof layoutTokens
