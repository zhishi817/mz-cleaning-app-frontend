import { normalizeHttpUrl } from './urls'

test('normalizes plain and legacy html links', () => {
  expect(normalizeHttpUrl('example.com/guide')).toBe('https://example.com/guide')
  expect(normalizeHttpUrl('<a href="https://example.com/public/guide">Guide</a>')).toBe('https://example.com/public/guide')
  expect(normalizeHttpUrl('')).toBeNull()
})
