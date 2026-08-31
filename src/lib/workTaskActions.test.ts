import { actionDisabledReasonText, availableActionsForTask, navigationForWorkTaskAction } from './workTaskActions'

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
