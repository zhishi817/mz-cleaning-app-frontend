export const TASK_BUSINESS_TIME_ZONE = 'Australia/Melbourne'

const formatter = new Intl.DateTimeFormat('en-AU', {
  timeZone: TASK_BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function taskBusinessDateKey(date: Date = new Date()) {
  const parts = formatter.formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  if (!year || !month || !day) throw new Error('task_business_timezone_unavailable')
  return `${year}-${month}-${day}`
}

export function millisecondsUntilNextTaskBusinessDate(now: Date = new Date()) {
  const start = now.getTime()
  const currentKey = taskBusinessDateKey(now)
  let low = start
  let high = start + 36 * 60 * 60 * 1000
  while (taskBusinessDateKey(new Date(high)) === currentKey && high < start + 72 * 60 * 60 * 1000) {
    high += 6 * 60 * 60 * 1000
  }
  if (taskBusinessDateKey(new Date(high)) === currentKey) return 24 * 60 * 60 * 1000
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2)
    if (taskBusinessDateKey(new Date(middle)) === currentKey) low = middle
    else high = middle
  }
  return Math.max(1000, high - start)
}

export function shouldFollowTaskBusinessDate(params: {
  period: 'today' | 'week' | 'month'
  selectedDate: string
  previousBusinessDate: string
  nextBusinessDate: string
}) {
  return params.period === 'today'
    && params.previousBusinessDate !== params.nextBusinessDate
    && params.selectedDate === params.previousBusinessDate
}
