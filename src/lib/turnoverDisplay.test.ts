import { checkoutTimeForDisplay, cleanGuestRequestText, guestRequestForDisplay, isLateCheckoutDisplay } from './turnoverDisplay'

describe('guest request display', () => {
  it('treats placeholder guest request values as empty', () => {
    expect(cleanGuestRequestText(null)).toBe('')
    expect(cleanGuestRequestText('null')).toBe('')
    expect(cleanGuestRequestText(' undefined ')).toBe('')
    expect(cleanGuestRequestText('无')).toBe('')
  })

  it('returns real guest request text for task display', () => {
    expect(guestRequestForDisplay({ guest_special_request: '保留行李' })).toBe('保留行李')
    expect(guestRequestForDisplay({ guest_special_request: 'null', note: 'none' })).toBe('')
    expect(guestRequestForDisplay({
      turnover_display: { guest_request_summary: '提前入住' },
      guest_special_request: '保留行李',
    })).toBe('提前入住')
  })

  it('does not restore the original checkout timing on a deferred execution-day card', () => {
    const task = {
      deferred_inspection_merged: true,
      deferred_inspection_current_day_checkout: false,
      start_time: '10am',
      is_late_checkout: true,
      turnover_display: { checkout_time: '10am', is_late_checkout: true },
    }
    expect(checkoutTimeForDisplay(task)).toBe('')
    expect(isLateCheckoutDisplay(task)).toBe(false)
  })

  it('retains checkout timing when a real checkout also occurs on the execution day', () => {
    const task = {
      deferred_inspection_merged: true,
      deferred_inspection_current_day_checkout: true,
      start_time: '10am',
      turnover_display: { checkout_time: '10am', is_late_checkout: true },
    }
    expect(checkoutTimeForDisplay(task)).toBe('10am')
    expect(isLateCheckoutDisplay(task)).toBe(true)
  })
})
