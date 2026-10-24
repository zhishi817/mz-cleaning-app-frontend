import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { Platform } from 'react-native'
import CleaningMediaVideo from './CleaningMediaVideo'

const mockPlay = jest.fn(async () => ({}))
const mockPause = jest.fn(async () => ({}))
const mockFullscreen = jest.fn(async () => ({}))
jest.mock('expo-av', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    ResizeMode: { CONTAIN: 'contain' },
    Video: React.forwardRef((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({ playAsync: mockPlay, pauseAsync: mockPause, presentFullscreenPlayer: mockFullscreen }))
      return React.createElement(View, props)
    }),
  }
})

test('authenticated native playback keeps exact source headers and provides explicit controls', async () => {
  const source = { uri: 'https://api.test/video?source_task_id=exact-task', headers: { Authorization: 'Bearer synthetic-token' } }
  const ui = render(<CleaningMediaVideo source={source} />)
  const video = await ui.findByTestId('cleaning-media-video-player')
  expect(video.props.source).toEqual(source)
  expect(video.props.useNativeControls).toBe(true)
  expect(video.props.resizeMode).toBe('contain')
  expect(ui.getByText('视频加载中…')).toBeTruthy()
  act(() => video.props.onPlaybackStatusUpdate({ isLoaded: true, isPlaying: false }))
  fireEvent.press(ui.getByLabelText('播放视频'))
  await waitFor(() => expect(mockPlay).toHaveBeenCalled())
  act(() => video.props.onPlaybackStatusUpdate({ isLoaded: true, isPlaying: true }))
  fireEvent.press(ui.getByLabelText('暂停视频'))
  fireEvent.press(ui.getByLabelText('全屏查看视频'))
  await waitFor(() => { expect(mockPause).toHaveBeenCalled(); expect(mockFullscreen).toHaveBeenCalled() })
})

test('decode failure is visible and retry reloads only the same read source', async () => {
  const source = { uri: 'file:///synthetic/video.mp4' }
  const ui = render(<CleaningMediaVideo source={source} />)
  const video = await ui.findByTestId('cleaning-media-video-player')
  act(() => video.props.onError('decode error'))
  expect(ui.getByText('视频无法播放，请重试；若仍失败请联系管理员')).toBeTruthy()
  fireEvent.press(ui.getByText('重新读取视频'))
  await waitFor(() => expect(ui.getByTestId('cleaning-media-video-player').props.source).toEqual(source))
  expect(ui.getByText('视频加载中…')).toBeTruthy()
})

test('source changes reset loaded/error state and keep portrait video uncropped', async () => {
  const ui = render(<CleaningMediaVideo source={{ uri: 'file:///synthetic/a.mp4' }} />)
  const video = await ui.findByTestId('cleaning-media-video-player')
  const oldVideoCallbacks = video.props
  act(() => video.props.onReadyForDisplay({ naturalSize: { width: 720, height: 1280 } }))
  expect(ui.getByTestId('cleaning-media-video-frame').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ aspectRatio: 720 / 1280 })]))
  act(() => video.props.onError('failure'))
  ui.rerender(<CleaningMediaVideo source={{ uri: 'file:///synthetic/b.mp4' }} />)
  await waitFor(() => expect(ui.getByTestId('cleaning-media-video-player').props.source.uri).toBe('file:///synthetic/b.mp4'))
  expect(ui.queryByText('视频无法播放，请重试；若仍失败请联系管理员')).toBeNull()
  act(() => {
    oldVideoCallbacks.onError('late error from old task')
    oldVideoCallbacks.onPlaybackStatusUpdate({ isLoaded: true, isPlaying: true })
  })
  expect(ui.getByTestId('cleaning-media-video-player').props.source.uri).toBe('file:///synthetic/b.mp4')
  expect(ui.queryByText('视频无法播放，请重试；若仍失败请联系管理员')).toBeNull()
  expect(ui.queryByLabelText('暂停视频')).toBeNull()
})

test('fullscreen failure keeps the loaded video playable', async () => {
  mockFullscreen.mockRejectedValueOnce(new Error('fullscreen unavailable'))
  const ui = render(<CleaningMediaVideo source={{ uri: 'file:///synthetic/video.mp4' }} />)
  const video = await ui.findByTestId('cleaning-media-video-player')
  act(() => video.props.onPlaybackStatusUpdate({ isLoaded: true, isPlaying: false }))
  fireEvent.press(ui.getByLabelText('全屏查看视频'))
  await waitFor(() => expect(ui.getByText('暂时无法全屏，可继续在当前页面播放')).toBeTruthy())
  expect(ui.getByTestId('cleaning-media-video-player')).toBeTruthy()
  expect(ui.getByLabelText('播放视频')).toBeTruthy()
})

test('web reads protected bytes with Authorization, revokes the blob and shows a 403 without playing it', async () => {
  const originalPlatform = Platform.OS
  const originalFetch = globalThis.fetch
  const originalCreate = URL.createObjectURL
  const originalRevoke = URL.revokeObjectURL
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
  globalThis.fetch = jest.fn().mockResolvedValueOnce({ ok: true, blob: async () => ({ size: 20 }) }).mockResolvedValueOnce({ ok: false, status: 403 })
  URL.createObjectURL = jest.fn(() => 'blob:synthetic-video')
  URL.revokeObjectURL = jest.fn()
  try {
    const ui = render(<CleaningMediaVideo source={{ uri: 'https://api.test/exact-source', headers: { Authorization: 'Bearer synthetic-token' } }} />)
    await waitFor(() => expect(ui.getByTestId('cleaning-media-video-player').props.source).toEqual({ uri: 'blob:synthetic-video' }))
    expect(globalThis.fetch).toHaveBeenCalledWith('https://api.test/exact-source', expect.objectContaining({ headers: { Authorization: 'Bearer synthetic-token' } }))
    ui.rerender(<CleaningMediaVideo source={{ uri: 'https://api.test/forbidden-source', headers: { Authorization: 'Bearer synthetic-token' } }} />)
    await waitFor(() => expect(ui.getByText('无查看此视频的权限')).toBeTruthy())
    expect(ui.queryByTestId('cleaning-media-video-player')).toBeNull()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:synthetic-video')
    ui.unmount()
  } finally {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform })
    globalThis.fetch = originalFetch
    URL.createObjectURL = originalCreate
    URL.revokeObjectURL = originalRevoke
  }
})
