import { resolveKeyRequirementTags } from './keyRequirementTags'

test('same-day turnover keeps incoming two-key requirement off the outgoing checkout', () => {
  expect(resolveKeyRequirementTags(
    {
      task_type: 'turnover',
      keys_required: 2,
      keys_required_checkout: 1,
      keys_required_checkin: 2,
      key_tags: {
        checkout_sets: 1,
        checkin_sets: 2,
        show_checkout: false,
        show_checkin: true,
      },
    },
    { hasCheckout: true, hasCheckin: true, isCheckedOut: false },
  )).toEqual({
    checkoutSets: 0,
    checkinSets: 2,
    showCheckout: false,
    showCheckin: true,
  })
})

test('the same booking shows the two-key return reminder on its later checkout', () => {
  expect(resolveKeyRequirementTags(
    {
      task_type: 'checkout_clean',
      keys_required: 2,
      keys_required_checkout: 2,
    },
    { hasCheckout: true, hasCheckin: false, isCheckedOut: false },
  )).toEqual({
    checkoutSets: 2,
    checkinSets: 0,
    showCheckout: true,
    showCheckin: false,
  })
})

test('marking the guest checked out does not hide the two-key return confirmation', () => {
  expect(resolveKeyRequirementTags(
    {
      task_type: 'checkout_clean',
      keys_required: 2,
      keys_required_checkout: 2,
    },
    { hasCheckout: true, hasCheckin: false, isCheckedOut: true },
  ).showCheckout).toBe(true)
})

test('checkout-only cleaning still shows keys needed for the next incoming guest', () => {
  expect(resolveKeyRequirementTags(
    {
      task_type: 'checkout_clean',
      keys_required: 1,
      keys_required_checkout: 1,
      keys_required_checkin: 2,
    },
    { hasCheckout: true, hasCheckin: false, isCheckedOut: false },
  )).toEqual({
    checkoutSets: 0,
    checkinSets: 2,
    showCheckout: false,
    showCheckin: true,
  })
})

test('turnover does not infer either direction from an ambiguous generic value', () => {
  expect(resolveKeyRequirementTags(
    {
      task_type: 'turnover',
      keys_required: 2,
    },
    { hasCheckout: true, hasCheckin: true, isCheckedOut: false },
  )).toEqual({
    checkoutSets: 0,
    checkinSets: 0,
    showCheckout: false,
    showCheckin: false,
  })
})
