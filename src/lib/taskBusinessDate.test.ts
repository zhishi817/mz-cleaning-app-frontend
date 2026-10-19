import { millisecondsUntilNextTaskBusinessDate, shouldFollowTaskBusinessDate, taskBusinessDateKey } from './taskBusinessDate'

describe('taskBusinessDate', () => {
  it('advances at Melbourne midnight when DST begins', () => {
    expect(taskBusinessDateKey(new Date('2026-10-03T13:59:59.000Z'))).toBe('2026-10-03')
    expect(taskBusinessDateKey(new Date('2026-10-03T14:00:01.000Z'))).toBe('2026-10-04')
  })

  it('keeps a single business date across the repeated DST fallback hour', () => {
    expect(taskBusinessDateKey(new Date('2026-04-04T15:30:00.000Z'))).toBe('2026-04-05')
    expect(taskBusinessDateKey(new Date('2026-04-04T16:30:00.000Z'))).toBe('2026-04-05')
  })

  it('schedules the next Melbourne midnight across a 23-hour DST start day', () => {
    expect(millisecondsUntilNextTaskBusinessDate(new Date('2026-10-03T14:00:00.000Z'))).toBe(23 * 60 * 60 * 1000)
  })

  it('only advances a selected date that was following Today', () => {
    expect(shouldFollowTaskBusinessDate({
      period: 'today',
      selectedDate: '2026-10-03',
      previousBusinessDate: '2026-10-03',
      nextBusinessDate: '2026-10-04',
    })).toBe(true)
    expect(shouldFollowTaskBusinessDate({
      period: 'today',
      selectedDate: '2026-09-30',
      previousBusinessDate: '2026-10-03',
      nextBusinessDate: '2026-10-04',
    })).toBe(false)
    expect(shouldFollowTaskBusinessDate({
      period: 'week',
      selectedDate: '2026-10-03',
      previousBusinessDate: '2026-10-03',
      nextBusinessDate: '2026-10-04',
    })).toBe(false)
  })
})
