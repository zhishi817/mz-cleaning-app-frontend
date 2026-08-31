import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import CleaningMediaPreview from './CleaningMediaPreview'
import { loadCleaningMediaImage } from '../lib/cleaningMediaCache'

jest.mock('../lib/cleaningMediaCache', () => ({
  loadCleaningMediaImage: jest.fn(async () => ({ uri: null, failure: null })),
  removeCleaningMediaCachedImage: jest.fn(async () => {}),
  getCleaningMediaCacheEpoch: jest.fn(() => 0),
  subscribeCleaningMediaCache: jest.fn(() => () => {}),
}))

const mockedLoadCleaningMediaImage = jest.mocked(loadCleaningMediaImage)

beforeEach(() => {
  mockedLoadCleaningMediaImage.mockReset()
  mockedLoadCleaningMediaImage.mockImplementation(async (source) => ({
    uri: source.uri?.includes('variant=preview') ? 'file:///cache/preview.jpg' : 'file:///cache/thumbnail.jpg',
    failure: null,
  }))
})

jest.mock('../config/env', () => ({
  API_BASE_URL: 'https://api.example.com/api',
}))

test('先显示加载态，高清图成功后隐藏加载态', async () => {
  const ui = render(<CleaningMediaPreview token="token-1" reference="cleaning/photo-1.jpg" testID="photo" />)
  await waitFor(() => expect(ui.getByTestId('photo-preview').props.source).toEqual({ uri: 'file:///cache/preview.jpg' }))

  expect(ui.getByText('高清图加载中…')).toBeTruthy()
  fireEvent(ui.getByTestId('photo-preview'), 'load')
  expect(ui.queryByText('高清图加载中…')).toBeNull()
})

test('list mode downloads only the thumbnail and never mounts a preview request', async () => {
  const ui = render(<CleaningMediaPreview token="token-1" reference="cleaning/photo-1.jpg" loadPreview={false} testID="photo" />)

  await waitFor(() => expect(ui.getByTestId('photo-thumbnail').props.source).toEqual({ uri: 'file:///cache/thumbnail.jpg' }))
  expect(ui.queryByTestId('photo-preview')).toBeNull()
  expect(mockedLoadCleaningMediaImage).toHaveBeenCalledTimes(1)
  expect(mockedLoadCleaningMediaImage).toHaveBeenCalledWith(expect.objectContaining({ uri: expect.stringContaining('variant=thumbnail') }))
})

test('remote proxy URLs are used only by the downloader; native Images receive file URIs', async () => {
  const reference = 'https://current-public-base.r2.dev/historical/offline-task-photo.jpg'
  const ui = render(<CleaningMediaPreview token="token-1" reference={reference} accessWorkTaskId="cleaning_offline_tasks:task-1" offlineWorkTaskMedia testID="photo" />)

  await waitFor(() => expect(ui.getByTestId('photo-thumbnail').props.source).toEqual({ uri: 'file:///cache/thumbnail.jpg' }))
  expect(ui.getByTestId('photo-preview').props.source).toEqual({ uri: 'file:///cache/preview.jpg' })
  expect(mockedLoadCleaningMediaImage).toHaveBeenCalledWith(expect.objectContaining({
    uri: 'https://api.example.com/api/cleaning-app/media/image?url=https%3A%2F%2Fcurrent-public-base.r2.dev%2Fhistorical%2Foffline-task-photo.jpg&variant=thumbnail&work_task_id=cleaning_offline_tasks%3Atask-1',
    headers: { Authorization: 'Bearer token-1' },
  }))
  expect(mockedLoadCleaningMediaImage).toHaveBeenCalledWith(expect.objectContaining({
    uri: 'https://api.example.com/api/cleaning-app/media/image?url=https%3A%2F%2Fcurrent-public-base.r2.dev%2Fhistorical%2Foffline-task-photo.jpg&variant=preview&work_task_id=cleaning_offline_tasks%3Atask-1',
    headers: { Authorization: 'Bearer token-1' },
  }))
})

test('存在本地照片时，缩略图和原图预览都直接使用本地文件', async () => {
  const ui = render(<CleaningMediaPreview token="token-1" reference="cleaning/photo-1.jpg" localUri="file:///draft/photo-1.jpg" testID="photo" />)
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })

  expect(ui.getByTestId('photo-thumbnail').props.source).toEqual({ uri: 'file:///draft/photo-1.jpg' })
  expect(ui.getByTestId('photo-preview').props.source).toEqual({ uri: 'file:///draft/photo-1.jpg' })
  expect(mockedLoadCleaningMediaImage).not.toHaveBeenCalled()
})

test('403 是权限终态，不展示自动或手动重试入口', async () => {
  mockedLoadCleaningMediaImage.mockResolvedValue({
    uri: null,
    failure: { status: 403, message: '无查看这张照片的权限', retryable: false },
  })
  const ui = render(<CleaningMediaPreview token="token-1" reference="cleaning/photo-1.jpg" testID="photo" />)

  await waitFor(() => expect(ui.getByText('无查看这张照片的权限')).toBeTruthy())
  expect(ui.getByTestId('photo-terminal')).toBeTruthy()
  expect(ui.queryByTestId('photo-retry')).toBeNull()
})

test('网络错误保留重试入口，而 404 不缓存为可展示图片', async () => {
  mockedLoadCleaningMediaImage.mockResolvedValueOnce({
    uri: null,
    failure: { status: 404, message: '照片已不可用（文件不存在）', retryable: false },
  }).mockResolvedValueOnce({
    uri: null,
    failure: { status: null, message: '网络或服务暂不可用，请稍后重试', retryable: true },
  })
  const terminal = render(<CleaningMediaPreview token="token-1" reference="cleaning/photo-1.jpg" testID="terminal" />)

  await waitFor(() => expect(terminal.getByText('照片已不可用（文件不存在）')).toBeTruthy())
  expect(terminal.queryByTestId('terminal-retry')).toBeNull()

  mockedLoadCleaningMediaImage.mockReset()
  mockedLoadCleaningMediaImage.mockResolvedValue({
    uri: null,
    failure: { status: null, message: '网络或服务暂不可用，请稍后重试', retryable: true },
  })
  const retryable = render(<CleaningMediaPreview token="token-1" reference="cleaning/photo-2.jpg" testID="retryable" />)

  await waitFor(() => expect(retryable.getByText('网络或服务暂不可用，请稍后重试')).toBeTruthy())
  expect(retryable.getByTestId('retryable-retry')).toBeTruthy()
})
