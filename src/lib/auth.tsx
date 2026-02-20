import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { forgotPasswordApi, loginApi, meApi } from './api'
import { API_BASE_URL, LOCAL_LOGIN_ENABLED, LOCAL_LOGIN_PASSWORD, LOCAL_LOGIN_ROLE, LOCAL_LOGIN_USERNAME } from '../config/env'
import {
  clearAuthToken,
  clearStoredUser,
  getAuthToken,
  getStoredUser,
  setAuthToken,
  setStoredUser,
  type StoredUser,
} from './authStorage'

type AuthStatus = 'booting' | 'signedOut' | 'signedIn'

type AuthContextValue = {
  status: AuthStatus
  token: string | null
  user: StoredUser | null
  signIn: (params: { username: string; password: string }) => Promise<void>
  signOut: () => Promise<void>
  requestPasswordReset: (params: { email: string }) => Promise<void>
  isSigningIn: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

function localTokenFor(username: string) {
  return `local:${encodeURIComponent(username)}:${Date.now()}`
}

function canUseLocalLogin() {
  return LOCAL_LOGIN_ENABLED || !API_BASE_URL
}

export function AuthProvider(props: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('booting')
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<StoredUser | null>(null)
  const [isSigningIn, setIsSigningIn] = useState(false)

  const signOut = useCallback(async () => {
    await clearAuthToken()
    await clearStoredUser()
    setToken(null)
    setUser(null)
    setStatus('signedOut')
  }, [])

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
        const localUser = { username, role }
        await setStoredUser(localUser)
        setToken(t)
        setUser(localUser)
        setStatus('signedIn')
        return
      }
      try {
        const remote = await meApi(t)
        await setStoredUser(remote)
        setToken(t)
        setUser(remote)
        setStatus('signedIn')
      } catch {
        if (u) await clearStoredUser()
        await clearAuthToken()
        setStatus('signedOut')
      }
    } catch {
      setStatus('signedOut')
    }
  }, [])

  useEffect(() => {
    bootstrap()
  }, [bootstrap])

  const signIn = useCallback(async (params: { username: string; password: string }) => {
    try {
      setIsSigningIn(true)
      const alias: Record<string, string> = { ops: 'cs', field: 'cleaner' }
      const username = alias[params.username] || params.username
      if (canUseLocalLogin() && username.trim() === LOCAL_LOGIN_USERNAME && params.password === LOCAL_LOGIN_PASSWORD) {
        const localUser = { username: username.trim(), role: LOCAL_LOGIN_ROLE }
        const localToken = localTokenFor(localUser.username)
        await setAuthToken(localToken)
        await setStoredUser(localUser)
        setToken(localToken)
        setUser(localUser)
        setStatus('signedIn')
        return
      }
      if (!API_BASE_URL && canUseLocalLogin()) {
        throw new Error('后端地址未配置，且本地测试账号/密码不匹配')
      }
      const { token: newToken } = await loginApi({ username, password: params.password })
      const remoteUser = await meApi(newToken)
      await setAuthToken(newToken)
      await setStoredUser(remoteUser)
      setToken(newToken)
      setUser(remoteUser)
      setStatus('signedIn')
    } finally {
      setIsSigningIn(false)
    }
  }, [])

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
    }),
    [isSigningIn, signIn, signOut, requestPasswordReset, status, token, user],
  )

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
