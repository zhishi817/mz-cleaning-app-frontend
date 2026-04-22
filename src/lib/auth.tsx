import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { forgotPasswordApi, loginApi, meApi, unregisterExpoPushToken } from './api'
import { API_BASE_URL, LOCAL_LOGIN_ENABLED, LOCAL_LOGIN_PASSWORD, LOCAL_LOGIN_ROLE, LOCAL_LOGIN_USERNAME } from '../config/env'
import {
  clearAuthToken,
  clearRememberedLogin,
  clearStoredUser,
  getAuthToken,
  getRememberedLoginHint,
  getRememberedPlainPassword,
  getStoredUser,
  pruneExpiredRememberedLogin,
  setRememberedLogin,
  setAuthToken,
  setStoredUser,
  type StoredUser,
} from './authStorage'
import { subscribeAuthInvalidated } from './authEvents'
import { clearRegisteredExpoPushToken, getRegisteredExpoPushToken } from './pushTokenStorage'

type AuthStatus = 'booting' | 'signedOut' | 'signedIn'

type AuthContextValue = {
  status: AuthStatus
  token: string | null
  user: StoredUser | null
  signIn: (params: { username: string; password: string }) => Promise<void>
  signOut: () => Promise<void>
  requestPasswordReset: (params: { email: string }) => Promise<void>
  isSigningIn: boolean
  authIssue: string | null
  clearAuthIssue: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function localTokenFor(username: string) {
  return `local:${encodeURIComponent(username)}:${Date.now()}`
}

function canUseLocalLogin() {
  return !!(__DEV__ && LOCAL_LOGIN_ENABLED && !API_BASE_URL)
}

function normalizeUsername(username: string) {
  const alias: Record<string, string> = { ops: 'cs', field: 'cleaner' }
  const key = String(username || '').trim()
  return alias[key] || key
}

export function AuthProvider(props: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('booting')
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<StoredUser | null>(null)
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [authIssue, setAuthIssue] = useState<string | null>(null)

  const signOutInternal = useCallback(async (reason: 'manual' | 'session_expired' = 'manual') => {
    const currentToken = token
    try {
      const expoPushToken = await getRegisteredExpoPushToken()
      if (currentToken && expoPushToken) await unregisterExpoPushToken(currentToken, { expo_push_token: expoPushToken })
    } catch {}
    try {
      await clearRegisteredExpoPushToken()
    } catch {}
    await clearAuthToken()
    await clearStoredUser()
    if (reason === 'manual') {
      await clearRememberedLogin()
    }
    setToken(null)
    setUser(null)
    setStatus('signedOut')
    setAuthIssue(reason === 'session_expired' ? '登录已过期，请重新登录' : null)
  }, [token])

  const signOut = useCallback(async () => {
    await signOutInternal('manual')
  }, [signOutInternal])

  const clearAuthIssue = useCallback(() => {
    setAuthIssue(null)
  }, [])

  const applySignedInState = useCallback(async (nextToken: string, nextUser: StoredUser) => {
    await setAuthToken(nextToken)
    await setStoredUser(nextUser)
    setToken(nextToken)
    setUser(nextUser)
    setStatus('signedIn')
    setAuthIssue(null)
  }, [])

  const signInWithRemoteCredentials = useCallback(async (username: string, password: string) => {
    const normalizedUsername = normalizeUsername(username)
    const { token: newToken } = await loginApi({ username: normalizedUsername, password })
    const remoteUser = await meApi(newToken)
    await setRememberedLogin({
      username: normalizedUsername,
      password,
      rememberPassword: true,
      biometricEnabled: false,
    })
    await applySignedInState(newToken, remoteUser)
  }, [applySignedInState])

  const trySilentReauth = useCallback(async () => {
    await pruneExpiredRememberedLogin()
    const hint = await getRememberedLoginHint()
    if (!hint || hint.expired) return false
    const password = await getRememberedPlainPassword()
    if (!password) return false
    try {
      await signInWithRemoteCredentials(hint.username, password)
      return true
    } catch {
      await clearRememberedLogin()
      return false
    }
  }, [signInWithRemoteCredentials])

  const bootstrap = useCallback(async () => {
    try {
      const t = await getAuthToken()
      const u = await getStoredUser()
      if (!t) {
        setStatus('signedOut')
        return
      }
      if (t.startsWith('local:')) {
        if (!canUseLocalLogin()) {
          await clearAuthToken()
          if (u) await clearStoredUser()
          setStatus('signedOut')
          return
        }
        const username = u?.username || decodeURIComponent(t.split(':')[1] || '') || LOCAL_LOGIN_USERNAME
        const role = u?.role || LOCAL_LOGIN_ROLE
        const id = u?.id || `local:${username}`
        const localUser = { id, username, role }
        await setStoredUser(localUser)
        setToken(t)
        setUser(localUser)
        setStatus('signedIn')
        return
      }
      try {
        const remote = await meApi(t)
        await applySignedInState(t, remote)
      } catch {
        const recovered = await trySilentReauth()
        if (!recovered) await signOutInternal('session_expired')
      }
    } catch {
      setStatus('signedOut')
    }
  }, [applySignedInState, signOutInternal, trySilentReauth])

  useEffect(() => {
    bootstrap()
  }, [bootstrap])

  useEffect(() => {
    return subscribeAuthInvalidated(() => {
      trySilentReauth().then((recovered) => {
        if (!recovered) signOutInternal('session_expired').catch(() => null)
      }).catch(() => {
        signOutInternal('session_expired').catch(() => null)
      })
    })
  }, [signOutInternal, trySilentReauth])

  const signIn = useCallback(async (params: { username: string; password: string }) => {
    try {
      setIsSigningIn(true)
      const username = normalizeUsername(params.username)
      if (canUseLocalLogin() && username.trim() === LOCAL_LOGIN_USERNAME && params.password === LOCAL_LOGIN_PASSWORD) {
        const localUser = { id: `local:${username.trim()}`, username: username.trim(), role: LOCAL_LOGIN_ROLE }
        const localToken = localTokenFor(localUser.username)
        await setAuthToken(localToken)
        await setStoredUser(localUser)
        await clearRememberedLogin()
        setToken(localToken)
        setUser(localUser)
        setStatus('signedIn')
        setAuthIssue(null)
        return
      }
      if (!API_BASE_URL && canUseLocalLogin()) {
        throw new Error('后端地址未配置，且本地测试账号/密码不匹配')
      }
      await signInWithRemoteCredentials(username, params.password)
    } finally {
      setIsSigningIn(false)
    }
  }, [signInWithRemoteCredentials])

  const requestPasswordReset = useCallback(async (params: { email: string }) => {
    if (!API_BASE_URL && canUseLocalLogin()) return
    await forgotPasswordApi(params)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      token,
      user,
      signIn,
      signOut,
      requestPasswordReset,
      isSigningIn,
      authIssue,
      clearAuthIssue,
    }),
    [authIssue, clearAuthIssue, isSigningIn, signIn, signOut, requestPasswordReset, status, token, user],
  )

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
