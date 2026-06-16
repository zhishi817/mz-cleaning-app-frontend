import { canSwitchTaskMode } from './roles'

test('task mode switch requires both manager and cleaner roles', () => {
  expect(canSwitchTaskMode({ role: 'finance_staff', roles: ['finance_staff', 'customer_service'] })).toBe(false)
  expect(canSwitchTaskMode({ role: 'customer_service', roles: ['Finance_staff_assistant', 'customer_service'] })).toBe(false)
  expect(canSwitchTaskMode({ role: 'customer_service', roles: ['customer_service', 'cleaner'] })).toBe(true)
  expect(canSwitchTaskMode({ role: 'cleaner', roles: ['cleaner'] })).toBe(false)
})
