export function normalizeAuMobile(input: string) {
  const raw = String(input || '').replace(/[^\d+]/g, '')
  if (raw.startsWith('+')) return raw
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('61')) return `+${digits}`
  if (digits.startsWith('0')) return `+61${digits.slice(1)}`
  return `+61${digits}`
}

