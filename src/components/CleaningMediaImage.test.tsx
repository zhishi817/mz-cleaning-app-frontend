import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import CleaningMediaImage from './CleaningMediaImage'
import { loadCleaningMediaImage } from '../lib/cleaningMediaCache'

jest.mock('../lib/cleaningMediaCache', () => ({
  loadCleaningMediaImage: jest.fn(async () => ({ uri: null, failure: null })),
  removeCleaningMediaCachedImage: jest.fn(async () => {}),
  getCleaningMediaCacheEpoch: jest.fn(() => 0),
  subscribeCleaningMediaCache: jest.fn(() => () => {}),
}))

jest.mock('../config/env', () => ({
  API_BASE_URL: 'https://api.example.com/api',
}))

const mockedLoadCleaningMediaImage = jest.mocked(loadCleaningMediaImage)
const testAuthProps = { token: 'test-media-token' }

beforeEach(() => {
  mockedLoadCleaningMediaImage.mockReset()
  mockedLoadCleaningMediaImage.mockResolvedValue({ uri: 'file:///cache/image.jpg', failure: null })
})

test('offline task thumbnail surfaces a terminal authorization failure instead of a blank frame', async () => {
  mockedLoadCleaningMediaImage.mockResolvedValue({
    uri: null,
    failure: { status: 403, message: '无查看这张照片的权限', retryable: false },
  })
  const ui = render(
    <CleaningMediaImage
      {...testAuthProps}
      testID="offline-task-thumbnail"
      remoteReference="r2://private-bucket/mzapp/offline-photo.jpg"
      accessWorkTaskId="cleaning_offline_tasks:task-1"
      style={{ width: 96, height: 96 }}
    />,
  )

  await waitFor(() => expect(ui.getByText('无查看这张照片的权限')).toBeTruthy())
  expect(ui.queryByTestId('offline-task-thumbnail-retry')).toBeNull()
  expect(mockedLoadCleaningMediaImage).toHaveBeenCalledWith(expect.objectContaining({
    uri: expect.stringContaining('work_task_id=cleaning_offline_tasks%3Atask-1'),
  }))
})

test('offline task thumbnail keeps an explicit retry for transient media failures', async () => {
  mockedLoadCleaningMediaImage
    .mockResolvedValueOnce({ uri: null, failure: { status: null, message: '网络或服务暂不可用，请稍后重试', retryable: true } })
    .mockResolvedValueOnce({ uri: 'file:///cache/recovered.jpg', failure: null })
  const ui = render(
    <CleaningMediaImage
      {...testAuthProps}
      testID="offline-task-thumbnail-retry"
      remoteReference="r2://private-bucket/mzapp/offline-photo.jpg"
      accessWorkTaskId="cleaning_offline_tasks:task-1"
      style={{ width: 96, height: 96 }}
    />,
  )

  await waitFor(() => expect(ui.getByTestId('offline-task-thumbnail-retry-retry')).toBeTruthy())
  fireEvent.press(ui.getByTestId('offline-task-thumbnail-retry-retry'))
  await waitFor(() => expect(mockedLoadCleaningMediaImage).toHaveBeenCalledTimes(2))
})

test('retryable proxy failure keeps an existing local thumbnail visible', async () => {
  mockedLoadCleaningMediaImage.mockResolvedValue({
    uri: null,
    failure: { status: null, message: '网络或服务暂不可用，请稍后重试', retryable: true },
  })
  const ui = render(
    <CleaningMediaImage
      {...testAuthProps}
      testID="local-thumbnail-fallback"
      remoteReference="r2://private-bucket/mzapp/offline-photo.jpg"
      thumbnailUri="file:///cache/existing-thumbnail.jpg"
      accessWorkTaskId="cleaning_offline_tasks:task-1"
      style={{ width: 96, height: 96 }}
    />,
  )

  await waitFor(() => expect(ui.getByTestId('local-thumbnail-fallback').props.source).toEqual({ uri: 'file:///cache/existing-thumbnail.jpg' }))
  expect(ui.queryByTestId('local-thumbnail-fallback-retry')).toBeNull()
  expect(mockedLoadCleaningMediaImage).toHaveBeenCalledTimes(1)
})

test('never passes an authenticated proxy URL directly to the native Image renderer', async () => {
  const ui = render(
    <CleaningMediaImage
      {...testAuthProps}
      testID="private-thumbnail"
      remoteReference="cleaning/private-photo.jpg"
      style={{ width: 96, height: 96 }}
    />,
  )

  await waitFor(() => expect(ui.getByTestId('private-thumbnail').props.source).toEqual({ uri: 'file:///cache/image.jpg' }))
  expect(String(ui.getByTestId('private-thumbnail').props.source?.uri || '')).not.toContain('/cleaning-app/media/image')
})
