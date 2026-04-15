import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { ResizeMode, Video } from 'expo-av'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { hairline, moderateScale } from '../../lib/scale'
import { getWorkTasksSnapshot } from '../../lib/workTasksStore'
import type { TasksStackParamList } from '../../navigation/RootNavigator'
import { getCompletionPhotos, listChecklistItems, selfCompleteCleaningTask, submitCleaningConsumables, uploadCleaningMedia, uploadCleaningVideo, uploadSelfLockboxVideo, saveCompletionPhotos, type ChecklistItem } from '../../lib/api'
import { API_BASE_URL } from '../../config/env'

type Props = NativeStackScreenProps<TasksStackParamList, 'CleaningSelfComplete'>

type PhotoArea = 'toilet' | 'living' | 'sofa' | 'bedroom' | 'kitchen'

type CompletionPhotoItem = { area: PhotoArea; url: string }

type SupplyItemState = {
  id: string
  label: string
  required: boolean
  status: 'ok' | 'low' | null
  qty: string
  note: string
  photo_url: string | null
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

function fmtTime(iso: string) {
  const d = new Date(String(iso || ''))
  if (Number.isNaN(d.getTime())) return String(iso || '')
  const pad2 = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function buildWatermarkText(propertyCode: string, username: string, iso: string) {
  const line1 = `${propertyCode || '未知房号'}${username ? `  ${username}` : ''}`.trim()
  const line2 = fmtTime(iso)
  return `${line1}\n${line2}`.trim()
}

function sectionTitle(no: string, title: string, icon: any) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionNo}>{no}</Text>
      <Ionicons name={icon} size={moderateScale(16)} color="#111827" />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  )
}

export default function CleaningSelfCompleteScreen(props: Props) {
  const { t } = useI18n()
  const { token, user } = useAuth()
  const insets = useSafeAreaInsets()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [savingPhotos, setSavingPhotos] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [suppliesLoading, setSuppliesLoading] = useState(false)
  const [suppliesSubmitting, setSuppliesSubmitting] = useState(false)
  const [expanded, setExpanded] = useState<Record<'supplies' | 'feedback' | 'photos' | 'complete', boolean>>({
    supplies: true,
    feedback: true,
    photos: true,
    complete: true,
  })

  const task = useMemo(() => getWorkTasksSnapshot().items.find(x => x.id === props.route.params.taskId) || null, [props.route.params.taskId])
  const cleaningTaskId = String(task?.source_id || '').trim()
  const propertyCode = String(task?.property?.code || '').trim()
  const propertyAddr = String(task?.property?.address || '').trim()

  const [completion, setCompletion] = useState<Record<PhotoArea, string[]>>({
    toilet: [],
    living: [],
    sofa: [],
    bedroom: [],
    kitchen: [],
  })
  const [lockboxLocalUrl, setLockboxLocalUrl] = useState<string | null>(null)
  const lockboxFromTask = String((task as any)?.lockbox_video_url || '').trim()
  const lockboxUrl = lockboxLocalUrl || lockboxFromTask || null
  const remainingNightsRaw = (task as any)?.remaining_nights
  const remainingNights0 = remainingNightsRaw == null ? null : Number(remainingNightsRaw)
  const remainingNights = Number.isFinite(remainingNights0 as any) ? (remainingNights0 as number) : null

  const viewerCloseRef = useRef<any>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerUrls, setViewerUrls] = useState<string[]>([])
  const [viewerIndex, setViewerIndex] = useState(0)

  const requiredAreas: PhotoArea[] = ['toilet', 'living', 'sofa', 'bedroom', 'kitchen']

  const completionOk = useMemo(() => requiredAreas.every(a => (completion[a] || []).length > 0), [completion])

  const [suppliesSubmitted, setSuppliesSubmitted] = useState(false)
  const [supplies, setSupplies] = useState<SupplyItemState[]>([])
  const [remoteAcPhotoUrl, setRemoteAcPhotoUrl] = useState<string | null>(null)
  const [remoteTvPhotoUrl, setRemoteTvPhotoUrl] = useState<string | null>(null)
  const [livingRoomPhotoUrl, setLivingRoomPhotoUrl] = useState<string | null>(String((task as any)?.living_room_photo_url || '').trim() || null)

  const lockboxOk = !!String(lockboxUrl || '').trim()

  const canSubmitSupplies = useMemo(() => {
    if (!supplies.length) return false
    for (const it of supplies) {
      if (it.id !== 'other') {
        if (it.status !== 'ok' && it.status !== 'low') return false
      }
      if (it.status === 'low') {
        const q = Number(String(it.qty || '').trim())
        if (!Number.isFinite(q) || q < 1) return false
        if (!String(it.photo_url || '').trim()) return false
      }
    }
    if (!String(livingRoomPhotoUrl || '').trim()) return false
    if (!String(remoteTvPhotoUrl || '').trim()) return false
    return true
  }, [livingRoomPhotoUrl, supplies, remoteAcPhotoUrl, remoteTvPhotoUrl])

  const refresh = useCallback(async () => {
    if (!token) return
    if (!cleaningTaskId) return
    try {
      setLoading(true)
      const r = await getCompletionPhotos(token, cleaningTaskId).catch(() => null)
      const next: Record<PhotoArea, string[]> = { toilet: [], living: [], sofa: [], bedroom: [], kitchen: [] }
      for (const it of r?.items || []) {
        const a = String(it.area || '').trim() as PhotoArea
        const url = String(it.url || '').trim()
        if (!url) continue
        if (!(a in next)) continue
        next[a].push(url)
      }
      setCompletion(next)
    } finally {
      setLoading(false)
    }
  }, [cleaningTaskId, token])

  const loadSuppliesChecklist = useCallback(async () => {
    if (!token) return
    if (supplies.length) return
    try {
      setSuppliesLoading(true)
      const list = await listChecklistItems(token)
      const mapped = (list || []).map((it: ChecklistItem) => ({
        id: it.id,
        label: it.label,
        required: !!it.required,
        status: it.id === 'other' ? ('ok' as const) : (null as any),
        qty: '1',
        note: '',
        photo_url: null,
      }))
      setSupplies(mapped)
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '加载失败'))
    } finally {
      setSuppliesLoading(false)
    }
  }, [supplies.length, t, token])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const nav: any = props.navigation as any
    if (!nav || typeof nav.addListener !== 'function') return
    const unsub = nav.addListener('focus', () => refresh())
    return unsub
  }, [props.navigation, refresh])

  useEffect(() => {
    loadSuppliesChecklist()
  }, [loadSuppliesChecklist])

  useEffect(() => {
    const next = String((task as any)?.living_room_photo_url || '').trim() || null
    if (next) setLivingRoomPhotoUrl(next)
  }, [task?.id])

  function toggle(k: keyof typeof expanded) {
    setExpanded(p => ({ ...p, [k]: !p[k] }))
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

  async function takePhotoAndUpload(area: PhotoArea) {
    if (!token) throw new Error('请先登录')
    const ok = await ensureCameraPerm()
    if (!ok) throw new Error('需要相机权限')
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1, allowsEditing: true, aspect: [4, 3] })
    if (res.canceled || !res.assets?.length) return null
    const a = res.assets[0] as any
    const uri = String(a.uri || '').trim()
    if (!uri) return null
    const name = String(a.fileName || uri.split('/').pop() || `completion-${area}-${Date.now()}.jpg`)
    const mimeType = String(a.mimeType || 'image/jpeg')
    const capturedAt = new Date().toISOString()
    const username = String((user as any)?.username || (user as any)?.email || '').trim()
    const watermarkText = buildWatermarkText(propertyCode, username, capturedAt)
    const up = await uploadCleaningMedia(token, { uri, name, mimeType }, { watermark: '1', purpose: 'completion_photo', property_code: propertyCode, captured_at: capturedAt, watermark_text: watermarkText })
    return { url: up.url, captured_at: capturedAt }
  }

  function setSupplyItem(idx: number, patch: Partial<SupplyItemState>) {
    setSupplies(prev => prev.map((x, i) => (i === idx ? { ...x, ...patch } : x)))
  }

  async function onTakeStockPhoto(idx: number) {
    if (!token) return
    try {
      const ok = await ensureCameraPerm()
      if (!ok) {
        Alert.alert(t('common_error'), '需要相机权限')
        return
      }
      const res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 })
      if (res.canceled || !res.assets?.length) return
      const a = res.assets[0] as any
      const uri = String(a.uri || '').trim()
      if (!uri) return
      const name = String(a.fileName || uri.split('/').pop() || `stock-${Date.now()}.jpg`)
      const mimeType = String(a.mimeType || 'image/jpeg')
      const up = await uploadCleaningMedia(token, { uri, name, mimeType })
      setSupplyItem(idx, { photo_url: up.url })
      Alert.alert(t('common_ok'), '库存照片已上传')
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '上传失败'))
    }
  }

  async function onTakeRemotePhoto(kind: 'ac' | 'tv') {
    if (!token) return
    try {
      const ok = await ensureCameraPerm()
      if (!ok) {
        Alert.alert(t('common_error'), '需要相机权限')
        return
      }
      const res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 })
      if (res.canceled || !res.assets?.length) return
      const a = res.assets[0] as any
      const uri = String(a.uri || '').trim()
      if (!uri) return
      const name = String(a.fileName || uri.split('/').pop() || `remote-${kind}-${Date.now()}.jpg`)
      const mimeType = String(a.mimeType || 'image/jpeg')
      const up = await uploadCleaningMedia(token, { uri, name, mimeType })
      if (kind === 'ac') setRemoteAcPhotoUrl(up.url)
      else setRemoteTvPhotoUrl(up.url)
      Alert.alert(t('common_ok'), '照片已上传')
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '上传失败'))
    }
  }

  async function onUploadLivingRoomPhoto(source: 'camera' | 'library') {
    if (!token) return
    try {
      const ok = source === 'camera' ? await ensureCameraPerm() : await ensureLibraryPerm()
      if (!ok) {
        Alert.alert(t('common_error'), source === 'camera' ? '需要相机权限' : '需要相册权限')
        return
      }
      const res =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1, allowsEditing: true, aspect: [4, 3] })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1, allowsEditing: true, aspect: [4, 3] })
      if (res.canceled || !res.assets?.length) return
      const a = res.assets[0] as any
      const uri = String(a.uri || '').trim()
      if (!uri) return
      const name = String(a.fileName || uri.split('/').pop() || `living-room-${Date.now()}.jpg`)
      const mimeType = String(a.mimeType || 'image/jpeg')
      const up = await uploadCleaningMedia(token, { uri, name, mimeType }, { purpose: 'consumable_living_room_photo' })
      setLivingRoomPhotoUrl(up.url)
      Alert.alert(t('common_ok'), '客厅照片已上传')
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '上传失败'))
    }
  }

  async function onSubmitSupplies() {
    if (!token) return Alert.alert(t('common_error'), '请先登录')
    if (!cleaningTaskId) return Alert.alert(t('common_error'), '缺少任务信息')
    if (!canSubmitSupplies) return Alert.alert(t('common_error'), '请完成所有消耗品检查，并上传客厅照片（不足项需拍照）')
    const out = supplies.map(x => ({
      item_id: x.id,
      status: x.status as any,
      qty: x.status === 'low' ? Number(String(x.qty || '').trim()) : undefined,
      note: x.note.trim() || undefined,
      photo_url: x.photo_url || undefined,
    }))
    if (String(remoteAcPhotoUrl || '').trim()) {
      out.push({
        item_id: 'remote_ac',
        status: 'ok' as any,
        photo_url: remoteAcPhotoUrl || undefined,
      } as any)
    }
    out.push({
      item_id: 'remote_tv',
      status: 'ok' as any,
      photo_url: remoteTvPhotoUrl || undefined,
    } as any)
    try {
      setSuppliesSubmitting(true)
      await submitCleaningConsumables(token, cleaningTaskId, { living_room_photo_url: String(livingRoomPhotoUrl || '').trim(), items: out })
      setSuppliesSubmitted(true)
      Alert.alert(t('common_ok'), '提交成功')
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '提交失败'))
    } finally {
      setSuppliesSubmitting(false)
    }
  }

  async function onAddCompletionPhoto(area: PhotoArea) {
    if (!token) return Alert.alert(t('common_error'), '请先登录')
    if (!cleaningTaskId) return Alert.alert(t('common_error'), '缺少任务信息')
    if (uploading || savingPhotos) return
    try {
      setUploading(true)
      const up = await takePhotoAndUpload(area)
      if (!up?.url) return
      const next = { ...completion, [area]: [...(completion[area] || []), up.url] }
      setCompletion(next)
      setSavingPhotos(true)
      const flat: CompletionPhotoItem[] = []
      for (const a0 of requiredAreas) {
        for (const u of next[a0] || []) flat.push({ area: a0, url: u })
      }
      await saveCompletionPhotos(token, cleaningTaskId, { items: flat })
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '上传失败'))
      refresh().catch(() => null)
    } finally {
      setUploading(false)
      setSavingPhotos(false)
    }
  }

  async function onRemovePhoto(area: PhotoArea, url: string) {
    if (!token) return
    if (!cleaningTaskId) return
    if (savingPhotos) return
    const next = { ...completion, [area]: (completion[area] || []).filter(x => x !== url) }
    setCompletion(next)
    try {
      setSavingPhotos(true)
      const flat: CompletionPhotoItem[] = []
      for (const a0 of requiredAreas) {
        for (const u of next[a0] || []) flat.push({ area: a0, url: u })
      }
      await saveCompletionPhotos(token, cleaningTaskId, { items: flat })
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '保存失败'))
      refresh().catch(() => null)
    } finally {
      setSavingPhotos(false)
    }
  }

  async function onUploadLockboxVideo() {
    if (!token) return Alert.alert(t('common_error'), '请先登录')
    if (!cleaningTaskId) return Alert.alert(t('common_error'), '缺少任务信息')
    if (uploading || submitting) return
    try {
      setUploading(true)
      const ok = await ensureCameraPerm()
      if (!ok) {
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
      await uploadSelfLockboxVideo(token, cleaningTaskId, { media_url: up.url })
      Alert.alert(t('common_ok'), '视频已上传')
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '上传失败'))
    } finally {
      setUploading(false)
    }
  }

  async function onSelfComplete() {
    if (!token) return Alert.alert(t('common_error'), '请先登录')
    if (!cleaningTaskId) return Alert.alert(t('common_error'), '缺少任务信息')
    if (!lockboxOk) return Alert.alert(t('common_error'), '请先上传挂钥匙视频')
    if (!completionOk) return Alert.alert(t('common_error'), '请先上传房间完成照片')
    try {
      setSubmitting(true)
      await selfCompleteCleaningTask(token, cleaningTaskId)
      Alert.alert(t('common_ok'), '已标记已完成')
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
    <>
      <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingBottom: Math.max(16, insets.bottom) + 10 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.headRow}>
            <View style={styles.badge}>
              <Ionicons name="home-outline" size={moderateScale(14)} color="#2563EB" />
              <Text style={styles.badgeText} numberOfLines={1}>
                {propertyCode || task.title}
              </Text>
            </View>
            {loading ? <Text style={styles.mutedSmall}>{t('common_loading')}</Text> : null}
          </View>
          {propertyAddr ? <Text style={styles.sub}>{propertyAddr}</Text> : null}
        </View>

        <View style={styles.card}>
          <Pressable onPress={() => toggle('supplies')} style={({ pressed }) => [styles.sectionHead, pressed ? styles.pressed : null]}>
            {sectionTitle('1.', '消耗品补充', 'cube-outline')}
            <Ionicons name={expanded.supplies ? 'chevron-up' : 'chevron-down'} size={moderateScale(18)} color="#6B7280" />
          </Pressable>
          {expanded.supplies ? (
            <>
              <Text style={styles.mutedSmall}>请完成消耗品补充（不足项需拍照）。</Text>
              <Text style={styles.mutedSmall}>{`待住晚数：${remainingNights == null ? '-' : String(remainingNights)}`}</Text>
              {suppliesSubmitted ? <Text style={styles.ok}>已提交</Text> : suppliesLoading ? <Text style={styles.mutedSmall}>{t('common_loading')}</Text> : <Text style={styles.warn}>未提交</Text>}
              <View style={styles.supBlock}>
                <Text style={styles.supLabel}>客厅照片</Text>
                <Text style={styles.mutedSmall}>提交补品前需重新提供一张客厅照片。</Text>
                <View style={styles.supRow}>
                  <Pressable
                    onPress={() => onUploadLivingRoomPhoto('camera')}
                    disabled={suppliesSubmitting}
                    style={({ pressed }) => [styles.supPhotoBtn, pressed ? styles.pressed : null, suppliesSubmitting ? styles.disabled : null]}
                  >
                    <Text style={styles.supPhotoText}>{livingRoomPhotoUrl ? '重新拍照' : '拍照'}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => onUploadLivingRoomPhoto('library')}
                    disabled={suppliesSubmitting}
                    style={({ pressed }) => [styles.supPhotoBtn, pressed ? styles.pressed : null, suppliesSubmitting ? styles.disabled : null]}
                  >
                    <Text style={styles.supPhotoText}>相册上传</Text>
                  </Pressable>
                </View>
                {livingRoomPhotoUrl ? (
                  <Pressable
                    onPress={() => {
                      setViewerUrls([toAbsoluteUrl(livingRoomPhotoUrl)])
                      setViewerIndex(0)
                      setViewerOpen(true)
                    }}
                    style={({ pressed }) => [styles.supPhotoPreview, pressed ? styles.pressed : null]}
                  >
                    <Image source={{ uri: toAbsoluteUrl(livingRoomPhotoUrl) }} style={styles.supPreviewImg} />
                  </Pressable>
                ) : null}
              </View>
              {supplies.map((it, idx) => (
                <View key={it.id} style={styles.supBlock}>
                  <Text style={styles.supLabel}>{it.label}</Text>
                  {it.id === 'other' ? (
                    <TextInput
                      value={it.note}
                      onChangeText={(v) => setSupplyItem(idx, { note: v })}
                      style={[styles.supInput, styles.supNote]}
                      placeholder="其他需要补充/检查的内容（可选）"
                      placeholderTextColor="#9CA3AF"
                      multiline
                    />
                  ) : (
                    <View style={styles.supRow}>
                      <Pressable
                        onPress={() => setSupplyItem(idx, { status: 'ok', photo_url: null })}
                        style={({ pressed }) => [styles.supChip, it.status === 'ok' ? styles.supChipActive : null, pressed ? styles.pressed : null]}
                      >
                        <Text style={[styles.supChipText, it.status === 'ok' ? styles.supChipTextActive : null]}>足够</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setSupplyItem(idx, { status: 'low' })}
                        style={({ pressed }) => [styles.supChip, it.status === 'low' ? styles.supChipActive : null, pressed ? styles.pressed : null]}
                      >
                        <Text style={[styles.supChipText, it.status === 'low' ? styles.supChipTextActive : null]}>不足</Text>
                      </Pressable>
                    </View>
                  )}
                  {it.status === 'low' ? (
                    <>
                      <View style={styles.supRow}>
                        <TextInput
                          value={it.qty}
                          onChangeText={(v) => setSupplyItem(idx, { qty: v.replace(/[^\d]/g, '').slice(0, 6) })}
                          style={[styles.supInput, styles.supQty]}
                          placeholder="缺多少（数量）"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="number-pad"
                        />
                        <Pressable
                          onPress={() => onTakeStockPhoto(idx)}
                          disabled={suppliesSubmitting}
                          style={({ pressed }) => [styles.supPhotoBtn, pressed ? styles.pressed : null, suppliesSubmitting ? styles.disabled : null]}
                        >
                          <Text style={styles.supPhotoText}>{it.photo_url ? '已拍照' : '拍照库存'}</Text>
                        </Pressable>
                      </View>
                      {it.photo_url ? (
                        <Pressable
                          onPress={() => {
                            setViewerUrls([toAbsoluteUrl(it.photo_url)])
                            setViewerIndex(0)
                            setViewerOpen(true)
                          }}
                          style={({ pressed }) => [styles.supPhotoPreview, pressed ? styles.pressed : null]}
                        >
                          <Image source={{ uri: toAbsoluteUrl(it.photo_url) }} style={styles.supPreviewImg} />
                        </Pressable>
                      ) : null}
                      <TextInput
                        value={it.note}
                        onChangeText={(v) => setSupplyItem(idx, { note: v })}
                        style={[styles.supInput, styles.supNote]}
                        placeholder="备注（可选）"
                        placeholderTextColor="#9CA3AF"
                        multiline
                      />
                    </>
                  ) : null}
                </View>
              ))}
              <View style={styles.supBlock}>
                <Text style={styles.supLabel}>遥控器拍照</Text>
                <Text style={styles.mutedSmall}>请拍照：电视遥控器、空调遥控器。</Text>
                <Text style={styles.mutedSmall}>备注：空调遥控器嵌在墙上的不用拍照。</Text>

                <Text style={[styles.supLabel, { marginTop: 10 }]}>空调遥控器</Text>
                <View style={styles.supRow}>
                  <Pressable
                    onPress={() => onTakeRemotePhoto('ac')}
                    disabled={suppliesSubmitting}
                    style={({ pressed }) => [styles.supPhotoBtn, pressed ? styles.pressed : null, suppliesSubmitting ? styles.disabled : null]}
                  >
                    <Text style={styles.supPhotoText}>{remoteAcPhotoUrl ? '已拍照' : '拍照'}</Text>
                  </Pressable>
                </View>
                {remoteAcPhotoUrl ? (
                  <Pressable
                    onPress={() => {
                      setViewerUrls([toAbsoluteUrl(remoteAcPhotoUrl)])
                      setViewerIndex(0)
                      setViewerOpen(true)
                    }}
                    style={({ pressed }) => [styles.supPhotoPreview, pressed ? styles.pressed : null]}
                  >
                    <Image source={{ uri: toAbsoluteUrl(remoteAcPhotoUrl) }} style={styles.supPreviewImg} />
                  </Pressable>
                ) : null}

                <Text style={[styles.supLabel, { marginTop: 12 }]}>电视遥控器</Text>
                <View style={styles.supRow}>
                  <Pressable
                    onPress={() => onTakeRemotePhoto('tv')}
                    disabled={suppliesSubmitting}
                    style={({ pressed }) => [styles.supPhotoBtn, pressed ? styles.pressed : null, suppliesSubmitting ? styles.disabled : null]}
                  >
                    <Text style={styles.supPhotoText}>{remoteTvPhotoUrl ? '已拍照' : '拍照'}</Text>
                  </Pressable>
                </View>
                {remoteTvPhotoUrl ? (
                  <Pressable
                    onPress={() => {
                      setViewerUrls([toAbsoluteUrl(remoteTvPhotoUrl)])
                      setViewerIndex(0)
                      setViewerOpen(true)
                    }}
                    style={({ pressed }) => [styles.supPhotoPreview, pressed ? styles.pressed : null]}
                  >
                    <Image source={{ uri: toAbsoluteUrl(remoteTvPhotoUrl) }} style={styles.supPreviewImg} />
                  </Pressable>
                ) : null}
              </View>
              {supplies.length ? (
                <Pressable
                  onPress={onSubmitSupplies}
                  disabled={suppliesSubmitting || !canSubmitSupplies}
                  style={({ pressed }) => [styles.primaryBtn, pressed ? styles.pressed : null, suppliesSubmitting || !canSubmitSupplies ? styles.disabledPrimary : null]}
                >
                  <Text style={styles.primaryText}>{suppliesSubmitting ? t('common_loading') : '提交消耗品补充'}</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}
        </View>

        <View style={styles.card}>
          <Pressable onPress={() => toggle('feedback')} style={({ pressed }) => [styles.sectionHead, pressed ? styles.pressed : null]}>
            {sectionTitle('2.', '房源问题反馈', 'chatbubble-ellipses-outline')}
            <Ionicons name={expanded.feedback ? 'chevron-up' : 'chevron-down'} size={moderateScale(18)} color="#6B7280" />
          </Pressable>
          {expanded.feedback ? (
            <>
              <Text style={styles.mutedSmall}>如发现问题，请提交反馈（可选）。</Text>
              <View style={styles.row}>
                <Pressable
                  onPress={() => props.navigation.navigate('FeedbackForm', { taskId: task.id })}
                  style={({ pressed }) => [styles.grayBtn, pressed ? styles.pressed : null]}
                >
                  <Text style={styles.grayText}>进入房源问题反馈</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </View>

        <View style={styles.card}>
          <Pressable onPress={() => toggle('photos')} style={({ pressed }) => [styles.sectionHead, pressed ? styles.pressed : null]}>
            {sectionTitle('3.', '房间完成照片', 'camera-outline')}
            <Ionicons name={expanded.photos ? 'chevron-up' : 'chevron-down'} size={moderateScale(18)} color="#6B7280" />
          </Pressable>
          {expanded.photos ? (
            <>
              <Text style={styles.mutedSmall}>每个区域至少 1 张照片。</Text>
              {completionOk ? <Text style={styles.ok}>已满足</Text> : <Text style={styles.warn}>未满足</Text>}
              {requiredAreas.map((a) => {
                const list = completion[a] || []
                const title =
                  a === 'toilet' ? '浴室' :
                    a === 'living' ? '客厅' :
                      a === 'sofa' ? '沙发' :
                        a === 'bedroom' ? '卧室' :
                          a === 'kitchen' ? '厨房' :
                            a
                return (
                  <View key={a} style={{ marginTop: 10 }}>
                    <View style={styles.areaHead}>
                      <Text style={styles.areaTitle}>{title}</Text>
                      <Text style={styles.areaCount}>{`${list.length}`}</Text>
                      <Pressable
                        onPress={() => onAddCompletionPhoto(a)}
                        disabled={uploading || savingPhotos}
                        style={({ pressed }) => [styles.areaBtn, pressed ? styles.pressed : null, uploading || savingPhotos ? styles.disabled : null]}
                      >
                        <Text style={styles.areaBtnText}>拍照</Text>
                      </Pressable>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 6 }}>
                      {list.map((u, idx) => (
                        <View key={`${u}:${idx}`} style={styles.thumbWrap}>
                          <Pressable
                            onPress={() => {
                              setViewerUrls(list.map(x => toAbsoluteUrl(x)))
                              setViewerIndex(idx)
                              setViewerOpen(true)
                            }}
                            style={({ pressed }) => [styles.thumbPress, pressed ? styles.pressed : null]}
                          >
                            <Image source={{ uri: toAbsoluteUrl(u) }} style={styles.thumb} />
                          </Pressable>
                          <Pressable
                            onPress={() => onRemovePhoto(a, u)}
                            disabled={savingPhotos}
                            style={({ pressed }) => [styles.removeBtn, pressed ? styles.pressed : null, savingPhotos ? styles.disabled : null]}
                          >
                            <Ionicons name="close" size={moderateScale(14)} color="#FFFFFF" />
                          </Pressable>
                        </View>
                      ))}
                      {!list.length ? <Text style={styles.mutedSmall}>暂无照片</Text> : null}
                    </ScrollView>
                  </View>
                )
              })}
            </>
          ) : null}
        </View>

        <View style={styles.card}>
          <Pressable onPress={() => toggle('complete')} style={({ pressed }) => [styles.sectionHead, pressed ? styles.pressed : null]}>
            {sectionTitle('4.', '标记已完成', 'checkmark-circle-outline')}
            <Ionicons name={expanded.complete ? 'chevron-up' : 'chevron-down'} size={moderateScale(18)} color="#6B7280" />
          </Pressable>
          {expanded.complete ? (
            <>
              <View style={{ marginTop: 8, gap: 6 }}>
                <Text style={styles.mutedSmall}>{`消耗品补充：${suppliesSubmitted ? '已提交' : '未提交'}`}</Text>
                <Text style={styles.mutedSmall}>{`房间完成照片：${completionOk ? '已满足' : '未满足'}`}</Text>
                <Text style={styles.mutedSmall}>{`挂钥匙视频：${lockboxOk ? '已上传' : '未上传'}`}</Text>
              </View>

              <View style={{ marginTop: 10 }}>
                <Text style={styles.mutedSmall}>挂钥匙视频（可重传）</Text>
                {lockboxOk ? (
                  <View style={styles.videoWrap}>
                    <Video
                      source={{ uri: toAbsoluteUrl(lockboxUrl) }}
                      style={styles.video}
                      resizeMode={ResizeMode.CONTAIN}
                      shouldPlay={false}
                      useNativeControls
                    />
                  </View>
                ) : null}
                <View style={styles.row}>
                  <Pressable
                    onPress={onUploadLockboxVideo}
                    disabled={uploading || submitting}
                    style={({ pressed }) => [styles.grayBtn, pressed ? styles.pressed : null, uploading || submitting ? styles.disabled : null]}
                  >
                    <Text style={styles.grayText}>{lockboxOk ? '重传视频' : '上传视频'}</Text>
                  </Pressable>
                  <Pressable
                    onPress={onSelfComplete}
                    disabled={uploading || submitting}
                    style={({ pressed }) => [styles.primaryBtn, pressed ? styles.pressed : null, uploading || submitting ? styles.disabledPrimary : null]}
                  >
                    <Text style={styles.primaryText}>{submitting ? t('common_loading') : '标记已完成'}</Text>
                  </Pressable>
                </View>
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>

      <Modal visible={viewerOpen} transparent animationType="fade" onRequestClose={() => setViewerOpen(false)}>
        <Pressable style={styles.viewerBackdrop} onPress={() => setViewerOpen(false)}>
          <Pressable style={styles.viewerCard} onPress={() => {}}>
            <View style={[styles.viewerHead, { paddingTop: Math.max(insets.top, 10) }]}>
              <Pressable
                onPress={() => {
                  setViewerOpen(false)
                  try {
                    if (viewerCloseRef.current) clearTimeout(viewerCloseRef.current)
                  } catch {}
                }}
                style={({ pressed }) => [styles.viewerCloseBtn, pressed ? styles.pressed : null]}
              >
                <Text style={styles.viewerCloseText}>关闭</Text>
              </Pressable>
            </View>
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentOffset={{ x: viewerIndex * 320, y: 0 }}>
              {viewerUrls.map((u, i) => (
                <View key={`${u}:${i}`} style={styles.viewerSlide}>
                  <Image source={{ uri: u }} style={styles.viewerImg} resizeMode="contain" />
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F6F7FB' },
  content: { padding: 16, gap: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, borderWidth: hairline(), borderColor: '#EEF0F6' },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  badge: { height: 30, paddingHorizontal: 10, borderRadius: 12, backgroundColor: '#EFF6FF', borderWidth: hairline(), borderColor: '#DBEAFE', flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '72%' },
  badgeText: { color: '#2563EB', fontWeight: '900', flexShrink: 1 },
  sub: { marginTop: 8, color: '#6B7280', fontWeight: '700' },
  muted: { marginTop: 10, color: '#6B7280', fontWeight: '700' },
  mutedSmall: { marginTop: 6, color: '#6B7280', fontWeight: '700', fontSize: 12 },
  ok: { marginTop: 8, color: '#16A34A', fontWeight: '900' },
  warn: { marginTop: 8, color: '#DC2626', fontWeight: '900' },
  pressed: { opacity: 0.92 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionNo: { width: 22, fontWeight: '900', color: '#6B7280' },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: '#111827' },
  row: { marginTop: 10, flexDirection: 'row', gap: 10 },
  primaryBtn: { flex: 1, height: 40, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontWeight: '900' },
  grayBtn: { flex: 1, height: 40, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', borderWidth: hairline(), borderColor: '#E5E7EB' },
  grayText: { color: '#111827', fontWeight: '900' },
  disabled: { opacity: 0.6 },
  disabledPrimary: { backgroundColor: '#93C5FD' },
  areaHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  areaTitle: { flex: 1, color: '#111827', fontWeight: '900' },
  areaCount: { width: 24, textAlign: 'center', color: '#6B7280', fontWeight: '900' },
  areaBtn: { height: 30, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  areaBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  thumbWrap: { width: 90, height: 90, borderRadius: 12, overflow: 'hidden', borderWidth: hairline(), borderColor: '#EEF0F6' },
  thumbPress: { width: '100%', height: '100%' },
  thumb: { width: '100%', height: '100%' },
  removeBtn: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  supBlock: { marginTop: 12, paddingTop: 10, borderTopWidth: hairline(), borderTopColor: '#EEF0F6' },
  supLabel: { color: '#111827', fontWeight: '900' },
  supRow: { marginTop: 8, flexDirection: 'row', gap: 10, alignItems: 'center' },
  supChip: { flex: 1, height: 34, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', borderWidth: hairline(), borderColor: '#E5E7EB' },
  supChipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  supChipText: { color: '#111827', fontWeight: '900' },
  supChipTextActive: { color: '#FFFFFF' },
  supInput: { height: 38, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: hairline(), borderColor: '#E5E7EB', paddingHorizontal: 10, color: '#111827', fontWeight: '800' },
  supQty: { flex: 1 },
  supNote: { marginTop: 8, minHeight: 80, textAlignVertical: 'top', paddingTop: 10, paddingBottom: 10 },
  supPhotoBtn: { width: 110, height: 38, borderRadius: 12, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  supPhotoText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  supPhotoPreview: { marginTop: 8, borderRadius: 14, overflow: 'hidden', borderWidth: hairline(), borderColor: '#EEF0F6' },
  supPreviewImg: { width: '100%', height: 180, backgroundColor: '#F3F4F6' },
  videoWrap: { marginTop: 10, borderRadius: 14, overflow: 'hidden', borderWidth: hairline(), borderColor: '#EEF0F6', backgroundColor: '#F3F4F6' },
  video: { width: '100%', height: 240 },
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', padding: 12, alignItems: 'center', justifyContent: 'center' },
  viewerCard: { width: '100%', backgroundColor: '#111827', borderRadius: 16, overflow: 'hidden' },
  viewerHead: { flexDirection: 'row', justifyContent: 'flex-end' },
  viewerCloseBtn: { paddingVertical: 10, paddingHorizontal: 14 },
  viewerCloseText: { color: '#FFFFFF', fontWeight: '900' },
  viewerSlide: { width: 320, height: 420, alignItems: 'center', justifyContent: 'center' },
  viewerImg: { width: '100%', height: '100%' },
})
