import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { ResizeMode, Video } from 'expo-av'
import * as ImagePicker from 'expo-image-picker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { API_BASE_URL } from '../../config/env'
import { effectiveInspectionMode, inspectionModeLabel, isSelfCompleteMode, isStayoverTaskType } from '../../lib/cleaningInspection'
import { buildCleaningMediaImageSource } from '../../lib/cleaningMedia'
import {
  deleteGuestLuggageNotice,
  getCleaningConsumables,
  getCompletionPhotos,
  getInspectionPhotos,
  getRestockProof,
  markGuestCheckedOutByOrder,
  markGuestCheckedOutByTasks,
  saveGuestLuggageNotice,
  updateCleaningTaskManagerFields,
  uploadMzappMedia,
} from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { prependNotice } from '../../lib/noticesStore'
import { hasAnyRole } from '../../lib/roles'
import { hairline, moderateScale } from '../../lib/scale'
import { findWorkTaskItemByAnyId, patchWorkTaskItem, refreshWorkTasksFromServer, subscribeWorkTasks, type WorkTaskItem, type WorkTasksView } from '../../lib/workTasksStore'
import { inspectionPhotoTaskIdsFromTask } from '../../lib/managerDailyTaskPhotos'
import type { TasksStackParamList } from '../../navigation/RootNavigator'
import GuestLuggageCard from '../../components/GuestLuggageCard'

type Props = NativeStackScreenProps<TasksStackParamList, 'ManagerDailyTask'>

const PHOTO_LOAD_FOCUS_REUSE_MS = 30_000

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

const AREA_LABEL: Record<string, string> = {
  unclean: '清洁问题',
  toilet: '卫生间',
  living: '客厅',
  sofa: '沙发',
  bedroom: '卧室',
  kitchen: '厨房',
  shower_drain: '淋浴房下水口',
  vacuum_used: '吸尘器使用后',
}

const CLEANING_SCENE_PHOTO_LABEL: Record<string, string> = {
  shower_drain_photo_1: '淋浴房下水口 1',
  shower_drain_photo_2: '淋浴房下水口 2',
  shower_drain_photo_3: '淋浴房下水口 3',
  coffee_machine_photo: '咖啡机',
  kettle_photo: '烧水壶',
  toaster_photo: '面包机',
  vacuum_used_photo: '吸尘器使用后',
}

const CLEANING_SCENE_PHOTO_IDS = new Set(Object.keys(CLEANING_SCENE_PHOTO_LABEL))

function normalizeUrlList(raw: any, fallback?: any) {
  const values = Array.isArray(raw) ? raw : raw ? [raw] : []
  const fallbackValues = Array.isArray(fallback) ? fallback : fallback ? [fallback] : []
  return Array.from(
    new Set(
      [...values, ...fallbackValues]
        .map((item) => String(item || '').trim())
        .filter(Boolean),
    ),
  )
}

function uniqueTextList(values: any[]) {
  return Array.from(new Set(values.map((item) => String(item || '').trim()).filter(Boolean)))
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

function buildCleaningSummary(checkoutTime: string | null, checkinTime: string | null) {
  const checkout = String(checkoutTime || '').trim()
  const checkin = String(checkinTime || '').trim()
  if (checkout && checkin) return `${checkout}退房 ${checkin}入住`
  if (checkout) return `${checkout}退房`
  if (checkin) return `${checkin}入住`
  return null
}

function isDoneLikeStatusZh(status0: string) {
  const s = String(status0 || '').trim().toLowerCase()
  return s === 'done' || s === 'completed' || s === 'ready' || s === 'keys_hung' || s === 'cleaned' || s === 'restock_pending' || s === 'restocked' || s === 'inspected'
}

function statusLabelZh(status: string, task?: WorkTaskItem | null) {
  const s = String(status || '').trim().toLowerCase()
  const source = String(task?.source_type || '').trim().toLowerCase()
  const kind = String(task?.task_kind || '').trim().toLowerCase()
  if (source === 'cleaning_tasks' && kind === 'inspection' && (s === 'cleaned' || s === 'restock_pending' || s === 'restocked')) return '待检查'
  if (source === 'cleaning_tasks' && kind === 'cleaning') {
    const taskType = String((task as any)?.task_type || '').trim().toLowerCase()
    const isStayoverTask = isStayoverTaskType(taskType)
    const inspectionStatus = String((task as any)?.inspection_status || '').trim().toLowerCase()
    const hasInspection = Array.isArray((task as any)?.inspection_task_ids) ? (task as any).inspection_task_ids.length > 0 : false
    const inspectionMode = effectiveInspectionMode(task as any)
    if (isDoneLikeStatusZh(s)) {
      if (isStayoverTask) return '已完成'
      if (inspectionMode === 'same_day' || inspectionMode === 'deferred' || hasInspection || inspectionStatus) {
        if (inspectionStatus === 'keys_hung' || inspectionStatus === 'done' || inspectionStatus === 'completed') return '已挂钥匙'
        return '待检查'
      }
      return '已挂钥匙'
    }
    const checkedOutAt = String((task as any)?.checked_out_at || '').trim()
    if (s === 'in_progress' || s === 'cleaning') return '进行中'
    if (s !== 'cancelled' && s !== 'canceled') {
      if (checkedOutAt) return '已退房'
      return '已分配'
    }
  }
  if (s === 'done' || s === 'completed') return '已完成'
  if (s === 'to_inspect') return '待检查'
  if (s === 'to_hang_keys') return '待挂钥匙'
  if (s === 'to_complete') return '待完成'
  if (s === 'keys_hung') return '已挂钥匙'
  if (s === 'in_progress') return '进行中'
  if (s === 'assigned') return '已分配'
  if (s === 'cancelled' || s === 'canceled') return '已取消'
  if (s === 'ready') return '已完成'
  if (s === 'cleaned') return '已清洁'
  if (s === 'restocked') return '已补货'
  if (s === 'inspected') return '已检查'
  return '待处理'
}

function hashText(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return String(h)
}

function isBeforeToday(taskDate0: any) {
  const taskDate = String(taskDate0 || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(taskDate)) return false
  return taskDate < ymd(new Date())
}

function checkoutTaskIdsFromTask(task: WorkTaskItem | null) {
  if (!task || task.source_type !== 'cleaning_tasks') return []
  return Array.from(
    new Set(
      [
        ...(Array.isArray((task as any)?.cleaning_task_ids) ? (task as any).cleaning_task_ids : []),
        ...(Array.isArray((task as any)?.source_ids) ? (task as any).source_ids : []),
        (task as any)?.source_id,
      ]
        .map((x) => String(x || '').trim())
        .filter(Boolean),
    ),
  )
}

function cleaningTaskIdsFromTask(task: WorkTaskItem | null) {
  if (!task || task.source_type !== 'cleaning_tasks') return []
  const ids = [
    ...(Array.isArray((task as any)?.cleaning_task_ids) ? (task as any).cleaning_task_ids : []),
    ...(Array.isArray((task as any)?.source_ids) ? (task as any).source_ids : []),
    (task as any)?.source_id,
  ]
  return uniqueTextList(ids)
}

function mergeConsumableRows(rows: any[]) {
  const byItem = new Map<string, { item_id: string; photo_url?: string | null; photo_urls?: string[]; item_label?: string | null; status?: string | null; note?: string | null; need_restock?: boolean }>()
  for (const x of rows || []) {
    const itemId = String(x?.item_id || '').trim()
    if (!itemId) continue
    const urls = normalizeUrlList(x?.photo_urls, x?.photo_url)
    const prev = byItem.get(itemId)
    if (prev) {
      const nextUrls = uniqueTextList([...(prev.photo_urls || []), ...urls])
      const nextStatus = String(prev.status || '').trim().toLowerCase() === 'low' || String(x?.status || '').trim().toLowerCase() === 'low' ? 'low' : (prev.status || String(x?.status || '').trim() || null)
      byItem.set(itemId, {
        ...prev,
        photo_url: nextUrls[0] || prev.photo_url || null,
        photo_urls: nextUrls,
        item_label: prev.item_label || (x?.item_label == null ? null : String(x.item_label || '').trim()),
        status: nextStatus,
        note: prev.note || (x?.note == null ? null : String(x.note || '').trim()),
        need_restock: !!prev.need_restock || !!x?.need_restock || String(x?.status || '').trim().toLowerCase() === 'low',
      })
      continue
    }
    byItem.set(itemId, {
      item_id: itemId,
      photo_url: urls[0] || null,
      photo_urls: urls,
      item_label: x?.item_label == null ? null : String(x.item_label || '').trim(),
      status: x?.status == null ? null : String(x.status || '').trim(),
      note: x?.note == null ? null : String(x.note || '').trim(),
      need_restock: !!x?.need_restock || String(x?.status || '').trim().toLowerCase() === 'low',
    })
  }
  return Array.from(byItem.values())
}

function mergeRestockProofRows(rows: any[]) {
  const byItem = new Map<string, { item_id: string; proof_url: string; proof_urls?: string[]; note?: string | null; status?: string | null }>()
  for (const x of rows || []) {
    const itemId = String(x?.item_id || '').trim()
    if (!itemId) continue
    const urls = normalizeUrlList(x?.proof_urls, x?.proof_url)
    if (!urls.length) continue
    const prev = byItem.get(itemId)
    if (prev) {
      const nextUrls = uniqueTextList([...(prev.proof_urls || []), ...urls])
      byItem.set(itemId, {
        ...prev,
        proof_url: nextUrls[0] || prev.proof_url,
        proof_urls: nextUrls,
        note: prev.note || (x?.note == null ? null : String(x.note || '').trim()),
        status: prev.status || (x?.status == null ? null : String(x.status || '').trim()),
      })
      continue
    }
    byItem.set(itemId, {
      item_id: itemId,
      proof_url: urls[0],
      proof_urls: urls,
      note: x?.note == null ? null : String(x.note || '').trim(),
      status: x?.status == null ? null : String(x.status || '').trim(),
    })
  }
  return Array.from(byItem.values())
}

export default function ManagerDailyTaskScreen(props: Props) {
  const { t } = useI18n()
  const { token, user } = useAuth()
  const insets = useSafeAreaInsets()
  const [storeVersion, setStoreVersion] = useState(0)
  const [saving, setSaving] = useState(false)
  const [marking, setMarking] = useState(false)
  const [resolvingRemote, setResolvingRemote] = useState(false)

  useEffect(() => {
    const unsub = subscribeWorkTasks(() => setStoreVersion((v) => v + 1))
    return () => {
      unsub()
    }
  }, [])

  const task = useMemo(() => findWorkTaskItemByAnyId(props.route.params.taskId), [props.route.params.taskId, storeVersion])
  const canEditManagerFields = hasAnyRole(user, ['customer_service', 'admin', 'offline_manager'])
  const canSeeUnclean = hasAnyRole(user, ['admin', 'offline_manager'])

  const [checkoutTime, setCheckoutTime] = useState('')
  const [checkinTime, setCheckinTime] = useState('')
  const [oldCode, setOldCode] = useState('')
  const [newCode, setNewCode] = useState('')
  const [guestNote, setGuestNote] = useState('')
  const [luggageNote, setLuggageNote] = useState('')
  const [luggagePhotoUrls, setLuggagePhotoUrls] = useState<string[]>([])
  const [luggageSaving, setLuggageSaving] = useState(false)
  const [luggageUploading, setLuggageUploading] = useState(false)
  const [keysRequired, setKeysRequired] = useState(1)
  const [keysDirty, setKeysDirty] = useState(false)

  const [photosLoading, setPhotosLoading] = useState(false)
  const [consumableItems, setConsumableItems] = useState<Array<{ item_id: string; photo_url?: string | null; photo_urls?: string[]; item_label?: string | null; status?: string | null; note?: string | null; need_restock?: boolean }>>([])
  const [livingRoomPhotoUrls, setLivingRoomPhotoUrls] = useState<string[]>([])
  const [completionItems, setCompletionItems] = useState<Array<{ area: string; url: string; note?: string | null }>>([])
  const [inspectionItems, setInspectionItems] = useState<Array<{ area: string; url: string; note?: string | null }>>([])
  const [restockProofs, setRestockProofs] = useState<Array<{ item_id: string; proof_url: string; proof_urls?: string[]; note?: string | null; status?: string | null }>>([])
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)
  const syncedTaskIdRef = useRef<string>('')
  const syncedLuggageVersionRef = useRef<string>('')
  const photoLoadInFlightKeyRef = useRef<string>('')
  const photoLoadInFlightPromiseRef = useRef<Promise<void> | null>(null)
  const lastPhotoLoadRef = useRef<{ key: string; at: number } | null>(null)

  useEffect(() => {
    const currentTaskId = String(task?.id || '').trim()
    if (!currentTaskId) {
      return
    }
    if (syncedTaskIdRef.current === currentTaskId) return
    syncedTaskIdRef.current = currentTaskId
    setCheckoutTime(String((task as any)?.start_time || (task as any)?.checkout_time || '').trim())
    setCheckinTime(String((task as any)?.end_time || (task as any)?.checkin_time || '').trim())
    setOldCode(String((task as any)?.old_code || '').trim())
    setNewCode(String((task as any)?.new_code || '').trim())
    setGuestNote(String((task as any)?.guest_special_request || '').trim())
    const k = Number((task as any)?.keys_required_checkin ?? (task as any)?.keys_required ?? 1)
    setKeysRequired(Number.isFinite(k) && k >= 2 ? 2 : 1)
    setKeysDirty(false)
  }, [task?.id])

  useEffect(() => {
    const currentTaskId = String(task?.id || '').trim()
    if (!currentTaskId) return
    const luggageVersion = String((task as any)?.guest_luggage?.version || 0)
    const syncVersion = `${currentTaskId}:${luggageVersion}`
    if (syncedLuggageVersionRef.current === syncVersion) return
    syncedLuggageVersionRef.current = syncVersion
    setLuggageNote(String((task as any)?.guest_luggage?.note || '').trim())
    setLuggagePhotoUrls(normalizeUrlList((task as any)?.guest_luggage?.photo_urls).slice(0, 3))
  }, [task?.id, (task as any)?.guest_luggage?.version])

  useEffect(() => {
    if (task) return
    if (!token || !user?.id) return
    let cancelled = false
    const view: WorkTasksView = 'all'
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
  }, [task, token, user?.id, props.route.params.taskId])

  const inspectionTaskIds = useMemo(() => inspectionPhotoTaskIdsFromTask(task), [task])
  const cleaningTaskIds = useMemo(() => cleaningTaskIdsFromTask(task), [task])
  const inspectionTaskIdsKey = inspectionTaskIds.join('|')
  const cleaningTaskIdsKey = cleaningTaskIds.join('|')

  const loadTaskPhotos = useCallback(async (opts?: { reuseRecent?: boolean }) => {
    if (!token) return
    const loadKey = `${String(user?.id || '')}|${cleaningTaskIdsKey}|${inspectionTaskIdsKey}`
    const lastLoad = lastPhotoLoadRef.current
    if (opts?.reuseRecent && lastLoad?.key === loadKey && Date.now() - lastLoad.at < PHOTO_LOAD_FOCUS_REUSE_MS) return
    if (photoLoadInFlightPromiseRef.current && photoLoadInFlightKeyRef.current === loadKey) return photoLoadInFlightPromiseRef.current
    const cleaningIds = cleaningTaskIdsKey ? cleaningTaskIdsKey.split('|').filter(Boolean) : []
    const inspectionIds = inspectionTaskIdsKey ? inspectionTaskIdsKey.split('|').filter(Boolean) : []
    if (!inspectionIds.length && !cleaningIds.length) {
      setConsumableItems([])
      setLivingRoomPhotoUrls([])
      setCompletionItems([])
      setInspectionItems([])
      setRestockProofs([])
      return
    }

    let run: Promise<void> | undefined = undefined
    run = (async () => {
      setPhotosLoading(true)
      try {
        const [consumablesResps, completionResps, inspectionResps, restockResps] = await Promise.all([
          Promise.all(cleaningIds.map((id) => getCleaningConsumables(token, id).catch(() => null))),
          Promise.all(cleaningIds.map((id) => getCompletionPhotos(token, id).catch(() => null))),
          Promise.all(inspectionIds.map((id) => getInspectionPhotos(token, id).catch(() => null))),
          Promise.all(cleaningIds.map((id) => getRestockProof(token, id).catch(() => null))),
        ])

        setLivingRoomPhotoUrls(uniqueTextList(consumablesResps.flatMap((resp) => normalizeUrlList((resp as any)?.living_room_photo_url))))
        setConsumableItems(mergeConsumableRows(consumablesResps.flatMap((resp) => (Array.isArray((resp as any)?.items) ? (resp as any).items : []))))

        const completion = completionResps.flatMap((resp) => (Array.isArray((resp as any)?.items) ? (resp as any).items : []))
        const seenCompletion = new Set<string>()
        setCompletionItems(
          completion
            .map((x) => ({ area: String(x.area || '').trim(), url: String(x.url || '').trim(), note: x.note ?? null }))
            .filter((x) => {
              if (!x.url) return false
              const key = `${x.area}|${x.url}`
              if (seenCompletion.has(key)) return false
              seenCompletion.add(key)
              return true
            }),
        )

        const items = inspectionResps.flatMap((resp) => (Array.isArray((resp as any)?.items) ? (resp as any).items : []))
        const seenInspection = new Set<string>()
        setInspectionItems(
          items
            .map((x) => ({ area: String(x.area || '').trim(), url: String(x.url || '').trim(), note: x.note ?? null }))
            .filter((x) => {
              if (!x.url) return false
              const key = `${x.area}|${x.url}`
              if (seenInspection.has(key)) return false
              seenInspection.add(key)
              return true
            }),
        )

        setRestockProofs(mergeRestockProofRows(restockResps.flatMap((resp) => (Array.isArray((resp as any)?.items) ? (resp as any).items : []))))
        lastPhotoLoadRef.current = { key: loadKey, at: Date.now() }
      } catch {
        setConsumableItems([])
        setLivingRoomPhotoUrls([])
        setCompletionItems([])
        setInspectionItems([])
        setRestockProofs([])
      } finally {
        if (run && photoLoadInFlightPromiseRef.current === run) {
          photoLoadInFlightPromiseRef.current = null
          photoLoadInFlightKeyRef.current = ''
          setPhotosLoading(false)
        }
      }
    })()

    photoLoadInFlightKeyRef.current = loadKey
    photoLoadInFlightPromiseRef.current = run
    return run
  }, [cleaningTaskIdsKey, inspectionTaskIdsKey, token, user?.id])

  useEffect(() => {
    void loadTaskPhotos()
  }, [loadTaskPhotos])

  useEffect(() => {
    const nav: any = props.navigation as any
    if (!nav || typeof nav.addListener !== 'function') return
    const unsub = nav.addListener('focus', () => void loadTaskPhotos({ reuseRecent: true }))
    return unsub
  }, [loadTaskPhotos, props.navigation])

  async function onSave() {
    if (!token) return Alert.alert(t('common_error'), '请先登录')
    if (!task) return
    if (!canEditManagerFields) return
    const ids = Array.isArray((task as any)?.source_ids) && (task as any).source_ids.length ? (task as any).source_ids : [String((task as any)?.source_id || '')]
    const taskIds = ids.map((x: any) => String(x || '').trim()).filter(Boolean)
    try {
      setSaving(true)
      const norm = (v: any) => String(v ?? '').replace(/\s+/g, ' ').trim()
      const toNull = (v: any) => {
        const s = norm(v)
        return s ? s : null
      }
      const prevCheckout = toNull((task as any)?.start_time || (task as any)?.checkout_time)
      const prevCheckin = toNull((task as any)?.end_time || (task as any)?.checkin_time)
      const prevOldCode = toNull((task as any)?.old_code)
      const prevNewCode = toNull((task as any)?.new_code)
      const prevGuest = toNull((task as any)?.guest_special_request)
      const prevKeys0 = Number((task as any)?.keys_required_checkin ?? (task as any)?.keys_required ?? 1)
      const prevKeys = Number.isFinite(prevKeys0) && prevKeys0 >= 2 ? 2 : 1

      const nextCheckout = toNull(checkoutTime)
      const nextCheckin = toNull(checkinTime)
      const nextOldCode = toNull(oldCode)
      const nextNewCode = toNull(newCode)
      const nextGuest = toNull(guestNote)
      const nextKeys = keysRequired

      const payload: any = { task_ids: taskIds }
      if (!isHistoricalTask) {
        if (norm(nextCheckout) !== norm(prevCheckout)) payload.checkout_time = nextCheckout
        if (norm(nextCheckin) !== norm(prevCheckin)) payload.checkin_time = nextCheckin
        if (norm(nextOldCode) !== norm(prevOldCode)) payload.old_code = nextOldCode
        if (norm(nextNewCode) !== norm(prevNewCode)) payload.new_code = nextNewCode
        if (norm(nextGuest) !== norm(prevGuest)) payload.guest_special_request = nextGuest
      }
      const needKeysUpdate = Number.isFinite(nextKeys) && (keysDirty || nextKeys !== prevKeys)
      const nextKeysValue = nextKeys >= 2 ? 2 : 1

      if (needKeysUpdate) payload.keys_required = nextKeysValue
      const keysForOtherFields = Object.keys(payload).filter((k) => k !== 'task_ids')
      let saveResult: any = null
      if (keysForOtherFields.length) {
        if (!taskIds.length) throw new Error('缺少任务ID')
        saveResult = await updateCleaningTaskManagerFields(token, payload)
      }
      setCheckoutTime(payload.checkout_time !== undefined ? String(payload.checkout_time || '').trim() : String(prevCheckout || '').trim())
      setCheckinTime(payload.checkin_time !== undefined ? String(payload.checkin_time || '').trim() : String(prevCheckin || '').trim())
      setOldCode(payload.old_code !== undefined ? String(payload.old_code || '').trim() : String(prevOldCode || '').trim())
      setNewCode(payload.new_code !== undefined ? String(payload.new_code || '').trim() : String(prevNewCode || '').trim())
      setGuestNote(payload.guest_special_request !== undefined ? String(payload.guest_special_request || '').trim() : String(prevGuest || '').trim())
      setKeysRequired(nextKeysValue)

      const changedLines: string[] = []
      const fmt = (label: string, next: any, prev: any) => `${label}：${norm(next) || '-'}（原：${norm(prev) || '-'}）`
      if (payload.checkout_time !== undefined) changedLines.push(fmt('退房时间', payload.checkout_time, prevCheckout))
      if (payload.checkin_time !== undefined) changedLines.push(fmt('入住时间', payload.checkin_time, prevCheckin))
      if (payload.old_code !== undefined) changedLines.push(fmt('旧密码', payload.old_code, prevOldCode))
      if (payload.new_code !== undefined) changedLines.push(fmt('新密码', payload.new_code, prevNewCode))
      if (payload.guest_special_request !== undefined) changedLines.push(fmt('客人需求', payload.guest_special_request, prevGuest))
      if (needKeysUpdate) changedLines.push(fmt('需挂钥匙套数', nextKeysValue, prevKeys))

      if (task?.id) {
        const patch: any = {}
        if (payload.checkout_time !== undefined) patch.start_time = payload.checkout_time
        if (payload.checkin_time !== undefined) patch.end_time = payload.checkin_time
        if (payload.checkout_time !== undefined) patch.checkout_time = payload.checkout_time
        if (payload.checkin_time !== undefined) patch.checkin_time = payload.checkin_time
        if (payload.old_code !== undefined) patch.old_code = payload.old_code
        if (payload.new_code !== undefined) patch.new_code = payload.new_code
        if (payload.guest_special_request !== undefined) patch.guest_special_request = payload.guest_special_request
        if (needKeysUpdate) {
          const checkout0 = Number((task as any)?.keys_required_checkout ?? 1)
          const checkoutK = Number.isFinite(checkout0) && checkout0 >= 2 ? 2 : 1
          patch.keys_required_checkin = nextKeysValue
          patch.keys_required = Math.max(checkoutK, nextKeysValue)
        }
        const mergedCheckout = payload.checkout_time !== undefined ? payload.checkout_time : prevCheckout
        const mergedCheckin = payload.checkin_time !== undefined ? payload.checkin_time : prevCheckin
        patch.summary = buildCleaningSummary(mergedCheckout, mergedCheckin)
        if (Object.keys(patch).length) await patchWorkTaskItem(task.id, patch)
      }
      if (changedLines.length) {
        const propertyCode = String(task?.property?.code || task?.title || '').trim() || '任务'
        const propertyAddress = String(task?.property?.address || '').trim()
        const nextFieldsKey = hashText(
          JSON.stringify({
            checkout_time: payload.checkout_time !== undefined ? payload.checkout_time : prevCheckout,
            checkin_time: payload.checkin_time !== undefined ? payload.checkin_time : prevCheckin,
            old_code: payload.old_code !== undefined ? payload.old_code : prevOldCode,
            new_code: payload.new_code !== undefined ? payload.new_code : prevNewCode,
            guest_special_request: payload.guest_special_request !== undefined ? payload.guest_special_request : prevGuest,
            keys_required: needKeysUpdate ? nextKeysValue : prevKeys,
          }),
        )
        const body = [
          propertyCode ? `房源：${propertyCode}` : '',
          propertyAddress ? `地址：${propertyAddress}` : '',
          '任务信息已更新：',
          ...changedLines,
        ]
          .filter(Boolean)
          .join('\n')
        void prependNotice({
          id: `manager_fields:${propertyCode}:${nextFieldsKey}`,
          type: needKeysUpdate ? 'key' : 'update',
          title: `任务信息更新：${propertyCode}`,
          summary: changedLines[0] ? changedLines[0].slice(0, 30) : '信息已更新',
          content: body,
          data: {
            entity: 'cleaning_task',
            entityId: String(taskIds[0] || task?.id || ''),
            action: 'open_task',
            kind: 'cleaning_task_manager_fields_updated',
            task_ids: taskIds,
            property_code: propertyCode,
            fields_key: nextFieldsKey,
            event_id: `manager_fields:${propertyCode}:${nextFieldsKey}`,
          },
        }).catch(() => null)
      }
      if (token && user?.id) {
        const { date_from, date_to } = buildDetailFallbackRange()
        refreshWorkTasksFromServer({ token, userId: String(user.id), date_from, date_to, view: 'all' }).catch(() => null)
      }
      setKeysDirty(false)
      const skippedAll = !saveResult || saveResult?.skipped
      Alert.alert(t('common_ok'), skippedAll ? '已保存（无变化）' : '已保存')
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '保存失败'))
    } finally {
      setSaving(false)
    }
  }

  async function addLuggagePhotos(source: 'camera' | 'library') {
    if (!token || !task || luggageUploading) return
    const remaining = 3 - luggagePhotoUrls.length
    if (remaining <= 0) return Alert.alert('已达上限', '每条临时通知最多上传 3 张照片。')
    try {
      const permission = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) return Alert.alert('需要权限', source === 'camera' ? '请开启相机权限' : '请开启相册权限')
      const picked = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.75, allowsEditing: false })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            quality: 0.75,
            allowsEditing: false,
            allowsMultipleSelection: true,
            selectionLimit: remaining,
            orderedSelection: true,
          })
      if (picked.canceled || !picked.assets?.length) return
      setLuggageUploading(true)
      const uploaded: string[] = []
      for (const asset of picked.assets.slice(0, remaining)) {
        const uri = String(asset.uri || '').trim()
        if (!uri) continue
        const name = String(asset.fileName || uri.split('/').pop() || `guest-luggage-${Date.now()}.jpg`)
        const mimeType = String(asset.mimeType || 'image/jpeg')
        const result = await uploadMzappMedia(token, { uri, name, mimeType }, { purpose: 'guest_luggage' })
        uploaded.push(result.url)
      }
      if (uploaded.length) setLuggagePhotoUrls((prev) => uniqueTextList([...prev, ...uploaded]).slice(0, 3))
    } catch (error: any) {
      Alert.alert('上传失败', String(error?.message || '请稍后重试'))
    } finally {
      setLuggageUploading(false)
    }
  }

  async function saveLuggage() {
    if (!token || !task || luggageSaving) return
    const note = luggageNote.trim()
    if (!note && !luggagePhotoUrls.length) return Alert.alert('请填写通知内容', '当天任务临时通知需要填写说明或上传照片。')
    const taskIds = cleaningTaskIdsFromTask(task)
    if (!taskIds.length) return Alert.alert('保存失败', '缺少清洁任务 ID')
    try {
      setLuggageSaving(true)
      const result = await saveGuestLuggageNotice(token, {
        task_ids: taskIds,
        note: note || null,
        photo_urls: luggagePhotoUrls.slice(0, 3),
      })
      await patchWorkTaskItem(task.id, { guest_luggage: result.guest_luggage } as any)
      setLuggageNote(String(result.guest_luggage.note || ''))
      setLuggagePhotoUrls(result.guest_luggage.photo_urls || [])
      Alert.alert('已保存', '已通知相关清洁、检查、admin 和线下经理。')
    } catch (error: any) {
      Alert.alert('保存失败', String(error?.message || '请稍后重试'))
    } finally {
      setLuggageSaving(false)
    }
  }

  async function removeLuggage() {
    const noticeId = String((task as any)?.guest_luggage?.id || '').trim()
    if (!token || !task || !noticeId || luggageSaving) return
    try {
      setLuggageSaving(true)
      await deleteGuestLuggageNotice(token, noticeId)
      await patchWorkTaskItem(task.id, { guest_luggage: null } as any)
      setLuggageNote('')
      setLuggagePhotoUrls([])
      Alert.alert('已移除', '当天任务临时通知已移除。')
    } catch (error: any) {
      Alert.alert('移除失败', String(error?.message || '请稍后重试'))
    } finally {
      setLuggageSaving(false)
    }
  }

  if (!task) {
    return (
      <View style={styles.page}>
        <Text style={styles.muted}>{resolvingRemote ? t('common_loading') : t('common_error')}</Text>
      </View>
    )
  }

  const property = task.property
  const status = String(task.status || '')
  const cleaningStatus = String((task as any)?.cleaning_status || '')
  const inspectionStatus = String((task as any)?.inspection_status || '')
  const checkedOutAt = String((task as any)?.checked_out_at || '').trim()
  const hasKeyPhoto = !!String((task as any)?.key_photo_url || '').trim()
  const lockboxUrl = String((task as any)?.lockbox_video_url || '').trim()
  const taskType = String((task as any)?.task_type || '').trim().toLowerCase()
  const isStayoverTask = isStayoverTaskType(taskType)
  const isCheckoutLike = taskType === 'checkout_clean' || taskType === 'turnover' || !!String((task as any)?.start_time || '').trim()
  const inspectionMode = effectiveInspectionMode(task as any)
  const inspectionPlanText = inspectionModeLabel(inspectionMode, String((task as any)?.inspection_due_date || '').trim() || null)
  const isSelfComplete = isSelfCompleteMode(task as any) && (isCheckoutLike || isStayoverTask)
  const taskDate = String((task as any)?.scheduled_date || (task as any)?.date || '').trim()
  const isHistoricalTask = isBeforeToday(taskDate)
  const isTodayTask = taskDate.slice(0, 10) === ymd(new Date())
  const canEditGeneralInfo = canEditManagerFields && !saving && !isHistoricalTask
  const canEditLuggage = hasAnyRole(user, ['customer_service', 'admin', 'offline_manager']) && isTodayTask
  const canEditKeysOnly = canEditManagerFields && !saving

  const uncleanPhotos = inspectionItems.filter((x) => x.area === 'unclean')
  const roomPhotoAreas = ['living', 'sofa', 'bedroom', 'kitchen'] as const
  const roomPhotosByArea = roomPhotoAreas.map((a) => ({
    area: a,
    cleanerItems: completionItems.filter((x) => x.area === a),
    inspectorItems: inspectionItems.filter((x) => x.area === a),
  }))
  const livingRoomPhotoUrl = livingRoomPhotoUrls[0] || null
  const remoteTvRow = consumableItems.find((x) => x.item_id === 'remote_tv') || null
  const remoteAcRow = consumableItems.find((x) => x.item_id === 'remote_ac') || null
  const remoteTvPhotoUrl = normalizeUrlList(remoteTvRow?.photo_urls, remoteTvRow?.photo_url)[0] || null
  const remoteAcPhotoUrl = normalizeUrlList(remoteAcRow?.photo_urls, remoteAcRow?.photo_url)[0] || null
  const restockItems = Array.isArray((task as any)?.restock_items) ? ((task as any).restock_items as any[]) : []
  const consumableRestockPhotoRecords = consumableItems.filter((x) => {
    const itemId = String(x.item_id || '').trim()
    const photoUrls = normalizeUrlList(x.photo_urls, x.photo_url)
    if (!photoUrls.length) return false
    if (itemId === 'remote_tv' || itemId === 'remote_ac') return false
    if (CLEANING_SCENE_PHOTO_IDS.has(itemId)) return false
    return !!x.need_restock || String(x.status || '').trim().toLowerCase() === 'low' || restockItems.some((item) => String(item?.item_id || '').trim() === itemId)
  })
  const cleanerCompletionPhotoGroups = (() => {
    const groups: Array<{ key: string; label: string; urls: string[] }> = []
    const addGroup = (key: string, label: string, urls0: any) => {
      const urls = normalizeUrlList(urls0)
      if (!urls.length) return
      groups.push({ key, label, urls })
    }
    addGroup('living-room-photo', '客厅照片', livingRoomPhotoUrls)
    for (const area of ['toilet', 'living', 'sofa', 'bedroom', 'kitchen', 'shower_drain', 'vacuum_used']) {
      const urls = completionItems.filter((x) => x.area === area).map((x) => x.url)
      addGroup(`completion-${area}`, AREA_LABEL[area] || area, urls)
    }
    for (const itemId of Object.keys(CLEANING_SCENE_PHOTO_LABEL)) {
      const row = consumableItems.find((x) => x.item_id === itemId)
      addGroup(`scene-${itemId}`, CLEANING_SCENE_PHOTO_LABEL[itemId] || itemId, normalizeUrlList(row?.photo_urls, row?.photo_url))
    }
    return groups
  })()
  const restockPhotoGroups = (() => {
    const itemIds = uniqueTextList([
      ...restockItems.map((item) => item?.item_id),
      ...consumableRestockPhotoRecords.map((item) => item.item_id),
      ...restockProofs.map((item) => item.item_id),
    ])
    return itemIds.map((itemId, idx) => {
      const restockItem = restockItems.find((item) => String(item?.item_id || '').trim() === itemId) || null
      const cleanerRow = consumableRestockPhotoRecords.find((x) => x.item_id === itemId) || null
      const inspectorProof = restockProofs.find((x) => x.item_id === itemId) || null
      const label = String(restockItem?.label || cleanerRow?.item_label || itemId || `补品 ${idx + 1}`).trim()
      return {
        key: `${itemId || label}-${idx}`,
        itemId,
        label,
        cleanerPhotoUrls: normalizeUrlList(cleanerRow?.photo_urls, cleanerRow?.photo_url || restockItem?.photo_url),
        inspectorPhotoUrls: normalizeUrlList(inspectorProof?.proof_urls, inspectorProof?.proof_url),
      }
    })
  })()

  async function onToggleCheckedOut() {
    if (!token) return Alert.alert(t('common_error'), '请先登录')
    if (!canEditManagerFields) return
    if (!task) return
    const taskId = String(task.id)
    const nextCheckedOutAt = checkedOutAt ? null : new Date().toISOString()
    try {
      setMarking(true)
      const taskIds = checkoutTaskIdsFromTask(task)
      await patchWorkTaskItem(taskId, { checked_out_at: nextCheckedOutAt } as any)
      if (taskIds.length) {
        await markGuestCheckedOutByTasks(token, { task_ids: taskIds, action: checkedOutAt ? 'unset' : 'set' })
      } else {
        const orderId = String((task as any)?.order_id_checkout || (task as any)?.order_id || '').trim()
        if (!orderId) throw new Error('缺少订单ID')
        await markGuestCheckedOutByOrder(token, { order_id: orderId, action: checkedOutAt ? 'unset' : 'set' })
      }
      Alert.alert(t('common_ok'), checkedOutAt ? '已取消退房' : '已标记退房，已通知清洁人员')
    } catch (e: any) {
      await patchWorkTaskItem(taskId, { checked_out_at: checkedOutAt || null } as any)
      Alert.alert(t('common_error'), String(e?.message || '操作失败'))
    } finally {
      setMarking(false)
    }
  }

  return (
    <>
      <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingBottom: Math.max(16, insets.bottom) + 10 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.headRow}>
            <Text style={styles.title}>每日清洁</Text>
            <View style={styles.headPillsRow}>
              {isStayoverTask ? (
                <View style={[styles.pill, { backgroundColor: '#ECFDF5', borderWidth: hairline(), borderColor: '#A7F3D0' }]}>
                  <Text style={[styles.pillText, { color: '#047857' }]}>入住中清洁</Text>
                </View>
              ) : null}
              {!isStayoverTask ? (
                <View style={[styles.pill, inspectionMode === 'pending_decision' ? { backgroundColor: '#FEF3C7', borderWidth: hairline(), borderColor: '#F59E0B' } : { backgroundColor: '#EFF6FF', borderWidth: hairline(), borderColor: '#DBEAFE' }]}>
                  <Text style={[styles.pillText, inspectionMode === 'pending_decision' ? { color: '#B45309' } : { color: '#2563EB' }]}>{inspectionPlanText}</Text>
                </View>
              ) : null}
              <View style={styles.pill}>
                <Text style={styles.pillText}>{statusLabelZh(status, task)}</Text>
              </View>
            </View>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="home-outline" size={moderateScale(14)} color="#2563EB" />
            <Text style={styles.metaText} numberOfLines={2}>
              {property?.code || task.title}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>客服信息</Text>
            {!canEditManagerFields ? <Text style={styles.mutedSmall}>仅客服、admin、线下经理可编辑</Text> : null}
          </View>
          {isHistoricalTask ? <Text style={styles.mutedSmall}>历史任务仅可修改需挂钥匙套数；时间、密码、客需不可修改</Text> : null}
          <View style={styles.row2Compact}>
            <View style={styles.formHalf}>
              <Text style={styles.label}>退房时间</Text>
              <TextInput value={checkoutTime} onChangeText={setCheckoutTime} editable={canEditGeneralInfo} style={[styles.input, !canEditGeneralInfo ? styles.inputDisabled : null]} placeholder="例如 11am" placeholderTextColor="#9CA3AF" />
            </View>
            <View style={styles.formHalf}>
              <Text style={styles.label}>入住时间</Text>
              <TextInput value={checkinTime} onChangeText={setCheckinTime} editable={canEditGeneralInfo} style={[styles.input, !canEditGeneralInfo ? styles.inputDisabled : null]} placeholder="例如 2pm" placeholderTextColor="#9CA3AF" />
            </View>
          </View>
          <View style={styles.row2Compact}>
            <View style={styles.formHalf}>
              <Text style={styles.label}>旧密码</Text>
              <TextInput value={oldCode} onChangeText={setOldCode} editable={canEditGeneralInfo} style={[styles.input, !canEditGeneralInfo ? styles.inputDisabled : null]} placeholder="旧密码" placeholderTextColor="#9CA3AF" />
            </View>
            <View style={styles.formHalf}>
              <Text style={styles.label}>新密码</Text>
              <TextInput value={newCode} onChangeText={setNewCode} editable={canEditGeneralInfo} style={[styles.input, !canEditGeneralInfo ? styles.inputDisabled : null]} placeholder="新密码" placeholderTextColor="#9CA3AF" />
            </View>
          </View>
          {!isStayoverTask ? (
            <View style={styles.fieldCompact}>
              <Text style={styles.label}>需挂钥匙套数</Text>
              <View style={styles.pillsRow}>
                <Pressable
                  onPress={() => {
                    setKeysRequired(1)
                    setKeysDirty(true)
                  }}
                  disabled={!canEditKeysOnly}
                  style={({ pressed }) => [styles.pillBtn, keysRequired === 1 ? styles.pillBtnOn : null, pressed ? styles.pressed : null]}
                >
                  <Text style={[styles.pillBtnText, keysRequired === 1 ? styles.pillBtnTextOn : null]}>1 套</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setKeysRequired(2)
                    setKeysDirty(true)
                  }}
                  disabled={!canEditKeysOnly}
                  style={({ pressed }) => [styles.pillBtn, keysRequired === 2 ? styles.pillBtnOn : null, pressed ? styles.pressed : null]}
                >
                  <Text style={[styles.pillBtnText, keysRequired === 2 ? styles.pillBtnTextOn : null]}>2 套</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          <View style={styles.fieldCompact}>
            <Text style={styles.label}>客人特殊需求</Text>
            <TextInput
              value={guestNote}
              onChangeText={(v) => setGuestNote(v.slice(0, 1500))}
              editable={canEditGeneralInfo}
              style={[styles.input, styles.textarea, !canEditGeneralInfo ? styles.inputDisabled : null]}
              placeholder="备注（可选）"
              placeholderTextColor="#9CA3AF"
              multiline
            />
          </View>
          <Pressable
            onPress={onSave}
            disabled={!canEditManagerFields || saving}
            style={({ pressed }) => [styles.primaryBtnFull, !canEditManagerFields || saving ? styles.primaryBtnDisabled : null, pressed ? styles.pressed : null]}
          >
            <Text style={styles.primaryText}>{saving ? t('common_loading') : '保存修改'}</Text>
          </Pressable>
          <Pressable
            onPress={() => props.navigation.navigate('FeedbackForm', { taskId: task.id })}
            style={({ pressed }) => [styles.grayBtnFull, pressed ? styles.pressed : null]}
          >
            <Text style={styles.grayText}>房源问题反馈</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>当天任务临时通知</Text>
            {!canEditLuggage ? <Text style={styles.mutedSmall}>仅当天任务可编辑</Text> : null}
          </View>
          <Text style={styles.luggageWarning}>用于发布仅与当天任务有关的临时事项。保存后会醒目通知相关清洁和检查人员。</Text>
          <TextInput
            value={luggageNote}
            onChangeText={(value) => setLuggageNote(value.slice(0, 1500))}
            editable={canEditLuggage && !luggageSaving}
            style={[styles.input, styles.textarea, !canEditLuggage ? styles.inputDisabled : null]}
            placeholder="通知说明（可选），例如：客人物品放在客厅，请勿移动"
            placeholderTextColor="#9CA3AF"
            multiline
          />
          <View style={styles.luggagePhotos}>
            {luggagePhotoUrls.map((url, index) => (
              <View key={`${url}-${index}`} style={styles.luggagePhotoItem}>
                <Image source={buildCleaningMediaImageSource(token, url)} style={styles.luggagePhoto} />
                {canEditLuggage ? (
                  <Pressable
                    onPress={() => setLuggagePhotoUrls((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                    style={({ pressed }) => [styles.luggageRemovePhoto, pressed ? styles.pressed : null]}
                  >
                    <Ionicons name="close-circle" size={moderateScale(22)} color="#DC2626" />
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
          {canEditLuggage && luggagePhotoUrls.length < 3 ? (
            <View style={styles.row2Compact}>
              <Pressable
                onPress={() => addLuggagePhotos('camera')}
                disabled={luggageUploading || luggageSaving}
                style={({ pressed }) => [styles.grayBtnFull, styles.luggageAddButton, pressed ? styles.pressed : null]}
              >
                <Text style={styles.grayText}>{luggageUploading ? '上传中...' : '拍照'}</Text>
              </Pressable>
              <Pressable
                onPress={() => addLuggagePhotos('library')}
                disabled={luggageUploading || luggageSaving}
                style={({ pressed }) => [styles.grayBtnFull, styles.luggageAddButton, pressed ? styles.pressed : null]}
              >
                <Text style={styles.grayText}>从相册选择</Text>
              </Pressable>
            </View>
          ) : null}
          <Text style={styles.mutedSmall}>{`已选择 ${luggagePhotoUrls.length}/3 张，照片可选。`}</Text>
          {canEditLuggage ? (
            <View style={styles.luggageActions}>
              <Pressable
                onPress={saveLuggage}
                disabled={luggageSaving || luggageUploading || (!luggageNote.trim() && !luggagePhotoUrls.length)}
                style={({ pressed }) => [styles.primaryBtnFull, luggageSaving || luggageUploading || (!luggageNote.trim() && !luggagePhotoUrls.length) ? styles.primaryBtnDisabled : null, pressed ? styles.pressed : null]}
              >
                <Text style={styles.primaryText}>{luggageSaving ? '保存中...' : '保存并通知'}</Text>
              </Pressable>
              {(task as any)?.guest_luggage?.id ? (
                <Pressable
                  onPress={() => Alert.alert('确认移除？', '移除后执行人员将不再看到此临时通知。', [
                    { text: '取消', style: 'cancel' },
                    { text: '移除', style: 'destructive', onPress: removeLuggage },
                  ])}
                  disabled={luggageSaving}
                  style={({ pressed }) => [styles.grayBtnFull, pressed ? styles.pressed : null]}
                >
                  <Text style={[styles.grayText, { color: '#DC2626' }]}>移除提醒</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <GuestLuggageCard
            notice={(task as any)?.guest_luggage || null}
            showAcknowledgementSummary
            compact
          />
        </View>

        {!isStayoverTask ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>钥匙与挂钥匙视频</Text>
          <Text style={styles.mutedSmall}>这里展示已上传的钥匙照片、挂钥匙视频（如有）。</Text>
          {hasKeyPhoto ? (
            <Pressable
              onPress={() => {
                setViewerUrl(String((task as any)?.key_photo_url))
                setViewerOpen(true)
              }}
              style={({ pressed }) => [styles.mediaThumbWrap, pressed ? styles.pressed : null]}
            >
              <Image source={buildCleaningMediaImageSource(token, (task as any)?.key_photo_url)} style={styles.mediaThumb} />
              <Text style={styles.mediaLabel}>钥匙照片</Text>
            </Pressable>
          ) : null}
          {lockboxUrl ? (
            <View style={styles.videoWrap}>
              <Video source={{ uri: toAbsoluteUrl(lockboxUrl) }} style={styles.video} resizeMode={ResizeMode.CONTAIN} shouldPlay={false} useNativeControls />
              <Text style={styles.mediaLabel}>挂钥匙视频</Text>
            </View>
          ) : null}
          {!hasKeyPhoto && !lockboxUrl ? <Text style={styles.mutedSmall}>暂无钥匙照片或挂钥匙视频</Text> : null}
        </View>
        ) : null}

        {canSeeUnclean && !isStayoverTask ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>清洁问题照片（检查员拍摄）</Text>
            {photosLoading ? <Text style={styles.mutedSmall}>{t('common_loading')}</Text> : null}
            {uncleanPhotos.length ? (
              <View style={styles.grid}>
                {uncleanPhotos.map((x, idx) => (
                  <Pressable
                    key={`${x.url}-${idx}`}
                    onPress={() => {
                      setViewerUrl(x.url)
                      setViewerOpen(true)
                    }}
                    style={({ pressed }) => [styles.gridItem, pressed ? styles.pressed : null]}
                  >
                    <Image source={buildCleaningMediaImageSource(token, x.url)} style={styles.gridImg} />
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.mutedSmall}>暂无</Text>
            )}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>清洁现场照片</Text>
          {photosLoading ? <Text style={styles.mutedSmall}>{t('common_loading')}</Text> : null}
          <View style={styles.mediaStack}>
            <View style={styles.mediaSection}>
              <Text style={styles.columnTitle}>客厅照片</Text>
              {livingRoomPhotoUrl ? (
                <Pressable
                  onPress={() => {
                    setViewerUrl(livingRoomPhotoUrl)
                    setViewerOpen(true)
                  }}
                  style={({ pressed }) => [styles.fullWidthMediaCard, pressed ? styles.pressed : null]}
                >
                  <Image source={buildCleaningMediaImageSource(token, livingRoomPhotoUrl)} style={styles.fullWidthImg} />
                </Pressable>
              ) : (
                <Text style={styles.mutedSmall}>暂无</Text>
              )}
            </View>
            <View style={styles.mediaSection}>
              <Text style={styles.columnTitle}>遥控器照片</Text>
              {remoteTvPhotoUrl || remoteAcPhotoUrl ? (
                <View style={styles.grid}>
                  {remoteTvPhotoUrl ? (
                    <Pressable
                      onPress={() => {
                        setViewerUrl(remoteTvPhotoUrl)
                        setViewerOpen(true)
                      }}
                      style={({ pressed }) => [styles.gridItem, pressed ? styles.pressed : null]}
                    >
                      <Image source={buildCleaningMediaImageSource(token, remoteTvPhotoUrl)} style={styles.gridImg} />
                      <Text style={styles.mediaLabel}>电视遥控器</Text>
                    </Pressable>
                  ) : null}
                  {remoteAcPhotoUrl ? (
                    <Pressable
                      onPress={() => {
                        setViewerUrl(remoteAcPhotoUrl)
                        setViewerOpen(true)
                      }}
                      style={({ pressed }) => [styles.gridItem, pressed ? styles.pressed : null]}
                    >
                      <Image source={buildCleaningMediaImageSource(token, remoteAcPhotoUrl)} style={styles.gridImg} />
                      <Text style={styles.mediaLabel}>空调遥控器</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : (
                <Text style={styles.mutedSmall}>暂无</Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>清洁完成照片</Text>
          {photosLoading ? <Text style={styles.mutedSmall}>{t('common_loading')}</Text> : null}
          {cleanerCompletionPhotoGroups.length ? (
            cleanerCompletionPhotoGroups.map((g) => (
              <View key={g.key} style={styles.group}>
                <Text style={styles.groupTitle}>{g.label}</Text>
                <View style={styles.grid}>
                  {g.urls.map((url, idx) => (
                    <Pressable
                      key={`${g.key}-${url}-${idx}`}
                      onPress={() => {
                        setViewerUrl(url)
                        setViewerOpen(true)
                      }}
                      style={({ pressed }) => [styles.gridItem, pressed ? styles.pressed : null]}
                    >
                      <Image source={buildCleaningMediaImageSource(token, url)} style={styles.gridImg} />
                    </Pressable>
                  ))}
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.mutedSmall}>暂无</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>检查照片</Text>
          {photosLoading ? <Text style={styles.mutedSmall}>{t('common_loading')}</Text> : null}
          {roomPhotosByArea.map((g) => (
            <View key={`inspection-${g.area}`} style={styles.group}>
              <Text style={styles.groupTitle}>{AREA_LABEL[g.area] || g.area}</Text>
              {g.inspectorItems.length ? (
                <View style={styles.grid}>
                  {g.inspectorItems.map((x, idx) => (
                    <Pressable
                      key={`inspector-${g.area}-${x.url}-${idx}`}
                      onPress={() => {
                        setViewerUrl(x.url)
                        setViewerOpen(true)
                      }}
                      style={({ pressed }) => [styles.gridItem, pressed ? styles.pressed : null]}
                    >
                      <Image source={buildCleaningMediaImageSource(token, x.url)} style={styles.gridImg} />
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text style={styles.mutedSmall}>暂无</Text>
              )}
            </View>
          ))}
        </View>

        {!isStayoverTask ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>补品照片记录</Text>
          {photosLoading ? <Text style={styles.mutedSmall}>{t('common_loading')}</Text> : null}
          {restockPhotoGroups.length ? (
            restockPhotoGroups.map((group) => {
              return (
                <View key={group.key} style={styles.group}>
                  <Text style={styles.groupTitle}>{group.label}</Text>
                  <View style={styles.mediaStack}>
                    <View style={styles.mediaSection}>
                      <Text style={styles.columnTitle}>清洁拍的</Text>
                      {group.cleanerPhotoUrls.length ? (
                        <View style={styles.grid}>
                          {group.cleanerPhotoUrls.map((photoUrl, photoIdx) => (
                            <Pressable
                              key={`cleaner-proof-${group.itemId}-${photoIdx}`}
                              onPress={() => {
                                setViewerUrl(photoUrl)
                                setViewerOpen(true)
                              }}
                              style={({ pressed }) => [styles.gridItem, pressed ? styles.pressed : null]}
                            >
                              <Image source={buildCleaningMediaImageSource(token, photoUrl)} style={styles.gridImg} />
                            </Pressable>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.mutedSmall}>暂无</Text>
                      )}
                    </View>
                    <View style={styles.mediaSection}>
                      <Text style={styles.columnTitle}>检查补拍</Text>
                      {group.inspectorPhotoUrls.length ? (
                        <View style={styles.grid}>
                          {group.inspectorPhotoUrls.map((photoUrl, photoIdx) => (
                            <Pressable
                              key={`inspector-proof-${group.itemId}-${photoIdx}`}
                              onPress={() => {
                                setViewerUrl(photoUrl)
                                setViewerOpen(true)
                              }}
                              style={({ pressed }) => [styles.gridItem, pressed ? styles.pressed : null]}
                            >
                              <Image source={buildCleaningMediaImageSource(token, photoUrl)} style={styles.gridImg} />
                            </Pressable>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.mutedSmall}>暂无</Text>
                      )}
                    </View>
                  </View>
                </View>
              )
            })
          ) : (
            <Text style={styles.mutedSmall}>暂无补品照片记录</Text>
          )}
        </View>
        ) : null}
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
              <Image source={buildCleaningMediaImageSource(token, viewerUrl)} style={styles.viewerImg} resizeMode="contain" />
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F6F7FB' },
  content: { padding: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, borderWidth: hairline(), borderColor: '#EEF0F6', marginBottom: 12 },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  headPillsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', flexShrink: 1, maxWidth: '72%' },
  title: { flex: 1, minWidth: 0, flexShrink: 1, fontSize: 16, fontWeight: '900', color: '#111827' },
  pill: { minHeight: 28, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#EFF6FF', borderWidth: hairline(), borderColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', maxWidth: '100%' },
  pillText: { color: '#2563EB', fontWeight: '900', fontSize: 12, textAlign: 'center' },
  metaRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { flex: 1, minWidth: 0, color: '#111827', fontWeight: '900', flexShrink: 1 },
  addr: { marginTop: 6, color: '#6B7280', fontWeight: '700' },
  kvRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  kvLabel: { color: '#6B7280', fontWeight: '800' },
  kvValue: { color: '#111827', fontWeight: '900', flexShrink: 1 },

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  sectionTitle: { color: '#111827', fontWeight: '900' },
  muted: { color: '#6B7280', fontWeight: '700' },
  mutedSmall: { marginTop: 8, color: '#6B7280', fontWeight: '700', fontSize: 12 },
  field: { marginTop: 10 },
  fieldCompact: { marginTop: 8 },
  label: { color: '#111827', fontWeight: '900', marginBottom: 8 },
  input: { height: 44, borderRadius: 12, borderWidth: hairline(), borderColor: '#D1D5DB', paddingHorizontal: 12, fontWeight: '800', color: '#111827' },
  inputDisabled: { backgroundColor: '#F3F4F6', color: '#9CA3AF' },
  textarea: { height: 84, paddingTop: 12, textAlignVertical: 'top' },
  row2: { marginTop: 10, flexDirection: 'row', gap: 10 },
  row2Compact: { marginTop: 8, flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  formHalf: { flex: 1, minWidth: 130 },
  pillsRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  pillBtn: { flex: 1, height: 40, borderRadius: 12, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  pillBtnOn: { backgroundColor: '#EFF6FF', borderColor: '#DBEAFE' },
  pillBtnText: { color: '#6B7280', fontWeight: '900' },
  pillBtnTextOn: { color: '#2563EB' },

  checkoutBtn: { marginTop: 10, height: 40, borderRadius: 12, backgroundColor: '#E0F2FE', borderWidth: hairline(), borderColor: '#BAE6FD', alignItems: 'center', justifyContent: 'center' },
  checkoutBtnDisabled: { backgroundColor: '#BAE6FD' },
  checkoutText: { color: '#0369A1', fontWeight: '900' },

  grayBtnFull: { marginTop: 10, minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  grayText: { color: '#111827', fontWeight: '900', textAlign: 'center' },
  primaryBtnFull: { marginTop: 12, minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  primaryBtnDisabled: { backgroundColor: '#93C5FD' },
  primaryText: { color: '#FFFFFF', fontWeight: '900', textAlign: 'center' },
  pressed: { opacity: 0.92 },
  luggageWarning: { marginTop: 8, color: '#B91C1C', fontWeight: '800', fontSize: 12, lineHeight: 18 },
  luggagePhotos: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  luggagePhotoItem: { width: 92, height: 92, borderRadius: 12, overflow: 'hidden', borderWidth: hairline(), borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
  luggagePhoto: { width: '100%', height: '100%' },
  luggageRemovePhoto: { position: 'absolute', top: 3, right: 3, width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  luggageAddButton: { flex: 1, minWidth: 130, marginTop: 0 },
  luggageActions: { marginTop: 2 },

  mediaThumbWrap: { marginTop: 10, borderRadius: 14, overflow: 'hidden', borderWidth: hairline(), borderColor: '#EEF0F6', backgroundColor: '#F3F4F6' },
  mediaThumb: { width: '100%', height: 180 },
  mediaLabel: { marginTop: 8, color: '#6B7280', fontWeight: '800' },
  videoWrap: { marginTop: 10, borderRadius: 14, overflow: 'hidden', borderWidth: hairline(), borderColor: '#EEF0F6', backgroundColor: '#0B0F17', paddingBottom: 10 },
  video: { width: '100%', height: 220, backgroundColor: '#0B0F17' },

  group: { marginTop: 12, paddingTop: 12, borderTopWidth: hairline(), borderTopColor: '#EEF0F6' },
  groupTitle: { color: '#111827', fontWeight: '900' },
  mediaStack: { marginTop: 10, gap: 12 },
  mediaSection: { minWidth: 0 },
  columnTitle: { color: '#6B7280', fontWeight: '800', fontSize: 12, marginBottom: 8 },
  fullWidthMediaCard: { borderRadius: 14, overflow: 'hidden', borderWidth: hairline(), borderColor: '#EEF0F6', backgroundColor: '#F3F4F6' },
  fullWidthImg: { width: '100%', height: 180, backgroundColor: '#F3F4F6' },
  grid: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridItem: { flexBasis: '47%', flexGrow: 1, minWidth: 120, borderRadius: 14, overflow: 'hidden', borderWidth: hairline(), borderColor: '#EEF0F6', backgroundColor: '#F3F4F6' },
  gridImg: { width: '100%', height: 160, backgroundColor: '#F3F4F6' },

  viewerMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  viewerTopRow: { position: 'absolute', top: 0, left: 0, right: 0, height: 54, paddingHorizontal: 12, justifyContent: 'center', zIndex: 2 },
  viewerCloseText: { color: '#FFFFFF', fontWeight: '900' },
  viewerImg: { flex: 1 },
})
