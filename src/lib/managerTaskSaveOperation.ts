type ManagerFieldsPayload = Record<string, any>

type ManagerTaskFieldValues = {
  checkout_time?: string | null
  checkin_time?: string | null
  guest_special_request?: string | null
}

export type ManagerTaskFieldItem = ManagerTaskFieldValues & { id: string }

export type ManagerTaskSaveOperation = {
  id: string
  signature: string
}

function sortedUniqueText(values: unknown) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean)))
    .sort()
}

function canonicalValue(value: any): any {
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => [key, canonicalValue(value[key])]),
  )
}

export function buildManagerTaskFieldItems(params: {
  taskIds: string[]
  checkoutTaskId?: string | null
  checkinTaskId?: string | null
  fields: ManagerTaskFieldValues
}): ManagerTaskFieldItem[] {
  const taskIds = sortedUniqueText(params.taskIds)
  const taskSet = new Set(taskIds)
  const byId = new Map<string, ManagerTaskFieldItem>()
  const item = (id: string) => {
    const current = byId.get(id) || { id }
    byId.set(id, current)
    return current
  }
  const exactTarget = (raw: unknown, field: string) => {
    const requested = String(raw || '').trim()
    if (requested && taskSet.has(requested)) return requested
    if (taskIds.length === 1) return taskIds[0]
    throw new Error(`${field}_target_missing`)
  }
  if (params.fields.checkout_time !== undefined) {
    item(exactTarget(params.checkoutTaskId, 'checkout_time')).checkout_time = params.fields.checkout_time
  }
  if (params.fields.checkin_time !== undefined) {
    item(exactTarget(params.checkinTaskId, 'checkin_time')).checkin_time = params.fields.checkin_time
  }
  if (params.fields.guest_special_request !== undefined) {
    for (const id of taskIds) item(id).guest_special_request = params.fields.guest_special_request
  }
  return Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id))
}

export function managerTaskSavePayloadSignature(payload: ManagerFieldsPayload) {
  const verification = payload?.password_verification
  return JSON.stringify(canonicalValue({
    ...payload,
    operation_id: undefined,
    task_ids: sortedUniqueText(payload?.task_ids),
    items: Array.isArray(payload?.items)
      ? [...payload.items]
          .map((entry) => ({ ...entry, id: String(entry?.id || '').trim() }))
          .sort((a, b) => a.id.localeCompare(b.id))
      : undefined,
    password_task_ids: payload?.password_task_ids == null
      ? undefined
      : sortedUniqueText(payload.password_task_ids),
    password_verification: verification == null
      ? undefined
      : {
          ...verification,
          request_id: undefined,
          fields: sortedUniqueText(verification.fields),
        },
  }))
}

export function managerTaskSaveOperation(
  current: ManagerTaskSaveOperation | null,
  payload: ManagerFieldsPayload,
  createId: () => string,
): ManagerTaskSaveOperation {
  const signature = managerTaskSavePayloadSignature(payload)
  if (current?.signature === signature && current.id) return current
  return { id: createId(), signature }
}
