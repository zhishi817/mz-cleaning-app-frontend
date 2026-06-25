import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, AppState, Image, Linking, Modal, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { hairline, moderateScale } from '../../lib/scale'
import { createCleaningOfflineTask, createManualCleaningTask, listCleaningAppPropertyCodes, reorderCleaningTasks, reorderWorkTasks } from '../../lib/api'
import { markGuestCheckedOutByOrder, markGuestCheckedOutByTasks } from '../../lib/api'
import { listMzappAlerts, markMzappAlertRead } from '../../lib/api'
import { getMyProfile } from '../../lib/api'
import { listDayEndHandover } from '../../lib/api'
import { listWorkTasks } from '../../lib/api'
import { createWarehouseKeyEvent, getWarehouseKeyStatus, type WarehouseKeyStatus } from '../../lib/api'
import { processDayEndHandoverQueue } from '../../lib/dayEndHandoverQueue'
import {
  listKeyUploadQueueItems,
  processKeyUploadQueue,
  selectKeyPhotoEffectiveState,
  subscribeKeyUploadQueue,
} from '../../lib/keyUploadQueue'
import GuestLuggageCard from '../../components/GuestLuggageCard'
import { getNoticesSnapshot, initNoticesStore, prependNotice, subscribeNotices } from '../../lib/noticesStore'
import { getProfile, setProfile, type Profile } from '../../lib/profileStore'
import { cleaningTaskTitleSuffix, effectiveInspectionMode, inspectionModeLabel, inspectionScopeLabel, isPasswordOnlyInspectionTask, isSelfCompleteMode, isStayoverTaskType } from '../../lib/cleaningInspection'
import { canSwitchTaskMode, isTaskManagerUser } from '../../lib/roles'
import { normalizeHttpUrl } from '../../lib/urls'
import { resolveKeyRequirementTags } from '../../lib/keyRequirementTags'
import { normalizeAuMobile } from '../../lib/phone'
import { isEarlyCheckinTime, isLateCheckinTime, isLateCheckoutTime } from '../../lib/taskTime'
import { getInspectionModeTone, getInspectionScopeTone, getTaskKindTone, getTaskStatusMeta, TASK_TONE_COLORS, type TaskTone } from '../../lib/taskVisualTheme'
import {
  activateWorkTasksRealtime,
  deactivateWorkTasksRealtime,
  getWorkTasksSnapshot,
  initWorkTasksStore,
  makeWorkTasksBucketKey,
  patchWorkTaskItem,
  patchWorkTaskItems,
  refreshWorkTasksFromServer,
  subscribeWorkTasks,
  type WorkTaskItem,
  type WorkTasksView,
} from '../../lib/workTasksStore'
import type { DayEndOverviewUser, DayEndRoleStats, DayEndTargetRole, TasksStackParamList } from '../../navigation/RootNavigator'

type Period = 'today' | 'week' | 'month'
type QuickCreateMode = 'checkout' | 'checkin' | 'offline'
type QuickCreateOfflineTaskType = 'property' | 'company' | 'other'
type QuickCreatePropertyOption = { id: string; code: string; region?: string | null }
type DayEndOverviewDisplayUser = DayEndOverviewUser & { displayRole: DayEndTargetRole }
type Props = NativeStackScreenProps<TasksStackParamList, 'TasksList'>
type TaskCacheHint = { message: string; lastSyncedAt: string | null } | null

const QUICK_CREATE_OFFLINE_TASK_TYPES: { key: QuickCreateOfflineTaskType; label: string }[] = [
  { key: 'property', label: '房源任务' },
  { key: 'company', label: '公司任务' },
  { key: 'other', label: '其他任务' },
]

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function formatSyncTimestamp(raw: string | null) {
  const value = String(raw || '').trim()
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

function buildTaskCacheHint(lastSyncedAt: string | null, failedRefresh = false): TaskCacheHint {
  return {
    message: failedRefresh ? '当前显示离线缓存，联网后下拉刷新。' : '已加载本地缓存，正在同步最新任务。',
    lastSyncedAt: lastSyncedAt || null,
  }
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

function normalizeDayEndRoles(items: Array<string | DayEndTargetRole>) {
  const roles = new Set<DayEndTargetRole>()
  for (const item of items || []) {
    if (item === 'cleaning' || item === 'inspection') roles.add(item)
  }
  return Array.from(roles.values()).sort()
}

function createDayEndRoleStats(): DayEndRoleStats {
  return { assigned: 0, done: 0, pending: 0, activeRooms: [], doneRooms: [] }
}

function pushUniqueRoom(list: string[], roomCode: string) {
  if (!roomCode || list.includes(roomCode)) return
  list.push(roomCode)
}

function isInspectionWorkSubmitted(status0: any) {
  const s = String(status0 || '').trim().toLowerCase()
  return isDoneLikeStatus(s)
}

function applyDayEndRoleProgress(stats: DayEndRoleStats, status0: any, roomCode: string, isSubmitted: boolean) {
  stats.assigned += 1
  if (isSubmitted) {
    stats.done += 1
    pushUniqueRoom(stats.doneRooms, roomCode)
    return
  }
  const status = String(status0 || '').trim().toLowerCase()
  if (status === 'in_progress') {
    pushUniqueRoom(stats.activeRooms, roomCode)
    return
  }
  stats.pending += 1
}

function formatDayEndRoleStats(label: string, stats?: DayEndRoleStats | null) {
  if (!stats || stats.assigned <= 0) return ''
  const parts = [`${label} ${stats.done}/${stats.assigned}`]
  if (stats.activeRooms.length) parts.push(`进行中 ${stats.activeRooms.join('、')}`)
  else if (stats.pending > 0) parts.push(`待处理 ${stats.pending}`)
  if (stats.doneRooms.length) parts.push(`已完成 ${stats.doneRooms.join('、')}`)
  return parts.join(' · ')
}

function dayEndRoleRank(roles: DayEndTargetRole[]) {
  const normalized = normalizeDayEndRoles(roles)
  if (normalized.includes('cleaning')) return 0
  if (normalized.includes('inspection')) return 1
  return 2
}

function compareDayEndOverviewUsers(a: DayEndOverviewUser, b: DayEndOverviewUser) {
  const roleDelta = dayEndRoleRank(a.roles) - dayEndRoleRank(b.roles)
  if (roleDelta) return roleDelta
  const completionDelta = Number(a.complete === true) - Number(b.complete === true)
  if (completionDelta) return completionDelta
  return String(a.userName || a.userId || '').localeCompare(String(b.userName || b.userId || ''), 'en')
}

function compareDayEndOverviewDisplayUsers(a: DayEndOverviewDisplayUser, b: DayEndOverviewDisplayUser) {
  const completionDelta = Number(a.complete === true) - Number(b.complete === true)
  if (completionDelta) return completionDelta
  return String(a.userName || a.userId || '').localeCompare(String(b.userName || b.userId || ''), 'en')
}

function buildDayEndOverviewDisplayUsers(users: DayEndOverviewUser[]): DayEndOverviewDisplayUser[] {
  const cleaners: DayEndOverviewDisplayUser[] = []
  const inspectors: DayEndOverviewDisplayUser[] = []
  for (const entry of users || []) {
    const cleaningAssigned = Number(entry.stats?.cleaning?.assigned || 0)
    const inspectionAssigned = Number(entry.stats?.inspection?.assigned || 0)
    if (cleaningAssigned > 0 || (cleaningAssigned <= 0 && entry.roles.includes('cleaning'))) {
      cleaners.push({ ...entry, displayRole: 'cleaning' })
    }
    if (inspectionAssigned > 0 || (inspectionAssigned <= 0 && entry.roles.includes('inspection'))) {
      inspectors.push({ ...entry, displayRole: 'inspection' })
    }
  }
  return [
    ...cleaners.sort(compareDayEndOverviewDisplayUsers),
    ...inspectors.sort(compareDayEndOverviewDisplayUsers),
  ]
}

function dayEndProgressIdentity(task: { id?: any; source_id?: any; title?: any; property?: { code?: any } | null }, code: string) {
  return code || String(task.property?.code || task.title || '').trim() || String(task.source_id || task.id || '').trim()
}

function resolveCleaningProgressUserId(task: { task_kind?: any; assignee_id?: any; cleaner_id?: any; cleaner_name?: any; inspector_id?: any }) {
  const cleanerId = String(task.cleaner_id || '').trim()
  if (cleanerId) return cleanerId
  const kind = String(task.task_kind || '').trim().toLowerCase()
  const assigneeId = String(task.assignee_id || '').trim()
  if (!assigneeId) return ''
  if (kind === 'cleaning') return assigneeId
  const cleanerName = String(task.cleaner_name || '').trim()
  const inspectorId = String(task.inspector_id || '').trim()
  if (cleanerName && assigneeId !== inspectorId) return assigneeId
  return ''
}

function dayEndTargetContentLabel(roles: DayEndTargetRole[]) {
  const hasCleaning = roles.includes('cleaning')
  const hasInspection = roles.includes('inspection')
  if (hasCleaning && hasInspection) return '清洁、检查与 Reject 床品'
  if (hasInspection) return '消耗品与 Reject 床品'
  return '备用钥匙、脏床品、仓库钥匙与 Reject 床品'
}

function buildDayEndOverviewBaseUsers(tasks: Array<{
  task_kind?: any
  status?: any
  cleaning_status?: any
  inspection_status?: any
  cleaning_task_ids?: any
  inspection_task_ids?: any
  assignee_id?: any
  cleaner_id?: any
  inspector_id?: any
  assignee_name?: any
  cleaner_name?: any
  inspector_name?: any
  id?: any
  source_id?: any
  title?: any
  property?: { code?: any } | null
}>): DayEndOverviewUser[] {
  const map = new Map<string, { userId: string; userName: string; roles: Set<DayEndTargetRole>; roomCodes: Set<string>; stats: { cleaning: DayEndRoleStats; inspection: DayEndRoleStats } }>()
  const seenRoleRooms = new Set<string>()
  for (const task of tasks || []) {
    const st = String(task.status || '').trim().toLowerCase()
    if (st === 'cancelled' || st === 'canceled') continue
    const kind = String(task.task_kind || '').trim().toLowerCase()
    const code = String(task.property?.code || '').trim()
    const hasCleaningWork =
      kind === 'cleaning'
      || (Array.isArray(task.cleaning_task_ids) && task.cleaning_task_ids.length > 0)
      || !!String(task.cleaning_status || '').trim()
    const hasInspectionWork =
      kind === 'inspection'
      || (Array.isArray(task.inspection_task_ids) && task.inspection_task_ids.length > 0)
      || !!String(task.inspection_status || '').trim()
    if (hasCleaningWork) {
      const cleanerId = resolveCleaningProgressUserId(task)
      if (cleanerId) {
        const cleaningStatus = String(task.cleaning_status || (kind === 'cleaning' ? task.status : '') || '').trim().toLowerCase()
        const progressKey = ['cleaning', cleanerId, dayEndProgressIdentity(task, code)].join('|')
        if (!seenRoleRooms.has(progressKey)) {
          seenRoleRooms.add(progressKey)
          const entry = map.get(cleanerId) || {
            userId: cleanerId,
            userName: String(task.cleaner_name || task.assignee_name || '').trim(),
            roles: new Set<DayEndTargetRole>(),
            roomCodes: new Set<string>(),
            stats: { cleaning: createDayEndRoleStats(), inspection: createDayEndRoleStats() },
          }
          entry.roles.add('cleaning')
          if (!entry.userName) entry.userName = String(task.cleaner_name || task.assignee_name || '').trim()
          if (code) entry.roomCodes.add(code)
          applyDayEndRoleProgress(entry.stats.cleaning, cleaningStatus, code, isCleaningWorkSubmitted(cleaningStatus))
          map.set(cleanerId, entry)
        }
      }
    }
    if (hasInspectionWork) {
      const inspectorId = String(task.inspector_id || (kind === 'inspection' ? task.assignee_id : '') || '').trim()
      if (!inspectorId) continue
      const inspectionStatus = String(task.inspection_status || (kind === 'inspection' ? task.status : '') || '').trim().toLowerCase()
      const progressKey = ['inspection', inspectorId, dayEndProgressIdentity(task, code)].join('|')
      if (seenRoleRooms.has(progressKey)) continue
      seenRoleRooms.add(progressKey)
      const entry = map.get(inspectorId) || {
        userId: inspectorId,
        userName: String(task.inspector_name || task.assignee_name || '').trim(),
        roles: new Set<DayEndTargetRole>(),
        roomCodes: new Set<string>(),
        stats: { cleaning: createDayEndRoleStats(), inspection: createDayEndRoleStats() },
      }
      entry.roles.add('inspection')
      if (!entry.userName) entry.userName = String(task.inspector_name || task.assignee_name || '').trim()
      if (code) entry.roomCodes.add(code)
      applyDayEndRoleProgress(entry.stats.inspection, inspectionStatus, code, isInspectionWorkSubmitted(inspectionStatus))
      map.set(inspectorId, entry)
    }
  }
  return Array.from(map.values())
    .map((entry) => ({
      userId: entry.userId,
      userName: entry.userName || entry.userId,
      roles: normalizeDayEndRoles(Array.from(entry.roles.values())),
      roomCodes: Array.from(entry.roomCodes.values()).sort((a, b) => a.localeCompare(b, 'en')),
      complete: null,
      stats: {
        cleaning: { ...entry.stats.cleaning, activeRooms: entry.stats.cleaning.activeRooms.slice().sort((a, b) => a.localeCompare(b, 'en')), doneRooms: entry.stats.cleaning.doneRooms.slice().sort((a, b) => a.localeCompare(b, 'en')) },
        inspection: { ...entry.stats.inspection, activeRooms: entry.stats.inspection.activeRooms.slice().sort((a, b) => a.localeCompare(b, 'en')), doneRooms: entry.stats.inspection.doneRooms.slice().sort((a, b) => a.localeCompare(b, 'en')) },
      },
    }))
    .sort(compareDayEndOverviewUsers)
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

function taskRegionValue(task: WorkTaskItem) {
  return String((task as any).region || task.property?.region || '').trim()
}

const MANAGER_REGION_ORDER = ['West Melbourne', 'Melbourne', 'Docklands', 'Southbank', 'St Kilda'] as const

function managerRegionRank(region0: string) {
  const region = String(region0 || '').trim().toLowerCase()
  if (!region) return Number.POSITIVE_INFINITY
  const idx = MANAGER_REGION_ORDER.findIndex((item) => item.toLowerCase() === region)
  return idx >= 0 ? idx : MANAGER_REGION_ORDER.length
}

function taskCleanerSortValue(task: WorkTaskItem) {
  const cleanerName = String((task as any).cleaner_name || '').trim()
  const cleanerId = String((task as any).cleaner_id || task.assignee_id || '').trim()
  const inspectorName = String((task as any).inspector_name || '').trim()
  const inspectorId = String((task as any).inspector_id || '').trim()
  return cleanerName || cleanerId || inspectorName || inspectorId
}

function taskManagerSearchText(task: WorkTaskItem) {
  return [
    task.property?.code,
    task.property?.address,
    task.title,
    (task as any).region,
    task.property?.region,
    (task as any).cleaner_name,
    (task as any).cleaner_id,
    task.assignee_id,
    (task as any).inspector_name,
    (task as any).inspector_id,
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)
    .join(' ')
}

function compareManagerTaskGrouping(a: WorkTaskItem, b: WorkTaskItem) {
  const ar = taskRegionValue(a)
  const br = taskRegionValue(b)
  const aRegionEmpty = !ar
  const bRegionEmpty = !br
  if (aRegionEmpty !== bRegionEmpty) return aRegionEmpty ? 1 : -1
  const regionRankDelta = managerRegionRank(ar) - managerRegionRank(br)
  if (regionRankDelta) return regionRankDelta
  const regionDelta = ar.localeCompare(br)
  if (regionDelta) return regionDelta

  const ac = taskCleanerSortValue(a)
  const bc = taskCleanerSortValue(b)
  const aCleanerEmpty = !ac
  const bCleanerEmpty = !bc
  if (aCleanerEmpty !== bCleanerEmpty) return aCleanerEmpty ? 1 : -1
  const cleanerDelta = ac.localeCompare(bc)
  if (cleanerDelta) return cleanerDelta

  return 0
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

function taskTagStylePair(tone: TaskTone) {
  if (tone === 'special') return { container: styles.tagSpecial, text: styles.tagSpecialText }
  if (tone === 'pending') return { container: styles.tagPending, text: styles.tagPendingText }
  if (tone === 'danger') return { container: styles.tagDanger, text: styles.tagDangerText }
  if (tone === 'success') return { container: styles.tagSuccess, text: styles.tagSuccessText }
  if (tone === 'info') return { container: styles.tagInfo, text: styles.tagInfoText }
  return { container: styles.tagNormal, text: styles.tagNormalText }
}

function statusPillStylePair(tone: TaskTone) {
  if (tone === 'special') return { pill: styles.statusPurple, text: styles.statusTextPurple }
  if (tone === 'pending') return { pill: styles.statusAmber, text: styles.statusTextAmber }
  if (tone === 'success') return { pill: styles.statusGreen, text: styles.statusTextGreen }
  if (tone === 'neutral') return { pill: styles.statusGray, text: styles.statusTextGray }
  return { pill: styles.statusBlue, text: styles.statusTextBlue }
}

function isDoneLikeStatus(status0: string) {
  const s = String(status0 || '').trim().toLowerCase()
  return s === 'done' || s === 'completed' || s === 'ready' || s === 'keys_hung' || s === 'cleaned' || s === 'restock_pending' || s === 'restocked' || s === 'inspected'
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

function warehouseKeyStatusText(status: string) {
  const s = String(status || '').trim().toLowerCase()
  if (s === 'borrowed' || s === 'in_transit') return '已借出'
  if (s === 'available') return '可借用'
  return s || '未知'
}

function warehouseKeyEventText(action: string) {
  const s = String(action || '').trim().toLowerCase()
  if (s === 'borrow') return '借出'
  if (s === 'return') return '归还'
  if (s === 'handover') return '转交'
  return '更新'
}

function warehouseKeyEventTimeText(value: any, currentDate: string) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const normalized = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(raw)
    ? raw.replace(' ', 'T')
    : raw
  const d = new Date(normalized)
  if (Number.isNaN(d.getTime())) return ''
  const date = ymd(d)
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  return date === String(currentDate || '').slice(0, 10) ? time : `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${time}`
}

function isSouthbankCleaningTask(task: WorkTaskItem) {
  if (task.source_type !== 'cleaning_tasks') return false
  const kind = String(task.task_kind || '').trim().toLowerCase()
  if (kind !== 'cleaning' && kind !== 'inspection') return false
  const status = String(task.status || '').trim().toLowerCase()
  if (status === 'cancelled' || status === 'canceled') return false
  const region = String(task.property?.region || '').trim().toLowerCase().replace(/\s+/g, '')
  return region.includes('southbank')
}

function isCleaningTaskAssignedToUser(task: WorkTaskItem, userId: string) {
  const uid = String(userId || '').trim()
  if (!uid || task.source_type !== 'cleaning_tasks') return false
  const kind = String(task.task_kind || '').trim().toLowerCase()
  if (kind === 'inspection') return String((task as any).inspector_id || task.assignee_id || '').trim() === uid
  if (kind === 'cleaning') return String((task as any).cleaner_id || task.assignee_id || '').trim() === uid
  return String((task as any).cleaner_id || (task as any).inspector_id || task.assignee_id || '').trim() === uid
}

function hasMobileExecutor(task: WorkTaskItem) {
  if (task.source_type !== 'cleaning_tasks') return !!String(task.assignee_id || '').trim()
  const kind = String(task.task_kind || '').trim().toLowerCase()
  if (kind === 'inspection') return !!String((task as any).inspector_id || task.assignee_id || '').trim()
  if (kind === 'cleaning') return !!String((task as any).cleaner_id || task.assignee_id || '').trim()
  return !!String((task as any).cleaner_id || (task as any).inspector_id || task.assignee_id || '').trim()
}

function isPropertyFollowupTask(task: WorkTaskItem) {
  const source = String(task.source_type || '').trim()
  return source === 'property_maintenance' || source === 'property_deep_cleaning' || source === 'property_daily_necessities'
}

export default function TasksScreen(props: Props) {
  const { status, user, token } = useAuth()
  const { locale, t } = useI18n()
  const { width: windowWidth, fontScale } = useWindowDimensions()
  const prefersWrappedSegments = windowWidth < 360 || fontScale >= 1.25
  const prefersCompactTaskHeader = windowWidth <= 390 || fontScale >= 1.1
  const roleNames = useMemo(() => {
    const arr = Array.isArray((user as any)?.roles) ? ((user as any).roles as any[]) : []
    const ids = arr.map((x) => String(x || '').trim()).filter(Boolean)
    const primary = String((user as any)?.role || '').trim()
    if (primary) ids.unshift(primary)
    return Array.from(new Set(ids))
  }, [user])
  const canManagerMode = useMemo(() => isManagerRole(roleNames), [roleNames])
  const canSeeDayEndOverview = useMemo(() => roleNames.includes('admin') || roleNames.includes('offline_manager'), [roleNames])
  const canTaskManagerView = useMemo(() => isTaskManagerUser(user), [user])
  const canSwitchMode = useMemo(() => canSwitchTaskMode(user), [user])
  const [mode, setMode] = useState<'cleaning' | 'manager'>('cleaning')
  const [period, setPeriod] = useState<Period>('today')
  const [selectedDate, setSelectedDate] = useState<string>(() => ymd(new Date()))
  const [hasInit, setHasInit] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [view, setView] = useState<WorkTasksView>('all')
  const [reorderMode, setReorderMode] = useState(false)
  const [orderMarks, setOrderMarks] = useState<Record<string, string>>({})
  const [orderList, setOrderList] = useState<string[]>([])
  const [savingOrder, setSavingOrder] = useState(false)
  const [, bump] = useState(0)
  const notifiedInspectionsRef = useRef<Record<string, boolean>>({})
  const [banner, setBanner] = useState<{ title: string; message: string } | null>(null)
  const [dayEndComplete, setDayEndComplete] = useState<boolean | null>(null)
  const [dayEndOverviewUsers, setDayEndOverviewUsers] = useState<DayEndOverviewUser[]>([])
  const [dayEndOverviewLoading, setDayEndOverviewLoading] = useState(false)
  const [staffProgressCollapsed, setStaffProgressCollapsed] = useState(false)
  const [warehouseKey, setWarehouseKey] = useState<WarehouseKeyStatus | null>(null)
  const [warehouseKeyLoading, setWarehouseKeyLoading] = useState(false)
  const [warehouseKeyBusy, setWarehouseKeyBusy] = useState(false)
  const [warehouseKeyExpanded, setWarehouseKeyExpanded] = useState(false)
  const [warehouseTransferOpen, setWarehouseTransferOpen] = useState(false)
  const [warehouseNote, setWarehouseNote] = useState('')
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)
  const [quickCreateMode, setQuickCreateMode] = useState<QuickCreateMode>('checkin')
  const [quickCreateBusy, setQuickCreateBusy] = useState(false)
  const [quickCreateProperty, setQuickCreateProperty] = useState('')
  const [quickCreateDate, setQuickCreateDate] = useState(() => ymd(new Date()))
  const [quickCreateTime, setQuickCreateTime] = useState('3pm')
  const [quickCreateOldCode, setQuickCreateOldCode] = useState('')
  const [quickCreateNewCode, setQuickCreateNewCode] = useState('')
  const [quickCreateNights, setQuickCreateNights] = useState('')
  const [quickCreateGuestNote, setQuickCreateGuestNote] = useState('')
  const [quickCreateOfflineTitle, setQuickCreateOfflineTitle] = useState('')
  const [quickCreateOfflineContent, setQuickCreateOfflineContent] = useState('')
  const [quickCreateOfflineTaskType, setQuickCreateOfflineTaskType] = useState<QuickCreateOfflineTaskType>('other')
  const [quickCreateUrgency, setQuickCreateUrgency] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium')
  const [quickCreatePropertyOptions, setQuickCreatePropertyOptions] = useState<QuickCreatePropertyOption[]>([])
  const bannerTimerRef = useRef<any>(null)
  const [search, setSearch] = useState('')
  const weekRowRef = useRef<ScrollView>(null)
  const weekPagerRef = useRef<ScrollView>(null)
  const weekPagerAdjustingRef = useRef(false)
  const lastAlertsFetchRef = useRef(0)
  const shownAlertIdsRef = useRef<Record<string, boolean>>({})
  const warehouseNoticeSeenRef = useRef('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [taskNoticeArmed, setTaskNoticeArmed] = useState(false)
  const [checkedOutPendingMap, setCheckedOutPendingMap] = useState<Record<string, boolean>>({})
  const [taskCacheHint, setTaskCacheHint] = useState<TaskCacheHint>(null)
  const [isShowingCachedTasks, setIsShowingCachedTasks] = useState(false)
  const [collapsedTaskIds, setCollapsedTaskIds] = useState<Record<string, boolean>>({})
  const [copiedFeedbackKey, setCopiedFeedbackKey] = useState<string | null>(null)
  const copyFeedbackTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const allowDerivedTaskNotices = String(token || '').startsWith('local:')
  const [keyQueueByTaskId, setKeyQueueByTaskId] = useState<Record<string, true>>({})

  const reloadKeyQueueState = useCallback(async () => {
    const items = await listKeyUploadQueueItems().catch(() => [])
    const next: Record<string, true> = {}
    for (const item of items || []) {
      const key = String(item.cleaning_task_id || '').trim()
      if (key) next[key] = true
    }
    setKeyQueueByTaskId(next)
  }, [])

  const handleTaskRefreshFailure = useCallback((message: string, preserveError: boolean) => {
    const snapshot = getWorkTasksSnapshot()
    const cachedItems = Array.isArray(snapshot.items) ? snapshot.items : []
    if (cachedItems.length > 0) {
      setIsShowingCachedTasks(true)
      setTaskCacheHint(buildTaskCacheHint(snapshot.lastFullSyncTimestamp || null, true))
      if (!preserveError) setLoadError(null)
      return
    }
    setIsShowingCachedTasks(false)
    setTaskCacheHint(null)
    if (!preserveError) setLoadError(message)
  }, [])

  const toggleTaskCollapsed = useCallback((taskId: string) => {
    setCollapsedTaskIds((prev) => ({ ...prev, [taskId]: !prev[taskId] }))
  }, [])

  const flashCopiedFeedback = useCallback((key: string) => {
    const prevTimer = copyFeedbackTimersRef.current[key]
    if (prevTimer) clearTimeout(prevTimer)
    setCopiedFeedbackKey(key)
    copyFeedbackTimersRef.current[key] = setTimeout(() => {
      setCopiedFeedbackKey((prev) => (prev === key ? null : prev))
      delete copyFeedbackTimersRef.current[key]
    }, 1600)
  }, [])

  useEffect(() => {
    return () => {
      Object.values(copyFeedbackTimersRef.current).forEach((timer) => clearTimeout(timer))
      copyFeedbackTimersRef.current = {}
    }
  }, [])

  useEffect(() => {
    void reloadKeyQueueState()
    const unsubscribe = subscribeKeyUploadQueue(() => {
      void reloadKeyQueueState()
    })
    return unsubscribe
  }, [reloadKeyQueueState])

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
    if (!(canManagerMode && mode === 'manager') && search) setSearch('')
  }, [canManagerMode, mode, search])

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
      if (view !== 'all' && view !== 'mine') setView('all')
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
    if (status !== 'signedIn' || !user?.id || !token) return
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
      setIsShowingCachedTasks(false)
      setTaskCacheHint(null)
      setLoadError(null)
    } catch (e: any) {
      handleTaskRefreshFailure(String(e?.message || '加载失败'), preserveError)
      throw e
    } finally {
      if (!silent) setRefreshing(false)
    }
  }, [effectiveView, handleTaskRefreshFailure, range.date_from, range.date_to, status, token, user?.id])

  useEffect(() => {
    if (status === 'signedIn' && token && user?.id) return
    deactivateWorkTasksRealtime()
    setTaskCacheHint(null)
    setIsShowingCachedTasks(false)
  }, [status, token, user?.id])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (status !== 'signedIn' || !user?.id || !token) return
      setTaskNoticeArmed(false)
      await initNoticesStore().catch(() => null)
      const bucketKey = makeWorkTasksBucketKey({ userId: user.id, date_from: range.date_from, date_to: range.date_to, view: effectiveView })
      await initWorkTasksStore({ bucketKey })
      if (cancelled) return
      const hydratedSnapshot = getWorkTasksSnapshot()
      const hasCachedItems = Array.isArray(hydratedSnapshot.items) && hydratedSnapshot.items.length > 0
      setHasInit(true)
      setLoadError(null)
      setIsShowingCachedTasks(hasCachedItems)
      setTaskCacheHint(hasCachedItems ? buildTaskCacheHint(hydratedSnapshot.lastFullSyncTimestamp || null, false) : null)
      try {
        await refreshTasksData({ silent: true })
      } catch (e: any) {
        if (!cancelled) handleTaskRefreshFailure(String((e as any)?.message || '加载失败'), false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [effectiveView, handleTaskRefreshFailure, range.date_from, range.date_to, refreshTasksData, status, token, user?.id])

  useEffect(() => {
    if (status !== 'signedIn' || !token || !user?.id) return
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
  }, [props.navigation, refreshTasksData, status, token, user?.id])

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
    const list = (tasksByDate.get(selectedDate) || []).filter((task) => {
      if (!(canManagerMode && mode === 'manager' && view === 'all')) return hasMobileExecutor(task)
      if (task.source_type === 'cleaning_tasks') return true
      if (isPropertyFollowupTask(task)) return hasMobileExecutor(task)
      return true
    }).slice()
    list.sort((a, b) => {
      if (period === 'today') {
        const aStatus = String(a.status || '').trim().toLowerCase()
        const bStatus = String(b.status || '').trim().toLowerCase()
        const aDone = aStatus === 'done' || aStatus === 'completed' || aStatus === 'keys_hung'
        const bDone = bStatus === 'done' || bStatus === 'completed' || bStatus === 'keys_hung'
        if (aDone !== bDone) return aDone ? 1 : -1
      }

      if (canManagerMode && mode === 'manager') {
        const managerGroupDelta = compareManagerTaskGrouping(a, b)
        if (managerGroupDelta) return managerGroupDelta
      }

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
    return list
  }, [canManagerMode, mode, period, selectedDate, tasksByDate, view])

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
  const currentUserId = String((user as any)?.id || '').trim()
  const showWarehouseKeyCard = useMemo(() => {
    if (period !== 'today') return false
    if (!currentUserId) return false
    const managerCanViewSouthbankKeys = canSeeDayEndOverview && canManagerMode && mode === 'manager' && view === 'all'
    return renderTasks.some((task) => isSouthbankCleaningTask(task) && (managerCanViewSouthbankKeys || isCleaningTaskAssignedToUser(task, currentUserId)))
  }, [canManagerMode, canSeeDayEndOverview, currentUserId, mode, period, renderTasks, view])
  const loadWarehouseKey = useCallback(async () => {
    if (!token || !showWarehouseKeyCard || !warehouseKeyExpanded) return
    setWarehouseKeyLoading(true)
    try {
      const data = await getWarehouseKeyStatus(token, { key_code: 'msq', date: dayEndDate })
      setWarehouseKey(data)
    } catch {
      setWarehouseKey(null)
    } finally {
      setWarehouseKeyLoading(false)
    }
  }, [dayEndDate, showWarehouseKeyCard, token, warehouseKeyExpanded])
  const submitWarehouseKeyEvent = useCallback(async (action: 'borrow' | 'return' | 'handover', toUserId?: string) => {
    if (!token) return
    try {
      setWarehouseKeyBusy(true)
      await createWarehouseKeyEvent(token, {
        key_code: 'msq',
        action,
        to_user_id: toUserId,
        note: warehouseNote.trim() || undefined,
        task_date: dayEndDate,
      })
      setWarehouseNote('')
      setWarehouseTransferOpen(false)
      await loadWarehouseKey()
      const title = action === 'borrow' ? '已借钥匙' : action === 'return' ? '已还钥匙' : '已转交钥匙'
      showBanner(title, 'MSQ 仓库钥匙状态已更新')
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '更新失败'))
    } finally {
      setWarehouseKeyBusy(false)
    }
  }, [dayEndDate, loadWarehouseKey, t, token, warehouseNote])
  const callWarehouseKeyHolder = useCallback(async () => {
    const phone = String(warehouseKey?.key?.holder_phone_au || '').trim()
    if (!phone) {
      Alert.alert(t('common_error'), '借出人手机号缺失')
      return
    }
    const url = `tel:${normalizeAuMobile(phone)}`
    try {
      const ok = await Linking.canOpenURL(url)
      if (!ok) throw new Error('not supported')
      await Linking.openURL(url)
    } catch {
      Alert.alert(t('common_error'), `无法拨打：${phone}`)
    }
  }, [t, warehouseKey])
  const isCleanerSelf = useMemo(() => {
    return roleNames.includes('cleaner') || roleNames.includes('cleaner_inspector')
  }, [roleNames.join('|')])
  const isInspectorSelf = useMemo(() => {
    return roleNames.includes('cleaning_inspector') || roleNames.includes('cleaner_inspector')
  }, [roleNames.join('|')])
  const isInspectorOnlySelf = useMemo(() => isInspectorOnlyRole(roleNames), [roleNames])
  useEffect(() => {
    setWarehouseKeyExpanded(false)
    setWarehouseTransferOpen(false)
  }, [period, selectedDate])

  useEffect(() => {
    if (!showWarehouseKeyCard) {
      setWarehouseKey(null)
      setWarehouseKeyExpanded(false)
      setWarehouseTransferOpen(false)
      return
    }
    if (!warehouseKeyExpanded) {
      setWarehouseTransferOpen(false)
      return
    }
    loadWarehouseKey()
    const nav: any = props.navigation as any
    const unsub = nav && typeof nav.addListener === 'function' ? nav.addListener('focus', loadWarehouseKey) : null
    return () => {
      try {
        if (typeof unsub === 'function') unsub()
      } catch {}
    }
  }, [loadWarehouseKey, props.navigation, showWarehouseKeyCard, warehouseKeyExpanded])

  useEffect(() => {
    if (!showWarehouseKeyCard || !warehouseKeyExpanded) return
    let cancelled = false
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' || cancelled) return
      void loadWarehouseKey()
    })
    return () => {
      cancelled = true
      try {
        sub.remove()
      } catch {}
    }
  }, [loadWarehouseKey, showWarehouseKeyCard, warehouseKeyExpanded])

  useEffect(() => {
    if (!showWarehouseKeyCard || !warehouseKeyExpanded) return
    let cancelled = false
    const refreshForWarehouseNotice = () => {
      const notice = (getNoticesSnapshot().items || []).find((item) => {
        const data = (item as any)?.data || {}
        return String(data.kind || '').trim() === 'warehouse_key_updated'
          || String(data.entity || '').trim() === 'warehouse_key'
      })
      const noticeId = String((notice as any)?.data?.event_id || notice?.id || '').trim()
      if (!noticeId || warehouseNoticeSeenRef.current === noticeId) return
      warehouseNoticeSeenRef.current = noticeId
      if (!cancelled) void loadWarehouseKey()
    }
    initNoticesStore().then(refreshForWarehouseNotice).catch(() => null)
    const unsub = subscribeNotices(refreshForWarehouseNotice)
    return () => {
      cancelled = true
      try {
        unsub()
      } catch {}
    }
  }, [loadWarehouseKey, showWarehouseKeyCard, warehouseKeyExpanded])
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
  const selfDayEndRoles = useMemo(() => {
    return normalizeDayEndRoles(
      selfDayEndTasks.map((task) => {
        const kind = String(task.task_kind || '').trim().toLowerCase()
        return kind === 'inspection' ? 'inspection' : 'cleaning'
      }),
    )
  }, [selfDayEndTasks])
  const dayEndOverviewDisplayUsers = useMemo(
    () => buildDayEndOverviewDisplayUsers(dayEndOverviewUsers),
    [dayEndOverviewUsers],
  )
  const dayEndViewerTarget = useMemo(() => {
    const currentUserId = String((user as any)?.id || '').trim()
    if ((isCleanerSelf || isInspectorSelf) && currentUserId) return { userId: currentUserId, userName: String((user as any)?.username || '').trim(), roles: selfDayEndRoles, roomCodes: [] as string[] }
    if (!canSeeDayEndOverview || !(canManagerMode && mode === 'manager')) return { userId: '', userName: '', roles: [] as DayEndTargetRole[], roomCodes: [] as string[] }
    if (dayEndOverviewUsers.length !== 1) return { userId: '', userName: '', roles: [] as DayEndTargetRole[], roomCodes: [] as string[] }
    const [entry] = dayEndOverviewUsers
    return { userId: entry.userId, userName: entry.userName, roles: entry.roles, roomCodes: entry.roomCodes }
  }, [canManagerMode, canSeeDayEndOverview, dayEndOverviewUsers, isCleanerSelf, isInspectorSelf, mode, selfDayEndRoles, user])
  const dayEndViewerRoles = useMemo(
    () => ((isCleanerSelf || isInspectorSelf) ? selfDayEndRoles : normalizeDayEndRoles(dayEndViewerTarget.roles || [])),
    [dayEndViewerTarget.roles, isCleanerSelf, isInspectorSelf, selfDayEndRoles],
  )
  const dayEndViewerInspectorOnly = dayEndViewerRoles.includes('inspection') && !dayEndViewerRoles.includes('cleaning')
  const dayEndViewerHasCleaning = dayEndViewerRoles.includes('cleaning')
  const dayEndViewerHasInspection = dayEndViewerRoles.includes('inspection')
  const dayEndTaskRoomCodes = useMemo(() => {
    if (canManagerMode && !isCleanerSelf && !isInspectorSelf) return (dayEndViewerTarget.roomCodes || []).slice().sort((a, b) => a.localeCompare(b, 'en'))
    return Array.from(
      new Set(
        selfDayEndTasks
          .map((t) => String(t.property?.code || '').trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, 'en'))
  }, [canManagerMode, dayEndViewerTarget.roomCodes, isCleanerSelf, isInspectorSelf, selfDayEndTasks])

  useEffect(() => {
    if (!token) return
    if (period !== 'today') return
    if (!(isCleanerSelf || isInspectorSelf ? selfDayEndTasks.length : dayEndViewerTarget.userId)) return
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
  }, [canManagerMode, dayEndDate, dayEndViewerTarget.userId, isCleanerSelf, isInspectorOnlySelf, isInspectorSelf, period, props.navigation, selfDayEndTasks.length, token])
  useEffect(() => {
    if (!token || !canSeeDayEndOverview || !(canManagerMode && mode === 'manager') || period !== 'today') {
      setDayEndOverviewUsers([])
      setDayEndOverviewLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setDayEndOverviewLoading(true)
      try {
        const tasks = await listWorkTasks(token, { date_from: dayEndDate, date_to: dayEndDate, view: 'all' })
        const baseUsers = buildDayEndOverviewBaseUsers(tasks.filter((task) => String(task.source_type || '').trim() === 'cleaning_tasks'))
        if (cancelled) return
        if (!baseUsers.length) {
          setDayEndOverviewUsers([])
          setDayEndOverviewLoading(false)
          return
        }
        setDayEndOverviewUsers(baseUsers)
        const rows = await Promise.all(baseUsers.map(async (entry) => {
          const r = await listDayEndHandover(token, { date: dayEndDate, user_id: entry.userId })
          const complete = !!(r as any)?.submitted_at
          return { ...entry, complete }
        }))
        if (!cancelled) {
          setDayEndOverviewUsers(rows.sort(compareDayEndOverviewUsers))
          setDayEndOverviewLoading(false)
        }
      } catch {
        if (!cancelled) {
          setDayEndOverviewUsers((prev) => prev.map((entry) => ({ ...entry, complete: null })))
          setDayEndOverviewLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canManagerMode, canSeeDayEndOverview, dayEndDate, mode, period, token])
  const visibleTasks = useMemo(() => {
    const q = search.trim().toLowerCase()
    // Manager search must stay within the currently selected day, even when the
    // user is browsing the week/month containers.
    const base = renderTasks
    const filtered = q
      ? base.filter((t) => taskManagerSearchText(t).includes(q))
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
      if (canManagerMode && mode === 'manager') {
        const managerGroupDelta = compareManagerTaskGrouping(a, b)
        if (managerGroupDelta) return managerGroupDelta
      }
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
  }, [renderTasks, search, canManagerMode, mode])
  const showDayEndCard = period === 'today'
    && (isCleanerSelf || isInspectorSelf ? selfDayEndTasks.length > 0 : false)
    && !!dayEndViewerTarget.userId
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

  function openDayEndScreen(params?: { userId?: string; userName?: string; taskRoomCodes?: string[]; targetRoles?: DayEndTargetRole[]; focus?: 'key' | 'dirty' | 'consumable' | 'reject'; overviewMode?: boolean; overviewUsers?: DayEndOverviewUser[] }) {
    props.navigation.navigate('DayEndBackupKeys', {
      date: dayEndDate,
      ...(params?.focus ? { focus: params.focus } : {}),
      ...(params?.taskRoomCodes?.length ? { taskRoomCodes: params.taskRoomCodes } : {}),
      ...(params?.targetRoles?.length ? { targetRoles: params.targetRoles } : {}),
      ...(params?.userId ? { userId: params.userId } : {}),
      ...(params?.userName ? { userName: params.userName } : {}),
      ...(params?.overviewMode ? { overviewMode: true } : {}),
      ...(params?.overviewUsers?.length ? { overviewUsers: params.overviewUsers } : {}),
    })
  }

  function openQuickCreate(mode0: QuickCreateMode = 'checkin') {
    setQuickCreateMode(mode0)
    setQuickCreateDate(selectedDate)
    setQuickCreateTime(mode0 === 'checkout' ? '10am' : '3pm')
    setQuickCreateProperty('')
    setQuickCreateOldCode('')
    setQuickCreateNewCode('')
    setQuickCreateNights('')
    setQuickCreateGuestNote('')
    setQuickCreateOfflineTitle('')
    setQuickCreateOfflineContent('')
    setQuickCreateOfflineTaskType('other')
    setQuickCreateUrgency('medium')
    setQuickCreateOpen(true)
  }

  function resolveQuickCreateProperty(value: string) {
    const raw = String(value || '').trim()
    if (!raw) return null
    const upper = raw.toUpperCase()
    return quickCreatePropertyOptions.find((item) => String(item.code || '').trim().toUpperCase() === upper || String(item.id || '').trim().toUpperCase() === upper) || null
  }

  async function submitQuickCreate() {
    if (!token || !user?.id) return
    const property = String(quickCreateProperty || '').trim()
    const date = String(quickCreateDate || '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert(t('common_error'), '日期格式应为 YYYY-MM-DD')
      return
    }
    try {
      setQuickCreateBusy(true)
      if (quickCreateMode === 'offline') {
        const title = String(quickCreateOfflineTitle || '').trim()
        if (!title) {
          Alert.alert(t('common_error'), '请填写线下任务标题')
          return
        }
        const propertyOption = property ? resolveQuickCreateProperty(property) : null
        if (quickCreateOfflineTaskType === 'property' && !propertyOption) {
          Alert.alert(t('common_error'), '房源任务需要从房号提示中选择房号')
          return
        }
        if (property && !propertyOption) {
          Alert.alert(t('common_error'), '请从房号提示中选择房号')
          return
        }
        await createCleaningOfflineTask(token, {
          date,
          task_type: quickCreateOfflineTaskType,
          title,
          content: String(quickCreateOfflineContent || '').trim(),
          kind: 'manual',
          status: 'todo',
          urgency: quickCreateUrgency,
          property_id: propertyOption?.id || null,
          assignee_id: null,
        })
      } else {
        if (!property) {
          Alert.alert(t('common_error'), '请填写房号')
          return
        }
        const propertyOption = resolveQuickCreateProperty(property)
        if (!propertyOption) {
          Alert.alert(t('common_error'), '请从房号提示中选择房号')
          return
        }
        const time = String(quickCreateTime || '').trim() || (quickCreateMode === 'checkout' ? '10am' : '3pm')
        const nightsRaw = Number(String(quickCreateNights || '').trim())
        const nights = Number.isFinite(nightsRaw) && nightsRaw >= 0 ? Math.trunc(nightsRaw) : null
        await createManualCleaningTask(token, {
          create_mode: quickCreateMode,
          task_date: date,
          property_id: propertyOption.id,
          status: 'pending',
          keys_required: 1,
          old_code: quickCreateMode === 'checkout' ? (String(quickCreateOldCode || '').trim() || null) : null,
          new_code: quickCreateMode === 'checkin' ? (String(quickCreateNewCode || '').trim() || null) : null,
          checkout_time: quickCreateMode === 'checkout' ? time : null,
          checkin_time: quickCreateMode === 'checkin' ? time : null,
          nights_override: quickCreateMode === 'checkin' ? nights : null,
          guest_special_request: String(quickCreateGuestNote || '').trim() || null,
        })
      }
      setQuickCreateOpen(false)
      showBanner('已新增', quickCreateMode === 'offline' ? '线下任务已新增。' : '清洁任务已新增，订单同步后会自动关联。')
      await refreshTasksData({ silent: true, preserveError: true })
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '新增失败'))
    } finally {
      setQuickCreateBusy(false)
    }
  }

  useEffect(() => {
    if (!quickCreateOpen || !token) return
    let cancelled = false
    ;(async () => {
      try {
        const rows = await listCleaningAppPropertyCodes(token)
        if (!cancelled) setQuickCreatePropertyOptions(rows)
      } catch {
        if (!cancelled) setQuickCreatePropertyOptions([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [quickCreateOpen, token])

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
      const title = code ? `${code} · 房间已挂钥匙` : '房间已挂钥匙'
      const msg = fresh.length > 1 ? `${code} 等 ${fresh.length} 个房间已挂钥匙` : '挂钥匙视频已上传，房间钥匙已挂好'
      showBanner(title, msg)
      for (const t of fresh) {
        const code2 = String(t.property?.code || t.title || '').trim()
        const addr2 = String(t.property?.address || '').trim()
        const body = [code2 ? `房源：${code2}` : '', addr2 ? `地址：${addr2}` : '', '状态：已挂钥匙'].filter(Boolean).join('\n')
        await prependNotice({
          id: `insp:keys_hung:${t.id}`,
          type: 'key',
          title: code2 ? `${code2} · 房间已挂钥匙` : '房间已挂钥匙',
          summary: '挂钥匙视频已上传，房间钥匙已挂好',
          content: body || '状态：已挂钥匙',
          data: { kind: 'keys_hung', property_code: code2 || undefined, task_id: t.id },
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
      const localPatches: Array<{ id: string; patch: Partial<WorkTaskItem> }> = []
      for (const { task, mark } of marks) {
        if (!isReorderableTask(task)) continue
        if (task.source_type !== 'cleaning_tasks') {
          workTaskIds.push(String(task.id))
          localPatches.push({ id: String(task.id), patch: { sort_index: mark } as Partial<WorkTaskItem> })
          continue
        }
        const ids = Array.isArray((task as any).source_ids) && (task as any).source_ids.length ? (task as any).source_ids.map((x: any) => String(x)) : [String(task.source_id)]
        if (task.task_kind === 'cleaning') {
          cleanerGroups.push(ids)
          localPatches.push({ id: String(task.id), patch: { sort_index: mark, sort_index_cleaner: mark } as Partial<WorkTaskItem> })
        } else if (task.task_kind === 'inspection') {
          inspectorGroups.push(ids)
          localPatches.push({ id: String(task.id), patch: { sort_index: mark, sort_index_inspector: mark } as Partial<WorkTaskItem> })
        }
      }
      await Promise.all([
        workTaskIds.length ? reorderWorkTasks(token, { date: selectedDate, task_ids: workTaskIds }) : Promise.resolve(null),
        cleanerGroups.length ? reorderCleaningTasks(token, { kind: 'cleaner', date: selectedDate, groups: cleanerGroups }) : Promise.resolve(null),
        inspectorGroups.length ? reorderCleaningTasks(token, { kind: 'inspector', date: selectedDate, groups: inspectorGroups }) : Promise.resolve(null),
      ])
      await patchWorkTaskItems(localPatches)
      setReorderMode(false)
      showBanner('已保存', '顺序已保存')
      void refreshWorkTasksFromServer({ token, userId: user.id, date_from: range.date_from, date_to: range.date_to, view: canManagerMode && mode === 'manager' ? view : 'mine' }).catch(() => null)
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
  const warehouseKeyRow = warehouseKey?.key || null
  const warehouseKeyEvents = warehouseKey?.events || []
  const warehouseKeyCandidates = useMemo(() => {
    return (warehouseKey?.candidates || [])
      .filter((item) => String(item.id || '').trim() && String(item.id || '').trim() !== currentUserId)
      .slice(0, 20)
  }, [currentUserId, warehouseKey])
  const warehouseHolderName = String(warehouseKeyRow?.holder_name || '').trim()
  const warehouseHolderId = String(warehouseKeyRow?.holder_user_id || '').trim()
  const warehouseHolderPhone = String((warehouseKeyRow as any)?.holder_phone_au || '').trim()
  const warehouseIsHeldByMe = !!currentUserId && !!warehouseHolderId && warehouseHolderId === currentUserId
  const warehouseStatus = warehouseKeyStatusText(String(warehouseKeyRow?.status || 'available'))
  const warehouseLatest = warehouseKeyEvents[0] || null
  const warehouseLatestTime = warehouseKeyEventTimeText(
    warehouseLatest?.created_at || warehouseKeyRow?.updated_at,
    dayEndDate,
  )
  const quickCreatePropertyMatches = useMemo(() => {
    const q = String(quickCreateProperty || '').trim().toLowerCase()
    if (!q) return []
    const rows = quickCreatePropertyOptions.filter((item) => {
      return String(item.code || '').toLowerCase().includes(q) || String(item.id || '').toLowerCase().includes(q)
    })
    return rows.slice(0, 20)
  }, [quickCreateProperty, quickCreatePropertyOptions])

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
            onRefresh={() => {
              void refreshTasksData()
              if (showWarehouseKeyCard) void loadWarehouseKey()
            }}
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
          <View style={[styles.segment, prefersWrappedSegments ? styles.segmentWrapResponsive : null]}>
            <Pressable
              onPress={() => {
                setPeriod('today')
                setSelectedDate(ymd(new Date()))
              }}
              style={({ pressed }) => [styles.segmentItem, prefersWrappedSegments ? styles.segmentItemResponsive : null, period === 'today' ? styles.segmentItemActive : null, pressed ? styles.segmentPressed : null]}
            >
              <Text style={[styles.segmentText, period === 'today' ? styles.segmentTextActive : null]}>{t('tasks_period_today')}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setPeriod('week')
                setSelectedDate(ymd(new Date()))
              }}
              style={({ pressed }) => [styles.segmentItem, prefersWrappedSegments ? styles.segmentItemResponsive : null, period === 'week' ? styles.segmentItemActive : null, pressed ? styles.segmentPressed : null]}
            >
              <Text style={[styles.segmentText, period === 'week' ? styles.segmentTextActive : null]}>{t('tasks_period_week')}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setPeriod('month')
                setSelectedDate(ymd(new Date()))
              }}
              style={({ pressed }) => [styles.segmentItem, prefersWrappedSegments ? styles.segmentItemResponsive : null, period === 'month' ? styles.segmentItemActive : null, pressed ? styles.segmentPressed : null]}
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
            <View style={[styles.segment, prefersWrappedSegments ? styles.segmentWrapResponsive : null]}>
              <Pressable
                onPress={() => {
                  setMode('cleaning')
                  setView('mine')
                }}
                style={({ pressed }) => [styles.segmentItem, prefersWrappedSegments ? styles.segmentItemResponsive : null, mode === 'cleaning' ? styles.segmentItemActive : null, pressed ? styles.segmentPressed : null]}
              >
                <Text style={[styles.segmentText, mode === 'cleaning' ? styles.segmentTextActive : null]}>清洁</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setMode('manager')
                  setView('all')
                }}
                style={({ pressed }) => [styles.segmentItem, prefersWrappedSegments ? styles.segmentItemResponsive : null, mode === 'manager' ? styles.segmentItemActive : null, pressed ? styles.segmentPressed : null]}
              >
                <Text style={[styles.segmentText, mode === 'manager' ? styles.segmentTextActive : null]}>管理</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {canSeeDayEndOverview && canManagerMode && mode === 'manager' && period === 'today' ? (
          <View style={styles.staffProgressCard}>
            <Pressable
              accessibilityLabel="staff-progress-toggle"
              onPress={() => setStaffProgressCollapsed((prev) => !prev)}
              style={({ pressed }) => [styles.staffProgressHeader, pressed ? styles.segmentPressed : null]}
            >
              <View style={styles.staffProgressHeaderMain}>
                <Text style={styles.staffProgressTitle}>今日工作情况</Text>
                <Text style={styles.staffProgressHint}>查看清洁与检查进度</Text>
              </View>
              <Ionicons
                name={staffProgressCollapsed ? 'chevron-down' : 'chevron-up'}
                size={moderateScale(18)}
                color="#6B7280"
              />
            </Pressable>
            {!staffProgressCollapsed ? (
              <>
                <View style={styles.staffProgressList}>
                  {dayEndOverviewLoading && !dayEndOverviewUsers.length ? (
                    <Text style={styles.staffProgressEmpty}>正在加载今天的人员工作情况...</Text>
                  ) : null}
                  {!dayEndOverviewLoading && !dayEndOverviewDisplayUsers.length ? (
                    <Text style={styles.staffProgressEmpty}>今天暂无清洁或检查任务。</Text>
                  ) : null}
                  {dayEndOverviewDisplayUsers.map((entry) => {
                    const cleaningLine = entry.displayRole === 'cleaning' ? formatDayEndRoleStats('清洁', entry.stats?.cleaning) : ''
                    const inspectionLine = entry.displayRole === 'inspection' ? formatDayEndRoleStats('检查', entry.stats?.inspection) : ''
                    return (
                      <Pressable
                        key={`${entry.displayRole}:${entry.userId}`}
                        onPress={() => openDayEndScreen({ userId: entry.userId, userName: entry.userName, taskRoomCodes: entry.roomCodes, targetRoles: [entry.displayRole] })}
                        style={({ pressed }) => [styles.staffProgressItem, pressed ? styles.segmentPressed : null]}
                      >
                        <View style={styles.staffProgressMain}>
                          <View style={styles.staffProgressNameRow}>
                            <Text style={styles.staffProgressName}>{entry.userName || entry.userId}</Text>
                            <Text style={styles.staffProgressMeta}>
                              {entry.displayRole === 'inspection' ? '检查人员' : '清洁人员'}
                            </Text>
                          </View>
                          {cleaningLine ? <Text style={styles.staffProgressLine}>{cleaningLine}</Text> : null}
                          {inspectionLine ? <Text style={styles.staffProgressLine}>{inspectionLine}</Text> : null}
                        </View>
                        <View style={[styles.staffProgressStatusPill, entry.complete == null ? styles.staffProgressStatusGray : (entry.complete ? styles.staffProgressStatusGreen : styles.staffProgressStatusAmber)]}>
                          <Text style={[styles.staffProgressStatusText, entry.complete == null ? styles.staffProgressStatusTextGray : (entry.complete ? styles.staffProgressStatusTextGreen : styles.staffProgressStatusTextAmber)]}>
                            {entry.complete == null ? '待同步' : (entry.complete ? '已交接' : '未交接')}
                          </Text>
                        </View>
                      </Pressable>
                    )
                  })}
                </View>
              </>
            ) : null}
          </View>
        ) : null}

        {canManagerMode && mode === 'manager' ? (
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={moderateScale(16)} color="#9CA3AF" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              style={styles.searchInput}
              placeholder={period === 'today' ? '搜索今日任务（房号/地址/清洁/检查）' : period === 'week' ? '搜索本周当前日期任务（房号/地址/清洁/检查）' : '搜索本月当前日期任务（房号/地址/清洁/检查）'}
              placeholderTextColor="#9CA3AF"
            />
            {search.trim() ? (
              <Pressable onPress={() => setSearch('')} style={({ pressed }) => [styles.searchClear, pressed ? styles.segmentPressed : null]}>
                <Ionicons name="close-circle" size={moderateScale(18)} color="#9CA3AF" />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{sectionTitle}</Text>
          <View style={styles.sectionRight}>
            {canManagerMode && mode === 'manager' ? (
              <Pressable
                onPress={() => openQuickCreate('checkin')}
                style={({ pressed }) => [styles.addTaskBtn, pressed ? styles.segmentPressed : null]}
              >
                <Ionicons name="add" size={moderateScale(15)} color="#FFFFFF" />
                <Text style={styles.addTaskBtnText}>新增</Text>
              </Pressable>
            ) : null}
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

        {showWarehouseKeyCard ? (
          <View style={styles.warehouseKeyCard}>
            <Pressable
              onPress={() => setWarehouseKeyExpanded((prev) => !prev)}
              style={({ pressed }) => [styles.warehouseKeyHeader, pressed ? styles.segmentPressed : null]}
            >
              <View style={styles.warehouseKeyHeaderMain}>
                <View style={styles.warehouseKeyIcon}>
                  <Ionicons name="key-outline" size={moderateScale(16)} color="#047857" />
                </View>
                <Text style={styles.taskTitle} numberOfLines={1}>MSQ 仓库钥匙</Text>
              </View>
              {warehouseKeyExpanded ? (
                <View style={[styles.statusPill, warehouseIsHeldByMe ? styles.statusBlue : String(warehouseKeyRow?.status || '') === 'available' ? styles.statusGreen : styles.statusAmber]}>
                  <Text style={[styles.statusText, warehouseIsHeldByMe ? styles.statusTextBlue : String(warehouseKeyRow?.status || '') === 'available' ? styles.statusTextGreen : styles.statusTextAmber]}>
                    {warehouseKeyLoading && !warehouseKeyRow ? '加载中' : warehouseStatus}
                  </Text>
                </View>
              ) : (
                <View style={[styles.statusPill, styles.statusGreen]}>
                  <Text style={[styles.statusText, styles.statusTextGreen]}>已收起</Text>
                </View>
              )}
              <Ionicons name={warehouseKeyExpanded ? 'chevron-up' : 'chevron-down'} size={moderateScale(16)} color="#047857" />
            </Pressable>
            {warehouseKeyExpanded ? (
              <>
                <Text style={styles.summary} numberOfLines={2}>
                  {warehouseHolderName
                    ? `当前持有人：${warehouseHolderName}${warehouseIsHeldByMe ? '（我）' : ''}`
                    : '当前没有记录持有人。'}
                </Text>
                {warehouseHolderName ? (
                  <View style={styles.warehousePhoneRow}>
                    <Ionicons name="call-outline" size={moderateScale(14)} color="#047857" />
                    <Text style={styles.warehousePhoneText} numberOfLines={1}>
                      {warehouseHolderPhone || '手机号未填写'}
                    </Text>
                    {warehouseHolderPhone ? (
                      <Pressable
                        onPress={callWarehouseKeyHolder}
                        style={({ pressed }) => [styles.warehouseCallBtn, pressed ? styles.segmentPressed : null]}
                      >
                        <Text style={styles.warehouseCallText}>打电话</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
                {warehouseLatest ? (
                  <Text style={styles.warehouseKeyMeta} numberOfLines={2}>
                    最近：{warehouseKeyEventText(String(warehouseLatest.action || ''))}{warehouseLatestTime ? ` ${warehouseLatestTime}` : ''} · {String(warehouseLatest.actor_name || '').trim() || '未知'}{warehouseLatest.to_name ? ` → ${warehouseLatest.to_name}` : ''}
                  </Text>
                ) : null}
                <View style={styles.actionsRow}>
                  <Pressable
                    disabled={warehouseKeyBusy || warehouseIsHeldByMe}
                    onPress={() => submitWarehouseKeyEvent('borrow')}
                    style={({ pressed }) => [styles.actionBtn, pressed ? styles.segmentPressed : null, warehouseKeyBusy || warehouseIsHeldByMe ? styles.actionBtnDisabled : null]}
                  >
                    <Text style={[styles.actionText, warehouseKeyBusy || warehouseIsHeldByMe ? { color: '#6B7280' } : null]}>{warehouseIsHeldByMe ? '已由我持有' : '借钥匙'}</Text>
                  </Pressable>
                  <Pressable
                    disabled={warehouseKeyBusy || String(warehouseKeyRow?.status || '') === 'available'}
                    onPress={() => submitWarehouseKeyEvent('return')}
                    style={({ pressed }) => [styles.actionBtn, pressed ? styles.segmentPressed : null, warehouseKeyBusy || String(warehouseKeyRow?.status || '') === 'available' ? styles.actionBtnDisabled : null]}
                  >
                    <Text style={[styles.actionText, warehouseKeyBusy || String(warehouseKeyRow?.status || '') === 'available' ? { color: '#6B7280' } : null]}>还钥匙</Text>
                  </Pressable>
                  <Pressable
                    disabled={warehouseKeyBusy || !warehouseKeyCandidates.length}
                    onPress={() => setWarehouseTransferOpen(true)}
                    style={({ pressed }) => [styles.actionBtn, pressed ? styles.segmentPressed : null, warehouseKeyBusy || !warehouseKeyCandidates.length ? styles.actionBtnDisabled : null]}
                  >
                    <Text style={[styles.actionText, warehouseKeyBusy || !warehouseKeyCandidates.length ? { color: '#6B7280' } : null]}>转交同事</Text>
                  </Pressable>
                </View>
                <Pressable
                  disabled={warehouseKeyLoading}
                  onPress={loadWarehouseKey}
                  style={({ pressed }) => [styles.warehouseRefresh, pressed ? styles.segmentPressed : null]}
                >
                  <Ionicons name="refresh-outline" size={moderateScale(14)} color="#047857" />
                  <Text style={styles.warehouseRefreshText}>{warehouseKeyLoading ? '刷新中' : '刷新状态'}</Text>
                </Pressable>
              </>
            ) : (
              <Text style={styles.summary} numberOfLines={2}>
                如需查看或操作 MSQ 仓库钥匙，请点击展开。
              </Text>
            )}
          </View>
        ) : null}

        <Modal visible={warehouseTransferOpen} transparent animationType="fade" onRequestClose={() => setWarehouseTransferOpen(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.transferModal}>
              <View style={styles.transferHeader}>
                <Text style={styles.transferTitle}>转交 MSQ 仓库钥匙</Text>
                <Pressable onPress={() => setWarehouseTransferOpen(false)} style={({ pressed }) => [styles.transferClose, pressed ? styles.segmentPressed : null]}>
                  <Ionicons name="close" size={moderateScale(18)} color="#111827" />
                </Pressable>
              </View>
              <TextInput
                value={warehouseNote}
                onChangeText={setWarehouseNote}
                style={styles.transferNote}
                placeholder="备注（可选）"
                placeholderTextColor="#9CA3AF"
              />
              <ScrollView style={styles.transferList} contentContainerStyle={{ gap: 8 }}>
                {warehouseKeyCandidates.length ? warehouseKeyCandidates.map((item) => (
                  <Pressable
                    key={item.id}
                    disabled={warehouseKeyBusy}
                    onPress={() => submitWarehouseKeyEvent('handover', item.id)}
                    style={({ pressed }) => [styles.transferOption, pressed ? styles.segmentPressed : null]}
                  >
                    <View style={styles.transferAvatar}>
                      <Text style={styles.transferAvatarText}>{initialsOf(item.name)}</Text>
                    </View>
                    <View style={styles.transferOptionBody}>
                      <Text style={styles.transferOptionName} numberOfLines={1}>{item.name || item.id}</Text>
                      <Text style={styles.transferOptionRole} numberOfLines={1}>{item.role || '今日相关人员'}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={moderateScale(16)} color="#9CA3AF" />
                  </Pressable>
                )) : (
                  <Text style={styles.emptyText}>今天没有可转交的 Southbank 相关人员。</Text>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal visible={quickCreateOpen} transparent animationType="fade" onRequestClose={() => setQuickCreateOpen(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.createTaskModal}>
              <View style={styles.transferHeader}>
                <Text style={styles.transferTitle}>新增任务</Text>
                <Pressable onPress={() => setQuickCreateOpen(false)} disabled={quickCreateBusy} style={({ pressed }) => [styles.transferClose, pressed ? styles.segmentPressed : null]}>
                  <Ionicons name="close" size={moderateScale(18)} color="#111827" />
                </Pressable>
              </View>
              <View style={styles.createModeRow}>
                {[
                  { key: 'checkin', label: '待同步入住' },
                  { key: 'checkout', label: '待同步退房' },
                  { key: 'offline', label: '线下任务' },
                ].map((item) => (
                  <Pressable
                    key={item.key}
                    disabled={quickCreateBusy}
                    onPress={() => {
                      const mode0 = item.key as QuickCreateMode
                      setQuickCreateMode(mode0)
                      setQuickCreateTime(mode0 === 'checkout' ? '10am' : '3pm')
                    }}
                    style={({ pressed }) => [styles.createModeBtn, quickCreateMode === item.key ? styles.createModeBtnOn : null, pressed ? styles.segmentPressed : null]}
                  >
                    <Text style={[styles.createModeText, quickCreateMode === item.key ? styles.createModeTextOn : null]}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
              <ScrollView style={styles.createTaskBody} contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
                <View style={styles.createField}>
                  <Text style={styles.createLabel}>日期</Text>
                  <TextInput value={quickCreateDate} onChangeText={setQuickCreateDate} editable={!quickCreateBusy} style={styles.createInput} placeholder="YYYY-MM-DD" placeholderTextColor="#9CA3AF" />
                </View>
                {quickCreateMode === 'offline' ? (
                  <View style={styles.createField}>
                    <Text style={styles.createLabel}>任务类型</Text>
                    <View style={styles.createModeRow}>
                      {QUICK_CREATE_OFFLINE_TASK_TYPES.map((item) => (
                        <Pressable
                          key={item.key}
                          disabled={quickCreateBusy}
                          onPress={() => setQuickCreateOfflineTaskType(item.key)}
                          style={({ pressed }) => [styles.createModeBtn, quickCreateOfflineTaskType === item.key ? styles.createModeBtnOn : null, pressed ? styles.segmentPressed : null]}
                        >
                          <Text style={[styles.createModeText, quickCreateOfflineTaskType === item.key ? styles.createModeTextOn : null]}>{item.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}
                <View style={styles.createField}>
                  <Text style={styles.createLabel}>
                    {quickCreateMode === 'offline'
                      ? (quickCreateOfflineTaskType === 'property' ? '房号' : '房号（可选）')
                      : '房号'}
                  </Text>
                  <TextInput value={quickCreateProperty} onChangeText={setQuickCreateProperty} editable={!quickCreateBusy} style={styles.createInput} placeholder="例如 2607" placeholderTextColor="#9CA3AF" autoCapitalize="characters" />
                  {quickCreatePropertyMatches.length ? (
                    <View style={styles.propertySuggestList}>
                      {quickCreatePropertyMatches.map((item) => (
                        <Pressable
                          key={item.id || item.code}
                          disabled={quickCreateBusy}
                          onPress={() => setQuickCreateProperty(item.code || item.id)}
                          style={({ pressed }) => [styles.propertySuggestItem, pressed ? styles.segmentPressed : null]}
                        >
                          <Text style={styles.propertySuggestText}>{item.code || item.id}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>

                {quickCreateMode === 'offline' ? (
                  <>
                    <View style={styles.createField}>
                      <Text style={styles.createLabel}>标题</Text>
                      <TextInput value={quickCreateOfflineTitle} onChangeText={setQuickCreateOfflineTitle} editable={!quickCreateBusy} style={styles.createInput} placeholder="例如 临时送物 / 联系客人" placeholderTextColor="#9CA3AF" />
                    </View>
                    <View style={styles.createField}>
                      <Text style={styles.createLabel}>内容</Text>
                      <TextInput value={quickCreateOfflineContent} onChangeText={setQuickCreateOfflineContent} editable={!quickCreateBusy} style={[styles.createInput, styles.createTextArea]} placeholder="补充说明" placeholderTextColor="#9CA3AF" multiline />
                    </View>
                    <View style={styles.createField}>
                      <Text style={styles.createLabel}>紧急度</Text>
                      <View style={styles.createModeRow}>
                        {[
                          { key: 'low', label: '低' },
                          { key: 'medium', label: '中' },
                          { key: 'high', label: '高' },
                          { key: 'urgent', label: '紧急' },
                        ].map((item) => (
                          <Pressable
                            key={item.key}
                            disabled={quickCreateBusy}
                            onPress={() => setQuickCreateUrgency(item.key as any)}
                            style={({ pressed }) => [styles.createModeBtn, quickCreateUrgency === item.key ? styles.createModeBtnOn : null, pressed ? styles.segmentPressed : null]}
                          >
                            <Text style={[styles.createModeText, quickCreateUrgency === item.key ? styles.createModeTextOn : null]}>{item.label}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.createField}>
                      <Text style={styles.createLabel}>{quickCreateMode === 'checkout' ? '退房时间' : '入住时间'}</Text>
                      <TextInput value={quickCreateTime} onChangeText={setQuickCreateTime} editable={!quickCreateBusy} style={styles.createInput} placeholder={quickCreateMode === 'checkout' ? '10am' : '3pm'} placeholderTextColor="#9CA3AF" />
                    </View>
                    <View style={styles.createField}>
                      <Text style={styles.createLabel}>{quickCreateMode === 'checkout' ? '旧密码' : '新密码'}</Text>
                      <TextInput value={quickCreateMode === 'checkout' ? quickCreateOldCode : quickCreateNewCode} onChangeText={quickCreateMode === 'checkout' ? setQuickCreateOldCode : setQuickCreateNewCode} editable={!quickCreateBusy} style={styles.createInput} placeholder={quickCreateMode === 'checkout' ? '旧密码' : '新密码'} placeholderTextColor="#9CA3AF" />
                    </View>
                    {quickCreateMode === 'checkin' ? (
                      <View style={styles.createField}>
                        <Text style={styles.createLabel}>入住天数（可选）</Text>
                        <TextInput value={quickCreateNights} onChangeText={setQuickCreateNights} editable={!quickCreateBusy} style={styles.createInput} keyboardType="number-pad" placeholder="例如 3" placeholderTextColor="#9CA3AF" />
                      </View>
                    ) : null}
                    <View style={styles.createField}>
                      <Text style={styles.createLabel}>客人需求</Text>
                      <TextInput value={quickCreateGuestNote} onChangeText={setQuickCreateGuestNote} editable={!quickCreateBusy} style={[styles.createInput, styles.createTextArea]} placeholder="需要同步给现场的信息" placeholderTextColor="#9CA3AF" multiline />
                    </View>
                    <Text style={styles.createHint}>手动新增的入住/退房任务会保持待同步；订单同步后自动关联。</Text>
                  </>
                )}
              </ScrollView>
              <Pressable
                disabled={quickCreateBusy}
                onPress={submitQuickCreate}
                style={({ pressed }) => [styles.createSubmitBtn, pressed ? styles.segmentPressed : null, quickCreateBusy ? styles.actionBtnDisabled : null]}
              >
                <Text style={[styles.actionText, quickCreateBusy ? { color: '#6B7280' } : null]}>{quickCreateBusy ? '新增中' : '确认新增'}</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {taskCacheHint ? (
          <View style={styles.cacheHintCard}>
            <View style={styles.cacheHintHeader}>
              <Text style={styles.cacheHintTitle}>{isShowingCachedTasks ? '本地缓存' : '正在同步'}</Text>
              <Text style={styles.cacheHintMeta}>{taskCacheHint.lastSyncedAt ? `上次同步 ${formatSyncTimestamp(taskCacheHint.lastSyncedAt)}` : '等待首次同步'}</Text>
            </View>
            <Text style={styles.cacheHintText}>{taskCacheHint.message}</Text>
          </View>
        ) : null}

        {!hasInit ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{t('common_loading')}</Text>
          </View>
        ) : loadError ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{loadError}</Text>
            <Pressable onPress={() => { void refreshTasksData() }} style={({ pressed }) => [styles.emptyRetryBtn, pressed ? styles.segmentPressed : null]}>
              <Text style={styles.emptyRetryText}>重试</Text>
            </Pressable>
          </View>
        ) : visibleTasks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{t('tasks_no_tasks')}</Text>
          </View>
        ) : (
          <View style={{ marginTop: 10, gap: 12 }}>
            {visibleTasks.map((task, taskIndex) => {
              const shouldRenderDayEndBefore = showDayEndCard && dayEndInsertIndex === taskIndex
              const meta = getTaskStatusMeta(task, roleNames)
              const metaStyles = statusPillStylePair(meta.tone)
              const kind = taskKindLabel(task.task_kind)
              const addr = task.property?.address || ''
              const code = task.property?.code || ''
              const unitType = task.property?.unit_type || ''
              const region = task.property?.region || ''
              const checkoutTime = String(task.start_time || '').trim()
              const checkinTime = String(task.end_time || '').trim()
              const guideUrl = normalizeHttpUrl(task.property?.access_guide_link)
              const wifiSsid = String(task.property?.wifi_ssid || '').trim()
              const wifiPassword = String(task.property?.wifi_password || '').trim()
              const hasWifiInfo = !!(wifiSsid || wifiPassword)
              const oldCode = String((task as any).old_code || '').trim()
              const newCode = String((task as any).new_code || '').trim()
              const guestSpecialRequest = String((task as any).guest_special_request || (task as any).note || '').trim()
              const guestLuggage = (task as any).guest_luggage || null
              const urgency = urgencyMeta(task.urgency)
              const isOfflineTask = String(task.task_kind || '').toLowerCase() === 'offline'
              const detailPreview = !isOfflineTask && task.source_type !== 'cleaning_tasks' ? stripPhotoLines(task.summary) : ''
              const showSummary = !!detailPreview
              const isCleaningSource = task.source_type === 'cleaning_tasks'
              const isCleaningTask = isCleaningSource && String(task.task_kind || '').toLowerCase() === 'cleaning'
              const isInspectionTask = isCleaningSource && String(task.task_kind || '').toLowerCase() === 'inspection'
              const isCleaningSubmitted = isCleaningTask && isCleaningWorkSubmitted(task.status)
              const keyPhotoState = selectKeyPhotoEffectiveState({
                key_photo_url: String((task as any)?.key_photo_url || '').trim(),
                has_local_pending: !!keyQueueByTaskId[String((task as any)?.source_id || '').trim()],
              })
              const taskType = String((task as any).task_type || '').trim().toLowerCase()
              const isStayoverTask = isCleaningTask && isStayoverTaskType(taskType)
              const isCheckoutTask = taskType === 'checkout_clean' || !!checkoutTime
              const isPasswordOnlyInspection = isPasswordOnlyInspectionTask(task as any)
              const inspectionScopeTag = isInspectionTask && taskType === 'checkin_clean' ? inspectionScopeLabel((task as any).inspection_scope) : null
              const inspectionMode = effectiveInspectionMode(task as any)
              const inspectionPlanLabel = inspectionModeLabel(inspectionMode, String((task as any).inspection_due_date || '').trim() || null)
              const stayoverTagStyles = taskTagStylePair('normal')
              const kindTagStyles = taskTagStylePair(getTaskKindTone(task.task_kind))
              const inspectionPlanTagStyles = taskTagStylePair(getInspectionModeTone(inspectionMode))
              const inspectionScopeTagStyles = taskTagStylePair(getInspectionScopeTone(isPasswordOnlyInspection))
              const checkoutTagStyles = taskTagStylePair('danger')
              const checkinTagStyles = taskTagStylePair('pending')
              const lateCheckoutTagStyles = taskTagStylePair('danger')
              const earlyCheckinTagStyles = taskTagStylePair('info')
              const isSelfCompleteEligible = isCleaningTask && isSelfCompleteMode(task as any) && (isCheckoutTask || isStayoverTask)
              const isDirectCompleteEligible = isCleaningTask && (isSelfCompleteEligible || isStayoverTask)
              const isPendingInspectionDecision = isCleaningTask && !isStayoverTask && inspectionMode === 'pending_decision'
              const showInspectionPlanTag = isCleaningTask && !isStayoverTask
              const checkedOutAt = String((task as any).checked_out_at || '').trim()
              const isCheckedOut = !!checkedOutAt
              const isHistoricalTask = isBeforeToday(String(task.scheduled_date || (task as any).date || ''))
              const canEditManagerFields = roleNames.includes('customer_service') || roleNames.includes('admin') || roleNames.includes('offline_manager')
              const isManager = canManagerMode && mode === 'manager'
              const isInspectorUser = roleNames.includes('cleaning_inspector') || roleNames.includes('cleaner_inspector')
              const cleanerName = String((task as any).cleaner_name || '').trim()
              const inspectorName = String((task as any).inspector_name || '').trim()
              const cleanerExecName = cleanerName || '-'
              const inspectorExecName = isDirectCompleteEligible || isPendingInspectionDecision ? '无' : (inspectorName || '-')
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
              const isLateCheckin = hasCheckin && isLateCheckinTime(checkinTime)
              const titleSuffix = cleaningTaskTitleSuffix(task as any)
              const taskCollapsed = !!collapsedTaskIds[String(task.id)]
              const addressCopied = copiedFeedbackKey === `address:${task.id}`
              const wifiCopied = copiedFeedbackKey === `wifi:${task.id}`
              const offlineTitleRaw = String(task.title || '').trim()
              const offlineTitleSuffix = isOfflineTask && offlineTitleRaw && (!code || (!offlineTitleRaw.includes(code) && offlineTitleRaw !== code))
                ? offlineTitleRaw
                : ''
              const title2 = isOfflineTask
                ? [code || '', offlineTitleSuffix].filter(Boolean).join(' ').trim() || offlineTitleRaw || '-'
                : `${code || task.title || '-'}${titleSuffix ? ` ${titleSuffix}` : ''}`.trim()
              const keyRequirementTags = resolveKeyRequirementTags(task, { hasCheckout, hasCheckin, isCheckedOut })
              const checkoutSets = keyRequirementTags.checkoutSets
              const checkinSets = keyRequirementTags.checkinSets
              const showCheckout = isCleaningSource && keyRequirementTags.showCheckout
              const showCheckin = isCleaningSource && keyRequirementTags.showCheckin
              const offlineDetail = (() => {
                if (!isOfflineTask) return null
                const s1 = stripPhotoLines(task.summary)
                if (s1) return s1
                const t1 = String(task.title || '').trim()
                if (t1 && (!code || t1 !== code) && t1 !== title2) return t1
                if (!t1) return null
                if (code && t1 === code) return null
                if (t1 === title2) return null
                return t1
              })()
              const offlineAssigneeName = String((task as any).assignee_name || (task as any).cleaner_name || '').trim()
                || (String(task.assignee_id || '').trim() ? String(task.assignee_id || '').trim() : '未分配')
              return (
                <React.Fragment key={task.id}>
                  {shouldRenderDayEndBefore ? (
                    <Pressable
                      onPress={() => openDayEndScreen({
                        taskRoomCodes: dayEndTaskRoomCodes,
                        targetRoles: dayEndViewerRoles,
                        ...((isCleanerSelf || isInspectorSelf) ? {} : { userId: dayEndViewerTarget.userId, userName: dayEndViewerTarget.userName || undefined }),
                      })}
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
                            : (dayEndViewerInspectorOnly
                              ? '请拍剩余消耗品并完成 Reject 床品登记。'
                              : (dayEndViewerHasCleaning && dayEndViewerHasInspection
                                ? '请完成备用钥匙、脏床品、剩余消耗品与 Reject 床品登记。'
                                : '请根据今天实际任务完成日终交接。')))
                          : (dayEndViewerTarget.userName
                            ? `查看 ${dayEndViewerTarget.userName} 今日的${dayEndTargetContentLabel(dayEndViewerRoles)}交接记录。`
                            : `查看今日的${dayEndTargetContentLabel(dayEndViewerRoles)}交接记录。`)}
                      </Text>
                      <View style={styles.actionsRow}>
                        <Pressable
                          onPress={() => openDayEndScreen({
                            focus: dayEndViewerInspectorOnly ? 'consumable' : 'key',
                            taskRoomCodes: dayEndTaskRoomCodes,
                            targetRoles: dayEndViewerRoles,
                            ...((isCleanerSelf || isInspectorSelf) ? {} : { userId: dayEndViewerTarget.userId, userName: dayEndViewerTarget.userName || undefined }),
                          })}
                          style={({ pressed }) => [styles.actionBtn, pressed ? styles.segmentPressed : null]}
                        >
                          <Text style={styles.actionText}>{dayEndViewerInspectorOnly ? '上传剩余消耗品' : '上传备用钥匙'}</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => openDayEndScreen({
                            focus: dayEndViewerInspectorOnly ? 'reject' : 'dirty',
                            taskRoomCodes: dayEndTaskRoomCodes,
                            targetRoles: dayEndViewerRoles,
                            ...((isCleanerSelf || isInspectorSelf) ? {} : { userId: dayEndViewerTarget.userId, userName: dayEndViewerTarget.userName || undefined }),
                          })}
                          style={({ pressed }) => [styles.actionBtn, pressed ? styles.segmentPressed : null]}
                        >
                          <Text style={styles.actionText}>{dayEndViewerInspectorOnly ? '登记 Reject床品' : '上传脏床品照片'}</Text>
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
                  <View style={styles.taskHeroRow}>
                    <View style={styles.taskHeroMain}>
                      <View style={styles.taskTitleRow}>
                        <View style={styles.taskTitleMain}>
                          {!isManager && (isReorderableTask(task) || sortIndex != null) ? (
                            <View style={[styles.orderPill, reorderMode && isReorderableTask(task) ? styles.orderPillActive : null]}>
                              <Text style={[styles.orderPillText, reorderMode && isReorderableTask(task) ? styles.orderPillTextActive : null]}>
                                {reorderMode && isReorderableTask(task) ? (selectedMark || '·') : sortIndex == null ? '·' : String(sortIndex)}
                              </Text>
                            </View>
                          ) : null}
                          <Text style={[styles.taskTitle, prefersCompactTaskHeader ? styles.taskTitleCompact : null]} numberOfLines={prefersCompactTaskHeader ? 3 : 2}>
                            {title2}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={[styles.taskHeroAside, prefersCompactTaskHeader ? styles.taskHeroAsideCompact : null]}>
                      <View style={[styles.statusPill, metaStyles.pill]}>
                        <Text style={[styles.statusText, metaStyles.text]}>{meta.text}</Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`task-collapse-${task.id}`}
                        accessibilityHint={taskCollapsed ? '展开任务详情' : '收起任务详情'}
                        onPress={() => toggleTaskCollapsed(String(task.id))}
                        hitSlop={8}
                        style={({ pressed }) => [styles.collapseBtn, pressed ? styles.segmentPressed : null]}
                      >
                        <Text style={styles.collapseBtnText}>{taskCollapsed ? '展开' : '收起'}</Text>
                        <Ionicons name={taskCollapsed ? 'chevron-down' : 'chevron-up'} size={moderateScale(16)} color="#6B7280" />
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.taskSubRow}>
                    {isStayoverTask ? (
                      <View style={stayoverTagStyles.container}>
                        <Text style={stayoverTagStyles.text}>入住中清洁</Text>
                      </View>
                    ) : (
                      <>
                        <View style={kindTagStyles.container}>
                          <Text style={kindTagStyles.text}>{kind}</Text>
                        </View>
                        {showCheckout ? (
                          <View style={checkoutTagStyles.container}>
                            <Text style={checkoutTagStyles.text}>{`请确认已退${Math.max(2, Math.trunc(Number(checkoutSets || 0)))}套钥匙`}</Text>
                          </View>
                        ) : null}
                        {showCheckin ? (
                          <View style={checkinTagStyles.container}>
                            <Text style={checkinTagStyles.text}>{`需挂${checkinSets}套钥匙`}</Text>
                          </View>
                        ) : null}
                        {isLateCheckout ? (
                          <View style={lateCheckoutTagStyles.container}>
                            <Text style={lateCheckoutTagStyles.text}>晚退房</Text>
                          </View>
                        ) : null}
                        {isEarlyCheckin ? (
                          <View style={earlyCheckinTagStyles.container}>
                            <Text style={earlyCheckinTagStyles.text}>早入住</Text>
                          </View>
                        ) : null}
                        {isLateCheckin ? (
                          <View style={earlyCheckinTagStyles.container}>
                            <Text style={earlyCheckinTagStyles.text}>晚入住</Text>
                          </View>
                        ) : null}
                        {showInspectionPlanTag ? (
                          <View style={inspectionPlanTagStyles.container}>
                            <Text style={inspectionPlanTagStyles.text}>{inspectionPlanLabel}</Text>
                          </View>
                        ) : null}
                        {inspectionScopeTag ? (
                          <View style={inspectionScopeTagStyles.container}>
                            <Text style={inspectionScopeTagStyles.text}>{inspectionScopeTag}</Text>
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

                  {!taskCollapsed && isCleaningSource ? (
                    <>
                      <View style={styles.execCard}>
                        <Text style={styles.execLabel}>执行人员</Text>
                        <View style={styles.execPeople}>
                          <View style={styles.execPerson}>
                            <View style={styles.execBadgeClean}>
                              <Text style={styles.execBadgeText}>清</Text>
                            </View>
                            <View style={styles.execPersonText}>
                              <Text style={[styles.execPersonRole, styles.execPersonRoleClean]}>清洁</Text>
                              <Text style={styles.execPersonName} numberOfLines={1}>{cleanerExecName}</Text>
                            </View>
                          </View>
                          <View style={styles.execPerson}>
                            <View style={styles.execBadgeInspect}>
                              <Text style={styles.execBadgeText}>检</Text>
                            </View>
                            <View style={styles.execPersonText}>
                              <Text style={[styles.execPersonRole, styles.execPersonRoleInspect]}>检查</Text>
                              <Text style={styles.execPersonName} numberOfLines={1}>{inspectorExecName}</Text>
                            </View>
                          </View>
                        </View>
                        {isManager || isInspectorUser ? (
                          <View style={styles.execOrderRow}>
                            <Text style={styles.execOrder} numberOfLines={1}>
                              {`清洁顺序：${cleanerOrderN == null ? '-' : String(cleanerOrderN)}`}
                            </Text>
                            <Text style={styles.execOrder} numberOfLines={1}>
                              {`检查顺序：${inspectorOrderN == null ? '-' : String(inspectorOrderN)}`}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      {!isOfflineTask && unitType ? (
                        <View style={styles.detailRowCard}>
                          <View style={[styles.detailIconWrap, styles.detailIconIndigo]}>
                            <Ionicons name="bed-outline" size={moderateScale(18)} color="#6366F1" />
                          </View>
                          <View style={styles.detailRowContent}>
                            <Text style={styles.detailRowLabel}>户型</Text>
                            <Text style={styles.unitTypeText}>{unitType}</Text>
                          </View>
                        </View>
                      ) : null}

                      {addr ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={addressCopied ? `address-copied-${task.id}` : `address-copy-${task.id}`}
                          onPress={async () => {
                            try {
                              await Clipboard.setStringAsync(addr)
                              flashCopiedFeedback(`address:${task.id}`)
                              showBanner('已复制', '地址已复制')
                            } catch {
                              showBanner('复制失败', '复制失败')
                            }
                          }}
                          style={({ pressed }) => [styles.detailRowCard, pressed ? styles.segmentPressed : null]}
                        >
                          <View style={[styles.detailIconWrap, styles.detailIconBlue]}>
                            <Ionicons name="location-outline" size={moderateScale(18)} color="#2563EB" />
                          </View>
                          <View style={styles.detailRowContent}>
                            <Text style={styles.detailRowLabel}>地址</Text>
                            <Text style={styles.addrText} numberOfLines={2}>
                              {addr}
                            </Text>
                          </View>
                          <View style={[styles.copyAffordance, addressCopied ? styles.copyAffordanceDone : null]}>
                            <Ionicons name={addressCopied ? 'checkmark-circle' : 'copy-outline'} size={moderateScale(18)} color={addressCopied ? '#047857' : '#9CA3AF'} />
                            {addressCopied ? <Text style={styles.copyAffordanceText}>已复制</Text> : null}
                          </View>
                        </Pressable>
                      ) : null}

                      {hasWifiInfo ? (
                        wifiPassword ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={wifiCopied ? `wifi-copied-${task.id}` : `wifi-copy-${task.id}`}
                            onPress={async () => {
                              try {
                                await Clipboard.setStringAsync(wifiPassword)
                                flashCopiedFeedback(`wifi:${task.id}`)
                                showBanner('已复制', 'Wi-Fi 密码已复制')
                              } catch {
                                showBanner('复制失败', '复制失败')
                              }
                            }}
                            style={({ pressed }) => [styles.detailRowCard, styles.detailRowCardAccent, pressed ? styles.segmentPressed : null]}
                          >
                            <View style={[styles.detailIconWrap, styles.detailIconTeal]}>
                              <Ionicons name="wifi-outline" size={moderateScale(18)} color="#0F766E" />
                            </View>
                            <View style={styles.detailRowContent}>
                              <Text style={styles.detailRowLabelTeal}>Wi-Fi</Text>
                              <View style={styles.detailSplitRow}>
                                <View style={styles.detailSplitCell}>
                                  <Text style={styles.wifiLabel}>名称</Text>
                                  <Text style={styles.wifiValue} numberOfLines={1}>{wifiSsid || '-'}</Text>
                                </View>
                                <View style={[styles.detailSplitDivider, styles.detailSplitDividerTeal]} />
                                <View style={styles.detailSplitCell}>
                                  <Text style={styles.wifiLabel}>密码</Text>
                                  <Text style={styles.wifiValue} numberOfLines={1}>{wifiPassword || '-'}</Text>
                                </View>
                              </View>
                            </View>
                            <View style={[styles.copyAffordance, wifiCopied ? styles.copyAffordanceDone : null]}>
                              <Ionicons name={wifiCopied ? 'checkmark-circle' : 'copy-outline'} size={moderateScale(18)} color={wifiCopied ? '#047857' : '#9CA3AF'} />
                              {wifiCopied ? <Text style={styles.copyAffordanceText}>已复制</Text> : null}
                            </View>
                          </Pressable>
                        ) : (
                          <View style={[styles.detailRowCard, styles.detailRowCardAccent]}>
                            <View style={[styles.detailIconWrap, styles.detailIconTeal]}>
                              <Ionicons name="wifi-outline" size={moderateScale(18)} color="#0F766E" />
                            </View>
                            <View style={styles.detailRowContent}>
                              <Text style={styles.detailRowLabelTeal}>Wi-Fi</Text>
                              <View style={styles.detailSplitRow}>
                                <View style={styles.detailSplitCell}>
                                  <Text style={styles.wifiLabel}>名称</Text>
                                  <Text style={styles.wifiValue} numberOfLines={1}>{wifiSsid || '-'}</Text>
                                </View>
                                <View style={[styles.detailSplitDivider, styles.detailSplitDividerTeal]} />
                                <View style={styles.detailSplitCell}>
                                  <Text style={styles.wifiLabel}>密码</Text>
                                  <Text style={styles.wifiValue} numberOfLines={1}>-</Text>
                                </View>
                              </View>
                            </View>
                          </View>
                        )
                      ) : null}

                      <View style={styles.detailRowCard}>
                        <View style={[styles.detailIconWrap, styles.detailIconGreen]}>
                          <Ionicons name="time-outline" size={moderateScale(18)} color="#16A34A" />
                        </View>
                        <View style={styles.detailRowContent}>
                          <Text style={styles.detailRowLabel}>时间</Text>
                          <View style={styles.detailSplitRow}>
                            <View style={styles.detailSplitCell}>
                              <Text style={styles.timeLabel}>退房时间</Text>
                              <Text style={styles.timeValue}>{checkoutTime || '-'}</Text>
                            </View>
                            <View style={styles.detailSplitDivider} />
                            <View style={styles.detailSplitCell}>
                              <Text style={styles.timeLabel}>入住时间</Text>
                              <Text style={styles.timeValue}>{checkinTime || '-'}</Text>
                            </View>
                          </View>
                        </View>
                      </View>

                      {stayedNights != null || remainingNights != null ? (
                        <View style={styles.detailRowCard}>
                          <View style={[styles.detailIconWrap, styles.detailIconBlue]}>
                            <Ionicons name="moon-outline" size={moderateScale(18)} color="#2563EB" />
                          </View>
                          <View style={styles.detailRowContent}>
                            <Text style={styles.detailRowLabel}>入住晚数</Text>
                            <View style={styles.detailSplitRow}>
                              <View style={styles.detailSplitCell}>
                                <Text style={styles.timeLabel}>已住晚数</Text>
                                <Text style={styles.timeValue}>{stayedNights == null ? '-' : `${stayedNights}`}</Text>
                              </View>
                              <View style={styles.detailSplitDivider} />
                              <View style={styles.detailSplitCell}>
                                <Text style={styles.timeLabel}>待住晚数</Text>
                                <Text style={styles.timeValue}>{remainingNights == null ? '-' : `${remainingNights}`}</Text>
                              </View>
                            </View>
                          </View>
                        </View>
                      ) : null}

                      <View style={styles.detailRowCard}>
                        <View style={[styles.detailIconWrap, styles.detailIconAmber]}>
                          <Ionicons name="key-outline" size={moderateScale(18)} color="#D97706" />
                        </View>
                        <View style={styles.detailRowContent}>
                          <Text style={styles.detailRowLabel}>门锁密码</Text>
                          <View style={styles.detailSplitRow}>
                            <View style={styles.detailSplitCell}>
                              <Text style={styles.pwLabel}>旧密码</Text>
                              <Text style={styles.pwValue}>{oldCode || '-'}</Text>
                            </View>
                            <View style={styles.detailSplitDivider} />
                            <View style={styles.detailSplitCell}>
                              <Text style={styles.pwLabel}>新密码</Text>
                              <Text style={styles.pwValue}>{newCode || '-'}</Text>
                            </View>
                          </View>
                        </View>
                      </View>

                      {guestSpecialRequest ? (
                        <View style={styles.detailRowCard}>
                          <View style={[styles.detailIconWrap, styles.detailIconBlue]}>
                            <Ionicons name="chatbubble-ellipses-outline" size={moderateScale(18)} color="#2563EB" />
                          </View>
                          <View style={styles.detailRowContent}>
                            <Text style={styles.detailRowLabel}>客人需求</Text>
                            <Text style={styles.guestValue} numberOfLines={3}>
                              {guestSpecialRequest}
                            </Text>
                          </View>
                        </View>
                      ) : null}

                      <GuestLuggageCard
                        notice={guestLuggage}
                        token={token}
                        compact
                        showAcknowledge={!isManager && (isCleanerRole(roleNames) || isInspectorUser)}
                        showAcknowledgementSummary={isManager}
                        onChanged={(notice) => patchWorkTaskItem(String(task.id), { guest_luggage: notice } as any)}
                      />

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
                            style={({ pressed }) => [styles.detailRowCard, pressed ? styles.segmentPressed : null]}
                          >
                            <View style={[styles.detailIconWrap, styles.detailIconBlue]}>
                              <Ionicons name="open-outline" size={moderateScale(18)} color="#2563EB" />
                            </View>
                            <View style={styles.detailRowContent}>
                              <Text style={styles.detailRowLabel}>入住指南</Text>
                              <Text style={styles.guideText} numberOfLines={1}>
                                查看入住指南
                              </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={moderateScale(18)} color="#9CA3AF" />
                          </Pressable>
                        ) : (
                          <View style={styles.detailRowCard}>
                            <View style={[styles.detailIconWrap, styles.detailIconMuted]}>
                              <Ionicons name="open-outline" size={moderateScale(18)} color="#9CA3AF" />
                            </View>
                            <View style={styles.detailRowContent}>
                              <Text style={styles.detailRowLabel}>入住指南</Text>
                              <Text style={[styles.guideText, { color: '#9CA3AF' }]} numberOfLines={1}>
                                无入住指南，请联系管理员
                              </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={moderateScale(18)} color="#E5E7EB" />
                          </View>
                        )
                      ) : null}
                    </>
                  ) : !taskCollapsed && isOfflineTask ? (
                    <>
                      <View style={styles.execCard}>
                        <Text style={styles.execLabel}>执行人员</Text>
                        <View style={styles.execPeople}>
                          <View style={styles.execPerson}>
                            <View style={styles.execBadgeClean}>
                              <Text style={styles.execBadgeText}>执</Text>
                            </View>
                            <View style={styles.execPersonText}>
                              <Text style={[styles.execPersonRole, styles.execPersonRoleClean]}>执行</Text>
                              <Text style={styles.execPersonName} numberOfLines={1}>{offlineAssigneeName}</Text>
                            </View>
                          </View>
                        </View>
                        {sortIndex != null ? (
                          <View style={styles.execOrderRow}>
                            <Text style={styles.execOrder} numberOfLines={1}>
                              {`执行顺序：${String(sortIndex)}`}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </>
                  ) : (
                    <>
                      {!taskCollapsed && !isOfflineTask && addr ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={addressCopied ? `address-copied-${task.id}` : `address-copy-${task.id}`}
                          onPress={async () => {
                            try {
                              await Clipboard.setStringAsync(addr)
                              flashCopiedFeedback(`address:${task.id}`)
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
                          <View style={[styles.copyAffordance, addressCopied ? styles.copyAffordanceDone : null]}>
                            <Ionicons name={addressCopied ? 'checkmark-circle' : 'copy-outline'} size={moderateScale(14)} color={addressCopied ? '#047857' : '#9CA3AF'} />
                            {addressCopied ? <Text style={styles.copyAffordanceText}>已复制</Text> : null}
                          </View>
                        </Pressable>
                      ) : null}
                    </>
                  )}

                  {!taskCollapsed && isOfflineTask && offlineDetail ? (
                    <View style={styles.row}>
                      <Ionicons name="list-outline" size={moderateScale(14)} color="#9CA3AF" />
                      <Text style={styles.addr} numberOfLines={3}>
                        {offlineDetail}
                      </Text>
                    </View>
                  ) : null}

                  {!taskCollapsed && restockSummary ? (
                    <View style={styles.row}>
                      <Ionicons name="cube-outline" size={moderateScale(14)} color="#9CA3AF" />
                      <Text style={styles.addr} numberOfLines={2}>{`待补消耗品：${restockSummary}`}</Text>
                    </View>
                  ) : null}

                  {!taskCollapsed && showSummary ? (
                    <Text style={styles.summary} numberOfLines={3}>
                      {detailPreview}
                    </Text>
                  ) : null}

                  {!taskCollapsed && isCleaningSource && isManager ? (
                    <View style={styles.actionsRow}>
                      {canEditManagerFields && isCheckoutTask ? (
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
                  ) : !taskCollapsed && isInspectionTask && isInspectorUser ? (
                    <View style={styles.actionsRow}>
                      <Pressable
                        onPress={() => props.navigation.navigate('InspectionPanel', { taskId: task.id })}
                        style={({ pressed }) => [styles.actionBtn, pressed ? styles.segmentPressed : null]}
                      >
                        <Text style={styles.actionText}>{isPasswordOnlyInspection ? '查看说明' : '检查与补充'}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => props.navigation.navigate('InspectionComplete', { taskId: task.id })}
                        style={({ pressed }) => [styles.actionBtn, pressed ? styles.segmentPressed : null]}
                      >
                        <Text style={styles.actionText}>{isPasswordOnlyInspection ? '改密码并完成' : '标记已完成'}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => props.navigation.navigate('FeedbackForm', { taskId: task.id })}
                        style={({ pressed }) => [styles.actionBtn, pressed ? styles.segmentPressed : null]}
                      >
                        <Text style={styles.actionText}>房源问题反馈</Text>
                      </Pressable>
                    </View>
                  ) : !taskCollapsed && isCleaningTask ? (
                    <View style={styles.actionsRow}>
                      {!isCleaningSubmitted && !isStayoverTask ? (
                        <Pressable
                          onPress={() => props.navigation.navigate('TaskDetail', { id: task.id, action: 'upload_key' })}
                          disabled={keyPhotoState !== 'missing'}
                          style={({ pressed }) => [styles.actionBtn, pressed ? styles.segmentPressed : null, keyPhotoState !== 'missing' ? styles.actionBtnDisabled : null]}
                        >
                          <Text style={[styles.actionText, keyPhotoState !== 'missing' ? { color: '#6B7280' } : null]}>
                            {keyPhotoState === 'recorded' ? '钥匙已记录' : keyPhotoState === 'pending_sync' ? '钥匙待同步' : t('tasks_btn_upload_key')}
                          </Text>
                        </Pressable>
                      ) : null}
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
                      <Pressable
                        onPress={() => props.navigation.navigate('FeedbackForm', { taskId: task.id })}
                        style={({ pressed }) => [styles.actionBtn, pressed ? styles.segmentPressed : null]}
                      >
                        <Text style={styles.actionText}>{t('tasks_btn_repair')}</Text>
                      </Pressable>
                    </View>
                  ) : null}
                  </Pressable>
                </React.Fragment>
              )
            })}
            {showDayEndCard && dayEndInsertIndex === visibleTasks.length ? (
              <Pressable
                onPress={() => openDayEndScreen({
                  taskRoomCodes: dayEndTaskRoomCodes,
                  targetRoles: dayEndViewerRoles,
                  ...((isCleanerSelf || isInspectorSelf) ? {} : { userId: dayEndViewerTarget.userId, userName: dayEndViewerTarget.userName || undefined }),
                })}
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
                      : (dayEndViewerInspectorOnly
                        ? '请拍剩余消耗品并完成 Reject 床品登记。'
                        : (dayEndViewerHasCleaning && dayEndViewerHasInspection
                          ? '请完成备用钥匙、脏床品、剩余消耗品与 Reject 床品登记。'
                          : '请根据今天实际任务完成日终交接。')))
                    : (dayEndViewerTarget.userName
                      ? `查看 ${dayEndViewerTarget.userName} 今日的${dayEndTargetContentLabel(dayEndViewerRoles)}交接记录。`
                      : `查看今日的${dayEndTargetContentLabel(dayEndViewerRoles)}交接记录。`)}
                </Text>
                <View style={styles.actionsRow}>
                  <Pressable
                    onPress={() => openDayEndScreen({
                      focus: dayEndViewerInspectorOnly ? 'consumable' : 'key',
                      taskRoomCodes: dayEndTaskRoomCodes,
                      targetRoles: dayEndViewerRoles,
                      ...((isCleanerSelf || isInspectorSelf) ? {} : { userId: dayEndViewerTarget.userId, userName: dayEndViewerTarget.userName || undefined }),
                    })}
                    style={({ pressed }) => [styles.actionBtn, pressed ? styles.segmentPressed : null]}
                  >
                    <Text style={styles.actionText}>{dayEndViewerInspectorOnly ? '上传剩余消耗品' : '上传备用钥匙'}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => openDayEndScreen({
                      focus: dayEndViewerInspectorOnly ? 'reject' : 'dirty',
                      taskRoomCodes: dayEndTaskRoomCodes,
                      targetRoles: dayEndViewerRoles,
                      ...((isCleanerSelf || isInspectorSelf) ? {} : { userId: dayEndViewerTarget.userId, userName: dayEndViewerTarget.userName || undefined }),
                    })}
                    style={({ pressed }) => [styles.actionBtn, pressed ? styles.segmentPressed : null]}
                  >
                    <Text style={styles.actionText}>{dayEndViewerInspectorOnly ? '登记 Reject床品' : '上传脏床品照片'}</Text>
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
    minHeight: moderateScale(60),
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: hairline(),
    borderBottomColor: '#EEF0F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  hello: { flex: 1, minWidth: 0, flexShrink: 1, fontSize: moderateScale(20), fontWeight: '800', color: '#111827' },
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
  dayEndOverviewCard: { marginTop: 10, backgroundColor: '#F8FBFF', borderRadius: 18, padding: 14, borderWidth: hairline(), borderColor: '#DCEAFE', flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayEndOverviewIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  dayEndOverviewBody: { flex: 1, minWidth: 0 },
  dayEndOverviewMeta: { alignSelf: 'flex-start', paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  dayEndOverviewMetaText: { fontSize: 11, fontWeight: '900', color: '#2563EB' },
  dayEndOverviewTitle: { marginTop: 6, fontWeight: '900', fontSize: 15, color: '#111827' },
  dayEndOverviewMsg: { marginTop: 4, color: '#4B5563', fontWeight: '700', lineHeight: 18 },
  dayEndOverviewArrow: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  staffProgressCard: { marginTop: 10, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, borderWidth: hairline(), borderColor: '#E5E7EB', gap: 12 },
  staffProgressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderRadius: 14 },
  staffProgressHeaderMain: { flex: 1, minWidth: 0 },
  staffProgressTitle: { fontSize: 15, fontWeight: '900', color: '#111827' },
  staffProgressHint: { fontSize: 12, fontWeight: '700', color: '#6B7280' },
  staffProgressList: { gap: 10 },
  staffProgressItem: { borderRadius: 14, borderWidth: hairline(), borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  staffProgressMain: { flex: 1, minWidth: 0, gap: 4 },
  staffProgressNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  staffProgressName: { fontSize: 14, fontWeight: '900', color: '#111827' },
  staffProgressMeta: { fontSize: 11, fontWeight: '800', color: '#2563EB', backgroundColor: '#EAF2FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  staffProgressLine: { fontSize: 12, lineHeight: 18, fontWeight: '700', color: '#4B5563' },
  staffProgressEmpty: { fontSize: 13, lineHeight: 20, fontWeight: '700', color: '#6B7280' },
  staffProgressStatusPill: { minWidth: 58, height: 28, borderRadius: 14, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  staffProgressStatusText: { fontSize: 11, fontWeight: '900' },
  staffProgressStatusGray: { backgroundColor: '#E5E7EB' },
  staffProgressStatusGreen: { backgroundColor: '#DCFCE7' },
  staffProgressStatusAmber: { backgroundColor: '#FEF3C7' },
  staffProgressStatusTextGray: { color: '#6B7280' },
  staffProgressStatusTextGreen: { color: '#166534' },
  staffProgressStatusTextAmber: { color: '#92400E' },
  dayEndCard: { marginBottom: 12, backgroundColor: '#F8FBFF', borderRadius: 18, padding: 14, borderWidth: hairline(), borderColor: '#DCEAFE', flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayEndTitle: { fontWeight: '900', color: '#111827' },
  dayEndTaskCard: { backgroundColor: '#F8FBFF', borderColor: '#DCEAFE' },
  dayEndMsg: { marginTop: 4, color: '#4B5563', fontWeight: '700' },
  warehouseKeyCard: { marginTop: 10, backgroundColor: '#F0FDF4', borderRadius: 18, padding: 14, borderWidth: hairline(), borderColor: '#BBF7D0' },
  warehouseKeyHeader: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  warehouseKeyHeaderMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  warehouseKeyIcon: { width: 26, height: 26, borderRadius: 13, borderWidth: hairline(), borderColor: '#A7F3D0', backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' },
  warehousePhoneRow: { marginTop: 8, minHeight: 34, borderRadius: 12, backgroundColor: '#DCFCE7', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  warehousePhoneText: { flex: 1, minWidth: 0, color: '#065F46', fontSize: moderateScale(12), fontWeight: '900' },
  warehouseCallBtn: { minHeight: 26, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#047857', alignItems: 'center', justifyContent: 'center' },
  warehouseCallText: { color: '#FFFFFF', fontSize: moderateScale(11), fontWeight: '900' },
  warehouseKeyMeta: { marginTop: 6, color: '#047857', fontSize: moderateScale(12), fontWeight: '800', lineHeight: moderateScale(17) },
  warehouseRefresh: { alignSelf: 'flex-start', marginTop: 10, minHeight: 30, paddingHorizontal: 10, borderRadius: 12, backgroundColor: '#DCFCE7', flexDirection: 'row', alignItems: 'center', gap: 6 },
  warehouseRefreshText: { color: '#047857', fontSize: moderateScale(12), fontWeight: '900' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(17, 24, 39, 0.42)', justifyContent: 'center', padding: 18 },
  transferModal: { maxHeight: '78%', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14 },
  transferHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  transferTitle: { flex: 1, minWidth: 0, fontSize: moderateScale(17), lineHeight: moderateScale(22), fontWeight: '900', color: '#111827' },
  transferClose: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  transferNote: { marginTop: 12, minHeight: 42, borderRadius: 12, backgroundColor: '#F9FAFB', borderWidth: hairline(), borderColor: '#E5E7EB', paddingHorizontal: 12, color: '#111827', fontWeight: '800' },
  transferList: { marginTop: 12 },
  transferOption: { minHeight: 58, borderRadius: 14, backgroundColor: '#F9FAFB', borderWidth: hairline(), borderColor: '#EEF0F6', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  transferAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#047857', alignItems: 'center', justifyContent: 'center' },
  transferAvatarText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  transferOptionBody: { flex: 1, minWidth: 0 },
  transferOptionName: { color: '#111827', fontWeight: '900', fontSize: moderateScale(14), lineHeight: moderateScale(18) },
  transferOptionRole: { marginTop: 2, color: '#6B7280', fontWeight: '700', fontSize: moderateScale(12), lineHeight: moderateScale(16) },
  createTaskModal: { maxHeight: '86%', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14 },
  createTaskBody: { marginTop: 12, maxHeight: 520 },
  createModeRow: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  createModeBtn: { flexGrow: 1, minHeight: 34, paddingHorizontal: 10, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  createModeBtnOn: { backgroundColor: '#DBEAFE', borderWidth: hairline(), borderColor: '#93C5FD' },
  createModeText: { color: '#6B7280', fontSize: moderateScale(12), fontWeight: '900' },
  createModeTextOn: { color: '#1D4ED8' },
  createField: { gap: 6 },
  createLabel: { color: '#4B5563', fontSize: moderateScale(12), fontWeight: '900' },
  createInput: { minHeight: 42, borderRadius: 12, backgroundColor: '#F9FAFB', borderWidth: hairline(), borderColor: '#E5E7EB', paddingHorizontal: 12, color: '#111827', fontWeight: '800' },
  createTextArea: { minHeight: 82, paddingTop: 10, textAlignVertical: 'top' },
  createHint: { color: '#9CA3AF', fontSize: moderateScale(12), fontWeight: '700', lineHeight: moderateScale(17) },
  createSubmitBtn: { marginTop: 12, minHeight: 42, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  propertySuggestList: { marginTop: 2, borderRadius: 12, overflow: 'hidden', borderWidth: hairline(), borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  propertySuggestItem: { minHeight: 36, paddingHorizontal: 12, justifyContent: 'center', borderBottomWidth: hairline(), borderBottomColor: '#F3F4F6' },
  propertySuggestText: { color: '#111827', fontSize: moderateScale(13), fontWeight: '800' },
  searchWrap: { marginTop: 10, height: 44, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: hairline(), borderColor: '#EEF0F6', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: { flex: 1, minWidth: 0, height: 44, color: '#111827', fontWeight: '800' },
  searchClear: { minHeight: 44, width: 44, alignItems: 'center', justifyContent: 'center' },

  segmentWrap: { backgroundColor: '#F2F4F8', borderRadius: 14, padding: 8 },
  segment: { flexDirection: 'row', gap: 8 },
  segmentWrapResponsive: { flexWrap: 'wrap' },
  segmentItem: { flex: 1, minHeight: moderateScale(44), paddingVertical: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  segmentItemResponsive: { flexBasis: 96 },
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
  weekCard: { width: moderateScale(72) },
  weekCardFlex: { flex: 1, width: 0 },
  weekCardInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    minHeight: moderateScale(96),
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
  monthNavBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 44, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: hairline(), borderColor: '#EEF0F6' },
  monthNavBtnText: { fontWeight: '900', color: '#111827', fontSize: 12 },
  monthTitle: { fontWeight: '900', color: '#111827' },
  monthHeader: { flexDirection: 'row', paddingHorizontal: 4, marginBottom: 8 },
  monthHeaderText: { width: '14.2857%', textAlign: 'center', color: '#9CA3AF', fontWeight: '900', fontSize: 11 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  monthCell: { width: '14.2857%', paddingVertical: 6, paddingHorizontal: 4 },
  monthCellInner: {
    minHeight: moderateScale(52),
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

  sectionHeader: { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  sectionTitle: { flexShrink: 1, minWidth: 0, fontSize: moderateScale(14), fontWeight: '800', color: '#6B7280' },
  sectionCount: { flexShrink: 1, fontSize: moderateScale(12), fontWeight: '700', color: '#9CA3AF' },
  sectionRight: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1, flexWrap: 'wrap', justifyContent: 'flex-end' },
  viewSegment: { flexDirection: 'row', gap: 6, backgroundColor: '#F2F4F8', borderRadius: 14, padding: 4 },
  viewSegmentItem: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  viewSegmentItemActive: { backgroundColor: '#FFFFFF' },
  viewSegmentText: { fontSize: moderateScale(12), fontWeight: '800', color: '#6B7280' },
  viewSegmentTextActive: { color: '#111827' },
  addTaskBtn: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 11, backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  addTaskBtnText: { fontSize: moderateScale(12), fontWeight: '900', color: '#FFFFFF' },
  reorderBtn: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  reorderBtnDisabled: { backgroundColor: '#E5E7EB' },
  reorderBtnText: { fontSize: moderateScale(12), fontWeight: '900', color: '#111827' },

  cacheHintCard: { marginTop: 10, backgroundColor: '#EFF6FF', borderRadius: 16, padding: 14, borderWidth: hairline(), borderColor: '#DBEAFE', gap: 6 },
  cacheHintHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  cacheHintTitle: { fontSize: moderateScale(12), fontWeight: '900', color: '#2563EB' },
  cacheHintMeta: { fontSize: moderateScale(11), fontWeight: '700', color: '#4B5563' },
  cacheHintText: { color: '#1D4ED8', fontWeight: '800' },
  emptyCard: { marginTop: 10, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, borderWidth: hairline(), borderColor: '#EEF0F6' },
  emptyText: { color: '#9CA3AF', fontWeight: '800' },
  emptyRetryBtn: { marginTop: 12, minHeight: 38, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  emptyRetryText: { color: '#FFFFFF', fontWeight: '900' },

  taskCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, borderWidth: hairline(), borderColor: '#E8EDF5', shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  taskHeroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  taskHeroMain: { flex: 1, minWidth: 0 },
  taskTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  taskTitleRowCompact: { flexDirection: 'column', alignItems: 'stretch' },
  taskTitleMain: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 },
  taskTitleMainCompact: { width: '100%' },
  taskTitle: { flex: 1, minWidth: 0, flexShrink: 1, fontSize: moderateScale(17), lineHeight: moderateScale(22), fontWeight: '900', color: '#111827' },
  taskTitleCompact: { fontSize: moderateScale(16), lineHeight: moderateScale(21) },
  taskHeroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  taskHeroAside: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexShrink: 0, flexWrap: 'nowrap', alignSelf: 'flex-start' },
  taskHeroAsideCompact: { gap: 6 },
  collapseBtn: { minHeight: 36, minWidth: 72, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18, backgroundColor: '#F8FAFC', borderWidth: hairline(), borderColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, flexShrink: 0, alignSelf: 'center' },
  collapseBtnText: { color: '#6B7280', fontSize: moderateScale(12), fontWeight: '800' },
  orderPill: { width: 26, height: 26, borderRadius: 13, borderWidth: hairline(), borderColor: '#DBEAFE', backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  orderPillActive: { borderColor: '#2563EB', backgroundColor: '#2563EB' },
  orderPillText: { fontSize: 12, fontWeight: '900', color: '#2563EB' },
  orderPillTextActive: { color: '#FFFFFF' },
  orderInput: { width: 44, height: 30, borderRadius: 10, borderWidth: hairline(), borderColor: '#D1D5DB', paddingHorizontal: 8, fontWeight: '900', color: '#111827', textAlign: 'center' },
  statusPill: { minHeight: 36, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0, alignSelf: 'center' },
  statusText: { fontSize: 12, fontWeight: '900', lineHeight: 16, textAlign: 'center' },
  statusBlue: { backgroundColor: TASK_TONE_COLORS.normal.bg },
  statusAmber: { backgroundColor: TASK_TONE_COLORS.pending.bg },
  statusGreen: { backgroundColor: TASK_TONE_COLORS.success.bg },
  statusPurple: { backgroundColor: TASK_TONE_COLORS.special.bg },
  statusGray: { backgroundColor: TASK_TONE_COLORS.neutral.bg },
  statusTextBlue: { color: TASK_TONE_COLORS.normal.text },
  statusTextAmber: { color: TASK_TONE_COLORS.pending.text },
  statusTextGreen: { color: TASK_TONE_COLORS.success.text },
  statusTextPurple: { color: TASK_TONE_COLORS.special.text },
  statusTextGray: { color: TASK_TONE_COLORS.neutral.text },
  taskSubRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  tagNormal: { paddingHorizontal: 10, minHeight: 24, paddingVertical: 4, borderRadius: 12, backgroundColor: TASK_TONE_COLORS.normal.bg, borderWidth: hairline(), borderColor: TASK_TONE_COLORS.normal.border, alignItems: 'center', justifyContent: 'center' },
  tagNormalText: { fontSize: 11, fontWeight: '900', color: TASK_TONE_COLORS.normal.text },
  tagSpecial: { paddingHorizontal: 10, minHeight: 24, paddingVertical: 4, borderRadius: 12, backgroundColor: TASK_TONE_COLORS.special.bg, borderWidth: hairline(), borderColor: TASK_TONE_COLORS.special.border, alignItems: 'center', justifyContent: 'center' },
  tagSpecialText: { fontSize: 11, fontWeight: '900', color: TASK_TONE_COLORS.special.text },
  tagPending: { paddingHorizontal: 10, minHeight: 24, paddingVertical: 4, borderRadius: 12, backgroundColor: TASK_TONE_COLORS.pending.bg, borderWidth: hairline(), borderColor: TASK_TONE_COLORS.pending.border, alignItems: 'center', justifyContent: 'center' },
  tagPendingText: { fontSize: 11, fontWeight: '900', color: TASK_TONE_COLORS.pending.text },
  tagDanger: { paddingHorizontal: 10, minHeight: 24, paddingVertical: 4, borderRadius: 12, backgroundColor: TASK_TONE_COLORS.danger.bg, borderWidth: hairline(), borderColor: TASK_TONE_COLORS.danger.border, alignItems: 'center', justifyContent: 'center' },
  tagDangerText: { fontSize: 11, fontWeight: '900', color: TASK_TONE_COLORS.danger.text },
  tagSuccess: { paddingHorizontal: 10, minHeight: 24, paddingVertical: 4, borderRadius: 12, backgroundColor: TASK_TONE_COLORS.success.bg, borderWidth: hairline(), borderColor: TASK_TONE_COLORS.success.border, alignItems: 'center', justifyContent: 'center' },
  tagSuccessText: { fontSize: 11, fontWeight: '900', color: TASK_TONE_COLORS.success.text },
  tagInfo: { paddingHorizontal: 10, minHeight: 24, paddingVertical: 4, borderRadius: 12, backgroundColor: TASK_TONE_COLORS.info.bg, borderWidth: hairline(), borderColor: TASK_TONE_COLORS.info.border, alignItems: 'center', justifyContent: 'center' },
  tagInfoText: { fontSize: 11, fontWeight: '900', color: TASK_TONE_COLORS.info.text },
  urgencyPill: { paddingHorizontal: 10, minHeight: 24, paddingVertical: 4, borderRadius: 12, borderWidth: hairline(), alignItems: 'center', justifyContent: 'center' },
  urgencyText: { fontSize: 11, fontWeight: '900' },
  urgencyUrgent: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
  urgencyUrgentText: { color: '#B91C1C' },
  urgencyHigh: { backgroundColor: '#FFF7ED', borderColor: '#FDBA74' },
  urgencyHighText: { color: '#C2410C' },
  urgencyMedium: { backgroundColor: '#EFF6FF', borderColor: '#93C5FD' },
  urgencyMediumText: { color: '#1D4ED8' },
  urgencyLow: { backgroundColor: '#F3F4F6', borderColor: '#D1D5DB' },
  urgencyLowText: { color: '#4B5563' },
  tagGray: { paddingHorizontal: 10, minHeight: 24, paddingVertical: 4, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  tagGrayText: { fontSize: 11, fontWeight: '800', color: '#6B7280' },
  row: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  addr: { flex: 1, minWidth: 0, flexShrink: 1, color: '#6B7280', fontSize: moderateScale(13), fontWeight: '600' },
  linkInline: { flex: 1, minWidth: 0, flexShrink: 1, color: '#2563EB', fontSize: moderateScale(13), fontWeight: '800' },
  execCard: { marginTop: 14, padding: 14, borderRadius: 18, backgroundColor: '#F8FAFC', borderWidth: hairline(), borderColor: '#E5E7EB', gap: 10 },
  execLabel: { color: '#6B7280', fontWeight: '700', fontSize: moderateScale(12) },
  execPeople: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  execPerson: { flexGrow: 1, flexShrink: 1, flexBasis: 140, minWidth: 128, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: hairline(), borderColor: '#E5E7EB' },
  execBadgeClean: { width: 36, height: 36, borderRadius: 18, flexShrink: 0, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  execBadgeInspect: { width: 36, height: 36, borderRadius: 18, flexShrink: 0, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center' },
  execBadgeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  execPersonText: { flex: 1, minWidth: 0 },
  execPersonRole: { fontWeight: '800', fontSize: moderateScale(11), lineHeight: moderateScale(15) },
  execPersonRoleClean: { color: '#2563EB' },
  execPersonRoleInspect: { color: '#7C3AED' },
  execPersonName: { minWidth: 0, flexShrink: 1, color: '#111827', fontWeight: '800', fontSize: moderateScale(13), lineHeight: moderateScale(18) },
  execOrderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, columnGap: 16, paddingHorizontal: 4 },
  execOrder: { flexGrow: 1, flexBasis: 120, color: '#6B7280', fontWeight: '600', fontSize: moderateScale(11), lineHeight: moderateScale(16) },
  detailRowCard: { marginTop: 14, borderRadius: 16, backgroundColor: '#F8FAFC', borderWidth: hairline(), borderColor: '#E5E7EB', paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 12, minWidth: 0 },
  detailRowCardAccent: { backgroundColor: '#F0FDFA', borderColor: '#99F6E4' },
  detailIconWrap: { width: moderateScale(34), height: moderateScale(34), borderRadius: moderateScale(17), alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  detailIconBlue: { backgroundColor: '#DBEAFE' },
  detailIconIndigo: { backgroundColor: '#EEF2FF' },
  detailIconTeal: { backgroundColor: '#CCFBF1' },
  detailIconGreen: { backgroundColor: '#DCFCE7' },
  detailIconAmber: { backgroundColor: '#FEF3C7' },
  detailIconMuted: { backgroundColor: '#F3F4F6' },
  detailRowContent: { flex: 1, minWidth: 0 },
  detailRowLabel: { color: '#9CA3AF', fontWeight: '700', fontSize: moderateScale(12) },
  detailRowLabelTeal: { color: '#0F766E', fontWeight: '700', fontSize: moderateScale(12) },
  detailSplitRow: { marginTop: 6, flexDirection: 'row', alignItems: 'stretch', gap: 12, minWidth: 0 },
  detailSplitCell: { flex: 1, minWidth: 0 },
  detailSplitDivider: { width: hairline(), alignSelf: 'stretch', backgroundColor: '#E5E7EB' },
  detailSplitDividerTeal: { backgroundColor: '#99F6E4' },
  unitTypeText: { flexShrink: 1, color: '#111827', fontSize: moderateScale(13), fontWeight: '600' },
  addrText: { color: '#111827', fontSize: moderateScale(13), fontWeight: '600', lineHeight: moderateScale(19) },
  copyAffordance: { minHeight: 30, paddingHorizontal: 8, borderRadius: 999, borderWidth: hairline(), borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, flexShrink: 0 },
  copyAffordanceDone: { borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' },
  copyAffordanceText: { color: '#047857', fontSize: moderateScale(11), fontWeight: '900' },
  wifiLabel: { color: '#0F766E', fontWeight: '700', fontSize: moderateScale(12) },
  wifiValue: { marginTop: 2, color: '#111827', fontWeight: '600', fontSize: moderateScale(13) },
  timeLabel: { color: '#9CA3AF', fontWeight: '600', fontSize: moderateScale(12) },
  timeValue: { marginTop: 2, color: '#111827', fontWeight: '600', fontSize: moderateScale(13) },
  pwLabel: { color: '#9CA3AF', fontWeight: '600', fontSize: moderateScale(12) },
  pwValue: { marginTop: 2, color: '#111827', fontWeight: '600', fontSize: moderateScale(13) },
  guestValue: { marginTop: 4, color: '#111827', fontWeight: '600', fontSize: moderateScale(13), lineHeight: moderateScale(19) },
  guideText: { flex: 1, minWidth: 0, color: '#2563EB', fontWeight: '600', fontSize: moderateScale(13) },
  pwRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  pwText: { flex: 1, color: '#6B7280', fontSize: moderateScale(13), fontWeight: '700' },
  summary: { marginTop: 10, color: '#374151', fontWeight: '700', lineHeight: 18 },
  actionsRow: { marginTop: 12, flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'stretch' },
  actionBtn: { flex: 1, flexGrow: 1, flexShrink: 1, minWidth: 128, minHeight: 40, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 8 },
  actionBtnDisabled: { backgroundColor: '#E5E7EB' },
  actionText: { flexShrink: 1, fontWeight: '900', color: '#FFFFFF', fontSize: 12, lineHeight: 16, textAlign: 'center' },
})
