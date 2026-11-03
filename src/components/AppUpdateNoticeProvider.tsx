import Constants from 'expo-constants'
import * as Updates from 'expo-updates'
import { useUpdates } from 'expo-updates'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AppState, Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { CURRENT_APP_RELEASE_NOTES, type AppReleaseNotes } from '../lib/appReleaseNotes'
import {
  checkAppRestartSafety,
  releaseAppRestartReservation,
  reserveAppRestart,
  subscribeAppRestartSafety,
  type AppRestartSafetyResult,
} from '../lib/appRestartSafety'
import {
  acknowledgeAppliedAppUpdate,
  appUpdatePendingTarget,
  dismissPendingAppUpdate,
  loadAppUpdateNoticeState,
  resolveAppUpdateNotice,
  saveAppUpdateNoticeState,
  type AppUpdateNoticeStoredState,
  type AppUpdateNoticeView,
} from '../lib/appUpdateNoticeState'
import { hairline } from '../lib/scale'
import AppButton from './ui/AppButton'

type AppUpdateNoticeContextValue = {
  label: string
  detail: string
  status: AppUpdateNoticeView['kind']
  open: () => void
}

const DEFAULT_CONTEXT: AppUpdateNoticeContextValue = {
  label: '应用更新',
  detail: '查看当前版本',
  status: 'current',
  open: () => {},
}

const AppUpdateNoticeContext = createContext<AppUpdateNoticeContextValue>(DEFAULT_CONTEXT)

function cleanText(value: unknown) {
  return String(value || '').trim()
}

function downloadedUpdateId(info: any) {
  if (!info || String(info.type || '').toLowerCase() === 'rollback') return ''
  return cleanText(info.updateId || info?.manifest?.id)
}

function downloadedRuntimeVersion(info: any) {
  return cleanText(info?.manifest?.runtimeVersion) || cleanText(Updates.runtimeVersion) || null
}

function downloadedCreatedAt(info: any) {
  const value = info?.createdAt || info?.manifest?.createdAt
  if (value instanceof Date) return value.toISOString()
  return cleanText(value) || null
}

function shortId(value: unknown) {
  const text = cleanText(value)
  return text ? text.slice(0, 8) : '-'
}

function copyFor(view: AppUpdateNoticeView) {
  if (view.kind === 'pending') return {
    label: '更新已下载',
    detail: '可以现在安全重启并应用更新，也可以选择“稍后”，保存或取消当前工作后再从“我的 → 应用更新”打开。',
  }
  if (view.kind === 'applied') return {
    label: '更新完成',
    detail: '设备现在实际运行的是这个更新版本。下面的修复清单来自当前正在运行的代码。',
  }
  if (view.kind === 'rollback_pending') return {
    label: '检测到版本回退',
    detail: '当前没有把回退指令当作普通更新成功；应用会继续遵循安装包的原生更新恢复规则。',
  }
  if (view.kind === 'rolled_back') return {
    label: '当前运行安装包版本',
    detail: '设备已切换到安装包内置版本，不能把这次启动报告为补丁更新成功。',
  }
  if (view.kind === 'cache_missing') return {
    label: '已下载更新不可用',
    detail: '此前记录的缓存更新已被替换、清理或未能恢复。当前不会声称它已经生效。',
  }
  if (view.kind === 'emergency') return {
    label: '应用处于应急启动',
    detail: '更新初始化失败后，应用正在使用可启动的回退版本；当前不会报告更新完成。',
  }
  if (view.kind === 'unsupported') return {
    label: '当前环境不支持 OTA',
    detail: '开发环境、Expo Go 或未启用 expo-updates 的安装包没有可核验的 OTA 状态。',
  }
  return { label: '应用更新', detail: '当前没有等待生效的已下载更新。' }
}

function releaseForView(view: AppUpdateNoticeView, stored: AppUpdateNoticeStoredState, runningUpdateId: string): AppReleaseNotes | null {
  if (view.kind === 'applied') return view.applied.release
  if (stored.last_applied?.update_id === runningUpdateId) return stored.last_applied.release
  return CURRENT_APP_RELEASE_NOTES
}

export function AppUpdateNoticeProvider({ children }: { children: React.ReactNode }) {
  const updateState = useUpdates()
  const [stored, setStored] = useState<AppUpdateNoticeStoredState>({
    version: 1,
    last_seen_update_id: null,
    pending: null,
    dismissed_pending_id: null,
    acknowledged_applied_id: null,
    last_applied: null,
  })
  const [view, setView] = useState<AppUpdateNoticeView>({ kind: 'current' })
  const [visible, setVisible] = useState(false)
  const [appState, setAppState] = useState(AppState.currentState)
  const [restartSafety, setRestartSafety] = useState<{ status: 'idle' | 'checking' | 'ready'; result: AppRestartSafetyResult | null }>({ status: 'idle', result: null })
  const [restartError, setRestartError] = useState<string | null>(null)
  const [restartRequested, setRestartRequested] = useState(false)
  const generationRef = useRef(0)
  const safetyCheckRef = useRef(0)
  const restartInFlightRef = useRef(false)
  const runningUpdateId = cleanText(Updates.updateId)
  const downloaded = updateState.downloadedUpdate
  const downloadedId = downloadedUpdateId(downloaded)
  const pendingRuntimeVersion = downloadedRuntimeVersion(downloaded)
  const pendingCreatedAt = downloadedCreatedAt(downloaded)
  const rollbackPending = updateState.isUpdatePending && String((downloaded as any)?.type || '').toLowerCase() === 'rollback'
  const settled = !updateState.isStartupProcedureRunning && !updateState.isChecking && !updateState.isDownloading
  const pendingTargetId = view.kind === 'pending' ? view.target.update_id : ''
  const pendingDownloadReady = view.kind === 'pending'
    && updateState.isUpdatePending
    && !!downloadedId
    && downloadedId === pendingTargetId
    && !updateState.isChecking
    && !updateState.isDownloading
    && !updateState.isRestarting

  const latestRestartStateRef = useRef({
    appState,
    downloadedId,
    isChecking: !!updateState.isChecking,
    isDownloading: !!updateState.isDownloading,
    isRestarting: !!updateState.isRestarting,
    isUpdatePending: !!updateState.isUpdatePending,
    pendingTargetId,
    visible,
  })
  latestRestartStateRef.current = {
    appState,
    downloadedId,
    isChecking: !!updateState.isChecking,
    isDownloading: !!updateState.isDownloading,
    isRestarting: !!updateState.isRestarting,
    isUpdatePending: !!updateState.isUpdatePending,
    pendingTargetId,
    visible,
  }

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState)
    return () => subscription.remove()
  }, [])

  useEffect(() => {
    const generation = ++generationRef.current
    let alive = true
    ;(async () => {
      const previous = await loadAppUpdateNoticeState()
      if (!alive || generationRef.current !== generation) return
      const target = updateState.isUpdatePending && downloadedId
        ? appUpdatePendingTarget({
            updateId: downloadedId,
            runtimeVersion: pendingRuntimeVersion,
            channel: Updates.channel,
            platform: Platform.OS,
            createdAt: pendingCreatedAt,
          })
        : null
      const resolution = resolveAppUpdateNotice({
        stored: previous,
        enabled: Updates.isEnabled,
        startupComplete: settled,
        runningUpdateId,
        runtimeVersion: Updates.runtimeVersion,
        channel: Updates.channel,
        platform: Platform.OS,
        isEmbeddedLaunch: Updates.isEmbeddedLaunch,
        isEmergencyLaunch: Updates.isEmergencyLaunch,
        downloadedTarget: target,
        updatePending: updateState.isUpdatePending,
        rollbackPending,
        release: CURRENT_APP_RELEASE_NOTES,
      })
      const saved = await saveAppUpdateNoticeState(resolution.state)
      if (!alive || generationRef.current !== generation) return
      setStored(saved)
      setView(resolution.view)
      if (resolution.should_prompt) setVisible(true)
    })().catch(() => {
      if (!alive || generationRef.current !== generation) return
      setView({ kind: 'current' })
    })
    return () => { alive = false }
  }, [downloadedId, pendingCreatedAt, pendingRuntimeVersion, rollbackPending, runningUpdateId, settled, updateState.isUpdatePending])

  const refreshRestartSafety = useCallback(() => {
    if (!visible || view.kind !== 'pending') return
    const checkId = ++safetyCheckRef.current
    setRestartSafety((current) => ({ status: 'checking', result: current.result }))
    void checkAppRestartSafety().then((result) => {
      if (safetyCheckRef.current !== checkId) return
      setRestartSafety({ status: 'ready', result })
    }).catch(() => {
      if (safetyCheckRef.current !== checkId) return
      setRestartSafety({
        status: 'ready',
        result: {
          safe: false,
          generation: -1,
          blockers: [{ kind: 'storage_error', message: '无法核对本地草稿和上传队列，请稍后重试' }],
        },
      })
    })
  }, [view.kind, visible])

  useEffect(() => {
    if (!visible || view.kind !== 'pending') {
      safetyCheckRef.current += 1
      setRestartSafety({ status: 'idle', result: null })
      setRestartError(null)
      return
    }
    refreshRestartSafety()
    return subscribeAppRestartSafety(refreshRestartSafety)
  }, [refreshRestartSafety, view.kind, visible])

  const close = useCallback(() => {
    if (restartInFlightRef.current) return
    setVisible(false)
    const next = view.kind === 'pending'
      ? dismissPendingAppUpdate(stored, view.target.update_id)
      : view.kind === 'applied'
        ? acknowledgeAppliedAppUpdate(stored, view.applied.update_id)
        : stored
    setStored(next)
    void saveAppUpdateNoticeState(next)
  }, [stored, view])

  const restartNow = useCallback(async () => {
    if (restartInFlightRef.current) return
    const initial = latestRestartStateRef.current
    if (
      initial.appState !== 'active'
      || !initial.visible
      || !initial.isUpdatePending
      || !initial.downloadedId
      || initial.downloadedId !== initial.pendingTargetId
      || initial.isChecking
      || initial.isDownloading
      || initial.isRestarting
    ) {
      setRestartError('更新文件尚未准备好，请保持 App 在前台并稍后重试。')
      return
    }
    restartInFlightRef.current = true
    setRestartRequested(true)
    setRestartError(null)
    const targetId = initial.pendingTargetId
    let reservation: symbol | null = null
    let reloadScheduled = false
    try {
      const result = await checkAppRestartSafety()
      const latest = latestRestartStateRef.current
      const targetStillReady = latest.appState === 'active'
        && latest.visible
        && latest.isUpdatePending
        && latest.downloadedId === targetId
        && latest.pendingTargetId === targetId
        && !latest.isChecking
        && !latest.isDownloading
        && !latest.isRestarting
      if (!targetStillReady) {
        setRestartError('更新状态已经变化，请重新打开更新提示后再试。')
        return
      }
      setRestartSafety({ status: 'ready', result })
      if (!result.safe) return
      reservation = reserveAppRestart(result.generation)
      if (!reservation) {
        setRestartError('表单或上传状态刚刚发生变化，已阻止重启，请确认后重试。')
        refreshRestartSafety()
        return
      }
      await Updates.reloadAsync()
      reloadScheduled = true
      // A successful call schedules native reload immediately. Keep the guard active;
      // running more application logic here could race the reload.
      return
    } catch {
      releaseAppRestartReservation(reservation)
      setRestartError('重启更新失败，当前内容仍保留。请稍后重试或选择“稍后”。')
    } finally {
      if (!reloadScheduled) {
        restartInFlightRef.current = false
        setRestartRequested(false)
      }
    }
  }, [refreshRestartSafety])

  const copy = copyFor(view)
  const release = releaseForView(view, stored, runningUpdateId)
  const appVersion = cleanText((Constants as any)?.expoConfig?.version) || '-'
  const contextValue = useMemo<AppUpdateNoticeContextValue>(() => ({
    label: '应用更新',
    detail: view.kind === 'pending'
      ? '已下载 · 下次打开可能生效'
      : view.kind === 'applied'
        ? '已更新 · 查看修复内容'
        : view.kind === 'rollback_pending' || view.kind === 'rolled_back' || view.kind === 'cache_missing' || view.kind === 'emergency'
          ? '更新状态需查看'
          : '查看当前版本与更新说明',
    status: view.kind,
    open: () => setVisible(true),
  }), [view.kind])

  const restartBlockers = restartSafety.result?.blockers || []
  const restartSafe = pendingDownloadReady
    && appState === 'active'
    && restartSafety.status === 'ready'
    && restartSafety.result?.safe === true
  const pendingStatusText = updateState.isRestarting || restartRequested
    ? '正在重启并应用更新…'
    : updateState.isDownloading
      ? `正在下载更新${Number.isFinite(Number(updateState.downloadProgress)) ? ` · ${Math.round(Number(updateState.downloadProgress) * 100)}%` : ''}`
      : updateState.downloadError
        ? '更新下载失败，请保持当前 App，稍后重试。'
        : updateState.isChecking
          ? '正在检查更新文件…'
          : updateState.checkError
            ? '检查更新失败，当前版本可继续使用。'
            : !pendingDownloadReady
              ? '正在确认已下载更新，暂时不能重启。'
              : restartSafety.status === 'checking'
                ? '正在核对未保存内容和上传队列…'
                : restartSafety.result?.safe
                  ? '更新已准备好，且未发现未保存内容或进行中的上传。'
                  : '为避免丢失内容，当前已阻止重启。'
  const transientUpdateStatus = updateState.isRestarting
    ? '正在切换到已下载更新…'
    : updateState.isDownloading
      ? `正在下载更新${Number.isFinite(Number(updateState.downloadProgress)) ? ` · ${Math.round(Number(updateState.downloadProgress) * 100)}%` : ''}`
      : updateState.downloadError
        ? '更新下载失败，当前版本可继续使用。'
        : updateState.isChecking
          ? '正在检查是否有可用更新…'
          : updateState.checkError
            ? '检查更新失败，当前版本可继续使用。'
            : null

  return (
    <AppUpdateNoticeContext.Provider value={contextValue}>
      {children}
      <Modal transparent animationType="fade" visible={visible} onRequestClose={close}>
        <View style={styles.backdrop}>
          <View style={styles.modal} testID="app-update-notice-dialog">
            <ScrollView contentContainerStyle={styles.content}>
              <Text style={styles.title}>{copy.label}</Text>
              <Text style={styles.detail}>{copy.detail}</Text>
              <View style={styles.meta}>
                <Text style={styles.metaText}>App 版本：{appVersion}</Text>
                <Text style={styles.metaText}>频道：{cleanText(Updates.channel) || '-'}</Text>
                <Text style={styles.metaText}>运行版本：{shortId(Updates.runtimeVersion)}</Text>
                <Text style={styles.metaText}>当前更新：{shortId(runningUpdateId)}</Text>
                {view.kind === 'pending' ? <Text style={styles.metaText}>待生效更新：{shortId(view.target.update_id)}</Text> : null}
              </View>
              {(view.kind === 'applied' || view.kind === 'current') ? (
                <View style={styles.notes}>
                  <Text style={styles.notesTitle}>{release?.title || '版本说明'}</Text>
                  {release?.items.length ? release.items.map((item, index) => (
                    <Text key={`${item}-${index}`} style={styles.noteItem}>• {item}</Text>
                  )) : <Text style={styles.noteEmpty}>此版本没有提供修复清单。</Text>}
                </View>
              ) : null}
              {view.kind !== 'pending' && transientUpdateStatus ? (
                <View style={styles.restartStatus} testID="app-update-transient-status">
                  <Text style={styles.restartStatusTitle}>{transientUpdateStatus}</Text>
                </View>
              ) : null}
              {view.kind === 'pending' ? (
                <View style={styles.restartStatus} testID="app-update-restart-status">
                  <Text style={styles.restartStatusTitle}>{pendingStatusText}</Text>
                  {restartBlockers.map((blocker, index) => (
                    <Text key={`${blocker.kind}-${index}`} style={styles.restartBlocker}>• {blocker.message}</Text>
                  ))}
                  {!restartSafe && restartSafety.status === 'ready' && restartBlockers.length ? (
                    <Text style={styles.restartHelp}>请先选择“稍后”，回到相关页面完成保存、等待上传结束，或取消草稿，再重新打开“我的 → 应用更新”。</Text>
                  ) : null}
                  {restartError ? <Text style={styles.restartError}>{restartError}</Text> : null}
                </View>
              ) : null}
              {view.kind === 'pending' ? (
                <AppButton
                  testID="app-update-restart-now"
                  label="现在重启并更新"
                  onPress={restartNow}
                  disabled={!restartSafe}
                  loading={restartRequested}
                  fullWidth
                />
              ) : null}
              <AppButton
                testID="app-update-notice-close"
                label={view.kind === 'pending' ? '稍后' : view.kind === 'applied' ? '完成' : '关闭'}
                onPress={close}
                disabled={restartRequested}
                tone={view.kind === 'pending' ? 'secondary' : 'primary'}
                fullWidth
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </AppUpdateNoticeContext.Provider>
  )
}

export function useAppUpdateNotice() {
  return useContext(AppUpdateNoticeContext)
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,23,42,0.48)' },
  modal: { width: '100%', maxWidth: 440, maxHeight: '86%', borderRadius: 20, borderWidth: hairline(), borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', overflow: 'hidden' },
  content: { padding: 20, gap: 12 },
  title: { fontSize: 20, lineHeight: 28, fontWeight: '900', color: '#111827' },
  detail: { fontSize: 14, lineHeight: 21, color: '#4B5563' },
  meta: { padding: 12, gap: 4, borderRadius: 12, backgroundColor: '#EFF6FF' },
  metaText: { fontSize: 12, lineHeight: 18, fontWeight: '700', color: '#1E40AF' },
  notes: { padding: 12, gap: 6, borderRadius: 12, backgroundColor: '#F9FAFB' },
  notesTitle: { fontSize: 14, lineHeight: 20, fontWeight: '900', color: '#111827' },
  noteItem: { fontSize: 13, lineHeight: 19, color: '#374151' },
  noteEmpty: { fontSize: 13, lineHeight: 19, color: '#6B7280' },
  restartStatus: { padding: 12, gap: 6, borderRadius: 12, backgroundColor: '#F9FAFB', borderWidth: hairline(), borderColor: '#E5E7EB' },
  restartStatusTitle: { fontSize: 13, lineHeight: 19, fontWeight: '800', color: '#374151' },
  restartBlocker: { fontSize: 12, lineHeight: 18, color: '#92400E' },
  restartHelp: { fontSize: 12, lineHeight: 18, color: '#6B7280' },
  restartError: { fontSize: 12, lineHeight: 18, fontWeight: '700', color: '#B91C1C' },
})
