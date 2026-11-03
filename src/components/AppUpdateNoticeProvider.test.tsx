import AsyncStorage from '@react-native-async-storage/async-storage'
import React from 'react'
import { AppState, Pressable, Text } from 'react-native'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { APP_UPDATE_NOTICE_STORAGE_KEY } from '../lib/appUpdateNoticeState'
import { __resetAppRestartSafetyForTests, setAppRestartBlocker } from '../lib/appRestartSafety'
import { AppUpdateNoticeProvider, useAppUpdateNotice } from './AppUpdateNoticeProvider'

const mockUseUpdates = jest.fn()
const mockReloadAsync = jest.fn()

jest.mock('expo-updates', () => ({
  updateId: 'current-update',
  runtimeVersion: 'runtime-1',
  channel: 'testflight',
  isEnabled: true,
  isEmbeddedLaunch: false,
  isEmergencyLaunch: false,
  reloadAsync: (...args: any[]) => mockReloadAsync(...args),
  useUpdates: () => mockUseUpdates(),
}))

jest.mock('../lib/inspectionPanelDraftRecovery', () => ({
  listInspectionPanelDraftRecoverySnapshots: jest.fn(async () => []),
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
  __resetAppRestartSafetyForTests()
  await AsyncStorage.clear()
  ;(AppState as any).currentState = 'active'
  mockUseUpdates.mockReset()
  mockReloadAsync.mockReset()
  mockReloadAsync.mockResolvedValue(undefined)
})
test('SDK确认下载后同时提供安全重启和稍后，稍后不会主动重启且再次挂载不重复弹出', async () => {
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
    isRestarting: false,
    checkError: null,
    downloadError: null,
    downloadProgress: 1,
  })
  const first = render(<AppUpdateNoticeProvider><Entry /></AppUpdateNoticeProvider>)
  await waitFor(() => expect(first.getByText('更新已下载')).toBeTruthy())
  await waitFor(() => expect(first.getByText(/未发现未保存内容/)).toBeTruthy())
  expect(first.getByText('稍后')).toBeTruthy()
  fireEvent.press(first.getByTestId('app-update-notice-close'))
  expect(mockReloadAsync).not.toHaveBeenCalled()
  await waitFor(() => expect(first.queryByText('更新已下载')).toBeNull())
  first.unmount()

  const second = render(<AppUpdateNoticeProvider><Entry /></AppUpdateNoticeProvider>)
  await waitFor(() => expect(second.getByText('已下载 · 下次打开可能生效')).toBeTruthy())
  expect(second.queryByText('更新已下载')).toBeNull()
  fireEvent.press(second.getByTestId('open-update'))
  expect(second.getByText('更新已下载')).toBeTruthy()
  await waitFor(() => expect(second.getByText(/未发现未保存内容/)).toBeTruthy())
})

test('更新已下载且全局状态安全时只调用一次reloadAsync', async () => {
  mockUseUpdates.mockReturnValue({
    downloadedUpdate: {
      type: 'new', updateId: 'next-update',
      manifest: { id: 'next-update', runtimeVersion: 'runtime-1' },
    },
    isUpdatePending: true,
    isStartupProcedureRunning: false,
    isChecking: false,
    isDownloading: false,
    isRestarting: false,
    checkError: null,
    downloadError: null,
    downloadProgress: 1,
  })
  const ui = render(<AppUpdateNoticeProvider><Entry /></AppUpdateNoticeProvider>)
  await waitFor(() => expect(ui.getByText(/未发现未保存内容/)).toBeTruthy())
  await waitFor(() => expect(ui.getByTestId('app-update-restart-now').props.accessibilityState.disabled).toBe(false))
  const restart = ui.getByTestId('app-update-restart-now')
  fireEvent.press(restart)
  fireEvent.press(restart)
  await waitFor(() => expect(mockReloadAsync).toHaveBeenCalledTimes(1))
})

test('App切到后台时立即禁用重启，回到前台后重新放行', async () => {
  mockUseUpdates.mockReturnValue({
    downloadedUpdate: { type: 'new', updateId: 'next-update', manifest: { id: 'next-update', runtimeVersion: 'runtime-1' } },
    isUpdatePending: true,
    isStartupProcedureRunning: false,
    isChecking: false,
    isDownloading: false,
    isRestarting: false,
  })
  const ui = render(<AppUpdateNoticeProvider><Entry /></AppUpdateNoticeProvider>)
  await waitFor(() => expect(ui.getByTestId('app-update-restart-now').props.accessibilityState.disabled).toBe(false))
  await waitFor(() => expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function)))
  const appStateListener = (AppState.addEventListener as jest.Mock).mock.calls.at(-1)?.[1] as ((state: string) => void)

  await act(async () => {
    appStateListener('background')
    await Promise.resolve()
  })
  expect(ui.getByTestId('app-update-restart-now').props.accessibilityState.disabled).toBe(true)
  fireEvent.press(ui.getByTestId('app-update-restart-now'))
  expect(mockReloadAsync).not.toHaveBeenCalled()

  await act(async () => {
    appStateListener('active')
    await Promise.resolve()
  })
  await waitFor(() => expect(ui.getByTestId('app-update-restart-now').props.accessibilityState.disabled).toBe(false))
})

test('未保存输入会禁用重启并提示先保存或取消，状态清除后重新放行', async () => {
  setAppRestartBlocker('edit-form', { kind: 'unsaved', message: '有未保存的测试输入' })
  mockUseUpdates.mockReturnValue({
    downloadedUpdate: { type: 'new', updateId: 'next-update', manifest: { id: 'next-update', runtimeVersion: 'runtime-1' } },
    isUpdatePending: true,
    isStartupProcedureRunning: false,
    isChecking: false,
    isDownloading: false,
    isRestarting: false,
  })
  const ui = render(<AppUpdateNoticeProvider><Entry /></AppUpdateNoticeProvider>)
  await waitFor(() => expect(ui.getByText('• 有未保存的测试输入')).toBeTruthy())
  expect(ui.getByText(/完成保存、等待上传结束，或取消草稿/)).toBeTruthy()
  expect(ui.getByTestId('app-update-restart-now').props.accessibilityState.disabled).toBe(true)
  fireEvent.press(ui.getByTestId('app-update-restart-now'))
  expect(mockReloadAsync).not.toHaveBeenCalled()

  await act(async () => {
    setAppRestartBlocker('edit-form', null)
    await Promise.resolve()
  })
  await waitFor(() => expect(ui.getByText(/未发现未保存内容/)).toBeTruthy())
  await waitFor(() => expect(ui.getByTestId('app-update-restart-now').props.accessibilityState.disabled).toBe(false))
})

test('下载元数据缺失时不调用reloadAsync', async () => {
  await AsyncStorage.setItem(APP_UPDATE_NOTICE_STORAGE_KEY, JSON.stringify({
    version: 1,
    last_seen_update_id: 'current-update',
    pending: {
      update_id: 'next-update', runtime_version: 'runtime-1', channel: 'testflight', platform: 'ios',
      created_at: null, observed_at: '2026-10-25T02:00:00.000Z',
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
    isRestarting: false,
  })
  const ui = render(<AppUpdateNoticeProvider><Entry /></AppUpdateNoticeProvider>)
  await waitFor(() => expect(ui.getByText('已下载 · 下次打开可能生效')).toBeTruthy())
  fireEvent.press(ui.getByTestId('open-update'))
  expect(ui.getByText(/正在确认已下载更新/)).toBeTruthy()
  expect(ui.getByTestId('app-update-restart-now').props.accessibilityState.disabled).toBe(true)
  expect(mockReloadAsync).not.toHaveBeenCalled()
  fireEvent.press(ui.getByTestId('app-update-notice-close'))
  await waitFor(() => expect(ui.queryByText('更新已下载')).toBeNull())
})

test('reloadAsync失败时保留弹窗并给出可重试提示', async () => {
  mockReloadAsync.mockRejectedValueOnce(new Error('native reload failed'))
  mockUseUpdates.mockReturnValue({
    downloadedUpdate: { type: 'new', updateId: 'next-update', manifest: { id: 'next-update', runtimeVersion: 'runtime-1' } },
    isUpdatePending: true,
    isStartupProcedureRunning: false,
    isChecking: false,
    isDownloading: false,
    isRestarting: false,
  })
  const ui = render(<AppUpdateNoticeProvider><Entry /></AppUpdateNoticeProvider>)
  await waitFor(() => expect(ui.getByText(/未发现未保存内容/)).toBeTruthy())
  await waitFor(() => expect(ui.getByTestId('app-update-restart-now').props.accessibilityState.disabled).toBe(false))
  fireEvent.press(ui.getByTestId('app-update-restart-now'))
  await waitFor(() => expect(ui.getByText(/重启更新失败/)).toBeTruthy())
  expect(ui.getByText('稍后')).toBeTruthy()
  expect(ui.getByTestId('app-update-restart-now').props.accessibilityState.disabled).toBe(false)
})

test('检查、下载和失败状态只显示真实阶段且不会提前提供重启', async () => {
  mockUseUpdates.mockReturnValue({
    downloadedUpdate: undefined,
    isUpdatePending: false,
    isStartupProcedureRunning: false,
    isChecking: true,
    isDownloading: false,
    isRestarting: false,
  })
  const ui = render(<AppUpdateNoticeProvider><Entry /></AppUpdateNoticeProvider>)
  await waitFor(() => expect(ui.getByText('查看当前版本与更新说明')).toBeTruthy())
  fireEvent.press(ui.getByTestId('open-update'))
  expect(ui.getByText('正在检查是否有可用更新…')).toBeTruthy()
  expect(ui.queryByTestId('app-update-restart-now')).toBeNull()

  mockUseUpdates.mockReturnValue({
    downloadedUpdate: undefined,
    isUpdatePending: false,
    isStartupProcedureRunning: false,
    isChecking: false,
    isDownloading: false,
    isRestarting: false,
    downloadError: new Error('network'),
  })
  ui.rerender(<AppUpdateNoticeProvider><Entry /></AppUpdateNoticeProvider>)
  expect(ui.getByText('更新下载失败，当前版本可继续使用。')).toBeTruthy()
  expect(mockReloadAsync).not.toHaveBeenCalled()
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
