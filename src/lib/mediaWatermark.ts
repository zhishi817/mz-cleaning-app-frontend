/** Capture metadata is evidence. Never substitute a task assignee or the current time. */
export function mediaOperatorName(user: { username?: string | null; display_name?: string | null } | null | undefined): string {
  return String(user?.username || user?.display_name || '').trim() || '未记录'
}

export function melbourneCaptureTime(iso?: string | null): string {
  if (!iso || !String(iso).trim() || !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso)) return '未记录'
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return '未记录'
  try {
    const parts = new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(date)
    const part = (name: string) => parts.find((item) => item.type === name)?.value || ''
    return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')} Melbourne`
  } catch {
    // An unsupported runtime must not silently use the phone's own timezone.
    return '未记录'
  }
}

export function buildMediaWatermark(label: string | null | undefined, operatorName: string | null | undefined, capturedAt?: string | null): string {
  return `${String(label || '').trim() || '未记录'}  操作账号: ${String(operatorName || '').trim() || '未记录'}\n${melbourneCaptureTime(capturedAt)}`
}
