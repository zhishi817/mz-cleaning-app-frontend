import {
  isLegacyManagerTaskSaveResponse,
  isManagerTaskSaveReceiptSupported,
  managerTaskPatchFromAuthoritativeUpdates,
  managerTaskSaveEventOperationId,
} from './managerTaskSaveReceipt'

const combinedTask = {
  id: 'turnover:synthetic-1',
  source_type: 'cleaning_tasks',
  source_ids: ['checkout-1', 'checkin-1'],
  active_source_ids: ['checkout-1', 'checkin-1'],
  checkout_time: '10am',
  checkin_time: '3pm',
  start_time: '10am',
  end_time: '3pm',
  guest_special_request: 'before',
  keys_required_checkout: 1,
  keys_required_checkin: 1,
  keys_required: 1,
  summary: '10am退房 3pm入住',
  unrelated_remote_field: 'keep-me',
  turnover_display: {
    old_code_task_id: 'checkout-1',
    new_code_task_id: 'checkin-1',
    old_code: 'OLD-BEFORE',
    new_code: 'NEW-BEFORE',
    unrelated_projection_field: 'keep-me',
  },
  password_authority: {
    old_code_status: 'needs_review',
    new_code_status: 'needs_review',
    unrelated_authority_field: 'keep-me',
  },
}

test('projects a combined-card receipt onto the exact checkout and check-in sides', () => {
  const patch = managerTaskPatchFromAuthoritativeUpdates(combinedTask, [
    {
      task_id: 'checkout-1',
      task_type: 'checkout_clean',
      checkout_time: '10:30am',
      old_code: 'OLD-AFTER',
      old_code_authority_status: 'source_linked',
      old_code_source_task_id: 'checkin-1',
      old_code_source_order_id: 'order-1',
      old_code_source_field: 'new_code',
      guest_special_request: 'after',
      keys_required: 2,
      sequence_no: 101,
    },
    {
      task_id: 'checkin-1',
      task_type: 'checkin_clean',
      checkin_time: '2:30pm',
      new_code: 'NEW-AFTER',
      new_code_authority_status: 'manual_confirmed',
      guest_special_request: 'after',
      keys_required: 1,
      sequence_no: 102,
    },
  ])

  expect(patch).toMatchObject({
    checkout_time: '10:30am',
    start_time: '10:30am',
    checkin_time: '2:30pm',
    end_time: '2:30pm',
    guest_special_request: 'after',
    old_code: 'OLD-AFTER',
    new_code: 'NEW-AFTER',
    keys_required_checkout: 2,
    keys_required_checkin: 1,
    keys_required: 2,
    key_tags: {
      checkout_sets: 2,
      checkin_sets: 1,
      show_checkout: true,
      show_checkin: false,
    },
    summary: '10:30am退房 2:30pm入住',
    turnover_display: {
      old_code: 'OLD-AFTER',
      new_code: 'NEW-AFTER',
      old_code_authority_status: 'source_linked',
      new_code_authority_status: 'manual_confirmed',
      unrelated_projection_field: 'keep-me',
    },
    password_authority: {
      old_code_status: 'source_linked',
      new_code_status: 'manual_confirmed',
      unrelated_authority_field: 'keep-me',
    },
    _managerFieldsSequenceBySource: {
      'checkout-1': 101,
      'checkin-1': 102,
    },
  })
  expect(patch).not.toHaveProperty('unrelated_remote_field')
})

test('clears a stale two-key tag when an authoritative source is reduced to one set', () => {
  const patch = managerTaskPatchFromAuthoritativeUpdates({
    id: 'checkin-1',
    task_type: 'checkin_clean',
    source_ids: ['checkin-1'],
    keys_required: 2,
    keys_required_checkin: 2,
    key_tags: {
      checkin_sets: 2,
      show_checkin: true,
      unrelated_tag_field: 'keep-me',
    },
  }, [{
    task_id: 'checkin-1',
    task_type: 'checkin_clean',
    keys_required: 1,
    sequence_no: 103,
  }])

  expect(patch).toMatchObject({
    keys_required: 1,
    keys_required_checkin: 1,
    key_tags: {
      checkin_sets: 1,
      show_checkin: false,
      unrelated_tag_field: 'keep-me',
    },
  })
})

test('uses final server values when password propagation is protected or unchanged', () => {
  const patch = managerTaskPatchFromAuthoritativeUpdates(combinedTask, [{
    task_id: 'checkout-1',
    task_type: 'checkout_clean',
    old_code: 'MANUAL-PRESERVED',
    old_code_authority_status: 'manual_confirmed',
    old_code_source_task_id: null,
    old_code_source_order_id: null,
    old_code_source_field: 'manual',
    sequence_no: 110,
  }])
  expect(patch).toMatchObject({
    old_code: 'MANUAL-PRESERVED',
    turnover_display: {
      old_code: 'MANUAL-PRESERVED',
      old_code_authority_status: 'manual_confirmed',
      old_code_source_task_id: null,
      old_code_source_order_id: null,
      old_code_source_field: 'manual',
    },
  })
})

test('ignores a delayed older receipt per source while accepting another source update', () => {
  const task = {
    ...combinedTask,
    _managerFieldsSequenceBySource: { 'checkout-1': 200, 'checkin-1': 150 },
  }
  const patch = managerTaskPatchFromAuthoritativeUpdates(task, [
    { task_id: 'checkout-1', task_type: 'checkout_clean', old_code: 'STALE', sequence_no: 199 },
    { task_id: 'checkin-1', task_type: 'checkin_clean', new_code: 'FRESH', sequence_no: 151 },
  ])
  expect(patch).not.toHaveProperty('old_code')
  expect(patch).toMatchObject({
    new_code: 'FRESH',
    _managerFieldsSequenceBySource: { 'checkout-1': 200, 'checkin-1': 151 },
  })
})

test('does not patch cards that do not contain an affected canonical/source id', () => {
  expect(managerTaskPatchFromAuthoritativeUpdates(combinedTask, [{
    task_id: 'other-order-task',
    task_type: 'checkout_clean',
    old_code: 'DO-NOT-LEAK',
    sequence_no: 300,
  }])).toBeNull()
})

test('recognizes the versioned receipt and both exact operation event forms', () => {
  expect(isManagerTaskSaveReceiptSupported({ manager_fields_receipt_version: 1, authoritative_updates: [] })).toBe(true)
  expect(isManagerTaskSaveReceiptSupported({ manager_fields_receipt_version: 1 })).toBe(false)
  expect(isManagerTaskSaveReceiptSupported({ manager_fields_receipt_version: 2, authoritative_updates: [] })).toBe(false)
  expect(isManagerTaskSaveReceiptSupported({
    manager_fields_receipt_version: 1,
    authoritative_updates: [{} as any],
  })).toBe(false)
  expect(isManagerTaskSaveReceiptSupported({
    manager_fields_receipt_version: 1,
    authoritative_updates: [{ task_id: 'checkout-1', task_type: 'checkout_clean' }],
  })).toBe(false)
  expect(isManagerTaskSaveReceiptSupported({
    manager_fields_receipt_version: 1,
    authoritative_updates: [{ task_id: 'checkout-1', task_type: '', old_code: 'SYNTH' }],
  })).toBe(false)
  expect(isManagerTaskSaveReceiptSupported({
    manager_fields_receipt_version: 1,
    authoritative_updates: [{ task_id: 'checkout-1', task_type: 'checkout_clean', keys_required: 3 }],
  })).toBe(false)
  expect(isManagerTaskSaveReceiptSupported({})).toBe(false)
  expect(isLegacyManagerTaskSaveResponse({ ok: true, updated: 1 })).toBe(true)
  expect(isLegacyManagerTaskSaveResponse({ ok: true, manager_fields_receipt_version: 2 })).toBe(false)
  expect(isLegacyManagerTaskSaveResponse({ ok: true, operation_id: 'modern-without-version' })).toBe(false)
  expect(isLegacyManagerTaskSaveResponse(null)).toBe(false)
  expect(managerTaskSaveEventOperationId({ payload: { manager_fields: { operation_id: 'save-1' } } })).toBe('save-1')
  expect(managerTaskSaveEventOperationId({ payload: { password_sync: { request_id: 'save-2' } } })).toBe('save-2')
})
