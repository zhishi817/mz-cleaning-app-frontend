import AsyncStorage from '@react-native-async-storage/async-storage'
import { CURRENT_APP_RELEASE_NOTES } from './appReleaseNotes'
import {
  acknowledgeAppliedAppUpdate,
  appUpdatePendingTarget,
  dismissPendingAppUpdate,
  loadAppUpdateNoticeState,
  resolveAppUpdateNotice,
  saveAppUpdateNoticeState,
} from './appUpdateNoticeState'

const base = {
  enabled: true,
  startupComplete: true,
  runningUpdateId: 'old-update',
  runtimeVersion: 'runtime-1',
  channel: 'testflight',
  platform: 'ios',
  isEmbeddedLaunch: false,
  isEmergencyLaunch: false,
  updatePending: false,
  rollbackPending: false,
  release: CURRENT_APP_RELEASE_NOTES,
  now: '2026-10-25T01:00:00.000Z',
}

beforeEach(async () => { await AsyncStorage.clear() })

test('首次安装只记录当前updateId，不误报更新完成', () => {
  const result = resolveAppUpdateNotice({
    ...base,
    stored: { version: 1, last_seen_update_id: null, pending: null, dismissed_pending_id: null, acknowledged_applied_id: null, last_applied: null },
    downloadedTarget: null,
  })
  expect(result.view.kind).toBe('current')
  expect(result.should_prompt).toBe(false)
  expect(result.state.last_seen_update_id).toBe('old-update')
})
test('只有SDK已下载的新updateId才显示pending，稍后关闭后重进不重复弹窗', () => {
  const pending = appUpdatePendingTarget({ updateId: 'next-update', runtimeVersion: 'runtime-1', channel: 'testflight', platform: 'ios', createdAt: '2026-10-25T02:00:00.000Z' })!
  const initial = resolveAppUpdateNotice({
    ...base,
    stored: { version: 1, last_seen_update_id: 'old-update', pending: null, dismissed_pending_id: null, acknowledged_applied_id: null, last_applied: null },
    downloadedTarget: pending,
    updatePending: true,
  })
  expect(initial.view.kind).toBe('pending')
  expect(initial.should_prompt).toBe(true)
  const dismissed = dismissPendingAppUpdate(initial.state, pending.update_id)
  const reopened = resolveAppUpdateNotice({ ...base, stored: dismissed, downloadedTarget: pending, updatePending: true })
  expect(reopened.view.kind).toBe('pending')
  expect(reopened.should_prompt).toBe(false)
})

test('实际运行目标updateId后才显示一次已生效和当前bundle修复清单', () => {
  const pending = appUpdatePendingTarget({ updateId: 'next-update', runtimeVersion: 'runtime-1', channel: 'testflight', platform: 'ios', createdAt: null })!
  const stored = { version: 1 as const, last_seen_update_id: 'old-update', pending, dismissed_pending_id: pending.update_id, acknowledged_applied_id: null, last_applied: null }
  const applied = resolveAppUpdateNotice({ ...base, stored, runningUpdateId: 'next-update', downloadedTarget: null })
  expect(applied.view).toEqual(expect.objectContaining({ kind: 'applied' }))
  if (applied.view.kind === 'applied') expect(applied.view.applied.release).toEqual(CURRENT_APP_RELEASE_NOTES)
  expect(applied.should_prompt).toBe(true)
  const acknowledged = acknowledgeAppliedAppUpdate(applied.state, 'next-update')
  const again = resolveAppUpdateNotice({ ...base, stored: acknowledged, runningUpdateId: 'next-update', downloadedTarget: null })
  expect(again.should_prompt).toBe(false)
})

test('未观察到pending的远端updateId变化方向未知，不误报更新成功', () => {
  const result = resolveAppUpdateNotice({
    ...base,
    stored: { version: 1, last_seen_update_id: 'old-update', pending: null, dismissed_pending_id: null, acknowledged_applied_id: null, last_applied: null },
    runningUpdateId: 'native-applied-update',
    downloadedTarget: null,
  })
  expect(result.view.kind).toBe('current')
  expect(result.state.last_seen_update_id).toBe('native-applied-update')
  expect(result.should_prompt).toBe(false)
})

test('rollback、emergency、缓存消失和更新替代都不误报成功', () => {
  const pending = appUpdatePendingTarget({ updateId: 'next-update', runtimeVersion: 'runtime-1', channel: 'testflight', platform: 'ios', createdAt: null })!
  const stored = { version: 1 as const, last_seen_update_id: 'old-update', pending, dismissed_pending_id: null, acknowledged_applied_id: null, last_applied: null }
  expect(resolveAppUpdateNotice({ ...base, stored, downloadedTarget: null, rollbackPending: true }).view.kind).toBe('rollback_pending')
  expect(resolveAppUpdateNotice({ ...base, stored, downloadedTarget: null, isEmergencyLaunch: true }).view.kind).toBe('emergency')
  expect(resolveAppUpdateNotice({ ...base, stored, downloadedTarget: null }).view.kind).toBe('cache_missing')

  const replacement = appUpdatePendingTarget({ updateId: 'replacement', runtimeVersion: 'runtime-1', channel: 'testflight', platform: 'ios', createdAt: null })!
  const replaced = resolveAppUpdateNotice({ ...base, stored: dismissPendingAppUpdate(stored, 'next-update'), downloadedTarget: replacement, updatePending: true })
  expect(replaced.view.kind).toBe('pending')
  expect(replaced.should_prompt).toBe(true)
})

test('启动状态未稳定时保留已记录pending且不弹窗、不清缓存记录', () => {
  const pending = appUpdatePendingTarget({ updateId: 'next-update', runtimeVersion: 'runtime-1', channel: 'testflight', platform: 'ios', createdAt: null })!
  const stored = { version: 1 as const, last_seen_update_id: 'old-update', pending, dismissed_pending_id: null, acknowledged_applied_id: null, last_applied: null }
  const result = resolveAppUpdateNotice({ ...base, stored, startupComplete: false, downloadedTarget: null })
  expect(result.view).toEqual({ kind: 'pending', target: pending })
  expect(result.state.pending).toEqual(pending)
  expect(result.should_prompt).toBe(false)
})

test('SDK已报告pending但目标元数据晚到时保留旧状态且不误报缓存消失', () => {
  const pending = appUpdatePendingTarget({ updateId: 'next-update', runtimeVersion: 'runtime-1', channel: 'testflight', platform: 'ios', createdAt: null })!
  const stored = { version: 1 as const, last_seen_update_id: 'old-update', pending, dismissed_pending_id: null, acknowledged_applied_id: null, last_applied: null }
  const result = resolveAppUpdateNotice({ ...base, stored, updatePending: true, downloadedTarget: null })
  expect(result.view).toEqual({ kind: 'pending', target: pending })
  expect(result.state.pending).toEqual(pending)
  expect(result.should_prompt).toBe(false)
})

test('downloadedUpdate对象残留但SDK不再pending时不创建新的待生效提示', () => {
  const stale = appUpdatePendingTarget({ updateId: 'stale-update', runtimeVersion: 'runtime-1', channel: 'testflight', platform: 'ios', createdAt: null })!
  const stored = { version: 1 as const, last_seen_update_id: 'old-update', pending: null, dismissed_pending_id: null, acknowledged_applied_id: null, last_applied: null }
  const result = resolveAppUpdateNotice({ ...base, stored, updatePending: false, downloadedTarget: stale })
  expect(result.view.kind).toBe('current')
  expect(result.should_prompt).toBe(false)
})

test('缺失或无效发布说明不被伪造为修复清单', () => {
  const pending = appUpdatePendingTarget({ updateId: 'next-update', runtimeVersion: 'runtime-1', channel: 'testflight', platform: 'ios', createdAt: null })!
  const stored = { version: 1 as const, last_seen_update_id: 'old-update', pending, dismissed_pending_id: null, acknowledged_applied_id: null, last_applied: null }
  const result = resolveAppUpdateNotice({ ...base, stored, runningUpdateId: 'next-update', downloadedTarget: null, release: null })
  expect(result.view.kind).toBe('applied')
  if (result.view.kind === 'applied') expect(result.view.applied.release).toBeNull()
})

test('持久化损坏时安全降级为空状态', async () => {
  await AsyncStorage.setItem('mzstay.app_update_notice.v1', '{bad-json')
  expect(await loadAppUpdateNoticeState()).toEqual(expect.objectContaining({ version: 1, pending: null }))
  const saved = await saveAppUpdateNoticeState({ version: 1, last_seen_update_id: 'a', pending: null, dismissed_pending_id: null, acknowledged_applied_id: null, last_applied: null })
  expect(saved.last_seen_update_id).toBe('a')
})
