import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import * as ImagePicker from 'expo-image-picker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../../lib/auth'
import { cleaningTaskTitleSuffix, effectiveInspectionMode, inspectionModeLabel, inspectionScopeLabel, isKeyHandoverExecutionTask, isPasswordOnlyInspectionTask, isSelfCompleteMode, isStayoverTaskType } from '../../lib/cleaningInspection'
import { useI18n } from '../../lib/i18n'
import {
  discardKeyUpload,
  enqueueKeyUpload,
  getKeyUploadQueueItem,
  getKeyUploadVisibleError,
  processKeyUploadQueue,
  selectKeyPhotoEffectiveState,
  subscribeKeyUploadQueue,
  type KeyUploadQueueItem,
} from '../../lib/keyUploadQueue'
import { hairline, isCompactWidth, moderateScale } from '../../lib/scale'
import { findWorkTaskItemByAnyId, getWorkTasksSnapshot, patchWorkTaskItem, refreshWorkTasksFromServer, type WorkTaskItem, type WorkTasksView, subscribeWorkTasks } from '../../lib/workTasksStore'
import type { TasksStackParamList } from '../../navigation/RootNavigator'
import { deleteKeyPhoto, markGuestCheckedOutByOrder, markGuestCheckedOutByTasks, markWorkTask, updateWorkTaskPhotos, uploadMzappMedia } from '../../lib/api'
import GuestLuggageCard from '../../components/GuestLuggageCard'
import { normalizeHttpUrl } from '../../lib/urls'
import { resolveKeyRequirementTags } from '../../lib/keyRequirementTags'
import {
  checkinTimeForDisplay,
  checkoutTimeForDisplay,
  executionTaskIdsForRole,
  guestRequestForDisplay,
  isEarlyCheckinDisplay,
  isLateCheckinDisplay,
  isLateCheckoutDisplay,
  turnoverDisplayOf,
} from '../../lib/turnoverDisplay'
import { getInspectionModeTone, getInspectionScopeTone, getTaskKindTone, getTaskStatusMeta, TASK_TONE_COLORS, type TaskTone } from '../../lib/taskVisualTheme'
import { buildCleaningMediaImageSource } from '../../lib/cleaningMedia'

type Props = NativeStackScreenProps<TasksStackParamList, 'TaskDetail'>

function taskKindLabel(kind: string) {
  const s = String(kind || '').trim().toLowerCase()
  if (s === 'cleaning') return '清洁'
  if (s === 'inspection') return '检查'
  if (s === 'execution') return '执行'
  if (s === 'maintenance') return '维修'
  if (s === 'deep_cleaning') return '深清'
  if (s === 'offline') return '线下'
  if (s) return s
  return '任务'
}

function taskTagStylePair(tone: TaskTone) {
  if (tone === 'special') return { container: styles.tagSpecial, text: styles.tagSpecialText }
  if (tone === 'pending') return { container: styles.tagPending, text: styles.tagPendingText }
  if (tone === 'danger') return { container: styles.tagDanger, text: styles.tagDangerText }
  if (tone === 'success') return { container: styles.tagSuccess, text: styles.tagSuccessText }
  if (tone === 'info') return { container: styles.tagInfo, text: styles.tagInfoText }
  return { container: styles.tagNormal, text: styles.tagNormalText }
}

function statusPillStylePair(tone: TaskTone) {
  if (tone === 'special') return { pill: styles.statusPurple, text: styles.statusTextPurple }
  if (tone === 'pending') return { pill: styles.statusAmber, text: styles.statusTextAmber }
  if (tone === 'success') return { pill: styles.statusGreen, text: styles.statusTextGreen }
  if (tone === 'neutral') return { pill: styles.statusGray, text: styles.statusTextGray }
  return { pill: styles.statusBlue, text: styles.statusTextBlue }
}

function extractFirstUrl(text: any) {
  const s = String(text || '')
  const m = s.match(/https?:\/\/[^\s)]+/i)
  return m?.[0] ? String(m[0]) : null
}

function stripPhotoLines(text: any) {
  const s = String(text || '').trim()
  if (!s) return ''
  const lines = s
    .split('\n')
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .filter((x) => !/^照片\s*\d*\s*:/i.test(x))
  return lines.join('\n').trim()
}

function photoUrlsFromText(text: any) {
  const s = String(text || '').trim()
  if (!s) return []
  return Array.from(
    new Set(
      s
        .split('\n')
        .map((line) => String(line || '').trim())
        .filter((line) => /^照片\s*\d*\s*:/i.test(line))
        .map((line) => extractFirstUrl(line))
        .filter(Boolean)
        .map((url) => String(url || '').trim()),
    ),
  )
}

function normalizePhotoUrls(input: any) {
  const values = Array.isArray(input) ? input : []
  return Array.from(new Set(values.map((item) => String(item || '').trim()).filter(Boolean)))
}

function urgencyMeta(value: any) {
  const s = String(value || '').trim().toLowerCase()
  if (!s) return null
  if (s === 'urgent') return { text: '紧急', pill: styles.urgencyUrgent, textStyle: styles.urgencyUrgentText }
  if (s === 'high') return { text: '高优先', pill: styles.urgencyHigh, textStyle: styles.urgencyHighText }
  if (s === 'medium') return null
  if (s === 'low') return { text: '低优先', pill: styles.urgencyLow, textStyle: styles.urgencyLowText }
  return { text: s.toUpperCase(), pill: styles.urgencyMedium, textStyle: styles.urgencyMediumText }
}

function isManagerRole(role: string) {
  const r = String(role || '').trim()
  return r === 'admin' || r === 'offline_manager' || r === 'customer_service'
}

function roleNamesOf(user: any) {
  const values = Array.isArray(user?.roles) ? user.roles : []
  const ids: string[] = values.map((x: any) => String(x || '').trim()).filter(Boolean)
  const primary = String(user?.role || '').trim()
  if (primary) ids.unshift(primary)
  return Array.from(new Set(ids))
}

function ymd(d: Date) {
  const pad2 = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function addDays(d: Date, days: number) {
  const nd = new Date(d)
  nd.setDate(nd.getDate() + days)
  return nd
}

function buildDetailFallbackRange(base = new Date()) {
  return {
    date_from: ymd(addDays(base, -7)),
    date_to: ymd(addDays(base, 7)),
  }
}

function isBeforeToday(taskDate0: any) {
  const taskDate = String(taskDate0 || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(taskDate)) return false
  return taskDate < ymd(new Date())
}

function isCleaningWorkSubmitted(status0: any) {
  const s = String(status0 || '').trim().toLowerCase()
  return ['cleaned', 'restock_pending', 'restocked', 'to_inspect', 'to_hang_keys', 'keys_hung', 'done', 'completed', 'ready'].includes(s)
}

function checkoutTaskIdsFromTask(task: WorkTaskItem | null) {
  if (!task || task.source_type !== 'cleaning_tasks') return []
  return executionTaskIdsForRole(task, 'cleaning')
}

export default function TaskDetailScreen(props: Props) {
  const { t } = useI18n()
  const { user, token } = useAuth()
  const { width, height } = useWindowDimensions()
  const roleNames = useMemo(() => roleNamesOf(user), [user])
  const canManagerView = useMemo(() => roleNames.some(isManagerRole), [roleNames])
  const insets = useSafeAreaInsets()
  const [hasInit, setHasInit] = useState(false)
  const [resolvingRemote, setResolvingRemote] = useState(false)
  const [, bump] = useState(0)
  const id = props.route.params.id
  const action = props.route.params.action
  const [marking, setMarking] = useState(false)
  const [markPhotoUrls, setMarkPhotoUrls] = useState<string[]>([])
  const [taskPhotoUrls, setTaskPhotoUrls] = useState<string[]>([])
  const [taskPhotoSaving, setTaskPhotoSaving] = useState(false)
  const [markNote, setMarkNote] = useState('')
  const [deferReason, setDeferReason] = useState('')
  const [showUnfinished, setShowUnfinished] = useState(false)
  const [keyQueueItem, setKeyQueueItem] = useState<KeyUploadQueueItem | null>(null)
  const [keyUploading, setKeyUploading] = useState(false)
  const [keyDeleting, setKeyDeleting] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [autoUploadKeyDone, setAutoUploadKeyDone] = useState(false)
  const [checkedOutPending, setCheckedOutPending] = useState(false)

  useEffect(() => {
    setHasInit(true)
    const unsub = subscribeWorkTasks(() => bump(v => v + 1))
    bump(v => v + 1)
    return () => {
      unsub()
    }
  }, [])

  const items = getWorkTasksSnapshot().items
  const task = useMemo<WorkTaskItem | null>(() => findWorkTaskItemByAnyId(id), [id, items])
  const previewSize = useMemo(() => ({ width, height }), [height, width])
  const previewSource = useMemo(() => (previewUrl ? buildCleaningMediaImageSource(token, previewUrl) : null), [previewUrl, token])
  const taskPhotoUrlsKey = useMemo(() => JSON.stringify(normalizePhotoUrls((task as any)?.photo_urls)), [task])
  const isCompactLayout = isCompactWidth(width)
  const guestLuggage = (task as any)?.guest_luggage || null
  const cleaningTaskId = String((task as any)?.source_id || '').trim()

  const reloadKeyQueueItem = useCallback(async () => {
    if (!cleaningTaskId) {
      setKeyQueueItem(null)
      return
    }
    setKeyQueueItem(await getKeyUploadQueueItem(cleaningTaskId))
  }, [cleaningTaskId])

  useEffect(() => {
    if (!task) return
    setMarkPhotoUrls(normalizePhotoUrls((task as any).completion_photo_urls).length ? normalizePhotoUrls((task as any).completion_photo_urls) : photoUrlsFromText(task.summary))
    setTaskPhotoUrls(normalizePhotoUrls((task as any).photo_urls))
    setMarkNote(String((task as any).completion_note || '').trim())
    setDeferReason(String((task as any).completion_reason || '').trim())
    setShowUnfinished(false)
  }, [task?.id, taskPhotoUrlsKey])

  useEffect(() => {
    if (!hasInit) return
    if (task) return
    if (!token || !user?.id) return
    let cancelled = false
    const view: WorkTasksView = canManagerView ? 'all' : 'mine'
    const { date_from, date_to } = buildDetailFallbackRange()
    setResolvingRemote(true)
    refreshWorkTasksFromServer({ token, userId: String(user.id), date_from, date_to, view })
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setResolvingRemote(false)
      })
    return () => {
      cancelled = true
    }
  }, [canManagerView, hasInit, id, task, token, user?.id])

  useEffect(() => {
    void reloadKeyQueueItem()
    const unsubscribe = subscribeKeyUploadQueue(() => {
      void reloadKeyQueueItem()
    })
    return unsubscribe
  }, [reloadKeyQueueItem])

  async function onUploadKey() {
    if (!task) return
    if (!token) {
      Alert.alert(t('common_error'), '请先登录')
      return
    }
    if (task.source_type !== 'cleaning_tasks') {
      Alert.alert(t('common_error'), '仅清洁/检查任务支持上传钥匙')
      return
    }
    if (keyUploading) return
    setKeyUploading(true)
    try {
      try {
        const perm = await ImagePicker.requestCameraPermissionsAsync()
        if (!perm.granted) {
          Alert.alert('需要相机权限', '请在系统设置中允许相机权限后再拍照', [
            { text: '取消', style: 'cancel' },
            { text: '去设置', onPress: () => Linking.openSettings() },
          ])
          return
        }
      } catch {}

      let res: ImagePicker.ImagePickerResult
      try {
        res = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.75, allowsEditing: false })
      } catch {
        Alert.alert(t('common_error'), '无法打开相机（模拟器不支持相机拍照，请用真机测试）')
        return
      }
      if (res.canceled || !res.assets?.length) return
      const a = res.assets[0] as any
      const uri = String(a.uri || '').trim()
      if (!uri) return

      const propertyCode = String((task as any)?.property?.code || '').trim()
      const now = new Date()
      const pad2 = (n: number) => String(n).padStart(2, '0')
      const watermarkTime = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`
      const username = String((user as any)?.username || '').trim()
      const watermarkText = `${propertyCode || '未知房号'}  ${username || '未知用户'}\n${watermarkTime}`
      const capturedAt = now.toISOString()

      try {
        await enqueueKeyUpload({
          cleaning_task_id: String(task.source_id),
          source_uri: uri,
          property_code: propertyCode,
          captured_at: capturedAt,
          watermark_text: watermarkText,
          file_name: String(a.fileName || uri.split('/').pop() || `key-${Date.now()}.jpg`),
          mime_type: String(a.mimeType || 'image/jpeg'),
        })
        await reloadKeyQueueItem()
        void processKeyUploadQueue(token)
        Alert.alert(t('common_ok'), '钥匙照片已暂存，正在同步。')
      } catch (e: any) {
        Alert.alert(t('common_error'), String(e?.message || '保存失败'))
      }
    } finally {
      setKeyUploading(false)
    }
  }

  async function onDeleteKey() {
    if (!task) return
    const remoteUrl = String((task as any).key_photo_url || '').trim()
    if (!token && remoteUrl) {
      Alert.alert(t('common_error'), '请先登录')
      return
    }
    if (task.source_type !== 'cleaning_tasks') return
    if (keyDeleting) return
    setKeyDeleting(true)
    try {
      if (remoteUrl) {
        await deleteKeyPhoto(token as string, String(task.source_id))
      }
      await discardKeyUpload(String(task.source_id), { deleteLocalFile: true })
      await reloadKeyQueueItem()
      Alert.alert(t('common_ok'), remoteUrl ? '已删除钥匙照片' : '已删除待同步钥匙照片')
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '删除失败'))
    } finally {
      setKeyDeleting(false)
    }
  }

  async function ensureCameraPerm() {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync()
      return !!perm.granted
    } catch {
      return false
    }
  }

  async function ensureLibraryPerm() {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
      return !!perm.granted
    } catch {
      return false
    }
  }

  async function onAppendPhotosForMarking(source: 'camera' | 'library') {
    if (!task) return
    if (!token) {
      Alert.alert(t('common_error'), '请先登录')
      return
    }
    const permitted = source === 'camera' ? await ensureCameraPerm() : await ensureLibraryPerm()
    if (!permitted) {
      Alert.alert(t('common_error'), source === 'camera' ? '请先开启相机权限' : '请先开启相册权限')
      return
    }
    const uploaded: string[] = []
    let applied = false
    const applyUploaded = () => {
      if (!uploaded.length || applied) return
      applied = true
      setMarkPhotoUrls((prev) => normalizePhotoUrls([...prev, ...uploaded]))
    }
    try {
      setMarking(true)
      const continuousCamera = source === 'camera' && String(task.task_kind || '').trim().toLowerCase() === 'deep_cleaning'
      let keepCapturing = true
      while (keepCapturing) {
        const res =
          source === 'camera'
            ? await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.75, allowsEditing: false })
            : await ImagePicker.launchImageLibraryAsync({
                mediaTypes: 'images',
                quality: 0.75,
                allowsEditing: false,
                allowsMultipleSelection: true,
                selectionLimit: 0,
              })
        if (res.canceled || !res.assets?.length) break
        for (const asset of res.assets as any[]) {
          const uri = String(asset?.uri || '').trim()
          if (!uri) continue
          const name = String(asset?.fileName || uri.split('/').pop() || `task-${Date.now()}.jpg`)
          const mimeType = String(asset?.mimeType || 'image/jpeg')
          const up = await uploadMzappMedia(token, { uri, name, mimeType })
          uploaded.push(up.url)
        }
        keepCapturing = continuousCamera
      }
      if (!uploaded.length) return
      applyUploaded()
      if (!continuousCamera) Alert.alert(t('common_ok'), uploaded.length > 1 ? `已上传 ${uploaded.length} 张照片` : '照片已上传')
    } catch (e: any) {
      applyUploaded()
      Alert.alert(t('common_error'), String(e?.message || '上传失败'))
    } finally {
      setMarking(false)
    }
  }

  function removeMarkPhoto(index: number) {
    setMarkPhotoUrls((prev) => prev.filter((_, idx) => idx !== index))
  }

  async function saveTaskPhotos(nextUrls: string[]) {
    if (!task) return
    if (!token) throw new Error('请先登录')
    const normalized = normalizePhotoUrls(nextUrls)
    const result = await updateWorkTaskPhotos(token, String(task.id), { photo_urls: normalized })
    const saved = normalizePhotoUrls(result.photo_urls)
    setTaskPhotoUrls(saved)
    await patchWorkTaskItem(String(task.id), { photo_urls: saved } as any)
  }

  async function onAppendTaskPhotos(source: 'camera' | 'library') {
    if (!task) return
    if (!token) {
      Alert.alert(t('common_error'), '请先登录')
      return
    }
    const permitted = source === 'camera' ? await ensureCameraPerm() : await ensureLibraryPerm()
    if (!permitted) {
      Alert.alert(t('common_error'), source === 'camera' ? '请先开启相机权限' : '请先开启相册权限')
      return
    }
    const uploaded: string[] = []
    try {
      setTaskPhotoSaving(true)
      const res =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.75, allowsEditing: false })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: 'images',
              quality: 0.75,
              allowsEditing: false,
              allowsMultipleSelection: true,
              selectionLimit: 0,
            })
      if (res.canceled || !res.assets?.length) return
      for (const asset of res.assets as any[]) {
        const uri = String(asset?.uri || '').trim()
        if (!uri) continue
        const name = String(asset?.fileName || uri.split('/').pop() || `offline-task-${Date.now()}.jpg`)
        const mimeType = String(asset?.mimeType || 'image/jpeg')
        const up = await uploadMzappMedia(token, { uri, name, mimeType })
        uploaded.push(up.url)
      }
      if (!uploaded.length) return
      await saveTaskPhotos([...taskPhotoUrls, ...uploaded])
      Alert.alert(t('common_ok'), uploaded.length > 1 ? `已上传 ${uploaded.length} 张照片` : '照片已上传')
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '上传失败'))
    } finally {
      setTaskPhotoSaving(false)
    }
  }

  async function removeTaskPhoto(index: number) {
    if (taskPhotoSaving) return
    try {
      setTaskPhotoSaving(true)
      await saveTaskPhotos(taskPhotoUrls.filter((_, idx) => idx !== index))
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '删除失败'))
    } finally {
      setTaskPhotoSaving(false)
    }
  }

  async function onMarkDone() {
    if (!task) return
    if (!token) {
      Alert.alert(t('common_error'), '请先登录')
      return
    }
    if (requiresMarkPhotos && !effectiveMarkPhotoUrls.length) {
      Alert.alert(t('common_error'), '请先拍照上传')
      return
    }
    try {
      setMarking(true)
      const note = markNote.trim() || null
      await markWorkTask(token, String(task.id), {
        action: 'done',
        photo_url: effectiveMarkPhotoUrls[0] || null,
        photo_urls: effectiveMarkPhotoUrls,
        note,
      })
      await patchWorkTaskItem(String(task.id), { status: 'done', completion_photo_urls: effectiveMarkPhotoUrls, completion_note: note, completion_reason: null } as any)
      Alert.alert(t('common_ok'), '已标记完成')
      props.navigation.goBack()
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '提交失败'))
    } finally {
      setMarking(false)
    }
  }

  async function onMarkDefer() {
    if (!task) return
    if (!token) {
      Alert.alert(t('common_error'), '请先登录')
      return
    }
    if (requiresMarkPhotos && !effectiveMarkPhotoUrls.length) {
      Alert.alert(t('common_error'), '请先拍照上传')
      return
    }
    const r = deferReason.trim()
    if (!r) {
      Alert.alert(t('common_error'), '请填写未完成原因')
      return
    }
    try {
      setMarking(true)
      const note = markNote.trim() || null
      await markWorkTask(token, String(task.id), {
        action: 'defer',
        photo_url: effectiveMarkPhotoUrls[0] || null,
        photo_urls: effectiveMarkPhotoUrls,
        reason: r,
        note,
      })
      await patchWorkTaskItem(String(task.id), { status: 'todo', completion_photo_urls: effectiveMarkPhotoUrls, completion_note: note, completion_reason: r } as any)
      Alert.alert(t('common_ok'), '已挪到下次')
      props.navigation.goBack()
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '提交失败'))
    } finally {
      setMarking(false)
    }
  }

  useEffect(() => {
    if (!task) return
    if (action !== 'upload_key') return
    if (autoUploadKeyDone) return
    props.navigation.setParams({ action: undefined })
    setAutoUploadKeyDone(true)
    ;(async () => {
      await onUploadKey()
    })()
  }, [action, task, autoUploadKeyDone, props.navigation])

  if (!hasInit) {
    return (
      <View style={styles.page}>
        <Text style={styles.muted}>{t('common_loading')}</Text>
      </View>
    )
  }

  if (!task) {
    return (
      <View style={styles.page}>
        <Text style={styles.muted}>{resolvingRemote ? t('common_loading') : t('common_error')}</Text>
      </View>
    )
  }

  const meta = getTaskStatusMeta(task, roleNames)
  const metaStyles = statusPillStylePair(meta.tone)
  const kind = taskKindLabel(task.task_kind)
  const region = String(task.property?.region || '').trim()
  const code = String(task.property?.code || '').trim()
  const unitType = String(task.property?.unit_type || '').trim()
  const title = `${region ? `${region} ` : ''}${code || task.title || '-'}`.trim()
  const checkoutTime = checkoutTimeForDisplay(task)
  const checkinTime = checkinTimeForDisplay(task)
  const guideUrl = normalizeHttpUrl(task.property?.access_guide_link)
  const taskType = String((task as any).task_type || '').trim().toLowerCase()
  const isCheckoutTask = taskType === 'checkout_clean' || !!checkoutTime
  const turnoverDisplay = turnoverDisplayOf(task)
  const oldCode = String(turnoverDisplay?.old_code || (task as any).old_code || '').trim()
  const newCode = String(turnoverDisplay?.new_code || (task as any).new_code || '').trim()
  const guestSpecialRequest = guestRequestForDisplay(task)
  const urgency = urgencyMeta(task.urgency)
  const isCleaningSource = task.source_type === 'cleaning_tasks'
  const isKeyHandoverTask = isKeyHandoverExecutionTask(task as any)
  const isStayoverTask = isCleaningSource && isStayoverTaskType(taskType)
  const isCleaningOrInspection = isCleaningSource && (String(task.task_kind || '').toLowerCase() === 'cleaning' || String(task.task_kind || '').toLowerCase() === 'inspection' || isKeyHandoverTask)
  const wifiSsid = String((task as any)?.property?.wifi_ssid || '').trim()
  const wifiPassword = String((task as any)?.property?.wifi_password || '').trim()
  const hasCheckout = !!checkoutTime
  const hasCheckin = !!checkinTime
  const isLateCheckout = hasCheckout && isLateCheckoutDisplay(task, checkoutTime)
  const isEarlyCheckin = hasCheckin && isEarlyCheckinDisplay(task, checkinTime)
  const isLateCheckin = hasCheckin && isLateCheckinDisplay(task, checkinTime)
  const titleSuffix = cleaningTaskTitleSuffix(task as any)
  const title2 = `${title}${titleSuffix ? ` ${titleSuffix}` : ''}`.trim()
  const remoteKeyPhotoUrl = String((task as any).key_photo_url || '').trim() || null
  const pendingKeyPhotoUrl = String(keyQueueItem?.local_uri || keyQueueItem?.uploaded_url || '').trim() || null
  const keyPhotoEffectiveState = selectKeyPhotoEffectiveState({
    key_photo_url: remoteKeyPhotoUrl,
    has_local_pending: !!keyQueueItem,
  })
  const keyPhotoUrl = remoteKeyPhotoUrl || pendingKeyPhotoUrl
  const keyPhotoStatusText = keyPhotoEffectiveState === 'recorded'
    ? '钥匙已正式记录'
    : keyPhotoEffectiveState === 'pending_sync'
      ? '钥匙照片待同步'
      : '未上传钥匙照片'
  const keyPhotoVisibleError = getKeyUploadVisibleError(keyQueueItem?.last_error)
  const lockboxVideoUrl = String((task as any).lockbox_video_url || '').trim() || null
  const taskNote = String((task as any).note || '').trim()
  const checkedOutAt = String((task as any).checked_out_at || '').trim()
  const isCheckedOut = !!checkedOutAt
  const taskDate = String(task.scheduled_date || task.date || '').trim()
  const isHistoricalTask = isBeforeToday(taskDate)
  const keyRequirementTags = resolveKeyRequirementTags(task, { hasCheckout, hasCheckin, isCheckedOut })
  const checkoutSets = keyRequirementTags.checkoutSets
  const checkinSets = keyRequirementTags.checkinSets
  const showCheckout = isCleaningSource && keyRequirementTags.showCheckout
  const showCheckin = isCleaningSource && keyRequirementTags.showCheckin
  const isCleaningTask = isCleaningSource && String(task.task_kind || '').toLowerCase() === 'cleaning'
  const isInspectionTask = isCleaningSource && String(task.task_kind || '').toLowerCase() === 'inspection'
  const isOfflineTask = String(task.task_kind || '').toLowerCase() === 'offline'
  const inspectionMode = effectiveInspectionMode(task as any)
  const inspectionPlanLabel = inspectionModeLabel(inspectionMode, String((task as any).inspection_due_date || '').trim() || null)
  const isPasswordOnlyInspection = isPasswordOnlyInspectionTask(task as any)
  const showInspectionScope = isPasswordOnlyInspection || (isInspectionTask && taskType === 'checkin_clean')
  const inspectionScopeText = isPasswordOnlyInspection ? '仅改密码' : (showInspectionScope ? inspectionScopeLabel((task as any).inspection_scope) : '')
  const stayoverTagStyles = taskTagStylePair('normal')
  const kindTagStyles = taskTagStylePair(getTaskKindTone(task.task_kind))
  const checkoutTagStyles = taskTagStylePair('danger')
  const checkinTagStyles = taskTagStylePair('pending')
  const lateCheckoutTagStyles = taskTagStylePair('danger')
  const earlyCheckinTagStyles = taskTagStylePair('info')
  const inspectionPlanTagStyles = taskTagStylePair(getInspectionModeTone(inspectionMode))
  const inspectionScopeTagStyles = taskTagStylePair(getInspectionScopeTone(isPasswordOnlyInspection))
  const isSelfCompleteEligible = isCleaningTask && isSelfCompleteMode(task as any) && (isCheckoutTask || isStayoverTask)
  const isDirectCompleteEligible = isCleaningTask && (isSelfCompleteEligible || isStayoverTask)
  const isPendingInspectionDecision = isCleaningTask && !isStayoverTask && inspectionMode === 'pending_decision'
  const showInspectionPlanTag = (isCleaningTask || isInspectionTask) && !isStayoverTask && !isPasswordOnlyInspection
  const isCustomerService = roleNames.includes('customer_service')
  const canDeleteKeyPhoto = (roleNames.includes('cleaner') || roleNames.includes('cleaner_inspector')) && isCleaningTask && !!keyPhotoUrl
  const isCleaningSubmitted = isCleaningTask && isCleaningWorkSubmitted(task.status)
  const restockItems = Array.isArray((task as any)?.restock_items) ? ((task as any).restock_items as any[]) : []
  const restockSummary = restockItems
    .map((item) => {
      const label = String(item?.label || item?.item_id || '').trim()
      if (!label) return null
      const qty = item?.qty == null ? null : Number(item.qty)
      const suffix = Number.isFinite(qty as any) && qty ? ` x${qty}` : ''
      return String(item?.status || '').trim() === 'carry_forward'
        ? `${label}${suffix}（上次检查要求下次退房补）`
        : `${label}${suffix}`
    })
    .filter(Boolean) as string[]
  const detailText = (() => {
    if (isCleaningSource) return null
    if (isOfflineTask) return null
    const s = stripPhotoLines(task.summary)
    return s || null
  })()
  const isAlreadyDone = (() => {
    const s = String(task.status || '').trim().toLowerCase()
    return s === 'done' || s === 'completed'
  })()
  const effectiveMarkPhotoUrls = markPhotoUrls
  const requiresMarkPhotos = !isOfflineTask
  const offlineDetail = (() => {
    if (!isOfflineTask) return null
    const code2 = String(task.property?.code || '').trim()
    const t1 = String(task.title || '').trim()
    if (t1 && (!code2 || t1 !== code2) && t1 !== title2) return t1
    const s1 = stripPhotoLines(task.summary)
    if (s1) return s1
    if (!t1) return null
    if (code2 && t1 === code2) return null
    if (t1 === title2) return null
    return t1
  })()
  return (
    <>
    <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, moderateScale(20)) + moderateScale(12) }]} showsVerticalScrollIndicator={false}>
      <GuestLuggageCard
        notice={guestLuggage}
        token={token}
        showAcknowledge={!canManagerView && roleNames.some((role) => ['cleaner', 'cleaner_inspector', 'cleaning_inspector'].includes(role))}
        showAcknowledgementSummary={canManagerView}
        onChanged={(notice) => task ? patchWorkTaskItem(task.id, { guest_luggage: notice } as any) : undefined}
      />

      <View style={styles.card}>
        <View style={[styles.titleRow, isCompactLayout ? styles.titleRowCompact : null]}>
          <Text style={styles.title}>{title2}</Text>
          <View style={[styles.statusPill, metaStyles.pill]}>
            <Text style={[styles.statusText, metaStyles.text]}>{meta.text}</Text>
          </View>
        </View>

        <View style={styles.tagsRow}>
          {isStayoverTask ? (
            <View style={stayoverTagStyles.container}>
              <Text style={stayoverTagStyles.text}>入住中清洁</Text>
            </View>
          ) : (
            <>
              <View style={kindTagStyles.container}>
                <Text style={kindTagStyles.text}>{isKeyHandoverTask ? '执行' : kind}</Text>
              </View>
              {showCheckout ? (
                <View style={checkoutTagStyles.container}>
                  <Text style={checkoutTagStyles.text}>{`请确认已退${Math.max(2, Math.trunc(Number(checkoutSets || 0)))}套钥匙`}</Text>
                </View>
              ) : null}
              {showCheckin ? (
                <View style={checkinTagStyles.container}>
                  <Text style={checkinTagStyles.text}>{`需挂${checkinSets}套钥匙`}</Text>
                </View>
              ) : null}
              {isLateCheckout ? (
                <View style={lateCheckoutTagStyles.container}>
                  <Text style={lateCheckoutTagStyles.text}>晚退房</Text>
                </View>
              ) : null}
              {isEarlyCheckin ? (
                <View style={earlyCheckinTagStyles.container}>
                  <Text style={earlyCheckinTagStyles.text}>早入住</Text>
                </View>
              ) : null}
              {isLateCheckin ? (
                <View style={earlyCheckinTagStyles.container}>
                  <Text style={earlyCheckinTagStyles.text}>晚入住</Text>
                </View>
              ) : null}
              {showInspectionPlanTag ? (
                <View style={inspectionPlanTagStyles.container}>
                  <Text style={inspectionPlanTagStyles.text}>{inspectionPlanLabel}</Text>
                </View>
              ) : null}
              {showInspectionScope ? (
                <View style={inspectionScopeTagStyles.container}>
                  <Text style={inspectionScopeTagStyles.text}>{inspectionScopeText}</Text>
                </View>
              ) : null}
              {urgency ? (
                <View style={[styles.urgencyPill, urgency.pill]}>
                  <Text style={[styles.urgencyText, urgency.textStyle]}>{urgency.text}</Text>
                </View>
              ) : null}
              {unitType ? (
                <View style={styles.tagGray}>
                  <Text style={styles.tagGrayText}>{unitType}</Text>
                </View>
              ) : null}
            </>
          )}
        </View>

        {isDirectCompleteEligible || isPendingInspectionDecision ? (
          <View style={styles.row}>
            <Ionicons name="person-outline" size={moderateScale(14)} color="#9CA3AF" />
            <Text style={styles.rowText}>检查人员：无</Text>
          </View>
        ) : null}

        {unitType && isStayoverTask ? (
          <View style={styles.row}>
            <Ionicons name="bed-outline" size={moderateScale(14)} color="#9CA3AF" />
            <Text style={styles.rowText}>{unitType}</Text>
          </View>
        ) : null}

        {task.property?.address ? (
          <Pressable
            onPress={async () => {
              try {
                await Clipboard.setStringAsync(String(task.property?.address || ''))
                Alert.alert(t('common_ok'), '地址已复制')
              } catch {
                Alert.alert(t('common_error'), '复制失败')
              }
            }}
            style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
          >
            <Ionicons name="location-outline" size={moderateScale(14)} color="#9CA3AF" />
            <Text style={styles.rowText}>{task.property.address}</Text>
            <Ionicons name="copy-outline" size={moderateScale(14)} color="#9CA3AF" />
          </Pressable>
        ) : null}

        {isCleaningOrInspection ? (
          <>
            <Pressable
              onPress={async () => {
                if (!wifiPassword) return
                try {
                  await Clipboard.setStringAsync(wifiPassword)
                  Alert.alert(t('common_ok'), 'Wi‑Fi 密码已复制')
                } catch {
                  Alert.alert(t('common_error'), '复制失败')
                }
              }}
              style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
            >
              <Ionicons name="wifi-outline" size={moderateScale(14)} color="#9CA3AF" />
              <Text style={styles.rowText}>{`Wi‑Fi：${wifiSsid || '-'}  密码：${wifiPassword || '-'}`}</Text>
              {wifiPassword ? <Ionicons name="copy-outline" size={moderateScale(14)} color="#9CA3AF" /> : null}
            </Pressable>
          </>
        ) : null}

        <View style={styles.row}>
          <Ionicons name="calendar-outline" size={moderateScale(14)} color="#9CA3AF" />
          <Text style={styles.rowText}>{task.scheduled_date || task.date}</Text>
        </View>

        {checkoutTime ? (
          <View style={styles.row}>
            <Ionicons name="time-outline" size={moderateScale(14)} color="#9CA3AF" />
            <Text style={styles.rowText}>{`退房时间：${checkoutTime}${checkinTime ? `  入住时间：${checkinTime}` : ''}`}</Text>
          </View>
        ) : null}

        {isCleaningSource ? (
          <View style={styles.row}>
            <Ionicons name="lock-closed-outline" size={moderateScale(14)} color="#9CA3AF" />
            <Text style={styles.rowText}>{`旧密码：${oldCode || '-'}  新密码：${newCode || '-'}`}</Text>
          </View>
        ) : null}

        {showInspectionScope ? (
          <View style={styles.row}>
            <Ionicons name={isPasswordOnlyInspection ? 'flash-outline' : 'checkmark-done-outline'} size={moderateScale(14)} color={TASK_TONE_COLORS[getInspectionScopeTone(isPasswordOnlyInspection)].text} />
            <View style={[styles.inlineTonePill, inspectionScopeTagStyles.container]}>
              <Text style={[styles.inlineTonePillText, inspectionScopeTagStyles.text]}>{`检查执行方式：${inspectionScopeText}`}</Text>
            </View>
          </View>
        ) : null}

        {taskNote ? (
          <View style={styles.row}>
            <Ionicons name="document-text-outline" size={moderateScale(14)} color="#9CA3AF" />
            <Text style={styles.rowText}>{`备注：${taskNote}`}</Text>
          </View>
        ) : null}

        {guestSpecialRequest ? (
          <View style={styles.row}>
            <Ionicons name="chatbubble-ellipses-outline" size={moderateScale(14)} color="#9CA3AF" />
            <Text style={styles.rowText}>{`客人需求：${guestSpecialRequest}`}</Text>
          </View>
        ) : null}

        {restockSummary.length ? (
          <View style={styles.restockWrap}>
            <Text style={styles.sectionTitle}>待补消耗品</Text>
            {restockSummary.map((item, index) => (
              <View key={`${item}-${index}`} style={styles.restockItem}>
                <Text style={styles.restockTitle}>{item}</Text>
                <Text style={styles.restockNote}>进入补品填报或检查与补充时，请优先处理这一项。</Text>
              </View>
            ))}
          </View>
        ) : null}

        {!checkoutTime && checkinTime ? (
          <View style={styles.row}>
            <Ionicons name="time-outline" size={moderateScale(14)} color="#9CA3AF" />
            <Text style={styles.rowText}>{`入住时间：${checkinTime}`}</Text>
          </View>
        ) : null}

        {guideUrl ? (
          <Pressable
            onPress={async () => {
              try {
                await Linking.openURL(guideUrl)
              } catch {
                Alert.alert(t('common_error'), '打开失败')
              }
            }}
            style={({ pressed }) => [styles.linkInlineRow, pressed ? styles.pressed : null]}
          >
            <Ionicons name="open-outline" size={moderateScale(16)} color="#2563EB" />
            <Text style={styles.linkInlineText} numberOfLines={1}>
              查看入住指南
            </Text>
          </Pressable>
        ) : (
          <View style={styles.row}>
            <Ionicons name="open-outline" size={moderateScale(14)} color="#9CA3AF" />
            <Text style={styles.rowText} numberOfLines={1}>
              无入住指南，请联系管理员
            </Text>
          </View>
        )}

        {isCleaningSource && !isStayoverTask && keyPhotoUrl ? (
          <>
            <View style={styles.line} />
            <Text style={styles.sectionTitle}>钥匙照片</Text>
            <Text style={styles.summary}>{keyPhotoStatusText}</Text>
            <Pressable
              onPress={() => setPreviewUrl(keyPhotoUrl)}
              style={({ pressed }) => [styles.photoWrap, pressed ? styles.pressed : null]}
            >
              <Image source={{ uri: keyPhotoUrl }} style={styles.photo} resizeMode="contain" />
            </Pressable>
            {keyPhotoVisibleError ? <Text style={styles.summary}>{keyPhotoVisibleError}</Text> : null}
            {canDeleteKeyPhoto ? (
              <Pressable
                onPress={() =>
                  Alert.alert('确认删除？', '删除后需要重新上传钥匙照片。', [
                    { text: '取消', style: 'cancel' },
                    { text: '删除', style: 'destructive', onPress: onDeleteKey },
                  ])
                }
                disabled={keyDeleting}
                style={({ pressed }) => [styles.dangerBtn, pressed ? styles.pressed : null, keyDeleting ? styles.actionBtnDisabled : null]}
              >
                <Text style={styles.dangerText}>{keyDeleting ? '删除中...' : '删除钥匙照片'}</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}

        {isKeyHandoverTask ? (
          <View style={[styles.actionsRow, isCompactLayout ? styles.actionsRowCompact : null]}>
            <Pressable
              onPress={() => props.navigation.navigate('InspectionComplete', { taskId: task.id, skipInspectionPhotos: true })}
              style={({ pressed }) => [styles.actionBtn, isCompactLayout ? styles.actionBtnCompact : null, pressed ? styles.pressed : null]}
            >
              <Text style={styles.actionText}>上传视频并完成</Text>
            </Pressable>
            <Pressable
              onPress={() => props.navigation.navigate('FeedbackForm', { taskId: task.id })}
              style={({ pressed }) => [styles.actionBtn, isCompactLayout ? styles.actionBtnCompact : null, pressed ? styles.pressed : null]}
            >
              <Text style={styles.actionText}>{t('tasks_btn_repair')}</Text>
            </Pressable>
          </View>
        ) : isCleaningTask ? (
          <View style={[styles.actionsRow, isCompactLayout ? styles.actionsRowCompact : null]}>
            {isCustomerService ? (
              <>
                {isCheckoutTask ? (
                  <Pressable
                    onPress={async () => {
                      if (isHistoricalTask) return
                      if (!token) return
                      const nextCheckedOutAt = isCheckedOut ? null : new Date().toISOString()
                      try {
                        setCheckedOutPending(true)
                        const taskIds = checkoutTaskIdsFromTask(task)
                        await patchWorkTaskItem(String(task.id), { checked_out_at: nextCheckedOutAt } as any)
                        if (taskIds.length) {
                          await markGuestCheckedOutByTasks(token, { task_ids: taskIds, action: isCheckedOut ? 'unset' : 'set' })
                        } else {
                          const orderId = String((task as any)?.order_id_checkout || (task as any)?.order_id || '').trim()
                          if (!orderId) throw new Error('缺少订单ID')
                          await markGuestCheckedOutByOrder(token, { order_id: orderId, action: isCheckedOut ? 'unset' : 'set' })
                        }
                        Alert.alert(t('common_ok'), isCheckedOut ? '已取消退房' : '已标记已退房')
                        props.navigation.goBack()
                      } catch (e: any) {
                        await patchWorkTaskItem(String(task.id), { checked_out_at: checkedOutAt || null } as any)
                        Alert.alert(t('common_error'), String(e?.message || '提交失败'))
                      } finally {
                        setCheckedOutPending(false)
                      }
                    }}
                    disabled={!token || isHistoricalTask || checkedOutPending}
                    style={({ pressed }) => [styles.actionBtn, isCompactLayout ? styles.actionBtnCompact : null, pressed ? styles.pressed : null, isCheckedOut || isHistoricalTask || checkedOutPending ? styles.actionBtnDisabled : null]}
                  >
                    <Text style={[styles.actionText, isCheckedOut || isHistoricalTask || checkedOutPending ? { color: '#6B7280' } : null]}>{checkedOutPending ? '提交中...' : isCheckedOut ? '取消已退房' : '标记已退房'}</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => props.navigation.navigate('FeedbackForm', { taskId: task.id })}
                  style={({ pressed }) => [styles.actionBtn, isCompactLayout ? styles.actionBtnCompact : null, pressed ? styles.pressed : null]}
                >
                  <Text style={styles.actionText}>{t('tasks_btn_repair')}</Text>
                </Pressable>
              </>
            ) : (
              <>
                {!isStayoverTask ? (
                  <Pressable
                    onPress={onUploadKey}
                    disabled={keyUploading || isCleaningSubmitted || keyPhotoEffectiveState !== 'missing'}
                    style={({ pressed }) => [styles.actionBtn, isCompactLayout ? styles.actionBtnCompact : null, pressed ? styles.pressed : null, (keyUploading || keyPhotoEffectiveState !== 'missing') ? styles.actionBtnDisabled : null]}
                  >
                    <Text style={styles.actionText}>
                      {keyUploading
                        ? t('common_loading')
                        : keyPhotoEffectiveState === 'recorded'
                          ? '钥匙已记录'
                          : keyPhotoEffectiveState === 'pending_sync'
                            ? '钥匙待同步'
                            : (isCleaningSubmitted ? '钥匙记录' : t('tasks_btn_upload_key'))}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => {
                    if (isPendingInspectionDecision) return
                    props.navigation.navigate(isDirectCompleteEligible ? 'CleaningSelfComplete' : 'SuppliesForm', { taskId: task.id } as any)
                  }}
                  style={({ pressed }) => [styles.actionBtn, isCompactLayout ? styles.actionBtnCompact : null, pressed ? styles.pressed : null, isPendingInspectionDecision ? styles.actionBtnDisabled : null]}
                >
                  <Text style={styles.actionText}>
                    {isPendingInspectionDecision
                      ? '待确认检查安排'
                      : isCleaningSubmitted
                        ? (isDirectCompleteEligible ? '完成记录' : '补品记录')
                        : (isStayoverTask ? '标记已完成' : (isSelfCompleteEligible ? '补充与完成' : '补品填报'))}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => props.navigation.navigate('FeedbackForm', { taskId: task.id })}
                  style={({ pressed }) => [styles.actionBtn, isCompactLayout ? styles.actionBtnCompact : null, pressed ? styles.pressed : null]}
                >
                  <Text style={styles.actionText}>{t('tasks_btn_repair')}</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : (
          <View style={styles.markWrap}>
            {offlineDetail || detailText ? (
              <View style={styles.detailPanel}>
                <Text style={styles.sectionTitle}>任务内容</Text>
                <Text style={styles.summary}>{offlineDetail || detailText}</Text>
              </View>
            ) : null}
            {isOfflineTask ? (
              <View style={styles.taskPhotosPanel}>
                <Text style={styles.sectionTitle}>任务照片</Text>
                <Text style={styles.mutedSmall}>
                  {taskPhotoUrls.length ? `已添加 ${taskPhotoUrls.length} 张照片，线下执行人可查看` : '可添加现场说明照片给线下执行人查看'}
                </Text>
                <View style={[styles.markUploadRow, isCompactLayout ? styles.actionsRowCompact : null]}>
                  <Pressable onPress={() => onAppendTaskPhotos('camera')} disabled={taskPhotoSaving} style={({ pressed }) => [styles.markBtn, styles.markUploadBtn, isCompactLayout ? styles.actionBtnCompact : null, pressed ? styles.pressed : null, taskPhotoSaving ? styles.markBtnDisabled : null]}>
                    <Text style={styles.markBtnText}>{taskPhotoSaving ? '保存中...' : '拍照添加'}</Text>
                  </Pressable>
                  <Pressable onPress={() => onAppendTaskPhotos('library')} disabled={taskPhotoSaving} style={({ pressed }) => [styles.markBtn, styles.markUploadBtn, isCompactLayout ? styles.actionBtnCompact : null, pressed ? styles.pressed : null, taskPhotoSaving ? styles.markBtnDisabled : null]}>
                    <Text style={styles.markBtnText}>相册添加</Text>
                  </Pressable>
                </View>
                {taskPhotoUrls.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.markPhotoList}>
                    {taskPhotoUrls.map((url, index) => (
                      <View key={`${url}:${index}`} style={styles.markPhotoCard}>
                        <Pressable
                          onPress={() => setPreviewUrl(String(url))}
                          style={({ pressed }) => [styles.markPhotoThumbWrap, pressed ? styles.pressed : null]}
                        >
                          <Image source={buildCleaningMediaImageSource(token, url)} style={styles.markPhotoThumb} resizeMode="cover" />
                        </Pressable>
                        <Pressable onPress={() => removeTaskPhoto(index)} disabled={taskPhotoSaving} style={({ pressed }) => [styles.markPhotoRemoveBtn, pressed ? styles.pressed : null]}>
                          <Ionicons name="close" size={moderateScale(14)} color="#FFFFFF" />
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                ) : null}
              </View>
            ) : null}
            <Text style={styles.sectionTitle}>任务处理</Text>
            <Text style={styles.mutedSmall} numberOfLines={2}>
              {effectiveMarkPhotoUrls.length
                ? `已上传 ${effectiveMarkPhotoUrls.length} 张照片，可继续追加或删除`
                : (requiresMarkPhotos ? '未上传照片（需要拍照/相册上传后才能提交）' : '照片可选，可直接提交，也可补充拍照留档')}
            </Text>
            <View style={[styles.markUploadRow, isCompactLayout ? styles.actionsRowCompact : null]}>
              <Pressable onPress={() => onAppendPhotosForMarking('camera')} disabled={marking} style={({ pressed }) => [styles.markBtn, styles.markUploadBtn, isCompactLayout ? styles.actionBtnCompact : null, pressed ? styles.pressed : null, marking ? styles.markBtnDisabled : null]}>
                <Text style={styles.markBtnText}>拍照上传</Text>
              </Pressable>
              <Pressable onPress={() => onAppendPhotosForMarking('library')} disabled={marking} style={({ pressed }) => [styles.markBtn, styles.markUploadBtn, isCompactLayout ? styles.actionBtnCompact : null, pressed ? styles.pressed : null, marking ? styles.markBtnDisabled : null]}>
                <Text style={styles.markBtnText}>相册上传</Text>
              </Pressable>
            </View>
            {effectiveMarkPhotoUrls.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.markPhotoList}>
                {effectiveMarkPhotoUrls.map((url, index) => (
                  <View key={`${url}:${index}`} style={styles.markPhotoCard}>
                    <Pressable
                      onPress={() => setPreviewUrl(String(url))}
                      style={({ pressed }) => [styles.markPhotoThumbWrap, pressed ? styles.pressed : null]}
                    >
                      <Image source={{ uri: String(url) }} style={styles.markPhotoThumb} resizeMode="cover" />
                    </Pressable>
                    <Pressable onPress={() => removeMarkPhoto(index)} style={({ pressed }) => [styles.markPhotoRemoveBtn, pressed ? styles.pressed : null]}>
                      <Ionicons name="close" size={moderateScale(14)} color="#FFFFFF" />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            ) : null}

            <Text style={styles.label}>备注（可选）</Text>
            <TextInput
              value={markNote}
              onChangeText={setMarkNote}
              style={styles.input}
              placeholder="备注"
              placeholderTextColor="#9CA3AF"
            />

            <View style={[styles.markRow, isCompactLayout ? styles.actionsRowCompact : null]}>
              <Pressable
                onPress={() => {
                  setShowUnfinished(false)
                  onMarkDone()
                }}
                disabled={marking || isAlreadyDone}
                style={({ pressed }) => [styles.markPrimary, isCompactLayout ? styles.actionBtnCompact : null, pressed ? styles.pressed : null, marking || isAlreadyDone ? styles.markBtnDisabled : null]}
              >
                <Text style={styles.markPrimaryText}>标记完成</Text>
              </Pressable>
              <Pressable
                onPress={() => setShowUnfinished(v => !v)}
                disabled={marking}
                style={({ pressed }) => [styles.markBtn, { flex: 1, marginTop: 0 }, isCompactLayout ? styles.actionBtnCompact : null, pressed ? styles.pressed : null, marking ? styles.markBtnDisabled : null]}
              >
                <Text style={styles.markBtnText}>未完成</Text>
              </Pressable>
            </View>

            {showUnfinished ? (
              <>
                <View style={styles.line} />
                <Text style={styles.label}>未完成原因（必填）</Text>
                <TextInput
                  value={deferReason}
                  onChangeText={setDeferReason}
                  style={styles.input}
                  placeholder="未完成原因"
                  placeholderTextColor="#9CA3AF"
                />
                <Pressable onPress={onMarkDefer} disabled={marking} style={({ pressed }) => [styles.markBtn, pressed ? styles.pressed : null, marking ? styles.markBtnDisabled : null]}>
                  <Text style={styles.markBtnText}>提交</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        )}
      </View>
    </ScrollView>
    <Modal visible={!!previewUrl} transparent animationType="fade" onRequestClose={() => setPreviewUrl(null)}>
      <Pressable style={styles.previewBackdrop} onPress={() => setPreviewUrl(null)}>
        <Pressable style={styles.previewCard} onPress={() => {}}>
          <View style={[styles.previewTopRow, { paddingTop: Math.max(10, insets.top) }]}>
            <Pressable onPress={() => setPreviewUrl(null)} style={({ pressed }) => [styles.previewCloseBtn, pressed ? styles.pressed : null]}>
              <Text style={styles.previewCloseText}>关闭</Text>
            </Pressable>
          </View>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.previewScrollContent}
            maximumZoomScale={3}
            minimumZoomScale={1}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            bounces={false}
            centerContent
          >
            {previewSource ? (
              <View style={{ width: previewSize.width, height: Math.max(240, previewSize.height - insets.top - insets.bottom - 80) }}>
                <Image source={previewSource} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
              </View>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F6F7FB' },
  content: { padding: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, borderWidth: hairline(), borderColor: '#EEF0F6' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  titleRowCompact: { alignItems: 'flex-start' },
  title: { flex: 1, minWidth: 0, flexShrink: 1, fontSize: moderateScale(18), lineHeight: moderateScale(23), fontWeight: '900', color: '#111827' },
  statusPill: { minHeight: 26, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statusText: { fontSize: 12, fontWeight: '900', textAlign: 'center' },
  statusBlue: { backgroundColor: TASK_TONE_COLORS.normal.bg },
  statusAmber: { backgroundColor: TASK_TONE_COLORS.pending.bg },
  statusGreen: { backgroundColor: TASK_TONE_COLORS.success.bg },
  statusPurple: { backgroundColor: TASK_TONE_COLORS.special.bg },
  statusGray: { backgroundColor: TASK_TONE_COLORS.neutral.bg },
  statusTextBlue: { color: TASK_TONE_COLORS.normal.text },
  statusTextAmber: { color: TASK_TONE_COLORS.pending.text },
  statusTextGreen: { color: TASK_TONE_COLORS.success.text },
  statusTextPurple: { color: TASK_TONE_COLORS.special.text },
  statusTextGray: { color: TASK_TONE_COLORS.neutral.text },
  tagsRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  tagNormal: { paddingHorizontal: 10, height: 24, borderRadius: 12, backgroundColor: TASK_TONE_COLORS.normal.bg, borderWidth: hairline(), borderColor: TASK_TONE_COLORS.normal.border, alignItems: 'center', justifyContent: 'center' },
  tagNormalText: { fontSize: 11, fontWeight: '900', color: TASK_TONE_COLORS.normal.text },
  tagSpecial: { paddingHorizontal: 10, height: 24, borderRadius: 12, backgroundColor: TASK_TONE_COLORS.special.bg, borderWidth: hairline(), borderColor: TASK_TONE_COLORS.special.border, alignItems: 'center', justifyContent: 'center' },
  tagSpecialText: { fontSize: 11, fontWeight: '900', color: TASK_TONE_COLORS.special.text },
  tagPending: { paddingHorizontal: 10, height: 24, borderRadius: 12, backgroundColor: TASK_TONE_COLORS.pending.bg, borderWidth: hairline(), borderColor: TASK_TONE_COLORS.pending.border, alignItems: 'center', justifyContent: 'center' },
  tagPendingText: { fontSize: 11, fontWeight: '900', color: TASK_TONE_COLORS.pending.text },
  tagDanger: { paddingHorizontal: 10, height: 24, borderRadius: 12, backgroundColor: TASK_TONE_COLORS.danger.bg, borderWidth: hairline(), borderColor: TASK_TONE_COLORS.danger.border, alignItems: 'center', justifyContent: 'center' },
  tagDangerText: { fontSize: 11, fontWeight: '900', color: TASK_TONE_COLORS.danger.text },
  tagSuccess: { paddingHorizontal: 10, height: 24, borderRadius: 12, backgroundColor: TASK_TONE_COLORS.success.bg, borderWidth: hairline(), borderColor: TASK_TONE_COLORS.success.border, alignItems: 'center', justifyContent: 'center' },
  tagSuccessText: { fontSize: 11, fontWeight: '900', color: TASK_TONE_COLORS.success.text },
  tagInfo: { paddingHorizontal: 10, height: 24, borderRadius: 12, backgroundColor: TASK_TONE_COLORS.info.bg, borderWidth: hairline(), borderColor: TASK_TONE_COLORS.info.border, alignItems: 'center', justifyContent: 'center' },
  tagInfoText: { fontSize: 11, fontWeight: '900', color: TASK_TONE_COLORS.info.text },
  urgencyPill: { paddingHorizontal: 10, height: 24, borderRadius: 12, borderWidth: hairline(), alignItems: 'center', justifyContent: 'center' },
  urgencyText: { fontSize: 11, fontWeight: '900' },
  urgencyUrgent: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
  urgencyUrgentText: { color: '#B91C1C' },
  urgencyHigh: { backgroundColor: '#FFF7ED', borderColor: '#FDBA74' },
  urgencyHighText: { color: '#C2410C' },
  urgencyMedium: { backgroundColor: '#EFF6FF', borderColor: '#93C5FD' },
  urgencyMediumText: { color: '#1D4ED8' },
  urgencyLow: { backgroundColor: '#F3F4F6', borderColor: '#D1D5DB' },
  urgencyLowText: { color: '#4B5563' },
  tagGray: { paddingHorizontal: 10, height: 24, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  tagGrayText: { fontSize: 11, fontWeight: '800', color: '#6B7280' },
  row: { marginTop: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  inlineTonePill: { minHeight: 28, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, borderWidth: hairline(), alignItems: 'center', justifyContent: 'center' },
  inlineTonePillText: { fontSize: moderateScale(13), fontWeight: '800' },
  rowText: { flex: 1, minWidth: 0, flexShrink: 1, color: '#6B7280', fontSize: moderateScale(13), fontWeight: '600', lineHeight: moderateScale(19) },
  actionsRow: { marginTop: 14, flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  actionsRowCompact: { flexDirection: 'column' },
  actionBtn: { flex: 1, flexGrow: 1, flexShrink: 1, minWidth: 128, minHeight: 40, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  actionBtnCompact: { width: '100%', flexBasis: '100%', flexGrow: 0 },
  actionBtnDisabled: { backgroundColor: '#E5E7EB' },
  actionText: { flexShrink: 1, fontWeight: '900', color: '#FFFFFF', fontSize: 13, lineHeight: 17, textAlign: 'center' },
  dangerBtn: { marginTop: 10, minHeight: 40, borderRadius: 12, backgroundColor: '#FEF2F2', borderWidth: hairline(), borderColor: '#FCA5A5', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  dangerText: { fontWeight: '900', color: '#B91C1C', fontSize: 13 },
  line: { marginTop: 14, height: hairline(), backgroundColor: '#EEF0F6' },
  sectionTitle: { marginTop: 14, fontSize: 13, fontWeight: '900', color: '#111827' },
  summary: { marginTop: 8, color: '#374151', fontWeight: '700', lineHeight: 18 },
  linkInlineRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  linkInlineText: { flexShrink: 1, minWidth: 0, color: '#2563EB', fontSize: moderateScale(14), fontWeight: '800' },
  photoWrap: { marginTop: 10, borderRadius: 14, overflow: 'hidden', borderWidth: hairline(), borderColor: '#EEF0F6' },
  photo: { width: '100%', height: moderateScale(220), backgroundColor: '#F3F4F6' },
  metaText: { marginTop: 12, color: '#9CA3AF', fontWeight: '700', fontSize: 12 },
  pressed: { opacity: 0.92 },
  muted: { padding: 16, color: '#6B7280', fontWeight: '700' },
  mutedSmall: { marginTop: 8, color: '#6B7280', fontWeight: '700', fontSize: 12 },
  markWrap: { marginTop: 14 },
  detailPanel: { marginBottom: 4 },
  taskPhotosPanel: { marginTop: 4, marginBottom: 4 },
  label: { marginTop: 14, marginBottom: 8, color: '#111827', fontWeight: '900' },
  input: { height: 44, borderRadius: 12, borderWidth: hairline(), borderColor: '#D1D5DB', paddingHorizontal: 12, fontWeight: '700', color: '#111827' },
  markRow: { marginTop: 14, flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  markBtn: { marginTop: 12, minHeight: 40, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  markUploadRow: { marginTop: 12, flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  markUploadBtn: { flex: 1, marginTop: 0 },
  markPhotoList: { gap: 10, paddingTop: 12, paddingBottom: 4 },
  markPhotoCard: { width: moderateScale(112), position: 'relative' },
  markPhotoThumbWrap: { borderRadius: 14, overflow: 'hidden', borderWidth: hairline(), borderColor: '#E5E7EB', backgroundColor: '#F3F4F6' },
  markPhotoThumb: { width: '100%', height: moderateScale(112) },
  markPhotoRemoveBtn: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(17,24,39,0.84)', alignItems: 'center', justifyContent: 'center' },
  markBtnText: { flexShrink: 1, fontWeight: '900', color: '#FFFFFF', fontSize: 13, lineHeight: 17, textAlign: 'center' },
  markPrimary: { flex: 1, flexShrink: 1, minWidth: 128, minHeight: 40, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  markPrimaryText: { flexShrink: 1, color: '#FFFFFF', fontWeight: '900', fontSize: 13, lineHeight: 17, textAlign: 'center' },
  markBtnDisabled: { backgroundColor: '#E5E7EB' },
  restockWrap: { marginTop: 10, gap: 12 },
  restockItem: { padding: 12, borderRadius: 14, backgroundColor: '#F9FAFB', borderWidth: hairline(), borderColor: '#EEF0F6' },
  restockTitle: { color: '#111827', fontWeight: '900' },
  restockNote: { marginTop: 6, color: '#6B7280', fontWeight: '700' },
  videoInline: { width: '100%', height: moderateScale(220), backgroundColor: '#0B0F17' },
  previewBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.86)', padding: 12, justifyContent: 'center' },
  previewCard: { flex: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000000' },
  previewTopRow: { minHeight: 48, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'flex-end', paddingHorizontal: 10 },
  previewCloseBtn: { height: 32, paddingHorizontal: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  previewCloseText: { color: '#FFFFFF', fontWeight: '900' },
  previewScrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
})
