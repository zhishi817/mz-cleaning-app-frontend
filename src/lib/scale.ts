import { Dimensions, PixelRatio, Text as RNText, TextInput as RNTextInput } from 'react-native'

const guidelineBaseWidth = 375
export const compactWidth = 400

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function scale(size: number) {
  const { width } = Dimensions.get('window')
  const ratio = clamp(width / guidelineBaseWidth, 0.92, 1.16)
  return ratio * size
}

export function moderateScale(size: number, factor = 0.5) {
  return size + (scale(size) - size) * factor
}

export function hairline(width = 1) {
  return width / PixelRatio.get()
}

export function isCompactWidth(width: number) {
  return width < compactWidth
}

export function configureDefaultTextScaling(maxFontSizeMultiplier = 1.35) {
  const textDefaults = (RNText as any).defaultProps || {}
  const inputDefaults = (RNTextInput as any).defaultProps || {}
  ;(RNText as any).defaultProps = {
    ...textDefaults,
    allowFontScaling: true,
    maxFontSizeMultiplier,
  }
  ;(RNTextInput as any).defaultProps = {
    ...inputDefaults,
    allowFontScaling: true,
    maxFontSizeMultiplier,
  }
}
