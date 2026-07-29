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
