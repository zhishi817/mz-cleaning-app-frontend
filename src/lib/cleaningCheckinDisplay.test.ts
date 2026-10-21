import { checkinTimeDisplayPatch, checkinTimeNoteLabel, cleaningSummaryWithCheckinAuthority, hasActualCheckinTask } from './cleaningCheckinDisplay'

describe('cleaning check-in display authority', () => {
  test('checkout time note never presents a created check-in task', () => {
    const checkout: any = { task_type: 'checkout_clean', has_checkin_task: false, phase_history: [{ task_type: 'checkout_clean' }, { task_type: 'checkin_clean' }] }
    expect(hasActualCheckinTask(checkout)).toBe(false)
    expect(checkinTimeDisplayPatch(checkout, '2pm')).toEqual({ has_checkin_task: false, checkin_time_note: '2pm', end_time: null })
    expect(cleaningSummaryWithCheckinAuthority({ checkoutTime: '10am', checkinTime: '2pm', hasCheckinTask: false })).toBe('10am退房')
    expect(checkinTimeNoteLabel({ checkin_time_note: '2pm' })).toBe('入住时间备注：2pm（未创建入住任务）')
  })

  test('explicit or synchronized check-in phase keeps check-in task display', () => {
    const turnover: any = { task_type: 'checkout_clean', phase_history: [{ task_type: 'checkout_clean' }, { task_type: 'checkin_clean' }] }
    expect(hasActualCheckinTask(turnover)).toBe(true)
    expect(hasActualCheckinTask({ ...turnover, has_checkin_task: true })).toBe(true)
    expect(checkinTimeDisplayPatch(turnover, '2pm')).toEqual({ has_checkin_task: true, checkin_time_note: null, end_time: '2pm' })
    expect(cleaningSummaryWithCheckinAuthority({ checkoutTime: '10am', checkinTime: '2pm', hasCheckinTask: true })).toBe('10am退房 2pm入住')
    expect(checkinTimeNoteLabel({ checkin_time_note: null })).toBeNull()
  })
})
