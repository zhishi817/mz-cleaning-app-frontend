import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Platform, View } from 'react-native'
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { findWorkTaskItemByAnyId } from '../lib/workTasksStore'
import { getNoticesSnapshot, initNoticesStore, prependNotice, subscribeNotices, upsertNotices } from '../lib/noticesStore'
import { listInboxNotifications, registerExpoPushToken } from '../lib/api'
import { resolveNoticeCreatedAt } from '../lib/noticeTime'
import LoginScreen from '../screens/LoginScreen'
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen'
import TasksScreen from '../screens/tabs/TasksScreen'
import NoticesScreen from '../screens/tabs/NoticesScreen'
import ContactsScreen from '../screens/tabs/ContactsScreen'
import MeScreen from '../screens/tabs/MeScreen'
import NoticeDetailScreen from '../screens/notices/NoticeDetailScreen'
import InfoCenterDetailScreen from '../screens/notices/InfoCenterDetailScreen'
import ContactDetailScreen from '../screens/contacts/ContactDetailScreen'
import ProfileEditScreen from '../screens/me/ProfileEditScreen'
import AccountScreen from '../screens/me/AccountScreen'
import ChangePasswordScreen from '../screens/me/ChangePasswordScreen'
import TaskDetailScreen from '../screens/tasks/TaskDetailScreen'
import FeedbackFormScreen from '../screens/tasks/FeedbackFormScreen'
import SuppliesFormScreen from '../screens/tasks/SuppliesFormScreen'
import InspectionPanelScreen from '../screens/tasks/InspectionPanelScreen'
import InspectionCompleteScreen from '../screens/tasks/InspectionCompleteScreen'
import CleaningSelfCompleteScreen from '../screens/tasks/CleaningSelfCompleteScreen'
import ManagerDailyTaskScreen from '../screens/tasks/ManagerDailyTaskScreen'
import DayEndBackupKeysScreen from '../screens/tasks/DayEndBackupKeysScreen'

export type AuthStackParamList = {
  Login: undefined
  ForgotPassword: undefined
}

export type AppTabParamList = {
  Tasks: undefined
  Notices: undefined
  Contacts: undefined
  Me: undefined
}

const AuthStack = createNativeStackNavigator<AuthStackParamList>()
const Tabs = createBottomTabNavigator<AppTabParamList>()
const TasksStack = createNativeStackNavigator<TasksStackParamList>()
const NoticesStack = createNativeStackNavigator<NoticesStackParamList>()
const ContactsStack = createNativeStackNavigator<ContactsStackParamList>()
const MeStack = createNativeStackNavigator<MeStackParamList>()

export type TasksStackParamList = {
  TasksList: undefined
  TaskDetail: { id: string; action?: 'upload_key' | 'complete' }
  InspectionPanel: { taskId: string }
  InspectionComplete: { taskId: string }
  CleaningSelfComplete: { taskId: string }
  ManagerDailyTask: { taskId: string }
  DayEndBackupKeys: { date: string; userId?: string; userName?: string; focus?: 'key' | 'dirty'; taskRoomCodes?: string[] }
  FeedbackForm: { taskId: string }
  SuppliesForm: { taskId: string }
}

export type NoticesStackParamList = {
  NoticesList: undefined
  NoticeDetail: { id: string }
  InfoCenterDetail: { kind: 'property' | 'secret' | 'task' | 'announcement' | 'guide' | 'warehouse_guide'; title: string; subtitle?: string; body?: string; url?: string | null; copyText?: string | null; secretId?: string }
  TaskDetail: { id: string; action?: 'upload_key' | 'complete' }
  InspectionPanel: { taskId: string }
  InspectionComplete: { taskId: string }
  CleaningSelfComplete: { taskId: string }
  ManagerDailyTask: { taskId: string }
  DayEndBackupKeys: { date: string; userId?: string; userName?: string; focus?: 'key' | 'dirty'; taskRoomCodes?: string[] }
  FeedbackForm: { taskId: string }
  SuppliesForm: { taskId: string }
}

export type ContactsStackParamList = {
  ContactsList: undefined
  ContactDetail: { id: string }
}

export type MeStackParamList = {
  MeHome: undefined
  ProfileEdit: undefined
  Account: undefined
  ChangePassword: undefined
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

function resolveTaskNoticeNavigation(params: { taskRouteId: string; role: string }) {
  const role = String(params.role || '').trim()
  const task = findWorkTaskItemByAnyId(params.taskRouteId)
  const isCleaningTask = String(task?.source_type || '').trim() === 'cleaning_tasks'
  const isInspection = isCleaningTask && String(task?.task_kind || '').trim() === 'inspection'
  const isManager = role === 'admin' || role === 'offline_manager' || role === 'customer_service'
  const isInspector = role === 'cleaning_inspector' || role === 'cleaner_inspector'
  if (isManager && isCleaningTask) return { screen: 'ManagerDailyTask', params: { taskId: params.taskRouteId } }
  if (isInspector && isInspection) return { screen: 'InspectionPanel', params: { taskId: params.taskRouteId } }
  return { screen: 'TaskDetail', params: { id: params.taskRouteId } }
}

function formatIncomingNotice(title0: string, body0: string, data0: any) {
  const data = data0 && typeof data0 === 'object' ? data0 : {}
  const kind = String(data?.kind || '').trim()
  const propertyCode = String(data?.property_code || '').trim()
  const photoUrl = String(data?.photo_url || '').trim()
  if (kind !== 'key_photo_uploaded') {
    return {
      title: title0 || '通知',
      summary: body0.split('\n')[0]?.slice(0, 60) || body0.slice(0, 60) || '通知',
      content: body0 || title0 || '通知',
    }
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

function BootScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  )
}

function AuthStackNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerTitleAlign: 'center' }}>
      <AuthStack.Screen name="Login" component={LoginScreen} options={{ title: '登录' }} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: '找回密码' }} />
    </AuthStack.Navigator>
  )
}

function TasksStackNavigator() {
  const { t } = useI18n()
  return (
    <TasksStack.Navigator screenOptions={{ headerTitleAlign: 'center' }}>
      <TasksStack.Screen name="TasksList" component={TasksScreen} options={{ headerShown: false, title: t('tabs_tasks') }} />
      <TasksStack.Screen name="TaskDetail" component={TaskDetailScreen} options={{ title: t('task_detail_title') }} />
      <TasksStack.Screen name="InspectionPanel" component={InspectionPanelScreen} options={{ title: '检查与补充' }} />
      <TasksStack.Screen name="InspectionComplete" component={InspectionCompleteScreen} options={{ title: '标记已完成' }} />
      <TasksStack.Screen name="CleaningSelfComplete" component={CleaningSelfCompleteScreen} options={{ title: '补充与完成' }} />
      <TasksStack.Screen name="ManagerDailyTask" component={ManagerDailyTaskScreen} options={{ title: '每日清洁' }} />
      <TasksStack.Screen name="DayEndBackupKeys" component={DayEndBackupKeysScreen} options={{ title: '日终交接' }} />
      <TasksStack.Screen name="FeedbackForm" component={FeedbackFormScreen} options={{ title: t('tasks_btn_repair') }} />
      <TasksStack.Screen name="SuppliesForm" component={SuppliesFormScreen} options={{ title: '补品填报' }} />
    </TasksStack.Navigator>
  )
}

function NoticesStackNavigator() {
  const { t } = useI18n()
  return (
    <NoticesStack.Navigator screenOptions={{ headerTitleAlign: 'center' }}>
      <NoticesStack.Screen name="NoticesList" component={NoticesScreen} options={{ headerShown: false, title: t('notices_title') }} />
      <NoticesStack.Screen name="NoticeDetail" component={NoticeDetailScreen} options={{ title: t('notices_title'), animation: 'slide_from_right' }} />
      <NoticesStack.Screen name="InfoCenterDetail" component={InfoCenterDetailScreen} options={{ title: t('notices_title'), animation: 'slide_from_right' }} />
      <NoticesStack.Screen name="TaskDetail" component={TaskDetailScreen} options={{ title: t('task_detail_title'), animation: 'slide_from_right' }} />
      <NoticesStack.Screen name="InspectionPanel" component={InspectionPanelScreen} options={{ title: '检查与补充', animation: 'slide_from_right' }} />
      <NoticesStack.Screen name="InspectionComplete" component={InspectionCompleteScreen} options={{ title: '标记已完成', animation: 'slide_from_right' }} />
      <NoticesStack.Screen name="CleaningSelfComplete" component={CleaningSelfCompleteScreen} options={{ title: '补充与完成', animation: 'slide_from_right' }} />
      <NoticesStack.Screen name="ManagerDailyTask" component={ManagerDailyTaskScreen} options={{ title: '每日清洁', animation: 'slide_from_right' }} />
      <NoticesStack.Screen name="DayEndBackupKeys" component={DayEndBackupKeysScreen} options={{ title: '日终交接', animation: 'slide_from_right' }} />
      <NoticesStack.Screen name="FeedbackForm" component={FeedbackFormScreen} options={{ title: t('tasks_btn_repair'), animation: 'slide_from_right' }} />
      <NoticesStack.Screen name="SuppliesForm" component={SuppliesFormScreen} options={{ title: '补品填报', animation: 'slide_from_right' }} />
    </NoticesStack.Navigator>
  )
}

function ContactsStackNavigator() {
  const { t } = useI18n()
  return (
    <ContactsStack.Navigator screenOptions={{ headerTitleAlign: 'center' }}>
      <ContactsStack.Screen name="ContactsList" component={ContactsScreen} options={{ title: t('contacts_title') }} />
      <ContactsStack.Screen name="ContactDetail" component={ContactDetailScreen} options={{ title: t('contacts_title') }} />
    </ContactsStack.Navigator>
  )
}

function MeStackNavigator() {
  const { t } = useI18n()
  return (
    <MeStack.Navigator screenOptions={{ headerTitleAlign: 'center' }}>
      <MeStack.Screen name="MeHome" component={MeScreen} options={{ title: t('me_title') }} />
      <MeStack.Screen name="ProfileEdit" component={ProfileEditScreen} options={{ title: t('profile_edit') }} />
      <MeStack.Screen name="Account" component={AccountScreen} options={{ title: t('account_manage') }} />
      <MeStack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: '修改密码' }} />
    </MeStack.Navigator>
  )
}

function AppTabs() {
  const { t } = useI18n()
  const [unreadNotices, setUnreadNotices] = useState(0)

  useEffect(() => {
    let unsub: (() => void) | null = null
    let alive = true
    ;(async () => {
      await initNoticesStore().catch(() => null)
      if (!alive) return
      const update = () => {
        const n = Object.keys(getNoticesSnapshot().unreadIds || {}).length
        setUnreadNotices(n)
      }
      update()
      unsub = subscribeNotices(update)
    })()
    return () => {
      alive = false
      if (unsub) unsub()
    }
  }, [])

  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerTitleAlign: 'center',
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          height: Platform.OS === 'ios' ? 86 : 66,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 26 : 10,
          borderTopColor: '#EEF0F6',
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
        tabBarIcon: ({ color, size, focused }) => {
          const s = Math.max(20, Math.min(26, size))
          const name =
            route.name === 'Tasks'
              ? focused
                ? 'calendar'
                : 'calendar-outline'
              : route.name === 'Notices'
                ? focused
                  ? 'notifications'
                  : 'notifications-outline'
                : route.name === 'Contacts'
                  ? focused
                    ? 'people'
                    : 'people-outline'
                  : focused
                    ? 'person'
                    : 'person-outline'
          const icon = <Ionicons name={name as any} size={s} color={color} />
          if (route.name !== 'Notices') return icon
          return (
            <View style={{ width: s, height: s }}>
              {icon}
              {unreadNotices > 0 ? <View style={styles.noticeTabDot} /> : null}
            </View>
          )
        },
      })}
    >
      <Tabs.Screen
        name="Tasks"
        component={TasksStackNavigator}
        options={{ headerShown: false, title: t('tabs_tasks'), tabBarLabel: t('tabs_tasks') }}
      />
      <Tabs.Screen
        name="Notices"
        component={NoticesStackNavigator}
        options={{ headerShown: false, title: t('tabs_notices'), tabBarLabel: t('tabs_notices') }}
      />
      <Tabs.Screen
        name="Contacts"
        component={ContactsStackNavigator}
        options={{ headerShown: false, title: t('tabs_contacts'), tabBarLabel: t('tabs_contacts') }}
      />
      <Tabs.Screen name="Me" component={MeStackNavigator} options={{ headerShown: false, title: t('tabs_me'), tabBarLabel: t('tabs_me') }} />
    </Tabs.Navigator>
  )
}

export default function RootNavigator() {
  const { status, token, user } = useAuth()
  const navRef = useNavigationContainerRef<any>()
  const pushAskedRef = useRef(false)
  const pushListenerRef = useRef<any>(null)
  const pushResponseListenerRef = useRef<any>(null)

  async function registerForPush() {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    })
    const { status } = await Notifications.requestPermissionsAsync()
    if (status !== 'granted') return
    const projectId =
      String((Constants as any)?.expoConfig?.extra?.eas?.projectId || '') ||
      String((Constants as any)?.easConfig?.projectId || '') ||
      ''
    let expoPushToken = ''
    try {
      const r = projectId ? await Notifications.getExpoPushTokenAsync({ projectId }) : await Notifications.getExpoPushTokenAsync()
      expoPushToken = String((r as any)?.data || '').trim()
    } catch {
      const r = await Notifications.getExpoPushTokenAsync()
      expoPushToken = String((r as any)?.data || '').trim()
    }
    if (!expoPushToken) return
    try {
      if (!token) return
      await registerExpoPushToken(token, { expo_push_token: expoPushToken, platform: Platform.OS, ua: `mzstay/${String((Constants as any)?.expoConfig?.version || '')}` })
    } catch {}
  }

  useEffect(() => {
    if (pushAskedRef.current) return
    if (status !== 'signedIn') return
    if (!token) return
    pushAskedRef.current = true
    registerForPush().catch(() => null)
  }, [status, token, user?.id])

  useEffect(() => {
    if (pushListenerRef.current || pushResponseListenerRef.current) return
    pushListenerRef.current = Notifications.addNotificationReceivedListener((n) => {
      ;(async () => {
        try {
          await initNoticesStore()
          const title = String(n?.request?.content?.title || '').trim() || '通知'
          const body = String(n?.request?.content?.body || '').trim()
          const data: any = n?.request?.content?.data || {}
          const kind = String(data?.kind || '').trim()
          const propertyCode = String(data?.property_code || '').trim()
          const checkedOutAt = String(data?.checked_out_at || '').trim()
          const eventId = String(data?.event_id || '').trim()
          const fieldsKey = String(data?.fields_key || '').trim()
          const reqId = String((n as any)?.request?.identifier || '').trim()
          const formatted = formatIncomingNotice(title, body, data)
          const id0 =
            kind === 'guest_checked_out' && propertyCode && checkedOutAt
              ? `guest_checked_out:${propertyCode}:${checkedOutAt}`
              : kind === 'guest_checked_out_cancelled' && propertyCode
                ? `guest_checked_out_cancelled:${propertyCode}:${checkedOutAt || ''}`
                : kind === 'cleaning_task_manager_fields_updated' && propertyCode && fieldsKey
                  ? `manager_fields:${propertyCode}:${fieldsKey}`
                  : eventId || reqId || `${Date.now()}`
          await prependNotice({
            id: String(id0),
            type: 'update',
            title: formatted.title,
            summary: formatted.summary,
            content: formatted.content,
            data,
          })
          try {
            if (token) {
              const { items } = await listInboxNotifications(token, { limit: 30 })
              const list = (items || []).map((it: any) => {
                const ch = Array.isArray(it?.changes) ? it.changes.map((v: any) => String(v || '').toLowerCase()) : []
                const type: 'key' | 'update' = String(it?.type || '').toUpperCase().includes('KEY') || ch.includes('keys') ? 'key' : 'update'
                return {
                  id: String(it?.event_id || it?.id || ''),
                  type,
                  title: String(it?.title || '通知'),
                  summary: String(it?.body || ''),
                  content: String(it?.body || ''),
                  data: { ...(it?.data && typeof it.data === 'object' ? it.data : {}), _server_id: String(it?.id || ''), event_id: String(it?.event_id || '') },
                  createdAt: resolveNoticeCreatedAt(it?.created_at, it?.event_id, it?.id) || new Date().toISOString(),
                  unread: !it?.read_at,
                }
              })
              await upsertNotices(list, { replace: true })
            }
          } catch {}
        } catch {}
      })()
    })
    pushResponseListenerRef.current = Notifications.addNotificationResponseReceivedListener((r) => {
      ;(async () => {
        try {
          await initNoticesStore()
          const n: any = r?.notification
          const title = String(n?.request?.content?.title || '').trim() || '通知'
          const body = String(n?.request?.content?.body || '').trim()
          const data: any = n?.request?.content?.data || {}
          const kind = String(data?.kind || '').trim()
          const propertyCode = String(data?.property_code || '').trim()
          const checkedOutAt = String(data?.checked_out_at || '').trim()
          const eventId = String(data?.event_id || '').trim()
          const fieldsKey = String(data?.fields_key || '').trim()
          const reqId = String(n?.request?.identifier || '').trim()
          const formatted = formatIncomingNotice(title, body, data)
          const id0 =
            kind === 'guest_checked_out' && propertyCode && checkedOutAt
              ? `guest_checked_out:${propertyCode}:${checkedOutAt}`
              : kind === 'guest_checked_out_cancelled' && propertyCode
                ? `guest_checked_out_cancelled:${propertyCode}:${checkedOutAt || ''}`
                : kind === 'cleaning_task_manager_fields_updated' && propertyCode && fieldsKey
                  ? `manager_fields:${propertyCode}:${fieldsKey}`
                  : eventId || reqId || `${Date.now()}`
          await prependNotice({
            id: String(id0),
            type: 'update',
            title: formatted.title,
            summary: formatted.summary,
            content: formatted.content,
            data,
          })
          try {
            if (token) {
              const { items } = await listInboxNotifications(token, { limit: 30 })
              const list = (items || []).map((it: any) => {
                const ch = Array.isArray(it?.changes) ? it.changes.map((v: any) => String(v || '').toLowerCase()) : []
                const type: 'key' | 'update' = String(it?.type || '').toUpperCase().includes('KEY') || ch.includes('keys') ? 'key' : 'update'
                return {
                  id: String(it?.event_id || it?.id || ''),
                  type,
                  title: String(it?.title || '通知'),
                  summary: String(it?.body || ''),
                  content: String(it?.body || ''),
                  data: { ...(it?.data && typeof it.data === 'object' ? it.data : {}), _server_id: String(it?.id || ''), event_id: String(it?.event_id || '') },
                  createdAt: resolveNoticeCreatedAt(it?.created_at, it?.event_id, it?.id) || new Date().toISOString(),
                  unread: !it?.read_at,
                }
              })
              await upsertNotices(list, { replace: true })
          }
          } catch {}
          if (navRef.isReady()) {
            navRef.navigate('Notices', { screen: 'NoticesList' } as any)
            setTimeout(() => {
              try {
                navRef.navigate('Notices', { screen: 'NoticeDetail', params: { id: String(id0) } } as any)
              } catch {}
            }, 0)
          }
        } catch {}
      })()
    })
    return () => {
      try {
        pushListenerRef.current?.remove?.()
        pushResponseListenerRef.current?.remove?.()
      } catch {}
      pushListenerRef.current = null
      pushResponseListenerRef.current = null
    }
  }, [navRef])

  return (
    <NavigationContainer ref={navRef}>
      {status === 'booting' ? <BootScreen /> : status === 'signedIn' ? <AppTabs /> : <AuthStackNavigator />}
    </NavigationContainer>
  )
}

const styles = {
  noticeTabDot: {
    position: 'absolute' as const,
    right: 0,
    top: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
}
