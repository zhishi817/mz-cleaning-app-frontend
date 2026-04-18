import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { ResizeMode, Video } from 'expo-av'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { API_BASE_URL } from '../../config/env'
import { getInspectionPhotos, uploadCleaningVideo, uploadLockboxVideo } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { hairline, moderateScale } from '../../lib/scale'
import { getWorkTasksSnapshot } from '../../lib/workTasksStore'
import type { TasksStackParamList } from '../../navigation/RootNavigator'

type Props = NativeStackScreenProps<TasksStackParamList, 'InspectionComplete'>

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
  const refresh = useCallback(async () => {
    if (!token) return
    if (!cleaningTaskId) return
    try {
      setLoading(true)
      setValidationReady(false)
      const p = await getInspectionPhotos(token, cleaningTaskId).catch(() => null)
      const needs: string[] = []

      const requiredAreas = ['toilet', 'living', 'sofa', 'bedroom', 'kitchen', 'shower_drain']
      const gotAreas = new Set<string>()
      for (const it of p?.items || []) {
        const a = String(it.area || '').trim()
        if (a) gotAreas.add(a)
      }
      const missingAreas = requiredAreas.filter(a => !gotAreas.has(a))
      if (missingAreas.length) needs.push('关键区域照片未齐')

      setMissing(needs)
      setValidationReady(true)
    } finally {
      setLoading(false)
    }
  }, [cleaningTaskId, token])

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
    try {
      setUploading(true)
      const perm = await ImagePicker.requestCameraPermissionsAsync()
      if (!perm.granted) {
        Alert.alert(t('common_error'), '需要相机权限')
        return
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
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
      Alert.alert(t('common_ok'), '视频已上传')
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '上传失败'))
    } finally {
      setUploading(false)
    }
  }

  async function onComplete() {
    if (!token) return Alert.alert(t('common_error'), '请先登录')
    if (!cleaningTaskId) return Alert.alert(t('common_error'), '缺少任务信息')
    if (!validationReady || loading) return Alert.alert(t('common_error'), '正在校验检查与补充状态，请稍候')
    if (missing.length) return Alert.alert(t('common_error'), missing.join('、'))
    const u = String(effectiveLockboxUrl || '').trim()
    if (!u) return Alert.alert(t('common_error'), '请先上传挂钥匙视频')
    try {
      setSubmitting(true)
      await uploadLockboxVideo(token, cleaningTaskId, { media_url: u })
      Alert.alert(t('common_ok'), '已完成')
      props.navigation.goBack()
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '提交失败'))
    } finally {
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
        ) : (
          <Text style={styles.ok}>前置检查已满足</Text>
        )}
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
            <Text style={styles.sectionTitle}>挂钥匙视频</Text>
          </View>
        </View>
        <Text style={styles.mutedSmall}>请上传挂钥匙视频，完成后可标记已完成。</Text>
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
            <Text style={styles.grayText}>{effectiveLockboxUrl ? '重传视频' : '上传视频'}</Text>
          </Pressable>
          <Pressable
            onPress={onComplete}
            disabled={uploading || submitting}
            style={({ pressed }) => [styles.primaryBtn, uploading || submitting ? styles.disabledPrimary : null, pressed ? styles.pressed : null]}
          >
            <Text style={styles.primaryText}>标记已完成</Text>
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
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { fontSize: 16, fontWeight: '900', color: '#111827' },
  badge: { height: 30, paddingHorizontal: 10, borderRadius: 12, backgroundColor: '#EFF6FF', borderWidth: hairline(), borderColor: '#DBEAFE', flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '70%' },
  badgeText: { color: '#2563EB', fontWeight: '900', flexShrink: 1 },
  ok: { marginTop: 8, color: '#16A34A', fontWeight: '900' },
  warn: { marginTop: 8, color: '#DC2626', fontWeight: '900' },
  muted: { marginTop: 10, color: '#6B7280', fontWeight: '700' },
  mutedSmall: { marginTop: 8, color: '#6B7280', fontWeight: '700', fontSize: 12 },
  pressed: { opacity: 0.92 },
  linkBtn: { marginTop: 10, height: 38, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#EFF6FF', borderWidth: hairline(), borderColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  linkText: { fontWeight: '900', color: '#2563EB' },

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontWeight: '900', color: '#111827' },
  previewBtn: { marginTop: 10, height: 38, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  previewText: { fontWeight: '900', color: '#111827' },
  videoWrap: { marginTop: 12, borderRadius: 14, overflow: 'hidden', borderWidth: hairline(), borderColor: '#EEF0F6', backgroundColor: '#0B0F17' },
  video: { width: '100%', height: 220, backgroundColor: '#0B0F17' },

  row: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  grayBtn: { flex: 1, height: 44, borderRadius: 12, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  grayText: { fontWeight: '900', color: '#111827' },
  primaryBtn: { flex: 1, height: 44, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontWeight: '900', color: '#FFFFFF' },
  disabled: { opacity: 0.65 },
  disabledPrimary: { backgroundColor: '#93C5FD' },
})
