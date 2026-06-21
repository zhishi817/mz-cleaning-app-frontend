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
import { findWorkTaskItemByAnyId, getWorkTasksSnapshot } from '../lib/workTasksStore'
import { getNoticesSnapshot, initNoticesStore, subscribeNotices } from '../lib/noticesStore'
import { registerExpoPushToken } from '../lib/api'
import { syncInboxNotifications } from '../lib/notificationInbox'
import { getPushDeviceId, setRegisteredExpoPushToken } from '../lib/pushTokenStorage'
import { isTaskManagerUser } from '../lib/roles'
import type { CompanyContentCategory, CompanyGuideRole } from '../lib/api'
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
import ExpenseCenterScreen from '../screens/me/ExpenseCenterScreen'
import TaskDetailScreen from '../screens/tasks/TaskDetailScreen'
import FeedbackFormScreen from '../screens/tasks/FeedbackFormScreen'
import SuppliesFormScreen from '../screens/tasks/SuppliesFormScreen'
import InspectionPanelScreen from '../screens/tasks/InspectionPanelScreen'
import InspectionCompleteScreen from '../screens/tasks/InspectionCompleteScreen'
import CleaningSelfCompleteScreen from '../screens/tasks/CleaningSelfCompleteScreen'
import ManagerDailyTaskScreen from '../screens/tasks/ManagerDailyTaskScreen'
import DayEndBackupKeysScreen from '../screens/tasks/DayEndBackupKeysScreen'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

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
  InspectionComplete: { taskId: string; skipInspectionPhotos?: boolean }
  CleaningSelfComplete: { taskId: string }
  ManagerDailyTask: { taskId: string }
  DayEndBackupKeys: { date: string; userId?: string; userName?: string; focus?: 'key' | 'dirty' | 'consumable' | 'reject'; taskRoomCodes?: string[]; overviewMode?: boolean; overviewUsers?: Array<{ userId: string; userName: string; roles: string[]; roomCodes: string[]; complete: boolean | null }> }
  FeedbackForm: { taskId: string }
  SuppliesForm: { taskId: string }
}

export type NoticesStackParamList = {
  NoticesList: undefined
  NoticeDetail: { id: string }
  InfoCenterDetail: { kind: 'property' | 'secret' | 'task' | 'announcement' | 'guide' | 'warehouse_guide'; title: string; subtitle?: string; body?: string; contentRaw?: string | null; docCategory?: CompanyContentCategory | null; guideRole?: CompanyGuideRole | null; url?: string | null; copyText?: string | null; secretId?: string }
  TaskDetail: { id: string; action?: 'upload_key' | 'complete' }
  InspectionPanel: { taskId: string }
  InspectionComplete: { taskId: string; skipInspectionPhotos?: boolean }
  CleaningSelfComplete: { taskId: string }
  ManagerDailyTask: { taskId: string }
  DayEndBackupKeys: { date: string; userId?: string; userName?: string; focus?: 'key' | 'dirty' | 'consumable' | 'reject'; taskRoomCodes?: string[]; overviewMode?: boolean; overviewUsers?: Array<{ userId: string; userName: string; roles: string[]; roomCodes: string[]; complete: boolean | null }> }
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
  ExpenseCenter: undefined
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

function shouldShowTaskNoticeForCurrentUser(data: any, user: any) {
  if (isTaskManagerUser(user)) return true
  const uid = String(user?.id || '').trim()
  if (!uid) return true
  const kind = String(data?.kind || '').trim()
  const taskIds = Array.from(
    new Set(
      [
        ...(Array.isArray(data?.task_ids) ? data.task_ids : []),
        data?.task_id,
        data?.entityId,
        data?.entity_id,
      ]
        .map((x) => String(x || '').trim())
        .filter(Boolean),
    ),
  )
  if (!taskIds.length) return true
  if (!['guest_checked_out', 'guest_checked_out_cancelled', 'key_photo_uploaded', 'cleaning_task_manager_fields_updated', 'key_photo_deleted'].includes(kind)) return true
  const items = getWorkTasksSnapshot().items || []
  const matches = taskIds
    .map((id) => findWorkTaskItemByAnyId(id) || items.find((it: any) => String(it?.source_id || '').trim() === id) || null)
    .filter(Boolean) as any[]
  if (!matches.length) return false
  return matches.some((task) => {
    const taskKind = String(task?.task_kind || '').trim().toLowerCase()
    const assigneeId = String(task?.assignee_id || '').trim()
    const cleanerId = String(task?.cleaner_id || '').trim()
    const inspectorId = String(task?.inspector_id || '').trim()
    if (taskKind === 'inspection') return assigneeId === uid || inspectorId === uid
    if (taskKind === 'cleaning') return assigneeId === uid || cleanerId === uid
    return assigneeId === uid
  })
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
      <MeStack.Screen name="ExpenseCenter" component={ExpenseCenterScreen} options={{ title: '支出录入' }} />
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
  const statusRef = useRef(status)
  const tokenRef = useRef(token)
  const userRef = useRef(user)
  useEffect(() => {
    statusRef.current = status
    tokenRef.current = token
    userRef.current = user
    if (status !== 'signedIn') pushAskedRef.current = false
  }, [status, token, user])

  async function registerForPush() {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: '默认通知',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
      })
    }
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
      const deviceId = await getPushDeviceId()
      await registerExpoPushToken(token, {
        expo_push_token: expoPushToken,
        device_id: deviceId,
        platform: Platform.OS,
        ua: `mzstay/${String((Constants as any)?.expoConfig?.version || '')}`,
      })
      await setRegisteredExpoPushToken(expoPushToken)
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
          if (statusRef.current !== 'signedIn' || !tokenRef.current || !String(userRef.current?.id || '').trim()) return
          const data: any = n?.request?.content?.data || {}
          if (!shouldShowTaskNoticeForCurrentUser(data, userRef.current)) return
          await syncInboxNotifications({
            token: tokenRef.current,
            limit: 30,
            replace: true,
            include: (notice) => shouldShowTaskNoticeForCurrentUser(notice.data, userRef.current),
          })
        } catch {}
      })()
    })
    pushResponseListenerRef.current = Notifications.addNotificationResponseReceivedListener((r) => {
      ;(async () => {
        try {
          if (statusRef.current !== 'signedIn' || !tokenRef.current || !String(userRef.current?.id || '').trim()) return
          const n: any = r?.notification
          const data: any = n?.request?.content?.data || {}
          const eventId = String(data?.event_id || '').trim()
          if (!shouldShowTaskNoticeForCurrentUser(data, userRef.current)) return
          const { notices } = await syncInboxNotifications({
            token: tokenRef.current,
            limit: 30,
            replace: true,
            include: (notice) => shouldShowTaskNoticeForCurrentUser(notice.data, userRef.current),
          })
          const targetId = notices.find((notice) => String(notice.data?.event_id || notice.id) === eventId)?.id || ''
          if (navRef.isReady()) {
            navRef.navigate('Notices', { screen: 'NoticesList' } as any)
            if (targetId) setTimeout(() => {
              try {
                navRef.navigate('Notices', { screen: 'NoticeDetail', params: { id: targetId } } as any)
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
