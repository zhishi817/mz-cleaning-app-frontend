import React from 'react'
import { View } from 'react-native'
import { render } from '@testing-library/react-native'
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
