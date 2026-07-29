import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { ResizeMode, Video } from 'expo-av'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../../lib/auth'
import {
  deleteCleaningConsumablesPhoto,
  enqueueCleaningConsumablesMediaCleanup,
  getCleaningConsumablesDraft,
  isLocalCleaningConsumablesPhotoUri,
  persistCompressedCleaningConsumablesPhoto,
  setCleaningConsumablesDraft,
  updateCleaningConsumablesDraft,
  type CleaningConsumablesDraftItem,
  type CleaningConsumablesMedia,
  type CleaningConsumablesPhotoMetaMap,
  type CleaningConsumablesSubmitStatus,
} from '../../lib/cleaningConsumablesDraft'
import {
  enqueueAndProcessCleaningConsumablesSubmit,
  subscribeCleaningConsumablesSubmitQueue,
} from '../../lib/cleaningConsumablesSubmitQueue'
import {
  enqueueInspectionMediaItem,
  listInspectionMediaQueueItemsForTask,
  processInspectionMediaQueue,
  removeInspectionMediaItem,
  subscribeInspectionMediaQueue,
  updateInspectionMediaItem,
  type InspectionMediaQueueItem,
} from '../../lib/inspectionMediaQueue'
import { effectiveInspectionMode } from '../../lib/cleaningInspection'
import { useI18n } from '../../lib/i18n'
import { hairline, moderateScale } from '../../lib/scale'
import { findWorkTaskItemByAnyId, subscribeWorkTasks } from '../../lib/workTasksStore'
import type { TasksStackParamList } from '../../navigation/RootNavigator'
import { getCleaningConsumables, getCompletionPhotos, getRestockProof, selfCompleteCleaningTask, type ChecklistItem } from '../../lib/api'
import { consumableRestockStandard } from '../../lib/consumableRestockStandards'
import { ensureSuppliesCatalogLoaded, retrySuppliesCatalog, useSuppliesCatalogStore } from '../../lib/useSuppliesCatalogStore'
import { API_BASE_URL } from '../../config/env'
import AppButton from '../../components/ui/AppButton'
import AppTextInput from '../../components/ui/AppTextInput'
import ResponsiveImageGrid from '../../components/ui/ResponsiveImageGrid'
import CleaningMediaImage from '../../components/CleaningMediaImage'
import CleaningMediaPreview from '../../components/CleaningMediaPreview'
import SafeAreaBottomBar from '../../components/ui/SafeAreaBottomBar'
import { layoutTokens } from '../../lib/theme'

type Props = NativeStackScreenProps<TasksStackParamList, 'CleaningSelfComplete'>

type PhotoArea = 'toilet' | 'living' | 'sofa' | 'bedroom' | 'kitchen' | 'shower_drain' | 'remote_tv' | 'vacuum_used'

type ViewerItem = {
  reference: string
  watermarkText: string | null
}

type SupplyItemState = {
  id: string
  label: string
  required: boolean
  status: 'ok' | 'low' | null
  restock_status: 'restocked' | 'carry_forward' | 'unavailable' | null
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

const COMPLETION_AREAS: { area: PhotoArea; title: string; hint: string; required?: boolean }[] = [
  { area: 'toilet', title: '浴室', hint: '至少 1 张' },
  { area: 'shower_drain', title: '浴室下水口', hint: '至少 1 张' },
  { area: 'living', title: '客厅', hint: '拍整体照片（至少 1 张）' },
  { area: 'sofa', title: '沙发', hint: '拍坐垫表面（至少 1 张）' },
  { area: 'bedroom', title: '卧室', hint: '拍地毯（至少 1 张）' },
  { area: 'kitchen', title: '厨房', hint: '拍整体照片（至少 1 张）' },
  { area: 'remote_tv', title: '电视和空调遥控器', hint: '两种遥控器同框拍 1 张（必拍）' },
  { area: 'vacuum_used', title: '吸尘器使用后', hint: '至少 1 张' },
]

function normalizeDraftItems(list: SupplyItemState[]): CleaningConsumablesDraftItem[] {
  return list.map((item) => ({
    item_id: item.id,
    label: item.label,
    qty: item.restock_status === 'restocked' || item.restock_status === 'carry_forward'
      ? Number(String(item.qty || '').trim()) || null
      : null,
    note: String(item.note || '').trim() || null,
    // 未选择补货结果时不能写成“现场够用”，否则重进页面会把整份草稿误回显为已确认。
    status: item.restock_status === 'unavailable'
      ? 'ok'
      : item.restock_status === 'restocked' || item.restock_status === 'carry_forward'
        ? 'low'
        : null,
    restock_status: item.restock_status,
    photo_url: item.restock_status === 'restocked' ? item.photo_urls[0] || null : null,
    photo_urls: item.restock_status === 'restocked' ? item.photo_urls : [],
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

function selfCompleteLockboxSyncStatus(item: InspectionMediaQueueItem | null, businessSaved: boolean, required: boolean) {
  if (!required) return { label: '无需上传', tone: 'neutral' as StatusTone, hint: '入住中清洁无需挂钥匙视频。' }
  if (businessSaved) return { label: '已同步', tone: 'success' as StatusTone, hint: '挂钥匙视频已上传并保存到任务。' }
  if (!item) return { label: '未上传', tone: 'pending' as StatusTone, hint: '完成前请拍摄并上传挂钥匙视频。' }
  if (item.upload_status === 'uploading') return { label: '上传中', tone: 'info' as StatusTone, hint: '视频已保存到本机，正在上传。' }
  if (item.upload_status === 'pending') return { label: '待同步', tone: 'info' as StatusTone, hint: '视频已保存到本机，等待网络后会自动上传。' }
  if (item.uploaded_url && item.last_error) return { label: '保存失败', tone: 'pending' as StatusTone, hint: `视频已上传，但任务记录保存失败：${item.last_error}` }
  if (item.uploaded_url) return { label: '等待保存', tone: 'info' as StatusTone, hint: '视频文件已上传，正在保存任务记录。' }
  if (item.local_file_deleted_at) return { label: '需重拍', tone: 'pending' as StatusTone, hint: '本地视频已过期清理，请重新拍摄。' }
  return { label: '同步失败', tone: 'pending' as StatusTone, hint: item.last_error || '视频仍保存在本机，可点击重试同步。' }
}

export default function CleaningSelfCompleteScreen(props: Props) {
  const { t } = useI18n()
  const { token, user } = useAuth()
  const insets = useSafeAreaInsets()
  const { width: viewerPageWidth } = useWindowDimensions()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [savingPhotos, setSavingPhotos] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [suppliesSubmitting, setSuppliesSubmitting] = useState(false)
  const [, bumpTasksVersion] = useState(0)
  const [expanded, setExpanded] = useState<Record<'supplies' | 'feedback' | 'photos' | 'complete', boolean>>({
    supplies: true,
    feedback: true,
    photos: true,
    complete: true,
  })
  const [roomConfirmed, setRoomConfirmed] = useState(false)

  useEffect(() => {
    const unsubscribe = subscribeWorkTasks(() => bumpTasksVersion((value) => value + 1))
    return () => {
      unsubscribe()
    }
  }, [])

  const task = findWorkTaskItemByAnyId(props.route.params.taskId)
  const cleaningTaskId = String(task?.source_id || '').trim()
  const propertyCode = String(task?.property?.code || '').trim()
  const propertyAddr = String(task?.property?.address || '').trim()
  const completedSelfCompleteView = ['done', 'completed', 'ready', 'keys_hung', 'cleaned', 'restock_pending', 'restocked', 'inspected']
    .includes(String((task as any)?.status || '').trim().toLowerCase())
  const skipRoomConfirmation = completedSelfCompleteView
  useEffect(() => {
    setRoomConfirmed(skipRoomConfirmation)
  }, [props.route.params.taskId, skipRoomConfirmation])
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
    shower_drain: [],
    remote_tv: [],
    vacuum_used: [],
  })
  const completionRef = useRef(completion)
  const [completionWatermarks, setCompletionWatermarks] = useState<Record<string, string>>({})
  const completionWatermarksRef = useRef<Record<string, string>>({})
  const [lockboxItem, setLockboxItem] = useState<InspectionMediaQueueItem | null>(null)
  const lockboxFromTask = String((task as any)?.lockbox_video_url || '').trim()
  const lockboxUrl = String(lockboxItem?.uploaded_url || lockboxItem?.local_uri || lockboxFromTask || '').trim() || null
  const lockboxBusinessSaved = !!lockboxItem?.business_saved || !!lockboxFromTask
  const remainingNightsRaw = (task as any)?.remaining_nights
  const remainingNights0 = remainingNightsRaw == null ? null : Number(remainingNightsRaw)
  const remainingNights = Number.isFinite(remainingNights0 as any) ? (remainingNights0 as number) : null

  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerItems, setViewerItems] = useState<ViewerItem[]>([])
  const [viewerIndex, setViewerIndex] = useState(0)

  const completionAreas = useMemo(() => COMPLETION_AREAS.map((item) => item.area), [])
  const requiredAreas = useMemo(() => COMPLETION_AREAS.filter((item) => item.required !== false).map((item) => item.area), [])

  const completionOk = useMemo(() => requiredAreas.every(a => (completion[a] || []).length > 0), [completion, requiredAreas])

  const [suppliesSubmitted, setSuppliesSubmitted] = useState(false)
  const [supplies, setSupplies] = useState<SupplyItemState[]>([])
  const suppliesCatalog = useSuppliesCatalogStore()
  const [draftPhotoMeta, setDraftPhotoMeta] = useState<CleaningConsumablesPhotoMetaMap>({})
  const [suppliesSubmitStatus, setSuppliesSubmitStatus] = useState<CleaningConsumablesSubmitStatus>('draft')
  const suppliesDraftHydratedRef = useRef(false)
  const suppliesDirtyRef = useRef(false)
  const suppliesUserChangedRef = useRef(false)
  const catalogCacheHint = useMemo(() => {
    if (!suppliesCatalog.items.length) return ''
    if (suppliesCatalog.error) return '当前显示最近缓存的补品清单，联网后可重试。'
    if (suppliesCatalog.isFromCache || suppliesCatalog.refreshing) return '当前显示本地缓存，正在同步最新补品清单。'
    return ''
  }, [suppliesCatalog.error, suppliesCatalog.isFromCache, suppliesCatalog.items.length, suppliesCatalog.refreshing])
  const showCatalogErrorCard = !!suppliesCatalog.error && !suppliesCatalog.items.length

  const lockboxOk = !requiresLockboxVideo || lockboxBusinessSaved
  const pendingSuppliesSubmit = suppliesSubmitStatus !== 'draft' && suppliesSubmitStatus !== 'synced'
  const suppliesSummaryTone: StatusTone = suppliesSubmitted || suppliesSubmitStatus === 'synced' ? 'success' : pendingSuppliesSubmit ? 'info' : 'pending'
  const suppliesSummaryText = suppliesSubmitted || suppliesSubmitStatus === 'synced' ? '已提交' : pendingSuppliesSubmit ? '待同步' : '未提交'
  const photoSummaryTone: StatusTone = completionOk ? 'success' : 'pending'
  const photoSummaryText = completionOk ? '已满足' : '未满足'
  const lockboxSyncStatus = selfCompleteLockboxSyncStatus(lockboxItem, lockboxBusinessSaved, requiresLockboxVideo)
  const lockboxSummaryTone = lockboxSyncStatus.tone
  const lockboxSummaryText = lockboxSyncStatus.label
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
      if (it.id === 'other' && !String(it.note || '').trim()) continue
      if (!it.restock_status) return false
      if (it.restock_status === 'restocked' && !(it.photo_urls || []).length) return false
    }
    return true
  }, [supplies])

  const refresh = useCallback(async () => {
    if (!token) return
    if (!cleaningTaskId) return
    try {
      setLoading(true)
      const [serverResult, draftResult] = await Promise.allSettled([
        getCompletionPhotos(token, cleaningTaskId),
        getCleaningConsumablesDraft(cleaningTaskId),
      ])
      const serverReadOk = serverResult.status === 'fulfilled'
      const draftReadOk = draftResult.status === 'fulfilled'
      if (!serverReadOk && !draftReadOk) return
      const r = serverResult.status === 'fulfilled' ? serverResult.value : null
      const draft = draftResult.status === 'fulfilled' ? draftResult.value : null
      const next: Record<PhotoArea, string[]> = serverReadOk
        ? { toilet: [], living: [], sofa: [], bedroom: [], kitchen: [], shower_drain: [], remote_tv: [], vacuum_used: [] }
        : {
            toilet: [...completionRef.current.toilet],
            living: [...completionRef.current.living],
            sofa: [...completionRef.current.sofa],
            bedroom: [...completionRef.current.bedroom],
            kitchen: [...completionRef.current.kitchen],
            shower_drain: [...completionRef.current.shower_drain],
            remote_tv: [...completionRef.current.remote_tv],
            vacuum_used: [...completionRef.current.vacuum_used],
          }
      const nextWatermarks = serverReadOk ? {} : { ...completionWatermarksRef.current }
      const pendingCompletionDraft = draft?.completion_submit_enabled && !draft.completion_business_saved
      const serverItems = pendingCompletionDraft ? [] : (r?.items || [])
      for (const it of serverItems) {
        const rawArea = String(it.area || '').trim()
        const a = (rawArea === 'remote_controls' || rawArea === 'remote_ac' ? 'remote_tv' : rawArea) as PhotoArea
        const url = String(it.url || '').trim()
        if (!url) continue
        if (!(a in next)) continue
        next[a].push(url)
      }
      for (const media of draft?.media || []) {
        if (media.media_kind !== 'completion_photo') continue
        const rawArea = String(media.area || '').trim()
        const area = (rawArea === 'remote_controls' || rawArea === 'remote_ac' ? 'remote_tv' : rawArea) as PhotoArea
        const url = String(media.remote_url || media.local_uri || '').trim()
        if (!(area in next) || !url || next[area].includes(url)) continue
        next[area].push(url)
        if (String(media.local_uri || '').trim() === url && String(media.watermark_text || '').trim()) {
          nextWatermarks[url] = String(media.watermark_text || '').trim()
        }
      }
      setCompletion(next)
      setCompletionWatermarks(nextWatermarks)
    } finally {
      setLoading(false)
    }
  }, [cleaningTaskId, token])

  const reloadLockboxItem = useCallback(async () => {
    if (!cleaningTaskId || !requiresLockboxVideo) {
      setLockboxItem(null)
      return
    }
    const items = await listInspectionMediaQueueItemsForTask(cleaningTaskId, ['lockbox_video'])
    const selfCompleteItems = items.filter((item) => item.meta?.lockbox_submission_mode === 'self_complete')
    const latest = selfCompleteItems.sort((a, b) => b.created_at.localeCompare(a.created_at))[0] || null
    setLockboxItem(latest)
  }, [cleaningTaskId, requiresLockboxVideo])

  useEffect(() => {
    completionRef.current = completion
  }, [completion])

  useEffect(() => {
    completionWatermarksRef.current = completionWatermarks
  }, [completionWatermarks])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    let cancelled = false
    void reloadLockboxItem()
    if (token && cleaningTaskId && requiresLockboxVideo) {
      void processInspectionMediaQueue(token)
        .catch(() => null)
        .finally(() => {
          if (!cancelled) void reloadLockboxItem()
        })
    }
    const unsubscribe = subscribeInspectionMediaQueue(() => {
      void reloadLockboxItem()
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [cleaningTaskId, reloadLockboxItem, requiresLockboxVideo, token])

  useEffect(() => {
    const nav: any = props.navigation as any
    if (!nav || typeof nav.addListener !== 'function') return
    const unsub = nav.addListener('focus', () => {
      refresh()
      if (token && cleaningTaskId && requiresLockboxVideo) {
        void processInspectionMediaQueue(token).catch(() => null).finally(() => {
          void reloadLockboxItem()
        })
      }
    })
    return unsub
  }, [cleaningTaskId, props.navigation, refresh, reloadLockboxItem, requiresLockboxVideo, token])

  useEffect(() => {
    if (!requiresConsumables) return
    if (!token) return
    void ensureSuppliesCatalogLoaded(token).catch(() => null)
  }, [requiresConsumables, token])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!requiresConsumables || !cleaningTaskId || !token) {
        suppliesDraftHydratedRef.current = true
        return
      }
      const [draftResult, consumablesResult, restockResult] = await Promise.allSettled([
        getCleaningConsumablesDraft(cleaningTaskId),
        getCleaningConsumables(token, cleaningTaskId),
        getRestockProof(token, cleaningTaskId),
      ])
      if (cancelled) return
      const draft = draftResult.status === 'fulfilled' ? draftResult.value : null
      const serverConsumables = consumablesResult.status === 'fulfilled' ? consumablesResult.value.items : []
      const savedConsumables = serverConsumables.length > 0
      const consumablesById = new Map(
        serverConsumables
          .map((item) => [String(item.item_id || '').trim(), item] as const)
          .filter(([itemId]) => !!itemId),
      )
      const restockById = new Map(
        (restockResult.status === 'fulfilled' ? restockResult.value.items : [])
          .map((item) => [String(item.item_id || '').trim(), item] as const)
          .filter(([itemId]) => !!itemId),
      )
      suppliesDraftHydratedRef.current = true
      suppliesDirtyRef.current = !!draft
      setSuppliesSubmitStatus(draft?.submit_status || (draft?.pending_submit ? 'waiting_sync' : 'draft'))
      setDraftPhotoMeta(draft?.photo_meta || {})
      setSuppliesSubmitted(
        (draft?.consumables_business_saved === true
          && (!draft.restock_submit_enabled || draft.restock_business_saved === true))
        || (!draft && savedConsumables),
      )
      const byId = new Map((draft?.items || []).map((item) => [String(item.item_id || '').trim(), item]))
      if (suppliesCatalog.items.length) {
        const mapped = suppliesCatalog.items.map((it: ChecklistItem) => ({
          id: it.id,
          label: it.label,
          required: !!it.required,
          status: null,
          restock_status: null,
          qty: '1',
          note: '',
          photo_urls: [],
        }))
        const next = mapped.map((item) => {
          const prev = byId.get(item.id)
          const serverRestock = restockById.get(item.id)
          const serverConsumable = consumablesById.get(item.id)
          const localRestock = prev?.restock_status
          const legacyExplicitSufficient = prev?.status === 'ok'
            && !Object.prototype.hasOwnProperty.call(prev || {}, 'restock_status')
          const restockStatus = localRestock === 'restocked' || localRestock === 'carry_forward' || localRestock === 'unavailable'
            ? localRestock
            : legacyExplicitSufficient
              ? 'unavailable'
            : serverRestock?.status === 'restocked' || serverRestock?.status === 'carry_forward' || serverRestock?.status === 'unavailable'
              ? serverRestock.status
              : String(serverConsumable?.status || '').trim() === 'ok'
                ? 'unavailable'
              : null
          return {
            ...item,
            restock_status: restockStatus,
            qty: prev?.qty != null ? String(prev.qty) : serverRestock?.qty != null ? String(serverRestock.qty) : '1',
            note: String(prev?.note || serverRestock?.note || ''),
            photo_urls: Array.isArray(prev?.photo_urls) && prev.photo_urls.length
              ? prev.photo_urls.map((url) => String(url || '').trim()).filter(Boolean)
              : Array.isArray(serverRestock?.proof_urls)
                ? serverRestock.proof_urls.map((url) => String(url || '').trim()).filter(Boolean)
                : [],
          }
        })
        setSupplies(next)
      }
    })().catch(() => null)
    return () => {
      cancelled = true
    }
  }, [cleaningTaskId, requiresConsumables, suppliesCatalog.items, token])

  useEffect(() => {
    if (!cleaningTaskId) return
    return subscribeCleaningConsumablesSubmitQueue((changedTaskId) => {
      if (changedTaskId !== cleaningTaskId) return
      void getCleaningConsumablesDraft(cleaningTaskId).then((draft) => {
        if (!draft && requiresConsumables) {
          suppliesDirtyRef.current = false
          setSuppliesSubmitStatus('synced')
          setSuppliesSubmitted(true)
          return
        }
        if (requiresConsumables && draft) {
          setSuppliesSubmitStatus(draft.submit_status)
          setDraftPhotoMeta(draft.photo_meta || {})
          setSuppliesSubmitted(
            draft.consumables_business_saved === true
              && (!draft.restock_submit_enabled || draft.restock_business_saved === true),
          )
          if (draft.submit_status !== 'draft' || !suppliesDirtyRef.current) {
            const byId = new Map((draft.items || []).map((item) => [String(item.item_id || '').trim(), item]))
            setSupplies((current) => current.map((item) => {
              const next = byId.get(item.id)
              if (!next) return item
              return {
                ...item,
                status: next.status === 'low' || next.status === 'ok' ? next.status : item.status,
                restock_status:
                  next.restock_status === 'restocked' || next.restock_status === 'carry_forward' || next.restock_status === 'unavailable'
                    ? next.restock_status
                    : item.restock_status,
                qty: next.qty == null ? item.qty : String(next.qty),
                note: String(next.note || ''),
                photo_urls: Array.isArray(next.photo_urls) ? next.photo_urls.filter(Boolean) : [],
              }
            }))
          }
        }
        void refresh()
      }).catch(() => {})
    })
  }, [cleaningTaskId, refresh, requiresConsumables])

  useEffect(() => {
    if (!requiresConsumables) return
    if (!suppliesCatalog.items.length) return
    if (supplies.length) return
    const mapped = suppliesCatalog.items.map((it: ChecklistItem) => ({
      id: it.id,
      label: it.label,
      required: !!it.required,
      status: null,
      restock_status: null,
      qty: '1',
      note: '',
      photo_urls: [],
    }))
    setSupplies(mapped)
  }, [requiresConsumables, supplies.length, suppliesCatalog.items])

  useEffect(() => {
    if (!requiresConsumables || !cleaningTaskId) return
    if (!suppliesDraftHydratedRef.current || !suppliesDirtyRef.current) return
    if (suppliesSubmitStatus !== 'draft' && suppliesSubmitStatus !== 'ready_to_submit') return
    void setCleaningConsumablesDraft(cleaningTaskId, {
      property_code: propertyCode || null,
      pending_submit: pendingSuppliesSubmit,
      submit_status: suppliesSubmitStatus,
      submit_consumables: true,
      restock_submit_enabled: supplies.some((item) => item.restock_status === 'restocked' || item.restock_status === 'carry_forward'),
      extra_photo_urls: {},
      items: normalizeDraftItems(supplies),
      photo_meta: draftPhotoMeta,
      ...(suppliesUserChangedRef.current
        ? { consumables_business_saved: false, restock_business_saved: false }
        : {}),
    })
  }, [cleaningTaskId, draftPhotoMeta, pendingSuppliesSubmit, propertyCode, requiresConsumables, supplies, suppliesSubmitStatus])

  function toggle(k: keyof typeof expanded) {
    setExpanded(p => ({ ...p, [k]: !p[k] }))
  }

  function openViewer(urls: string[], index = 0) {
    const username = String((user as any)?.username || (user as any)?.email || '').trim()
    const nextItems = urls
      .map((url) => {
        const rawUrl = String(url || '').trim()
        if (!rawUrl) return null
        return {
          reference: toAbsoluteUrl(rawUrl),
          // 远端文件由上传接口写入真实水印；本地草稿先显示相同文字，避免拍完预览时看起来无水印。
          watermarkText: rawUrl.startsWith('file://')
            ? completionWatermarks[rawUrl] || buildWatermarkText(propertyCode, username, new Date().toISOString())
            : null,
        }
      })
      .filter(Boolean) as ViewerItem[]
    setViewerItems(nextItems)
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

  async function takePhotoAndPersist(area: PhotoArea) {
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
    const persisted = await persistCompressedCleaningConsumablesPhoto(uri, name, mimeType, `completion-${area}`)
    return {
      url: persisted.localUri,
      name: persisted.name,
      mimeType: persisted.mimeType,
      capturedAt,
      watermarkText,
    }
  }

  function setSupplyItem(idx: number, patch: Partial<SupplyItemState>) {
    suppliesDirtyRef.current = true
    suppliesUserChangedRef.current = true
    setSuppliesSubmitted(false)
    setSuppliesSubmitStatus('draft')
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
    if (isLocalCleaningConsumablesPhotoUri(uri) && !deleteCleaningConsumablesPhoto(uri)) {
      void enqueueCleaningConsumablesMediaCleanup(uri)
    }
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
    const persisted = await persistCompressedCleaningConsumablesPhoto(sourceUri, name, mimeType, prefix)
    const username = String((user as any)?.username || (user as any)?.email || '').trim()
    rememberDraftPhoto(persisted.localUri, { name: persisted.name, mimeType: persisted.mimeType, capturedAt, watermarkText: buildWatermarkText(propertyCode, username, capturedAt) })
    return persisted.localUri
  }

  async function onTakeStockPhoto(idx: number) {
    try {
      suppliesDirtyRef.current = true
      suppliesUserChangedRef.current = true
      setSuppliesSubmitted(false)
      setSuppliesSubmitStatus('draft')
      const localUri = await persistCapturedConsumablesPhoto(`stock-${Date.now()}.jpg`, 'stock')
      if (!localUri) return
      setSupplies((prev) => prev.map((x, i) => (i === idx ? { ...x, photo_urls: [...x.photo_urls, localUri] } : x)))
      Alert.alert(t('common_ok'), '补货凭证已保存到本机')
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '保存失败'))
    }
  }

  async function onMarkRestocked(idx: number) {
    const item = supplies[idx]
    if (!item) return
    try {
      const localUri = await persistCapturedConsumablesPhoto(`restock-${item.id}-${Date.now()}.jpg`, 'restock')
      if (!localUri) return
      setSupplyItem(idx, {
        status: 'ok',
        restock_status: 'restocked',
        photo_urls: [...item.photo_urls, localUri],
      })
      Alert.alert(t('common_ok'), '已补充，补货凭证已保存到本机')
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '保存失败'))
    }
  }

  function setRestockResolution(idx: number, restockStatus: 'carry_forward' | 'unavailable') {
    const item = supplies[idx]
    if (!item) return
    for (const url of item.photo_urls) removePhotoUri(url)
    setSupplyItem(idx, {
      status: 'ok',
      restock_status: restockStatus,
      photo_urls: [],
    })
  }

  async function queueCurrentConsumablesSubmit(snapshot?: {
    supplies?: SupplyItemState[]
    photoMeta?: Record<string, { name?: string; mime_type?: string; captured_at?: string; watermark_text?: string }>
  }) {
    await setCleaningConsumablesDraft(cleaningTaskId, {
      property_code: propertyCode || null,
      pending_submit: true,
      submit_status: 'ready_to_submit',
      submit_consumables: true,
      restock_submit_enabled: (snapshot?.supplies || supplies).some((item) => item.restock_status === 'restocked' || item.restock_status === 'carry_forward'),
      consumables_business_saved: false,
      restock_business_saved: false,
      extra_photo_urls: {},
      items: normalizeDraftItems(snapshot?.supplies || supplies),
      photo_meta: snapshot?.photoMeta || draftPhotoMeta,
    })
  }

  async function queueCompletionSnapshot(
    next: Record<PhotoArea, string[]>,
    captured?: { url: string; area: PhotoArea; name: string; mimeType: string; capturedAt: string; watermarkText: string },
  ) {
    const current = await getCleaningConsumablesDraft(cleaningTaskId)
    const currentCompletionMedia = (current?.media || []).filter((media) => media.media_kind === 'completion_photo')
    const preservedMedia = (current?.media || []).filter((media) => media.media_kind !== 'completion_photo')
    const completionMedia: CleaningConsumablesMedia[] = []
    for (const area of completionAreas) {
      for (const url of next[area] || []) {
        const existing = currentCompletionMedia.find((media) => media.local_uri === url || media.remote_url === url)
        if (existing) {
          completionMedia.push({ ...existing, area, media_kind: 'completion_photo' })
          continue
        }
        const isLocal = isLocalCleaningConsumablesPhotoUri(url)
        const capturedMeta = captured && captured.url === url ? captured : null
        const mediaId = `completion-${area}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        completionMedia.push({
          media_id: mediaId,
          slot: `completion:${area}:${mediaId}`,
          media_kind: 'completion_photo',
          area,
          local_uri: isLocal ? url : null,
          remote_url: isLocal ? null : url,
          upload_status: isLocal ? 'local' : 'uploaded',
          upload_error_code: null,
          name: capturedMeta?.name || null,
          mime_type: capturedMeta?.mimeType || 'image/jpeg',
          captured_at: capturedMeta?.capturedAt || new Date().toISOString(),
          watermark_text: capturedMeta?.watermarkText || null,
        })
      }
    }
    const keepCurrentSubmit = !!current?.pending_submit && current.submit_status !== 'draft' && current.submit_status !== 'synced'
    const patch = {
      property_code: propertyCode || null,
      pending_submit: keepCurrentSubmit,
      submit_status: keepCurrentSubmit ? current?.submit_status || 'ready_to_submit' : 'draft' as const,
      submit_consumables: current?.submit_consumables === true,
      restock_submit_enabled: current?.restock_submit_enabled === true,
      completion_submit_enabled: false,
      completion_business_saved: false,
      items: current?.items || [],
      living_room_photo_url: current?.living_room_photo_url || null,
      remote_ac_photo_url: current?.remote_ac_photo_url || null,
      remote_tv_photo_url: current?.remote_tv_photo_url || null,
      extra_photo_urls: current?.extra_photo_urls || {},
      photo_meta: current?.photo_meta || {},
      media: [...preservedMedia, ...completionMedia],
    }
    await setCleaningConsumablesDraft(cleaningTaskId, patch)
  }

  async function submitCompletionBatch() {
    await queueCompletionSnapshot(completion)
    await updateCleaningConsumablesDraft(cleaningTaskId, (current) => ({
      ...current,
      pending_submit: true,
      submit_status: 'ready_to_submit',
      completion_submit_enabled: true,
      completion_business_saved: false,
    }))
    const result = await enqueueAndProcessCleaningConsumablesSubmit(
      token || '',
      String((user as any)?.username || (user as any)?.email || ''),
      cleaningTaskId,
    )
    if (result.succeeded_task_ids.includes(cleaningTaskId)) return
    const current = await getCleaningConsumablesDraft(cleaningTaskId)
    const detail = current?.last_error_message || (current?.submit_status === 'waiting_sync'
      ? '照片已保存在本机，等待网络恢复后会继续同步。'
      : '房间完成照片尚未同步完成，请稍后重试。')
    throw new Error(detail)
  }

  async function onSubmitSupplies() {
    if (!token) return Alert.alert(t('common_error'), '请先登录')
    if (!cleaningTaskId) return Alert.alert(t('common_error'), '缺少任务信息')
    if (!canSubmitSupplies) return Alert.alert(t('common_error'), '请逐项选择现场够用、已补充或下次退房补；已补充必须拍补货凭证。')
    try {
      setSuppliesSubmitting(true)
      await queueCurrentConsumablesSubmit()
      setSuppliesSubmitStatus('ready_to_submit')
      const result = await enqueueAndProcessCleaningConsumablesSubmit(token, String((user as any)?.username || (user as any)?.email || ''), cleaningTaskId)
      if (result.succeeded_task_ids.includes(cleaningTaskId)) {
        suppliesDirtyRef.current = false
        suppliesUserChangedRef.current = false
        setSuppliesSubmitStatus('synced')
        setDraftPhotoMeta({})
        setSuppliesSubmitted(true)
        Alert.alert(t('common_ok'), '提交成功')
        return
      }
      const currentDraft = await getCleaningConsumablesDraft(cleaningTaskId)
      const nextStatus = currentDraft?.submit_status || 'waiting_sync'
      setSuppliesSubmitStatus(nextStatus)
      if (nextStatus === 'blocked' || nextStatus === 'failed') {
        Alert.alert(t('common_error'), currentDraft?.last_error_message || '提交失败，请检查后重试')
      }
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
      const captured = await takePhotoAndPersist(area)
      if (!captured?.url) return
      const previous = area === 'remote_tv' ? completion[area] || [] : []
      const next = { ...completion, [area]: area === 'remote_tv' ? [captured.url] : [...(completion[area] || []), captured.url] }
      setCompletion(next)
      setSavingPhotos(true)
      await queueCompletionSnapshot(next, { area, ...captured })
      for (const url of previous) removePhotoUri(url)
      setCompletionWatermarks((current) => {
        const nextWatermarks = { ...current, [captured.url]: captured.watermarkText }
        for (const url of previous) delete nextWatermarks[url]
        return nextWatermarks
      })
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '照片保存失败'))
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
      removePhotoUri(url)
      await queueCompletionSnapshot(next)
      setCompletionWatermarks((current) => {
        const nextWatermarks = { ...current }
        delete nextWatermarks[url]
        return nextWatermarks
      })
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
      if (lockboxItem && !lockboxItem.business_saved) {
        await removeInspectionMediaItem(lockboxItem.id)
      }
      const queued = await enqueueInspectionMediaItem({
        task_id: cleaningTaskId,
        kind: 'lockbox_video',
        source_uri: uri,
        name,
        mime_type: mimeType,
        meta: { lockbox_submission_mode: 'self_complete' },
      })
      setLockboxItem(queued)
      Alert.alert(t('common_ok'), '视频已保存到本机，正在上传并保存任务记录。')
      void processInspectionMediaQueue(token).catch(() => null).finally(() => {
        void reloadLockboxItem()
      })
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '上传失败'))
    } finally {
      setUploading(false)
    }
  }

  async function onRetryLockboxSync() {
    if (!token) return Alert.alert(t('common_error'), '请先登录')
    if (!lockboxItem || lockboxBusinessSaved) return
    await updateInspectionMediaItem(lockboxItem.id, {
      upload_status: lockboxItem.uploaded_url ? 'uploaded' : 'pending',
      last_error: null,
    })
    void processInspectionMediaQueue(token).catch(() => null).finally(() => {
      void reloadLockboxItem()
    })
  }

  async function onSelfComplete() {
    if (!token) return Alert.alert(t('common_error'), '请先登录')
    if (!cleaningTaskId) return Alert.alert(t('common_error'), '缺少任务信息')
    if (requiresLockboxVideo && !lockboxOk) return Alert.alert(t('common_error'), '请先上传挂钥匙视频')
    if (!completionOk) return Alert.alert(t('common_error'), '请先上传房间完成照片')
    if (requiresConsumables && !canSubmitSupplies) {
      return Alert.alert(t('common_error'), '请逐项选择现场够用、已补充或下次退房补；已补充必须拍补货凭证。')
    }
    try {
      setSubmitting(true)
      if (requiresConsumables && !suppliesSubmitted) {
        setSuppliesSubmitting(true)
        await queueCurrentConsumablesSubmit()
        const suppliesResult = await enqueueAndProcessCleaningConsumablesSubmit(
          token,
          String((user as any)?.username || (user as any)?.email || ''),
          cleaningTaskId,
        )
        if (!suppliesResult.succeeded_task_ids.includes(cleaningTaskId)) {
          const draft = await getCleaningConsumablesDraft(cleaningTaskId)
          throw new Error(draft?.last_error_message || '消耗品补充尚未同步完成，请稍后重试。')
        }
        suppliesUserChangedRef.current = false
        suppliesDirtyRef.current = false
        setSuppliesSubmitted(true)
        setSuppliesSubmitStatus('synced')
      }
      await submitCompletionBatch()
      await selfCompleteCleaningTask(token, cleaningTaskId)
      Alert.alert(t('common_ok'), '已标记已完成')
      props.navigation.goBack()
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '提交失败'))
    } finally {
      setSuppliesSubmitting(false)
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
                  <Text style={styles.infoPanelText}>逐项选择“现场够用”“已补充”或“下次退房补”；已补充必须拍补货凭证。</Text>
                  <Text style={styles.infoPanelText}>照片先保存在本机，提交时才上传并写入补货记录；弱网下可稍后继续。</Text>
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
                      <Text style={styles.subSectionTitle}>消耗品补充</Text>
                      <Text style={styles.subSectionHint}>现场补好的记录为“已补充”；来不及补的记到下一次退房。</Text>
                    </View>
                    {supplies.map((it, idx) => (
                      <View key={it.id} style={styles.itemCard}>
                        <View style={styles.itemHead}>
                          <View style={styles.supCopy}>
                            <Text style={styles.supLabel}>{it.label}</Text>
                            {consumableRestockStandard(it.id, it.label) ? <Text style={styles.supStandard}>{`补充标准：${consumableRestockStandard(it.id, it.label)}`}</Text> : null}
                          </View>
                          {it.id === 'other' && !String(it.note || '').trim() ? (
                            <StatusPill label="可选" tone="neutral" />
                          ) : it.restock_status === 'restocked' ? (
                            <StatusPill label="已补充" tone="success" />
                          ) : it.restock_status === 'carry_forward' ? (
                            <StatusPill label="下次退房补" tone="info" />
                          ) : it.restock_status === 'unavailable' ? (
                            <StatusPill label="现场够用" tone="success" />
                          ) : (
                            <StatusPill label="待确认" tone="neutral" />
                          )}
                        </View>
                        {it.id === 'other' ? (
                          <AppTextInput
                            value={it.note}
                            onChangeText={(v) => setSupplyItem(idx, { note: v })}
                            style={[styles.supInput, styles.supNote]}
                            placeholder="添加其他补充项（可选）"
                            multiline
                          />
                        ) : null}
                        <View style={styles.supRow}>
                          <Pressable
                            testID={`self-restock-${it.id}-sufficient`}
                            onPress={() => setRestockResolution(idx, 'unavailable')}
                            style={({ pressed }) => [styles.supChip, it.restock_status === 'unavailable' ? styles.supChipActive : null, pressed ? styles.pressed : null]}
                          >
                            <Text style={[styles.supChipText, it.restock_status === 'unavailable' ? styles.supChipTextActive : null]}>现场够用</Text>
                          </Pressable>
                          <Pressable
                            testID={`self-restock-${it.id}-restocked`}
                            onPress={() => onMarkRestocked(idx)}
                            disabled={suppliesSubmitting}
                            style={({ pressed }) => [styles.supChip, it.restock_status === 'restocked' ? styles.supChipActive : null, pressed ? styles.pressed : null, suppliesSubmitting ? styles.disabled : null]}
                          >
                            <Text style={[styles.supChipText, it.restock_status === 'restocked' ? styles.supChipTextActive : null]}>已补充</Text>
                          </Pressable>
                          <Pressable
                            testID={`self-restock-${it.id}-carry-forward`}
                            onPress={() => setRestockResolution(idx, 'carry_forward')}
                            style={({ pressed }) => [styles.supChip, it.restock_status === 'carry_forward' ? styles.supChipActive : null, pressed ? styles.pressed : null]}
                          >
                            <Text style={[styles.supChipText, it.restock_status === 'carry_forward' ? styles.supChipTextActive : null]}>下次退房补</Text>
                          </Pressable>
                        </View>
                        {it.restock_status === 'restocked' || it.restock_status === 'carry_forward' ? (
                          <>
                            <View style={styles.supRow}>
                              <AppTextInput
                                value={it.qty}
                                onChangeText={(v) => setSupplyItem(idx, { qty: v.replace(/[^\d]/g, '').slice(0, 6) })}
                                style={[styles.supInput, styles.supQty]}
                                placeholder="补充数量（可选）"
                                keyboardType="number-pad"
                              />
                              {it.restock_status === 'restocked' ? (
                                <Pressable
                                  onPress={() => onTakeStockPhoto(idx)}
                                  disabled={suppliesSubmitting}
                                  style={({ pressed }) => [styles.secondaryBtnDark, styles.stockPhotoBtn, pressed ? styles.pressed : null, suppliesSubmitting ? styles.disabled : null]}
                                >
                                  <Text style={styles.secondaryBtnDarkText}>{it.photo_urls.length ? `继续拍凭证 (${it.photo_urls.length})` : '拍补货凭证'}</Text>
                                </Pressable>
                              ) : null}
                            </View>
                            {it.restock_status === 'carry_forward' ? <Text style={styles.carryForwardHint}>已记到下一次退房补，无需拍补货照片。</Text> : null}
                            {it.photo_urls.length ? (
                              <ResponsiveImageGrid
                                items={it.photo_urls}
                                fixedItemWidth={96}
                                keyExtractor={(photoUrl, photoIdx) => `${photoUrl}-${photoIdx}`}
                                renderItem={(photoUrl, photoIdx) => (
                                  <View style={styles.thumbWrap}>
                                    <Pressable onPress={() => openViewer(it.photo_urls, photoIdx)} style={({ pressed }) => [styles.thumbPress, pressed ? styles.pressed : null]}>
                                      <CleaningMediaImage
                                        token={token}
                                        localUri={String(photoUrl).startsWith('file://') ? photoUrl : null}
                                        remoteReference={photoUrl}
                                        style={styles.thumb}
                                      />
                                    </Pressable>
                                    <Pressable
                                      onPress={() => {
                                        removePhotoUri(photoUrl)
                                        setSupplyItem(idx, { photo_urls: it.photo_urls.filter((_, photoIndex) => photoIndex !== photoIdx) })
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
                      </View>
                    ))}

                    {supplies.length ? (
                      <AppButton
                        label="提交消耗品补充"
                        onPress={onSubmitSupplies}
                        disabled={suppliesSubmitting || !canSubmitSupplies}
                        loading={suppliesSubmitting}
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
                <Text style={styles.infoPanelText}>电视和空调遥控器同框拍 1 张；浴室下水口和吸尘器使用后照片也必拍。</Text>
                <Text style={styles.infoPanelText}>拍照后先保存到本机；点击“标记已完成”时才会逐张上传，并一次写入完成照片记录。</Text>
                {completionOk ? <Text style={styles.ok}>已满足</Text> : <Text style={styles.warn}>未满足</Text>}
              </View>
              {COMPLETION_AREAS.map(({ area, title, hint }) => {
                const list = completion[area] || []
                const singlePhotoArea = area === 'remote_tv'
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
                          testID={`completion-photo-${area}-capture`}
                          onPress={() => onAddCompletionPhoto(area)}
                          disabled={uploading || savingPhotos}
                          style={({ pressed }) => [styles.areaBtn, pressed ? styles.pressed : null, uploading || savingPhotos ? styles.disabled : null]}
                        >
                          <Text style={styles.areaBtnText}>{singlePhotoArea && list.length ? '重拍' : '拍照'}</Text>
                        </Pressable>
                      </View>
                    </View>
                    {list.length ? (
                      <ResponsiveImageGrid
                        items={list}
                        fixedItemWidth={96}
                        keyExtractor={(u, idx) => `${u}:${idx}`}
                        renderItem={(u, idx) => (
                          <View style={styles.thumbWrap}>
                            <Pressable testID={`completion-photo-${area}-${idx}`} onPress={() => openViewer(list, idx)} style={({ pressed }) => [styles.thumbPress, pressed ? styles.pressed : null]}>
                              <CleaningMediaImage
                                token={token}
                                localUri={String(u).startsWith('file://') ? u : null}
                                remoteReference={u}
                                style={styles.thumb}
                              />
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
                      <Text testID="self-complete-lockbox-sync-hint" style={lockboxSummaryTone === 'pending' ? styles.warnSmall : styles.mutedSmall}>{lockboxSyncStatus.hint}</Text>
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
                      label={lockboxBusinessSaved ? '重传视频' : lockboxItem ? '重拍视频' : '上传视频'}
                      onPress={onUploadLockboxVideo}
                      disabled={uploading || submitting}
                      loading={uploading}
                      tone="secondary"
                      style={[styles.grayBtn, uploading || submitting ? styles.disabled : null]}
                    />
                  ) : null}
                  {requiresLockboxVideo && lockboxItem && !lockboxBusinessSaved && (lockboxItem.last_error || lockboxItem.uploaded_url) ? (
                    <AppButton
                      label="重试同步"
                      onPress={onRetryLockboxSync}
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
          label="标记已完成"
          onPress={onSelfComplete}
          disabled={uploading || submitting}
          loading={submitting}
          fullWidth
          style={uploading || submitting ? styles.disabledPrimary : null}
        />
      </SafeAreaBottomBar>
      </KeyboardAvoidingView>

      <Modal visible={viewerOpen} transparent animationType="fade" onRequestClose={() => setViewerOpen(false)}>
        <View testID="self-complete-photo-viewer-mask" style={styles.viewerMask}>
          <View style={[styles.viewerTopRow, { paddingTop: Math.max(10, insets.top) }]} pointerEvents="box-none">
            <Text style={styles.viewerCloseText}>左右滑动查看</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="关闭照片预览"
              onPress={() => setViewerOpen(false)}
              style={({ pressed }) => [styles.viewerCloseBtn, pressed ? styles.pressed : null]}
            >
              <Text style={styles.viewerCloseButtonText}>关闭</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.viewerPager}
            contentOffset={{ x: viewerIndex * viewerPageWidth, y: 0 }}
          >
            {viewerItems.map((item, index) => (
              <View key={`${item.reference}:${index}`} style={[styles.viewerSlide, { width: viewerPageWidth }]}>
                <CleaningMediaPreview token={token} reference={item.reference} style={styles.viewerImg} />
                {item.watermarkText ? (
                  <View pointerEvents="none" style={styles.viewerWatermark}>
                    <Text style={styles.viewerWatermarkText}>{item.watermarkText}</Text>
                  </View>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={!!task && !skipRoomConfirmation && !roomConfirmed}
        transparent
        animationType="fade"
        onRequestClose={() => props.navigation.goBack()}
      >
        <View testID="self-complete-room-confirmation" style={styles.roomConfirmMask}>
          <View style={styles.roomConfirmCard}>
            <Text style={styles.roomConfirmTitle}>确认当前任务房号</Text>
            <Text style={styles.roomConfirmMessage}>请确认后再开始补充与完成，避免填错房源。</Text>
            <Text testID="self-complete-room-confirmation-code" style={styles.roomConfirmCode}>{propertyCode || task?.title || '房号未加载'}</Text>
            {propertyAddr ? <Text style={styles.roomConfirmAddress}>{propertyAddr}</Text> : null}
            {!propertyCode ? <Text style={styles.roomConfirmWarning}>房号尚未加载，请返回任务列表后重试。</Text> : null}
            <View style={styles.roomConfirmActions}>
              <AppButton label="返回任务" onPress={() => props.navigation.goBack()} tone="secondary" style={styles.roomConfirmButton} />
              <AppButton label="房号正确，继续" onPress={() => setRoomConfirmed(true)} disabled={!propertyCode} style={styles.roomConfirmButton} />
            </View>
          </View>
        </View>
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
  warnSmall: { marginTop: 6, color: '#B91C1C', fontWeight: '800', fontSize: 12, lineHeight: 18 },
  ok: { marginTop: 8, color: '#16A34A', fontWeight: '900' },
  warn: { marginTop: 8, color: '#DC2626', fontWeight: '900' },
  statusPill: { minHeight: 28, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: hairline(), alignItems: 'center', justifyContent: 'center' },
  statusPillText: { fontWeight: '900', fontSize: 12 },
  inlineErrorCard: { marginTop: 10, borderRadius: 14, backgroundColor: '#FFF7ED', borderWidth: hairline(), borderColor: '#FCD34D', padding: 12, gap: 8 },
  inlineErrorTitle: { color: '#9A3412', fontWeight: '900' },
  inlineErrorText: { color: '#B45309', fontWeight: '700', lineHeight: 18 },
  inlineRetryBtn: { alignSelf: 'flex-start', minHeight: layoutTokens.button.height, paddingHorizontal: layoutTokens.button.horizontalPadding, paddingVertical: 0, borderRadius: 10, backgroundColor: '#EA580C', alignItems: 'center', justifyContent: 'center' },
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
  primaryBtn: { flex: 1, flexShrink: 1, minWidth: 140, minHeight: layoutTokens.button.height, borderRadius: 14, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', paddingHorizontal: layoutTokens.button.horizontalPadding, paddingVertical: 0 },
  primaryText: { color: '#FFFFFF', fontWeight: '900', textAlign: 'center' },
  grayBtn: { flex: 1, flexShrink: 1, minWidth: 140, minHeight: layoutTokens.button.height, borderRadius: 14, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', borderWidth: hairline(), borderColor: '#E5E7EB', paddingHorizontal: layoutTokens.button.horizontalPadding, paddingVertical: 0 },
  grayText: { color: '#111827', fontWeight: '900', textAlign: 'center' },
  secondaryBtnDark: { minWidth: 120, minHeight: layoutTokens.button.height, paddingHorizontal: layoutTokens.button.horizontalPadding, paddingVertical: 0, borderRadius: 14, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
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
  areaBtn: { minHeight: layoutTokens.button.height, paddingHorizontal: layoutTokens.button.horizontalPadding, paddingVertical: 0, borderRadius: layoutTokens.button.radius, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  areaBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  thumbRow: { gap: 10, paddingVertical: 8 },
  thumbWrap: { width: 96, height: 96, borderRadius: 12, overflow: 'hidden', borderWidth: hairline(), borderColor: '#EEF0F6' },
  thumbPress: { width: '100%', height: '100%' },
  thumb: { width: '100%', height: '100%' },
  removeBtn: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  supCopy: { flex: 1, minWidth: 0 },
  supLabel: { color: '#111827', fontWeight: '900' },
  supStandard: { marginTop: 3, color: '#475569', fontSize: 12, fontWeight: '700', lineHeight: 17 },
  supRow: { marginTop: 8, flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  supChip: { flex: 1, minWidth: 120, minHeight: layoutTokens.button.height, paddingHorizontal: 10, paddingVertical: 0, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', borderWidth: hairline(), borderColor: '#E5E7EB' },
  supChipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  supChipText: { color: '#111827', fontWeight: '900' },
  supChipTextActive: { color: '#FFFFFF' },
  supInput: { minHeight: 44, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: hairline(), borderColor: '#E5E7EB', paddingHorizontal: 10, color: '#111827', fontWeight: '800' },
  supQty: { flex: 1 },
  supNote: { marginTop: 8, minHeight: 80, textAlignVertical: 'top', paddingTop: 10, paddingBottom: 10 },
  carryForwardHint: { marginTop: 8, color: '#1D4ED8', fontWeight: '800', lineHeight: 19 },
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
  viewerMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  viewerTopRow: { position: 'absolute', zIndex: 2, top: 0, left: 0, right: 0, minHeight: 54, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  viewerPager: { flex: 1 },
  viewerCloseBtn: { minHeight: layoutTokens.button.height, paddingHorizontal: layoutTokens.button.horizontalPadding, paddingVertical: 0, borderRadius: layoutTokens.button.radius, backgroundColor: 'rgba(15,23,42,0.8)', borderWidth: hairline(), borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
  viewerCloseText: { color: '#FFFFFF', fontWeight: '900' },
  viewerCloseButtonText: { color: '#FFFFFF', fontWeight: '900' },
  viewerSlide: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  viewerImg: { width: '100%', height: '100%' },
  viewerWatermark: { position: 'absolute', right: 16, bottom: 18, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.52)', paddingHorizontal: 9, paddingVertical: 6 },
  viewerWatermarkText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', lineHeight: 16, textAlign: 'right' },
  roomConfirmMask: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(15,23,42,0.56)' },
  roomConfirmCard: { borderRadius: 18, backgroundColor: '#FFFFFF', padding: 18, gap: 10 },
  roomConfirmTitle: { color: '#111827', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  roomConfirmMessage: { color: '#475467', fontWeight: '700', lineHeight: 20, textAlign: 'center' },
  roomConfirmCode: { color: '#1D4ED8', fontSize: 24, fontWeight: '900', textAlign: 'center' },
  roomConfirmAddress: { color: '#667085', fontWeight: '700', lineHeight: 18, textAlign: 'center' },
  roomConfirmWarning: { color: '#B45309', fontWeight: '800', lineHeight: 18, textAlign: 'center' },
  roomConfirmActions: { flexDirection: 'row', gap: layoutTokens.button.rowGap, marginTop: 4 },
  roomConfirmButton: { flex: 1, minWidth: 0 },
})
