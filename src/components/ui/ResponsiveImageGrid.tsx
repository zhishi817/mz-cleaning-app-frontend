import React, { useMemo, useState } from 'react'
import { View, type LayoutChangeEvent } from 'react-native'
import { resolveResponsiveImageColumns } from '../../lib/responsive'
import { layoutTokens } from '../../lib/theme'

type Props<T> = {
  gap?: number
  items: readonly T[]
  keyExtractor: (item: T, index: number) => string
  renderItem: (item: T, index: number, itemWidth: number) => React.ReactNode
}

export default function ResponsiveImageGrid<T>({
  gap = layoutTokens.spacing.sm,
  items,
  keyExtractor,
  renderItem,
}: Props<T>) {
  const [containerWidth, setContainerWidth] = useState(0)

  function onLayout(event: LayoutChangeEvent) {
    const nextWidth = Math.max(0, Math.floor(event.nativeEvent.layout.width))
    if (nextWidth !== containerWidth) setContainerWidth(nextWidth)
  }

  const { columns, itemWidth } = useMemo(() => {
    const columns = resolveResponsiveImageColumns(containerWidth || layoutTokens.breakpoints.compactPhone)
    const totalGap = gap * Math.max(0, columns - 1)
    const itemWidth = containerWidth > 0 ? Math.floor((containerWidth - totalGap) / columns) : 0
    return { columns, itemWidth }
  }, [containerWidth, gap])

  return (
    <View onLayout={onLayout} style={{ width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {items.map((item, index) => (
        <View
          key={keyExtractor(item, index)}
          style={{
            width: itemWidth > 0 ? itemWidth : `${100 / columns}%`,
          }}
        >
          {renderItem(item, index, itemWidth)}
        </View>
      ))}
    </View>
  )
}
