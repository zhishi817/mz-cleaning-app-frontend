import { API_BASE_URL } from '../config/env'

type Json = any

function normalizeBase(base: string) {
  return String(base || '').trim().replace(/\/+$/g, '')
}

function uniq(items: string[]) {
  return Array.from(new Set(items)).filter(Boolean)
}

function buildUrlCandidates(path: string) {
  const base = normalizeBase(API_BASE_URL)
  if (!base) return []
  const raw = base
  const stripAuth = raw.replace(/\/auth\/?$/g, '')
  const stripApi = stripAuth.replace(/\/api\/?$/g, '')
  const p = String(path || '').replace(/^\/+/g, '')
  const candidates = [
    `${raw}/${p}`,
    `${stripAuth}/${p}`,
    `${stripApi}/${p}`,
  ].map(u => u.replace(/([^:]\/)\/+/g, '$1'))
  return uniq(candidates)
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
    const txt = await res.text()
    try {
      const json = JSON.parse(txt) as any
      const msg = json?.message
      if (typeof msg === 'string' && msg.trim()) {
        const existingId = String(json?.existing_id || '').trim()
        const errs = Array.isArray(json?.errors) ? json.errors.map((x: any) => String(x || '').trim()).filter(Boolean) : []
        const merged0 = errs.length ? `${msg.trim()}: ${errs.join(' | ')}` : msg.trim()
        const merged = msg.trim() === 'duplicate' && existingId ? `${merged0}:${existingId}` : merged0
        return merged.slice(0, 240)
      }
    } catch {
      const t = String(txt || '').trim()
      if (t) return t.slice(0, 180)
    }
  } catch {}
  return `请求失败 (${res.status})`
}

async function parseJsonOrThrow(res: Response) {
  const txt = await res.text()
  try {
    return JSON.parse(txt)
  } catch {
    const t = String(txt || '').trim()
    throw new Error(`后端返回非 JSON（${res.status}）：${t ? t.slice(0, 180) : 'empty body'}`)
  }
}

function decodeJwtPayload(token: string): any | null {
  try {
    const parts = String(token || '').split('.')
    if (parts.length < 2) return null
    const p = parts[1] || ''
    const b64 = p.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(p.length / 4) * 4, '=')
    const atobFn = (globalThis as any)?.atob
    const txt =
      typeof atobFn === 'function'
        ? atobFn(b64)
        : (globalThis as any)?.Buffer
          ? String((globalThis as any).Buffer.from(b64, 'base64').toString('utf8') || '')
          : ''
    if (!txt) return null
    return JSON.parse(txt)
  } catch {
    return null
  }
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
  const data = (await parseJsonOrThrow(res)) as Json
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
      30000,
    )
    if (lastRes.status !== 404) break
  }
  const res = lastRes as Response
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  const data = (await parseJsonOrThrow(res)) as Json
  const username = String(data?.username || '')
  const role = String(data?.role || '')
  const roles = Array.isArray(data?.roles) ? data.roles.map((v: any) => String(v || '')).filter(Boolean) : (Array.isArray(decodeJwtPayload(token)?.roles) ? decodeJwtPayload(token)?.roles : undefined)
  const permissions = Array.isArray(data?.permissions) ? data.permissions.map((v: any) => String(v || '')).filter(Boolean) : undefined
  const payload = decodeJwtPayload(token)
  const id = String(data?.id || payload?.sub || payload?.user_id || payload?.uid || '') || (username ? `legacy:${username}` : '')
  if (!id || !username || !role) throw new Error('用户信息返回不完整')
  return { id, username, role, roles, permissions }
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

export type CleaningAppProperty = {
  id: string
  code: string
  address: string
  unit_type: string
  region?: string | null
  access_guide_link?: string | null
}

export type CleaningAppTask = {
  id: string
  task_id: string
  date: string
  task_date: string
  status: string
  assignee_id: string | null
  inspector_id: string | null
  checkout_time: string | null
  checkin_time: string | null
  old_code: string | null
  new_code: string | null
  access_code: string | null
  property: CleaningAppProperty | null
}

export async function listCleaningAppTasks(
  token: string,
  params: { date_from: string; date_to: string; status?: string; assignee_id?: string | null },
) {
  const urls = buildUrlCandidates('cleaning-app/tasks')
  if (!urls.length) throw new Error('后端地址未配置（EXPO_PUBLIC_API_BASE_URL）')

  const qs = new URLSearchParams()
  qs.set('date_from', params.date_from)
  qs.set('date_to', params.date_to)
  if (params.status) qs.set('status', params.status)
  if (params.assignee_id) qs.set('assignee_id', params.assignee_id)
  const fullUrls = urls.map(u => `${u}?${qs.toString()}`)

  let lastRes: Response | null = null
  for (const url of fullUrls) {
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
  const data = (await parseJsonOrThrow(res)) as any
  if (!Array.isArray(data)) throw new Error('任务列表返回格式不正确')
  return data as CleaningAppTask[]
}

export type WorkTaskProperty = {
  id: string
  code: string
  address: string
  unit_type: string
  region?: string | null
  access_guide_link?: string | null
}

export type WorkTask = {
  id: string
  task_kind: string
  source_type: string
  source_id: string
  source_ids?: string[]
  cleaning_task_ids?: string[]
  inspection_task_ids?: string[]
  property_id: string | null
  title: string
  summary: string | null
  scheduled_date: string | null
  start_time: string | null
  end_time: string | null
  task_type?: string | null
  assignee_id: string | null
  inspector_id?: string | null
  status: string
  cleaning_status?: string | null
  inspection_status?: string | null
  urgency: string
  old_code?: string | null
  new_code?: string | null
  guest_special_request?: string | null
  checked_out_at?: string | null
  cleaner_name?: string | null
  inspector_name?: string | null
  key_photo_url?: string | null
  lockbox_video_url?: string | null
  completion_photos_ok?: boolean
  stayed_nights?: number | null
  remaining_nights?: number | null
  restock_items?: Array<{
    item_id: string
    label: string
    qty: number | null
    note: string | null
    photo_url: string | null
    status: string
  }>
  property: WorkTaskProperty | null
}

export async function updateCleaningTaskManagerFields(
  token: string,
  params: {
    task_ids: string[]
    checkout_time?: string | null
    checkin_time?: string | null
    old_code?: string | null
    new_code?: string | null
    guest_special_request?: string | null
  },
) {
  const urls = buildUrlCandidates('mzapp/cleaning-tasks/manager-fields')
  if (!urls.length) throw new Error('后端地址未配置（EXPO_PUBLIC_API_BASE_URL）')
  let lastRes: Response | null = null
  let exhausted = true
  for (const url of urls) {
    for (const method of ['PATCH', 'POST'] as const) {
      lastRes = await fetchWithTimeout(
        url,
        { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(params) },
        15000,
      )
      if (lastRes.status === 404 || lastRes.status === 405) continue
      exhausted = false
      break
    }
    if (!exhausted) break
  }
  const res = lastRes as Response
  if (exhausted) throw new Error('后端未部署“客服编辑任务”接口，请更新后端 Dev 后重试')
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  return (await parseJsonOrThrow(res)) as any
}

export async function listWorkTasks(token: string, params: { date_from: string; date_to: string; view?: 'mine' | 'all' }) {
  const urls = buildUrlCandidates('mzapp/work-tasks')
  if (!urls.length) throw new Error('后端地址未配置（EXPO_PUBLIC_API_BASE_URL）')

  const qs = new URLSearchParams()
  qs.set('date_from', params.date_from)
  qs.set('date_to', params.date_to)
  if (params.view) qs.set('view', params.view)
  const fullUrls = urls.map(u => `${u}?${qs.toString()}`)

  let lastRes: Response | null = null
  for (const url of fullUrls) {
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
  const data = (await parseJsonOrThrow(res)) as any
  if (!Array.isArray(data)) throw new Error('任务列表返回格式不正确')
  return data as WorkTask[]
}

export type ChecklistItem = {
  id: string
  label: string
  kind: string
  required: boolean
  requires_photo_when_low: boolean
}

export async function listChecklistItems(token: string) {
  const urls = buildUrlCandidates('mzapp/checklist-items')
  if (!urls.length) throw new Error('后端地址未配置（EXPO_PUBLIC_API_BASE_URL）')

  let lastRes: Response | null = null
  for (const url of urls) {
    lastRes = await fetchWithTimeout(
      url,
      { method: 'GET', headers: { Authorization: `Bearer ${token}` } },
      15000,
    )
    if (lastRes.status !== 404) break
  }
  const res = lastRes as Response
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  const data = (await parseJsonOrThrow(res)) as any
  if (!Array.isArray(data)) throw new Error('清单返回格式不正确')
  return data as ChecklistItem[]
}

export type PropertyFeedback = {
  id: string
  property_id: string
  source_task_id?: string | null
  kind: 'maintenance' | 'deep_cleaning'
  area?: string | null
  areas?: string[] | null
  category?: string | null
  detail: string
  media_urls?: string[] | null
  created_by?: string | null
  created_by_name?: string | null
  created_at: string
  status: 'open' | 'in_progress' | 'resolved' | 'cancelled'
  resolved_at?: string | null
}

export async function listPropertyFeedbacks(
  token: string,
  params: { property_id?: string; property_code?: string; status?: Array<PropertyFeedback['status']>; limit?: number },
) {
  const sp = new URLSearchParams()
  if (params.property_id) sp.set('property_id', params.property_id)
  if (params.property_code) sp.set('property_code', params.property_code)
  if (params.status?.length) sp.set('status', params.status.join(','))
  if (params.limit) sp.set('limit', String(params.limit))
  const urls = buildUrlCandidates(`mzapp/property-feedbacks?${sp.toString()}`)
  if (!urls.length) throw new Error('后端地址未配置（EXPO_PUBLIC_API_BASE_URL）')
  let lastRes: Response | null = null
  for (const url of urls) {
    const res = await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } })
    lastRes = res
    if (res.ok) return (await res.json()) as PropertyFeedback[]
  }
  const msg = lastRes ? await parseErrorMessage(lastRes) : ''
  throw new Error(msg || '获取失败')
}

export async function createPropertyFeedback(
  token: string,
  params: {
    kind: PropertyFeedback['kind']
    property_id: string
    source_task_id?: string
    area?: string
    areas?: string[]
    category?: string
    detail: string
    media_urls?: string[]
  },
) {
  const urls = buildUrlCandidates('mzapp/property-feedbacks')
  if (!urls.length) throw new Error('后端地址未配置（EXPO_PUBLIC_API_BASE_URL）')
  let lastRes: Response | null = null
  for (const url of urls) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    lastRes = res
    if (res.ok) return (await res.json()) as PropertyFeedback
  }
  const msg = lastRes ? await parseErrorMessage(lastRes) : ''
  throw new Error(msg || '提交失败')
}

export async function uploadCleaningMedia(
  token: string,
  file: { uri: string; name: string; mimeType: string },
  meta?: Record<string, string | undefined | null>,
) {
  const urls = buildUrlCandidates('cleaning-app/upload')
  if (!urls.length) throw new Error('后端地址未配置（EXPO_PUBLIC_API_BASE_URL）')
  const { compressImageForUpload } = await import('./imageCompression')
  const compressedUri = await compressImageForUpload(file.uri)
  const form = new FormData()
  if (meta) {
    for (const [k, v] of Object.entries(meta)) {
      const vv = String(v ?? '').trim()
      if (vv) form.append(k, vv)
    }
  }
  form.append('file', { uri: compressedUri, name: file.name, type: file.mimeType } as any)

  let lastRes: Response | null = null
  for (const url of urls) {
    lastRes = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form as any,
      },
      30000,
    )
    if (lastRes.status !== 404) break
  }
  const res = lastRes as Response
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  const data = (await parseJsonOrThrow(res)) as any
  const u = String(data?.url || '').trim()
  if (!u) throw new Error('上传成功但未返回 url')
  return { url: u }
}

export async function uploadCleaningVideo(token: string, file: { uri: string; name: string; mimeType: string }) {
  const urls = buildUrlCandidates('cleaning-app/upload')
  if (!urls.length) throw new Error('后端地址未配置（EXPO_PUBLIC_API_BASE_URL）')
  const form = new FormData()
  form.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as any)

  let lastRes: Response | null = null
  for (const url of urls) {
    lastRes = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form as any,
      },
      60000,
    )
    if (lastRes.status !== 404) break
  }
  const res = lastRes as Response
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  const data = (await parseJsonOrThrow(res)) as any
  const u = String(data?.url || '').trim()
  if (!u) throw new Error('上传成功但未返回 url')
  return { url: u }
}

export async function startCleaningTask(token: string, taskId: string, params: { media_url: string; captured_at?: string }) {
  const urls = buildUrlCandidates(`cleaning-app/tasks/${encodeURIComponent(taskId)}/start`)
  if (!urls.length) throw new Error('后端地址未配置（EXPO_PUBLIC_API_BASE_URL）')
  let lastRes: Response | null = null
  for (const url of urls) {
    lastRes = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      },
      15000,
    )
    if (lastRes.status !== 404) break
  }
  const res = lastRes as Response
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  return (await parseJsonOrThrow(res)) as any
}

export async function uploadLockboxVideo(token: string, cleaningTaskId: string, params: { media_url: string }) {
  const urls = buildUrlCandidates(`mzapp/cleaning-tasks/${encodeURIComponent(cleaningTaskId)}/lockbox-video`)
  if (!urls.length) throw new Error('后端地址未配置（EXPO_PUBLIC_API_BASE_URL）')
  let lastRes: Response | null = null
  for (const url of urls) {
    lastRes = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      },
      20000,
    )
    if (lastRes.status !== 404) break
  }
  const res = lastRes as Response
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  return (await parseJsonOrThrow(res)) as any
}

export async function uploadSelfLockboxVideo(token: string, cleaningTaskId: string, params: { media_url: string; captured_at?: string }) {
  const urls = buildUrlCandidates(`cleaning-app/tasks/${encodeURIComponent(cleaningTaskId)}/lockbox-video`)
  if (!urls.length) throw new Error('后端地址未配置（EXPO_PUBLIC_API_BASE_URL）')
  let lastRes: Response | null = null
  for (const url of urls) {
    lastRes = await fetchWithTimeout(
      url,
      { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(params) },
      20000,
    )
    if (lastRes.status !== 404) break
  }
  const res = lastRes as Response
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  return (await parseJsonOrThrow(res)) as any
}

export type InspectionPhotoArea = 'toilet' | 'living' | 'sofa' | 'bedroom' | 'kitchen' | 'unclean'

export async function getInspectionPhotos(token: string, cleaningTaskId: string) {
  const urls = uniq([
    ...buildUrlCandidates(`cleaning-app/tasks/${encodeURIComponent(cleaningTaskId)}/inspection-photos`),
    ...buildUrlCandidates(`mzapp/cleaning-tasks/${encodeURIComponent(cleaningTaskId)}/inspection-photos`),
  ])
  if (!urls.length) throw new Error('后端地址未配置（EXPO_PUBLIC_API_BASE_URL）')
  let lastRes: Response | null = null
  for (const url of urls) {
    lastRes = await fetchWithTimeout(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } }, 15000)
    if (lastRes.status !== 404) break
  }
  const res = lastRes as Response
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  return (await parseJsonOrThrow(res)) as {
    items: Array<{ area: string; url: string; note?: string | null; captured_at?: string | null; created_at?: string | null }>
  }
}

export async function saveInspectionPhotos(
  token: string,
  cleaningTaskId: string,
  params: { items: Array<{ area: InspectionPhotoArea; url: string; note?: string | null; captured_at?: string }> },
) {
  const urls = uniq([
    ...buildUrlCandidates(`cleaning-app/tasks/${encodeURIComponent(cleaningTaskId)}/inspection-photos`),
    ...buildUrlCandidates(`mzapp/cleaning-tasks/${encodeURIComponent(cleaningTaskId)}/inspection-photos`),
  ])
  if (!urls.length) throw new Error('后端地址未配置（EXPO_PUBLIC_API_BASE_URL）')
  let lastRes: Response | null = null
  for (const url of urls) {
    lastRes = await fetchWithTimeout(
      url,
      { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(params) },
      15000,
    )
    if (lastRes.status !== 404) break
  }
  const res = lastRes as Response
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  return (await parseJsonOrThrow(res)) as any
}

export async function getRestockProof(token: string, cleaningTaskId: string) {
  const urls = uniq([
    ...buildUrlCandidates(`cleaning-app/tasks/${encodeURIComponent(cleaningTaskId)}/restock-proof`),
    ...buildUrlCandidates(`mzapp/cleaning-tasks/${encodeURIComponent(cleaningTaskId)}/restock-proof`),
  ])
  if (!urls.length) throw new Error('后端地址未配置（EXPO_PUBLIC_API_BASE_URL）')
  let lastRes: Response | null = null
  for (const url of urls) {
    lastRes = await fetchWithTimeout(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } }, 15000)
    if (lastRes.status !== 404) break
  }
  const res = lastRes as Response
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  return (await parseJsonOrThrow(res)) as {
    items: Array<{ item_id: string; proof_url: string | null; status?: string | null; qty?: number | null; note?: string | null; created_at?: string | null }>
  }
}

export async function saveRestockProof(
  token: string,
  cleaningTaskId: string,
  params: { items: Array<{ item_id: string; status: 'restocked' | 'unavailable'; qty?: number | null; note?: string | null; proof_url: string | null }> },
) {
  const urls = uniq([
    ...buildUrlCandidates(`cleaning-app/tasks/${encodeURIComponent(cleaningTaskId)}/restock-proof`),
    ...buildUrlCandidates(`mzapp/cleaning-tasks/${encodeURIComponent(cleaningTaskId)}/restock-proof`),
  ])
  if (!urls.length) throw new Error('后端地址未配置（EXPO_PUBLIC_API_BASE_URL）')
  let lastRes: Response | null = null
  for (const url of urls) {
    lastRes = await fetchWithTimeout(
      url,
      { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(params) },
      15000,
    )
    if (lastRes.status !== 404) break
  }
  const res = lastRes as Response
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  return (await parseJsonOrThrow(res)) as any
}

export type CompletionPhotoArea = 'toilet' | 'living' | 'sofa' | 'bedroom' | 'kitchen'

export async function getCompletionPhotos(token: string, cleaningTaskId: string) {
  const urls = buildUrlCandidates(`cleaning-app/tasks/${encodeURIComponent(cleaningTaskId)}/completion-photos`)
  if (!urls.length) throw new Error('后端地址未配置（EXPO_PUBLIC_API_BASE_URL）')
  let lastRes: Response | null = null
  for (const url of urls) {
    lastRes = await fetchWithTimeout(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } }, 15000)
    if (lastRes.status !== 404) break
  }
  const res = lastRes as Response
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  return (await parseJsonOrThrow(res)) as {
    items: Array<{ area: string; url: string; note?: string | null; captured_at?: string | null; created_at?: string | null }>
  }
}

export async function saveCompletionPhotos(
  token: string,
  cleaningTaskId: string,
  params: { items: Array<{ area: CompletionPhotoArea; url: string; note?: string | null; captured_at?: string }> },
) {
  const urls = buildUrlCandidates(`cleaning-app/tasks/${encodeURIComponent(cleaningTaskId)}/completion-photos`)
  if (!urls.length) throw new Error('后端地址未配置（EXPO_PUBLIC_API_BASE_URL）')
  let lastRes: Response | null = null
  for (const url of urls) {
    lastRes = await fetchWithTimeout(
      url,
      { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(params) },
      15000,
    )
    if (lastRes.status !== 404) break
  }
  const res = lastRes as Response
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  return (await parseJsonOrThrow(res)) as any
}

export async function selfCompleteCleaningTask(token: string, cleaningTaskId: string) {
  const urls = buildUrlCandidates(`cleaning-app/tasks/${encodeURIComponent(cleaningTaskId)}/self-complete`)
  if (!urls.length) throw new Error('后端地址未配置（EXPO_PUBLIC_API_BASE_URL）')
  let lastRes: Response | null = null
  for (const url of urls) {
    lastRes = await fetchWithTimeout(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }, 20000)
    if (lastRes.status !== 404) break
  }
  const res = lastRes as Response
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  return (await parseJsonOrThrow(res)) as any
}

export async function markGuestCheckedOut(token: string, cleaningTaskId: string, params?: { action?: 'set' | 'unset' }) {
  const urls = buildUrlCandidates(`mzapp/cleaning-tasks/${encodeURIComponent(cleaningTaskId)}/guest-checked-out`)
  if (!urls.length) throw new Error('后端地址未配置（EXPO_PUBLIC_API_BASE_URL）')
  let lastRes: Response | null = null
  for (const url of urls) {
    lastRes = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: params ? JSON.stringify(params) : undefined,
      },
      15000,
    )
    if (lastRes.status !== 404) break
  }
  const res = lastRes as Response
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  return (await parseJsonOrThrow(res)) as any
}

export async function markGuestCheckedOutBulk(token: string, params: { task_ids: string[]; action?: 'set' | 'unset' }) {
  const urls = buildUrlCandidates('mzapp/cleaning-tasks/guest-checked-out')
  if (!urls.length) throw new Error('后端地址未配置（EXPO_PUBLIC_API_BASE_URL）')
  let lastRes: Response | null = null
  for (const url of urls) {
    lastRes = await fetchWithTimeout(
      url,
      { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(params) },
      15000,
    )
    if (lastRes.status !== 404) break
  }
  const res = lastRes as Response
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  return (await parseJsonOrThrow(res)) as any
}

export async function registerExpoPushToken(token: string, params: { expo_push_token: string; platform?: string; device_id?: string; ua?: string }) {
  const urls = buildUrlCandidates('notifications/expo/register')
  if (!urls.length) throw new Error('后端地址未配置（EXPO_PUBLIC_API_BASE_URL）')
  let lastRes: Response | null = null
  for (const url of urls) {
    lastRes = await fetchWithTimeout(
      url,
      { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(params) },
      15000,
    )
    if (lastRes.status !== 404) break
  }
  const res = lastRes as Response
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  return (await parseJsonOrThrow(res)) as any
}

export async function submitCleaningConsumables(
  token: string,
  taskId: string,
  params: { items: Array<{ item_id: string; status: 'ok' | 'low'; qty?: number; note?: string; photo_url?: string }> },
) {
  const urls = buildUrlCandidates(`cleaning-app/tasks/${encodeURIComponent(taskId)}/consumables`)
  if (!urls.length) throw new Error('后端地址未配置（EXPO_PUBLIC_API_BASE_URL）')
  let lastRes: Response | null = null
  for (const url of urls) {
    lastRes = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      },
      15000,
    )
    if (lastRes.status !== 404) break
  }
  const res = lastRes as Response
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  return (await parseJsonOrThrow(res)) as any
}

export async function listUsers(token: string) {
  const urls = buildUrlCandidates('users/contacts')
  if (!urls.length) throw new Error('后端地址未配置（EXPO_PUBLIC_API_BASE_URL）')
  let lastRes: Response | null = null
  for (const url of urls) {
    lastRes = await fetchWithTimeout(
      url,
      { method: 'GET', headers: { Authorization: `Bearer ${token}` } },
      15000,
    )
    if (lastRes.status !== 404) break
  }
  const res = lastRes as Response
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  return (await parseJsonOrThrow(res)) as Array<{
    id: string
    username: string
    role: string
    phone_au?: string | null
    display_name?: string | null
    avatar_url?: string | null
  }>
}

export async function listCompanySecretsForApp(token: string) {
  const urls = buildUrlCandidates('cms/company/secrets/app-list')
  if (!urls.length) throw new Error('后端地址未配置（EXPO_PUBLIC_API_BASE_URL）')
  let lastRes: Response | null = null
  for (const url of urls) {
    lastRes = await fetchWithTimeout(
      url,
      { method: 'GET', headers: { Authorization: `Bearer ${token}` } },
      15000,
    )
    if (lastRes.status !== 404) break
  }
  const res = lastRes as Response
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  return (await parseJsonOrThrow(res)) as Array<{ id: string; title: string; username?: string | null; note?: string | null; secret?: string | null; updated_at?: string | null }>
}

export async function logCopyCompanySecretForApp(token: string, secretId: string) {
  const urls = buildUrlCandidates(`cms/company/secrets/${encodeURIComponent(secretId)}/log-copy-app`)
  if (!urls.length) throw new Error('后端地址未配置（EXPO_PUBLIC_API_BASE_URL）')
  let lastRes: Response | null = null
  for (const url of urls) {
    lastRes = await fetchWithTimeout(
      url,
      { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
      15000,
    )
    if (lastRes.status !== 404) break
  }
  const res = lastRes as Response
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  return (await parseJsonOrThrow(res)) as any
}

export async function getMyProfile(token: string) {
  const urls = buildUrlCandidates('users/me')
  if (!urls.length) throw new Error('后端地址未配置（EXPO_PUBLIC_API_BASE_URL）')
  let lastRes: Response | null = null
  for (const url of urls) {
    lastRes = await fetchWithTimeout(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } }, 15000)
    if (lastRes.status !== 404) break
  }
  const res = lastRes as Response
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  return (await parseJsonOrThrow(res)) as { id: string; username: string; role: string; phone_au?: string | null; display_name?: string | null; avatar_url?: string | null }
}

export async function updateMyProfile(
  token: string,
  params: { phone_au?: string | null; display_name?: string; avatar_url?: string | null },
) {
  const urls = buildUrlCandidates('users/me')
  if (!urls.length) throw new Error('后端地址未配置（EXPO_PUBLIC_API_BASE_URL）')
  let lastRes: Response | null = null
  for (const url of urls) {
    lastRes = await fetchWithTimeout(
      url,
      { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(params) },
      15000,
    )
    if (lastRes.status !== 404) break
  }
  const res = lastRes as Response
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  return (await parseJsonOrThrow(res)) as { id: string; username: string; role: string; phone_au?: string | null; display_name?: string | null; avatar_url?: string | null }
}

export async function changeMyPassword(token: string, params: { old_password: string; new_password: string }) {
  const urls = buildUrlCandidates('users/me/change-password')
  if (!urls.length) throw new Error('后端地址未配置（EXPO_PUBLIC_API_BASE_URL）')
  let lastRes: Response | null = null
  for (const url of urls) {
    lastRes = await fetchWithTimeout(
      url,
      { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(params) },
      15000,
    )
    if (lastRes.status !== 404) break
  }
  const res = lastRes as Response
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  return (await parseJsonOrThrow(res)) as { ok: boolean }
}

export type MzappAlert = {
  id: string
  kind: string
  level: string
  date?: string | null
  position?: number | null
  payload: any
  created_at: string
  read_at?: string | null
}

export async function listMzappAlerts(token: string, params?: { unread?: boolean; kind?: string; limit?: number }) {
  const q = new URLSearchParams()
  if (params?.unread) q.set('unread', '1')
  if (params?.kind) q.set('kind', params.kind)
  if (params?.limit) q.set('limit', String(params.limit))
  const suffix = q.toString() ? `mzapp/alerts?${q.toString()}` : 'mzapp/alerts'
  const urls = buildUrlCandidates(suffix)
  if (!urls.length) throw new Error('后端地址未配置（EXPO_PUBLIC_API_BASE_URL）')
  let lastRes: Response | null = null
  for (const url of urls) {
    lastRes = await fetchWithTimeout(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } }, 15000)
    if (lastRes.status !== 404) break
  }
  const res = lastRes as Response
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  return (await parseJsonOrThrow(res)) as MzappAlert[]
}

export async function markMzappAlertRead(token: string, alertId: string) {
  const urls = buildUrlCandidates(`mzapp/alerts/${encodeURIComponent(alertId)}/read`)
  if (!urls.length) throw new Error('后端地址未配置（EXPO_PUBLIC_API_BASE_URL）')
  let lastRes: Response | null = null
  for (const url of urls) {
    lastRes = await fetchWithTimeout(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }, 15000)
    if (lastRes.status !== 404) break
  }
  const res = lastRes as Response
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  return (await parseJsonOrThrow(res)) as { ok: boolean }
}

export async function reorderCleaningTasks(
  token: string,
  params: { kind: 'cleaner' | 'inspector'; date: string; groups: string[][] },
) {
  const urls = buildUrlCandidates('mzapp/cleaning-tasks/reorder')
  if (!urls.length) throw new Error('后端地址未配置（EXPO_PUBLIC_API_BASE_URL）')
  let lastRes: Response | null = null
  for (const url of urls) {
    lastRes = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      },
      15000,
    )
    if (lastRes.status !== 404) break
  }
  const res = lastRes as Response
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  return (await parseJsonOrThrow(res)) as any
}

export async function uploadMzappMedia(token: string, file: { uri: string; name: string; mimeType: string }) {
  const urls = buildUrlCandidates('mzapp/upload')
  if (!urls.length) throw new Error('后端地址未配置（EXPO_PUBLIC_API_BASE_URL）')
  const { compressImageForUpload } = await import('./imageCompression')
  const compressedUri = await compressImageForUpload(file.uri)
  const form = new FormData()
  form.append('file', { uri: compressedUri, name: file.name, type: file.mimeType } as any)
  let lastRes: Response | null = null
  for (const url of urls) {
    lastRes = await fetchWithTimeout(
      url,
      { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form as any },
      30000,
    )
    if (lastRes.status !== 404) break
  }
  const res = lastRes as Response
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  const data = (await parseJsonOrThrow(res)) as any
  const u = String(data?.url || '').trim()
  if (!u) throw new Error('上传成功但未返回 url')
  return { url: u }
}

export async function markWorkTask(
  token: string,
  taskId: string,
  params: { action: 'done' | 'defer'; photo_url?: string | null; note?: string | null; reason?: string | null; defer_to?: string | null },
) {
  const urls = buildUrlCandidates(`mzapp/work-tasks/${encodeURIComponent(taskId)}/mark`)
  if (!urls.length) throw new Error('后端地址未配置（EXPO_PUBLIC_API_BASE_URL）')
  let lastRes: Response | null = null
  for (const url of urls) {
    lastRes = await fetchWithTimeout(
      url,
      { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(params) },
      15000,
    )
    if (lastRes.status !== 404) break
  }
  const res = lastRes as Response
  if (!res.ok) throw new Error(await parseErrorMessage(res))
  return (await parseJsonOrThrow(res)) as any
}
