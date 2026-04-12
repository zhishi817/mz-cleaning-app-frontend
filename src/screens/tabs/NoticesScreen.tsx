import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useIsFocused } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { hairline, moderateScale } from '../../lib/scale'
import { getJson, setJson } from '../../lib/storage'
import { getNoticesSnapshot, initNoticesStore, markNoticeRead, refreshNotices, subscribeNotices, type Notice, upsertNotices } from '../../lib/noticesStore'
import { getPresentedNotice } from '../../lib/noticePresentation'
import { resolveNoticeCreatedAt } from '../../lib/noticeTime'
import { getWorkTasksSnapshot, subscribeWorkTasks } from '../../lib/workTasksStore'
import {
  listCompanyAnnouncementsForApp,
  listCompanySecretsForApp,
  listInboxNotifications,
  listWarehouseGuidesForApp,
  listWorkGuidesForApp,
  listWorkTasks,
  markInboxNotificationsRead,
  type CompanyAnnouncement,
  type CompanyGuide,
  type InboxNotificationItem,
  type WarehouseGuide,
  type WorkTask,
} from '../../lib/api'
import type { NoticesStackParamList } from '../../navigation/RootNavigator'

type Props = NativeStackScreenProps<NoticesStackParamList, 'NoticesList'>

type SearchResult = {
  id: string
  kind: 'property' | 'secret' | 'task' | 'guide' | 'warehouse_guide' | 'announcement'
  title: string
  subtitle: string
  body: string
  icon: keyof typeof Ionicons.glyphMap
  taskId?: string | null
  taskKind?: string | null
  taskSourceType?: string | null
  url?: string | null
  copyText?: string | null
  secretId?: string
}

type SearchSection = {
  key: 'property' | 'task' | 'announcement' | 'guide' | 'warehouse_guide'
  title: string
  emptyText: string
  items: SearchResult[]
}

type CompanyContentCache = {
  announcements: CompanyAnnouncement[]
  workGuides: CompanyGuide[]
  warehouseGuides: WarehouseGuide[]
  secrets: Array<{ id: string; title: string; username?: string | null; note?: string | null; secret?: string | null; updated_at?: string | null }>
}

const COMPANY_CONTENT_CACHE_KEY = 'mzstay.notices.company-content.v1'
const HISTORY_SEARCH_WINDOWS = [3, 6, 12] as const

function formatTime(iso: string) {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return '--/-- --:--'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function typeMeta(type: Notice['type']) {
  if (type === 'update') return { bg: '#EFF6FF', fg: '#2563EB' }
  if (type === 'key') return { bg: '#DCFCE7', fg: '#16A34A' }
  return { bg: '#F3F4F6', fg: '#374151' }
}

function formatKeyPhotoNotice(title0: string, body0: string, data0: any) {
  const data = data0 && typeof data0 === 'object' ? data0 : {}
  const kind = String(data?.kind || '').trim()
  const propertyCode = String(data?.property_code || '').trim()
  const photoUrl = String(data?.photo_url || '').trim()
  if (kind !== 'key_photo_uploaded') {
    return { title: title0, summary: body0, content: body0 }
  }
  const title = propertyCode ? `钥匙已上传：${propertyCode}` : (title0 || '钥匙已上传')
  const lines = [propertyCode ? `房源：${propertyCode}` : '', body0 || '清洁员已上传钥匙照片', photoUrl ? `照片：${photoUrl}` : ''].filter(Boolean)
  const content = lines.join('\n')
  return {
    title,
    summary: propertyCode ? `房源：${propertyCode}` : (body0 || '清洁员已上传钥匙照片'),
    content,
  }
}

function normalizeHttpUrl(raw: string | null | undefined) {
  const u = String(raw || '').trim()
  if (!u) return null
  if (/^https?:\/\//i.test(u)) return u
  return `https://${u}`
}

function extractTextLinesFromContent(content: string | null | undefined): string[] {
  const raw = String(content || '').trim()
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return raw.split(/\n+/).map(s => s.trim()).filter(Boolean)
    const lines: string[] = []
    for (const block of parsed) {
      const type = String(block?.type || '').trim()
      if (type === 'heading' || type === 'paragraph' || type === 'callout') {
        const text = String(block?.text || '').trim()
        if (text) lines.push(text)
        continue
      }
      if (type === 'image' || type === 'video') {
        const caption = String(block?.caption || '').trim()
        if (caption) lines.push(caption)
        continue
      }
      if (type === 'step') {
        const title = String(block?.title || '').trim()
        if (title) lines.push(title)
        const contents = Array.isArray(block?.contents) ? block.contents : []
        for (const item of contents) {
          const text = String(item?.text || item?.caption || '').trim()
          if (text) lines.push(text)
        }
      }
    }
    return lines.filter(Boolean)
  } catch {
    return raw
      .replace(/<[^>]+>/g, ' ')
      .split(/\n+/)
      .map(s => s.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
  }
}

function companyContentBody(content: string | null | undefined) {
  return extractTextLinesFromContent(content).join('\n')
}

function companyContentSummary(content: string | null | undefined, fallback = '暂无内容') {
  const lines = extractTextLinesFromContent(content)
  const merged = lines.slice(0, 3).join(' ')
  const summary = merged.replace(/\s+/g, ' ').trim()
  if (!summary) return fallback
  return summary.length > 84 ? `${summary.slice(0, 84).trim()}...` : summary
}

function taskStatusLabel(task: WorkTask) {
  const s = String(task.status || '').trim()
  return s || 'unknown'
}

function taskHistorySubtitle(task: WorkTask) {
  const code = String(task.property?.code || task.title || '').trim() || '任务'
  const date = String(task.scheduled_date || (task as any).date || '').trim()
  const type = String((task as any).task_type || task.task_kind || '').trim()
  return [code, date, type].filter(Boolean).join(' · ')
}

function taskHistoryBody(task: WorkTask) {
  const lines: string[] = []
  const code = String(task.property?.code || '').trim()
  const addr = String(task.property?.address || '').trim()
  const date = String(task.scheduled_date || (task as any).date || '').trim()
  const start = String((task as any).start_time || '').trim()
  const end = String((task as any).end_time || '').trim()
  const oldCode = String((task as any).old_code || '').trim()
  const newCode = String((task as any).new_code || '').trim()
  const guest = String((task as any).guest_special_request || '').trim()
  const summary = String(task.summary || '').trim()
  if (code) lines.push(`房源：${code}`)
  if (addr) lines.push(`地址：${addr}`)
  if (date) lines.push(`日期：${date}`)
  lines.push(`状态：${taskStatusLabel(task)}`)
  if (start || end) lines.push(`时间：${[start ? `退房 ${start}` : '', end ? `入住 ${end}` : ''].filter(Boolean).join('  ')}`)
  if (oldCode || newCode) lines.push(`密码：${[oldCode ? `旧 ${oldCode}` : '', newCode ? `新 ${newCode}` : ''].filter(Boolean).join('  ')}`)
  if (guest) lines.push(`客需：${guest}`)
  if (summary) lines.push(`说明：${summary}`)
  return lines.join('\n')
}

function propertySearchBody(task: WorkTask) {
  const lines: string[] = []
  const code = String(task.property?.code || '').trim()
  const addr = String(task.property?.address || '').trim()
  const wifiSsid = String((task.property as any)?.wifi_ssid || '').trim()
  const wifiPassword = String((task.property as any)?.wifi_password || '').trim()
  const guide = normalizeHttpUrl((task.property as any)?.access_guide_link)
  const oldCode = String((task as any).old_code || '').trim()
  const newCode = String((task as any).new_code || '').trim()
  const guest = String((task as any).guest_special_request || '').trim()
  if (code) lines.push(`房号：${code}`)
  if (addr) lines.push(`地址：${addr}`)
  if (wifiSsid) lines.push(`Wi-Fi：${wifiSsid}`)
  if (wifiPassword) lines.push(`Wi-Fi密码：${wifiPassword}`)
  if (guide) lines.push(`入住指南：${guide}`)
  if (oldCode || newCode) lines.push(`门锁密码：${[oldCode ? `旧 ${oldCode}` : '', newCode ? `新 ${newCode}` : ''].filter(Boolean).join('  ')}`)
  if (guest) lines.push(`客需：${guest}`)
  return lines.join('\n')
}

function propertySearchSubtitle(task: WorkTask) {
  const code = String(task.property?.code || '').trim()
  const addr = String(task.property?.address || '').trim()
  const wifiSsid = String((task.property as any)?.wifi_ssid || '').trim()
  return [code, addr, wifiSsid ? `Wi-Fi ${wifiSsid}` : ''].filter(Boolean).join(' · ')
}

function announcementSubtitle(item: CompanyAnnouncement) {
  return `${item.urgent ? '紧急公告 · ' : ''}${item.published_at ? item.published_at : '已发布'}`
}

export default function NoticesScreen(props: Props) {
  const { t } = useI18n()
  const { token, user } = useAuth()
  const isFocused = useIsFocused()
  const { width: windowWidth } = useWindowDimensions()
  const [hasInit, setHasInit] = useState(false)
  const [, setTick] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const [query, setQuery] = useState('')
  const [secrets, setSecrets] = useState<Array<{ id: string; title: string; username?: string | null; note?: string | null; secret?: string | null; updated_at?: string | null }>>([])
  const [historyTasks, setHistoryTasks] = useState<WorkTask[]>([])
  const [announcements, setAnnouncements] = useState<CompanyAnnouncement[]>([])
  const [announcementIndex, setAnnouncementIndex] = useState(0)
  const [workGuides, setWorkGuides] = useState<CompanyGuide[]>([])
  const [warehouseGuides, setWarehouseGuides] = useState<WarehouseGuide[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMoreRemote, setHasMoreRemote] = useState(true)
  const [companyContentHydrated, setCompanyContentHydrated] = useState(false)
  const [historyWindowIndex, setHistoryWindowIndex] = useState(0)
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false)
  const companyContentLoadedRef = useRef(false)
  const historyLoadedWindowIndexRef = useRef(-1)
  const role = String(user?.role || '').trim()
  const canSearchAllTaskHistory = role === 'admin' || role === 'offline_manager' || role === 'customer_service'

  const snap = getNoticesSnapshot()
  const hasAnyUnread = Object.keys(snap.unreadIds || {}).length > 0
  const announcementCardWidth = useMemo(() => Math.max(280, windowWidth - 32), [windowWidth])
  const featuredGuides = workGuides.slice(0, 5)

  useEffect(() => {
    if (!announcements.length) {
      setAnnouncementIndex(0)
      return
    }
    if (announcementIndex >= announcements.length) setAnnouncementIndex(0)
  }, [announcementIndex, announcements.length])

  const items = useMemo(() => {
    const base0 = snap.items.filter(n => n.type !== 'system')
    const base = showUnreadOnly ? base0.filter(n => !!snap.unreadIds[n.id]) : base0
    const q = query.trim().toLowerCase()
    if (!q) return base
    return base.filter(n => {
      const a = String(n.title || '').toLowerCase()
      const b = String(n.summary || '').toLowerCase()
      const c = String(n.content || '').toLowerCase()
      return a.includes(q) || b.includes(q) || c.includes(q)
    })
  }, [query, showUnreadOnly, snap.items, snap.unreadIds])

  useEffect(() => {
    let unsub: (() => void) | null = null
    let unsub2: (() => void) | null = null
    ;(async () => {
      await initNoticesStore()
      const cachedContent = await getJson<CompanyContentCache>(COMPANY_CONTENT_CACHE_KEY)
      if (cachedContent) {
        if (Array.isArray(cachedContent.secrets)) setSecrets(cachedContent.secrets)
        if (Array.isArray(cachedContent.announcements)) setAnnouncements(cachedContent.announcements)
        if (Array.isArray(cachedContent.workGuides)) setWorkGuides(cachedContent.workGuides)
        if (Array.isArray(cachedContent.warehouseGuides)) setWarehouseGuides(cachedContent.warehouseGuides)
        companyContentLoadedRef.current =
          Array.isArray(cachedContent.secrets) ||
          Array.isArray(cachedContent.announcements) ||
          Array.isArray(cachedContent.workGuides) ||
          Array.isArray(cachedContent.warehouseGuides)
      }
      setCompanyContentHydrated(true)
      setHasInit(true)
      unsub = subscribeNotices(() => setTick(v => v + 1))
      unsub2 = subscribeWorkTasks(() => setTick(v => v + 1))
      setTick(v => v + 1)
    })()
    return () => {
      if (unsub) unsub()
      if (unsub2) unsub2()
    }
  }, [])

  async function loadCompanyContent(options?: { force?: boolean }) {
    if (!token) return
    if (!options?.force && companyContentLoadedRef.current) return
    const [secretRows, announceRows, guideRows, warehouseRows] = await Promise.allSettled([
      listCompanySecretsForApp(token),
      listCompanyAnnouncementsForApp(token),
      listWorkGuidesForApp(token),
      listWarehouseGuidesForApp(token),
    ])
    if (secretRows.status === 'fulfilled' && Array.isArray(secretRows.value)) setSecrets(secretRows.value)
    if (announceRows.status === 'fulfilled' && Array.isArray(announceRows.value)) setAnnouncements(announceRows.value)
    if (guideRows.status === 'fulfilled' && Array.isArray(guideRows.value)) setWorkGuides(guideRows.value)
    if (warehouseRows.status === 'fulfilled' && Array.isArray(warehouseRows.value)) setWarehouseGuides(warehouseRows.value)
    const nextSecrets = secretRows.status === 'fulfilled' && Array.isArray(secretRows.value) ? secretRows.value : secrets
    const nextAnnouncements = announceRows.status === 'fulfilled' && Array.isArray(announceRows.value) ? announceRows.value : announcements
    const nextWorkGuides = guideRows.status === 'fulfilled' && Array.isArray(guideRows.value) ? guideRows.value : workGuides
    const nextWarehouseGuides = warehouseRows.status === 'fulfilled' && Array.isArray(warehouseRows.value) ? warehouseRows.value : warehouseGuides
    if (
      (secretRows.status === 'fulfilled' && Array.isArray(secretRows.value)) ||
      (announceRows.status === 'fulfilled' && Array.isArray(announceRows.value)) ||
      (guideRows.status === 'fulfilled' && Array.isArray(guideRows.value)) ||
      (warehouseRows.status === 'fulfilled' && Array.isArray(warehouseRows.value))
    ) {
      await setJson<CompanyContentCache>(COMPANY_CONTENT_CACHE_KEY, {
        secrets: nextSecrets,
        announcements: nextAnnouncements,
        workGuides: nextWorkGuides,
        warehouseGuides: nextWarehouseGuides,
      })
    }
    companyContentLoadedRef.current =
      (secretRows.status === 'fulfilled' && Array.isArray(secretRows.value)) ||
      (announceRows.status === 'fulfilled' && Array.isArray(announceRows.value)) ||
      (guideRows.status === 'fulfilled' && Array.isArray(guideRows.value)) ||
      (warehouseRows.status === 'fulfilled' && Array.isArray(warehouseRows.value))
        ? true
        : companyContentLoadedRef.current
    setCompanyContentHydrated(true)
  }

  async function loadHistoryTasks(options?: { force?: boolean; windowIndex?: number }) {
    if (!token || !user?.id) return
    const targetIndex = Math.max(0, Math.min(HISTORY_SEARCH_WINDOWS.length - 1, Number(options?.windowIndex ?? historyWindowIndex) || 0))
    if (!options?.force && historyLoadedWindowIndexRef.current >= targetIndex) return
    const pad2 = (n: number) => String(n).padStart(2, '0')
    const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
    const now = new Date()
    const from = new Date(now)
    from.setMonth(from.getMonth() - HISTORY_SEARCH_WINDOWS[targetIndex])
    const to = new Date(now)
    to.setDate(to.getDate() + 60)
    const rows = await listWorkTasks(token, {
      date_from: ymd(from),
      date_to: ymd(to),
      view: canSearchAllTaskHistory ? 'all' : 'mine',
    })
    setHistoryTasks(Array.isArray(rows) ? rows : [])
    historyLoadedWindowIndexRef.current = targetIndex
    setHistoryWindowIndex(targetIndex)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!isFocused) return
      if (!token) return
      try {
        await loadCompanyContent()
      } catch {
        if (!cancelled) return
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isFocused, token])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!isFocused) return
      if (!token) return
      if (!user?.id) return
      try {
        await loadHistoryTasks()
      } catch {
        if (!cancelled) return
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isFocused, token, user?.id, canSearchAllTaskHistory, historyWindowIndex])

  useEffect(() => {
    ;(async () => {
      if (!isFocused) return
      if (!token) return
      if (!hasInit) return
      try {
        await syncInbox(true)
      } catch {}
    })()
    return () => {}
  }, [isFocused, token, hasInit])

  function inboxNoticeType(it: InboxNotificationItem): Notice['type'] {
    const t0 = String(it.type || '').toUpperCase()
    const changes = Array.isArray(it.changes) ? it.changes.map(v => String(v || '').toLowerCase()) : []
    if (t0.includes('KEY') || changes.includes('keys')) return 'key'
    return 'update'
  }

  function inboxToNotice(it: InboxNotificationItem) {
    const createdAt = resolveNoticeCreatedAt(it.created_at, it.event_id, it.id) || new Date().toISOString()
    const body = String(it.body || '').trim()
    const title = String(it.title || '').trim() || '通知'
    const unread = !it.read_at
    const data = it.data && typeof it.data === 'object' ? it.data : {}
    const formatted = formatKeyPhotoNotice(title, body, data)
    return {
      id: String(it.event_id || it.id || '').trim(),
      type: inboxNoticeType(it),
      title: formatted.title,
      summary: formatted.summary,
      content: formatted.content,
      data: { ...data, _server_id: String(it.id || '').trim(), event_id: String(it.event_id || '').trim() },
      createdAt,
      unread,
    }
  }

  async function syncInbox(reset: boolean) {
    if (!token) return
    if (!hasMoreRemote && !reset) return
    const cur = reset ? null : cursor
    const { items: rows, next_cursor } = await listInboxNotifications(token, { limit: 50, cursor: cur })
    const list = (rows || []).map(inboxToNotice).filter(n => !!n.id)
    await upsertNotices(list, { replace: reset })
    setCursor(next_cursor)
    setHasMoreRemote(!!next_cursor)
  }

  async function onRefresh() {
    try {
      setRefreshing(true)
      await refreshNotices()
      await Promise.allSettled([syncInbox(true), loadCompanyContent({ force: true }), loadHistoryTasks({ force: true })])
    } finally {
      setRefreshing(false)
    }
  }

  async function onLoadMore() {
    if (query.trim()) return
    if (loadingMore) return
    try {
      setLoadingMore(true)
      await syncInbox(false)
    } finally {
      setLoadingMore(false)
    }
  }

  async function onExpandHistorySearch() {
    if (!token || historyLoadingMore) return
    if (historyWindowIndex >= HISTORY_SEARCH_WINDOWS.length - 1) return
    try {
      setHistoryLoadingMore(true)
      await loadHistoryTasks({ force: true, windowIndex: historyWindowIndex + 1 })
    } finally {
      setHistoryLoadingMore(false)
    }
  }

  async function markNoticeOpened(item: Notice) {
    await markNoticeRead(item.id)
    try {
      const serverId = String((item as any)?.data?._server_id || '').trim()
      if (token && serverId) await markInboxNotificationsRead(String(token), { ids: [serverId] })
    } catch {}
  }

  const searchSections = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return [] as SearchSection[]
    const workItems = getWorkTasksSnapshot().items || []
    const propertyResults: SearchResult[] = []
    const taskResults: SearchResult[] = []
    const announcementResults: SearchResult[] = []
    const guideResults: SearchResult[] = []
    const warehouseGuideResults: SearchResult[] = []
    const seen = new Set<string>()

    for (const it of workItems) {
      const code = String(it.property?.code || '').trim()
      const addr = String(it.property?.address || '').trim()
      const wifiSsid = String((it.property as any)?.wifi_ssid || '').trim()
      const wifiPassword = String((it.property as any)?.wifi_password || '').trim()
      const guide = normalizeHttpUrl((it.property as any)?.access_guide_link)
      const oldCode = String((it as any).old_code || '').trim()
      const newCode = String((it as any).new_code || '').trim()
      const guest = String((it as any).guest_special_request || '').trim()
      const hay = `${code} ${addr} ${wifiSsid} ${wifiPassword} ${guide || ''} ${oldCode} ${newCode} ${guest}`.toLowerCase()
      if (!hay.includes(q)) continue
      const key = String((it.property as any)?.id || code || it.id).trim()
      if (!key || seen.has(`prop:${key}`)) continue
      seen.add(`prop:${key}`)
      propertyResults.push({
        id: `prop:${key}`,
        kind: 'property',
        title: code ? `房源：${code}` : '房源信息',
        subtitle: propertySearchSubtitle(it) || '-',
        body: propertySearchBody(it) || '-',
        icon: 'home-outline',
        url: guide,
        copyText: addr || null,
      })
      if (propertyResults.length >= 8) break
    }

    for (const it of historyTasks) {
      const code = String(it.property?.code || '').trim()
      const addr = String(it.property?.address || '').trim()
      const summary = String(it.summary || '').trim()
      const taskType = String((it as any).task_type || it.task_kind || '').trim()
      const oldCode = String((it as any).old_code || '').trim()
      const newCode = String((it as any).new_code || '').trim()
      const guest = String((it as any).guest_special_request || '').trim()
      const date = String(it.scheduled_date || (it as any).date || '').trim()
      const wifiSsid = String((it.property as any)?.wifi_ssid || '').trim()
      const wifiPassword = String((it.property as any)?.wifi_password || '').trim()
      const guide = normalizeHttpUrl((it.property as any)?.access_guide_link)
      const hay = `${code} ${addr} ${summary} ${taskType} ${oldCode} ${newCode} ${guest} ${date} ${wifiSsid} ${wifiPassword} ${guide || ''}`.toLowerCase()
      if (!hay.includes(q)) continue
      const taskId = String(it.id || '').trim()
      if (!taskId || seen.has(`task:${taskId}`)) continue
      seen.add(`task:${taskId}`)
      taskResults.push({
        id: `task:${taskId}`,
        kind: 'task',
        title: code ? `任务：${code}` : '历史任务',
        subtitle: taskHistorySubtitle(it),
        body: taskHistoryBody(it),
        icon: 'time-outline',
        taskId,
        taskKind: String(it.task_kind || ''),
        taskSourceType: String(it.source_type || ''),
      })
      if (taskResults.length >= 12) break
    }

    for (const announcement of announcements) {
      const title = String(announcement.title || '').trim()
      const body = companyContentBody(announcement.content)
      const summary = companyContentSummary(announcement.content, '公司公告')
      const subtitle = announcementSubtitle(announcement)
      const hay = `${title} ${summary} ${body} ${subtitle}`.toLowerCase()
      if (!hay.includes(q)) continue
      const key = String(announcement.id || '').trim()
      if (!key || seen.has(`announcement:${key}`)) continue
      seen.add(`announcement:${key}`)
      announcementResults.push({
        id: `announcement:${key}`,
        kind: 'announcement',
        title: title || '公司公告',
        subtitle,
        body,
        icon: 'megaphone-outline',
      })
      if (announcementResults.length >= 8) break
    }

    for (const guide of workGuides) {
      const title = String(guide.title || '').trim()
      const body = companyContentBody(guide.content)
      const summary = companyContentSummary(guide.content, '工作指南')
      const hay = `${title} ${summary} ${body}`.toLowerCase()
      if (!hay.includes(q)) continue
      const key = String(guide.id || '').trim()
      if (!key || seen.has(`guide:${key}`)) continue
      seen.add(`guide:${key}`)
      guideResults.push({
        id: `guide:${key}`,
        kind: 'guide',
        title: title || '工作指南',
        subtitle: summary,
        body,
        icon: 'book-outline',
      })
      if (guideResults.length >= 8) break
    }

    for (const guide of warehouseGuides) {
      const title = String(guide.title || '').trim()
      const body = companyContentBody(guide.content)
      const summary = companyContentSummary(guide.content, '仓库指南')
      const hay = `${title} ${summary} ${body}`.toLowerCase()
      if (!hay.includes(q)) continue
      const key = String(guide.id || '').trim()
      if (!key || seen.has(`warehouse:${key}`)) continue
      seen.add(`warehouse:${key}`)
      warehouseGuideResults.push({
        id: `warehouse:${key}`,
        kind: 'warehouse_guide',
        title: title || '仓库指南',
        subtitle: summary,
        body,
        icon: 'cube-outline',
      })
      if (warehouseGuideResults.length >= 8) break
    }

    return [
      { key: 'property', title: '房源信息', emptyText: '没有匹配的房源信息，可试试房号、地址、Wi-Fi 或入住指南。', items: propertyResults },
      { key: 'task', title: '历史任务', emptyText: `最近 ${HISTORY_SEARCH_WINDOWS[historyWindowIndex]} 个月内没有匹配的历史任务。`, items: taskResults },
      { key: 'announcement', title: '公司公告', emptyText: '没有匹配的公司公告。', items: announcementResults },
      { key: 'guide', title: '工作指南', emptyText: '没有匹配的工作指南。', items: guideResults },
      { key: 'warehouse_guide', title: '仓库指南', emptyText: '没有匹配的仓库指南。', items: warehouseGuideResults },
    ] satisfies SearchSection[]
  }, [query, announcements, historyTasks, historyWindowIndex, warehouseGuides, workGuides])

  function openSearchResult(item: SearchResult) {
    if (item.kind === 'task' && item.taskId) {
      const isCleaningTask = String(item.taskSourceType || '').trim() === 'cleaning_tasks'
      const isInspection = isCleaningTask && String(item.taskKind || '').trim() === 'inspection'
      const isManager = role === 'admin' || role === 'offline_manager' || role === 'customer_service'
      const isInspector = role === 'cleaning_inspector' || role === 'cleaner_inspector'
      if (isManager && isCleaningTask) {
        props.navigation.navigate('ManagerDailyTask', { taskId: item.taskId })
        return
      }
      if (isInspector && isInspection) {
        props.navigation.navigate('InspectionPanel', { taskId: item.taskId })
        return
      }
      props.navigation.navigate('TaskDetail', { id: item.taskId })
      return
    }
    props.navigation.navigate('InfoCenterDetail', {
      kind: item.kind,
      title: item.title,
      subtitle: item.subtitle,
      body: item.body,
      url: item.url || null,
      copyText: item.copyText || null,
      secretId: item.secretId,
    })
  }

  function renderSearchResult(item: SearchResult) {
    return (
      <Pressable
        key={item.id}
        onPress={() => openSearchResult(item)}
        style={({ pressed }) => [styles.searchResultRow, pressed ? styles.rowPressed : null]}
      >
        <View style={styles.searchResultIcon}>
          <Ionicons name={item.icon} size={moderateScale(18)} color="#2563EB" />
        </View>
        <View style={styles.searchResultMain}>
          <Text style={styles.searchResultTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.searchResultSummary} numberOfLines={2}>
            {item.subtitle}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={moderateScale(16)} color="#9CA3AF" />
      </Pressable>
    )
  }

  function renderSearchSection(section: SearchSection) {
    const canExpandHistory = section.key === 'task' && historyWindowIndex < HISTORY_SEARCH_WINDOWS.length - 1
    const nextMonths = canExpandHistory ? HISTORY_SEARCH_WINDOWS[historyWindowIndex + 1] : null
    return (
      <View key={section.key} style={styles.searchGroup}>
        <View style={styles.searchGroupHead}>
          <Text style={styles.searchGroupTitle}>{section.title}</Text>
          <Text style={styles.searchGroupMeta}>{section.items.length} 条</Text>
        </View>
        {section.items.length ? section.items.map(renderSearchResult) : <Text style={styles.searchEmptyText}>{section.emptyText}</Text>}
        {canExpandHistory ? (
          <Pressable
            onPress={onExpandHistorySearch}
            style={({ pressed }) => [styles.searchMoreBtn, pressed ? styles.rowPressed : null, historyLoadingMore ? styles.searchMoreBtnDisabled : null]}
            disabled={historyLoadingMore}
          >
            <Text style={styles.searchMoreBtnText}>
              {historyLoadingMore ? '加载中...' : `展示更多历史任务（扩展到最近 ${nextMonths} 个月）`}
            </Text>
          </Pressable>
        ) : null}
      </View>
    )
  }

  function renderNoticeItem({ item }: { item: Notice }) {
    const notice = getPresentedNotice(item)
    const meta = typeMeta(notice.type)
    const unread = !!getNoticesSnapshot().unreadIds[notice.id]
    const icon = notice.type === 'update' ? 'megaphone-outline' : notice.type === 'key' ? 'key-outline' : 'clipboard-outline'
    const img = notice.images[0] || null
    return (
      <Pressable
        onPress={() => {
          props.navigation.navigate('NoticeDetail', { id: notice.id })
          markNoticeOpened(notice).catch(() => null)
        }}
        style={({ pressed }) => [styles.noticeRow, pressed ? styles.rowPressed : null]}
      >
        <View style={[styles.noticeIconWrap, { backgroundColor: meta.bg, borderColor: meta.bg }]}>
          <Ionicons name={icon as any} size={moderateScale(18)} color={meta.fg} />
        </View>
        <View style={styles.noticeMain}>
          <Text style={styles.noticeTitle} numberOfLines={1}>
            {notice.title}
          </Text>
          <Text style={styles.noticeSummary} numberOfLines={1}>
            {notice.summary}
          </Text>
        </View>
        {img ? <Image source={{ uri: img }} style={styles.noticeThumb} /> : null}
        <View style={styles.noticeRight}>
          <View style={styles.noticeTimeRow}>
            <Text style={styles.noticeTime}>{formatTime(notice.createdAt).split(' ')[1]}</Text>
            {unread ? <View style={styles.unreadDot} /> : null}
          </View>
          <Ionicons name="chevron-forward" size={moderateScale(16)} color="#9CA3AF" />
        </View>
      </Pressable>
    )
  }

  function renderAnnouncementCard(item: CompanyAnnouncement, index: number) {
    const summary = companyContentSummary(item.content, '点击查看公司公告')
    const body = companyContentBody(item.content)
    return (
      <Pressable
        key={String(item.id || index)}
        onPress={() =>
          props.navigation.navigate('InfoCenterDetail', {
            kind: 'announcement',
            title: String(item.title || '公司公告'),
            subtitle: `${item.urgent ? '紧急公告 · ' : ''}${item.published_at ? formatTime(`${item.published_at}T00:00:00`).split(' ')[0] : '已发布'}`,
            body,
          })
        }
        style={({ pressed }) => [styles.announcementCard, { width: announcementCardWidth }, pressed ? styles.rowPressed : null]}
      >
        <View style={styles.announcementHead}>
          <View style={styles.announcementBadgeRow}>
            <View style={styles.announcementIconWrap}>
              <Ionicons name="megaphone-outline" size={moderateScale(18)} color="#D97706" />
            </View>
            <View style={styles.announcementTextWrap}>
              <Text style={styles.announcementTitle} numberOfLines={2}>
                {String(item.title || '公司公告')}
              </Text>
              <Text style={styles.announcementMeta}>
                {item.urgent ? '紧急公告' : '最新公告'}
                {item.published_at ? ` · ${item.published_at}` : ''}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={moderateScale(16)} color="#9CA3AF" />
        </View>
        <Text style={styles.announcementSummary} numberOfLines={3}>
          {summary}
        </Text>
      </Pressable>
    )
  }

  function renderAnnouncementRail() {
    return (
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>公司公告</Text>
          {announcements.length > 1 ? <Text style={styles.sectionMeta}>{announcementIndex + 1}/{announcements.length}</Text> : null}
        </View>
        {!companyContentHydrated ? (
          <View style={styles.announcementPlaceholder}>
            <ActivityIndicator size="small" color="#D97706" />
            <View style={styles.announcementTextWrap}>
              <Text style={styles.announcementTitle}>公司公告加载中</Text>
              <Text style={styles.announcementSummary}>正在读取最近一次公告并同步最新内容。</Text>
            </View>
          </View>
        ) : announcements.length ? (
          <>
            <ScrollView
              horizontal
              pagingEnabled
              decelerationRate="fast"
              snapToInterval={announcementCardWidth + 12}
              snapToAlignment="start"
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.announcementRail}
              onMomentumScrollEnd={(event) => {
                const x = Number(event.nativeEvent.contentOffset?.x || 0)
                const nextIndex = Math.round(x / (announcementCardWidth + 12))
                setAnnouncementIndex(Math.max(0, Math.min(announcements.length - 1, nextIndex)))
              }}
            >
              {announcements.map((item, index) => renderAnnouncementCard(item, index))}
            </ScrollView>
            {announcements.length > 1 ? (
              <View style={styles.carouselDots}>
                {announcements.map((item, index) => (
                  <View key={String(item.id || index)} style={[styles.carouselDot, index === announcementIndex ? styles.carouselDotActive : null]} />
                ))}
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.announcementPlaceholder}>
            <View style={styles.announcementIconWrap}>
              <Ionicons name="megaphone-outline" size={moderateScale(18)} color="#D97706" />
            </View>
            <View style={styles.announcementTextWrap}>
              <Text style={styles.announcementTitle}>公司公告暂未发布</Text>
              <Text style={styles.announcementSummary}>发布后会显示在这里，支持横向轮播查看不同公告。</Text>
            </View>
          </View>
        )}
      </View>
    )
  }

  function renderGuideRail() {
    return (
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>工作指南</Text>
        </View>
        {featuredGuides.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.guideRail}>
            {featuredGuides.map((guide) => {
              const title = String(guide.title || '工作指南')
              const body = companyContentBody(guide.content)
              const summary = companyContentSummary(guide.content, '点击查看工作指南')
              return (
                <Pressable
                  key={String(guide.id || title)}
                  onPress={() =>
                    props.navigation.navigate('InfoCenterDetail', {
                      kind: 'guide',
                      title,
                      subtitle: guide.updated_at ? `更新于 ${formatTime(String(guide.updated_at)).replace('/', '-').replace('/', '-')}` : '工作指南',
                      body,
                    })
                  }
                  style={({ pressed }) => [styles.guideCard, pressed ? styles.rowPressed : null]}
                >
                  <View style={styles.guideTop}>
                    <View style={styles.guideIconWrap}>
                      <Ionicons name="book-outline" size={moderateScale(18)} color="#2563EB" />
                    </View>
                    <Ionicons name="chevron-forward" size={moderateScale(14)} color="#9CA3AF" />
                  </View>
                  <Text style={styles.guideTitle} numberOfLines={2}>
                    {title}
                  </Text>
                  <Text style={styles.guideSummary} numberOfLines={3}>
                    {summary}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>
        ) : (
          <View style={styles.guidePlaceholder}>
            <View style={styles.guidePlaceholderIcon}>
              <Ionicons name="book-outline" size={moderateScale(18)} color="#2563EB" />
            </View>
            <View style={styles.guidePlaceholderText}>
              <Text style={styles.guidePlaceholderTitle}>工作指南暂未发布</Text>
              <Text style={styles.guidePlaceholderSummary}>发布后会显示在这里，方便快速查看。</Text>
            </View>
          </View>
        )}
      </View>
    )
  }

  const hasQuery = !!query.trim()
  const hasAnySearchMatches = searchSections.some(section => section.items.length > 0)

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.topBar}>
        <Text style={styles.pageTitle}>工作中心</Text>
        <Pressable
          onPress={() => setShowUnreadOnly(v => !v)}
          style={({ pressed }) => [styles.bellBtn, pressed ? styles.rowPressed : null]}
          accessibilityRole="button"
          accessibilityLabel="toggle-unread"
        >
          <Ionicons name="notifications-outline" size={moderateScale(20)} color="#111827" />
          {hasAnyUnread ? <View style={styles.bellDot} /> : null}
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={moderateScale(18)} color="#9CA3AF" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          style={styles.searchInput}
          placeholder="输入关键词搜索历史任务、仓库指南、工作指南、公告、房源信息..."
          placeholderTextColor="#9CA3AF"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      {hasQuery ? (
        <View style={styles.searchSection}>
          <Text style={styles.sectionLabel}>搜索结果</Text>
          <ScrollView
            style={styles.searchScroll}
            contentContainerStyle={styles.searchResultsWrap}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            {searchSections.map(renderSearchSection)}
            {!hasAnySearchMatches ? <Text style={styles.emptyText}>暂无匹配内容，可试试房号、地址、Wi-Fi、公告标题或指南关键词。</Text> : null}
          </ScrollView>
        </View>
      ) : (
        <>
          {renderAnnouncementRail()}
          {renderGuideRail()}

          <View style={styles.noticeSectionHead}>
            <Text style={styles.sectionTitle}>通知消息</Text>
            <View style={styles.filterMiniWrap}>
              <Pressable
                onPress={() => setShowUnreadOnly(false)}
                style={({ pressed }) => [styles.filterMiniChip, !showUnreadOnly ? styles.filterMiniChipActive : null, pressed ? styles.rowPressed : null]}
              >
                <Text style={[styles.filterMiniText, !showUnreadOnly ? styles.filterMiniTextActive : null]}>{t('notices_all')}</Text>
              </Pressable>
              <Pressable
                onPress={() => setShowUnreadOnly(true)}
                style={({ pressed }) => [styles.filterMiniChip, showUnreadOnly ? styles.filterMiniChipActive : null, pressed ? styles.rowPressed : null]}
              >
                <Text style={[styles.filterMiniText, showUnreadOnly ? styles.filterMiniTextActive : null]}>{t('notices_unread')}</Text>
              </Pressable>
            </View>
          </View>

          {!hasInit && (
            <View style={styles.loadingWrap}>
              <ActivityIndicator />
              <Text style={styles.loadingText}>{t('common_loading')}</Text>
            </View>
          )}

          <FlatList
            data={items}
            keyExtractor={it => it.id}
            renderItem={renderNoticeItem}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            onEndReachedThreshold={0.2}
            onEndReached={onLoadMore}
            ListEmptyComponent={!hasInit ? null : <Text style={styles.emptyText}>暂无通知消息。</Text>}
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.footer}>
                  <ActivityIndicator />
                  <Text style={styles.footerText}>{t('common_loading')}</Text>
                </View>
              ) : null
            }
          />
        </>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F6F7FB' },
  topBar: { paddingHorizontal: 16, paddingTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pageTitle: { fontSize: moderateScale(22), fontWeight: '900', color: '#111827' },
  bellBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  bellDot: { position: 'absolute', right: 10, top: 10, width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#EF4444' },

  searchWrap: {
    marginTop: 12,
    marginHorizontal: 16,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: hairline(),
    borderColor: '#EEF0F6',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: { flex: 1, minWidth: 0, height: 40, color: '#111827', fontWeight: '700', fontSize: 14 },

  sectionBlock: { paddingHorizontal: 16, paddingTop: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { color: '#111827', fontWeight: '900', fontSize: 15 },
  sectionMeta: { color: '#9CA3AF', fontSize: 12, fontWeight: '700' },

  announcementCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: hairline(),
    borderColor: '#EEF0F6',
    padding: 14,
  },
  announcementHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  announcementBadgeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 },
  announcementIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: hairline(),
    borderColor: '#FCD34D',
  },
  announcementTextWrap: { flex: 1, minWidth: 0 },
  announcementTitle: { color: '#111827', fontSize: 15, fontWeight: '900' },
  announcementMeta: { marginTop: 4, color: '#9CA3AF', fontSize: 12, fontWeight: '700' },
  announcementSummary: { marginTop: 10, color: '#374151', fontSize: 13, lineHeight: 19, fontWeight: '600' },
  announcementRail: { paddingRight: 16, gap: 12 },
  announcementPlaceholder: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: hairline(),
    borderColor: '#EEF0F6',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  carouselDots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10 },
  carouselDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#D1D5DB' },
  carouselDotActive: { width: 18, backgroundColor: '#2563EB' },

  guideRail: { paddingRight: 16, gap: 10 },
  guideCard: {
    width: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: hairline(),
    borderColor: '#EEF0F6',
    padding: 14,
  },
  guideTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  guideIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DBEAFE',
    borderWidth: hairline(),
    borderColor: '#BFDBFE',
  },
  guideTitle: { marginTop: 12, color: '#111827', fontSize: 14, fontWeight: '900' },
  guideSummary: { marginTop: 8, color: '#6B7280', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  guidePlaceholder: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: hairline(),
    borderColor: '#EEF0F6',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  guidePlaceholderIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DBEAFE',
    borderWidth: hairline(),
    borderColor: '#BFDBFE',
  },
  guidePlaceholderText: { flex: 1, minWidth: 0 },
  guidePlaceholderTitle: { color: '#111827', fontSize: 14, fontWeight: '900' },
  guidePlaceholderSummary: { marginTop: 6, color: '#6B7280', fontSize: 12, lineHeight: 18, fontWeight: '700' },

  sectionLabel: { paddingHorizontal: 16, paddingTop: 10, color: '#9CA3AF', fontWeight: '900', fontSize: 12 },
  noticeSectionHead: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  filterMiniWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: hairline(),
    borderColor: '#EEF0F6',
    padding: 3,
  },
  filterMiniChip: {
    minWidth: 52,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  filterMiniChipActive: { backgroundColor: '#2563EB' },
  filterMiniText: { fontSize: 12, fontWeight: '800', color: '#6B7280' },
  filterMiniTextActive: { color: '#FFFFFF' },
  searchSection: { flex: 1 },
  searchScroll: { flex: 1 },
  searchResultsWrap: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20, gap: 10 },
  searchGroup: {
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: hairline(),
    borderColor: '#EEF0F6',
    padding: 12,
    gap: 8,
  },
  searchGroupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  searchGroupTitle: { color: '#111827', fontWeight: '900', fontSize: 14 },
  searchGroupMeta: { color: '#9CA3AF', fontWeight: '800', fontSize: 12 },
  searchResultRow: {
    minHeight: 64,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: hairline(),
    borderColor: '#EEF0F6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchResultIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: hairline(),
    borderColor: '#DBEAFE',
  },
  searchResultMain: { flex: 1, minWidth: 0 },
  searchResultTitle: { color: '#111827', fontWeight: '900', fontSize: 14 },
  searchResultSummary: { marginTop: 3, color: '#9CA3AF', fontWeight: '700', fontSize: 12, lineHeight: 17 },
  searchEmptyText: { paddingVertical: 8, color: '#94A3B8', fontWeight: '700', fontSize: 12, lineHeight: 18 },
  searchMoreBtn: {
    marginTop: 2,
    minHeight: 38,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: hairline(),
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  searchMoreBtnDisabled: { opacity: 0.7 },
  searchMoreBtnText: { color: '#2563EB', fontWeight: '900', fontSize: 13 },

  loadingWrap: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingText: { color: '#6B7280', fontWeight: '700' },

  listContent: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 10, flexGrow: 1 },
  sep: { height: 10 },
  rowPressed: { opacity: 0.92 },
  noticeRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: hairline(),
    borderColor: '#EEF0F6',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  noticeIconWrap: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: hairline() },
  noticeMain: { flex: 1, minWidth: 0 },
  noticeTitle: { color: '#111827', fontWeight: '900', fontSize: moderateScale(14) },
  noticeSummary: { marginTop: 3, color: '#9CA3AF', fontWeight: '700', fontSize: 12 },
  noticeRight: { alignItems: 'flex-end', justifyContent: 'space-between', height: 40 },
  noticeTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noticeTime: { color: '#9CA3AF', fontWeight: '700', fontSize: 12 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  noticeThumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#EEF0F6' },

  emptyText: { paddingHorizontal: 16, paddingVertical: 20, color: '#9CA3AF', fontWeight: '700', textAlign: 'center', lineHeight: 20 },
  footer: { paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  footerText: { color: '#6B7280', fontWeight: '700' },
})
