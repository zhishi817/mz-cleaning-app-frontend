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
  getInspectionPanelBatch,
  subscribeInspectionPanelSubmitQueue,
  type InspectionPanelBatchStatus,
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

type Props = NativeStackScreenProps<TasksStackParamList, 'InspectionComplete'>

function inspectionBatchStatusHint(status: InspectionPanelBatchStatus | null) {
  if (status === 'pending_submit') return '检查与补充已正式提交，当前待同步。'
  if (status === 'syncing') return '检查与补充正在同步中，可先继续完成挂钥匙视频。'
  if (status === 'partial_failed') return '检查与补充部分同步失败，可先完成本页，稍后回检查页重试同步。'
  if (status === 'failed') return '检查与补充同步失败，可先完成本页，稍后回检查页重试同步。'
  if (status === 'synced') return '检查与补充已同步完成。'
  return ''
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

  const task = useMemo(() => getWorkTasksSnapshot().items.find(x => x.id === props.route.params.taskId) || null, [props.route.params.taskId])
  const cleaningTaskId = String(task?.source_id || '').trim()
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
      const batch = isPasswordOnlyInspection ? null : await getInspectionPanelBatch(props.route.params.taskId)
      const status = batch?.status || null
      setPanelBatchStatus(status)
      if (!isPasswordOnlyInspection && (!batch || status === 'draft')) needs.push('请先在“检查与补充”页点击正式提交')
      setMissing(needs)
      setValidationReady(true)
    } finally {
      setLoading(false)
    }
  }, [cleaningTaskId, isPasswordOnlyInspection, props.route.params.taskId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    void reloadLockboxItem()
    const unsubscribe = subscribeInspectionMediaQueue(() => {
      void reloadLockboxItem()
    })
    return unsubscribe
  }, [reloadLockboxItem])

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
    if (!validationReady || loading) return Alert.alert(t('common_error'), '正在校验检查与补充状态，请稍候')
    if (missing.length) return Alert.alert(t('common_error'), missing.join('、'))
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
      Alert.alert(t('common_ok'), '视频已保存到本机，联网后会自动上传并保存。')
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
    if (lockboxSaved) {
      Alert.alert(t('common_ok'), '挂钥匙视频已同步完成')
      props.navigation.goBack()
      return
    }
    if (!lockboxItem?.uploaded_url) {
      const expiredWithoutRemote = !!lockboxItem?.local_file_deleted_at && !lockboxItem?.uploaded_url
      return Alert.alert(t('common_error'), expiredWithoutRemote ? '本地视频已过期清理，请重新拍摄。' : '请等待视频上传完成后再提交。')
    }
    try {
      setSubmitting(true)
      await uploadLockboxVideo(token, cleaningTaskId, { media_url: lockboxItem.uploaded_url })
      await updateInspectionMediaItem(lockboxItem.id, {
        business_saved: true,
        business_saved_at: new Date().toISOString(),
        last_error: null,
      })
      Alert.alert(t('common_ok'), '视频已提交，任务已完成')
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

  const canComplete = !!lockboxItem?.uploaded_url && !submitting && !deleting && !lockboxSaved
  const uploadHint = (() => {
    if (!lockboxItem && lockboxSaved) return '挂钥匙视频已同步完成。'
    if (!lockboxItem) return ''
    if (lockboxSaved) return '挂钥匙视频已同步完成。'
    if (lockboxItem.upload_status === 'pending' || lockboxItem.upload_status === 'uploading') return '视频已保存到本机，正在自动上传。'
    if (lockboxItem.uploaded_url && !lockboxItem.business_saved) return '视频已上传，联网恢复后会自动保存；如需立刻完成，也可以手动点击提交。'
    if (lockboxItem.local_file_deleted_at && !lockboxItem.uploaded_url) return '本地视频已过期清理，请重新拍摄。'
    if (lockboxItem.last_error) return String(lockboxItem.last_error)
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
          <Text style={styles.warn}>{`未满足：${missing.join('、')}`}</Text>
        ) : isPasswordOnlyInspection ? (
          <View style={[styles.noticeCard, inspectionScopeNoticeStyles.card]}>
            <Ionicons name="flash-outline" size={moderateScale(16)} color={inspectionScopeNoticeStyles.icon} />
            <Text style={[styles.noticeCardText, inspectionScopeNoticeStyles.text]}>此任务为{inspectionScopeLabel((task as any)?.inspection_scope)}，无需重复检查照片或消耗品确认。</Text>
          </View>
        ) : (
          <Text style={styles.ok}>检查与补充已正式提交，可继续完成当前步骤</Text>
        )}
        {!missing.length && panelBatchStatus && inspectionBatchStatusHint(panelBatchStatus) ? (
          <Text style={panelBatchStatus === 'failed' || panelBatchStatus === 'partial_failed' ? styles.warn : styles.muted}>
            {inspectionBatchStatusHint(panelBatchStatus)}
          </Text>
        ) : null}
        {isEarlyCheckinSkipAttempt ? <Text style={styles.warnSmall}>早入住不可跳过检查照片，请返回检查与补充正常拍照。</Text> : null}
        <Pressable
          onPress={() => props.navigation.navigate('InspectionPanel', { taskId: task.id })}
          style={({ pressed }) => [styles.linkBtn, pressed ? styles.pressed : null]}
        >
          <Text style={styles.linkText}>进入检查与补充</Text>
        </Pressable>
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
            ? '此任务只需修改密码并拍视频留存；如果现场发现异常，再返回上一页补充问题反馈。弱网下视频会先保存在本机，联网后自动上传并保存。'
            : '请先修改密码盒密码并拍视频；如果是直接把钥匙给客人，也需要拍视频留存。弱网下视频会先保存在本机，联网后自动上传并保存。'}
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
          <Text style={lockboxItem?.uploaded_url ? styles.ok : styles.pending}>{uploadHint}</Text>
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
          label={uploading ? t('common_loading') : lockboxItem?.uploaded_url ? '重拍视频' : '拍视频并上传'}
          onPress={onUploadVideo}
          disabled={uploading || deleting || submitting}
          tone="secondary"
          style={[styles.grayBtn, uploading || deleting || submitting ? styles.disabled : null]}
        />
        <AppButton
          label={
            submitting
              ? t('common_loading')
              : lockboxSaved
                ? '已同步完成'
                : (isPasswordOnlyInspection ? '改密码完成' : '点击完成')
          }
          onPress={onSubmitComplete}
          disabled={!canComplete}
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
  linkBtn: { marginTop: 10, minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#EFF6FF', borderWidth: hairline(), borderColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
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
  previewBtn: { marginTop: 10, minHeight: 38, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  previewText: { fontWeight: '900', color: '#111827', textAlign: 'center' },
  videoWrap: { marginTop: 12, borderRadius: 14, overflow: 'hidden', borderWidth: hairline(), borderColor: '#EEF0F6', backgroundColor: '#0B0F17' },
  video: { width: '100%', height: 220, backgroundColor: '#0B0F17' },
  deleteBtn: { marginTop: 10, minHeight: 38, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#FEF2F2', borderWidth: hairline(), borderColor: '#FECACA', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'flex-start' },
  deleteText: { fontWeight: '900', color: '#B91C1C', textAlign: 'center' },

  row: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  grayBtn: { flex: 1, flexShrink: 1, minWidth: 140, minHeight: 44, borderRadius: 12, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  grayText: { fontWeight: '900', color: '#111827', textAlign: 'center' },
  primaryBtn: { flex: 1, flexShrink: 1, minWidth: 140, minHeight: 44, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  primaryText: { fontWeight: '900', color: '#FFFFFF', textAlign: 'center' },
  disabled: { opacity: 0.65 },
  disabledPrimary: { backgroundColor: '#93C5FD' },
})
