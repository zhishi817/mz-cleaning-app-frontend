export type ManagerTaskAuthoritativeUpdate = {
  task_id: string
  task_type?: string | null
  scheduled_date?: string | null
  checkout_time?: string | null
  checkin_time?: string | null
  old_code?: string | null
  new_code?: string | null
  guest_special_request?: string | null
  keys_required?: number | null
  old_code_authority_status?: string | null
  new_code_authority_status?: string | null
  old_code_source_task_id?: string | null
  old_code_source_order_id?: string | null
  old_code_source_field?: string | null
  updated_at?: string | null
  task_version?: number | null
  sequence_no?: number | null
}

export type ManagerTaskSaveReceipt = {
  operation_id?: string | null
  manager_fields_receipt_version?: number | null
  authoritative_updates?: ManagerTaskAuthoritativeUpdate[] | null
  projection_refresh_required?: boolean | null
}

type TaskLike = Record<string, any> & { id?: string | null }

function text(value: unknown) {
  return String(value ?? '').trim()
}

function normalizedTaskIds(task: TaskLike) {
  return new Set([
    task.id,
    task.task_id,
    task.source_id,
    ...(Array.isArray(task.source_ids) ? task.source_ids : []),
    ...(Array.isArray(task.active_source_ids) ? task.active_source_ids : []),
    ...(Array.isArray(task.superseded_source_ids) ? task.superseded_source_ids : []),
    ...(Array.isArray(task.all_related_source_ids) ? task.all_related_source_ids : []),
    ...(Array.isArray(task.cleaning_task_ids) ? task.cleaning_task_ids : []),
    ...(Array.isArray(task.inspection_task_ids) ? task.inspection_task_ids : []),
    ...(Array.isArray(task.execution_task_ids) ? task.execution_task_ids : []),
  ].map(text).filter(Boolean))
}

function normalizedAuthorityStatus(value: unknown) {
  const status = text(value).toLowerCase()
  return status || null
}

function normalizedKeyCount(value: unknown) {
  const count = Number(value)
  return Number.isFinite(count) && count >= 2 ? 2 : 1
}

function summaryForTimes(checkoutTime: unknown, checkinTime: unknown, previous: unknown) {
  const checkout = text(checkoutTime)
  const checkin = text(checkinTime)
  if (checkout && checkin) return `${checkout}退房 ${checkin}入住`
  if (checkout) return `${checkout}退房`
  if (checkin) return `${checkin}入住`
  return previous ?? null
}

function hasOwn(object: object, key: string) {
  return Object.prototype.hasOwnProperty.call(object, key)
}

const authoritativeStringFields = [
  'scheduled_date',
  'checkout_time',
  'checkin_time',
  'old_code',
  'new_code',
  'guest_special_request',
  'old_code_authority_status',
  'new_code_authority_status',
  'old_code_source_task_id',
  'old_code_source_order_id',
  'old_code_source_field',
  'updated_at',
] as const

const authoritativePatchFields = [
  'checkout_time',
  'checkin_time',
  'old_code',
  'new_code',
  'guest_special_request',
  'keys_required',
  'old_code_authority_status',
  'new_code_authority_status',
  'old_code_source_task_id',
  'old_code_source_order_id',
  'old_code_source_field',
] as const

function isManagerTaskAuthoritativeUpdate(value: unknown): value is ManagerTaskAuthoritativeUpdate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const update = value as Record<string, unknown>
  if (typeof update.task_id !== 'string' || !update.task_id.trim()) return false
  if (typeof update.task_type !== 'string' || !update.task_type.trim()) return false
  if (!authoritativePatchFields.some((field) => hasOwn(update, field))) return false
  if (authoritativeStringFields.some((field) => (
    hasOwn(update, field) && update[field] !== null && typeof update[field] !== 'string'
  ))) return false
  if (hasOwn(update, 'keys_required') && update.keys_required !== null) {
    const keysRequired = Number(update.keys_required)
    if (!Number.isFinite(keysRequired) || keysRequired < 1 || keysRequired > 2) return false
  }
  for (const field of ['task_version', 'sequence_no'] as const) {
    if (!hasOwn(update, field) || update[field] === null) continue
    const value0 = Number(update[field])
    if (!Number.isFinite(value0) || value0 < 0) return false
  }
  return true
}

export function isLegacyManagerTaskSaveResponse(receipt: unknown) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return false
  return ![
    'operation_id',
    'manager_fields_receipt_version',
    'authoritative_updates',
    'projection_refresh_required',
  ].some((field) => hasOwn(receipt as object, field))
}

function applicableUpdates(task: TaskLike, updates: ManagerTaskAuthoritativeUpdate[]) {
  const ids = normalizedTaskIds(task)
  return updates
    .filter((update) => ids.has(text(update?.task_id)))
    .sort((a, b) => Number(a.sequence_no || 0) - Number(b.sequence_no || 0))
}

export function managerTaskPatchFromAuthoritativeUpdates(
  task: TaskLike,
  updates0: ManagerTaskAuthoritativeUpdate[],
) {
  const updates = applicableUpdates(task, Array.isArray(updates0) ? updates0 : [])
  if (!updates.length) return null

  const sequenceBySource = {
    ...((task._managerFieldsSequenceBySource && typeof task._managerFieldsSequenceBySource === 'object')
      ? task._managerFieldsSequenceBySource
      : {}),
  } as Record<string, number>
  const accepted = updates.filter((update) => {
    const taskId = text(update.task_id)
    const sequence = Number(update.sequence_no || 0)
    const previous = Number(sequenceBySource[taskId] || 0)
    if (sequence && previous && sequence < previous) return false
    if (sequence) sequenceBySource[taskId] = sequence
    return true
  })
  if (!accepted.length) return null

  const patch: Record<string, any> = {
    _managerFieldsSequenceBySource: sequenceBySource,
  }
  const turnoverDisplay = {
    ...((task.turnover_display && typeof task.turnover_display === 'object') ? task.turnover_display : {}),
  }
  const passwordAuthority = {
    ...((task.password_authority && typeof task.password_authority === 'object') ? task.password_authority : {}),
  }
  const keyTags = {
    ...((task.key_tags && typeof task.key_tags === 'object') ? task.key_tags : {}),
  }
  let turnoverChanged = false
  let authorityChanged = false
  let checkoutTime = task.checkout_time ?? task.start_time ?? null
  let checkinTime = task.checkin_time ?? task.end_time ?? task.checkin_time_note ?? null
  let checkoutKeys = normalizedKeyCount(task.keys_required_checkout ?? task.keys_required ?? 1)
  let checkinKeys = normalizedKeyCount(task.keys_required_checkin ?? task.keys_required ?? 1)
  let keysChanged = false

  for (const update of accepted) {
    const taskId = text(update.task_id)
    const taskType = text(update.task_type).toLowerCase()
    const isCheckout = taskType === 'checkout_clean'
    const isCheckin = taskType === 'checkin_clean'
    const isExactOldTarget = text(turnoverDisplay.old_code_task_id) === taskId
      || (isCheckout && !text(turnoverDisplay.old_code_task_id))
    const isExactNewTarget = text(turnoverDisplay.new_code_task_id) === taskId
      || (isCheckin && !text(turnoverDisplay.new_code_task_id))

    if (isCheckout && hasOwn(update, 'checkout_time')) {
      checkoutTime = update.checkout_time ?? null
      patch.checkout_time = checkoutTime
      patch.start_time = checkoutTime
    }
    if (isCheckin && hasOwn(update, 'checkin_time')) {
      checkinTime = update.checkin_time ?? null
      patch.checkin_time = checkinTime
      patch.end_time = checkinTime
      patch.checkin_time_note = null
      patch.has_checkin_task = true
    }
    if (hasOwn(update, 'guest_special_request')) patch.guest_special_request = update.guest_special_request ?? null

    if (isExactOldTarget) {
      if (hasOwn(update, 'old_code')) {
        patch.old_code = update.old_code ?? null
        turnoverDisplay.old_code = update.old_code ?? null
        turnoverChanged = true
      }
      if (hasOwn(update, 'old_code_authority_status')) {
        const status = normalizedAuthorityStatus(update.old_code_authority_status)
        turnoverDisplay.old_code_authority_status = status
        passwordAuthority.old_code_status = status
        authorityChanged = true
        turnoverChanged = true
      }
      if (hasOwn(update, 'old_code_source_task_id')) {
        turnoverDisplay.old_code_source_task_id = update.old_code_source_task_id ?? null
        turnoverChanged = true
      }
      if (hasOwn(update, 'old_code_source_order_id')) {
        turnoverDisplay.old_code_source_order_id = update.old_code_source_order_id ?? null
        turnoverChanged = true
      }
      if (hasOwn(update, 'old_code_source_field')) {
        turnoverDisplay.old_code_source_field = update.old_code_source_field ?? null
        turnoverChanged = true
      }
    }
    if (isExactNewTarget) {
      if (hasOwn(update, 'new_code')) {
        patch.new_code = update.new_code ?? null
        turnoverDisplay.new_code = update.new_code ?? null
        turnoverChanged = true
      }
      if (hasOwn(update, 'new_code_authority_status')) {
        const status = normalizedAuthorityStatus(update.new_code_authority_status)
        turnoverDisplay.new_code_authority_status = status
        passwordAuthority.new_code_status = status
        authorityChanged = true
        turnoverChanged = true
      }
    }

    if (hasOwn(update, 'keys_required')) {
      const keys = normalizedKeyCount(update.keys_required)
      if (isCheckout) checkoutKeys = keys
      if (isCheckin) checkinKeys = keys
      keysChanged = isCheckout || isCheckin || keysChanged
    }
    if (hasOwn(update, 'updated_at')) patch.updated_at = update.updated_at ?? null
  }

  if (turnoverChanged) patch.turnover_display = turnoverDisplay
  if (authorityChanged) patch.password_authority = passwordAuthority
  if (keysChanged) {
    const hasCheckout = accepted.some((update) => text(update.task_type).toLowerCase() === 'checkout_clean')
      || Boolean(text(turnoverDisplay.old_code_task_id))
    const hasCheckin = accepted.some((update) => text(update.task_type).toLowerCase() === 'checkin_clean')
      || Boolean(text(turnoverDisplay.new_code_task_id))
    if (hasCheckout) {
      patch.keys_required_checkout = checkoutKeys
      keyTags.checkout_sets = checkoutKeys
      keyTags.show_checkout = checkoutKeys >= 2
    }
    if (hasCheckin) {
      patch.keys_required_checkin = checkinKeys
      keyTags.checkin_sets = checkinKeys
      keyTags.show_checkin = checkinKeys >= 2
    }
    patch.keys_required = Math.max(hasCheckout ? checkoutKeys : 1, hasCheckin ? checkinKeys : 1)
    patch.key_tags = keyTags
  }
  if (hasOwn(patch, 'checkout_time') || hasOwn(patch, 'checkin_time')) {
    patch.summary = summaryForTimes(checkoutTime, checkinTime, task.summary)
  }
  return patch
}

export function managerTaskSaveReceiptOperationId(receipt: ManagerTaskSaveReceipt | null | undefined) {
  return text(receipt?.operation_id)
}

export function isManagerTaskSaveReceiptSupported(receipt: ManagerTaskSaveReceipt | null | undefined) {
  return Number(receipt?.manager_fields_receipt_version || 0) === 1
    && Array.isArray(receipt?.authoritative_updates)
    && receipt.authoritative_updates.every(isManagerTaskAuthoritativeUpdate)
}

export function managerTaskSaveEventOperationId(event: any) {
  return text(
    event?.payload?.manager_fields?.operation_id
      || event?.payload?.password_sync?.request_id,
  )
}
