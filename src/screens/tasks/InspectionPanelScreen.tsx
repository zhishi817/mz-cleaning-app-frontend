import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { useNetInfo } from '@react-native-community/netinfo'
import * as ImagePicker from 'expo-image-picker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../../lib/auth'
import {
  getInspectionPanelFeedbackDraft,
  type InspectionPanelFeedbackDraftState,
} from '../../lib/inspectionPanelFeedbackDraft'
import {
  clearInspectionPanelDraft,
  getInspectionPanelDraft,
  setInspectionPanelDraft,
} from '../../lib/inspectionPanelDraft'
import {
  bindInspectionPanelCleaningTaskId,
  createInspectionPanelLocalMedia,
  discardInspectionPanelBatch,
  findInspectionPanelValidationIssue,
  getInspectionPanelBatch,
  processInspectionPanelSubmitQueue,
  saveInspectionPanelDraftBatch,
  submitInspectionPanelBatch,
  subscribeInspectionPanelSubmitQueue,
  inspectionPanelFailedStepDetails,
  inspectionPanelLocalMediaSummary,
  validateInspectionPanelSnapshot,
  type InspectionPanelBatchMedia,
  type InspectionPanelBatchRestockItem,
  type InspectionPanelBatchStatus,
  type InspectionPanelRoomPhotoArea,
  type InspectionPanelRoomPhotoRequirement,
  type InspectionPanelSubmitQueueItem,
} from '../../lib/inspectionPanelSubmitQueue'
import { inspectionScopeLabel, isPasswordOnlyInspectionTask } from '../../lib/cleaningInspection'
import { compressImageForUpload } from '../../lib/imageCompression'
import { useI18n } from '../../lib/i18n'
import { hairline, moderateScale } from '../../lib/scale'
import { layoutTokens } from '../../lib/theme'
import { canSkipInspectionPhotosForGuestArrival, isEarlyCheckinTime } from '../../lib/taskTime'
import { getInspectionScopeTone, TASK_TONE_COLORS, type TaskTone } from '../../lib/taskVisualTheme'
import { checkinTimeForDisplay, cleaningExecutionTaskIdsFromTask, guestRequestForDisplay, isEarlyCheckinDisplay } from '../../lib/turnoverDisplay'
import { consumableRestockStandard } from '../../lib/consumableRestockStandards'
import { ensureSuppliesCatalogLoaded, retrySuppliesCatalog, useSuppliesCatalogStore } from '../../lib/useSuppliesCatalogStore'
import { getWorkTasksSnapshot, patchWorkTaskItem, subscribeWorkTasks } from '../../lib/workTasksStore'
import { appendInspectionIssuePhotos, getCleaningConsumables, getInspectionPhotos, uploadCleaningMedia } from '../../lib/api'
import { cleaningMediaReference } from '../../lib/cleaningMedia'
import { getJson, remove as removeStorage, setJson } from '../../lib/storage'
import type { TasksStackParamList } from '../../navigation/RootNavigator'
import GuestLuggageCard from '../../components/GuestLuggageCard'
import CleaningMediaImage from '../../components/CleaningMediaImage'
import CleaningMediaPreview from '../../components/CleaningMediaPreview'
import AppButton from '../../components/ui/AppButton'
import AppTextInput from '../../components/ui/AppTextInput'
import ResponsiveImageGrid from '../../components/ui/ResponsiveImageGrid'
import SafeAreaBottomBar from '../../components/ui/SafeAreaBottomBar'

type Props = NativeStackScreenProps<TasksStackParamList, 'InspectionPanel'>

type RestockState = InspectionPanelBatchRestockItem
type RoomPhotoMap = Record<InspectionPanelRoomPhotoArea, InspectionPanelBatchMedia[]>
type ViewerTarget = {
  localUri?: string | null
  thumbnailUri?: string | null
  remoteReference?: string | null
}

type PostSubmitIssueDraft = {
  submit_id: string
  items: InspectionPanelBatchMedia[]
  last_error?: string | null
}

const ROOM_AREAS: { key: InspectionPanelRoomPhotoArea; label: string; hint: string; max: number }[] = [
  { key: 'living', label: '客厅', hint: '建议拍客厅整体', max: 3 },
  { key: 'sofa', label: '沙发', hint: '建议拍沙发表面', max: 2 },
  { key: 'bedroom', label: '卧室', hint: '重点拍地毯情况', max: 8 },
  { key: 'kitchen', label: '厨房', hint: '建议拍整体', max: 2 },
  { key: 'bathroom', label: '浴室', hint: '需要拍浴室整体', max: 3 },
]

function baseRoomPhotos(): RoomPhotoMap {
  return { living: [], sofa: [], bedroom: [], kitchen: [], bathroom: [] }
}

function buildRemoteInspectionPhotoState(items: any[]) {
  const roomPhotos = baseRoomPhotos()
  const cleaningIssue: InspectionPanelBatchMedia[] = []
  for (const [index, item] of (Array.isArray(items) ? items : []).entries()) {
    const url = cleanText(item?.url)
    const area = cleanText(item?.area).toLowerCase()
    if (!url || (!Object.prototype.hasOwnProperty.call(roomPhotos, area) && area !== 'unclean')) continue
    const media: InspectionPanelBatchMedia = {
      id: `remote-inspection-${area}-${index}`,
      local_uri: null,
      thumbnail_uri: null,
      uploaded_key: null,
      uploaded_url: url,
      name: `已同步${area}检查照片`,
      mime_type: 'image/jpeg',
      captured_at: cleanText(item?.captured_at) || cleanText(item?.created_at) || '1970-01-01T00:00:00.000Z',
      note: cleanText(item?.note) || null,
    }
    if (area === 'unclean') cleaningIssue.push(media)
    else (roomPhotos as any)[area].push(media)
  }
  return {
    roomPhotos,
    cleaningIssue,
    total: Object.values(roomPhotos).reduce((sum, values) => sum + values.length, 0) + cleaningIssue.length,
  }
}

function cleanText(value: any) {
  return String(value || '').trim()
}

function postSubmitIssueDraftKey(taskId: string) {
  return `mzstay.inspection_post_submit_issue_draft.v1:${cleanText(taskId)}`
}

function makePostSubmitIssueId(taskId: string) {
  const entropy = Math.random().toString(36).slice(2, 10)
  return `inspection-issue-${cleanText(taskId).slice(0, 36) || 'task'}-${Date.now().toString(36)}-${entropy}`
}

function formatLocalTime(value = new Date()) {
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
}

function mediaRemoteReference(media: InspectionPanelBatchMedia) {
  return cleanText(media.uploaded_key || media.uploaded_url)
}

function mediaViewerTarget(media: InspectionPanelBatchMedia): ViewerTarget {
  return {
    localUri: cleanText(media.local_uri) || null,
    thumbnailUri: cleanText(media.thumbnail_uri) || null,
    remoteReference: mediaRemoteReference(media) || null,
  }
}

function cloneRestockItem(item: RestockState): RestockState {
  return {
    ...item,
    proof_media: [...(item.proof_media || [])],
  }
}

function cloneRoomPhotos(roomPhotos: RoomPhotoMap): RoomPhotoMap {
  return {
    living: [...(roomPhotos.living || [])],
    sofa: [...(roomPhotos.sofa || [])],
    bedroom: [...(roomPhotos.bedroom || [])],
    kitchen: [...(roomPhotos.kitchen || [])],
    bathroom: [...(roomPhotos.bathroom || [])],
  }
}

function noticeToneStylePair(tone: TaskTone) {
  const palette = TASK_TONE_COLORS[tone]
  return {
    card: { backgroundColor: palette.bg, borderColor: palette.border },
    text: { color: palette.text },
    icon: palette.dot,
  }
}

function sectionTitle(icon: any, title: string) {
  return (
    <View style={styles.sectionTitleRow}>
      <Ionicons name={icon} size={moderateScale(16)} color="#111827" />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  )
}

function batchStatusLabel(status: InspectionPanelBatchStatus | null) {
  if (status === 'draft') return '草稿未提交'
  if (status === 'pending_submit') return '待同步'
  if (status === 'syncing') return '同步中'
  if (status === 'partial_failed') return '部分失败'
  if (status === 'failed') return '同步失败'
  if (status === 'synced') return '已同步'
  return '未开始'
}

function batchStatusHint(status: InspectionPanelBatchStatus | null, lastError?: string | null) {
  const error = cleanText(lastError)
  if (status === 'pending_submit') return error || '本页已保存到本机，正在等待同步。'
  if (status === 'syncing') return '当前正在上传图片并提交业务记录。'
  if (status === 'partial_failed') return `${error ? `最近错误：${error}。` : ''}已有部分步骤成功；重试会从失败步骤继续，不会重复上传已成功内容。`
  if (status === 'failed') return `${error ? `最近错误：${error}。` : ''}同步失败；重试会从失败步骤继续。若要改内容，需要先放弃当前失败批次并重建草稿。`
  if (status === 'synced') return '本次检查与补充已全部同步完成，可回看摘要。'
  return '拍照和填写阶段只保存在本机，点击提交后会保存为待同步批次。'
}

function shouldRefreshBatchPresentation(
  current: InspectionPanelSubmitQueueItem | null,
  next: InspectionPanelSubmitQueueItem | null,
) {
  if (!current || !next) return current !== next
  return current.status !== next.status || cleanText(current.last_error) !== cleanText(next.last_error)
}

function feedbackSummary(draft: InspectionPanelFeedbackDraftState | null) {
  if (!draft) return '未暂存房源问题反馈'
  const maintenance = draft.maintenanceDrafts?.length || 0
  const deep = draft.deepCleaningDrafts?.length || 0
  const daily = draft.dailyDrafts?.length || 0
  const total = maintenance + deep + daily
  if (!total) return '未暂存房源问题反馈'
  return `已暂存 ${total} 条反馈（维修 ${maintenance} / 深清 ${deep} / 日用品 ${daily}）`
}

function buildInitialRestock(task: any) {
  const list = Array.isArray(task?.restock_items) ? task.restock_items : []
  return list
    .map((x: any) => {
      const itemId = cleanText(x?.item_id)
      if (!itemId) return null
      const qty0 = x?.qty == null ? null : Number(x.qty)
      return {
        item_id: itemId,
        label: cleanText(x?.label) || itemId,
        qty: Number.isFinite(qty0) ? qty0 : null,
        status: null,
        source_photo_url: cleanText(x?.photo_url) || null,
        proof_media: [],
        note: '',
        origin: 'task' as const,
      }
    })
    .filter(Boolean) as RestockState[]
}

function sourceIdsForConsumables(task: any, fallbackId: string) {
  return Array.from(new Set([
    ...cleaningExecutionTaskIdsFromTask(task),
    fallbackId,
  ].map((value) => cleanText(value)).filter(Boolean)))
}

function buildRestockFromConsumables(responses: any[]) {
  const out: RestockState[] = []
  const seen = new Set<string>()
  for (const response of responses) {
    const items = Array.isArray(response?.items) ? response.items : []
    for (const item of items) {
      const itemId = cleanText(item?.item_id)
      if (!itemId || seen.has(itemId)) continue
      const status = cleanText(item?.status).toLowerCase()
      if (!item?.need_restock && status !== 'low') continue
      seen.add(itemId)
      const photoUrls = Array.isArray(item?.photo_urls) ? item.photo_urls.map(cleanText).filter(Boolean) : []
      const qty0 = item?.qty == null ? null : Number(item.qty)
      out.push({
        item_id: itemId,
        label: cleanText(item?.item_label) || itemId,
        qty: Number.isFinite(qty0) ? qty0 : null,
        status: null,
        source_photo_url: cleanText(item?.photo_url) || photoUrls[0] || null,
        proof_media: [],
        note: cleanText(item?.note),
        origin: 'task',
      })
    }
  }
  return out
}

function mergeRestockItems(base: RestockState[], incoming: RestockState[]) {
  const out = base.map(cloneRestockItem)
  const byId = new Map(out.map((item, index) => [item.item_id, index]))
  for (const item of incoming) {
    const idx = byId.get(item.item_id)
    if (idx == null) {
      byId.set(item.item_id, out.length)
      out.push(cloneRestockItem(item))
      continue
    }
    const current = out[idx]
    out[idx] = {
      ...current,
      label: current.label || item.label,
      qty: current.qty == null ? item.qty : current.qty,
      source_photo_url: current.source_photo_url || item.source_photo_url,
      note: current.note || item.note,
    }
  }
  return out
}

function buildSnapshot(params: {
  taskId: string
  cleaningTaskId: string
  propertyId?: string | null
  propertyCode?: string | null
  restock: RestockState[]
  restockConfirmedSufficient: boolean
  roomPhotoRequirement: InspectionPanelRoomPhotoRequirement
  roomPhotos: RoomPhotoMap
  cleaningIssue: InspectionPanelBatchMedia[]
  feedback: InspectionPanelFeedbackDraftState | null
}) {
  return {
    task_id: params.taskId,
    cleaning_task_id: params.cleaningTaskId,
    property_id: cleanText(params.propertyId) || null,
    property_code: cleanText(params.propertyCode) || null,
    room_photo_requirement: params.roomPhotoRequirement,
    restock_confirmed_sufficient: params.restockConfirmedSufficient,
    restock: params.restock.map(cloneRestockItem),
    room_photos: cloneRoomPhotos(params.roomPhotos),
    cleaning_issue: [...params.cleaningIssue],
    feedback: params.feedback,
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

export default function InspectionPanelScreen(props: Props) {
  const { t } = useI18n()
  const { token } = useAuth()
  const netInfo = useNetInfo()
  const insets = useSafeAreaInsets()
  const suppliesCatalog = useSuppliesCatalogStore()
  const [, bumpTasksVersion] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [savingRoomPhotos, setSavingRoomPhotos] = useState(false)
  const [roomPhotosSavedAt, setRoomPhotosSavedAt] = useState<string | null>(null)
  const [viewerTarget, setViewerTarget] = useState<ViewerTarget | null>(null)
  const [restockPickerOpen, setRestockPickerOpen] = useState(false)
  const [restockPickerMode, setRestockPickerMode] = useState<'other' | 'next'>('other')
  const [restockPickerQuery, setRestockPickerQuery] = useState('')
  const [restockPickerSelectedIds, setRestockPickerSelectedIds] = useState<string[]>([])
  const [restock, setRestock] = useState<RestockState[]>([])
  const [restockLoading, setRestockLoading] = useState(true)
  const [restockLoadError, setRestockLoadError] = useState(false)
  const [restockConfirmedSufficient, setRestockConfirmedSufficient] = useState(false)
  const [guestArrivalPhotoSkipConfirmed, setGuestArrivalPhotoSkipConfirmed] = useState(false)
  const [roomPhotos, setRoomPhotos] = useState<RoomPhotoMap>(baseRoomPhotos())
  const roomPhotosRef = useRef<RoomPhotoMap>(baseRoomPhotos())
  const [cleaningIssue, setCleaningIssue] = useState<InspectionPanelBatchMedia[]>([])
  const [feedbackDraft, setFeedbackDraft] = useState<InspectionPanelFeedbackDraftState | null>(null)
  const [batchItem, setBatchItem] = useState<InspectionPanelSubmitQueueItem | null>(null)
  const [roomConfirmed, setRoomConfirmed] = useState(false)
  const [postSubmitIssueDraft, setPostSubmitIssueDraft] = useState<PostSubmitIssueDraft | null>(null)
  const [postSubmitIssueSubmitting, setPostSubmitIssueSubmitting] = useState(false)
  const [guestNeedDone, setGuestNeedDone] = useState(false)
  const [showValidationIssue, setShowValidationIssue] = useState(false)
  const draftHydratedRef = useRef(false)
  const draftPersistChainRef = useRef<Promise<void>>(Promise.resolve())
  const localStateLoadVersionRef = useRef(0)
  const scrollRef = useRef<ScrollView | null>(null)
  const sectionOffsetsRef = useRef<Record<'restock' | 'photos', number>>({ restock: 0, photos: 0 })
  const [expanded, setExpanded] = useState({
    restock: true,
    cleaningIssue: true,
    propertyIssue: true,
    photos: true,
  })

  const commitRoomPhotos = useCallback((nextRoomPhotos: RoomPhotoMap) => {
    const next = cloneRoomPhotos(nextRoomPhotos)
    roomPhotosRef.current = next
    setRoomPhotos(next)
    return next
  }, [])

  useEffect(() => {
    draftHydratedRef.current = false
    draftPersistChainRef.current = Promise.resolve()
    localStateLoadVersionRef.current += 1
  }, [props.route.params.taskId])

  useEffect(() => {
    let cancelled = false
    setPostSubmitIssueDraft(null)
    const taskId = cleanText(props.route.params.taskId)
    if (!taskId) return
    void getJson<PostSubmitIssueDraft>(postSubmitIssueDraftKey(taskId)).then((saved) => {
      if (cancelled || !saved) return
      const submitId = cleanText(saved.submit_id)
      const items = Array.isArray(saved.items)
        ? saved.items.filter((item) => cleanText(item?.id) && (cleanText(item?.local_uri) || mediaRemoteReference(item as InspectionPanelBatchMedia)))
        : []
      if (!submitId || !items.length) return
      setPostSubmitIssueDraft({ submit_id: submitId, items, last_error: cleanText(saved.last_error) || null })
    }).catch(() => null)
    return () => {
      cancelled = true
    }
  }, [props.route.params.taskId])

  useEffect(() => {
    const unsubscribe = subscribeWorkTasks(() => bumpTasksVersion((value) => value + 1))
    return () => {
      unsubscribe()
    }
  }, [])

  const task = getWorkTasksSnapshot().items.find((x) => x.id === props.route.params.taskId) || null
  const cleaningTaskId = cleanText(props.route.params.sourceId) || cleanText(task?.source_id)
  const readOnly = props.route.params.readOnly === true
  const completedInspectionView = ['done', 'completed', 'ready', 'keys_hung'].includes(cleanText(task?.status).toLowerCase())
  const skipRoomConfirmation = readOnly || completedInspectionView
  useEffect(() => {
    setRoomConfirmed(skipRoomConfirmation)
  }, [props.route.params.taskId, skipRoomConfirmation])
  const propertyId = cleanText(task?.property_id || task?.property?.id)
  const propertyCode = cleanText(task?.property?.code)
  const propertyAddr = cleanText(task?.property?.address)
  const checkinTime = cleanText(checkinTimeForDisplay(task))
  const guestSpecialRequest = guestRequestForDisplay(task)
  const consumableSourceIdsKey = useMemo(() => sourceIdsForConsumables(task, cleaningTaskId).join('|'), [cleaningTaskId, task])
  const guestArrivalPhotoSkipEligible = canSkipInspectionPhotosForGuestArrival(checkinTime)
  const isEarlyCheckinGuest = isEarlyCheckinDisplay(task) || isEarlyCheckinTime(checkinTime)
  const isPasswordOnlyInspection = isPasswordOnlyInspectionTask(task as any)
  const inspectionSubmitAction = (Array.isArray((task as any)?.available_actions) ? (task as any).available_actions : [])
    .find((action: any) => String(action?.id || '') === 'submit_inspection')
  const cleaningSubmissionBlocked = !isPasswordOnlyInspection
    && String(inspectionSubmitAction?.disabled_reason || '') === 'cleaning_submission_required'
  const roomPhotoRequirement: InspectionPanelRoomPhotoRequirement = isPasswordOnlyInspection
    ? 'password_only'
    : guestArrivalPhotoSkipEligible && guestArrivalPhotoSkipConfirmed
      ? 'guest_arrival_confirmed'
      : 'required'
  const inspectionScopeNoticeStyles = noticeToneStylePair(getInspectionScopeTone(isPasswordOnlyInspection))
  const batchStatus = batchItem?.status || 'draft'
  const hasFormalSubmission = batchStatus !== 'draft'
  const isFrozen = readOnly || batchStatus !== 'draft'
  const canAppendPostSubmitCleaningIssue = !readOnly && batchStatus === 'synced' && !!cleaningTaskId
  const isOnline = netInfo.isConnected !== false && netInfo.isInternetReachable !== false
  const batchValidationError = hasFormalSubmission && batchItem ? validateInspectionPanelSnapshot(batchItem.snapshot) : null
  const canRetryFailedBatch = batchStatus === 'failed' || batchStatus === 'partial_failed'
  const canDiscardFrozenBatch = canRetryFailedBatch || !!batchValidationError
  const scrollBottomPadding = canDiscardFrozenBatch ? 140 + Math.max(insets.bottom, 16) : 32 + Math.max(insets.bottom, 16)
  const initialRestockItems = useMemo(() => buildInitialRestock(task), [task])
  const draftValidationIssue = useMemo(
    () => (
      showValidationIssue && task
        ? findInspectionPanelValidationIssue(buildSnapshot({
            taskId: task.id,
            cleaningTaskId,
            propertyId,
            propertyCode,
            restock,
            restockConfirmedSufficient,
            roomPhotoRequirement,
            roomPhotos,
            cleaningIssue,
            feedback: feedbackDraft,
          }))
        : null
    ),
    [cleaningIssue, cleaningTaskId, feedbackDraft, propertyCode, propertyId, restock, restockConfirmedSufficient, roomPhotoRequirement, roomPhotos, showValidationIssue, task],
  )

  const restockPickerItems = useMemo(() => {
    const q = restockPickerQuery.trim().toLowerCase()
    const base = suppliesCatalog.items.filter((item) => String(item.kind || '').trim() === 'consumable')
    if (!q) return base
    return base.filter((item) => cleanText(item.label).toLowerCase().includes(q) || cleanText(item.id).toLowerCase().includes(q))
  }, [restockPickerQuery, suppliesCatalog.items])

  const loadLocalState = useCallback(async (options?: { showSpinner?: boolean; forceDraftReload?: boolean }) => {
    if (!task) return
    const loadVersion = ++localStateLoadVersionRef.current
    const showSpinner = options?.showSpinner !== false
    const forceDraftReload = options?.forceDraftReload === true
    if (showSpinner) setLoading(true)
    setRestockLoading(true)
    setRestockLoadError(false)
    try {
      if (cleaningTaskId) {
        await bindInspectionPanelCleaningTaskId({
          task_id: task.id,
          cleaning_task_id: cleaningTaskId,
          property_id: propertyId,
          property_code: propertyCode,
        })
      }
      const consumableSourceIds = consumableSourceIdsKey ? consumableSourceIdsKey.split('|').filter(Boolean) : []
      const [batch, draft, feedback, consumableResults, remoteInspectionPhotos] = await Promise.all([
        getInspectionPanelBatch(task.id),
        getInspectionPanelDraft(task.id),
        getInspectionPanelFeedbackDraft(task.id),
        token && consumableSourceIds.length
          ? Promise.allSettled(consumableSourceIds.map((id) => getCleaningConsumables(token, id)))
          : Promise.resolve([]),
        readOnly && token && cleaningTaskId
          ? getInspectionPhotos(token, cleaningTaskId).then((result) => result?.items || []).catch(() => [])
          : Promise.resolve([]),
      ])
      if (localStateLoadVersionRef.current !== loadVersion) return
      const consumablesResponses = consumableResults.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])
      const consumableLoadFailed = consumableSourceIds.length > 0 && (!token || consumableResults.some((result) => result.status === 'rejected'))
      const remoteRestockItems = buildRestockFromConsumables(consumablesResponses)
      const remotePhotoState = readOnly ? buildRemoteInspectionPhotoState(remoteInspectionPhotos) : null
      const sourceSnapshot = batch && batch.status !== 'draft' ? batch.snapshot : null
      setBatchItem(batch)
      setFeedbackDraft(sourceSnapshot?.feedback || feedback || null)
      if (sourceSnapshot) {
        setRestockLoadError(false)
        setRestock(sourceSnapshot.restock.map(cloneRestockItem))
        setRestockConfirmedSufficient(!!sourceSnapshot.restock_confirmed_sufficient)
        setGuestArrivalPhotoSkipConfirmed(sourceSnapshot.room_photo_requirement === 'guest_arrival_confirmed')
        commitRoomPhotos(remotePhotoState?.total ? remotePhotoState.roomPhotos : cloneRoomPhotos(sourceSnapshot.room_photos || baseRoomPhotos()))
        setCleaningIssue(remotePhotoState?.total ? remotePhotoState.cleaningIssue : [...(sourceSnapshot.cleaning_issue || [])])
        draftHydratedRef.current = true
        return
      }
      setRestockLoadError(consumableLoadFailed)
      if (draftHydratedRef.current && !forceDraftReload) {
        if (feedback) setFeedbackDraft(feedback)
        if (remotePhotoState?.total) {
          commitRoomPhotos(remotePhotoState.roomPhotos)
          setCleaningIssue(remotePhotoState.cleaningIssue)
        }
        const incoming = mergeRestockItems(initialRestockItems.map(cloneRestockItem), remoteRestockItems)
        if (incoming.length) {
          setRestock((prev) => mergeRestockItems(prev, incoming))
          if (remoteRestockItems.length) setRestockConfirmedSufficient(false)
        }
        return
      }
      setRestock(
        mergeRestockItems(
          draft?.restock?.length
            ? draft.restock.map(cloneRestockItem)
            : initialRestockItems.map(cloneRestockItem),
          remoteRestockItems,
        ),
      )
      setRestockConfirmedSufficient(!!draft?.restock_confirmed_sufficient && !remoteRestockItems.length)
      setGuestArrivalPhotoSkipConfirmed(draft?.room_photo_requirement === 'guest_arrival_confirmed')
      commitRoomPhotos(remotePhotoState?.total ? remotePhotoState.roomPhotos : cloneRoomPhotos(draft?.room_photos || baseRoomPhotos()))
      setCleaningIssue(remotePhotoState?.total ? remotePhotoState.cleaningIssue : [...(draft?.cleaning_issue || [])])
      draftHydratedRef.current = true
    } finally {
      if (localStateLoadVersionRef.current === loadVersion) {
        setRestockLoading(false)
        if (showSpinner) setLoading(false)
      }
    }
  }, [cleaningTaskId, commitRoomPhotos, consumableSourceIdsKey, initialRestockItems, propertyCode, propertyId, readOnly, task, token])

  const loadLocalStateRef = useRef(loadLocalState)
  useEffect(() => {
    loadLocalStateRef.current = loadLocalState
  }, [loadLocalState])

  useEffect(() => {
    if (!task?.id) return
    void loadLocalStateRef.current({ showSpinner: true })
  }, [cleaningTaskId, consumableSourceIdsKey, propertyCode, propertyId, readOnly, task?.id, token])

  useEffect(() => {
    const taskId = task?.id
    if (!taskId) return
    const unsubscribe = subscribeInspectionPanelSubmitQueue(() => {
      void getInspectionPanelBatch(taskId)
        .then((batch) => {
          setBatchItem((current) => shouldRefreshBatchPresentation(current, batch) ? batch : current)
        })
        .catch(() => null)
    })
    return unsubscribe
  }, [task?.id])

  useEffect(() => {
    if (!restockPickerOpen || !token) return
    void ensureSuppliesCatalogLoaded(token).catch(() => null)
  }, [restockPickerOpen, token])

  useEffect(() => {
    const nav: any = props.navigation as any
    if (!nav || typeof nav.addListener !== 'function') return
    const unsub = nav.addListener('focus', () => {
      void getInspectionPanelFeedbackDraft(props.route.params.taskId).then((draft) => {
        setFeedbackDraft(draft)
      })
    })
    return unsub
  }, [props.navigation, props.route.params.taskId])

  const persistDraft = useCallback(async (
    nextRestock = restock,
    nextRestockConfirmedSufficient = restockConfirmedSufficient,
    nextRoomPhotos = roomPhotos,
    nextCleaningIssue = cleaningIssue,
    nextFeedbackDraft = feedbackDraft,
  ) => {
    if (!task || isFrozen) return
    const snapshot = buildSnapshot({
      taskId: task.id,
      cleaningTaskId,
      propertyId,
      propertyCode,
      restock: nextRestock,
      restockConfirmedSufficient: nextRestockConfirmedSufficient,
      roomPhotoRequirement,
      roomPhotos: nextRoomPhotos,
      cleaningIssue: nextCleaningIssue,
      feedback: nextFeedbackDraft,
    })
    draftHydratedRef.current = true
    draftPersistChainRef.current = draftPersistChainRef.current
      .catch(() => undefined)
      .then(async () => {
        await setInspectionPanelDraft(task.id, snapshot)
      })
    await draftPersistChainRef.current
  }, [cleaningIssue, cleaningTaskId, feedbackDraft, isFrozen, propertyCode, propertyId, restock, restockConfirmedSufficient, roomPhotoRequirement, roomPhotos, task])

  useEffect(() => {
    if (!loading) {
      void persistDraft()
    }
  }, [cleaningIssue, feedbackDraft, guestArrivalPhotoSkipConfirmed, loading, persistDraft, restock, restockConfirmedSufficient, roomPhotos])

  async function createMediaFromAsset(asset: any, prefix: string, note?: string) {
    const uri = cleanText(asset?.uri)
    if (!uri) return null
    const preparedUri = await compressImageForUpload(uri)
    const convertedToJpeg = preparedUri && preparedUri !== uri
    const capturedAt = new Date().toISOString()
    const username = cleanText((task as any)?.assignee_name || '')
    const watermarkTime = capturedAt.replace('T', ' ').slice(0, 16)
    return createInspectionPanelLocalMedia({
      sourceUri: preparedUri || uri,
      name: convertedToJpeg ? `${prefix}-${Date.now()}.jpg` : cleanText(asset?.fileName) || cleanText(uri.split('/').pop()) || `${prefix}-${Date.now()}`,
      mimeType: convertedToJpeg ? 'image/jpeg' : cleanText(asset?.mimeType),
      prefix,
      capturedAt,
      note,
      watermarkText: `${propertyCode || '未知房号'}  ${username || '未知用户'}\n${watermarkTime}`,
    })
  }

  async function onAddRoomPhoto(area: InspectionPanelRoomPhotoArea) {
    if (isFrozen) return
    const limit = ROOM_AREAS.find((item) => item.key === area)?.max || 1
    const currentRoomPhotos = roomPhotosRef.current
    if ((currentRoomPhotos[area] || []).length >= limit) return
    const ok = await ensureCameraPerm()
    if (!ok) return Alert.alert(t('common_error'), '需要相机权限')
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.75, allowsEditing: false })
    if (res.canceled || !res.assets?.length) return
    let media: InspectionPanelBatchMedia | null = null
    try {
      media = await createMediaFromAsset(res.assets[0], `inspection-${area}`)
    } catch (error: any) {
      Alert.alert(t('common_error'), String(error?.message || '照片格式转换失败，请重新拍摄'))
      return
    }
    if (!media) return
    const nextRoomPhotos = cloneRoomPhotos(currentRoomPhotos)
    nextRoomPhotos[area] = [...(currentRoomPhotos[area] || []), media]
    const committedRoomPhotos = commitRoomPhotos(nextRoomPhotos)
    setRoomPhotosSavedAt(null)
    try {
      await persistDraft(restock, restockConfirmedSufficient, committedRoomPhotos)
      setRoomPhotosSavedAt(formatLocalTime())
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '照片自动保存失败，请点击“保存照片”重试'))
    }
  }

  function onRemoveRoomPhoto(area: InspectionPanelRoomPhotoArea, idx: number) {
    if (isFrozen) return
    setRoomPhotosSavedAt(null)
    const nextRoomPhotos = cloneRoomPhotos(roomPhotosRef.current)
    nextRoomPhotos[area] = nextRoomPhotos[area].filter((_, index) => index !== idx)
    commitRoomPhotos(nextRoomPhotos)
  }

  async function onSaveRoomPhotos() {
    if (isFrozen || savingRoomPhotos) return
    const photoCount = Object.values(roomPhotos).reduce((total, items) => total + items.length, 0)
    if (!photoCount) return Alert.alert(t('common_error'), '请先拍摄房间检查照片')
    setSavingRoomPhotos(true)
    try {
      await persistDraft(restock, restockConfirmedSufficient, roomPhotos)
      setRoomPhotosSavedAt(formatLocalTime())
      Alert.alert(t('common_ok'), '照片已保存到本机草稿。尚未上传，提交本页后会自动同步。')
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '照片保存失败，请重试'))
    } finally {
      setSavingRoomPhotos(false)
    }
  }

  async function onAddCleaningIssuePhoto(source: 'camera' | 'library') {
    if (isFrozen) return
    if (cleaningIssue.length >= 12) return
    const permitted = source === 'camera' ? await ensureCameraPerm() : await ensureLibraryPerm()
    if (!permitted) return Alert.alert(t('common_error'), source === 'camera' ? '需要相机权限' : '需要相册权限')
    const res =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.75, allowsEditing: false })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.75, allowsMultipleSelection: true, selectionLimit: 12 - cleaningIssue.length, orderedSelection: true })
    if (res.canceled || !res.assets?.length) return
    const created: InspectionPanelBatchMedia[] = []
    for (const asset of (res.assets as any[]).slice(0, 12 - cleaningIssue.length)) {
      try {
        const media = await createMediaFromAsset(asset, 'unclean', '')
        if (media) created.push(media)
      } catch (error: any) {
        Alert.alert(t('common_error'), String(error?.message || '照片格式转换失败，请重新拍摄'))
        return
      }
    }
    if (!created.length) return
    setCleaningIssue((prev) => [...prev, ...created].slice(0, 12))
  }

  async function persistPostSubmitIssueDraft(next: PostSubmitIssueDraft | null) {
    const taskId = cleanText(props.route.params.taskId)
    if (!taskId) return
    if (!next?.items.length) {
      await removeStorage(postSubmitIssueDraftKey(taskId))
      return
    }
    await setJson(postSubmitIssueDraftKey(taskId), next)
  }

  async function onAddPostSubmitCleaningIssueFromLibrary() {
    if (!canAppendPostSubmitCleaningIssue) return
    const remaining = Math.max(0, 12 - cleaningIssue.length - (postSubmitIssueDraft?.items.length || 0))
    if (!remaining) {
      Alert.alert(t('common_error'), '清洁问题照片最多 12 张')
      return
    }
    const permitted = await ensureLibraryPerm()
    if (!permitted) return Alert.alert(t('common_error'), '需要相册权限')
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.75,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      orderedSelection: true,
    })
    if (res.canceled || !res.assets?.length) return
    const created: InspectionPanelBatchMedia[] = []
    for (const asset of (res.assets as any[]).slice(0, remaining)) {
      try {
        const media = await createMediaFromAsset(asset, 'inspection-issue', '')
        if (media) created.push(media)
      } catch (error: any) {
        Alert.alert(t('common_error'), String(error?.message || '照片格式转换失败，请重新选择'))
        return
      }
    }
    if (!created.length) return
    const next: PostSubmitIssueDraft = {
      submit_id: postSubmitIssueDraft?.submit_id || makePostSubmitIssueId(props.route.params.taskId),
      items: [...(postSubmitIssueDraft?.items || []), ...created],
      last_error: null,
    }
    setPostSubmitIssueDraft(next)
    try {
      await persistPostSubmitIssueDraft(next)
    } catch (error: any) {
      Alert.alert(t('common_error'), String(error?.message || '问题照片保存到本机失败'))
    }
  }

  function updatePostSubmitCleaningIssueNote(idx: number, value: string) {
    if (!postSubmitIssueDraft) return
    const next = {
      ...postSubmitIssueDraft,
      items: postSubmitIssueDraft.items.map((item, index) => (index === idx ? { ...item, note: value.slice(0, 300) } : item)),
    }
    setPostSubmitIssueDraft(next)
    void persistPostSubmitIssueDraft(next).catch(() => null)
  }

  function removePostSubmitCleaningIssue(idx: number) {
    if (!postSubmitIssueDraft) return
    const items = postSubmitIssueDraft.items.filter((_, index) => index !== idx)
    const next = items.length ? { ...postSubmitIssueDraft, items, last_error: null } : null
    setPostSubmitIssueDraft(next)
    void persistPostSubmitIssueDraft(next).catch(() => null)
  }

  async function onSubmitPostSubmitCleaningIssue() {
    if (!canAppendPostSubmitCleaningIssue || !token || !postSubmitIssueDraft?.items.length) return
    setPostSubmitIssueSubmitting(true)
    let next = postSubmitIssueDraft
    try {
      const uploadedItems: InspectionPanelBatchMedia[] = []
      for (const item of next.items) {
        let uploaded = item
        let remoteReference = mediaRemoteReference(uploaded)
        if (!remoteReference) {
          const localUri = cleanText(uploaded.local_uri)
          if (!localUri) throw new Error('缺少可提交的问题照片')
          const upload = await uploadCleaningMedia(
            token,
            {
              uri: localUri,
              name: cleanText(uploaded.name) || `inspection-issue-${Date.now()}.jpg`,
              mimeType: cleanText(uploaded.mime_type) || 'image/jpeg',
            },
            {
              watermark: '1',
              purpose: 'inspection_issue',
              property_code: propertyCode || undefined,
              captured_at: cleanText(uploaded.captured_at) || undefined,
              watermark_text: `${propertyCode || '未知房号'}\n${cleanText(uploaded.captured_at).replace('T', ' ').slice(0, 16)}`,
            },
          )
          remoteReference = cleaningMediaReference(upload)
          if (!remoteReference) throw new Error('问题照片上传后缺少媒体引用')
          uploaded = {
            ...uploaded,
            uploaded_key: remoteReference.startsWith('cleaning/') ? remoteReference : null,
            uploaded_url: remoteReference.startsWith('cleaning/') ? null : remoteReference,
          }
          next = { ...next, items: next.items.map((entry) => entry.id === uploaded.id ? uploaded : entry), last_error: null }
          setPostSubmitIssueDraft(next)
          await persistPostSubmitIssueDraft(next)
        }
        uploadedItems.push(uploaded)
      }
      await appendInspectionIssuePhotos(token, cleaningTaskId, {
        items: uploadedItems.map((item) => ({
          url: mediaRemoteReference(item),
          note: cleanText(item.note) || null,
          captured_at: cleanText(item.captured_at) || undefined,
        })),
        submit_id: next.submit_id,
        step_key: 'append_inspection_issue_photos',
      }, { skipAuthInvalidation: true })
      setCleaningIssue((current) => [...current, ...uploadedItems])
      setPostSubmitIssueDraft(null)
      await persistPostSubmitIssueDraft(null)
      Alert.alert(t('common_ok'), '清洁问题已提交')
    } catch (error: any) {
      const failed = { ...next, last_error: String(error?.message || '清洁问题提交失败，请重试') }
      setPostSubmitIssueDraft(failed)
      await persistPostSubmitIssueDraft(failed).catch(() => null)
      Alert.alert(t('common_error'), failed.last_error || '清洁问题提交失败，请重试')
    } finally {
      setPostSubmitIssueSubmitting(false)
    }
  }

  function onChangeCleaningIssueNote(idx: number, value: string) {
    if (isFrozen) return
    setCleaningIssue((prev) => prev.map((item, index) => (index === idx ? { ...item, note: value.slice(0, 300) } : item)))
  }

  function onRemoveCleaningIssuePhoto(idx: number) {
    if (isFrozen) return
    setCleaningIssue((prev) => prev.filter((_, index) => index !== idx))
  }

  async function captureRestockProof() {
    const ok = await ensureCameraPerm()
    if (!ok) {
      Alert.alert(t('common_error'), '需要相机权限')
      return null
    }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.75, allowsEditing: false })
    if (res.canceled || !res.assets?.length) return null
    try {
      return await createMediaFromAsset(res.assets[0], 'restock')
    } catch (error: any) {
      Alert.alert(t('common_error'), String(error?.message || '照片格式转换失败，请重新拍摄'))
      return null
    }
  }

  async function onTakeRestockProof(idx: number) {
    if (isFrozen) return
    const media = await captureRestockProof()
    if (!media) return
    setRestock((prev) => prev.map((item, index) => (index === idx ? { ...item, proof_media: [...item.proof_media, media] } : item)))
  }

  async function onMarkRestocked(idx: number) {
    if (isFrozen) return
    const media = await captureRestockProof()
    if (!media) return
    setRestock((prev) => prev.map((item, index) => (index === idx ? { ...item, status: 'restocked', proof_media: [...item.proof_media, media] } : item)))
  }

  function validateDraft() {
    if (!task) return { section: 'restock' as const, message: '任务数据尚未加载完成' }
    return findInspectionPanelValidationIssue(buildSnapshot({
      taskId: task.id,
      cleaningTaskId,
      propertyId,
      propertyCode,
      restock,
      restockConfirmedSufficient,
      roomPhotoRequirement,
      roomPhotos,
      cleaningIssue,
      feedback: feedbackDraft,
    }))
  }

  function rememberSectionOffset(section: 'restock' | 'photos', y: number) {
    sectionOffsetsRef.current[section] = Math.max(0, y)
  }

  function focusValidationIssue(issue: NonNullable<ReturnType<typeof findInspectionPanelValidationIssue>>) {
    if (issue.section === 'restock') {
      setExpanded((prev) => ({ ...prev, restock: true }))
    } else {
      setExpanded((prev) => ({ ...prev, photos: true }))
    }
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, (sectionOffsetsRef.current[issue.section] || 0) - 18),
        animated: true,
      })
    })
  }

  async function onSubmitPage() {
    if (!task || !token) return
    if (cleaningSubmissionBlocked) {
      Alert.alert('暂不可提交检查', '请先等待清洁提交补品记录和房源照片，清洁完成后刷新任务再提交检查。')
      return
    }
    const currentBatch = await getInspectionPanelBatch(task.id)
    if (currentBatch && currentBatch.status !== 'draft') {
      setSubmitting(true)
      try {
        await processInspectionPanelSubmitQueue(token)
        setBatchItem(await getInspectionPanelBatch(task.id))
      } catch (e: any) {
        Alert.alert(t('common_error'), String(e?.message || '重试同步失败'))
      } finally {
        setSubmitting(false)
      }
      return
    }
    const validationIssue = validateDraft()
    if (validationIssue) {
      setShowValidationIssue(true)
      focusValidationIssue(validationIssue)
      return
    }
    setSubmitting(true)
    try {
      setShowValidationIssue(false)
      await persistDraft()
      await saveInspectionPanelDraftBatch({
        task_id: task.id,
        cleaning_task_id: cleaningTaskId,
        property_id: propertyId,
        property_code: propertyCode,
        snapshot: buildSnapshot({
          taskId: task.id,
          cleaningTaskId,
          propertyId,
          propertyCode,
          restock,
          restockConfirmedSufficient,
          roomPhotoRequirement,
          roomPhotos,
          cleaningIssue,
          feedback: feedbackDraft,
        }),
      })
      const submitted = await submitInspectionPanelBatch(task.id)
      setBatchItem(submitted)
      await processInspectionPanelSubmitQueue(token)
      const latest = await getInspectionPanelBatch(task.id)
      setBatchItem(latest)
      Alert.alert(
        t('common_ok'),
        latest?.status === 'synced'
          ? '检查与补充已同步到系统。'
          : '检查与补充已保存到本机，网络恢复或任务信息刷新后会自动同步。可以继续进入完成页。',
      )
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '提交失败'))
      setBatchItem(await getInspectionPanelBatch(task.id))
    } finally {
      setSubmitting(false)
    }
  }

  async function onDiscardFailedBatch() {
    if (!task) return
    await discardInspectionPanelBatch(task.id)
    await clearInspectionPanelDraft(task.id)
    draftHydratedRef.current = true
    setBatchItem(null)
    setRestock(initialRestockItems.map(cloneRestockItem))
    setRestockConfirmedSufficient(false)
    setGuestArrivalPhotoSkipConfirmed(false)
    commitRoomPhotos(baseRoomPhotos())
    setCleaningIssue([])
    setFeedbackDraft(await getInspectionPanelFeedbackDraft(task.id))
  }

  function requestDiscardFailedBatch() {
    if (!canDiscardFrozenBatch) return
    Alert.alert(
      '放弃失败批次并重建草稿',
      '当前失败批次的冻结 snapshot、同步进度和本地草稿都会被清除。已同步到后台的内容不会回滚。确认后页面会回到可编辑草稿。',
      [
        { text: '取消', style: 'cancel' },
        { text: '放弃并重建', style: 'destructive', onPress: () => void onDiscardFailedBatch() },
      ],
    )
  }

  function closeRestockPicker() {
    setRestockPickerOpen(false)
    setRestockPickerMode('other')
    setRestockPickerQuery('')
    setRestockPickerSelectedIds([])
  }

  function openRestockPicker(mode: 'other' | 'next') {
    if (isFrozen) return
    setRestockPickerMode(mode)
    setRestockPickerOpen(true)
  }

  function toggleRestockPickerItem(itemId0: string) {
    if (isFrozen) return
    const itemId = cleanText(itemId0)
    if (!itemId) return
    if (restock.some((item) => item.item_id === itemId)) return
    setRestockPickerSelectedIds((prev) => (prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]))
  }

  function addManualRestockItems(itemIds: string[]) {
    if (isFrozen) return
    const existing = new Set(restock.map((item) => item.item_id))
    const nextItems = Array.from(new Set(itemIds.map(cleanText).filter(Boolean)))
      .filter((itemId) => !existing.has(itemId))
      .map((itemId) => {
        const source = suppliesCatalog.items.find((item) => cleanText(item.id) === itemId)
        const status: RestockState['status'] = restockPickerMode === 'next' ? 'carry_forward' : null
        return {
          item_id: itemId,
          label: cleanText(source?.label) || itemId,
          qty: null,
          status,
          source_photo_url: null,
          proof_media: [],
          note: '',
          origin: 'manual' as const,
        }
      })
    if (!nextItems.length) return Alert.alert(t('common_error'), '请先选择补充项')
    setRestockConfirmedSufficient(false)
    setRestock((prev) => [...prev, ...nextItems])
    closeRestockPicker()
  }

  const completeDisabled = !hasFormalSubmission || !!batchValidationError || (!!guestSpecialRequest && !guestNeedDone)
  const syncHint = readOnly ? '只读查看模式，已同步照片不可修改。' : batchStatusHint(batchStatus, batchItem?.last_error)
  const failedStepDetails = inspectionPanelFailedStepDetails(batchItem)
  const localMediaSummary = inspectionPanelLocalMediaSummary(batchItem)
  const restockAddButtons = (
    <View style={styles.restockAddRow}>
      <Pressable
        testID="inspection-add-other-restock"
        onPress={() => openRestockPicker('other')}
        disabled={isFrozen}
        style={({ pressed }) => [styles.previewBtn, styles.restockAddButton, isFrozen ? styles.submitDisabled : null, pressed ? styles.pressed : null]}
      >
        <Text style={styles.previewBtnText}>添加其他要补充项</Text>
      </Pressable>
      <Pressable
        testID="inspection-add-next-restock"
        onPress={() => openRestockPicker('next')}
        disabled={isFrozen}
        style={({ pressed }) => [styles.previewBtn, styles.restockAddButton, isFrozen ? styles.submitDisabled : null, pressed ? styles.pressed : null]}
      >
        <Text style={styles.previewBtnText}>添加下次要补充项</Text>
      </Pressable>
    </View>
  )
  const restockLoadErrorView = (
    <View testID="inspection-restock-load-error" style={styles.inlineErrorCard}>
      <Text style={styles.inlineErrorTitle}>补充项读取失败</Text>
      <Text style={styles.inlineErrorText}>暂时无法确认消耗品状态，请重试后再确认现场是否充足。</Text>
      <Pressable
        testID="inspection-retry-restock-load"
        onPress={() => !isFrozen && void loadLocalState({ showSpinner: true, forceDraftReload: true })}
        disabled={isFrozen}
        style={({ pressed }) => [styles.inlineRetryBtn, isFrozen ? styles.actionBtnDisabled : null, pressed ? styles.pressed : null]}
      >
        <Text style={styles.inlineRetryText}>重试读取</Text>
      </Pressable>
    </View>
  )

  if (!task) {
    return (
      <View style={styles.page}>
        <Text style={styles.muted}>{t('common_loading')}</Text>
      </View>
    )
  }

  return (
    <View style={styles.page}>
      <KeyboardAvoidingView style={styles.page} behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} style={styles.page} contentContainerStyle={[styles.content, { paddingBottom: scrollBottomPadding }]} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.headRow}>
              <Text style={styles.title}>检查与补充</Text>
              <View style={styles.badge}>
                <Ionicons name="home-outline" size={moderateScale(14)} color="#2563EB" />
                <Text style={styles.badgeText}>{task.title}</Text>
              </View>
            </View>
            {propertyAddr ? <Text style={styles.sub}>{propertyAddr}</Text> : null}
            {readOnly ? (
              <Text testID="inspection-read-only-banner" style={styles.readOnlyBanner}>
                只读查看：任务已完成，检查照片已从系统同步加载，不能修改或再次提交。
              </Text>
            ) : null}
            {isPasswordOnlyInspection ? (
              <View style={[styles.noticeCard, inspectionScopeNoticeStyles.card]}>
                <Ionicons name="flash-outline" size={moderateScale(16)} color={inspectionScopeNoticeStyles.icon} />
                <Text style={[styles.noticeCardText, inspectionScopeNoticeStyles.text]}>
                  {`此任务为${inspectionScopeLabel((task as any)?.inspection_scope)}，只需必要说明与最终视频；拍照阶段只存本地，提交本页时才进入同步队列。`}
                </Text>
              </View>
            ) : null}
            {guestArrivalPhotoSkipEligible && !isEarlyCheckinGuest ? (
              <Pressable
                onPress={() => !isFrozen && setGuestArrivalPhotoSkipConfirmed((value) => !value)}
                disabled={isFrozen}
                style={({ pressed }) => [styles.guestArrivalSkipRow, isFrozen ? styles.actionBtnDisabled : null, pressed ? styles.pressed : null]}
              >
                <Ionicons name={guestArrivalPhotoSkipConfirmed ? 'checkbox-outline' : 'square-outline'} size={moderateScale(18)} color={guestArrivalPhotoSkipConfirmed ? '#EA580C' : '#6B7280'} />
                <Text style={styles.guestArrivalSkipText}>客人已到达并急需入住，确认跳过房间检查照片</Text>
              </Pressable>
            ) : isEarlyCheckinGuest ? (
              <Text style={styles.warnSmall}>早入住客人到达时不可跳过检查照片。</Text>
            ) : null}
          </View>

          <GuestLuggageCard
            notice={(task as any).guest_luggage || null}
            token={token}
            showAcknowledge={!readOnly}
            onChanged={readOnly ? undefined : (notice) => patchWorkTaskItem(task.id, { guest_luggage: notice } as any)}
          />

          <View
            style={[styles.card, draftValidationIssue?.section === 'restock' ? styles.validationCard : null]}
            onLayout={(event) => rememberSectionOffset('restock', event.nativeEvent.layout.y)}
          >
            <Pressable onPress={() => setExpanded((prev) => ({ ...prev, restock: !prev.restock }))} style={({ pressed }) => [styles.sectionHead, pressed ? styles.pressed : null]}>
              {sectionTitle('cube-outline', '1. 消耗品补充')}
              <Ionicons name={expanded.restock ? 'chevron-up' : 'chevron-down'} size={moderateScale(18)} color="#9CA3AF" />
            </Pressable>
            {expanded.restock ? (
              !restock.length ? (
                <View style={styles.block}>
                  {restockLoading ? (
                    <Text testID="inspection-restock-loading" style={styles.mutedSmall}>正在读取补充项...</Text>
                  ) : restockLoadError ? restockLoadErrorView : null}
                  {!restockLoading && !restockLoadError && draftValidationIssue?.section === 'restock' ? (
                    <View style={styles.inlineErrorCard}>
                      <Text style={styles.inlineErrorTitle}>还有内容没完成</Text>
                      <Text style={styles.inlineErrorText}>{draftValidationIssue.message}</Text>
                    </View>
                  ) : null}
                  {!restockLoading && !restockLoadError ? (
                    <>
                      <Text style={styles.mutedSmall}>{restockConfirmedSufficient ? '已确认当前消耗品充足。' : '当前没有待补充项，请确认现场消耗品都充足，或添加其他要补充项或下次退房要补的项目。'}</Text>
                      <Pressable
                        onPress={() => !isFrozen && setRestockConfirmedSufficient(true)}
                        disabled={isFrozen}
                        style={({ pressed }) => [styles.primaryBtn, styles.restockConfirmButton, restockConfirmedSufficient ? styles.primaryBtnSuccess : null, isFrozen ? styles.submitDisabled : null, pressed ? styles.pressed : null]}
                      >
                        <Text style={styles.primaryText}>{restockConfirmedSufficient ? '已确认充足' : '确认都充足'}</Text>
                      </Pressable>
                      {restockAddButtons}
                    </>
                  ) : null}
                </View>
              ) : (
                <>
                  {restockLoadError ? restockLoadErrorView : null}
                  {draftValidationIssue?.section === 'restock' ? (
                    <View style={styles.inlineErrorCard}>
                      <Text style={styles.inlineErrorTitle}>还有内容没完成</Text>
                      <Text style={styles.inlineErrorText}>{draftValidationIssue.message}</Text>
                    </View>
                  ) : null}
                  {restockAddButtons}
                  {restock.map((item, idx) => (
                    <View key={item.item_id} style={[styles.block, draftValidationIssue?.section === 'restock' && draftValidationIssue.item_id === item.item_id ? styles.validationBlock : null]}>
                      <View style={styles.inlineHeadRow}>
                        <View style={styles.restockTitleWrap}>
                          <Text style={styles.label}>{item.label}</Text>
                          {consumableRestockStandard(item.item_id, item.label) ? <Text style={styles.restockStandard}>{`补充标准：${consumableRestockStandard(item.item_id, item.label)}`}</Text> : null}
                        </View>
                        {item.origin === 'manual' ? (
                          <Pressable onPress={() => !isFrozen && setRestock((prev) => prev.filter((_, index) => index !== idx))} disabled={isFrozen} style={({ pressed }) => [styles.removeBtn, isFrozen ? styles.actionBtnDisabled : null, pressed ? styles.pressed : null]}>
                            <Text style={styles.removeBtnText}>移除</Text>
                          </Pressable>
                        ) : null}
                      </View>
                      <Text style={styles.mutedSmall}>{item.qty != null ? `建议补充：${item.qty}` : ''}</Text>
                      <View style={styles.row}>
                        <Pressable onPress={() => void onMarkRestocked(idx)} disabled={isFrozen} style={({ pressed }) => [styles.chip, styles.chipHalf, item.status === 'restocked' ? styles.chipActive : null, isFrozen ? styles.actionBtnDisabled : null, pressed ? styles.pressed : null]}>
                          <Text style={[styles.chipText, item.status === 'restocked' ? styles.chipTextActive : null]}>已补充</Text>
                        </Pressable>
                        <Pressable testID={`inspection-restock-${item.item_id}-carry-forward`} onPress={() => !isFrozen && setRestock((prev) => prev.map((entry, index) => (index === idx ? { ...entry, status: 'carry_forward', proof_media: [] } : entry)))} disabled={isFrozen} style={({ pressed }) => [styles.chip, styles.chipHalf, item.status === 'carry_forward' ? styles.chipActive : null, isFrozen ? styles.actionBtnDisabled : null, pressed ? styles.pressed : null]}>
                          <Text style={[styles.chipText, item.status === 'carry_forward' ? styles.chipTextActive : null]}>下次退房补</Text>
                        </Pressable>
                        <Pressable onPress={() => !isFrozen && setRestock((prev) => prev.map((entry, index) => (index === idx ? { ...entry, status: 'unavailable', proof_media: [] } : entry)))} disabled={isFrozen} style={({ pressed }) => [styles.chip, styles.chipFull, item.status === 'unavailable' ? styles.chipActive : null, isFrozen ? styles.actionBtnDisabled : null, pressed ? styles.pressed : null]}>
                          <Text style={[styles.chipText, item.status === 'unavailable' ? styles.chipTextActive : null]}>现场够用</Text>
                        </Pressable>
                      </View>
                      <View style={styles.restockProofRow}>
                        <View style={styles.restockProofGallery}>
                          {cleanText(item.source_photo_url) ? (
                            <Pressable onPress={() => setViewerTarget({ remoteReference: cleanText(item.source_photo_url) })} style={({ pressed }) => [styles.proofThumbWrap, pressed ? styles.pressed : null]}>
                              <CleaningMediaImage token={token} isOnline={isOnline} remoteReference={item.source_photo_url} style={styles.proofThumb} />
                              <Text style={styles.proofHint}>清洁员补货照片</Text>
                            </Pressable>
                          ) : null}
                          {item.proof_media.map((proof, proofIdx) => (
                            <View key={`${proof.id}-${proofIdx}`} style={styles.proofThumbCard}>
                              <Pressable onPress={() => setViewerTarget(mediaViewerTarget(proof))} style={({ pressed }) => [styles.proofThumbWrap, pressed ? styles.pressed : null]}>
                                <CleaningMediaImage
                                  token={token}
                                  isOnline={isOnline}
                                  localUri={proof.local_uri}
                                  thumbnailUri={proof.thumbnail_uri}
                                  remoteReference={mediaRemoteReference(proof)}
                                  style={styles.proofThumb}
                                />
                                <Text style={styles.proofHint}>本地草稿照片</Text>
                              </Pressable>
                              {!isFrozen ? (
                                <Pressable onPress={() => setRestock((prev) => prev.map((entry, entryIdx) => (entryIdx === idx ? { ...entry, proof_media: entry.proof_media.filter((_, mediaIdx) => mediaIdx !== proofIdx) } : entry)))} style={({ pressed }) => [styles.proofDeleteBtn, pressed ? styles.pressed : null]}>
                                  <Ionicons name="trash-outline" size={moderateScale(14)} color="#DC2626" />
                                </Pressable>
                              ) : null}
                            </View>
                          ))}
                        </View>
                        <View style={styles.restockActionCol}>
                          {item.status === 'unavailable' ? (
                            <Text style={[styles.mutedSmall, styles.restockNoNeedText]}>现场够用，无需再上传照片</Text>
                          ) : item.status === 'carry_forward' ? (
                            <Text style={[styles.mutedSmall, styles.restockNoNeedText]}>已记到下次退房补，无需再拍补货照片</Text>
                          ) : (
                            <Pressable onPress={() => void onTakeRestockProof(idx)} disabled={isFrozen} style={({ pressed }) => [styles.photoBtn, styles.restockPhotoBtn, isFrozen ? styles.submitDisabled : null, pressed ? styles.pressed : null]}>
                              <Text style={styles.photoBtnText}>{item.proof_media.length ? '继续拍照' : '拍照上传'}</Text>
                            </Pressable>
                          )}
                        </View>
                      </View>
                      <AppTextInput value={item.note} onChangeText={(value) => !isFrozen && setRestock((prev) => prev.map((entry, index) => (index === idx ? { ...entry, note: value.slice(0, 300) } : entry)))} editable={!isFrozen} style={[styles.input, styles.note]} placeholder="备注（可选）" multiline />
                    </View>
                  ))}
                </>
              )
            ) : null}
          </View>

          <View style={styles.card}>
            <Pressable onPress={() => setExpanded((prev) => ({ ...prev, cleaningIssue: !prev.cleaningIssue }))} style={({ pressed }) => [styles.sectionHead, pressed ? styles.pressed : null]}>
              {sectionTitle('alert-circle-outline', '2. 清洁问题反馈')}
              <Ionicons name={expanded.cleaningIssue ? 'chevron-up' : 'chevron-down'} size={moderateScale(18)} color="#9CA3AF" />
            </Pressable>
            {expanded.cleaningIssue ? (
              <View style={styles.block}>
                <Text style={styles.mutedSmall}>
                  {canAppendPostSubmitCleaningIssue
                    ? '本次检查已同步：仅可从相册补充新的清洁问题，其他检查与补充照片已锁定。'
                    : '如发现清洁没做到位，可补充照片和备注。此阶段只会保存在本地草稿。'}
                </Text>
                <View style={styles.uploadActionsRow}>
                  {!isFrozen ? (
                    <>
                      <Pressable
                        onPress={() => void onAddCleaningIssuePhoto('camera')}
                        style={({ pressed }) => [styles.photoBtn, styles.uploadActionBtn, pressed ? styles.pressed : null]}
                      >
                        <Text style={styles.photoBtnText}>拍照上传</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => void onAddCleaningIssuePhoto('library')}
                        style={({ pressed }) => [styles.photoBtn, styles.uploadActionBtn, pressed ? styles.pressed : null]}
                      >
                        <Text style={styles.photoBtnText}>相册上传</Text>
                      </Pressable>
                    </>
                  ) : null}
                  {canAppendPostSubmitCleaningIssue ? (
                    <Pressable
                      testID="inspection-post-submit-issue-library"
                      onPress={() => void onAddPostSubmitCleaningIssueFromLibrary()}
                      disabled={postSubmitIssueSubmitting}
                      style={({ pressed }) => [styles.photoBtn, styles.uploadActionBtn, postSubmitIssueSubmitting ? styles.actionBtnDisabled : null, pressed ? styles.pressed : null]}
                    >
                      <Text style={styles.photoBtnText}>从相册选择问题照片</Text>
                    </Pressable>
                  ) : null}
                </View>
                {isFrozen ? (
                  <Text style={styles.mutedSmall}>
                    {readOnly
                      ? '当前为只读查看，已同步照片不可修改。'
                      : canAppendPostSubmitCleaningIssue
                        ? '新增问题照片会追加提交，不会修改已提交的检查与补充照片。'
                        : '本页已保存为提交批次；如需补充照片，请先放弃当前提交批次并重建草稿。'}
                  </Text>
                ) : null}
                {cleaningIssue.map((item, idx) => (
                  <View key={`${item.id}-${idx}`} style={styles.issueCard}>
                    <View style={styles.row}>
                      <Pressable onPress={() => setViewerTarget(mediaViewerTarget(item))} style={({ pressed }) => [styles.uncleanThumbWrap, pressed ? styles.pressed : null]}>
                        <CleaningMediaImage
                          token={token}
                          isOnline={isOnline}
                          localUri={item.local_uri}
                          thumbnailUri={item.thumbnail_uri}
                          remoteReference={mediaRemoteReference(item)}
                          style={styles.uncleanThumb}
                        />
                      </Pressable>
                      {!isFrozen ? (
                        <Pressable onPress={() => onRemoveCleaningIssuePhoto(idx)} style={({ pressed }) => [styles.removeBtn, pressed ? styles.pressed : null]}>
                          <Text style={styles.removeBtnText}>删除</Text>
                        </Pressable>
                      ) : null}
                    </View>
                    <AppTextInput value={cleanText(item.note)} onChangeText={(value) => onChangeCleaningIssueNote(idx, value)} editable={!isFrozen} style={[styles.input, styles.note]} placeholder="备注（可选）" multiline />
                  </View>
                ))}
                {postSubmitIssueDraft?.items.map((item, idx) => (
                  <View key={`post-submit-${item.id}-${idx}`} style={styles.issueCard}>
                    <View style={styles.row}>
                      <Pressable onPress={() => setViewerTarget(mediaViewerTarget(item))} style={({ pressed }) => [styles.uncleanThumbWrap, pressed ? styles.pressed : null]}>
                        <CleaningMediaImage
                          token={token}
                          isOnline={isOnline}
                          localUri={item.local_uri}
                          thumbnailUri={item.thumbnail_uri}
                          remoteReference={mediaRemoteReference(item)}
                          style={styles.uncleanThumb}
                        />
                      </Pressable>
                      <Pressable onPress={() => removePostSubmitCleaningIssue(idx)} disabled={postSubmitIssueSubmitting} style={({ pressed }) => [styles.removeBtn, postSubmitIssueSubmitting ? styles.actionBtnDisabled : null, pressed ? styles.pressed : null]}>
                        <Text style={styles.removeBtnText}>删除</Text>
                      </Pressable>
                    </View>
                    <AppTextInput value={cleanText(item.note)} onChangeText={(value) => updatePostSubmitCleaningIssueNote(idx, value)} editable={!postSubmitIssueSubmitting} style={[styles.input, styles.note]} placeholder="问题备注（可选）" multiline />
                  </View>
                ))}
                {canAppendPostSubmitCleaningIssue && postSubmitIssueDraft?.items.length ? (
                  <View style={styles.postSubmitIssueActions}>
                    {postSubmitIssueDraft.last_error ? <Text style={styles.warnSmall}>{postSubmitIssueDraft.last_error}</Text> : null}
                    <AppButton
                      testID="inspection-post-submit-issue-submit"
                      label={postSubmitIssueSubmitting ? '正在提交清洁问题' : '提交清洁问题'}
                      onPress={() => void onSubmitPostSubmitCleaningIssue()}
                      disabled={postSubmitIssueSubmitting}
                      loading={postSubmitIssueSubmitting}
                      fullWidth
                    />
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>

          <View style={styles.card}>
            <Pressable onPress={() => setExpanded((prev) => ({ ...prev, propertyIssue: !prev.propertyIssue }))} style={({ pressed }) => [styles.sectionHead, pressed ? styles.pressed : null]}>
              {sectionTitle('home-outline', '3. 房源问题反馈')}
              <Ionicons name={expanded.propertyIssue ? 'chevron-up' : 'chevron-down'} size={moderateScale(18)} color="#9CA3AF" />
            </Pressable>
            {expanded.propertyIssue ? (
              <View style={styles.block}>
                <Text style={styles.mutedSmall}>{feedbackSummary(feedbackDraft)}</Text>
                {readOnly ? (
                  <Text style={styles.mutedSmall}>当前为只读查看，不能新增房源问题反馈。</Text>
                ) : (
                  <Pressable
                    onPress={() => props.navigation.navigate('FeedbackForm', { taskId: task.id, source: 'inspection_panel_batch' })}
                    style={({ pressed }) => [styles.primaryBtn, { marginTop: 12 }, pressed ? styles.pressed : null]}
                  >
                    <Text style={styles.primaryText}>进入问题反馈</Text>
                  </Pressable>
                )}
              </View>
            ) : null}
          </View>

          <View
            style={[styles.card, draftValidationIssue?.section === 'photos' ? styles.validationCard : null]}
            onLayout={(event) => rememberSectionOffset('photos', event.nativeEvent.layout.y)}
          >
            <Pressable onPress={() => setExpanded((prev) => ({ ...prev, photos: !prev.photos }))} style={({ pressed }) => [styles.sectionHead, pressed ? styles.pressed : null]}>
              {sectionTitle('camera-outline', '4. 房间检查照片')}
              <Ionicons name={expanded.photos ? 'chevron-up' : 'chevron-down'} size={moderateScale(18)} color="#9CA3AF" />
            </Pressable>
            {expanded.photos ? (
              <View style={styles.block}>
                {draftValidationIssue?.section === 'photos' ? (
                  <View style={styles.inlineErrorCard}>
                    <Text style={styles.inlineErrorTitle}>还有照片没完成</Text>
                    <Text style={styles.inlineErrorText}>{draftValidationIssue.message}</Text>
                  </View>
                ) : null}
                <ResponsiveImageGrid
                  items={ROOM_AREAS}
                  keyExtractor={(item) => item.key}
                  renderItem={(area) => (
                    <View style={[styles.photoCard, draftValidationIssue?.section === 'photos' && draftValidationIssue.room_area === area.key ? styles.validationPhotoCard : null]}>
                      <View style={styles.photoHeadRow}>
                        <Text style={styles.photoLabel}>{area.label}</Text>
                        <Text style={styles.photoCount}>{(roomPhotos[area.key] || []).length ? `${(roomPhotos[area.key] || []).length}/${area.max}` : '未拍'}</Text>
                      </View>
                      <Text style={styles.photoHint}>{area.hint}</Text>
                      <View style={styles.thumbRow}>
                        {(roomPhotos[area.key] || []).length ? (
                          roomPhotos[area.key].map((photo, idx) => (
                            <Pressable
                              key={`${photo.id}-${idx}`}
                              testID={`inspection-photo-${area.key}-${idx}`}
                              onPress={() => setViewerTarget(mediaViewerTarget(photo))}
                              onLongPress={() => !readOnly && onRemoveRoomPhoto(area.key, idx)}
                              style={({ pressed }) => [styles.thumbMiniWrap, pressed ? styles.pressed : null]}
                            >
                              <CleaningMediaImage
                                token={token}
                                isOnline={isOnline}
                                localUri={photo.local_uri}
                                thumbnailUri={photo.thumbnail_uri}
                                remoteReference={mediaRemoteReference(photo)}
                                style={styles.thumbMini}
                              />
                            </Pressable>
                          ))
                        ) : (
                          <View style={styles.thumbMiniEmpty}>
                            <Ionicons name="image-outline" size={moderateScale(16)} color="#9CA3AF" />
                            <Text style={styles.photoEmptyText}>未拍</Text>
                          </View>
                        )}
                      </View>
                      {!isFrozen ? (
                        <Pressable onPress={() => void onAddRoomPhoto(area.key)} disabled={(roomPhotos[area.key] || []).length >= area.max} style={({ pressed }) => [styles.smallBtn, (roomPhotos[area.key] || []).length >= area.max ? styles.submitDisabled : null, pressed ? styles.pressed : null]}>
                          <Text style={styles.smallBtnText}>{(roomPhotos[area.key] || []).length >= area.max ? '已达上限' : '添加'}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  )}
                />
                {!isFrozen ? (
                  <AppButton
                    label="保存照片"
                    onPress={() => void onSaveRoomPhotos()}
                    disabled={savingRoomPhotos}
                    loading={savingRoomPhotos}
                    tone="secondary"
                    fullWidth
                    style={styles.savePhotosButton}
                  />
                ) : null}
                <Text style={styles.mutedSmall}>
                  {isFrozen
                    ? (readOnly ? '已同步照片支持点击查看大图，当前为只读状态。' : '本页照片已随提交批次冻结保存在本机；进入完成页不会删除这些照片。')
                    : roomPhotosSavedAt
                    ? `已于 ${roomPhotosSavedAt} 保存到本机草稿；提交本页后才会统一同步。`
                    : '拍照后会自动保存到本机草稿；也可点击上方按钮再次确认。提交本页后才会统一同步。'}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHead}>{sectionTitle('checkmark-circle-outline', '5. 标记已完成')}</View>
            <View style={styles.block}>
              {readOnly ? (
                <Text testID="inspection-read-only-complete-hint" style={styles.readOnlyBanner}>
                  任务已完成。此处只保留检查照片查看，不能再次提交或修改任务。
                </Text>
              ) : <>
              {guestSpecialRequest ? (
                <View style={styles.guestNeedCard}>
                  <Text style={styles.guestNeedTitle}>客人需求（需要确认已完成）</Text>
                  <Text style={styles.guestNeedText}>{guestSpecialRequest}</Text>
                  <Pressable onPress={() => setGuestNeedDone((value) => !value)} style={({ pressed }) => [styles.guestNeedCheckRow, pressed ? styles.pressed : null]}>
                    <Ionicons name={guestNeedDone ? 'checkbox-outline' : 'square-outline'} size={moderateScale(18)} color={guestNeedDone ? '#16A34A' : '#6B7280'} />
                    <Text style={styles.guestNeedCheckText}>我已完成客人需求</Text>
                  </Pressable>
                </View>
              ) : null}
              {!hasFormalSubmission ? <Text style={styles.mutedSmall}>先点击“提交本页检查与补充”，保存本机批次后即可进入完成页。</Text> : null}
              {hasFormalSubmission && !batchValidationError ? <Text style={styles.mutedSmall}>检查与补充已保存到本机。即使还在同步或失败状态，也可以继续进入视频页；任务会等待检查照片同步完成后再完成。</Text> : null}
              {batchValidationError ? <Text style={styles.warnSmall}>当前冻结批次不完整，不能进入完成页。请放弃并重建草稿后补齐内容。</Text> : null}
              <AppButton
                label={hasFormalSubmission
                  ? batchValidationError
                    ? '照片不完整，请重建草稿'
                    : (isPasswordOnlyInspection ? '进入改密码并完成' : batchItem?.status === 'synced' ? '进入标记已完成' : '进入视频提交（任务待完成）')
                  : '提交本页检查与补充'}
                onPress={() => {
                  if (hasFormalSubmission) {
                    if (batchValidationError) return
                    props.navigation.navigate('InspectionComplete', {
                      taskId: task.id,
                      ...(cleaningTaskId ? { sourceId: cleaningTaskId } : {}),
                      skipInspectionPhotos: batchItem?.snapshot.room_photo_requirement === 'guest_arrival_confirmed',
                    })
                    return
                  }
                  void onSubmitPage()
                }}
                disabled={hasFormalSubmission ? completeDisabled : submitting || !token}
                loading={submitting}
                fullWidth
                style={[
                  styles.completeSectionButton,
                  (hasFormalSubmission ? completeDisabled : submitting || !token) ? styles.submitDisabled : null,
                ]}
                />
              </>}
            </View>
          </View>

          <View testID="inspection-sync-status-card" style={styles.card}>
            <View style={styles.block}>
              <Text style={styles.mutedSmall}>{`当前状态：${batchStatusLabel(batchStatus)}`}</Text>
              <Text style={batchStatus === 'failed' || batchStatus === 'partial_failed' || batchValidationError ? styles.warnSmall : styles.mutedSmall}>
                {batchValidationError ? `当前批次验证失败：${batchValidationError}` : syncHint}
              </Text>
              {failedStepDetails.length ? (
                <View testID="inspection-sync-failed-steps" style={styles.syncDetailCard}>
                  <Text style={styles.syncDetailTitle}>失败步骤</Text>
                  {failedStepDetails.map((step) => (
                    <Text key={step.key} style={styles.syncDetailText}>{`${step.label}：${step.error}`}</Text>
                  ))}
                </View>
              ) : null}
              {localMediaSummary ? (
                <Text testID="inspection-local-media-summary" style={styles.localMediaText}>
                  {`本批次照片共 ${localMediaSummary.total} 张；本机仍保留 ${localMediaSummary.retained} 张，已有远端引用 ${localMediaSummary.remoteReferenced} 张。同步失败时不会因重试自动删除仍保留的本地照片。`}
                </Text>
              ) : null}
              {!canDiscardFrozenBatch && isFrozen ? (
                <Text style={styles.mutedSmall}>当前批次已保存并冻结，不能继续编辑本次 snapshot。</Text>
              ) : null}
            </View>
          </View>

          {loading ? <Text style={styles.muted}>{t('common_loading')}</Text> : null}
        </ScrollView>

        {canDiscardFrozenBatch ? (
          <SafeAreaBottomBar>
            <View style={styles.bottomSecondaryRow}>
              {canRetryFailedBatch && !batchValidationError ? (
                <AppButton
                  label="重试同步"
                  onPress={() => void onSubmitPage()}
                  disabled={submitting || !token}
                  loading={submitting}
                  tone="secondary"
                  style={styles.bottomSecondaryButton}
                />
              ) : null}
              <AppButton
                label="放弃并重建草稿"
                onPress={requestDiscardFailedBatch}
                disabled={submitting}
                tone="danger"
                style={styles.bottomSecondaryButton}
              />
            </View>
          </SafeAreaBottomBar>
        ) : null}
      </KeyboardAvoidingView>

      <Modal visible={restockPickerOpen} transparent animationType="fade" onRequestClose={closeRestockPicker}>
        <Pressable style={styles.viewerMask} onPress={closeRestockPicker}>
          <Pressable style={styles.pickerCard} onPress={() => {}}>
            <View style={styles.pickerHead}>
              <Text style={styles.pickerTitle}>{restockPickerMode === 'next' ? '选择下次退房要补充项' : '选择其他要补充项'}</Text>
              <Pressable onPress={closeRestockPicker} style={({ pressed }) => [styles.pickerClose, pressed ? styles.pressed : null]}>
                <Text style={styles.pickerCloseText}>关闭</Text>
              </Pressable>
            </View>
            <View style={[styles.searchWrap, { marginTop: 10 }]}>
              <Ionicons name="search" size={moderateScale(16)} color="#9CA3AF" />
              <AppTextInput value={restockPickerQuery} onChangeText={setRestockPickerQuery} placeholder="搜索消耗品" style={styles.searchInput} />
            </View>
            <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
              {!restockPickerItems.length && suppliesCatalog.loading ? <Text style={styles.mutedSmall}>{t('common_loading')}</Text> : null}
              {!restockPickerItems.length && !suppliesCatalog.loading && suppliesCatalog.error ? (
                <View style={styles.inlineErrorCard}>
                  <Text style={styles.inlineErrorTitle}>补充项加载失败</Text>
                  <Text style={styles.inlineErrorText}>当前无可用缓存，请联网后重试。</Text>
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
              {restockPickerItems.map((item) => {
                const itemId = cleanText(item.id)
                const alreadyAdded = restock.some((entry) => entry.item_id === itemId)
                const selected = restockPickerSelectedIds.includes(itemId)
                return (
                  <Pressable key={item.id} onPress={() => toggleRestockPickerItem(itemId)} style={({ pressed }) => [styles.pickerRow, selected ? styles.pickerRowSelected : null, pressed ? styles.pressed : null]}>
                    <Text style={[styles.pickerRowText, alreadyAdded ? styles.pickerRowTextMuted : null]}>{cleanText(item.label || item.id)}</Text>
                    {alreadyAdded ? (
                      <Text style={styles.pickerRowMeta}>已添加</Text>
                    ) : selected ? (
                      <Ionicons name="checkmark-circle" size={moderateScale(20)} color="#2563EB" />
                    ) : (
                      <Ionicons name="ellipse-outline" size={moderateScale(20)} color="#D1D5DB" />
                    )}
                  </Pressable>
                )
              })}
              {!restockPickerItems.length && !suppliesCatalog.loading && !suppliesCatalog.error ? <Text style={styles.mutedSmall}>未找到</Text> : null}
            </ScrollView>
            <View style={styles.pickerFooter}>
              <Text style={styles.pickerFooterText}>
                {restockPickerSelectedIds.length
                  ? `已选 ${restockPickerSelectedIds.length} 项`
                  : restockPickerMode === 'next' ? '加入后会直接记为下次退房补' : '加入后请再选择本次处理结果'}
              </Text>
              <Pressable onPress={() => addManualRestockItems(restockPickerSelectedIds)} disabled={!restockPickerSelectedIds.length} style={({ pressed }) => [styles.primaryBtn, styles.pickerConfirmBtn, !restockPickerSelectedIds.length ? styles.submitDisabled : null, pressed ? styles.pressed : null]}>
                <Text style={styles.primaryText}>加入补充列表</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!viewerTarget} transparent animationType="fade" onRequestClose={() => setViewerTarget(null)}>
        <Pressable testID="inspection-photo-viewer-mask" style={styles.viewerMask} onPress={() => setViewerTarget(null)}>
          <View style={[styles.viewerTopRow, { paddingTop: Math.max(10, insets.top) }]} pointerEvents="none">
            <Text style={styles.viewerCloseText}>点击任意位置关闭</Text>
          </View>
          {viewerTarget ? (
            <CleaningMediaPreview
              testID="inspection-photo-viewer"
              token={token}
              reference={viewerTarget.remoteReference || viewerTarget.localUri || viewerTarget.thumbnailUri}
              thumbnailReference={viewerTarget.localUri || viewerTarget.thumbnailUri || viewerTarget.remoteReference}
              style={styles.viewerImg}
            />
          ) : null}
        </Pressable>
      </Modal>

      <Modal
        visible={!!task && !skipRoomConfirmation && !roomConfirmed}
        transparent
        animationType="fade"
        onRequestClose={() => props.navigation.goBack()}
      >
        <View testID="inspection-room-confirmation" style={styles.roomConfirmMask}>
          <View style={styles.roomConfirmCard}>
            <Text style={styles.roomConfirmTitle}>确认当前任务房号</Text>
            <Text style={styles.roomConfirmMessage}>请确认后再开始检查与补充，避免填错房源。</Text>
            <Text testID="inspection-room-confirmation-code" style={styles.roomConfirmCode}>{propertyCode || task?.title || '房号未加载'}</Text>
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
  content: { padding: 16, paddingBottom: 24 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, borderWidth: hairline(), borderColor: '#EEF0F6', marginBottom: 12 },
  validationCard: { borderColor: '#F59E0B', backgroundColor: '#FFFBEB' },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  title: { flex: 1, minWidth: 0, fontSize: 16, fontWeight: '900', color: '#111827' },
  badge: { minHeight: 30, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: '#EFF6FF', borderWidth: hairline(), borderColor: '#DBEAFE', flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '70%', flexShrink: 1 },
  badgeText: { color: '#2563EB', fontWeight: '900', flexShrink: 1 },
  sub: { marginTop: 8, color: '#6B7280', fontWeight: '700' },
  readOnlyBanner: { marginTop: 10, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 10, backgroundColor: '#EFF6FF', borderWidth: hairline(), borderColor: '#BFDBFE', color: '#1D4ED8', fontWeight: '900', lineHeight: 18 },
  muted: { marginTop: 6, color: '#6B7280', fontWeight: '700' },
  mutedSmall: { marginTop: 8, color: '#6B7280', fontWeight: '700', fontSize: 12 },
  warnSmall: { marginTop: 8, color: '#B45309', fontWeight: '900', fontSize: 12 },
  syncDetailCard: { marginTop: 10, padding: 10, borderRadius: 12, backgroundColor: '#FFF7ED', borderWidth: hairline(), borderColor: '#FCD34D', gap: 4 },
  syncDetailTitle: { color: '#9A3412', fontWeight: '900' },
  syncDetailText: { color: '#B45309', fontWeight: '700', lineHeight: 18 },
  localMediaText: { marginTop: 8, color: '#2563EB', fontWeight: '700', fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.92 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { flexShrink: 1, minWidth: 0, fontWeight: '900', color: '#111827' },
  block: { marginTop: 10, paddingTop: 10, borderTopWidth: hairline(), borderTopColor: '#EEF0F6' },
  validationBlock: { borderTopColor: '#F59E0B' },
  inlineHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  label: { color: '#111827', fontWeight: '900' },
  restockTitleWrap: { flex: 1, minWidth: 0 },
  restockStandard: { marginTop: 3, color: '#475569', fontSize: 12, fontWeight: '700', lineHeight: 17 },
  row: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  chip: { flex: 1, minWidth: 120, minHeight: layoutTokens.button.height, paddingVertical: 0, borderRadius: 12, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  chipHalf: { flexBasis: '47%', minWidth: 132 },
  chipFull: { flexBasis: '100%', minWidth: 0 },
  chipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { color: '#374151', fontWeight: '900' },
  chipTextActive: { color: '#FFFFFF' },
  input: { borderRadius: 12, borderWidth: hairline(), borderColor: '#D1D5DB', paddingHorizontal: 12, fontWeight: '700', color: '#111827' },
  note: { minHeight: 96, paddingTop: 10, paddingBottom: 10, textAlignVertical: 'top', marginTop: 10 },
  photoBtn: { minHeight: layoutTokens.button.height, paddingHorizontal: layoutTokens.button.horizontalPadding, paddingVertical: 0, borderRadius: layoutTokens.button.radius, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  photoBtnText: { fontWeight: '900', color: '#111827', textAlign: 'center', flexShrink: 1 },
  previewBtn: { minHeight: layoutTokens.button.height, paddingHorizontal: layoutTokens.button.horizontalPadding, paddingVertical: 0, borderRadius: layoutTokens.button.radius, backgroundColor: '#EFF6FF', borderWidth: hairline(), borderColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  previewBtnText: { fontWeight: '900', color: '#2563EB', textAlign: 'center' },
  primaryBtn: { minHeight: layoutTokens.button.height, paddingHorizontal: layoutTokens.button.horizontalPadding, paddingVertical: 0, borderRadius: layoutTokens.button.radius, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  restockConfirmButton: { width: '100%' },
  restockAddRow: { marginTop: 10, flexDirection: 'row', alignItems: 'stretch', gap: 10, flexWrap: 'wrap' },
  restockAddButton: { flex: 1, minWidth: 136 },
  primaryBtnSuccess: { backgroundColor: '#16A34A' },
  primaryText: { color: '#FFFFFF', fontWeight: '900', textAlign: 'center' },
  submitDisabled: { backgroundColor: '#93C5FD' },
  bottomSecondaryRow: { marginTop: 10, flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  bottomSecondaryButton: { flex: 1, minWidth: 0 },
  actionBtnDisabled: { opacity: 0.55 },
  removeBtn: { minHeight: layoutTokens.button.height, paddingHorizontal: layoutTokens.button.horizontalPadding, paddingVertical: 0, borderRadius: layoutTokens.button.radius, backgroundColor: '#FEE2E2', borderWidth: hairline(), borderColor: '#FECACA', alignItems: 'center', justifyContent: 'center' },
  removeBtnText: { fontWeight: '900', color: '#991B1B' },
  noticeCard: { marginTop: 10, minHeight: 40, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, borderWidth: hairline(), flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  noticeCardText: { flex: 1, minWidth: 0, fontWeight: '900', lineHeight: 18 },
  restockProofRow: { marginTop: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' },
  restockProofGallery: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  restockActionCol: { width: '100%', minWidth: 0, alignItems: 'stretch' },
  restockPhotoBtn: { width: '100%', minHeight: 44 },
  restockNoNeedText: { marginTop: 0, textAlign: 'center' },
  proofThumbCard: { position: 'relative' },
  proofThumbWrap: { width: 96, borderRadius: 12, overflow: 'hidden', borderWidth: hairline(), borderColor: '#EEF0F6', backgroundColor: '#F3F4F6' },
  proofThumb: { width: '100%', height: 96 },
  proofHint: { paddingHorizontal: 6, paddingVertical: 5, fontSize: 10, lineHeight: 12, fontWeight: '700', color: '#374151', backgroundColor: '#FFFFFF' },
  proofDeleteBtn: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.96)', borderWidth: hairline(), borderColor: '#FECACA', alignItems: 'center', justifyContent: 'center' },
  issueCard: { marginTop: 10 },
  uploadActionsRow: { marginTop: 10, flexDirection: 'row', alignItems: 'stretch', gap: 10, flexWrap: 'wrap' },
  uploadActionBtn: { flexGrow: 1, flexBasis: 136, minWidth: 136 },
  postSubmitIssueActions: { marginTop: 12, gap: 8 },
  uncleanThumbWrap: { width: 96, height: 96, borderRadius: 12, overflow: 'hidden', borderWidth: hairline(), borderColor: '#EEF0F6', backgroundColor: '#F3F4F6' },
  uncleanThumb: { width: '100%', height: '100%' },
  photoCard: { flexBasis: '47%', flexGrow: 1, minWidth: 120, backgroundColor: '#F9FAFB', borderWidth: hairline(), borderColor: '#EEF0F6', borderRadius: 14, padding: 10 },
  validationPhotoCard: { borderColor: '#F59E0B', backgroundColor: '#FFF7ED' },
  photoHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  photoLabel: { flex: 1, minWidth: 0, fontWeight: '900', color: '#111827' },
  photoCount: { color: '#6B7280', fontWeight: '900', fontSize: 12 },
  photoHint: { marginTop: 4, minHeight: 16, color: '#6B7280', fontWeight: '700', fontSize: 11, lineHeight: 15 },
  thumbRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumbMiniWrap: { width: 96, height: 96, borderRadius: 10, overflow: 'hidden', borderWidth: hairline(), borderColor: '#EEF0F6', backgroundColor: '#F3F4F6' },
  thumbMini: { width: '100%', height: '100%' },
  thumbMiniEmpty: { width: 96, height: 96, borderRadius: 10, borderWidth: hairline(), borderColor: '#EEF0F6', backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', gap: 2 },
  photoEmptyText: { color: '#9CA3AF', fontWeight: '800', fontSize: 11 },
  smallBtn: { marginTop: 10, minHeight: layoutTokens.button.height, paddingVertical: 0, borderRadius: layoutTokens.button.radius, backgroundColor: '#EFF6FF', borderWidth: hairline(), borderColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  smallBtnText: { color: '#2563EB', fontWeight: '900' },
  savePhotosButton: { marginTop: 12 },
  completeSectionButton: { marginTop: 14 },
  guestNeedCard: { marginBottom: 12, padding: 12, borderRadius: 14, backgroundColor: '#F9FAFB', borderWidth: hairline(), borderColor: '#EEF0F6' },
  guestNeedTitle: { color: '#111827', fontWeight: '900' },
  guestNeedText: { marginTop: 8, color: '#111827', fontWeight: '700', lineHeight: 20 },
  guestNeedCheckRow: { marginTop: 10, minHeight: layoutTokens.button.height, borderRadius: layoutTokens.button.radius, backgroundColor: '#FFFFFF', borderWidth: hairline(), borderColor: '#E5E7EB', paddingHorizontal: layoutTokens.button.horizontalPadding, paddingVertical: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  guestNeedCheckText: { color: '#111827', fontWeight: '900' },
  guestArrivalSkipRow: { marginTop: 10, minHeight: 44, borderRadius: 12, backgroundColor: '#FFF7ED', borderWidth: hairline(), borderColor: '#FDBA74', paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  guestArrivalSkipText: { flex: 1, minWidth: 0, color: '#9A3412', fontWeight: '900', lineHeight: 18 },
  viewerMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  viewerTopRow: { position: 'absolute', top: 0, left: 0, right: 0, height: 54, paddingHorizontal: 12, justifyContent: 'center', zIndex: 2 },
  viewerCloseText: { color: '#FFFFFF', fontWeight: '900' },
  viewerImg: { flex: 1 },
  roomConfirmMask: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(15,23,42,0.56)' },
  roomConfirmCard: { borderRadius: 18, backgroundColor: '#FFFFFF', padding: 18, gap: 10 },
  roomConfirmTitle: { color: '#111827', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  roomConfirmMessage: { color: '#475467', fontWeight: '700', lineHeight: 20, textAlign: 'center' },
  roomConfirmCode: { color: '#1D4ED8', fontSize: 24, fontWeight: '900', textAlign: 'center' },
  roomConfirmAddress: { color: '#667085', fontWeight: '700', lineHeight: 18, textAlign: 'center' },
  roomConfirmWarning: { color: '#B45309', fontWeight: '800', lineHeight: 18, textAlign: 'center' },
  roomConfirmActions: { flexDirection: 'row', gap: layoutTokens.button.rowGap, marginTop: 4 },
  roomConfirmButton: { flex: 1, minWidth: 0 },
  pickerCard: { marginHorizontal: 16, marginTop: 90, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12 },
  pickerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerTitle: { fontSize: 16, fontWeight: '900', color: '#111827' },
  pickerClose: { minHeight: layoutTokens.button.height, paddingHorizontal: layoutTokens.button.horizontalPadding, paddingVertical: 0, borderRadius: layoutTokens.button.radius, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  pickerCloseText: { fontWeight: '900', color: '#111827' },
  pickerRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottomWidth: hairline(), borderBottomColor: '#EEF0F6', paddingHorizontal: 6, paddingVertical: 10 },
  pickerRowSelected: { backgroundColor: '#EFF6FF' },
  pickerRowText: { fontWeight: '800', color: '#111827' },
  pickerRowTextMuted: { color: '#9CA3AF' },
  pickerRowMeta: { fontSize: 12, fontWeight: '800', color: '#6B7280' },
  pickerFooter: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  pickerFooterText: { flex: 1, minWidth: 0, fontSize: 12, fontWeight: '800', color: '#6B7280' },
  pickerConfirmBtn: { flexGrow: 1, minWidth: 148, paddingHorizontal: 16 },
  searchWrap: { height: 44, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: hairline(), borderColor: '#EEF0F6', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: { flex: 1, minWidth: 0, height: 44, color: '#111827', fontWeight: '800' },
  inlineErrorCard: { marginTop: 10, borderRadius: 14, backgroundColor: '#FFF7ED', borderWidth: hairline(), borderColor: '#FCD34D', padding: 12, gap: 8 },
  inlineErrorTitle: { color: '#9A3412', fontWeight: '900' },
  inlineErrorText: { color: '#B45309', fontWeight: '700', lineHeight: 18 },
  inlineRetryBtn: { alignSelf: 'flex-start', minHeight: layoutTokens.button.height, paddingHorizontal: layoutTokens.button.horizontalPadding, paddingVertical: 0, borderRadius: 10, backgroundColor: '#EA580C', alignItems: 'center', justifyContent: 'center' },
  inlineRetryText: { color: '#FFFFFF', fontWeight: '900' },
})
