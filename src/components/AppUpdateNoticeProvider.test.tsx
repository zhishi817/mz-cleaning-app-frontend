import AsyncStorage from '@react-native-async-storage/async-storage'
import React from 'react'
import { Pressable, Text } from 'react-native'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { APP_UPDATE_NOTICE_STORAGE_KEY } from '../lib/appUpdateNoticeState'
import { AppUpdateNoticeProvider, useAppUpdateNotice } from './AppUpdateNoticeProvider'

const mockUseUpdates = jest.fn()

jest.mock('expo-updates', () => ({
  updateId: 'current-update',
  runtimeVersion: 'runtime-1',
  channel: 'testflight',
  isEnabled: true,
  isEmbeddedLaunch: false,
  isEmergencyLaunch: false,
  useUpdates: () => mockUseUpdates(),
}))

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.28' } },
}))

function Entry() {
  const update = useAppUpdateNotice()
  return (
    <Pressable testID="open-update" onPress={update.open}>
      <Text>{update.detail}</Text>
    </Pressable>
  )
}

beforeEach(async () => {
  await AsyncStorage.clear()
  mockUseUpdates.mockReset()
})
test('SDK确认下载后提示且稍后不提供主动重启，再次挂载不会重复弹出', async () => {
  mockUseUpdates.mockReturnValue({
    downloadedUpdate: {
      type: 'new',
      updateId: 'next-update',
      createdAt: new Date('2026-10-25T02:00:00.000Z'),
      manifest: { id: 'next-update', runtimeVersion: 'runtime-1' },
    },
    isUpdatePending: true,
    isStartupProcedureRunning: false,
    isChecking: false,
    isDownloading: false,
  })
  const first = render(<AppUpdateNoticeProvider><Entry /></AppUpdateNoticeProvider>)
  await waitFor(() => expect(first.getByText('更新已下载')).toBeTruthy())
  expect(first.getByText(/本次会话不会主动重启/)).toBeTruthy()
  expect(first.queryByText(/重启更新/)).toBeNull()
  fireEvent.press(first.getByTestId('app-update-notice-close'))
  await waitFor(() => expect(first.queryByText('更新已下载')).toBeNull())
  first.unmount()

  const second = render(<AppUpdateNoticeProvider><Entry /></AppUpdateNoticeProvider>)
  await waitFor(() => expect(second.getByText('已下载 · 下次打开可能生效')).toBeTruthy())
  expect(second.queryByText('更新已下载')).toBeNull()
  fireEvent.press(second.getByTestId('open-update'))
  expect(second.getByText('更新已下载')).toBeTruthy()
})

test('只有实际运行保存的目标updateId才显示一次更新完成和当前修复清单', async () => {
  await AsyncStorage.setItem(APP_UPDATE_NOTICE_STORAGE_KEY, JSON.stringify({
    version: 1,
    last_seen_update_id: 'old-update',
    pending: {
      update_id: 'current-update',
      runtime_version: 'runtime-1',
      channel: 'testflight',
      platform: 'ios',
      created_at: null,
      observed_at: '2026-10-25T02:00:00.000Z',
    },
    dismissed_pending_id: 'current-update',
    acknowledged_applied_id: null,
    last_applied: null,
  }))
  mockUseUpdates.mockReturnValue({
    downloadedUpdate: undefined,
    isUpdatePending: false,
    isStartupProcedureRunning: false,
    isChecking: false,
    isDownloading: false,
  })
  const ui = render(<AppUpdateNoticeProvider><Entry /></AppUpdateNoticeProvider>)
  await waitFor(() => expect(ui.getByText('更新完成')).toBeTruthy())
  expect(ui.getByText('OTA 更新提示')).toBeTruthy()
  expect(ui.getByText(/只有设备实际运行新 updateId/)).toBeTruthy()
  fireEvent.press(ui.getByTestId('app-update-notice-close'))
  await waitFor(() => expect(ui.queryByText('更新完成')).toBeNull())
})

test('回退pending和应急启动不误显示更新完成', async () => {
  mockUseUpdates.mockReturnValue({
    downloadedUpdate: { type: 'rollback' },
    isUpdatePending: true,
    isStartupProcedureRunning: false,
    isChecking: false,
    isDownloading: false,
  })
  const ui = render(<AppUpdateNoticeProvider><Entry /></AppUpdateNoticeProvider>)
  await waitFor(() => expect(ui.getByText('更新状态需查看')).toBeTruthy())
  fireEvent.press(ui.getByTestId('open-update'))
  expect(ui.getByText('检测到版本回退')).toBeTruthy()
  expect(ui.queryByText('更新完成')).toBeNull()
})

test('downloadedUpdate残留但isUpdatePending为false时不提示已下载', async () => {
  mockUseUpdates.mockReturnValue({
    downloadedUpdate: {
      type: 'new',
      updateId: 'stale-update',
      createdAt: new Date('2026-10-25T02:00:00.000Z'),
      manifest: { id: 'stale-update', runtimeVersion: 'runtime-1' },
    },
    isUpdatePending: false,
    isStartupProcedureRunning: false,
    isChecking: false,
    isDownloading: false,
  })
  const ui = render(<AppUpdateNoticeProvider><Entry /></AppUpdateNoticeProvider>)
  await waitFor(() => expect(ui.getByText('查看当前版本与更新说明')).toBeTruthy())
  expect(ui.queryByText('更新已下载')).toBeNull()
})

test('isUpdatePending先到但目标元数据晚到时保留已记录目标且不重复弹窗', async () => {
  await AsyncStorage.setItem(APP_UPDATE_NOTICE_STORAGE_KEY, JSON.stringify({
    version: 1,
    last_seen_update_id: 'current-update',
    pending: {
      update_id: 'next-update',
      runtime_version: 'runtime-1',
      channel: 'testflight',
      platform: 'ios',
      created_at: null,
      observed_at: '2026-10-25T02:00:00.000Z',
    },
    dismissed_pending_id: null,
    acknowledged_applied_id: null,
    last_applied: null,
  }))
  mockUseUpdates.mockReturnValue({
    downloadedUpdate: undefined,
    isUpdatePending: true,
    isStartupProcedureRunning: false,
    isChecking: false,
    isDownloading: false,
  })
  const ui = render(<AppUpdateNoticeProvider><Entry /></AppUpdateNoticeProvider>)
  await waitFor(() => expect(ui.getByText('已下载 · 下次打开可能生效')).toBeTruthy())
  expect(ui.queryByText('更新已下载')).toBeNull()
  expect(JSON.parse((await AsyncStorage.getItem(APP_UPDATE_NOTICE_STORAGE_KEY)) || '{}').pending.update_id).toBe('next-update')
})
