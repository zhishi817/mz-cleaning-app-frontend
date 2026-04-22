import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Dimensions, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useIsFocused } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { hairline, moderateScale } from '../../lib/scale'
import { getJson, setJson } from '../../lib/storage'
import { getWorkTasksSnapshot } from '../../lib/workTasksStore'
import {
  completePropertyFeedbackProject,
  createPropertyFeedback,
  createPropertyFeedbackBatch,
  createPropertyFeedbackProject,
  listDailyNecessityOptions,
  listPropertyFeedbacks,
  updatePropertyFeedback,
  updatePropertyFeedbackProject,
  uploadCleaningMedia,
  type DailyNecessityOption,
  type PropertyFeedback,
  type PropertyFeedbackProject,
} from '../../lib/api'
import type { TasksStackParamList } from '../../navigation/RootNavigator'
import { API_BASE_URL } from '../../config/env'

type Props = NativeStackScreenProps<TasksStackParamList, 'FeedbackForm'>
type Kind = 'maintenance' | 'deep_cleaning' | 'daily_necessities'
type ActionMode = 'create' | 'edit' | 'complete'
type TimePickerTarget = 'project_started_at' | 'project_ended_at' | 'draft_started_at' | 'draft_ended_at'
type AreaOption = (typeof AREA_OPTIONS)[number]
type DeepCleaningAreaOption = (typeof DEEP_CLEANING_AREA_OPTIONS)[number]
type DailyStatusOption = (typeof DAILY_STATUS_OPTIONS)[number]['value']

type MaintenanceDraft = {
  clientId: string
  area: AreaOption | null
  detail: string
  media: string[]
  submitAsCompleted: boolean
  completionNote: string
  completionAfterPhotos: string[]
}

type DeepCleaningDraft = {
  clientId: string
  area: DeepCleaningAreaOption | null
  detail: string
  media: string[]
  submitAsCompleted: boolean
  completionNote: string
  completionAfterPhotos: string[]
  completionStartedAt: string | null
  completionEndedAt: string | null
}

type DailyDraft = {
  clientId: string
  status: DailyStatusOption
  itemName: string
  itemSku?: string | null
  qty: string
  note: string
  media: string[]
}

const AREA_OPTIONS = ['入户走廊', '客厅', '厨房', '卧室', '阳台', '浴室', '其他'] as const
const DEEP_CLEANING_AREA_OPTIONS = ['入户走廊', '客厅', '厨房', '卧室', '阳台', '浴室', '全屋', '其他'] as const
const DAILY_STATUS_OPTIONS = [
  { value: 'need_replace', label: '需更换' },
  { value: 'replaced', label: '已更换' },
  { value: 'no_action', label: '无需更换' },
] as const

const DAILY_OPTIONS_CACHE_KEY = 'feedback_daily_necessity_options_v1'
const FEEDBACK_HISTORY_CACHE_TTL_MS = 3 * 60 * 1000
function feedbackHistoryCacheKey(propertyId: string, propertyCode: string) {
  return `feedback_history_open_${String(propertyId || '').trim()}_${String(propertyCode || '').trim()}`
}

type FeedbackHistoryCache = {
  pending: PropertyFeedback[]
  resolved: PropertyFeedback[]
  updated_at: number
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
  if (/^[\w.-]+\.[a-z]{2,}/i.test(s0)) return `https://${s0}`
  return s0
}

function normalizeUrls(raw: any): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map((x) => String(x || '').trim()).filter(Boolean).map(toAbsoluteUrl)
  const s = String(raw || '').trim()
  if (!s) return []
  try {
    const j = JSON.parse(s)
    if (Array.isArray(j)) return j.map((x) => String(x || '').trim()).filter(Boolean).map(toAbsoluteUrl)
  } catch {}
  return [toAbsoluteUrl(s)]
}

function fmtTime(s: string | null | undefined) {
  const raw = String(s || '').trim()
  if (!raw) return '-'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  const pad2 = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function fmtTimeOnly(s: string | null | undefined) {
  const raw = String(s || '').trim()
  if (!raw) return '请选择时间'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  const pad2 = (n: number) => String(n).padStart(2, '0')
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function setIsoTime(baseIso: string | null | undefined, hour: number, minute: number) {
  const base = String(baseIso || '').trim()
  const d = base ? new Date(base) : new Date()
  if (Number.isNaN(d.getTime())) {
    const next = new Date()
    next.setHours(hour, minute, 0, 0)
    return next.toISOString()
  }
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

function parseHourMinute(raw: string | null | undefined) {
  const base = String(raw || '').trim()
  if (!base) return { hour: 9, minute: 0 }
  const d = new Date(base)
  if (Number.isNaN(d.getTime())) return { hour: 9, minute: 0 }
  return { hour: d.getHours(), minute: d.getMinutes() }
}

function extractContentText(raw: any) {
  const s0 = String(raw ?? '').trim()
  if (!s0) return ''
  if (!(s0.startsWith('{') || s0.startsWith('['))) return s0
  try {
    const j = JSON.parse(s0)
    if (Array.isArray(j)) return j.map((x: any) => String(x?.content || x || '').trim()).filter(Boolean).join('；')
    return String(j?.content || '').trim()
  } catch {
    return s0
  }
}

function dailyOptionSearchText(item: DailyNecessityOption) {
  return [item.item_name, item.sku, item.category].map((x) => String(x || '').trim().toLowerCase()).filter(Boolean).join(' ')
}

function dailyOptionMeta(item: DailyNecessityOption) {
  return [item.sku, item.category].map((x) => String(x || '').trim()).filter(Boolean).join('  ·  ')
}

function dedupeDailyOptions(items: DailyNecessityOption[]) {
  const byName = new Map<string, DailyNecessityOption>()
  for (const item of items) {
    const nameKey = String(item.item_name || '').trim().toLowerCase()
    if (!nameKey) continue
    const existing = byName.get(nameKey)
    if (!existing) {
      byName.set(nameKey, item)
      continue
    }
    const existingSku = String(existing.sku || '').trim()
    const nextSku = String(item.sku || '').trim()
    if (!existingSku && nextSku) {
      byName.set(nameKey, item)
    }
  }
  return Array.from(byName.values())
}

function statusLabel(item?: PropertyFeedback | null) {
  if (!item) return '-'
  const s = String(item.status || '').trim()
  if (s === 'need_replace') return '待更换'
  if (s === 'replaced') return '已更换'
  if (s === 'no_action') return '无需更换'
  if (s === 'resolved' && String(item.review_status || '').trim() === 'pending') return '已完成（待复核）'
  if (s === 'resolved') return '已完成'
  if (s === 'in_progress') return '处理中'
  return '待处理'
}

function projectStatusLabel(item?: PropertyFeedbackProject | null, feedback?: PropertyFeedback | null) {
  if (!item) return '-'
  if (item.status === 'completed' && String(feedback?.review_status || '').trim() === 'pending') return '已完成（待复核）'
  if (item.status === 'completed') return '已完成'
  return '待处理'
}

function groupByKind(list: PropertyFeedback[]) {
  const deduped = uniqFeedbacks(list)
  return {
    maintenance: deduped.filter((x) => x.kind === 'maintenance'),
    deep: deduped.filter((x) => x.kind === 'deep_cleaning'),
    daily: deduped.filter((x) => x.kind === 'daily_necessities'),
  }
}

function uniqFeedbacks(list: PropertyFeedback[]) {
  const seen = new Set<string>()
  const out: PropertyFeedback[] = []
  for (const item of list) {
    const key = `${String(item.kind || '').trim()}:${String(item.id || '').trim()}`
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

function buildDefaultProject(kind: 'maintenance' | 'deep_cleaning'): PropertyFeedbackProject {
  return {
    id: '',
    name: '',
    area: null,
    category: kind === 'maintenance' ? null : undefined,
    detail: null,
    note: null,
    started_at: null,
    ended_at: null,
    duration_minutes: null,
    before_photos: [],
    after_photos: [],
    status: 'open',
    completed_by: null,
    completed_at: null,
  }
}

function feedbackPreviewUrls(item: PropertyFeedback): string[] {
  const basePhotos = [
    ...normalizeUrls(item.media_urls),
    ...normalizeUrls(item.repair_photo_urls),
  ]
  if (item.kind === 'daily_necessities') return Array.from(new Set(basePhotos))

  const projectItems = Array.isArray(item.project_items) ? item.project_items : []
  const target = projectItems.find((it) => it.status !== 'completed') || projectItems[0] || null
  const orderedProjects = target
    ? [target, ...projectItems.filter((it) => it.id !== target.id)]
    : projectItems
  return Array.from(new Set([
    ...orderedProjects.flatMap((it) => [
      ...normalizeUrls(it.before_photos),
      ...normalizeUrls(it.after_photos),
    ]),
    ...basePhotos,
  ]))
}

function firstOpenProject(item: PropertyFeedback) {
  const projectItems = Array.isArray(item.project_items) ? item.project_items : []
  return projectItems.find((it) => it.status !== 'completed') || projectItems[0] || null
}

function isWeakFeedbackTitle(value: string, item: PropertyFeedback) {
  const text = String(value || '').trim()
  if (!text) return true
  if (text === '其他') return true
  if (text === '维修项目' || text === '深度清洁') return true
  const category = String(item.category || '').trim()
  if (category && text === category) return true
  return false
}

function feedbackAreaLabel(item: PropertyFeedback) {
  if (item.kind === 'maintenance') {
    const directArea = String(item.area || '').trim()
    if (directArea) return directArea
    const target = firstOpenProject(item)
    return String(target?.area || '').trim()
  }
  if (item.kind === 'deep_cleaning') {
    const directAreas = (item.areas || []).filter(Boolean).map((x) => String(x).trim()).filter(Boolean)
    if (directAreas.length) return directAreas.join('、')
    const target = firstOpenProject(item)
    const projectArea = String(target?.area || '').trim()
    if (projectArea) return projectArea
  }
  return ''
}

function feedbackListTitle(item: PropertyFeedback) {
  if (item.kind === 'daily_necessities') {
    const itemName = String(item.item_name || '').trim()
    const qty = Number(item.quantity)
    if (itemName && Number.isFinite(qty) && qty > 0) return `日用品更换：${itemName} x${Math.trunc(qty)}`
    if (itemName) return `日用品更换：${itemName}`
    return '日用品更换'
  }

  const target = firstOpenProject(item)
  const detailCandidates = [
    extractContentText(item.detail),
    String(target?.detail || '').trim(),
    String(target?.name || '').trim(),
  ]
  const detailText = detailCandidates.find((text) => !isWeakFeedbackTitle(text, item)) || ''
  const areaText = feedbackAreaLabel(item)

  if (areaText && detailText) return `${areaText}：${detailText}`
  if (detailText) return detailText
  if (areaText) return areaText

  const category = String(item.category || '').trim()
  if (category && category !== '其他') return category
  return '无标题'
}

function makeDraftId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function buildMaintenanceDraft(): MaintenanceDraft {
  return {
    clientId: makeDraftId(),
    area: null,
    detail: '',
    media: [],
    submitAsCompleted: false,
    completionNote: '',
    completionAfterPhotos: [],
  }
}

function buildDeepCleaningDraft(): DeepCleaningDraft {
  return {
    clientId: makeDraftId(),
    area: null,
    detail: '',
    media: [],
    submitAsCompleted: false,
    completionNote: '',
    completionAfterPhotos: [],
    completionStartedAt: null,
    completionEndedAt: null,
  }
}

function buildDailyDraft(): DailyDraft {
  return {
    clientId: makeDraftId(),
    status: 'need_replace',
    itemName: '',
    itemSku: null,
    qty: '1',
    note: '',
    media: [],
  }
}

export default function FeedbackFormScreen(props: Props) {
  const { t } = useI18n()
  const { token, user } = useAuth()
  const insets = useSafeAreaInsets()
  const isFocused = useIsFocused()

  const [kind, setKind] = useState<Kind>('maintenance')
  const [maintenanceDrafts, setMaintenanceDrafts] = useState<MaintenanceDraft[]>([buildMaintenanceDraft()])
  const [deepCleaningDrafts, setDeepCleaningDrafts] = useState<DeepCleaningDraft[]>([buildDeepCleaningDraft()])
  const [dailyDrafts, setDailyDrafts] = useState<DailyDraft[]>([buildDailyDraft()])
  const [submitting, setSubmitting] = useState(false)

  const [pending, setPending] = useState<PropertyFeedback[]>([])
  const [resolved, setResolved] = useState<PropertyFeedback[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)
  const [resolvedExpanded, setResolvedExpanded] = useState(false)
  const [detailItem, setDetailItem] = useState<PropertyFeedback | null>(null)

  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerUrls, setViewerUrls] = useState<string[]>([])
  const [viewerIndex, setViewerIndex] = useState(0)

  const [actionOpen, setActionOpen] = useState(false)
  const [actionMode, setActionMode] = useState<ActionMode>('create')
  const [actionFeedback, setActionFeedback] = useState<PropertyFeedback | null>(null)
  const [actionProject, setActionProject] = useState<PropertyFeedbackProject | null>(null)
  const [actionSaving, setActionSaving] = useState(false)
  const [projectForm, setProjectForm] = useState<PropertyFeedbackProject>(buildDefaultProject('maintenance'))
  const [timePickerOpen, setTimePickerOpen] = useState(false)
  const [timeField, setTimeField] = useState<TimePickerTarget>('project_started_at')
  const [timeDraftId, setTimeDraftId] = useState<string | null>(null)
  const [pickerHour, setPickerHour] = useState(9)
  const [pickerMinute, setPickerMinute] = useState(0)
  const [dailyEditOpen, setDailyEditOpen] = useState(false)
  const [dailyEditItem, setDailyEditItem] = useState<PropertyFeedback | null>(null)
  const [dailyEditSaving, setDailyEditSaving] = useState(false)
  const [dailyEditStatus, setDailyEditStatus] = useState<(typeof DAILY_STATUS_OPTIONS)[number]['value']>('need_replace')
  const [dailyEditItemName, setDailyEditItemName] = useState('')
  const [dailyEditItemSku, setDailyEditItemSku] = useState<string | null>(null)
  const [dailyEditQty, setDailyEditQty] = useState('1')
  const [dailyEditNote, setDailyEditNote] = useState('')
  const [dailyEditMedia, setDailyEditMedia] = useState<string[]>([])
  const [dailyOptions, setDailyOptions] = useState<DailyNecessityOption[]>([])
  const [activeDailySuggestTarget, setActiveDailySuggestTarget] = useState<string | null>(null)
  const [queuedEditItem, setQueuedEditItem] = useState<PropertyFeedback | null>(null)
  const [recordArea, setRecordArea] = useState<DeepCleaningAreaOption | null>(null)
  const [recordEditOpen, setRecordEditOpen] = useState(false)
  const [recordEditFeedback, setRecordEditFeedback] = useState<PropertyFeedback | null>(null)
  const [recordEditSaving, setRecordEditSaving] = useState(false)

  const task = useMemo(() => getWorkTasksSnapshot().items.find((x) => x.id === props.route.params.taskId) || null, [props.route.params.taskId])
  const propertyId = String(task?.property_id || task?.property?.id || '').trim()
  const propertyCode = String(task?.property?.code || '').trim()
  const historyCacheRef = useRef<FeedbackHistoryCache | null>(null)
  const historyRefreshRef = useRef<Promise<void> | null>(null)

  useEffect(() => {
    const title = kind === 'maintenance' ? '房源维修' : kind === 'deep_cleaning' ? '深度清洁' : '日用品反馈'
    props.navigation.setOptions({ title })
  }, [props.navigation, kind])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const cached = await getJson<FeedbackHistoryCache | PropertyFeedback[]>(feedbackHistoryCacheKey(propertyId, propertyCode))
        if (cancelled || !cached) return
        if (Array.isArray(cached)) {
          const normalized = { pending: uniqFeedbacks(cached), resolved: [], updated_at: 0 }
          historyCacheRef.current = normalized
          if (!normalized.pending.length) return
          setPending(normalized.pending)
          return
        }
        const normalized = {
          pending: uniqFeedbacks(Array.isArray(cached.pending) ? cached.pending : []),
          resolved: uniqFeedbacks(Array.isArray(cached.resolved) ? cached.resolved : []),
          updated_at: Number(cached.updated_at || 0) || 0,
        }
        historyCacheRef.current = normalized
        if (!normalized.pending.length && !normalized.resolved.length) return
        setPending(normalized.pending)
        setResolved(normalized.resolved)
      } catch {}
    })()
    return () => {
      cancelled = true
    }
  }, [propertyId, propertyCode])

  async function refreshLists(options?: { force?: boolean; silent?: boolean }) {
    if (!token || (!propertyId && !propertyCode)) return
    const force = !!options?.force
    const cache = historyCacheRef.current
    const now = Date.now()
    const hasCache = !!(cache && (cache.pending.length || cache.resolved.length))
    const isFresh = !!(cache && cache.updated_at > 0 && now - cache.updated_at < FEEDBACK_HISTORY_CACHE_TTL_MS)
    if (!force && isFresh) return
    if (historyRefreshRef.current) {
      if (!force) return historyRefreshRef.current
      await historyRefreshRef.current.catch(() => {})
    }
    const shouldShowLoading = !options?.silent && !hasCache
    const job = (async () => {
      if (shouldShowLoading) setLoadingList(true)
      setListError(null)
      try {
        const [openList, dailyList, resolvedList] = await Promise.all([
          listPropertyFeedbacks(token, { property_id: propertyId || undefined, property_code: propertyCode || undefined, status: ['open', 'in_progress'], limit: 50 }),
          listPropertyFeedbacks(token, { property_id: propertyId || undefined, property_code: propertyCode || undefined, status: ['need_replace', 'replaced', 'no_action'], limit: 50 }),
          listPropertyFeedbacks(token, { property_id: propertyId || undefined, property_code: propertyCode || undefined, status: ['resolved'], limit: 50 }),
        ])
        const nextPending = uniqFeedbacks(
          [...(Array.isArray(openList) ? openList : []), ...(Array.isArray(dailyList) ? dailyList : [])].filter((item) => {
            const status = String(item?.status || '').trim()
            return status !== 'resolved' && status !== 'replaced' && status !== 'no_action'
          }),
        )
        const nextResolved = uniqFeedbacks((Array.isArray(resolvedList) ? resolvedList : []).filter((x) => x.kind !== 'daily_necessities'))
        setPending(nextPending)
        setResolved(nextResolved)
        const nextCache = { pending: nextPending, resolved: nextResolved, updated_at: Date.now() }
        historyCacheRef.current = nextCache
        void setJson(feedbackHistoryCacheKey(propertyId, propertyCode), nextCache)
      } catch (e: any) {
        setListError(String(e?.message || '加载失败'))
        if (!cache?.pending.length) setPending([])
        if (!cache?.resolved.length) setResolved([])
      } finally {
        if (shouldShowLoading) setLoadingList(false)
      }
    })()
    historyRefreshRef.current = job
    try {
      await job
    } finally {
      if (historyRefreshRef.current === job) historyRefreshRef.current = null
    }
  }

  useEffect(() => {
    if (!isFocused) return
    const cache = historyCacheRef.current
    const hasCache = !!(cache && (cache.pending.length || cache.resolved.length))
    void refreshLists({ silent: hasCache })
  }, [token, propertyId, propertyCode, isFocused])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const cached = await getJson<DailyNecessityOption[]>(DAILY_OPTIONS_CACHE_KEY)
        if (cancelled || !Array.isArray(cached) || !cached.length) return
        setDailyOptions(dedupeDailyOptions(cached))
      } catch {}
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function resetCreateForm(nextKind: Kind) {
    setKind(nextKind)
    if (nextKind === 'maintenance' && !maintenanceDrafts.length) setMaintenanceDrafts([buildMaintenanceDraft()])
    if (nextKind === 'deep_cleaning' && !deepCleaningDrafts.length) setDeepCleaningDrafts([buildDeepCleaningDraft()])
    if (nextKind === 'daily_necessities' && !dailyDrafts.length) setDailyDrafts([buildDailyDraft()])
  }

  function resetDraftsForKind(targetKind: Kind) {
    if (targetKind === 'maintenance') setMaintenanceDrafts([buildMaintenanceDraft()])
    else if (targetKind === 'deep_cleaning') setDeepCleaningDrafts([buildDeepCleaningDraft()])
    else setDailyDrafts([buildDailyDraft()])
  }

  function updateMaintenanceDraft(clientId: string, updater: (draft: MaintenanceDraft) => MaintenanceDraft) {
    setMaintenanceDrafts((prev) => prev.map((draft) => (draft.clientId === clientId ? updater(draft) : draft)))
  }

  function updateDeepCleaningDraft(clientId: string, updater: (draft: DeepCleaningDraft) => DeepCleaningDraft) {
    setDeepCleaningDrafts((prev) => prev.map((draft) => (draft.clientId === clientId ? updater(draft) : draft)))
  }

  function updateDailyDraft(clientId: string, updater: (draft: DailyDraft) => DailyDraft) {
    setDailyDrafts((prev) => prev.map((draft) => (draft.clientId === clientId ? updater(draft) : draft)))
  }

  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      try {
        const rows = await listDailyNecessityOptions(token, { limit: 120 })
        if (cancelled || !Array.isArray(rows) || !rows.length) return
        const deduped = dedupeDailyOptions(rows)
        setDailyOptions(deduped)
        void setJson(DAILY_OPTIONS_CACHE_KEY, deduped)
      } catch {}
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  function dailySuggestKey(mode: 'draft' | 'edit', clientId?: string) {
    return mode === 'draft' ? `draft:${String(clientId || '').trim()}` : 'edit'
  }

  function filterDailyOptions(keyword?: string | null) {
    const normalized = String(keyword || '').trim().toLowerCase()
    const source = normalized ? dailyOptions.filter((item) => dailyOptionSearchText(item).includes(normalized)) : dailyOptions
    return source.slice(0, 8)
  }

  function applyDailyOption(targetKey: string, option: DailyNecessityOption) {
    const nextName = String(option.item_name || '').trim()
    const nextSku = String(option.sku || '').trim() || null
    const defaultQty = option.default_quantity != null && Number.isFinite(Number(option.default_quantity)) && Number(option.default_quantity) > 0 ? String(Math.trunc(Number(option.default_quantity))) : ''
    if (targetKey.startsWith('draft:')) {
      const clientId = targetKey.slice(6)
      updateDailyDraft(clientId, (draft) => ({
        ...draft,
        itemName: nextName,
        itemSku: nextSku,
        qty: draft.qty.trim() ? draft.qty : defaultQty || '1',
      }))
    } else if (targetKey === 'edit') {
      setDailyEditItemName(nextName)
      setDailyEditItemSku(nextSku)
      setDailyEditQty((prev) => (String(prev || '').trim() ? prev : defaultQty || '1'))
    }
    setActiveDailySuggestTarget(null)
  }

  function removeMaintenanceDraft(clientId: string) {
    setMaintenanceDrafts((prev) => (prev.length > 1 ? prev.filter((draft) => draft.clientId !== clientId) : prev))
  }

  function removeDeepCleaningDraft(clientId: string) {
    setDeepCleaningDrafts((prev) => (prev.length > 1 ? prev.filter((draft) => draft.clientId !== clientId) : prev))
  }

  function removeDeepCleaningPhoto(clientId: string, field: 'media' | 'completionAfterPhotos', photoIndex: number) {
    updateDeepCleaningDraft(clientId, (draft) => ({
      ...draft,
      [field]: draft[field].filter((_, idx) => idx !== photoIndex),
    }))
  }

  function removeMaintenancePhoto(clientId: string, field: 'media' | 'completionAfterPhotos', photoIndex: number) {
    updateMaintenanceDraft(clientId, (draft) => ({
      ...draft,
      [field]: draft[field].filter((_, idx) => idx !== photoIndex),
    }))
  }

  function removeDailyDraft(clientId: string) {
    setDailyDrafts((prev) => (prev.length > 1 ? prev.filter((draft) => draft.clientId !== clientId) : prev))
  }

  function removeDailyDraftPhoto(clientId: string, photoIndex: number) {
    updateDailyDraft(clientId, (draft) => ({
      ...draft,
      media: draft.media.filter((_, idx) => idx !== photoIndex),
    }))
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

  function buildWatermarkText(iso: string) {
    const username = String((user as any)?.username || (user as any)?.email || '').trim()
    const line1 = `${propertyCode || '未知房号'}${username ? `  ${username}` : ''}`.trim()
    const line2 = fmtTime(iso)
    return `${line1}\n${line2}`.trim()
  }

  async function uploadPhotoUrls(source: 'camera' | 'library'): Promise<string[]> {
    if (!token) return []
    const ok = source === 'camera' ? await ensureCameraPerm() : await ensureLibraryPerm()
    if (!ok) {
      Alert.alert(t('common_error'), source === 'camera' ? '请先开启相机权限' : '请先开启相册权限')
      return []
    }
    try {
      const res =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1, allowsMultipleSelection: true, selectionLimit: 0, orderedSelection: true })
      if (res.canceled || !res.assets?.length) return []
      const uploaded: string[] = []
      for (const asset of res.assets as any[]) {
        const uri = String(asset?.uri || '').trim()
        if (!uri) continue
        const capturedAt = new Date().toISOString()
        const up = await uploadCleaningMedia(
          token,
          { uri, name: String(asset?.fileName || uri.split('/').pop() || `feedback-${Date.now()}.jpg`), mimeType: String(asset?.mimeType || 'image/jpeg') },
          { watermark: '1', purpose: 'feedback', property_code: propertyCode, captured_at: capturedAt, watermark_text: buildWatermarkText(capturedAt) },
        )
        if (up?.url) uploaded.push(up.url)
      }
      return uploaded
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '上传失败'))
      return []
    }
  }

  async function uploadAndAppend(setter: React.Dispatch<React.SetStateAction<string[]>>, source: 'camera' | 'library') {
    const urls = await uploadPhotoUrls(source)
    if (!urls.length) return
    setter((prev) => [...prev, ...urls])
  }

  async function appendMaintenancePhoto(clientId: string, field: 'media' | 'completionAfterPhotos', source: 'camera' | 'library') {
    const urls = await uploadPhotoUrls(source)
    if (!urls.length) return
    updateMaintenanceDraft(clientId, (draft) => ({ ...draft, [field]: [...draft[field], ...urls] }))
  }

  async function appendDeepCleaningPhoto(clientId: string, field: 'media' | 'completionAfterPhotos', source: 'camera' | 'library') {
    const urls = await uploadPhotoUrls(source)
    if (!urls.length) return
    updateDeepCleaningDraft(clientId, (draft) => ({ ...draft, [field]: [...draft[field], ...urls] }))
  }

  async function appendDailyPhoto(clientId: string, source: 'camera' | 'library') {
    const urls = await uploadPhotoUrls(source)
    if (!urls.length) return
    updateDailyDraft(clientId, (draft) => ({ ...draft, media: [...draft.media, ...urls] }))
  }

  async function appendProjectPhoto(field: 'before_photos' | 'after_photos', source: 'camera' | 'library') {
    const urls = await uploadPhotoUrls(source)
    if (!urls.length) return
    setProjectForm((prev) => ({ ...prev, [field]: [...prev[field], ...urls] }))
  }

  function removeProjectPhoto(field: 'before_photos' | 'after_photos', photoIndex: number) {
    setProjectForm((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, idx) => idx !== photoIndex),
    }))
  }

  async function appendDailyEditPhoto(source: 'camera' | 'library') {
    const urls = await uploadPhotoUrls(source)
    if (!urls.length) return
    setDailyEditMedia((prev) => [...prev, ...urls])
  }

  function removeDailyEditPhoto(photoIndex: number) {
    setDailyEditMedia((prev) => prev.filter((_, idx) => idx !== photoIndex))
  }

  async function openDraftTimePicker(clientId: string, field: 'draft_started_at' | 'draft_ended_at') {
    const target = deepCleaningDrafts.find((draft) => draft.clientId === clientId)
    if (!target) return
    const raw = field === 'draft_started_at' ? target.completionStartedAt : target.completionEndedAt
    const parsed = parseHourMinute(raw)
    setTimeDraftId(clientId)
    setTimeField(field)
    setPickerHour(parsed.hour)
    setPickerMinute(parsed.minute)
    setTimePickerOpen(true)
  }

  function dismissCreateSuccess(successCount: number, failedLabels: string[]) {
    if (!failedLabels.length) {
      Alert.alert(t('common_ok'), successCount > 1 ? `已成功提交 ${successCount} 条记录` : '提交成功')
      return
    }
    const prefix = successCount > 0 ? `已成功提交 ${successCount} 条，` : ''
    Alert.alert(t('common_error'), `${prefix}以下记录提交失败：${failedLabels.join('、')}`)
  }

  async function submitFeedback() {
    if (!token || !propertyId) return
    try {
      setSubmitting(true)
      if (kind === 'maintenance') {
        const invalidIndex = maintenanceDrafts.findIndex((draft) => {
          if (!draft.area || !draft.detail.trim()) return true
          if (draft.submitAsCompleted && !draft.completionAfterPhotos.length) return true
          return false
        })
        if (invalidIndex >= 0) {
          Alert.alert(t('common_error'), `请完整填写第 ${invalidIndex + 1} 条维修记录`)
          return
        }
        const payloads = maintenanceDrafts.map((draft) => ({
          kind: 'maintenance' as const,
          property_id: propertyId,
          source_task_id: task?.id ? String(task.id) : undefined,
          area: draft.area || undefined,
          detail: draft.detail.trim(),
          media_urls: draft.media,
        }))
        const createResults = await createPropertyFeedbackBatch(token, payloads)
        const failedIds = new Set<string>()
        let successCount = 0
        for (let idx = 0; idx < createResults.length; idx += 1) {
          const result = createResults[idx]
          const draft = maintenanceDrafts[idx]
          if (!result?.ok) {
            failedIds.add(draft.clientId)
            continue
          }
          const feedbackId = String(result.response?.id || '').trim()
          if (!feedbackId) {
            failedIds.add(draft.clientId)
            continue
          }
          if (draft.submitAsCompleted) {
            try {
              await completePropertyFeedbackProject(token, 'maintenance', feedbackId, `legacy-${feedbackId}`, {
                note: draft.completionNote.trim() || undefined,
                detail: draft.detail.trim(),
                source_task_id: task?.id ? String(task.id) : undefined,
                before_photos: draft.media,
                after_photos: draft.completionAfterPhotos,
              })
            } catch {
              failedIds.add(draft.clientId)
              continue
            }
          }
          successCount += 1
        }
        if (!failedIds.size) {
          resetDraftsForKind('maintenance')
        } else {
          setMaintenanceDrafts((prev) => prev.filter((draft) => failedIds.has(draft.clientId)))
        }
        dismissCreateSuccess(successCount, maintenanceDrafts.filter((draft) => failedIds.has(draft.clientId)).map((_, idx) => `维修记录${idx + 1}`))
      } else if (kind === 'deep_cleaning') {
        const invalidIndex = deepCleaningDrafts.findIndex((draft) => {
          if (!draft.area || !draft.detail.trim() || !draft.media.length) return true
          if (draft.submitAsCompleted) {
            if (!draft.completionAfterPhotos.length) return true
            if (!String(draft.completionStartedAt || '').trim() || !String(draft.completionEndedAt || '').trim()) return true
          }
          return false
        })
        if (invalidIndex >= 0) {
          Alert.alert(t('common_error'), `请完整填写第 ${invalidIndex + 1} 条深度清洁记录`)
          return
        }
        const payloads = deepCleaningDrafts.map((draft) => ({
          kind: 'deep_cleaning' as const,
          property_id: propertyId,
          source_task_id: task?.id ? String(task.id) : undefined,
          areas: draft.area ? [draft.area] : [],
          detail: draft.detail.trim(),
          media_urls: draft.media,
        }))
        const createResults = await createPropertyFeedbackBatch(token, payloads)
        const failedIds = new Set<string>()
        let successCount = 0
        for (let idx = 0; idx < createResults.length; idx += 1) {
          const result = createResults[idx]
          const draft = deepCleaningDrafts[idx]
          if (!result?.ok) {
            failedIds.add(draft.clientId)
            continue
          }
          const feedbackId = String(result.response?.id || '').trim()
          if (!feedbackId) {
            failedIds.add(draft.clientId)
            continue
          }
          if (draft.submitAsCompleted) {
            try {
              await completePropertyFeedbackProject(token, 'deep_cleaning', feedbackId, `legacy-${feedbackId}`, {
                note: draft.completionNote.trim() || undefined,
                detail: draft.detail.trim(),
                source_task_id: task?.id ? String(task.id) : undefined,
                started_at: draft.completionStartedAt || undefined,
                ended_at: draft.completionEndedAt || undefined,
                before_photos: draft.media,
                after_photos: draft.completionAfterPhotos,
              })
            } catch {
              failedIds.add(draft.clientId)
              continue
            }
          }
          successCount += 1
        }
        if (!failedIds.size) {
          resetDraftsForKind('deep_cleaning')
        } else {
          setDeepCleaningDrafts((prev) => prev.filter((draft) => failedIds.has(draft.clientId)))
        }
        dismissCreateSuccess(successCount, deepCleaningDrafts.filter((draft) => failedIds.has(draft.clientId)).map((_, idx) => `深清记录${idx + 1}`))
      } else {
        const invalidIndex = dailyDrafts.findIndex((draft) => {
          const qty = Number(draft.qty)
          return !draft.itemName.trim() || !Number.isFinite(qty) || qty < 1 || (!draft.note.trim() && !draft.media.length)
        })
        if (invalidIndex >= 0) {
          Alert.alert(t('common_error'), `请完整填写第 ${invalidIndex + 1} 条日用品记录`)
          return
        }
        const results = await createPropertyFeedbackBatch(
          token,
          dailyDrafts.map((draft) => ({
            kind: 'daily_necessities' as const,
            property_id: propertyId,
            source_task_id: task?.id ? String(task.id) : undefined,
            status: draft.status,
            item_name: draft.itemName.trim(),
            quantity: Math.trunc(Number(draft.qty)),
            note: draft.note.trim(),
            media_urls: draft.media,
          })),
        )
        const failedIds = new Set<string>()
        let successCount = 0
        results.forEach((result, idx) => {
          if (result.ok) successCount += 1
          else failedIds.add(dailyDrafts[idx].clientId)
        })
        if (!failedIds.size) {
          resetDraftsForKind('daily_necessities')
        } else {
          setDailyDrafts((prev) => prev.filter((draft) => failedIds.has(draft.clientId)))
        }
        dismissCreateSuccess(successCount, dailyDrafts.filter((draft) => failedIds.has(draft.clientId)).map((_, idx) => `日用品记录${idx + 1}`))
      }
      await refreshLists({ force: true })
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '提交失败'))
    } finally {
      setSubmitting(false)
    }
  }

  function openViewer(urls: string[], index: number) {
    const list = urls.map(toAbsoluteUrl).filter(Boolean)
    if (!list.length) return
    setViewerUrls(list)
    setViewerIndex(Math.max(0, Math.min(index, list.length - 1)))
    setViewerOpen(true)
  }

  function closeDetailModal() {
    setDetailItem(null)
  }

  function closeViewer() {
    setViewerOpen(false)
  }

  function syncViewerIndex(offsetX: number) {
    const safeWidth = Math.max(screenWidth, 1)
    const nextIndex = Math.round(Number(offsetX || 0) / safeWidth)
    setViewerIndex(Math.max(0, Math.min(nextIndex, Math.max(viewerUrls.length - 1, 0))))
  }

  function openProjectAction(mode: ActionMode, feedback: PropertyFeedback, project?: PropertyFeedbackProject | null) {
    const baseKind = feedback.kind === 'maintenance' ? 'maintenance' : 'deep_cleaning'
    const base = buildDefaultProject(baseKind)
    const next = project
      ? {
          ...base,
          ...project,
          before_photos: normalizeUrls(project.before_photos),
          after_photos: normalizeUrls(project.after_photos),
        }
      : base
    setActionMode(mode)
    setActionFeedback(feedback)
    setActionProject(project || null)
    setProjectForm(next)
    setActionOpen(true)
  }

  function buildHistoryProject(feedback: PropertyFeedback) {
    const items = Array.isArray(feedback.project_items) ? feedback.project_items : []
    const target = items.find((it) => it.status !== 'completed') || items[0]
    if (target) {
      const fallbackBefore = normalizeUrls(feedback.media_urls)
      const fallbackAfter = normalizeUrls(feedback.repair_photo_urls)
      return {
        ...target,
        before_photos: target.before_photos.length ? target.before_photos : fallbackBefore,
        after_photos: target.after_photos.length ? target.after_photos : fallbackAfter,
      }
    }
    return {
      id: `legacy-${feedback.id}`,
      name:
        feedback.kind === 'deep_cleaning'
          ? ((feedback.areas || []).filter(Boolean).join('、') || '深度清洁')
          : String(feedback.category || '').trim() || '维修项目',
      area: feedback.kind === 'maintenance' ? String(feedback.area || '').trim() || null : null,
      category: feedback.kind === 'maintenance' ? String(feedback.category || '').trim() || null : null,
      detail: String(feedback.detail || '').trim() || null,
      note: String(feedback.repair_notes || '').trim() || null,
      started_at: null,
      ended_at: null,
      duration_minutes: null,
      before_photos: normalizeUrls(feedback.media_urls),
      after_photos: normalizeUrls(feedback.repair_photo_urls),
      status: feedback.status === 'resolved' ? 'completed' : 'open',
      completed_by: null,
      completed_at: feedback.completed_at || null,
    } as PropertyFeedbackProject
  }

  function openDailyEdit(item: PropertyFeedback) {
    const matched = dailyOptions.find((option) => String(option.item_name || '').trim() === String(item.item_name || '').trim()) || null
    setDailyEditItem(item)
    setDailyEditStatus((String(item.status || '').trim() as any) || 'need_replace')
    setDailyEditItemName(String(item.item_name || '').trim())
    setDailyEditItemSku(matched?.sku ? String(matched.sku) : null)
    setDailyEditQty(String(item.quantity || 1))
    setDailyEditNote(String(item.note || item.detail || '').trim())
    setDailyEditMedia(normalizeUrls(item.media_urls))
    setDailyEditOpen(true)
  }

  function openRecordEditor(item: PropertyFeedback) {
    if (item.kind === 'daily_necessities') {
      openDailyEdit(item)
      return
    }
    const nextProject = buildHistoryProject(item)
    setRecordEditFeedback(item)
    setProjectForm({
      ...buildDefaultProject(item.kind === 'maintenance' ? 'maintenance' : 'deep_cleaning'),
      ...nextProject,
      name: item.kind === 'maintenance' ? '维修记录' : '深度清洁记录',
      before_photos: normalizeUrls(item.media_urls),
      after_photos: normalizeUrls(item.repair_photo_urls),
      detail: String(item.detail || '').trim() || nextProject.detail || null,
      note: String(item.repair_notes || nextProject.note || '').trim() || null,
    })
    setRecordArea(
      item.kind === 'deep_cleaning'
        ? (((item.areas || []).find(Boolean) as DeepCleaningAreaOption | undefined) || null)
        : null,
    )
    setRecordEditOpen(true)
  }

  function requestRecordEdit(item: PropertyFeedback) {
    if (actionOpen || dailyEditOpen || recordEditOpen) return
    if (detailItem) {
      setQueuedEditItem(item)
      setDetailItem(null)
      return
    }
    openRecordEditor(item)
  }

  function applyUpdatedFeedbackRow(row: PropertyFeedback | null | undefined) {
    if (!row) return
    const status = String(row.status || '').trim()
    const reviewStatus = String(row.review_status || '').trim()
    const isResolvedPending = status === 'resolved' && reviewStatus === 'pending'
    setPending((prev) => uniqFeedbacks(prev.filter((item) => item.id !== row.id && `${item.kind}:${item.id}` !== `${row.kind}:${row.id}`)))
    if (isResolvedPending) {
      setResolved((prev) => uniqFeedbacks([row, ...prev.filter((item) => item.id !== row.id && `${item.kind}:${item.id}` !== `${row.kind}:${row.id}`)]))
    } else {
      setResolved((prev) => prev.filter((item) => item.id !== row.id && `${item.kind}:${item.id}` !== `${row.kind}:${row.id}`))
      setPending((prev) => uniqFeedbacks([row, ...prev]))
    }
    if (detailItem?.id === row.id && detailItem?.kind === row.kind) setDetailItem(row)
  }

  function buildEditedFeedbackFallback(item: PropertyFeedback): PropertyFeedback {
    const afterPhotos = Array.isArray(projectForm.after_photos) ? projectForm.after_photos : []
    const isResolvedPending = afterPhotos.length > 0
    return {
      ...item,
      area: item.kind === 'maintenance' ? String(projectForm.area || '').trim() || null : item.area || null,
      areas: item.kind === 'deep_cleaning' ? (recordArea ? [recordArea] : []) : item.areas || null,
      category: item.kind === 'maintenance' ? String(projectForm.category || '').trim() || null : item.category || null,
      detail: String(projectForm.detail || '').trim(),
      media_urls: projectForm.before_photos,
      repair_photo_urls: afterPhotos,
      repair_notes: String(projectForm.note || '').trim() || null,
      note: String(projectForm.note || '').trim() || null,
      status: isResolvedPending ? 'resolved' : item.status,
      review_status: isResolvedPending ? 'pending' : item.review_status || null,
      completed_at: isResolvedPending ? item.completed_at || new Date().toISOString() : item.completed_at || null,
    }
  }

  function openTimePicker(field: TimePickerTarget) {
    setTimeDraftId(null)
    const raw =
      field === 'project_started_at'
        ? projectForm.started_at
        : field === 'project_ended_at'
          ? projectForm.ended_at
          : timeDraftId
            ? field === 'draft_started_at'
              ? deepCleaningDrafts.find((draft) => draft.clientId === timeDraftId)?.completionStartedAt || null
              : deepCleaningDrafts.find((draft) => draft.clientId === timeDraftId)?.completionEndedAt || null
            : null
    const parsed = parseHourMinute(raw)
    setTimeField(field)
    setPickerHour(parsed.hour)
    setPickerMinute(parsed.minute)
    setTimePickerOpen(true)
  }

  function applyPickedTime() {
    if (timeField === 'project_started_at' || timeField === 'project_ended_at') {
      const key = timeField === 'project_started_at' ? 'started_at' : 'ended_at'
      setProjectForm((prev) => ({ ...prev, [key]: setIsoTime(prev[key], pickerHour, pickerMinute) }))
    } else if (timeDraftId) {
      updateDeepCleaningDraft(timeDraftId, (draft) => ({
        ...draft,
        [timeField === 'draft_started_at' ? 'completionStartedAt' : 'completionEndedAt']: setIsoTime(
          timeField === 'draft_started_at' ? draft.completionStartedAt : draft.completionEndedAt,
          pickerHour,
          pickerMinute,
        ),
      }))
    }
    setTimeDraftId(null)
    setTimePickerOpen(false)
  }

  async function saveProjectAction() {
    if (!token || !actionFeedback) return
    try {
      setActionSaving(true)
      if (actionMode === 'create') {
        if (!projectForm.name.trim()) {
          Alert.alert(t('common_error'), '请填写项目名称')
          return
        }
        const resp = await createPropertyFeedbackProject(token, actionFeedback.kind as 'maintenance' | 'deep_cleaning', actionFeedback.id, {
          name: projectForm.name.trim(),
          area: String(projectForm.area || '').trim() || undefined,
          category: actionFeedback.kind === 'maintenance' ? String(projectForm.category || '').trim() || undefined : undefined,
          detail: actionFeedback.kind === 'maintenance' ? String(projectForm.detail || '').trim() || undefined : undefined,
          note: actionFeedback.kind === 'deep_cleaning' ? String(projectForm.note || '').trim() || undefined : undefined,
        })
        setDetailItem((resp.row as any) || null)
      } else if (actionMode === 'edit' && actionProject) {
        const resp = await updatePropertyFeedbackProject(token, actionFeedback.kind as 'maintenance' | 'deep_cleaning', actionFeedback.id, actionProject.id, {
          name: projectForm.name.trim() || undefined,
          area: String(projectForm.area || '').trim() || undefined,
          category: actionFeedback.kind === 'maintenance' ? String(projectForm.category || '').trim() || undefined : undefined,
          detail: String(projectForm.detail || '').trim() || undefined,
          note: String(projectForm.note || '').trim() || undefined,
        })
        setDetailItem((resp.row as any) || null)
      } else if (actionMode === 'complete' && actionProject) {
        if (!projectForm.after_photos.length) {
          Alert.alert(t('common_error'), '请上传处理后照片')
          return
        }
        if (actionFeedback.kind === 'deep_cleaning') {
          if (!String(projectForm.started_at || '').trim() || !String(projectForm.ended_at || '').trim()) {
            Alert.alert(t('common_error'), '请填写开始时间和结束时间')
            return
          }
          if (!projectForm.before_photos.length) {
            Alert.alert(t('common_error'), '请上传处理前照片')
            return
          }
        }
        const resp = await completePropertyFeedbackProject(token, actionFeedback.kind as 'maintenance' | 'deep_cleaning', actionFeedback.id, actionProject.id, {
          note: String(projectForm.note || '').trim() || undefined,
          detail: String(projectForm.detail || '').trim() || undefined,
          source_task_id: task?.id ? String(task.id) : undefined,
          started_at: String(projectForm.started_at || '').trim() || undefined,
          ended_at: String(projectForm.ended_at || '').trim() || undefined,
          before_photos: projectForm.before_photos,
          after_photos: projectForm.after_photos,
        })
        setDetailItem((resp.row as any) || null)
      }
      setActionOpen(false)
      await refreshLists({ force: true })
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '保存失败'))
    } finally {
      setActionSaving(false)
    }
  }

  async function saveRecordEdit() {
    if (!token || !recordEditFeedback) return
    try {
      setRecordEditSaving(true)
      if (recordEditFeedback.kind === 'maintenance') {
        if (!String(projectForm.area || '').trim() || !String(projectForm.detail || '').trim()) {
          Alert.alert(t('common_error'), '请完整填写维修记录')
          return
        }
        const resp = await updatePropertyFeedback(token, 'maintenance', recordEditFeedback.id, {
          area: String(projectForm.area || '').trim(),
          detail: String(projectForm.detail || '').trim(),
          note: String(projectForm.note || '').trim() || undefined,
          media_urls: projectForm.before_photos,
          repair_photo_urls: projectForm.after_photos,
        })
        applyUpdatedFeedbackRow((resp.row as any) || buildEditedFeedbackFallback(recordEditFeedback))
      } else {
        if (!recordArea || !String(projectForm.detail || '').trim()) {
          Alert.alert(t('common_error'), '请完整填写深度清洁记录')
          return
        }
        const resp = await updatePropertyFeedback(token, 'deep_cleaning', recordEditFeedback.id, {
          areas: [recordArea],
          detail: String(projectForm.detail || '').trim(),
          note: String(projectForm.note || '').trim() || undefined,
          media_urls: projectForm.before_photos,
          repair_photo_urls: projectForm.after_photos,
        })
        applyUpdatedFeedbackRow((resp.row as any) || buildEditedFeedbackFallback(recordEditFeedback))
      }
      setRecordEditOpen(false)
      setRecordEditFeedback(null)
      await refreshLists({ force: true })
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '保存失败'))
    } finally {
      setRecordEditSaving(false)
    }
  }

  async function saveDailyEdit() {
    if (!token || !dailyEditItem) return
    try {
      setDailyEditSaving(true)
      const qty = Number(dailyEditQty)
      if (!dailyEditItemName.trim() || !Number.isFinite(qty) || qty < 1 || (!dailyEditNote.trim() && !dailyEditMedia.length)) {
        Alert.alert(t('common_error'), '请完整填写日用品反馈')
        return
      }
      const resp = await updatePropertyFeedback(token, 'daily_necessities', dailyEditItem.id, {
        status: dailyEditStatus,
        item_name: dailyEditItemName.trim(),
        quantity: Math.trunc(qty),
        note: dailyEditNote.trim(),
        media_urls: dailyEditMedia,
      })
      setDailyEditOpen(false)
      if (detailItem?.id === dailyEditItem.id) setDetailItem((resp.row as any) || null)
      await refreshLists({ force: true })
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '保存失败'))
    } finally {
      setDailyEditSaving(false)
    }
  }

  const pendingGroups = useMemo(() => groupByKind(pending), [pending])
  const screenWidth = Dimensions.get('window').width
  const detailRecord = useMemo(() => {
    if (!detailItem || (detailItem.kind !== 'maintenance' && detailItem.kind !== 'deep_cleaning')) return null
    return buildHistoryProject(detailItem)
  }, [detailItem])
  const pendingHistoryCount = pendingGroups.maintenance.length + pendingGroups.deep.length + pendingGroups.daily.length
  const currentDraftCount = kind === 'maintenance' ? maintenanceDrafts.length : kind === 'deep_cleaning' ? deepCleaningDrafts.length : dailyDrafts.length
  const submitButtonLabel = submitting ? t('common_loading') : currentDraftCount > 1 ? `提交全部 ${currentDraftCount} 条记录` : '提交记录'

  useEffect(() => {
    if (detailItem || !queuedEditItem || actionOpen || dailyEditOpen || recordEditOpen) return
    const target = queuedEditItem
    setQueuedEditItem(null)
    openRecordEditor(target)
  }, [detailItem, queuedEditItem, actionOpen, dailyEditOpen, recordEditOpen])

  return (
    <>
      <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
        {!task ? (
          <Text style={styles.muted}>{t('common_loading')}</Text>
        ) : (
          <View style={styles.pageStack}>
            <StepCard
              step="1"
              title="选择反馈类型"
              subtitle="先选择本次反馈属于维修、深清还是日用品。"
            >
              <View style={styles.headerRow}>
                <View style={styles.headerTextWrap}>
                  {task.property?.address ? <Text style={styles.sub}>{task.property.address}</Text> : null}
                </View>
                <View style={styles.taskBadge}>
                  <Text style={styles.taskBadgeText}>{task.title}</Text>
                </View>
              </View>
              <View style={styles.segmentRow}>
                {(['maintenance', 'deep_cleaning', 'daily_necessities'] as Kind[]).map((value) => (
                  <Pressable key={value} onPress={() => resetCreateForm(value)} style={({ pressed }) => [styles.segment, kind === value ? styles.segmentActive : null, pressed ? styles.pressed : null]}>
                    <Text style={[styles.segmentText, kind === value ? styles.segmentTextActive : null]}>
                      {value === 'maintenance' ? '房源维修' : value === 'deep_cleaning' ? '深度清洁' : '日用品反馈'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </StepCard>

            <StepCard
              step="2"
              title="填写记录信息"
              subtitle={kind === 'daily_necessities' ? '可连续添加多条日用品记录，一次性提交。' : kind === 'deep_cleaning' ? '可连续添加多条深清记录，每条独立填写前后照片和完成状态。' : '可连续添加多条维修记录，每条独立填写前后照片和完成状态。'}
            >
              {kind === 'maintenance'
                  ? maintenanceDrafts.map((draft, index) => (
                      <View key={draft.clientId} style={styles.createCard}>
                        <View style={styles.createCardHeader}>
                          <Text style={styles.createCardTitle}>{`维修记录 ${index + 1}`}</Text>
                          {maintenanceDrafts.length > 1 ? (
                          <Pressable onPress={() => removeMaintenanceDraft(draft.clientId)} style={({ pressed }) => [styles.removeBtn, pressed ? styles.pressed : null]}>
                            <Text style={styles.removeBtnText}>删除</Text>
                          </Pressable>
                        ) : null}
                      </View>
                      <View style={styles.createSection}>
                        <Text style={styles.createSectionTitle}>基础信息</Text>
                        <Text style={styles.label}>问题区域</Text>
                        <View style={styles.chipsRow}>
                          {AREA_OPTIONS.map((x) => (
                            <Pressable key={`${draft.clientId}-${x}`} onPress={() => updateMaintenanceDraft(draft.clientId, (item) => ({ ...item, area: x }))} style={({ pressed }) => [styles.chip, draft.area === x ? styles.chipActive : null, pressed ? styles.pressed : null]}>
                              <Text style={[styles.chipText, draft.area === x ? styles.chipTextActive : null]}>{x}</Text>
                            </Pressable>
                          ))}
                        </View>
                        <Text style={styles.label}>问题详情</Text>
                        <TextInput value={draft.detail} onChangeText={(v) => updateMaintenanceDraft(draft.clientId, (item) => ({ ...item, detail: v }))} style={[styles.input, styles.textarea]} placeholder="请描述问题" placeholderTextColor="#9CA3AF" multiline />
                      </View>
                      <View style={styles.createSection}>
                        <Text style={styles.createSectionTitle}>现场照片</Text>
                        <Text style={styles.label}>维修前照片</Text>
                        <UploadButtons onCamera={() => appendMaintenancePhoto(draft.clientId, 'media', 'camera')} onLibrary={() => appendMaintenancePhoto(draft.clientId, 'media', 'library')} />
                        <PhotoStrip urls={draft.media} onPress={openViewer} onRemove={(photoIndex) => removeMaintenancePhoto(draft.clientId, 'media', photoIndex)} />
                      </View>
                      <View style={styles.createSection}>
                        <Text style={styles.createSectionTitle}>完成信息</Text>
                        <Text style={styles.label}>完成确认</Text>
                        <View style={styles.choiceGrid}>
                          <Pressable onPress={() => updateMaintenanceDraft(draft.clientId, (item) => ({ ...item, submitAsCompleted: false, completionAfterPhotos: [], completionNote: '' }))} style={({ pressed }) => [styles.choiceCard, !draft.submitAsCompleted ? styles.choiceCardActive : null, pressed ? styles.pressed : null]}>
                            <Text style={[styles.choiceTitle, !draft.submitAsCompleted ? styles.choiceTitleActive : null]}>未完成</Text>
                            <Text style={[styles.choiceDesc, !draft.submitAsCompleted ? styles.choiceDescActive : null]}>先提交反馈</Text>
                          </Pressable>
                          <Pressable onPress={() => updateMaintenanceDraft(draft.clientId, (item) => ({ ...item, submitAsCompleted: true }))} style={({ pressed }) => [styles.choiceCard, draft.submitAsCompleted ? styles.choiceCardActive : null, pressed ? styles.pressed : null]}>
                            <Text style={[styles.choiceTitle, draft.submitAsCompleted ? styles.choiceTitleActive : null]}>已完成</Text>
                            <Text style={[styles.choiceDesc, draft.submitAsCompleted ? styles.choiceDescActive : null]}>一起提交完工信息</Text>
                          </Pressable>
                        </View>
                        {draft.submitAsCompleted ? (
                          <View style={styles.completionBlock}>
                            <Text style={styles.label}>维修后照片（必填）</Text>
                            <UploadButtons onCamera={() => appendMaintenancePhoto(draft.clientId, 'completionAfterPhotos', 'camera')} onLibrary={() => appendMaintenancePhoto(draft.clientId, 'completionAfterPhotos', 'library')} />
                            <PhotoStrip urls={draft.completionAfterPhotos} onPress={openViewer} onRemove={(photoIndex) => removeMaintenancePhoto(draft.clientId, 'completionAfterPhotos', photoIndex)} />
                            <Text style={styles.label}>维修备注（可选）</Text>
                            <TextInput value={draft.completionNote} onChangeText={(v) => updateMaintenanceDraft(draft.clientId, (item) => ({ ...item, completionNote: v }))} style={[styles.input, styles.textarea]} placeholder="例如：已维修完成，可正常使用" placeholderTextColor="#9CA3AF" multiline />
                          </View>
                        ) : null}
                      </View>
                    </View>
                  ))
                : kind === 'deep_cleaning'
                  ? deepCleaningDrafts.map((draft, index) => (
                      <View key={draft.clientId} style={styles.createCard}>
                        <View style={styles.createCardHeader}>
                          <Text style={styles.createCardTitle}>{`深清记录 ${index + 1}`}</Text>
                          {deepCleaningDrafts.length > 1 ? (
                            <Pressable onPress={() => removeDeepCleaningDraft(draft.clientId)} style={({ pressed }) => [styles.removeBtn, pressed ? styles.pressed : null]}>
                            <Text style={styles.removeBtnText}>删除</Text>
                          </Pressable>
                        ) : null}
                      </View>
                        <View style={styles.createSection}>
                          <Text style={styles.createSectionTitle}>基础信息</Text>
                          <Text style={styles.label}>需要深清的区域</Text>
                          <View style={styles.chipsRow}>
                            {DEEP_CLEANING_AREA_OPTIONS.map((x) => (
                              <Pressable key={`${draft.clientId}-${x}`} onPress={() => updateDeepCleaningDraft(draft.clientId, (item) => ({ ...item, area: x }))} style={({ pressed }) => [styles.chip, draft.area === x ? styles.chipActive : null, pressed ? styles.pressed : null]}>
                                <Text style={[styles.chipText, draft.area === x ? styles.chipTextActive : null]}>{x}</Text>
                              </Pressable>
                            ))}
                          </View>
                          <Text style={styles.label}>原始情况说明</Text>
                          <TextInput value={draft.detail} onChangeText={(v) => updateDeepCleaningDraft(draft.clientId, (item) => ({ ...item, detail: v }))} style={[styles.input, styles.textarea]} placeholder="请描述需要深清的整体问题" placeholderTextColor="#9CA3AF" multiline />
                        </View>
                        <View style={styles.createSection}>
                          <Text style={styles.createSectionTitle}>现场照片</Text>
                          <Text style={styles.label}>深度清洁前照片</Text>
                          <UploadButtons onCamera={() => appendDeepCleaningPhoto(draft.clientId, 'media', 'camera')} onLibrary={() => appendDeepCleaningPhoto(draft.clientId, 'media', 'library')} />
                          <PhotoStrip urls={draft.media} onPress={openViewer} onRemove={(photoIndex) => removeDeepCleaningPhoto(draft.clientId, 'media', photoIndex)} />
                        </View>
                        <View style={styles.createSection}>
                          <Text style={styles.createSectionTitle}>完成信息</Text>
                          <Text style={styles.label}>完成确认</Text>
                          <View style={styles.choiceGrid}>
                            <Pressable onPress={() => updateDeepCleaningDraft(draft.clientId, (item) => ({ ...item, submitAsCompleted: false, completionAfterPhotos: [], completionNote: '', completionStartedAt: null, completionEndedAt: null }))} style={({ pressed }) => [styles.choiceCard, !draft.submitAsCompleted ? styles.choiceCardActive : null, pressed ? styles.pressed : null]}>
                              <Text style={[styles.choiceTitle, !draft.submitAsCompleted ? styles.choiceTitleActive : null]}>未完成</Text>
                              <Text style={[styles.choiceDesc, !draft.submitAsCompleted ? styles.choiceDescActive : null]}>先提交反馈</Text>
                            </Pressable>
                            <Pressable onPress={() => updateDeepCleaningDraft(draft.clientId, (item) => ({ ...item, submitAsCompleted: true }))} style={({ pressed }) => [styles.choiceCard, draft.submitAsCompleted ? styles.choiceCardActive : null, pressed ? styles.pressed : null]}>
                              <Text style={[styles.choiceTitle, draft.submitAsCompleted ? styles.choiceTitleActive : null]}>已完成</Text>
                              <Text style={[styles.choiceDesc, draft.submitAsCompleted ? styles.choiceDescActive : null]}>一起提交完工信息</Text>
                            </Pressable>
                          </View>
                          {draft.submitAsCompleted ? (
                            <View style={styles.completionBlock}>
                              <Text style={styles.label}>开始时间</Text>
                              <Pressable onPress={() => openDraftTimePicker(draft.clientId, 'draft_started_at')} style={({ pressed }) => [styles.timeField, pressed ? styles.pressed : null]}>
                                <Text style={String(draft.completionStartedAt || '').trim() ? styles.timeFieldText : styles.timeFieldPlaceholder}>{fmtTimeOnly(draft.completionStartedAt)}</Text>
                                <Ionicons name="time-outline" size={18} color="#2563EB" />
                              </Pressable>
                              <Text style={styles.label}>结束时间</Text>
                              <Pressable onPress={() => openDraftTimePicker(draft.clientId, 'draft_ended_at')} style={({ pressed }) => [styles.timeField, pressed ? styles.pressed : null]}>
                                <Text style={String(draft.completionEndedAt || '').trim() ? styles.timeFieldText : styles.timeFieldPlaceholder}>{fmtTimeOnly(draft.completionEndedAt)}</Text>
                                <Ionicons name="time-outline" size={18} color="#2563EB" />
                              </Pressable>
                              <Text style={styles.label}>深度清洁后照片（必填）</Text>
                              <UploadButtons onCamera={() => appendDeepCleaningPhoto(draft.clientId, 'completionAfterPhotos', 'camera')} onLibrary={() => appendDeepCleaningPhoto(draft.clientId, 'completionAfterPhotos', 'library')} />
                              <PhotoStrip urls={draft.completionAfterPhotos} onPress={openViewer} onRemove={(photoIndex) => removeDeepCleaningPhoto(draft.clientId, 'completionAfterPhotos', photoIndex)} />
                              <Text style={styles.label}>处理说明（可选）</Text>
                              <TextInput value={draft.completionNote} onChangeText={(v) => updateDeepCleaningDraft(draft.clientId, (item) => ({ ...item, completionNote: v }))} style={[styles.input, styles.textarea]} placeholder="例如：已经深清完成，异味已消除" placeholderTextColor="#9CA3AF" multiline />
                            </View>
                          ) : null}
                        </View>
                      </View>
                    ))
                  : dailyDrafts.map((draft, index) => (
                      <View key={draft.clientId} style={styles.createCard}>
                        <View style={styles.createCardHeader}>
                          <Text style={styles.createCardTitle}>{`日用品记录 ${index + 1}`}</Text>
                          {dailyDrafts.length > 1 ? (
                            <Pressable onPress={() => removeDailyDraft(draft.clientId)} style={({ pressed }) => [styles.removeBtn, pressed ? styles.pressed : null]}>
                            <Text style={styles.removeBtnText}>删除</Text>
                          </Pressable>
                        ) : null}
                      </View>
                        <View style={styles.createSection}>
                          <Text style={styles.createSectionTitle}>基础信息</Text>
                          <Text style={styles.label}>状态</Text>
                          <View style={styles.chipsRow}>
                            {DAILY_STATUS_OPTIONS.map((x) => (
                              <Pressable key={`${draft.clientId}-${x.value}`} onPress={() => updateDailyDraft(draft.clientId, (item) => ({ ...item, status: x.value }))} style={({ pressed }) => [styles.chip, draft.status === x.value ? styles.chipActive : null, pressed ? styles.pressed : null]}>
                                <Text style={[styles.chipText, draft.status === x.value ? styles.chipTextActive : null]}>{x.label}</Text>
                              </Pressable>
                            ))}
                          </View>
                          <Text style={styles.label}>物品名称</Text>
                          <TextInput
                            value={draft.itemName}
                            onFocus={() => {
                              setActiveDailySuggestTarget(dailySuggestKey('draft', draft.clientId))
                            }}
                            onChangeText={(v) => {
                              setActiveDailySuggestTarget(dailySuggestKey('draft', draft.clientId))
                              updateDailyDraft(draft.clientId, (item) => ({ ...item, itemName: v, itemSku: null }))
                            }}
                            style={styles.input}
                            placeholder="输入物品名称或 SKU 搜索"
                            placeholderTextColor="#9CA3AF"
                          />
                          <Text style={styles.helperText}>可直接输入，也可从下方常用日用品中快速选择，支持按名称或 SKU 搜索。</Text>
                          {activeDailySuggestTarget === dailySuggestKey('draft', draft.clientId) ? (
                            <View style={styles.suggestList}>
                              {!filterDailyOptions(draft.itemName).length ? <Text style={styles.muted}>没有匹配项，可以直接输入物品名称</Text> : null}
                              {filterDailyOptions(draft.itemName).map((option) => (
                                <Pressable key={option.id || `${option.item_name}-${option.sku}`} onPress={() => applyDailyOption(dailySuggestKey('draft', draft.clientId), option)} style={({ pressed }) => [styles.suggestItem, pressed ? styles.pressed : null]}>
                                  <Text style={styles.suggestItemTitle}>{option.item_name}</Text>
                                  {dailyOptionMeta(option) ? <Text style={styles.suggestItemMeta}>{dailyOptionMeta(option)}</Text> : null}
                                </Pressable>
                              ))}
                            </View>
                          ) : null}
                          <Text style={styles.label}>数量</Text>
                          <TextInput value={draft.qty} onChangeText={(v) => updateDailyDraft(draft.clientId, (item) => ({ ...item, qty: v.replace(/[^\d]/g, '') }))} style={styles.input} placeholder="例如：2" placeholderTextColor="#9CA3AF" keyboardType="number-pad" />
                        </View>
                        <View style={styles.createSection}>
                          <Text style={styles.createSectionTitle}>现场照片与备注</Text>
                          <Text style={styles.label}>照片</Text>
                          <UploadButtons onCamera={() => appendDailyPhoto(draft.clientId, 'camera')} onLibrary={() => appendDailyPhoto(draft.clientId, 'library')} />
                          <PhotoStrip urls={draft.media} onPress={openViewer} onRemove={(photoIndex) => removeDailyDraftPhoto(draft.clientId, photoIndex)} />
                          <Text style={styles.label}>备注</Text>
                          <TextInput value={draft.note} onChangeText={(v) => updateDailyDraft(draft.clientId, (item) => ({ ...item, note: v }))} style={[styles.input, styles.textarea]} placeholder="备注或照片至少填一个" placeholderTextColor="#9CA3AF" multiline />
                        </View>
                      </View>
                    ))}
              <View style={styles.batchActions}>
                <Pressable
                  onPress={() => {
                    if (kind === 'maintenance') setMaintenanceDrafts((prev) => [...prev, buildMaintenanceDraft()])
                    else if (kind === 'deep_cleaning') setDeepCleaningDrafts((prev) => [...prev, buildDeepCleaningDraft()])
                    else setDailyDrafts((prev) => [...prev, buildDailyDraft()])
                  }}
                  style={({ pressed }) => [styles.secondaryBtn, pressed ? styles.pressed : null]}
                >
                  <Text style={styles.secondaryBtnText}>新增一条记录</Text>
                </Pressable>
                <Pressable onPress={submitFeedback} disabled={submitting} style={({ pressed }) => [styles.submitBtn, styles.batchSubmitBtn, submitting ? styles.submitDisabled : null, pressed ? styles.pressed : null]}>
                  <Text style={styles.submitText}>{submitButtonLabel}</Text>
                </Pressable>
              </View>
            </StepCard>

            <View style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <View style={styles.historyTitleWrap}>
                  <Text style={styles.historyTitle}>本房源历史反馈</Text>
                  <Text style={styles.historySubtitle}>处理中反馈默认展开，待复核记录默认收起，可按需查看。</Text>
                </View>
                <Pressable onPress={() => setExpanded((v) => !v)} style={({ pressed }) => [styles.historyToggle, pressed ? styles.pressed : null]}>
                  <Text style={styles.historyToggleText}>{expanded ? '收起' : '展开'}</Text>
                </Pressable>
              </View>

              {loadingList ? (
                <View style={styles.historySyncBanner}>
                  <ActivityIndicator size="small" color="#1D4ED8" />
                  <View style={styles.historySyncTextWrap}>
                    <Text style={styles.historySyncTitle}>历史反馈记录更新状态同步中</Text>
                    <Text style={styles.historySyncSubtitle}>{pending.length ? '正在刷新最新状态和照片，请稍等。' : '正在加载历史反馈记录，请稍等。'}</Text>
                  </View>
                </View>
              ) : null}
              {listError ? <Text style={styles.muted}>{listError}</Text> : null}
              {expanded && !listError ? (
                <View style={styles.historyGroups}>
                  <View style={styles.historySection}>
                    <View style={styles.historySectionHead}>
                      <View style={styles.historySectionTextWrap}>
                        <Text style={styles.historySectionTitle}>处理中反馈</Text>
                        <Text style={styles.historySectionSubtitle}>先看当前还需要继续跟进的记录，再按类型查看。</Text>
                      </View>
                      <View style={styles.historySectionCount}>
                        <Text style={styles.historySectionCountText}>{pendingHistoryCount}</Text>
                      </View>
                    </View>
                    <FeedbackGroup title="房源维修" items={pendingGroups.maintenance} emptyText="暂无处理中维修反馈" onView={setDetailItem} onEdit={requestRecordEdit} onPreview={openViewer} />
                    <FeedbackGroup title="深度清洁" items={pendingGroups.deep} emptyText="暂无处理中深清反馈" onView={setDetailItem} onEdit={requestRecordEdit} onPreview={openViewer} />
                    <FeedbackGroup title="日用品反馈" items={pendingGroups.daily} emptyText="暂无处理中日用品反馈" onView={setDetailItem} onEdit={requestRecordEdit} onPreview={openViewer} />
                  </View>

                  <View style={styles.historySection}>
                    <View style={styles.historySectionHead}>
                      <View style={styles.historySectionTextWrap}>
                        <Text style={styles.historySectionTitle}>已完成待复核</Text>
                        <Text style={styles.historySectionSubtitle}>已提交完工信息，等待后续复核确认。</Text>
                      </View>
                      <View style={styles.historySectionHeadActions}>
                        <View style={styles.historySectionCount}>
                          <Text style={styles.historySectionCountText}>{resolved.length}</Text>
                        </View>
                        <Pressable onPress={() => setResolvedExpanded((v) => !v)} style={({ pressed }) => [styles.historySectionToggle, pressed ? styles.pressed : null]}>
                          <Text style={styles.historySectionToggleText}>{resolvedExpanded ? '收起' : '展开'}</Text>
                        </Pressable>
                      </View>
                    </View>
                    {resolvedExpanded ? <FeedbackGroup title="完工记录" items={resolved} emptyText="暂无待复核记录" onView={setDetailItem} onEdit={requestRecordEdit} onPreview={openViewer} /> : null}
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        )}
      </ScrollView>

      <Modal visible={!!detailItem} transparent presentationStyle="overFullScreen" animationType="fade" onRequestClose={closeDetailModal}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={closeDetailModal} />
          <View style={styles.modalSheet}>
            <View style={styles.modalTop}>
              <Text style={styles.modalTitle}>反馈详情</Text>
              <View style={styles.modalActions}>
                {detailItem ? (
                  <Pressable onPress={() => requestRecordEdit(detailItem)} style={({ pressed }) => [styles.headerActionBtn, pressed ? styles.pressed : null]}>
                    <Ionicons name="create-outline" size={16} color="#2563EB" />
                    <Text style={styles.headerActionText}>编辑记录</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={closeDetailModal}><Text style={styles.closeText}>关闭</Text></Pressable>
              </View>
            </View>
            <View style={styles.modalBody}>
              <ScrollView style={styles.modalScroll} contentContainerStyle={styles.detailModalBody} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                <Text style={styles.detailHeadline}>{statusLabel(detailItem)}</Text>
                {detailItem?.kind === 'daily_necessities' ? <Text style={styles.detailText}>{extractContentText(detailItem?.detail) || '-'}</Text> : null}
                <Text style={styles.detailMeta}>{`${String(detailItem?.created_by_name || '').trim() || 'unknown'}  ${fmtTime(detailItem?.created_at || '')}`}</Text>

                {detailItem?.kind === 'daily_necessities' && normalizeUrls(detailItem?.media_urls).length ? (
                  <>
                    <Text style={styles.label}>原始反馈照片</Text>
                    <PhotoStrip urls={normalizeUrls(detailItem?.media_urls)} onPress={openViewer} />
                  </>
                ) : null}

                {detailItem && detailRecord && (detailItem.kind === 'maintenance' || detailItem.kind === 'deep_cleaning') ? (
                  <>
                    <View style={styles.sectionHead}>
                      <Text style={styles.sectionTitle}>原记录</Text>
                    </View>
                    <View style={styles.projectCard}>
                      <View style={styles.projectTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.projectTitle}>{detailItem.kind === 'deep_cleaning' ? '深度清洁记录' : '维修记录'}</Text>
                          <Text style={styles.projectMeta}>{projectStatusLabel(detailRecord, detailItem)}</Text>
                        </View>
                      </View>
                      {detailItem.kind === 'deep_cleaning' ? (
                        <Text style={styles.projectMeta}>{`区域：${(detailItem.areas || []).filter(Boolean).join('、') || '-'}`}</Text>
                      ) : detailRecord.area ? (
                        <Text style={styles.projectMeta}>{`区域：${detailRecord.area}`}</Text>
                      ) : null}
                      {detailItem.kind === 'maintenance' && detailRecord.category ? <Text style={styles.projectMeta}>{`类型：${detailRecord.category}`}</Text> : null}
                      {detailRecord.detail ? <Text style={styles.projectText}>{`${detailItem.kind === 'deep_cleaning' ? '情况' : '问题'}：${detailRecord.detail}`}</Text> : null}
                      {detailRecord.note ? <Text style={styles.projectText}>{`处理：${detailRecord.note}`}</Text> : null}
                      {detailItem.kind === 'deep_cleaning' && (detailRecord.started_at || detailRecord.ended_at) ? (
                        <Text style={styles.projectMeta}>{`开始：${fmtTime(detailRecord.started_at || '')}  结束：${fmtTime(detailRecord.ended_at || '')}`}</Text>
                      ) : null}
                      {detailRecord.before_photos.length ? (
                        <>
                          <Text style={styles.photoSectionLabel}>{detailItem.kind === 'deep_cleaning' ? '深度清洁前照片' : '维修前照片'}</Text>
                          <PhotoStrip urls={detailRecord.before_photos} onPress={openViewer} />
                        </>
                      ) : null}
                      {detailRecord.after_photos.length ? (
                        <>
                          <Text style={styles.photoSectionLabel}>{detailItem.kind === 'deep_cleaning' ? '深度清洁后照片' : '维修后照片'}</Text>
                          <PhotoStrip urls={detailRecord.after_photos} onPress={openViewer} />
                        </>
                      ) : null}
                    </View>
                  </>
                ) : null}
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={recordEditOpen} transparent presentationStyle="overFullScreen" animationType="fade" onRequestClose={() => { setRecordEditOpen(false); setRecordEditFeedback(null) }}>
        <View style={styles.modalRoot}>
          <View style={styles.modalSheet}>
            <View style={styles.modalTop}>
              <Text style={styles.modalTitle}>编辑记录</Text>
              <Pressable onPress={() => { setRecordEditOpen(false); setRecordEditFeedback(null) }}><Text style={styles.closeText}>关闭</Text></Pressable>
            </View>
            <View style={styles.modalBody}>
              <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollBody} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                {recordEditFeedback ? (
                  <>
                  {recordEditFeedback.kind === 'maintenance' ? (
                    <>
                      <Text style={styles.label}>区域</Text>
                      <View style={styles.chipsRow}>
                        {AREA_OPTIONS.map((x) => (
                          <Pressable key={x} onPress={() => setProjectForm((prev) => ({ ...prev, area: x }))} style={({ pressed }) => [styles.chip, projectForm.area === x ? styles.chipActive : null, pressed ? styles.pressed : null]}>
                            <Text style={[styles.chipText, projectForm.area === x ? styles.chipTextActive : null]}>{x}</Text>
                          </Pressable>
                        ))}
                      </View>
                      <Text style={styles.label}>问题说明</Text>
                      <TextInput value={String(projectForm.detail || '')} onChangeText={(v) => setProjectForm((prev) => ({ ...prev, detail: v }))} style={[styles.input, styles.textarea]} placeholder="问题说明" placeholderTextColor="#9CA3AF" multiline />
                    </>
                  ) : (
                    <>
                      <Text style={styles.label}>需要深清的区域</Text>
                      <View style={styles.chipsRow}>
                        {DEEP_CLEANING_AREA_OPTIONS.map((x) => (
                          <Pressable key={x} onPress={() => setRecordArea(x)} style={({ pressed }) => [styles.chip, recordArea === x ? styles.chipActive : null, pressed ? styles.pressed : null]}>
                            <Text style={[styles.chipText, recordArea === x ? styles.chipTextActive : null]}>{x}</Text>
                          </Pressable>
                        ))}
                      </View>
                      <Text style={styles.label}>原始情况说明</Text>
                      <TextInput value={String(projectForm.detail || '')} onChangeText={(v) => setProjectForm((prev) => ({ ...prev, detail: v }))} style={[styles.input, styles.textarea]} placeholder="请描述需要深清的情况" placeholderTextColor="#9CA3AF" multiline />
                    </>
                  )}
                  <Text style={styles.label}>{recordEditFeedback.kind === 'deep_cleaning' ? '深度清洁前照片' : '维修前照片'}</Text>
                  <UploadButtons onCamera={() => appendProjectPhoto('before_photos', 'camera')} onLibrary={() => appendProjectPhoto('before_photos', 'library')} />
                  <PhotoStrip urls={projectForm.before_photos} onPress={openViewer} onRemove={(photoIndex) => removeProjectPhoto('before_photos', photoIndex)} />
                  <Text style={styles.label}>{recordEditFeedback.kind === 'deep_cleaning' ? '处理备注（可选）' : '维修备注（可选）'}</Text>
                  <TextInput value={String(projectForm.note || '')} onChangeText={(v) => setProjectForm((prev) => ({ ...prev, note: v }))} style={[styles.input, styles.textarea]} placeholder="处理说明" placeholderTextColor="#9CA3AF" multiline />
                  <Text style={styles.label}>{recordEditFeedback.kind === 'deep_cleaning' ? '深度清洁后照片（可选）' : '维修后照片（可选）'}</Text>
                  <UploadButtons onCamera={() => appendProjectPhoto('after_photos', 'camera')} onLibrary={() => appendProjectPhoto('after_photos', 'library')} />
                  <PhotoStrip urls={projectForm.after_photos} onPress={openViewer} onRemove={(photoIndex) => removeProjectPhoto('after_photos', photoIndex)} />
                  </>
                ) : (
                  <Text style={styles.muted}>记录加载中，请重新打开编辑。</Text>
                )}
              </ScrollView>
            </View>
            <View style={styles.modalFooter}>
              <Pressable onPress={saveRecordEdit} disabled={recordEditSaving || !recordEditFeedback} style={({ pressed }) => [styles.submitBtn, recordEditSaving || !recordEditFeedback ? styles.submitDisabled : null, pressed ? styles.pressed : null]}>
                <Text style={styles.submitText}>{recordEditSaving ? t('common_loading') : '保存记录'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={actionOpen} transparent presentationStyle="overFullScreen" animationType="fade" onRequestClose={() => { setActionOpen(false); setActionFeedback(null); }}>
        <View style={styles.modalRoot}>
          <View style={styles.modalSheet}>
            <View style={styles.modalTop}>
              <Text style={styles.modalTitle}>
                {actionMode === 'create' ? '新增项目' : actionMode === 'edit' ? '编辑项目' : '完成项目'}
              </Text>
              <Pressable onPress={() => { setActionOpen(false); setActionFeedback(null); }}><Text style={styles.closeText}>关闭</Text></Pressable>
            </View>
            <View style={styles.modalBody}>
              <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollBody} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                {actionFeedback ? (
                  <>
                  <Text style={styles.label}>项目名称</Text>
                  <TextInput value={projectForm.name} onChangeText={(v) => setProjectForm((prev) => ({ ...prev, name: v }))} style={styles.input} placeholder="例如：浴室漂白" placeholderTextColor="#9CA3AF" />
                  <Text style={styles.label}>区域</Text>
                  <View style={styles.chipsRow}>
                    {(actionFeedback?.kind === 'deep_cleaning' ? DEEP_CLEANING_AREA_OPTIONS : AREA_OPTIONS).map((x) => (
                      <Pressable key={x} onPress={() => setProjectForm((prev) => ({ ...prev, area: x }))} style={({ pressed }) => [styles.chip, projectForm.area === x ? styles.chipActive : null, pressed ? styles.pressed : null]}>
                        <Text style={[styles.chipText, projectForm.area === x ? styles.chipTextActive : null]}>{x}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {actionFeedback?.kind === 'maintenance' ? (
                    <>
                      <Text style={styles.label}>问题说明</Text>
                      <TextInput value={String(projectForm.detail || '')} onChangeText={(v) => setProjectForm((prev) => ({ ...prev, detail: v }))} style={[styles.input, styles.textarea]} placeholder="问题说明" placeholderTextColor="#9CA3AF" multiline />
                    </>
                  ) : null}
                  <Text style={styles.label}>{actionFeedback?.kind === 'deep_cleaning' ? '处理说明' : '处理备注'}</Text>
                  <TextInput value={String(projectForm.note || '')} onChangeText={(v) => setProjectForm((prev) => ({ ...prev, note: v }))} style={[styles.input, styles.textarea]} placeholder="处理说明" placeholderTextColor="#9CA3AF" multiline />
                  {actionMode === 'complete' && actionFeedback?.kind === 'deep_cleaning' ? (
                    <>
                      <Text style={styles.label}>开始时间</Text>
                      <Pressable onPress={() => openTimePicker('project_started_at')} style={({ pressed }) => [styles.timeField, pressed ? styles.pressed : null]}>
                        <Text style={String(projectForm.started_at || '').trim() ? styles.timeFieldText : styles.timeFieldPlaceholder}>{fmtTimeOnly(projectForm.started_at)}</Text>
                        <Ionicons name="time-outline" size={18} color="#2563EB" />
                      </Pressable>
                      <Text style={styles.label}>结束时间</Text>
                      <Pressable onPress={() => openTimePicker('project_ended_at')} style={({ pressed }) => [styles.timeField, pressed ? styles.pressed : null]}>
                        <Text style={String(projectForm.ended_at || '').trim() ? styles.timeFieldText : styles.timeFieldPlaceholder}>{fmtTimeOnly(projectForm.ended_at)}</Text>
                        <Ionicons name="time-outline" size={18} color="#2563EB" />
                      </Pressable>
                    </>
                  ) : null}
                  {actionMode === 'complete' ? (
                    <>
                      <Text style={styles.label}>{actionFeedback?.kind === 'deep_cleaning' ? '前照片（必填）' : '前照片（可选）'}</Text>
                      <UploadButtons onCamera={() => appendProjectPhoto('before_photos', 'camera')} onLibrary={() => appendProjectPhoto('before_photos', 'library')} />
                      <PhotoStrip urls={projectForm.before_photos} onPress={openViewer} onRemove={(photoIndex) => removeProjectPhoto('before_photos', photoIndex)} />
                      <Text style={styles.label}>后照片（必填）</Text>
                      <UploadButtons onCamera={() => appendProjectPhoto('after_photos', 'camera')} onLibrary={() => appendProjectPhoto('after_photos', 'library')} />
                      <PhotoStrip urls={projectForm.after_photos} onPress={openViewer} onRemove={(photoIndex) => removeProjectPhoto('after_photos', photoIndex)} />
                    </>
                  ) : null}
                  </>
                ) : <Text style={styles.muted}>记录加载中，请重新打开。</Text>}
              </ScrollView>
            </View>
            <View style={styles.modalFooter}>
              <Pressable onPress={saveProjectAction} disabled={actionSaving} style={({ pressed }) => [styles.submitBtn, actionSaving ? styles.submitDisabled : null, pressed ? styles.pressed : null]}>
                <Text style={styles.submitText}>{actionSaving ? t('common_loading') : actionMode === 'complete' ? '保存记录' : '保存项目'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={dailyEditOpen} transparent presentationStyle="overFullScreen" animationType="fade" onRequestClose={() => setDailyEditOpen(false)}>
        <View style={styles.modalRoot}>
          <View style={styles.modalSheet}>
            <View style={styles.modalTop}>
              <Text style={styles.modalTitle}>编辑日用品反馈</Text>
              <Pressable onPress={() => setDailyEditOpen(false)}><Text style={styles.closeText}>关闭</Text></Pressable>
            </View>
            <View style={styles.modalBody}>
              <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollBody} nestedScrollEnabled>
                <Text style={styles.label}>状态</Text>
                <View style={styles.chipsRow}>
                  {DAILY_STATUS_OPTIONS.map((x) => (
                    <Pressable key={x.value} onPress={() => setDailyEditStatus(x.value)} style={({ pressed }) => [styles.chip, dailyEditStatus === x.value ? styles.chipActive : null, pressed ? styles.pressed : null]}>
                      <Text style={[styles.chipText, dailyEditStatus === x.value ? styles.chipTextActive : null]}>{x.label}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.label}>物品名称</Text>
                <TextInput
                  value={dailyEditItemName}
                  onFocus={() => {
                    setActiveDailySuggestTarget(dailySuggestKey('edit'))
                  }}
                  onChangeText={(v) => {
                    setActiveDailySuggestTarget(dailySuggestKey('edit'))
                    setDailyEditItemName(v)
                    setDailyEditItemSku(null)
                  }}
                  style={styles.input}
                  placeholder="输入物品名称或 SKU 搜索"
                  placeholderTextColor="#9CA3AF"
                />
                <Text style={styles.helperText}>可直接输入，也可从下方常用日用品中快速选择，支持按名称或 SKU 搜索。</Text>
                {activeDailySuggestTarget === dailySuggestKey('edit') ? (
                  <View style={styles.suggestList}>
                    {!filterDailyOptions(dailyEditItemName).length ? <Text style={styles.muted}>没有匹配项，可以直接输入物品名称</Text> : null}
                    {filterDailyOptions(dailyEditItemName).map((option) => (
                      <Pressable key={option.id || `${option.item_name}-${option.sku}`} onPress={() => applyDailyOption(dailySuggestKey('edit'), option)} style={({ pressed }) => [styles.suggestItem, pressed ? styles.pressed : null]}>
                        <Text style={styles.suggestItemTitle}>{option.item_name}</Text>
                        {dailyOptionMeta(option) ? <Text style={styles.suggestItemMeta}>{dailyOptionMeta(option)}</Text> : null}
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <Text style={styles.label}>数量</Text>
                <TextInput value={dailyEditQty} onChangeText={(v) => setDailyEditQty(v.replace(/[^\d]/g, ''))} style={styles.input} placeholder="例如：2" placeholderTextColor="#9CA3AF" keyboardType="number-pad" />
                <Text style={styles.label}>照片</Text>
                <UploadButtons onCamera={() => appendDailyEditPhoto('camera')} onLibrary={() => appendDailyEditPhoto('library')} />
                <PhotoStrip urls={dailyEditMedia} onPress={openViewer} onRemove={removeDailyEditPhoto} />
                <Text style={styles.label}>备注</Text>
                <TextInput value={dailyEditNote} onChangeText={setDailyEditNote} style={[styles.input, styles.textarea]} placeholder="备注或照片至少填一个" placeholderTextColor="#9CA3AF" multiline />
              </ScrollView>
            </View>
            <View style={styles.modalFooter}>
              <Pressable onPress={saveDailyEdit} disabled={dailyEditSaving} style={({ pressed }) => [styles.submitBtn, dailyEditSaving ? styles.submitDisabled : null, pressed ? styles.pressed : null]}>
                <Text style={styles.submitText}>{dailyEditSaving ? t('common_loading') : '保存修改'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={viewerOpen} transparent presentationStyle="overFullScreen" animationType="fade" onRequestClose={closeViewer}>
        <Pressable style={styles.viewerBackdrop} onPress={closeViewer}>
          <Pressable style={styles.viewerCard} onPress={() => {}}>
            <ScrollView
              horizontal
              pagingEnabled
              directionalLockEnabled
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              contentOffset={{ x: viewerIndex * screenWidth, y: 0 }}
              onMomentumScrollEnd={(event) => syncViewerIndex(event.nativeEvent.contentOffset.x)}
            >
            {viewerUrls.map((u, idx) => (
                <View key={`${u}-${idx}`} style={[styles.viewerSlide, { width: screenWidth }]}>
                <Image source={{ uri: toAbsoluteUrl(u) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
              </View>
            ))}
            </ScrollView>
            <View style={[styles.viewerTop, { paddingTop: Math.max(insets.top, 12) }]}>
              <Pressable onPress={closeViewer}><Text style={styles.viewerText}>关闭</Text></Pressable>
              {viewerUrls.length ? <Text style={styles.viewerCounter}>{`${Math.min(viewerIndex + 1, viewerUrls.length)}/${viewerUrls.length}`}</Text> : null}
              {viewerUrls[viewerIndex] ? (
                <Pressable onPress={() => Linking.openURL(viewerUrls[viewerIndex]).catch(() => Alert.alert(t('common_error'), '打开失败'))}>
                  <Text style={styles.viewerText}>浏览器打开</Text>
                </Pressable>
              ) : null}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={timePickerOpen} transparent presentationStyle="overFullScreen" animationType="slide" onRequestClose={() => setTimePickerOpen(false)}>
        <View style={styles.modalRoot}>
          <View style={[styles.modalCard, { maxHeight: '72%' }]}>
            <View style={styles.modalTop}>
              <Text style={styles.modalTitle}>{timeField === 'project_started_at' || timeField === 'draft_started_at' ? '选择开始时间' : '选择结束时间'}</Text>
              <Pressable onPress={() => setTimePickerOpen(false)}><Text style={styles.closeText}>关闭</Text></Pressable>
            </View>
            <View style={{ padding: 14 }}>
              <Text style={styles.label}>小时</Text>
              <View style={styles.timeGrid}>
                {Array.from({ length: 24 }, (_, idx) => idx).map((hour) => (
                  <Pressable key={`hour-${hour}`} onPress={() => setPickerHour(hour)} style={({ pressed }) => [styles.timeChip, pickerHour === hour ? styles.timeChipActive : null, pressed ? styles.pressed : null]}>
                    <Text style={[styles.timeChipText, pickerHour === hour ? styles.timeChipTextActive : null]}>{String(hour).padStart(2, '0')}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.label}>分钟</Text>
              <View style={styles.timeGrid}>
                {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((minute) => (
                  <Pressable key={`minute-${minute}`} onPress={() => setPickerMinute(minute)} style={({ pressed }) => [styles.timeChip, pickerMinute === minute ? styles.timeChipActive : null, pressed ? styles.pressed : null]}>
                    <Text style={[styles.timeChipText, pickerMinute === minute ? styles.timeChipTextActive : null]}>{String(minute).padStart(2, '0')}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: '#F8FAFC' }}>
                <Text style={styles.projectMeta}>{`已选时间：${String(pickerHour).padStart(2, '0')}:${String(pickerMinute).padStart(2, '0')}`}</Text>
              </View>
              <Pressable onPress={applyPickedTime} style={({ pressed }) => [styles.submitBtn, pressed ? styles.pressed : null]}>
                <Text style={styles.submitText}>确认时间</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  )
}

function UploadButtons(props: { onCamera: () => void; onLibrary: () => void }) {
  return (
    <View style={styles.photoRow}>
      <Pressable onPress={props.onCamera} style={({ pressed }) => [styles.photoBtn, pressed ? styles.pressed : null]}>
        <Text style={styles.photoBtnText}>拍照上传</Text>
      </Pressable>
      <Pressable onPress={props.onLibrary} style={({ pressed }) => [styles.photoBtn, pressed ? styles.pressed : null]}>
        <Text style={styles.photoBtnText}>相册选择</Text>
      </Pressable>
    </View>
  )
}

function StepCard(props: { step: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <View style={styles.stepCard}>
      <View style={styles.stepHeader}>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>{props.step}</Text>
        </View>
        <View style={styles.stepHeaderText}>
          <Text style={styles.stepTitle}>{props.title}</Text>
          {props.subtitle ? <Text style={styles.stepSubtitle}>{props.subtitle}</Text> : null}
        </View>
      </View>
      <View style={styles.stepBody}>{props.children}</View>
    </View>
  )
}

function PhotoStrip(props: { urls: string[]; onPress: (urls: string[], index: number) => void; onRemove?: (index: number) => void }) {
  if (!props.urls.length) return null
  return (
    <View style={styles.thumbRow}>
      {props.urls.map((u, idx) => (
        <View key={`${u}-${idx}`} style={styles.thumbItemWrap}>
          <Pressable onPress={() => props.onPress(props.urls, idx)} style={({ pressed }) => [styles.thumbWrap, pressed ? styles.pressed : null]}>
            <Image source={{ uri: toAbsoluteUrl(u) }} style={styles.thumb} />
          </Pressable>
          {props.onRemove ? (
            <Pressable onPress={() => props.onRemove?.(idx)} style={({ pressed }) => [styles.thumbDeleteBtn, pressed ? styles.pressed : null]}>
              <Ionicons name="trash-outline" size={14} color="#FFFFFF" />
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  )
}

function FeedbackGroup(props: { title: string; items: PropertyFeedback[]; emptyText?: string; onView: (item: PropertyFeedback) => void; onEdit: (item: PropertyFeedback) => void; onPreview: (urls: string[], index: number) => void }) {
  return (
    <View style={styles.groupBlock}>
      <View style={styles.groupHead}>
        <Text style={styles.groupTitle}>{props.title}</Text>
        <View style={styles.groupCountPill}>
          <Text style={styles.groupCountText}>{props.items.length}</Text>
        </View>
      </View>
      {props.items.length ? (
        props.items.map((item) => {
          const previewUrls = feedbackPreviewUrls(item)
          const previewUrl = previewUrls[0] ? toAbsoluteUrl(previewUrls[0]) : ''
          return (
            <View key={`${item.kind}:${item.id}`} style={styles.feedbackItem}>
              <View style={styles.feedbackRow}>
                <View style={styles.feedbackMain}>
                  <Text style={styles.feedbackTitle}>{feedbackListTitle(item)}</Text>
                  <Text style={styles.feedbackMeta}>{statusLabel(item)}</Text>
                </View>
                {previewUrl ? (
                  <Pressable onPress={() => props.onPreview(previewUrls, 0)} style={({ pressed }) => [styles.feedbackThumbWrap, pressed ? styles.pressed : null]}>
                    <Image source={{ uri: previewUrl }} style={styles.feedbackThumb} resizeMode="cover" />
                    {previewUrls.length > 1 ? (
                      <View style={styles.feedbackThumbBadge}>
                        <Text style={styles.feedbackThumbBadgeText}>{previewUrls.length}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                ) : null}
                <View style={styles.feedbackActions}>
                  <Pressable onPress={() => props.onView(item)} style={({ pressed }) => [styles.iconBtn, pressed ? styles.pressed : null]}>
                    <Ionicons name="eye-outline" size={18} color="#2563EB" />
                  </Pressable>
                  <Pressable onPress={() => props.onEdit(item)} style={({ pressed }) => [styles.iconBtn, pressed ? styles.pressed : null]}>
                    <Ionicons name="create-outline" size={18} color="#2563EB" />
                  </Pressable>
                </View>
              </View>
            </View>
          )
        })
      ) : (
        <Text style={styles.groupEmptyText}>{props.emptyText || '暂无记录'}</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 16, paddingBottom: 40 },
  pageStack: { gap: 14 },
  stepCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, borderWidth: hairline(), borderColor: '#E5E7EB', shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 1, overflow: 'hidden' },
  stepHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  stepBadgeText: { color: '#1D4ED8', fontWeight: '900', fontSize: 13 },
  stepHeaderText: { flex: 1 },
  stepTitle: { fontSize: 18, fontWeight: '900', color: '#111827' },
  stepSubtitle: { marginTop: 4, color: '#6B7280', fontWeight: '600', lineHeight: 18 },
  stepBody: { marginTop: 16, minWidth: 0 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  headerTextWrap: { flex: 1, minWidth: 0 },
  title: { fontSize: 22, fontWeight: '900', color: '#111827' },
  taskBadge: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  taskBadgeText: { color: '#2563EB', fontWeight: '800' },
  sub: { marginTop: 8, color: '#6B7280', fontWeight: '600', lineHeight: 20 },
  segmentRow: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  segment: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#EEF2FF' },
  segmentActive: { backgroundColor: '#2563EB' },
  segmentText: { color: '#1E3A8A', fontWeight: '800', fontSize: 12 },
  segmentTextActive: { color: '#FFFFFF' },
  label: { marginTop: 14, marginBottom: 8, fontWeight: '800', color: '#111827', fontSize: 14 },
  input: { height: 44, width: '100%', alignSelf: 'stretch', borderWidth: hairline(), borderColor: '#D1D5DB', borderRadius: 12, paddingHorizontal: 12, color: '#111827', backgroundColor: '#FFFFFF' },
  textarea: { height: 112, minHeight: 112, paddingTop: 12, paddingBottom: 12, textAlignVertical: 'top' },
  helperText: { marginTop: 6, color: '#64748B', fontSize: 12, lineHeight: 17, fontWeight: '600' },
  errorText: { marginTop: 6, color: '#DC2626', fontSize: 12, fontWeight: '700' },
  suggestList: { marginTop: 8, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: hairline(), borderColor: '#E2E8F0', overflow: 'hidden' },
  suggestItem: { paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: hairline(), borderBottomColor: '#E5E7EB' },
  suggestItemTitle: { color: '#111827', fontWeight: '800' },
  suggestItemMeta: { marginTop: 4, color: '#64748B', fontSize: 12, fontWeight: '700' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB' },
  chipActive: { backgroundColor: '#DBEAFE', borderColor: '#93C5FD' },
  chipText: { color: '#111827', fontWeight: '700', fontSize: 12 },
  chipTextActive: { color: '#1D4ED8' },
  photoRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  photoBtn: { backgroundColor: '#EFF6FF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: hairline(), borderColor: '#BFDBFE' },
  photoBtnText: { color: '#1D4ED8', fontWeight: '800' },
  choiceGrid: { flexDirection: 'row', gap: 10 },
  choiceCard: { flex: 1, borderRadius: 16, borderWidth: hairline(), borderColor: '#D1D5DB', backgroundColor: '#F8FAFC', paddingHorizontal: 14, paddingVertical: 12 },
  choiceCardActive: { backgroundColor: '#EFF6FF', borderColor: '#93C5FD' },
  choiceTitle: { fontSize: 15, fontWeight: '900', color: '#111827' },
  choiceTitleActive: { color: '#1D4ED8' },
  choiceDesc: { marginTop: 4, color: '#6B7280', fontWeight: '600', lineHeight: 16, fontSize: 12 },
  choiceDescActive: { color: '#1E40AF' },
  createCard: { marginTop: 12, borderRadius: 18, backgroundColor: '#F8FAFC', borderWidth: hairline(), borderColor: '#DCE4F2', overflow: 'hidden' },
  createCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: hairline(), borderBottomColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  createCardTitle: { fontSize: 16, fontWeight: '900', color: '#111827' },
  removeBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#FEE2E2' },
  removeBtnText: { color: '#DC2626', fontWeight: '800', fontSize: 12 },
  createSection: { margin: 12, marginTop: 0, padding: 14, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: hairline(), borderColor: '#E8EDF5' },
  createSectionTitle: { fontSize: 13, fontWeight: '900', color: '#475569', letterSpacing: 0.3 },
  completionBlock: { marginTop: 14, borderRadius: 16, backgroundColor: '#F8FAFC', borderWidth: hairline(), borderColor: '#E2E8F0', padding: 14 },
  completionHeader: { marginBottom: 6 },
  completionTitle: { fontSize: 15, fontWeight: '900', color: '#111827' },
  completionSubtitle: { marginTop: 4, color: '#6B7280', fontWeight: '600' },
  timeField: {
    height: 46,
    borderWidth: hairline(),
    borderColor: '#BFDBFE',
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#EFF6FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeFieldText: { color: '#111827', fontWeight: '800' },
  timeFieldPlaceholder: { color: '#6B7280', fontWeight: '700' },
  thumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  thumbItemWrap: { position: 'relative' },
  thumbWrap: { borderRadius: 10, overflow: 'hidden' },
  thumb: { width: 74, height: 74, borderRadius: 10, backgroundColor: '#E5E7EB' },
  thumbDeleteBtn: { position: 'absolute', right: 4, top: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(17,24,39,0.76)', alignItems: 'center', justifyContent: 'center' },
  submitWrap: { marginTop: 2, marginBottom: 2 },
  batchActions: { marginTop: 16, gap: 10 },
  secondaryBtn: { borderRadius: 16, backgroundColor: '#EFF6FF', paddingVertical: 14, alignItems: 'center', borderWidth: hairline(), borderColor: '#BFDBFE' },
  secondaryBtnText: { color: '#1D4ED8', fontWeight: '900', fontSize: 15 },
  batchSubmitBtn: { marginTop: 2 },
  submitBtn: { borderRadius: 16, backgroundColor: '#111827', paddingVertical: 15, alignItems: 'center' },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  historyCard: { backgroundColor: '#F8FAFC', borderRadius: 18, borderWidth: hairline(), borderColor: '#E2E8F0', padding: 14 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  historyTitleWrap: { flex: 1 },
  historyTitle: { fontSize: 16, fontWeight: '900', color: '#334155' },
  historySubtitle: { marginTop: 4, color: '#64748B', fontWeight: '600' },
  historySyncBanner: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: hairline(),
    borderColor: '#93C5FD',
    backgroundColor: '#DBEAFE',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  historySyncTextWrap: { flex: 1 },
  historySyncTitle: { color: '#1E3A8A', fontWeight: '900', fontSize: 13 },
  historySyncSubtitle: { color: '#1D4ED8', fontWeight: '700', fontSize: 12, marginTop: 2 },
  historyToggle: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#E2E8F0' },
  historyToggleText: { color: '#334155', fontWeight: '800', fontSize: 12 },
  historyGroups: { marginTop: 10, gap: 12 },
  historySection: { borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: hairline(), borderColor: '#E2E8F0', padding: 12 },
  historySectionHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  historySectionHeadActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historySectionTextWrap: { flex: 1 },
  historySectionTitle: { color: '#0F172A', fontSize: 15, fontWeight: '900' },
  historySectionSubtitle: { marginTop: 4, color: '#64748B', fontSize: 12, fontWeight: '700', lineHeight: 17 },
  historySectionCount: { minWidth: 34, height: 34, borderRadius: 17, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  historySectionCountText: { color: '#1D4ED8', fontSize: 13, fontWeight: '900' },
  historySectionToggle: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#E2E8F0' },
  historySectionToggleText: { color: '#334155', fontWeight: '800', fontSize: 12 },
  sectionHead: { marginTop: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontWeight: '900', color: '#111827', fontSize: 16 },
  toggleBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: '#F3F4F6' },
  toggleText: { fontWeight: '800', color: '#111827', fontSize: 12 },
  groupBlock: { marginTop: 12 },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  groupTitle: { fontWeight: '800', color: '#334155', fontSize: 13 },
  groupCountPill: { minWidth: 24, height: 24, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  groupCountText: { color: '#475569', fontSize: 11, fontWeight: '900' },
  groupEmptyText: { color: '#94A3B8', fontWeight: '700', fontSize: 12 },
  feedbackItem: { padding: 10, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: hairline(), borderColor: '#E2E8F0', marginBottom: 8 },
  feedbackRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  feedbackMain: { flex: 1, minWidth: 0 },
  feedbackTitle: { fontWeight: '800', color: '#1F2937' },
  feedbackMeta: { marginTop: 6, color: '#64748B', fontWeight: '700', fontSize: 12 },
  feedbackThumbWrap: { width: 56, height: 56, borderRadius: 12, overflow: 'hidden', borderWidth: hairline(), borderColor: '#BFDBFE', backgroundColor: '#EFF6FF', position: 'relative' },
  feedbackThumb: { width: '100%', height: '100%', backgroundColor: '#DBEAFE' },
  feedbackThumbBadge: { position: 'absolute', right: 4, bottom: 4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: 'rgba(15,23,42,0.78)', alignItems: 'center', justifyContent: 'center' },
  feedbackThumbBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  feedbackActions: { flexDirection: 'row', gap: 8 },
  muted: { color: '#6B7280', marginTop: 8, fontWeight: '600' },
  modalRoot: { flex: 1, backgroundColor: 'rgba(17,24,39,0.45)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  modalCard: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 18, overflow: 'hidden' },
  modalSheet: { width: '100%', height: '88%', backgroundColor: '#FFFFFF', borderRadius: 18, overflow: 'hidden' },
  modalBody: { flex: 1, minHeight: 0 },
  modalScroll: { flex: 1 },
  modalScrollBody: { padding: 14, paddingBottom: 120 },
  detailModalBody: { padding: 14, paddingBottom: 20 },
  modalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: hairline(), borderBottomColor: '#E5E7EB' },
  modalFooter: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 14, borderTopWidth: hairline(), borderTopColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  modalActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalTitle: { fontWeight: '900', color: '#111827', fontSize: 16 },
  closeText: { color: '#2563EB', fontWeight: '800' },
  headerActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: '#EFF6FF', borderWidth: hairline(), borderColor: '#BFDBFE' },
  headerActionText: { color: '#2563EB', fontWeight: '800', fontSize: 12 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EFF6FF', borderWidth: hairline(), borderColor: '#BFDBFE', alignItems: 'center', justifyContent: 'center' },
  detailHeadline: { color: '#111827', fontWeight: '900', fontSize: 16 },
  detailText: { marginTop: 10, color: '#374151', lineHeight: 20 },
  detailMeta: { marginTop: 8, color: '#6B7280', fontSize: 12, fontWeight: '700' },
  projectCard: { marginTop: 10, padding: 12, borderRadius: 14, backgroundColor: '#F8FAFC', borderWidth: hairline(), borderColor: '#E2E8F0' },
  projectTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  projectTitle: { fontWeight: '900', color: '#111827' },
  projectMeta: { marginTop: 6, color: '#6B7280', fontWeight: '700', fontSize: 12 },
  projectText: { marginTop: 6, color: '#374151', lineHeight: 18 },
  inlineBtns: { flexDirection: 'row', gap: 8 },
  miniBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: '#E5E7EB' },
  miniBtnText: { color: '#111827', fontWeight: '800', fontSize: 12 },
  miniBtnPrimary: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: '#2563EB' },
  miniBtnPrimaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  photoSectionLabel: { marginTop: 8, color: '#374151', fontWeight: '800' },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: { minWidth: 52, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center' },
  timeChipActive: { backgroundColor: '#2563EB' },
  timeChipText: { color: '#111827', fontWeight: '800' },
  timeChipTextActive: { color: '#FFFFFF' },
  pressed: { opacity: 0.75 },
  viewerBackdrop: { flex: 1, backgroundColor: '#000000' },
  viewerCard: { flex: 1, backgroundColor: '#000000' },
  viewerSlide: { height: '100%' },
  viewerTop: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between' },
  viewerCounter: { color: '#FFFFFF', fontWeight: '900' },
  viewerText: { color: '#FFFFFF', fontWeight: '800' },
})
