import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Dimensions, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import * as ImagePicker from 'expo-image-picker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { hairline, moderateScale } from '../../lib/scale'
import { getWorkTasksSnapshot, subscribeWorkTasks, type WorkTaskItem } from '../../lib/workTasksStore'
import type { TasksStackParamList } from '../../navigation/RootNavigator'
import { deleteKeyPhoto, markGuestCheckedOutBulk, markWorkTask, startCleaningTask, uploadCleaningMedia, uploadMzappMedia } from '../../lib/api'
import { enqueueKeyUpload } from '../../lib/keyUploadQueue'

type Props = NativeStackScreenProps<TasksStackParamList, 'TaskDetail'>

function statusLabel(status: string) {
  const s = String(status || '').trim().toLowerCase()
  if (s === 'done' || s === 'completed') return { text: '已完成', pill: styles.statusGreen, textStyle: styles.statusTextGreen }
  if (s === 'to_inspect') return { text: '待检查', pill: styles.statusAmber, textStyle: styles.statusTextAmber }
  if (s === 'to_hang_keys') return { text: '待挂钥匙', pill: styles.statusAmber, textStyle: styles.statusTextAmber }
  if (s === 'to_complete') return { text: '待完成', pill: styles.statusAmber, textStyle: styles.statusTextAmber }
  if (s === 'keys_hung') return { text: '已挂钥匙', pill: styles.statusGreen, textStyle: styles.statusTextGreen }
  if (s === 'in_progress') return { text: '进行中', pill: styles.statusBlue, textStyle: styles.statusTextBlue }
  if (s === 'assigned') return { text: '已分配', pill: styles.statusBlue, textStyle: styles.statusTextBlue }
  if (s === 'cancelled' || s === 'canceled') return { text: '已取消', pill: styles.statusGray, textStyle: styles.statusTextGray }
  return { text: '待处理', pill: styles.statusAmber, textStyle: styles.statusTextAmber }
}

function statusLabelForTask(task: WorkTaskItem) {
  const s = String(task.status || '').trim().toLowerCase()
  const meta = statusLabel(s)
  const source = String(task.source_type || '').trim().toLowerCase()
  const kind = String(task.task_kind || '').trim().toLowerCase()
  if (source === 'cleaning_tasks' && kind === 'cleaning') {
    const checkedOutAt = String((task as any).checked_out_at || '').trim()
    if (s !== 'in_progress' && s !== 'done' && s !== 'completed' && s !== 'cancelled' && s !== 'canceled') {
      if (checkedOutAt) return { text: '已退房', pill: styles.statusPurple, textStyle: styles.statusTextPurple }
      return { text: '待清洁', pill: styles.statusAmber, textStyle: styles.statusTextAmber }
    }
  }
  return meta
}

function taskKindLabel(kind: string) {
  const s = String(kind || '').trim().toLowerCase()
  if (s === 'cleaning') return '清洁'
  if (s === 'inspection') return '检查'
  if (s === 'maintenance') return '维修'
  if (s === 'deep_cleaning') return '深清'
  if (s === 'offline') return '线下'
  if (s) return s
  return '任务'
}

function normalizeHttpUrl(raw: string | null | undefined) {
  const s0 = String(raw || '').trim()
  if (!s0) return null
  const mHref = s0.match(/href\s*=\s*["']([^"']+)["']/i)
  const s = (mHref?.[1] || s0).trim()
  const mHttp = s.match(/https?:\/\/[^\s"'<>]+/i)
  const u = (mHttp?.[0] || s).trim()
  if (!u) return null
  if (/^https?:\/\//i.test(u)) return u
  return `https://${u}`
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
    .filter((x) => !/^照片\s*:/i.test(x))
  return lines.join('\n').trim()
}

function isManagerRole(role: string) {
  const r = String(role || '').trim()
  return r === 'admin' || r === 'offline_manager' || r === 'customer_service'
}

export default function TaskDetailScreen(props: Props) {
  const { t } = useI18n()
  const { user, token } = useAuth()
  const insets = useSafeAreaInsets()
  const [hasInit, setHasInit] = useState(false)
  const [, bump] = useState(0)
  const id = props.route.params.id
  const action = props.route.params.action
  const [marking, setMarking] = useState(false)
  const [markPhotoUrl, setMarkPhotoUrl] = useState<string | null>(null)
  const [markNote, setMarkNote] = useState('')
  const [deferReason, setDeferReason] = useState('')
  const [showUnfinished, setShowUnfinished] = useState(false)
  const [localKeyPhotoUrl, setLocalKeyPhotoUrl] = useState<string | null>(null)
  const [keyUploading, setKeyUploading] = useState(false)
  const [keyDeleting, setKeyDeleting] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [autoUploadKeyDone, setAutoUploadKeyDone] = useState(false)

  useEffect(() => {
    setHasInit(true)
    const unsub = subscribeWorkTasks(() => bump(v => v + 1))
    bump(v => v + 1)
    return () => {
      unsub()
    }
  }, [])

  const items = getWorkTasksSnapshot().items
  const task = useMemo<WorkTaskItem | null>(() => items.find(x => x.id === id) || null, [id, items])
  const previewSize = useMemo(() => {
    const { width, height } = Dimensions.get('window')
    return { width, height }
  }, [])

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
      res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 })
    } catch (e: any) {
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
      const name = String(a.fileName || uri.split('/').pop() || `key-${Date.now()}.jpg`)
      const mimeType = String(a.mimeType || 'image/jpeg')
      const up = await uploadCleaningMedia(
        token,
        { uri, name, mimeType },
        { purpose: 'key_photo', watermark: '1', watermark_text: watermarkText, property_code: propertyCode, captured_at: capturedAt },
      )
      await startCleaningTask(token, String(task.source_id), { media_url: up.url, captured_at: capturedAt })
      setLocalKeyPhotoUrl(up.url)
      Alert.alert(t('common_ok'), '钥匙上传成功')
    } catch (e: any) {
      const msg = String(e?.message || '上传失败')
      const m = msg.toLowerCase()
      const canQueue = m.includes('network request failed') || m.includes('timeout') || m.includes('aborted')
      if (!canQueue) {
        Alert.alert(t('common_error'), msg)
        return
      }
      try {
        await enqueueKeyUpload({
          cleaning_task_id: String(task.source_id),
          source_uri: uri,
          property_code: propertyCode,
          captured_at: capturedAt,
          watermark_text: watermarkText,
        })
        Alert.alert(t('common_ok'), '已离线保存，网络恢复后自动上传')
      } catch (e2: any) {
        Alert.alert(t('common_error'), String(e2?.message || msg))
      }
    }
    finally {
      setKeyUploading(false)
    }
  }

  async function onDeleteKey() {
    if (!task) return
    if (!token) {
      Alert.alert(t('common_error'), '请先登录')
      return
    }
    if (task.source_type !== 'cleaning_tasks') return
    if (keyDeleting) return
    setKeyDeleting(true)
    try {
      await deleteKeyPhoto(token, String(task.source_id))
      setLocalKeyPhotoUrl(null)
      Alert.alert(t('common_ok'), '已删除钥匙照片')
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '删除失败'))
    } finally {
      setKeyDeleting(false)
    }
  }

  async function onTakePhotoForMarking() {
    if (!task) return
    if (!token) {
      Alert.alert(t('common_error'), '请先登录')
      return
    }
    try {
      setMarking(true)
      const res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 })
      if (res.canceled || !res.assets?.length) return
      const a = res.assets[0] as any
      const uri = String(a.uri || '').trim()
      if (!uri) return
      const name = String(a.fileName || uri.split('/').pop() || `task-${Date.now()}.jpg`)
      const mimeType = String(a.mimeType || 'image/jpeg')
      const up = await uploadMzappMedia(token, { uri, name, mimeType })
      setMarkPhotoUrl(up.url)
      Alert.alert(t('common_ok'), '照片已上传')
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '上传失败'))
    } finally {
      setMarking(false)
    }
  }

  async function onMarkDone() {
    if (!task) return
    if (!token) {
      Alert.alert(t('common_error'), '请先登录')
      return
    }
    if (!effectiveMarkPhotoUrl) {
      Alert.alert(t('common_error'), '请先拍照上传')
      return
    }
    try {
      setMarking(true)
      await markWorkTask(token, String(task.id), { action: 'done', photo_url: effectiveMarkPhotoUrl, note: markNote.trim() || null })
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
    if (!effectiveMarkPhotoUrl) {
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
      await markWorkTask(token, String(task.id), { action: 'defer', photo_url: effectiveMarkPhotoUrl, reason: r, note: markNote.trim() || null })
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
        <Text style={styles.muted}>{t('common_error')}</Text>
      </View>
    )
  }

  const meta = statusLabelForTask(task)
  const kind = taskKindLabel(task.task_kind)
  const region = String(task.property?.region || '').trim()
  const code = String(task.property?.code || '').trim()
  const unitType = String(task.property?.unit_type || '').trim()
  const title = `${region ? `${region} ` : ''}${code || task.title || '-'}`.trim()
  const checkoutTime = String(task.start_time || '').trim()
  const checkinTime = String(task.end_time || '').trim()
  const guideUrl = normalizeHttpUrl(task.property?.access_guide_link)
  const taskType = String((task as any).task_type || '').trim().toLowerCase()
  const isCheckoutTask = taskType === 'checkout_clean' || !!checkoutTime
  const oldCode = String((task as any).old_code || '').trim()
  const newCode = String((task as any).new_code || '').trim()
  const showUrgency = (() => {
    const u = String(task.urgency || '').trim().toLowerCase()
    if (!u) return false
    if (u === 'medium') return false
    return true
  })()
  const isCleaningSource = task.source_type === 'cleaning_tasks'
  const isCleaningOrInspection = isCleaningSource && (String(task.task_kind || '').toLowerCase() === 'cleaning' || String(task.task_kind || '').toLowerCase() === 'inspection')
  const wifiSsid = String((task as any)?.property?.wifi_ssid || '').trim()
  const wifiPassword = String((task as any)?.property?.wifi_password || '').trim()
  const routerLocation = String((task as any)?.property?.router_location || '').trim()
  const hasCheckout = !!checkoutTime
  const hasCheckin = !!checkinTime
  const titleSuffix = hasCheckout || hasCheckin ? `${hasCheckout ? '退房' : ''}${hasCheckout && hasCheckin ? ' ' : ''}${hasCheckin ? '入住' : ''}` : ''
  const title2 = `${title}${titleSuffix ? ` ${titleSuffix}` : ''}`.trim()
  const keyPhotoUrl = String(localKeyPhotoUrl || (task as any).key_photo_url || '').trim() || null
  const lockboxVideoUrl = String((task as any).lockbox_video_url || '').trim() || null
  const keysRequired = Number((task as any).keys_required ?? 1)
  const keysSets = Number.isFinite(keysRequired) ? Math.max(1, Math.trunc(keysRequired)) : 1
  const checkedOutAt = String((task as any).checked_out_at || '').trim()
  const isCheckedOut = !!checkedOutAt
  const showKeySets = isCleaningSource && (hasCheckout || hasCheckin) && keysSets >= 2
  const keySetsText = isCheckedOut ? `请确认已退${keysSets}套钥匙` : hasCheckin ? `需挂${keysSets}套钥匙` : `请确认已退${keysSets}套钥匙`
  const restockItems = Array.isArray((task as any).restock_items) ? ((task as any).restock_items as any[]) : []
  const isCleaningTask = isCleaningSource && String(task.task_kind || '').toLowerCase() === 'cleaning'
  const isInspectionTask = isCleaningSource && String(task.task_kind || '').toLowerCase() === 'inspection'
  const isOfflineTask = String(task.task_kind || '').toLowerCase() === 'offline'
  const inspectorAssigned = String((task as any).inspector_id || '').trim()
  const isSelfCompleteEligible = isCleaningTask && isCheckoutTask && !inspectorAssigned
  const isCustomerService = String(user?.role || '') === 'customer_service'
  const canDeleteKeyPhoto = (String(user?.role || '') === 'cleaner' || String(user?.role || '') === 'cleaner_inspector') && isCleaningTask
  const showSummary = !!(task.summary && task.source_type !== 'cleaning_tasks' && !isOfflineTask)
  const isAlreadyDone = (() => {
    const s = String(task.status || '').trim().toLowerCase()
    return s === 'done' || s === 'completed'
  })()
  const savedMarkPhotoUrl = extractFirstUrl(task.summary)
  const effectiveMarkPhotoUrl = markPhotoUrl || savedMarkPhotoUrl
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
  const effectiveLockboxUrl = lockboxVideoUrl

  return (
    <>
      <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title2}</Text>
          <View style={[styles.statusPill, meta.pill]}>
            <Text style={[styles.statusText, meta.textStyle]}>{meta.text}</Text>
          </View>
        </View>

        <View style={styles.tagsRow}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{kind}</Text>
          </View>
          {showKeySets ? (
            <View style={styles.tagKey}>
              <Text style={styles.tagKeyText}>{keySetsText}</Text>
            </View>
          ) : null}
          {isSelfCompleteEligible ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>自完成</Text>
            </View>
          ) : null}
          {showUrgency ? (
            <View style={styles.tagGray}>
              <Text style={styles.tagGrayText}>{String(task.urgency).toUpperCase()}</Text>
            </View>
          ) : null}
          {unitType ? (
            <View style={styles.tagGray}>
              <Text style={styles.tagGrayText}>{unitType}</Text>
            </View>
          ) : null}
        </View>

        {isSelfCompleteEligible ? (
          <View style={styles.row}>
            <Ionicons name="person-outline" size={moderateScale(14)} color="#9CA3AF" />
            <Text style={styles.rowText}>检查人员：无</Text>
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

        {isCleaningSource && keyPhotoUrl ? (
          <>
            <View style={styles.line} />
            <Text style={styles.sectionTitle}>钥匙照片</Text>
            <Pressable
              onPress={() => setPreviewUrl(keyPhotoUrl)}
              style={({ pressed }) => [styles.photoWrap, pressed ? styles.pressed : null]}
            >
              <Image source={{ uri: keyPhotoUrl }} style={styles.photo} resizeMode="contain" />
            </Pressable>
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

        {isCleaningTask ? (
          <View style={styles.actionsRow}>
            {isCustomerService ? (
              <>
                {isCheckoutTask ? (
                  <Pressable
                    onPress={async () => {
                      if (!token) return
                      try {
                        const ids0 = Array.isArray((task as any)?.source_ids) && (task as any).source_ids.length ? (task as any).source_ids : [String(task.source_id)]
                        const ids = ids0.map((x: any) => String(x || '').trim()).filter(Boolean)
                        await markGuestCheckedOutBulk(token, { task_ids: ids, action: isCheckedOut ? 'unset' : 'set' })
                        Alert.alert(t('common_ok'), isCheckedOut ? '已取消退房' : '已标记已退房')
                        props.navigation.goBack()
                      } catch (e: any) {
                        Alert.alert(t('common_error'), String(e?.message || '提交失败'))
                      }
                    }}
                    disabled={!token}
                    style={({ pressed }) => [styles.actionBtn, pressed ? styles.pressed : null, isCheckedOut ? styles.actionBtnDisabled : null]}
                  >
                    <Text style={[styles.actionText, isCheckedOut ? { color: '#6B7280' } : null]}>{isCheckedOut ? '取消已退房' : '标记已退房'}</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => props.navigation.navigate('FeedbackForm', { taskId: task.id })}
                  style={({ pressed }) => [styles.actionBtn, pressed ? styles.pressed : null]}
                >
                  <Text style={styles.actionText}>{t('tasks_btn_repair')}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  onPress={onUploadKey}
                  disabled={keyUploading}
                  style={({ pressed }) => [styles.actionBtn, pressed ? styles.pressed : null, keyUploading ? styles.actionBtnDisabled : null]}
                >
                  <Text style={styles.actionText}>{keyUploading ? t('common_loading') : t('tasks_btn_upload_key')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => props.navigation.navigate('FeedbackForm', { taskId: task.id })}
                  style={({ pressed }) => [styles.actionBtn, pressed ? styles.pressed : null]}
                >
                  <Text style={styles.actionText}>{t('tasks_btn_repair')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => props.navigation.navigate(isSelfCompleteEligible ? 'CleaningSelfComplete' : 'SuppliesForm', { taskId: task.id } as any)}
                  style={({ pressed }) => [styles.actionBtn, pressed ? styles.pressed : null]}
                >
                  <Text style={styles.actionText}>{isSelfCompleteEligible ? '补充与完成' : '补品填报'}</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : (
          <View style={styles.markWrap}>
            <Text style={styles.sectionTitle}>任务处理</Text>
            <Text style={styles.mutedSmall} numberOfLines={2}>
              {effectiveMarkPhotoUrl ? '已上传照片' : '未上传照片（需要拍照后才能提交）'}
            </Text>
            <Pressable onPress={onTakePhotoForMarking} disabled={marking} style={({ pressed }) => [styles.markBtn, pressed ? styles.pressed : null, marking ? styles.markBtnDisabled : null]}>
              <Text style={styles.markBtnText}>拍照上传</Text>
            </Pressable>
            {effectiveMarkPhotoUrl ? (
              <Pressable
                onPress={() => setPreviewUrl(String(effectiveMarkPhotoUrl))}
                style={({ pressed }) => [styles.photoWrap, pressed ? styles.pressed : null]}
              >
                <Image source={{ uri: String(effectiveMarkPhotoUrl) }} style={styles.photo} resizeMode="contain" />
              </Pressable>
            ) : null}

            {offlineDetail ? (
              <>
                <Text style={styles.label}>任务内容</Text>
                <Text style={styles.summary}>{offlineDetail}</Text>
              </>
            ) : null}

            <Text style={styles.label}>备注（可选）</Text>
            <TextInput
              value={markNote}
              onChangeText={setMarkNote}
              style={styles.input}
              placeholder="备注"
              placeholderTextColor="#9CA3AF"
            />

            <View style={styles.markRow}>
              <Pressable
                onPress={() => {
                  setShowUnfinished(false)
                  onMarkDone()
                }}
                disabled={marking || isAlreadyDone}
                style={({ pressed }) => [styles.markPrimary, pressed ? styles.pressed : null, marking || isAlreadyDone ? styles.markBtnDisabled : null]}
              >
                <Text style={styles.markPrimaryText}>标记完成</Text>
              </Pressable>
              <Pressable
                onPress={() => setShowUnfinished(v => !v)}
                disabled={marking}
                style={({ pressed }) => [styles.markBtn, { flex: 1, marginTop: 0 }, pressed ? styles.pressed : null, marking ? styles.markBtnDisabled : null]}
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

        {showSummary ? (
          <>
            <View style={styles.line} />
            <Text style={styles.sectionTitle}>详情</Text>
            <Text style={styles.summary}>{stripPhotoLines(task.summary)}</Text>
          </>
        ) : null}
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
            {previewUrl ? (
              <View style={{ width: previewSize.width, height: Math.max(240, previewSize.height - insets.top - insets.bottom - 80) }}>
                <Image source={{ uri: previewUrl }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
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
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { flex: 1, fontSize: moderateScale(18), fontWeight: '900', color: '#111827' },
  statusPill: { height: 26, paddingHorizontal: 10, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  statusText: { fontSize: 12, fontWeight: '900' },
  statusBlue: { backgroundColor: '#DBEAFE' },
  statusAmber: { backgroundColor: '#FEF3C7' },
  statusGreen: { backgroundColor: '#DCFCE7' },
  statusPurple: { backgroundColor: '#EDE9FE' },
  statusGray: { backgroundColor: '#F3F4F6' },
  statusTextBlue: { color: '#2563EB' },
  statusTextAmber: { color: '#B45309' },
  statusTextGreen: { color: '#16A34A' },
  statusTextPurple: { color: '#7C3AED' },
  statusTextGray: { color: '#6B7280' },
  tagsRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  tag: { paddingHorizontal: 10, height: 24, borderRadius: 12, backgroundColor: '#EFF6FF', borderWidth: hairline(), borderColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  tagText: { fontSize: 11, fontWeight: '900', color: '#2563EB' },
  tagGray: { paddingHorizontal: 10, height: 24, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  tagGrayText: { fontSize: 11, fontWeight: '800', color: '#6B7280' },
  tagKey: { paddingHorizontal: 10, height: 24, borderRadius: 12, backgroundColor: '#FEF2F2', borderWidth: hairline(), borderColor: '#FCA5A5', alignItems: 'center', justifyContent: 'center' },
  tagKeyText: { fontSize: 11, fontWeight: '900', color: '#B91C1C' },
  row: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowText: { flex: 1, color: '#6B7280', fontSize: moderateScale(13), fontWeight: '600' },
  actionsRow: { marginTop: 14, flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, height: 36, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  actionBtnDisabled: { backgroundColor: '#E5E7EB' },
  actionText: { fontWeight: '900', color: '#FFFFFF', fontSize: 13 },
  dangerBtn: { marginTop: 10, height: 36, borderRadius: 12, backgroundColor: '#FEF2F2', borderWidth: hairline(), borderColor: '#FCA5A5', alignItems: 'center', justifyContent: 'center' },
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
  label: { marginTop: 14, marginBottom: 8, color: '#111827', fontWeight: '900' },
  input: { height: 44, borderRadius: 12, borderWidth: hairline(), borderColor: '#D1D5DB', paddingHorizontal: 12, fontWeight: '700', color: '#111827' },
  markRow: { marginTop: 14, flexDirection: 'row', gap: 10 },
  markBtn: { marginTop: 12, height: 36, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  markBtnText: { fontWeight: '900', color: '#FFFFFF', fontSize: 13 },
  markPrimary: { flex: 1, height: 36, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  markPrimaryText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
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
