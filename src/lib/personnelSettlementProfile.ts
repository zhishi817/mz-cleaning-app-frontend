export type PersonnelGstStatus = 'unconfirmed' | 'registered' | 'not_registered'

export function normalizeAustralianAbn(value: unknown) {
  return String(value ?? '').replace(/\D/g, '')
}

export function isValidAustralianAbn(value: unknown) {
  const digits = normalizeAustralianAbn(value)
  return /^\d{11}$/.test(digits)
}

export function melbourneDateToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Melbourne',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function isValidDateOnly(value: unknown) {
  const text = String(value ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false
  const date = new Date(`${text}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text
}
