import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { ResizeMode, Video } from 'expo-av'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { API_BASE_URL } from '../../config/env'
import { deleteLockboxVideo, uploadLockboxVideo } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import {
  bindInspectionPanelCleaningTaskId,
  getInspectionPanelVideoReadiness,
  getInspectionPanelBatch,
  subscribeInspectionPanelSubmitQueue,
  type InspectionPanelBatchStatus,
  type InspectionPanelVideoReadiness,
} from '../../lib/inspectionPanelSubmitQueue'
import { useI18n } from '../../lib/i18n'
import {
  enqueueInspectionMediaItem,
  listInspectionMediaQueueItemsForTask,
  processInspectionMediaQueue,
  removeInspectionMediaItem,
  subscribeInspectionMediaQueue,
  updateInspectionMediaItem,
  type InspectionMediaQueueItem,
} from '../../lib/inspectionMediaQueue'
import { inspectionScopeLabel, isPasswordOnlyInspectionTask } from '../../lib/cleaningInspection'
import { hairline, moderateScale } from '../../lib/scale'
import { isEarlyCheckinTime } from '../../lib/taskTime'
import { getInspectionScopeTone, TASK_TONE_COLORS, type TaskTone } from '../../lib/taskVisualTheme'
import { getWorkTasksSnapshot, patchWorkTaskItem } from '../../lib/workTasksStore'
import type { TasksStackParamList } from '../../navigation/RootNavigator'
import AppButton from '../../components/ui/AppButton'
import AppText from '../../components/ui/AppText'
import SafeAreaBottomBar from '../../components/ui/SafeAreaBottomBar'
import { layoutTokens } from '../../lib/theme'
import { actionDisabledReasonText } from '../../lib/workTaskActions'

type Props = NativeStackScreenProps<TasksStackParamList, 'InspectionComplete'>

function cleanText(value: any) {
  return String(value ?? '').trim()
}

function inspectionBatchStatusHint(status: InspectionPanelBatchStatus | null, lastError?: string | null) {
  const error = cleanText(lastError)
  if (status === 'pending_submit') return error || '检查与补充已保存到本机，当前待同步。'
  if (status === 'syncing') return '检查与补充正在同步中；本机照片会保留，任务会等待照片业务保存。'
  if (status === 'partial_failed') return '检查与补充部分同步失败；本机照片会保留，稍后回检查页重试。'
  if (status === 'failed') return '检查与补充同步失败；本机照片会保留，稍后回检查页重试。'
  if (status === 'synced') return '检查与补充已同步完成。'
  return '检查与补充尚未发现已提交批次，请先保存本机照片。'
}

function noticeToneStylePair(tone: TaskTone) {
  const palette = TASK_TONE_COLORS[tone]
  return {
    card: { backgroundColor: palette.bg, borderColor: palette.border },
    text: { color: palette.text },
    icon: palette.dot,
  }
}

function normalizeBase(base: string) {
  return String(base || '').trim().replace(/\/+$/g, '')
}

function toAbsoluteUrl(rawUrl: any) {
  const s0 = String(rawUrl ?? '').trim()
  if (!s0) return ''
  if (/^https?:\/\//i.test(s0)) return s0
  if (s0.startsWith('//')) return `https:${s0}`
  const base = normalizeBase(API_BASE_URL)
  const stripAuth = base.replace(/\/auth\/?$/g, '')
  const stripApi = stripAuth.replace(/\/api\/?$/g, '')
  const root = stripApi || stripAuth || base
  if (!root) return s0
  if (s0.startsWith('/')) return `${root}${s0}`
  return s0
}

function staleQueueUpload(item: InspectionMediaQueueItem | null, now = Date.now()) {
  if (!item || item.upload_status !== 'uploading') return false
  const startedAt = new Date(String(item.last_attempt_at || item.uploaded_at || item.created_at || '')).getTime()
  return Number.isFinite(startedAt) && now - startedAt > 2 * 60 * 1000
}

export default function InspectionCompleteScreen(props: Props) {
  const { t } = useI18n()
  const { token } = useAuth()
  const insets = useSafeAreaInsets()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [lockboxItem, setLockboxItem] = useState<InspectionMediaQueueItem | null>(null)
  const [missing, setMissing] = useState<string[]>([])
  const [validationReady, setValidationReady] = useState(false)
  const [panelBatchStatus, setPanelBatchStatus] = useState<InspectionPanelBatchStatus | null>(null)
  const [panelBatchError, setPanelBatchError] = useState<string | null>(null)
  const [panelVideoReadiness, setPanelVideoReadiness] = useState<InspectionPanelVideoReadiness>({
    ready: false,
    reason: '请先完成检查与补充照片。',
    skipInspectionPhotos: false,
  })

  const task = useMemo(() => getWorkTasksSnapshot().items.find(x => x.id === props.route.params.taskId) || null, [props.route.params.taskId])
  const serverActions = Array.isArray((task as any)?.available_actions) ? (((task as any).available_actions || []) as any[]) : null
  const accessVideoAction = serverActions?.find((action) => String(action?.id || '') === 'upload_access_video') || null
  const submitInspectionAction = serverActions?.find((action) => String(action?.id || '') === 'submit_inspection') || null
  const actionSourceId = cleanText(accessVideoAction?.source_id)
  const inspectionPanelSourceId = cleanText(submitInspectionAction?.source_id) || cleanText(props.route.params.sourceId) || actionSourceId || cleanText(task?.source_id)
  const cleaningTaskId = cleanText(props.route.params.sourceId) || actionSourceId || cleanText(task?.source_id)
  const [lockboxDeleted, setLockboxDeleted] = useState(false)
  const lockboxFromTask = lockboxDeleted ? '' : String((task as any)?.lockbox_video_url || '').trim()
  const effectiveLockboxUrl = String(lockboxItem?.uploaded_url || lockboxItem?.local_uri || lockboxFromTask || '').trim() || null
  const lockboxSaved = !!lockboxItem?.business_saved || !!lockboxFromTask
  const checkinTime = String((task as any)?.end_time || (task as any)?.checkin_time || '').trim()
  const routeSkipInspectionPhotos = props.route.params.skipInspectionPhotos === true
  const isEarlyCheckinSkipAttempt = routeSkipInspectionPhotos && isEarlyCheckinTime(checkinTime)
  const isPasswordOnlyInspection = isPasswordOnlyInspectionTask(task as any)
  const inspectionScopeNoticeStyles = noticeToneStylePair(getInspectionScopeTone(isPasswordOnlyInspection))
  const oldCode = String((task as any)?.old_code || '').trim()
  const newCode = String((task as any)?.new_code || '').trim()
  const accessVideoDeniedReason = serverActions
    ? accessVideoAction?.enabled
      ? ''
      : actionDisabledReasonText(accessVideoAction?.disabled_reason || '当前任务没有可提交的访问凭证操作')
    : ''
  const canOpenInspectionPanel = !isPasswordOnlyInspection && (!serverActions || submitInspectionAction?.enabled === true)

  const reloadLockboxItem = useCallback(async () => {
    if (!cleaningTaskId) {
      setLockboxItem(null)
      return
    }
    const items = await listInspectionMediaQueueItemsForTask(cleaningTaskId, ['lockbox_video'])
    const latest = items.sort((a, b) => b.created_at.localeCompare(a.created_at))[0] || null
    setLockboxItem(latest)
  }, [cleaningTaskId])
  const refresh = useCallback(async () => {
    if (!cleaningTaskId) return
    try {
      setLoading(true)
      setValidationReady(false)
      const needs: string[] = []
      if (!isPasswordOnlyInspection && inspectionPanelSourceId) {
        await bindInspectionPanelCleaningTaskId({
          task_id: props.route.params.taskId,
          cleaning_task_id: inspectionPanelSourceId,
          property_id: cleanText((task as any)?.property_id || (task as any)?.property?.id),
          property_code: cleanText((task as any)?.property?.code),
        })
      }
      const batch = isPasswordOnlyInspection ? null : await getInspectionPanelBatch(props.route.params.taskId)
      const status = batch?.status || null
      const videoReadiness = isPasswordOnlyInspection
        ? { ready: true, reason: null, skipInspectionPhotos: true }
        : getInspectionPanelVideoReadiness(batch)
      setPanelBatchStatus(status)
      setPanelBatchError(batch?.last_error || null)
      setPanelVideoReadiness(videoReadiness)
      if (!isPasswordOnlyInspection && !videoReadiness.ready) needs.push(videoReadiness.reason || '检查与补充照片尚未完成本机保存')
      setMissing(needs)
      setValidationReady(true)
    } finally {
      setLoading(false)
    }
  }, [cleaningTaskId, inspectionPanelSourceId, isPasswordOnlyInspection, props.route.params.taskId, task])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    let cancelled = false
    void reloadLockboxItem()
    if (token && cleaningTaskId) {
      void processInspectionMediaQueue(token)
        .catch(() => null)
        .finally(() => {
          if (!cancelled) void reloadLockboxItem()
        })
    }
    const unsubscribe = subscribeInspectionMediaQueue(() => {
      void reloadLockboxItem()
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [cleaningTaskId, reloadLockboxItem, token])

  useEffect(() => {
    const unsubscribe = subscribeInspectionPanelSubmitQueue(() => {
      void refresh()
    })
    return unsubscribe
  }, [refresh])

  useEffect(() => {
    const nav: any = props.navigation as any
    if (!nav || typeof nav.addListener !== 'function') return
    const unsub = nav.addListener('focus', () => {
      refresh()
    })
    return unsub
  }, [props.navigation, refresh])

  async function onUploadVideo() {
    if (!token) return Alert.alert(t('common_error'), '请先登录')
    if (!cleaningTaskId) return Alert.alert(t('common_error'), '缺少任务信息')
    if (accessVideoDeniedReason) return Alert.alert('暂不可操作', accessVideoDeniedReason)
    if (!isPasswordOnlyInspection && !panelVideoReadiness.ready) {
      if (canOpenInspectionPanel) {
        props.navigation.navigate('InspectionPanel', { taskId: task?.id || props.route.params.taskId, ...(inspectionPanelSourceId ? { sourceId: inspectionPanelSourceId } : {}) })
      }
      return
    }
    try {
      setUploading(true)
      const perm = await ImagePicker.requestCameraPermissionsAsync()
      if (!perm.granted) {
        Alert.alert(t('common_error'), '需要相机权限')
        return
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: 'videos',
        videoMaxDuration: 30,
        quality: ImagePicker.UIImagePickerControllerQualityType.High,
      } as any)
      if (res.canceled || !res.assets?.length) return
      const a = res.assets[0] as any
      const uri = String(a.uri || '').trim()
      if (!uri) return
      const name = String(a.fileName || uri.split('/').pop() || `lockbox-${Date.now()}.mov`)
      const mimeType = String(a.mimeType || 'video/quicktime')
      if (lockboxItem && !lockboxItem.business_saved) {
        await removeInspectionMediaItem(lockboxItem.id)
      }
      setLockboxDeleted(false)
      const queued = await enqueueInspectionMediaItem({
        task_id: cleaningTaskId,
        kind: 'lockbox_video',
        source_uri: uri,
        name,
        mime_type: mimeType,
        meta: {},
      })
      setLockboxItem(queued)
      Alert.alert(t('common_ok'), '视频已保存到本机，正在上传并保存任务记录；如果保存失败，可点击完成重试。')
      void processInspectionMediaQueue(token)
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '上传失败'))
    } finally {
      setUploading(false)
    }
  }

  async function onSubmitComplete() {
    if (!token) return Alert.alert(t('common_error'), '请先登录')
    if (!cleaningTaskId) return Alert.alert(t('common_error'), '缺少任务信息')
    if (accessVideoDeniedReason) return Alert.alert('暂不可操作', accessVideoDeniedReason)
    if (!isPasswordOnlyInspection && !panelVideoReadiness.ready) return Alert.alert('请先完成检查与补充', panelVideoReadiness.reason || '请先完成检查与补充照片。')
    const inspectionPhotosPending = !isPasswordOnlyInspection && panelBatchStatus !== 'synced'
    if (lockboxSaved) {
      Alert.alert(t('common_ok'), inspectionPhotosPending ? '视频已保存，检查照片待同步，任务尚未完成。' : '挂钥匙视频已同步完成')
      props.navigation.goBack()
      return
    }
    if (!lockboxItem?.uploaded_url) {
      const expiredWithoutRemote = !!lockboxItem?.local_file_deleted_at && !lockboxItem?.uploaded_url
      if (expiredWithoutRemote) return Alert.alert(t('common_error'), '本地视频已过期清理，请重新拍摄。')
      if (lockboxItem) {
        void processInspectionMediaQueue(token)
        Alert.alert(t('common_ok'), '视频已保存到本机，任务记录尚未保存；请点击完成重试。')
        props.navigation.goBack()
        return
      }
      return Alert.alert(t('common_error'), '请先拍摄视频。')
    }
    try {
      setSubmitting(true)
      const result = await uploadLockboxVideo(token, cleaningTaskId, { media_url: lockboxItem.uploaded_url })
      await updateInspectionMediaItem(lockboxItem.id, {
        business_saved: true,
        business_saved_at: new Date().toISOString(),
        last_error: null,
      })
      const serverFinalizationPending = result?.action_result?.finalization_pending === true
      Alert.alert(
        t('common_ok'),
        !isPasswordOnlyInspection && (inspectionPhotosPending || serverFinalizationPending)
          ? '视频已提交，检查照片待同步，任务尚未完成。'
          : '视频已提交，任务已完成',
      )
      props.navigation.goBack()
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '提交失败'))
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteCurrentLockboxVideo() {
    if (deleting) return
    if (!lockboxItem && !lockboxSaved && !lockboxFromTask) return
    if (!task) return Alert.alert(t('common_error'), '缺少任务信息')
    if (lockboxSaved && !token) return Alert.alert(t('common_error'), '请先登录')
    if (!cleaningTaskId) return Alert.alert(t('common_error'), '缺少任务信息')
    try {
      setDeleting(true)
      if (lockboxSaved) {
        await deleteLockboxVideo(token as string, cleaningTaskId)
      }
      if (lockboxItem) await removeInspectionMediaItem(lockboxItem.id)
      setLockboxItem(null)
      setLockboxDeleted(true)
      await patchWorkTaskItem(String(task.id), { status: 'to_inspect', lockbox_video_url: null } as any)
      Alert.alert(t('common_ok'), lockboxSaved ? '已删除视频，任务已恢复为待检查。' : '已删除本机待上传视频。')
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '删除失败'))
    } finally {
      setDeleting(false)
    }
  }

  async function retryLockboxUpload() {
    if (!token) return Alert.alert(t('common_error'), '请先登录')
    if (!lockboxItem || lockboxSaved) return
    await updateInspectionMediaItem(lockboxItem.id, {
      upload_status: lockboxItem.uploaded_url ? 'uploaded' : 'pending',
      last_error: null,
    })
    void processInspectionMediaQueue(token)
  }

  function onDeleteLockboxVideo() {
    Alert.alert(
      '删除视频',
      lockboxSaved
        ? '删除后任务会恢复为待检查，需要重新拍摄并提交。确定删除吗？'
        : '确定删除本机待上传视频吗？',
      [
        { text: t('common_cancel'), style: 'cancel' },
        { text: '删除', style: 'destructive', onPress: () => { void deleteCurrentLockboxVideo() } },
      ],
    )
  }

  const canComplete = !accessVideoDeniedReason
    && (isPasswordOnlyInspection || panelVideoReadiness.ready)
    && !!lockboxItem
    && !submitting
    && !deleting
    && !lockboxSaved
  const inspectionPhotosPending = !isPasswordOnlyInspection && panelBatchStatus !== 'synced'
  const lockboxUploadStale = staleQueueUpload(lockboxItem)
  const canRetryLockboxUpload = !!lockboxItem && !lockboxSaved && !submitting && !deleting && (lockboxUploadStale || lockboxItem.upload_status === 'failed_retryable')
  const videoCaptureDisabled = uploading
    || deleting
    || submitting
    || !!accessVideoDeniedReason
    || !validationReady
    || (!isPasswordOnlyInspection && !panelVideoReadiness.ready)
  const uploadHint = (() => {
    if (!lockboxItem && lockboxSaved) return '挂钥匙视频已同步完成。'
    if (!lockboxItem) return ''
    if (lockboxSaved) return '挂钥匙视频已同步完成。'
    if (lockboxUploadStale) return '视频上传可能已卡住，视频仍保存在本机，可点击重试上传。'
    if (lockboxItem.upload_status === 'pending' || lockboxItem.upload_status === 'uploading') return '视频已保存到本机，正在自动上传。'
    if (lockboxItem.uploaded_url && !lockboxItem.business_saved && lockboxItem.last_error) {
      return `视频文件已上传，但任务记录保存失败：${lockboxItem.last_error}。请点击“点击完成”重试。`
    }
    if (lockboxItem.last_error) return String(lockboxItem.last_error)
    if (lockboxItem.uploaded_url && !lockboxItem.business_saved) return '视频文件已上传，但任务记录尚未保存。请点击“点击完成”完成保存；系统也会自动重试。'
    if (lockboxItem.local_file_deleted_at && !lockboxItem.uploaded_url) return '本地视频已过期清理，请重新拍摄。'
    return ''
  })()

  if (!task) {
    return (
      <View style={styles.page}>
        <Text style={styles.muted}>{t('common_loading')}</Text>
      </View>
    )
  }

  const scrollBottomPadding = 140 + Math.max(insets.bottom, layoutTokens.spacing.lg)

  return (
    <View style={styles.page}>
    <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingBottom: scrollBottomPadding }]} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <View style={styles.headRow}>
          <AppText style={styles.title} variant="section">标记已完成</AppText>
          <View style={styles.badge}>
            <Ionicons name="home-outline" size={moderateScale(14)} color="#2563EB" />
            <AppText style={styles.badgeText} variant="label" numberOfLines={2} expandable>
              {task.title}
            </AppText>
          </View>
        </View>
        {!validationReady || loading ? (
          <Text style={styles.muted}>正在校验检查与补充状态...</Text>
        ) : missing.length ? (
          <Text style={styles.pending}>{`${missing.join('、')}；请先返回检查与补充完成本机保存后再拍视频。`}</Text>
        ) : isPasswordOnlyInspection ? (
          <View style={[styles.noticeCard, inspectionScopeNoticeStyles.card]}>
            <Ionicons name="flash-outline" size={moderateScale(16)} color={inspectionScopeNoticeStyles.icon} />
            <Text style={[styles.noticeCardText, inspectionScopeNoticeStyles.text]}>此任务为{inspectionScopeLabel((task as any)?.inspection_scope)}，无需重复检查照片或消耗品确认。</Text>
          </View>
        ) : (
          <Text style={panelBatchStatus === 'synced' ? styles.ok : styles.pending}>检查与补充照片已完整保存到本机，可继续拍摄视频</Text>
        )}
        {!isPasswordOnlyInspection && inspectionBatchStatusHint(panelBatchStatus, panelBatchError) ? (
          <Text style={panelBatchStatus === 'failed' || panelBatchStatus === 'partial_failed' ? styles.warn : styles.muted}>
            {inspectionBatchStatusHint(panelBatchStatus, panelBatchError)}
          </Text>
        ) : null}
        {isEarlyCheckinSkipAttempt ? <Text style={styles.warnSmall}>早入住不可跳过检查照片，请返回检查与补充正常拍照。</Text> : null}
        {accessVideoDeniedReason ? <Text style={styles.warnSmall}>{`暂不可操作：${accessVideoDeniedReason}`}</Text> : null}
        {canOpenInspectionPanel ? (
          <Pressable
            onPress={() => props.navigation.navigate('InspectionPanel', { taskId: task.id, ...(inspectionPanelSourceId ? { sourceId: inspectionPanelSourceId } : {}) })}
            style={({ pressed }) => [styles.linkBtn, pressed ? styles.pressed : null]}
          >
            <Text style={styles.linkText}>进入检查与补充</Text>
          </Pressable>
        ) : null}
        {loading ? <Text style={styles.mutedSmall}>{t('common_loading')}</Text> : null}
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHead}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>密码盒 / 给钥匙视频</Text>
          </View>
        </View>
        <Text style={styles.mutedSmall}>
          {isPasswordOnlyInspection
            ? '此任务只需修改密码并拍视频留存；如果现场发现异常，再返回上一页补充问题反馈。视频会先保存到本机，再自动上传并保存；如保存失败会显示具体原因。'
            : '请先完成检查与补充照片并保存到本机，再修改密码盒密码并拍视频；如果是直接把钥匙给客人，也需要拍视频留存。视频会先保存到本机，再自动上传并保存；如保存失败会显示具体原因。'}
        </Text>
        <View style={styles.codePanel}>
          <View style={styles.codeRow}>
            <Text style={styles.codeLabel}>旧密码</Text>
            <Text style={styles.codeValue}>{oldCode || '-'}</Text>
          </View>
          <View style={styles.codeRow}>
            <Text style={styles.codeLabel}>新密码</Text>
            <Text style={[styles.codeValue, newCode ? styles.codeValueStrong : styles.codeValueMissing]}>{newCode || '未填写，请按客服要求修改'}</Text>
          </View>
        </View>
        {effectiveLockboxUrl ? (
          <View style={styles.videoWrap}>
            <Video
              source={{ uri: toAbsoluteUrl(effectiveLockboxUrl) }}
              style={styles.video}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay={false}
              useNativeControls
            />
          </View>
        ) : null}
        {uploadHint ? (
          <Text style={lockboxItem?.last_error ? styles.warn : lockboxItem?.uploaded_url ? styles.ok : styles.pending}>{uploadHint}</Text>
        ) : null}
        {canRetryLockboxUpload ? (
          <Pressable
            onPress={retryLockboxUpload}
            disabled={uploading || submitting || deleting}
            style={({ pressed }) => [styles.retryBtn, pressed ? styles.pressed : null, uploading || submitting || deleting ? styles.disabled : null]}
          >
            <Ionicons name="refresh-outline" size={moderateScale(15)} color="#2563EB" />
            <Text style={styles.retryText}>重试上传</Text>
          </Pressable>
        ) : null}
        {effectiveLockboxUrl || lockboxItem ? (
          <Pressable
            onPress={onDeleteLockboxVideo}
            disabled={deleting || uploading || submitting}
            style={({ pressed }) => [styles.deleteBtn, pressed ? styles.pressed : null, deleting || uploading || submitting ? styles.disabled : null]}
          >
            <Ionicons name="trash-outline" size={moderateScale(15)} color="#B91C1C" />
            <Text style={styles.deleteText}>{deleting ? t('common_loading') : '删除已上传视频'}</Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
    <SafeAreaBottomBar>
      <View style={styles.row}>
        <AppButton
          label={lockboxItem?.uploaded_url ? '重拍视频' : '拍视频并上传'}
          onPress={onUploadVideo}
          disabled={videoCaptureDisabled}
          loading={uploading}
          tone="secondary"
          style={[styles.grayBtn, videoCaptureDisabled ? styles.disabled : null]}
        />
        <AppButton
          label={lockboxSaved
            ? '已同步完成'
            : !isPasswordOnlyInspection && !panelVideoReadiness.ready
              ? '先完成检查与补充'
              : (isPasswordOnlyInspection ? '改密码完成' : inspectionPhotosPending ? '提交视频（任务待完成）' : '点击完成')}
          onPress={onSubmitComplete}
          disabled={!canComplete}
          loading={submitting}
          style={!canComplete ? styles.disabledPrimary : null}
        />
      </View>
    </SafeAreaBottomBar>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F6F7FB' },
  content: { padding: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, borderWidth: hairline(), borderColor: '#EEF0F6', marginBottom: 12 },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  title: { flex: 1, minWidth: 0, fontSize: 16, fontWeight: '900', color: '#111827' },
  badge: { minHeight: 30, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: '#EFF6FF', borderWidth: hairline(), borderColor: '#DBEAFE', flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '70%', flexShrink: 1 },
  badgeText: { color: '#2563EB', fontWeight: '900', flexShrink: 1 },
  ok: { marginTop: 8, color: TASK_TONE_COLORS.success.text, fontWeight: '900' },
  pending: { marginTop: 8, color: TASK_TONE_COLORS.pending.text, fontWeight: '900' },
  warn: { marginTop: 8, color: '#DC2626', fontWeight: '900' },
  warnSmall: { marginTop: 8, color: '#B45309', fontWeight: '900', fontSize: 12 },
  muted: { marginTop: 10, color: '#6B7280', fontWeight: '700' },
  mutedSmall: { marginTop: 8, color: '#6B7280', fontWeight: '700', fontSize: 12 },
  noticeCard: { marginTop: 8, minHeight: 40, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, borderWidth: hairline(), flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  noticeCardText: { flex: 1, minWidth: 0, fontWeight: '900', lineHeight: 18 },
  pressed: { opacity: 0.92 },
  linkBtn: { marginTop: 10, minHeight: layoutTokens.button.height, paddingHorizontal: layoutTokens.button.horizontalPadding, paddingVertical: 0, borderRadius: layoutTokens.button.radius, backgroundColor: '#EFF6FF', borderWidth: hairline(), borderColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  linkText: { fontWeight: '900', color: '#2563EB', textAlign: 'center' },

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontWeight: '900', color: '#111827' },
  codePanel: { marginTop: 10, borderRadius: 12, borderWidth: hairline(), borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', padding: 10, gap: 8 },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  codeLabel: { color: '#6B7280', fontWeight: '900' },
  codeValue: { flex: 1, minWidth: 0, color: '#111827', fontWeight: '900', textAlign: 'right' },
  codeValueStrong: { color: '#2563EB' },
  codeValueMissing: { color: '#B45309' },
  previewBtn: { marginTop: 10, minHeight: layoutTokens.button.height, paddingHorizontal: layoutTokens.button.horizontalPadding, paddingVertical: 0, borderRadius: layoutTokens.button.radius, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  previewText: { fontWeight: '900', color: '#111827', textAlign: 'center' },
  videoWrap: { marginTop: 12, borderRadius: 14, overflow: 'hidden', borderWidth: hairline(), borderColor: '#EEF0F6', backgroundColor: '#0B0F17' },
  video: { width: '100%', height: 220, backgroundColor: '#0B0F17' },
  deleteBtn: { marginTop: 10, minHeight: layoutTokens.button.height, paddingHorizontal: layoutTokens.button.horizontalPadding, paddingVertical: 0, borderRadius: layoutTokens.button.radius, backgroundColor: '#FEF2F2', borderWidth: hairline(), borderColor: '#FECACA', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: layoutTokens.button.gap, alignSelf: 'flex-start' },
  deleteText: { fontWeight: '900', color: '#B91C1C', textAlign: 'center' },
  retryBtn: { marginTop: 10, minHeight: layoutTokens.button.height, paddingHorizontal: layoutTokens.button.horizontalPadding, paddingVertical: 0, borderRadius: layoutTokens.button.radius, backgroundColor: '#EFF6FF', borderWidth: hairline(), borderColor: '#DBEAFE', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: layoutTokens.button.gap, alignSelf: 'flex-start' },
  retryText: { fontWeight: '900', color: '#2563EB', textAlign: 'center' },

  row: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  grayBtn: { flex: 1, flexShrink: 1, minWidth: 140, minHeight: layoutTokens.button.height, borderRadius: layoutTokens.button.radius, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', paddingHorizontal: layoutTokens.button.horizontalPadding, paddingVertical: 0 },
  grayText: { fontWeight: '900', color: '#111827', textAlign: 'center' },
  primaryBtn: { flex: 1, flexShrink: 1, minWidth: 140, minHeight: layoutTokens.button.height, borderRadius: layoutTokens.button.radius, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', paddingHorizontal: layoutTokens.button.horizontalPadding, paddingVertical: 0 },
  primaryText: { fontWeight: '900', color: '#FFFFFF', textAlign: 'center' },
  disabled: { opacity: 0.65 },
  disabledPrimary: { backgroundColor: '#93C5FD' },
})
