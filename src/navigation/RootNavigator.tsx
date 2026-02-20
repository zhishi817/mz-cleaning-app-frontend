import React from 'react'
import { ActivityIndicator, Platform, View } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import LoginScreen from '../screens/LoginScreen'
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen'
import TasksScreen from '../screens/tabs/TasksScreen'
import NoticesScreen from '../screens/tabs/NoticesScreen'
import ContactsScreen from '../screens/tabs/ContactsScreen'
import MeScreen from '../screens/tabs/MeScreen'
import NoticeDetailScreen from '../screens/notices/NoticeDetailScreen'
import ContactDetailScreen from '../screens/contacts/ContactDetailScreen'
import ProfileEditScreen from '../screens/me/ProfileEditScreen'
import AccountScreen from '../screens/me/AccountScreen'
import TaskDetailScreen from '../screens/tasks/TaskDetailScreen'
import RepairFormScreen from '../screens/tasks/RepairFormScreen'

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
  RepairForm: { taskId: string }
}

export type NoticesStackParamList = {
  NoticesList: undefined
  NoticeDetail: { id: string }
}

export type ContactsStackParamList = {
  ContactsList: undefined
  ContactDetail: { id: string }
}

export type MeStackParamList = {
  MeHome: undefined
  ProfileEdit: undefined
  Account: undefined
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
      <TasksStack.Screen name="RepairForm" component={RepairFormScreen} options={{ title: t('tasks_btn_repair') }} />
    </TasksStack.Navigator>
  )
}

function NoticesStackNavigator() {
  const { t } = useI18n()
  return (
    <NoticesStack.Navigator screenOptions={{ headerTitleAlign: 'center' }}>
      <NoticesStack.Screen name="NoticesList" component={NoticesScreen} options={{ title: t('notices_title') }} />
      <NoticesStack.Screen name="NoticeDetail" component={NoticeDetailScreen} options={{ title: t('notices_title') }} />
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
    </MeStack.Navigator>
  )
}

function AppTabs() {
  const { t } = useI18n()
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
          return <Ionicons name={name as any} size={s} color={color} />
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
  const { status } = useAuth()

  return (
    <NavigationContainer>
      {status === 'booting' ? <BootScreen /> : status === 'signedIn' ? <AppTabs /> : <AuthStackNavigator />}
    </NavigationContainer>
  )
}
