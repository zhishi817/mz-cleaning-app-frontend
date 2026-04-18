import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { hairline, moderateScale } from '../../lib/scale'
import { getJson, setJson } from '../../lib/storage'
import { getWorkTasksSnapshot } from '../../lib/workTasksStore'
import { getCleaningConsumables, listChecklistItems, submitCleaningConsumables, uploadCleaningMedia, type ChecklistItem } from '../../lib/api'
import type { TasksStackParamList } from '../../navigation/RootNavigator'

type Props = NativeStackScreenProps<TasksStackParamList, 'SuppliesForm'>

type ItemState = {
  id: string
  label: string
  required: boolean
  status: 'ok' | 'low' | null
  qty: string
  note: string
  photo_url: string | null
}

type CachedConsumablesRecord = {
  living_room_photo_url?: string | null
  items?: Array<{ item_id: string; qty?: number | null; note?: string | null; status?: string | null; photo_url?: string | null }>
}

const SHOWER_DRAIN_PHOTOS = [
  { id: 'shower_drain_photo_1', label: '淋浴房下水口 1' },
  { id: 'shower_drain_photo_2', label: '淋浴房下水口 2' },
  { id: 'shower_drain_photo_3', label: '淋浴房下水口 3' },
] as const

const KITCHEN_REQUIRED_PHOTOS = [
  { id: 'coffee_machine_photo', label: '咖啡机' },
  { id: 'kettle_photo', label: '烧水壶' },
  { id: 'toaster_photo', label: '面包机' },
] as const

function buildBaseItems(list: ChecklistItem[]) {
  return (list || []).map((it: ChecklistItem) => ({
    id: it.id,
    label: it.label,
    required: !!it.required,
    status: it.id === 'other' ? ('ok' as const) : (null as any),
    qty: '1',
    note: '',
    photo_url: null,
  }))
}

function applyExistingToItems(baseMapped: ItemState[], existingItems: any[]) {
  const byId = new Map((existingItems || []).map((x: any) => [String(x.item_id || ''), x]))
  return baseMapped.map((it): ItemState => {
    const prev = byId.get(it.id)
    if (!prev) return it
    if (it.id === 'other') return { ...it, note: String(prev.note || '') }
    return {
      ...it,
      status: (String(prev.status || '').trim() === 'low' ? 'low' : 'ok') as 'ok' | 'low',
      qty: prev.qty != null ? String(prev.qty) : '1',
      note: String(prev.note || ''),
      photo_url: String(prev.photo_url || '').trim() || null,
    }
  })
}

const SUPPLIES_CHECKLIST_CACHE_KEY = 'supplies_checklist_v1'
function suppliesRecordCacheKey(taskId: string) {
  return `supplies_record_${String(taskId || '').trim()}`
}

export default function SuppliesFormScreen(props: Props) {
  const { t } = useI18n()
  const { token, user } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<ItemState[]>([])
  const [photoUploadingIdx, setPhotoUploadingIdx] = useState<number | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)
  const [batchUploadingGroup, setBatchUploadingGroup] = useState<string | null>(null)
  const [remoteAcPhotoUrl, setRemoteAcPhotoUrl] = useState<string | null>(null)
  const [remoteTvPhotoUrl, setRemoteTvPhotoUrl] = useState<string | null>(null)
  const [livingRoomPhotoUrl, setLivingRoomPhotoUrl] = useState<string | null>(null)
  const [extraPhotoUrls, setExtraPhotoUrls] = useState<Record<string, string | null>>({})
  const [hasExistingRecord, setHasExistingRecord] = useState(false)

  useEffect(() => {
    props.navigation.setOptions({ title: hasExistingRecord ? '补品记录' : '补品填报' })
  }, [hasExistingRecord, props.navigation])

  const task = useMemo(() => getWorkTasksSnapshot().items.find(x => x.id === props.route.params.taskId) || null, [props.route.params.taskId])
  const cleaningTaskId = useMemo(() => String(task?.source_id || props.route.params.taskId || '').trim(), [props.route.params.taskId, task?.source_id])
  const propertyCode = String(task?.property?.code || task?.title || '').trim()
  const allRequiredScenePhotos = useMemo(
    () => [
      ...SHOWER_DRAIN_PHOTOS,
      ...KITCHEN_REQUIRED_PHOTOS,
    ],
    [],
  )
  const remainingNightsRaw = (task as any)?.remaining_nights
  const remainingNights0 = remainingNightsRaw == null ? null : Number(remainingNightsRaw)
  const remainingNights = Number.isFinite(remainingNights0 as any) ? (remainingNights0 as number) : null
  const regularItems = useMemo(() => items.filter(it => it.id !== 'other'), [items])
  const otherItem = useMemo(() => items.find(it => it.id === 'other') || null, [items])
  const completedChecks = useMemo(() => regularItems.filter(it => it.status === 'ok' || it.status === 'low').length, [regularItems])
  const lowStockCount = useMemo(() => regularItems.filter(it => it.status === 'low').length, [regularItems])
  const requiredPhotosReady = useMemo(() => {
    let count = 0
    if (String(livingRoomPhotoUrl || '').trim()) count += 1
    for (const item of allRequiredScenePhotos) {
      if (String(extraPhotoUrls[item.id] || '').trim()) count += 1
    }
    if (String(remoteTvPhotoUrl || '').trim()) count += 1
    return count
  }, [allRequiredScenePhotos, extraPhotoUrls, livingRoomPhotoUrl, remoteTvPhotoUrl])

  function setItem(idx: number, patch: Partial<ItemState>) {
    setItems(prev => prev.map((x, i) => (i === idx ? { ...x, ...patch } : x)))
  }

  function buildWatermarkText(capturedAt: string) {
    const d = new Date(capturedAt)
    const pad2 = (n: number) => String(n).padStart(2, '0')
    const stamp = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
    const username = String((user as any)?.username || (user as any)?.email || '').trim() || '未知用户'
    return `${propertyCode || '未知房号'}  ${username}\n${stamp}`
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [cachedChecklist, cachedRecord] = await Promise.all([
          getJson<ChecklistItem[]>(SUPPLIES_CHECKLIST_CACHE_KEY),
          cleaningTaskId ? getJson<CachedConsumablesRecord>(suppliesRecordCacheKey(cleaningTaskId)) : Promise.resolve(null),
        ])
        if (cancelled) return
        const baseList = Array.isArray(cachedChecklist) ? cachedChecklist : []
        if (baseList.length) {
          const mapped = applyExistingToItems(buildBaseItems(baseList), Array.isArray(cachedRecord?.items) ? cachedRecord?.items || [] : [])
          setItems(mapped)
          setHasExistingRecord(!!(cachedRecord?.items && cachedRecord.items.length))
        }
        const byId = new Map((Array.isArray(cachedRecord?.items) ? cachedRecord?.items : []).map((x: any) => [String(x.item_id || ''), x]))
        const nextExtraPhotos = Object.fromEntries(
          allRequiredScenePhotos.map((item) => [item.id, String(byId.get(item.id)?.photo_url || '').trim() || null]),
        ) as Record<string, string | null>
        setRemoteAcPhotoUrl(String(byId.get('remote_ac')?.photo_url || '').trim() || null)
        setRemoteTvPhotoUrl(String(byId.get('remote_tv')?.photo_url || '').trim() || null)
        setLivingRoomPhotoUrl(String(cachedRecord?.living_room_photo_url || '').trim() || null)
        setExtraPhotoUrls(nextExtraPhotos)
      } catch {}
    })()
    return () => {
      cancelled = true
    }
  }, [allRequiredScenePhotos, cleaningTaskId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!token) return
      try {
        setLoading(true)
        const list = await listChecklistItems(token)
        if (cancelled) return
        const baseMapped = buildBaseItems(list || [])
        void setJson(SUPPLIES_CHECKLIST_CACHE_KEY, list || [])
        let existingItems: any[] = []
        let existingLivingRoomPhotoUrl: string | null = null
        try {
          if (!cleaningTaskId) throw new Error('缺少清洁任务ID')
          const existing = await getCleaningConsumables(token, cleaningTaskId)
          existingItems = Array.isArray(existing?.items) ? existing.items : []
          existingLivingRoomPhotoUrl = String(existing?.living_room_photo_url || '').trim() || null
          void setJson(suppliesRecordCacheKey(cleaningTaskId), { living_room_photo_url: existingLivingRoomPhotoUrl, items: existingItems })
        } catch {}
        const byId = new Map(existingItems.map((x: any) => [String(x.item_id || ''), x]))
        const mapped: ItemState[] = applyExistingToItems(baseMapped, existingItems)
        const acRemote = byId.get('remote_ac')
        const tvRemote = byId.get('remote_tv')
        const nextExtraPhotos = Object.fromEntries(
          allRequiredScenePhotos.map((item) => [item.id, String(byId.get(item.id)?.photo_url || '').trim() || null]),
        ) as Record<string, string | null>
        setHasExistingRecord(existingItems.length > 0)
        setRemoteAcPhotoUrl(String(acRemote?.photo_url || '').trim() || null)
        setRemoteTvPhotoUrl(String(tvRemote?.photo_url || '').trim() || null)
        setLivingRoomPhotoUrl(existingLivingRoomPhotoUrl)
        setExtraPhotoUrls(nextExtraPhotos)
        setItems(mapped)
      } catch (e: any) {
        if (!cancelled) Alert.alert(t('common_error'), String(e?.message || '加载失败'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [allRequiredScenePhotos, cleaningTaskId, t, token])

  async function ensureCameraPerm() {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync()
      return !!perm.granted
    } catch {
      return false
    }
  }

  async function onTakeStockPhoto(idx: number) {
    if (!token) return
    try {
      setPhotoUploadingIdx(idx)
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
      const capturedAt = new Date().toISOString()
      const up = await uploadCleaningMedia(token, { uri, name, mimeType }, { purpose: 'consumable_stock_photo', watermark: '1', watermark_text: buildWatermarkText(capturedAt), property_code: propertyCode || undefined, captured_at: capturedAt })
      setItem(idx, { photo_url: up.url })
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '上传失败'))
    } finally {
      setPhotoUploadingIdx(null)
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
      const capturedAt = new Date().toISOString()
      const up = await uploadCleaningMedia(token, { uri, name, mimeType }, { purpose: 'consumable_remote_photo', watermark: '1', watermark_text: buildWatermarkText(capturedAt), property_code: propertyCode || undefined, captured_at: capturedAt, area: kind === 'tv' ? 'tv_remote' : 'ac_remote' })
      if (kind === 'ac') setRemoteAcPhotoUrl(up.url)
      else setRemoteTvPhotoUrl(up.url)
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '上传失败'))
    }
  }

  async function onTakeRequiredScenePhoto(photoId: string) {
    if (!token) return
    try {
      const ok = await ensureCameraPerm()
      if (!ok) {
        Alert.alert(t('common_error'), '需要相机权限')
        return
      }
      const res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1, allowsEditing: true, aspect: [4, 3] })
      if (res.canceled || !res.assets?.length) return
      const a = res.assets[0] as any
      const uri = String(a.uri || '').trim()
      if (!uri) return
      const name = String(a.fileName || uri.split('/').pop() || `${photoId}-${Date.now()}.jpg`)
      const mimeType = String(a.mimeType || 'image/jpeg')
      const capturedAt = new Date().toISOString()
      const up = await uploadCleaningMedia(token, { uri, name, mimeType }, { purpose: 'consumable_scene_photo', scene: photoId, watermark: '1', watermark_text: buildWatermarkText(capturedAt), property_code: propertyCode || undefined, captured_at: capturedAt })
      setExtraPhotoUrls(prev => ({ ...prev, [photoId]: up.url }))
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '上传失败'))
    }
  }

  async function onTakeRequiredScenePhotoSequence(group: 'bathroom' | 'kitchen') {
    if (!token) return
    const targets = group === 'bathroom' ? SHOWER_DRAIN_PHOTOS : KITCHEN_REQUIRED_PHOTOS
    if (!targets.length) return
    try {
      setBatchUploadingGroup(group)
      const ok = await ensureCameraPerm()
      if (!ok) {
        Alert.alert(t('common_error'), '需要相机权限')
        return
      }
      for (const item of targets) {
        const res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1, allowsEditing: true, aspect: [4, 3] })
        if (res.canceled || !res.assets?.length) return
        const a = res.assets[0] as any
        const uri = String(a.uri || '').trim()
        if (!uri) return
        const name = String(a.fileName || uri.split('/').pop() || `${item.id}-${Date.now()}.jpg`)
        const mimeType = String(a.mimeType || 'image/jpeg')
        const capturedAt = new Date().toISOString()
        const up = await uploadCleaningMedia(token, { uri, name, mimeType }, { purpose: 'consumable_scene_photo', scene: item.id, watermark: '1', watermark_text: buildWatermarkText(capturedAt), property_code: propertyCode || undefined, captured_at: capturedAt })
        setExtraPhotoUrls(prev => ({ ...prev, [item.id]: up.url }))
      }
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '上传失败'))
    } finally {
      setBatchUploadingGroup(null)
    }
  }

  async function uploadLivingRoomPhoto() {
    if (!token) return
    try {
      const ok = await ensureCameraPerm()
      if (!ok) {
        Alert.alert(t('common_error'), '需要相机权限')
        return
      }
      const res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1, allowsEditing: true, aspect: [4, 3] })
      if (res.canceled || !res.assets?.length) return
      const a = res.assets[0] as any
      const uri = String(a.uri || '').trim()
      if (!uri) return
      const name = String(a.fileName || uri.split('/').pop() || `living-room-${Date.now()}.jpg`)
      const mimeType = String(a.mimeType || 'image/jpeg')
      const capturedAt = new Date().toISOString()
      const up = await uploadCleaningMedia(token, { uri, name, mimeType }, { purpose: 'consumable_living_room_photo', watermark: '1', watermark_text: buildWatermarkText(capturedAt), property_code: propertyCode || undefined, captured_at: capturedAt })
      setLivingRoomPhotoUrl(up.url)
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '上传失败'))
    }
  }

  function removeStockPhoto(idx: number) {
    setItem(idx, { photo_url: null })
  }

  function removeLivingRoomPhoto() {
    setLivingRoomPhotoUrl(null)
  }

  function removeRequiredScenePhoto(photoId: string) {
    setExtraPhotoUrls(prev => ({ ...prev, [photoId]: null }))
  }

  function removeRemotePhoto(kind: 'ac' | 'tv') {
    if (kind === 'ac') setRemoteAcPhotoUrl(null)
    else setRemoteTvPhotoUrl(null)
  }

  async function onTakeRemotePhotoSequence() {
    if (!token) return
    try {
      setBatchUploadingGroup('remote')
      const ok = await ensureCameraPerm()
      if (!ok) {
        Alert.alert(t('common_error'), '需要相机权限')
        return
      }
      const targets: Array<'tv' | 'ac'> = ['tv', 'ac']
      for (const kind of targets) {
        const res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1, allowsEditing: true, aspect: [4, 3] })
        if (res.canceled || !res.assets?.length) return
        const a = res.assets[0] as any
        const uri = String(a.uri || '').trim()
        if (!uri) return
        const name = String(a.fileName || uri.split('/').pop() || `remote-${kind}-${Date.now()}.jpg`)
        const mimeType = String(a.mimeType || 'image/jpeg')
        const capturedAt = new Date().toISOString()
        const up = await uploadCleaningMedia(token, { uri, name, mimeType }, { purpose: 'consumable_remote_photo', watermark: '1', watermark_text: buildWatermarkText(capturedAt), property_code: propertyCode || undefined, captured_at: capturedAt, area: kind === 'tv' ? 'tv_remote' : 'ac_remote' })
        if (kind === 'tv') setRemoteTvPhotoUrl(up.url)
        else setRemoteAcPhotoUrl(up.url)
      }
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '上传失败'))
    } finally {
      setBatchUploadingGroup(null)
    }
  }

  const canSubmit = useMemo(() => {
    if (!items.length) return false
    for (const it of items) {
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
    if (!SHOWER_DRAIN_PHOTOS.some(item => String(extraPhotoUrls[item.id] || '').trim())) return false
    for (const item of KITCHEN_REQUIRED_PHOTOS) {
      if (!String(extraPhotoUrls[item.id] || '').trim()) return false
    }
    if (!String(remoteTvPhotoUrl || '').trim()) return false
    return true
  }, [extraPhotoUrls, items, livingRoomPhotoUrl, remoteTvPhotoUrl])

  async function confirmToiletPaperMirrorChecked() {
    const needsConfirm = items.some((it) => {
      if (it.status !== 'low') return false
      const label = String(it.label || '').trim()
      const id = String(it.id || '').trim().toLowerCase()
      return label.includes('卷纸') || id.includes('toilet_paper') || id.includes('toiletpaper')
    })
    if (!needsConfirm) return true
    return await new Promise<boolean>((resolve) => {
      Alert.alert(
        '确认检查',
        '卷纸报不足前，请确认镜子后面是否已经检查。',
        [
          { text: '取消', style: 'cancel', onPress: () => resolve(false) },
          { text: '已检查', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      )
    })
  }

  async function onSubmit() {
    if (!token) {
      Alert.alert(t('common_error'), '请先登录')
      return
    }
    if (!task || task.source_type !== 'cleaning_tasks') {
      Alert.alert(t('common_error'), '仅清洁任务支持补品填报')
      return
    }
    if (!canSubmit) {
      Alert.alert(t('common_error'), '请完成所有消耗品检查，并按要求拍完客厅、浴室、厨房和遥控器照片（不足项需拍照）')
      return
    }
    const mirrorChecked = await confirmToiletPaperMirrorChecked()
    if (!mirrorChecked) return
    const out = items.map(x => ({
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
    for (const item of allRequiredScenePhotos) {
      const url = String(extraPhotoUrls[item.id] || '').trim()
      if (!url) continue
      out.push({
        item_id: item.id,
        status: 'ok' as any,
        photo_url: url,
      } as any)
    }
    try {
      setSubmitting(true)
      await submitCleaningConsumables(token, cleaningTaskId, { living_room_photo_url: String(livingRoomPhotoUrl || '').trim(), items: out })
      Alert.alert(t('common_ok'), hasExistingRecord ? '补品记录已更新' : '提交成功')
      props.navigation.goBack()
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '提交失败'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!task ? (
          <Text style={styles.muted}>{t('common_loading')}</Text>
        ) : (
          <View style={styles.card}>
            <View style={styles.heroCard}>
              <View style={styles.headRow}>
                <View style={styles.heroTextWrap}>
                  <Text style={styles.title}>{hasExistingRecord ? '补品记录' : '补品填报'}</Text>
                  <Text style={styles.heroHint}>先完成照片，再逐项勾选库存情况。</Text>
                </View>
                <View style={styles.badge}>
                  <Ionicons name="home-outline" size={moderateScale(14)} color="#2563EB" />
                  <Text style={styles.badgeText}>{task.title}</Text>
                </View>
              </View>
              {task.property?.address ? <Text style={styles.sub}>{task.property.address}</Text> : null}
              <View style={styles.summaryRow}>
                <View style={styles.summaryPill}>
                  <Text style={styles.summaryLabel}>待住晚数</Text>
                  <Text style={styles.summaryValue}>{remainingNights == null ? '-' : String(remainingNights)}</Text>
                </View>
                <View style={styles.summaryPill}>
                  <Text style={styles.summaryLabel}>已检查</Text>
                  <Text style={styles.summaryValue}>{`${completedChecks}/${regularItems.length || 0}`}</Text>
                </View>
                <View style={styles.summaryPill}>
                  <Text style={styles.summaryLabel}>不足项</Text>
                  <Text style={styles.summaryValue}>{String(lowStockCount)}</Text>
                </View>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHead}>
                <View>
                  <Text style={styles.sectionTitle}>补品检查</Text>
                  <Text style={styles.sectionHint}>逐项判断库存是否足够，不足时补数量并拍照。</Text>
                </View>
              </View>
              {loading && items.length ? <Text style={styles.muted}>正在同步最新补品记录…</Text> : null}
              {loading && !items.length ? <Text style={styles.muted}>正在加载补品清单…</Text> : null}

              <View style={styles.itemList}>
                {regularItems.map((it) => {
                  const idx = items.findIndex(x => x.id === it.id)
                  return (
                    <View key={it.id} style={styles.itemRowCard}>
                      <View style={styles.itemRowHead}>
                        <View style={styles.itemNameWrap}>
                          <Text style={styles.itemRowLabel}>{it.label}</Text>
                          {it.status === 'ok' ? <Text style={styles.itemStatusHintOk}>已确认足够</Text> : null}
                          {it.status === 'low' ? <Text style={styles.itemStatusHintLow}>已标记不足</Text> : null}
                        </View>
                        <View style={styles.itemToggleGroup}>
                          <Pressable
                            onPress={() => setItem(idx, { status: 'ok', photo_url: null })}
                            style={({ pressed }) => [styles.inlineChip, it.status === 'ok' ? styles.inlineChipOkActive : null, pressed ? styles.pressed : null]}
                          >
                            <Text style={[styles.inlineChipText, it.status === 'ok' ? styles.inlineChipTextActive : null]}>足够</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => setItem(idx, { status: 'low' })}
                            style={({ pressed }) => [styles.inlineChip, it.status === 'low' ? styles.inlineChipLowActive : null, pressed ? styles.pressed : null]}
                          >
                            <Text style={[styles.inlineChipText, it.status === 'low' ? styles.inlineChipTextActive : null]}>不足</Text>
                          </Pressable>
                        </View>
                      </View>

                      {it.status === 'low' ? (
                        <View style={styles.lowDetailBox}>
                          <View style={styles.lowStockInlineRow}>
                            <TextInput
                              value={it.qty}
                              onChangeText={v => setItem(idx, { qty: v.replace(/[^\d]/g, '').slice(0, 6) })}
                              style={[styles.input, styles.qty]}
                              placeholder="缺多少"
                              placeholderTextColor="#9CA3AF"
                              keyboardType="number-pad"
                            />
                            <Pressable
                              onPress={() => onTakeStockPhoto(idx)}
                              disabled={photoUploadingIdx === idx}
                              style={({ pressed }) => [styles.photoBtn, styles.inlinePhotoBtn, photoUploadingIdx === idx ? styles.photoBtnDisabled : null, pressed ? styles.pressed : null]}
                            >
                              <Text style={styles.photoBtnText}>{photoUploadingIdx === idx ? t('common_loading') : it.photo_url ? '已拍照' : '拍照库存'}</Text>
                            </Pressable>
                          </View>
                          {it.photo_url ? (
                            <View style={styles.thumbRow}>
                              <View style={styles.thumbMiniWrap}>
                                <Pressable
                                  onPress={() => {
                                    setViewerUrl(it.photo_url)
                                    setViewerOpen(true)
                                  }}
                                  style={({ pressed }) => [styles.thumbMiniPress, pressed ? styles.pressed : null]}
                                >
                                  <Image source={{ uri: it.photo_url }} style={styles.thumbMini} />
                                </Pressable>
                                <Pressable onPress={() => removeStockPhoto(idx)} style={({ pressed }) => [styles.thumbDeleteBtn, pressed ? styles.pressed : null]}>
                                  <Ionicons name="trash-outline" size={moderateScale(12)} color="#FFFFFF" />
                                </Pressable>
                              </View>
                            </View>
                          ) : null}
                          <TextInput
                            value={it.note}
                            onChangeText={v => setItem(idx, { note: v })}
                            style={[styles.input, styles.note]}
                            placeholder="备注（可选）"
                            placeholderTextColor="#9CA3AF"
                            multiline
                          />
                        </View>
                      ) : null}
                    </View>
                  )
                })}
              </View>

              {otherItem ? (
                <View style={styles.itemCard}>
                  <Text style={styles.label}>其他</Text>
                  <TextInput
                    value={otherItem.note}
                    onChangeText={v => setItem(items.findIndex(x => x.id === 'other'), { note: v })}
                    style={[styles.input, styles.note, { marginTop: 6 }]}
                    placeholder="其他需要补充/检查的内容（可选）"
                    placeholderTextColor="#9CA3AF"
                    multiline
                  />
                </View>
              ) : null}
            </View>

            <View style={[styles.sectionCard, styles.photoSectionCard]}>
              <View style={styles.sectionHead}>
                <View style={styles.sectionHeadMain}>
                  <Text style={styles.sectionTitle}>拍照上传</Text>
                  <Text style={styles.sectionHint}>客厅照片、浴室点位、厨房点位和电视遥控器都要拍；空调遥控器嵌在墙上的可不拍，只支持手机现场拍照。</Text>
                </View>
                <View style={styles.progressPill}>
                  <Text style={styles.progressPillText}>{`${requiredPhotosReady}/8 已完成`}</Text>
                </View>
              </View>

              <View style={styles.photoChecklistGroup}>
                <View style={styles.groupHead}>
                  <Text style={styles.groupTitle}>客厅照片</Text>
                  <Pressable
                    onPress={() => uploadLivingRoomPhoto()}
                    disabled={submitting || batchUploadingGroup !== null}
                    style={({ pressed }) => [styles.primaryPhotoBtnSmall, submitting || batchUploadingGroup !== null ? styles.photoBtnDisabled : null, pressed ? styles.pressed : null]}
                  >
                    <Text style={styles.primaryPhotoBtnText}>{livingRoomPhotoUrl ? '重拍' : '拍照'}</Text>
                  </Pressable>
                </View>
                <View style={styles.photoChecklistRow}>
                  <View style={styles.photoChecklistTextWrap}>
                    <Text style={styles.photoChecklistLabel}>客厅照片</Text>
                    <Text style={styles.photoChecklistHint}>请拖完地后拍照。</Text>
                  </View>
                  {livingRoomPhotoUrl ? <Text style={styles.doneTag}>已拍</Text> : <Text style={styles.pendingTag}>待拍</Text>}
                </View>
                {livingRoomPhotoUrl ? (
                  <View style={styles.thumbRow}>
                    <View style={styles.thumbMiniWrap}>
                      <Pressable
                        onPress={() => {
                          setViewerUrl(livingRoomPhotoUrl)
                          setViewerOpen(true)
                        }}
                        style={({ pressed }) => [styles.thumbMiniPress, pressed ? styles.pressed : null]}
                      >
                        <Image source={{ uri: livingRoomPhotoUrl }} style={styles.thumbMini} />
                      </Pressable>
                      <Pressable onPress={removeLivingRoomPhoto} style={({ pressed }) => [styles.thumbDeleteBtn, pressed ? styles.pressed : null]}>
                        <Ionicons name="trash-outline" size={moderateScale(12)} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </View>

              <View style={styles.photoChecklistGroup}>
                <View style={styles.groupHead}>
                  <Text style={styles.groupTitle}>浴室检查</Text>
                  <Pressable
                    onPress={() => onTakeRequiredScenePhotoSequence('bathroom')}
                    disabled={submitting || batchUploadingGroup !== null || SHOWER_DRAIN_PHOTOS.every(item => String(extraPhotoUrls[item.id] || '').trim())}
                    style={({ pressed }) => [styles.primaryPhotoBtnSmall, submitting || batchUploadingGroup !== null || SHOWER_DRAIN_PHOTOS.every(item => String(extraPhotoUrls[item.id] || '').trim()) ? styles.photoBtnDisabled : null, pressed ? styles.pressed : null]}
                  >
                    <Text style={styles.primaryPhotoBtnText}>{batchUploadingGroup === 'bathroom' ? '拍照中…' : '拍照'}</Text>
                  </Pressable>
                </View>
                <View style={styles.photoChecklistEntry}>
                  <View style={styles.photoChecklistRow}>
                    <View style={styles.photoChecklistTextWrap}>
                      <Text style={styles.photoChecklistLabel}>淋浴房下水口</Text>
                      <Text style={styles.photoChecklistHint}>至少拍 1 张，最多 3 张，现场拍摄清洁完成后的状态。</Text>
                    </View>
                    {SHOWER_DRAIN_PHOTOS.some(item => extraPhotoUrls[item.id]) ? <Text style={styles.doneTag}>已拍</Text> : <Text style={styles.pendingTag}>待拍</Text>}
                  </View>
                </View>
                <View style={styles.thumbRow}>
                  {SHOWER_DRAIN_PHOTOS.map((item) => {
                    const url = extraPhotoUrls[item.id]
                    if (!url) return <View key={`drain-empty-${item.id}`} style={styles.thumbMiniEmpty}><Text style={styles.thumbMiniEmptyText}>下水口</Text></View>
                    return (
                      <View key={`drain-thumb-${item.id}`} style={styles.thumbMiniWrap}>
                        <Pressable
                          onPress={() => {
                            setViewerUrl(url)
                            setViewerOpen(true)
                          }}
                          style={({ pressed }) => [styles.thumbMiniPress, pressed ? styles.pressed : null]}
                        >
                          <Image source={{ uri: url }} style={styles.thumbMini} />
                        </Pressable>
                        <Pressable onPress={() => removeRequiredScenePhoto(item.id)} style={({ pressed }) => [styles.thumbDeleteBtn, pressed ? styles.pressed : null]}>
                          <Ionicons name="trash-outline" size={moderateScale(12)} color="#FFFFFF" />
                        </Pressable>
                      </View>
                    )
                  })}
                </View>
              </View>

              <View style={styles.photoChecklistGroup}>
                <View style={styles.groupHead}>
                  <Text style={styles.groupTitle}>厨房检查</Text>
                  <Pressable
                    onPress={() => onTakeRequiredScenePhotoSequence('kitchen')}
                    disabled={submitting || batchUploadingGroup !== null}
                    style={({ pressed }) => [styles.primaryPhotoBtnSmall, submitting || batchUploadingGroup !== null ? styles.photoBtnDisabled : null, pressed ? styles.pressed : null]}
                  >
                    <Text style={styles.primaryPhotoBtnText}>{batchUploadingGroup === 'kitchen' ? '拍照中…' : '拍照'}</Text>
                  </Pressable>
                </View>
                {KITCHEN_REQUIRED_PHOTOS.map((item) => (
                  <View key={item.id} style={styles.photoChecklistEntry}>
                    <View style={styles.photoChecklistRow}>
                      <View style={styles.photoChecklistTextWrap}>
                        <Text style={styles.photoChecklistLabel}>{item.label}</Text>
                        <Text style={styles.photoChecklistHint}>现场拍摄清洁完成后的状态</Text>
                      </View>
                      {extraPhotoUrls[item.id] ? (
                        <>
                          <Text style={styles.doneTag}>已拍</Text>
                          <Pressable
                            onPress={() => onTakeRequiredScenePhoto(item.id)}
                            disabled={submitting || batchUploadingGroup !== null}
                            style={({ pressed }) => [styles.photoBtn, styles.photoChecklistBtn, submitting || batchUploadingGroup !== null ? styles.photoBtnDisabled : null, pressed ? styles.pressed : null]}
                          >
                            <Text style={styles.photoBtnText}>重拍</Text>
                          </Pressable>
                        </>
                      ) : (
                        <Text style={styles.pendingTag}>待拍</Text>
                      )}
                    </View>
                  </View>
                ))}
                <View style={styles.thumbRow}>
                  {KITCHEN_REQUIRED_PHOTOS.map((item) => {
                    const url = extraPhotoUrls[item.id]
                    if (!url) return <View key={`kitchen-empty-${item.id}`} style={styles.thumbMiniEmpty}><Text style={styles.thumbMiniEmptyText}>{item.label}</Text></View>
                    return (
                      <View key={`kitchen-thumb-${item.id}`} style={styles.thumbMiniWrap}>
                        <Pressable
                          onPress={() => {
                            setViewerUrl(url)
                            setViewerOpen(true)
                          }}
                          style={({ pressed }) => [styles.thumbMiniPress, pressed ? styles.pressed : null]}
                        >
                          <Image source={{ uri: url }} style={styles.thumbMini} />
                        </Pressable>
                        <Pressable onPress={() => removeRequiredScenePhoto(item.id)} style={({ pressed }) => [styles.thumbDeleteBtn, pressed ? styles.pressed : null]}>
                          <Ionicons name="trash-outline" size={moderateScale(12)} color="#FFFFFF" />
                        </Pressable>
                      </View>
                    )
                  })}
                </View>
              </View>

              <View style={styles.photoChecklistGroup}>
                <View style={styles.groupHead}>
                  <Text style={styles.groupTitle}>遥控器拍照</Text>
                  <Pressable
                    onPress={onTakeRemotePhotoSequence}
                    disabled={submitting || batchUploadingGroup !== null}
                    style={({ pressed }) => [styles.primaryPhotoBtnSmall, submitting || batchUploadingGroup !== null ? styles.photoBtnDisabled : null, pressed ? styles.pressed : null]}
                  >
                    <Text style={styles.primaryPhotoBtnText}>{batchUploadingGroup === 'remote' ? '拍照中…' : '拍照'}</Text>
                  </Pressable>
                </View>
                <View style={styles.photoChecklistEntry}>
                  <View style={styles.photoChecklistRow}>
                    <View style={styles.photoChecklistTextWrap}>
                      <Text style={styles.photoChecklistLabel}>电视遥控器</Text>
                      <Text style={styles.photoChecklistHint}>电视遥控器要拍。</Text>
                    </View>
                    {remoteTvPhotoUrl ? (
                      <>
                        <Text style={styles.doneTag}>已拍</Text>
                        <Pressable
                          onPress={() => onTakeRemotePhoto('tv')}
                          disabled={submitting || batchUploadingGroup !== null}
                          style={({ pressed }) => [styles.photoBtn, styles.photoChecklistBtn, submitting || batchUploadingGroup !== null ? styles.photoBtnDisabled : null, pressed ? styles.pressed : null]}
                        >
                          <Text style={styles.photoBtnText}>重拍</Text>
                        </Pressable>
                      </>
                    ) : (
                      <Text style={styles.pendingTag}>待拍</Text>
                    )}
                  </View>
                </View>
                <View style={styles.photoChecklistEntry}>
                  <View style={styles.photoChecklistRow}>
                    <View style={styles.photoChecklistTextWrap}>
                      <Text style={styles.photoChecklistLabel}>空调遥控器</Text>
                      <Text style={styles.photoChecklistHint}>嵌在墙上的可不拍。</Text>
                    </View>
                    {remoteAcPhotoUrl ? (
                      <>
                        <Text style={styles.doneTag}>已拍</Text>
                        <Pressable
                          onPress={() => onTakeRemotePhoto('ac')}
                          disabled={submitting || batchUploadingGroup !== null}
                          style={({ pressed }) => [styles.photoBtn, styles.photoChecklistBtn, submitting || batchUploadingGroup !== null ? styles.photoBtnDisabled : null, pressed ? styles.pressed : null]}
                        >
                          <Text style={styles.photoBtnText}>重拍</Text>
                        </Pressable>
                      </>
                    ) : (
                      <Text style={styles.pendingTag}>待拍</Text>
                    )}
                  </View>
                </View>
                <View style={styles.thumbRow}>
                  {remoteTvPhotoUrl ? (
                    <View style={styles.thumbMiniWrap}>
                      <Pressable
                        onPress={() => {
                          setViewerUrl(remoteTvPhotoUrl)
                          setViewerOpen(true)
                        }}
                        style={({ pressed }) => [styles.thumbMiniPress, pressed ? styles.pressed : null]}
                      >
                        <Image source={{ uri: remoteTvPhotoUrl }} style={styles.thumbMini} />
                      </Pressable>
                      <Pressable onPress={() => removeRemotePhoto('tv')} style={({ pressed }) => [styles.thumbDeleteBtn, pressed ? styles.pressed : null]}>
                        <Ionicons name="trash-outline" size={moderateScale(12)} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  ) : <View style={styles.thumbMiniEmpty}><Text style={styles.thumbMiniEmptyText}>电视遥控器</Text></View>}
                  {remoteAcPhotoUrl ? (
                    <View style={styles.thumbMiniWrap}>
                      <Pressable
                        onPress={() => {
                          setViewerUrl(remoteAcPhotoUrl)
                          setViewerOpen(true)
                        }}
                        style={({ pressed }) => [styles.thumbMiniPress, pressed ? styles.pressed : null]}
                      >
                        <Image source={{ uri: remoteAcPhotoUrl }} style={styles.thumbMini} />
                      </Pressable>
                      <Pressable onPress={() => removeRemotePhoto('ac')} style={({ pressed }) => [styles.thumbDeleteBtn, pressed ? styles.pressed : null]}>
                        <Ionicons name="trash-outline" size={moderateScale(12)} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  ) : <View style={styles.thumbMiniEmpty}><Text style={styles.thumbMiniEmptyText}>空调遥控器</Text></View>}
                </View>
              </View>
            </View>

            <Pressable
              onPress={onSubmit}
              disabled={submitting || !canSubmit}
              style={({ pressed }) => [styles.submitBtn, submitting || !canSubmit ? styles.submitDisabled : null, pressed ? styles.pressed : null]}
            >
              <Text style={styles.submitText}>{submitting ? t('common_loading') : (hasExistingRecord ? '保存修改' : '提交')}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={viewerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setViewerOpen(false)
          setViewerUrl(null)
        }}
      >
        <Pressable
          style={styles.viewerMask}
          onPress={() => {
            setViewerOpen(false)
            setViewerUrl(null)
          }}
        >
          <View style={styles.viewerTopRow} pointerEvents="none">
            <Text style={styles.viewerCloseText}>点击任意位置关闭</Text>
          </View>
          {viewerUrl ? (
            <View style={{ flex: 1 }} pointerEvents="none">
              <Image source={{ uri: viewerUrl }} style={styles.viewerImg} resizeMode="contain" />
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F6F7FB' },
  content: { padding: 16, paddingBottom: 28 },
  card: { width: '100%', gap: 14 },
  heroCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, borderWidth: hairline(), borderColor: '#E6ECF5', shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  heroTextWrap: { flex: 1, gap: 4 },
  title: { fontSize: 16, fontWeight: '900', color: '#111827' },
  heroHint: { color: '#667085', fontWeight: '700' },
  badge: { height: 30, paddingHorizontal: 10, borderRadius: 12, backgroundColor: '#EFF6FF', borderWidth: hairline(), borderColor: '#DBEAFE', flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '70%' },
  badgeText: { color: '#2563EB', fontWeight: '900', flexShrink: 1 },
  sub: { marginTop: 8, color: '#6B7280', fontWeight: '700' },
  summaryRow: { marginTop: 14, flexDirection: 'row', gap: 10 },
  summaryPill: { flex: 1, borderRadius: 14, backgroundColor: '#F8FAFC', borderWidth: hairline(), borderColor: '#E8EDF5', paddingVertical: 10, paddingHorizontal: 10 },
  summaryLabel: { color: '#667085', fontSize: 12, fontWeight: '700' },
  summaryValue: { marginTop: 4, color: '#111827', fontSize: 16, fontWeight: '900' },
  sectionCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, borderWidth: hairline(), borderColor: '#E6ECF5', gap: 12 },
  photoSectionCard: { backgroundColor: '#F7FAFF', borderColor: '#D9E7FF' },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  sectionHeadMain: { flex: 1, minWidth: 0 },
  sectionTitle: { color: '#111827', fontSize: 16, fontWeight: '900' },
  sectionHint: { marginTop: 4, color: '#667085', fontWeight: '700', lineHeight: 18 },
  progressPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#E0ECFF', flexShrink: 0, alignSelf: 'flex-start' },
  progressPillText: { color: '#2563EB', fontWeight: '900', fontSize: 12 },
  photoChecklistGroup: { gap: 8 },
  photoChecklistEntry: { gap: 8 },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  groupTitle: { color: '#111827', fontSize: 14, fontWeight: '900' },
  photoChecklistRow: { borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: hairline(), borderColor: '#D9E7FF', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  photoChecklistTextWrap: { flex: 1, minWidth: 0 },
  photoChecklistLabel: { color: '#111827', fontWeight: '900' },
  photoChecklistHint: { marginTop: 2, color: '#667085', fontSize: 12, fontWeight: '700' },
  photoChecklistBtn: { minWidth: 72, height: 34 },
  itemList: { gap: 10 },
  itemCard: { borderRadius: 16, backgroundColor: '#FAFBFC', borderWidth: hairline(), borderColor: '#E8EDF5', padding: 12 },
  itemRowCard: { borderRadius: 14, backgroundColor: '#FAFBFC', borderWidth: hairline(), borderColor: '#E8EDF5', padding: 12 },
  itemRowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  itemNameWrap: { flex: 1, minWidth: 0 },
  itemRowLabel: { color: '#111827', fontWeight: '900', fontSize: 15 },
  itemStatusHintOk: { marginTop: 2, color: '#0F9F6E', fontSize: 12, fontWeight: '700' },
  itemStatusHintLow: { marginTop: 2, color: '#B45309', fontSize: 12, fontWeight: '700' },
  itemToggleGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemCardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  okTag: { color: '#0F9F6E', backgroundColor: '#E9FBF4', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', fontSize: 12, fontWeight: '900' },
  lowTag: { color: '#B45309', backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', fontSize: 12, fontWeight: '900' },
  doneTag: { color: '#2563EB', backgroundColor: '#EAF2FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', fontSize: 12, fontWeight: '900', flexShrink: 0 },
  pendingTag: { color: '#667085', backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', fontSize: 12, fontWeight: '900', flexShrink: 0 },
  label: { marginBottom: 6, color: '#111827', fontWeight: '900' },
  input: { height: 38, borderRadius: 10, borderWidth: hairline(), borderColor: '#D1D5DB', paddingHorizontal: 10, fontWeight: '700', color: '#111827' },
  row: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  lowStockInlineRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  qty: { flex: 1 },
  inlineChip: { minWidth: 68, height: 34, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  inlineChipOkActive: { backgroundColor: '#14B87A', borderColor: '#14B87A' },
  inlineChipLowActive: { backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
  inlineChipText: { color: '#374151', fontWeight: '900', fontSize: 13 },
  inlineChipTextActive: { color: '#FFFFFF' },
  lowDetailBox: { marginTop: 10, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: hairline(), borderColor: '#E8EDF5', padding: 10 },
  note: { height: 64, paddingTop: 10, textAlignVertical: 'top', marginTop: 8 },
  photoBtn: { height: 38, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  inlinePhotoBtn: { minWidth: 96 },
  primaryPhotoBtn: { flex: 1, height: 38, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#2563EB', borderWidth: hairline(), borderColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  primaryPhotoBtnSmall: { minWidth: 72, height: 34, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#2563EB', borderWidth: hairline(), borderColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  primaryPhotoBtnText: { fontWeight: '900', color: '#FFFFFF' },
  photoBtnDisabled: { backgroundColor: '#E5E7EB' },
  photoBtnText: { fontWeight: '900', color: '#111827' },
  photoPreview: { marginTop: 8, borderRadius: 12, overflow: 'hidden', borderWidth: hairline(), borderColor: '#EEF0F6' },
  photo: { width: '100%', height: moderateScale(160), backgroundColor: '#F3F4F6' },
  thumbRow: { marginTop: 2, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumbMiniWrap: { width: 60, height: 60, borderRadius: 10, overflow: 'hidden', borderWidth: hairline(), borderColor: '#D9E7FF', backgroundColor: '#F3F4F6' },
  thumbMiniPress: { width: '100%', height: '100%' },
  thumbMini: { width: '100%', height: '100%' },
  thumbMiniEmpty: { width: 60, height: 60, borderRadius: 10, borderWidth: hairline(), borderColor: '#E5E7EB', backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', padding: 6 },
  thumbMiniEmptyText: { fontSize: 10, lineHeight: 12, color: '#98A2B3', fontWeight: '700', textAlign: 'center' },
  thumbDeleteBtn: { position: 'absolute', right: 4, top: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(17,24,39,0.76)', alignItems: 'center', justifyContent: 'center' },
  submitBtn: { marginTop: 12, height: 44, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  submitDisabled: { backgroundColor: '#93C5FD' },
  submitText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  muted: { color: '#6B7280', fontWeight: '700' },
  pressed: { opacity: 0.92 },
  viewerMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  viewerTopRow: { position: 'absolute', top: 0, left: 0, right: 0, height: 54, paddingHorizontal: 12, justifyContent: 'center', zIndex: 2 },
  viewerCloseText: { color: '#FFFFFF', fontWeight: '900' },
  viewerImg: { flex: 1 },
})
