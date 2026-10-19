import { isValidAustralianAbn, isValidDateOnly, melbourneDateToday } from './personnelSettlementProfile'

test('validates ABN length without a mathematical checksum', () => {
  expect(isValidAustralianAbn('53 004 085 616')).toBe(true)
  expect(isValidAustralianAbn('53 004 085 617')).toBe(true)
  expect(isValidAustralianAbn('1234')).toBe(false)
})

test('formats profile effective dates in Australia/Melbourne', () => {
  expect(melbourneDateToday(new Date('2026-09-09T14:30:00.000Z'))).toBe('2026-09-10')
  expect(isValidDateOnly('2026-09-10')).toBe(true)
  expect(isValidDateOnly('2026-02-30')).toBe(false)
})
