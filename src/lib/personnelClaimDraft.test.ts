import {
  emptyPersonnelClaimDraft,
  personnelClaimDraftKey,
  personnelClaimPayloadFromDraft,
} from './personnelClaimDraft'
import { buildPersonnelClaimEvidenceImageSource } from './personnelClaimEvidenceMedia'

test('费用反馈草稿按人员隔离并生成可重试的申报请求', () => {
  expect(personnelClaimDraftKey('cleaner/1')).toBe('personnel-claim-draft:v1:cleaner_1')
  expect(personnelClaimDraftKey('cleaner/1', 'settlement/weekly-1')).toBe('personnel-claim-draft:v1:cleaner_1:settlement_weekly-1')
  const draft = {
    ...emptyPersonnelClaimDraft('2026-09-10'),
    request_id: 'claim_abc12345',
    claim_type: 'overtime_hour' as const,
    duration_minutes: '2.5',
    requested_amount: '75.50',
    note: 'Night shift',
  }
  expect(personnelClaimPayloadFromDraft(draft)).toEqual(expect.objectContaining({
    client_request_id: 'claim_abc12345',
    duration_minutes: 150,
    requested_amount_cents: 7550,
    note: 'Night shift',
  }))
})

test('证明照片只能通过本人鉴权接口显示', () => {
  expect(buildPersonnelClaimEvidenceImageSource('https://api.example.test/api', 'token-1', 'claim/1', 'evidence 1')).toEqual({
    uri: 'https://api.example.test/api/finance/settlements/my-claims/claim%2F1/evidence/evidence%201/image',
    headers: {
      Authorization: 'Bearer token-1',
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
    },
  })
  expect(buildPersonnelClaimEvidenceImageSource('https://api.example.test', '', 'claim-1', 'evidence-1')).toBeNull()
})
