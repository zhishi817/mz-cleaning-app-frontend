import React, { useMemo, useState } from 'react'
import { useWindowDimensions, View, type LayoutChangeEvent } from 'react-native'
import { resolveResponsiveImageColumns } from '../../lib/responsive'
import { layoutTokens } from '../../lib/theme'

type Props<T> = {
  columnPolicyWidth?: number
  compactColumns?: number
  gap?: number
  fixedItemWidth?: number
  items: readonly T[]
  keyExtractor: (item: T, index: number) => string
  phoneColumns?: number
  renderItem: (item: T, index: number, itemWidth: number) => React.ReactNode
  testID?: string
}

export default function ResponsiveImageGrid<T>({
  columnPolicyWidth,
  compactColumns,
  gap = layoutTokens.spacing.sm,
  fixedItemWidth,
  items,
  keyExtractor,
  phoneColumns,
  renderItem,
  testID,
}: Props<T>) {
  const { width: viewportWidth } = useWindowDimensions()
  const [containerWidth, setContainerWidth] = useState(0)

  function onLayout(event: LayoutChangeEvent) {
    const nextWidth = Math.max(0, Math.floor(event.nativeEvent.layout.width))
    if (nextWidth !== containerWidth) setContainerWidth(nextWidth)
  }

  const { columns, itemWidth: responsiveItemWidth } = useMemo(() => {
    const effectiveWidth = containerWidth || layoutTokens.breakpoints.compactPhone
    const hasCustomColumnPolicy = compactColumns != null || phoneColumns != null
    const policyWidth = columnPolicyWidth
      || (hasCustomColumnPolicy ? viewportWidth : effectiveWidth)
    const responsiveColumns = resolveResponsiveImageColumns(effectiveWidth)
    const columns = policyWidth < layoutTokens.breakpoints.compactPhone
      ? Math.max(1, compactColumns ?? responsiveColumns)
      : policyWidth < layoutTokens.breakpoints.tablet
        ? Math.max(1, phoneColumns ?? responsiveColumns)
        : responsiveColumns
    const totalGap = gap * Math.max(0, columns - 1)
    const itemWidth = containerWidth > 0 ? Math.floor((containerWidth - totalGap) / columns) : 0
    return { columns, itemWidth }
  }, [columnPolicyWidth, compactColumns, containerWidth, gap, phoneColumns, viewportWidth])
  const itemWidth = fixedItemWidth && fixedItemWidth > 0 ? fixedItemWidth : responsiveItemWidth

  return (
    <View testID={testID} onLayout={onLayout} style={{ width: '100%', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap }}>
      {items.map((item, index) => (
        <View
          key={keyExtractor(item, index)}
          style={{
            alignSelf: 'flex-start',
            width: itemWidth > 0 ? itemWidth : `${100 / columns}%`,
          }}
        >
          {renderItem(item, index, itemWidth)}
        </View>
      ))}
    </View>
  )
}
