import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { Alert, AppState, Keyboard, Share, StyleSheet } from 'react-native'
import {
  getMyPersonnelClaim,
  getMyPersonnelSettlement,
  getMyPersonnelSettlementSubmissionPreview,
  listMyPersonnelClaims,
  listMyPersonnelSettlements,
  updateMyPersonnelClaim,
  type MyPersonnelClaimOptionsResponse,
} from '../../lib/api'
import PersonnelSettlementScreen, {
  buildPersonnelSettlementWeekDailySummaries,
  buildPersonnelCalendarMonth,
  formatPersonnelDuration,
  formatPersonnelDate,
  formatPersonnelDateWithWeekday,
  groupPersonnelClaimsByDate,
  normalizePersonnelTimeWheelMinute,
  personnelClaimSaveErrorMessage,
  personnelPricingIssueLabel,
  personnelSettlementCategoryTotals,
  personnelSettlementPendingPropertyLabels,
  personnelSettlementSubsidyTotalCents,
  personnelSettlementWeekForDate,
  personnelTimeWheelIndexFromOffset,
  rebasePersonnelServiceTime,
  selectCurrentSettlementDocuments,
  settlementWorkReasonLabel,
  summarizePersonnelSettlementLinesByDate,
  unincludedSubmissionClaims,
} from './PersonnelSettlementScreen'
import { emptyPersonnelClaimDraft, personnelClaimDraftScopeForTarget } from '../../lib/personnelClaimDraft'

let mockFocusCallback: (() => void | (() => void)) | null = null
let mockFocusCleanup: (() => void) | void
let mockAppStateChangeListener: ((nextState: string) => void) | null = null
const mockNavigationSetOptions = jest.fn()

function renderPersonnelSettlementScreen() {
  return render(<PersonnelSettlementScreen navigation={{ setOptions: mockNavigationSetOptions }} />)
}

test('付款后差额税务口径冲突使用明确待处理文案', () => {
  expect(personnelPricingIssueLabel('post_payment_adjustment_tax_treatment_requires_decision'))
    .toBe('上周付款后差额与本周 GST 身份不一致，请公司财务／税务负责人核对')
})

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

async function waitForClaimDraftReady(ui: ReturnType<typeof renderPersonnelSettlementScreen>) {
  await waitFor(() => expect(ui.queryByTestId('claim-draft-loading')).toBeNull(), { timeout: 5000 })
}

async function choosePreviousMonthClaimDate(ui: ReturnType<typeof renderPersonnelSettlementScreen>, day = 23) {
  await waitForClaimDraftReady(ui)
  fireEvent.press(ui.getByTestId('claim-service-date'))
  await waitFor(() => expect(ui.getByTestId('claim-date-picker')).toBeTruthy())
  const targetDate = new Date()
  targetDate.setMonth(targetDate.getMonth() - 1, day)
  const targetYmd = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  fireEvent.press(ui.getByTestId('claim-date-picker-previous-month'))
  fireEvent.press(ui.getByTestId(`claim-date-picker-date-${targetYmd}`))
  fireEvent.press(ui.getByTestId('claim-date-picker-confirm'))
  await waitFor(() => expect(mockGetClaimOptions).toHaveBeenLastCalledWith('token-1', targetYmd))
  return targetYmd
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
}, { virtual: true })

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
const mockGetClaimOptions = jest.fn(async (_token?: string, serviceDate?: string): Promise<MyPersonnelClaimOptionsResponse> => ({
  service_date: serviceDate || '2026-09-13',
  rule_id: 'rule-1',
  rule_name: 'Cleaner rule',
  options: [
    { business_type: 'warehouse', claim_type: 'warehouse_hour', label: '仓管工作', calculation_label: '可先反馈，公司核对时确认计算方式', input_mode: 'time_range', evidence_required: true, property_required: false, rule_configured: false },
    { business_type: 'overtime', claim_type: 'overtime_hour', label: '加班', calculation_label: '可先反馈，公司核对时确认计算方式', input_mode: 'time_range', evidence_required: true, property_required: false, rule_configured: false },
    { business_type: 'subsidy', claim_type: 'subsidy_amount', label: '补贴', calculation_label: '按填写金额提交，公司核对后决定是否计入', input_mode: 'amount', evidence_required: true, property_required: false, rule_configured: true },
    { business_type: 'new_property', claim_type: 'new_property_task', label: '上新房', calculation_label: '可先反馈，公司核对时确认计算方式', input_mode: 'time_range', evidence_required: false, property_required: true, rule_configured: false },
    { business_type: 'external', claim_type: 'external_task', label: '编外合作', calculation_label: '可先反馈，公司核对时确认计算方式', input_mode: 'quantity', evidence_required: true, property_required: false, rule_configured: false },
    { business_type: 'custom', claim_type: 'custom_amount', label: '其他费用', calculation_label: '按填写金额提交，公司核对后决定是否计入', input_mode: 'amount', evidence_required: true, property_required: false, rule_configured: true },
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
const mockLoadDraft = jest.fn(async () => null)
const mockLoadDraftForTarget = jest.fn(async () => null)
const mockSaveDraft = jest.fn(async (_userId: string, draft: any, _scope?: string) => draft)
const mockClearDraft = jest.fn(async () => undefined)

jest.mock('../../lib/auth', () => ({
  useAuth: () => ({ token: 'token-1', user: { id: 'cleaner-1', username: 'Cleaner One', role: 'cleaner' } }),
}))

jest.mock('../../lib/personnelClaimDraft', () => {
  const actual = jest.requireActual('../../lib/personnelClaimDraft')
  return {
    ...actual,
    loadPersonnelClaimDraft: (...args: any[]) => (mockLoadDraft as any)(...args),
    loadPersonnelClaimDraftForTarget: (...args: any[]) => (mockLoadDraftForTarget as any)(...args),
    savePersonnelClaimDraft: (...args: any[]) => (mockSaveDraft as any)(...args),
    clearPersonnelClaimDraft: (...args: any[]) => (mockClearDraft as any)(...args),
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
    work_checklist: [{
      execution_key: 'cleaning:task-late', task_id: 'task-late', component_type: 'cleaning_task',
      property_label: 'LATE01', scheduled_service_date: '2026-09-09', service_date: null,
      status: 'incomplete', status_reason: 'task_not_completed:assigned', included_in_amount: false,
      requires_manual_review: false, evidence_count: 0,
    }, {
      execution_key: 'cleaning:task-legacy', task_id: 'task-legacy', component_type: 'cleaning_task',
      property_label: 'LEGACY01', scheduled_service_date: '2026-09-08', service_date: null,
      status: 'legacy_completed_unverified', status_reason: 'legacy_settlement_amount_preserved_without_execution_audit',
      included_in_amount: true, requires_manual_review: true, evidence_count: 0,
    }, {
      execution_key: 'cleaning:task-moved', task_id: 'task-moved', component_type: 'cleaning_task',
      property_label: 'MOVED01', scheduled_service_date: '2026-09-09', current_scheduled_service_date: '2026-09-15',
      service_date: null, status: 'rescheduled', status_reason: 'rescheduled_after_plan',
      included_in_amount: false, requires_manual_review: false, evidence_count: 0,
    }, {
      execution_key: 'cleaning:task-management-closed', task_id: 'task-management-closed', component_type: 'cleaning_task',
      property_label: 'CLOSED01', scheduled_service_date: '2026-09-10', current_scheduled_service_date: '2026-09-10',
      service_date: null, status: 'management_closed', status_reason: 'management_closed_without_execution',
      included_in_amount: false, requires_manual_review: false, evidence_count: 0,
    }],
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
        calculation_snapshot: { work_items: [{
          execution_key: 'cleaning:task-1', task_id: 'task-1', service_date: '2026-09-10',
          performed_by_name: 'Cleaner One', property_label: 'FG1003', scheduled_service_date: '2026-09-08',
          evidence_count: 2, status: 'completed',
        }, {
          execution_key: 'inspection:task-1', task_id: 'task-1-inspection', service_date: '2026-09-10',
          performed_by_name: 'Cleaner One', property_label: 'FG1003', scheduled_service_date: '2026-09-08',
          evidence_count: 1, status: 'completed',
        }] },
      },
      {
        id: 'line-cleaning-2', component_type: 'cleaning_task', service_date: '2026-09-10',
        description: 'Cleaning · OP814 · 两房两卫', quantity_numerator: 1, quantity_denominator: 1,
        unit_rate_cents: 4000, subtotal_cents: 4000, gst_cents: 400, total_cents: 4400,
        source_type: 'cleaning_task_assignment', source_id: 'task-2', price_basis: 'exclusive_gst', evidence_count: 0,
        calculation_snapshot: { work_items: [{
          execution_key: 'cleaning:task-2', task_id: 'task-2', service_date: '2026-09-10',
          performed_by_name: 'Cleaner One', property_label: 'OP814', scheduled_service_date: '2026-09-09',
          inspection_due_date: '2026-09-10', evidence_count: 1, status: 'completed',
        }] },
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
  mockLoadDraft.mockResolvedValue(null)
  mockLoadDraftForTarget.mockResolvedValue(null)
  mockSaveDraft.mockImplementation(async (_userId: string, draft: any) => draft)
  mockClearDraft.mockResolvedValue(undefined)
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
    { id: '1', component_type: 'cleaning_task', service_date: '2026-09-10', description: 'Cleaning · FG1003 · 两房两卫', quantity_numerator: 1, quantity_denominator: 1, unit_rate_cents: 4000, subtotal_cents: 4000, gst_cents: 400, total_cents: 4400, evidence_count: 0, calculation_snapshot: { work_items: [{ execution_key: 'cleaning:1', task_id: '1', property_label: 'FG1003', service_date: '2026-09-10', scheduled_service_date: '2026-09-08', evidence_count: 2, status: 'completed' }] } },
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
    work_items: [expect.objectContaining({ execution_key: 'cleaning:1', property_label: 'FG1003', scheduled_service_date: '2026-09-08' })],
  })])
  expect(personnelSettlementSubsidyTotalCents([
    { id: 'work', component_type: 'cleaning_task', total_cents: 8800 },
    { id: 'subsidy', component_type: 'subsidy_amount', total_cents: 2200 },
  ] as any)).toBe(2200)
})

test('检查周明细固定显示周一到周日并把计薪、清洁、补贴、待处理和历史按日归位', () => {
  const lines = [{
    id: 'inspection-day:2026-10-05', component_type: 'inspection_day', service_date: '2026-10-05',
    description: 'Inspection day · 2 properties', subtotal_cents: 13636, gst_cents: 1364, total_cents: 15000,
    calculation_snapshot: { work_items: [
      { execution_key: 'inspection:task-1', task_id: 'task-1', component_type: 'inspection_day', property_label: 'A101', service_date: '2026-10-05', status: 'payable' },
      { execution_key: 'inspection:task-2', task_id: 'task-2', component_type: 'inspection_day', property_label: 'B202', service_date: '2026-10-05', status: 'payable' },
    ] },
  }, {
    id: 'cleaning:task-3', component_type: 'cleaning_task', service_date: '2026-10-08',
    description: 'Cleaning · FO1602', subtotal_cents: 3182, gst_cents: 318, total_cents: 3500,
  }, {
    id: 'subsidy:travel', component_type: 'subsidy_amount', service_date: '2026-10-08',
    description: 'Travel subsidy', subtotal_cents: 909, gst_cents: 91, total_cents: 1000,
  }] as any
  const days = buildPersonnelSettlementWeekDailySummaries({
    week_start: '2026-10-05', week_end: '2026-10-11', lines,
    work_checklist: [{
      execution_key: 'inspection:expected', task_id: 'expected', component_type: 'inspection_day',
      property_label: 'C303', service_date: '2026-10-11', status: 'expected', included_in_amount: false,
    }, {
      execution_key: 'inspection:cancelled', task_id: 'cancelled', component_type: 'inspection_day',
      property_label: 'D404', scheduled_service_date: '2026-10-06', status: 'cancelled', included_in_amount: false,
    }, {
      execution_key: 'inspection:pending', task_id: 'pending', component_type: 'inspection_day',
      property_label: 'E505', service_date: '2026-10-07', status: 'payable', included_in_amount: false,
    }] as any,
    pending_pricing_items: [{
      id: 'inspection:pending', source_type: 'inspection_task_assignment', source_id: 'pending',
      service_date: '2026-10-07', component_type: 'inspection_day', description: 'Inspection · E505',
      property_label: 'E505', code: 'missing_effective_rule',
      work_items: [
        { execution_key: 'inspection:pending', task_id: 'pending', property_label: 'E505' },
        { execution_key: 'inspection:pending-2', task_id: 'pending-2', property_label: 'F606' },
      ],
    }] as any,
  })

  expect(days.map((day) => day.service_date)).toEqual([
    '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11',
  ])
  expect(days[0]).toEqual(expect.objectContaining({
    inspection_total_cents: 15000,
    inspection_work_items: [expect.objectContaining({ property_label: 'A101' }), expect.objectContaining({ property_label: 'B202' })],
  }))
  expect(days[1].history_items).toEqual([expect.objectContaining({ property_label: 'D404', status: 'cancelled' })])
  expect(days[2].pending_pricing_items).toEqual([expect.objectContaining({ property_label: 'E505' })])
  expect(days[2].inspection_work_items).toEqual([])
  expect(personnelSettlementPendingPropertyLabels(days[2].pending_pricing_items[0])).toEqual(['E505', 'F606'])
  expect(days[3]).toEqual(expect.objectContaining({ cleaning_total_cents: 3500, subsidy_total_cents: 1000 }))
  expect(days[6].inspection_work_items).toEqual([expect.objectContaining({ property_label: 'C303', status: 'expected' })])
  expect(personnelSettlementCategoryTotals(lines)).toEqual({
    inspection_cents: 15000, cleaning_cents: 3500, other_cents: 0, subsidy_cents: 1000, adjustment_cents: 0,
  })
})

test('下一周把已付差额显示为独立补发明细并保留税前和 GST 拆分', async () => {
  ;(listMyPersonnelSettlements as jest.Mock).mockResolvedValueOnce([])
  ;(getMyPersonnelSettlementSubmissionPreview as jest.Mock).mockResolvedValueOnce({
    week_start: '2026-09-07', week_end: '2026-09-13', status: 'not_submitted', settlement: null,
    subtotal_cents: 2000, gst_cents: 200, total_cents: 2200, line_count: 1,
    confirmation_token: 'c'.repeat(64), calculation_status: 'complete', pending_pricing_count: 0,
    pending_pricing_items: [], blocking_issues: [], work_checklist: [],
    lines: [{
      id: 'carry-1', component_type: 'post_payment_adjustment', service_date: '2026-09-07',
      source_type: 'post_payment_adjustment', source_id: 'carry-1',
      description: 'Paid settlement supplement · 2026-08-31 to 2026-09-06',
      quantity_numerator: 1, quantity_denominator: 1, unit_rate_cents: 2200,
      subtotal_cents: 2000, gst_cents: 200, total_cents: 2200,
      price_basis: 'inclusive_gst', evidence_count: 0,
      calculation_snapshot: { carry_adjustment: {
        source_settlement_id: 'paid-week', source_adjustment_id: 'adjustment-1',
        source_week_start: '2026-08-31', source_week_end: '2026-09-06',
        recorded_subtotal_difference_cents: 2000, recorded_gst_difference_cents: 200,
        recorded_total_difference_cents: 2200,
        previously_applied_subtotal_cents: 0, previously_applied_gst_cents: 0,
        previously_applied_total_cents: 0,
        applied_subtotal_cents: 2000, applied_gst_cents: 200, applied_total_cents: 2200,
      } },
    }],
  })
  const ui = renderPersonnelSettlementScreen()
  fireEvent.press(ui.getByTestId('personnel-settlements-tab'))
  await waitFor(() => expect(ui.getByTestId('weekly-submission-preview')).toBeTruthy())
  fireEvent.press(ui.getByTestId('weekly-submission-review'))
  expect(ui.getByTestId('weekly-submission-day-2026-09-07-adjustment')).toBeTruthy()
  expect(ui.getByText('上周补发／抵扣')).toBeTruthy()
  expect(ui.getByText('原账单 2026-08-31 至 2026-09-06')).toBeTruthy()
  expect(ui.getByText('原已付金额保持不变 · 税前 $20.00 · GST $2.00')).toBeTruthy()
  expect(ui.getByTestId('weekly-submission-adjustment-total')).toBeTruthy()
  expect(personnelSettlementCategoryTotals((await (getMyPersonnelSettlementSubmissionPreview as jest.Mock).mock.results[0].value).lines)).toEqual(expect.objectContaining({ adjustment_cents: 2200 }))
  ui.unmount()
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
  expect(personnelClaimSaveErrorMessage(new Error('claim_edit_conflict'))).toBe('这条反馈已在其他设备或页面更新，请刷新后核对最新内容再修改。')
  expect(personnelClaimSaveErrorMessage({ code: 'claim_period_locked' })).toBe('这条反馈所属周已进入财务核准或付款阶段，不能再修改。')
  expect(personnelClaimSaveErrorMessage(new Error('claim_draft_scope_mismatch'))).toBe('当前表单与草稿不一致，已阻止修改旧反馈。请关闭后重新打开。')
  expect(personnelSettlementWeekForDate('2026-09-28')).toEqual({ week_start: '2026-09-28', week_end: '2026-10-04' })
  expect(personnelSettlementWeekForDate('2026-10-03')).toEqual({ week_start: '2026-09-28', week_end: '2026-10-04' })
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
    started_at: '2026-09-12T00:00:00.000Z', ended_at: '2026-09-12T01:00:00.000Z',
    duration_minutes: 60, note: '补充工作说明', review_note: '请补充送达位置', evidence_count: 1,
    evidence: [{ id: 'evidence-returned-1', media_id: 'media-returned-1', mime_type: 'image/jpeg' }],
  } as any
  ;(listMyPersonnelClaims as jest.Mock).mockResolvedValueOnce([returnedClaim])
  ;(getMyPersonnelClaim as jest.Mock).mockResolvedValueOnce(returnedClaim)
  ;(updateMyPersonnelClaim as jest.Mock).mockResolvedValueOnce({ ...returnedClaim, status: 'draft' })

  const ui = renderPersonnelSettlementScreen()
  await waitFor(() => expect(ui.getByTestId('claim-row-claim-returned')).toBeTruthy())
  fireEvent.press(ui.getByTestId('claim-row-claim-returned'))
  await waitFor(() => expect(ui.getByTestId('claim-detail-edit')).toBeTruthy())
  fireEvent.press(ui.getByTestId('claim-detail-edit'))
  await waitFor(() => expect(ui.getByText('修改工作量反馈')).toBeTruthy())
  await waitForClaimDraftReady(ui)
  expect(ui.getByTestId('claim-form-header')).toBeTruthy()
  expect(ui.queryByTestId('claim-evidence-locked')).toBeNull()
  await waitFor(() => expect(ui.getByTestId('claim-draft-existing-evidence')).toBeTruthy())
  expect(ui.getByTestId('claim-photo-label').props.children[3]).toBe(1)
  fireEvent.press(ui.getByText('从相册选择'))
  await waitFor(() => expect(ui.getByTestId('claim-draft-local-evidence')).toBeTruthy())
  expect(ui.getByTestId('claim-photo-label').props.children[3]).toBe(2)
  fireEvent.press(ui.getByLabelText('删除证明照片'))
  await waitFor(() => expect(ui.queryByTestId('claim-draft-local-evidence')).toBeNull())
  expect(ui.getByTestId('claim-photo-label').props.children[3]).toBe(1)
  expect(ui.getByTestId('claim-draft-existing-evidence')).toBeTruthy()
  fireEvent.press(ui.getByText('从相册选择'))
  await waitFor(() => expect(ui.getByTestId('claim-draft-local-evidence')).toBeTruthy())
  fireEvent.press(ui.getByTestId('claim-submit'))
  await waitFor(() => expect(ui.getByTestId('claim-submit-review')).toBeTruthy())
  fireEvent.press(ui.getByTestId('claim-submit-review-confirm'))
  await waitFor(() => expect(mockUploadEvidence).toHaveBeenCalledTimes(1))
  expect(mockSubmitClaim).toHaveBeenCalledWith('token-1', 'claim-returned')
  expect(mockClearDraft).toHaveBeenCalledWith(
    'cleaner-1',
    expect.objectContaining({ claim_id: 'claim-returned' }),
    'edit_claim-returned',
  )
  expect(mockClearDraft).not.toHaveBeenCalledWith('cleaner-1', expect.anything(), 'create')
})

test('待核对反馈可修改且 10 月 3 日不会漂移为今天，并携带版本防止覆盖', async () => {
  const keyboardDismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined)
  const submittedClaim = {
    id: 'claim-submitted', status: 'submitted', service_date: '2026-10-03', claim_type: 'overtime_hour',
    started_at: '2026-10-03T00:00:00.000Z', ended_at: '2026-10-03T02:00:00.000Z', duration_minutes: 120,
    note: '9/28 周加班', evidence_count: 1, updated_at: '2026-10-04T01:02:03.000Z', available_actions: ['edit'],
    evidence: [{
      id: 'evidence-existing-1', media_id: 'media-existing-1', mime_type: 'image/jpeg',
      original_file_name: 'original-proof.jpg',
    }],
  } as any
  ;(listMyPersonnelClaims as jest.Mock).mockResolvedValueOnce([submittedClaim])
  ;(getMyPersonnelClaim as jest.Mock).mockResolvedValueOnce(submittedClaim).mockResolvedValueOnce(submittedClaim)
  ;(updateMyPersonnelClaim as jest.Mock).mockResolvedValueOnce({ ...submittedClaim, note: '9/28 周加班（修正）' })

  const ui = renderPersonnelSettlementScreen()
  await waitFor(() => expect(ui.getByTestId('claim-row-claim-submitted')).toBeTruthy())
  fireEvent.press(ui.getByTestId('claim-row-claim-submitted'))
  await waitFor(() => expect(ui.getByTestId('claim-detail-edit')).toBeTruthy())
  fireEvent.press(ui.getByTestId('claim-detail-edit'))
  await waitFor(() => expect(ui.getByText('修改工作量反馈')).toBeTruthy())
  await waitForClaimDraftReady(ui)
  await waitFor(() => expect(mockGetClaimOptions).toHaveBeenLastCalledWith('token-1', '2026-10-03'))

  expect(ui.getByTestId('claim-service-date-value').props.children).toBe('03/10/2026')
  expect(ui.getByText('已上传，修改时保留')).toBeTruthy()
  expect(ui.getByTestId('claim-photo-label').props.children).toEqual(['照片或截图证明', '（必填）', '（', 1, '/5）'])
  expect(ui.getByTestId('claim-draft-existing-evidence').props.source).toEqual(expect.objectContaining({
    headers: expect.objectContaining({ Authorization: 'Bearer token-1', 'Cache-Control': 'no-store' }),
  }))
  expect(ui.queryByLabelText('删除证明照片')).toBeNull()
  expect(ui.getByTestId('claim-evidence-locked')).toBeTruthy()
  expect(ui.queryByText('从相册选择')).toBeNull()
  expect(ui.queryByText('拍照')).toBeNull()

  fireEvent.press(ui.getByTestId('claim-form-close'))
  await waitFor(() => expect(ui.queryByText('修改工作量反馈')).toBeNull(), { timeout: 3000 })
  fireEvent.press(ui.getByTestId('claim-row-claim-submitted'))
  await waitFor(() => expect(ui.getByTestId('claim-detail-edit')).toBeTruthy())
  fireEvent.press(ui.getByTestId('claim-detail-edit'))
  await waitFor(() => expect(ui.getByText('已上传，修改时保留')).toBeTruthy())
  await waitFor(() => expect(ui.getByTestId('claim-submit').props.accessibilityState.disabled).toBe(false))

  fireEvent.press(ui.getByTestId('claim-submit'))
  expect(ui.getByTestId('claim-submit-review')).toBeTruthy()
  expect(keyboardDismiss).toHaveBeenCalled()
  fireEvent.press(ui.getByTestId('claim-submit-review-cancel'))

  fireEvent.changeText(ui.getByTestId('claim-note'), '9/28 周加班（修正）')
  fireEvent.press(ui.getByTestId('claim-submit'))
  expect(ui.getByTestId('claim-submit-review-date').props.children).toBe('03/10/2026')
  expect(ui.getByTestId('claim-submit-review-week').props.children).toBe('28/09/2026–04/10/2026')
  expect(ui.queryByTestId('claim-submit-cross-week-warning')).toBeNull()
  fireEvent.press(ui.getByTestId('claim-submit-review-cancel'))
  expect(ui.getByTestId('claim-note').props.value).toBe('9/28 周加班（修正）')

  fireEvent.press(ui.getByTestId('claim-service-date'))
  fireEvent.press(ui.getByTestId('claim-date-picker-previous-month'))
  fireEvent.press(ui.getByTestId('claim-date-picker-date-2026-09-27'))
  fireEvent.press(ui.getByTestId('claim-date-picker-confirm'))
  await waitFor(() => expect(mockGetClaimOptions).toHaveBeenLastCalledWith('token-1', '2026-09-27'))
  await waitFor(() => {
    expect(ui.queryByTestId('claim-date-picker')).toBeNull()
    expect(ui.getByTestId('claim-submit').props.accessibilityState.disabled).toBe(false)
  })
  fireEvent.press(ui.getByTestId('claim-submit'))
  await waitFor(() => expect(ui.getByTestId('claim-submit-cross-week-warning')).toBeTruthy())
  expect(ui.getByTestId('claim-submit-review-week').props.children).toBe('21/09/2026–27/09/2026')
  expect(ui.getByText('工作日期已跨周：原周 28/09/2026–04/10/2026，修改后进入 21/09/2026–27/09/2026。原周将不再包含该反馈。')).toBeTruthy()
  fireEvent.press(ui.getByTestId('claim-submit-review-cancel'))

  fireEvent.press(ui.getByTestId('claim-service-date'))
  fireEvent.press(ui.getByTestId('claim-date-picker-next-month'))
  fireEvent.press(ui.getByTestId('claim-date-picker-date-2026-10-03'))
  fireEvent.press(ui.getByTestId('claim-date-picker-confirm'))
  await waitFor(() => expect(mockGetClaimOptions).toHaveBeenLastCalledWith('token-1', '2026-10-03'))
  await waitFor(() => {
    expect(ui.queryByTestId('claim-date-picker')).toBeNull()
    expect(ui.getByTestId('claim-submit').props.accessibilityState.disabled).toBe(false)
  })
  fireEvent.press(ui.getByTestId('claim-submit'))
  fireEvent.press(ui.getByTestId('claim-submit-review-confirm'))
  fireEvent.press(ui.getByTestId('claim-submit-review-confirm'))

  await waitFor(() => expect(updateMyPersonnelClaim).toHaveBeenCalledWith(
    'token-1',
    'claim-submitted',
    expect.objectContaining({
      service_date: '2026-10-03',
      claim_type: 'overtime_hour',
      expected_updated_at: '2026-10-04T01:02:03.000Z',
      note: '9/28 周加班（修正）',
    }),
  ))
  expect(updateMyPersonnelClaim).toHaveBeenCalledTimes(1)
  expect(mockSubmitClaim).not.toHaveBeenCalled()
})

test('修改待核对反馈失败后关闭核对层并在原表单持续显示错误', async () => {
  const submittedClaim = {
    id: 'claim-submit-failure', status: 'submitted', service_date: '2026-10-03', claim_type: 'overtime_hour',
    started_at: '2026-10-03T00:00:00.000Z', ended_at: '2026-10-03T01:00:00.000Z', duration_minutes: 60,
    note: '原说明', evidence_count: 1, updated_at: '2026-10-04T01:02:03.000Z', available_actions: ['edit'],
    evidence: [{ id: 'evidence-existing-1', media_id: 'media-existing-1', mime_type: 'image/jpeg' }],
  } as any
  ;(listMyPersonnelClaims as jest.Mock).mockResolvedValueOnce([submittedClaim])
  ;(getMyPersonnelClaim as jest.Mock).mockResolvedValueOnce(submittedClaim)
  ;(updateMyPersonnelClaim as jest.Mock).mockRejectedValueOnce(new Error('offline'))

  const ui = renderPersonnelSettlementScreen()
  await waitFor(() => expect(ui.getByTestId('claim-row-claim-submit-failure')).toBeTruthy())
  fireEvent.press(ui.getByTestId('claim-row-claim-submit-failure'))
  await waitFor(() => expect(ui.getByTestId('claim-detail-edit')).toBeTruthy())
  fireEvent.press(ui.getByTestId('claim-detail-edit'))
  await waitFor(() => expect(ui.getByText('修改工作量反馈')).toBeTruthy())
  await waitForClaimDraftReady(ui)
  await waitFor(() => expect(ui.getByTestId('claim-note')).toBeTruthy())
  fireEvent.changeText(ui.getByTestId('claim-note'), '修改后的说明')
  await waitFor(() => expect(ui.getByTestId('claim-submit').props.accessibilityState.disabled).toBe(false))
  fireEvent.press(ui.getByTestId('claim-submit'))
  await waitFor(() => expect(ui.getByTestId('claim-submit-review')).toBeTruthy())
  fireEvent.press(ui.getByTestId('claim-submit-review-confirm'))

  await waitFor(() => expect(ui.queryByTestId('claim-submit-review')).toBeNull(), { timeout: 5000 })
  expect(ui.getByTestId('claim-form-header')).toBeTruthy()
  expect(ui.getByTestId('claim-form-error')).toBeTruthy()
  expect(ui.getByText(/offline/)).toBeTruthy()

  fireEvent.press(ui.getByTestId('claim-form-close'))
  await waitFor(() => expect(ui.queryByText('修改工作量反馈')).toBeNull(), { timeout: 3000 })
  openClaimForm()
  await waitForClaimDraftReady(ui)
  expect(ui.getByText('新增工作量反馈')).toBeTruthy()
  expect(ui.getByTestId('claim-service-date-value').props.children).toBe('--')
  expect(ui.queryByDisplayValue('修改后的说明')).toBeNull()
  expect(updateMyPersonnelClaim).toHaveBeenCalledTimes(1)
}, 15000)

test('迟到的修改草稿和重复新增点击都不能覆盖最新新增会话', async () => {
  const submittedClaim = {
    id: 'claim-slow-edit', status: 'submitted', service_date: '2026-10-03', claim_type: 'overtime_hour',
    started_at: '2026-10-03T00:00:00.000Z', ended_at: '2026-10-03T01:00:00.000Z', duration_minutes: 60,
    note: '服务端原说明', evidence_count: 1, updated_at: '2026-10-04T01:02:03.000Z', available_actions: ['edit'],
    evidence: [{ id: 'evidence-slow-edit', media_id: 'media-slow-edit', mime_type: 'image/jpeg' }],
  } as any
  const staleEditDraft = {
    ...emptyPersonnelClaimDraft('2026-10-03'),
    claim_id: 'claim-slow-edit',
    claim_type: 'overtime_hour' as const,
    note: '迟到的旧修改草稿',
  }
  const staleCreateDraft = {
    ...emptyPersonnelClaimDraft('2026-09-11'),
    note: '第一次新增的迟到草稿',
  }
  const latestCreateDraft = {
    ...emptyPersonnelClaimDraft('2026-09-12'),
    note: '第二次新增草稿',
  }
  let resolveEditDraft: (draft: any) => void = () => undefined
  let resolveFirstCreateDraft: (draft: any) => void = () => undefined
  const editLoad = new Promise((resolve) => { resolveEditDraft = resolve })
  const firstCreateLoad = new Promise((resolve) => { resolveFirstCreateDraft = resolve })
  let createLoadCount = 0
  ;(mockLoadDraftForTarget as any).mockImplementation(async (_userId: string, target: any) => {
    if (target.mode === 'edit') return editLoad
    createLoadCount += 1
    return createLoadCount === 1 ? firstCreateLoad : latestCreateDraft
  })
  ;(listMyPersonnelClaims as jest.Mock).mockResolvedValueOnce([submittedClaim])
  ;(getMyPersonnelClaim as jest.Mock).mockResolvedValueOnce(submittedClaim)

  const ui = renderPersonnelSettlementScreen()
  await waitFor(() => expect(ui.getByTestId('claim-row-claim-slow-edit')).toBeTruthy())
  fireEvent.press(ui.getByTestId('claim-row-claim-slow-edit'))
  await waitFor(() => expect(ui.getByTestId('claim-detail-edit')).toBeTruthy())
  fireEvent.press(ui.getByTestId('claim-detail-edit'))
  await waitFor(() => expect(ui.getByTestId('claim-draft-loading')).toBeTruthy())
  fireEvent.press(ui.getByTestId('claim-form-close'))
  await waitFor(() => expect(ui.queryByText('修改工作量反馈')).toBeNull(), { timeout: 3000 })
  expect(mockSaveDraft).not.toHaveBeenCalled()

  openClaimForm()
  openClaimForm()
  await waitForClaimDraftReady(ui)
  await waitFor(() => expect(ui.getByTestId('claim-note')).toBeTruthy())
  expect(ui.getByText('新增工作量反馈')).toBeTruthy()
  expect(ui.getByTestId('claim-service-date-value').props.children).toBe('12/09/2026')
  expect(ui.getByTestId('claim-note').props.value).toBe('第二次新增草稿')

  await act(async () => {
    resolveEditDraft(staleEditDraft)
    resolveFirstCreateDraft(staleCreateDraft)
    await Promise.resolve()
  })
  expect(ui.getByText('新增工作量反馈')).toBeTruthy()
  expect(ui.getByTestId('claim-service-date-value').props.children).toBe('12/09/2026')
  expect(ui.getByTestId('claim-note').props.value).toBe('第二次新增草稿')
  expect(updateMyPersonnelClaim).not.toHaveBeenCalled()
})

test('逐条修改草稿跨关闭和页面重进仍隔离恢复', async () => {
  const claimA = {
    id: 'claim-scope-a', status: 'returned', service_date: '2026-09-12', claim_type: 'warehouse_hour',
    started_at: '2026-09-12T00:00:00.000Z', ended_at: '2026-09-12T01:00:00.000Z', duration_minutes: 60,
    note: 'A 原说明', evidence_count: 0, available_actions: ['edit'],
  } as any
  const claimB = {
    ...claimA,
    id: 'claim-scope-b',
    note: 'B 原说明',
  }
  const storedByScope = new Map<string, any>()
  ;(mockLoadDraftForTarget as any).mockImplementation(async (_userId: string, target: any) => (
    storedByScope.get(personnelClaimDraftScopeForTarget(target)) || null
  ))
  mockSaveDraft.mockImplementation(async (_userId: string, draft: any, scope?: string) => {
    const saved = { ...draft, updated_at: new Date().toISOString() }
    storedByScope.set(String(scope || 'default'), saved)
    return saved
  })
  ;(listMyPersonnelClaims as jest.Mock)
    .mockResolvedValueOnce([claimA, claimB])
    .mockResolvedValueOnce([claimA, claimB])
  ;(getMyPersonnelClaim as jest.Mock)
    .mockResolvedValueOnce(claimA)
    .mockResolvedValueOnce(claimB)
    .mockResolvedValueOnce(claimA)

  const ui = renderPersonnelSettlementScreen()
  await waitFor(() => expect(ui.getByTestId('claim-row-claim-scope-a')).toBeTruthy())
  fireEvent.press(ui.getByTestId('claim-row-claim-scope-a'))
  await waitFor(() => expect(ui.getByTestId('claim-detail-edit')).toBeTruthy())
  fireEvent.press(ui.getByTestId('claim-detail-edit'))
  await waitForClaimDraftReady(ui)
  await waitFor(() => expect(ui.getByTestId('claim-note')).toBeTruthy())
  fireEvent.changeText(ui.getByTestId('claim-note'), 'A 独立草稿')
  fireEvent.press(ui.getByTestId('claim-form-close'))
  await waitFor(() => expect(ui.queryByText('修改工作量反馈')).toBeNull(), { timeout: 3000 })

  fireEvent.press(ui.getByTestId('claim-row-claim-scope-b'))
  await waitFor(() => expect(ui.getByTestId('claim-detail-edit')).toBeTruthy())
  fireEvent.press(ui.getByTestId('claim-detail-edit'))
  await waitForClaimDraftReady(ui)
  await waitFor(() => expect(ui.getByTestId('claim-note')).toBeTruthy())
  expect(ui.getByTestId('claim-note').props.value).toBe('B 原说明')
  fireEvent.changeText(ui.getByTestId('claim-note'), 'B 独立草稿')
  fireEvent.press(ui.getByTestId('claim-form-close'))
  await waitFor(() => expect(ui.queryByText('修改工作量反馈')).toBeNull(), { timeout: 3000 })
  ui.unmount()

  const reentered = renderPersonnelSettlementScreen()
  await waitFor(() => expect(reentered.getByTestId('claim-row-claim-scope-a')).toBeTruthy())
  fireEvent.press(reentered.getByTestId('claim-row-claim-scope-a'))
  await waitFor(() => expect(reentered.getByTestId('claim-detail-edit')).toBeTruthy())
  fireEvent.press(reentered.getByTestId('claim-detail-edit'))
  await waitForClaimDraftReady(reentered)
  await waitFor(() => expect(reentered.getByTestId('claim-note')).toBeTruthy())
  expect(reentered.getByTestId('claim-note').props.value).toBe('A 独立草稿')
  expect(storedByScope.get('edit_claim-scope-b')).toEqual(expect.objectContaining({ note: 'B 独立草稿' }))
}, 15000)

test('新增入口使用不会超出导航栏的紧凑统一按钮', async () => {
  renderPersonnelSettlementScreen()
  await waitFor(() => expect(mockNavigationSetOptions).toHaveBeenCalled())
  const latestOptions = [...mockNavigationSetOptions.mock.calls]
    .reverse()
    .map(([options]) => options)
    .find((options) => typeof options?.headerRight === 'function')
  const headerButton = latestOptions.headerRight()
  expect(headerButton.props.label).toBe('＋ 新增')
  expect(headerButton.props.size).toBe('compact')
  expect(headerButton.props.minHeight).toBe(44)
  expect(StyleSheet.flatten(headerButton.props.style)).toEqual(expect.objectContaining({ minWidth: 82, flexShrink: 0 }))
})

test('核对前校验错误会在表单内持续显示', async () => {
  const ui = renderPersonnelSettlementScreen()
  await waitFor(() => expect(mockNavigationSetOptions).toHaveBeenCalled())
  openClaimForm()
  await choosePreviousMonthClaimDate(ui)
  fireEvent.press(ui.getByTestId('claim-submit'))
  expect(ui.getByTestId('claim-form-error')).toBeTruthy()
  expect(ui.getByText('请填写补贴内容')).toBeTruthy()
  expect(ui.queryByTestId('claim-submit-review')).toBeNull()
})

test('历史其他费用仍可修改但不会重新出现在新建类型中', async () => {
  const returnedClaim = {
    id: 'claim-custom-returned', status: 'returned', service_date: '2026-09-12', claim_type: 'custom_amount',
    requested_amount_cents: 1368, note: '历史停车补贴', review_note: '请补充说明', evidence_count: 1,
  } as any
  ;(listMyPersonnelClaims as jest.Mock).mockResolvedValueOnce([returnedClaim])
  ;(getMyPersonnelClaim as jest.Mock).mockResolvedValueOnce(returnedClaim)
  const optionsWithoutCustom = (await mockGetClaimOptions('token-1', '2026-09-12')).options
    .filter((option: any) => option.claim_type !== 'custom_amount')
  mockGetClaimOptions.mockImplementation(async (_token?: string, serviceDate?: string) => ({
    service_date: serviceDate || '2026-09-12',
    rule_id: null,
    rule_name: null,
    options: optionsWithoutCustom,
  }))

  const ui = renderPersonnelSettlementScreen()
  await waitFor(() => expect(ui.getByTestId('claim-row-claim-custom-returned')).toBeTruthy())
  fireEvent.press(ui.getByTestId('claim-row-claim-custom-returned'))
  await waitFor(() => expect(ui.getByTestId('claim-detail-edit')).toBeTruthy())
  fireEvent.press(ui.getByTestId('claim-detail-edit'))
  await waitFor(() => expect(ui.getByText('修改工作量反馈')).toBeTruthy())
  await waitForClaimDraftReady(ui)

  await waitFor(() => expect(ui.getByText('当前选择：其他费用（历史）')).toBeTruthy(), { timeout: 3000 })
  expect(ui.queryByTestId('claim-type-custom')).toBeNull()
  expect(ui.getByTestId('claim-amount').props.value).toBe('13.68')
  expect(ui.getByTestId('claim-note').props.value).toBe('历史停车补贴')
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
  await waitForClaimDraftReady(ui)
  expect(ui.getByTestId('claim-service-date-value').props.children).toBe('--')
  expect(ui.getByText('请先确认工作日期；系统不会自动使用今天。')).toBeTruthy()
  expect(ui.queryByText('上新房')).toBeNull()
  const targetYmd = await choosePreviousMonthClaimDate(ui)
  await waitFor(() => expect(ui.getByText('上新房')).toBeTruthy())
  expect(ui.queryByText(/试工/)).toBeNull()
  expect(ui.getByText(/网络中断时不会丢失/)).toBeTruthy()
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
  expect(ui.getByTestId('settlement-day-2026-09-07')).toBeTruthy()
  expect(ui.getByTestId('settlement-day-2026-09-13')).toBeTruthy()
  expect(ui.getByTestId('settlement-day-2026-09-10-cleaning')).toBeTruthy()
  expect(ui.getByText('FG1003 / OP814')).toBeTruthy()
  expect(ui.getByTestId('settlement-day-2026-09-10-subsidy')).toBeTruthy()
  expect(ui.getByText('Subsidy - Travel subsidy')).toBeTruthy()
  expect(ui.getByTestId('settlement-detail-subsidy-total').props.children.join('')).toBe('其中补贴 $22.00（已包含）')
  expect(ui.queryByText('本周房源工作清单（4）')).toBeNull()
  fireEvent.press(ui.getByTestId('settlement-day-2026-09-08-history-toggle'))
  expect(ui.getByText('LEGACY01 · 历史完成待核实')).toBeTruthy()
  expect(ui.getByText('保留历史结算金额，执行事实待核实')).toBeTruthy()
  fireEvent.press(ui.getByTestId('settlement-day-2026-09-09-history-toggle'))
  expect(ui.getByText('LATE01 · 未完成')).toBeTruthy()
  expect(ui.getByText('任务状态 assigned，尚无完成审计')).toBeTruthy()
  expect(ui.getByText('MOVED01 · 改期/跨日')).toBeTruthy()
  expect(ui.getByText('原安排日后已改期，原任务不自动计费')).toBeTruthy()
  fireEvent.press(ui.getByTestId('settlement-day-2026-09-10-history-toggle'))
  expect(ui.getByText('CLOSED01 · 管理关闭')).toBeTruthy()
  expect(ui.getByText('仅关闭管理流程，不代表真实执行完成，不计费')).toBeTruthy()
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
    subtotal_cents: 4091, gst_cents: 409, total_cents: 4500, line_count: 2,
    confirmation_token: 'a'.repeat(64),
    blocking_issues: [],
    work_checklist: [{
      execution_key: 'cleaning:task-delayed', task_id: 'task-delayed', component_type: 'cleaning_task',
      property_label: 'DELAY01', scheduled_service_date: '2026-09-10', service_date: null,
      status: 'incomplete', status_reason: 'task_not_completed:assigned', included_in_amount: false,
      requires_manual_review: false, evidence_count: 0,
    }],
    lines: [{
      id: 'cleaning_task_assignment:task-1:cleaning_task', component_type: 'cleaning_task',
      service_date: '2026-09-10', source_type: 'cleaning_task_assignment', source_id: 'task-1',
      description: 'Cleaning · FG1003 · 一房一卫', quantity_numerator: 1, quantity_denominator: 1,
      unit_rate_cents: 3500, subtotal_cents: 3182, gst_cents: 318, total_cents: 3500,
      price_basis: 'inclusive_gst', evidence_count: 0,
    }, {
      id: 'workload_claim:pending-subsidy:subsidy_amount', component_type: 'subsidy_amount',
      service_date: '2026-09-11', source_type: 'workload_claim', source_id: 'pending-subsidy',
      description: '交通补贴', quantity_numerator: 1, quantity_denominator: 1,
      unit_rate_cents: 1000, subtotal_cents: 909, gst_cents: 91, total_cents: 1000,
      price_basis: 'inclusive_gst', evidence_count: 1,
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
  expect(ui.getByTestId('weekly-submission-day-2026-09-10-cleaning')).toBeTruthy()
  expect(ui.getByText('FG1003')).toBeTruthy()
  expect(ui.getByTestId('weekly-submission-included-pending-claims')).toBeTruthy()
  expect(ui.getByText('已包含 1 条待财务审核反馈')).toBeTruthy()
  expect(ui.queryByTestId('weekly-submission-unincluded-claims')).toBeNull()
  expect(ui.getByText('以下基础工作量、额外工作、补贴和上周补发／抵扣均已计入本次确认总额')).toBeTruthy()
  expect(ui.getByTestId('weekly-submission-subsidy-total')).toBeTruthy()
  expect(ui.queryByText('本周房源工作清单（1）')).toBeNull()
  fireEvent.press(ui.getByTestId('weekly-submission-day-2026-09-10-history-toggle'))
  expect(ui.getByText('DELAY01 · 未完成')).toBeTruthy()
  expect(ui.getByText('任务状态 assigned，尚无完成审计')).toBeTruthy()
  expect(mockSubmitSettlementWeek).not.toHaveBeenCalled()

  fireEvent.press(ui.getByTestId('weekly-submission-next'))
  expect(ui.getByTestId('weekly-submission-submit').props.accessibilityState.disabled).toBe(true)
  expect(ui.getByText('1 项（已包含）')).toBeTruthy()
  expect(ui.getByTestId('weekly-submission-confirmation-subsidy-total')).toBeTruthy()
  expect(StyleSheet.flatten(ui.getByTestId('weekly-submission-checkbox').props.style)).toEqual(expect.objectContaining({ width: 24, height: 24, flexShrink: 0 }))
  expect(ui.getAllByText('$45.00')).toHaveLength(2)
  fireEvent.press(ui.getByTestId('weekly-submission-acknowledgement'))
  fireEvent.press(ui.getByTestId('weekly-submission-submit'))
  await waitFor(() => expect(mockSubmitSettlementWeek).toHaveBeenCalledWith('token-1', '2026-09-07', 'a'.repeat(64)))
  ui.unmount()
})

test('待计价项目单列且允许先提交已计小计，随后必须重新确认', async () => {
  ;(listMyPersonnelSettlements as jest.Mock).mockResolvedValueOnce([])
  ;(getMyPersonnelSettlementSubmissionPreview as jest.Mock).mockResolvedValueOnce({
    week_start: '2026-09-07', week_end: '2026-09-13', status: 'not_submitted', settlement: null,
    subtotal_cents: 0, gst_cents: 0, total_cents: 0, line_count: 0,
    confirmation_token: 'f'.repeat(64),
    calculation_status: 'partial', pending_pricing_count: 1,
    pending_pricing_items: [{
      id: 'workload_claim:claim-overtime:overtime_hour', source_type: 'workload_claim', source_id: 'claim-overtime',
      service_date: '2026-09-08', component_type: 'overtime_hour', description: '加班 2 小时', code: 'missing_rule_item',
      work_items: [
        { execution_key: 'inspection:A101', task_id: 'A101', property_label: 'A101' },
        { execution_key: 'inspection:B202', task_id: 'B202', property_label: 'B202' },
      ],
    }],
    blocking_issues: [{ source_type: 'workload_claim', source_id: 'claim-overtime', code: 'missing_rule_item' }],
    lines: [],
  })

  const ui = renderPersonnelSettlementScreen()
  fireEvent.press(ui.getByTestId('personnel-settlements-tab'))
  await waitFor(() => expect(ui.getByTestId('weekly-submission-preview')).toBeTruthy())
  expect(ui.getByText('本周总额暂未计算完整；可先提交已计小计和待计价项目，公司补齐后会请你重新确认。')).toBeTruthy()
  fireEvent.press(ui.getByTestId('weekly-submission-review'))
  expect(ui.getByText('以下为已计价项目；待计价工作单独列出且未按零元合并')).toBeTruthy()
  expect(ui.queryByText('本周暂无可提交项目')).toBeNull()
  expect(ui.getByTestId('weekly-submission-day-2026-09-07')).toBeTruthy()
  expect(ui.getByTestId('weekly-submission-day-2026-09-13')).toBeTruthy()
  expect(ui.getByTestId('weekly-submission-day-2026-09-08-pending')).toBeTruthy()
  expect(ui.getByText('A101 / B202')).toBeTruthy()
  expect(ui.getByText('08/09/2026  周二')).toBeTruthy()
  expect(ui.getByText('加班 2 小时')).toBeTruthy()
  expect(ui.getByText('费用规则缺少该工作类型单价')).toBeTruthy()
  expect(ui.getByTestId('weekly-submission-next').props.accessibilityState.disabled).toBe(false)
  fireEvent.press(ui.getByTestId('weekly-submission-next'))
  fireEvent.press(ui.getByTestId('weekly-submission-acknowledgement'))
  fireEvent.press(ui.getByTestId('weekly-submission-submit'))
  await waitFor(() => expect(mockSubmitSettlementWeek).toHaveBeenCalledWith('token-1', '2026-09-07', 'f'.repeat(64)))
  ui.unmount()
})

test('已作废的周结算重新显示完整核对与提交入口', async () => {
  const voidSettlement = {
    id: 'settlement-void', week_start: '2026-09-07', week_end: '2026-09-13', status: 'void',
    subtotal_cents: 6364, gst_cents: 636, total_cents: 7000, currency: 'AUD', line_count: 2, evidence_count: 0,
  }
  ;(listMyPersonnelSettlements as jest.Mock).mockResolvedValueOnce([voidSettlement])
  ;(getMyPersonnelSettlementSubmissionPreview as jest.Mock).mockResolvedValueOnce({
    week_start: '2026-09-07', week_end: '2026-09-13', status: 'not_submitted', settlement: voidSettlement,
    subtotal_cents: 6364, gst_cents: 636, total_cents: 7000, line_count: 2,
    confirmation_token: 'c'.repeat(64), blocking_issues: [], lines: [],
  })

  const ui = renderPersonnelSettlementScreen()
  fireEvent.press(ui.getByTestId('personnel-settlements-tab'))
  await waitFor(() => expect(ui.getByTestId('weekly-submission-preview')).toBeTruthy())
  expect(ui.getByText('待重新提交')).toBeTruthy()
  expect(ui.getByText('原结算已作废。请重新核对本周完整工作量和总额后提交。')).toBeTruthy()
  fireEvent.press(ui.getByText('重新核对并提交'))
  expect(ui.getByTestId('weekly-submission-review-detail')).toBeTruthy()
  fireEvent.press(ui.getByTestId('weekly-submission-next'))
  fireEvent.press(ui.getByTestId('weekly-submission-acknowledgement'))
  fireEvent.press(ui.getByTestId('weekly-submission-submit'))
  await waitFor(() => expect(mockSubmitSettlementWeek).toHaveBeenCalledWith('token-1', '2026-09-07', 'c'.repeat(64)))
  ui.unmount()
})

test('历史已作废周从列表按自身周次重新加载核对入口', async () => {
  const historicalVoidSettlement = {
    id: 'settlement-void-history', week_start: '2026-09-07', week_end: '2026-09-13', status: 'void',
    subtotal_cents: 6364, gst_cents: 636, total_cents: 7000, currency: 'AUD', line_count: 2, evidence_count: 0,
  }
  ;(listMyPersonnelSettlements as jest.Mock).mockResolvedValueOnce([historicalVoidSettlement])
  ;(getMyPersonnelSettlementSubmissionPreview as jest.Mock)
    .mockResolvedValueOnce({
      week_start: '2026-09-28', week_end: '2026-10-04', status: 'not_submitted', settlement: null,
      subtotal_cents: 0, gst_cents: 0, total_cents: 0, line_count: 0,
      confirmation_token: 'd'.repeat(64), blocking_issues: [], lines: [],
    })
    .mockResolvedValueOnce({
      week_start: '2026-09-07', week_end: '2026-09-13', status: 'not_submitted', settlement: historicalVoidSettlement,
      subtotal_cents: 6364, gst_cents: 636, total_cents: 7000, line_count: 2,
      confirmation_token: 'e'.repeat(64), blocking_issues: [], lines: [],
    })

  const ui = renderPersonnelSettlementScreen()
  fireEvent.press(ui.getByTestId('personnel-settlements-tab'))
  const resubmit = await ui.findByTestId('voided-settlement-resubmit-settlement-void-history')
  expect(ui.getByText('已作废')).toBeTruthy()
  expect(ui.getByText('重新核对并提交')).toBeTruthy()
  fireEvent.press(resubmit)

  await waitFor(() => expect(getMyPersonnelSettlementSubmissionPreview).toHaveBeenCalledWith('token-1', '2026-09-07'))
  await waitFor(() => expect(ui.getByTestId('weekly-submission-review-detail')).toBeTruthy())
  expect(ui.getByText('07/09/2026 至 13/09/2026')).toBeTruthy()
  fireEvent.press(ui.getByTestId('weekly-submission-next'))
  fireEvent.press(ui.getByTestId('weekly-submission-acknowledgement'))
  fireEvent.press(ui.getByTestId('weekly-submission-submit'))
  await waitFor(() => expect(mockSubmitSettlementWeek).toHaveBeenCalledWith('token-1', '2026-09-07', 'e'.repeat(64)))
  ui.unmount()
})

test('补贴使用单一通用入口且不提示具体类别，上新房按时间且无需照片即可提交', async () => {
  const ui = renderPersonnelSettlementScreen()
  openClaimForm()
  const targetYmd = await choosePreviousMonthClaimDate(ui)

  expect(ui.getByText(/补贴按填写金额提交，由财务决定是否计入/)).toBeTruthy()
  expect(ui.getByTestId('claim-type-warehouse')).toBeTruthy()
  expect(ui.getByTestId('claim-type-overtime')).toBeTruthy()
  expect(ui.getByTestId('claim-type-subsidy')).toBeTruthy()
  expect(ui.getByTestId('claim-type-new_property')).toBeTruthy()
  expect(ui.getByTestId('claim-type-external')).toBeTruthy()
  expect(ui.getByText('按填写金额提交，公司核对后决定是否计入')).toBeTruthy()
  expect(ui.queryByText('其他费用')).toBeNull()
  expect(ui.getByText('补贴金额 AUD')).toBeTruthy()
  expect(ui.getByText('补贴内容')).toBeTruthy()
  expect(ui.getByTestId('claim-note').props.placeholder).toBe('请填写具体补贴内容')
  expect(ui.getByTestId('claim-note').props.placeholder).not.toMatch(/停车|油费|高温|雨补|交通/)
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

  expect(ui.getByTestId('claim-property').props.value).toBe('FG1003')
  expect(ui.getByTestId('claim-note').props.value).toBe('上新房布置')
  expect(ui.getByTestId('claim-start-time-value').props.children).toBe('10:05')
  expect(ui.getByTestId('claim-end-time-value').props.children).toBe('16:15')
  expect(ui.getByTestId('claim-duration-summary').props.children).toEqual(['工作时长：', '6 小时 10 分钟'])
  await waitFor(() => expect(ui.getByTestId('claim-submit').props.accessibilityState.disabled).toBe(false))
  fireEvent.press(ui.getByTestId('claim-submit'))
  expect(ui.getByTestId('claim-submit-review')).toBeTruthy()
  fireEvent.press(ui.getByTestId('claim-submit-review-confirm'))

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
  expect(mockClearDraft).toHaveBeenCalledWith(
    'cleaner-1',
    expect.objectContaining({ claim_id: expect.any(String) }),
    'create',
  )
  expect((mockClearDraft.mock.calls as any[][]).map((call) => call[2])).toEqual(['create'])
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
  await choosePreviousMonthClaimDate(ui)
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

test('周结算详情从统一入口提交带截图的通用补贴并原子进入重新核对', async () => {
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
  expect(ui.getByText('补充本周补贴')).toBeTruthy()
  expect(ui.queryByText('其他费用')).toBeNull()
  expect(ui.getByText('补贴金额 AUD')).toBeTruthy()
  expect(ui.getByText('补贴内容')).toBeTruthy()
  expect(ui.getByTestId('settlement-supplement-note').props.placeholder).toBe('请填写具体补贴内容')

  expect(ui.getByTestId('settlement-projected-total').props.children).toBe('$110.00')
  expect(ui.getByTestId('settlement-supplement-date-value').props.children).toBe('--')
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
  expect(ui.getByTestId('settlement-current-supplement-total').props.children).toEqual(['+ ', '$10.00'])
  expect(ui.getByTestId('settlement-projected-total').props.children).toBe('$120.00')

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

test('结算清单不会向用户裸露后端状态原因代码', () => {
  for (const [code, label] of [
    ['executed_by_different_performer', '任务由其他执行人完成，原执行人不计费'],
    ['deferred_replaced_by_completed_checkin', '延期检查已由实际完成的入住检查替代，不重复计费'],
    ['execution_recorded_after_task_cancelled', '任务取消后仍记录到执行，需要人工核实'],
    ['legacy_execution_task_later_cancelled', '历史执行后任务被取消，需要人工核实'],
    ['cleaning_action_without_done_status', '已记录清洁执行，但任务状态未完成，需要人工核实'],
    ['inspection_action_without_submission_status', '已记录检查执行，但提交状态不完整，需要人工核实'],
  ]) {
    expect(settlementWorkReasonLabel(code)).toBe(label)
  }
})
