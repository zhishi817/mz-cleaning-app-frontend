import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Image, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { ResizeMode, Video } from 'expo-av'
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
import {
  dequeueCleaningConsumablesSubmit,
  enqueueCleaningConsumablesSubmit,
  isCleaningConsumablesSubmitQueued,
} from '../../lib/cleaningConsumablesSubmitQueue'
import { effectiveInspectionMode } from '../../lib/cleaningInspection'
import { useI18n } from '../../lib/i18n'
import { hairline, moderateScale } from '../../lib/scale'
import { getWorkTasksSnapshot, patchWorkTaskItem } from '../../lib/workTasksStore'
import type { TasksStackParamList } from '../../navigation/RootNavigator'
import { getCompletionPhotos, isRetryableApiError, selfCompleteCleaningTask, submitCleaningConsumables, uploadCleaningMedia, uploadCleaningVideo, uploadSelfLockboxVideo, saveCompletionPhotos, type ChecklistItem } from '../../lib/api'
import { ensureSuppliesCatalogLoaded, retrySuppliesCatalog, useSuppliesCatalogStore } from '../../lib/useSuppliesCatalogStore'
import { API_BASE_URL } from '../../config/env'
import AppButton from '../../components/ui/AppButton'
import AppTextInput from '../../components/ui/AppTextInput'
import ResponsiveImageGrid from '../../components/ui/ResponsiveImageGrid'
import SafeAreaBottomBar from '../../components/ui/SafeAreaBottomBar'
import { layoutTokens } from '../../lib/theme'

type Props = NativeStackScreenProps<TasksStackParamList, 'CleaningSelfComplete'>

type PhotoArea = 'toilet' | 'living' | 'sofa' | 'bedroom' | 'kitchen' | 'vacuum_used'

type CompletionPhotoItem = { area: PhotoArea; url: string }

type SupplyItemState = {
  id: string
  label: string
  required: boolean
  status: 'ok' | 'low' | null
  qty: string
  note: string
  photo_urls: string[]
}

type StatusTone = 'success' | 'pending' | 'info' | 'neutral'

const STATUS_TONE_COLORS: Record<StatusTone, { bg: string; border: string; text: string }> = {
  success: { bg: '#ECFDF5', border: '#A7F3D0', text: '#047857' },
  pending: { bg: '#FEF2F2', border: '#FECACA', text: '#B91C1C' },
  info: { bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8' },
  neutral: { bg: '#F3F4F6', border: '#D1D5DB', text: '#6B7280' },
}

const COMPLETION_AREAS: { area: PhotoArea; title: string; hint: string }[] = [
  { area: 'toilet', title: '浴室', hint: '至少 1 张' },
  { area: 'living', title: '客厅', hint: '至少 1 张' },
  { area: 'sofa', title: '沙发', hint: '至少 1 张' },
  { area: 'bedroom', title: '卧室', hint: '至少 1 张' },
  { area: 'kitchen', title: '厨房', hint: '至少 1 张' },
  { area: 'vacuum_used', title: '吸尘器使用后', hint: '至少 1 张' },
]

function normalizeDraftItems(list: SupplyItemState[]): CleaningConsumablesDraftItem[] {
  return list.map((item) => ({
    item_id: item.id,
    qty: item.id === 'other' ? null : (item.status === 'low' ? Number(String(item.qty || '').trim()) || 1 : null),
    note: String(item.note || '').trim() || null,
    status: item.id === 'other' ? 'ok' : item.status,
    photo_url: item.photo_urls[0] || null,
    photo_urls: item.photo_urls,
  }))
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

function StatusPill({ label, tone }: { label: string; tone: StatusTone }) {
  const palette = STATUS_TONE_COLORS[tone]
  return (
    <View style={[styles.statusPill, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Text style={[styles.statusPillText, { color: palette.text }]}>{label}</Text>
    </View>
  )
}

function SummaryTile({ label, value, tone }: { label: string; value: string; tone: StatusTone }) {
  const palette = STATUS_TONE_COLORS[tone]
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryTileLabel}>{label}</Text>
      <Text style={[styles.summaryTileValue, { color: palette.text }]}>{value}</Text>
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
  const taskType = String((task as any)?.task_type || '').trim().toLowerCase()
  const isStayoverTask = taskType === 'stayover_clean'
  const inspectionMode = effectiveInspectionMode(task as any)
  const requiresConsumables = !isStayoverTask
  const requiresLockboxVideo = !isStayoverTask

  const [completion, setCompletion] = useState<Record<PhotoArea, string[]>>({
    toilet: [],
    living: [],
    sofa: [],
    bedroom: [],
    kitchen: [],
    vacuum_used: [],
  })
  const [lockboxLocalUrl, setLockboxLocalUrl] = useState<string | null>(null)
  const lockboxFromTask = String((task as any)?.lockbox_video_url || '').trim()
  const lockboxUrl = lockboxLocalUrl || lockboxFromTask || null
  const remainingNightsRaw = (task as any)?.remaining_nights
  const remainingNights0 = remainingNightsRaw == null ? null : Number(remainingNightsRaw)
  const remainingNights = Number.isFinite(remainingNights0 as any) ? (remainingNights0 as number) : null

  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerUrls, setViewerUrls] = useState<string[]>([])
  const [viewerIndex, setViewerIndex] = useState(0)

  const requiredAreas = useMemo(() => COMPLETION_AREAS.map((item) => item.area), [])

  const completionOk = useMemo(() => requiredAreas.every(a => (completion[a] || []).length > 0), [completion, requiredAreas])

  const [suppliesSubmitted, setSuppliesSubmitted] = useState(false)
  const [supplies, setSupplies] = useState<SupplyItemState[]>([])
  const suppliesCatalog = useSuppliesCatalogStore()
  const [draftPhotoMeta, setDraftPhotoMeta] = useState<CleaningConsumablesPhotoMetaMap>({})
  const [pendingSuppliesSubmit, setPendingSuppliesSubmit] = useState(false)
  const suppliesDraftHydratedRef = useRef(false)
  const suppliesDirtyRef = useRef(false)
  const catalogCacheHint = useMemo(() => {
    if (!suppliesCatalog.items.length) return ''
    if (suppliesCatalog.error) return '当前显示最近缓存的补品清单，联网后可重试。'
    if (suppliesCatalog.isFromCache || suppliesCatalog.refreshing) return '当前显示本地缓存，正在同步最新补品清单。'
    return ''
  }, [suppliesCatalog.error, suppliesCatalog.isFromCache, suppliesCatalog.items.length, suppliesCatalog.refreshing])
  const showCatalogErrorCard = !!suppliesCatalog.error && !suppliesCatalog.items.length

  const lockboxOk = !requiresLockboxVideo || !!String(lockboxUrl || '').trim()
  const suppliesSummaryTone: StatusTone = suppliesSubmitted ? 'success' : pendingSuppliesSubmit ? 'info' : 'pending'
  const suppliesSummaryText = suppliesSubmitted ? '已提交' : pendingSuppliesSubmit ? '待同步' : '未提交'
  const photoSummaryTone: StatusTone = completionOk ? 'success' : 'pending'
  const photoSummaryText = completionOk ? '已满足' : '未满足'
  const lockboxSummaryTone: StatusTone = requiresLockboxVideo ? (lockboxOk ? 'success' : 'pending') : 'neutral'
  const lockboxSummaryText = requiresLockboxVideo ? (lockboxOk ? '已上传' : '未上传') : '无需上传'
  const completeHeaderTone: StatusTone = requiresLockboxVideo ? lockboxSummaryTone : photoSummaryTone
  const completeHeaderText = requiresLockboxVideo ? lockboxSummaryText : photoSummaryText
  const heroHint = requiresConsumables
    ? '先完成补品检查，再补齐房间完成照片和挂钥匙视频。'
    : '入住中清洁只需补齐完成照片后标记完成。'
  const stepLabels = useMemo(() => {
    let step = 1
    return {
      supplies: requiresConsumables ? `${step++}.` : null,
      feedback: `${step++}.`,
      photos: `${step++}.`,
      complete: `${step++}.`,
    }
  }, [requiresConsumables])
  const heroSummaryTiles = useMemo(
    () =>
      [
        requiresConsumables ? { label: '消耗品补充', value: suppliesSummaryText, tone: suppliesSummaryTone } : null,
        { label: '完成照片', value: photoSummaryText, tone: photoSummaryTone },
        requiresLockboxVideo ? { label: '挂钥匙视频', value: lockboxSummaryText, tone: lockboxSummaryTone } : null,
      ].filter(Boolean) as { label: string; value: string; tone: StatusTone }[],
    [lockboxSummaryText, lockboxSummaryTone, photoSummaryText, photoSummaryTone, requiresConsumables, requiresLockboxVideo, suppliesSummaryText, suppliesSummaryTone],
  )
  const completeSummaryTiles = useMemo(
    () =>
      [
        requiresConsumables ? { label: '消耗品补充', value: suppliesSummaryText, tone: suppliesSummaryTone } : null,
        { label: '房间完成照片', value: photoSummaryText, tone: photoSummaryTone },
        requiresLockboxVideo ? { label: '挂钥匙视频', value: lockboxSummaryText, tone: lockboxSummaryTone } : null,
      ].filter(Boolean) as { label: string; value: string; tone: StatusTone }[],
    [lockboxSummaryText, lockboxSummaryTone, photoSummaryText, photoSummaryTone, requiresConsumables, requiresLockboxVideo, suppliesSummaryText, suppliesSummaryTone],
  )
  const scrollBottomPadding = 148 + Math.max(insets.bottom, layoutTokens.spacing.lg)

  useEffect(() => {
    if (!task || isStayoverTask) return
    if (inspectionMode === 'self_complete') return
    Alert.alert('待确认检查安排', '当前任务不是“自完成”流程，请等待经理确认检查安排。', [
      { text: '知道了', onPress: () => props.navigation.goBack() },
    ])
  }, [inspectionMode, isStayoverTask, props.navigation, task])

  const canSubmitSupplies = useMemo(() => {
    if (!supplies.length) return false
    for (const it of supplies) {
      if (it.id !== 'other') {
        if (it.status !== 'ok' && it.status !== 'low') return false
      }
      if (it.status === 'low') {
        const q = Number(String(it.qty || '').trim())
        if (!Number.isFinite(q) || q < 1) return false
        if (!(it.photo_urls || []).length) return false
      }
    }
    return true
  }, [supplies])

  const refresh = useCallback(async () => {
    if (!token) return
    if (!cleaningTaskId) return
    try {
      setLoading(true)
      const r = await getCompletionPhotos(token, cleaningTaskId).catch(() => null)
      const next: Record<PhotoArea, string[]> = { toilet: [], living: [], sofa: [], bedroom: [], kitchen: [], vacuum_used: [] }
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
    if (!requiresConsumables) return
    if (!token) return
    void ensureSuppliesCatalogLoaded(token).catch(() => null)
  }, [requiresConsumables, token])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!requiresConsumables || !cleaningTaskId) {
        suppliesDraftHydratedRef.current = true
        return
      }
      const [queued, draft] = await Promise.all([
        isCleaningConsumablesSubmitQueued(cleaningTaskId),
        getCleaningConsumablesDraft(cleaningTaskId),
      ])
      if (cancelled) return
      suppliesDraftHydratedRef.current = true
      suppliesDirtyRef.current = !!draft
      setPendingSuppliesSubmit(queued || !!draft?.pending_submit)
      setDraftPhotoMeta(draft?.photo_meta || {})
      if (!draft) return
      const byId = new Map((draft.items || []).map((item) => [String(item.item_id || '').trim(), item]))
      if (suppliesCatalog.items.length) {
        const mapped = suppliesCatalog.items.map((it: ChecklistItem) => ({
          id: it.id,
          label: it.label,
          required: !!it.required,
          status: it.id === 'other' ? ('ok' as const) : (null as any),
          qty: '1',
          note: '',
          photo_urls: [],
        }))
        const next = mapped.map((item) => {
          const prev = byId.get(item.id)
          if (!prev) return item
          if (item.id === 'other') return { ...item, note: String(prev.note || '') }
          return {
            ...item,
            status: (String(prev.status || '').trim() === 'low' ? 'low' : 'ok') as 'ok' | 'low',
            qty: prev.qty != null ? String(prev.qty) : '1',
            note: String(prev.note || ''),
            photo_urls: Array.isArray(prev.photo_urls) ? prev.photo_urls.map((url) => String(url || '').trim()).filter(Boolean) : [],
          }
        })
        setSupplies(next)
      }
    })().catch(() => null)
    return () => {
      cancelled = true
    }
  }, [cleaningTaskId, requiresConsumables, suppliesCatalog.items])

  useEffect(() => {
    if (!requiresConsumables) return
    if (!suppliesCatalog.items.length) return
    if (supplies.length) return
    const mapped = suppliesCatalog.items.map((it: ChecklistItem) => ({
      id: it.id,
      label: it.label,
      required: !!it.required,
      status: it.id === 'other' ? ('ok' as const) : (null as any),
      qty: '1',
      note: '',
      photo_urls: [],
    }))
    setSupplies(mapped)
  }, [requiresConsumables, supplies.length, suppliesCatalog.items])

  useEffect(() => {
    if (!requiresConsumables || !cleaningTaskId) return
    if (!suppliesDraftHydratedRef.current || !suppliesDirtyRef.current) return
    void setCleaningConsumablesDraft(cleaningTaskId, {
      property_code: propertyCode || null,
      pending_submit: pendingSuppliesSubmit,
      extra_photo_urls: {},
      items: normalizeDraftItems(supplies),
      photo_meta: draftPhotoMeta,
    })
  }, [cleaningTaskId, draftPhotoMeta, pendingSuppliesSubmit, propertyCode, requiresConsumables, supplies])

  function toggle(k: keyof typeof expanded) {
    setExpanded(p => ({ ...p, [k]: !p[k] }))
  }

  function openViewer(urls: string[], index = 0) {
    setViewerUrls(urls.map((url) => toAbsoluteUrl(url)).filter(Boolean))
    setViewerIndex(index)
    setViewerOpen(true)
  }

  async function ensureCameraPerm() {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync()
      return !!perm.granted
    } catch {
      return false
    }
  }

  async function takePhotoAndUpload(area: PhotoArea) {
    if (!token) throw new Error('请先登录')
    const ok = await ensureCameraPerm()
    if (!ok) throw new Error('需要相机权限')
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.75, allowsEditing: false })
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
    suppliesDirtyRef.current = true
    setSupplies(prev => prev.map((x, i) => (i === idx ? { ...x, ...patch } : x)))
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

  async function persistCapturedConsumablesPhoto(fallbackName: string, prefix: string) {
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
    const username = String((user as any)?.username || (user as any)?.email || '').trim()
    rememberDraftPhoto(localUri, { name, mimeType, capturedAt, watermarkText: buildWatermarkText(propertyCode, username, capturedAt) })
    return localUri
  }

  async function uploadDraftPhotoIfNeeded(
    rawUrl: string,
    fallbackName: string,
    meta: Record<string, any>,
    photoMetaMap: Record<string, { name?: string; mime_type?: string; captured_at?: string; watermark_text?: string }>,
  ) {
    const current = String(rawUrl || '').trim()
    if (!current) return ''
    if (!isLocalCleaningConsumablesPhotoUri(current)) return current
    const photoMeta = photoMetaMap[current]
    const capturedAt = String(photoMeta?.captured_at || '').trim() || new Date().toISOString()
    const name = String(photoMeta?.name || '').trim() || fallbackName
    const mimeType = String(photoMeta?.mime_type || '').trim() || 'image/jpeg'
    const username = String((user as any)?.username || (user as any)?.email || '').trim()
    const watermarkText = buildWatermarkText(propertyCode, username, capturedAt)
    const up = await uploadCleaningMedia(token as string, { uri: current, name, mimeType }, {
      ...meta,
      captured_at: capturedAt,
      watermark: '1',
      watermark_text: watermarkText,
      property_code: propertyCode || undefined,
    })
    deleteCleaningConsumablesPhoto(current)
    delete photoMetaMap[current]
    return String(up.url || '').trim()
  }

  async function onTakeStockPhoto(idx: number) {
    try {
      suppliesDirtyRef.current = true
      const localUri = await persistCapturedConsumablesPhoto(`stock-${Date.now()}.jpg`, 'stock')
      if (!localUri) return
      setSupplies((prev) => prev.map((x, i) => (i === idx ? { ...x, photo_urls: [...x.photo_urls, localUri] } : x)))
      Alert.alert(t('common_ok'), '库存照片已保存到本机')
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '保存失败'))
    }
  }

  async function queueCurrentConsumablesSubmit(snapshot?: {
    supplies?: SupplyItemState[]
    photoMeta?: Record<string, { name?: string; mime_type?: string; captured_at?: string; watermark_text?: string }>
  }) {
    await setCleaningConsumablesDraft(cleaningTaskId, {
      property_code: propertyCode || null,
      pending_submit: true,
      extra_photo_urls: {},
      items: normalizeDraftItems(snapshot?.supplies || supplies),
      photo_meta: snapshot?.photoMeta || draftPhotoMeta,
    })
    await enqueueCleaningConsumablesSubmit(cleaningTaskId)
    setPendingSuppliesSubmit(true)
  }

  async function onSubmitSupplies() {
    if (!token) return Alert.alert(t('common_error'), '请先登录')
    if (!cleaningTaskId) return Alert.alert(t('common_error'), '缺少任务信息')
    if (!canSubmitSupplies) return Alert.alert(t('common_error'), '请完成所有消耗品检查；不足项必须填写数量并拍照。')
    const workingSupplies = supplies.map((item) => ({ ...item, photo_urls: [...item.photo_urls] }))
    const workingPhotoMeta = { ...draftPhotoMeta }
    try {
      setSuppliesSubmitting(true)
      for (const item of workingSupplies) {
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
      setSupplies(workingSupplies)
      setDraftPhotoMeta(workingPhotoMeta)

      const out = workingSupplies.map(x => ({
        item_id: x.id,
        status: x.status as any,
        qty: x.status === 'low' ? Number(String(x.qty || '').trim()) : undefined,
        note: x.note.trim() || undefined,
        photo_url: x.photo_urls[0] || undefined,
        photo_urls: x.photo_urls.length ? x.photo_urls : undefined,
      }))
      const updated = await submitCleaningConsumables(token, cleaningTaskId, { items: out })
      const nextStatus = String((updated as any)?.status || '').trim()
      if (task?.id && nextStatus) {
        await patchWorkTaskItem(String(task.id), { status: nextStatus } as any)
      }
      suppliesDirtyRef.current = false
      setPendingSuppliesSubmit(false)
      setDraftPhotoMeta({})
      await removeCleaningConsumablesDraft(cleaningTaskId)
      await dequeueCleaningConsumablesSubmit(cleaningTaskId)
      setSuppliesSubmitted(true)
      Alert.alert(t('common_ok'), '提交成功')
    } catch (e: any) {
      if (isRetryableApiError(e)) {
        setSupplies(workingSupplies)
        setDraftPhotoMeta(workingPhotoMeta)
        await queueCurrentConsumablesSubmit({ supplies: workingSupplies, photoMeta: workingPhotoMeta })
        Alert.alert(t('common_ok'), '已离线保存，联网后会自动同步补品填报。')
        return
      }
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
    if (requiresLockboxVideo && !lockboxOk) return Alert.alert(t('common_error'), '请先上传挂钥匙视频')
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
    <View style={styles.page}>
      <KeyboardAvoidingView
        style={styles.page}
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingBottom: scrollBottomPadding }]} keyboardShouldPersistTaps="handled">
        <View style={styles.heroCard}>
          <View style={styles.headRow}>
            <View style={styles.heroTextWrap}>
              <Text style={styles.title}>补充与完成</Text>
              <Text style={styles.heroHint}>{heroHint}</Text>
            </View>
            <View style={styles.badge}>
              <Ionicons name="home-outline" size={moderateScale(14)} color="#2563EB" />
              <Text style={styles.badgeText} numberOfLines={1}>
                {propertyCode || task.title}
              </Text>
            </View>
          </View>
          {propertyAddr ? <Text style={styles.heroAddress}>{propertyAddr}</Text> : null}
          <View style={styles.summaryGrid}>
            <SummaryTile label="待住晚数" value={remainingNights == null ? '-' : String(remainingNights)} tone="neutral" />
            {heroSummaryTiles.map((tile) => (
              <SummaryTile key={tile.label} label={tile.label} value={tile.value} tone={tile.tone} />
            ))}
          </View>
          {loading ? <Text style={styles.mutedSmall}>{t('common_loading')}</Text> : null}
        </View>

        {requiresConsumables ? (
          <View style={styles.card}>
            <Pressable onPress={() => toggle('supplies')} style={({ pressed }) => [styles.sectionHead, pressed ? styles.pressed : null]}>
              {sectionTitle(String(stepLabels.supplies || ''), '消耗品补充', 'cube-outline')}
              <View style={styles.sectionHeadRight}>
                <StatusPill label={suppliesSummaryText} tone={suppliesSummaryTone} />
                <Ionicons name={expanded.supplies ? 'chevron-up' : 'chevron-down'} size={moderateScale(18)} color="#6B7280" />
              </View>
            </Pressable>
            {expanded.supplies ? (
              <>
                <View style={styles.infoPanel}>
                  <View style={styles.infoPanelHeader}>
                    <View style={styles.infoPanelTitleRow}>
                      <Ionicons name="information-circle-outline" size={moderateScale(16)} color="#1D4ED8" />
                      <Text style={styles.infoPanelTitle}>提交规则</Text>
                    </View>
                    <StatusPill label={remainingNights == null ? '待住晚数 -' : `待住晚数 ${remainingNights}`} tone="neutral" />
                  </View>
                  <Text style={styles.infoPanelText}>请完成消耗品补充，不足项需要拍照。</Text>
                  <Text style={styles.infoPanelText}>照片会先保存在本机，提交时自动上传；弱网下可稍后继续。</Text>
                  {catalogCacheHint ? <Text style={styles.infoPanelText}>{catalogCacheHint}</Text> : null}
                  {pendingSuppliesSubmit ? <Text style={styles.ok}>已离线保存，待联网自动同步。</Text> : null}
                  {suppliesSubmitted ? <Text style={styles.ok}>已提交</Text> : pendingSuppliesSubmit ? null : suppliesCatalog.loading ? <Text style={styles.mutedSmall}>{t('common_loading')}</Text> : <Text style={styles.warn}>未提交</Text>}
                </View>
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
                {!showCatalogErrorCard ? (
                  <>
                    <View style={styles.subSection}>
                      <Text style={styles.subSectionTitle}>消耗品检查</Text>
                      <Text style={styles.subSectionHint}>逐项确认库存，不足时填写数量并补拍照片。</Text>
                    </View>
                    {supplies.map((it, idx) => (
                      <View key={it.id} style={styles.itemCard}>
                        <View style={styles.itemHead}>
                          <Text style={styles.supLabel}>{it.label}</Text>
                          {it.id === 'other' ? (
                            <StatusPill label="可选" tone="neutral" />
                          ) : it.status === 'ok' ? (
                            <StatusPill label="足够" tone="success" />
                          ) : it.status === 'low' ? (
                            <StatusPill label="不足" tone="pending" />
                          ) : (
                            <StatusPill label="待确认" tone="neutral" />
                          )}
                        </View>
                        {it.id === 'other' ? (
                          <AppTextInput
                            value={it.note}
                            onChangeText={(v) => setSupplyItem(idx, { note: v })}
                            style={[styles.supInput, styles.supNote]}
                            placeholder="其他需要补充/检查的内容（可选）"
                            multiline
                          />
                        ) : (
                          <>
                            <View style={styles.supRow}>
                          <Pressable
                            onPress={() => {
                              suppliesDirtyRef.current = true
                              for (const url of it.photo_urls) removePhotoUri(url)
                              setSupplyItem(idx, { status: 'ok', photo_urls: [] })
                            }}
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
                            {it.status === 'low' ? (
                              <>
                                <View style={styles.supRow}>
                                  <AppTextInput
                                    value={it.qty}
                                    onChangeText={(v) => setSupplyItem(idx, { qty: v.replace(/[^\d]/g, '').slice(0, 6) })}
                                    style={[styles.supInput, styles.supQty]}
                                    placeholder="缺多少（数量）"
                                    keyboardType="number-pad"
                                  />
                                  <Pressable
                                    onPress={() => onTakeStockPhoto(idx)}
                                    disabled={suppliesSubmitting}
                                    style={({ pressed }) => [styles.secondaryBtnDark, styles.stockPhotoBtn, pressed ? styles.pressed : null, suppliesSubmitting ? styles.disabled : null]}
                                  >
                                    <Text style={styles.secondaryBtnDarkText}>{it.photo_urls.length ? `继续拍照 (${it.photo_urls.length})` : '拍照库存'}</Text>
                                  </Pressable>
                                </View>
                                {it.photo_urls.length ? (
                                  <ResponsiveImageGrid
                                    items={it.photo_urls}
                                    keyExtractor={(photoUrl, photoIdx) => `${photoUrl}-${photoIdx}`}
                                    renderItem={(photoUrl, photoIdx) => (
                                      <View style={styles.thumbWrap}>
                                        <Pressable onPress={() => openViewer(it.photo_urls, photoIdx)} style={({ pressed }) => [styles.thumbPress, pressed ? styles.pressed : null]}>
                                          <Image source={{ uri: toAbsoluteUrl(photoUrl) }} style={styles.thumb} />
                                        </Pressable>
                                        <Pressable
                                          onPress={() => {
                                            suppliesDirtyRef.current = true
                                            removePhotoUri(photoUrl)
                                            setSupplies((prev) => prev.map((x, i) => (i === idx ? { ...x, photo_urls: x.photo_urls.filter((_, j) => j !== photoIdx) } : x)))
                                          }}
                                          style={({ pressed }) => [styles.removeBtn, pressed ? styles.pressed : null]}
                                        >
                                          <Ionicons name="close" size={moderateScale(14)} color="#FFFFFF" />
                                        </Pressable>
                                      </View>
                                    )}
                                  />
                                ) : null}
                                <AppTextInput
                                  value={it.note}
                                  onChangeText={(v) => setSupplyItem(idx, { note: v })}
                                  style={[styles.supInput, styles.supNote]}
                                  placeholder="备注（可选）"
                                  multiline
                                />
                              </>
                            ) : null}
                          </>
                        )}
                      </View>
                    ))}

                    {supplies.length ? (
                      <AppButton
                        label={suppliesSubmitting ? t('common_loading') : '提交消耗品补充'}
                        onPress={onSubmitSupplies}
                        disabled={suppliesSubmitting || !canSubmitSupplies}
                        fullWidth
                        style={suppliesSubmitting || !canSubmitSupplies ? styles.disabledPrimary : null}
                      />
                    ) : null}
                  </>
                ) : null}
              </>
            ) : null}
          </View>
        ) : null}

        <View style={styles.card}>
          <Pressable onPress={() => toggle('feedback')} style={({ pressed }) => [styles.sectionHead, pressed ? styles.pressed : null]}>
            {sectionTitle(stepLabels.feedback, '房源问题反馈', 'chatbubble-ellipses-outline')}
            <View style={styles.sectionHeadRight}>
              <StatusPill label="可选" tone="neutral" />
              <Ionicons name={expanded.feedback ? 'chevron-up' : 'chevron-down'} size={moderateScale(18)} color="#6B7280" />
            </View>
          </Pressable>
          {expanded.feedback ? (
            <>
              <View style={styles.infoPanel}>
                <Text style={styles.infoPanelText}>如发现房源问题，请在这里提交反馈。没有问题可跳过本步骤。</Text>
              </View>
              <View style={styles.rowCompact}>
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
            {sectionTitle(stepLabels.photos, '房间完成照片', 'camera-outline')}
            <View style={styles.sectionHeadRight}>
              <StatusPill label={photoSummaryText} tone={photoSummaryTone} />
              <Ionicons name={expanded.photos ? 'chevron-up' : 'chevron-down'} size={moderateScale(18)} color="#6B7280" />
            </View>
          </Pressable>
          {expanded.photos ? (
            <>
              <View style={styles.infoPanel}>
                <Text style={styles.infoPanelText}>每个区域至少 1 张照片，并补拍 1 张吸尘器使用后照片。</Text>
                {completionOk ? <Text style={styles.ok}>已满足</Text> : <Text style={styles.warn}>未满足</Text>}
              </View>
              {COMPLETION_AREAS.map(({ area, title, hint }) => {
                const list = completion[area] || []
                return (
                  <View key={area} style={styles.photoAreaCard}>
                    <View style={styles.photoAreaHead}>
                      <View style={styles.photoAreaCopy}>
                        <Text style={styles.areaTitle}>{title}</Text>
                        <Text style={styles.photoAreaHint}>{hint}</Text>
                      </View>
                      <View style={styles.photoAreaActions}>
                        <StatusPill label={`${list.length} 张`} tone={list.length ? 'success' : 'neutral'} />
                        <Pressable
                          onPress={() => onAddCompletionPhoto(area)}
                          disabled={uploading || savingPhotos}
                          style={({ pressed }) => [styles.areaBtn, pressed ? styles.pressed : null, uploading || savingPhotos ? styles.disabled : null]}
                        >
                          <Text style={styles.areaBtnText}>拍照</Text>
                        </Pressable>
                      </View>
                    </View>
                    {list.length ? (
                      <ResponsiveImageGrid
                        items={list}
                        keyExtractor={(u, idx) => `${u}:${idx}`}
                        renderItem={(u, idx) => (
                          <View style={styles.thumbWrap}>
                            <Pressable onPress={() => openViewer(list, idx)} style={({ pressed }) => [styles.thumbPress, pressed ? styles.pressed : null]}>
                              <Image source={{ uri: toAbsoluteUrl(u) }} style={styles.thumb} />
                            </Pressable>
                            <Pressable
                              onPress={() => onRemovePhoto(area, u)}
                              disabled={savingPhotos}
                              style={({ pressed }) => [styles.removeBtn, pressed ? styles.pressed : null, savingPhotos ? styles.disabled : null]}
                            >
                              <Ionicons name="close" size={moderateScale(14)} color="#FFFFFF" />
                            </Pressable>
                          </View>
                        )}
                      />
                    ) : <Text style={styles.mutedSmall}>暂无照片</Text>}
                  </View>
                )
              })}
            </>
          ) : null}
        </View>

        <View style={styles.card}>
          <Pressable onPress={() => toggle('complete')} style={({ pressed }) => [styles.sectionHead, pressed ? styles.pressed : null]}>
            {sectionTitle(stepLabels.complete, '标记已完成', 'checkmark-circle-outline')}
            <View style={styles.sectionHeadRight}>
              <StatusPill label={completeHeaderText} tone={completeHeaderTone} />
              <Ionicons name={expanded.complete ? 'chevron-up' : 'chevron-down'} size={moderateScale(18)} color="#6B7280" />
            </View>
          </Pressable>
          {expanded.complete ? (
            <>
              <View style={styles.summaryGrid}>
                {completeSummaryTiles.map((tile) => (
                  <SummaryTile key={tile.label} label={tile.label} value={tile.value} tone={tile.tone} />
                ))}
              </View>

              <View style={styles.subCard}>
                {requiresLockboxVideo ? (
                  <View style={styles.subCardHead}>
                    <View style={styles.subCardCopy}>
                      <Text style={styles.subCardTitle}>挂钥匙视频</Text>
                      <Text style={styles.subCardHint}>完成前请上传挂钥匙视频，可重复拍摄覆盖。</Text>
                    </View>
                    <StatusPill label={lockboxSummaryText} tone={lockboxSummaryTone} />
                  </View>
                ) : (
                  <View style={styles.noticeBanner}>
                    <Ionicons name="checkmark-circle-outline" size={moderateScale(16)} color="#1D4ED8" />
                    <Text style={styles.noticeBannerText}>入住中清洁无需补品和挂钥匙视频，补齐完成照片后可直接标记完成。</Text>
                  </View>
                )}
                {requiresLockboxVideo && lockboxOk ? (
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
                <View style={styles.actionRow}>
                  {requiresLockboxVideo ? (
                    <AppButton
                      label={lockboxOk ? '重传视频' : '上传视频'}
                      onPress={onUploadLockboxVideo}
                      disabled={uploading || submitting}
                      tone="secondary"
                      style={[styles.grayBtn, uploading || submitting ? styles.disabled : null]}
                    />
                  ) : null}
                </View>
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>

      <SafeAreaBottomBar>
        <AppButton
          label={submitting ? t('common_loading') : '标记已完成'}
          onPress={onSelfComplete}
          disabled={uploading || submitting}
          fullWidth
          style={uploading || submitting ? styles.disabledPrimary : null}
        />
      </SafeAreaBottomBar>
      </KeyboardAvoidingView>

      <Modal visible={viewerOpen} transparent animationType="fade" onRequestClose={() => setViewerOpen(false)}>
        <Pressable style={styles.viewerBackdrop} onPress={() => setViewerOpen(false)}>
          <Pressable style={styles.viewerCard} onPress={() => {}}>
            <View style={[styles.viewerHead, { paddingTop: Math.max(insets.top, 10) }]}>
              <Pressable
                onPress={() => setViewerOpen(false)}
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
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F6F7FB' },
  content: { padding: 16, gap: 12 },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: hairline(),
    borderColor: '#E7ECF5',
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, borderWidth: hairline(), borderColor: '#E7ECF5' },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  heroTextWrap: { flex: 1, minWidth: 180, gap: 6 },
  title: { color: '#111827', fontWeight: '900', fontSize: 22, lineHeight: 28 },
  heroHint: { color: '#475569', fontWeight: '700', lineHeight: 20 },
  badge: { minHeight: 30, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: '#EFF6FF', borderWidth: hairline(), borderColor: '#DBEAFE', flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%', flexShrink: 1 },
  badgeText: { color: '#2563EB', fontWeight: '900', flexShrink: 1 },
  heroAddress: { marginTop: 12, color: '#4B5563', fontWeight: '900', fontSize: 18, lineHeight: 28 },
  summaryGrid: { marginTop: 14, flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  summaryTile: { flexGrow: 1, minWidth: 108, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 14, backgroundColor: '#F8FAFC', borderWidth: hairline(), borderColor: '#E5E7EB', gap: 4 },
  summaryTileLabel: { color: '#6B7280', fontWeight: '800', fontSize: 12 },
  summaryTileValue: { fontWeight: '900', fontSize: 15 },
  noticeBanner: { marginTop: 14, flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 12, borderRadius: 14, backgroundColor: '#EFF6FF', borderWidth: hairline(), borderColor: '#BFDBFE' },
  noticeBannerText: { flex: 1, color: '#1D4ED8', fontWeight: '800', lineHeight: 20 },
  muted: { marginTop: 10, color: '#6B7280', fontWeight: '700' },
  mutedSmall: { marginTop: 6, color: '#6B7280', fontWeight: '700', fontSize: 12 },
  ok: { marginTop: 8, color: '#16A34A', fontWeight: '900' },
  warn: { marginTop: 8, color: '#DC2626', fontWeight: '900' },
  statusPill: { minHeight: 28, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: hairline(), alignItems: 'center', justifyContent: 'center' },
  statusPillText: { fontWeight: '900', fontSize: 12 },
  inlineErrorCard: { marginTop: 10, borderRadius: 14, backgroundColor: '#FFF7ED', borderWidth: hairline(), borderColor: '#FCD34D', padding: 12, gap: 8 },
  inlineErrorTitle: { color: '#9A3412', fontWeight: '900' },
  inlineErrorText: { color: '#B45309', fontWeight: '700', lineHeight: 18 },
  inlineRetryBtn: { alignSelf: 'flex-start', minHeight: 34, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#EA580C', alignItems: 'center', justifyContent: 'center' },
  inlineRetryText: { color: '#FFFFFF', fontWeight: '900' },
  pressed: { opacity: 0.92 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  sectionHeadRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionNo: { width: 22, fontWeight: '900', color: '#6B7280' },
  sectionTitle: { flexShrink: 1, minWidth: 0, fontSize: 15, fontWeight: '900', color: '#111827' },
  infoPanel: { marginTop: 12, padding: 12, borderRadius: 16, backgroundColor: '#F8FAFC', borderWidth: hairline(), borderColor: '#E5E7EB' },
  infoPanelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  infoPanelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoPanelTitle: { color: '#111827', fontWeight: '900' },
  infoPanelText: { marginTop: 8, color: '#475569', fontWeight: '700', lineHeight: 19 },
  subSection: { marginTop: 14, gap: 4 },
  subSectionTitle: { color: '#111827', fontWeight: '900', fontSize: 16 },
  subSectionHint: { color: '#6B7280', fontWeight: '700' },
  subCard: { marginTop: 12, padding: 12, borderRadius: 16, backgroundColor: '#FBFCFE', borderWidth: hairline(), borderColor: '#E5EAF3', gap: 10 },
  subCardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  subCardCopy: { flex: 1, minWidth: 160, gap: 4 },
  subCardTitle: { color: '#111827', fontWeight: '900', fontSize: 15 },
  subCardHint: { color: '#6B7280', fontWeight: '700', lineHeight: 19 },
  itemCard: { marginTop: 10, padding: 12, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: hairline(), borderColor: '#E5EAF3' },
  itemHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  rowCompact: { marginTop: 10, flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  actionRow: { marginTop: 4, flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  primaryBtn: { flex: 1, flexShrink: 1, minWidth: 140, minHeight: 44, borderRadius: 14, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  primaryText: { color: '#FFFFFF', fontWeight: '900', textAlign: 'center' },
  grayBtn: { flex: 1, flexShrink: 1, minWidth: 140, minHeight: 44, borderRadius: 14, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', borderWidth: hairline(), borderColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 8 },
  grayText: { color: '#111827', fontWeight: '900', textAlign: 'center' },
  secondaryBtnDark: { minWidth: 120, minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  secondaryBtnDarkText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12, textAlign: 'center' },
  stockPhotoBtn: { flex: 1, minWidth: 132 },
  disabled: { opacity: 0.6 },
  disabledPrimary: { backgroundColor: '#93C5FD' },
  photoAreaCard: { marginTop: 10, padding: 12, borderRadius: 16, backgroundColor: '#FBFCFE', borderWidth: hairline(), borderColor: '#E5EAF3' },
  photoAreaHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  photoAreaCopy: { flex: 1, minWidth: 120, gap: 4 },
  photoAreaHint: { color: '#6B7280', fontWeight: '700', fontSize: 12 },
  photoAreaActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  areaTitle: { flex: 1, minWidth: 0, color: '#111827', fontWeight: '900' },
  areaBtn: { minHeight: 44, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  areaBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  thumbRow: { gap: 10, paddingVertical: 8 },
  thumbWrap: { width: '100%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', borderWidth: hairline(), borderColor: '#EEF0F6' },
  thumbPress: { width: '100%', height: '100%' },
  thumb: { width: '100%', height: '100%' },
  removeBtn: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  supLabel: { color: '#111827', fontWeight: '900' },
  supRow: { marginTop: 8, flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  supChip: { flex: 1, minWidth: 120, minHeight: 44, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', borderWidth: hairline(), borderColor: '#E5E7EB' },
  supChipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  supChipText: { color: '#111827', fontWeight: '900' },
  supChipTextActive: { color: '#FFFFFF' },
  supInput: { minHeight: 44, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: hairline(), borderColor: '#E5E7EB', paddingHorizontal: 10, color: '#111827', fontWeight: '800' },
  supQty: { flex: 1 },
  supNote: { marginTop: 8, minHeight: 80, textAlignVertical: 'top', paddingTop: 10, paddingBottom: 10 },
  supPhotoPreview: { marginTop: 8, borderRadius: 14, overflow: 'hidden', borderWidth: hairline(), borderColor: '#EEF0F6' },
  supPreviewImg: { width: '100%', height: 180, backgroundColor: '#F3F4F6' },
  captureGrid: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  captureCard: { flexGrow: 1, minWidth: 150, padding: 12, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: hairline(), borderColor: '#E5EAF3', gap: 10 },
  captureCardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  captureHint: { color: '#6B7280', fontWeight: '700', lineHeight: 18 },
  capturePreview: { borderRadius: 12, overflow: 'hidden', borderWidth: hairline(), borderColor: '#EEF0F6' },
  capturePreviewImg: { width: '100%', height: 120, backgroundColor: '#F3F4F6' },
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
