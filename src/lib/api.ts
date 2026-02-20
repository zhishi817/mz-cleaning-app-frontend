import { API_BASE_URL } from '../config/env'

type Json = any

function normalizeBase(base: string) {
  return String(base || '').trim().replace(/\/+$/g, '')
}

function uniq(items: string[]) {
  return Array.from(new Set(items)).filter(Boolean)
}

function buildAuthUrlCandidates(endpoint: 'login' | 'me' | 'forgot') {
  const base = normalizeBase(API_BASE_URL)
  if (!base) return []
  const raw = base
  const stripAuth = raw.replace(/\/auth\/?$/g, '')
  const stripApi = stripAuth.replace(/\/api\/?$/g, '')
  const paths =
    endpoint === 'login'
      ? ['auth/login', 'login']
      : endpoint === 'forgot'
        ? ['auth/forgot', 'forgot']
        : ['auth/me', 'me']
  const candidates = [
    ...paths.map(p => `${raw}/${p}`),
    ...paths.map(p => `${stripAuth}/${p}`),
    ...paths.map(p => `${stripApi}/${p}`),
  ].map(u => u.replace(/([^:]\/)\/+/g, '$1'))
  return uniq(candidates)
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController()
  const timer = setTimeout(() => {
    try {
      controller.abort()
    } catch {}
  }, timeoutMs)
  try {
    const res = await fetch(input, { ...init, signal: controller.signal })
    return res
  } finally {
    try {
      clearTimeout(timer)
    } catch {}
  }
}

async function parseErrorMessage(res: Response) {
  try {
    const json = (await res.json()) as any
    const msg = json?.message
    if (typeof msg === 'string' && msg.trim()) return msg.trim()
  } catch {}
  return `请求失败 (${res.status})`
}

export async function loginApi(params: { username: string; password: string }) {
  const urls = buildAuthUrlCandidates('login')
  if (!urls.length) throw new Error('后端地址未配置（EXPO_PUBLIC_API_BASE_URL）')

  let lastRes: Response | null = null
  for (const url of urls) {
    lastRes = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      },
      15000,
    )
    if (lastRes.status !== 404) break
  }

  const res = lastRes as Response
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  const data = (await res.json()) as Json
  const token = String(data?.token || '')
  if (!token) throw new Error('登录成功但未返回 token')
  return { token }
}

export async function meApi(token: string) {
  const urls = buildAuthUrlCandidates('me')
  if (!urls.length) throw new Error('后端地址未配置（EXPO_PUBLIC_API_BASE_URL）')

  let lastRes: Response | null = null
  for (const url of urls) {
    lastRes = await fetchWithTimeout(
      url,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      },
      15000,
    )
    if (lastRes.status !== 404) break
  }
  const res = lastRes as Response
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  const data = (await res.json()) as Json
  const username = String(data?.username || '')
  const role = String(data?.role || '')
  if (!username || !role) throw new Error('用户信息返回不完整')
  return { username, role }
}

export async function forgotPasswordApi(params: { email: string }) {
  const urls = buildAuthUrlCandidates('forgot')
  if (!urls.length) throw new Error('后端地址未配置（EXPO_PUBLIC_API_BASE_URL）')

  let lastRes: Response | null = null
  for (const url of urls) {
    lastRes = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      },
      15000,
    )
    if (lastRes.status !== 404) break
  }
  const res = lastRes as Response
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  return { ok: true }
}

