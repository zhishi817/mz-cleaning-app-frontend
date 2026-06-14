export function parseTaskTimeMinutes(value: any) {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return null
  const s = raw.replace(/\s+/g, '')
  const m12 = s.match(/^(\d{1,2})(?::(\d{1,2}))?(am|pm)$/)
  if (m12) {
    let hour = Number(m12[1] || 0)
    const minute = Number(m12[2] || 0)
    if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute < 0 || minute > 59) return null
    hour = hour % 12
    if (m12[3] === 'pm') hour += 12
    return hour * 60 + minute
  }
  const m24 = s.match(/^(\d{1,2})(?::(\d{1,2}))?$/)
  if (m24) {
    const hour = Number(m24[1] || 0)
    const minute = Number(m24[2] || 0)
    if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
    return hour * 60 + minute
  }
  return null
}

export function isEarlyCheckinTime(value: any) {
  const mins = parseTaskTimeMinutes(value)
  return mins != null && mins < 15 * 60
}

export function canSkipInspectionPhotosForGuestArrival(value: any) {
  const mins = parseTaskTimeMinutes(value)
  return mins != null && mins >= 15 * 60
}
