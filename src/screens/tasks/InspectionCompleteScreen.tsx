import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { ResizeMode, Video } from 'expo-av'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { API_BASE_URL } from '../../config/env'
import { getInspectionPhotos, getRestockProof, uploadCleaningVideo, uploadLockboxVideo } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { hairline, moderateScale } from '../../lib/scale'
import { canSkipInspectionPhotosForGuestArrival, isEarlyCheckinTime } from '../../lib/taskTime'
import { getWorkTasksSnapshot } from '../../lib/workTasksStore'
import type { TasksStackParamList } from '../../navigation/RootNavigator'

type Props = NativeStackScreenProps<TasksStackParamList, 'InspectionComplete'>

const REQUIRED_INSPECTION_AREAS = ['living', 'sofa', 'bedroom', 'kitchen'] as const

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
  const [submitting, setSubmitting] = useState(false)
  const [lockboxLocalUrl, setLockboxLocalUrl] = useState<string | null>(null)
  const [missing, setMissing] = useState<string[]>([])
  const [validationReady, setValidationReady] = useState(false)

  const task = useMemo(() => getWorkTasksSnapshot().items.find(x => x.id === props.route.params.taskId) || null, [props.route.params.taskId])
  const cleaningTaskId = String(task?.source_id || '').trim()
  const lockboxFromTask = String((task as any)?.lockbox_video_url || '').trim()
  const effectiveLockboxUrl = lockboxLocalUrl || lockboxFromTask || null
  const checkinTime = String((task as any)?.end_time || (task as any)?.checkin_time || '').trim()
  const routeSkipInspectionPhotos = props.route.params.skipInspectionPhotos === true
  const canSkipInspectionPhotos = routeSkipInspectionPhotos && canSkipInspectionPhotosForGuestArrival(checkinTime)
  const isEarlyCheckinSkipAttempt = routeSkipInspectionPhotos && isEarlyCheckinTime(checkinTime)
  const oldCode = String((task as any)?.old_code || '').trim()
  const newCode = String((task as any)?.new_code || '').trim()
  const refresh = useCallback(async () => {
    if (!token) return
    if (!cleaningTaskId) return
    try {
      setLoading(true)
      setValidationReady(false)
      const [p, restock] = await Promise.all([
        getInspectionPhotos(token, cleaningTaskId).catch(() => null),
        getRestockProof(token, cleaningTaskId).catch(() => null),
      ])
      const needs: string[] = []

      if (!canSkipInspectionPhotos) {
        const gotAreas = new Set<string>()
        for (const it of p?.items || []) {
          const a = String(it.area || '').trim()
          if (a) gotAreas.add(a)
        }
        const missingAreas = REQUIRED_INSPECTION_AREAS.filter(a => !gotAreas.has(a))
        if (missingAreas.length) needs.push('关键区域照片未齐（每个区域至少 1 张）')
      }
      const hasRestockRecord = !!(restock?.items?.length || restock?.confirmed_sufficient)
      if (!hasRestockRecord) needs.push('消耗品确认未完成')

      setMissing(needs)
      setValidationReady(true)
    } finally {
      setLoading(false)
    }
  }, [canSkipInspectionPhotos, cleaningTaskId, token])

  useEffect(() => {
    refresh()
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
      const up = await uploadCleaningVideo(token, { uri, name, mimeType })
      setLockboxLocalUrl(up.url)
      setSubmitting(true)
      await uploadLockboxVideo(token, cleaningTaskId, { media_url: up.url })
      Alert.alert(t('common_ok'), '视频已上传，任务已完成')
      props.navigation.goBack()
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '上传或提交失败'))
    } finally {
      setUploading(false)
      setSubmitting(false)
    }
  }

  if (!task) {
    return (
      <View style={styles.page}>
        <Text style={styles.muted}>{t('common_loading')}</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingBottom: Math.max(16, insets.bottom) + 10 }]} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <View style={styles.headRow}>
          <Text style={styles.title}>标记已完成</Text>
          <View style={styles.badge}>
            <Ionicons name="home-outline" size={moderateScale(14)} color="#2563EB" />
            <Text style={styles.badgeText} numberOfLines={1}>
              {task.title}
            </Text>
          </View>
        </View>
        {!validationReady || loading ? (
          <Text style={styles.muted}>正在校验检查与补充状态...</Text>
        ) : missing.length ? (
          <Text style={styles.warn}>{`未满足：${missing.join('、')}`}</Text>
        ) : canSkipInspectionPhotos ? (
          <Text style={styles.ok}>已按 3pm 客人到达加急流程跳过检查照片</Text>
        ) : (
          <Text style={styles.ok}>前置检查已满足</Text>
        )}
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
        <Text style={styles.mutedSmall}>请先修改密码盒密码并拍视频；如果是直接把钥匙给客人，也需要拍视频留存。视频上传成功后会自动标记已完成。</Text>
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
        <View style={styles.row}>
          <Pressable
            onPress={onUploadVideo}
            disabled={uploading || submitting}
            style={({ pressed }) => [styles.grayBtn, uploading || submitting ? styles.disabled : null, pressed ? styles.pressed : null]}
          >
            <Text style={styles.grayText}>{uploading || submitting ? t('common_loading') : effectiveLockboxUrl ? '重拍视频并完成' : '拍视频并完成'}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
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
  ok: { marginTop: 8, color: '#16A34A', fontWeight: '900' },
  warn: { marginTop: 8, color: '#DC2626', fontWeight: '900' },
  warnSmall: { marginTop: 8, color: '#B45309', fontWeight: '900', fontSize: 12 },
  muted: { marginTop: 10, color: '#6B7280', fontWeight: '700' },
  mutedSmall: { marginTop: 8, color: '#6B7280', fontWeight: '700', fontSize: 12 },
  pressed: { opacity: 0.92 },
  linkBtn: { marginTop: 10, minHeight: 38, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#EFF6FF', borderWidth: hairline(), borderColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
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

  row: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  grayBtn: { flex: 1, flexShrink: 1, minWidth: 140, minHeight: 44, borderRadius: 12, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  grayText: { fontWeight: '900', color: '#111827', textAlign: 'center' },
  primaryBtn: { flex: 1, flexShrink: 1, minWidth: 140, minHeight: 44, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  primaryText: { fontWeight: '900', color: '#FFFFFF', textAlign: 'center' },
  disabled: { opacity: 0.65 },
  disabledPrimary: { backgroundColor: '#93C5FD' },
})
