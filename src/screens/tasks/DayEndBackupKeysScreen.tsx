import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { hairline, moderateScale } from '../../lib/scale'
import { listCleaningAppLinenTypes, listCleaningAppPropertyCodes, listCleaningAppTasks, listDayEndBackupKeys, listDayEndHandover, uploadCleaningMedia, uploadDayEndHandover } from '../../lib/api'
import { clearDayEndHandoverDraft, getDayEndHandoverDraft, persistDayEndDraftPhoto, processDayEndHandoverQueue, saveDayEndHandoverDraft, type DayEndHandoverDraft, type DayEndRejectDraftItem } from '../../lib/dayEndHandoverQueue'
import type { TasksStackParamList } from '../../navigation/RootNavigator'

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
  const m = String(e?.message || e || '').toLowerCase()
  if (!m) return false
  if (m.includes('network request failed')) return true
  if (m.includes('timeout')) return true
  if (m.includes('timed out')) return true
  if (m.includes('aborted')) return true
  return false
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
  return !!String(item.linen_type || '').trim() && !!String(item.used_room || '').trim() && Number(item.quantity || 0) > 0 && (item.photos || []).length > 0
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

function addDays(base: string, delta: number) {
  const raw = String(base || '').slice(0, 10)
  const dt = new Date(`${raw}T00:00:00`)
  if (Number.isNaN(dt.getTime())) return raw
  dt.setDate(dt.getDate() + delta)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
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
  const taskRoomCodes = Array.isArray(props.route.params.taskRoomCodes) ? props.route.params.taskRoomCodes : []
  const overviewMode = props.route.params.overviewMode === true
  const overviewUsers = Array.isArray(props.route.params.overviewUsers) ? props.route.params.overviewUsers : []
  const overviewUsersPending = useMemo(
    () => overviewUsers.map((entry) => ({ ...entry, complete: null as boolean | null })),
    [overviewUsers],
  )

  const roleNames = useMemo(() => roleNamesOf(user), [user])
  const isCleanerSelf = useMemo(() => roleNames.includes('cleaner') || roleNames.includes('cleaner_inspector'), [roleNames])
  const isInspectorSelf = useMemo(() => roleNames.includes('cleaning_inspector') || roleNames.includes('cleaner_inspector'), [roleNames])
  const isInspectorOnlySelf = useMemo(() => roleNames.includes('cleaning_inspector') && !roleNames.includes('cleaner') && !roleNames.includes('cleaner_inspector'), [roleNames])
  const isManagerViewer = useMemo(() => canManageDayEnd(roleNames), [roleNames])
  const viewingOtherUser = !!targetUserId && targetUserId !== currentUserId
  const isOverviewMode = isManagerViewer && overviewMode && !targetUserId
  const canEdit = (isCleanerSelf || isInspectorSelf) && !viewingOtherUser
  const canView = canEdit || isManagerViewer
  const canSubmit = canEdit && (isInspectorOnlySelf ? consumableItems.length > 0 : (keyItems.length > 0 && returnWashItems.length > 0)) && rejectItems.every(rejectItemComplete)
  const [overviewRows, setOverviewRows] = useState(() => overviewUsersPending)

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

  const load = useCallback(async () => {
    if (!token || !canView) return
    if (isOverviewMode) {
      setDraftReady(true)
      setLoading(false)
      setLoadError(null)
      return
    }
    try {
      setLoading(true)
      setLoadError(null)
      try {
        const list = await listCleaningAppLinenTypes(token)
        const next = filterRejectLinenTypeOptions((list || []).map((x) => ({ code: String(x.code || ''), name: String(x.name || '') })).filter((x) => !!x.name))
        if (next.length) setLinenTypeOptions(next)
      } catch {}
      const taskRoomOptions = dedupePropertyCodeOptions(taskRoomCodes.map((code, idx) => ({ id: `task_${idx}_${code}`, code })))
      try {
        let codes = taskRoomOptions
        if (!codes.length) codes = await listCleaningAppPropertyCodes(token)
        if (!codes?.length) {
          const taskList = await listCleaningAppTasks(token, {
            date_from: date,
            date_to: date,
            assignee_id: targetUserId || currentUserId || null,
          })
          codes = dedupePropertyCodeOptions(
            (taskList || []).map((task) => ({
              id: String(task.property?.id || task.id || ''),
              code: String(task.property?.code || '').trim(),
            })),
          )
        }
        setPropertyCodeOptions(dedupePropertyCodeOptions(codes || []))
      } catch {
        try {
          const taskList = await listCleaningAppTasks(token, {
            date_from: date,
            date_to: date,
            assignee_id: targetUserId || currentUserId || null,
          })
          setPropertyCodeOptions(
            dedupePropertyCodeOptions(
              (taskList || []).map((task) => ({
                id: String(task.property?.id || task.id || ''),
                code: String(task.property?.code || '').trim(),
              })),
            ),
          )
        } catch {}
      }
      let remoteKeyItems: PhotoItem[] = []
      let remoteReturnWashItems: PhotoItem[] = []
      let remoteWarehouseKeyItems: PhotoItem[] = []
      let remoteWarehouseKeyNotUsed = false
      let remoteConsumableItems: PhotoItem[] = []
      let remoteRejectItems: RejectItemState[] = []
      try {
        const r = await listDayEndHandover(token, { date, user_id: targetUserId || undefined })
        remoteKeyItems = toPhotoItems(r?.key_photos || [], 'key')
        remoteReturnWashItems = toPhotoItems((r as any)?.return_wash_photos || r?.dirty_linen_photos || [], 'return_wash')
        remoteWarehouseKeyItems = toPhotoItems((r as any)?.warehouse_key_photos || [], 'warehouse_key')
        remoteWarehouseKeyNotUsed = !!(r as any)?.no_warehouse_key
        remoteConsumableItems = toPhotoItems((r as any)?.consumable_photos || [], 'consumable')
        remoteRejectItems = toRejectItems((r as any)?.reject_items || [])
      } catch (e: any) {
        const msg = String(e?.message || '')
        if (!msg.includes('后端未部署该接口')) throw e
        const legacy = await listDayEndBackupKeys(token, { date, user_id: targetUserId || undefined })
        remoteKeyItems = toPhotoItems(legacy?.items || [], 'key')
        remoteReturnWashItems = []
        remoteRejectItems = []
      }
      if (canEdit && currentUserId) {
        const draft = await getDayEndHandoverDraft(currentUserId, date)
        if (draft) {
          persistEnabledRef.current = true
          setKeyItems(mergePhotoItems(remoteKeyItems, draft.key_items || []))
          setReturnWashItems(mergePhotoItems(remoteReturnWashItems, draft.return_wash_items || []))
          setWarehouseKeyItems(mergePhotoItems(remoteWarehouseKeyItems, (draft as any).warehouse_key_items || []))
          setWarehouseKeyNotUsed(!!((draft as any).no_warehouse_key || remoteWarehouseKeyNotUsed))
          setConsumableItems(mergePhotoItems(remoteConsumableItems, draft.consumable_items || []))
          setRejectItems(mergeRejectItems(remoteRejectItems, (draft.reject_items || []).map((item: DayEndRejectDraftItem) => ({
            id: item.id,
            linen_type: item.linen_type,
            quantity: String(item.quantity || 1),
            used_room: item.used_room,
            photos: item.photos || [],
          }))))
        } else {
          setKeyItems(remoteKeyItems)
          setReturnWashItems(remoteReturnWashItems)
          setWarehouseKeyItems(remoteWarehouseKeyItems)
          setWarehouseKeyNotUsed(remoteWarehouseKeyNotUsed)
          setConsumableItems(remoteConsumableItems)
          setRejectItems(remoteRejectItems)
        }
      } else {
        setKeyItems(remoteKeyItems)
        setReturnWashItems(remoteReturnWashItems)
        setWarehouseKeyItems(remoteWarehouseKeyItems)
        setWarehouseKeyNotUsed(remoteWarehouseKeyNotUsed)
        setConsumableItems(remoteConsumableItems)
        setRejectItems(remoteRejectItems)
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
  }, [canEdit, canView, currentUserId, date, isOverviewMode, t, targetUserId, taskRoomCodes, token])

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
  }, [date, isOverviewMode, overviewUsers, token])

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
    const label = kind === 'key' ? '日终交接-备用钥匙' : kind === 'return_wash' ? '日终交接-退洗床品' : kind === 'warehouse_key' ? '日终交接-仓库钥匙' : kind === 'consumable' ? '日终交接-剩余消耗品' : '日终交接-Reject床品'
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
    return (items || []).map((item) => ({
      linen_type: item.linen_type,
      quantity: Math.max(1, Number(item.quantity || 0) || 1),
      used_room: item.used_room,
      photos: photoPayload(item.photos),
    }))
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
    if (section === 'return_wash' && !photoPayload(returnWashItems).length) return '请先上传脏床品/退洗床品照片'
    if (section === 'warehouse_key' && !warehouseKeyNotUsed && !photoPayload(warehouseKeyItems).length) return '请上传仓库钥匙照片，或选择今天未使用仓库钥匙'
    if (section === 'consumable' && !photoPayload(consumableItems).length) return '请先上传剩余消耗品照片'
    if ((section === 'reject' || section === 'all') && !rejectItems.every(rejectItemComplete)) return '请补全 Reject 床品登记'
    if (section === 'all' && !isInspectorOnlySelf) {
      if (!photoPayload(keyItems).length) return '请先上传备用钥匙照片'
      if (!photoPayload(returnWashItems).length) return '请先上传脏床品/退洗床品照片'
    }
    if (section === 'all' && isInspectorOnlySelf && !photoPayload(consumableItems).length) return '请先上传剩余消耗品照片'
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
      Alert.alert(t('common_ok'), section === 'warehouse_key' && warehouseKeyNotUsed ? '仓库钥匙已标记为未使用' : '已提交并保存')
      await load()
    } catch (e: any) {
      if (isNetworkishError(e)) {
        persistEnabledRef.current = true
        await saveDraftSnapshot({ pendingSubmit: false })
        Alert.alert(t('common_ok'), '已离线保存，网络恢复后可再次提交')
        return
      }
      Alert.alert(t('common_error'), String(e?.message || '提交失败'))
    } finally {
      setSubmitting(false)
      setSubmittingSection(null)
    }
  }

  function persistSectionAfterCapture(section: DayEndSubmitSection, params: Parameters<typeof persistSection>[1]) {
    void persistSection(section, params).catch((e: any) => {
      if (isNetworkishError(e)) return
      Alert.alert(t('common_error'), `照片已上传，但即时保存失败：${String(e?.message || '请重新点击提交')}`)
    })
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
      res = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 1 })
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
    if (!canSubmit) return Alert.alert(t('common_error'), isInspectorOnlySelf ? '请先上传剩余消耗品照片，并补全 Reject 床品登记' : '请先上传备用钥匙照片、退洗床品照片，并补全 Reject 床品登记')
    if (uploading || submitting) return
    setSubmitting(true)
    try {
      const hasPendingReject = rejectItems.some((item) => item.photos.some((x) => !x.uploaded_url))
      const hasPending = keyItems.some((x) => !x.uploaded_url) || returnWashItems.some((x) => !x.uploaded_url) || warehouseKeyItems.some((x) => !x.uploaded_url) || consumableItems.some((x) => !x.uploaded_url) || hasPendingReject
      if (hasPending) {
        persistEnabledRef.current = true
        await saveDraftSnapshot({ pendingSubmit: true })
        const r = await processDayEndHandoverQueue(token)
        if (r.remaining > 0) {
          Alert.alert(t('common_ok'), '已离线保存，网络恢复后会自动补传并提交日终交接')
          props.navigation.goBack()
          return
        }
        Alert.alert(t('common_ok'), '已提交日终交接')
        props.navigation.goBack()
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
          throw new Error(isInspectorOnlySelf ? '后端还没部署新版检查员日终交接接口，当前页面只能先查看/拍照暂存，暂时无法正式提交剩余消耗品和 Reject 床品登记。' : '后端还没部署新版日终交接接口，当前页面只能先查看/拍照暂存，暂时无法正式提交退洗床品和 Reject 床品登记。')
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
        {items.map((it) => (
          <View key={it.id} style={styles.gridItem}>
            <Image source={{ uri: it.uploaded_url || it.uri }} style={styles.gridImg} />
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

  if (!canView) {
    return (
      <View style={[styles.page, styles.center]}>
        <Text style={styles.muted}>无权限查看日终交接</Text>
      </View>
    )
  }

  return (
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
                  onPress={() => props.navigation.push('DayEndBackupKeys', { date, userId: item.userId, userName: item.userName, taskRoomCodes: item.roomCodes })}
                  style={({ pressed }) => [styles.overviewItem, pressed ? styles.pressed : null]}
                >
                  <View style={styles.overviewMain}>
                    <Text style={styles.overviewName}>{item.userName || item.userId}</Text>
                    <Text style={styles.overviewMeta}>{item.roles.includes('cleaning') && item.roles.includes('inspection') ? '清洁 + 检查' : item.roles.includes('inspection') ? '检查' : '清洁'}</Text>
                    {item.roomCodes.length ? <Text style={styles.overviewRooms} numberOfLines={2}>{`房号：${item.roomCodes.join('、')}`}</Text> : null}
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
        <Text style={styles.mutedSmall}>{isInspectorOnlySelf ? '完成当天检查任务后，请提交自己剩余消耗品照片，并完成 Reject 床品登记。' : '完成当天清洁任务后，请提交备用钥匙照片、退洗床品照片，以及 Reject 床品登记。'}</Text>
        {taskRoomCodes.length ? <Text style={styles.mutedSmall}>{`今日任务房号：${taskRoomCodes.join('、')}`}</Text> : null}
        {!canEdit ? <Text style={styles.mutedSmall}>当前为查看模式。</Text> : null}
        {loading ? <Text style={styles.mutedSmall}>{t('common_loading')}</Text> : null}
        {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}
      </View>

      {isInspectorOnlySelf ? (
        <View
          style={styles.card}
          onLayout={(e) => {
            const y = e?.nativeEvent?.layout?.y
            setAnchorY((prev) => ({ ...prev, consumable: typeof y === 'number' ? y : prev.consumable }))
          }}
        >
          <Text style={styles.sectionTitle}>1. 剩余消耗品照片</Text>
          <Text style={styles.mutedSmall}>至少上传 1 张，拍当天检查结束后自己剩余的消耗品。</Text>
          {canEdit ? (
            <Pressable onPress={() => captureAndUpload('consumable')} style={({ pressed }) => [styles.sectionBtn, pressed ? styles.pressed : null]} disabled={uploading || submitting}>
              <Ionicons name="camera-outline" size={moderateScale(16)} color="#2563EB" />
              <Text style={styles.sectionBtnText}>拍剩余消耗品</Text>
            </Pressable>
          ) : null}
          {renderPhotoGrid(consumableItems, (id) => setConsumableItems((prev) => prev.filter((x) => x.id !== id)))}
          {canEdit ? (
            <Pressable
              onPress={() => onSubmitSection('consumable')}
              disabled={!photoPayload(consumableItems).length || uploading || submitting || !!submittingSection}
              style={({ pressed }) => [styles.sectionSubmitBtn, pressed ? styles.pressed : null, !photoPayload(consumableItems).length || uploading || submitting || !!submittingSection ? styles.sectionSubmitDisabled : null]}
            >
              <Text style={styles.sectionSubmitText}>{submittingSection === 'consumable' ? t('common_loading') : '提交剩余消耗品'}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
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
                <Text style={styles.sectionBtnText}>拍备用钥匙</Text>
              </Pressable>
            ) : null}
            {renderPhotoGrid(keyItems, removeKeyPhoto)}
            {canEdit ? (
              <Pressable
                onPress={() => onSubmitSection('key')}
                disabled={!photoPayload(keyItems).length || uploading || submitting || !!submittingSection}
                style={({ pressed }) => [styles.sectionSubmitBtn, pressed ? styles.pressed : null, !photoPayload(keyItems).length || uploading || submitting || !!submittingSection ? styles.sectionSubmitDisabled : null]}
              >
                <Text style={styles.sectionSubmitText}>{submittingSection === 'key' ? t('common_loading') : '提交备用钥匙'}</Text>
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
            <Text style={styles.sectionTitle}>2. 脏床品 / 退洗床品照片</Text>
            <Text style={styles.mutedSmall}>正常使用后的脏床品，退回工厂清洗时在仓库现场拍照留存。</Text>
            {canEdit ? (
              <Pressable onPress={() => captureAndUpload('return_wash')} style={({ pressed }) => [styles.sectionBtn, pressed ? styles.pressed : null]} disabled={uploading || submitting}>
                <Ionicons name="camera-outline" size={moderateScale(16)} color="#2563EB" />
                <Text style={styles.sectionBtnText}>拍退洗床品</Text>
              </Pressable>
            ) : null}
            {renderPhotoGrid(returnWashItems, removeReturnWashPhoto)}
            {canEdit ? (
              <Pressable
                onPress={() => onSubmitSection('return_wash')}
                disabled={!photoPayload(returnWashItems).length || uploading || submitting || !!submittingSection}
                style={({ pressed }) => [styles.sectionSubmitBtn, pressed ? styles.pressed : null, !photoPayload(returnWashItems).length || uploading || submitting || !!submittingSection ? styles.sectionSubmitDisabled : null]}
              >
                <Text style={styles.sectionSubmitText}>{submittingSection === 'return_wash' ? t('common_loading') : '提交脏床品 / 退洗'}</Text>
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
            <Text style={styles.mutedSmall}>如果今天用了仓库钥匙，请拍照提交；如果没用到仓库钥匙，可以标记“今天未使用”后直接提交。</Text>
            {canEdit ? (
              <View style={styles.sectionActionRow}>
                <Pressable onPress={() => captureAndUpload('warehouse_key')} style={({ pressed }) => [styles.sectionBtn, styles.sectionActionBtn, pressed ? styles.pressed : null]} disabled={uploading || submitting}>
                  <Ionicons name="camera-outline" size={moderateScale(16)} color="#2563EB" />
                  <Text style={styles.sectionBtnText}>拍仓库钥匙</Text>
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
                <Text style={styles.sectionSubmitText}>{submittingSection === 'warehouse_key' ? t('common_loading') : '提交仓库钥匙'}</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      )}

      <View
        style={styles.card}
        onLayout={(e) => {
          const y = e?.nativeEvent?.layout?.y
          setAnchorY((prev) => ({ ...prev, reject: typeof y === 'number' ? y : prev.reject }))
        }}
      >
        <Text style={styles.sectionTitle}>{isInspectorOnlySelf ? '2. Reject 床品登记' : '4. Reject 床品登记'}</Text>
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
                    <Text style={styles.addPhotoText}>拍照</Text>
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
  overviewStatusPill: { minWidth: 64, minHeight: 28, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  overviewStatusGray: { backgroundColor: '#E5E7EB' },
  overviewStatusGreen: { backgroundColor: '#DCFCE7' },
  overviewStatusAmber: { backgroundColor: '#FEF3C7' },
  overviewStatusText: { fontWeight: '900', fontSize: 12 },
  overviewStatusTextGray: { color: '#4B5563' },
  overviewStatusTextGreen: { color: '#15803D' },
  overviewStatusTextAmber: { color: '#B45309' },
  searchInput: { flex: 1, minWidth: 0, height: 44, color: '#111827', fontWeight: '800' },
  pressed: { opacity: 0.92 },
})
