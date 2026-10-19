import { actionDisabledReasonText, availableActionsForTask, guestReadyCachePatchAfterCheckinTimeChange, guestReadyNotificationForActiveRole, guestReadyOperationId, guestReadyOutsideKeyForActiveRole, isGuestReadyNotificationAction, mergeGuestReadyNotificationActions, navigationForWorkTaskAction, navigationForWorkTaskEntry, preferredNoticeActionForTask } from './workTaskActions'

test('清洁未提交时，即使共享任务状态已进入 inspected，补品入口仍可编辑', () => {
  const task: any = {
    id: 'merged-task',
    source_type: 'cleaning_tasks',
    source_id: 'cleaning-task-1',
    task_kind: 'cleaning',
    status: 'inspected',
    cleaning_submission_ready: false,
  }
  const route = navigationForWorkTaskAction(task, {
    id: 'fill_supplies',
    label: '补品记录',
    placement: 'primary',
    enabled: true,
    target: 'SuppliesForm',
    intent: 'cleaning',
  })

  expect(route).toEqual({ screen: 'SuppliesForm', params: { taskId: 'merged-task' } })
  expect(actionDisabledReasonText('cleaning_submission_required')).toBe('请先等待清洁提交补品记录和房源照片')
  expect(actionDisabledReasonText('inspection_arrangement_conflict')).toBe('检查安排存在人员或重复任务冲突，请联系管理员处理')
  expect(actionDisabledReasonText('inspection_action_moved_to_checkin_task')).toBe('请在同日入住任务中完成检查')
})

test('钥匙照片删除后，即使补品已提交也保留重新上传入口', () => {
  const actions = availableActionsForTask({
    id: 'cleaned-without-key-photo',
    source_type: 'cleaning_tasks',
    task_kind: 'cleaning',
    task_type: 'checkout_clean',
    status: 'done',
    key_photo_url: null,
  } as any, { roleNames: ['cleaner'] })

  expect(actions.find((action) => action.id === 'upload_key_photo')).toEqual(expect.objectContaining({
    enabled: true,
    label: '上传钥匙',
  }))
})

test('客服、admin 和线下经理的旧任务详情入口保持管理动作一致', () => {
  const task: any = {
    id: 'manager-task',
    source_type: 'cleaning_tasks',
    task_kind: 'cleaning',
    task_type: 'checkout_clean',
    start_time: '10am',
    status: 'assigned',
  }
  const expected = ['mark_guest_checkout', 'report_issue']

  expect(availableActionsForTask(task, { roleNames: ['customer_service'] }).map((action) => action.id)).toEqual(expected)
  expect(availableActionsForTask(task, { roleNames: ['admin'] }).map((action) => action.id)).toEqual(expected)
  expect(availableActionsForTask(task, { roleNames: ['offline_manager'] }).map((action) => action.id)).toEqual(expected)
})

test('客服合并卡只继承服务端确认的退房 action source ID', () => {
  const task: any = {
    id: 'merged-turnover',
    source_type: 'cleaning_tasks',
    source_id: 'checkin-source',
    task_kind: 'cleaning',
    task_type: 'turnover',
    order_id_checkout: 'checkout-order',
    status: 'assigned',
    available_actions: [
      { id: 'mark_guest_checkout', label: '标记已退房', placement: 'primary', enabled: true, target: 'TaskDetail', intent: 'manager', source_id: 'checkout-source' },
    ],
  }

  expect(availableActionsForTask(task, { roleNames: ['customer_service'] }).find((action) => action.id === 'mark_guest_checkout')).toEqual(expect.objectContaining({
    source_id: 'checkout-source',
  }))
  expect(availableActionsForTask({ ...task, available_actions: [] }, { roleNames: ['customer_service'] }).map((action) => action.id)).toEqual(['report_issue'])
})

test('客服保留服务端独立授权的客人已通知动作，不从旧角色规则推导', () => {
  const task: any = {
    id: 'ready-checkin',
    source_type: 'cleaning_tasks',
    source_id: 'checkin-source',
    task_kind: 'cleaning',
    task_type: 'turnover',
    order_id_checkin: 'checkin-order',
    status: 'ready',
    available_actions: [
      { id: 'record_guest_ready_notified', label: '记录已通知客人', placement: 'primary', enabled: true, target: 'TaskDetail', intent: 'manager', source_id: 'checkin-order' },
    ],
  }

  expect(availableActionsForTask(task, { roleNames: ['customer_service'] }).map((action) => action.id)).toEqual([
    'record_guest_ready_notified',
    'report_issue',
  ])
  expect(availableActionsForTask({ ...task, available_actions: [] }, { roleNames: ['customer_service'] }).map((action) => action.id)).toEqual([
    'report_issue',
  ])
})

test('客服从通知、深链和历史搜索进入清洁任务时回到原客服编辑页', () => {
  const task: any = {
    id: 'ready-checkin',
    source_type: 'cleaning_tasks',
    source_id: 'checkin-source',
    task_kind: 'cleaning',
    task_type: 'turnover',
    status: 'ready',
    available_actions: [
      { id: 'record_guest_ready_notified', label: '已通知客人', placement: 'primary', enabled: true, target: 'TaskDetail', intent: 'manager' },
    ],
  }
  const entry = {
    task,
    fallbackTaskId: task.id,
    roleNames: ['customer_service'],
    activeRole: 'customer_service',
    isTaskManager: true,
  }

  expect(navigationForWorkTaskEntry({ ...entry, noticeData: { kind: 'guest_ready' } })).toEqual({
    screen: 'ManagerDailyTask',
    params: { taskId: 'ready-checkin' },
  })
  expect(navigationForWorkTaskEntry({ ...entry, noticeData: {} })).toEqual({
    screen: 'ManagerDailyTask',
    params: { taskId: 'ready-checkin' },
  })
  expect(navigationForWorkTaskEntry({ ...entry, noticeData: undefined })).toEqual({
    screen: 'ManagerDailyTask',
    params: { taskId: 'ready-checkin' },
  })
  expect(navigationForWorkTaskEntry({ ...entry, isTaskManager: false })).toEqual({
    screen: 'TaskDetail',
    params: { id: 'ready-checkin' },
  })
})

test('客人通知标签和服务端缓存动作只跟随当前生效的客服角色', () => {
  const notification = { status: 'not_notified' }
  const outsideKey = { required: true }
  expect(guestReadyNotificationForActiveRole(notification, 'customer_service')).toBe(notification)
  expect(guestReadyOutsideKeyForActiveRole(outsideKey, 'customer_service')).toBe(outsideKey)
  for (const activeRole of ['admin', 'offline_manager', 'cleaner', 'cleaning_inspector']) {
    expect(guestReadyNotificationForActiveRole(notification, activeRole)).toBeNull()
    expect(guestReadyOutsideKeyForActiveRole(outsideKey, activeRole)).toBeNull()
  }

  const task: any = {
    id: 'multi-role-turnover',
    source_type: 'cleaning_tasks',
    task_kind: 'cleaning',
    task_type: 'turnover',
    available_actions: [
      { id: 'record_guest_ready_notified', label: '已通知客人', placement: 'primary', enabled: true, target: 'TaskDetail', intent: 'manager' },
      { id: 'cancel_guest_ready_outside_key', label: '取消钥匙外挂', placement: 'more', enabled: true, target: 'TaskDetail', intent: 'manager' },
      { id: 'report_issue', label: '问题反馈', placement: 'more', enabled: true, target: 'FeedbackForm', intent: 'issue' },
    ],
  }
  const assignedRoles = ['customer_service', 'admin']
  expect(availableActionsForTask(task, { roleNames: assignedRoles, activeRole: 'customer_service' }).map((action) => action.id)).toEqual([
    'record_guest_ready_notified',
    'cancel_guest_ready_outside_key',
    'report_issue',
  ])
  expect(availableActionsForTask(task, { roleNames: assignedRoles, activeRole: 'admin' }).map((action) => action.id)).toEqual([
    'report_issue',
  ])
  expect(preferredNoticeActionForTask(task, {}, { roleNames: assignedRoles, activeRole: 'admin' })?.id).toBe('report_issue')
  expect(availableActionsForTask(task, { roleNames: assignedRoles, activeRole: 'customer_service' }).filter(isGuestReadyNotificationAction).map((action) => action.id)).toEqual([
    'record_guest_ready_notified',
    'cancel_guest_ready_outside_key',
  ])
})

test('客人通知操作在同一服务端版本上复用幂等键', () => {
  expect(guestReadyOperationId({ orderId: 'order-1', action: 'mark', expectedVersion: 4 }))
    .toBe('guest-ready:mark:4:order-1')
  expect(guestReadyOperationId({ orderId: 'order-1', action: 'mark', expectedVersion: 5 }))
    .toBe('guest-ready:mark:5:order-1')
  expect(guestReadyOperationId({ orderId: '', action: 'mark', expectedVersion: 4 })).toBeNull()
})

test('入住时间变化立即让旧通知缓存失效，但钥匙外挂要求继续保留', () => {
  const earlyOnly: any = {
    id: 'early-only',
    guest_ready_notification: { status: 'notified' },
    guest_ready_outside_key: { required: false },
    turnover_display: { checkin_time: '2:30pm', is_early_checkin: true, is_late_checkin: false },
    available_actions: [
      { id: 'revoke_guest_ready_notified', label: '撤销', placement: 'primary', enabled: true, intent: 'manager' },
      { id: 'register_guest_ready_outside_key', label: '登记钥匙外挂', placement: 'more', enabled: true, intent: 'manager' },
    ],
  }
  expect(guestReadyCachePatchAfterCheckinTimeChange(earlyOnly, '3pm')).toEqual({
    turnover_display: { checkin_time: '3pm', is_early_checkin: false, is_late_checkin: false },
    guest_ready_notification: null,
    available_actions: [
      { id: 'register_guest_ready_outside_key', label: '登记钥匙外挂', placement: 'more', enabled: true, intent: 'manager' },
    ],
  })

  const both: any = {
    ...earlyOnly,
    guest_ready_outside_key: { required: true },
    available_actions: [
      { id: 'revoke_guest_ready_notified', label: '撤销', placement: 'primary', enabled: true, intent: 'manager' },
      { id: 'cancel_guest_ready_outside_key', label: '取消钥匙外挂', placement: 'more', enabled: true, intent: 'manager' },
    ],
  }
  expect(guestReadyCachePatchAfterCheckinTimeChange(both, '4pm')).toEqual({
    turnover_display: { checkin_time: '4pm', is_early_checkin: false, is_late_checkin: false },
    guest_ready_notification: {
      status: 'not_notified',
      notified_at: null,
      notified_by_user_id: null,
      notified_by_name: null,
      requirement_reasons: ['outside_key'],
      automatic_early_arrival: false,
      outside_key_required: true,
    },
    available_actions: [
      { id: 'record_guest_ready_notified', label: '已通知客人', placement: 'primary', enabled: true, intent: 'manager' },
      { id: 'cancel_guest_ready_outside_key', label: '取消钥匙外挂', placement: 'more', enabled: true, intent: 'manager' },
    ],
  })

  expect(guestReadyCachePatchAfterCheckinTimeChange(earlyOnly, '2pm')).toEqual({
    turnover_display: { checkin_time: '2pm', is_early_checkin: true, is_late_checkin: false },
    guest_ready_notification: {
      status: 'not_notified',
      notified_at: null,
      notified_by_user_id: null,
      notified_by_name: null,
      requirement_reasons: ['early_arrival'],
      automatic_early_arrival: true,
      outside_key_required: false,
    },
    available_actions: [
      { id: 'record_guest_ready_notified', label: '已通知客人', placement: 'primary', enabled: true, intent: 'manager' },
      { id: 'register_guest_ready_outside_key', label: '登记钥匙外挂', placement: 'more', enabled: true, intent: 'manager' },
    ],
  })
})

test('通知状态回执只替换对应动作，不覆盖任务原有操作', () => {
  const existing: any[] = [
    { id: 'fill_supplies', label: '补品填报' },
    { id: 'record_guest_ready_notified', label: '已通知客人' },
    { id: 'register_guest_ready_outside_key', label: '登记钥匙外挂' },
    { id: 'report_issue', label: '问题反馈' },
  ]
  const receipt: any[] = [
    { id: 'revoke_guest_ready_notified', label: '撤销已通知客人' },
    { id: 'cancel_guest_ready_outside_key', label: '取消钥匙外挂' },
  ]
  expect(mergeGuestReadyNotificationActions(existing, receipt).map((action) => action.id)).toEqual([
    'fill_supplies',
    'report_issue',
    'revoke_guest_ready_notified',
    'cancel_guest_ready_outside_key',
  ])
})

test('钥匙外挂动作从列表和通知入口统一进入任务详情', () => {
  const task: any = { id: 'outside-key-task' }
  for (const id of ['register_guest_ready_outside_key', 'cancel_guest_ready_outside_key'] as const) {
    expect(navigationForWorkTaskAction(task, {
      id,
      label: '钥匙外挂',
      placement: 'more',
      enabled: true,
      target: 'TaskDetail',
      intent: 'manager',
    })).toEqual({ screen: 'TaskDetail', params: { id: 'outside-key-task' } })
  }
})

test('入住检查不会显示退房动作，旧服务端缓存动作同样会被隐藏', () => {
  const checkinTask: any = { id: 'checkin', source_type: 'cleaning_tasks', task_kind: 'inspection', task_type: 'checkin_clean', order_id: 'checkin-order', status: 'assigned' }
  for (const roleNames of [['customer_service'], ['admin'], ['offline_manager']]) {
    expect(availableActionsForTask(checkinTask, { roleNames }).map((action) => action.id)).toEqual(['report_issue'])
  }
  const cached = availableActionsForTask({ ...checkinTask, available_actions: [
    { id: 'submit_inspection', label: '入住检查', placement: 'primary', enabled: true, target: 'InspectionPanel', intent: 'inspection' },
    { id: 'mark_guest_checkout', label: '标记已退房', placement: 'primary', enabled: true, target: 'TaskDetail', intent: 'manager' },
  ] }, { roleNames: ['admin'] })
  expect(cached.map((action) => action.id)).toEqual(['submit_inspection'])
})
