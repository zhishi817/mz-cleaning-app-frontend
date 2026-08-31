import { useWindowDimensions } from 'react-native'
import { layoutTokens } from './theme'

export function resolveResponsiveImageColumns(containerWidth: number) {
  if (containerWidth < layoutTokens.breakpoints.compactPhone) return 2
  if (containerWidth < layoutTokens.breakpoints.tablet) return 3
  return 4
}

export function useResponsiveLayout() {
  const { width, height, fontScale } = useWindowDimensions()
  return {
    width,
    height,
    fontScale,
    isCompactPhone: width < layoutTokens.breakpoints.compactPhone,
    isLargePhone: width >= layoutTokens.breakpoints.largePhone && width < layoutTokens.breakpoints.tablet,
    isTablet: width >= layoutTokens.breakpoints.tablet,
    isLargeText: fontScale >= 1.2,
    isXLargeText: fontScale >= 1.35,
  }
}
