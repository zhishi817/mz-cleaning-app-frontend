import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { API_BASE_URL } from '../../config/env'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { hairline, moderateScale } from '../../lib/scale'
import { isRetryableApiError, listCleaningAppLinenTypes, listCleaningAppPropertyCodes, listCleaningAppTasks, listDayEndBackupKeys, listDayEndHandover, listWorkTasks, uploadCleaningMedia, uploadDayEndHandover } from '../../lib/api'
import { clearDayEndHandoverDraft, getDayEndHandoverDraft, persistDayEndDraftPhoto, saveDayEndHandoverDraft, type DayEndHandoverDraft, type DayEndRejectDraftItem } from '../../lib/dayEndHandoverQueue'
import type { DayEndOverviewUser, DayEndRoleStats, DayEndTargetRole, TasksStackParamList } from '../../navigation/RootNavigator'

type Props = NativeStackScreenProps<TasksStackParamList, 'DayEndBackupKeys'>

type PhotoItem = {
  id: string
  uri: string
  captured_at: string
  uploaded_url: string | null
  watermark_text?: string
}

type RejectItemState = {
  id: string
  linen_type: string
  quantity: string
  used_room: string
  photos: PhotoItem[]
}

type LinenTypeOption = { code: string; name: string }
type DayEndSubmitSection = 'all' | 'key' | 'return_wash' | 'warehouse_key' | 'consumable' | 'reject'
type DayEndCaptureKind = 'key' | 'return_wash' | 'warehouse_key' | 'consumable' | 'reject'

const REJECT_HIDDEN_LINEN_TYPES = new Set(['推车', '推车liner', '推车 liner', '红色洗衣袋', '橘色袋子'])

const FALLBACK_LINEN_TYPES: LinenTypeOption[] = [
  { code: 'bedsheet', name: '床单' },
  { code: 'duvet_cover', name: '被套' },
  { code: 'pillowcase', name: '枕套' },
  { code: 'hand_towel', name: '手巾' },
  { code: 'bath_mat', name: '地巾' },
  { code: 'tea_towel', name: '茶巾' },
  { code: 'bath_towel', name: '浴巾' },
]

let cachedLinenTypeOptions: LinenTypeOption[] | null = null
let cachedPropertyCodeOptions: Array<{ id: string; code: string }> | null = null

function normalizeBase(raw: string) {
  return String(raw || '').trim().replace(/\/+$/g, '')
}

function toAbsoluteUrl(rawUrl: any) {
  const s = String(rawUrl || '').trim()
  if (!s) return ''
  if (/^(https?:|file:|content:|asset-library:|data:|ph:)/i.test(s)) return s
  const base = normalizeBase(API_BASE_URL)
  const stripAuth = base.replace(/\/auth\/?$/g, '')
  const stripApi = stripAuth.replace(/\/api\/?$/g, '')
  const root = stripApi || stripAuth || base
  if (!root) return s
  return `${root}${s.startsWith('/') ? s : `/${s}`}`
}

function makeLocalId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function toPhotoItems(items: Array<{ id?: string; url: string; captured_at?: string | null }>, prefix: string): PhotoItem[] {
  return (items || []).map((it, idx) => ({
    id: String(it.id || `${prefix}_${idx}`),
    uri: String(it.url || ''),
    captured_at: String(it.captured_at || new Date().toISOString()),
    uploaded_url: String(it.url || '').trim() || null,
  }))
}

function toRejectItems(items: Array<{ id?: string; linen_type?: string; quantity?: number; used_room?: string; photos?: Array<{ id?: string; url: string; captured_at?: string | null }> }>): RejectItemState[] {
  return (items || []).map((it, idx) => ({
    id: String(it.id || `reject_${idx}`),
    linen_type: String(it.linen_type || ''),
    quantity: String(it.quantity || 1),
    used_room: String(it.used_room || ''),
    photos: toPhotoItems(it.photos || [], `reject_${idx}`),
  }))
}

function mergePhotoItems(remoteItems: PhotoItem[], draftItems: PhotoItem[]) {
  const out: PhotoItem[] = []
  const seen = new Set<string>()
  for (const item of [...(draftItems || []), ...(remoteItems || [])]) {
    const key = String(item.uploaded_url || item.uri || item.id || '').trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

function mergeRejectItems(remoteItems: RejectItemState[], draftItems: RejectItemState[]) {
  const out: RejectItemState[] = []
  const seen = new Set<string>()
  for (const item of [...(draftItems || []), ...(remoteItems || [])]) {
    const key = String(item.id || '').trim() || `${item.linen_type}_${item.used_room}_${item.quantity}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

function isNetworkishError(e: any) {
  if (isRetryableApiError(e)) return true
  const code = String(e?.code || '').trim().toUpperCase()
  return code === 'TIMEOUT' || code === 'NETWORK_ERROR'
}

function roleNamesOf(user: any): string[] {
  const arr = Array.isArray(user?.roles) ? user.roles : []
  const ids = arr.map((x: any) => String(x || '').trim()).filter((x: string) => !!x)
  const primary = String(user?.role || '').trim()
  if (primary) ids.unshift(primary)
  return Array.from(new Set(ids))
}

function canManageDayEnd(roleNames: string[]) {
  const set = new Set((roleNames || []).map((x) => String(x || '').trim()).filter(Boolean))
  return set.has('admin') || set.has('offline_manager') || set.has('customer_service') || set.has('inventory_manager')
}

function rejectItemComplete(item: RejectItemState) {
  return !!String(item.linen_type || '').trim() && !!String(item.used_room || '').trim() && Number(item.quantity || 0) > 0 && (item.photos || []).some((photo) => !!String(photo.uploaded_url || '').trim())
}

function getPropertyCodeSuggestions(options: Array<{ id: string; code: string }>, query: string) {
  const normalized = String(query || '').trim().toLowerCase()
  const list = normalized
    ? options.filter((opt) => String(opt.code || '').toLowerCase().includes(normalized))
    : options
  return list.slice(0, 8)
}

function dedupePropertyCodeOptions(items: Array<{ id: string; code: string }>) {
  const out: Array<{ id: string; code: string }> = []
  const seen = new Set<string>()
  for (const item of items || []) {
    const code = String(item?.code || '').trim()
    if (!code) continue
    const key = code.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ id: String(item?.id || code), code })
  }
  return out.sort((a, b) => a.code.localeCompare(b.code, 'en'))
}

function filterRejectLinenTypeOptions(items: LinenTypeOption[]) {
  return (items || []).filter((item) => {
    const code = String(item?.code || '').trim().toLowerCase()
    const name = String(item?.name || '').trim().toLowerCase()
    if (!name) return false
    if (REJECT_HIDDEN_LINEN_TYPES.has(String(item?.name || '').trim())) return false
    if (code === 'cart' || code === 'cart_liner' || code === 'red_laundry_bag' || code === 'orange_bag') return false
    if (name === '推车' || name === '推车liner' || name === '推车 liner' || name === '红色洗衣袋' || name === '橘色袋子') return false
    return true
  })
}

async function loadLinenTypeOptionsCached(token: string) {
  if (cachedLinenTypeOptions?.length) return cachedLinenTypeOptions
  const list = await listCleaningAppLinenTypes(token)
  const next = filterRejectLinenTypeOptions((list || []).map((x) => ({ code: String(x.code || ''), name: String(x.name || '') })).filter((x) => !!x.name))
  if (next.length) cachedLinenTypeOptions = next
  return next
}

function normalizeDayEndRoles(items: any[]): DayEndTargetRole[] {
  const roles = new Set<DayEndTargetRole>()
  for (const item of Array.isArray(items) ? items : []) {
    if (item === 'cleaning' || item === 'inspection') roles.add(item)
  }
  return Array.from(roles.values()).sort()
}

function roleStatsLine(label: string, stats?: DayEndRoleStats | null) {
  if (!stats || stats.assigned <= 0) return ''
  const parts = [`${label} ${stats.done}/${stats.assigned}`]
  if (stats.activeRooms.length) parts.push(`进行中 ${stats.activeRooms.join('、')}`)
  else if (stats.pending > 0) parts.push(`待处理 ${stats.pending}`)
  if (stats.doneRooms.length) parts.push(`已完成 ${stats.doneRooms.join('、')}`)
  return parts.join(' · ')
}

function buildResolvedDayEndMeta(tasks: Array<any>, userId0: string) {
  const userId = String(userId0 || '').trim()
  const roles = new Set<DayEndTargetRole>()
  const roomCodes = new Set<string>()
  if (!userId) return { roles: [] as DayEndTargetRole[], roomCodes: [] as string[] }
  for (const task of tasks || []) {
    if (String(task?.source_type || '').trim() !== 'cleaning_tasks') continue
    const status = String(task?.status || '').trim().toLowerCase()
    if (status === 'cancelled' || status === 'canceled') continue
    const kind = String(task?.task_kind || '').trim().toLowerCase()
    const assignedUserId = kind === 'inspection'
      ? String(task?.inspector_id || task?.assignee_id || '').trim()
      : String(task?.cleaner_id || task?.assignee_id || '').trim()
    if (assignedUserId !== userId) continue
    if (kind === 'inspection') roles.add('inspection')
    else if (kind === 'cleaning') roles.add('cleaning')
    const code = String(task?.property?.code || '').trim()
    if (code) roomCodes.add(code)
  }
  return {
    roles: Array.from(roles.values()).sort(),
    roomCodes: Array.from(roomCodes.values()).sort((a, b) => a.localeCompare(b, 'en')),
  }
}

export default function DayEndBackupKeysScreen(props: Props) {
  const { t } = useI18n()
  const { token, user } = useAuth()
  const insets = useSafeAreaInsets()
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [keyItems, setKeyItems] = useState<PhotoItem[]>([])
  const [returnWashItems, setReturnWashItems] = useState<PhotoItem[]>([])
  const [warehouseKeyItems, setWarehouseKeyItems] = useState<PhotoItem[]>([])
  const [warehouseKeyNotUsed, setWarehouseKeyNotUsed] = useState(false)
  const [consumableItems, setConsumableItems] = useState<PhotoItem[]>([])
  const [rejectItems, setRejectItems] = useState<RejectItemState[]>([])
  const [submittingSection, setSubmittingSection] = useState<DayEndSubmitSection | null>(null)
  const [linenTypeOptions, setLinenTypeOptions] = useState<LinenTypeOption[]>(FALLBACK_LINEN_TYPES)
  const [propertyCodeOptions, setPropertyCodeOptions] = useState<Array<{ id: string; code: string }>>([])
  const [draftReady, setDraftReady] = useState(false)
  const [viewerUrls, setViewerUrls] = useState<string[]>([])
  const [viewerIndex, setViewerIndex] = useState(0)
  const persistEnabledRef = useRef(false)
  const lastLoadAlertRef = useRef('')
  const scrollRef = useRef<ScrollView>(null)
  const [anchorY, setAnchorY] = useState<{ key: number; returnWash: number; warehouseKey: number; consumable: number; reject: number }>({ key: 0, returnWash: 0, warehouseKey: 0, consumable: 0, reject: 0 })
  const currentUserId = String((user as any)?.id || '').trim()
  const username = String((user as any)?.username || (user as any)?.email || '').trim()
  const date = String(props.route.params.date || '').slice(0, 10)
  const targetUserId = String(props.route.params.userId || '').trim()
  const targetUserName = String(props.route.params.userName || '').trim()
  const focus = props.route.params.focus
  const routeTaskRoomCodes = useMemo(() => (Array.isArray(props.route.params.taskRoomCodes) ? props.route.params.taskRoomCodes : []), [props.route.params.taskRoomCodes])
  const routeTargetRoles = useMemo(() => normalizeDayEndRoles(props.route.params.targetRoles || []), [props.route.params.targetRoles])
  const routeTaskRoomCodesKey = routeTaskRoomCodes.join('|')
  const routeTargetRolesKey = routeTargetRoles.join('|')
  const overviewMode = props.route.params.overviewMode === true
  const overviewUsers = useMemo(
    () => (Array.isArray(props.route.params.overviewUsers) ? props.route.params.overviewUsers : []) as DayEndOverviewUser[],
    [props.route.params.overviewUsers],
  )
  const overviewUsersPending = useMemo(
    () => overviewUsers.map((entry) => ({ ...entry, complete: null as boolean | null })),
    [overviewUsers],
  )

  const roleNames = useMemo(() => roleNamesOf(user), [user])
  const isCleanerSelf = useMemo(() => roleNames.includes('cleaner') || roleNames.includes('cleaner_inspector'), [roleNames])
  const isInspectorSelf = useMemo(() => roleNames.includes('cleaning_inspector') || roleNames.includes('cleaner_inspector'), [roleNames])
  const isManagerViewer = useMemo(() => canManageDayEnd(roleNames), [roleNames])
  const viewingOtherUser = !!targetUserId && targetUserId !== currentUserId
  const isOverviewMode = isManagerViewer && overviewMode && !targetUserId
  const fallbackSelfRoles = useMemo(
    () => normalizeDayEndRoles([isCleanerSelf ? 'cleaning' : '', isInspectorSelf ? 'inspection' : '']),
    [isCleanerSelf, isInspectorSelf],
  )
  const [resolvedTargetRoles, setResolvedTargetRoles] = useState<DayEndTargetRole[]>(() => routeTargetRoles.length ? routeTargetRoles : fallbackSelfRoles)
  const [resolvedTaskRoomCodes, setResolvedTaskRoomCodes] = useState<string[]>(() => dedupePropertyCodeOptions(routeTaskRoomCodes.map((code, idx) => ({ id: `task_${idx}_${code}`, code }))).map((item) => item.code))
  const effectiveRoles = useMemo(
    () => (resolvedTargetRoles.length ? resolvedTargetRoles : fallbackSelfRoles),
    [fallbackSelfRoles, resolvedTargetRoles],
  )
  const effectiveHasCleaning = effectiveRoles.includes('cleaning')
  const effectiveHasInspection = effectiveRoles.includes('inspection')
  const effectiveInspectorOnly = effectiveHasInspection && !effectiveHasCleaning
  const consumableSectionIndex = effectiveHasCleaning ? 4 : 1
  const rejectSectionIndex = effectiveHasCleaning ? (effectiveHasInspection ? 5 : 4) : 2
  const canEdit = (isCleanerSelf || isInspectorSelf) && !viewingOtherUser
  const canView = canEdit || isManagerViewer
  const canSubmit = canEdit
    && (!effectiveHasCleaning || (photoPayload(keyItems).length > 0 && photoPayload(returnWashItems).length > 0))
    && (!effectiveHasInspection || photoPayload(consumableItems).length > 0)
    && rejectItems.every(rejectItemComplete)
  const [overviewRows, setOverviewRows] = useState(() => overviewUsersPending)

  useEffect(() => {
    if (routeTargetRoles.length) {
      setResolvedTargetRoles(routeTargetRoles)
      return
    }
    if (!token || isOverviewMode) return
    const lookupUserId = String(targetUserId || currentUserId || '').trim()
    if (!lookupUserId || !date) return
    let cancelled = false
    ;(async () => {
      try {
        const tasks = await listWorkTasks(token, { date_from: date, date_to: date, view: 'all' })
        if (cancelled) return
        const next = buildResolvedDayEndMeta(tasks, lookupUserId)
        if (next.roles.length) setResolvedTargetRoles(next.roles)
        else if (!targetUserId) setResolvedTargetRoles(fallbackSelfRoles)
        if (next.roomCodes.length && !routeTaskRoomCodes.length) setResolvedTaskRoomCodes(next.roomCodes)
      } catch {
        if (!cancelled && !targetUserId) setResolvedTargetRoles(fallbackSelfRoles)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [currentUserId, date, fallbackSelfRoles, isOverviewMode, routeTargetRoles, routeTargetRolesKey, routeTaskRoomCodes.length, targetUserId, token])

  useEffect(() => {
    if (routeTaskRoomCodes.length) {
      setResolvedTaskRoomCodes(dedupePropertyCodeOptions(routeTaskRoomCodes.map((code, idx) => ({ id: `task_${idx}_${code}`, code }))).map((item) => item.code))
    }
  }, [routeTaskRoomCodes, routeTaskRoomCodesKey])

  const buildDraft = useCallback(
    (params?: { pendingSubmit?: boolean; nextKeyItems?: PhotoItem[]; nextReturnWashItems?: PhotoItem[]; nextWarehouseKeyItems?: PhotoItem[]; nextWarehouseKeyNotUsed?: boolean; nextConsumableItems?: PhotoItem[]; nextRejectItems?: RejectItemState[] }): DayEndHandoverDraft => ({
      user_id: currentUserId,
      date,
      pending_submit: !!params?.pendingSubmit,
      key_items: (params?.nextKeyItems || keyItems).map((x) => ({ ...x })),
      return_wash_items: (params?.nextReturnWashItems || returnWashItems).map((x) => ({ ...x })),
      warehouse_key_items: (params?.nextWarehouseKeyItems || warehouseKeyItems).map((x) => ({ ...x })),
      no_warehouse_key: params?.nextWarehouseKeyNotUsed ?? warehouseKeyNotUsed,
      consumable_items: (params?.nextConsumableItems || consumableItems).map((x) => ({ ...x })),
      reject_items: (params?.nextRejectItems || rejectItems).map((item) => ({
        id: item.id,
        linen_type: item.linen_type,
        quantity: Math.max(1, Number(item.quantity || 0) || 1),
        used_room: item.used_room,
        photos: item.photos.map((x) => ({ ...x })),
      })),
      updated_at: new Date().toISOString(),
    }),
    [consumableItems, currentUserId, date, keyItems, rejectItems, returnWashItems, warehouseKeyItems, warehouseKeyNotUsed],
  )

  const saveDraftSnapshot = useCallback(
    async (params?: { pendingSubmit?: boolean; nextKeyItems?: PhotoItem[]; nextReturnWashItems?: PhotoItem[]; nextWarehouseKeyItems?: PhotoItem[]; nextWarehouseKeyNotUsed?: boolean; nextConsumableItems?: PhotoItem[]; nextRejectItems?: RejectItemState[] }) => {
      if (!canEdit || !currentUserId) return
      await saveDayEndHandoverDraft(buildDraft(params))
    },
    [buildDraft, canEdit, currentUserId],
  )

  const applyLoadedData = useCallback(
    (remote: {
      keyItems: PhotoItem[]
      returnWashItems: PhotoItem[]
      warehouseKeyItems: PhotoItem[]
      warehouseKeyNotUsed: boolean
      consumableItems: PhotoItem[]
      rejectItems: RejectItemState[]
    }, draft?: DayEndHandoverDraft | null) => {
      if (canEdit && draft) {
        persistEnabledRef.current = true
        setKeyItems(mergePhotoItems(remote.keyItems, draft.key_items || []))
        setReturnWashItems(mergePhotoItems(remote.returnWashItems, draft.return_wash_items || []))
        setWarehouseKeyItems(mergePhotoItems(remote.warehouseKeyItems, (draft as any).warehouse_key_items || []))
        setWarehouseKeyNotUsed(!!((draft as any).no_warehouse_key || remote.warehouseKeyNotUsed))
        setConsumableItems(mergePhotoItems(remote.consumableItems, draft.consumable_items || []))
        setRejectItems(mergeRejectItems(remote.rejectItems, (draft.reject_items || []).map((item: DayEndRejectDraftItem) => ({
          id: item.id,
          linen_type: item.linen_type,
          quantity: String(item.quantity || 1),
          used_room: item.used_room,
          photos: item.photos || [],
        }))))
        return
      }
      setKeyItems(remote.keyItems)
      setReturnWashItems(remote.returnWashItems)
      setWarehouseKeyItems(remote.warehouseKeyItems)
      setWarehouseKeyNotUsed(remote.warehouseKeyNotUsed)
      setConsumableItems(remote.consumableItems)
      setRejectItems(remote.rejectItems)
    },
    [canEdit],
  )

  const load = useCallback(async () => {
    if (!token || !canView) return
    if (isOverviewMode) {
      setDraftReady(true)
      setLoading(false)
      setLoadError(null)
      return
    }
    const emptyRemote = {
      keyItems: [] as PhotoItem[],
      returnWashItems: [] as PhotoItem[],
      warehouseKeyItems: [] as PhotoItem[],
      warehouseKeyNotUsed: false,
      consumableItems: [] as PhotoItem[],
      rejectItems: [] as RejectItemState[],
    }
    try {
      setLoading(true)
      setLoadError(null)

      const draft = canEdit && currentUserId ? await getDayEndHandoverDraft(currentUserId, date) : null
      if (draft) {
        applyLoadedData(emptyRemote, draft)
        setDraftReady(true)
        setLoading(false)
      }

      const taskRoomOptions = dedupePropertyCodeOptions(resolvedTaskRoomCodes.map((code, idx) => ({ id: `task_${idx}_${code}`, code })))
      const linenPromise = loadLinenTypeOptionsCached(token).catch(() => [] as LinenTypeOption[])
      const propertyCodePromise = (async () => {
        if (taskRoomOptions.length) return taskRoomOptions
        try {
          const taskList = await listCleaningAppTasks(token, {
            date_from: date,
            date_to: date,
            assignee_id: targetUserId || currentUserId || null,
          })
          const codes = dedupePropertyCodeOptions(
            (taskList || []).map((task) => ({
              id: String(task.property?.id || task.id || ''),
              code: String(task.property?.code || '').trim(),
            })),
          )
          if (codes.length) return codes
        } catch {}
        return cachedPropertyCodeOptions || []
      })()
      const remotePromise = (async () => {
        try {
          const r = await listDayEndHandover(token, { date, user_id: targetUserId || undefined })
          return {
            keyItems: toPhotoItems(r?.key_photos || [], 'key'),
            returnWashItems: toPhotoItems((r as any)?.return_wash_photos || r?.dirty_linen_photos || [], 'return_wash'),
            warehouseKeyItems: toPhotoItems((r as any)?.warehouse_key_photos || [], 'warehouse_key'),
            warehouseKeyNotUsed: !!(r as any)?.no_warehouse_key,
            consumableItems: toPhotoItems((r as any)?.consumable_photos || [], 'consumable'),
            rejectItems: toRejectItems((r as any)?.reject_items || []),
          }
        } catch (e: any) {
          const msg = String(e?.message || '')
          if (!msg.includes('后端未部署该接口')) throw e
          const legacy = await listDayEndBackupKeys(token, { date, user_id: targetUserId || undefined })
          return {
            ...emptyRemote,
            keyItems: toPhotoItems(legacy?.items || [], 'key'),
          }
        }
      })()

      const [linenOptions, propertyOptions, remoteData] = await Promise.all([linenPromise, propertyCodePromise, remotePromise])
      if (linenOptions.length) setLinenTypeOptions(linenOptions)
      if (propertyOptions.length) setPropertyCodeOptions(propertyOptions)
      applyLoadedData(remoteData, draft)

      if (!taskRoomOptions.length && !propertyOptions.length && !cachedPropertyCodeOptions?.length) {
        void listCleaningAppPropertyCodes(token)
          .then((codes) => {
            const next = dedupePropertyCodeOptions(codes || [])
            if (next.length) {
              cachedPropertyCodeOptions = next
              setPropertyCodeOptions(next)
            }
          })
          .catch(() => null)
      }
    } catch (e: any) {
      const message = String(e?.message || '加载失败')
      if (isNetworkishError(e)) {
        setLoadError(message)
      } else {
        setLoadError(message)
        if (lastLoadAlertRef.current !== message) {
          lastLoadAlertRef.current = message
          Alert.alert(t('common_error'), message)
        }
      }
    } finally {
      setDraftReady(true)
      setLoading(false)
    }
  }, [applyLoadedData, canEdit, canView, currentUserId, date, isOverviewMode, resolvedTaskRoomCodes, t, targetUserId, token])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (isOverviewMode) setOverviewRows(overviewUsersPending)
    if (!token || !isOverviewMode || !overviewUsers.length) return
    let cancelled = false
    ;(async () => {
      try {
        const rows = await Promise.all(overviewUsers.map(async (entry) => {
          try {
            const r = await listDayEndHandover(token, { date, user_id: entry.userId })
            const complete = !!(r as any)?.submitted_at
            return { ...entry, complete }
          } catch {
            return { ...entry, complete: null }
          }
        }))
        if (!cancelled) setOverviewRows(rows.sort((a, b) => Number(a.complete) - Number(b.complete) || String(a.userName || '').localeCompare(String(b.userName || ''), 'en')))
      } catch {}
    })()
    return () => {
      cancelled = true
    }
  }, [date, isOverviewMode, overviewUsers, overviewUsersPending, token])

  useEffect(() => {
    if (!focus) return
    const key = focus === 'dirty' ? 'returnWash' : focus
    const y = key === 'key'
      ? anchorY.key
      : key === 'returnWash'
        ? anchorY.returnWash
        : key === 'consumable'
          ? anchorY.consumable
          : key === 'reject'
            ? anchorY.reject
            : anchorY.key
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true })
    }, 80)
    return () => clearTimeout(timer)
  }, [anchorY, focus])

  useEffect(() => {
    if (!draftReady || !canEdit || !currentUserId || !persistEnabledRef.current) return
    saveDraftSnapshot().catch(() => {})
  }, [canEdit, consumableItems, currentUserId, draftReady, keyItems, rejectItems, returnWashItems, saveDraftSnapshot, warehouseKeyItems, warehouseKeyNotUsed])

  function buildWatermarkText(kind: DayEndCaptureKind, capturedAt: string) {
    const d = new Date(capturedAt)
    const pad2 = (n: number) => String(n).padStart(2, '0')
    const stamp = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
    const label = kind === 'key' ? '日终交接-备用钥匙' : kind === 'return_wash' ? '日终交接-脏床品' : kind === 'warehouse_key' ? '日终交接-仓库钥匙' : kind === 'consumable' ? '日终交接-剩余消耗品' : '日终交接-Reject床品'
    return `${username || '未知用户'}  ${label}\n${stamp}`
  }

  function updateRejectItem(itemId: string, patch: Partial<RejectItemState>) {
    setRejectItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, ...patch } : item)))
  }

  function updateRejectPhotos(itemId: string, updater: (photos: PhotoItem[]) => PhotoItem[]) {
    setRejectItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, photos: updater(Array.isArray(item.photos) ? item.photos : []) } : item)),
    )
  }

  function photoPayload(items: PhotoItem[]) {
    return (items || [])
      .map((x) => ({ url: String(x.uploaded_url || '').trim(), captured_at: x.captured_at }))
      .filter((x) => !!x.url)
  }

  function rejectPayload(items: RejectItemState[]) {
    return (items || [])
      .map((item) => {
        const photos = photoPayload(item.photos)
        return {
          linen_type: item.linen_type,
          quantity: Math.max(1, Number(item.quantity || 0) || 1),
          used_room: item.used_room,
          photos,
        }
      })
      .filter((item) => !!String(item.linen_type || '').trim() && !!String(item.used_room || '').trim() && item.quantity > 0 && item.photos.length > 0)
  }

  function openPhotoViewer(items: PhotoItem[], index: number) {
    const urls = (items || [])
      .map((item) => toAbsoluteUrl(item.uploaded_url || item.uri))
      .filter(Boolean)
    if (!urls.length) return
    setViewerUrls(urls)
    setViewerIndex(Math.max(0, Math.min(index, urls.length - 1)))
  }

  function closePhotoViewer() {
    setViewerUrls([])
    setViewerIndex(0)
  }

  function movePhotoViewer(delta: number) {
    setViewerIndex((prev) => {
      const count = viewerUrls.length
      if (!count) return 0
      return (prev + delta + count) % count
    })
  }

  async function persistSection(
    section: DayEndSubmitSection,
    params?: {
      nextKeyItems?: PhotoItem[]
      nextReturnWashItems?: PhotoItem[]
      nextWarehouseKeyItems?: PhotoItem[]
      nextWarehouseKeyNotUsed?: boolean
      nextConsumableItems?: PhotoItem[]
      nextRejectItems?: RejectItemState[]
    },
  ) {
    if (!token) throw new Error('请先登录')
    const nextKeyItems = params?.nextKeyItems || keyItems
    const nextReturnWashItems = params?.nextReturnWashItems || returnWashItems
    const nextWarehouseKeyItems = params?.nextWarehouseKeyItems || warehouseKeyItems
    const nextWarehouseKeyNotUsed = params?.nextWarehouseKeyNotUsed ?? warehouseKeyNotUsed
    const nextConsumableItems = params?.nextConsumableItems || consumableItems
    const nextRejectItems = params?.nextRejectItems || rejectItems
    await uploadDayEndHandover(token, {
      date,
      section,
      key_photos: photoPayload(nextKeyItems),
      return_wash_photos: photoPayload(nextReturnWashItems),
      dirty_linen_photos: photoPayload(nextReturnWashItems),
      warehouse_key_photos: photoPayload(nextWarehouseKeyItems),
      consumable_photos: photoPayload(nextConsumableItems),
      reject_items: rejectPayload(nextRejectItems),
      no_warehouse_key: nextWarehouseKeyNotUsed,
    })
    persistEnabledRef.current = true
    await saveDraftSnapshot({
      nextKeyItems,
      nextReturnWashItems,
      nextWarehouseKeyItems,
      nextWarehouseKeyNotUsed,
      nextConsumableItems,
      nextRejectItems,
    })
  }

  function validateSection(section: DayEndSubmitSection) {
    if (section === 'key' && !photoPayload(keyItems).length) return '请先上传备用钥匙照片'
    if (section === 'return_wash' && !photoPayload(returnWashItems).length) return '请先上传脏床品照片'
    if (section === 'warehouse_key' && !warehouseKeyNotUsed && !photoPayload(warehouseKeyItems).length) return '请上传仓库钥匙照片，或选择今天未使用仓库钥匙'
    if (section === 'consumable' && !photoPayload(consumableItems).length) return '请先上传剩余消耗品照片'
    if ((section === 'reject' || section === 'all') && !rejectItems.every(rejectItemComplete)) return '请补全 Reject 床品登记'
    if (section === 'all' && effectiveHasCleaning) {
      if (!photoPayload(keyItems).length) return '请先上传备用钥匙照片'
      if (!photoPayload(returnWashItems).length) return '请先上传脏床品照片'
    }
    if (section === 'all' && effectiveHasInspection && !photoPayload(consumableItems).length) return '请先上传剩余消耗品照片'
    return ''
  }

  async function onSubmitSection(section: DayEndSubmitSection) {
    if (!token) return Alert.alert(t('common_error'), '请先登录')
    if (!canEdit) return
    const invalid = validateSection(section)
    if (invalid) return Alert.alert(t('common_error'), invalid)
    if (uploading || submitting || submittingSection) return
    setSubmitting(true)
    setSubmittingSection(section)
    try {
      await persistSection(section)
      Alert.alert(t('common_ok'), section === 'warehouse_key' && warehouseKeyNotUsed ? '仓库钥匙记录已保存' : '照片已保存')
    } catch (e: any) {
      if (isNetworkishError(e)) {
        persistEnabledRef.current = true
        await saveDraftSnapshot({ pendingSubmit: false })
        Alert.alert(t('common_ok'), '已离线保存，网络恢复后可再次保存')
        return
      }
      Alert.alert(t('common_error'), String(e?.message || '提交失败'))
    } finally {
      setSubmitting(false)
      setSubmittingSection(null)
    }
  }

  function persistSectionAfterCapture(section: DayEndSubmitSection, params: Parameters<typeof persistSection>[1]) {
    void section
    persistEnabledRef.current = true
    void saveDraftSnapshot(params).catch(() => null)
  }

  function promptContinueCapture(kind: DayEndCaptureKind, rejectItemId?: string) {
    if (!canEdit) return
    Alert.alert('照片已添加', '需要继续拍下一张吗？', [
      { text: '完成', style: 'cancel' },
      { text: '继续拍', onPress: () => captureAndUpload(kind, rejectItemId) },
    ])
  }

  async function captureAndUpload(kind: DayEndCaptureKind, rejectItemId?: string) {
    if (!token) return Alert.alert(t('common_error'), '请先登录')
    if (!canEdit) return
    if (uploading || submitting) return
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync()
      if (!perm.granted) {
        Alert.alert('需要相机权限', '请在系统设置中允许相机权限后再拍照')
        return
      }
    } catch {}
    let res: ImagePicker.ImagePickerResult
    try {
      res = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.75, allowsEditing: false })
    } catch {
      Alert.alert(t('common_error'), '无法打开相机（请用真机测试）')
      return
    }
    if (res.canceled || !res.assets?.length) return
    const a = res.assets[0] as any
    const uri = String(a.uri || '').trim()
    if (!uri) return
    const capturedAt = new Date().toISOString()
    const watermarkText = buildWatermarkText(kind, capturedAt)
    const tempId = makeLocalId(kind)
    const tempItem: PhotoItem = { id: tempId, uri, captured_at: capturedAt, uploaded_url: null, watermark_text: watermarkText }
    persistEnabledRef.current = true
    if (kind === 'key') setKeyItems((prev) => [tempItem, ...prev])
    else if (kind === 'return_wash') setReturnWashItems((prev) => [tempItem, ...prev])
    else if (kind === 'warehouse_key') {
      setWarehouseKeyNotUsed(false)
      setWarehouseKeyItems((prev) => [tempItem, ...prev])
    }
    else if (kind === 'consumable') setConsumableItems((prev) => [tempItem, ...prev])
    else if (rejectItemId) updateRejectPhotos(rejectItemId, (photos) => [tempItem, ...photos])

    setUploading(true)
    try {
      const name = String(a.fileName || uri.split('/').pop() || `${kind}-${Date.now()}.jpg`)
      const mimeType = String(a.mimeType || 'image/jpeg')
      const purpose = kind === 'key' ? 'backup_key_return' : kind === 'return_wash' ? 'return_wash_linen' : kind === 'warehouse_key' ? 'warehouse_key_return' : kind === 'consumable' ? 'remaining_consumables' : 'reject_linen_return'
      const up = await uploadCleaningMedia(token, { uri, name, mimeType }, { purpose, captured_at: capturedAt, watermark: '1', watermark_text: watermarkText })
      if (kind === 'key') {
        setKeyItems((prev) => {
          const next = prev.map((x) => (x.id === tempId ? { ...x, uploaded_url: up.url } : x))
          persistSectionAfterCapture('key', { nextKeyItems: next })
          return next
        })
      } else if (kind === 'return_wash') {
        setReturnWashItems((prev) => {
          const next = prev.map((x) => (x.id === tempId ? { ...x, uploaded_url: up.url } : x))
          persistSectionAfterCapture('return_wash', { nextReturnWashItems: next })
          return next
        })
      } else if (kind === 'warehouse_key') {
        setWarehouseKeyItems((prev) => {
          const next = prev.map((x) => (x.id === tempId ? { ...x, uploaded_url: up.url } : x))
          persistSectionAfterCapture('warehouse_key', { nextWarehouseKeyItems: next, nextWarehouseKeyNotUsed: false })
          return next
        })
      } else if (kind === 'consumable') {
        setConsumableItems((prev) => {
          const next = prev.map((x) => (x.id === tempId ? { ...x, uploaded_url: up.url } : x))
          persistSectionAfterCapture('consumable', { nextConsumableItems: next })
          return next
        })
      }
      else if (rejectItemId) {
        updateRejectPhotos(rejectItemId, (photos) => photos.map((x) => (x.id === tempId ? { ...x, uploaded_url: up.url } : x)))
      }
      promptContinueCapture(kind, rejectItemId)
    } catch (e: any) {
      if (!isNetworkishError(e)) {
        if (kind === 'key') setKeyItems((prev) => prev.filter((x) => x.id !== tempId))
        else if (kind === 'return_wash') setReturnWashItems((prev) => prev.filter((x) => x.id !== tempId))
        else if (kind === 'warehouse_key') setWarehouseKeyItems((prev) => prev.filter((x) => x.id !== tempId))
        else if (kind === 'consumable') setConsumableItems((prev) => prev.filter((x) => x.id !== tempId))
        else if (rejectItemId) updateRejectPhotos(rejectItemId, (photos) => photos.filter((x) => x.id !== tempId))
        Alert.alert(t('common_error'), String(e?.message || '上传失败'))
        return
      }
      try {
        const queued = await persistDayEndDraftPhoto({ user_id: currentUserId, date, bucket: kind, source_uri: uri, captured_at: capturedAt, watermark_text: watermarkText })
        if (kind === 'key') setKeyItems((prev) => prev.map((x) => (x.id === tempId ? queued : x)))
        else if (kind === 'return_wash') setReturnWashItems((prev) => prev.map((x) => (x.id === tempId ? queued : x)))
        else if (kind === 'warehouse_key') setWarehouseKeyItems((prev) => prev.map((x) => (x.id === tempId ? queued : x)))
        else if (kind === 'consumable') setConsumableItems((prev) => prev.map((x) => (x.id === tempId ? queued : x)))
        else if (rejectItemId) {
          updateRejectPhotos(rejectItemId, (photos) => photos.map((x) => (x.id === tempId ? queued : x)))
        }
        Alert.alert(t('common_ok'), '已离线保存，网络恢复后自动上传')
      } catch (e2: any) {
        Alert.alert(t('common_error'), String(e2?.message || e?.message || '保存失败'))
      }
    } finally {
      setUploading(false)
    }
  }

  async function onSubmit() {
    if (!token) return Alert.alert(t('common_error'), '请先登录')
    if (!canSubmit) {
      const missing = [
        effectiveHasCleaning ? '备用钥匙照片' : '',
        effectiveHasCleaning ? '脏床品照片' : '',
        effectiveHasInspection ? '剩余消耗品照片' : '',
        'Reject 床品登记',
      ].filter(Boolean).join('、')
      return Alert.alert(t('common_error'), `请先补全${missing}`)
    }
    if (uploading || submitting) return
    setSubmitting(true)
    try {
      const hasPendingReject = rejectItems.some((item) => item.photos.some((x) => !x.uploaded_url))
      const hasPending = keyItems.some((x) => !x.uploaded_url) || returnWashItems.some((x) => !x.uploaded_url) || warehouseKeyItems.some((x) => !x.uploaded_url) || consumableItems.some((x) => !x.uploaded_url) || hasPendingReject
      if (hasPending) {
        persistEnabledRef.current = true
        await saveDraftSnapshot({ pendingSubmit: false })
        Alert.alert(t('common_error'), '还有照片未上传成功，请等待照片显示为“已上传”后再提交日终交接。')
        return
      }
      try {
        await uploadDayEndHandover(token, {
          date,
          key_photos: keyItems.map((x) => ({ url: String(x.uploaded_url || '').trim(), captured_at: x.captured_at })).filter((x) => !!x.url),
          return_wash_photos: returnWashItems.map((x) => ({ url: String(x.uploaded_url || '').trim(), captured_at: x.captured_at })).filter((x) => !!x.url),
          dirty_linen_photos: returnWashItems.map((x) => ({ url: String(x.uploaded_url || '').trim(), captured_at: x.captured_at })).filter((x) => !!x.url),
          warehouse_key_photos: warehouseKeyItems.map((x) => ({ url: String(x.uploaded_url || '').trim(), captured_at: x.captured_at })).filter((x) => !!x.url),
          consumable_photos: consumableItems.map((x) => ({ url: String(x.uploaded_url || '').trim(), captured_at: x.captured_at })).filter((x) => !!x.url),
          no_warehouse_key: warehouseKeyNotUsed,
          reject_items: rejectItems.map((item) => ({
            linen_type: item.linen_type,
            quantity: Math.max(1, Number(item.quantity || 0) || 1),
            used_room: item.used_room,
            photos: item.photos.map((x) => ({ url: String(x.uploaded_url || '').trim(), captured_at: x.captured_at })).filter((x) => !!x.url),
          })),
        })
      } catch (e: any) {
        const msg = String(e?.message || '')
        if (msg.includes('后端未部署该接口')) {
          throw new Error(
            effectiveInspectorOnly
              ? '后端还没部署新版检查员日终交接接口，当前页面只能先查看/拍照暂存，暂时无法正式提交剩余消耗品和 Reject 床品登记。'
              : (effectiveHasCleaning && effectiveHasInspection
                ? '后端还没部署新版清洁/检查日终交接接口，当前页面只能先查看/拍照暂存，暂时无法正式提交完整的日终交接记录。'
                : '后端还没部署新版日终交接接口，当前页面只能先查看/拍照暂存，暂时无法正式提交脏床品和 Reject 床品登记。'),
          )
        }
        throw e
      }
      if (currentUserId) await clearDayEndHandoverDraft(currentUserId, date)
      Alert.alert(t('common_ok'), '已提交日终交接')
      props.navigation.goBack()
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '提交失败'))
    } finally {
      setSubmitting(false)
    }
  }

  function renderPhotoGrid(items: PhotoItem[], onRemove: (id: string) => void) {
    if (!items.length) return <Text style={styles.muted}>暂无照片</Text>
    return (
      <View style={styles.grid}>
        {items.map((it, index) => (
          <View key={it.id} style={styles.gridItem}>
            <Pressable onPress={() => openPhotoViewer(items, index)} style={({ pressed }) => [styles.gridImgPress, pressed ? styles.pressed : null]}>
              <Image source={{ uri: toAbsoluteUrl(it.uploaded_url || it.uri) }} style={styles.gridImg} resizeMode="contain" />
            </Pressable>
            <View style={styles.gridFoot}>
              <Text style={styles.gridMeta} numberOfLines={1}>{it.uploaded_url ? '已上传' : '已离线保存'}</Text>
              {canEdit ? (
                <Pressable onPress={() => onRemove(it.id)} style={({ pressed }) => [styles.removeBtn, pressed ? styles.pressed : null]} disabled={uploading || submitting}>
                  <Text style={styles.removeText}>删除</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    )
  }

  function removeRejectPhoto(itemId: string, photoId: string) {
    setRejectItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, photos: item.photos.filter((x) => x.id !== photoId) } : item)))
  }

  function removeKeyPhoto(photoId: string) {
    setKeyItems((prev) => {
      const next = prev.filter((x) => x.id !== photoId)
      if (photoPayload(next).length) void persistSection('key', { nextKeyItems: next }).catch(() => null)
      else void saveDraftSnapshot({ nextKeyItems: next }).catch(() => null)
      return next
    })
  }

  function removeReturnWashPhoto(photoId: string) {
    setReturnWashItems((prev) => {
      const next = prev.filter((x) => x.id !== photoId)
      if (photoPayload(next).length) void persistSection('return_wash', { nextReturnWashItems: next }).catch(() => null)
      else void saveDraftSnapshot({ nextReturnWashItems: next }).catch(() => null)
      return next
    })
  }

  function removeWarehouseKeyPhoto(photoId: string) {
    setWarehouseKeyItems((prev) => {
      const next = prev.filter((x) => x.id !== photoId)
      if (photoPayload(next).length || warehouseKeyNotUsed) void persistSection('warehouse_key', { nextWarehouseKeyItems: next }).catch(() => null)
      else void saveDraftSnapshot({ nextWarehouseKeyItems: next }).catch(() => null)
      return next
    })
  }

  function renderConsumableCard() {
    return (
      <View
        style={styles.card}
        onLayout={(e) => {
          const y = e?.nativeEvent?.layout?.y
          setAnchorY((prev) => ({ ...prev, consumable: typeof y === 'number' ? y : prev.consumable }))
        }}
      >
        <Text style={styles.sectionTitle}>{`${consumableSectionIndex}. 剩余消耗品照片`}</Text>
        <Text style={styles.mutedSmall}>至少上传 1 张，拍当天检查结束后自己剩余的消耗品。</Text>
        {canEdit ? (
          <Pressable onPress={() => captureAndUpload('consumable')} style={({ pressed }) => [styles.sectionBtn, pressed ? styles.pressed : null]} disabled={uploading || submitting}>
            <Ionicons name="camera-outline" size={moderateScale(16)} color="#2563EB" />
            <Text style={styles.sectionBtnText}>{consumableItems.length ? '继续拍剩余消耗品' : '拍剩余消耗品'}</Text>
          </Pressable>
        ) : null}
        {renderPhotoGrid(consumableItems, (id) => setConsumableItems((prev) => prev.filter((x) => x.id !== id)))}
        {canEdit ? (
          <Pressable
            onPress={() => onSubmitSection('consumable')}
            disabled={!photoPayload(consumableItems).length || uploading || submitting || !!submittingSection}
            style={({ pressed }) => [styles.sectionSubmitBtn, pressed ? styles.pressed : null, !photoPayload(consumableItems).length || uploading || submitting || !!submittingSection ? styles.sectionSubmitDisabled : null]}
          >
            <Text style={styles.sectionSubmitText}>{submittingSection === 'consumable' ? t('common_loading') : '保存剩余消耗品照片'}</Text>
          </Pressable>
        ) : null}
      </View>
    )
  }

  if (!canView) {
    return (
      <View style={[styles.page, styles.center]}>
        <Text style={styles.muted}>无权限查看日终交接</Text>
      </View>
    )
  }

  return (
    <>
    <ScrollView ref={scrollRef} style={styles.page} contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
      {isOverviewMode ? (
        <>
          <View style={styles.card}>
            <Text style={styles.title}>今日日终交接总览</Text>
            <Text style={styles.mutedSmall}>{`日期：${date || '-'}`}</Text>
            <Text style={styles.mutedSmall}>查看今天清洁员和检查员的日终交接提交状态，点进可查看具体内容。</Text>
          </View>

          <View style={styles.card}>
            {!overviewRows.length ? <Text style={styles.muted}>加载中...</Text> : null}
            <View style={styles.overviewList}>
              {overviewRows.map((item) => (
                <Pressable
                  key={item.userId}
                  onPress={() => props.navigation.push('DayEndBackupKeys', { date, userId: item.userId, userName: item.userName, taskRoomCodes: item.roomCodes, targetRoles: item.roles })}
                  style={({ pressed }) => [styles.overviewItem, pressed ? styles.pressed : null]}
                >
                  <View style={styles.overviewMain}>
                    <Text style={styles.overviewName}>{item.userName || item.userId}</Text>
                    <Text style={styles.overviewMeta}>{item.roles.includes('cleaning') && item.roles.includes('inspection') ? '清洁 + 检查' : item.roles.includes('inspection') ? '检查' : '清洁'}</Text>
                    {item.roomCodes.length ? <Text style={styles.overviewRooms} numberOfLines={2}>{`房号：${item.roomCodes.join('、')}`}</Text> : null}
                    {roleStatsLine('清洁', item.stats?.cleaning) ? <Text style={styles.overviewProgress}>{roleStatsLine('清洁', item.stats?.cleaning)}</Text> : null}
                    {roleStatsLine('检查', item.stats?.inspection) ? <Text style={styles.overviewProgress}>{roleStatsLine('检查', item.stats?.inspection)}</Text> : null}
                  </View>
                  <View style={[styles.overviewStatusPill, item.complete == null ? styles.overviewStatusGray : (item.complete ? styles.overviewStatusGreen : styles.overviewStatusAmber)]}>
                    <Text style={[styles.overviewStatusText, item.complete == null ? styles.overviewStatusTextGray : (item.complete ? styles.overviewStatusTextGreen : styles.overviewStatusTextAmber)]}>{item.complete == null ? '加载中' : (item.complete ? '已提交' : '未提交')}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        </>
      ) : (
        <>
      <View style={styles.card}>
        <Text style={styles.title}>日终交接</Text>
        <Text style={styles.mutedSmall}>{`日期：${date || '-'}`}</Text>
        {targetUserName ? <Text style={styles.mutedSmall}>{`人员：${targetUserName}`}</Text> : null}
        <Text style={styles.mutedSmall}>
          {effectiveHasCleaning && effectiveHasInspection
            ? '完成当天清洁和检查任务后，请提交备用钥匙、脏床品、仓库钥匙记录、剩余消耗品，以及 Reject 床品登记。'
            : (effectiveInspectorOnly
              ? '完成当天检查任务后，请提交剩余消耗品照片，并完成 Reject 床品登记。'
              : '完成当天清洁任务后，请提交备用钥匙、脏床品、仓库钥匙记录，以及 Reject 床品登记。')}
        </Text>
        {resolvedTaskRoomCodes.length ? <Text style={styles.mutedSmall}>{`今日任务房号：${resolvedTaskRoomCodes.join('、')}`}</Text> : null}
        {!canEdit ? <Text style={styles.mutedSmall}>当前为查看模式。</Text> : null}
        {loading ? <Text style={styles.mutedSmall}>{t('common_loading')}</Text> : null}
        {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}
      </View>

      {!effectiveHasCleaning && effectiveHasInspection ? renderConsumableCard() : null}

      {effectiveHasCleaning ? (
        <>
          <View
            style={styles.card}
            onLayout={(e) => {
              const y = e?.nativeEvent?.layout?.y
              setAnchorY((prev) => ({ ...prev, key: typeof y === 'number' ? y : prev.key }))
            }}
          >
            <Text style={styles.sectionTitle}>1. 备用钥匙照片</Text>
            <Text style={styles.mutedSmall}>至少上传 1 张，作为当天钥匙已放回的凭证。</Text>
            {canEdit ? (
              <Pressable onPress={() => captureAndUpload('key')} style={({ pressed }) => [styles.sectionBtn, pressed ? styles.pressed : null]} disabled={uploading || submitting}>
                <Ionicons name="camera-outline" size={moderateScale(16)} color="#2563EB" />
                <Text style={styles.sectionBtnText}>{keyItems.length ? '继续拍备用钥匙' : '拍备用钥匙'}</Text>
              </Pressable>
            ) : null}
            {renderPhotoGrid(keyItems, removeKeyPhoto)}
            {canEdit ? (
              <Pressable
                onPress={() => onSubmitSection('key')}
                disabled={!photoPayload(keyItems).length || uploading || submitting || !!submittingSection}
                style={({ pressed }) => [styles.sectionSubmitBtn, pressed ? styles.pressed : null, !photoPayload(keyItems).length || uploading || submitting || !!submittingSection ? styles.sectionSubmitDisabled : null]}
              >
                <Text style={styles.sectionSubmitText}>{submittingSection === 'key' ? t('common_loading') : '保存备用钥匙照片'}</Text>
              </Pressable>
            ) : null}
          </View>

          <View
            style={styles.card}
            onLayout={(e) => {
              const y = e?.nativeEvent?.layout?.y
              setAnchorY((prev) => ({ ...prev, returnWash: typeof y === 'number' ? y : prev.returnWash }))
            }}
          >
            <Text style={styles.sectionTitle}>2. 脏床品照片</Text>
            <Text style={styles.mutedSmall}>正常使用后的脏床品，在仓库现场拍照留存。</Text>
            {canEdit ? (
              <Pressable onPress={() => captureAndUpload('return_wash')} style={({ pressed }) => [styles.sectionBtn, pressed ? styles.pressed : null]} disabled={uploading || submitting}>
                <Ionicons name="camera-outline" size={moderateScale(16)} color="#2563EB" />
                <Text style={styles.sectionBtnText}>{returnWashItems.length ? '继续拍脏床品' : '拍脏床品'}</Text>
              </Pressable>
            ) : null}
            {renderPhotoGrid(returnWashItems, removeReturnWashPhoto)}
            {canEdit ? (
              <Pressable
                onPress={() => onSubmitSection('return_wash')}
                disabled={!photoPayload(returnWashItems).length || uploading || submitting || !!submittingSection}
                style={({ pressed }) => [styles.sectionSubmitBtn, pressed ? styles.pressed : null, !photoPayload(returnWashItems).length || uploading || submitting || !!submittingSection ? styles.sectionSubmitDisabled : null]}
              >
                <Text style={styles.sectionSubmitText}>{submittingSection === 'return_wash' ? t('common_loading') : '保存脏床品照片'}</Text>
              </Pressable>
            ) : null}
          </View>

          <View
            style={styles.card}
            onLayout={(e) => {
              const y = e?.nativeEvent?.layout?.y
              setAnchorY((prev) => ({ ...prev, warehouseKey: typeof y === 'number' ? y : prev.warehouseKey }))
            }}
          >
            <Text style={styles.sectionTitle}>3. 仓库钥匙照片</Text>
            <Text style={styles.mutedSmall}>如果今天用了仓库钥匙，请拍照保存；如果没用到仓库钥匙，可以标记“今天未使用”后保存记录。</Text>
            {canEdit ? (
              <View style={styles.sectionActionRow}>
                <Pressable onPress={() => captureAndUpload('warehouse_key')} style={({ pressed }) => [styles.sectionBtn, styles.sectionActionBtn, pressed ? styles.pressed : null]} disabled={uploading || submitting}>
                  <Ionicons name="camera-outline" size={moderateScale(16)} color="#2563EB" />
                  <Text style={styles.sectionBtnText}>{warehouseKeyItems.length ? '继续拍仓库钥匙' : '拍仓库钥匙'}</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    const next = !warehouseKeyNotUsed
                    setWarehouseKeyNotUsed(next)
                    persistEnabledRef.current = true
                    void saveDraftSnapshot({ nextWarehouseKeyNotUsed: next }).catch(() => null)
                  }}
                  style={({ pressed }) => [styles.sectionBtn, styles.sectionActionBtn, warehouseKeyNotUsed ? styles.sectionBtnSelected : null, pressed ? styles.pressed : null]}
                  disabled={uploading || submitting}
                >
                  <Ionicons name={warehouseKeyNotUsed ? 'checkmark-circle-outline' : 'remove-circle-outline'} size={moderateScale(16)} color={warehouseKeyNotUsed ? '#16A34A' : '#2563EB'} />
                  <Text style={[styles.sectionBtnText, warehouseKeyNotUsed ? styles.sectionBtnSelectedText : null]}>{warehouseKeyNotUsed ? '已标记未使用' : '今天未使用'}</Text>
                </Pressable>
              </View>
            ) : null}
            {renderPhotoGrid(warehouseKeyItems, removeWarehouseKeyPhoto)}
            {canEdit ? (
              <Pressable
                onPress={() => onSubmitSection('warehouse_key')}
                disabled={(!warehouseKeyNotUsed && !photoPayload(warehouseKeyItems).length) || uploading || submitting || !!submittingSection}
                style={({ pressed }) => [styles.sectionSubmitBtn, pressed ? styles.pressed : null, (!warehouseKeyNotUsed && !photoPayload(warehouseKeyItems).length) || uploading || submitting || !!submittingSection ? styles.sectionSubmitDisabled : null]}
              >
                <Text style={styles.sectionSubmitText}>{submittingSection === 'warehouse_key' ? t('common_loading') : '保存仓库钥匙记录'}</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      ) : null}

      {effectiveHasCleaning && effectiveHasInspection ? renderConsumableCard() : null}

      <View
        style={styles.card}
        onLayout={(e) => {
          const y = e?.nativeEvent?.layout?.y
          setAnchorY((prev) => ({ ...prev, reject: typeof y === 'number' ? y : prev.reject }))
        }}
      >
        <Text style={styles.sectionTitle}>{`${rejectSectionIndex}. Reject 床品登记`}</Text>
        <Text style={styles.mutedSmall}>不合格床品要退给工厂退款时，在仓库登记床品类型、数量、使用房号，并上传不合格床品退回照片。</Text>
        {canEdit ? (
          <Pressable
            onPress={() => {
              const id = makeLocalId('reject_item')
              setRejectItems((prev) => [...prev, { id, linen_type: linenTypeOptions[0]?.name || '', quantity: '1', used_room: '', photos: [] }])
              setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60)
            }}
            style={({ pressed }) => [styles.sectionBtn, pressed ? styles.pressed : null]}
            disabled={uploading || submitting}
          >
            <Ionicons name="add-circle-outline" size={moderateScale(16)} color="#2563EB" />
            <Text style={styles.sectionBtnText}>新增 Reject</Text>
          </Pressable>
        ) : null}
        {!rejectItems.length ? <Text style={styles.muted}>今天没有 Reject 床品可不填。</Text> : null}
        <View style={styles.rejectList}>
          {rejectItems.map((item, index) => (
            <View key={item.id} style={styles.rejectCard}>
              <View style={styles.rejectHead}>
                <Text style={styles.rejectTitle}>{`Reject ${index + 1}`}</Text>
                {canEdit ? (
                  <Pressable onPress={() => setRejectItems((prev) => prev.filter((x) => x.id !== item.id))} style={({ pressed }) => [styles.removeBtn, pressed ? styles.pressed : null]}>
                    <Text style={styles.removeText}>删除</Text>
                  </Pressable>
                ) : null}
              </View>
              <Text style={styles.fieldLabel}>床品类型</Text>
              <View style={styles.chipWrap}>
                {linenTypeOptions.map((opt) => (
                  <Pressable key={opt.code || opt.name} onPress={() => canEdit && updateRejectItem(item.id, { linen_type: opt.name })} style={({ pressed }) => [styles.chip, item.linen_type === opt.name ? styles.chipActive : null, pressed ? styles.pressed : null]}>
                    <Text style={[styles.chipText, item.linen_type === opt.name ? styles.chipTextActive : null]}>{opt.name}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.fieldLabel}>使用房号</Text>
              {propertyCodeOptions.length ? (
                <View style={styles.chipWrap}>
                  {propertyCodeOptions.map((opt) => (
                    <Pressable
                      key={`${item.id}_${opt.id || opt.code}`}
                      onPress={() => canEdit && updateRejectItem(item.id, { used_room: opt.code })}
                      style={({ pressed }) => [styles.chip, item.used_room === opt.code ? styles.chipActive : null, pressed ? styles.pressed : null]}
                    >
                      <Text style={[styles.chipText, item.used_room === opt.code ? styles.chipTextActive : null]}>{opt.code}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text style={styles.mutedSmall}>今天暂无可选任务房号</Text>
              )}
              <Text style={styles.helperText}>请选择今天实际使用该床品的任务房号。</Text>
              <Text style={styles.fieldLabel}>数量</Text>
              <TextInput
                value={item.quantity}
                onChangeText={(v) => canEdit && updateRejectItem(item.id, { quantity: v.replace(/[^\d]/g, '') || '' })}
                keyboardType="number-pad"
                editable={canEdit}
                placeholder="数量"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
              />
              <View style={styles.inlineRow}>
                <Text style={styles.fieldLabel}>不合格床品退回照片上传</Text>
                {canEdit ? (
                  <Pressable onPress={() => captureAndUpload('reject', item.id)} style={({ pressed }) => [styles.addPhotoBtn, pressed ? styles.pressed : null]} disabled={uploading || submitting}>
                    <Ionicons name="camera-outline" size={moderateScale(15)} color="#2563EB" />
                    <Text style={styles.addPhotoText}>{item.photos.length ? '继续拍照' : '拍照'}</Text>
                  </Pressable>
                ) : null}
              </View>
              {renderPhotoGrid(item.photos, (photoId) => removeRejectPhoto(item.id, photoId))}
            </View>
          ))}
        </View>
      </View>

      {canEdit ? (
        <Pressable
          onPress={onSubmit}
          disabled={!canSubmit || uploading || submitting}
          style={({ pressed }) => [styles.submitBtn, pressed ? styles.pressed : null, !canSubmit || uploading || submitting ? styles.submitBtnDisabled : null]}
        >
          <Text style={styles.submitText}>{submitting ? t('common_loading') : '提交日终交接'}</Text>
        </Pressable>
      ) : null}
        </>
      )}
    </ScrollView>
    <Modal visible={!!viewerUrls.length} transparent animationType="fade" onRequestClose={closePhotoViewer}>
      <View style={styles.viewerBackdrop}>
        <View style={[styles.viewerTop, { paddingTop: Math.max(insets.top, 12) }]}>
          <Text style={styles.viewerCount}>{viewerUrls.length ? `${viewerIndex + 1} / ${viewerUrls.length}` : ''}</Text>
          <Pressable onPress={closePhotoViewer} style={({ pressed }) => [styles.viewerCloseBtn, pressed ? styles.pressed : null]}>
            <Text style={styles.viewerCloseText}>关闭</Text>
          </Pressable>
        </View>
        <View style={styles.viewerBody}>
          {viewerUrls.length > 1 ? (
            <Pressable onPress={() => movePhotoViewer(-1)} style={({ pressed }) => [styles.viewerNavBtn, styles.viewerNavLeft, pressed ? styles.pressed : null]}>
              <Ionicons name="chevron-back" size={moderateScale(28)} color="#FFFFFF" />
            </Pressable>
          ) : null}
          {viewerUrls[viewerIndex] ? (
            <Image source={{ uri: viewerUrls[viewerIndex] }} style={styles.viewerImage} resizeMode="contain" />
          ) : null}
          {viewerUrls.length > 1 ? (
            <Pressable onPress={() => movePhotoViewer(1)} style={({ pressed }) => [styles.viewerNavBtn, styles.viewerNavRight, pressed ? styles.pressed : null]}>
              <Ionicons name="chevron-forward" size={moderateScale(28)} color="#FFFFFF" />
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F6F7FB' },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, borderWidth: hairline(), borderColor: '#EEF0F6', marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '900', color: '#111827' },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: '#111827' },
  muted: { marginTop: 10, color: '#6B7280', fontWeight: '700' },
  mutedSmall: { marginTop: 8, color: '#6B7280', fontWeight: '700', fontSize: 12 },
  errorText: { marginTop: 8, color: '#B91C1C', fontWeight: '800', fontSize: 12 },
  sectionBtn: { marginTop: 12, minHeight: 40, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#EFF6FF', borderWidth: hairline(), borderColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  sectionBtnText: { color: '#2563EB', fontWeight: '900', textAlign: 'center' },
  sectionBtnSelected: { backgroundColor: '#ECFDF5', borderColor: '#BBF7D0' },
  sectionBtnSelectedText: { color: '#16A34A' },
  sectionActionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sectionActionBtn: { flexGrow: 1, flexBasis: '47%', minWidth: 130 },
  sectionSubmitBtn: { marginTop: 12, minHeight: 42, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center' },
  sectionSubmitDisabled: { backgroundColor: '#A7F3D0' },
  sectionSubmitText: { color: '#FFFFFF', fontWeight: '900', textAlign: 'center' },
  grid: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridItem: { flexBasis: '47%', flexGrow: 1, minWidth: 120, borderRadius: 14, overflow: 'hidden', borderWidth: hairline(), borderColor: '#EEF0F6', backgroundColor: '#F9FAFB' },
  gridImgPress: { width: '100%', height: 160, backgroundColor: '#F3F4F6' },
  gridImg: { width: '100%', height: 160, backgroundColor: '#F3F4F6' },
  gridFoot: { padding: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  gridMeta: { color: '#6B7280', fontWeight: '800', flex: 1, minWidth: 0 },
  removeBtn: { height: 28, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#FEF2F2', borderWidth: hairline(), borderColor: '#FCA5A5', alignItems: 'center', justifyContent: 'center' },
  removeText: { color: '#B91C1C', fontWeight: '900', fontSize: 12 },
  rejectList: { marginTop: 10, gap: 12 },
  rejectCard: { borderWidth: hairline(), borderColor: '#E5E7EB', borderRadius: 14, padding: 12, backgroundColor: '#F9FAFB' },
  rejectHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  rejectTitle: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: '900', color: '#111827' },
  fieldLabel: { marginTop: 10, color: '#374151', fontWeight: '800', fontSize: 12 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { height: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: hairline(), borderColor: '#D1D5DB', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { color: '#374151', fontWeight: '800', fontSize: 12 },
  chipTextActive: { color: '#FFFFFF' },
  input: { marginTop: 8, height: 42, borderRadius: 12, borderWidth: hairline(), borderColor: '#D1D5DB', backgroundColor: '#FFFFFF', paddingHorizontal: 12, color: '#111827', fontWeight: '800' },
  searchInputWrap: { marginTop: 8, height: 42, borderRadius: 12, borderWidth: hairline(), borderColor: '#D1D5DB', backgroundColor: '#FFFFFF', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  helperText: { marginTop: 6, color: '#6B7280', fontWeight: '700', fontSize: 12 },
  suggestList: { marginTop: 8, borderRadius: 12, borderWidth: hairline(), borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', overflow: 'hidden' },
  suggestRow: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 12, borderBottomWidth: hairline(), borderBottomColor: '#EEF0F6' },
  suggestText: { color: '#111827', fontWeight: '800' },
  inlineRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  addPhotoBtn: { minHeight: 32, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: hairline(), borderColor: '#BFDBFE', backgroundColor: '#EFF6FF', flexDirection: 'row', alignItems: 'center', gap: 6 },
  addPhotoText: { color: '#2563EB', fontWeight: '900', fontSize: 12, textAlign: 'center' },
  submitBtn: { marginTop: 4, minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center' },
  submitBtnDisabled: { backgroundColor: '#A7F3D0' },
  submitText: { color: '#FFFFFF', fontWeight: '900', textAlign: 'center' },
  overviewList: { gap: 10 },
  overviewItem: { borderRadius: 14, borderWidth: hairline(), borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', padding: 12, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  overviewMain: { flex: 1, minWidth: 0 },
  overviewName: { color: '#111827', fontWeight: '900', fontSize: 14 },
  overviewMeta: { marginTop: 4, color: '#2563EB', fontWeight: '800', fontSize: 12 },
  overviewRooms: { marginTop: 6, color: '#6B7280', fontWeight: '700', fontSize: 12, lineHeight: 18 },
  overviewProgress: { marginTop: 4, color: '#4B5563', fontWeight: '700', fontSize: 12, lineHeight: 18 },
  overviewStatusPill: { minWidth: 64, minHeight: 28, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  overviewStatusGray: { backgroundColor: '#E5E7EB' },
  overviewStatusGreen: { backgroundColor: '#DCFCE7' },
  overviewStatusAmber: { backgroundColor: '#FEF3C7' },
  overviewStatusText: { fontWeight: '900', fontSize: 12 },
  overviewStatusTextGray: { color: '#4B5563' },
  overviewStatusTextGreen: { color: '#15803D' },
  overviewStatusTextAmber: { color: '#B45309' },
  searchInput: { flex: 1, minWidth: 0, height: 44, color: '#111827', fontWeight: '800' },
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  viewerTop: { minHeight: 56, paddingHorizontal: 16, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  viewerCount: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
  viewerCloseBtn: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  viewerCloseText: { color: '#FFFFFF', fontWeight: '900' },
  viewerBody: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '100%' },
  viewerNavBtn: { position: 'absolute', zIndex: 2, top: '42%', width: 48, height: 72, borderRadius: 24, backgroundColor: 'rgba(17,24,39,0.42)', alignItems: 'center', justifyContent: 'center' },
  viewerNavLeft: { left: 10 },
  viewerNavRight: { right: 10 },
  pressed: { opacity: 0.92 },
})
