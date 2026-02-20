import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'

const TOKEN_KEY = 'mzstay.auth.token'
const USER_KEY = 'mzstay.auth.user'

async function safeSetItem(key: string, value: string) {
  try {
    await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK })
    return
  } catch {}
  await AsyncStorage.setItem(key, value)
}

async function safeGetItem(key: string) {
  try {
    const v = await SecureStore.getItemAsync(key)
    if (v != null) return v
  } catch {}
  return AsyncStorage.getItem(key)
}

async function safeDeleteItem(key: string) {
  try {
    await SecureStore.deleteItemAsync(key)
  } catch {}
  await AsyncStorage.removeItem(key)
}

export async function setAuthToken(token: string) {
  await safeSetItem(TOKEN_KEY, token)
}

export async function getAuthToken() {
  return safeGetItem(TOKEN_KEY)
}

export async function clearAuthToken() {
  await safeDeleteItem(TOKEN_KEY)
}

export type StoredUser = { username: string; role: string }

export async function setStoredUser(user: StoredUser | null) {
  if (!user) {
    await safeDeleteItem(USER_KEY)
    return
  }
  await safeSetItem(USER_KEY, JSON.stringify(user))
}

export async function getStoredUser(): Promise<StoredUser | null> {
  const raw = await safeGetItem(USER_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const username = String((parsed as any).username || '')
    const role = String((parsed as any).role || '')
    if (!username || !role) return null
    return { username, role }
  } catch {
    return null
  }
}

export async function clearStoredUser() {
  await safeDeleteItem(USER_KEY)
}

