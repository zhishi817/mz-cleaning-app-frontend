import { buildManagerTaskFieldItems, managerTaskSaveOperation, managerTaskSavePayloadSignature } from './managerTaskSaveOperation'

describe('buildManagerTaskFieldItems', () => {
  test('keeps checkout/checkin times on exact tasks and shared guest request on both', () => {
    expect(buildManagerTaskFieldItems({
      taskIds: ['checkin-1', 'checkout-1'],
      checkoutTaskId: 'checkout-1',
      checkinTaskId: 'checkin-1',
      fields: { checkout_time: '10:00', checkin_time: '15:00', guest_special_request: 'cot' },
    })).toEqual([
      { id: 'checkin-1', checkin_time: '15:00', guest_special_request: 'cot' },
      { id: 'checkout-1', checkout_time: '10:00', guest_special_request: 'cot' },
    ])
  })

  test('fails closed when a multi-source time target is absent', () => {
    expect(() => buildManagerTaskFieldItems({
      taskIds: ['checkin-1', 'checkout-1'],
      fields: { checkout_time: '10:00' },
    })).toThrow('checkout_time_target_missing')
  })

  test('canonical signature ignores nested field insertion order', () => {
    expect(managerTaskSavePayloadSignature({
      task_ids: ['task-1'],
      items: [{ id: 'task-1', checkout_time: '10am', guest_special_request: 'cot' }],
    })).toBe(managerTaskSavePayloadSignature({
      items: [{ guest_special_request: 'cot', checkout_time: '10am', id: 'task-1' }],
      task_ids: ['task-1'],
    }))
  })
})

test('a failed save retry reuses the operation id for the same complete payload', () => {
  let sequence = 0
  const createId = () => `mobile-manager-save-${++sequence}`
  const payload = {
    task_ids: ['checkout-1', 'checkin-1'],
    password_task_ids: ['checkout-1', 'checkin-1'],
    checkout_time: '11am',
    checkin_time: '3pm',
    old_code: 'SYNTH-OLD',
    new_code: 'SYNTH-NEW',
    guest_special_request: 'synthetic request',
    keys_required: 2,
    password_verification: { fields: ['old_code', 'new_code'], request_id: 'temporary', client: 'mobile' },
  }
  const first = managerTaskSaveOperation(null, payload, createId)
  const retry = managerTaskSaveOperation(first, {
    ...payload,
    task_ids: ['checkin-1', 'checkout-1'],
    password_task_ids: ['checkin-1', 'checkout-1'],
    password_verification: { ...payload.password_verification, fields: ['new_code', 'old_code'], request_id: 'different-temporary' },
  }, createId)
  expect(retry).toEqual(first)
  expect(sequence).toBe(1)
})

test('changed user intent gets a new operation id and a successful operation can be cleared', () => {
  let sequence = 0
  const createId = () => `mobile-manager-save-${++sequence}`
  const first = managerTaskSaveOperation(null, { task_ids: ['task-1'], guest_special_request: 'first' }, createId)
  const changed = managerTaskSaveOperation(first, { task_ids: ['task-1'], guest_special_request: 'second' }, createId)
  const laterSameContent = managerTaskSaveOperation(null, { task_ids: ['task-1'], guest_special_request: 'first' }, createId)
  expect(changed.id).not.toBe(first.id)
  expect(laterSameContent.id).not.toBe(first.id)
  expect(sequence).toBe(3)
})

test('operation and password request ids do not affect the payload signature', () => {
  expect(managerTaskSavePayloadSignature({
    operation_id: 'operation-a',
    task_ids: ['task-1'],
    new_code: 'SYNTH',
    password_verification: { fields: ['new_code'], request_id: 'request-a', client: 'mobile' },
  })).toBe(managerTaskSavePayloadSignature({
    operation_id: 'operation-b',
    task_ids: ['task-1'],
    new_code: 'SYNTH',
    password_verification: { fields: ['new_code'], request_id: 'request-b', client: 'mobile' },
  }))
})
