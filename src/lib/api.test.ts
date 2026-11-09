jest.mock('./authEvents', () => ({
  notifyAuthInvalidated: jest.fn(),
}))

jest.mock('expo-file-system', () => ({
  File: class File {
    get exists() {
      return true
    }
  },
}))

function response(status: number, body: unknown) {
  const text = JSON.stringify(body)
  const value: any = {
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn(async () => text),
    json: jest.fn(async () => body),
  }
  value.clone = jest.fn(() => response(status, body))
  return value
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.useRealTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

test('manual checkin link candidates use the canonical read-only query and preserve the minimal DTO', async () => {
  const fetchMock = jest.fn(async () => response(200, {
    items: [{
      id: 'FIXTURE-CHECKOUT-TASK-001',
      property_id: 'FIXTURE-PROPERTY-001',
      property_code: 'FIXTURE-PROP-CODE-001',
      task_date: '2026-11-03',
      checkout_time: '10am',
      status: 'completed',
    }],
  }))
  globalThis.fetch = fetchMock as any
  const api = require('./api') as typeof import('./api')

  await expect(api.listManualCheckinLinkCandidates('token', {
    property_id: 'FIXTURE-PROPERTY-001',
    task_date: '2026-11-03',
  })).resolves.toEqual([{
    id: 'FIXTURE-CHECKOUT-TASK-001',
    property_id: 'FIXTURE-PROPERTY-001',
    property_code: 'FIXTURE-PROP-CODE-001',
    task_date: '2026-11-03',
    checkout_time: '10am',
    status: 'completed',
  }])

  const [url, init] = (fetchMock as jest.Mock).mock.calls[0]
  expect(url).toContain('/cleaning/tasks/checkin-link-candidates?')
  expect(url).toContain('property_id=FIXTURE-PROPERTY-001')
  expect(url).toContain('task_date=2026-11-03')
  expect(init).toEqual(expect.objectContaining({ method: 'GET', cache: 'no-store' }))
  expect((init.headers as Headers).get('Authorization')).toBe('Bearer token')
})

test('manual checkin link candidates fail closed for service errors and out-of-scope data', async () => {
  const api = require('./api') as typeof import('./api')
  globalThis.fetch = jest.fn(async () => response(503, {
    code: 'checkin_link_candidates_unavailable',
    message: 'candidate query unavailable',
  })) as any
  await expect(api.listManualCheckinLinkCandidates('token', {
    property_id: 'FIXTURE-PROPERTY-001',
    task_date: '2026-11-03',
  })).rejects.toMatchObject({ status: 503, code: 'SERVER_ERROR', retryable: true })

  globalThis.fetch = jest.fn(async () => response(200, {
    items: [{
      id: 'FIXTURE-CHECKOUT-TASK-OTHER',
      property_id: 'FIXTURE-PROPERTY-OTHER',
      property_code: 'FIXTURE-PROP-CODE-OTHER',
      task_date: '2026-11-03',
      checkout_time: '10am',
      status: 'completed',
    }],
  })) as any
  await expect(api.listManualCheckinLinkCandidates('token', {
    property_id: 'FIXTURE-PROPERTY-001',
    task_date: '2026-11-03',
  })).rejects.toMatchObject({ code: 'INVALID_RESPONSE', retryable: true })
})

test('manual cleaning create sends an explicit link decision and preserves structured conflicts', async () => {
  const api = require('./api') as typeof import('./api')
  const fetchMock = jest.fn(async () => response(409, {
    code: 'manual_checkin_checkout_link_conflict',
    message: 'candidate already linked',
  }))
  globalThis.fetch = fetchMock as any

  await expect(api.createManualCleaningTask('token', {
    create_mode: 'checkin',
    task_date: '2026-11-03',
    property_id: 'FIXTURE-PROPERTY-001',
    new_code: null,
    linked_checkout_task_id: 'FIXTURE-CHECKOUT-TASK-001',
    checkin_link_decision: 'link',
  })).rejects.toMatchObject({ status: 409, code: 'manual_checkin_checkout_link_conflict' })

  const body = JSON.parse(String((fetchMock as jest.Mock).mock.calls[0][1]?.body || '{}'))
  expect(body).toEqual(expect.objectContaining({
    linked_checkout_task_id: 'FIXTURE-CHECKOUT-TASK-001',
    checkin_link_decision: 'link',
  }))
  expect(Object.prototype.hasOwnProperty.call(body, 'old_code')).toBe(false)
})

test('manual checkout link candidates and create payload use the reverse explicit protocol', async () => {
  const api = require('./api') as typeof import('./api')
  const fetchMock = jest.fn()
    .mockResolvedValueOnce(response(200, {
      items: [{
        id: 'FIXTURE-CHECKIN-TASK-001',
        property_id: 'FIXTURE-PROPERTY-001',
        property_code: 'FIXTURE-PROP-CODE-001',
        task_date: '2026-11-04',
        checkin_time: '3pm',
        status: 'assigned',
        inspection_scope: 'inspect_and_hang',
      }],
    }))
    .mockResolvedValueOnce(response(200, { id: 'FIXTURE-CHECKOUT-TASK-001' }))
  globalThis.fetch = fetchMock as any

  await expect(api.listManualCheckoutLinkCandidates('token', {
    property_id: 'FIXTURE-PROPERTY-001',
    task_date: '2026-11-04',
  })).resolves.toEqual([expect.objectContaining({
    id: 'FIXTURE-CHECKIN-TASK-001',
    checkin_time: '3pm',
    inspection_scope: 'inspect_and_hang',
  })])

  await api.createManualCleaningTask('token', {
    request_id: '3dd48a62-6861-4e55-a17f-c1814511076d',
    create_mode: 'checkout',
    task_date: '2026-11-04',
    property_id: 'FIXTURE-PROPERTY-001',
    linked_checkin_task_id: 'FIXTURE-CHECKIN-TASK-001',
    checkout_link_decision: 'link',
  })
  const createBody = JSON.parse(String((fetchMock as jest.Mock).mock.calls[1][1]?.body || '{}'))
  expect(createBody).toEqual(expect.objectContaining({
    request_id: '3dd48a62-6861-4e55-a17f-c1814511076d',
    linked_checkin_task_id: 'FIXTURE-CHECKIN-TASK-001',
    checkout_link_decision: 'link',
  }))
})

test('reverse candidates fail closed for password-only and out-of-scope rows', async () => {
  const api = require('./api') as typeof import('./api')
  globalThis.fetch = jest.fn(async () => response(200, {
    items: [{
      id: 'CHECKIN-PASSWORD-ONLY',
      property_id: 'FIXTURE-PROPERTY-001',
      property_code: 'FIXTURE-PROP-CODE-001',
      task_date: '2026-11-04',
      checkin_time: '3pm',
      inspection_scope: 'password_only',
    }],
  })) as any
  await expect(api.listManualCheckoutLinkCandidates('token', {
    property_id: 'FIXTURE-PROPERTY-001',
    task_date: '2026-11-04',
  })).rejects.toMatchObject({ code: 'INVALID_RESPONSE', retryable: true })
})

test('manager fields retries once with an unambiguous legacy payload only after strict-schema rejection', async () => {
  const api = require('./api') as typeof import('./api')
  const fetchMock = jest.fn()
    .mockResolvedValueOnce(response(400, {
      _errors: ["Unrecognized key(s) in object: 'operation_id', 'items'"],
    }))
    .mockResolvedValueOnce(response(201, { ok: true, updated: 2 }))
  globalThis.fetch = fetchMock as any

  await expect(api.updateCleaningTaskManagerFields('token', {
    operation_id: 'opaque-manager-save-1',
    task_ids: ['checkout-1', 'checkin-1'],
    items: [
      { id: 'checkout-1', checkout_time: '10:30am', guest_special_request: 'same request' },
      { id: 'checkin-1', checkin_time: '3:30pm', guest_special_request: 'same request' },
    ],
    password_task_ids: ['checkin-1'],
    new_code: 'SYNTH-NEW',
    password_verification: { fields: ['new_code'], request_id: 'opaque-manager-save-1', client: 'mobile' },
  })).resolves.toEqual({ ok: true, updated: 2 })

  expect(fetchMock).toHaveBeenCalledTimes(2)
  const modern = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body || '{}'))
  const legacy = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body || '{}'))
  expect(modern).toMatchObject({ operation_id: 'opaque-manager-save-1', items: expect.any(Array) })
  expect(legacy).toMatchObject({
    task_ids: ['checkout-1', 'checkin-1'],
    checkout_time: '10:30am',
    checkin_time: '3:30pm',
    guest_special_request: 'same request',
    new_code: 'SYNTH-NEW',
    password_verification: { request_id: 'opaque-manager-save-1' },
  })
  expect(legacy).not.toHaveProperty('operation_id')
  expect(legacy).not.toHaveProperty('items')
  expect(fetchMock.mock.calls[1]?.[0]).toBe(fetchMock.mock.calls[0]?.[0])
  expect(fetchMock.mock.calls[1]?.[1]?.method).toBe(fetchMock.mock.calls[0]?.[1]?.method)
})

test('manager fields never retries an uncertain failure as a legacy save', async () => {
  const api = require('./api') as typeof import('./api')
  const fetchMock = jest.fn(async () => response(400, { _errors: ['business validation failed'] }))
  globalThis.fetch = fetchMock as any

  await expect(api.updateCleaningTaskManagerFields('token', {
    operation_id: 'opaque-manager-save-2',
    task_ids: ['checkin-1'],
    items: [{ id: 'checkin-1', checkin_time: '4pm' }],
  })).rejects.toThrow('business validation failed')
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test('manager fields fails closed when per-task values cannot be represented by the old schema', async () => {
  const api = require('./api') as typeof import('./api')
  const fetchMock = jest.fn(async () => response(400, {
    _errors: ["Unrecognized key(s) in object: 'operation_id', 'items'"],
  }))
  globalThis.fetch = fetchMock as any

  await expect(api.updateCleaningTaskManagerFields('token', {
    operation_id: 'opaque-manager-save-3',
    task_ids: ['checkout-1', 'checkin-1'],
    items: [
      { id: 'checkout-1', guest_special_request: 'first' },
      { id: 'checkin-1', guest_special_request: 'second' },
    ],
  })).rejects.toThrow('旧后端无法安全表示多个任务的不同字段值')
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test('queue request can handle 401 without invalidating the global session', async () => {
  const fetchMock = jest.fn(async () => response(401, { message: 'token expired' }))
  globalThis.fetch = fetchMock as any
  const authEvents = require('./authEvents') as { notifyAuthInvalidated: jest.Mock }
  const api = require('./api') as typeof import('./api')

  await expect(api.saveInspectionPhotos(
    'NOT_A_REAL_EXPIRED_TOKEN',
    'FIXTURE-CLEANING-TASK-001',
    { items: [] },
    { skipAuthInvalidation: true },
  )).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' })

  expect(authEvents.notifyAuthInvalidated).not.toHaveBeenCalled()
  expect(fetchMock).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      cache: 'no-store',
    }),
  )
  const sentHeaders = (fetchMock as jest.Mock).mock.calls[0]?.[1]?.headers as Headers
  expect(sentHeaders.get('Authorization')).toBe('Bearer NOT_A_REAL_EXPIRED_TOKEN')
  expect(sentHeaders.get('X-Skip-Auth-Invalidation')).toBe('1')
  expect(sentHeaders.get('Cache-Control')).toBe('no-cache')
  expect(sentHeaders.get('Pragma')).toBe('no-cache')
})

test('mzapp upload exposes the server-owned task-photo reference without replacing the legacy url field', async () => {
  const fetchMock = jest.fn(async () => response(201, {
    url: 'https://example.invalid/mzapp/task-photo.jpg',
    key: 'mzapp/task-photo.jpg',
    remote_reference: 'fixture://not-a-real-remote-reference/mzapp/task-photo.jpg',
  }))
  globalThis.fetch = fetchMock as any
  const api = require('./api') as typeof import('./api')

  await expect(api.uploadMzappMedia(
    'token',
    { uri: 'file:///task-photo.jpg', name: 'task-photo.jpg', mimeType: 'image/jpeg' },
    undefined,
    { skipImageCompression: true },
  )).resolves.toEqual({
    url: 'https://example.invalid/mzapp/task-photo.jpg',
    key: 'mzapp/task-photo.jpg',
    remoteReference: 'fixture://not-a-real-remote-reference/mzapp/task-photo.jpg',
  })
})

test('task-list timeout aborts a fetch that never returns headers', async () => {
  jest.useFakeTimers()
  globalThis.fetch = jest.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => {
      const error = new Error('aborted')
      error.name = 'AbortError'
      reject(error)
    })
  })) as any
  const api = require('./api') as typeof import('./api')

  const request = api.listWorkTasks('token', { date_from: '2026-10-20', date_to: '2026-10-20', view: 'mine' })
  const rejected = expect(request).rejects.toMatchObject({ status: 0, code: 'TIMEOUT', retryable: true })
  await jest.advanceTimersByTimeAsync(15_000)
  await rejected
})

test('task-list timeout also bounds a response body that never finishes', async () => {
  jest.useFakeTimers()
  const body = new Promise<string>(() => {})
  globalThis.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    text: jest.fn(() => body),
  })) as any
  const api = require('./api') as typeof import('./api')

  const request = api.listWorkTasks('token', { date_from: '2026-10-20', date_to: '2026-10-20', view: 'mine' })
  const rejected = expect(request).rejects.toMatchObject({ status: 0, code: 'TIMEOUT', retryable: true })
  await Promise.resolve()
  await jest.advanceTimersByTimeAsync(15_000)
  await rejected
})

test.each([401, 403])('task-list permission status %s fails before reading a pending body', async (status) => {
  const text = jest.fn(() => new Promise<string>(() => {}))
  globalThis.fetch = jest.fn(async () => ({ ok: false, status, text })) as any
  const api = require('./api') as typeof import('./api')

  await expect(api.listWorkTasks('token', {
    date_from: '2026-10-20',
    date_to: '2026-10-20',
    view: 'mine',
  })).rejects.toMatchObject({ status, code: status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN', retryable: false })
  expect(text).not.toHaveBeenCalled()
})

test.each([
  [401, 'UNAUTHORIZED'],
  [403, 'FORBIDDEN'],
  [404, 'property_feedback_source_task_not_found'],
] as const)('property feedback create preserves status and server error code for %s', async (status, expectedCode) => {
  globalThis.fetch = jest.fn(async () => response(status, { code: expectedCode })) as any
  const api = require('./api') as typeof import('./api')

  await expect(api.createPropertyFeedback('token', {
    kind: 'deep_cleaning',
    property_id: 'FIXTURE-PROPERTY-FEEDBACK-001',
    source_task_id: 'FIXTURE-CLEANING-TASK-001',
    areas: ['浴室'],
    detail: '深清记录',
    media_urls: ['cleaning/before.jpg'],
  })).rejects.toMatchObject({ status, code: expectedCode })
})

test('property feedback project create preserves a structured 403 error', async () => {
  globalThis.fetch = jest.fn(async () => response(403, { code: 'FORBIDDEN' })) as any
  const api = require('./api') as typeof import('./api')

  await expect(api.createPropertyFeedbackProject(
    'token',
    'deep_cleaning',
    'FIXTURE-FEEDBACK-001',
    { name: '浴室深清', area: '浴室' },
  )).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
})

test('property feedback project update remains a global restart blocker after its screen unmounts', async () => {
  const safety = require('./appRestartSafety') as typeof import('./appRestartSafety')
  safety.__resetAppRestartSafetyForTests()
  let finishRequest!: (value: any) => void
  globalThis.fetch = jest.fn(() => new Promise((resolve) => {
    finishRequest = resolve
  })) as any
  const api = require('./api') as typeof import('./api')

  safety.setAppRestartBlocker('screen:feedback-form', { kind: 'unsaved', message: '反馈表单尚未完成' })
  const request = api.updatePropertyFeedbackProject(
    'token', 'deep_cleaning', 'FIXTURE-FEEDBACK-001', 'FIXTURE-PROJECT-001', { note: '已更新' },
  )
  await Promise.resolve()
  safety.setAppRestartBlocker('screen:feedback-form', null)

  const duringRequest = await safety.checkAppRestartSafety()
  expect(duringRequest.safe).toBe(false)
  expect(duringRequest.blockers).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: 'submitting', message: '数据正在提交，请等待完成' }),
  ]))

  finishRequest(response(200, { ok: true, item: {}, row: {} }))
  await expect(request).resolves.toMatchObject({ ok: true })
  expect((await safety.checkAppRestartSafety()).blockers).not.toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: 'submitting', message: '数据正在提交，请等待完成' }),
  ]))
})

test('property feedback project completion preserves a structured 401 error', async () => {
  globalThis.fetch = jest.fn(async () => response(401, { code: 'UNAUTHORIZED' })) as any
  const api = require('./api') as typeof import('./api')

  await expect(api.completePropertyFeedbackProject(
    'token',
    'deep_cleaning',
    'FIXTURE-FEEDBACK-001',
    'FIXTURE-PROJECT-001',
    {
      source_task_id: 'FIXTURE-CLEANING-TASK-001',
      before_photos: ['cleaning/before.jpg'],
      after_photos: ['cleaning/after.jpg'],
    },
  )).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' })
})

test.each([
  ['feedback create', (api: typeof import('./api')) => api.createPropertyFeedback('token', {
    kind: 'deep_cleaning',
    property_id: 'FIXTURE-PROPERTY-FEEDBACK-001',
    source_task_id: 'FIXTURE-CLEANING-TASK-001',
    areas: ['浴室'],
    detail: '深清记录',
    media_urls: ['cleaning/before.jpg'],
  })],
  ['project create', (api: typeof import('./api')) => api.createPropertyFeedbackProject(
    'token', 'deep_cleaning', 'FIXTURE-FEEDBACK-001', { name: '浴室深清', area: '浴室' },
  )],
  ['project complete', (api: typeof import('./api')) => api.completePropertyFeedbackProject(
    'token', 'deep_cleaning', 'FIXTURE-FEEDBACK-001', 'FIXTURE-PROJECT-001', {
      source_task_id: 'FIXTURE-CLEANING-TASK-001',
      before_photos: ['cleaning/before.jpg'],
      after_photos: ['cleaning/after.jpg'],
    },
  )],
] as const)('%s aborts a request that never returns headers', async (_label, invoke) => {
  jest.useFakeTimers()
  globalThis.fetch = jest.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => {
      const error = new Error('aborted')
      error.name = 'AbortError'
      reject(error)
    })
  })) as any
  const api = require('./api') as typeof import('./api')

  const request = invoke(api)
  const rejected = expect(request).rejects.toMatchObject({ status: 0, code: 'TIMEOUT', retryable: true })
  await jest.advanceTimersByTimeAsync(30_000)
  await rejected
})

test.each([200, 500])('feedback create bounds a %s response body that never finishes', async (status) => {
  jest.useFakeTimers()
  globalThis.fetch = jest.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn(() => new Promise<string>(() => {})),
  })) as any
  const api = require('./api') as typeof import('./api')

  const request = api.createPropertyFeedback('token', {
    kind: 'deep_cleaning',
    property_id: 'FIXTURE-PROPERTY-FEEDBACK-001',
    source_task_id: 'FIXTURE-CLEANING-TASK-001',
    areas: ['浴室'],
    detail: '深清记录',
    media_urls: ['cleaning/before.jpg'],
  })
  const rejected = expect(request).rejects.toMatchObject({ status: 0, code: 'TIMEOUT', retryable: true })
  await jest.advanceTimersByTimeAsync(30_000)
  await rejected
})

test('MZ-084 property history access context is explicitly sent for list, edit and delete', async () => {
  const fetchMock = jest.fn(async () => response(200, []))
  globalThis.fetch = fetchMock as any
  const api = require('./api') as typeof import('./api')
  const access = { source_task_id: 'current-task', history_scope: 'property' as const }
  await api.listPropertyFeedbacks('fixture-token', { property_id: 'fixture-property', ...access })
  await api.updatePropertyFeedback('fixture-token', 'maintenance', 'old-record', { detail: 'fixture edit' }, access)
  await api.deletePropertyFeedback('fixture-token', 'maintenance', 'old-record', access)
  expect(fetchMock).toHaveBeenCalledTimes(3)
  for (const call of fetchMock.mock.calls as any[]) {
    expect(call[0]).toContain('source_task_id=current-task')
    expect(call[0]).toContain('history_scope=property')
  }
})
