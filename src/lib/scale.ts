import { Dimensions, PixelRatio } from 'react-native'

const guidelineBaseWidth = 375

export function scale(size: number) {
  const { width } = Dimensions.get('window')
  return (width / guidelineBaseWidth) * size
}

export function moderateScale(size: number, factor = 0.5) {
  return size + (scale(size) - size) * factor
}

export function hairline(width = 1) {
  return width / PixelRatio.get()
}

