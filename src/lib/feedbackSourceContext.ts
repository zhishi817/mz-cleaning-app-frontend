type FeedbackSourceAuthority = 'route' | 'feedback_view' | 'task_source' | 'missing'

type FeedbackSourceContextInput = {
  routeSourceTaskId?: unknown
  feedbackViewSourceTaskId?: unknown
  taskSourceId?: unknown
  taskSourceType?: unknown
  projectionTaskId?: unknown
}

export type FeedbackDraftSourceBinding = {
  status: 'confirmed' | 'confirmation_required'
  sourceTaskId: string
  reason: 'exact' | 'local_only_migration' | 'source_changed' | 'legacy_remote_source_unknown'
}

function cleanText(value: unknown) {
  return String(value || '').trim()
}

function keyPart(value: unknown, fallback: string) {
  const normalized = cleanText(value)
  const encoded = encodeURIComponent(normalized || fallback)
  return `${encoded.length}:${encoded}`
}

export function resolveFeedbackSourceContext(input: FeedbackSourceContextInput): {
  sourceTaskId: string
  authority: FeedbackSourceAuthority
} {
  const routeSourceTaskId = cleanText(input.routeSourceTaskId)
  if (routeSourceTaskId) return { sourceTaskId: routeSourceTaskId, authority: 'route' }

  const feedbackViewSourceTaskId = cleanText(input.feedbackViewSourceTaskId)
  if (feedbackViewSourceTaskId) return { sourceTaskId: feedbackViewSourceTaskId, authority: 'feedback_view' }

  const taskSourceId = cleanText(input.taskSourceId)
  if (cleanText(input.taskSourceType) === 'cleaning_tasks' && taskSourceId) {
    return { sourceTaskId: taskSourceId, authority: 'task_source' }
  }

  // A work-task/projection id is display/navigation identity, not a cleaning
  // source identity. It must never be sent to feedback or media endpoints.
  return { sourceTaskId: '', authority: 'missing' }
}

export function feedbackDraftScopeKey(input: {
  userId?: unknown
  propertyId?: unknown
  propertyCode?: unknown
  businessIdentity?: unknown
  projectionTaskId?: unknown
}) {
  const propertyIdentity = cleanText(input.propertyId) || cleanText(input.propertyCode)
  const taskIdentity = cleanText(input.businessIdentity) || cleanText(input.projectionTaskId)
  return `feedback_form_draft_v2_${keyPart(input.userId, 'anon')}|${keyPart(propertyIdentity, 'no-property')}|${keyPart(taskIdentity, 'no-task')}`
}

export function feedbackDraftOwnerMatches(input: {
  cachedUserId?: unknown
  cachedPropertyIdentity?: unknown
  currentUserId?: unknown
  currentPropertyIdentity?: unknown
}) {
  const currentUserId = cleanText(input.currentUserId)
  const currentPropertyIdentity = cleanText(input.currentPropertyIdentity)
  return !!currentUserId
    && !!currentPropertyIdentity
    && cleanText(input.cachedUserId) === currentUserId
    && cleanText(input.cachedPropertyIdentity) === currentPropertyIdentity
}

export function resolveFeedbackDraftSourceBinding(input: {
  cachedSourceTaskId?: unknown
  currentSourceTaskId?: unknown
  hasRemoteReferences: boolean
}): FeedbackDraftSourceBinding {
  const cachedSourceTaskId = cleanText(input.cachedSourceTaskId)
  const currentSourceTaskId = cleanText(input.currentSourceTaskId)
  if (cachedSourceTaskId && cachedSourceTaskId === currentSourceTaskId) {
    return { status: 'confirmed', sourceTaskId: currentSourceTaskId, reason: 'exact' }
  }
  if (!cachedSourceTaskId && !input.hasRemoteReferences) {
    return { status: 'confirmed', sourceTaskId: currentSourceTaskId, reason: 'local_only_migration' }
  }
  if (cachedSourceTaskId) {
    return { status: 'confirmation_required', sourceTaskId: cachedSourceTaskId, reason: 'source_changed' }
  }
  return { status: 'confirmation_required', sourceTaskId: '', reason: 'legacy_remote_source_unknown' }
}

export function feedbackSourceFailureMessage(error: unknown): string | null {
  const status = Number((error as any)?.status || 0)
  const code = cleanText((error as any)?.code).toLowerCase()
  const message = cleanText((error as any)?.message || error).toLowerCase()
  if (status === 401 || code === 'unauthorized') {
    return '登录已失效，请重新登录；本页文字和照片已保留。'
  }
  if (status === 403 || code === 'forbidden') {
    return '当前账号没有提交这条任务的权限；本页文字和照片已保留。'
  }
  if (
    code === 'property_feedback_source_task_not_found'
    || (status === 404 && (message.includes('source_task') || message.includes('来源任务')))
  ) {
    return '任务来源已更新或失效，请返回任务列表刷新后，从当前任务重新打开。本页文字和照片已保留，已上传照片不会重复上传。'
  }
  return null
}
