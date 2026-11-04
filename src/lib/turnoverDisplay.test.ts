import { checkoutTimeForDisplay, cleanGuestRequestText, guestRequestForDisplay, isLateCheckoutDisplay, newCodeForDisplay, oldCodeForDisplay, passwordTaskIdsForFields } from './turnoverDisplay'

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

  it('treats a null turnover password projection as authoritative over stale cached top-level values', () => {
    const task = {
      old_code: 'stale-old',
      new_code: 'stale-new',
      turnover_display: { old_code: null, new_code: null },
    }
    expect(oldCodeForDisplay(task)).toBe('')
    expect(newCodeForDisplay(task)).toBe('')
  })

  it('clears a legacy cached old password after the authoritative API projection arrives empty', () => {
    const legacyCachedTask = { old_code: 'cached-current-task-value' }
    expect(oldCodeForDisplay(legacyCachedTask)).toBe('cached-current-task-value')

    const refreshedTask = {
      ...legacyCachedTask,
      turnover_display: {
        old_code: null,
        old_code_authority_status: 'missing_authority',
      },
    }
    expect(oldCodeForDisplay(refreshedTask)).toBe('')
  })

  it('uses the gated top-level value only when the server did not provide a turnover projection', () => {
    expect(oldCodeForDisplay({ task_type: 'checkout_clean', old_code: 'manual-current' })).toBe('manual-current')
    expect(newCodeForDisplay({ new_code: 'new-current' })).toBe('new-current')
    expect(newCodeForDisplay({ task_type: 'checkin_clean', new_code: 'checkin-new-current' })).toBe('checkin-new-current')
  })

  it('never displays an old password on a pure check-in task', () => {
    expect(oldCodeForDisplay({
      task_type: 'checkin_clean',
      old_code: 'legacy-checkin-old',
      turnover_display: { old_code: 'legacy-checkin-old' },
    })).toBe('')
  })

  it('never displays a stale new password on a checkout-only task', () => {
    expect(newCodeForDisplay({
      task_type: 'checkout_clean',
      new_code: 'legacy-checkout-new',
      turnover_display: { new_code: 'legacy-checkout-new' },
    })).toBe('')
  })

  it('uses turnover side metadata even when a legacy payload omitted task_type', () => {
    expect(newCodeForDisplay({
      new_code: 'stale-checkout-new',
      turnover_display: { checkout_order_id: 'checkout-order', new_code: 'stale-checkout-new' },
    })).toBe('')
    expect(oldCodeForDisplay({
      old_code: 'stale-checkin-old',
      turnover_display: { checkin_order_id: 'checkin-order', old_code: 'stale-checkin-old' },
    })).toBe('')
    expect(newCodeForDisplay({
      turnover_display: { new_code_task_id: 'orderless-checkin-task', new_code: 'orderless-new' },
    })).toBe('orderless-new')
    expect(newCodeForDisplay({ new_code: 'legacy-new-without-side-metadata' })).toBe('legacy-new-without-side-metadata')
    expect(oldCodeForDisplay({ old_code: 'legacy-old-without-side-metadata' })).toBe('legacy-old-without-side-metadata')
  })

  it('uses exact password targets independently of blank values and never falls back to execution sources', () => {
    const checkoutOnlyExecutionCard = {
      active_source_ids: ['checkout-source'],
      source_id: 'checkout-source',
      turnover_display: {
        old_code: null,
        old_code_task_id: 'checkout-source',
        new_code: null,
        new_code_task_id: 'checkin-source',
        active_source_ids: ['checkout-source'],
      },
    }
    expect(passwordTaskIdsForFields(checkoutOnlyExecutionCard, ['new_code'])).toEqual(['checkin-source'])
    expect(passwordTaskIdsForFields(checkoutOnlyExecutionCard, ['old_code', 'new_code'])).toEqual(['checkout-source', 'checkin-source'])

    const staleCachedProjection = {
      ...checkoutOnlyExecutionCard,
      turnover_display: {
        ...checkoutOnlyExecutionCard.turnover_display,
        new_code_task_id: null,
      },
    }
    expect(passwordTaskIdsForFields(staleCachedProjection, ['new_code'])).toEqual([])
    expect(passwordTaskIdsForFields(staleCachedProjection, ['old_code', 'new_code'])).toEqual([])
  })

  it('fails closed when two password fields claim the same target task', () => {
    expect(passwordTaskIdsForFields({
      turnover_display: {
        old_code_task_id: 'ambiguous-shared-target',
        new_code_task_id: 'ambiguous-shared-target',
      },
    }, ['old_code', 'new_code'])).toEqual([])
  })
})
