import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { Alert, AppState, Share, StyleSheet } from 'react-native'
import { getMyPersonnelClaim, getMyPersonnelSettlement, getMyPersonnelSettlementSubmissionPreview, listMyPersonnelClaims, listMyPersonnelSettlements } from '../../lib/api'
import PersonnelSettlementScreen, {
  buildPersonnelCalendarMonth,
  formatPersonnelDuration,
  formatPersonnelDate,
  formatPersonnelDateWithWeekday,
  groupPersonnelClaimsByDate,
  normalizePersonnelTimeWheelMinute,
  personnelTimeWheelIndexFromOffset,
  rebasePersonnelServiceTime,
  selectCurrentSettlementDocuments,
  summarizePersonnelSettlementLinesByDate,
  unincludedSubmissionClaims,
} from './PersonnelSettlementScreen'

let mockFocusCallback: (() => void | (() => void)) | null = null
let mockFocusCleanup: (() => void) | void
let mockAppStateChangeListener: ((nextState: string) => void) | null = null
const mockNavigationSetOptions = jest.fn()

function renderPersonnelSettlementScreen() {
  return render(<PersonnelSettlementScreen navigation={{ setOptions: mockNavigationSetOptions }} />)
}

function openClaimForm() {
  const latestOptions = [...mockNavigationSetOptions.mock.calls]
    .reverse()
    .map(([options]) => options)
    .find((options) => typeof options?.headerRight === 'function')
  if (!latestOptions) throw new Error('工作量反馈新增入口未注册到页面右上角')
  act(() => {
    latestOptions.headerRight().props.onPress()
  })
}

jest.mock('@react-navigation/native', () => {
  // Jest must load React inside the hoisted mock factory.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react')
  return {
    useFocusEffect: (callback: () => void | (() => void)) => {
      React.useEffect(() => {
        mockFocusCallback = callback
        mockFocusCleanup = callback()
        return () => {
          mockFocusCleanup?.()
          mockFocusCallback = null
          mockFocusCleanup = undefined
        }
      }, [callback])
    },
  }
})

jest.mock('react-native-webview', () => {
  const { View } = require('react-native')
  return { WebView: View }
})

jest.mock('expo-image-picker', () => ({
  MediaTypeOptions: { Images: 'Images' },
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(async () => ({ canceled: false, assets: [{ uri: 'file:///proof.jpg', fileName: 'proof.jpg', mimeType: 'image/jpeg' }] })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: false, assets: [{ uri: 'file:///proof.jpg', fileName: 'proof.jpg', mimeType: 'image/jpeg' }] })),
}))

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native')
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 59, right: 0, bottom: 34, left: 0 }),
  }
})

const mockConfirm = jest.fn(async (_token?: string, _settlementId?: string) => ({
  id: 'settlement-1',
  week_start: '2026-09-07',
  week_end: '2026-09-13',
  status: 'confirmed',
  subtotal_cents: 10000,
  gst_cents: 1000,
  total_cents: 11000,
  currency: 'AUD',
  line_count: 1,
  evidence_count: 1,
  lines: [],
}))
const mockDownloadDocument = jest.fn(async (_token?: string, _settlementId?: string, _document?: any) => 'file:///settlement.pdf')
const mockCreateClaim = jest.fn(async (_token?: string, payload?: any) => ({ id: payload?.client_request_id || 'claim-1', status: 'draft' }))
const mockUploadEvidence = jest.fn(async (_token?: string, _claimId?: string, _mediaId?: string, _file?: any) => ({ id: 'evidence-1' }))
const mockSubmitClaim = jest.fn(async (_token?: string, _claimId?: string) => ({ id: 'claim-1', status: 'submitted' }))
const mockGetClaimOptions = jest.fn(async (_token?: string, serviceDate?: string) => ({
  service_date: serviceDate || '2026-09-13',
  rule_id: 'rule-1',
  rule_name: 'Cleaner rule',
  options: [
    { business_type: 'warehouse', claim_type: 'warehouse_hour', label: '仓管工作', calculation_label: '可先反馈，公司核对时确认计算方式', input_mode: 'time_range', evidence_required: true, property_required: false, rule_configured: false },
    { business_type: 'overtime', claim_type: 'overtime_hour', label: '加班', calculation_label: '可先反馈，公司核对时确认计算方式', input_mode: 'time_range', evidence_required: true, property_required: false, rule_configured: false },
    { business_type: 'subsidy', claim_type: 'subsidy_amount', label: '补贴', calculation_label: '可先反馈，公司核对时确认计算方式', input_mode: 'amount', evidence_required: true, property_required: false, rule_configured: false },
    { business_type: 'new_property', claim_type: 'new_property_task', label: '上新房', calculation_label: '可先反馈，公司核对时确认计算方式', input_mode: 'time_range', evidence_required: false, property_required: true, rule_configured: false },
    { business_type: 'external', claim_type: 'external_task', label: '编外合作', calculation_label: '可先反馈，公司核对时确认计算方式', input_mode: 'quantity', evidence_required: true, property_required: false, rule_configured: false },
    { business_type: 'custom', claim_type: 'custom_amount', label: '其他费用', calculation_label: '可先反馈，公司核对时确认计算方式', input_mode: 'amount', evidence_required: true, property_required: false, rule_configured: false },
  ],
}))
const mockGetClaimEstimate = jest.fn(async (_token?: string, _params?: any) => ({
  available: true,
  reason: null,
  rule_id: 'rule-1',
  rule_name: 'Cleaner rule',
  effective_from: '2026-09-01',
  price_basis: 'inclusive_gst',
  unit_rate_cents: 3500,
  gst_status: 'registered',
  quantity_numerator: 70,
  quantity_denominator: 60,
  subtotal_cents: 3712,
  gst_cents: 371,
  total_cents: 4083,
}))
const mockSubmitForReconciliation = jest.fn(async (_token?: string, _settlementId?: string, _claimId?: string, _reason?: string) => ({
  id: 'settlement-1', week_start: '2026-09-07', week_end: '2026-09-13', status: 'disputed',
  subtotal_cents: 10000, gst_cents: 1000, total_cents: 11000, currency: 'AUD', line_count: 1, evidence_count: 1,
  profile_snapshot: { gst_status: 'registered' }, lines: [], documents: [],
}))
const mockDispute = jest.fn(async (_token?: string, _settlementId?: string, _reason?: string) => ({
  id: 'settlement-1', week_start: '2026-09-07', week_end: '2026-09-13', status: 'disputed',
  subtotal_cents: 10000, gst_cents: 1000, total_cents: 11000, currency: 'AUD', line_count: 1, evidence_count: 1,
  profile_snapshot: { gst_status: 'registered' }, lines: [], documents: [],
}))
const mockSubmitSettlementWeek = jest.fn(async (_token?: string, _weekStart?: string, _confirmationToken?: string) => ({
  id: 'settlement-1', week_start: '2026-09-07', week_end: '2026-09-13', status: 'confirmed',
  subtotal_cents: 10000, gst_cents: 1000, total_cents: 11000, currency: 'AUD', line_count: 1, evidence_count: 1,
}))
const mockAddDraftPhoto = jest.fn(async (_userId: string, draft: any, _file?: any, _scope?: string) => ({
  ...draft,
  media: [...draft.media, {
    media_id: 'media-1', local_uri: 'file:///proof.jpg', name: 'proof.jpg', mime_type: 'image/jpeg', state: 'local_only',
  }],
}))

jest.mock('../../lib/auth', () => ({
  useAuth: () => ({ token: 'token-1', user: { id: 'cleaner-1', username: 'Cleaner One', role: 'cleaner' } }),
}))

jest.mock('../../lib/personnelClaimDraft', () => {
  const actual = jest.requireActual('../../lib/personnelClaimDraft')
  return {
    ...actual,
    loadPersonnelClaimDraft: jest.fn(async () => null),
    savePersonnelClaimDraft: jest.fn(async (_userId: string, draft: any) => draft),
    clearPersonnelClaimDraft: jest.fn(async () => undefined),
    addPersonnelClaimDraftPhoto: (userId: string, draft: any, file: any, scope?: string) => mockAddDraftPhoto(userId, draft, file, scope),
    personnelClaimDraftMissingMedia: jest.fn(() => []),
  }
})

jest.mock('../../lib/api', () => ({
  getMyPersonnelClaimOptions: (token: string, serviceDate: string) => mockGetClaimOptions(token, serviceDate),
  getMyPersonnelClaimEstimate: (token: string, params: any) => mockGetClaimEstimate(token, params),
  listMyPersonnelClaims: jest.fn(async () => []),
  listMyPersonnelSettlements: jest.fn(async () => [{
    id: 'settlement-1',
    week_start: '2026-09-07',
    week_end: '2026-09-13',
    status: 'awaiting_confirmation',
    subtotal_cents: 10000,
    gst_cents: 1000,
    total_cents: 11000,
    currency: 'AUD',
    line_count: 3,
    evidence_count: 1,
  }]),
  getMyPersonnelSettlementSubmissionPreview: jest.fn(async () => ({
    week_start: '2026-09-07', week_end: '2026-09-13', status: 'awaiting_confirmation',
    settlement: null, subtotal_cents: 10000, gst_cents: 1000, total_cents: 11000, line_count: 3,
    lines: [], blocking_issues: [], confirmation_token: 'b'.repeat(64),
  })),
  submitMyPersonnelSettlementWeek: (token: string, weekStart: string, confirmationToken: string) => mockSubmitSettlementWeek(token, weekStart, confirmationToken),
  getMyPersonnelSettlement: jest.fn(async () => ({
    id: 'settlement-1',
    week_start: '2026-09-07',
    week_end: '2026-09-13',
    status: 'awaiting_confirmation',
    subtotal_cents: 10000,
    gst_cents: 1000,
    total_cents: 11000,
    currency: 'AUD',
    line_count: 1,
    evidence_count: 1,
    profile_snapshot: { gst_status: 'registered' },
    phase5_schema_ready: true,
    documents: [{
      id: 'document-3', settlement_id: 'settlement-1', document_stage: 'awaiting_confirmation',
      document_kind: 'settlement_draft', document_label: '费用结算草稿', version: 3,
      invoice_number: null, mime_type: 'application/pdf', byte_size: 100,
      generated_at: '2026-09-16T00:05:00.000Z', file_name: 'settlement-draft-v3.pdf',
    }, {
      id: 'document-2', settlement_id: 'settlement-1', document_stage: 'awaiting_confirmation',
      document_kind: 'settlement_draft', document_label: '费用结算草稿', version: 2,
      invoice_number: null, mime_type: 'application/pdf', byte_size: 100,
      generated_at: '2026-09-15T00:05:00.000Z', file_name: 'settlement-draft-v2.pdf',
    }],
    lines: [
      {
        id: 'line-cleaning-1', component_type: 'cleaning_task', service_date: '2026-09-10',
        description: 'Cleaning · FG1003 · 两房两卫', quantity_numerator: 1, quantity_denominator: 1,
        unit_rate_cents: 4000, subtotal_cents: 4000, gst_cents: 400, total_cents: 4400,
        source_type: 'cleaning_task_assignment', source_id: 'task-1', price_basis: 'exclusive_gst', evidence_count: 0,
      },
      {
        id: 'line-cleaning-2', component_type: 'cleaning_task', service_date: '2026-09-10',
        description: 'Cleaning · OP814 · 两房两卫', quantity_numerator: 1, quantity_denominator: 1,
        unit_rate_cents: 4000, subtotal_cents: 4000, gst_cents: 400, total_cents: 4400,
        source_type: 'cleaning_task_assignment', source_id: 'task-2', price_basis: 'exclusive_gst', evidence_count: 0,
      },
      {
        id: 'line-1', component_type: 'subsidy_amount', service_date: '2026-09-10',
        description: 'Travel subsidy', quantity_numerator: 1, quantity_denominator: 1,
        unit_rate_cents: 2000, subtotal_cents: 2000, gst_cents: 200, total_cents: 2200,
        source_type: 'workload_claim', source_id: 'included-claim', price_basis: 'exclusive_gst', evidence_count: 1,
      },
    ],
  })),
  confirmMyPersonnelSettlement: (token: string, settlementId: string) => mockConfirm(token, settlementId),
  disputeMyPersonnelSettlement: (token: string, settlementId: string, reason: string) => mockDispute(token, settlementId, reason),
  createMyPersonnelClaim: (token: string, payload: any) => mockCreateClaim(token, payload),
  updateMyPersonnelClaim: jest.fn(),
  uploadMyPersonnelClaimEvidence: (token: string, claimId: string, mediaId: string, file: any) => mockUploadEvidence(token, claimId, mediaId, file),
  submitMyPersonnelClaim: (token: string, claimId: string) => mockSubmitClaim(token, claimId),
  submitMyPersonnelSettlementClaimForReconciliation: (token: string, settlementId: string, claimId: string, reason: string) => mockSubmitForReconciliation(token, settlementId, claimId, reason),
  getMyPersonnelClaim: jest.fn(),
  downloadMyPersonnelSettlementDocument: (token: string, settlementId: string, document: any) => mockDownloadDocument(token, settlementId, document),
}))

beforeEach(async () => {
  jest.restoreAllMocks()
  jest.clearAllMocks()
  mockFocusCallback = null
  mockFocusCleanup = undefined
  mockAppStateChangeListener = null
  mockNavigationSetOptions.mockClear()
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener: any) => {
    mockAppStateChangeListener = listener
    return {
      remove: jest.fn(() => {
        if (mockAppStateChangeListener === listener) mockAppStateChangeListener = null
      }),
    }
  })
  const storage = require('@react-native-async-storage/async-storage')
  await storage.clear()
})

test('周结算明细按日期合并清洁房号、其他费用和金额', () => {
  expect(personnelTimeWheelIndexFromOffset(44 * 10, 24)).toBe(10)
  expect(personnelTimeWheelIndexFromOffset(-20, 24)).toBe(0)
  expect(normalizePersonnelTimeWheelMinute(3)).toBe(5)
  expect(normalizePersonnelTimeWheelMinute(58)).toBe(55)
  expect(formatPersonnelDate('2026-08-23')).toBe('23/08/2026')
  expect(formatPersonnelDate('2026-02-30')).toBe('--')
  const calendar = buildPersonnelCalendarMonth(2026, 9, '2026-09-11', '2026-09-11')
  expect(calendar).toHaveLength(42)
  expect(calendar[0]).toEqual(expect.objectContaining({ ymd: '2026-08-31', inMonth: false }))
  expect(calendar.find((day) => day.ymd === '2026-09-11')).toEqual(expect.objectContaining({ isToday: true, isSelected: true }))
  const rows = summarizePersonnelSettlementLinesByDate([
    { id: '1', component_type: 'cleaning_task', service_date: '2026-09-10', description: 'Cleaning · FG1003 · 两房两卫', quantity_numerator: 1, quantity_denominator: 1, unit_rate_cents: 4000, subtotal_cents: 4000, gst_cents: 400, total_cents: 4400, evidence_count: 0 },
    { id: '2', component_type: 'cleaning_task', service_date: '2026-09-10', description: 'Cleaning · OP814 · 两房两卫', quantity_numerator: 1, quantity_denominator: 1, unit_rate_cents: 4000, subtotal_cents: 4000, gst_cents: 400, total_cents: 4400, evidence_count: 0 },
    { id: '3', component_type: 'subsidy_amount', service_date: '2026-09-10', description: 'Travel subsidy', quantity_numerator: 1, quantity_denominator: 1, unit_rate_cents: 2000, subtotal_cents: 2000, gst_cents: 200, total_cents: 2200, evidence_count: 1 },
  ])
  expect(rows).toEqual([expect.objectContaining({
    service_date: '2026-09-10',
    description: 'Cleaning - FG1003 / OP814; Subsidy - Travel subsidy',
    subtotal_cents: 10000,
    gst_cents: 1000,
    total_cents: 11000,
    evidence_count: 1,
  })])
})

test('工作时长使用小时和分钟显示且不暴露浮点小数', () => {
  expect(formatPersonnelDuration(370)).toBe('6 小时 10 分钟')
  expect(formatPersonnelDuration(360)).toBe('6 小时')
  expect(formatPersonnelDuration(40)).toBe('40 分钟')
  expect(formatPersonnelDuration(0)).toBe('--')
  expect(formatPersonnelDuration(Number.NaN)).toBe('--')
  expect(formatPersonnelDateWithWeekday('2026-09-14')).toBe('14/09/2026  周一')
  const rebasedTime = rebasePersonnelServiceTime(new Date(2026, 8, 14, 9, 35).toISOString(), '2026-09-10')
  expect(new Date(rebasedTime).getFullYear()).toBe(2026)
  expect(new Date(rebasedTime).getMonth()).toBe(8)
  expect(new Date(rebasedTime).getDate()).toBe(10)
  expect(new Date(rebasedTime).getHours()).toBe(9)
  expect(new Date(rebasedTime).getMinutes()).toBe(35)
  expect(rebasePersonnelServiceTime('', '2026-09-10')).toBe('')
  expect(groupPersonnelClaimsByDate([
    { id: 'older', service_date: '2026-09-06' },
    { id: 'latest-a', service_date: '2026-09-14' },
    { id: 'latest-b', service_date: '2026-09-14' },
  ] as any)).toEqual([
    expect.objectContaining({ service_date: '2026-09-14', claims: [expect.objectContaining({ id: 'latest-a' }), expect.objectContaining({ id: 'latest-b' })] }),
    expect.objectContaining({ service_date: '2026-09-06', claims: [expect.objectContaining({ id: 'older' })] }),
  ])
})

test('周提交核对只把未进入权威明细的有效反馈列为待处理', () => {
  const preview = {
    week_start: '2026-09-07', week_end: '2026-09-13', status: 'not_submitted', settlement: null,
    subtotal_cents: 3182, gst_cents: 318, total_cents: 3500, line_count: 1,
    confirmation_token: 'a'.repeat(64), blocking_issues: [],
    lines: [{ source_type: 'workload_claim', source_id: 'included', id: 'included-line' }],
  } as any
  expect(unincludedSubmissionClaims(preview, [
    { id: 'included', status: 'approved', service_date: '2026-09-10' },
    { id: 'pending', status: 'submitted', service_date: '2026-09-11' },
    { id: 'returned', status: 'returned', service_date: '2026-09-12' },
    { id: 'rejected', status: 'rejected', service_date: '2026-09-12' },
    { id: 'outside', status: 'submitted', service_date: '2026-09-14' },
  ] as any)).toEqual([
    expect.objectContaining({ id: 'pending' }),
    expect.objectContaining({ id: 'returned' }),
  ])
})

test('工作量反馈默认按工作日期紧凑分组且整行打开详情', async () => {
  const rows = [
    {
      id: 'claim-latest-a', status: 'submitted', service_date: '2026-09-14', claim_type: 'warehouse_hour',
      duration_minutes: 70, requested_amount_cents: 4083, note: '送 WSP 床品', evidence_count: 1,
    },
    {
      id: 'claim-latest-b', status: 'approved', service_date: '2026-09-14', claim_type: 'subsidy_amount',
      requested_amount_cents: 3500, approved_amount_cents: 3500, note: '雨补', evidence_count: 1,
    },
    {
      id: 'claim-older', status: 'approved', service_date: '2026-09-06', claim_type: 'new_property_task',
      requested_quantity: '1', note: '上新房', evidence_count: 0,
    },
  ] as any[]
  ;(listMyPersonnelClaims as jest.Mock).mockResolvedValueOnce(rows)
  ;(getMyPersonnelClaim as jest.Mock).mockResolvedValueOnce(rows[0])

  const ui = renderPersonnelSettlementScreen()
  await waitFor(() => expect(ui.getByTestId('claim-date-group-2026-09-14')).toBeTruthy())

  expect(ui.getByText('共 3 条反馈')).toBeTruthy()
  expect(ui.getByText('· 1 条待核对')).toBeTruthy()
  expect(ui.getByText('14/09/2026  周一')).toBeTruthy()
  expect(ui.getByText('2 条')).toBeTruthy()
  expect(ui.getByText('1 小时 10 分钟 · $40.83 · 证明 1 张')).toBeTruthy()
  expect(ui.queryByText('查看详情')).toBeNull()
  expect(ui.queryByTestId('claim-service-date')).toBeNull()

  fireEvent.press(ui.getByTestId('claim-row-claim-latest-a'))
  await waitFor(() => expect(getMyPersonnelClaim).toHaveBeenCalledWith('token-1', 'claim-latest-a'))
  await waitFor(() => expect(ui.getByText('工作量反馈详情')).toBeTruthy())
  await waitFor(() => expect(mockGetClaimEstimate).toHaveBeenCalledWith('token-1', {
    service_date: '2026-09-14',
    claim_type: 'warehouse_hour',
    duration_minutes: 70,
  }))
  await waitFor(() => expect(ui.getByTestId('claim-detail-estimate-card')).toBeTruthy())
  expect(ui.getByTestId('claim-detail-estimate-rate').props.children).toBe('$35.00 / 小时 · 已含 GST')
  expect(ui.getByTestId('claim-detail-estimate-total').props.children).toBe('$40.83')
  expect(ui.getByTestId('claim-detail-estimate-gst').props.children).toEqual(['其中 GST ', '$3.71'])
})

test('草稿或需补充资料的反馈从详情继续修改', async () => {
  const returnedClaim = {
    id: 'claim-returned', status: 'returned', service_date: '2026-09-12', claim_type: 'warehouse_hour',
    duration_minutes: 60, note: '补充工作说明', review_note: '请补充送达位置', evidence_count: 1,
  } as any
  ;(listMyPersonnelClaims as jest.Mock).mockResolvedValueOnce([returnedClaim])
  ;(getMyPersonnelClaim as jest.Mock).mockResolvedValueOnce(returnedClaim)

  const ui = renderPersonnelSettlementScreen()
  await waitFor(() => expect(ui.getByTestId('claim-row-claim-returned')).toBeTruthy())
  fireEvent.press(ui.getByTestId('claim-row-claim-returned'))
  await waitFor(() => expect(ui.getByTestId('claim-detail-edit')).toBeTruthy())
  fireEvent.press(ui.getByTestId('claim-detail-edit'))
  await waitFor(() => expect(ui.getByText('修改工作量反馈')).toBeTruthy())
  expect(ui.getByTestId('claim-form-header')).toBeTruthy()
})

test('页面聚焦和回前台刷新结算状态且十秒内不会重复读取', async () => {
  const ui = renderPersonnelSettlementScreen()
  await waitFor(() => expect(listMyPersonnelClaims).toHaveBeenCalledTimes(1))
  expect(listMyPersonnelSettlements).toHaveBeenCalledTimes(1)

  const baseline = Date.now()
  const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(baseline + 1_000)

  await act(async () => {
    mockFocusCleanup?.()
    mockFocusCleanup = mockFocusCallback?.()
    mockAppStateChangeListener?.('active')
    await Promise.resolve()
  })
  expect(listMyPersonnelClaims).toHaveBeenCalledTimes(1)
  expect(listMyPersonnelSettlements).toHaveBeenCalledTimes(1)

  nowSpy.mockReturnValue(baseline + 11_000)
  await act(async () => {
    mockFocusCleanup?.()
    mockFocusCleanup = mockFocusCallback?.()
    await Promise.resolve()
    await Promise.resolve()
  })
  expect(listMyPersonnelClaims).toHaveBeenCalledTimes(2)
  expect(listMyPersonnelSettlements).toHaveBeenCalledTimes(2)

  nowSpy.mockReturnValue(baseline + 22_000)
  await act(async () => {
    mockAppStateChangeListener?.('active')
    await Promise.resolve()
    await Promise.resolve()
  })
  expect(listMyPersonnelClaims).toHaveBeenCalledTimes(3)
  expect(listMyPersonnelSettlements).toHaveBeenCalledTimes(3)

  ui.unmount()
})

test('两步核对期间预览变化会退回明细并要求重新确认', async () => {
  const previewA = {
    week_start: '2026-09-07', week_end: '2026-09-13', status: 'not_submitted', settlement: null,
    subtotal_cents: 3182, gst_cents: 318, total_cents: 3500, line_count: 1,
    confirmation_token: 'a'.repeat(64), blocking_issues: [],
    lines: [{
      id: 'line-a', component_type: 'warehouse_hour', service_date: '2026-09-10',
      description: 'Warehouse · 1 小时', quantity_numerator: 60, quantity_denominator: 60,
      unit_rate_cents: 3500, subtotal_cents: 3182, gst_cents: 318, total_cents: 3500,
      source_type: 'workload_claim', source_id: 'claim-a', price_basis: 'inclusive_gst', evidence_count: 1,
    }],
  }
  const previewB = {
    ...previewA,
    subtotal_cents: 6364,
    gst_cents: 636,
    total_cents: 7000,
    line_count: 2,
    confirmation_token: 'b'.repeat(64),
    lines: [{
      ...previewA.lines[0],
      id: 'line-b',
      description: 'Warehouse · 2 小时',
      quantity_numerator: 120,
      subtotal_cents: 6364,
      gst_cents: 636,
      total_cents: 7000,
    }],
  }
  ;(getMyPersonnelSettlementSubmissionPreview as jest.Mock)
    .mockResolvedValueOnce(previewA)
    .mockResolvedValueOnce(previewB)

  const ui = renderPersonnelSettlementScreen()
  fireEvent.press(ui.getByTestId('personnel-settlements-tab'))
  await waitFor(() => expect(ui.getByTestId('weekly-submission-preview')).toBeTruthy())
  fireEvent.press(ui.getByTestId('weekly-submission-review'))
  fireEvent.press(ui.getByTestId('weekly-submission-next'))
  fireEvent.press(ui.getByTestId('weekly-submission-acknowledgement'))
  expect(ui.getByTestId('weekly-submission-submit').props.accessibilityState.disabled).toBe(false)

  const baseline = Date.now()
  const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(baseline + 11_000)
  await act(async () => {
    mockAppStateChangeListener?.('active')
    await Promise.resolve()
    await Promise.resolve()
  })

  await waitFor(() => expect(ui.getByTestId('weekly-submission-review-detail')).toBeTruthy())
  expect(ui.getByText('Warehouse · 2 小时')).toBeTruthy()
  expect(ui.queryByTestId('weekly-submission-submit')).toBeNull()
  expect(mockSubmitSettlementWeek).not.toHaveBeenCalled()

  fireEvent.press(ui.getByTestId('weekly-submission-next'))
  expect(ui.getByTestId('weekly-submission-submit').props.accessibilityState.disabled).toBe(true)
  fireEvent.press(ui.getByTestId('weekly-submission-acknowledgement'))
  fireEvent.press(ui.getByTestId('weekly-submission-submit'))
  await waitFor(() => expect(mockSubmitSettlementWeek).toHaveBeenCalledWith('token-1', '2026-09-07', 'b'.repeat(64)))
  nowSpy.mockRestore()
  ui.unmount()
})

test('周提交预览失败不会阻断工作量反馈，并可在周结算页单独重试', async () => {
  const claim = {
    id: 'claim-visible', status: 'submitted', service_date: '2026-09-14', claim_type: 'warehouse_hour',
    duration_minutes: 50, note: 'MSQ送床品', evidence_count: 1,
  } as any
  ;(listMyPersonnelClaims as jest.Mock).mockResolvedValueOnce([claim])
  ;(getMyPersonnelSettlementSubmissionPreview as jest.Mock).mockRejectedValueOnce(
    new Error('参数错误：invalid_weekly_submission_preview'),
  )
  const alertSpy = jest.spyOn(Alert, 'alert')

  const ui = renderPersonnelSettlementScreen()
  await waitFor(() => expect(ui.getByTestId('claim-row-claim-visible')).toBeTruthy())
  expect(alertSpy).not.toHaveBeenCalledWith(
    '加载失败',
    expect.stringContaining('invalid_weekly_submission_preview'),
  )

  fireEvent.press(ui.getByTestId('personnel-settlements-tab'))
  await waitFor(() => expect(ui.getByTestId('weekly-submission-preview-error')).toBeTruthy())
  expect(ui.getByText('上一完整周暂时无法预览，请稍后重试。')).toBeTruthy()

  fireEvent.press(ui.getByTestId('weekly-submission-preview-retry'))
  await waitFor(() => expect(getMyPersonnelSettlementSubmissionPreview).toHaveBeenCalledTimes(2))
  await waitFor(() => expect(ui.queryByTestId('weekly-submission-preview-error')).toBeNull())
})

test('移动端显示费用反馈入口并以工作量及金额正确作为确认口径', async () => {
  const ui = renderPersonnelSettlementScreen()
  await waitFor(() => expect(ui.getByText('暂无工作量反馈')).toBeTruthy())
  expect(ui.getByText('共 0 条反馈')).toBeTruthy()
  expect(ui.queryByTestId('claim-service-date')).toBeNull()
  openClaimForm()
  await waitFor(() => expect(ui.getByText('新增工作量反馈')).toBeTruthy())
  await waitFor(() => expect(ui.getByText('上新房')).toBeTruthy())
  expect(ui.queryByText(/试工/)).toBeNull()
  expect(ui.getByText(/网络中断时不会丢失/)).toBeTruthy()
  fireEvent.press(ui.getByTestId('claim-service-date'))
  await waitFor(() => expect(ui.getByTestId('claim-date-picker')).toBeTruthy())
  const now = new Date()
  const targetDate = new Date(now.getFullYear(), now.getMonth() - 1, 23)
  const targetYmd = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-23`
  fireEvent.press(ui.getByTestId('claim-date-picker-previous-month'))
  expect(ui.getByTestId('claim-date-picker-month-label').props.children).toEqual([
    targetDate.getFullYear(),
    '年',
    targetDate.getMonth() + 1,
    '月',
  ])
  fireEvent.press(ui.getByTestId(`claim-date-picker-date-${targetYmd}`))
  fireEvent.press(ui.getByTestId('claim-date-picker-confirm'))
  expect(ui.getByTestId('claim-service-date-value').props.children).toBe(formatPersonnelDate(targetYmd))
  expect(ui.queryByTestId('claim-date-picker')).toBeNull()

  fireEvent.press(ui.getByTestId('personnel-settlements-tab'))
  await waitFor(() => expect(ui.getByText('查看并再次确认')).toBeTruthy())
  const getSettlement = getMyPersonnelSettlement as jest.Mock
  const defaultGetSettlement = getSettlement.getMockImplementation()!
  let resolveSettlementDetail: (value: any) => void = () => undefined
  getSettlement.mockImplementationOnce(() => new Promise((resolve) => {
    resolveSettlementDetail = resolve
  }))
  fireEvent.press(ui.getByText('查看并再次确认'))
  expect(ui.getByTestId('settlement-detail-header')).toBeTruthy()
  expect(ui.getByTestId('settlement-detail-loading')).toBeTruthy()
  expect(ui.getByText('正在加载结算明细…')).toBeTruthy()
  expect(ui.queryByTestId('settlement-confirm')).toBeNull()
  await act(async () => {
    resolveSettlementDetail(await defaultGetSettlement('token-1', 'settlement-1'))
  })
  await waitFor(() => expect(ui.getByTestId('settlement-confirm')).toBeTruthy())
  expect(ui.getByText('确认并重新提交')).toBeTruthy()
  expect(ui.queryByText('提交异议给财务')).toBeNull()
  expect(ui.getByText('Cleaning - FG1003 / OP814; Subsidy - Travel subsidy')).toBeTruthy()
  expect(ui.getByText('费用结算草稿 · v3')).toBeTruthy()
  expect(ui.queryByText('费用结算草稿 · v2')).toBeNull()
  expect(ui.getByTestId('settlement-day-2026-09-10')).toBeTruthy()
  expect(StyleSheet.flatten(ui.getByTestId('settlement-detail-header').props.style).paddingTop).toBe(59)
  fireEvent.press(ui.getByTestId('settlement-detail-close'))
  await waitFor(() => expect(ui.queryByTestId('settlement-confirm')).toBeNull())

  fireEvent.press(ui.getByText('查看并再次确认'))
  await waitFor(() => expect(ui.getByTestId('settlement-confirm')).toBeTruthy())
  const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction })
  fireEvent.press(ui.getByText('查看 PDF'))
  await waitFor(() => expect(mockDownloadDocument).toHaveBeenCalledWith(
    'token-1',
    'settlement-1',
    expect.objectContaining({ id: 'document-3' }),
  ))
  expect(shareSpy).not.toHaveBeenCalled()
  await waitFor(() => expect(ui.getByTestId('settlement-pdf-viewer').props.source).toEqual({ uri: 'file:///settlement.pdf' }))
  expect(ui.getByTestId('settlement-detail-header')).toBeTruthy()
  expect(ui.getByTestId('settlement-pdf-sheet')).toBeTruthy()
  expect(ui.getByLabelText('分享 PDF')).toBeTruthy()
  expect(ui.queryByText('分享')).toBeNull()
  fireEvent.press(ui.getByTestId('settlement-pdf-share'))
  expect(shareSpy).toHaveBeenCalledWith(expect.objectContaining({ url: 'file:///settlement.pdf' }))
  fireEvent.press(ui.getByTestId('settlement-pdf-close'))
  await waitFor(() => expect(ui.queryByTestId('settlement-pdf-viewer')).toBeNull())
  shareSpy.mockRestore()
  fireEvent.press(ui.getByTestId('settlement-confirm'))
  await waitFor(() => expect(mockConfirm).toHaveBeenCalledWith('token-1', 'settlement-1'))
})

test('上一完整周必须先核对明细并二次确认才提交给财务', async () => {
  ;(listMyPersonnelClaims as jest.Mock).mockResolvedValueOnce([{
    id: 'pending-subsidy', status: 'submitted', service_date: '2026-09-11', claim_type: 'subsidy_amount',
    requested_amount_cents: 1000, note: '交通补贴', evidence_count: 1,
  }])
  ;(listMyPersonnelSettlements as jest.Mock).mockResolvedValueOnce([])
  ;(getMyPersonnelSettlementSubmissionPreview as jest.Mock).mockResolvedValueOnce({
    week_start: '2026-09-07', week_end: '2026-09-13', status: 'not_submitted', settlement: null,
    subtotal_cents: 3182, gst_cents: 318, total_cents: 3500, line_count: 1,
    confirmation_token: 'a'.repeat(64),
    blocking_issues: [],
    lines: [{
      id: 'cleaning_task_assignment:task-1:cleaning_task', component_type: 'cleaning_task',
      service_date: '2026-09-10', source_type: 'cleaning_task_assignment', source_id: 'task-1',
      description: 'Cleaning · FG1003 · 一房一卫', quantity_numerator: 1, quantity_denominator: 1,
      unit_rate_cents: 3500, subtotal_cents: 3182, gst_cents: 318, total_cents: 3500,
      price_basis: 'inclusive_gst', evidence_count: 0,
    }],
  })
  const ui = renderPersonnelSettlementScreen()
  await waitFor(() => expect(ui.getByText('交通补贴')).toBeTruthy())
  fireEvent.press(ui.getByTestId('personnel-settlements-tab'))
  await waitFor(() => expect(ui.getByTestId('weekly-submission-preview')).toBeTruthy())
  expect(ui.getByText('查看明细并核对')).toBeTruthy()
  expect(ui.queryByTestId('weekly-submission-submit')).toBeNull()

  fireEvent.press(ui.getByTestId('weekly-submission-review'))
  expect(ui.getByTestId('weekly-submission-review-detail')).toBeTruthy()
  expect(ui.getByText('Cleaning - FG1003')).toBeTruthy()
  expect(ui.getByTestId('weekly-submission-unincluded-claims')).toBeTruthy()
  expect(ui.getByText('尚未计入预计总额')).toBeTruthy()
  expect(mockSubmitSettlementWeek).not.toHaveBeenCalled()

  fireEvent.press(ui.getByTestId('weekly-submission-next'))
  expect(ui.getByTestId('weekly-submission-submit').props.accessibilityState.disabled).toBe(true)
  fireEvent.press(ui.getByTestId('weekly-submission-acknowledgement'))
  fireEvent.press(ui.getByTestId('weekly-submission-submit'))
  await waitFor(() => expect(mockSubmitSettlementWeek).toHaveBeenCalledWith('token-1', '2026-09-07', 'a'.repeat(64)))
  ui.unmount()
})

test('没有对应费用规则时仍可主动选择业务类型，上新房按时间且无需照片即可提交', async () => {
  const ui = renderPersonnelSettlementScreen()
  await waitFor(() => expect(mockGetClaimOptions).toHaveBeenCalled())
  openClaimForm()

  expect(ui.getByText(/未配置规则也可以先提交/)).toBeTruthy()
  expect(ui.getByText('可先反馈，公司核对时确认计算方式')).toBeTruthy()
  expect(ui.getAllByText('编外合作')).toHaveLength(1)
  expect(ui.queryByText(/试工/)).toBeNull()
  expect(ui.getByTestId('claim-amount')).toBeTruthy()
  expect(ui.queryByTestId('claim-quantity')).toBeNull()
  expect(ui.queryByTestId('claim-start-time')).toBeNull()

  fireEvent.press(ui.getByTestId('claim-type-warehouse'))
  await waitFor(() => expect(ui.getByTestId('claim-start-time')).toBeTruthy())
  expect(ui.getByTestId('claim-end-time')).toBeTruthy()
  expect(ui.queryByTestId('claim-amount')).toBeNull()
  fireEvent.press(ui.getByTestId('claim-start-time'))
  await waitFor(() => expect(ui.getByTestId('claim-time-picker')).toBeTruthy())
  expect(StyleSheet.flatten(ui.getByTestId('claim-time-picker-hour-wheel').props.style).height).toBe(132)
  fireEvent(ui.getByTestId('claim-time-picker-hour-wheel'), 'momentumScrollEnd', { nativeEvent: { contentOffset: { y: 44 * 10 } } })
  fireEvent(ui.getByTestId('claim-time-picker-minute-wheel'), 'momentumScrollEnd', { nativeEvent: { contentOffset: { y: 44 } } })
  expect(ui.getByTestId('claim-time-picker-selected-value').props.children).toEqual(['10', ':', '05'])
  fireEvent.press(ui.getByTestId('claim-time-picker-confirm'))
  expect(ui.getByTestId('claim-start-time-value').props.children).toBe('10:05')

  fireEvent.press(ui.getByTestId('claim-end-time'))
  fireEvent(ui.getByTestId('claim-time-picker-hour-wheel'), 'momentumScrollEnd', { nativeEvent: { contentOffset: { y: 44 * 16 } } })
  fireEvent(ui.getByTestId('claim-time-picker-minute-wheel'), 'momentumScrollEnd', { nativeEvent: { contentOffset: { y: 44 * 3 } } })
  fireEvent.press(ui.getByTestId('claim-time-picker-confirm'))
  expect(ui.getByTestId('claim-end-time-value').props.children).toBe('16:15')
  expect(ui.getByTestId('claim-duration-summary').props.children).toEqual(['工作时长：', '6 小时 10 分钟'])

  fireEvent.press(ui.getByTestId('claim-type-new_property'))
  expect(ui.getByTestId('claim-property')).toBeTruthy()
  expect(ui.queryByTestId('claim-quantity')).toBeNull()
  expect(ui.getByTestId('claim-start-time-value').props.children).toBe('10:05')
  expect(ui.getByTestId('claim-end-time-value').props.children).toBe('16:15')
  expect(ui.getByTestId('claim-duration-summary').props.children).toEqual(['工作时长：', '6 小时 10 分钟'])
  expect(ui.getByText(/照片或截图证明（选填）/)).toBeTruthy()
  fireEvent.changeText(ui.getByTestId('claim-property'), 'FG1003')
  fireEvent.changeText(ui.getByTestId('claim-note'), '上新房布置')

  fireEvent.press(ui.getByTestId('claim-service-date'))
  await waitFor(() => expect(ui.getByTestId('claim-date-picker')).toBeTruthy())
  const targetDate = new Date()
  targetDate.setMonth(targetDate.getMonth() - 1, 23)
  const targetYmd = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-23`
  fireEvent.press(ui.getByTestId('claim-date-picker-previous-month'))
  fireEvent.press(ui.getByTestId(`claim-date-picker-date-${targetYmd}`))
  fireEvent.press(ui.getByTestId('claim-date-picker-confirm'))
  await waitFor(() => expect(mockGetClaimOptions).toHaveBeenLastCalledWith('token-1', targetYmd))
  expect(ui.getByTestId('claim-service-date-value').props.children).toBe(formatPersonnelDate(targetYmd))
  expect(ui.getByTestId('claim-property').props.value).toBe('FG1003')
  expect(ui.getByTestId('claim-note').props.value).toBe('上新房布置')
  expect(ui.getByTestId('claim-start-time-value').props.children).toBe('10:05')
  expect(ui.getByTestId('claim-end-time-value').props.children).toBe('16:15')
  expect(ui.getByTestId('claim-duration-summary').props.children).toEqual(['工作时长：', '6 小时 10 分钟'])
  await waitFor(() => expect(ui.getByTestId('claim-submit').props.accessibilityState.disabled).toBe(false))
  fireEvent.press(ui.getByTestId('claim-submit'))

  await waitFor(() => expect(mockCreateClaim).toHaveBeenCalledWith(
    'token-1',
    expect.objectContaining({
      claim_type: 'new_property_task',
      service_date: targetYmd,
      property_id: 'FG1003',
      started_at: expect.any(String),
      ended_at: expect.any(String),
      requested_quantity: null,
      note: '上新房布置',
    }),
  ))
  await waitFor(() => expect(mockSubmitClaim).toHaveBeenCalled())
  expect(mockUploadEvidence).not.toHaveBeenCalled()
})

test('已配置的上新房规则按小时显示并请求权威预计金额', async () => {
  mockGetClaimOptions.mockResolvedValueOnce({
    service_date: '2026-09-14',
    rule_id: 'rule-1',
    rule_name: 'Cleaner rule',
    options: [{
      business_type: 'new_property',
      claim_type: 'new_property_task',
      label: '上新房',
      calculation_label: '系统按小时计算',
      input_mode: 'time_range',
      evidence_required: false,
      property_required: true,
      rule_configured: true,
    }],
  })

  const ui = renderPersonnelSettlementScreen()
  openClaimForm()
  await waitFor(() => expect(ui.getByTestId('claim-type-new_property')).toBeTruthy())
  fireEvent.press(ui.getByTestId('claim-type-new_property'))

  fireEvent.press(ui.getByTestId('claim-start-time'))
  await waitFor(() => expect(ui.getByTestId('claim-time-picker-hour-wheel')).toBeTruthy())
  fireEvent(ui.getByTestId('claim-time-picker-hour-wheel'), 'momentumScrollEnd', { nativeEvent: { contentOffset: { y: 44 * 17 } } })
  fireEvent(ui.getByTestId('claim-time-picker-minute-wheel'), 'momentumScrollEnd', { nativeEvent: { contentOffset: { y: 44 * 2 } } })
  fireEvent.press(ui.getByTestId('claim-time-picker-confirm'))

  fireEvent.press(ui.getByTestId('claim-end-time'))
  fireEvent(ui.getByTestId('claim-time-picker-hour-wheel'), 'momentumScrollEnd', { nativeEvent: { contentOffset: { y: 44 * 18 } } })
  fireEvent(ui.getByTestId('claim-time-picker-minute-wheel'), 'momentumScrollEnd', { nativeEvent: { contentOffset: { y: 44 * 4 } } })
  fireEvent.press(ui.getByTestId('claim-time-picker-confirm'))

  expect(ui.getByTestId('claim-duration-summary').props.children).toEqual(['工作时长：', '1 小时 10 分钟'])
  await waitFor(() => expect(mockGetClaimEstimate).toHaveBeenLastCalledWith(
    'token-1',
    expect.objectContaining({
      claim_type: 'new_property_task',
      duration_minutes: 70,
    }),
  ))
  await waitFor(() => expect(ui.getByTestId('claim-estimate-card')).toBeTruthy())
  expect(ui.getByTestId('claim-estimate-rate').props.children).toEqual(['$35.00 / 小时', ' · 已含 GST'])
  expect(ui.getByTestId('claim-estimate-total').props.children).toBe('$40.83')
  expect(ui.getByTestId('claim-estimate-gst').props.children).toEqual(['其中 GST ', '$3.71'])
})

test('hides documents from a previous settlement stage instead of falling back to stale PDF', () => {
  expect(selectCurrentSettlementDocuments({
    status: 'confirmed',
    documents: [{
      id: 'draft-v3', settlement_id: 'settlement-1', document_stage: 'awaiting_confirmation',
      document_kind: 'settlement_draft', document_label: '费用结算草稿', version: 3,
      invoice_number: null, mime_type: 'application/pdf', byte_size: 100,
      generated_at: '2026-09-16T00:05:00.000Z', file_name: 'settlement-draft-v3.pdf',
    }],
  })).toEqual([])
})

test('关闭仍在加载的周结算后迟到响应不会重新打开详情', async () => {
  const getSettlement = getMyPersonnelSettlement as jest.Mock
  const defaultGetSettlement = getSettlement.getMockImplementation()!
  let resolveSettlementDetail: (value: any) => void = () => undefined
  getSettlement.mockImplementationOnce(() => new Promise((resolve) => {
    resolveSettlementDetail = resolve
  }))

  const ui = renderPersonnelSettlementScreen()
  await waitFor(() => expect(ui.getByText('暂无工作量反馈')).toBeTruthy())
  fireEvent.press(ui.getByTestId('personnel-settlements-tab'))
  await waitFor(() => expect(ui.getByText('查看并再次确认')).toBeTruthy())
  fireEvent.press(ui.getByText('查看并再次确认'))
  expect(ui.getByTestId('settlement-detail-loading')).toBeTruthy()
  fireEvent.press(ui.getByTestId('settlement-detail-close'))
  expect(ui.queryByTestId('settlement-detail-header')).toBeNull()

  await act(async () => {
    resolveSettlementDetail(await defaultGetSettlement('token-1', 'settlement-1'))
  })
  expect(ui.queryByTestId('settlement-detail-header')).toBeNull()
})

test('周结算详情从统一入口提交带截图的补充费用并原子进入重新核对', async () => {
  const ui = renderPersonnelSettlementScreen()
  await waitFor(() => expect(ui.getByText('暂无工作量反馈')).toBeTruthy())
  fireEvent.press(ui.getByTestId('personnel-settlements-tab'))
  await waitFor(() => expect(ui.getByText('查看并再次确认')).toBeTruthy())
  fireEvent.press(ui.getByText('查看并再次确认'))
  await waitFor(() => expect(ui.getByTestId('settlement-reconciliation-card')).toBeTruthy())
  expect(ui.queryByTestId('settlement-supplement-card')).toBeNull()
  fireEvent.press(ui.getByTestId('settlement-issue-supplement'))
  await waitFor(() => expect(ui.getByTestId('settlement-supplement-card')).toBeTruthy())
  expect(StyleSheet.flatten(ui.getByTestId('settlement-supplement-card').props.style)).toEqual(expect.objectContaining({ gap: 12 }))

  expect(ui.getByTestId('settlement-projected-total').props.children).toBe('$110.00')
  expect(ui.getByTestId('settlement-supplement-date-value').props.children).toBe('13/09/2026')
  fireEvent.press(ui.getByTestId('settlement-supplement-date'))
  expect(ui.getByTestId('settlement-detail-header')).toBeTruthy()
  expect(ui.getByTestId('settlement-supplement-date-picker')).toBeTruthy()
  expect(ui.getByTestId('settlement-supplement-date-picker-date-2026-09-06').props.accessibilityState.disabled).toBe(true)
  expect(ui.getByTestId('settlement-supplement-date-picker-date-2026-09-12').props.accessibilityState.disabled).toBe(false)
  fireEvent.press(ui.getByTestId('settlement-supplement-date-picker-date-2026-09-12'))
  fireEvent.press(ui.getByTestId('settlement-supplement-date-picker-confirm'))
  expect(ui.getByTestId('settlement-supplement-date-value').props.children).toBe('12/09/2026')
  fireEvent.changeText(ui.getByTestId('settlement-supplement-amount'), '10.00')
  fireEvent.changeText(ui.getByTestId('settlement-supplement-note'), '临时交通补贴')
  expect(ui.getByTestId('settlement-current-supplement-total').props.children).toEqual(['+ ', '$11.00'])
  expect(ui.getByTestId('settlement-projected-total').props.children).toBe('$121.00')

  fireEvent.press(ui.getByText('上传照片/截图'))
  await waitFor(() => expect(mockAddDraftPhoto).toHaveBeenCalled())
  fireEvent.press(ui.getByTestId('settlement-supplement-submit'))
  await waitFor(() => expect(mockCreateClaim).toHaveBeenCalledWith(
    'token-1',
    expect.objectContaining({
      service_date: '2026-09-12',
      claim_type: 'subsidy_amount',
      requested_amount_cents: 1000,
      note: '临时交通补贴',
    }),
  ))
  await waitFor(() => expect(mockUploadEvidence).toHaveBeenCalled())
  await waitFor(() => expect(mockSubmitForReconciliation).toHaveBeenCalledWith(
    'token-1',
    'settlement-1',
    expect.any(String),
    expect.stringContaining('临时交通补贴'),
  ))
  expect(mockSubmitClaim).not.toHaveBeenCalled()
  expect(mockDispute).not.toHaveBeenCalled()
})

test('现有结算金额问题从统一入口发送给财务核对', async () => {
  const ui = renderPersonnelSettlementScreen()
  await waitFor(() => expect(ui.getByText('暂无工作量反馈')).toBeTruthy())
  fireEvent.press(ui.getByTestId('personnel-settlements-tab'))
  await waitFor(() => expect(ui.getByText('查看并再次确认')).toBeTruthy())
  fireEvent.press(ui.getByText('查看并再次确认'))
  await waitFor(() => expect(ui.getByTestId('settlement-issue-calculation')).toBeTruthy())
  fireEvent.press(ui.getByTestId('settlement-issue-calculation'))
  expect(StyleSheet.flatten(ui.getByTestId('settlement-issue-calculation').props.style)).toEqual(expect.objectContaining({
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  }))
  expect(StyleSheet.flatten(ui.getByTestId('settlement-dispute-submit').props.style)).toEqual(expect.objectContaining({ marginTop: 12 }))
  fireEvent.changeText(ui.getByTestId('settlement-dispute-reason'), '10/09/2026 的 FG1003 金额需要核对')
  fireEvent.press(ui.getByTestId('settlement-dispute-submit'))
  await waitFor(() => expect(mockDispute).toHaveBeenCalledWith(
    'token-1',
    'settlement-1',
    '10/09/2026 的 FG1003 金额需要核对',
  ))
  expect(mockSubmitForReconciliation).not.toHaveBeenCalled()
})
