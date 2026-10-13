import { canSwitchTaskMode, isTaskManagerUser } from './roles'

test('full task manager visibility is limited to the three business manager roles', () => {
  expect(isTaskManagerUser({ role: 'admin' })).toBe(true)
  expect(isTaskManagerUser({ role: 'offline_manager' })).toBe(true)
  expect(isTaskManagerUser({ role: 'customer_service' })).toBe(true)
  expect(isTaskManagerUser({ role: 'inventory_manager' })).toBe(false)
  expect(isTaskManagerUser({ role: 'cleaner' })).toBe(false)
})

test('task mode switch requires both manager and cleaner roles', () => {
  expect(canSwitchTaskMode({ role: 'finance_staff', roles: ['finance_staff', 'customer_service'] })).toBe(false)
  expect(canSwitchTaskMode({ role: 'customer_service', roles: ['Finance_staff_assistant', 'customer_service'] })).toBe(false)
  expect(canSwitchTaskMode({ role: 'customer_service', roles: ['customer_service', 'cleaner'] })).toBe(true)
  expect(canSwitchTaskMode({ role: 'cleaner', roles: ['cleaner'] })).toBe(false)
})
