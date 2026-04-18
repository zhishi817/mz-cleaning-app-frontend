import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'

const TOKEN_KEY = 'mzstay.auth.token'
const USER_KEY = 'mzstay.auth.user'
const LOGIN_HINT_KEY = 'mzstay.auth.login_hint'
const LOGIN_PASSWORD_KEY = 'mzstay.auth.login_password'
const LOGIN_PASSWORD_BIO_KEY = 'mzstay.auth.login_password_bio'
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

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

export type StoredUser = { id: string; username: string; role: string; roles?: string[]; permissions?: string[] }

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
    const id = String((parsed as any).id || '')
    const username = String((parsed as any).username || '')
    const role = String((parsed as any).role || '')
    if (!username || !role) return null
    const roles = Array.isArray((parsed as any).roles) ? (parsed as any).roles.map((v: any) => String(v || '')).filter(Boolean) : undefined
    const permissions = Array.isArray((parsed as any).permissions) ? (parsed as any).permissions.map((v: any) => String(v || '')).filter(Boolean) : undefined
    return { id: id || `legacy:${username}`, username, role, roles, permissions }
  } catch {
    return null
  }
}

export async function clearStoredUser() {
  await safeDeleteItem(USER_KEY)
}

export type RememberedLoginHint = {
  username: string
  remember_password: boolean
  biometric_enabled: boolean
  verified_at: string
}

function isExpiredByVerifiedAt(verifiedAt: string) {
  const d = new Date(String(verifiedAt || '').trim())
  if (!Number.isFinite(d.getTime())) return true
  return Date.now() - d.getTime() > WEEK_MS
}

async function readHint(): Promise<RememberedLoginHint | null> {
  const raw = await safeGetItem(LOGIN_HINT_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as any
    const username = String(parsed?.username || '').trim()
    if (!username) return null
    return {
      username,
      remember_password: parsed?.remember_password !== false,
      biometric_enabled: parsed?.biometric_enabled === true,
      verified_at: String(parsed?.verified_at || '').trim(),
    }
  } catch {
    return null
  }
}

export async function setRememberedLogin(params: {
  username: string
  password: string
  rememberPassword: boolean
  biometricEnabled?: boolean
}) {
  const username = String(params.username || '').trim()
  const password = String(params.password || '')
  const rememberPassword = params.rememberPassword !== false
  const biometricEnabled = rememberPassword && params.biometricEnabled === true
  if (!username) {
    await clearRememberedLogin()
    return
  }

  const hint: RememberedLoginHint = {
    username,
    remember_password: rememberPassword,
    biometric_enabled: biometricEnabled,
    verified_at: new Date().toISOString(),
  }

  await safeSetItem(LOGIN_HINT_KEY, JSON.stringify(hint))

  if (!rememberPassword) {
    await safeDeleteItem(LOGIN_PASSWORD_KEY)
    await safeDeleteItem(LOGIN_PASSWORD_BIO_KEY)
    return
  }

  if (biometricEnabled) {
    try {
      await SecureStore.setItemAsync(LOGIN_PASSWORD_BIO_KEY, password, {
        requireAuthentication: true,
        authenticationPrompt: '使用 Face ID 登录',
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      })
      await safeDeleteItem(LOGIN_PASSWORD_KEY)
      return
    } catch {}
  }

  await safeSetItem(LOGIN_PASSWORD_KEY, password)
  await safeDeleteItem(LOGIN_PASSWORD_BIO_KEY)
}

export async function getRememberedLoginHint(): Promise<(RememberedLoginHint & { expired: boolean }) | null> {
  const hint = await readHint()
  if (!hint) return null
  return { ...hint, expired: isExpiredByVerifiedAt(hint.verified_at) }
}

export async function getRememberedPlainPassword() {
  return await safeGetItem(LOGIN_PASSWORD_KEY)
}

export async function getRememberedBiometricPassword() {
  try {
    return await SecureStore.getItemAsync(LOGIN_PASSWORD_BIO_KEY, { authenticationPrompt: '使用 Face ID 登录' })
  } catch {
    return null
  }
}

export async function pruneExpiredRememberedLogin() {
  const hint = await readHint()
  if (!hint) return
  if (!isExpiredByVerifiedAt(hint.verified_at)) return
  await safeDeleteItem(LOGIN_PASSWORD_KEY)
  await safeDeleteItem(LOGIN_PASSWORD_BIO_KEY)
  await safeSetItem(
    LOGIN_HINT_KEY,
    JSON.stringify({
      ...hint,
      remember_password: false,
      biometric_enabled: false,
    }),
  )
}

export async function clearRememberedLogin() {
  await safeDeleteItem(LOGIN_HINT_KEY)
  await safeDeleteItem(LOGIN_PASSWORD_KEY)
  await safeDeleteItem(LOGIN_PASSWORD_BIO_KEY)
}
