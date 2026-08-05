import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import * as ImagePicker from 'expo-image-picker'
import { ResizeMode, Video } from 'expo-av'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { API_BASE_URL } from '../../config/env'
import { useAuth } from '../../lib/auth'
import { cleaningTaskTitleSuffix, effectiveInspectionMode, inspectionModeLabel, inspectionScopeLabel, isCheckinSiteExecutionTask, isKeyHandoverExecutionTask, isPasswordOnlyInspectionTask, isSelfCompleteMode, isStayoverTaskType } from '../../lib/cleaningInspection'
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
import { deleteKeyPhoto, listCleaningAppPropertyCodes, listUsers, markGuestCheckedOutByOrder, markGuestCheckedOutByTasks, markWorkTask, updateCleaningOfflineTask, updateWorkTaskPhotos, uploadMzappMedia } from '../../lib/api'
import GuestLuggageCard from '../../components/GuestLuggageCard'
import { normalizeHttpUrl } from '../../lib/urls'
import { isPropertyFollowupTask, propertyFollowupTaskDetail, propertyFollowupTaskTitle } from '../../lib/propertyFollowupTaskDisplay'
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
import CleaningMediaImage from '../../components/CleaningMediaImage'
import CleaningMediaPreview from '../../components/CleaningMediaPreview'
import AppIconButton from '../../components/ui/AppIconButton'
import { actionDisabledReasonText, availableActionsForTask, navigationForWorkTaskAction } from '../../lib/workTaskActions'
import type { WorkTaskAvailableAction } from '../../lib/api'

type Props = NativeStackScreenProps<TasksStackParamList, 'TaskDetail'>
type OfflineEditUserOption = { id: string; username?: string | null; display_name?: string | null }
type OfflineEditPropertyOption = { id: string; code: string; region?: string | null }

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

function normalizeBase(base: string) {
  return String(base || '').trim().replace(/\/+$/g, '')
}

function toAbsoluteUrl(rawUrl: any) {
  const value = String(rawUrl ?? '').trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith('//')) return `https:${value}`
  const base = normalizeBase(API_BASE_URL)
  const root = base.replace(/\/auth\/?$/g, '').replace(/\/api\/?$/g, '')
  if (!root) return value
  return value.startsWith('/') ? `${root}${value}` : value
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

function offlineEditUserName(user: OfflineEditUserOption) {
  return String(user.display_name || user.username || user.id || '').trim() || user.id
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

function checkoutTaskIdsFromTask(task: WorkTaskItem | null, action?: WorkTaskAvailableAction) {
  if (!task || task.source_type !== 'cleaning_tasks') return []
  const actionSourceId = String(action?.source_id || '').trim()
  if (actionSourceId) return [actionSourceId]
  return executionTaskIdsForRole(task, 'cleaning')
}

export default function TaskDetailScreen(props: Props) {
  const { t } = useI18n()
  const { user, token } = useAuth()
  const { width, height } = useWindowDimensions()
  const roleNames = useMemo(() => roleNamesOf(user), [user])
  const canManagerView = useMemo(() => roleNames.some(isManagerRole), [roleNames])
  const canViewLockboxVideo = useMemo(
    () => roleNames.some((role) => ['admin', 'offline_manager', 'customer_service', 'cleaning_inspector', 'cleaner_inspector'].includes(String(role).trim().toLowerCase())),
    [roleNames],
  )
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
  const [offlineEditOpen, setOfflineEditOpen] = useState(false)
  const [offlineEditBusy, setOfflineEditBusy] = useState(false)
  const [offlineEditLoadingOptions, setOfflineEditLoadingOptions] = useState(false)
  const [offlineEditDate, setOfflineEditDate] = useState('')
  const [offlineEditTitle, setOfflineEditTitle] = useState('')
  const [offlineEditContent, setOfflineEditContent] = useState('')
  const [offlineEditPropertyId, setOfflineEditPropertyId] = useState<string | null>(null)
  const [offlineEditAssigneeId, setOfflineEditAssigneeId] = useState<string | null>(null)
  const [offlineEditUsers, setOfflineEditUsers] = useState<OfflineEditUserOption[]>([])
  const [offlineEditProperties, setOfflineEditProperties] = useState<OfflineEditPropertyOption[]>([])
  const [offlineEditAssigneeOpen, setOfflineEditAssigneeOpen] = useState(false)
  const [offlineEditPropertyOpen, setOfflineEditPropertyOpen] = useState(false)

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
  const taskPhotoUrlsKey = useMemo(() => JSON.stringify(normalizePhotoUrls((task as any)?.photo_urls)), [task])
  const isCompactLayout = isCompactWidth(width)
  const guestLuggage = (task as any)?.guest_luggage || null
  const cleaningTaskId = String((task as any)?.source_id || '').trim()
  const isOfflineTaskForEdit = String(task?.task_kind || '').toLowerCase() === 'offline'
  const canEditOfflineTask = isOfflineTaskForEdit && canManagerView

  useEffect(() => {
    if (!offlineEditOpen || !token || !canEditOfflineTask) return
    let cancelled = false
    setOfflineEditLoadingOptions(true)
    Promise.all([
      listUsers(token).catch(() => []),
      listCleaningAppPropertyCodes(token).catch(() => []),
    ]).then(([userRows, propertyRows]) => {
      if (cancelled) return
      setOfflineEditUsers((Array.isArray(userRows) ? userRows : [])
        .map((item: any) => ({
          id: String(item?.id || '').trim(),
          username: item?.username == null ? null : String(item.username),
          display_name: item?.display_name == null ? null : String(item.display_name),
        }))
        .filter((item) => !!item.id)
        .sort((a, b) => offlineEditUserName(a).localeCompare(offlineEditUserName(b), 'en')))
      setOfflineEditProperties((Array.isArray(propertyRows) ? propertyRows : [])
        .map((item: any) => ({ id: String(item?.id || '').trim(), code: String(item?.code || '').trim(), region: item?.region == null ? null : String(item.region) }))
        .filter((item) => !!item.id))
    }).finally(() => {
      if (!cancelled) setOfflineEditLoadingOptions(false)
    })
    return () => {
      cancelled = true
    }
  }, [canEditOfflineTask, offlineEditOpen, token])

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
        void processKeyUploadQueue(token).then(() => {
          if (!user?.id) return
          const { date_from, date_to } = buildDetailFallbackRange()
          return refreshWorkTasksFromServer({
            token,
            userId: String(user.id),
            date_from,
            date_to,
            view: canManagerView ? 'all' : 'mine',
          }).catch(() => null)
        })
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

  async function onToggleGuestCheckedOut(action?: WorkTaskAvailableAction) {
    if (!task) return
    if (!token) return
    const currentCheckedOutAt = String((task as any).checked_out_at || '').trim()
    const taskDate = String(task.scheduled_date || task.date || '').trim()
    if (isBeforeToday(taskDate)) return
    const nextCheckedOutAt = currentCheckedOutAt ? null : new Date().toISOString()
    try {
      setCheckedOutPending(true)
      const taskIds = checkoutTaskIdsFromTask(task, action)
      await patchWorkTaskItem(String(task.id), { checked_out_at: nextCheckedOutAt } as any)
      if (taskIds.length) {
        await markGuestCheckedOutByTasks(token, { task_ids: taskIds, action: currentCheckedOutAt ? 'unset' : 'set' })
      } else {
        const orderId = String((task as any)?.order_id_checkout || (task as any)?.order_id || '').trim()
        if (!orderId) throw new Error('缺少订单ID')
        await markGuestCheckedOutByOrder(token, { order_id: orderId, action: currentCheckedOutAt ? 'unset' : 'set' })
      }
      Alert.alert(t('common_ok'), currentCheckedOutAt ? '已取消退房' : '已标记已退房')
      props.navigation.goBack()
    } catch (e: any) {
      await patchWorkTaskItem(String(task.id), { checked_out_at: currentCheckedOutAt || null } as any)
      Alert.alert(t('common_error'), String(e?.message || '提交失败'))
    } finally {
      setCheckedOutPending(false)
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
  const followupTitle = isPropertyFollowupTask(task) ? propertyFollowupTaskTitle(task) : ''
  const title = isPropertyFollowupTask(task) && followupTitle
    ? [region ? `${region} ${code}` : code, followupTitle || task.title || '-'].filter(Boolean).join(' · ').trim()
    : `${region ? `${region} ` : ''}${code || task.title || '-'}`.trim()
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
  const isCheckinSiteExecution = isCheckinSiteExecutionTask(task as any)
  const isCleaningOrInspection = isCleaningSource && (String(task.task_kind || '').toLowerCase() === 'cleaning' || String(task.task_kind || '').toLowerCase() === 'inspection' || isKeyHandoverTask || isCheckinSiteExecution)
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
  const selectedOfflineEditAssignee = offlineEditUsers.find((item) => item.id === offlineEditAssigneeId) || null
  const selectedOfflineEditProperty = offlineEditProperties.find((item) => item.id === offlineEditPropertyId) || null

  function openOfflineEdit() {
    if (!task || !canEditOfflineTask) return
    setOfflineEditDate(String(task.scheduled_date || task.date || '').slice(0, 10))
    setOfflineEditTitle(String(task.title || '').trim())
    setOfflineEditContent(stripPhotoLines(task.summary))
    setOfflineEditPropertyId(String(task.property_id || task.property?.id || '').trim() || null)
    setOfflineEditAssigneeId(String(task.assignee_id || '').trim() || null)
    setOfflineEditAssigneeOpen(false)
    setOfflineEditPropertyOpen(false)
    setOfflineEditOpen(true)
  }

  async function saveOfflineEdit() {
    if (!task || !token || !canEditOfflineTask || offlineEditBusy) return
    const date = String(offlineEditDate || '').trim()
    const title0 = String(offlineEditTitle || '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert(t('common_error'), '请输入正确的执行日期（YYYY-MM-DD）')
      return
    }
    if (!title0) {
      Alert.alert(t('common_error'), '请输入任务标题')
      return
    }
    const sourceId = String(task.source_id || '').trim() || String(task.id || '').replace(/^cleaning_offline_tasks:/, '')
    if (!sourceId) return
    setOfflineEditBusy(true)
    try {
      const updated = await updateCleaningOfflineTask(token, sourceId, {
        date,
        title: title0,
        content: String(offlineEditContent || '').trim(),
        property_id: offlineEditPropertyId,
        assignee_id: offlineEditAssigneeId,
      })
      const nextProperty = selectedOfflineEditProperty
        ? {
            id: selectedOfflineEditProperty.id,
            code: selectedOfflineEditProperty.code,
            region: selectedOfflineEditProperty.region || null,
            address: String(task.property?.address || ''),
            unit_type: String(task.property?.unit_type || ''),
          }
        : null
      patchWorkTaskItem(task.id, {
        title: String(updated?.title || title0),
        summary: updated?.content == null ? String(offlineEditContent || '').trim() : String(updated.content || ''),
        scheduled_date: String(updated?.date || date).slice(0, 10),
        date: String(updated?.date || date).slice(0, 10),
        property_id: updated?.property_id == null ? offlineEditPropertyId : updated.property_id,
        property: nextProperty,
        assignee_id: updated?.assignee_id == null ? offlineEditAssigneeId : updated.assignee_id,
        status: String(updated?.status || (offlineEditAssigneeId ? 'assigned' : task.status)),
      } as any)
      setOfflineEditOpen(false)
      Alert.alert(t('common_ok'), '线下任务已保存')
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '保存失败'))
    } finally {
      setOfflineEditBusy(false)
    }
  }

  const inspectionMode = effectiveInspectionMode(task as any)
  const inspectionPlanLabel = inspectionModeLabel(inspectionMode, String((task as any).inspection_due_date || '').trim() || null)
  const isPasswordOnlyInspection = isPasswordOnlyInspectionTask(task as any)
  const showInspectionScope = isPasswordOnlyInspection || isCheckinSiteExecution
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
  const taskActions = availableActionsForTask(task, { roleNames })
  const hasServerTaskActions = Array.isArray((task as any)?.available_actions)
  const renderTaskActionButton = (action: WorkTaskAvailableAction) => {
    const disabledReason = action.disabled_reason ? actionDisabledReasonText(action.disabled_reason) : ''
    const checkedOutVisual = action.id === 'mark_guest_checkout' && isCheckedOut
    const isEqualWidthAction = action.id === 'upload_key_photo' || action.id === 'fill_supplies'
    const isFullWidthAction = action.id === 'report_issue'
    const localDisabled =
      (action.id === 'upload_key_photo' && (keyUploading || keyPhotoEffectiveState !== 'missing'))
      || (action.id === 'mark_guest_checkout' && (!token || isHistoricalTask || checkedOutPending))
    const isTaskCompletedAction = action.disabled_reason === 'task_completed'
    const isReadOnlyInspectionAction = action.id === 'submit_inspection' && action.read_only === true
    const isSuppliesRecordedAction = action.id === 'fill_supplies' && (isCleaningSubmitted || isTaskCompletedAction)
    const disabled = !isReadOnlyInspectionAction && (isSuppliesRecordedAction || !action.enabled || localDisabled)
    const showActionReason = disabled
      && !!disabledReason
      && hasServerTaskActions
      && !(action.id === 'upload_key_photo' && keyPhotoEffectiveState !== 'missing')
      && !isTaskCompletedAction
      && !isSuppliesRecordedAction
    const label = action.id === 'upload_key_photo'
      ? (keyUploading
        ? t('common_loading')
        : keyPhotoEffectiveState === 'recorded'
          ? '钥匙已记录'
          : keyPhotoEffectiveState === 'pending_sync'
            ? '钥匙待同步'
            : action.label)
      : isSuppliesRecordedAction
        ? '补品已记录'
        : isReadOnlyInspectionAction
          ? '查看检查照片'
        : isTaskCompletedAction
          ? '任务已完成'
          : action.id === 'mark_guest_checkout' && checkedOutPending
            ? '提交中...'
            : action.label
    const onPress = () => {
      if (isSuppliesRecordedAction) {
        const route = navigationForWorkTaskAction(task, action)
        if (route) props.navigation.navigate(route.screen as any, route.params as any)
        return
      }
      if (isReadOnlyInspectionAction) {
        const route = navigationForWorkTaskAction(task, action)
        if (route) props.navigation.navigate(route.screen as any, route.params as any)
        return
      }
      if (disabled) {
        if (disabledReason && hasServerTaskActions) Alert.alert('暂不可操作', disabledReason)
        return
      }
      if (action.id === 'upload_key_photo') return void onUploadKey()
      if (action.id === 'mark_guest_checkout') return void onToggleGuestCheckedOut(action)
      const route = navigationForWorkTaskAction(task, action)
      if (route) props.navigation.navigate(route.screen as any, route.params as any)
    }
    return (
      <Pressable
        key={`${action.id}:${action.target || ''}:${action.label}`}
        testID={`task-detail-action-${task.id}-${action.id}`}
        onPress={onPress}
        disabled={disabled && !disabledReason && !isSuppliesRecordedAction}
        style={({ pressed }) => [
          styles.actionBtn,
          isCompactLayout ? styles.actionBtnCompact : null,
          isEqualWidthAction ? styles.actionBtnEqualWidth : null,
          isFullWidthAction ? styles.actionBtnFullWidth : null,
          pressed ? styles.pressed : null,
          checkedOutVisual || (disabled && !isReadOnlyInspectionAction) ? styles.actionBtnDisabled : null,
        ]}
      >
        <Text style={[styles.actionText, checkedOutVisual || (disabled && !isReadOnlyInspectionAction) ? { color: '#6B7280' } : null]}>{label}</Text>
        {showActionReason ? <Text style={styles.actionReasonText}>{disabledReason}</Text> : null}
      </Pressable>
    )
  }
  const detailText = (() => {
    if (isCleaningSource) return null
    if (isOfflineTask) return null
    const s = stripPhotoLines(task.summary)
    return propertyFollowupTaskDetail(task, s) || null
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
        <View style={[styles.titleMetaRow, isCompactLayout ? styles.titleRowCompact : null]}>
          <View style={styles.titleMainColumn}>
            <Text style={styles.title}>{title2}</Text>
            <View style={styles.tagsRow}>
              {isStayoverTask ? (
                <View style={stayoverTagStyles.container}>
                  <Text style={stayoverTagStyles.text}>入住中清洁</Text>
                </View>
              ) : (
                <>
                  <View style={kindTagStyles.container}>
                    <Text style={kindTagStyles.text}>{isKeyHandoverTask || isCheckinSiteExecution ? '执行' : kind}</Text>
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
                  {!isOfflineTask && urgency ? (
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
          </View>
          <View style={styles.titleSideColumn}>
            <View style={[styles.statusPill, metaStyles.pill]}>
              <Text style={[styles.statusText, metaStyles.text]}>{meta.text}</Text>
            </View>
            {canEditOfflineTask ? (
              <Pressable
                testID="offline-edit-button"
                onPress={openOfflineEdit}
                disabled={offlineEditBusy}
                style={({ pressed }) => [styles.editOfflineBtn, pressed ? styles.pressed : null, offlineEditBusy ? styles.editOfflineBtnDisabled : null]}
              >
                <Ionicons name="create-outline" size={moderateScale(14)} color={offlineEditBusy ? '#9CA3AF' : '#2563EB'} />
                <Text style={[styles.editOfflineText, offlineEditBusy ? styles.editOfflineTextDisabled : null]}>编辑任务</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {isCheckinSiteExecution ? (
          <View style={styles.row}>
            <Ionicons name="person-outline" size={moderateScale(14)} color="#9CA3AF" />
            <Text style={styles.rowText}>执行人员：{String((task as any).executor_name || (task as any).assignee_name || (task as any).cleaner_name || (task as any).inspector_name || task.assignee_id || '').trim() || '-'}</Text>
          </View>
        ) : isDirectCompleteEligible || isPendingInspectionDecision ? (
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
              testID="task-detail-key-photo"
              onPress={() => setPreviewUrl(keyPhotoUrl)}
              style={({ pressed }) => [styles.photoWrap, pressed ? styles.pressed : null]}
            >
              <CleaningMediaImage
                token={token}
                localUri={String(keyPhotoUrl).startsWith('file://') ? keyPhotoUrl : null}
                remoteReference={keyPhotoUrl}
                style={styles.photo}
                resizeMode="contain"
              />
            </Pressable>
            {keyPhotoVisibleError ? <Text style={styles.summary}>{keyPhotoVisibleError}</Text> : null}
            {canDeleteKeyPhoto ? (
              <Pressable
                testID="task-detail-delete-key-photo"
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

        {canViewLockboxVideo && isCleaningSource && lockboxVideoUrl ? (
          <>
            <View style={styles.line} />
            <Text style={styles.sectionTitle}>执行人上传的视频</Text>
            <View testID="task-detail-lockbox-video" style={styles.videoCard}>
              <Video
                source={{ uri: toAbsoluteUrl(lockboxVideoUrl) }}
                style={styles.videoInline}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay={false}
                useNativeControls
              />
            </View>
          </>
        ) : null}

        {isCleaningSource ? (
          taskActions.length ? (
            <>
              <View style={[styles.actionsRow, isCompactLayout ? styles.actionsRowCompact : null]}>
                {taskActions.map(renderTaskActionButton)}
              </View>
            </>
          ) : (
            <View style={styles.markWrap}>
              <Text style={styles.mutedSmall}>当前任务暂无可用操作，请刷新任务后重试。</Text>
            </View>
          )
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
                <View style={styles.compactActionRow}>
                  <Pressable testID="offline-task-photo-camera" onPress={() => onAppendTaskPhotos('camera')} disabled={taskPhotoSaving} style={({ pressed }) => [styles.compactActionBtn, pressed ? styles.pressed : null, taskPhotoSaving ? styles.compactActionBtnDisabled : null]}>
                    <Ionicons name="camera-outline" size={moderateScale(16)} color={taskPhotoSaving ? '#9CA3AF' : '#2563EB'} />
                    <Text style={[styles.compactActionText, taskPhotoSaving ? styles.compactActionTextDisabled : null]}>{taskPhotoSaving ? '保存中...' : '拍照添加'}</Text>
                  </Pressable>
                  <Pressable testID="offline-task-photo-library" onPress={() => onAppendTaskPhotos('library')} disabled={taskPhotoSaving} style={({ pressed }) => [styles.compactActionBtn, pressed ? styles.pressed : null, taskPhotoSaving ? styles.compactActionBtnDisabled : null]}>
                    <Ionicons name="images-outline" size={moderateScale(16)} color={taskPhotoSaving ? '#9CA3AF' : '#2563EB'} />
                    <Text style={[styles.compactActionText, taskPhotoSaving ? styles.compactActionTextDisabled : null]}>相册添加</Text>
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
                          <CleaningMediaImage token={token} remoteReference={url} style={styles.markPhotoThumb} resizeMode="cover" />
                        </Pressable>
                        <AppIconButton accessibilityLabel="删除任务照片" onPress={() => removeTaskPhoto(index)} disabled={taskPhotoSaving} style={styles.markPhotoRemoveBtn} visualStyle={styles.markPhotoRemoveVisual}>
                          <Ionicons name="close" size={moderateScale(14)} color="#FFFFFF" />
                        </AppIconButton>
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
            <View style={styles.compactActionRow}>
              <Pressable testID="offline-task-mark-camera" onPress={() => onAppendPhotosForMarking('camera')} disabled={marking} style={({ pressed }) => [styles.compactActionBtn, pressed ? styles.pressed : null, marking ? styles.compactActionBtnDisabled : null]}>
                <Ionicons name="camera-outline" size={moderateScale(16)} color={marking ? '#9CA3AF' : '#2563EB'} />
                <Text style={[styles.compactActionText, marking ? styles.compactActionTextDisabled : null]}>拍照上传</Text>
              </Pressable>
              <Pressable testID="offline-task-mark-library" onPress={() => onAppendPhotosForMarking('library')} disabled={marking} style={({ pressed }) => [styles.compactActionBtn, pressed ? styles.pressed : null, marking ? styles.compactActionBtnDisabled : null]}>
                <Ionicons name="images-outline" size={moderateScale(16)} color={marking ? '#9CA3AF' : '#2563EB'} />
                <Text style={[styles.compactActionText, marking ? styles.compactActionTextDisabled : null]}>相册上传</Text>
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
                      <CleaningMediaImage token={token} remoteReference={String(url)} style={styles.markPhotoThumb} resizeMode="cover" />
                    </Pressable>
                    <AppIconButton accessibilityLabel="删除标记照片" onPress={() => removeMarkPhoto(index)} style={styles.markPhotoRemoveBtn} visualStyle={styles.markPhotoRemoveVisual}>
                      <Ionicons name="close" size={moderateScale(14)} color="#FFFFFF" />
                    </AppIconButton>
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

            <View style={isOfflineTask ? styles.compactCompletionRow : [styles.markRow, isCompactLayout ? styles.actionsRowCompact : null]}>
              <Pressable
                testID={isOfflineTask ? 'offline-task-complete' : undefined}
                onPress={() => {
                  setShowUnfinished(false)
                  onMarkDone()
                }}
                disabled={marking || isAlreadyDone}
                style={({ pressed }) => [isOfflineTask ? styles.compactPrimaryBtn : styles.markPrimary, !isOfflineTask && isCompactLayout ? styles.actionBtnCompact : null, pressed ? styles.pressed : null, marking || isAlreadyDone ? styles.markBtnDisabled : null]}
              >
                <Text style={styles.markPrimaryText}>标记完成</Text>
              </Pressable>
              <Pressable
                testID={isOfflineTask ? 'offline-task-not-complete' : undefined}
                onPress={() => setShowUnfinished(v => !v)}
                disabled={marking}
                style={({ pressed }) => [isOfflineTask ? styles.compactSecondaryBtn : [styles.markBtn, { flex: 1, marginTop: 0 }], !isOfflineTask && isCompactLayout ? styles.actionBtnCompact : null, pressed ? styles.pressed : null, marking ? styles.markBtnDisabled : null]}
              >
                <Text style={isOfflineTask ? styles.compactSecondaryText : styles.markBtnText}>未完成</Text>
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
    <Modal visible={offlineEditOpen} transparent animationType="slide" onRequestClose={() => (offlineEditBusy ? undefined : setOfflineEditOpen(false))}>
      <View style={styles.editModalBackdrop}>
        <View style={[styles.editModalCard, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.editModalHeader}>
            <Text style={styles.editModalTitle}>编辑线下任务</Text>
            <Pressable onPress={() => setOfflineEditOpen(false)} disabled={offlineEditBusy} style={({ pressed }) => [styles.previewCloseBtn, pressed ? styles.pressed : null]}>
              <Text style={styles.editModalCloseText}>关闭</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.editModalScroll} contentContainerStyle={styles.editModalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>执行日期</Text>
            <TextInput accessibilityLabel="offline-edit-date" value={offlineEditDate} onChangeText={setOfflineEditDate} editable={!offlineEditBusy} style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor="#9CA3AF" />
            <Text style={styles.label}>任务标题</Text>
            <TextInput accessibilityLabel="offline-edit-title" value={offlineEditTitle} onChangeText={setOfflineEditTitle} editable={!offlineEditBusy} style={styles.input} placeholder="任务标题" placeholderTextColor="#9CA3AF" />
            <Text style={styles.label}>任务内容</Text>
            <TextInput accessibilityLabel="offline-edit-content" value={offlineEditContent} onChangeText={setOfflineEditContent} editable={!offlineEditBusy} style={[styles.input, styles.editModalTextArea]} placeholder="补充说明" placeholderTextColor="#9CA3AF" multiline />
            <Text style={styles.label}>房源（可选）</Text>
            <Pressable accessibilityLabel="offline-edit-property" onPress={() => setOfflineEditPropertyOpen((prev) => !prev)} disabled={offlineEditBusy} style={({ pressed }) => [styles.editModalSelect, pressed ? styles.pressed : null]}>
              <Text style={styles.editModalSelectText} numberOfLines={1}>{selectedOfflineEditProperty?.code || String(task.property?.code || offlineEditPropertyId || '').trim() || '未关联房源'}</Text>
              <Ionicons name={offlineEditPropertyOpen ? 'chevron-up' : 'chevron-down'} size={moderateScale(16)} color="#6B7280" />
            </Pressable>
            {offlineEditPropertyOpen ? (
              <View testID="offline-edit-property-options" style={styles.editModalOptionList}>
                <ScrollView style={styles.editModalOptionScroll} nestedScrollEnabled showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
                  <Pressable accessibilityLabel="offline-edit-property-none" onPress={() => { setOfflineEditPropertyId(null); setOfflineEditPropertyOpen(false) }} style={styles.editModalOptionItem}>
                    <Text style={styles.editModalOptionText}>未关联房源</Text>
                  </Pressable>
                  {offlineEditProperties.map((item) => (
                    <Pressable key={item.id} accessibilityLabel={`offline-edit-property-${item.id}`} onPress={() => { setOfflineEditPropertyId(item.id); setOfflineEditPropertyOpen(false) }} style={[styles.editModalOptionItem, item.id === offlineEditPropertyId ? styles.editModalOptionItemOn : null]}>
                      <Text style={styles.editModalOptionText}>{item.code || item.id}</Text>
                    </Pressable>
                  ))}
                  {!offlineEditProperties.length ? <Text style={styles.mutedSmall}>{offlineEditLoadingOptions ? '房源加载中...' : '暂无房源选项'}</Text> : null}
                </ScrollView>
              </View>
            ) : null}
            <Text style={styles.label}>执行人</Text>
            <Pressable accessibilityLabel="offline-edit-assignee" onPress={() => setOfflineEditAssigneeOpen((prev) => !prev)} disabled={offlineEditBusy} style={({ pressed }) => [styles.editModalSelect, pressed ? styles.pressed : null]}>
              <Text style={[styles.editModalSelectText, !selectedOfflineEditAssignee && !offlineEditAssigneeId ? styles.editModalPlaceholder : null]} numberOfLines={1}>{selectedOfflineEditAssignee ? offlineEditUserName(selectedOfflineEditAssignee) : (offlineEditAssigneeId || '未分配')}</Text>
              <Ionicons name={offlineEditAssigneeOpen ? 'chevron-up' : 'chevron-down'} size={moderateScale(16)} color="#6B7280" />
            </Pressable>
            {offlineEditAssigneeOpen ? (
              <View testID="offline-edit-assignee-options" style={styles.editModalOptionList}>
                <ScrollView style={styles.editModalOptionScroll} nestedScrollEnabled showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
                  <Pressable accessibilityLabel="offline-edit-assignee-none" onPress={() => { setOfflineEditAssigneeId(null); setOfflineEditAssigneeOpen(false) }} style={[styles.editModalOptionItem, !offlineEditAssigneeId ? styles.editModalOptionItemOn : null]}>
                    <Text style={styles.editModalOptionText}>未分配</Text>
                  </Pressable>
                  {offlineEditUsers.map((item) => (
                    <Pressable key={item.id} accessibilityLabel={`offline-edit-assignee-${item.id}`} onPress={() => { setOfflineEditAssigneeId(item.id); setOfflineEditAssigneeOpen(false) }} style={[styles.editModalOptionItem, item.id === offlineEditAssigneeId ? styles.editModalOptionItemOn : null]}>
                      <Text style={styles.editModalOptionText} numberOfLines={1}>{offlineEditUserName(item)}</Text>
                    </Pressable>
                  ))}
                  {!offlineEditUsers.length ? <Text style={styles.mutedSmall}>{offlineEditLoadingOptions ? '执行人加载中...' : '暂无可选执行人'}</Text> : null}
                </ScrollView>
              </View>
            ) : null}
            <Text style={styles.mutedSmall}>任务类型保持创建时设置。</Text>
          </ScrollView>
          <Pressable testID="offline-edit-save" onPress={() => { void saveOfflineEdit() }} disabled={offlineEditBusy} style={({ pressed }) => [styles.editModalSaveBtn, pressed ? styles.pressed : null, offlineEditBusy ? styles.actionBtnDisabled : null]}>
            <Text style={styles.editModalSaveText}>{offlineEditBusy ? '保存中...' : '保存修改'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
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
            {previewUrl ? (
              <View style={{ width: previewSize.width, height: Math.max(240, previewSize.height - insets.top - insets.bottom - 80) }}>
                <CleaningMediaPreview token={token} reference={previewUrl} style={{ width: '100%', height: '100%' }} />
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
  titleMetaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  titleMainColumn: { flex: 1, minWidth: 0 },
  titleSideColumn: { width: 96, alignItems: 'flex-end' },
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
  actionBtn: { flex: 1, flexGrow: 1, flexShrink: 1, minWidth: 128, minHeight: 44, borderRadius: 10, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 0 },
  actionBtnCompact: { width: '100%', flexBasis: '100%', flexGrow: 0 },
  actionBtnEqualWidth: { flex: 1, flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  actionBtnFullWidth: { flex: 0, flexGrow: 0, flexBasis: '100%', width: '100%' },
  actionBtnDisabled: { backgroundColor: '#E5E7EB' },
  actionText: { flexShrink: 1, fontWeight: '900', color: '#FFFFFF', fontSize: 13, lineHeight: 17, textAlign: 'center' },
  actionReasonText: { marginTop: 2, color: '#6B7280', fontSize: 11, lineHeight: 14, textAlign: 'center' },
  editOfflineBtn: { alignSelf: 'flex-end', marginTop: 8, minHeight: 44, borderRadius: 9, backgroundColor: '#F5F8FF', borderWidth: hairline(), borderColor: '#BFDBFE', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 16, paddingVertical: 0 },
  editOfflineBtnDisabled: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
  editOfflineText: { fontWeight: '900', color: '#2563EB', fontSize: 12 },
  editOfflineTextDisabled: { color: '#9CA3AF' },
  dangerBtn: { marginTop: 10, minHeight: 44, borderRadius: 12, backgroundColor: '#FEF2F2', borderWidth: hairline(), borderColor: '#FCA5A5', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 0 },
  dangerText: { fontWeight: '900', color: '#B91C1C', fontSize: 13 },
  line: { marginTop: 14, height: hairline(), backgroundColor: '#EEF0F6' },
  sectionTitle: { marginTop: 14, fontSize: 13, fontWeight: '900', color: '#111827' },
  summary: { marginTop: 8, color: '#374151', fontWeight: '700', lineHeight: 18 },
  linkInlineRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  linkInlineText: { flexShrink: 1, minWidth: 0, color: '#2563EB', fontSize: moderateScale(14), fontWeight: '800' },
  photoWrap: { width: '100%', height: moderateScale(220), marginTop: 10, borderRadius: 12, overflow: 'hidden', borderWidth: hairline(), borderColor: '#EEF0F6', backgroundColor: '#0B0F17' },
  photo: { width: '100%', height: '100%', backgroundColor: '#0B0F17' },
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
  markBtn: { marginTop: 12, minHeight: 44, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 0 },
  markUploadRow: { marginTop: 12, flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  markUploadBtn: { flex: 1, marginTop: 0 },
  compactActionRow: { marginTop: 10, flexDirection: 'row', gap: 8 },
  compactActionBtn: { flex: 1, minHeight: 44, borderRadius: 10, borderWidth: hairline(), borderColor: '#BFDBFE', backgroundColor: '#F5F8FF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 0 },
  compactActionBtnDisabled: { borderColor: '#E5E7EB', backgroundColor: '#F3F4F6' },
  compactActionText: { color: '#2563EB', fontSize: 12, fontWeight: '900' },
  compactActionTextDisabled: { color: '#9CA3AF' },
  compactCompletionRow: { marginTop: 14, flexDirection: 'row', gap: 8 },
  compactPrimaryBtn: { flex: 1, minHeight: 44, borderRadius: 10, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 0 },
  compactSecondaryBtn: { flex: 1, minHeight: 44, borderRadius: 10, borderWidth: hairline(), borderColor: '#D1D5DB', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 0 },
  compactSecondaryText: { color: '#4B5563', fontSize: 13, fontWeight: '900' },
  markPhotoList: { gap: 10, paddingTop: 12, paddingBottom: 4 },
  markPhotoCard: { width: 96, position: 'relative' },
  markPhotoThumbWrap: { borderRadius: 14, overflow: 'hidden', borderWidth: hairline(), borderColor: '#E5E7EB', backgroundColor: '#F3F4F6' },
  markPhotoThumb: { width: '100%', height: 96 },
  markPhotoRemoveBtn: { position: 'absolute', top: 4, right: 4 },
  markPhotoRemoveVisual: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(17,24,39,0.84)' },
  markBtnText: { flexShrink: 1, fontWeight: '900', color: '#FFFFFF', fontSize: 13, lineHeight: 17, textAlign: 'center' },
  markPrimary: { flex: 1, flexShrink: 1, minWidth: 128, minHeight: 44, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 0 },
  markPrimaryText: { flexShrink: 1, color: '#FFFFFF', fontWeight: '900', fontSize: 13, lineHeight: 17, textAlign: 'center' },
  markBtnDisabled: { backgroundColor: '#E5E7EB' },
  editModalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.45)' },
  editModalCard: { maxHeight: '92%', borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingTop: 14 },
  editModalHeader: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  editModalTitle: { flex: 1, color: '#111827', fontSize: moderateScale(18), fontWeight: '900' },
  editModalCloseText: { color: '#374151', fontWeight: '900' },
  editModalScroll: { flexGrow: 0 },
  editModalContent: { paddingBottom: 12 },
  editModalTextArea: { minHeight: 88, paddingTop: 10, textAlignVertical: 'top' },
  editModalSelect: { minHeight: 44, borderRadius: 12, borderWidth: hairline(), borderColor: '#D1D5DB', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  editModalSelectText: { flex: 1, minWidth: 0, color: '#111827', fontWeight: '800' },
  editModalPlaceholder: { color: '#9CA3AF' },
  editModalOptionList: { height: 190, marginTop: 4, borderRadius: 12, overflow: 'hidden', borderWidth: hairline(), borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  editModalOptionScroll: { flex: 1 },
  editModalOptionItem: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', borderBottomWidth: hairline(), borderBottomColor: '#F3F4F6' },
  editModalOptionItemOn: { backgroundColor: '#EFF6FF' },
  editModalOptionText: { color: '#111827', fontWeight: '900' },
  editModalSaveBtn: { minHeight: 44, marginTop: 8, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  editModalSaveText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },
  restockWrap: { marginTop: 10, gap: 12 },
  restockItem: { padding: 12, borderRadius: 14, backgroundColor: '#F9FAFB', borderWidth: hairline(), borderColor: '#EEF0F6' },
  restockTitle: { color: '#111827', fontWeight: '900' },
  restockNote: { marginTop: 6, color: '#6B7280', fontWeight: '700' },
  videoCard: { width: '100%', height: moderateScale(220), marginTop: 10, borderRadius: 12, overflow: 'hidden', backgroundColor: '#0B0F17' },
  videoInline: { width: '100%', height: '100%', backgroundColor: '#0B0F17' },
  previewBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.86)', padding: 12, justifyContent: 'center' },
  previewCard: { flex: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000000' },
  previewTopRow: { minHeight: 48, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'flex-end', paddingHorizontal: 10 },
  previewCloseBtn: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 0, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  previewCloseText: { color: '#FFFFFF', fontWeight: '900' },
  previewScrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
})
