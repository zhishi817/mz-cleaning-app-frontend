import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Image, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../../lib/auth'
import {
  deleteCleaningConsumablesPhoto,
  getCleaningConsumablesDraft,
  isLocalCleaningConsumablesPhotoUri,
  persistCleaningConsumablesPhoto,
  removeCleaningConsumablesDraft,
  setCleaningConsumablesDraft,
  type CleaningConsumablesDraftItem,
  type CleaningConsumablesPhotoMetaMap,
} from '../../lib/cleaningConsumablesDraft'
import { dequeueCleaningConsumablesSubmit, enqueueCleaningConsumablesSubmit, isCleaningConsumablesSubmitQueued } from '../../lib/cleaningConsumablesSubmitQueue'
import { useI18n } from '../../lib/i18n'
import { hairline, moderateScale } from '../../lib/scale'
import { getJson, setJson } from '../../lib/storage'
import { getWorkTasksSnapshot, patchWorkTaskItem } from '../../lib/workTasksStore'
import { getCleaningConsumables, isRetryableApiError, submitCleaningConsumables, uploadCleaningMedia, type ChecklistItem } from '../../lib/api'
import { ensureSuppliesCatalogLoaded, retrySuppliesCatalog, useSuppliesCatalogStore } from '../../lib/useSuppliesCatalogStore'
import type { TasksStackParamList } from '../../navigation/RootNavigator'
import AppButton from '../../components/ui/AppButton'
import AppText from '../../components/ui/AppText'
import AppTextInput from '../../components/ui/AppTextInput'
import ResponsiveImageGrid from '../../components/ui/ResponsiveImageGrid'
import { layoutTokens } from '../../lib/theme'

type Props = NativeStackScreenProps<TasksStackParamList, 'SuppliesForm'>

type ItemState = {
  id: string
  label: string
  required: boolean
  status: 'ok' | 'low' | null
  qty: string
  note: string
  photo_urls: string[]
}

type CachedConsumablesRecord = {
  living_room_photo_url?: string | null
  items?: { item_id: string; qty?: number | null; note?: string | null; status?: string | null; photo_url?: string | null; photo_urls?: string[] }[]
}

type SuppliesValidationIssue = {
  section: 'checklist' | 'photos'
  message: string
  itemId?: string
  photoGroup?: 'living_room' | 'bathroom' | 'kitchen' | 'vacuum' | 'remote_tv'
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

const ADDITIONAL_REQUIRED_PHOTOS = [
  { id: 'vacuum_used_photo', label: '吸尘器使用后' },
] as const

function buildBaseItems(list: ChecklistItem[]) {
  return (list || []).map((it: ChecklistItem) => ({
    id: it.id,
    label: it.label,
    required: !!it.required,
    status: it.id === 'other' ? ('ok' as const) : (null as any),
    qty: '1',
    note: '',
    photo_urls: [] as string[],
  }))
}

function normalizePhotoUrls(raw: any, fallback?: any) {
  const primary = Array.isArray(raw) ? raw : []
  const next = primary.map((item) => String(item || '').trim()).filter(Boolean)
  const fallbackUrl = String(fallback || '').trim()
  if (fallbackUrl) next.unshift(fallbackUrl)
  return Array.from(new Set(next))
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
      photo_urls: normalizePhotoUrls(prev.photo_urls, prev.photo_url),
    }
  })
}

function suppliesRecordCacheKey(taskId: string) {
  return `supplies_record_${String(taskId || '').trim()}`
}

function normalizeDraftItems(list: ItemState[]): CleaningConsumablesDraftItem[] {
  return list.map((item) => ({
    item_id: item.id,
    qty: item.id === 'other' ? null : (item.status === 'low' ? Number(String(item.qty || '').trim()) || 1 : null),
    note: String(item.note || '').trim() || null,
    status: item.id === 'other' ? 'ok' : item.status,
    photo_url: item.photo_urls[0] || null,
    photo_urls: item.photo_urls,
  }))
}

export default function SuppliesFormScreen(props: Props) {
  const { t } = useI18n()
  const { token, user } = useAuth()
  const insets = useSafeAreaInsets()
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
  const [initialRecordItems, setInitialRecordItems] = useState<CachedConsumablesRecord['items']>([])
  const [recordHydrated, setRecordHydrated] = useState(false)
  const [draftPhotoMeta, setDraftPhotoMeta] = useState<CleaningConsumablesPhotoMetaMap>({})
  const [pendingSubmit, setPendingSubmit] = useState(false)
  const [showValidationIssue, setShowValidationIssue] = useState(false)
  const [heroExpanded, setHeroExpanded] = useState(true)
  const suppliesCatalog = useSuppliesCatalogStore()
  const formDirtyRef = useRef(false)
  const draftHydratedRef = useRef(false)
  const scrollRef = useRef<ScrollView | null>(null)
  const sectionOffsetsRef = useRef<Record<'checklist' | 'photos', number>>({ checklist: 0, photos: 0 })

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
      ...ADDITIONAL_REQUIRED_PHOTOS,
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
  const priorityRestockItems = useMemo(() => {
    const list = Array.isArray((task as any)?.restock_items) ? ((task as any).restock_items as any[]) : []
    return list
      .map((item) => ({
        item_id: String(item?.item_id || '').trim(),
        label: String(item?.label || item?.item_id || '').trim(),
        qty: item?.qty == null ? null : Number(item.qty),
        status: String(item?.status || '').trim(),
      }))
      .filter((item) => item.item_id && item.label)
  }, [task])
  const catalogCacheHint = useMemo(() => {
    if (!suppliesCatalog.items.length) return ''
    if (suppliesCatalog.error) return '当前显示最近缓存的补品清单，联网后可重试。'
    if (suppliesCatalog.isFromCache || suppliesCatalog.refreshing) return '当前显示本地缓存，正在同步最新补品清单。'
    return ''
  }, [suppliesCatalog.error, suppliesCatalog.isFromCache, suppliesCatalog.items.length, suppliesCatalog.refreshing])
  const showCatalogErrorCard = !!suppliesCatalog.error && !suppliesCatalog.items.length && recordHydrated
  const requiredPhotosReady = useMemo(() => {
    let count = 0
    if (String(livingRoomPhotoUrl || '').trim()) count += 1
    for (const item of allRequiredScenePhotos) {
      if (String(extraPhotoUrls[item.id] || '').trim()) count += 1
    }
    if (String(remoteTvPhotoUrl || '').trim()) count += 1
    return count
  }, [allRequiredScenePhotos, extraPhotoUrls, livingRoomPhotoUrl, remoteTvPhotoUrl])

  function markFormDirty() {
    formDirtyRef.current = true
  }

  function rememberDraftPhoto(uri: string, meta: { name: string; mimeType: string; capturedAt: string; watermarkText: string }) {
    setDraftPhotoMeta((prev) => ({
      ...prev,
      [uri]: {
        name: meta.name,
        mime_type: meta.mimeType,
        captured_at: meta.capturedAt,
        watermark_text: meta.watermarkText,
      },
    }))
  }

  function dropDraftPhotoMeta(uri: string) {
    setDraftPhotoMeta((prev) => {
      if (!prev[uri]) return prev
      const next = { ...prev }
      delete next[uri]
      return next
    })
  }

  function removePhotoUri(uri: string) {
    if (isLocalCleaningConsumablesPhotoUri(uri)) deleteCleaningConsumablesPhoto(uri)
    dropDraftPhotoMeta(uri)
  }

  async function capturePersistedPhoto(fallbackName: string, prefix: string) {
    const ok = await ensureCameraPerm()
    if (!ok) throw new Error('需要相机权限')
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.75, allowsEditing: false })
    if (res.canceled || !res.assets?.length) return null
    const asset = res.assets[0] as any
    const sourceUri = String(asset.uri || '').trim()
    if (!sourceUri) return null
    const name = String(asset.fileName || sourceUri.split('/').pop() || fallbackName)
    const mimeType = String(asset.mimeType || 'image/jpeg')
    const capturedAt = new Date().toISOString()
    const localUri = persistCleaningConsumablesPhoto(sourceUri, name, mimeType, prefix)
    rememberDraftPhoto(localUri, { name, mimeType, capturedAt, watermarkText: buildWatermarkText(capturedAt) })
    return localUri
  }

  async function uploadDraftPhotoIfNeeded(
    rawUrl: string,
    fallbackName: string,
    meta: Record<string, any>,
    photoMetaMap: CleaningConsumablesPhotoMetaMap,
  ) {
    const current = String(rawUrl || '').trim()
    if (!current) return ''
    if (!isLocalCleaningConsumablesPhotoUri(current)) return current
    const photoMeta = photoMetaMap[current]
    const capturedAt = String(photoMeta?.captured_at || '').trim() || new Date().toISOString()
    const name = String(photoMeta?.name || '').trim() || fallbackName
    const mimeType = String(photoMeta?.mime_type || '').trim() || 'image/jpeg'
    const up = await uploadCleaningMedia(token as string, { uri: current, name, mimeType }, {
      ...meta,
      captured_at: capturedAt,
      watermark: '1',
      watermark_text: buildWatermarkText(capturedAt),
      property_code: propertyCode || undefined,
    })
    deleteCleaningConsumablesPhoto(current)
    delete photoMetaMap[current]
    return String(up.url || '').trim()
  }

  function setItem(idx: number, patch: Partial<ItemState>) {
    markFormDirty()
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
        const [queued, localDraft, nextCachedRecord] = await Promise.all([
          cleaningTaskId ? isCleaningConsumablesSubmitQueued(cleaningTaskId) : Promise.resolve(false),
          cleaningTaskId ? getCleaningConsumablesDraft(cleaningTaskId) : Promise.resolve(null),
          cleaningTaskId ? getJson<CachedConsumablesRecord>(suppliesRecordCacheKey(cleaningTaskId)) : Promise.resolve(null),
        ])
        if (cancelled) return
        draftHydratedRef.current = true
        formDirtyRef.current = !!localDraft
        setPendingSubmit(queued || !!localDraft?.pending_submit)
        setInitialRecordItems(Array.isArray(localDraft?.items) ? localDraft.items : Array.isArray(nextCachedRecord?.items) ? nextCachedRecord.items : [])
        setDraftPhotoMeta(localDraft?.photo_meta || {})
        setRecordHydrated(true)
        const draftItems = Array.isArray(localDraft?.items) ? localDraft.items : []
        const sourceItems = draftItems.length ? draftItems : Array.isArray(nextCachedRecord?.items) ? nextCachedRecord.items : []
        const byId = new Map(sourceItems.map((x: any) => [String(x.item_id || ''), x]))
        const nextExtraPhotos = Object.fromEntries(
          allRequiredScenePhotos.map((item) => [item.id, String(localDraft?.extra_photo_urls?.[item.id] || byId.get(item.id)?.photo_url || '').trim() || null]),
        ) as Record<string, string | null>
        setRemoteAcPhotoUrl(String(localDraft?.remote_ac_photo_url || byId.get('remote_ac')?.photo_url || '').trim() || null)
        setRemoteTvPhotoUrl(String(localDraft?.remote_tv_photo_url || byId.get('remote_tv')?.photo_url || '').trim() || null)
        setLivingRoomPhotoUrl(String(localDraft?.living_room_photo_url || nextCachedRecord?.living_room_photo_url || '').trim() || null)
        setExtraPhotoUrls(nextExtraPhotos)
        setHasExistingRecord(sourceItems.length > 0)
      } catch {}
    })()
    return () => {
      cancelled = true
    }
  }, [allRequiredScenePhotos, cleaningTaskId])

  useEffect(() => {
    if (!token) return
    void ensureSuppliesCatalogLoaded(token).catch(() => null)
  }, [token])

  useEffect(() => {
    if (!recordHydrated) return
    if (!suppliesCatalog.hydrated) return
    if (!suppliesCatalog.items.length) return
    if (formDirtyRef.current && items.length) return
    const mapped = applyExistingToItems(buildBaseItems(suppliesCatalog.items), Array.isArray(initialRecordItems) ? initialRecordItems || [] : [])
    setItems(mapped)
    setHasExistingRecord(Array.isArray(initialRecordItems) && initialRecordItems.length > 0)
  }, [initialRecordItems, items.length, recordHydrated, suppliesCatalog.hydrated, suppliesCatalog.items])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!token || !cleaningTaskId) return
      try {
        setLoading(true)
        const existing = await getCleaningConsumables(token, cleaningTaskId)
        if (cancelled) return
        const existingItems = Array.isArray(existing?.items) ? existing.items : []
        const existingLivingRoomPhotoUrl = String(existing?.living_room_photo_url || '').trim() || null
        const nextRecord: CachedConsumablesRecord = { living_room_photo_url: existingLivingRoomPhotoUrl, items: existingItems }
        void setJson(suppliesRecordCacheKey(cleaningTaskId), nextRecord)
        if (!formDirtyRef.current) {
          setInitialRecordItems(existingItems)
          const byId = new Map(existingItems.map((x: any) => [String(x.item_id || ''), x]))
          const nextExtraPhotos = Object.fromEntries(
            allRequiredScenePhotos.map((item) => [item.id, String(byId.get(item.id)?.photo_url || '').trim() || null]),
          ) as Record<string, string | null>
          setRemoteAcPhotoUrl(String(byId.get('remote_ac')?.photo_url || '').trim() || null)
          setRemoteTvPhotoUrl(String(byId.get('remote_tv')?.photo_url || '').trim() || null)
          setLivingRoomPhotoUrl(existingLivingRoomPhotoUrl)
          setExtraPhotoUrls(nextExtraPhotos)
          setDraftPhotoMeta({})
          setPendingSubmit(false)
          setHasExistingRecord(existingItems.length > 0)
        }
      } catch {}
      finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [allRequiredScenePhotos, cleaningTaskId, token])

  useEffect(() => {
    if (!cleaningTaskId) return
    if (!recordHydrated || !draftHydratedRef.current) return
    if (!formDirtyRef.current) return
    const draftItems = normalizeDraftItems(items)
    void setCleaningConsumablesDraft(cleaningTaskId, {
      property_code: propertyCode || null,
      pending_submit: pendingSubmit,
      living_room_photo_url: String(livingRoomPhotoUrl || '').trim() || null,
      remote_ac_photo_url: String(remoteAcPhotoUrl || '').trim() || null,
      remote_tv_photo_url: String(remoteTvPhotoUrl || '').trim() || null,
      extra_photo_urls: extraPhotoUrls,
      items: draftItems,
      photo_meta: draftPhotoMeta,
    })
  }, [cleaningTaskId, draftPhotoMeta, extraPhotoUrls, items, livingRoomPhotoUrl, pendingSubmit, propertyCode, recordHydrated, remoteAcPhotoUrl, remoteTvPhotoUrl])

  async function ensureCameraPerm() {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync()
      return !!perm.granted
    } catch {
      return false
    }
  }

  async function onTakeStockPhoto(idx: number) {
    try {
      markFormDirty()
      setPhotoUploadingIdx(idx)
      const localUri = await capturePersistedPhoto(`stock-${Date.now()}.jpg`, 'stock')
      if (!localUri) return
      setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, photo_urls: [...x.photo_urls, localUri] } : x)))
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '保存失败'))
    } finally {
      setPhotoUploadingIdx(null)
    }
  }

  async function onTakeRemotePhoto(kind: 'ac' | 'tv') {
    try {
      markFormDirty()
      const localUri = await capturePersistedPhoto(`remote-${kind}-${Date.now()}.jpg`, `remote-${kind}`)
      if (!localUri) return
      if (kind === 'ac') setRemoteAcPhotoUrl(localUri)
      else setRemoteTvPhotoUrl(localUri)
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '保存失败'))
    }
  }

  async function onTakeRequiredScenePhoto(photoId: string) {
    try {
      markFormDirty()
      const localUri = await capturePersistedPhoto(`${photoId}-${Date.now()}.jpg`, photoId)
      if (!localUri) return
      setExtraPhotoUrls(prev => ({ ...prev, [photoId]: localUri }))
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '保存失败'))
    }
  }

  async function onTakeRequiredScenePhotoSequence(group: 'bathroom' | 'kitchen') {
    const targets = group === 'bathroom' ? SHOWER_DRAIN_PHOTOS : KITCHEN_REQUIRED_PHOTOS
    const pendingTargets = targets.filter((item) => !String(extraPhotoUrls[item.id] || '').trim())
    const captureTargets = pendingTargets.length ? pendingTargets : (targets[0] ? [targets[0]] : [])
    if (!captureTargets.length) return
    if (group === 'bathroom') {
      await onTakeRequiredScenePhoto(captureTargets[0].id)
      return
    }
    try {
      markFormDirty()
      setBatchUploadingGroup(group)
      for (const target of captureTargets) {
        const localUri = await capturePersistedPhoto(`${target.id}-${Date.now()}.jpg`, target.id)
        if (!localUri) break
        setExtraPhotoUrls(prev => ({ ...prev, [target.id]: localUri }))
      }
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '保存失败'))
    } finally {
      setBatchUploadingGroup(null)
    }
  }

  async function uploadLivingRoomPhoto() {
    try {
      markFormDirty()
      const localUri = await capturePersistedPhoto(`living-room-${Date.now()}.jpg`, 'living-room')
      if (!localUri) return
      setLivingRoomPhotoUrl(localUri)
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '保存失败'))
    }
  }

  function removeStockPhoto(idx: number, photoIdx: number) {
    markFormDirty()
    setItems((prev) => prev.map((x, i) => {
      if (i !== idx) return x
      const nextUrls = x.photo_urls.filter((_, j) => {
        const keep = j !== photoIdx
        if (!keep) removePhotoUri(x.photo_urls[j] || '')
        return keep
      })
      return { ...x, photo_urls: nextUrls }
    }))
  }

  function removeLivingRoomPhoto() {
    markFormDirty()
    removePhotoUri(String(livingRoomPhotoUrl || ''))
    setLivingRoomPhotoUrl(null)
  }

  function removeRequiredScenePhoto(photoId: string) {
    markFormDirty()
    removePhotoUri(String(extraPhotoUrls[photoId] || ''))
    setExtraPhotoUrls(prev => ({ ...prev, [photoId]: null }))
  }

  function removeRemotePhoto(kind: 'ac' | 'tv') {
    markFormDirty()
    if (kind === 'ac') {
      removePhotoUri(String(remoteAcPhotoUrl || ''))
      setRemoteAcPhotoUrl(null)
    } else {
      removePhotoUri(String(remoteTvPhotoUrl || ''))
      setRemoteTvPhotoUrl(null)
    }
  }

  async function onTakeRemotePhotoSequence() {
    try {
      markFormDirty()
      setBatchUploadingGroup('remote')
      const targets: ('tv' | 'ac')[] = ['tv', 'ac']
      for (const kind of targets) {
        const localUri = await capturePersistedPhoto(`remote-${kind}-${Date.now()}.jpg`, `remote-${kind}`)
        if (!localUri) return
        if (kind === 'tv') setRemoteTvPhotoUrl(localUri)
        else setRemoteAcPhotoUrl(localUri)
      }
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '保存失败'))
    } finally {
      setBatchUploadingGroup(null)
    }
  }

  function buildValidationIssue(): SuppliesValidationIssue | null {
    if (!items.length) {
      return { section: 'checklist', message: '补品清单还没加载完成，请稍后再试。' }
    }
    for (const item of regularItems) {
      if (item.status !== 'ok' && item.status !== 'low') {
        return { section: 'checklist', itemId: item.id, message: `请先确认：${item.label} 是足够还是不足。` }
      }
      if (item.status === 'low') {
        const qty = Number(String(item.qty || '').trim())
        if (!Number.isFinite(qty) || qty < 1) {
          return { section: 'checklist', itemId: item.id, message: `请填写：${item.label} 缺少的数量。` }
        }
        if (!(item.photo_urls || []).length) {
          return { section: 'checklist', itemId: item.id, message: `请补拍：${item.label} 的库存照片。` }
        }
      }
    }
    if (!String(livingRoomPhotoUrl || '').trim()) {
      return { section: 'photos', photoGroup: 'living_room', message: '请先拍客厅照片。' }
    }
    if (!SHOWER_DRAIN_PHOTOS.some((item) => String(extraPhotoUrls[item.id] || '').trim())) {
      return { section: 'photos', photoGroup: 'bathroom', message: '请至少拍 1 张淋浴房下水口照片。' }
    }
    for (const item of KITCHEN_REQUIRED_PHOTOS) {
      if (!String(extraPhotoUrls[item.id] || '').trim()) {
        return { section: 'photos', photoGroup: 'kitchen', message: `请补拍：${item.label}。` }
      }
    }
    for (const item of ADDITIONAL_REQUIRED_PHOTOS) {
      if (!String(extraPhotoUrls[item.id] || '').trim()) {
        return { section: 'photos', photoGroup: 'vacuum', message: `请补拍：${item.label}。` }
      }
    }
    if (!String(remoteTvPhotoUrl || '').trim()) {
      return { section: 'photos', photoGroup: 'remote_tv', message: '请拍电视遥控器照片。' }
    }
    return null
  }

  function rememberSectionOffset(section: 'checklist' | 'photos', y: number) {
    sectionOffsetsRef.current[section] = Math.max(0, y)
  }

  function focusValidationIssue(issue: SuppliesValidationIssue) {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, (sectionOffsetsRef.current[issue.section] || 0) - 18),
        animated: true,
      })
    })
  }

  const validationIssue = showValidationIssue ? buildValidationIssue() : null

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

  async function queueCurrentConsumablesSubmit(snapshot?: {
    items?: ItemState[]
    livingRoomPhotoUrl?: string | null
    remoteAcPhotoUrl?: string | null
    remoteTvPhotoUrl?: string | null
    extraPhotoUrls?: Record<string, string | null>
    photoMeta?: CleaningConsumablesPhotoMetaMap
  }) {
    const nextItems = snapshot?.items || items
    const nextLivingRoomPhotoUrl = snapshot?.livingRoomPhotoUrl ?? livingRoomPhotoUrl
    const nextRemoteAcPhotoUrl = snapshot?.remoteAcPhotoUrl ?? remoteAcPhotoUrl
    const nextRemoteTvPhotoUrl = snapshot?.remoteTvPhotoUrl ?? remoteTvPhotoUrl
    const nextExtraPhotoUrls = snapshot?.extraPhotoUrls || extraPhotoUrls
    const nextPhotoMeta = snapshot?.photoMeta || draftPhotoMeta
    const draftItems = normalizeDraftItems(nextItems)
    await setCleaningConsumablesDraft(cleaningTaskId, {
      property_code: propertyCode || null,
      pending_submit: true,
      living_room_photo_url: String(nextLivingRoomPhotoUrl || '').trim() || null,
      remote_ac_photo_url: String(nextRemoteAcPhotoUrl || '').trim() || null,
      remote_tv_photo_url: String(nextRemoteTvPhotoUrl || '').trim() || null,
      extra_photo_urls: nextExtraPhotoUrls,
      items: draftItems,
      photo_meta: nextPhotoMeta,
    })
    await enqueueCleaningConsumablesSubmit(cleaningTaskId)
    setPendingSubmit(true)
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
    const nextValidationIssue = buildValidationIssue()
    if (nextValidationIssue) {
      setShowValidationIssue(true)
      focusValidationIssue(nextValidationIssue)
      return
    }
    const mirrorChecked = await confirmToiletPaperMirrorChecked()
    if (!mirrorChecked) return
    const workingItems = items.map((item) => ({ ...item, photo_urls: [...item.photo_urls] }))
    const workingPhotoMeta: CleaningConsumablesPhotoMetaMap = { ...draftPhotoMeta }
    let nextLivingRoomPhotoUrl = String(livingRoomPhotoUrl || '').trim()
    let nextRemoteAcPhotoUrl = String(remoteAcPhotoUrl || '').trim()
    let nextRemoteTvPhotoUrl = String(remoteTvPhotoUrl || '').trim()
    const nextExtraPhotoUrls: Record<string, string | null> = { ...extraPhotoUrls }
    try {
      setShowValidationIssue(false)
      setSubmitting(true)
      for (const item of workingItems) {
        const nextPhotoUrls: string[] = []
        for (let photoIdx = 0; photoIdx < item.photo_urls.length; photoIdx += 1) {
          const uploaded = await uploadDraftPhotoIfNeeded(
            item.photo_urls[photoIdx] || '',
            `${item.id}-${photoIdx + 1}.jpg`,
            { purpose: 'consumable_stock_photo' },
            workingPhotoMeta,
          )
          if (uploaded) nextPhotoUrls.push(uploaded)
        }
        item.photo_urls = nextPhotoUrls
      }
      nextLivingRoomPhotoUrl = await uploadDraftPhotoIfNeeded(
        nextLivingRoomPhotoUrl,
        'living-room.jpg',
        { purpose: 'consumable_living_room_photo' },
        workingPhotoMeta,
      )
      nextRemoteAcPhotoUrl = await uploadDraftPhotoIfNeeded(
        nextRemoteAcPhotoUrl,
        'remote-ac.jpg',
        { purpose: 'consumable_remote_photo', area: 'ac_remote' },
        workingPhotoMeta,
      )
      nextRemoteTvPhotoUrl = await uploadDraftPhotoIfNeeded(
        nextRemoteTvPhotoUrl,
        'remote-tv.jpg',
        { purpose: 'consumable_remote_photo', area: 'tv_remote' },
        workingPhotoMeta,
      )
      for (const item of allRequiredScenePhotos) {
        nextExtraPhotoUrls[item.id] = await uploadDraftPhotoIfNeeded(
          String(nextExtraPhotoUrls[item.id] || '').trim(),
          `${item.id}.jpg`,
          { purpose: 'consumable_scene_photo', scene: item.id },
          workingPhotoMeta,
        ) || null
      }

      setItems(workingItems)
      setLivingRoomPhotoUrl(nextLivingRoomPhotoUrl || null)
      setRemoteAcPhotoUrl(nextRemoteAcPhotoUrl || null)
      setRemoteTvPhotoUrl(nextRemoteTvPhotoUrl || null)
      setExtraPhotoUrls(nextExtraPhotoUrls)
      setDraftPhotoMeta(workingPhotoMeta)

      const out = workingItems.map(x => ({
        item_id: x.id,
        status: x.status as any,
        qty: x.status === 'low' ? Number(String(x.qty || '').trim()) : undefined,
        note: x.note.trim() || undefined,
        photo_url: x.photo_urls[0] || undefined,
        photo_urls: x.photo_urls.length ? x.photo_urls : undefined,
      }))
      if (String(nextRemoteAcPhotoUrl || '').trim()) {
        out.push({
          item_id: 'remote_ac',
          status: 'ok' as any,
          photo_url: nextRemoteAcPhotoUrl || undefined,
        } as any)
      }
      out.push({
        item_id: 'remote_tv',
        status: 'ok' as any,
        photo_url: nextRemoteTvPhotoUrl || undefined,
      } as any)
      for (const item of allRequiredScenePhotos) {
        const url = String(nextExtraPhotoUrls[item.id] || '').trim()
        if (!url) continue
        out.push({
          item_id: item.id,
          status: 'ok' as any,
          photo_url: url,
        } as any)
      }

      const updated = await submitCleaningConsumables(token, cleaningTaskId, { living_room_photo_url: String(nextLivingRoomPhotoUrl || '').trim(), items: out })
      formDirtyRef.current = false
      setPendingSubmit(false)
      setDraftPhotoMeta({})
      await removeCleaningConsumablesDraft(cleaningTaskId)
      await dequeueCleaningConsumablesSubmit(cleaningTaskId)
      const nextRecord: CachedConsumablesRecord = { living_room_photo_url: String(nextLivingRoomPhotoUrl || '').trim() || null, items: out as any }
      setInitialRecordItems(out as any)
      void setJson(suppliesRecordCacheKey(cleaningTaskId), nextRecord)
      const nextStatus = String((updated as any)?.status || '').trim()
      if (task?.id && nextStatus) {
        await patchWorkTaskItem(String(task.id), { status: nextStatus } as any)
      }
      Alert.alert(t('common_ok'), hasExistingRecord ? '补品记录已更新' : '提交成功')
      props.navigation.goBack()
    } catch (e: any) {
      if (isRetryableApiError(e)) {
        setItems(workingItems)
        setLivingRoomPhotoUrl(nextLivingRoomPhotoUrl || null)
        setRemoteAcPhotoUrl(nextRemoteAcPhotoUrl || null)
        setRemoteTvPhotoUrl(nextRemoteTvPhotoUrl || null)
        setExtraPhotoUrls(nextExtraPhotoUrls)
        setDraftPhotoMeta(workingPhotoMeta)
        await queueCurrentConsumablesSubmit({
          items: workingItems,
          livingRoomPhotoUrl: nextLivingRoomPhotoUrl || null,
          remoteAcPhotoUrl: nextRemoteAcPhotoUrl || null,
          remoteTvPhotoUrl: nextRemoteTvPhotoUrl || null,
          extraPhotoUrls: nextExtraPhotoUrls,
          photoMeta: workingPhotoMeta,
        })
        Alert.alert(t('common_ok'), '已离线保存，联网后会自动同步补品填报。')
        props.navigation.goBack()
        return
      }
      Alert.alert(t('common_error'), String(e?.message || '提交失败'))
    } finally {
      setSubmitting(false)
    }
  }

  const submitButtonLabel = submitting ? t('common_loading') : (hasExistingRecord ? '保存修改' : '提交')
  const scrollBottomPadding = Math.max(insets.bottom, layoutTokens.spacing.lg) + 28

  return (
    <View style={styles.page}>
      <KeyboardAvoidingView
        style={styles.page}
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.page}
          contentContainerStyle={[styles.content, { paddingBottom: scrollBottomPadding }]}
          keyboardShouldPersistTaps="handled"
        >
          {!task ? (
            <Text style={styles.muted}>{t('common_loading')}</Text>
          ) : (
            <>
              <View style={styles.card}>
                <View style={styles.heroCard}>
                  <View style={styles.headRow}>
                    <View style={styles.heroTextWrap}>
                      <AppText style={styles.title} variant="section">{hasExistingRecord ? '补品记录' : '补品填报'}</AppText>
                      <AppText style={styles.heroHint} variant="body" numberOfLines={3}>
                        先完成照片，再逐项勾选库存情况。
                      </AppText>
                    </View>
                    <Pressable
                      onPress={() => setHeroExpanded((value) => !value)}
                      style={({ pressed }) => [styles.badge, pressed ? styles.pressed : null]}
                    >
                      <Ionicons name="home-outline" size={moderateScale(14)} color="#2563EB" />
                      <AppText style={styles.badgeText} variant="label" numberOfLines={1}>{propertyCode || task.title}</AppText>
                      <AppText style={styles.badgeToggleText} variant="caption">{heroExpanded ? '收起' : '展开'}</AppText>
                    </Pressable>
                  </View>
                  {heroExpanded ? (
                    <>
                      {task.property?.address ? <AppText style={styles.sub} variant="body" expandable numberOfLines={2}>{task.property.address}</AppText> : null}
                      <View style={styles.summaryRow}>
                        <View style={styles.summaryPill}>
                          <AppText style={styles.summaryLabel} variant="caption">待住晚数</AppText>
                          <AppText style={styles.summaryValue} variant="section">{remainingNights == null ? '-' : String(remainingNights)}</AppText>
                        </View>
                        <View style={styles.summaryPill}>
                          <AppText style={styles.summaryLabel} variant="caption">已检查</AppText>
                          <AppText style={styles.summaryValue} variant="section">{`${completedChecks}/${regularItems.length || 0}`}</AppText>
                        </View>
                        <View style={styles.summaryPill}>
                          <AppText style={styles.summaryLabel} variant="caption">不足项</AppText>
                          <AppText style={styles.summaryValue} variant="section">{String(lowStockCount)}</AppText>
                        </View>
                      </View>
                      {priorityRestockItems.length ? (
                        <View style={styles.priorityRestockCard}>
                          <AppText style={styles.priorityRestockTitle} variant="label">本次重点补充</AppText>
                          <AppText style={styles.priorityRestockText} variant="body">
                            {priorityRestockItems.map((item) => {
                              const qty = item.qty != null && Number.isFinite(item.qty) && item.qty > 0 ? ` x${item.qty}` : ''
                              return item.status === 'carry_forward' ? `${item.label}${qty}（上次检查要求下次退房补）` : `${item.label}${qty}`
                            }).join('、')}
                          </AppText>
                        </View>
                      ) : null}
                    </>
                  ) : null}
                </View>

                <View
                  style={[styles.sectionCard, validationIssue?.section === 'checklist' ? styles.validationSectionCard : null]}
                  onLayout={(event) => rememberSectionOffset('checklist', event.nativeEvent.layout.y)}
                >
                  <View style={styles.sectionHead}>
                    <View>
                      <Text style={styles.sectionTitle}>补品检查</Text>
                      <Text style={styles.sectionHint}>逐项判断库存是否足够，不足时补数量并拍照。</Text>
                    </View>
                  </View>
                  {validationIssue?.section === 'checklist' ? (
                    <View style={styles.inlineErrorCard}>
                      <Text style={styles.inlineErrorTitle}>还有内容没完成</Text>
                      <Text style={styles.inlineErrorText}>{validationIssue.message}</Text>
                    </View>
                  ) : null}
                  {pendingSubmit ? <Text style={styles.ok}>已离线保存，待联网自动同步。</Text> : null}
                  <Text style={styles.muted}>消耗品照片会先保存在本机，提交时自动上传；弱网下可稍后继续。</Text>
                  {catalogCacheHint ? <Text style={styles.muted}>{catalogCacheHint}</Text> : null}
                  {loading && items.length ? <Text style={styles.muted}>正在同步最新补品记录…</Text> : null}
                  {loading && !items.length ? <Text style={styles.muted}>正在同步补品记录…</Text> : null}
                  {suppliesCatalog.loading && !items.length ? <Text style={styles.muted}>正在加载补品清单…</Text> : null}
                  {showCatalogErrorCard ? (
                    <View style={styles.inlineErrorCard}>
                      <Text style={styles.inlineErrorTitle}>补品清单加载失败</Text>
                      <Text style={styles.inlineErrorText}>当前没有可用缓存，请联网后重试。</Text>
                      <Pressable
                        onPress={() => {
                          if (!token) return
                          void retrySuppliesCatalog(token).catch(() => null)
                        }}
                        style={({ pressed }) => [styles.inlineRetryBtn, pressed ? styles.pressed : null]}
                      >
                        <Text style={styles.inlineRetryText}>重试</Text>
                      </Pressable>
                    </View>
                  ) : null}

                  <View style={styles.itemList}>
                    {regularItems.map((it) => {
                      const idx = items.findIndex((x) => x.id === it.id)
                      return (
                        <View key={it.id} style={[styles.itemRowCard, validationIssue?.section === 'checklist' && validationIssue.itemId === it.id ? styles.validationItemCard : null]}>
                          <View style={styles.itemRowHead}>
                            <View style={styles.itemNameWrap}>
                              <Text style={styles.itemRowLabel}>{it.label}</Text>
                              {it.status === 'ok' ? <Text style={styles.itemStatusHintOk}>已确认足够</Text> : null}
                              {it.status === 'low' ? <Text style={styles.itemStatusHintLow}>已标记不足</Text> : null}
                            </View>
                            <View style={styles.itemToggleGroup}>
                              <Pressable
                                onPress={() => setItem(idx, { status: 'ok', photo_urls: [] })}
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
                                <AppTextInput
                                  value={it.qty}
                                  onChangeText={(v) => setItem(idx, { qty: v.replace(/[^\d]/g, '').slice(0, 6) })}
                                  style={[styles.input, styles.qty]}
                                  placeholder="缺多少"
                                  keyboardType="number-pad"
                                />
                                <AppButton
                                  label={photoUploadingIdx === idx ? t('common_loading') : it.photo_urls.length ? `继续拍照 (${it.photo_urls.length})` : '拍照库存'}
                                  onPress={() => onTakeStockPhoto(idx)}
                                  disabled={photoUploadingIdx === idx}
                                  style={[styles.inlinePhotoBtn, photoUploadingIdx === idx ? styles.photoBtnDisabled : null]}
                                  tone="secondary"
                                />
                              </View>
                              {it.photo_urls.length ? (
                                <ResponsiveImageGrid
                                  items={it.photo_urls}
                                  keyExtractor={(photoUrl, photoIdx) => `${photoUrl}-${photoIdx}`}
                                  renderItem={(photoUrl, photoIdx) => (
                                    <View style={styles.thumbMiniWrap}>
                                      <Pressable
                                        onPress={() => {
                                          setViewerUrl(photoUrl)
                                          setViewerOpen(true)
                                        }}
                                        style={({ pressed }) => [styles.thumbMiniPress, pressed ? styles.pressed : null]}
                                      >
                                        <Image source={{ uri: photoUrl }} style={styles.thumbMini} />
                                      </Pressable>
                                      <Pressable onPress={() => removeStockPhoto(idx, photoIdx)} style={({ pressed }) => [styles.thumbDeleteBtn, pressed ? styles.pressed : null]}>
                                        <Ionicons name="trash-outline" size={moderateScale(12)} color="#FFFFFF" />
                                      </Pressable>
                                    </View>
                                  )}
                                />
                              ) : null}
                              <AppTextInput
                                value={it.note}
                                onChangeText={(v) => setItem(idx, { note: v })}
                                style={[styles.input, styles.note]}
                                placeholder="备注（可选）"
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
                      <AppTextInput
                        value={otherItem.note}
                        onChangeText={(v) => setItem(items.findIndex((x) => x.id === 'other'), { note: v })}
                        style={[styles.input, styles.note, { marginTop: 6 }]}
                        placeholder="其他需要补充/检查的内容（可选）"
                        multiline
                      />
                    </View>
                  ) : null}
                </View>

                <View
                  style={[styles.sectionCard, styles.photoSectionCard, validationIssue?.section === 'photos' ? styles.validationSectionCard : null]}
                  onLayout={(event) => rememberSectionOffset('photos', event.nativeEvent.layout.y)}
                >
                  <View style={styles.sectionHead}>
                    <View style={styles.sectionHeadMain}>
                      <Text style={styles.sectionTitle}>拍照上传</Text>
                      <Text style={styles.sectionHint}>客厅照片、浴室点位、厨房点位、吸尘器使用后和电视遥控器都要拍；空调遥控器嵌在墙上的可不拍，只支持手机现场拍照。</Text>
                    </View>
                    <View style={styles.progressPill}>
                      <Text style={styles.progressPillText}>{`${requiredPhotosReady}/9 已完成`}</Text>
                    </View>
                  </View>
                  {validationIssue?.section === 'photos' ? (
                    <View style={styles.inlineErrorCard}>
                      <Text style={styles.inlineErrorTitle}>还有照片没完成</Text>
                      <Text style={styles.inlineErrorText}>{validationIssue.message}</Text>
                    </View>
                  ) : null}

                  <View style={[styles.photoChecklistGroup, validationIssue?.photoGroup === 'living_room' ? styles.validationPhotoGroup : null]}>
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

                  <View style={[styles.photoChecklistGroup, validationIssue?.photoGroup === 'bathroom' ? styles.validationPhotoGroup : null]}>
                    <View style={styles.groupHead}>
                      <Text style={styles.groupTitle}>浴室检查</Text>
                      <Pressable
                        onPress={() => onTakeRequiredScenePhotoSequence('bathroom')}
                        disabled={submitting || batchUploadingGroup !== null || SHOWER_DRAIN_PHOTOS.every((item) => String(extraPhotoUrls[item.id] || '').trim())}
                        style={({ pressed }) => [styles.primaryPhotoBtnSmall, submitting || batchUploadingGroup !== null || SHOWER_DRAIN_PHOTOS.every((item) => String(extraPhotoUrls[item.id] || '').trim()) ? styles.photoBtnDisabled : null, pressed ? styles.pressed : null]}
                      >
                        <Text style={styles.primaryPhotoBtnText}>{batchUploadingGroup === 'bathroom' ? '拍照中…' : '拍照'}</Text>
                      </Pressable>
                    </View>
                    <View style={styles.photoChecklistEntry}>
                      <View style={styles.photoChecklistRow}>
                        <View style={styles.photoChecklistTextWrap}>
                          <Text style={styles.photoChecklistLabel}>淋浴房下水口</Text>
                          <Text style={styles.photoChecklistHint}>至少拍 1 张，最多 3 张；每点一次拍 1 张，现场拍摄清洁完成后的状态。</Text>
                        </View>
                        {SHOWER_DRAIN_PHOTOS.some((item) => extraPhotoUrls[item.id]) ? <Text style={styles.doneTag}>已拍</Text> : <Text style={styles.pendingTag}>待拍</Text>}
                      </View>
                    </View>
                    <ResponsiveImageGrid
                      items={SHOWER_DRAIN_PHOTOS}
                      keyExtractor={(item) => `drain-${item.id}`}
                      renderItem={(item) => {
                        const url = extraPhotoUrls[item.id]
                        if (!url) return <View style={styles.thumbMiniEmpty}><Text style={styles.thumbMiniEmptyText}>下水口</Text></View>
                        return (
                          <View style={styles.thumbMiniWrap}>
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
                      }}
                    />
                  </View>

                  <View style={[styles.photoChecklistGroup, validationIssue?.photoGroup === 'kitchen' ? styles.validationPhotoGroup : null]}>
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
                    <ResponsiveImageGrid
                      items={KITCHEN_REQUIRED_PHOTOS}
                      keyExtractor={(item) => `kitchen-${item.id}`}
                      renderItem={(item) => {
                        const url = extraPhotoUrls[item.id]
                        if (!url) return <View style={styles.thumbMiniEmpty}><Text style={styles.thumbMiniEmptyText}>{item.label}</Text></View>
                        return (
                          <View style={styles.thumbMiniWrap}>
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
                      }}
                    />
                  </View>

                  <View style={[styles.photoChecklistGroup, validationIssue?.photoGroup === 'vacuum' ? styles.validationPhotoGroup : null]}>
                    <View style={styles.groupHead}>
                      <Text style={styles.groupTitle}>吸尘器使用后</Text>
                      <Pressable
                        onPress={() => onTakeRequiredScenePhoto('vacuum_used_photo')}
                        disabled={submitting || batchUploadingGroup !== null}
                        style={({ pressed }) => [styles.primaryPhotoBtnSmall, submitting || batchUploadingGroup !== null ? styles.photoBtnDisabled : null, pressed ? styles.pressed : null]}
                      >
                        <Text style={styles.primaryPhotoBtnText}>拍照</Text>
                      </Pressable>
                    </View>
                    <View style={styles.photoChecklistEntry}>
                      <View style={styles.photoChecklistRow}>
                        <View style={styles.photoChecklistTextWrap}>
                          <Text style={styles.photoChecklistLabel}>吸尘器使用后</Text>
                          <Text style={styles.photoChecklistHint}>现场拍摄吸尘器使用后的状态。</Text>
                        </View>
                        {extraPhotoUrls.vacuum_used_photo ? (
                          <>
                            <Text style={styles.doneTag}>已拍</Text>
                            <Pressable
                              onPress={() => onTakeRequiredScenePhoto('vacuum_used_photo')}
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
                      {extraPhotoUrls.vacuum_used_photo ? (
                        <View style={styles.thumbMiniWrap}>
                          <Pressable
                            onPress={() => {
                              setViewerUrl(String(extraPhotoUrls.vacuum_used_photo))
                              setViewerOpen(true)
                            }}
                            style={({ pressed }) => [styles.thumbMiniPress, pressed ? styles.pressed : null]}
                          >
                            <Image source={{ uri: String(extraPhotoUrls.vacuum_used_photo) }} style={styles.thumbMini} />
                          </Pressable>
                          <Pressable onPress={() => removeRequiredScenePhoto('vacuum_used_photo')} style={({ pressed }) => [styles.thumbDeleteBtn, pressed ? styles.pressed : null]}>
                            <Ionicons name="trash-outline" size={moderateScale(12)} color="#FFFFFF" />
                          </Pressable>
                        </View>
                      ) : (
                        <View style={styles.thumbMiniEmpty}><Text style={styles.thumbMiniEmptyText}>吸尘器</Text></View>
                      )}
                    </View>
                  </View>

                  <View style={[styles.photoChecklistGroup, validationIssue?.photoGroup === 'remote_tv' ? styles.validationPhotoGroup : null]}>
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
                    <ResponsiveImageGrid
                      items={[
                        { id: 'tv', label: '电视遥控器', url: remoteTvPhotoUrl },
                        { id: 'ac', label: '空调遥控器', url: remoteAcPhotoUrl },
                      ]}
                      keyExtractor={(item) => item.id}
                      renderItem={(item) => (
                        item.url ? (
                          <View style={styles.thumbMiniWrap}>
                            <Pressable
                              onPress={() => {
                                setViewerUrl(item.url)
                                setViewerOpen(true)
                              }}
                              style={({ pressed }) => [styles.thumbMiniPress, pressed ? styles.pressed : null]}
                            >
                              <Image source={{ uri: item.url }} style={styles.thumbMini} />
                            </Pressable>
                            <Pressable onPress={() => removeRemotePhoto(item.id as 'tv' | 'ac')} style={({ pressed }) => [styles.thumbDeleteBtn, pressed ? styles.pressed : null]}>
                              <Ionicons name="trash-outline" size={moderateScale(12)} color="#FFFFFF" />
                            </Pressable>
                          </View>
                        ) : <View style={styles.thumbMiniEmpty}><Text style={styles.thumbMiniEmptyText}>{item.label}</Text></View>
                      )}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.submitInlineWrap}>
                <AppButton
                  label={submitButtonLabel}
                  onPress={onSubmit}
                  disabled={submitting}
                  fullWidth
                  style={submitting ? styles.submitDisabled : null}
                />
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

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
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F6F7FB' },
  content: { padding: 16, paddingBottom: 28 },
  card: { width: '100%', gap: 14 },
  heroCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, borderWidth: hairline(), borderColor: '#E6ECF5', shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  heroTextWrap: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontSize: 16, fontWeight: '900', color: '#111827' },
  heroHint: { color: '#667085', fontWeight: '700' },
  badge: { minHeight: 30, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: '#EFF6FF', borderWidth: hairline(), borderColor: '#DBEAFE', flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '70%', flexShrink: 1 },
  badgeText: { color: '#2563EB', fontWeight: '900', flexShrink: 1 },
  badgeToggleText: { color: '#2563EB', fontWeight: '800', flexShrink: 0 },
  sub: { marginTop: 8, color: '#6B7280', fontWeight: '700' },
  summaryRow: { marginTop: 14, flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  priorityRestockCard: { marginTop: 14, borderRadius: 14, backgroundColor: '#FFF7ED', borderWidth: hairline(), borderColor: '#FDBA74', padding: 12, gap: 6 },
  priorityRestockTitle: { color: '#9A3412', fontWeight: '900' },
  priorityRestockText: { color: '#B45309', fontWeight: '700', lineHeight: 20 },
  summaryPill: { flex: 1, minWidth: 120, borderRadius: 14, backgroundColor: '#F8FAFC', borderWidth: hairline(), borderColor: '#E8EDF5', paddingVertical: 10, paddingHorizontal: 10 },
  summaryLabel: { color: '#667085', fontSize: 12, fontWeight: '700' },
  summaryValue: { marginTop: 4, color: '#111827', fontSize: 16, fontWeight: '900' },
  sectionCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, borderWidth: hairline(), borderColor: '#E6ECF5', gap: 12 },
  validationSectionCard: { borderColor: '#F59E0B', backgroundColor: '#FFFBEB' },
  photoSectionCard: { backgroundColor: '#F7FAFF', borderColor: '#D9E7FF' },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  sectionHeadMain: { flex: 1, minWidth: 0 },
  sectionTitle: { color: '#111827', fontSize: 16, fontWeight: '900' },
  sectionHint: { marginTop: 4, color: '#667085', fontWeight: '700', lineHeight: 18 },
  progressPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#E0ECFF', flexShrink: 0, alignSelf: 'flex-start' },
  progressPillText: { color: '#2563EB', fontWeight: '900', fontSize: 12 },
  photoChecklistGroup: { gap: 8 },
  validationPhotoGroup: { borderRadius: 14, borderWidth: hairline(), borderColor: '#F59E0B', backgroundColor: '#FFF7ED', padding: 10 },
  photoChecklistEntry: { gap: 8 },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  groupTitle: { flex: 1, minWidth: 0, color: '#111827', fontSize: 14, fontWeight: '900' },
  photoChecklistRow: { borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: hairline(), borderColor: '#D9E7FF', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  photoChecklistTextWrap: { flex: 1, minWidth: 0 },
  photoChecklistLabel: { color: '#111827', fontWeight: '900' },
  photoChecklistHint: { marginTop: 2, color: '#667085', fontSize: 12, fontWeight: '700' },
  photoChecklistBtn: { minWidth: 96, minHeight: 44 },
  itemList: { gap: 10 },
  itemCard: { borderRadius: 16, backgroundColor: '#FAFBFC', borderWidth: hairline(), borderColor: '#E8EDF5', padding: 12 },
  itemRowCard: { borderRadius: 14, backgroundColor: '#FAFBFC', borderWidth: hairline(), borderColor: '#E8EDF5', padding: 12 },
  validationItemCard: { borderColor: '#F59E0B', backgroundColor: '#FFF7ED' },
  itemRowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  itemNameWrap: { flex: 1, minWidth: 0 },
  itemRowLabel: { color: '#111827', fontWeight: '900', fontSize: 15 },
  itemStatusHintOk: { marginTop: 2, color: '#0F9F6E', fontSize: 12, fontWeight: '700' },
  itemStatusHintLow: { marginTop: 2, color: '#B45309', fontSize: 12, fontWeight: '700' },
  itemToggleGroup: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' },
  itemCardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  okTag: { color: '#0F9F6E', backgroundColor: '#E9FBF4', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', fontSize: 12, fontWeight: '900' },
  lowTag: { color: '#B45309', backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', fontSize: 12, fontWeight: '900' },
  doneTag: { color: '#2563EB', backgroundColor: '#EAF2FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', fontSize: 12, fontWeight: '900', flexShrink: 0 },
  pendingTag: { color: '#667085', backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', fontSize: 12, fontWeight: '900', flexShrink: 0 },
  label: { marginBottom: 6, color: '#111827', fontWeight: '900' },
  input: { minHeight: 44, borderRadius: 10, borderWidth: hairline(), borderColor: '#D1D5DB', paddingHorizontal: 10, fontWeight: '700', color: '#111827' },
  row: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  lowStockInlineRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  qty: { flex: 1 },
  inlineChip: { minWidth: 72, minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  inlineChipOkActive: { backgroundColor: '#14B87A', borderColor: '#14B87A' },
  inlineChipLowActive: { backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
  inlineChipText: { color: '#374151', fontWeight: '900', fontSize: 13 },
  inlineChipTextActive: { color: '#FFFFFF' },
  lowDetailBox: { marginTop: 10, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: hairline(), borderColor: '#E8EDF5', padding: 10 },
  note: { height: 64, paddingTop: 10, textAlignVertical: 'top', marginTop: 8 },
  photoBtn: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  inlinePhotoBtn: { minWidth: 96 },
  primaryPhotoBtn: { flex: 1, minWidth: 128, minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#2563EB', borderWidth: hairline(), borderColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  primaryPhotoBtnSmall: { minWidth: 96, minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#2563EB', borderWidth: hairline(), borderColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  primaryPhotoBtnText: { fontWeight: '900', color: '#FFFFFF', textAlign: 'center' },
  photoBtnDisabled: { backgroundColor: '#E5E7EB' },
  photoBtnText: { fontWeight: '900', color: '#111827', textAlign: 'center' },
  photoPreview: { marginTop: 8, borderRadius: 12, overflow: 'hidden', borderWidth: hairline(), borderColor: '#EEF0F6' },
  photo: { width: '100%', height: moderateScale(160), backgroundColor: '#F3F4F6' },
  inlineErrorCard: { borderRadius: 14, backgroundColor: '#FFF7ED', borderWidth: hairline(), borderColor: '#FCD34D', padding: 12, gap: 8 },
  inlineErrorTitle: { color: '#9A3412', fontWeight: '900' },
  inlineErrorText: { color: '#B45309', fontWeight: '700', lineHeight: 18 },
  inlineRetryBtn: { alignSelf: 'flex-start', minHeight: 34, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#EA580C', alignItems: 'center', justifyContent: 'center' },
  inlineRetryText: { color: '#FFFFFF', fontWeight: '900' },
  thumbRow: { marginTop: 2, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumbMiniWrap: { width: '100%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden', borderWidth: hairline(), borderColor: '#D9E7FF', backgroundColor: '#F3F4F6' },
  thumbMiniPress: { width: '100%', height: '100%' },
  thumbMini: { width: '100%', height: '100%' },
  thumbMiniEmpty: { width: '100%', aspectRatio: 1, borderRadius: 10, borderWidth: hairline(), borderColor: '#E5E7EB', backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', padding: 6 },
  thumbMiniEmptyText: { fontSize: 10, lineHeight: 12, color: '#98A2B3', fontWeight: '700', textAlign: 'center' },
  thumbDeleteBtn: { position: 'absolute', right: 4, top: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(17,24,39,0.76)', alignItems: 'center', justifyContent: 'center' },
  submitInlineWrap: { marginTop: 4, paddingTop: 4 },
  submitBtn: { marginTop: 12, minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  submitDisabled: { backgroundColor: '#93C5FD' },
  submitText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15, textAlign: 'center' },
  ok: { marginTop: 8, color: '#16A34A', fontWeight: '900' },
  muted: { color: '#6B7280', fontWeight: '700' },
  pressed: { opacity: 0.92 },
  viewerMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  viewerTopRow: { position: 'absolute', top: 0, left: 0, right: 0, height: 54, paddingHorizontal: 12, justifyContent: 'center', zIndex: 2 },
  viewerCloseText: { color: '#FFFFFF', fontWeight: '900' },
  viewerImg: { flex: 1 },
})
