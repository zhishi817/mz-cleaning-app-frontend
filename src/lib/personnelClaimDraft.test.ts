import {
  assertPersonnelClaimDraftTarget,
  emptyPersonnelClaimDraft,
  loadPersonnelClaimDraft,
  loadPersonnelClaimDraftForTarget,
  personnelClaimCreateDraftScope,
  personnelClaimDraftKey,
  personnelClaimEditDraftScope,
  personnelClaimPayloadFromDraft,
  savePersonnelClaimDraft,
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

test('新增和每条修改草稿使用独立 scope，旧默认编辑草稿迁移后不会混入新增', async () => {
  expect(personnelClaimCreateDraftScope()).toBe('create')
  expect(personnelClaimEditDraftScope('claim/old')).toBe('edit_claim_old')
  const legacyEdit = {
    ...emptyPersonnelClaimDraft('2026-09-16'),
    claim_id: 'claim-old',
    expected_updated_at: '2026-09-17T01:02:03.000Z',
    note: '旧编辑说明',
    media: [{
      media_id: 'media-old', local_uri: 'file:///old-proof.jpg', name: 'old-proof.jpg', mime_type: 'image/jpeg', state: 'local_only' as const,
    }],
    updated_at: '2026-09-17T02:00:00.000Z',
  }
  await savePersonnelClaimDraft('cleaner/1', legacyEdit)

  expect(await loadPersonnelClaimDraftForTarget('cleaner/1', { mode: 'create' })).toBeNull()
  expect(await loadPersonnelClaimDraft('cleaner/1')).toBeNull()
  expect(await loadPersonnelClaimDraftForTarget('cleaner/1', { mode: 'edit', claimId: 'claim-old' })).toEqual(expect.objectContaining({
    claim_id: 'claim-old', note: '旧编辑说明', media: [expect.objectContaining({ media_id: 'media-old', local_uri: 'file:///old-proof.jpg' })],
  }))

  const createDraft = { ...emptyPersonnelClaimDraft('2026-10-01'), note: '独立新增草稿' }
  await savePersonnelClaimDraft('cleaner/1', createDraft)
  expect(await loadPersonnelClaimDraftForTarget('cleaner/1', { mode: 'create' })).toEqual(expect.objectContaining({
    claim_id: null, note: '独立新增草稿',
  }))
  expect(await loadPersonnelClaimDraftForTarget('cleaner/1', { mode: 'edit', claimId: 'claim-old' })).toEqual(expect.objectContaining({
    claim_id: 'claim-old', note: '旧编辑说明',
  }))
})

test('scope 身份不匹配时阻止新增误更新旧 claim', () => {
  const editDraft = { ...emptyPersonnelClaimDraft('2026-09-16'), claim_id: 'claim-old' }
  expect(() => assertPersonnelClaimDraftTarget(editDraft, { mode: 'create' })).toThrow('claim_draft_scope_mismatch')
  expect(() => assertPersonnelClaimDraftTarget(editDraft, { mode: 'edit', claimId: 'claim-other' })).toThrow('claim_draft_scope_mismatch')
  expect(() => assertPersonnelClaimDraftTarget(editDraft, { mode: 'edit', claimId: 'claim-old' })).not.toThrow()
})

test('错误 scope 中的旧编辑草稿会无损归位且不再占用新增 scope', async () => {
  const misplacedEdit = {
    ...emptyPersonnelClaimDraft('2026-09-20'),
    claim_id: 'claim-misplaced',
    note: '错误放在新增 scope 的编辑草稿',
    media: [{
      media_id: 'media-misplaced', local_uri: 'file:///misplaced.jpg', name: 'misplaced.jpg',
      mime_type: 'image/jpeg', state: 'local_only' as const,
    }],
  }
  await savePersonnelClaimDraft('cleaner/misplaced', misplacedEdit, personnelClaimCreateDraftScope())

  expect(await loadPersonnelClaimDraftForTarget('cleaner/misplaced', { mode: 'create' })).toBeNull()
  expect(await loadPersonnelClaimDraft('cleaner/misplaced', personnelClaimCreateDraftScope())).toBeNull()
  expect(await loadPersonnelClaimDraftForTarget('cleaner/misplaced', { mode: 'edit', claimId: 'claim-misplaced' })).toEqual(expect.objectContaining({
    claim_id: 'claim-misplaced',
    note: '错误放在新增 scope 的编辑草稿',
    media: [expect.objectContaining({ media_id: 'media-misplaced', local_uri: 'file:///misplaced.jpg' })],
  }))
})

test('修改待核对反馈保留原工作日期并携带并发版本', () => {
  const draft = {
    ...emptyPersonnelClaimDraft('2026-10-03'),
    claim_id: 'claim-submitted',
    expected_updated_at: '2026-10-04T01:02:03.000Z',
    claim_type: 'overtime_hour' as const,
    duration_minutes: '2',
    note: '9/28 周加班',
  }
  expect(personnelClaimPayloadFromDraft(draft)).toEqual(expect.objectContaining({
    service_date: '2026-10-03',
    expected_updated_at: '2026-10-04T01:02:03.000Z',
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
