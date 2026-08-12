import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import CleaningMediaPreview from './CleaningMediaPreview'
import { loadCleaningMediaImage } from '../lib/cleaningMediaCache'

jest.mock('../lib/cleaningMediaCache', () => ({
  loadCleaningMediaImage: jest.fn(async () => ({ uri: null, failure: null })),
}))

const mockedLoadCleaningMediaImage = jest.mocked(loadCleaningMediaImage)

beforeEach(() => {
  mockedLoadCleaningMediaImage.mockReset()
  mockedLoadCleaningMediaImage.mockResolvedValue({ uri: null, failure: null })
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
  let resolvePreview: (result: { uri: string | null; failure: null }) => void = () => undefined
  mockedLoadCleaningMediaImage.mockImplementation((source) => {
    if (source.uri?.includes('variant=preview')) return new Promise((resolve) => { resolvePreview = resolve })
    return Promise.resolve({ uri: null, failure: null })
  })
  const ui = render(<CleaningMediaPreview token="token-1" reference="cleaning/photo-1.jpg" testID="photo" />)
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })

  fireEvent(ui.getByTestId('photo-preview'), 'error')
  expect(ui.queryByText('原图加载失败，点击重试')).toBeNull()
  await act(async () => resolvePreview({ uri: 'file:///cache/preview.jpg', failure: null }))
  fireEvent(ui.getByTestId('photo-preview'), 'load')
  expect(ui.queryByText('原图加载失败，点击重试')).toBeNull()
})

test('缩略图失败时不伪装成黑色加载态并允许重试', async () => {
  const ui = render(<CleaningMediaPreview token="token-1" reference="cleaning/photo-1.jpg" testID="photo" />)
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })

  fireEvent(ui.getByTestId('photo-thumbnail'), 'error')
  await waitFor(() => expect(ui.getByText('照片预览加载失败，点击重试')).toBeTruthy())
})

test('存在本地照片时，缩略图和原图预览都直接使用本地文件', async () => {
  const ui = render(<CleaningMediaPreview token="token-1" reference="cleaning/photo-1.jpg" localUri="file:///draft/photo-1.jpg" testID="photo" />)
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })

  expect(ui.getByTestId('photo-thumbnail').props.source).toEqual({ uri: 'file:///draft/photo-1.jpg' })
  expect(ui.getByTestId('photo-preview').props.source).toEqual({ uri: 'file:///draft/photo-1.jpg' })
})

test('历史线下任务照片的缩略图和预览共用认证代理及精确任务上下文', async () => {
  const reference = 'https://current-public-base.r2.dev/historical/offline-task-photo.jpg'
  const ui = render(<CleaningMediaPreview token="token-1" reference={reference} accessWorkTaskId="cleaning_offline_tasks:task-1" offlineWorkTaskMedia testID="photo" />)
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })

  expect(ui.getByTestId('photo-thumbnail').props.source).toEqual({
    uri: 'https://api.example.com/api/cleaning-app/media/image?url=https%3A%2F%2Fcurrent-public-base.r2.dev%2Fhistorical%2Foffline-task-photo.jpg&variant=thumbnail&work_task_id=cleaning_offline_tasks%3Atask-1',
    headers: { Authorization: 'Bearer token-1' },
  })
  expect(ui.getByTestId('photo-preview').props.source).toEqual({
    uri: 'https://api.example.com/api/cleaning-app/media/image?url=https%3A%2F%2Fcurrent-public-base.r2.dev%2Fhistorical%2Foffline-task-photo.jpg&variant=preview&work_task_id=cleaning_offline_tasks%3Atask-1',
    headers: { Authorization: 'Bearer token-1' },
  })
})

test('临时通知照片的缩略图和预览共用认证代理及通知上下文', async () => {
  const ui = render(<CleaningMediaPreview token="token-1" reference="cleaning/notice-photo-1.jpg" guestLuggageId="guest-luggage-1" testID="photo" />)
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })

  expect(ui.getByTestId('photo-thumbnail').props.source).toEqual({
    uri: 'https://api.example.com/api/cleaning-app/media/image?key=cleaning%2Fnotice-photo-1.jpg&variant=thumbnail&guest_luggage_id=guest-luggage-1',
    headers: { Authorization: 'Bearer token-1' },
  })
  expect(ui.getByTestId('photo-preview').props.source).toEqual({
    uri: 'https://api.example.com/api/cleaning-app/media/image?key=cleaning%2Fnotice-photo-1.jpg&variant=preview&guest_luggage_id=guest-luggage-1',
    headers: { Authorization: 'Bearer token-1' },
  })
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

test('404 是照片缺失终态，网络错误才保留重试入口', async () => {
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
