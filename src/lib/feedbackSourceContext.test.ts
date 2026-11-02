import {
  feedbackDraftOwnerMatches,
  feedbackDraftScopeKey,
  feedbackSourceFailureMessage,
  resolveFeedbackDraftSourceBinding,
  resolveFeedbackSourceContext,
} from './feedbackSourceContext'

test('explicit report action source wins and projection id is never a source fallback', () => {
  expect(resolveFeedbackSourceContext({
    routeSourceTaskId: 'cleaning-action',
    feedbackViewSourceTaskId: 'cleaning-view',
    taskSourceId: 'cleaning-task',
    taskSourceType: 'cleaning_tasks',
    projectionTaskId: 'work-projection',
  })).toEqual({ sourceTaskId: 'cleaning-action', authority: 'route' })

  expect(resolveFeedbackSourceContext({
    projectionTaskId: 'work-projection',
    taskSourceId: '',
    taskSourceType: 'work_tasks',
  })).toEqual({ sourceTaskId: '', authority: 'missing' })
})

test('server feedback view then exact cleaning task source are the only non-route fallbacks', () => {
  expect(resolveFeedbackSourceContext({
    feedbackViewSourceTaskId: 'cleaning-view',
    taskSourceId: 'cleaning-task',
    taskSourceType: 'cleaning_tasks',
  })).toEqual({ sourceTaskId: 'cleaning-view', authority: 'feedback_view' })

  expect(resolveFeedbackSourceContext({
    taskSourceId: 'cleaning-task',
    taskSourceType: 'cleaning_tasks',
  })).toEqual({ sourceTaskId: 'cleaning-task', authority: 'task_source' })

  expect(resolveFeedbackSourceContext({
    taskSourceId: 'order-id',
    taskSourceType: 'orders',
  })).toEqual({ sourceTaskId: '', authority: 'missing' })
})

test('draft scope follows stable business identity across projection id changes', () => {
  const first = feedbackDraftScopeKey({
    userId: 'user-1',
    propertyId: 'property-1',
    propertyCode: 'P-1',
    businessIdentity: 'turnover:reservation-1',
    projectionTaskId: 'projection-old',
  })
  const second = feedbackDraftScopeKey({
    userId: 'user-1',
    propertyId: 'property-1',
    propertyCode: 'P-1',
    businessIdentity: 'turnover:reservation-1',
    projectionTaskId: 'projection-new',
  })
  expect(first).toBe(second)
})

test('draft key length-prefix encoding prevents user and property delimiter collisions', () => {
  const first = feedbackDraftScopeKey({
    userId: 'a_b',
    propertyId: 'c',
    businessIdentity: 'task-1',
  })
  const second = feedbackDraftScopeKey({
    userId: 'a',
    propertyId: 'b_c',
    businessIdentity: 'task-1',
  })
  expect(first).not.toBe(second)
})

test('draft owner requires exact non-empty user and property identities', () => {
  expect(feedbackDraftOwnerMatches({
    cachedUserId: 'user-1',
    cachedPropertyIdentity: 'property-1',
    currentUserId: 'user-1',
    currentPropertyIdentity: 'property-1',
  })).toBe(true)
  expect(feedbackDraftOwnerMatches({
    cachedUserId: 'user-1',
    cachedPropertyIdentity: 'property-1',
    currentUserId: 'user_1',
    currentPropertyIdentity: 'property-1',
  })).toBe(false)
  expect(feedbackDraftOwnerMatches({
    cachedUserId: '',
    cachedPropertyIdentity: 'property-1',
    currentUserId: '',
    currentPropertyIdentity: 'property-1',
  })).toBe(false)
})

test('draft binding never silently rebinds an uploaded or differently sourced draft', () => {
  expect(resolveFeedbackDraftSourceBinding({
    cachedSourceTaskId: 'cleaning-old',
    currentSourceTaskId: 'cleaning-new',
    hasRemoteReferences: true,
  })).toEqual({ status: 'confirmation_required', sourceTaskId: 'cleaning-old', reason: 'source_changed' })

  expect(resolveFeedbackDraftSourceBinding({
    cachedSourceTaskId: '',
    currentSourceTaskId: 'cleaning-new',
    hasRemoteReferences: true,
  })).toEqual({ status: 'confirmation_required', sourceTaskId: '', reason: 'legacy_remote_source_unknown' })

  expect(resolveFeedbackDraftSourceBinding({
    cachedSourceTaskId: '',
    currentSourceTaskId: 'cleaning-new',
    hasRemoteReferences: false,
  })).toEqual({ status: 'confirmed', sourceTaskId: 'cleaning-new', reason: 'local_only_migration' })
})

test.each([
  [{ status: 401, code: 'UNAUTHORIZED' }, '登录已失效，请重新登录；本页文字和照片已保留。'],
  [{ status: 403, code: 'FORBIDDEN' }, '当前账号没有提交这条任务的权限；本页文字和照片已保留。'],
  [{ status: 404, code: 'property_feedback_source_task_not_found' }, '任务来源已更新或失效，请返回任务列表刷新后，从当前任务重新打开。本页文字和照片已保留，已上传照片不会重复上传。'],
])('maps source-related HTTP failures to actionable preservation messages', (error, expected) => {
  expect(feedbackSourceFailureMessage(error)).toBe(expected)
})
