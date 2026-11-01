import React from 'react'
import { View } from 'react-native'
import { fireEvent, render } from '@testing-library/react-native'
import ResponsiveImageGrid from './ResponsiveImageGrid'

test('照片网格支持固定小缩略图宽度', () => {
  const ui = render(
    <ResponsiveImageGrid
      items={['photo-1']}
      fixedItemWidth={96}
      keyExtractor={(item) => item}
      renderItem={(item) => <View testID={item} />}
    />,
  )

  expect(ui.getByTestId('photo-1').parent?.parent?.props.style).toEqual(expect.objectContaining({ width: 96 }))
})

test.each([
  [320, 296, 1, 296],
  [360, 336, 2, 164],
  [375, 351, 2, 171],
  [390, 366, 2, 179],
  [430, 406, 2, 199],
])('屏幕 %ipx、内层容器 %ipx 时使用 %i 列并保持顶部对齐', (screenWidth, containerWidth, _columns, expectedItemWidth) => {
  const ui = render(
    <ResponsiveImageGrid
      columnPolicyWidth={screenWidth}
      compactColumns={1}
      phoneColumns={2}
      testID="room-grid"
      items={['room-1', 'room-2']}
      keyExtractor={(item) => item}
      renderItem={(item) => <View testID={item} />}
    />,
  )

  fireEvent(ui.getByTestId('room-grid'), 'layout', { nativeEvent: { layout: { width: containerWidth } } })

  expect(ui.getByTestId('room-grid').props.style).toEqual(expect.objectContaining({ alignItems: 'flex-start' }))
  expect(ui.getByTestId('room-1').parent?.parent?.props.style).toEqual(expect.objectContaining({
    alignSelf: 'flex-start',
    width: expectedItemWidth,
  }))
})
