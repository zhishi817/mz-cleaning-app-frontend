import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import CleaningMediaImage from './CleaningMediaImage'
import { loadCleaningMediaImage } from '../lib/cleaningMediaCache'

jest.mock('../lib/cleaningMediaCache', () => ({
  loadCleaningMediaImage: jest.fn(async () => ({ uri: null, failure: null })),
}))

jest.mock('../config/env', () => ({
  API_BASE_URL: 'https://api.example.com/api',
}))

const mockedLoadCleaningMediaImage = jest.mocked(loadCleaningMediaImage)
const testAuthProps = { token: 'test-media-token' }

beforeEach(() => {
  mockedLoadCleaningMediaImage.mockReset()
  mockedLoadCleaningMediaImage.mockResolvedValue({ uri: null, failure: null })
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
