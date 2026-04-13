import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Dimensions, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useIsFocused } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import * as FileSystem from 'expo-file-system/legacy'
import * as ImagePicker from 'expo-image-picker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { hairline, moderateScale } from '../../lib/scale'
import { getWorkTasksSnapshot } from '../../lib/workTasksStore'
import { createPropertyFeedback, listPropertyFeedbacks, uploadCleaningMedia, type PropertyFeedback } from '../../lib/api'
import type { TasksStackParamList } from '../../navigation/RootNavigator'
import { API_BASE_URL } from '../../config/env'

type Props = NativeStackScreenProps<TasksStackParamList, 'FeedbackForm'>

type Kind = 'maintenance' | 'deep_cleaning' | 'daily_necessities'

const AREA_OPTIONS = ['入户走廊', '客厅', '厨房', '卧室', '阳台', '浴室', '其他'] as const
const CATEGORY_OPTIONS = ['电器', '家具', '其他'] as const
const DAILY_STATUS_OPTIONS = [
  { value: 'need_replace', label: '需更换' },
  { value: 'replaced', label: '已更换' },
  { value: 'no_action', label: '无需更换' },
] as const

function dailyStatusLabel(v: any) {
  const s = String(v || '').trim()
  if (s === 'need_replace') return '需更换'
  if (s === 'replaced') return '已更换'
  if (s === 'no_action') return '无需更换'
  return s || '-'
}

function fmtTime(s: string) {
  const d = new Date(String(s || ''))
  if (Number.isNaN(d.getTime())) return String(s || '')
  const pad2 = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function extractContentText(raw: any) {
  const s0 = String(raw ?? '').trim()
  if (!s0) return ''
  const s = s0.startsWith('{') || s0.startsWith('[') ? s0 : s0.includes('{"content"') ? s0.slice(s0.indexOf('{')) : s0
  if (!(s.startsWith('{') || s.startsWith('['))) return s0
  try {
    const j = JSON.parse(s)
    if (Array.isArray(j)) {
      const lines = j
        .map((x: any) => {
          if (typeof x === 'string') return x.trim()
          const c = x?.content
          return typeof c === 'string' ? c.trim() : ''
        })
        .filter(Boolean)
      if (lines.length) return lines.join('；')
    }
    if (j && typeof j === 'object') {
      const c = (j as any).content
      if (typeof c === 'string' && c.trim()) return c.trim()
    }
  } catch {}
  return s0
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
  if (Array.isArray(raw)) {
    return raw
      .map((x: any) => {
        if (typeof x === 'string') return toAbsoluteUrl(x)
        const u = x?.url ?? x?.uri ?? x?.photo_url ?? x?.path
        return toAbsoluteUrl(u)
      })
      .map((x) => String(x || '').trim())
      .filter(Boolean)
  }
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (!s) return []
    if (s.startsWith('[') || s.startsWith('{')) {
      try {
        const j = JSON.parse(s)
        if (Array.isArray(j)) {
          return j
            .map((x: any) => {
              if (typeof x === 'string') return toAbsoluteUrl(x)
              const u = x?.url ?? x?.uri ?? x?.photo_url ?? x?.path
              return toAbsoluteUrl(u)
            })
            .map((x) => String(x || '').trim())
            .filter(Boolean)
        }
      } catch {}
    }
    return [toAbsoluteUrl(s)].filter(Boolean)
  }
  return []
}

function normalizeForFingerprint(input: any) {
  const s0 = String(input ?? '').trim()
  if (!s0) return ''
  const s1 = s0.replace(/\s+/g, ' ')
  const s2 = s1.replace(/[，。！？、,.!?;:()（）【】\[\]{}'"“”‘’\-_/\\]+/g, ' ')
  return s2.replace(/\s+/g, ' ').trim().toLowerCase()
}

export default function FeedbackFormScreen(props: Props) {
  const { t } = useI18n()
  const { token, user } = useAuth()
  const insets = useSafeAreaInsets()
  const isFocused = useIsFocused()

  const [kind, setKind] = useState<Kind>('maintenance')
  const [area, setArea] = useState<(typeof AREA_OPTIONS)[number] | null>(null)
  const [areas, setAreas] = useState<Array<(typeof AREA_OPTIONS)[number]>>([])
  const [category, setCategory] = useState<(typeof CATEGORY_OPTIONS)[number] | null>(null)
  const [detail, setDetail] = useState('')
  const [media, setMedia] = useState<string[]>([])
  const [maintenanceItems, setMaintenanceItems] = useState<Array<{ area: string; category: string; detail: string; media_urls: string[] }>>([])
  const [maintenanceEditIndex, setMaintenanceEditIndex] = useState<number | null>(null)
  const [showAllAdded, setShowAllAdded] = useState(false)
  const [dailyStatus, setDailyStatus] = useState<(typeof DAILY_STATUS_OPTIONS)[number]['value']>('need_replace')
  const [dailyItemName, setDailyItemName] = useState('')
  const [dailyQty, setDailyQty] = useState('1')
  const [dailyNote, setDailyNote] = useState('')

  const [loadingList, setLoadingList] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [pending, setPending] = useState<PropertyFeedback[]>([])
  const [pendingError, setPendingError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [detailItem, setDetailItem] = useState<PropertyFeedback | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(0)
  const [viewerUrls, setViewerUrls] = useState<string[]>([])
  const [viewerCache, setViewerCache] = useState<Record<string, { uri: string | null; loading: boolean; error: string | null }>>({})

  const task = useMemo(() => getWorkTasksSnapshot().items.find(x => x.id === props.route.params.taskId) || null, [props.route.params.taskId])
  const propertyId = String(task?.property_id || task?.property?.id || '').trim()
  const propertyCode = String(task?.property?.code || '').trim()

  useEffect(() => {
    const title = kind === 'maintenance' ? '房源维修' : kind === 'deep_cleaning' ? '深度清洁' : '日用品反馈'
    props.navigation.setOptions({ title })
  }, [props.navigation, kind])

  async function refreshPending() {
    if (!token) return
    if (!propertyId && !propertyCode) return
    try {
      setLoadingList(true)
      setPendingError(null)
      const status = ['open', 'in_progress']
      const list = await listPropertyFeedbacks(token, { property_id: propertyId || undefined, property_code: propertyCode || undefined, status, limit: 50 })
      setPending(Array.isArray(list) ? list : [])
    } catch (e: any) {
      setPendingError(String(e?.message || '加载失败'))
      setPending([])
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    refreshPending()
  }, [token, propertyId, propertyCode, kind])

  useEffect(() => {
    if (!isFocused) return
    refreshPending()
  }, [isFocused, token, propertyId, propertyCode])

  function resetForm(nextKind: Kind) {
    setKind(nextKind)
    setArea(null)
    setAreas([])
    setCategory(null)
    setDetail('')
    setMedia([])
    setMaintenanceItems([])
    setMaintenanceEditIndex(null)
    setShowAllAdded(false)
    setDailyStatus('need_replace')
    setDailyItemName('')
    setDailyQty('1')
    setDailyNote('')
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

  async function onTakePhoto() {
    if (!token) {
      Alert.alert(t('common_error'), '请先登录')
      return
    }
    const ok = await ensureCameraPerm()
    if (!ok) {
      Alert.alert('需要相机权限', '请在系统设置中允许相机权限后再拍照')
      return
    }
    try {
      const res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 })
      if (res.canceled || !res.assets?.length) return
      const a = res.assets[0] as any
      const uri = String(a.uri || '').trim()
      if (!uri) return
      const name = String(a.fileName || uri.split('/').pop() || `fb-${Date.now()}.jpg`)
      const mimeType = String(a.mimeType || 'image/jpeg')
      const capturedAt = new Date().toISOString()
      const up = await uploadCleaningMedia(token, { uri, name, mimeType }, { watermark: '1', purpose: 'feedback', property_code: propertyCode, captured_at: capturedAt, watermark_text: buildWatermarkText(capturedAt) })
      setMedia(prev => [...prev, up.url])
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '拍照失败'))
    }
  }

  async function onPickFromAlbum() {
    if (!token) {
      Alert.alert(t('common_error'), '请先登录')
      return
    }
    const ok = await ensureLibraryPerm()
    if (!ok) {
      Alert.alert('需要相册权限', '请在系统设置中允许相册权限后再选择照片')
      return
    }
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 })
      if (res.canceled || !res.assets?.length) return
      const a = res.assets[0] as any
      const uri = String(a.uri || '').trim()
      if (!uri) return
      const name = String(a.fileName || uri.split('/').pop() || `fb-${Date.now()}.jpg`)
      const mimeType = String(a.mimeType || 'image/jpeg')
      const capturedAt = new Date().toISOString()
      const up = await uploadCleaningMedia(token, { uri, name, mimeType }, { watermark: '1', purpose: 'feedback', property_code: propertyCode, captured_at: capturedAt, watermark_text: buildWatermarkText(capturedAt) })
      setMedia(prev => [...prev, up.url])
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '选择失败'))
    }
  }

  function toggleArea(a: (typeof AREA_OPTIONS)[number]) {
    setAreas(prev => (prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]))
  }

  const canSubmit = useMemo(() => {
    if (!propertyId) return false
    if (kind === 'maintenance') {
      const hasItems = maintenanceItems.length > 0
      const curOk = !!area && !!category && !!detail.trim()
      return hasItems || curOk
    }
    if (kind === 'deep_cleaning') return areas.length > 0 && media.length > 0 && !!detail.trim()
    const qty = Number(dailyQty)
    const okQty = Number.isFinite(qty) && qty >= 1
    return !!dailyItemName.trim() && okQty && (!!dailyNote.trim() || media.length > 0)
  }, [area, areas.length, category, detail, kind, media.length, propertyId, maintenanceItems.length, dailyItemName, dailyQty, dailyNote])

  function addMaintenanceItemFromCurrent() {
    const a = String(area || '').trim()
    const c = String(category || '').trim()
    const d = detail.trim()
    if (maintenanceEditIndex != null && maintenanceEditIndex >= 0) {
      if (!a || !c || !d) {
        Alert.alert('内容为空', '是否删除该条问题？', [
          { text: '取消' },
          {
            text: '删除',
            onPress: () => {
              setMaintenanceItems((prev) => prev.filter((_, i) => i !== maintenanceEditIndex))
              cancelEditMaintenanceItem()
            },
          },
        ])
        return
      }
      setMaintenanceItems((prev) => prev.map((x, i) => (i === maintenanceEditIndex ? { area: a, category: c, detail: d, media_urls: media } : x)))
      setMaintenanceEditIndex(null)
    } else {
      if (!a || !c || !d) {
        Alert.alert(t('common_error'), '当前问题未填写完整')
        return
      }
      setMaintenanceItems((prev) => [...prev, { area: a, category: c, detail: d, media_urls: media }])
    }
    setArea(null)
    setCategory(null)
    setDetail('')
    setMedia([])
  }

  function startEditMaintenanceItem(index: number) {
    const it = maintenanceItems[index]
    if (!it) return
    setArea((it.area as any) || null)
    setCategory((it.category as any) || null)
    setDetail(String(it.detail || ''))
    setMedia(Array.isArray(it.media_urls) ? it.media_urls : [])
    setMaintenanceEditIndex(index)
  }

  function cancelEditMaintenanceItem() {
    setMaintenanceEditIndex(null)
    setArea(null)
    setCategory(null)
    setDetail('')
    setMedia([])
  }

  async function onSubmit(force?: boolean) {
    if (!token) {
      Alert.alert(t('common_error'), '请先登录')
      return
    }
    if (!propertyId) {
      Alert.alert(t('common_error'), '缺少房源信息')
      return
    }
    const d = detail.trim()
    if (kind === 'maintenance') {
      if (maintenanceEditIndex != null) return Alert.alert(t('common_error'), '请先保存或取消当前编辑')
      const curOk = !!area && !!category && !!d
      if (!maintenanceItems.length && !curOk) return Alert.alert(t('common_error'), '请至少填写一条维修问题')
      if (curOk === false && (area || category || d || media.length)) return Alert.alert(t('common_error'), '当前问题未填写完整')
    } else if (kind === 'deep_cleaning') {
      if (!areas.length) return Alert.alert(t('common_error'), '请选择需要清洁的区域')
      if (!media.length) return Alert.alert(t('common_error'), '请拍照上传')
      if (!d) return Alert.alert(t('common_error'), '请填写说明')
    } else {
      const st = String(dailyStatus || '').trim()
      const it = dailyItemName.trim()
      const qty = Number(dailyQty)
      if (!st) return Alert.alert(t('common_error'), '请选择状态')
      if (!it) return Alert.alert(t('common_error'), '请输入物品名称')
      if (!Number.isFinite(qty) || qty < 1) return Alert.alert(t('common_error'), '请输入正确数量')
      if (!dailyNote.trim() && !media.length) return Alert.alert(t('common_error'), '请填写备注或上传照片')
    }

    if (!force) {
      const now = Date.now()
      const winMs = 24 * 3600 * 1000
      const detailNorm = normalizeForFingerprint(d).slice(0, 160)
      if (kind === 'maintenance') {
        const itemsAll = [
          ...maintenanceItems,
          ...(area && category && d ? [{ area: String(area), category: String(category), detail: d, media_urls: media }] : []),
        ]
        const hit = itemsAll.find((it) => {
          const a0 = String(it.area || '').trim()
          const c0 = String(it.category || '').trim()
          const dn = normalizeForFingerprint(it.detail).slice(0, 160)
          return pending.some((x: any) => {
            if (String(x?.kind || '') !== 'maintenance') return false
            const xa = String(x?.area || x?.category || '').trim()
            const xc = String(x?.category_detail || '').trim()
            if (xa !== a0) return false
            if (xc !== c0) return false
            const xt = normalizeForFingerprint(extractContentText(x?.detail)).slice(0, 160)
            if (!xt) return false
            if (xt !== dn && !xt.startsWith(dn.slice(0, 24))) return false
            const ct = new Date(String(x?.created_at || '')).getTime()
            return Number.isFinite(ct) ? now - ct <= winMs : true
          })
        })
        if (hit) {
          Alert.alert('可能重复提交', '该房源同区域同类型在 24 小时内已有类似问题。', [
            { text: '查看已有', onPress: () => refreshPending() },
            { text: '仍然提交', onPress: () => onSubmit(true) },
          ])
          return
        }
      } else if (kind === 'deep_cleaning') {
        const as0 = [...areas].map((s) => String(s || '').trim()).filter(Boolean).sort().join('、')
        const dup = pending.find((x: any) => {
          if (String(x?.kind || '') !== 'deep_cleaning') return false
          const xa = Array.isArray(x?.areas) ? x.areas.map((s: any) => String(s || '').trim()).filter(Boolean).sort().join('、') : ''
          if (xa !== as0) return false
          const xt = normalizeForFingerprint(extractContentText(x?.detail)).slice(0, 160)
          if (!xt) return false
          if (xt !== detailNorm && !xt.startsWith(detailNorm.slice(0, 24))) return false
          const ct = new Date(String(x?.created_at || '')).getTime()
          return Number.isFinite(ct) ? now - ct <= winMs : true
        })
        if (dup) {
          Alert.alert('可能重复提交', '该房源相同区域组合在 24 小时内已有类似深清需求。', [
            { text: '查看已有', onPress: () => setDetailItem(dup as any) },
            { text: '仍然提交', onPress: () => onSubmit(true) },
          ])
          return
        }
      } else {
        const st = String(dailyStatus || '').trim()
        const it = dailyItemName.trim()
        const qty = Number(dailyQty)
        const dn = normalizeForFingerprint(dailyNote.trim() || '').slice(0, 160)
        const dup = pending.find((x: any) => {
          if (String(x?.kind || '') !== 'daily_necessities') return false
          if (String(x?.status || '').trim() !== st) return false
          if (String(x?.item_name || '').trim() !== it) return false
          if (Number(x?.quantity || 0) !== (Number.isFinite(qty) ? Math.trunc(qty) : 0)) return false
          const xt = normalizeForFingerprint(String(x?.note || x?.detail || '').trim()).slice(0, 160)
          if (dn && xt && xt !== dn && !xt.startsWith(dn.slice(0, 24))) return false
          const ct = new Date(String(x?.created_at || '')).getTime()
          return Number.isFinite(ct) ? now - ct <= winMs : true
        })
        if (dup) {
          Alert.alert('可能重复提交', '该房源在 24 小时内已有类似日用品反馈。', [
            { text: '查看已有', onPress: () => setDetailItem(dup as any) },
            { text: '仍然提交', onPress: () => onSubmit(true) },
          ])
          return
        }
      }
    }

    try {
      setSubmitting(true)
      if (kind === 'maintenance') {
        const itemsAll = [
          ...maintenanceItems,
          ...(area && category && d ? [{ area: String(area), category: String(category), detail: d, media_urls: media }] : []),
        ]
        await createPropertyFeedback(token, {
          kind,
          property_id: propertyId,
          source_task_id: task?.id ? String(task.id) : undefined,
          items: itemsAll,
        } as any)
      } else if (kind === 'deep_cleaning') {
        await createPropertyFeedback(token, {
          kind,
          property_id: propertyId,
          source_task_id: task?.id ? String(task.id) : undefined,
          areas,
          detail: d,
          media_urls: media,
        } as any)
      } else {
        await createPropertyFeedback(token, {
          kind,
          property_id: propertyId,
          source_task_id: task?.id ? String(task.id) : undefined,
          status: dailyStatus,
          item_name: dailyItemName.trim(),
          quantity: Math.trunc(Number(dailyQty)),
          note: dailyNote.trim(),
          media_urls: media,
        } as any)
      }
      Alert.alert(t('common_ok'), '提交成功')
      resetForm(kind)
      await refreshPending()
    } catch (e: any) {
      const msg = String(e?.message || '提交失败')
      if (msg.startsWith('duplicate:')) {
        const existingId = msg.split(':').slice(1).join(':').trim()
        const hit = pending.find((x: any) => String(x?.id || '') === existingId) || null
        Alert.alert('已存在相同问题', '已为你定位到已有记录。', [
          { text: '打开已有', onPress: () => (hit ? setDetailItem(hit as any) : refreshPending()) },
          { text: '好的' },
        ])
      } else {
        Alert.alert(t('common_error'), msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const grouped = useMemo(() => {
    const m = pending.filter(x => String(x.kind || '') === 'maintenance')
    const d = pending.filter(x => String(x.kind || '') === 'deep_cleaning')
    const dn = pending.filter(x => String(x.kind || '') === 'daily_necessities')
    return { m, d, dn }
  }, [pending])

  const screen = useMemo(() => Dimensions.get('window'), [])
  const detailMedia = useMemo(() => normalizeUrls((detailItem as any)?.media_urls), [detailItem])
  const detailText = useMemo(() => extractContentText((detailItem as any)?.detail), [detailItem])
  const viewerRef = useRef<ScrollView | null>(null)

  const apiHost = useMemo(() => {
    try {
      const base = normalizeBase(API_BASE_URL)
      if (!base) return ''
      return new URL(base).host
    } catch {
      return ''
    }
  }, [])

  async function ensureViewerReady(url: string) {
    const u = toAbsoluteUrl(url)
    if (!u) return
    const existed = viewerCache[u]
    if (existed && (existed.loading || existed.uri || existed.error)) return
    setViewerCache(prev => ({ ...prev, [u]: { uri: null, loading: true, error: null } }))
    try {
      let sameHost = false
      try {
        const host = new URL(u).host
        sameHost = !!apiHost && host === apiHost
      } catch {}
      if (!sameHost) {
        setViewerCache(prev => ({ ...prev, [u]: { uri: u, loading: false, error: null } }))
        return
      }
      const base = FileSystem.cacheDirectory ? `${FileSystem.cacheDirectory}feedback-preview/` : null
      if (!base) throw new Error('no cache directory')
      try {
        await FileSystem.makeDirectoryAsync(base, { intermediates: true })
      } catch {}
      const lower = u.toLowerCase()
      const ext = lower.includes('.png') ? '.png' : lower.includes('.webp') ? '.webp' : '.jpg'
      const target = `${base}${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
      const headers = token && sameHost ? { Authorization: `Bearer ${token}` } : undefined
      const dl: any = await FileSystem.downloadAsync(u, target, headers ? { headers } : undefined)
      const status = Number(dl?.status || 0)
      const contentType = String(dl?.headers?.['Content-Type'] || dl?.headers?.['content-type'] || '').trim().toLowerCase()
      if (status && status >= 400) throw new Error(`下载失败 (${status})`)
      if (contentType && !contentType.startsWith('image/')) throw new Error(`不是图片 (${contentType || 'unknown'})`)
      const localUri = String(dl?.uri || target || '').trim()
      setViewerCache(prev => ({ ...prev, [u]: { uri: localUri || u, loading: false, error: null } }))
    } catch (e: any) {
      setViewerCache(prev => ({ ...prev, [u]: { uri: u, loading: false, error: String(e?.message || '图片加载失败') } }))
    }
  }

  function openViewerAt(list0: string[], index: number) {
    const list = (list0 || []).map((x) => toAbsoluteUrl(x)).filter(Boolean)
    if (!list.length) return
    const idx = Math.max(0, Math.min(list.length - 1, Number(index) || 0))
    setViewerUrls(list)
    setViewerIndex(idx)
    setViewerOpen(true)
    setTimeout(() => {
      try {
        viewerRef.current?.scrollTo({ x: idx * screen.width, y: 0, animated: false })
      } catch {}
    }, 0)
    ensureViewerReady(list[idx]).catch(() => {})
    if (idx > 0) ensureViewerReady(list[idx - 1]).catch(() => {})
    if (idx + 1 < list.length) ensureViewerReady(list[idx + 1]).catch(() => {})
  }

  useEffect(() => {
    if (!viewerOpen) return
    const list = viewerUrls
    if (!list.length) return
    const u = list[viewerIndex]
    if (u) ensureViewerReady(u).catch(() => {})
  }, [viewerIndex, viewerOpen, viewerUrls])

  return (
    <>
      <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {!task ? (
        <Text style={styles.muted}>{t('common_loading')}</Text>
      ) : (
        <View style={styles.card}>
          <View style={styles.headRow}>
            <Text style={styles.title}>问题反馈</Text>
            <View style={styles.badge}>
              <Ionicons name="home-outline" size={moderateScale(14)} color="#2563EB" />
              <Text style={styles.badgeText}>{task.title}</Text>
            </View>
          </View>
          {task.property?.address ? <Text style={styles.sub}>{task.property.address}</Text> : null}

          <View style={styles.segmentRow}>
            <Pressable
              onPress={() => resetForm('maintenance')}
              style={({ pressed }) => [styles.segment, kind === 'maintenance' ? styles.segmentActive : null, pressed ? styles.pressed : null]}
            >
              <Text style={[styles.segmentText, kind === 'maintenance' ? styles.segmentTextActive : null]}>房源维修</Text>
            </Pressable>
            <Pressable
              onPress={() => resetForm('deep_cleaning')}
              style={({ pressed }) => [styles.segment, kind === 'deep_cleaning' ? styles.segmentActive : null, pressed ? styles.pressed : null]}
            >
              <Text style={[styles.segmentText, kind === 'deep_cleaning' ? styles.segmentTextActive : null]}>深度清洁</Text>
            </Pressable>
            <Pressable
              onPress={() => resetForm('daily_necessities')}
              style={({ pressed }) => [styles.segment, kind === 'daily_necessities' ? styles.segmentActive : null, pressed ? styles.pressed : null]}
            >
              <Text style={[styles.segmentText, kind === 'daily_necessities' ? styles.segmentTextActive : null]}>日用品反馈</Text>
            </Pressable>
          </View>

          {kind === 'maintenance' ? (
            <>
              {maintenanceItems.length ? (
                <>
                  <Text style={styles.label}>{`已添加问题 (${maintenanceItems.length})`}</Text>
                  {(showAllAdded ? maintenanceItems : maintenanceItems.slice(0, 3)).map((it, idx) => (
                    <View key={`${it.area}:${it.category}:${idx}`} style={styles.itemCard}>
                      <View style={styles.itemCardTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemCardTitle}>{`问题 ${idx + 1}`}</Text>
                          <Text style={styles.itemCardMeta}>{`${it.area} · ${it.category}`}</Text>
                        </View>
                        <View style={styles.itemCardActions}>
                          <Pressable
                            onPress={() => startEditMaintenanceItem(idx)}
                            style={({ pressed }) => [styles.itemCardBtn, pressed ? styles.pressed : null]}
                          >
                            <Text style={styles.itemCardBtnText}>编辑</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => {
                              if (maintenanceEditIndex === idx) cancelEditMaintenanceItem()
                              setMaintenanceItems((prev) => prev.filter((_, i) => i !== idx))
                            }}
                            style={({ pressed }) => [styles.itemCardBtnDanger, pressed ? styles.pressed : null]}
                          >
                            <Text style={styles.itemCardBtnDangerText}>删除</Text>
                          </Pressable>
                        </View>
                      </View>
                      <Text style={styles.itemCardDetail} numberOfLines={3}>{it.detail}</Text>
                      {Array.isArray(it.media_urls) && it.media_urls.length ? (
                        <View style={[styles.thumbRow, { marginTop: 10 }]}>
                          {it.media_urls
                            .slice(0, 3)
                            .map((u, i) => (
                              <Pressable
                                key={`${u}-${i}`}
                                onPress={() => openViewerAt(it.media_urls, i)}
                                style={({ pressed }) => [styles.thumbWrap, pressed ? styles.pressed : null]}
                              >
                                <Image source={{ uri: toAbsoluteUrl(u) }} style={styles.thumb} resizeMode="contain" />
                              </Pressable>
                            ))}
                        </View>
                      ) : (
                        <Text style={[styles.pendingMeta, { marginTop: 8 }]}>无附件</Text>
                      )}
                    </View>
                  ))}
                  {maintenanceItems.length > 3 ? (
                    <Pressable onPress={() => setShowAllAdded(v => !v)} style={({ pressed }) => [styles.pendingToggle, { alignSelf: 'flex-start', marginTop: 10 }, pressed ? styles.pressed : null]}>
                      <Text style={styles.pendingToggleText}>{showAllAdded ? '收起' : '展开更多'}</Text>
                    </Pressable>
                  ) : null}
                </>
              ) : null}

              {maintenanceEditIndex != null ? (
                <View style={styles.editHintRow}>
                  <Text style={styles.editHintText}>{`正在编辑：问题 ${maintenanceEditIndex + 1}`}</Text>
                  <Pressable onPress={cancelEditMaintenanceItem} style={({ pressed }) => [styles.pendingToggle, pressed ? styles.pressed : null]}>
                    <Text style={styles.pendingToggleText}>取消编辑</Text>
                  </Pressable>
                </View>
              ) : null}

              <Text style={styles.label}>问题区域</Text>
              <View style={styles.chipsRow}>
                {AREA_OPTIONS.map(a => (
                  <Pressable
                    key={a}
                    onPress={() => setArea(a)}
                    style={({ pressed }) => [styles.chip, area === a ? styles.chipActive : null, pressed ? styles.pressed : null]}
                  >
                    <Text style={[styles.chipText, area === a ? styles.chipTextActive : null]}>{a}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>问题类型</Text>
              <View style={styles.chipsRow}>
                {CATEGORY_OPTIONS.map(c => (
                  <Pressable
                    key={c}
                    onPress={() => setCategory(c)}
                    style={({ pressed }) => [styles.chip, category === c ? styles.chipActive : null, pressed ? styles.pressed : null]}
                  >
                    <Text style={[styles.chipText, category === c ? styles.chipTextActive : null]}>{c}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>问题详情</Text>
              <TextInput
                value={detail}
                onChangeText={v => (v.length <= 800 ? setDetail(v) : setDetail(v.slice(0, 800)))}
                style={[styles.input, styles.textarea]}
                placeholder={'请详细描述问题'}
                placeholderTextColor="#9CA3AF"
                multiline
              />

              <Text style={styles.label}>上传附件（可选）</Text>
              <View style={styles.row}>
                <Pressable onPress={onTakePhoto} style={({ pressed }) => [styles.photoBtn, pressed ? styles.pressed : null]}>
                  <Text style={styles.photoBtnText}>拍照上传</Text>
                </Pressable>
                <Pressable onPress={onPickFromAlbum} style={({ pressed }) => [styles.photoBtn, pressed ? styles.pressed : null]}>
                  <Text style={styles.photoBtnText}>相册选择</Text>
                </Pressable>
                <Text style={styles.photoHint}>{media.length ? `已上传 ${media.length} 张` : '支持相机/相册'}</Text>
              </View>
              {media.length ? (
                <View style={{ marginTop: 10 }}>
                  <View style={styles.thumbRow}>
                    {media.map((u, idx) => (
                      <Pressable key={`${u}-${idx}`} onPress={() => openViewerAt(media, idx)} style={({ pressed }) => [styles.thumbWrap, pressed ? styles.pressed : null]}>
                        <Image source={{ uri: toAbsoluteUrl(u) }} style={styles.thumb} resizeMode="contain" />
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={[styles.row, { marginTop: 10 }]}>
                <Pressable
                  onPress={addMaintenanceItemFromCurrent}
                  style={({ pressed }) => [styles.photoBtn, pressed ? styles.pressed : null]}
                >
                  <Text style={styles.photoBtnText}>{maintenanceEditIndex != null ? '保存修改' : '加入列表'}</Text>
                </Pressable>
                <Text style={styles.photoHint}>多个区域/多个问题可分条加入</Text>
              </View>
            </>
          ) : kind === 'deep_cleaning' ? (
            <>
              <Text style={styles.label}>需要清洁的区域</Text>
              <View style={styles.chipsRow}>
                {AREA_OPTIONS.map(a => (
                  <Pressable
                    key={a}
                    onPress={() => toggleArea(a)}
                    style={({ pressed }) => [styles.chip, areas.includes(a) ? styles.chipActive : null, pressed ? styles.pressed : null]}
                  >
                    <Text style={[styles.chipText, areas.includes(a) ? styles.chipTextActive : null]}>{a}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>说明</Text>
              <TextInput
                value={detail}
                onChangeText={v => (v.length <= 800 ? setDetail(v) : setDetail(v.slice(0, 800)))}
                style={[styles.input, styles.textarea]}
                placeholder={'请描述需要深清的内容'}
                placeholderTextColor="#9CA3AF"
                multiline
              />

              <Text style={styles.label}>上传照片（必填）</Text>
              <View style={styles.row}>
                <Pressable onPress={onTakePhoto} style={({ pressed }) => [styles.photoBtn, pressed ? styles.pressed : null]}>
                  <Text style={styles.photoBtnText}>拍照上传</Text>
                </Pressable>
                <Pressable onPress={onPickFromAlbum} style={({ pressed }) => [styles.photoBtn, pressed ? styles.pressed : null]}>
                  <Text style={styles.photoBtnText}>相册选择</Text>
                </Pressable>
                <Text style={styles.photoHint}>{media.length ? `已上传 ${media.length} 张` : '支持相机/相册'}</Text>
              </View>
              {media.length ? (
                <View style={{ marginTop: 10 }}>
                  <View style={styles.thumbRow}>
                    {media.map((u, idx) => (
                      <Pressable key={`${u}-${idx}`} onPress={() => openViewerAt(media, idx)} style={({ pressed }) => [styles.thumbWrap, pressed ? styles.pressed : null]}>
                        <Image source={{ uri: toAbsoluteUrl(u) }} style={styles.thumb} resizeMode="contain" />
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.label}>状态</Text>
              <View style={styles.chipsRow}>
                {DAILY_STATUS_OPTIONS.map((x) => (
                  <Pressable
                    key={x.value}
                    onPress={() => setDailyStatus(x.value)}
                    style={({ pressed }) => [styles.chip, dailyStatus === x.value ? styles.chipActive : null, pressed ? styles.pressed : null]}
                  >
                    <Text style={[styles.chipText, dailyStatus === x.value ? styles.chipTextActive : null]}>{x.label}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>物品名称</Text>
              <TextInput
                value={dailyItemName}
                onChangeText={v => (v.length <= 120 ? setDailyItemName(v) : setDailyItemName(v.slice(0, 120)))}
                style={[styles.input, { height: 42 }]}
                placeholder={'例如：洗发水'}
                placeholderTextColor="#9CA3AF"
              />

              <Text style={styles.label}>数量</Text>
              <TextInput
                value={dailyQty}
                onChangeText={v => setDailyQty(String(v || '').replace(/[^\d]/g, '').slice(0, 6) || '')}
                style={[styles.input, { height: 42 }]}
                placeholder={'例如：2'}
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
              />

              <Text style={styles.label}>备注</Text>
              <TextInput
                value={dailyNote}
                onChangeText={v => (v.length <= 800 ? setDailyNote(v) : setDailyNote(v.slice(0, 800)))}
                style={[styles.input, styles.textarea]}
                placeholder={'可填写补充说明（备注或照片至少填一个）'}
                placeholderTextColor="#9CA3AF"
                multiline
              />

              <Text style={styles.label}>上传照片（可选）</Text>
              <View style={styles.row}>
                <Pressable onPress={onTakePhoto} style={({ pressed }) => [styles.photoBtn, pressed ? styles.pressed : null]}>
                  <Text style={styles.photoBtnText}>拍照上传</Text>
                </Pressable>
                <Pressable onPress={onPickFromAlbum} style={({ pressed }) => [styles.photoBtn, pressed ? styles.pressed : null]}>
                  <Text style={styles.photoBtnText}>相册选择</Text>
                </Pressable>
                <Text style={styles.photoHint}>{media.length ? `已上传 ${media.length} 张` : '支持相机/相册'}</Text>
              </View>
              {media.length ? (
                <View style={{ marginTop: 10 }}>
                  <View style={styles.thumbRow}>
                    {media.map((u, idx) => (
                      <Pressable key={`${u}-${idx}`} onPress={() => openViewerAt(media, idx)} style={({ pressed }) => [styles.thumbWrap, pressed ? styles.pressed : null]}>
                        <Image source={{ uri: toAbsoluteUrl(u) }} style={styles.thumb} resizeMode="contain" />
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          )}

          <Pressable
            onPress={() => onSubmit()}
            disabled={submitting || !canSubmit}
            style={({ pressed }) => [styles.submitBtn, submitting || !canSubmit ? styles.submitDisabled : null, pressed ? styles.pressed : null]}
          >
            <Text style={styles.submitText}>{submitting ? t('common_loading') : '提交'}</Text>
          </Pressable>

          <View style={styles.divider} />

          <View style={styles.pendingHead}>
            <Text style={styles.pendingTitle}>本房源待解决</Text>
            <Pressable onPress={() => setExpanded(v => !v)} style={({ pressed }) => [styles.pendingToggle, pressed ? styles.pressed : null]}>
              <Text style={styles.pendingToggleText}>{expanded ? '收起' : '展开'}</Text>
            </Pressable>
          </View>

          {loadingList ? (
            <Text style={styles.muted}>{t('common_loading')}</Text>
          ) : pendingError ? (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.muted}>{`加载失败：${pendingError}`}</Text>
              <Pressable onPress={refreshPending} style={({ pressed }) => [styles.pendingToggle, { alignSelf: 'flex-start', marginTop: 10 }, pressed ? styles.pressed : null]}>
                <Text style={styles.pendingToggleText}>重试</Text>
              </Pressable>
            </View>
          ) : !pending.length ? (
            <Text style={styles.muted}>暂无待解决记录</Text>
          ) : (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.groupTitle}>{`维修 (${grouped.m.length})`}</Text>
              {(expanded ? grouped.m : grouped.m.slice(0, 3)).map((x, idx) => (
                <Pressable key={`${String((x as any).kind || 'maintenance')}:${String(x.id)}:${idx}`} onPress={() => setDetailItem(x)} style={({ pressed }) => [styles.pendingItem, pressed ? styles.pressed : null]}>
                  <Text style={styles.pendingLine} numberOfLines={2}>
                    {`${String((x as any).area || '').trim() ? `[${String((x as any).area || '').trim()}] ` : ''}${extractContentText((x as any).detail)}`}
                  </Text>
                  {normalizeUrls((x as any).media_urls).length ? (
                    <View style={[styles.thumbRow, { marginTop: 8 }]}>
                      {normalizeUrls((x as any).media_urls)
                        .slice(0, 3)
                        .map((u, i) => (
                          <Pressable
                            key={`${u}-${i}`}
                            onPress={() => openViewerAt(normalizeUrls((x as any).media_urls), i)}
                            style={({ pressed }) => [styles.thumbWrap, pressed ? styles.pressed : null]}
                          >
                            <Image source={{ uri: u }} style={styles.thumb} resizeMode="contain" />
                          </Pressable>
                        ))}
                    </View>
                  ) : null}
                  <Text style={styles.pendingMeta}>{`${String(x.created_by_name || '').trim() || 'unknown'}  ${fmtTime(String(x.created_at || ''))}`}</Text>
                </Pressable>
              ))}
              <Text style={[styles.groupTitle, { marginTop: 10 }]}>{`深清 (${grouped.d.length})`}</Text>
              {(expanded ? grouped.d : grouped.d.slice(0, 3)).map((x, idx) => (
                <Pressable key={`${String((x as any).kind || 'deep_cleaning')}:${String(x.id)}:${idx}`} onPress={() => setDetailItem(x)} style={({ pressed }) => [styles.pendingItem, pressed ? styles.pressed : null]}>
                  <Text style={styles.pendingLine} numberOfLines={2}>
                    {`${Array.isArray((x as any).areas) && (x as any).areas.length ? `[${(x as any).areas.join('、')}] ` : ''}${extractContentText((x as any).detail)}`}
                  </Text>
                  {normalizeUrls((x as any).media_urls).length ? (
                    <View style={[styles.thumbRow, { marginTop: 8 }]}>
                      {normalizeUrls((x as any).media_urls)
                        .slice(0, 3)
                        .map((u, i) => (
                          <Pressable
                            key={`${u}-${i}`}
                            onPress={() => openViewerAt(normalizeUrls((x as any).media_urls), i)}
                            style={({ pressed }) => [styles.thumbWrap, pressed ? styles.pressed : null]}
                          >
                            <Image source={{ uri: u }} style={styles.thumb} resizeMode="contain" />
                          </Pressable>
                        ))}
                    </View>
                  ) : null}
                  <Text style={styles.pendingMeta}>{`${String(x.created_by_name || '').trim() || 'unknown'}  ${fmtTime(String(x.created_at || ''))}`}</Text>
                </Pressable>
              ))}
              <Text style={[styles.groupTitle, { marginTop: 10 }]}>{`日用品 (${grouped.dn.length})`}</Text>
              {(expanded ? grouped.dn : grouped.dn.slice(0, 3)).map((x, idx) => (
                <Pressable key={`${String((x as any).kind || 'daily_necessities')}:${String(x.id)}:${idx}`} onPress={() => setDetailItem(x)} style={({ pressed }) => [styles.pendingItem, pressed ? styles.pressed : null]}>
                  <Text style={styles.pendingLine} numberOfLines={2}>
                    {`[${dailyStatusLabel((x as any).status)}] ${String((x as any).item_name || '').trim() || '-'}${(x as any).quantity != null ? ` x${String((x as any).quantity)}` : ''} ${String((x as any).note || '').trim()}`}
                  </Text>
                  {normalizeUrls((x as any).media_urls).length ? (
                    <View style={[styles.thumbRow, { marginTop: 8 }]}>
                      {normalizeUrls((x as any).media_urls)
                        .slice(0, 3)
                        .map((u, i) => (
                          <Pressable
                            key={`${u}-${i}`}
                            onPress={() => openViewerAt(normalizeUrls((x as any).media_urls), i)}
                            style={({ pressed }) => [styles.thumbWrap, pressed ? styles.pressed : null]}
                          >
                            <Image source={{ uri: u }} style={styles.thumb} resizeMode="contain" />
                          </Pressable>
                        ))}
                    </View>
                  ) : null}
                  <Text style={styles.pendingMeta}>{`${String(x.created_by_name || '').trim() || 'unknown'}  ${fmtTime(String(x.created_at || ''))}`}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}
      </ScrollView>
      <Modal visible={!!detailItem} transparent animationType="fade" onRequestClose={() => setDetailItem(null)}>
        <View style={styles.detailModalRoot}>
          <View style={styles.detailCardWrap}>
            <View style={styles.detailCard}>
            <View style={styles.detailTopRow}>
              <Text style={styles.detailTitle}>详情</Text>
              <Pressable onPress={() => setDetailItem(null)} style={({ pressed }) => [styles.detailCloseBtn, pressed ? styles.pressed : null]}>
                <Text style={styles.detailCloseText}>关闭</Text>
              </Pressable>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }} keyboardShouldPersistTaps="handled">
              {String((detailItem as any)?.kind || '') === 'daily_necessities' ? (
                <>
                  <Text style={styles.detailText}>{`状态：${dailyStatusLabel((detailItem as any)?.status)}`}</Text>
                  <Text style={[styles.detailText, { marginTop: 10 }]}>{`物品：${String((detailItem as any)?.item_name || '').trim() || '-'}${(detailItem as any)?.quantity != null ? `  数量：${String((detailItem as any)?.quantity)}` : ''}`}</Text>
                  <Text style={[styles.detailText, { marginTop: 10 }]}>{`备注：${String((detailItem as any)?.note || '').trim() || '-'}`}</Text>
                </>
              ) : (
                <Text style={styles.detailText}>{detailText || '-'}</Text>
              )}
              {detailMedia.length ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.detailSubTitle}>{`照片 (${detailMedia.length})`}</Text>
                  <View style={styles.thumbRow}>
                    {detailMedia.map((u, idx) => (
                      <Pressable key={`${u}-${idx}`} onPress={() => openViewerAt(detailMedia, idx)} style={({ pressed }) => [styles.thumbWrap, pressed ? styles.pressed : null]}>
                        <Image source={{ uri: u }} style={styles.thumb} resizeMode="contain" />
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
            </ScrollView>
            </View>
          </View>
          {viewerOpen ? (
            <View style={styles.viewerOverlay}>
              <ScrollView
                ref={(r) => {
                  viewerRef.current = r
                }}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                contentOffset={{ x: viewerIndex * screen.width, y: 0 }}
                onMomentumScrollEnd={(e) => {
                  const x = Number(e?.nativeEvent?.contentOffset?.x || 0)
                  const idx = Math.round(x / Math.max(1, screen.width))
                  setViewerIndex(Math.max(0, Math.min(viewerUrls.length - 1, idx)))
                }}
              >
                {viewerUrls.map((u, idx) => {
                  const abs = toAbsoluteUrl(u)
                  const st = viewerCache[abs]
                  const uri = st?.uri || abs
                  const err = st?.error
                  const loading = st?.loading
                  return (
                    <View key={`${u}-${idx}`} style={{ width: screen.width, height: screen.height }}>
                      <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                      {loading ? <Text style={[styles.viewerHint, styles.viewerHintPos]}>加载中…</Text> : null}
                      {err ? <Text style={[styles.viewerHint, styles.viewerHintPos]}>{err}</Text> : null}
                    </View>
                  )
                })}
              </ScrollView>
              <View style={[styles.viewerTopRow, { paddingTop: Math.max(10, insets.top) }]}>
                <Text style={styles.viewerIndex}>{`${viewerIndex + 1}/${viewerUrls.length}`}</Text>
                <Pressable onPress={() => setViewerOpen(false)} style={({ pressed }) => [styles.viewerCloseBtn, pressed ? styles.pressed : null]}>
                  <Text style={styles.viewerCloseText}>关闭</Text>
                </Pressable>
              </View>
              {viewerUrls[viewerIndex] ? (
                <Pressable
                  onPress={async () => {
                    const abs = toAbsoluteUrl(viewerUrls[viewerIndex])
                    try {
                      await Linking.openURL(abs)
                    } catch {
                      Alert.alert(t('common_error'), '打开失败')
                    }
                  }}
                  style={({ pressed }) => [styles.viewerLinkBtnAbs, pressed ? styles.pressed : null]}
                >
                  <Text style={styles.viewerLinkText}>在浏览器打开</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </Modal>
      {!detailItem && viewerOpen ? (
        <View style={styles.viewerOverlay}>
          <ScrollView
            ref={(r) => {
              viewerRef.current = r
            }}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: viewerIndex * screen.width, y: 0 }}
            onMomentumScrollEnd={(e) => {
              const x = Number(e?.nativeEvent?.contentOffset?.x || 0)
              const idx = Math.round(x / Math.max(1, screen.width))
              setViewerIndex(Math.max(0, Math.min(viewerUrls.length - 1, idx)))
            }}
          >
            {viewerUrls.map((u, idx) => {
              const abs = toAbsoluteUrl(u)
              const st = viewerCache[abs]
              const uri = st?.uri || abs
              const err = st?.error
              const loading = st?.loading
              return (
                <View key={`${u}-${idx}`} style={{ width: screen.width, height: screen.height }}>
                  <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                  {loading ? <Text style={[styles.viewerHint, styles.viewerHintPos]}>加载中…</Text> : null}
                  {err ? <Text style={[styles.viewerHint, styles.viewerHintPos]}>{err}</Text> : null}
                </View>
              )
            })}
          </ScrollView>
          <View style={[styles.viewerTopRow, { paddingTop: Math.max(10, insets.top) }]}>
            <Text style={styles.viewerIndex}>{`${viewerIndex + 1}/${viewerUrls.length}`}</Text>
            <Pressable onPress={() => setViewerOpen(false)} style={({ pressed }) => [styles.viewerCloseBtn, pressed ? styles.pressed : null]}>
              <Text style={styles.viewerCloseText}>关闭</Text>
            </Pressable>
          </View>
          {viewerUrls[viewerIndex] ? (
            <Pressable
              onPress={async () => {
                const abs = toAbsoluteUrl(viewerUrls[viewerIndex])
                try {
                  await Linking.openURL(abs)
                } catch {
                  Alert.alert(t('common_error'), '打开失败')
                }
              }}
              style={({ pressed }) => [styles.viewerLinkBtnAbs, pressed ? styles.pressed : null]}
            >
              <Text style={styles.viewerLinkText}>在浏览器打开</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F6F7FB' },
  content: { padding: 16 },
  card: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, borderWidth: hairline(), borderColor: '#EEF0F6' },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  title: { fontSize: 16, fontWeight: '900', color: '#111827' },
  badge: { height: 30, paddingHorizontal: 10, borderRadius: 12, backgroundColor: '#EFF6FF', borderWidth: hairline(), borderColor: '#DBEAFE', flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '70%' },
  badgeText: { color: '#2563EB', fontWeight: '900', flexShrink: 1 },
  sub: { marginTop: 8, color: '#6B7280', fontWeight: '700' },
  segmentRow: { marginTop: 12, flexDirection: 'row', gap: 10 },
  segment: { flex: 1, height: 38, borderRadius: 12, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  segmentText: { fontWeight: '900', color: '#374151' },
  segmentTextActive: { color: '#FFFFFF' },
  label: { marginTop: 14, marginBottom: 8, color: '#111827', fontWeight: '900' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 34, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { color: '#374151', fontWeight: '900' },
  chipTextActive: { color: '#FFFFFF' },
  input: { borderRadius: 12, borderWidth: hairline(), borderColor: '#D1D5DB', paddingHorizontal: 12, fontWeight: '700', color: '#111827' },
  textarea: { height: 120, paddingTop: 12, textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  photoBtn: { height: 38, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  photoBtnText: { fontWeight: '900', color: '#111827' },
  photoHint: { color: '#6B7280', fontWeight: '700' },
  submitBtn: { marginTop: 14, height: 44, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  submitDisabled: { backgroundColor: '#93C5FD' },
  submitText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  divider: { marginTop: 14, borderTopWidth: hairline(), borderTopColor: '#EEF0F6' },
  pendingHead: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pendingTitle: { fontWeight: '900', color: '#111827' },
  pendingToggle: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB' },
  pendingToggleText: { fontWeight: '900', color: '#111827', fontSize: 12 },
  groupTitle: { marginTop: 6, fontWeight: '900', color: '#374151' },
  pendingItem: { marginTop: 8, padding: 10, borderRadius: 12, backgroundColor: '#F9FAFB', borderWidth: hairline(), borderColor: '#EEF0F6' },
  pendingLine: { fontWeight: '800', color: '#111827' },
  pendingMeta: { marginTop: 6, color: '#6B7280', fontWeight: '700', fontSize: 12 },
  muted: { color: '#6B7280', fontWeight: '700' },
  pressed: { opacity: 0.92 },
  editHintRow: { marginTop: 12, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 12, backgroundColor: '#EFF6FF', borderWidth: hairline(), borderColor: '#DBEAFE', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  editHintText: { fontWeight: '900', color: '#1D4ED8' },
  detailModalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  detailCardWrap: { flex: 1, padding: 14, justifyContent: 'center' },
  detailCard: { width: '100%', flex: 1, maxHeight: '85%', borderRadius: 16, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: hairline(), borderColor: '#EEF0F6' },
  detailTopRow: { height: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: hairline(), borderBottomColor: '#EEF0F6' },
  detailTitle: { fontWeight: '900', color: '#111827' },
  detailCloseBtn: { height: 32, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  detailCloseText: { fontWeight: '900', color: '#111827' },
  detailText: { fontWeight: '800', color: '#111827', lineHeight: 20 },
  detailSubTitle: { fontWeight: '900', color: '#111827' },
  thumbRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumbWrap: { width: 92, height: 92, borderRadius: 12, overflow: 'hidden', borderWidth: hairline(), borderColor: '#EEF0F6', backgroundColor: '#F3F4F6' },
  thumb: { width: '100%', height: '100%' },
  itemCard: { marginTop: 10, padding: 12, borderRadius: 14, backgroundColor: '#F9FAFB', borderWidth: hairline(), borderColor: '#EEF0F6' },
  itemCardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  itemCardTitle: { fontWeight: '900', color: '#111827' },
  itemCardMeta: { marginTop: 4, color: '#6B7280', fontWeight: '800' },
  itemCardDetail: { marginTop: 10, fontWeight: '800', color: '#111827', lineHeight: 20 },
  itemCardActions: { flexDirection: 'row', gap: 8 },
  itemCardBtn: { height: 30, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  itemCardBtnText: { fontWeight: '900', color: '#111827', fontSize: 12 },
  itemCardBtnDanger: { height: 30, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#FEF2F2', borderWidth: hairline(), borderColor: '#FECACA', alignItems: 'center', justifyContent: 'center' },
  itemCardBtnDangerText: { fontWeight: '900', color: '#B91C1C', fontSize: 12 },
  viewerOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#000000' },
  viewerTopRow: { position: 'absolute', left: 0, right: 0, top: 0, minHeight: 52, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 12 },
  viewerIndex: { color: '#FFFFFF', fontWeight: '900', marginTop: 10 },
  viewerCloseBtn: { height: 32, paddingHorizontal: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  viewerCloseText: { color: '#FFFFFF', fontWeight: '900' },
  viewerHint: { color: 'rgba(255,255,255,0.78)', fontWeight: '800', paddingHorizontal: 16, textAlign: 'center' },
  viewerHintPos: { position: 'absolute', left: 0, right: 0, top: '50%', marginTop: -14 },
  viewerLinkBtnAbs: { position: 'absolute', left: 12, bottom: 12, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: hairline(), borderColor: 'rgba(255,255,255,0.22)' },
  viewerLinkText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
})
