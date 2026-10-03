import { cleanGuestRequestText, guestRequestForDisplay } from './turnoverDisplay'

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
})
