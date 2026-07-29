import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import CleaningMediaPreview from './CleaningMediaPreview'
import { cacheCleaningMediaImage } from '../lib/cleaningMediaCache'

jest.mock('../lib/cleaningMediaCache', () => ({
  cacheCleaningMediaImage: jest.fn(async () => null),
}))

const mockedCacheCleaningMediaImage = jest.mocked(cacheCleaningMediaImage)

beforeEach(() => {
  mockedCacheCleaningMediaImage.mockReset()
  mockedCacheCleaningMediaImage.mockResolvedValue(null)
})

jest.mock('../config/env', () => ({
  API_BASE_URL: 'https://api.example.com/api',
}))

test('先显示加载态，高清图成功后隐藏加载态', async () => {
  const ui = render(<CleaningMediaPreview token="token-1" reference="cleaning/photo-1.jpg" testID="photo" />)
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })

  expect(ui.getByText('高清图加载中…')).toBeTruthy()
  fireEvent(ui.getByTestId('photo-preview'), 'load')
  expect(ui.queryByText('高清图加载中…')).toBeNull()
})

test('高清图失败时保留缩略图并允许重试', async () => {
  const ui = render(<CleaningMediaPreview token="token-1" reference="cleaning/photo-1.jpg" testID="photo" />)
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })

  fireEvent(ui.getByTestId('photo-preview'), 'error')
  await waitFor(() => expect(ui.getByText('原图加载失败，点击重试')).toBeTruthy())
  fireEvent.press(ui.getByTestId('photo-retry'))
  expect(ui.getByText('高清图加载中…')).toBeTruthy()
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
})

test('缓存完成前高清图的原生请求失败不会抢先卸载预览节点', async () => {
  let resolvePreview: (uri: string | null) => void = () => undefined
  mockedCacheCleaningMediaImage.mockImplementation((source) => {
    if (source.uri?.includes('variant=preview')) return new Promise((resolve) => { resolvePreview = resolve })
    return Promise.resolve(null)
  })
  const ui = render(<CleaningMediaPreview token="token-1" reference="cleaning/photo-1.jpg" testID="photo" />)
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })

  fireEvent(ui.getByTestId('photo-preview'), 'error')
  expect(ui.queryByText('原图加载失败，点击重试')).toBeNull()
  await act(async () => resolvePreview('file:///cache/preview.jpg'))
  fireEvent(ui.getByTestId('photo-preview'), 'load')
  expect(ui.queryByText('原图加载失败，点击重试')).toBeNull()
})

test('缩略图失败时不伪装成黑色加载态并允许重试', async () => {
  const ui = render(<CleaningMediaPreview token="token-1" reference="cleaning/photo-1.jpg" testID="photo" />)
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })

  fireEvent(ui.getByTestId('photo-thumbnail'), 'error')
  await waitFor(() => expect(ui.getByText('照片预览加载失败，点击重试')).toBeTruthy())
})
