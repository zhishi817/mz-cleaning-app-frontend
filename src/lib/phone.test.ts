import { normalizeAuMobile } from './phone'

test('normalizeAuMobile converts 04xx to +61', () => {
  expect(normalizeAuMobile('0412 345 678')).toBe('+61412345678')
})

test('normalizeAuMobile keeps +61', () => {
  expect(normalizeAuMobile('+61412345678')).toBe('+61412345678')
})

test('normalizeAuMobile converts 61 prefix', () => {
  expect(normalizeAuMobile('61412345678')).toBe('+61412345678')
})

