import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, AppState, Image, Linking, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { hairline, moderateScale } from '../../lib/scale'
import { reorderCleaningTasks, reorderWorkTasks } from '../../lib/api'
import { markGuestCheckedOutByOrder, markGuestCheckedOutByTasks } from '../../lib/api'
import { listMzappAlerts, markMzappAlertRead } from '../../lib/api'
import { getMyProfile } from '../../lib/api'
import { listDayEndHandover } from '../../lib/api'
import { listCleaningAppTasks } from '../../lib/api'
import { processDayEndHandoverQueue } from '../../lib/dayEndHandoverQueue'
import { processKeyUploadQueue } from '../../lib/keyUploadQueue'
import { getNoticesSnapshot, initNoticesStore, prependNotice } from '../../lib/noticesStore'
import { getProfile, setProfile, type Profile } from '../../lib/profileStore'
import { effectiveInspectionMode, inspectionModeLabel, isSelfCompleteMode, isStayoverTaskType } from '../../lib/cleaningInspection'
import { isTaskManagerUser } from '../../lib/roles'
import {
  activateWorkTasksRealtime,
  getWorkTasksSnapshot,
  initWorkTasksStore,
  makeWorkTasksBucketKey,
  patchWorkTaskItem,
  refreshWorkTasksFromServer,
  subscribeWorkTasks,
  type WorkTaskItem,
  type WorkTasksView,
} from '../../lib/workTasksStore'
import type { TasksStackParamList } from '../../navigation/RootNavigator'

type Period = 'today' | 'week' | 'month'

type Props = NativeStackScreenProps<TasksStackParamList, 'TasksList'>

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function parseYmd(value: string) {
  const [y, m, d] = value.split('-').map(v => Number(v))
  return new Date(y, (m || 1) - 1, d || 1)
}

function addDays(d: Date, days: number) {
  const nd = new Date(d)
  nd.setDate(nd.getDate() + days)
  return nd
}

function isBeforeToday(taskDate0: any) {
  const taskDate = String(taskDate0 || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(taskDate)) return false
  return taskDate < ymd(new Date())
}

function startOfWeekMonday(d: Date) {
  const nd = new Date(d)
  const day = nd.getDay()
  const diff = day === 0 ? -6 : 1 - day
  nd.setDate(nd.getDate() + diff)
  nd.setHours(0, 0, 0, 0)
  return nd
}

function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

function isManagerRoleName(roleName: string) {
  const r = String(roleName || '').trim()
  return r === 'admin' || r === 'offline_manager' || r === 'customer_service' || r === 'inventory_manager'
}

function isManagerRole(roleNames: string[]) {
  const rs = (roleNames || []).map((x) => String(x || '').trim()).filter(Boolean)
  return rs.some(isManagerRoleName)
}

function isCleanerRole(roleNames: string[]) {
  const rs = (roleNames || []).map((x) => String(x || '').trim()).filter(Boolean)
  return rs.includes('cleaner') || rs.includes('cleaner_inspector')
}

function isInspectorOnlyRole(roleNames: string[]) {
  const rs = (roleNames || []).map((x) => String(x || '').trim()).filter(Boolean)
  return rs.includes('cleaning_inspector') && !rs.includes('cleaner') && !rs.includes('cleaner_inspector')
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

function parseTimeMinutes(value: any) {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return null
  const s = raw.replace(/\s+/g, '')
  const m12 = s.match(/^(\d{1,2})(?::(\d{1,2}))?(am|pm)$/)
  if (m12) {
    let hour = Number(m12[1] || 0)
    const minute = Number(m12[2] || 0)
    if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute < 0 || minute > 59) return null
    hour = hour % 12
    if (m12[3] === 'pm') hour += 12
    return hour * 60 + minute
  }
  const m24 = s.match(/^(\d{1,2})(?::(\d{1,2}))?$/)
  if (m24) {
    const hour = Number(m24[1] || 0)
    const minute = Number(m24[2] || 0)
    if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
    return hour * 60 + minute
  }
  return null
}

function isEarlyCheckinTime(value: any) {
  const mins = parseTimeMinutes(value)
  return mins != null && mins < 15 * 60
}

function isLateCheckoutTime(value: any) {
  const mins = parseTimeMinutes(value)
  return mins != null && mins > 10 * 60
}

function buildDayEndOverviewBaseUsers(tasks: WorkTaskItem[]) {
  const map = new Map<string, { userId: string; userName: string; roles: Set<string>; roomCodes: Set<string> }>()
  for (const task of tasks || []) {
    if (task.source_type !== 'cleaning_tasks') continue
    const kind = String(task.task_kind || '').trim().toLowerCase()
    const st = String(task.status || '').trim().toLowerCase()
    if (st === 'cancelled' || st === 'canceled') continue
    const code = String(task.property?.code || '').trim()
    if (kind === 'cleaning') {
      const userId = String((task as any).cleaner_id || task.assignee_id || '').trim()
      if (userId) {
        const entry = map.get(userId) || { userId, userName: String((task as any).cleaner_name || '').trim(), roles: new Set<string>(), roomCodes: new Set<string>() }
        entry.roles.add('cleaning')
        if (!entry.userName) entry.userName = String((task as any).cleaner_name || '').trim()
        if (code) entry.roomCodes.add(code)
        map.set(userId, entry)
      }
    }
    if (kind === 'inspection') {
      const userId = String((task as any).inspector_id || '').trim()
      if (userId) {
        const entry = map.get(userId) || { userId, userName: String((task as any).inspector_name || '').trim(), roles: new Set<string>(), roomCodes: new Set<string>() }
        entry.roles.add('inspection')
        if (!entry.userName) entry.userName = String((task as any).inspector_name || '').trim()
        if (code) entry.roomCodes.add(code)
        map.set(userId, entry)
      }
    }
  }
  return Array.from(map.values())
    .map((entry) => ({
      userId: entry.userId,
      userName: entry.userName || entry.userId,
      roles: Array.from(entry.roles.values()).sort(),
      roomCodes: Array.from(entry.roomCodes.values()).sort((a, b) => a.localeCompare(b, 'en')),
      complete: null,
    }))
    .sort((a, b) => a.userName.localeCompare(b.userName, 'en'))
}

function buildDayEndOverviewBaseUsersFromCleaningTasks(tasks: Array<any>) {
  const map = new Map<string, { userId: string; userName: string; roles: Set<string>; roomCodes: Set<string> }>()
  for (const task of tasks || []) {
    const status = String(task?.status || '').trim().toLowerCase()
    if (status === 'cancelled' || status === 'canceled') continue
    const code = String(task?.property?.code || '').trim()
    const cleanerId = String(task?.cleaner_id || task?.assignee_id || '').trim()
    const inspectorId = String(task?.inspector_id || '').trim()
    if (cleanerId) {
      const entry = map.get(cleanerId) || { userId: cleanerId, userName: String(task?.cleaner_name || '').trim(), roles: new Set<string>(), roomCodes: new Set<string>() }
      entry.roles.add('cleaning')
      if (!entry.userName) entry.userName = String(task?.cleaner_name || '').trim()
      if (code) entry.roomCodes.add(code)
      map.set(cleanerId, entry)
    }
    if (inspectorId) {
      const entry = map.get(inspectorId) || { userId: inspectorId, userName: String(task?.inspector_name || '').trim(), roles: new Set<string>(), roomCodes: new Set<string>() }
      entry.roles.add('inspection')
      if (!entry.userName) entry.userName = String(task?.inspector_name || '').trim()
      if (code) entry.roomCodes.add(code)
      map.set(inspectorId, entry)
    }
  }
  return Array.from(map.values()).map((entry) => ({
    userId: entry.userId,
    userName: entry.userName || entry.userId,
    roles: Array.from(entry.roles.values()).sort(),
    roomCodes: Array.from(entry.roomCodes.values()).sort((a, b) => a.localeCompare(b, 'en')),
    complete: false,
  })).sort((a, b) => a.userName.localeCompare(b.userName, 'en'))
}

function isCleaningWorkSubmitted(status0: any) {
  const s = String(status0 || '').trim().toLowerCase()
  return ['cleaned', 'restock_pending', 'restocked', 'to_inspect', 'to_hang_keys', 'keys_hung', 'done', 'completed', 'ready'].includes(s)
}

function urgencyRank(u: string) {
  const s = String(u || '').trim().toLowerCase()
  if (s === 'urgent') return 3
  if (s === 'high') return 2
  if (s === 'medium') return 1
  return 0
}

function urgencyMeta(value: any) {
  const s = String(value || '').trim().toLowerCase()
  if (!s) return null
  if (s === 'urgent') return { text: '紧急', pill: styles.urgencyUrgent, textStyle: styles.urgencyUrgentText }
  if (s === 'high') return { text: '高优先', pill: styles.urgencyHigh, textStyle: styles.urgencyHighText }
  if (s === 'medium') return null
  return { text: '低优先', pill: styles.urgencyLow, textStyle: styles.urgencyLowText }
}

function taskSortIndexValue(task: WorkTaskItem) {
  const raw = (task as any).sort_index
  if (raw == null) return Number.POSITIVE_INFINITY
  const n = Number(raw)
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY
}

function statusLabel(status: string) {
  const s = String(status || '').trim().toLowerCase()
  if (s === 'done' || s === 'completed') return { text: '已完成', pill: styles.statusGreen, textStyle: styles.statusTextGreen }
  if (s === 'to_inspect') return { text: '待检查', pill: styles.statusAmber, textStyle: styles.statusTextAmber }
  if (s === 'to_hang_keys') return { text: '待挂钥匙', pill: styles.statusAmber, textStyle: styles.statusTextAmber }
  if (s === 'to_complete') return { text: '待完成', pill: styles.statusAmber, textStyle: styles.statusTextAmber }
  if (s === 'keys_hung') return { text: '已挂钥匙', pill: styles.statusGreen, textStyle: styles.statusTextGreen }
  if (s === 'in_progress') return { text: '进行中', pill: styles.statusBlue, textStyle: styles.statusTextBlue }
  if (s === 'assigned') return { text: '已分配', pill: styles.statusBlue, textStyle: styles.statusTextBlue }
  if (s === 'cancelled' || s === 'canceled') return { text: '已取消', pill: styles.statusGray, textStyle: styles.statusTextGray }
  return { text: '待处理', pill: styles.statusAmber, textStyle: styles.statusTextAmber }
}

function statusLabelForTask(task: WorkTaskItem, roleNames: string[]) {
  const s = String(task.status || '').trim().toLowerCase()
  const meta = statusLabel(s)
  const source = String(task.source_type || '').trim().toLowerCase()
  const kind = String(task.task_kind || '').trim().toLowerCase()
  if (source === 'cleaning_tasks' && kind === 'inspection') {
    return meta
  }
  if (source === 'cleaning_tasks' && kind === 'cleaning') {
    const isCleanerView = isCleanerRole(roleNames)
    const inspectionStatus = String((task as any).inspection_status || '').trim().toLowerCase()
    const hasInspection = Array.isArray((task as any).inspection_task_ids) ? (task as any).inspection_task_ids.length > 0 : false
    const inspectionMode = effectiveInspectionMode(task as any)
    if (isDoneLikeStatus(s)) {
      if (isCleanerView) return { text: '已完成', pill: styles.statusGreen, textStyle: styles.statusTextGreen }
      if (inspectionMode === 'same_day' || inspectionMode === 'deferred' || hasInspection || inspectionStatus) {
        if (inspectionStatus === 'keys_hung' || inspectionStatus === 'done' || inspectionStatus === 'completed') {
          return { text: '已挂钥匙', pill: styles.statusGreen, textStyle: styles.statusTextGreen }
        }
        return { text: '待检查', pill: styles.statusAmber, textStyle: styles.statusTextAmber }
      }
      return { text: '已完成', pill: styles.statusGreen, textStyle: styles.statusTextGreen }
    }
    const checkedOutAt = String((task as any).checked_out_at || '').trim()
    if (s === 'in_progress' || s === 'cleaning') return { text: '进行中', pill: styles.statusBlue, textStyle: styles.statusTextBlue }
    if (s !== 'cancelled' && s !== 'canceled') {
      if (checkedOutAt) return { text: '已退房', pill: styles.statusPurple, textStyle: styles.statusTextPurple }
      return { text: '已分配', pill: styles.statusBlue, textStyle: styles.statusTextBlue }
    }
    return meta
  }
  return meta
}

function isDoneLikeStatus(status0: string) {
  const s = String(status0 || '').trim().toLowerCase()
  return s === 'done' || s === 'completed' || s === 'ready' || s === 'keys_hung' || s === 'cleaned' || s === 'restocked' || s === 'inspected'
}

function taskKindLabel(kind: string) {
  const s = String(kind || '').trim().toLowerCase()
  if (s === 'cleaning') return '清洁'
  if (s === 'inspection') return '检查'
  if (s === 'maintenance') return '维修'
  if (s === 'deep_cleaning') return '深清'
  if (s === 'offline') return '线下'
  if (s) return s
  return '任务'
}

function normalizeHttpUrl(raw: string | null | undefined) {
  const s0 = String(raw || '').trim()
  if (!s0) return null
  const mHref = s0.match(/href\s*=\s*["']([^"']+)["']/i)
  const s = (mHref?.[1] || s0).trim()
  const mHttp = s.match(/https?:\/\/[^\s"'<>]+/i)
  const u = (mHttp?.[0] || s).trim()
  if (!u) return null
  if (/^https?:\/\//i.test(u)) return u
  return `https://${u}`
}

function stripPhotoLines(text: any) {
  const s = String(text || '').trim()
  if (!s) return ''
  const lines = s
    .split('\n')
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .filter((x) => !/^照片\s*\d*\s*:/i.test(x))
  return lines.join('\n').trim()
}

function initialsOf(name: string) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/g)
    .filter(Boolean)
  const a = (parts[0] || '?')[0] || '?'
  const b = parts.length > 1 ? (parts[parts.length - 1] || '')[0] || '' : ''
  return `${a}${b}`.toUpperCase()
}

export default function TasksScreen(props: Props) {
  const { user, token } = useAuth()
  const { locale, t } = useI18n()
  const { width: windowWidth } = useWindowDimensions()
  const roleNames = useMemo(() => {
    const arr = Array.isArray((user as any)?.roles) ? ((user as any).roles as any[]) : []
    const ids = arr.map((x) => String(x || '').trim()).filter(Boolean)
    const primary = String((user as any)?.role || '').trim()
    if (primary) ids.unshift(primary)
    return Array.from(new Set(ids))
  }, [user])
  const canManagerMode = useMemo(() => isManagerRole(roleNames), [roleNames])
  const canTaskManagerView = useMemo(() => isTaskManagerUser(user), [user])
  const canSwitchMode = useMemo(() => {
    if (!canManagerMode) return false
    return roleNames.some((r) => !isManagerRoleName(r))
  }, [canManagerMode, roleNames])
  const [mode, setMode] = useState<'cleaning' | 'manager'>('cleaning')
  const [period, setPeriod] = useState<Period>('today')
  const [selectedDate, setSelectedDate] = useState<string>(() => ymd(new Date()))
  const [hasInit, setHasInit] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [view, setView] = useState<WorkTasksView>('mine')
  const [reorderMode, setReorderMode] = useState(false)
  const [orderMarks, setOrderMarks] = useState<Record<string, string>>({})
  const [orderList, setOrderList] = useState<string[]>([])
  const [savingOrder, setSavingOrder] = useState(false)
  const [, bump] = useState(0)
  const notifiedInspectionsRef = useRef<Record<string, boolean>>({})
  const [banner, setBanner] = useState<{ title: string; message: string } | null>(null)
  const [dayEndComplete, setDayEndComplete] = useState<boolean | null>(null)
  const [dayEndOverviewUsers, setDayEndOverviewUsers] = useState<Array<{ userId: string; userName: string; roles: string[]; roomCodes: string[]; complete: boolean | null }>>([])
  const bannerTimerRef = useRef<any>(null)
  const [search, setSearch] = useState('')
  const weekRowRef = useRef<ScrollView>(null)
  const weekPagerRef = useRef<ScrollView>(null)
  const weekPagerAdjustingRef = useRef(false)
  const lastAlertsFetchRef = useRef(0)
  const shownAlertIdsRef = useRef<Record<string, boolean>>({})
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [taskNoticeArmed, setTaskNoticeArmed] = useState(false)
  const [checkedOutPendingMap, setCheckedOutPendingMap] = useState<Record<string, boolean>>({})
  const allowDerivedTaskNotices = String(token || '').startsWith('local:')

  function seedTaskNoticeBaseline(list: WorkTaskItem[]) {
    const next = { ...notifiedInspectionsRef.current }
    const isInspector = roleNames.includes('cleaning_inspector') || roleNames.includes('cleaner_inspector')
    if (isInspector && period === 'today') {
      for (const t of list) {
        if (t.source_type === 'cleaning_tasks' && t.task_kind === 'inspection' && String(t.status || '').toLowerCase() === 'to_inspect') next[t.id] = true
      }
    }
    const role = String(user?.role || '')
    if (role === 'cleaning_inspector' || role === 'cleaner_inspector') {
      for (const t of list) {
        if (
          t.source_type === 'cleaning_tasks' &&
          t.task_kind === 'inspection' &&
          String(t.status || '').toLowerCase() === 'in_progress' &&
          !!String((t as any).key_photo_url || '').trim()
        ) {
          next[`key:${t.id}`] = true
        }
      }
    }
    if ((role === 'cleaner' || role === 'cleaner_inspector') && period === 'today') {
      for (const t of list) {
        if (!(t.source_type === 'cleaning_tasks' && t.task_kind === 'cleaning')) continue
        const raw = String((t as any).checked_out_at || '').trim()
        const ms = Date.parse(raw)
        if (raw && Number.isFinite(ms) && Date.now() - ms < 6 * 60 * 60 * 1000) next[`co:${t.id}`] = true
      }
    }
    if (canManagerMode && mode === 'manager' && period === 'today') {
      for (const t of list) {
        if (t.source_type === 'cleaning_tasks' && t.task_kind === 'inspection' && String(t.status || '').toLowerCase() === 'keys_hung') {
          next[`hung:${t.id}`] = true
        }
      }
    }
    notifiedInspectionsRef.current = next
  }

  const greetingName = useMemo(() => {
    const raw = String(user?.username || '').trim()
    if (!raw) return 'User'
    return raw.includes('@') ? raw.split('@')[0] || raw : raw
  }, [user?.username])

  useEffect(() => {
    let alive = true
    const refresh = async () => {
      const saved = await getProfile(user)
      if (!alive) return
      setAvatarUrl(saved?.avatar_url || null)
      if (!token) return
      try {
        const remote = await getMyProfile(token)
        if (!alive) return
        const nextAvatar = String(remote.avatar_url || '').trim() || null
        setAvatarUrl(nextAvatar)
        const merged: Profile = {
          avatar_url: nextAvatar,
          display_name: String(remote.display_name || remote.username || saved?.display_name || user?.username || ''),
          phone_au: String(remote.phone_au || saved?.phone_au || ''),
          legal_name: String(remote.legal_name || saved?.legal_name || ''),
          bank_account_name: String(remote.bank_account_name || saved?.bank_account_name || ''),
          bank_bsb: String(remote.bank_bsb || saved?.bank_bsb || ''),
          bank_account_number: String(remote.bank_account_number || saved?.bank_account_number || ''),
          personal_abn: String(remote.personal_abn || saved?.personal_abn || ''),
          photo_id_url: remote.photo_id_url || saved?.photo_id_url || null,
        }
        await setProfile(user, merged)
      } catch {}
    }
    const nav: any = props.navigation as any
    const unsub = nav && typeof nav.addListener === 'function' ? nav.addListener('focus', refresh) : null
    refresh()
    return () => {
      alive = false
      try {
        if (typeof unsub === 'function') unsub()
      } catch {}
    }
  }, [props.navigation, token, user?.id, user?.username])

  const headerInitials = useMemo(() => initialsOf(greetingName), [greetingName])

  useEffect(() => {
    if (period === 'today') setSelectedDate(ymd(new Date()))
  }, [period])

  useEffect(() => {
    const unsub = subscribeWorkTasks(() => bump(v => v + 1))
    return () => {
      unsub()
    }
  }, [])

  useEffect(() => {
    if (!user?.id) return
    if (!canManagerMode) {
      setMode('cleaning')
      setView('mine')
      return
    }
    if (!canSwitchMode) {
      setMode('manager')
      setView('all')
      return
    }
    ;(async () => {
      try {
        const saved = String((await AsyncStorage.getItem('tasks_mode')) || '').trim()
        setMode(saved === 'manager' ? 'manager' : 'cleaning')
      } catch {
        setMode('cleaning')
      }
    })()
  }, [user?.id])

  useEffect(() => {
    if (!canManagerMode) {
      if (mode !== 'cleaning') setMode('cleaning')
      if (view !== 'mine') setView('mine')
      return
    }
    if (!canSwitchMode) {
      if (mode !== 'manager') setMode('manager')
      if (view !== 'all') setView('all')
      return
    }
    if (mode === 'cleaning' && view !== 'mine') setView('mine')
    if (mode === 'manager' && view !== 'all' && view !== 'mine') setView('all')
  }, [canManagerMode, canSwitchMode, mode, view])

  useEffect(() => {
    if (!canSwitchMode) return
    ;(async () => {
      try {
        await AsyncStorage.setItem('tasks_mode', mode)
      } catch {}
    })()
  }, [canSwitchMode, mode])

  const selected = useMemo(() => {
    const raw = String(selectedDate || '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date()
    const d = parseYmd(raw)
    return Number.isFinite(d.getTime()) ? d : new Date()
  }, [selectedDate])

  const range = useMemo(() => {
    if (period === 'month') {
      const base = selected
      const start = new Date(base.getFullYear(), base.getMonth(), 1)
      const end = new Date(base.getFullYear(), base.getMonth(), daysInMonth(start))
      return { date_from: ymd(start), date_to: ymd(end) }
    }
    const base = period === 'today' ? new Date() : selected
    const start = startOfWeekMonday(base)
    const end = addDays(start, 6)
    return { date_from: ymd(start), date_to: ymd(end) }
  }, [period, selected])

  const effectiveView = useMemo<WorkTasksView>(() => {
    return canManagerMode && mode === 'manager' ? view : 'mine'
  }, [canManagerMode, mode, view])

  const refreshTasksData = useCallback(async (opts?: { silent?: boolean; preserveError?: boolean }) => {
    if (!user?.id || !token) return
    const silent = opts?.silent === true
    const preserveError = opts?.preserveError === true
    if (!silent) setRefreshing(true)
    try {
      await Promise.all([processKeyUploadQueue(token), processDayEndHandoverQueue(token)])
      await refreshWorkTasksFromServer({ token, userId: user.id, date_from: range.date_from, date_to: range.date_to, view: effectiveView })
      await activateWorkTasksRealtime({ token, userId: user.id, date_from: range.date_from, date_to: range.date_to, view: effectiveView })
      await maybeFetchSlaAlerts()
      seedTaskNoticeBaseline(getWorkTasksSnapshot().items || [])
      setTaskNoticeArmed(true)
      setLoadError(null)
    } catch (e: any) {
      if (!preserveError) setLoadError(String(e?.message || '加载失败'))
      throw e
    } finally {
      if (!silent) setRefreshing(false)
    }
  }, [effectiveView, range.date_from, range.date_to, token, user?.id])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!user?.id || !token) return
      setTaskNoticeArmed(false)
      await initNoticesStore().catch(() => null)
      const bucketKey = makeWorkTasksBucketKey({ userId: user.id, date_from: range.date_from, date_to: range.date_to, view: effectiveView })
      await initWorkTasksStore({ bucketKey })
      if (cancelled) return
      setHasInit(true)
      setLoadError(null)
      try {
        await refreshTasksData({ silent: true })
      } catch (e: any) {
        if (!cancelled) setLoadError(String(e?.message || '加载失败'))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [effectiveView, range.date_from, range.date_to, refreshTasksData, token, user?.id])

  useEffect(() => {
    if (!token || !user?.id) return
    const nav: any = props.navigation as any
    const onFocus = async () => {
      try {
        await refreshTasksData({ silent: true, preserveError: true })
      } catch {}
    }
    const unsub = nav && typeof nav.addListener === 'function' ? nav.addListener('focus', onFocus) : null
    return () => {
      try {
        if (typeof unsub === 'function') unsub()
      } catch {}
    }
  }, [props.navigation, refreshTasksData, token, user?.id])

  useEffect(() => {
    if (!token || !user?.id) return
    let cancelled = false
    const onAppActive = async () => {
      if (cancelled) return
      try {
        await refreshTasksData({ silent: true, preserveError: true })
      } catch {}
    }
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return
      void onAppActive()
    })
    return () => {
      cancelled = true
      try {
        sub.remove()
      } catch {}
    }
  }, [refreshTasksData, token, user?.id])

  const items = getWorkTasksSnapshot().items
  const tasksByDate = useMemo(() => {
    const map = new Map<string, WorkTaskItem[]>()
    for (const task of items) {
      const list = map.get(task.date) || []
      list.push(task)
      map.set(task.date, list)
    }
    return map
  }, [items])

  function findWorkTaskForCleaningIds(cleaningIds: any[]) {
    const ids = (cleaningIds || []).map((x: any) => String(x || '').trim()).filter(Boolean)
    if (!ids.length) return null
    const all = getWorkTasksSnapshot().items || []
    for (const task of all) {
      if (task.source_type !== 'cleaning_tasks') continue
      const srcIds = Array.isArray((task as any).source_ids) ? ((task as any).source_ids as any[]).map(x => String(x)) : []
      const srcId = String(task.source_id || '')
      for (const id of ids) {
        if (srcId === id || srcIds.includes(id)) return task
      }
    }
    return null
  }

  async function maybeFetchSlaAlerts() {
    if (!token) return
    const role = String(user?.role || '')
    const isCleaner = role === 'cleaner' || role === 'cleaner_inspector'
    const interval = isCleaner ? 120000 : 300000
    const now = Date.now()
    if (now - lastAlertsFetchRef.current < interval) return
    lastAlertsFetchRef.current = now
    let alerts: any[] = []
    try {
      alerts = await listMzappAlerts(token, { unread: true, kind: 'key_upload_sla', limit: 50 })
    } catch {
      return
    }
    const next = alerts.find(a => a && a.id && !shownAlertIdsRef.current[String(a.id)])
    if (!next) return
    const id = String(next.id)
    shownAlertIdsRef.current[id] = true
    try { await markMzappAlertRead(token, id) } catch {}
    const payload = (next as any).payload || {}
    const level = String((next as any).level || payload.level || '')
    const position = Number(payload.position || (next as any).position || 0)
    const code = String(payload.property_code || '').trim()
    const addr = String(payload.property_address || '').trim()
    const phone = payload.cleaner_phone_au == null ? null : String(payload.cleaner_phone_au || '').trim()
    const cleaningIds = Array.isArray(payload.cleaning_task_ids) ? payload.cleaning_task_ids : []
    const workTask = findWorkTaskForCleaningIds(cleaningIds)
    const title = level === 'escalate' ? '钥匙未上传（超时）' : '请上传钥匙照片'
    const lines = [position ? `第 ${position} 个房间` : '', code ? `房源：${code}` : '', addr ? addr : ''].filter(Boolean)
    const msg = lines.join('\n')
    if (level === 'escalate') {
      Alert.alert(
        title,
        msg,
        [
          {
            text: '打电话',
            onPress: async () => {
              if (!phone) {
                Alert.alert(t('common_error'), '清洁手机号缺失')
                return
              }
              const url = `tel:${phone.replace(/\s+/g, '')}`
              try {
                const ok = await Linking.canOpenURL(url)
                if (!ok) throw new Error('not supported')
                await Linking.openURL(url)
              } catch {
                Alert.alert(t('common_error'), `无法拨打：${phone}`)
              }
            },
          },
          {
            text: '查看任务',
            onPress: () => {
              if (!workTask) return
              if (canTaskManagerView && workTask.source_type === 'cleaning_tasks') {
                props.navigation.navigate('ManagerDailyTask', { taskId: workTask.id })
                return
              }
              props.navigation.navigate('TaskDetail', { id: workTask.id })
            },
          },
          { text: t('common_cancel') },
        ],
        { cancelable: true },
      )
      return
    }
    Alert.alert(
      title,
      msg,
      [
        {
          text: '去上传',
          onPress: () => {
            if (!workTask) return
            if (canTaskManagerView && workTask.source_type === 'cleaning_tasks') {
              props.navigation.navigate('ManagerDailyTask', { taskId: workTask.id })
              return
            }
            props.navigation.navigate('TaskDetail', { id: workTask.id, action: 'upload_key' })
          },
        },
        { text: t('common_cancel') },
      ],
      { cancelable: true },
    )
  }

  const weekDays = useMemo(() => {
    const base = period === 'today' ? new Date() : selected
    const start = startOfWeekMonday(base)
    const labelsZh = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
    const labelsEn = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    return Array.from({ length: 7 }).map((_, idx) => {
      const date = addDays(start, idx)
      const key = ymd(date)
      const hasTask = (tasksByDate.get(key) || []).length > 0
      const isSelected = key === selectedDate
      const dow = locale === 'en' ? labelsEn[idx] : labelsZh[idx]
      return { key, dow, day: date.getDate(), hasTask, isSelected }
    })
  }, [locale, period, selected, selectedDate, tasksByDate])

  useEffect(() => {
    if (period !== 'today') return
    const d = parseYmd(selectedDate)
    const dow = d.getDay()
    const isWeekend = dow === 0 || dow === 6
    const id = setTimeout(() => {
      if (isWeekend) weekRowRef.current?.scrollToEnd({ animated: false })
      else weekRowRef.current?.scrollTo({ x: 0, y: 0, animated: false })
    }, 0)
    return () => clearTimeout(id)
  }, [period, selectedDate])

  const weekPagerWidth = useMemo(() => Math.max(1, Number(windowWidth || 0) - 32), [windowWidth])
  const weekPagerCenterIndex = 2

  const weekPagerPages = useMemo(() => {
    if (period !== 'week') return []
    const base = selected
    const start = startOfWeekMonday(base)
    const labelsZh = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
    const labelsEn = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const labels = locale === 'en' ? labelsEn : labelsZh
    return Array.from({ length: 5 }).map((_, pageIdx) => {
      const weekStart = addDays(start, (pageIdx - weekPagerCenterIndex) * 7)
      const days = Array.from({ length: 7 }).map((__, idx) => {
        const date = addDays(weekStart, idx)
        const key = ymd(date)
        const hasTask = (tasksByDate.get(key) || []).length > 0
        const isSelected = key === selectedDate
        return { key, dow: labels[idx], day: date.getDate(), hasTask, isSelected }
      })
      return { key: ymd(weekStart), days }
    })
  }, [locale, period, selected, selectedDate, tasksByDate])

  useEffect(() => {
    if (period !== 'week') return
    const id = setTimeout(() => {
      weekPagerAdjustingRef.current = true
      weekPagerRef.current?.scrollTo({ x: weekPagerWidth * weekPagerCenterIndex, y: 0, animated: false })
      setTimeout(() => {
        weekPagerAdjustingRef.current = false
      }, 0)
    }, 0)
    return () => clearTimeout(id)
  }, [period, selectedDate, weekPagerWidth])

  const onWeekPagerMomentumEnd = (e: any) => {
    if (period !== 'week') return
    if (weekPagerAdjustingRef.current) return
    const x = Number(e?.nativeEvent?.contentOffset?.x || 0)
    const idx = Math.round(x / weekPagerWidth)
    const delta = idx - weekPagerCenterIndex
    if (!delta) return
    const next = addDays(selected, delta * 7)
    setSelectedDate(ymd(next))
  }

  const monthGrid = useMemo(() => {
    const base = selected
    const monthStart = new Date(base.getFullYear(), base.getMonth(), 1)
    const start = startOfWeekMonday(monthStart)
    const total = 42
    const month = monthStart.getMonth()
    const days = daysInMonth(monthStart)
    const labelsZh = ['一', '二', '三', '四', '五', '六', '日']
    const labelsEn = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
    const header = locale === 'en' ? labelsEn : labelsZh
    const cells = Array.from({ length: total }).map((_, idx) => {
      const date = addDays(start, idx)
      const inMonth = date.getMonth() === month && date.getDate() >= 1 && date.getDate() <= days
      const key = ymd(date)
      const hasTask = (tasksByDate.get(key) || []).length > 0
      const isSelected = key === selectedDate
      return { key, date, day: date.getDate(), inMonth, hasTask, isSelected }
    })
    return { header, cells }
  }, [locale, selected, selectedDate, tasksByDate])

  const monthTitle = useMemo(() => {
    const y = selected.getFullYear()
    const m = selected.getMonth()
    const m2 = m + 1
    if (locale === 'en') {
      const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      return `${names[m] || m2} ${y}`
    }
    return `${y}年${m2}月`
  }, [locale, selected])

  const gotoPrevMonth = () => {
    const d = new Date(selected.getFullYear(), selected.getMonth() - 1, 1)
    setSelectedDate(ymd(d))
  }

  const gotoNextMonth = () => {
    const d = new Date(selected.getFullYear(), selected.getMonth() + 1, 1)
    setSelectedDate(ymd(d))
  }

  const selectedTasks = useMemo(() => {
    const list = (tasksByDate.get(selectedDate) || []).slice()
    list.sort((a, b) => {
      if (period === 'today') {
        const aStatus = String(a.status || '').trim().toLowerCase()
        const bStatus = String(b.status || '').trim().toLowerCase()
        const aDone = aStatus === 'done' || aStatus === 'completed' || aStatus === 'keys_hung'
        const bDone = bStatus === 'done' || bStatus === 'completed' || bStatus === 'keys_hung'
        if (aDone !== bDone) return aDone ? 1 : -1
      }

      const sortDelta = taskSortIndexValue(a) - taskSortIndexValue(b)
      if (sortDelta) return sortDelta

      const aIsCleaning = a.source_type === 'cleaning_tasks'
      const bIsCleaning = b.source_type === 'cleaning_tasks'
      if (!(aIsCleaning && bIsCleaning)) {
        const ur = urgencyRank(b.urgency) - urgencyRank(a.urgency)
        if (ur) return ur
      }

      const ar = String((a as any).region || a.property?.region || '').trim()
      const br = String((b as any).region || b.property?.region || '').trim()
      const aEmpty = !ar
      const bEmpty = !br
      if (aEmpty !== bEmpty) return aEmpty ? 1 : -1
      const r0 = ar.localeCompare(br)
      if (r0) return r0

      return String(a.title || '').localeCompare(String(b.title || ''))
    })
    return list
  }, [period, selectedDate, tasksByDate])

  const canReorder = useMemo(() => {
    if (roleNames.includes('cleaner') || roleNames.includes('cleaning_inspector') || roleNames.includes('cleaner_inspector')) return true
    if (canManagerMode && mode === 'manager') return false
    return selectedTasks.some((task) => task.source_type !== 'cleaning_tasks')
  }, [canManagerMode, mode, selectedTasks, roleNames.join('|')])

  const isReorderableTask = useMemo(() => {
    return (task: WorkTaskItem) => {
      if (task.source_type !== 'cleaning_tasks') return !(canManagerMode && mode === 'manager')
      if (roleNames.includes('cleaner_inspector')) return task.task_kind === 'cleaning' || task.task_kind === 'inspection'
      if (roleNames.includes('cleaning_inspector')) return task.task_kind === 'inspection'
      if (roleNames.includes('cleaner')) return task.task_kind === 'cleaning'
      return false
    }
  }, [canManagerMode, mode, roleNames.join('|')])

  useEffect(() => {
    if (!reorderMode) return
    setOrderList([])
    setOrderMarks({})
  }, [reorderMode, selectedDate])

  const renderTasks = useMemo(() => selectedTasks, [selectedTasks])
  const dayEndDate = useMemo(() => ymd(new Date()), [])
  const isCleanerSelf = useMemo(() => {
    return roleNames.includes('cleaner') || roleNames.includes('cleaner_inspector')
  }, [roleNames.join('|')])
  const isInspectorSelf = useMemo(() => {
    return roleNames.includes('cleaning_inspector') || roleNames.includes('cleaner_inspector')
  }, [roleNames.join('|')])
  const isInspectorOnlySelf = useMemo(() => isInspectorOnlyRole(roleNames), [roleNames])
  const cleanerTodayTasks = useMemo(() => {
    if (period !== 'today') return []
    return renderTasks.filter((t) => {
      if (t.source_type !== 'cleaning_tasks') return false
      if (String(t.task_kind || '').trim().toLowerCase() !== 'cleaning') return false
      const st = String(t.status || '').trim().toLowerCase()
      if (st === 'cancelled' || st === 'canceled') return false
      return true
    })
  }, [period, renderTasks])
  const selfDayEndTasks = useMemo(() => {
    if (period !== 'today') return []
    return renderTasks.filter((t) => {
      if (t.source_type !== 'cleaning_tasks') return false
      const kind = String(t.task_kind || '').trim().toLowerCase()
      const st = String(t.status || '').trim().toLowerCase()
      if (st === 'cancelled' || st === 'canceled') return false
      if (roleNames.includes('cleaner_inspector')) return kind === 'cleaning' || kind === 'inspection'
      if (roleNames.includes('cleaning_inspector')) return kind === 'inspection'
      if (roleNames.includes('cleaner')) return kind === 'cleaning'
      return false
    })
  }, [period, renderTasks, roleNames.join('|')])
  const dayEndViewerTarget = useMemo(() => {
    const currentUserId = String((user as any)?.id || '').trim()
    if ((isCleanerSelf || isInspectorSelf) && currentUserId) return { userId: currentUserId, userName: '' }
    if (!canManagerMode) return { userId: '', userName: '' }
    const pairs = cleanerTodayTasks
      .map((t) => ({ userId: String(t.assignee_id || '').trim(), userName: String((t as any).cleaner_name || '').trim() }))
      .filter((x) => !!x.userId)
    const uniq = Array.from(new Map(pairs.map((x) => [x.userId, x])).values())
    if (uniq.length !== 1) return { userId: '', userName: '' }
    return uniq[0]
  }, [canManagerMode, cleanerTodayTasks, isCleanerSelf, isInspectorSelf, user])
  const dayEndTaskRoomCodes = useMemo(() => {
    const sourceTasks = canManagerMode && !isCleanerSelf && !isInspectorSelf
      ? cleanerTodayTasks.filter((t) => String(t.assignee_id || '').trim() === String(dayEndViewerTarget.userId || '').trim())
      : selfDayEndTasks
    return Array.from(
      new Set(
        sourceTasks
          .map((t) => String(t.property?.code || '').trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, 'en'))
  }, [canManagerMode, cleanerTodayTasks, dayEndViewerTarget.userId, isCleanerSelf, isInspectorSelf, selfDayEndTasks])

  useEffect(() => {
    if (!token) return
    if (period !== 'today') return
    if (!(isCleanerSelf || isInspectorSelf ? selfDayEndTasks.length : cleanerTodayTasks.length)) return
    if (!dayEndViewerTarget.userId) {
      setDayEndComplete(null)
      return
    }
    setDayEndComplete(null)
    let cancelled = false
    const load = async () => {
      try {
        const r = await listDayEndHandover(token, { date: dayEndDate, user_id: isCleanerSelf || isInspectorSelf ? undefined : dayEndViewerTarget.userId })
        if (cancelled) return
        const complete = !!(r as any)?.submitted_at
        setDayEndComplete(complete)
      } catch {
        if (cancelled) return
        setDayEndComplete(null)
      }
    }
    load()
    const nav: any = props.navigation as any
    const unsub = nav && typeof nav.addListener === 'function' ? nav.addListener('focus', load) : null
    return () => {
      cancelled = true
      try {
        if (typeof unsub === 'function') unsub()
      } catch {}
    }
  }, [canManagerMode, cleanerTodayTasks.length, dayEndDate, dayEndViewerTarget.userId, isCleanerSelf, isInspectorOnlySelf, isInspectorSelf, period, props.navigation, selfDayEndTasks.length, token])
  useEffect(() => {
    if (!token || !(canManagerMode && mode === 'manager') || period !== 'today') {
      setDayEndOverviewUsers([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const cleaningTasks = await listCleaningAppTasks(token, { date_from: dayEndDate, date_to: dayEndDate })
        const baseUsers = buildDayEndOverviewBaseUsersFromCleaningTasks(cleaningTasks)
        if (cancelled) return
        if (!baseUsers.length) {
          setDayEndOverviewUsers([])
          return
        }
        setDayEndOverviewUsers(baseUsers)
        const rows = await Promise.all(baseUsers.map(async (entry) => {
          const r = await listDayEndHandover(token, { date: dayEndDate, user_id: entry.userId })
          const complete = !!(r as any)?.submitted_at
          return { ...entry, complete }
        }))
        if (!cancelled) setDayEndOverviewUsers(rows.sort((a, b) => Number(a.complete) - Number(b.complete) || a.userName.localeCompare(b.userName, 'en')))
      } catch {
        if (!cancelled) setDayEndOverviewUsers((prev) => prev.map((entry) => ({ ...entry, complete: null })))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canManagerMode, dayEndDate, mode, period, token])
  const visibleTasks = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = canManagerMode && mode === 'manager' && q ? items : renderTasks
    const filtered = q
      ? base.filter((t) => {
          const code = String(t.property?.code || '').toLowerCase()
          const addr = String(t.property?.address || '').toLowerCase()
          const title = String(t.title || '').toLowerCase()
          return code.includes(q) || addr.includes(q) || title.includes(q)
        })
      : base
    const list = filtered.slice()
    list.sort((a, b) => {
      const aStatus = String(a.status || '').trim().toLowerCase()
      const bStatus = String(b.status || '').trim().toLowerCase()
      const aDone = aStatus === 'done' || aStatus === 'completed' || aStatus === 'keys_hung'
      const bDone = bStatus === 'done' || bStatus === 'completed' || bStatus === 'keys_hung'
      if (aDone !== bDone) return aDone ? 1 : -1
      const ad = String(a.scheduled_date || (a as any).date || '')
      const bd = String(b.scheduled_date || (b as any).date || '')
      if (ad && bd && ad !== bd) return ad.localeCompare(bd)
      const sortDelta = taskSortIndexValue(a) - taskSortIndexValue(b)
      if (sortDelta) return sortDelta
      const aIsCleaning = a.source_type === 'cleaning_tasks'
      const bIsCleaning = b.source_type === 'cleaning_tasks'
      if (!(aIsCleaning && bIsCleaning)) {
        const ur = urgencyRank(b.urgency) - urgencyRank(a.urgency)
        if (ur) return ur
      }
      return String(a.title || '').localeCompare(String(b.title || ''))
    })
    if (canManagerMode && mode === 'manager') {
      const keyOf = (t: WorkTaskItem) => {
        if (t.source_type !== 'cleaning_tasks') return ''
        const d = String(t.scheduled_date || (t as any).date || '').slice(0, 10)
        const code = String(t.property?.code || '').trim()
        const pid = String(t.property_id || '').trim()
        const title = String(t.title || '').trim()
        const propKey = code || pid || title
        if (!d || !propKey) return ''
        return `${d}|${propKey}`
      }
      const isDone = (t: WorkTaskItem) => {
        const s = String(t.status || '').trim().toLowerCase()
        return s === 'done' || s === 'completed' || s === 'keys_hung'
      }
      const isCleaningKind = (t: WorkTaskItem) => String(t.task_kind || '').trim().toLowerCase() === 'cleaning'
      const pick = (a: WorkTaskItem, b: WorkTaskItem) => {
        const aDone = isDone(a)
        const bDone = isDone(b)
        if (aDone !== bDone) return aDone ? b : a
        const aClean = isCleaningKind(a)
        const bClean = isCleaningKind(b)
        if (aClean !== bClean) return aClean ? a : b
        const aiRaw = (a as any).sort_index
        const biRaw = (b as any).sort_index
        const ai = aiRaw == null ? Number.POSITIVE_INFINITY : Number(aiRaw)
        const bi = biRaw == null ? Number.POSITIVE_INFINITY : Number(biRaw)
        if (Number.isFinite(ai) && Number.isFinite(bi) && ai !== bi) return ai < bi ? a : b
        return a
      }
      const order: string[] = []
      const chosen = new Map<string, WorkTaskItem>()
      const passthrough: WorkTaskItem[] = []
      for (const t of list) {
        const k = keyOf(t)
        if (!k) {
          passthrough.push(t)
          continue
        }
        if (!chosen.has(k)) order.push(k)
        const prev = chosen.get(k)
        chosen.set(k, prev ? pick(prev, t) : t)
      }
      const deduped = [...passthrough, ...order.map((k) => chosen.get(k)).filter(Boolean)] as WorkTaskItem[]
      return deduped
    }
    return list
  }, [items, renderTasks, search, canManagerMode, mode])
  const showDayEndCard = period === 'today' && (isCleanerSelf || isInspectorSelf ? selfDayEndTasks.length > 0 : cleanerTodayTasks.length > 0) && !!dayEndViewerTarget.userId
  const dayEndInsertIndex = useMemo(() => {
    if (!showDayEndCard) return -1
    const eligibleIndexes = visibleTasks
      .map((task, index) => ({ task, index }))
      .filter(({ task }) => {
        if (task.source_type !== 'cleaning_tasks') return false
        const kind = String(task.task_kind || '').trim().toLowerCase()
        if (canManagerMode && !isCleanerSelf && !isInspectorSelf) return kind === 'cleaning'
        if (roleNames.includes('cleaner_inspector')) return kind === 'cleaning' || kind === 'inspection'
        if (roleNames.includes('cleaning_inspector')) return kind === 'inspection'
        if (roleNames.includes('cleaner')) return kind === 'cleaning'
        return false
      })
    if (!eligibleIndexes.length) return -1
    const firstDone = eligibleIndexes.find(({ task }) => isDoneLikeStatus(String(task.status || '')))
    if (firstDone) return firstDone.index
    return eligibleIndexes[eligibleIndexes.length - 1].index + 1
  }, [canManagerMode, isCleanerSelf, isInspectorSelf, roleNames, showDayEndCard, visibleTasks])

function showBanner(title: string, message: string) {
    setBanner({ title, message })
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
    bannerTimerRef.current = setTimeout(() => setBanner(null), 4000)
  }

  function isTaskOwnedByCurrentUser(task: WorkTaskItem) {
    const uid = String((user as any)?.id || '').trim()
    if (!uid) return false
    const kind = String(task.task_kind || '').trim().toLowerCase()
    const assigneeId = String(task.assignee_id || '').trim()
    const cleanerId = String((task as any)?.cleaner_id || '').trim()
    const inspectorId = String((task as any)?.inspector_id || '').trim()
    if (kind === 'inspection') return assigneeId === uid || inspectorId === uid
    if (kind === 'cleaning') return assigneeId === uid || cleanerId === uid
    return assigneeId === uid
  }

  useEffect(() => {
    if (!allowDerivedTaskNotices) return
    if (!taskNoticeArmed) return
    const isInspector = roleNames.includes('cleaning_inspector') || roleNames.includes('cleaner_inspector')
    if (!isInspector) return
    if (period !== 'today') return
    let cancelled = false
    ;(async () => {
      await initNoticesStore().catch(() => null)
      const existing = new Set(getNoticesSnapshot().items.map(n => n.id))
      const toInspect = renderTasks.filter(t => t.source_type === 'cleaning_tasks' && t.task_kind === 'inspection' && isTaskOwnedByCurrentUser(t) && String(t.status || '').toLowerCase() === 'to_inspect')
      const fresh = toInspect.filter(t => !notifiedInspectionsRef.current[t.id] && !existing.has(`insp:to_inspect:${t.id}`))
      if (!fresh.length || cancelled) return
      for (const t of fresh) notifiedInspectionsRef.current[t.id] = true
      const first = fresh[0]
      const code = String(first.property?.code || first.title || '').trim()
      const msg = fresh.length > 1 ? `${code} 等 ${fresh.length} 个待检查` : `${code} 待检查`
      showBanner('房源清洁完毕', msg)
      for (const t of fresh) {
        const code2 = String(t.property?.code || t.title || '').trim()
        const addr2 = String(t.property?.address || '').trim()
        const body = [code2 ? `房源：${code2}` : '', addr2 ? `地址：${addr2}` : '', '状态：待检查'].filter(Boolean).join('\n')
        await prependNotice({
          id: `insp:to_inspect:${t.id}`,
          type: 'update',
          title: code2 ? `房源清洁完毕：${code2}` : '房源清洁完毕',
          summary: '待检查',
          content: body || '状态：待检查',
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [allowDerivedTaskNotices, taskNoticeArmed, period, renderTasks, user?.role])

  useEffect(() => {
    if (!allowDerivedTaskNotices) return
    if (!taskNoticeArmed) return
    const role = String(user?.role || '')
    const isInspector = role === 'cleaning_inspector' || role === 'cleaner_inspector'
    if (!isInspector) return
    if (period !== 'today') return
    const keysUploaded = renderTasks.filter(
      t =>
        t.source_type === 'cleaning_tasks' &&
        t.task_kind === 'inspection' &&
        isTaskOwnedByCurrentUser(t) &&
        String(t.status || '').toLowerCase() === 'in_progress' &&
        !!String((t as any).key_photo_url || '').trim(),
    )
    let cancelled = false
    ;(async () => {
      await initNoticesStore().catch(() => null)
      const existing = new Set(getNoticesSnapshot().items.map(n => n.id))
      const fresh = keysUploaded.filter(t => !notifiedInspectionsRef.current[`key:${t.id}`] && !existing.has(`insp:key_uploaded:${t.id}`))
      if (!fresh.length || cancelled) return
      for (const t of fresh) notifiedInspectionsRef.current[`key:${t.id}`] = true
      const first = fresh[0]
      const code = String(first.property?.code || first.title || '').trim()
      const msg = fresh.length > 1 ? `${code} 等 ${fresh.length} 个已上传钥匙` : `${code} 已上传钥匙`
      showBanner('钥匙已上传', msg)
      for (const t of fresh) {
        const code2 = String(t.property?.code || t.title || '').trim()
        const addr2 = String(t.property?.address || '').trim()
        const photo = String((t as any).key_photo_url || '').trim()
        const body = [code2 ? `房源：${code2}` : '', addr2 ? `地址：${addr2}` : '', '事件：钥匙已上传', photo ? `照片：${photo}` : ''].filter(Boolean).join('\n')
        await prependNotice({
          id: `insp:key_uploaded:${t.id}`,
          type: 'key',
          title: code2 ? `钥匙已上传：${code2}` : '钥匙已上传',
          summary: '钥匙照片已更新',
          content: body || '事件：钥匙已上传',
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [allowDerivedTaskNotices, taskNoticeArmed, period, renderTasks, user?.role])

  useEffect(() => {
    if (!allowDerivedTaskNotices) return
    if (!taskNoticeArmed) return
    const role = String(user?.role || '')
    if (role !== 'cleaner' && role !== 'cleaner_inspector') return
    if (period !== 'today') return
    const checkedOut = renderTasks.filter(
      t => {
        if (!(t.source_type === 'cleaning_tasks' && t.task_kind === 'cleaning')) return false
        if (!isTaskOwnedByCurrentUser(t)) return false
        const raw = String((t as any).checked_out_at || '').trim()
        if (!raw) return false
        const ms = Date.parse(raw)
        if (!Number.isFinite(ms)) return false
        return Date.now() - ms < 6 * 60 * 60 * 1000
      },
    )
    let cancelled = false
    ;(async () => {
      await initNoticesStore().catch(() => null)
      const existing = new Set(getNoticesSnapshot().items.map(n => n.id))
      const fresh = checkedOut.filter(t => !notifiedInspectionsRef.current[`co:${t.id}`] && !existing.has(`clean:checked_out:${t.id}`))
      if (!fresh.length || cancelled) return
      for (const t of fresh) notifiedInspectionsRef.current[`co:${t.id}`] = true
      const first = fresh[0]
      const code = String(first.property?.code || first.title || '').trim()
      const msg = fresh.length > 1 ? `${code} 等 ${fresh.length} 个已退房` : `${code} 已退房`
      showBanner('客人已退房', msg)
      for (const t of fresh) {
        const code2 = String(t.property?.code || t.title || '').trim()
        const addr2 = String(t.property?.address || '').trim()
        const at = String((t as any).checked_out_at || '').trim()
        const body = [code2 ? `房源：${code2}` : '', addr2 ? `地址：${addr2}` : '', at ? `退房时间：${at}` : '', '事件：客人已退房'].filter(Boolean).join('\n')
        await prependNotice({
          id: `clean:checked_out:${t.id}`,
          type: 'update',
          title: code2 ? `客人已退房：${code2}` : '客人已退房',
          summary: '已标记退房',
          content: body || '事件：客人已退房',
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [allowDerivedTaskNotices, taskNoticeArmed, period, renderTasks, roleNames.join('|')])

  useEffect(() => {
    if (!allowDerivedTaskNotices) return
    if (!taskNoticeArmed) return
    if (!(canManagerMode && mode === 'manager')) return
    if (period !== 'today') return
    const hung = renderTasks.filter(t => t.source_type === 'cleaning_tasks' && t.task_kind === 'inspection' && String(t.status || '').toLowerCase() === 'keys_hung')
    let cancelled = false
    ;(async () => {
      await initNoticesStore().catch(() => null)
      const existing = new Set(getNoticesSnapshot().items.map(n => n.id))
      const fresh = hung.filter(t => !notifiedInspectionsRef.current[`hung:${t.id}`] && !existing.has(`insp:keys_hung:${t.id}`))
      if (!fresh.length || cancelled) return
      for (const t of fresh) notifiedInspectionsRef.current[`hung:${t.id}`] = true
      const first = fresh[0]
      const code = String(first.property?.code || first.title || '').trim()
      const msg = fresh.length > 1 ? `${code} 等 ${fresh.length} 个已挂钥匙` : `${code} 已挂钥匙`
      showBanner('已挂钥匙', msg)
      for (const t of fresh) {
        const code2 = String(t.property?.code || t.title || '').trim()
        const addr2 = String(t.property?.address || '').trim()
        const body = [code2 ? `房源：${code2}` : '', addr2 ? `地址：${addr2}` : '', '状态：已挂钥匙'].filter(Boolean).join('\n')
        await prependNotice({
          id: `insp:keys_hung:${t.id}`,
          type: 'key',
          title: code2 ? `已挂钥匙：${code2}` : '已挂钥匙',
          summary: '检查完成',
          content: body || '状态：已挂钥匙',
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [allowDerivedTaskNotices, taskNoticeArmed, period, renderTasks, canManagerMode, mode])

  async function onSaveOrder() {
    if (!token || !user?.id) return
    try {
      setSavingOrder(true)
      const reorderable = renderTasks.filter(isReorderableTask)
      const n = reorderable.length
      if (!n) {
        setReorderMode(false)
        return
      }
      if (orderList.length !== n) throw new Error(`请按顺序点选全部任务（已选 ${orderList.length}/${n}）`)
      const mapById = new Map<string, WorkTaskItem>()
      for (const t of reorderable) mapById.set(t.id, t)
      const marks: Array<{ task: WorkTaskItem; mark: number }> = []
      for (let i = 0; i < orderList.length; i++) {
        const id = String(orderList[i] || '').trim()
        const task = mapById.get(id)
        if (!task) throw new Error('排序选择包含无效任务')
        marks.push({ task, mark: i + 1 })
      }
      const cleanerGroups: string[][] = []
      const inspectorGroups: string[][] = []
      const workTaskIds: string[] = []
      for (const { task } of marks) {
        if (!isReorderableTask(task)) continue
        if (task.source_type !== 'cleaning_tasks') {
          workTaskIds.push(String(task.id))
          continue
        }
        const ids = Array.isArray((task as any).source_ids) && (task as any).source_ids.length ? (task as any).source_ids.map((x: any) => String(x)) : [String(task.source_id)]
        if (task.task_kind === 'cleaning') cleanerGroups.push(ids)
        else if (task.task_kind === 'inspection') inspectorGroups.push(ids)
      }
      if (workTaskIds.length) await reorderWorkTasks(token, { date: selectedDate, task_ids: workTaskIds })
      if (cleanerGroups.length) await reorderCleaningTasks(token, { kind: 'cleaner', date: selectedDate, groups: cleanerGroups })
      if (inspectorGroups.length) await reorderCleaningTasks(token, { kind: 'inspector', date: selectedDate, groups: inspectorGroups })
      await refreshWorkTasksFromServer({ token, userId: user.id, date_from: range.date_from, date_to: range.date_to, view: canManagerMode && mode === 'manager' ? view : 'mine' })
      setReorderMode(false)
      showBanner('已保存', '顺序已保存')
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '保存失败'))
    } finally {
      setSavingOrder(false)
    }
  }

  const sectionTitle = useMemo(() => {
    if (period === 'today') return t('tasks_section_today')
    if (locale === 'en') {
      const d = parseYmd(selectedDate)
      return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} Tasks`
    }
    const d = parseYmd(selectedDate)
    return `${d.getMonth() + 1}月${d.getDate()}日 任务`
  }, [locale, period, selectedDate, t])

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.hello}>
          {t('tasks_greeting')} <Text style={styles.helloName}>{greetingName}</Text>
        </Text>
        <View style={styles.avatar}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>{headerInitials}</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { void refreshTasksData() }}
            tintColor="#2563EB"
            colors={['#2563EB']}
          />
        }
      >
        {banner ? (
          <Pressable onPress={() => setBanner(null)} style={({ pressed }) => [styles.banner, pressed ? styles.segmentPressed : null]}>
            <View style={styles.bannerTextWrap}>
              <Text style={styles.bannerTitle} numberOfLines={1}>
                {banner.title}
              </Text>
              <Text style={styles.bannerMsg} numberOfLines={2}>
                {banner.message}
              </Text>
            </View>
            <Ionicons name="close" size={moderateScale(16)} color="#6B7280" />
          </Pressable>
        ) : null}
        <View style={styles.segmentWrap}>
          <View style={styles.segment}>
            <Pressable
              onPress={() => {
                setPeriod('today')
                setSelectedDate(ymd(new Date()))
              }}
              style={({ pressed }) => [styles.segmentItem, period === 'today' ? styles.segmentItemActive : null, pressed ? styles.segmentPressed : null]}
            >
              <Text style={[styles.segmentText, period === 'today' ? styles.segmentTextActive : null]}>{t('tasks_period_today')}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setPeriod('week')
                setSelectedDate(ymd(new Date()))
              }}
              style={({ pressed }) => [styles.segmentItem, period === 'week' ? styles.segmentItemActive : null, pressed ? styles.segmentPressed : null]}
            >
              <Text style={[styles.segmentText, period === 'week' ? styles.segmentTextActive : null]}>{t('tasks_period_week')}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setPeriod('month')
                setSelectedDate(ymd(new Date()))
              }}
              style={({ pressed }) => [styles.segmentItem, period === 'month' ? styles.segmentItemActive : null, pressed ? styles.segmentPressed : null]}
            >
              <Text style={[styles.segmentText, period === 'month' ? styles.segmentTextActive : null]}>{t('tasks_period_month')}</Text>
            </Pressable>
          </View>
        </View>

        {period === 'month' ? (
          <View style={styles.monthWrap}>
            <View style={styles.monthNavRow}>
              <Pressable onPress={gotoPrevMonth} style={({ pressed }) => [styles.monthNavBtn, pressed ? styles.segmentPressed : null]}>
                <Ionicons name="chevron-back" size={moderateScale(18)} color="#111827" />
                <Text style={styles.monthNavBtnText}>上个月</Text>
              </Pressable>
              <Text style={styles.monthTitle}>{monthTitle}</Text>
              <Pressable onPress={gotoNextMonth} style={({ pressed }) => [styles.monthNavBtn, pressed ? styles.segmentPressed : null]}>
                <Text style={styles.monthNavBtnText}>下个月</Text>
                <Ionicons name="chevron-forward" size={moderateScale(18)} color="#111827" />
              </Pressable>
            </View>
            <View style={styles.monthHeader}>
              {monthGrid.header.map(h => (
                <Text key={h} style={styles.monthHeaderText}>
                  {h}
                </Text>
              ))}
            </View>
            <View style={styles.monthGrid}>
              {monthGrid.cells.map(c => (
                <Pressable key={c.key} onPress={() => setSelectedDate(c.key)} style={({ pressed }) => [styles.monthCell, pressed ? styles.segmentPressed : null]}>
                  <View style={[styles.monthCellInner, !c.inMonth ? styles.monthCellOut : null, c.isSelected ? styles.monthCellSelected : null]}>
                    <Text style={[styles.monthDay, !c.inMonth ? styles.monthDayOut : null, c.isSelected ? styles.monthDaySelected : null]}>{c.day}</Text>
                    <View
                      style={[
                        styles.monthDot,
                        c.isSelected ? styles.monthDotSelected : null,
                        !c.isSelected && c.hasTask ? (c.inMonth ? styles.monthDotOn : styles.monthDotOut) : styles.monthDotHidden,
                      ]}
                    />
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          period === 'week' ? (
            <ScrollView
              ref={weekPagerRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onWeekPagerMomentumEnd}
              contentOffset={{ x: weekPagerWidth * weekPagerCenterIndex, y: 0 }}
              style={styles.weekPager}
            >
              {weekPagerPages.map((p) => (
                <View key={p.key} style={[styles.weekPage, { width: weekPagerWidth }]}>
                  {p.days.map((d) => (
                    <Pressable
                      key={d.key}
                      onPress={() => setSelectedDate(d.key)}
                      style={({ pressed }) => [styles.weekCard, styles.weekCardFlex, pressed ? styles.segmentPressed : null]}
                    >
                      <View style={[styles.weekCardInner, d.isSelected ? styles.dateCardSelected : null]}>
                        <Text style={[styles.dateDow, d.isSelected ? styles.dateDowSelected : null]}>{d.dow}</Text>
                        <Text style={[styles.dateDay, d.isSelected ? styles.dateDaySelected : null]}>{d.day}</Text>
                        <View style={[styles.dateDot, d.isSelected ? styles.dateDotSelected : d.hasTask ? styles.dateDotOn : styles.dateDotHidden]} />
                      </View>
                    </Pressable>
                  ))}
                </View>
              ))}
            </ScrollView>
          ) : (
            <ScrollView ref={weekRowRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekRow}>
              {weekDays.map(d => (
                <Pressable key={d.key} onPress={() => setSelectedDate(d.key)} style={({ pressed }) => [styles.weekCard, pressed ? styles.segmentPressed : null]}>
                  <View style={[styles.weekCardInner, d.isSelected ? styles.dateCardSelected : null]}>
                    <Text style={[styles.dateDow, d.isSelected ? styles.dateDowSelected : null]}>{d.dow}</Text>
                    <Text style={[styles.dateDay, d.isSelected ? styles.dateDaySelected : null]}>{d.day}</Text>
                    <View style={[styles.dateDot, d.isSelected ? styles.dateDotSelected : d.hasTask ? styles.dateDotOn : styles.dateDotHidden]} />
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )
        )}

        {canSwitchMode ? (
          <View style={[styles.segmentWrap, { marginTop: 10 }]}>
            <View style={styles.segment}>
              <Pressable
                onPress={() => {
                  setMode('cleaning')
                  setView('mine')
                }}
                style={({ pressed }) => [styles.segmentItem, mode === 'cleaning' ? styles.segmentItemActive : null, pressed ? styles.segmentPressed : null]}
              >
                <Text style={[styles.segmentText, mode === 'cleaning' ? styles.segmentTextActive : null]}>清洁</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setMode('manager')
                  setView('all')
                }}
                style={({ pressed }) => [styles.segmentItem, mode === 'manager' ? styles.segmentItemActive : null, pressed ? styles.segmentPressed : null]}
              >
                <Text style={[styles.segmentText, mode === 'manager' ? styles.segmentTextActive : null]}>管理</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {canManagerMode && mode === 'manager' ? (
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={moderateScale(16)} color="#9CA3AF" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              style={styles.searchInput}
              placeholder="搜索房源（编号/地址/标题）"
              placeholderTextColor="#9CA3AF"
            />
            {search.trim() ? (
              <Pressable onPress={() => setSearch('')} style={({ pressed }) => [styles.searchClear, pressed ? styles.segmentPressed : null]}>
                <Ionicons name="close-circle" size={moderateScale(18)} color="#9CA3AF" />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {canManagerMode && mode === 'manager' && period === 'today' ? (
          <Pressable
            onPress={() => props.navigation.navigate('DayEndBackupKeys', { date: dayEndDate, overviewMode: true, overviewUsers: dayEndOverviewUsers.map((entry) => ({ ...entry, complete: null })) })}
            style={({ pressed }) => [styles.dayEndOverviewCard, pressed ? styles.segmentPressed : null]}
          >
            <View style={styles.dayEndOverviewIcon}>
              <Ionicons name="albums-outline" size={moderateScale(18)} color="#1D4ED8" />
            </View>
            <View style={styles.dayEndOverviewBody}>
              <Text style={styles.dayEndOverviewTitle}>今日日终交接总览</Text>
              <Text style={styles.dayEndOverviewMsg} numberOfLines={2}>
                {dayEndOverviewUsers.length
                  ? `查看今天 ${dayEndOverviewUsers.length} 位清洁/检查人员的提交状态与内容。`
                  : '查看今天清洁和检查人员的日终交接提交状态。'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={moderateScale(18)} color="#93C5FD" />
          </Pressable>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{sectionTitle}</Text>
          <View style={styles.sectionRight}>
            {canManagerMode && mode === 'manager' ? (
              <View style={styles.viewSegment}>
                <Pressable onPress={() => setView('all')} style={({ pressed }) => [styles.viewSegmentItem, view === 'all' ? styles.viewSegmentItemActive : null, pressed ? styles.segmentPressed : null]}>
                  <Text style={[styles.viewSegmentText, view === 'all' ? styles.viewSegmentTextActive : null]}>{t('common_all')}</Text>
                </Pressable>
                <Pressable onPress={() => setView('mine')} style={({ pressed }) => [styles.viewSegmentItem, view === 'mine' ? styles.viewSegmentItemActive : null, pressed ? styles.segmentPressed : null]}>
                  <Text style={[styles.viewSegmentText, view === 'mine' ? styles.viewSegmentTextActive : null]}>{t('common_mine')}</Text>
                </Pressable>
              </View>
            ) : null}
            {canReorder ? (
              <Pressable
                onPress={() => {
                  if (reorderMode) onSaveOrder()
                  else {
                    setOrderList([])
                    setOrderMarks({})
                    setReorderMode(true)
                  }
                }}
                disabled={savingOrder}
                style={({ pressed }) => [styles.reorderBtn, pressed ? styles.segmentPressed : null, savingOrder ? styles.reorderBtnDisabled : null]}
              >
                <Text style={styles.reorderBtnText}>{reorderMode ? '保存顺序' : '排序'}</Text>
              </Pressable>
            ) : null}
            <Text style={styles.sectionCount}>{`${visibleTasks.length} ${t('tasks_tasks_suffix')}`}</Text>
          </View>
        </View>

        {!hasInit ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{t('common_loading')}</Text>
          </View>
        ) : loadError ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{loadError}</Text>
          </View>
        ) : visibleTasks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{t('tasks_no_tasks')}</Text>
          </View>
        ) : (
          <View style={{ marginTop: 10, gap: 12 }}>
            {visibleTasks.map((task, taskIndex) => {
              const shouldRenderDayEndBefore = showDayEndCard && dayEndInsertIndex === taskIndex
              const meta = statusLabelForTask(task, roleNames)
              const kind = taskKindLabel(task.task_kind)
              const addr = task.property?.address || ''
              const code = task.property?.code || ''
              const unitType = task.property?.unit_type || ''
              const region = task.property?.region || ''
              const checkoutTime = String(task.start_time || '').trim()
              const checkinTime = String(task.end_time || '').trim()
              const guideUrl = normalizeHttpUrl(task.property?.access_guide_link)
              const oldCode = String((task as any).old_code || '').trim()
              const newCode = String((task as any).new_code || '').trim()
              const guestSpecialRequest = String((task as any).guest_special_request || '').trim()
              const taskNote = String((task as any).note || '').trim()
              const urgency = urgencyMeta(task.urgency)
              const isOfflineTask = String(task.task_kind || '').toLowerCase() === 'offline'
              const detailPreview = !isOfflineTask && task.source_type !== 'cleaning_tasks' ? stripPhotoLines(task.summary) : ''
              const showSummary = !!detailPreview
              const isCleaningSource = task.source_type === 'cleaning_tasks'
              const isCleaningTask = isCleaningSource && String(task.task_kind || '').toLowerCase() === 'cleaning'
              const isInspectionTask = isCleaningSource && String(task.task_kind || '').toLowerCase() === 'inspection'
              const isCleaningSubmitted = isCleaningTask && isCleaningWorkSubmitted(task.status)
              const hasKeyPhoto = !!String((task as any)?.key_photo_url || '').trim()
              const taskType = String((task as any).task_type || '').trim().toLowerCase()
              const isStayoverTask = isCleaningTask && isStayoverTaskType(taskType)
              const isCheckoutTask = taskType === 'checkout_clean' || !!checkoutTime
              const inspectionMode = effectiveInspectionMode(task as any)
              const inspectionPlanLabel = inspectionModeLabel(inspectionMode, String((task as any).inspection_due_date || '').trim() || null)
              const isSelfCompleteEligible = isCleaningTask && isSelfCompleteMode(task as any) && (isCheckoutTask || isStayoverTask)
              const isDirectCompleteEligible = isCleaningTask && (isSelfCompleteEligible || isStayoverTask)
              const isPendingInspectionDecision = isCleaningTask && !isStayoverTask && inspectionMode === 'pending_decision'
              const showInspectionPlanTag = isCleaningTask && !isStayoverTask
              const checkedOutAt = String((task as any).checked_out_at || '').trim()
              const isCheckedOut = !!checkedOutAt
              const isHistoricalTask = isBeforeToday(String(task.scheduled_date || (task as any).date || ''))
              const isCustomerService = roleNames.includes('customer_service')
              const isManager = canManagerMode && mode === 'manager'
              const isInspectorUser = roleNames.includes('cleaning_inspector') || roleNames.includes('cleaner_inspector')
              const cleanerName = String((task as any).cleaner_name || '').trim()
              const inspectorName = String((task as any).inspector_name || '').trim()
              const cleanerOrderRaw = (task as any).sort_index_cleaner
              const inspectorOrderRaw = (task as any).sort_index_inspector
              const cleanerOrder = cleanerOrderRaw == null ? null : Number(cleanerOrderRaw)
              const inspectorOrder = inspectorOrderRaw == null ? null : Number(inspectorOrderRaw)
              const cleanerOrderN = Number.isFinite(cleanerOrder) ? cleanerOrder : null
              const inspectorOrderN = Number.isFinite(inspectorOrder) ? inspectorOrder : null
              const sortIndexRaw = (task as any).sort_index
              const sortIndex0 = sortIndexRaw == null ? null : Number(sortIndexRaw)
              const sortIndex = Number.isFinite(sortIndex0 as any) ? (sortIndex0 as number) : null
              const selectedIdx = orderList.indexOf(task.id)
              const selectedMark = selectedIdx >= 0 ? String(selectedIdx + 1) : ''
              const restockItems = Array.isArray((task as any).restock_items) ? ((task as any).restock_items as any[]) : []
              const stayedNightsRaw = (task as any).stayed_nights
              const remainingNightsRaw = (task as any).remaining_nights
              const stayedNights0 = stayedNightsRaw == null ? null : Number(stayedNightsRaw)
              const remainingNights0 = remainingNightsRaw == null ? null : Number(remainingNightsRaw)
              const stayedNights = Number.isFinite(stayedNights0 as any) ? (stayedNights0 as number) : null
              const remainingNights = Number.isFinite(remainingNights0 as any) ? (remainingNights0 as number) : null
              const restockSummary = (() => {
                if (!isInspectionTask) return null
                const parts = restockItems
                  .map((it) => {
                    const label = String(it?.label || it?.item_id || '').trim()
                    if (!label) return null
                    const qty = it?.qty == null ? null : Number(it.qty)
                    return Number.isFinite(qty as any) && qty ? `${label}×${qty}` : label
                  })
                  .filter(Boolean) as string[]
                if (!parts.length) return null
                const head = parts.slice(0, 3).join('、')
                if (parts.length <= 3) return head
                return `${head} 等${parts.length}项`
              })()
              const hasCheckout = !!checkoutTime
              const hasCheckin = !!checkinTime
              const isLateCheckout = hasCheckout && isLateCheckoutTime(checkoutTime)
              const isEarlyCheckin = hasCheckin && isEarlyCheckinTime(checkinTime)
              const titleSuffix = hasCheckout || hasCheckin ? `${hasCheckout ? '退房' : ''}${hasCheckout && hasCheckin ? ' ' : ''}${hasCheckin ? '入住' : ''}` : ''
              const title2 = `${code || task.title || '-'}${titleSuffix ? ` ${titleSuffix}` : ''}`.trim()
              const keyTagsRaw = (task as any)?.key_tags
              const keyTags = keyTagsRaw && typeof keyTagsRaw === 'object' ? keyTagsRaw : null
              const keysRequiredBase = Number((task as any)?.keys_required ?? 0)
              const keysCheckout = Number((task as any)?.keys_required_checkout ?? keysRequiredBase)
              const keysCheckin = Number((task as any)?.keys_required_checkin ?? keysRequiredBase)
              const checkoutSets = keyTags
                ? (keyTags.checkout_sets == null ? 0 : Number(keyTags.checkout_sets))
                : (Number.isFinite(keysCheckout) && keysCheckout >= 2 ? Math.trunc(keysCheckout) : 0)
              const checkinSets = keyTags
                ? (keyTags.checkin_sets == null ? 0 : Number(keyTags.checkin_sets))
                : (Number.isFinite(keysCheckin) && keysCheckin >= 2 ? Math.trunc(keysCheckin) : 0)
              const showCheckout = keyTags ? keyTags.show_checkout === true : (isCleaningSource && !isCheckedOut && checkoutSets >= 2)
              const showCheckin = keyTags ? keyTags.show_checkin === true : (isCleaningSource && checkinSets >= 2)
              const selfInspectorOnlyUser = isInspectorOnlyRole(roleNames)
              const offlineDetail = (() => {
                if (!isOfflineTask) return null
                const t1 = String(task.title || '').trim()
                if (t1 && (!code || t1 !== code) && t1 !== title2) return t1
                const s1 = stripPhotoLines(task.summary)
                if (s1) return s1
                if (!t1) return null
                if (code && t1 === code) return null
                if (t1 === title2) return null
                return t1
              })()
              return (
                <React.Fragment key={task.id}>
                  {shouldRenderDayEndBefore ? (
                    <Pressable
                      onPress={() => props.navigation.navigate('DayEndBackupKeys', { date: dayEndDate, taskRoomCodes: dayEndTaskRoomCodes, ...((isCleanerSelf || isInspectorSelf) ? {} : { userId: dayEndViewerTarget.userId, userName: dayEndViewerTarget.userName || undefined }) })}
                      style={({ pressed }) => [styles.taskCard, styles.dayEndTaskCard, pressed ? styles.segmentPressed : null]}
                    >
                      <View style={styles.taskTitleRow}>
                        <View style={styles.orderPill}>
                          <Text style={styles.orderPillText}>{dayEndComplete ? '完' : '交'}</Text>
                        </View>
                        <Text style={styles.taskTitle} numberOfLines={1}>日终交接</Text>
                        <View style={[styles.statusPill, dayEndComplete ? styles.statusGreen : styles.statusAmber]}>
                          <Text style={[styles.statusText, dayEndComplete ? styles.statusTextGreen : styles.statusTextAmber]}>
                            {dayEndComplete ? '已提交' : '待交接'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.summary} numberOfLines={2}>
                        {isCleanerSelf || isInspectorSelf
                          ? (dayEndComplete
                            ? '今天的日终交接已提交，可进入查看详情。'
                            : (selfInspectorOnlyUser ? '请拍剩余消耗品并完成 Reject 床品登记。' : '请根据今天实际任务完成日终交接。'))
                          : (dayEndViewerTarget.userName
                            ? `查看 ${dayEndViewerTarget.userName} 今日的钥匙与脏床品交接记录。`
                            : '查看今日的钥匙与脏床品交接记录。')}
                      </Text>
                      <View style={styles.actionsRow}>
                        <Pressable
                          onPress={() => props.navigation.navigate('DayEndBackupKeys', { date: dayEndDate, focus: selfInspectorOnlyUser ? 'consumable' : 'key', taskRoomCodes: dayEndTaskRoomCodes, ...((isCleanerSelf || isInspectorSelf) ? {} : { userId: dayEndViewerTarget.userId, userName: dayEndViewerTarget.userName || undefined }) })}
                          style={({ pressed }) => [styles.actionBtn, pressed ? styles.segmentPressed : null]}
                        >
                          <Text style={styles.actionText}>{selfInspectorOnlyUser ? '上传剩余消耗品' : '上传备用钥匙'}</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => props.navigation.navigate('DayEndBackupKeys', { date: dayEndDate, focus: selfInspectorOnlyUser ? 'reject' : 'dirty', taskRoomCodes: dayEndTaskRoomCodes, ...((isCleanerSelf || isInspectorSelf) ? {} : { userId: dayEndViewerTarget.userId, userName: dayEndViewerTarget.userName || undefined }) })}
                          style={({ pressed }) => [styles.actionBtn, pressed ? styles.segmentPressed : null]}
                        >
                          <Text style={styles.actionText}>{selfInspectorOnlyUser ? '登记 Reject床品' : '上传脏床品照片'}</Text>
                        </Pressable>
                      </View>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => {
                    if (reorderMode && isReorderableTask(task)) {
                      setOrderList((prev) => {
                        const exists = prev.includes(task.id)
                        const next = exists ? prev.filter((x) => x !== task.id) : [...prev, task.id]
                        setOrderMarks(Object.fromEntries(next.map((id, idx) => [id, String(idx + 1)])))
                        return next
                      })
                      return
                    }
                    const isManager0 = canTaskManagerView
                    const isInspector0 = roleNames.includes('cleaning_inspector') || roleNames.includes('cleaner_inspector')
                    const isInspection0 = task.source_type === 'cleaning_tasks' && task.task_kind === 'inspection'
                    const isCleaningTask0 = task.source_type === 'cleaning_tasks'
                    if (isManager0 && isCleaningTask0) {
                      props.navigation.navigate('ManagerDailyTask', { taskId: task.id })
                      return
                    }
                    if (isInspector0 && isInspection0) {
                      props.navigation.navigate('InspectionPanel', { taskId: task.id })
                      return
                    }
                    props.navigation.navigate('TaskDetail', { id: task.id })
                  }}
                    style={({ pressed }) => [styles.taskCard, pressed ? styles.segmentPressed : null]}
                  >
                  <View style={styles.taskTitleRow}>
                    {!isManager && (isReorderableTask(task) || sortIndex != null) ? (
                      <View style={[styles.orderPill, reorderMode && isReorderableTask(task) ? styles.orderPillActive : null]}>
                        <Text style={[styles.orderPillText, reorderMode && isReorderableTask(task) ? styles.orderPillTextActive : null]}>
                          {reorderMode && isReorderableTask(task) ? (selectedMark || '·') : sortIndex == null ? '·' : String(sortIndex)}
                        </Text>
                      </View>
                    ) : null}
                    <Text style={styles.taskTitle} numberOfLines={1}>
                      {title2}
                    </Text>
                    <View style={[styles.statusPill, meta.pill]}>
                      <Text style={[styles.statusText, meta.textStyle]}>{meta.text}</Text>
                    </View>
                  </View>

                  <View style={styles.taskSubRow}>
                    {isStayoverTask ? (
                      <View style={styles.tag}>
                        <Text style={styles.tagText}>入住中清洁</Text>
                      </View>
                    ) : (
                      <>
                        <View style={styles.tag}>
                          <Text style={styles.tagText}>{kind}</Text>
                        </View>
                        {showCheckout ? (
                          <View style={styles.tagKey}>
                            <Text style={styles.tagKeyText}>{`请确认已退${Math.max(2, Math.trunc(Number(checkoutSets || 0)))}套钥匙`}</Text>
                          </View>
                        ) : null}
                        {showCheckin ? (
                          <View style={styles.tagWarn}>
                            <Text style={styles.tagWarnText}>{`需挂${checkinSets}套钥匙`}</Text>
                          </View>
                        ) : null}
                        {isLateCheckout ? (
                          <View style={styles.tagLate}>
                            <Text style={styles.tagLateText}>晚退房</Text>
                          </View>
                        ) : null}
                        {isEarlyCheckin ? (
                          <View style={styles.tagWarn}>
                            <Text style={styles.tagWarnText}>早入住</Text>
                          </View>
                        ) : null}
                        {showInspectionPlanTag ? (
                          <View style={inspectionMode === 'pending_decision' ? styles.tagWarn : styles.tag}>
                            <Text style={inspectionMode === 'pending_decision' ? styles.tagWarnText : styles.tagText}>{inspectionPlanLabel}</Text>
                          </View>
                        ) : null}
                        {urgency ? (
                          <View style={[styles.urgencyPill, urgency.pill]}>
                            <Text style={[styles.urgencyText, urgency.textStyle]}>{urgency.text}</Text>
                          </View>
                        ) : null}
                      </>
                    )}
                  </View>

                  {isCleaningSource ? (
                    <>
                      <View style={styles.execCard}>
                        <View style={styles.execBadges}>
                          <View style={styles.execBadgeClean}>
                            <Text style={styles.execBadgeText}>清</Text>
                          </View>
                          <View style={styles.execBadgeInspect}>
                            <Text style={styles.execBadgeText}>检</Text>
                          </View>
                        </View>
                        <View style={styles.execTextWrap}>
                          <Text style={styles.execLabel}>执行人员</Text>
                          <Text style={styles.execNames} numberOfLines={1}>{`清洁: ${cleanerName || '-'} · 检查: ${isDirectCompleteEligible || isPendingInspectionDecision ? '无' : (inspectorName || '-')}`}</Text>
                          {isManager || isInspectorUser ? (
                            <Text style={styles.execOrder} numberOfLines={1}>
                              {`清洁顺序：${cleanerOrderN == null ? '-' : String(cleanerOrderN)}  检查顺序：${inspectorOrderN == null ? '-' : String(inspectorOrderN)}`}
                            </Text>
                          ) : null}
                        </View>
                      </View>

                      {!isOfflineTask && unitType ? (
                        <View style={styles.unitTypeRow}>
                          <Ionicons name="bed-outline" size={moderateScale(24)} color="#6366F1" />
                          <View style={styles.unitTypeCell}>
                            <Text style={styles.unitTypeText}>{unitType}</Text>
                          </View>
                        </View>
                      ) : null}

                      {addr ? (
                        <Pressable
                          onPress={async () => {
                            try {
                              await Clipboard.setStringAsync(addr)
                              showBanner('已复制', '地址已复制')
                            } catch {
                              showBanner('复制失败', '复制失败')
                            }
                          }}
                          style={({ pressed }) => [styles.addrRow, pressed ? styles.segmentPressed : null]}
                        >
                          <Ionicons name="location-outline" size={moderateScale(22)} color="#2563EB" />
                          <Text style={styles.addrText} numberOfLines={2}>
                            {addr}
                          </Text>
                          <Ionicons name="copy-outline" size={moderateScale(18)} color="#9CA3AF" />
                        </Pressable>
                      ) : null}

                      <View style={styles.timeRow}>
                        <Ionicons name="time-outline" size={moderateScale(26)} color="#16A34A" />
                        <View style={styles.timeCell}>
                          <Text style={styles.timeLabel}>退房时间</Text>
                          <Text style={styles.timeValue}>{checkoutTime || '-'}</Text>
                        </View>
                        <View style={styles.timeDivider} />
                        <View style={styles.timeCell}>
                          <Text style={styles.timeLabel}>入住时间</Text>
                          <Text style={styles.timeValue}>{checkinTime || '-'}</Text>
                        </View>
                      </View>

                      {stayedNights != null || remainingNights != null ? (
                        <View style={styles.timeRow}>
                          <Ionicons name="moon-outline" size={moderateScale(26)} color="#2563EB" />
                          <View style={styles.timeCell}>
                            <Text style={styles.timeLabel}>已住晚数</Text>
                            <Text style={styles.timeValue}>{stayedNights == null ? '-' : `${stayedNights}`}</Text>
                          </View>
                          <View style={styles.timeDivider} />
                          <View style={styles.timeCell}>
                            <Text style={styles.timeLabel}>待住晚数</Text>
                            <Text style={styles.timeValue}>{remainingNights == null ? '-' : `${remainingNights}`}</Text>
                          </View>
                        </View>
                      ) : null}

                      <View style={styles.pwRowNew}>
                        <Ionicons name="key-outline" size={moderateScale(22)} color="#F59E0B" />
                        <View style={styles.pwCell}>
                          <Text style={styles.pwLabel}>旧密码：</Text>
                          <Text style={styles.pwValue}>{oldCode || '-'}</Text>
                        </View>
                        <View style={styles.pwCell}>
                          <Text style={styles.pwLabel}>新密码：</Text>
                          <Text style={styles.pwValue}>{newCode || '-'}</Text>
                        </View>
                      </View>

                      {guestSpecialRequest ? (
                        <View style={styles.guestRow}>
                          <View style={styles.guestIconWrap}>
                            <Ionicons name="chatbubble-ellipses-outline" size={moderateScale(20)} color="#2563EB" />
                          </View>
                          <View style={styles.guestCell}>
                            <Text style={styles.guestLabel}>客人需求：</Text>
                            <Text style={styles.guestValue} numberOfLines={3}>
                              {guestSpecialRequest}
                            </Text>
                          </View>
                        </View>
                      ) : null}

                      {taskNote ? (
                        <View style={styles.guestRow}>
                          <View style={styles.guestIconWrap}>
                            <Ionicons name="document-text-outline" size={moderateScale(20)} color="#2563EB" />
                          </View>
                          <View style={styles.guestCell}>
                            <Text style={styles.guestLabel}>备注：</Text>
                            <Text style={styles.guestValue} numberOfLines={3}>
                              {taskNote}
                            </Text>
                          </View>
                        </View>
                      ) : null}

                      {!isOfflineTask ? (
                        guideUrl ? (
                          <Pressable
                            onPress={async () => {
                              try {
                                await Linking.openURL(guideUrl)
                              } catch {
                                showBanner('打开失败', '打开失败')
                              }
                            }}
                            style={({ pressed }) => [styles.guideCard, pressed ? styles.segmentPressed : null]}
                          >
                            <Ionicons name="open-outline" size={moderateScale(20)} color="#2563EB" />
                            <Text style={styles.guideText} numberOfLines={1}>
                              查看入住指南
                            </Text>
                            <Ionicons name="chevron-forward" size={moderateScale(18)} color="#9CA3AF" />
                          </Pressable>
                        ) : (
                          <View style={styles.guideCard}>
                            <Ionicons name="open-outline" size={moderateScale(20)} color="#9CA3AF" />
                            <Text style={[styles.guideText, { color: '#9CA3AF' }]} numberOfLines={1}>
                              无入住指南，请联系管理员
                            </Text>
                            <Ionicons name="chevron-forward" size={moderateScale(18)} color="#E5E7EB" />
                          </View>
                        )
                      ) : null}
                    </>
                  ) : (
                    <>
                      {!isOfflineTask && addr ? (
                        <Pressable
                          onPress={async () => {
                            try {
                              await Clipboard.setStringAsync(addr)
                              showBanner('已复制', '地址已复制')
                            } catch {
                              showBanner('复制失败', '复制失败')
                            }
                          }}
                          style={({ pressed }) => [styles.row, pressed ? styles.segmentPressed : null]}
                        >
                          <Ionicons name="location-outline" size={moderateScale(14)} color="#9CA3AF" />
                          <Text style={styles.addr} numberOfLines={2}>
                            {addr}
                          </Text>
                          <Ionicons name="copy-outline" size={moderateScale(14)} color="#9CA3AF" />
                        </Pressable>
                      ) : null}
                    </>
                  )}

                  {isOfflineTask && offlineDetail ? (
                    <View style={styles.row}>
                      <Ionicons name="list-outline" size={moderateScale(14)} color="#9CA3AF" />
                      <Text style={styles.addr} numberOfLines={3}>
                        {offlineDetail}
                      </Text>
                    </View>
                  ) : null}

                  {restockSummary ? (
                    <View style={styles.row}>
                      <Ionicons name="cube-outline" size={moderateScale(14)} color="#9CA3AF" />
                      <Text style={styles.addr} numberOfLines={2}>{`待补消耗品：${restockSummary}`}</Text>
                    </View>
                  ) : null}

                  {showSummary ? (
                    <Text style={styles.summary} numberOfLines={3}>
                      {detailPreview}
                    </Text>
                  ) : null}

                  {isCleaningSource && isManager ? (
                    <View style={styles.actionsRow}>
                      {isCustomerService && isCheckoutTask ? (
                        <Pressable
                          onPress={async () => {
                            if (isHistoricalTask) return
                            if (!token || !user?.id) return
                            try {
                                  const nextCheckedOutAt = isCheckedOut ? null : new Date().toISOString()
                                  const taskIds = checkoutTaskIdsFromTask(task)
                                  setCheckedOutPendingMap((prev) => ({ ...prev, [task.id]: true }))
                                  await patchWorkTaskItem(String(task.id), { checked_out_at: nextCheckedOutAt } as any)
                                  if (taskIds.length) {
                                    await markGuestCheckedOutByTasks(token, { task_ids: taskIds, action: isCheckedOut ? 'unset' : 'set' })
                                  } else {
                                    const orderId = String((task as any)?.order_id_checkout || (task as any)?.order_id || '').trim()
                                    if (!orderId) throw new Error('缺少订单ID')
                                    await markGuestCheckedOutByOrder(token, { order_id: orderId, action: isCheckedOut ? 'unset' : 'set' })
                                  }
                                  showBanner('已标记', isCheckedOut ? '已取消退房' : '已标记已退房')
                            } catch (e: any) {
                              await patchWorkTaskItem(String(task.id), { checked_out_at: checkedOutAt || null } as any)
                              showBanner('失败', String(e?.message || '提交失败'))
                            } finally {
                              setCheckedOutPendingMap((prev) => {
                                const next = { ...prev }
                                delete next[task.id]
                                return next
                              })
                            }
                          }}
                          disabled={!token || isHistoricalTask || !!checkedOutPendingMap[task.id]}
                          style={({ pressed }) => [styles.actionBtn, pressed ? styles.segmentPressed : null, isCheckedOut || isHistoricalTask || !!checkedOutPendingMap[task.id] ? styles.actionBtnDisabled : null]}
                        >
                          <Text style={[styles.actionText, isCheckedOut || isHistoricalTask || !!checkedOutPendingMap[task.id] ? { color: '#6B7280' } : null]}>{checkedOutPendingMap[task.id] ? '提交中...' : isCheckedOut ? '取消已退房' : '标记已退房'}</Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        onPress={() => props.navigation.navigate('FeedbackForm', { taskId: task.id })}
                        style={({ pressed }) => [styles.actionBtn, pressed ? styles.segmentPressed : null]}
                      >
                        <Text style={styles.actionText}>{t('tasks_btn_repair')}</Text>
                      </Pressable>
                    </View>
                  ) : isInspectionTask && isInspectorUser ? (
                    <View style={styles.actionsRow}>
                      <Pressable
                        onPress={() => props.navigation.navigate('InspectionPanel', { taskId: task.id })}
                        style={({ pressed }) => [styles.actionBtn, pressed ? styles.segmentPressed : null]}
                      >
                        <Text style={styles.actionText}>检查与补充</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => props.navigation.navigate('FeedbackForm', { taskId: task.id })}
                        style={({ pressed }) => [styles.actionBtn, pressed ? styles.segmentPressed : null]}
                      >
                        <Text style={styles.actionText}>房源问题反馈</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => props.navigation.navigate('InspectionComplete', { taskId: task.id })}
                        style={({ pressed }) => [styles.actionBtn, pressed ? styles.segmentPressed : null]}
                      >
                        <Text style={styles.actionText}>标记已完成</Text>
                      </Pressable>
                    </View>
                  ) : isCleaningTask ? (
                    <View style={styles.actionsRow}>
                      {!isCleaningSubmitted && !isStayoverTask ? (
                        <Pressable
                          onPress={() => props.navigation.navigate('TaskDetail', { id: task.id, action: 'upload_key' })}
                          disabled={hasKeyPhoto}
                          style={({ pressed }) => [styles.actionBtn, pressed ? styles.segmentPressed : null, hasKeyPhoto ? styles.actionBtnDisabled : null]}
                        >
                          <Text style={[styles.actionText, hasKeyPhoto ? { color: '#6B7280' } : null]}>{hasKeyPhoto ? '钥匙记录' : t('tasks_btn_upload_key')}</Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        onPress={() => props.navigation.navigate('FeedbackForm', { taskId: task.id })}
                        style={({ pressed }) => [styles.actionBtn, pressed ? styles.segmentPressed : null]}
                      >
                        <Text style={styles.actionText}>{t('tasks_btn_repair')}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          if (isPendingInspectionDecision) return
                          props.navigation.navigate(isDirectCompleteEligible ? 'CleaningSelfComplete' : 'SuppliesForm', { taskId: task.id } as any)
                        }}
                        style={({ pressed }) => [styles.actionBtn, pressed ? styles.segmentPressed : null, isPendingInspectionDecision ? styles.actionBtnDisabled : null]}
                      >
                        <Text style={styles.actionText}>
                          {isPendingInspectionDecision
                            ? '待确认检查安排'
                            : isCleaningSubmitted
                              ? (isDirectCompleteEligible ? '完成记录' : '补品记录')
                              : (isStayoverTask ? '标记已完成' : (isSelfCompleteEligible ? '补充与完成' : '补品填报'))}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                  </Pressable>
                </React.Fragment>
              )
            })}
            {showDayEndCard && dayEndInsertIndex === visibleTasks.length ? (
              <Pressable
                onPress={() => props.navigation.navigate('DayEndBackupKeys', { date: dayEndDate, taskRoomCodes: dayEndTaskRoomCodes, ...((isCleanerSelf || isInspectorSelf) ? {} : { userId: dayEndViewerTarget.userId, userName: dayEndViewerTarget.userName || undefined }) })}
                style={({ pressed }) => [styles.taskCard, styles.dayEndTaskCard, pressed ? styles.segmentPressed : null]}
              >
                <View style={styles.taskTitleRow}>
                  <View style={styles.orderPill}>
                    <Text style={styles.orderPillText}>{dayEndComplete ? '完' : '交'}</Text>
                  </View>
                  <Text style={styles.taskTitle} numberOfLines={1}>日终交接</Text>
                  <View style={[styles.statusPill, dayEndComplete ? styles.statusGreen : styles.statusAmber]}>
                    <Text style={[styles.statusText, dayEndComplete ? styles.statusTextGreen : styles.statusTextAmber]}>
                      {dayEndComplete ? '已提交' : '待交接'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.summary} numberOfLines={2}>
                  {isCleanerSelf || isInspectorSelf
                    ? (dayEndComplete
                      ? '今天的日终交接已提交，可进入查看详情。'
                      : (isInspectorOnlySelf ? '请拍剩余消耗品并完成 Reject 床品登记。' : '请根据今天实际任务完成日终交接。'))
                    : (dayEndViewerTarget.userName
                      ? `查看 ${dayEndViewerTarget.userName} 今日的钥匙与脏床品交接记录。`
                      : '查看今日的钥匙与脏床品交接记录。')}
                </Text>
                <View style={styles.actionsRow}>
                  <Pressable
                    onPress={() => props.navigation.navigate('DayEndBackupKeys', { date: dayEndDate, focus: isInspectorOnlySelf ? 'consumable' : 'key', taskRoomCodes: dayEndTaskRoomCodes, ...((isCleanerSelf || isInspectorSelf) ? {} : { userId: dayEndViewerTarget.userId, userName: dayEndViewerTarget.userName || undefined }) })}
                    style={({ pressed }) => [styles.actionBtn, pressed ? styles.segmentPressed : null]}
                  >
                    <Text style={styles.actionText}>{isInspectorOnlySelf ? '上传剩余消耗品' : '上传备用钥匙'}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => props.navigation.navigate('DayEndBackupKeys', { date: dayEndDate, focus: isInspectorOnlySelf ? 'reject' : 'dirty', taskRoomCodes: dayEndTaskRoomCodes, ...((isCleanerSelf || isInspectorSelf) ? {} : { userId: dayEndViewerTarget.userId, userName: dayEndViewerTarget.userName || undefined }) })}
                    style={({ pressed }) => [styles.actionBtn, pressed ? styles.segmentPressed : null]}
                  >
                    <Text style={styles.actionText}>{isInspectorOnlySelf ? '登记 Reject床品' : '上传脏床品照片'}</Text>
                  </Pressable>
                </View>
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F7FB' },
  header: {
    height: moderateScale(60),
    paddingHorizontal: 18,
    borderBottomWidth: hairline(),
    borderBottomColor: '#EEF0F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  hello: { fontSize: moderateScale(20), fontWeight: '800', color: '#111827' },
  helloName: { fontSize: moderateScale(20), fontWeight: '800', color: '#111827' },
  avatar: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: moderateScale(18),
    overflow: 'hidden',
    backgroundColor: '#111827',
  },
  avatarImg: { width: '100%', height: '100%', backgroundColor: '#0B0F17' },
  avatarFallback: { flex: 1, backgroundColor: '#0B0F17', alignItems: 'center', justifyContent: 'center' },
  avatarFallbackText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 },
  banner: { marginBottom: 12, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, borderWidth: hairline(), borderColor: '#EEF0F6', flexDirection: 'row', alignItems: 'center', gap: 10 },
  bannerTextWrap: { flex: 1, minWidth: 0 },
  bannerTitle: { fontWeight: '900', color: '#111827' },
  bannerMsg: { marginTop: 2, color: '#6B7280', fontWeight: '700' },
  dayEndOverviewCard: { marginTop: 10, backgroundColor: '#EFF6FF', borderRadius: 16, padding: 12, borderWidth: hairline(), borderColor: '#DBEAFE', flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayEndOverviewIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  dayEndOverviewBody: { flex: 1, minWidth: 0 },
  dayEndOverviewTitle: { fontWeight: '900', color: '#1D4ED8' },
  dayEndOverviewMsg: { marginTop: 2, color: '#1E40AF', fontWeight: '700' },
  dayEndCard: { marginBottom: 12, backgroundColor: '#EFF6FF', borderRadius: 16, padding: 12, borderWidth: hairline(), borderColor: '#DBEAFE', flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayEndTitle: { fontWeight: '900', color: '#1D4ED8' },
  dayEndTaskCard: { backgroundColor: '#EFF6FF', borderColor: '#DBEAFE' },
  dayEndMsg: { marginTop: 2, color: '#1E40AF', fontWeight: '700' },
  searchWrap: { marginTop: 10, height: 44, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: hairline(), borderColor: '#EEF0F6', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: { flex: 1, minWidth: 0, height: 44, color: '#111827', fontWeight: '800' },
  searchClear: { height: 44, width: 34, alignItems: 'center', justifyContent: 'center' },

  segmentWrap: { backgroundColor: '#F2F4F8', borderRadius: 14, padding: 8 },
  segment: { flexDirection: 'row', gap: 8 },
  segmentItem: { flex: 1, height: moderateScale(38), borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  segmentItemActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  segmentPressed: { opacity: 0.92 },
  segmentText: { fontSize: moderateScale(14), fontWeight: '700', color: '#9CA3AF' },
  segmentTextActive: { color: '#111827' },

  weekPager: { marginTop: 14 },
  weekPage: { flexDirection: 'row', gap: 10, paddingRight: 2 },
  weekRow: { gap: 10, marginTop: 14, paddingRight: 2 },
  weekCard: { width: moderateScale(64) },
  weekCardFlex: { flex: 1, width: 0 },
  weekCardInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: hairline(),
    borderColor: '#EEF0F6',
  },
  dateCardSelected: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  dateDow: { fontSize: moderateScale(12), fontWeight: '800', color: '#6B7280' },
  dateDowSelected: { color: '#FFFFFF', opacity: 0.95 },
  dateDay: { marginTop: 4, fontSize: moderateScale(18), fontWeight: '900', color: '#111827' },
  dateDaySelected: { color: '#FFFFFF' },
  dateDot: { marginTop: 6, width: 6, height: 6, borderRadius: 3, backgroundColor: '#2563EB' },
  dateDotSelected: { backgroundColor: '#FFFFFF' },
  dateDotOn: { backgroundColor: '#2563EB' },
  dateDotHidden: { opacity: 0 },

  monthWrap: { marginTop: 14 },
  monthNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 10 },
  monthNavBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 8, height: 32, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: hairline(), borderColor: '#EEF0F6' },
  monthNavBtnText: { fontWeight: '900', color: '#111827', fontSize: 12 },
  monthTitle: { fontWeight: '900', color: '#111827' },
  monthHeader: { flexDirection: 'row', paddingHorizontal: 4, marginBottom: 8 },
  monthHeaderText: { width: '14.2857%', textAlign: 'center', color: '#9CA3AF', fontWeight: '900', fontSize: 11 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  monthCell: { width: '14.2857%', paddingVertical: 6, paddingHorizontal: 4 },
  monthCellInner: {
    height: moderateScale(44),
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: hairline(),
    borderColor: '#EEF0F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthCellOut: { backgroundColor: '#F9FAFB', borderColor: '#EEF0F6' },
  monthCellSelected: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  monthDay: { fontSize: 13, fontWeight: '900', color: '#111827' },
  monthDaySelected: { color: '#FFFFFF' },
  monthDayOut: { color: '#9CA3AF' },
  monthDot: { marginTop: 4, width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#2563EB' },
  monthDotSelected: { backgroundColor: '#FFFFFF' },
  monthDotOn: { backgroundColor: '#2563EB' },
  monthDotOut: { backgroundColor: '#9CA3AF' },
  monthDotHidden: { opacity: 0 },

  sectionHeader: { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: moderateScale(14), fontWeight: '800', color: '#6B7280' },
  sectionCount: { fontSize: moderateScale(12), fontWeight: '700', color: '#9CA3AF' },
  sectionRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  viewSegment: { flexDirection: 'row', gap: 6, backgroundColor: '#F2F4F8', borderRadius: 14, padding: 4 },
  viewSegmentItem: { height: 28, paddingHorizontal: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  viewSegmentItemActive: { backgroundColor: '#FFFFFF' },
  viewSegmentText: { fontSize: moderateScale(12), fontWeight: '800', color: '#6B7280' },
  viewSegmentTextActive: { color: '#111827' },
  reorderBtn: { height: 28, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  reorderBtnDisabled: { backgroundColor: '#E5E7EB' },
  reorderBtnText: { fontSize: moderateScale(12), fontWeight: '900', color: '#111827' },

  emptyCard: { marginTop: 10, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, borderWidth: hairline(), borderColor: '#EEF0F6' },
  emptyText: { color: '#9CA3AF', fontWeight: '800' },

  taskCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, borderWidth: hairline(), borderColor: '#EEF0F6' },
  taskTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  taskTitle: { flex: 1, fontSize: moderateScale(18), fontWeight: '900', color: '#111827' },
  orderPill: { width: 26, height: 26, borderRadius: 13, borderWidth: hairline(), borderColor: '#DBEAFE', backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  orderPillActive: { borderColor: '#2563EB', backgroundColor: '#2563EB' },
  orderPillText: { fontSize: 12, fontWeight: '900', color: '#2563EB' },
  orderPillTextActive: { color: '#FFFFFF' },
  orderInput: { width: 44, height: 30, borderRadius: 10, borderWidth: hairline(), borderColor: '#D1D5DB', paddingHorizontal: 8, fontWeight: '900', color: '#111827', textAlign: 'center' },
  statusPill: { height: 26, paddingHorizontal: 10, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  statusText: { fontSize: 12, fontWeight: '900' },
  statusBlue: { backgroundColor: '#DBEAFE' },
  statusAmber: { backgroundColor: '#FEF3C7' },
  statusGreen: { backgroundColor: '#DCFCE7' },
  statusPurple: { backgroundColor: '#EDE9FE' },
  statusGray: { backgroundColor: '#F3F4F6' },
  statusTextBlue: { color: '#2563EB' },
  statusTextAmber: { color: '#B45309' },
  statusTextGreen: { color: '#16A34A' },
  statusTextPurple: { color: '#7C3AED' },
  statusTextGray: { color: '#6B7280' },
  taskSubRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  tag: { paddingHorizontal: 10, height: 24, borderRadius: 12, backgroundColor: '#EFF6FF', borderWidth: hairline(), borderColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  tagText: { fontSize: 11, fontWeight: '900', color: '#2563EB' },
  urgencyPill: { paddingHorizontal: 10, height: 24, borderRadius: 12, borderWidth: hairline(), alignItems: 'center', justifyContent: 'center' },
  urgencyText: { fontSize: 11, fontWeight: '900' },
  urgencyUrgent: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
  urgencyUrgentText: { color: '#B91C1C' },
  urgencyHigh: { backgroundColor: '#FFF7ED', borderColor: '#FDBA74' },
  urgencyHighText: { color: '#C2410C' },
  urgencyMedium: { backgroundColor: '#EFF6FF', borderColor: '#93C5FD' },
  urgencyMediumText: { color: '#1D4ED8' },
  urgencyLow: { backgroundColor: '#F3F4F6', borderColor: '#D1D5DB' },
  urgencyLowText: { color: '#4B5563' },
  tagGray: { paddingHorizontal: 10, height: 24, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  tagGrayText: { fontSize: 11, fontWeight: '800', color: '#6B7280' },
  tagKey: { paddingHorizontal: 10, height: 24, borderRadius: 12, backgroundColor: '#FEF2F2', borderWidth: hairline(), borderColor: '#FCA5A5', alignItems: 'center', justifyContent: 'center' },
  tagKeyText: { fontSize: 11, fontWeight: '900', color: '#B91C1C' },
  tagWarn: { paddingHorizontal: 10, height: 24, borderRadius: 12, backgroundColor: '#FFFBEB', borderWidth: hairline(), borderColor: '#FDE68A', alignItems: 'center', justifyContent: 'center' },
  tagWarnText: { fontSize: 11, fontWeight: '900', color: '#B45309' },
  tagLate: { paddingHorizontal: 10, height: 24, borderRadius: 12, backgroundColor: '#F3E8FF', borderWidth: hairline(), borderColor: '#D8B4FE', alignItems: 'center', justifyContent: 'center' },
  tagLateText: { fontSize: 11, fontWeight: '900', color: '#7C3AED' },
  row: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  addr: { flex: 1, color: '#6B7280', fontSize: moderateScale(13), fontWeight: '600' },
  linkInline: { flex: 1, color: '#2563EB', fontSize: moderateScale(13), fontWeight: '800' },
  execCard: { marginTop: 12, padding: 14, borderRadius: 18, backgroundColor: '#F3F4F6', flexDirection: 'row', alignItems: 'center', gap: 12 },
  execBadges: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  execBadgeClean: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  execBadgeInspect: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center' },
  execBadgeText: { color: '#FFFFFF', fontWeight: '800' },
  execTextWrap: { flex: 1, minWidth: 0 },
  execLabel: { color: '#6B7280', fontWeight: '600', fontSize: moderateScale(12) },
  execNames: { marginTop: 4, color: '#111827', fontWeight: '600', fontSize: moderateScale(13) },
  execOrder: { marginTop: 4, color: '#6B7280', fontWeight: '600', fontSize: moderateScale(12) },
  unitTypeRow: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  unitTypeCell: { flex: 1 },
  unitTypeText: { color: '#111827', fontSize: moderateScale(13), fontWeight: '600' },
  addrRow: { marginTop: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  addrText: { flex: 1, color: '#111827', fontSize: moderateScale(13), fontWeight: '600', lineHeight: moderateScale(19) },
  timeRow: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  timeCell: { flex: 1 },
  timeLabel: { color: '#9CA3AF', fontWeight: '600', fontSize: moderateScale(12) },
  timeValue: { marginTop: 2, color: '#111827', fontWeight: '600', fontSize: moderateScale(13) },
  timeDivider: { width: hairline(), height: 44, backgroundColor: '#EEF0F6' },
  pwRowNew: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pwCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  pwLabel: { color: '#9CA3AF', fontWeight: '600', fontSize: moderateScale(12) },
  pwValue: { color: '#111827', fontWeight: '600', fontSize: moderateScale(13) },
  guestRow: { marginTop: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  guestIconWrap: { width: moderateScale(20), height: moderateScale(20), marginTop: 2, alignItems: 'center', justifyContent: 'center' },
  guestCell: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  guestLabel: { color: '#9CA3AF', fontWeight: '600', fontSize: moderateScale(12), lineHeight: moderateScale(19) },
  guestValue: { color: '#111827', fontWeight: '600', fontSize: moderateScale(13), flexShrink: 1, lineHeight: moderateScale(19) },
  guideCard: { marginTop: 16, height: 62, borderRadius: 18, backgroundColor: '#F9FAFB', borderWidth: hairline(), borderColor: '#EEF0F6', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  guideText: { flex: 1, minWidth: 0, color: '#2563EB', fontWeight: '600', fontSize: moderateScale(13) },
  pwRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  pwText: { flex: 1, color: '#6B7280', fontSize: moderateScale(13), fontWeight: '700' },
  summary: { marginTop: 10, color: '#374151', fontWeight: '700', lineHeight: 18 },
  actionsRow: { marginTop: 12, flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, height: 36, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  actionBtnDisabled: { backgroundColor: '#E5E7EB' },
  actionText: { fontWeight: '900', color: '#FFFFFF', fontSize: 12 },
})
