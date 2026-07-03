import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { hairline, moderateScale } from '../../lib/scale'
import { getNoticesSnapshot, initNoticesStore, markNoticeRead, subscribeNotices, type Notice } from '../../lib/noticesStore'
import { getPresentedNotice } from '../../lib/noticePresentation'
import type { NoticesStackParamList } from '../../navigation/RootNavigator'
import { useI18n } from '../../lib/i18n'
import { API_BASE_URL } from '../../config/env'
import { getAuthToken, getStoredUser } from '../../lib/authStorage'
import { markInboxNotificationsRead } from '../../lib/api'
import { isTaskManagerUser, roleNamesOf } from '../../lib/roles'
import { findWorkTaskItemByAnyId, refreshWorkTasksFromServer } from '../../lib/workTasksStore'
import { actionDisabledReasonText, navigationForWorkTaskAction, preferredNoticeActionForTask } from '../../lib/workTaskActions'

type Props = NativeStackScreenProps<NoticesStackParamList, 'NoticeDetail'>

function formatTime(iso: string) {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return '--/-- --:--'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
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

function stripUrlLines(text: string) {
  const lines = String(text || '').split('\n')
  const kept: string[] = []
  for (const line of lines) {
    if (/https?:\/\/\S+/i.test(line) && (line.includes('照片') || line.includes('图片') || line.includes('photo') || line.includes('image'))) continue
    kept.push(line)
  }
  return kept.join('\n').trim()
}

function parseNoticeDetails(text: string) {
  const lines = String(text || '')
    .split('\n')
    .map((line) => String(line || '').trim())
    .filter(Boolean)

  const fields: { label: string; value: string }[] = []
  const notes: string[] = []

  for (const line of lines) {
    const photoMatch = line.match(/^照片\s*[:：]\s*(.+)$/i)
    if (photoMatch) continue
    const pair = line.match(/^([^:：]{1,12})\s*[:：]\s*(.+)$/)
    if (pair) {
      fields.push({ label: String(pair[1] || '').trim(), value: String(pair[2] || '').trim() })
      continue
    }
    notes.push(line)
  }

  return { fields, notes: notes.join('\n').trim() }
}

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function pickTaskRouteIdFromNoticeData(data0: any) {
  const data = data0 && typeof data0 === 'object' ? data0 : {}
  const taskIds = Array.isArray((data as any).task_ids) ? (data as any).task_ids : []
  const firstTaskId = String(taskIds[0] || '').trim()
  if (firstTaskId) return firstTaskId
  const taskId = String((data as any).task_id || '').trim()
  if (taskId) return taskId
  const entity = String((data as any).entity || '').trim()
  const entityId = String((data as any).entityId || (data as any).entity_id || '').trim()
  if ((entity === 'cleaning_task' || entity === 'work_task') && entityId) return entityId
  return ''
}

export default function NoticeDetailScreen(props: Props) {
  const { t } = useI18n()
  const id = props.route.params.id
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)
  const [storeReady, setStoreReady] = useState(false)
  const [rawNotice, setRawNotice] = useState<Notice | null>(null)
  const [openingTask, setOpeningTask] = useState(false)

  useLayoutEffect(() => {
    props.navigation.setOptions({
      headerLeft: () => (
        <Pressable
          onPress={() => {
            if (props.navigation.canGoBack()) {
              props.navigation.goBack()
              return
            }
            try {
              props.navigation.navigate('NoticesList')
            } catch {
              const parentNav: any = props.navigation.getParent?.()
              parentNav?.navigate?.('Notices', { screen: 'NoticesList' })
            }
          }}
          style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingRight: 10, opacity: pressed ? 0.7 : 1 }]}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={moderateScale(20)} color="#111827" />
          <Text style={{ color: '#111827', fontWeight: '700', fontSize: 14 }}>返回</Text>
        </Pressable>
      ),
    })
  }, [props.navigation])

  const notice = useMemo(() => (rawNotice ? getPresentedNotice(rawNotice) : null), [rawNotice])

  useEffect(() => {
    let alive = true
    let unsub: (() => void) | null = null
    const update = () => {
      if (!alive) return
      setRawNotice(getNoticesSnapshot().items.find((item) => item.id === id) || null)
    }
    ;(async () => {
      await initNoticesStore()
      if (!alive) return
      update()
      setStoreReady(true)
      unsub = subscribeNotices(update)
      await markNoticeRead(id)
      try {
        const token = await getAuthToken()
        const current = getNoticesSnapshot().items.find((item) => item.id === id) || null
        const serverId = String((current as any)?.data?._server_id || '').trim()
        if (token && serverId) await markInboxNotificationsRead(String(token), { ids: [serverId] })
      } catch {}
    })()
    return () => {
      alive = false
      if (unsub) unsub()
    }
  }, [id])

  if (!storeReady) {
    return (
      <View style={styles.page}>
        <ActivityIndicator style={styles.loading} color="#2563EB" />
      </View>
    )
  }

  if (!notice) {
    return (
      <View style={styles.page}>
        <Text style={styles.errorText}>{t('common_error')}</Text>
      </View>
    )
  }

  const meta =
    notice.type === 'update'
      ? { bg: '#EFF6FF', fg: '#2563EB' }
      : notice.type === 'key'
        ? { bg: '#DCFCE7', fg: '#16A34A' }
        : { bg: '#F3F4F6', fg: '#374151' }
  const imgs = Array.from(new Set(notice.images || []))
  const imagesAtBottom = notice.type === 'key'
  const bodyText = stripUrlLines(notice.content) || notice.content
  const details = parseNoticeDetails(bodyText)
  const action = String((notice as any)?.data?.action || '').trim()
  const targetDate = String((notice as any)?.data?.date || '').trim()
  const targetUserId = String((notice as any)?.data?.target_user_id || '').trim()
  const targetUserName = String((notice as any)?.data?.target_user_name || '').trim()
  const canOpenDayEnd = action === 'open_day_end_handover' && !!targetDate
  const noticeData = (rawNotice as any)?.data || (notice as any)?.data || {}
  const taskRouteId = pickTaskRouteIdFromNoticeData(noticeData)
  const canOpenTask = !!taskRouteId && !canOpenDayEnd

  async function openRelatedTask() {
    if (!taskRouteId || openingTask) return
    setOpeningTask(true)
    try {
      const token = await getAuthToken()
      const storedUser = await getStoredUser()
      const userId = String(storedUser?.id || '').trim()
      const existingTask = findWorkTaskItemByAnyId(taskRouteId)
      const baseDateRaw = String((noticeData as any)?.date || existingTask?.scheduled_date || (existingTask as any)?.date || '').slice(0, 10)
      const parsedBase = /^\d{4}-\d{2}-\d{2}$/.test(baseDateRaw) ? new Date(`${baseDateRaw}T00:00:00`) : new Date()
      if (token && userId) {
        await refreshWorkTasksFromServer({
          token,
          userId,
          date_from: formatDateKey(addDays(parsedBase, -7)),
          date_to: formatDateKey(addDays(parsedBase, 60)),
          view: isTaskManagerUser(storedUser) ? 'all' : 'mine',
        })
      }
      const task = findWorkTaskItemByAnyId(taskRouteId) || existingTask
      if (!task) {
        props.navigation.navigate('TaskDetail', { id: taskRouteId })
        return
      }
      const preferredAction = preferredNoticeActionForTask(task, noticeData, { roleNames: roleNamesOf(storedUser) })
      if (preferredAction && !preferredAction.enabled) {
        Alert.alert('暂不可操作', actionDisabledReasonText(preferredAction.disabled_reason || '任务已不可执行'))
        props.navigation.navigate('TaskDetail', { id: task.id })
        return
      }
      const route = preferredAction ? navigationForWorkTaskAction(task, preferredAction) : null
      if (route && route.screen !== 'TaskDetail') {
        props.navigation.navigate(route.screen as any, route.params as any)
        return
      }
      props.navigation.navigate('TaskDetail', route?.params || { id: task.id })
    } catch (e: any) {
      Alert.alert('刷新失败', String(e?.message || '无法刷新任务，请稍后再试'))
    } finally {
      setOpeningTask(false)
    }
  }

  return (
    <>
      <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.metaRow}>
            <View style={[styles.badge, { backgroundColor: meta.bg }]}>
              <Text style={[styles.badgeText, { color: meta.fg }]}>{notice.type === 'key' ? t('notices_type_key') : notice.type === 'update' ? t('notices_type_update') : t('notices_type_system')}</Text>
            </View>
            <View style={styles.timeRow}>
              <Ionicons name="time-outline" size={moderateScale(14)} color="#9CA3AF" />
              <Text style={styles.time}>{formatTime(notice.createdAt)}</Text>
            </View>
          </View>

          <Text style={styles.title}>{notice.title}</Text>

          {details.fields.length ? (
            <View style={styles.infoGrid}>
              {details.fields.map((field) => (
                <View key={`${field.label}:${field.value}`} style={styles.infoCard}>
                  <Text style={styles.infoLabel}>{field.label}</Text>
                  <Text style={styles.infoValue}>{field.value}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {!imagesAtBottom && imgs.length ? (
            <View style={styles.imagesWrap}>
              {imgs.map((u) => (
                <Pressable
                  key={u}
                  onPress={() => {
                    setViewerUrl(u)
                    setViewerOpen(true)
                  }}
                  style={({ pressed }) => [styles.imagePress, pressed ? styles.pressed : null]}
                >
                  <Image source={{ uri: toAbsoluteUrl(u) }} style={styles.image} />
                </Pressable>
              ))}
            </View>
          ) : null}

          {details.notes ? (
            <View style={styles.noteCard}>
              <Text style={styles.noteLabel}>说明</Text>
              <Text style={styles.body}>{details.notes}</Text>
            </View>
          ) : null}

          {canOpenDayEnd ? (
            <Pressable
              onPress={() => props.navigation.navigate('DayEndBackupKeys', { date: targetDate, ...(targetUserId ? { userId: targetUserId } : {}), ...(targetUserName ? { userName: targetUserName } : {}) })}
              style={({ pressed }) => [styles.actionBtn, pressed ? styles.pressed : null]}
            >
              <Ionicons name="open-outline" size={moderateScale(16)} color="#2563EB" />
              <Text style={styles.actionText}>查看日终交接</Text>
            </Pressable>
          ) : null}

          {canOpenTask ? (
            <Pressable
              disabled={openingTask}
              onPress={openRelatedTask}
              style={({ pressed }) => [styles.actionBtn, pressed ? styles.pressed : null, openingTask ? styles.actionBtnDisabled : null]}
            >
              {openingTask ? <ActivityIndicator size="small" color="#2563EB" /> : <Ionicons name="open-outline" size={moderateScale(16)} color="#2563EB" />}
              <Text style={styles.actionText}>{openingTask ? '刷新任务中...' : '查看任务'}</Text>
            </Pressable>
          ) : null}

          {imagesAtBottom && imgs.length ? (
            <View style={styles.photoSection}>
              <Text style={styles.noteLabel}>照片</Text>
              <View style={styles.imagesWrap}>
              {imgs.map((u) => (
                <Pressable
                  key={u}
                  onPress={() => {
                    setViewerUrl(u)
                    setViewerOpen(true)
                  }}
                  style={({ pressed }) => [styles.imagePress, pressed ? styles.pressed : null]}
                >
                  <Image source={{ uri: toAbsoluteUrl(u) }} style={styles.image} />
                </Pressable>
              ))}
            </View>
            </View>
          ) : null}
        </View>
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
              <Image source={{ uri: toAbsoluteUrl(viewerUrl) }} style={styles.viewerImg} resizeMode="contain" />
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F6F7FB' },
  loading: { marginTop: 48 },
  content: { padding: 16 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: hairline(),
    borderColor: '#EEF0F6',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  badge: { minHeight: 26, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 3, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 12, fontWeight: '900' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  time: { color: '#9CA3AF', fontSize: 12, fontWeight: '700' },
  title: { marginTop: 12, fontSize: moderateScale(18), fontWeight: '900', color: '#111827' },
  body: { marginTop: 8, color: '#374151', fontSize: 14, fontWeight: '600', lineHeight: 20 },
  errorText: { padding: 16, color: '#6B7280', fontWeight: '700' },
  pressed: { opacity: 0.92 },
  infoGrid: { marginTop: 14, gap: 10 },
  infoCard: { borderRadius: 14, backgroundColor: '#F8FAFC', borderWidth: hairline(), borderColor: '#E2E8F0', padding: 12 },
  infoLabel: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  infoValue: { marginTop: 6, color: '#111827', fontSize: 15, fontWeight: '900' },
  noteCard: { marginTop: 14, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: hairline(), borderColor: '#E5E7EB', padding: 12 },
  actionBtn: { marginTop: 14, minHeight: 42, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: '#EFF6FF', borderWidth: hairline(), borderColor: '#BFDBFE', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionBtnDisabled: { opacity: 0.65 },
  actionText: { color: '#2563EB', fontWeight: '900', textAlign: 'center' },
  noteLabel: { color: '#6B7280', fontSize: 12, fontWeight: '900' },
  photoSection: { marginTop: 14 },
  imagesWrap: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  imagePress: { flexBasis: '47%', flexGrow: 1, minWidth: 120, borderRadius: 14, overflow: 'hidden', borderWidth: hairline(), borderColor: '#EEF0F6', backgroundColor: '#F3F4F6' },
  image: { width: '100%', height: 160, backgroundColor: '#F3F4F6' },
  viewerMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  viewerTopRow: { position: 'absolute', top: 0, left: 0, right: 0, height: 54, paddingHorizontal: 12, justifyContent: 'center', zIndex: 2 },
  viewerCloseText: { color: '#FFFFFF', fontWeight: '900' },
  viewerImg: { flex: 1 },
})
