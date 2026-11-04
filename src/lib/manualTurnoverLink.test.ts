import {
  createManualCleaningRequestId,
  defaultManualTurnoverLinkChoice,
  manualTurnoverLinkDecision,
  normalizeManualTurnoverLinkCandidates,
  reconcileManualTurnoverLinkChoice,
} from './manualTurnoverLink'

const candidate = (id: string) => ({ id, property_id: 'p1', property_code: 'FO1602', task_date: '2026-11-04' })

test('single reliable candidate is selected, zero stays independent and multiple require an explicit choice', () => {
  expect(defaultManualTurnoverLinkChoice([])).toBe('independent')
  expect(defaultManualTurnoverLinkChoice([candidate('checkin-1')])).toBe('checkin-1')
  expect(defaultManualTurnoverLinkChoice([candidate('checkin-1'), candidate('checkin-2')])).toBeNull()
})

test('refresh preserves an explicit valid choice but drops a stale relationship', () => {
  const rows = [candidate('checkin-1'), candidate('checkin-2')]
  expect(reconcileManualTurnoverLinkChoice('checkin-2', rows)).toBe('checkin-2')
  expect(reconcileManualTurnoverLinkChoice('missing', rows)).toBeNull()
  expect(reconcileManualTurnoverLinkChoice('independent', rows)).toBe('independent')
})

test('candidate normalization is a minimal fail-closed DTO and removes duplicates', () => {
  expect(normalizeManualTurnoverLinkCandidates([
    { ...candidate('checkin-1'), checkin_time: '3pm', order_id: 'must-not-leak' },
    { ...candidate('checkin-1'), checkin_time: '4pm' },
    { id: '' },
  ])).toEqual([{ ...candidate('checkin-1'), checkin_time: '3pm', checkout_time: null, status: null, inspection_scope: null }])
})

test('decision payload never guesses a relationship', () => {
  expect(manualTurnoverLinkDecision(null)).toBeNull()
  expect(manualTurnoverLinkDecision('independent')).toEqual({ id: null, decision: 'independent' })
  expect(manualTurnoverLinkDecision('checkin-1')).toEqual({ id: 'checkin-1', decision: 'link' })
})

test('manual create request IDs are UUID v4 and each modal operation gets a new one', () => {
  const first = createManualCleaningRequestId()
  const second = createManualCleaningRequestId()
  expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  expect(second).not.toBe(first)
})
