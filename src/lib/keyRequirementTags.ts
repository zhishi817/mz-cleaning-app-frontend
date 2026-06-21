function keyCount(value: any) {
  const count = Number(value)
  return Number.isFinite(count) && count >= 2 ? Math.trunc(count) : 0
}

export function resolveKeyRequirementTags(task: any, options: { hasCheckout: boolean; hasCheckin: boolean; isCheckedOut: boolean }) {
  const taskType = String(task?.task_type || '').trim().toLowerCase()
  const isTurnover = taskType === 'turnover' || (options.hasCheckout && options.hasCheckin)
  const genericSets = keyCount(task?.keys_required)
  const explicitCheckoutSets = keyCount(task?.keys_required_checkout)
  const explicitCheckinSets = keyCount(task?.keys_required_checkin)
  const keyTags = task?.key_tags && typeof task.key_tags === 'object' ? task.key_tags : null

  // A turnover combines two different bookings. Never let the incoming booking's
  // generic key count leak into the outgoing booking's return reminder.
  const checkoutSets = isTurnover
    ? explicitCheckoutSets
    : Math.max(explicitCheckoutSets, keyCount(keyTags?.checkout_sets), options.hasCheckout ? genericSets : 0)
  const checkinSets = isTurnover
    ? explicitCheckinSets
    : Math.max(explicitCheckinSets, keyCount(keyTags?.checkin_sets), options.hasCheckin ? genericSets : 0)

  return {
    checkoutSets,
    checkinSets,
    showCheckout: options.hasCheckout && checkoutSets >= 2,
    showCheckin: checkinSets >= 2,
  }
}
