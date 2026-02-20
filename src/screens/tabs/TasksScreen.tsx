import React, { useEffect, useMemo, useState } from 'react'
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { hairline, moderateScale } from '../../lib/scale'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { getTasksSnapshot, initTasksStore, subscribeTasks, type Task } from '../../lib/tasksStore'
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

export default function TasksScreen(props: Props) {
  const { user } = useAuth()
  const { locale, t } = useI18n()
  const [period, setPeriod] = useState<Period>('today')
  const [selectedDate, setSelectedDate] = useState<string>(() => ymd(new Date()))
  const [hasInit, setHasInit] = useState(false)
  const [, bump] = useState(0)

  const greetingName = useMemo(() => {
    const raw = String(user?.username || '').trim()
    if (!raw) return 'Alice'
    return raw.includes('@') ? raw.split('@')[0] || raw : raw
  }, [user?.username])

  useEffect(() => {
    if (period === 'today') setSelectedDate(ymd(new Date()))
  }, [period])

  useEffect(() => {
    let unsub: (() => void) | null = null
    ;(async () => {
      await initTasksStore()
      setHasInit(true)
      unsub = subscribeTasks(() => bump(v => v + 1))
      bump(v => v + 1)
    })()
    return () => {
      if (unsub) unsub()
    }
  }, [])

  const items = getTasksSnapshot().items
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of items) {
      const list = map.get(task.date) || []
      list.push(task)
      map.set(task.date, list)
    }
    return map
  }, [items])

  const selected = useMemo(() => parseYmd(selectedDate), [selectedDate])

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

  const monthGrid = useMemo(() => {
    const base = new Date()
    const monthStart = new Date(base.getFullYear(), base.getMonth(), 1)
    const start = startOfWeekMonday(monthStart)
    const total = 42
    const month = base.getMonth()
    const days = daysInMonth(base)
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
  }, [locale, selectedDate, tasksByDate])

  const selectedTasks = useMemo(() => tasksByDate.get(selectedDate) || [], [selectedDate, tasksByDate])

  const sectionTitle = useMemo(() => {
    if (period === 'today') return t('tasks_section_today')
    if (locale === 'en') {
      const d = parseYmd(selectedDate)
      return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} Tasks`
    }
    const d = parseYmd(selectedDate)
    return `${d.getMonth() + 1}月${d.getDate()}日 任务`
  }, [locale, period, selectedDate, t])

  const countText = useMemo(() => {
    const n = selectedTasks.length
    return `${n} ${t('tasks_tasks_suffix')}`
  }, [selectedTasks.length, t])

  function statusMeta(status: Task['status']) {
    if (status === 'cleaning') return { text: t('tasks_status_cleaning'), pill: styles.taskStatusBlue, textStyle: styles.taskStatusTextBlue }
    if (status === 'completed') return { text: t('task_status_completed'), pill: styles.taskStatusGreen, textStyle: styles.taskStatusTextGreen }
    return { text: t('task_status_pending_key'), pill: styles.taskStatusAmber, textStyle: styles.taskStatusTextAmber }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.hello}>
          {t('tasks_greeting')} <Text style={styles.helloName}>{greetingName}</Text>
        </Text>
        <View style={styles.avatar}>
          <View style={styles.avatarInner} />
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.segmentWrap}>
          <View style={styles.segment}>
            <Pressable
              onPress={() => {
                setPeriod('today')
                setSelectedDate(ymd(new Date()))
              }}
              style={({ pressed }) => [
                styles.segmentItem,
                period === 'today' ? styles.segmentItemActive : null,
                pressed ? styles.segmentPressed : null,
              ]}
            >
              <Text style={[styles.segmentText, period === 'today' ? styles.segmentTextActive : null]}>{t('tasks_period_today')}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setPeriod('week')
                setSelectedDate(ymd(new Date()))
              }}
              style={({ pressed }) => [
                styles.segmentItem,
                period === 'week' ? styles.segmentItemActive : null,
                pressed ? styles.segmentPressed : null,
              ]}
            >
              <Text style={[styles.segmentText, period === 'week' ? styles.segmentTextActive : null]}>{t('tasks_period_week')}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setPeriod('month')
                setSelectedDate(ymd(new Date()))
              }}
              style={({ pressed }) => [
                styles.segmentItem,
                period === 'month' ? styles.segmentItemActive : null,
                pressed ? styles.segmentPressed : null,
              ]}
            >
              <Text style={[styles.segmentText, period === 'month' ? styles.segmentTextActive : null]}>{t('tasks_period_month')}</Text>
            </Pressable>
          </View>
        </View>

        {period === 'month' ? (
          <View style={styles.monthWrap}>
            <View style={styles.monthHeader}>
              {monthGrid.header.map(h => (
                <Text key={h} style={styles.monthHeaderText}>
                  {h}
                </Text>
              ))}
            </View>
            <View style={styles.monthGrid}>
              {monthGrid.cells.map(c =>
                !c.inMonth ? (
                  <View key={c.key} style={styles.monthCell} />
                ) : (
                  <Pressable
                    key={c.key}
                    onPress={() => setSelectedDate(c.key)}
                    style={({ pressed }) => [styles.monthCell, pressed ? styles.segmentPressed : null]}
                  >
                    <View style={[styles.monthCellInner, c.isSelected ? styles.monthCellSelected : null]}>
                      <Text style={[styles.monthDay, c.isSelected ? styles.monthDaySelected : null]}>{c.day}</Text>
                      <View style={[styles.monthDot, c.isSelected ? styles.monthDotSelected : c.hasTask ? styles.monthDotOn : styles.monthDotHidden]} />
                    </View>
                  </Pressable>
                ),
              )}
            </View>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekRow}>
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
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{sectionTitle}</Text>
          <Text style={styles.sectionCount}>{countText}</Text>
        </View>

        {!hasInit ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{t('common_loading')}</Text>
          </View>
        ) : selectedTasks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{t('tasks_no_tasks')}</Text>
          </View>
        ) : (
          <View style={{ marginTop: 10, gap: 12 }}>
            {selectedTasks.map(task => {
              const meta = statusMeta(task.status)
              return (
                <View key={task.id} style={styles.taskCard}>
                  <View style={styles.taskTopRow}>
                    <View style={styles.taskImage}>
                      <View style={styles.taskImageCorner}>
                        <Text style={styles.taskImageCornerText}>U</Text>
                      </View>
                      <View style={styles.taskImageMark}>
                        <Text style={styles.taskImageMarkText}>?</Text>
                      </View>
                    </View>

                    <View style={styles.taskMain}>
                      <View style={styles.taskTitleRow}>
                        <Text style={styles.taskTitle}>{task.title}</Text>
                        <View style={[styles.taskStatus, meta.pill]}>
                          <Text style={[styles.taskStatusText, meta.textStyle]}>{meta.text}</Text>
                        </View>
                      </View>

                      <View style={styles.taskAddrRow}>
                        <Ionicons name="location-outline" size={moderateScale(14)} color="#9CA3AF" />
                        <Text style={styles.taskAddr}>{task.address}</Text>
                      </View>

                      <View style={styles.taskTags}>
                        <View style={styles.tagGray}>
                          <Text style={styles.tagGrayText}>{task.unitType}</Text>
                        </View>
                        <View style={styles.tagRed}>
                          <Ionicons name="time-outline" size={moderateScale(12)} color="#EF4444" />
                          <Text style={styles.tagRedText}>{t('tasks_tag_priority')}</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <View style={styles.routeRow}>
                    <View style={styles.routeLeft}>
                      <View style={styles.routeIcon}>
                        <Ionicons name="list-outline" size={moderateScale(16)} color="#2563EB" />
                      </View>
                      <Text style={styles.routeText}>{t('tasks_route_order')}</Text>
                    </View>
                    <View style={styles.routeRight}>
                      <Text style={styles.routeRightText}>{t('tasks_route_rank')}</Text>
                      <Ionicons name="chevron-down" size={moderateScale(16)} color="#2563EB" />
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.timeRow}>
                    <View style={styles.timeCol}>
                      <Text style={styles.timeLabel}>{t('tasks_checkout')}</Text>
                      <View style={styles.timeValueRow}>
                        <Ionicons name="time-outline" size={moderateScale(14)} color="#EF4444" />
                        <Text style={styles.timeValue}>{task.checkoutTime}</Text>
                      </View>
                    </View>
                    <View style={styles.timeCol}>
                      <Text style={styles.timeLabel}>{t('tasks_next_checkin')}</Text>
                      <View style={styles.timeValueRow}>
                        <Ionicons name="person-outline" size={moderateScale(14)} color="#2563EB" />
                        <Text style={styles.timeValue}>{task.nextCheckinTime}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.codeRow}>
                    <View style={[styles.codeCard, styles.codeCardMuted]}>
                      <Text style={styles.codeLabel}>{t('tasks_old_code')}</Text>
                      <Text style={[styles.codeValue, styles.codeValueMuted]}>{task.oldCode}</Text>
                    </View>
                    <View style={[styles.codeCard, styles.codeCardBlue]}>
                      <View style={styles.codeLabelRow}>
                        <Ionicons name="lock-closed-outline" size={moderateScale(12)} color="#2563EB" />
                        <Text style={[styles.codeLabel, styles.codeLabelBlue]}>{t('tasks_master_code')}</Text>
                      </View>
                      <Text style={[styles.codeValue, styles.codeValueBlue]}>{task.masterCode}</Text>
                    </View>
                    <View style={[styles.codeCard, styles.codeCardGreen]}>
                      <Text style={[styles.codeLabel, styles.codeLabelGreen]}>{t('tasks_new_code')}</Text>
                      <Text style={[styles.codeValue, styles.codeValueGreen]}>{task.newCode}</Text>
                    </View>
                  </View>

                  <View style={styles.linkRow}>
                    <Ionicons name="open-outline" size={moderateScale(16)} color="#2563EB" />
                    <Text style={styles.linkText}>
                      {t('tasks_view_guide')} (Keypad code: {task.keypadCode})
                    </Text>
                  </View>

                  <View style={styles.actionsRow}>
                    <Pressable
                      onPress={() => props.navigation.navigate('TaskDetail', { id: task.id, action: 'upload_key' })}
                      style={({ pressed }) => [styles.actionBtn, styles.actionBtnBlue, pressed ? styles.segmentPressed : null]}
                    >
                      <Ionicons name="cloud-upload-outline" size={moderateScale(16)} color="#FFFFFF" />
                      <Text style={styles.actionBtnText}>{t('tasks_btn_upload_key')}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => props.navigation.navigate('RepairForm', { taskId: task.id })}
                      style={({ pressed }) => [styles.actionBtn, styles.actionBtnGray, pressed ? styles.segmentPressed : null]}
                    >
                      <Ionicons name="construct-outline" size={moderateScale(16)} color="#111827" />
                      <Text style={styles.actionBtnTextDark}>{t('tasks_btn_repair')}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => props.navigation.navigate('TaskDetail', { id: task.id, action: 'complete' })}
                      disabled={task.status === 'completed'}
                      style={({ pressed }) => [
                        styles.actionBtn,
                        styles.actionBtnGreen,
                        task.status === 'completed' ? styles.actionBtnDisabled : null,
                        pressed ? styles.segmentPressed : null,
                      ]}
                    >
                      <Ionicons name="checkmark-circle-outline" size={moderateScale(16)} color="#FFFFFF" />
                      <Text style={styles.actionBtnText}>{t('tasks_btn_complete')}</Text>
                    </Pressable>
                  </View>
                </View>
              )
            })}
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
  avatarInner: { flex: 1, backgroundColor: '#0B0F17' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 },

  segmentWrap: {
    backgroundColor: '#F2F4F8',
    borderRadius: 14,
    padding: 8,
  },
  segment: { flexDirection: 'row', gap: 8 },
  segmentItem: {
    flex: 1,
    height: moderateScale(38),
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
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

  weekRow: { gap: 10, marginTop: 14, paddingRight: 2 },
  weekCard: { width: moderateScale(64) },
  weekCardInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: hairline(),
    borderColor: '#EEF0F6',
  },
  dateCardSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  dateDow: { fontSize: moderateScale(12), fontWeight: '800', color: '#6B7280' },
  dateDowSelected: { color: '#FFFFFF', opacity: 0.95 },
  dateDay: { marginTop: 4, fontSize: moderateScale(18), fontWeight: '900', color: '#111827' },
  dateDaySelected: { color: '#FFFFFF' },
  dateDot: {
    marginTop: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563EB',
  },
  dateDotSelected: { backgroundColor: '#FFFFFF' },
  dateDotOn: { backgroundColor: '#2563EB' },
  dateDotHidden: { opacity: 0 },

  monthWrap: { marginTop: 14 },
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
  monthCellSelected: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  monthDay: { fontSize: 13, fontWeight: '900', color: '#111827' },
  monthDaySelected: { color: '#FFFFFF' },
  monthDot: { marginTop: 4, width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#2563EB' },
  monthDotSelected: { backgroundColor: '#FFFFFF' },
  monthDotOn: { backgroundColor: '#2563EB' },
  monthDotHidden: { opacity: 0 },

  sectionHeader: { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  sectionTitle: { fontSize: moderateScale(14), fontWeight: '800', color: '#6B7280' },
  sectionCount: { fontSize: moderateScale(12), fontWeight: '700', color: '#9CA3AF' },

  emptyCard: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: hairline(),
    borderColor: '#EEF0F6',
  },
  emptyText: { color: '#9CA3AF', fontWeight: '800' },

  taskCard: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: hairline(),
    borderColor: '#EEF0F6',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  taskTopRow: { flexDirection: 'row', gap: 12 },
  taskImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskImageCorner: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 18,
    height: 18,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskImageCornerText: { color: '#FFFFFF', fontWeight: '900', fontSize: 10 },
  taskImageMark: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskImageMarkText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },

  taskMain: { flex: 1 },
  taskTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  taskTitle: { fontSize: moderateScale(18), fontWeight: '900', color: '#111827' },
  taskStatus: {
    paddingHorizontal: 12,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskStatusBlue: { backgroundColor: '#DBEAFE' },
  taskStatusAmber: { backgroundColor: '#FEF3C7' },
  taskStatusGreen: { backgroundColor: '#DCFCE7' },
  taskStatusText: { fontSize: moderateScale(12), fontWeight: '900' },
  taskStatusTextBlue: { color: '#2563EB' },
  taskStatusTextAmber: { color: '#B45309' },
  taskStatusTextGreen: { color: '#16A34A' },
  taskAddrRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  taskAddr: { color: '#6B7280', fontSize: moderateScale(13), fontWeight: '600' },
  taskTags: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  tagGray: {
    paddingHorizontal: 10,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagGrayText: { fontSize: 11, fontWeight: '800', color: '#6B7280' },
  tagRed: {
    paddingHorizontal: 10,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  tagRedText: { fontSize: 11, fontWeight: '800', color: '#EF4444' },

  routeRow: {
    marginTop: 12,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    borderWidth: hairline(),
    borderColor: '#DBEAFE',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routeLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeText: { fontSize: moderateScale(14), fontWeight: '800', color: '#2563EB' },
  routeRight: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: hairline(),
    borderColor: '#BFDBFE',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  routeRightText: { fontSize: moderateScale(13), fontWeight: '900', color: '#2563EB' },

  divider: { marginTop: 12, height: hairline(), backgroundColor: '#EEF0F6' },

  timeRow: { flexDirection: 'row', marginTop: 12 },
  timeCol: { flex: 1 },
  timeLabel: { color: '#9CA3AF', fontSize: moderateScale(12), fontWeight: '800' },
  timeValueRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeValue: { fontSize: moderateScale(16), fontWeight: '900', color: '#111827' },

  codeRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  codeCard: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: hairline(),
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeCardMuted: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
  codeCardBlue: { backgroundColor: '#EFF6FF', borderColor: '#DBEAFE' },
  codeCardGreen: { backgroundColor: '#DCFCE7', borderColor: '#BBF7D0' },
  codeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  codeLabel: { fontSize: 11, fontWeight: '800', color: '#6B7280' },
  codeLabelBlue: { color: '#2563EB' },
  codeLabelGreen: { color: '#16A34A' },
  codeValue: { marginTop: 6, fontSize: moderateScale(16), fontWeight: '900', color: '#111827' },
  codeValueMuted: { color: '#374151' },
  codeValueBlue: { color: '#2563EB' },
  codeValueGreen: { color: '#16A34A' },

  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  linkText: { color: '#2563EB', fontSize: moderateScale(14), fontWeight: '800' },
  actionsRow: { marginTop: 12, flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnBlue: { backgroundColor: '#2563EB' },
  actionBtnGreen: { backgroundColor: '#16A34A' },
  actionBtnGray: { backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB' },
  actionBtnDisabled: { opacity: 0.6 },
  actionBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  actionBtnTextDark: { color: '#111827', fontSize: 13, fontWeight: '900' },
})
