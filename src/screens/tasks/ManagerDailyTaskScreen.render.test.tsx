import React from 'react'
import { Alert, Dimensions, Platform, StyleSheet } from 'react-native'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { I18nProvider } from '../../lib/i18n'
import * as api from '../../lib/api'
import { taskBusinessDateKey } from '../../lib/taskBusinessDate'

const mockTodayKey = taskBusinessDateKey()

const mockTask: any = {
  id: 'manager-ready-task',
  task_kind: 'cleaning',
  task_type: 'turnover',
  source_type: 'cleaning_tasks',
  source_id: 'cleaning-1',
  source_ids: ['cleaning-1', 'inspection-1'],
  active_source_ids: ['cleaning-1'],
  cleaning_task_ids: ['cleaning-1'],
  inspection_task_ids: ['inspection-1'],
  order_id_checkin: 'checkin-order-1',
  title: 'UT701',
  scheduled_date: mockTodayKey,
  date: mockTodayKey,
  start_time: '10am',
  end_time: '1pm',
  old_code: 'old-code',
  new_code: 'new-code',
  turnover_display: {
    checkout_order_id: 'checkout-order-1',
    checkin_order_id: 'checkin-order-1',
    old_code: 'old-code',
    old_code_task_id: 'cleaning-1',
    new_code: 'new-code',
    new_code_task_id: 'inspection-1',
    active_source_ids: ['cleaning-1'],
  },
  password_authority: { old_code_status: 'needs_review', new_code_status: 'source_linked' },
  guest_special_request: '保留原位',
  keys_required_checkin: 2,
  status: 'assigned',
  inspection_mode: 'same_day',
  inspection_scope: 'inspect_and_hang',
  key_photo_url: 'cleaning/key.jpg',
  lockbox_video_url: 'http://127.0.0.1/video.mov',
  property: { id: 'property-1', code: 'UT701', region: 'CBD', address: '虚构地址', unit_type: '两房一卫', access_guide_link: '' },
  guest_ready_notification: {
    order_id: 'checkin-order-1',
    status: 'not_notified',
    version: 0,
  },
  guest_ready_outside_key: {
    order_id: 'checkin-order-1',
    required: false,
    version: 0,
  },
  available_actions: [
    { id: 'record_guest_ready_notified', label: '已通知客人', placement: 'primary', enabled: true, target: 'TaskDetail', intent: 'manager', source_id: 'checkin-order-1' },
    { id: 'register_guest_ready_outside_key', label: '登记钥匙外挂', placement: 'more', enabled: true, target: 'TaskDetail', intent: 'manager', source_id: 'checkin-order-1' },
  ],
}

let mockFoundTask: any = undefined
let mockWorkTasksStoreListener: (() => void) | null = null

const mockAuthState = {
  token: 'local-preview-token',
  user: { id: 'customer-service-1', username: 'customer-service', role: 'customer_service', roles: ['customer_service'] },
}

const mockGuestLuggageCard = jest.fn((_props: any) => null)

const defaultConsumablesResponse = {
  living_room_photo_urls: ['cleaning/living.jpg'],
  items: [{ item_id: 'remote_tv', photo_urls: ['cleaning/remote.jpg'], item_label: '电视遥控器' }],
}
let mockConsumablesResponse: any = defaultConsumablesResponse

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

jest.mock('expo-av', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  return {
    ResizeMode: { CONTAIN: 'contain' },
    Video: (props: any) => React.createElement('Video', props),
  }
})

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
}))

jest.mock('../../lib/auth', () => ({ useAuth: () => mockAuthState }))

jest.mock('../../lib/api', () => ({
  changeGuestReadyNotification: jest.fn(),
  deleteGuestLuggageNotice: jest.fn(),
  getCleaningConsumables: jest.fn(async () => mockConsumablesResponse),
  getCompletionPhotos: jest.fn(async () => ({ items: [{ area: 'living', url: 'cleaning/completion.jpg' }] })),
  getInspectionPhotos: jest.fn(async () => ({ items: [{ area: 'living', url: 'cleaning/inspection.jpg' }] })),
  getRestockProof: jest.fn(async () => ({ items: [{ item_id: 'paper', proof_url: 'cleaning/restock.jpg' }] })),
  getWorkTaskFormPhotos: jest.fn(async () => ({ items: [] })),
  markGuestCheckedOutByOrder: jest.fn(),
  markGuestCheckedOutByTasks: jest.fn(),
  previewCleaningTaskPasswordAuthority: jest.fn(async () => ({
    selected_task_ids: ['cleaning-1'],
    fields: ['old_code', 'new_code'],
    same_order_checkout_task_ids: ['checkout-1'],
    dependent_checkin_task_ids: ['next-checkin-1'],
    manual_task_ids: [],
    requires_manual_source_confirmation: false,
    note: null,
  })),
  saveGuestLuggageNotice: jest.fn(),
  updateCleaningTaskManagerFields: jest.fn(async () => ({ ok: true })),
  uploadMzappMedia: jest.fn(),
}))

jest.mock('../../lib/workTasksStore', () => ({
  applyManagerTaskSaveReceipt: jest.fn(async () => ({ supported: false, appliedItems: 0, persisted: false, projectionRefreshRequired: true })),
  beginManagerTaskSaveOperation: jest.fn(() => true),
  failManagerTaskSaveOperation: jest.fn(),
  findWorkTaskItemByAnyId: () => mockFoundTask === undefined ? mockTask : mockFoundTask,
  getWorkTasksSnapshot: () => ({ items: [mockTask] }),
  patchWorkTaskItem: jest.fn(async () => {}),
  patchWorkTaskItems: jest.fn(async () => {}),
  reconcileActiveWorkTasksAfterLocalPatch: jest.fn(async () => false),
  requestWorkTasksRefresh: jest.fn(async () => {}),
  subscribeWorkTasks: jest.fn((listener: () => void) => {
    mockWorkTasksStoreListener = listener
    return () => {
      if (mockWorkTasksStoreListener === listener) mockWorkTasksStoreListener = null
    }
  }),
}))

jest.mock('../../lib/noticesStore', () => ({ prependNotice: jest.fn(async () => {}) }))

jest.mock('../../components/GuestLuggageCard', () => ({
  __esModule: true,
  default: (props: any) => mockGuestLuggageCard(props),
}))
jest.mock('../../components/CleaningMediaImage', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  return { __esModule: true, default: (props: any) => React.createElement('CleaningMediaImage', props) }
})
jest.mock('../../components/CleaningMediaPreview', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  return { __esModule: true, default: (props: any) => React.createElement('CleaningMediaPreview', props) }
})

function flattenedText(node: any): string[] {
  if (node == null || typeof node === 'boolean') return []
  if (typeof node === 'string' || typeof node === 'number') return [String(node)]
  if (Array.isArray(node)) return node.flatMap(flattenedText)
  return flattenedText(node.children || [])
}

beforeEach(() => {
  jest.clearAllMocks()
  mockConsumablesResponse = defaultConsumablesResponse
  mockFoundTask = undefined
  mockWorkTasksStoreListener = null
})

test('manager status obeys authoritative key-handover completion and explicit absence', () => {
  const ManagerDailyTaskScreen = jest.requireActual<typeof import('./ManagerDailyTaskScreen')>('./ManagerDailyTaskScreen').default as React.ComponentType<any>
  const originalStatus = mockTask.status
  const hadProjection = Object.prototype.hasOwnProperty.call(mockTask, 'key_handover')
  const originalProjection = mockTask.key_handover
  try {
    mockTask.status = 'in_progress'
    mockTask.key_handover = {
      state: 'completed',
      source_task_id: 'cleaning-1',
      completed_at: '2026-10-21T02:21:00.000Z',
      workflow_finalization_pending: true,
      missing_requirements: ['cleaning_consumables'],
    }
    const completed = render(
      <I18nProvider>
        <ManagerDailyTaskScreen
          navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
          route={{ key: 'manager-handover-completed', name: 'ManagerDailyTask', params: { taskId: mockTask.id } } as any}
        />
      </I18nProvider>,
    )
    expect(completed.getByText('已挂钥匙')).toBeTruthy()
    completed.unmount()

    mockTask.status = 'keys_hung'
    mockTask.key_handover = null
    const invalidated = render(
      <I18nProvider>
        <ManagerDailyTaskScreen
          navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
          route={{ key: 'manager-handover-invalidated', name: 'ManagerDailyTask', params: { taskId: mockTask.id } } as any}
        />
      </I18nProvider>,
    )
    expect(invalidated.queryByText('已挂钥匙')).toBeNull()
    expect(invalidated.getByText('已分配')).toBeTruthy()
    invalidated.unmount()
  } finally {
    mockTask.status = originalStatus
    if (hadProjection) mockTask.key_handover = originalProjection
    else delete mockTask.key_handover
  }
})

test('manager check-in card keeps its work status after the guest later checks out', () => {
  const ManagerDailyTaskScreen = jest.requireActual<typeof import('./ManagerDailyTaskScreen')>('./ManagerDailyTaskScreen').default as React.ComponentType<any>
  const before = {
    task_kind: mockTask.task_kind,
    task_type: mockTask.task_type,
    status: mockTask.status,
    checked_out_at: mockTask.checked_out_at,
    assignee_id: mockTask.assignee_id,
    assignee_name: mockTask.assignee_name,
  }
  try {
    mockTask.task_kind = 'cleaning'
    mockTask.task_type = 'checkin_clean'
    mockTask.status = 'assigned'
    mockTask.checked_out_at = '2026-10-15T00:00:00.000Z'
    mockTask.assignee_id = 'inspector-1'
    mockTask.assignee_name = 'Angela'
    const ui = render(
      <I18nProvider>
        <ManagerDailyTaskScreen
          navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
          route={{ key: 'manager-checkin-later-checkout', name: 'ManagerDailyTask', params: { taskId: mockTask.id } } as any}
        />
      </I18nProvider>,
    )
    expect(ui.getByText('已分配')).toBeTruthy()
    expect(ui.queryByText('已退房')).toBeNull()
    ui.unmount()
  } finally {
    Object.assign(mockTask, before)
  }
})

test('pure check-in manager card hides old password and verifies only new password', async () => {
  const ManagerDailyTaskScreen = jest.requireActual<typeof import('./ManagerDailyTaskScreen')>('./ManagerDailyTaskScreen').default as React.ComponentType<any>
  const before = {
    task_type: mockTask.task_type,
    has_checkin_task: mockTask.has_checkin_task,
    turnover_display: mockTask.turnover_display,
  }
  try {
    mockTask.task_type = 'checkin_clean'
    mockTask.has_checkin_task = true
    mockTask.turnover_display = {
      checkin_order_id: 'checkin-order-1',
      old_code: 'legacy-checkin-old',
      new_code: 'new-code',
      new_code_task_id: 'cleaning-1',
    }
    const ui = render(
      <I18nProvider>
        <ManagerDailyTaskScreen
          navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
          route={{ key: 'manager-pure-checkin-password', name: 'ManagerDailyTask', params: { taskId: mockTask.id } } as any}
        />
      </I18nProvider>,
    )
    expect(ui.queryByPlaceholderText('旧密码')).toBeNull()
    expect(ui.getByPlaceholderText('新密码')).toBeTruthy()
    fireEvent.press(ui.getByTestId('manager-password-authority-verify'))
    await waitFor(() => expect(api.previewCleaningTaskPasswordAuthority).toHaveBeenCalledWith(
      mockAuthState.token,
      { task_ids: ['cleaning-1'], fields: ['new_code'] },
    ))
    ui.unmount()
  } finally {
    Object.assign(mockTask, before)
  }
})

test('checkout-only manager card hides new password and verifies only old password', async () => {
  const ManagerDailyTaskScreen = jest.requireActual<typeof import('./ManagerDailyTaskScreen')>('./ManagerDailyTaskScreen').default as React.ComponentType<any>
  const before = {
    task_type: mockTask.task_type,
    has_checkin_task: mockTask.has_checkin_task,
    turnover_display: mockTask.turnover_display,
  }
  try {
    mockTask.task_type = 'checkout_clean'
    mockTask.has_checkin_task = false
    mockTask.turnover_display = {
      checkout_order_id: 'checkout-order-1',
      old_code: 'old-code',
      old_code_task_id: 'cleaning-1',
      new_code: 'stale-checkout-new',
    }
    const ui = render(
      <I18nProvider>
        <ManagerDailyTaskScreen
          navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
          route={{ key: 'manager-checkout-only-password', name: 'ManagerDailyTask', params: { taskId: mockTask.id } } as any}
        />
      </I18nProvider>,
    )
    expect(ui.getByPlaceholderText('旧密码')).toBeTruthy()
    expect(ui.queryByPlaceholderText('新密码')).toBeNull()
    fireEvent.press(ui.getByTestId('manager-password-authority-verify'))
    await waitFor(() => expect(api.previewCleaningTaskPasswordAuthority).toHaveBeenCalledWith(
      mockAuthState.token,
      { task_ids: ['cleaning-1'], fields: ['old_code'] },
    ))
    ui.unmount()
  } finally {
    Object.assign(mockTask, before)
  }
})

test('customer-service guest-ready actions coexist with the original editor and media order', async () => {
  const ManagerDailyTaskScreen = jest.requireActual<typeof import('./ManagerDailyTaskScreen')>('./ManagerDailyTaskScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <ManagerDailyTaskScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'manager-ready', name: 'ManagerDailyTask', params: { taskId: mockTask.id } } as any}
      />
    </I18nProvider>,
  )

  expect(ui.getByPlaceholderText('例如 11am').props.editable).toBe(true)
  expect(ui.getByPlaceholderText('例如 2pm').props.editable).toBe(true)
  expect(ui.getByPlaceholderText('旧密码').props.editable).toBe(true)
  expect(ui.getByPlaceholderText('新密码').props.editable).toBe(true)
  expect(ui.getByText('保存修改')).toBeTruthy()
  expect(ui.getByTestId('manager-keys-current').props.children).toBe('2 套')
  expect(ui.queryByTestId('manager-keys-option-1')).toBeNull()
  expect(ui.queryByTestId('manager-keys-option-2')).toBeNull()
  expect(ui.getByTestId('manager-guest-ready-action-record_guest_ready_notified')).toBeTruthy()
  expect(ui.getByTestId('manager-guest-ready-action-register_guest_ready_outside_key')).toBeTruthy()

  await waitFor(() => {
    expect(ui.getByText('钥匙与挂钥匙视频')).toBeTruthy()
    expect(ui.getByText('清洁现场照片')).toBeTruthy()
    expect(ui.getByText('清洁完成照片')).toBeTruthy()
    expect(ui.getByText('检查照片')).toBeTruthy()
    expect(ui.getByText('补品照片记录')).toBeTruthy()
  })

  const text = flattenedText(ui.toJSON())
  expect(text.indexOf('退房时间')).toBeLessThan(text.indexOf('客人特殊需求'))
  expect(text.indexOf('新密码')).toBeLessThan(text.indexOf('客人特殊需求'))
  expect(text.indexOf('客人特殊需求')).toBeLessThan(text.indexOf('需挂钥匙套数'))
  expect(text.indexOf('客服信息')).toBeLessThan(text.indexOf('当天任务临时通知'))
  expect(text.indexOf('当天任务临时通知')).toBeLessThan(text.indexOf('钥匙与挂钥匙视频'))
  expect(text.indexOf('钥匙与挂钥匙视频')).toBeLessThan(text.indexOf('清洁现场照片'))
})

test('customer-service reassigned history uses exact actor-bound media and keeps feedback on ManagerDailyTask', async () => {
  const before = { ...mockTask }
  const navigation = { navigate: jest.fn(), addListener: jest.fn(() => () => {}) }
  Object.assign(mockTask, {
    id: 'history-reassigned-record',
    source_id: 'checkout-source',
    source_ids: ['checkout-source'],
    active_source_ids: ['checkout-source'],
    cleaning_task_ids: ['checkout-source'],
    inspection_task_ids: [],
    work_record_read_only: true,
    work_record_state: 'reassigned',
    execution_state: 'active',
    completed_by_user_id: 'former-cleaner',
    property: {
      ...before.property,
      wifi_ssid: 'SYNTHETIC-WIFI',
      wifi_password: 'synthetic-only',
      router_location: '合成测试路由器位置',
      access_guide_link: 'https://example.invalid/synthetic-guide',
    },
    key_photo_url: null,
    lockbox_video_url: null,
    phase_history: [{ source_id: 'checkout-source', actor_user_id: 'former-cleaner', role: 'cleaner' }],
    read_only_views: {
      media_scope: 'manager',
      media_source_ids: ['checkout-source'],
      property_access: true,
      cleaner_photos: true,
      inspection_photos: true,
      guest_key_photo: true,
      feedback_history: true,
      feedback_report: true,
      feedback_source_id: 'checkout-source',
    },
    available_actions: [{
      id: 'report_issue',
      label: '问题反馈与报修记录',
      placement: 'more',
      enabled: true,
      read_only: false,
      target: 'FeedbackForm',
      intent: 'issue',
      source_type: 'cleaning_tasks',
      source_id: 'checkout-source',
    }],
  })
  ;(api.getWorkTaskFormPhotos as jest.Mock).mockResolvedValueOnce({
    items: [
      { id: 'former-photo', task_id: 'checkout-source', source: 'completion', area: 'living', url: 'cleaning/former.jpg', uploader_id: 'former-cleaner' },
      { id: 'former-video', task_id: 'checkout-source', source: 'lockbox_video', area: 'key_handover', url: 'cleaning/former.mp4', uploader_id: 'former-cleaner' },
      { id: 'replacement-photo', task_id: 'checkout-source', source: 'completion', area: 'kitchen', url: 'cleaning/replacement.jpg', uploader_id: 'replacement-cleaner' },
      { id: 'other-task-photo', task_id: 'same-property-other-task', source: 'completion', area: 'bedroom', url: 'cleaning/unrelated.jpg', uploader_id: 'former-cleaner' },
    ],
  })

  try {
    const ManagerDailyTaskScreen = jest.requireActual<typeof import('./ManagerDailyTaskScreen')>('./ManagerDailyTaskScreen').default as React.ComponentType<any>
    const ui = render(
      <I18nProvider>
        <ManagerDailyTaskScreen
          navigation={navigation as any}
          route={{ key: 'manager-reassigned-history', name: 'ManagerDailyTask', params: { taskId: mockTask.id } } as any}
        />
      </I18nProvider>,
    )

    await waitFor(() => expect(api.getWorkTaskFormPhotos).toHaveBeenCalledWith(
      mockAuthState.token,
      'history-reassigned-record',
      ['checkout-source'],
      'manager',
      { includeVideos: true },
    ))
    await waitFor(() => expect(JSON.stringify(ui.toJSON())).toContain('cleaning/former.jpg'))
    const rendered = JSON.stringify(ui.toJSON())
    const videos = ui.UNSAFE_getAllByType('Video' as any)
    const historicalVideo = videos.find((video) => String(video.props?.source?.uri || '').includes('cleaning%2Fformer.mp4'))
    expect(historicalVideo?.props?.source).toEqual({
      uri: expect.stringContaining('variant=source&source_task_id=checkout-source&source_ids=checkout-source&media_scope=manager'),
      headers: { Authorization: 'Bearer local-preview-token' },
    })
    expect(rendered).not.toContain('cleaning/replacement.jpg')
    expect(rendered).not.toContain('cleaning/unrelated.jpg')
    expect(api.getCompletionPhotos).not.toHaveBeenCalled()
    expect(ui.getByTestId('work-record-read-only-info')).toBeTruthy()
    expect(ui.getByText('查看入住指南')).toBeTruthy()
    expect(ui.queryByText('保存修改')).toBeNull()
    expect(api.updateCleaningTaskManagerFields).not.toHaveBeenCalled()

    fireEvent.press(ui.getByTestId('manager-feedback-action'))
    expect(navigation.navigate).toHaveBeenCalledWith('FeedbackForm', expect.objectContaining({
      taskId: 'history-reassigned-record',
      sourceTaskId: 'checkout-source',
    }))
    ui.unmount()
  } finally {
    for (const key of Object.keys(mockTask)) delete mockTask[key]
    Object.assign(mockTask, before)
  }
})

test('manager history renders the temporary notice only in the canonical lower section', async () => {
  const before = { ...mockTask }
  Object.assign(mockTask, {
    id: 'history-temporary-notice-record',
    work_record_read_only: true,
    work_record_state: 'completed',
    guest_luggage: {
      id: 'synthetic-notice',
      note: '合成临时通知',
      photo_urls: ['synthetic/notice.jpg'],
    },
    read_only_views: {
      guest_context: true,
      media_source_ids: ['cleaning-1'],
    },
  })

  try {
    const ManagerDailyTaskScreen = jest.requireActual<typeof import('./ManagerDailyTaskScreen')>('./ManagerDailyTaskScreen').default as React.ComponentType<any>
    const ui = render(
      <I18nProvider>
        <ManagerDailyTaskScreen
          navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
          route={{ key: 'manager-history-temporary-notice', name: 'ManagerDailyTask', params: { taskId: mockTask.id } } as any}
        />
      </I18nProvider>,
    )

    await waitFor(() => expect(ui.getByTestId('work-record-read-only-info')).toBeTruthy())
    expect(ui.getAllByText('当天任务临时通知')).toHaveLength(1)
    expect(mockGuestLuggageCard).toHaveBeenCalled()
    expect(mockGuestLuggageCard).toHaveBeenCalledWith(expect.objectContaining({
      notice: expect.objectContaining({ id: 'synthetic-notice' }),
      showAcknowledgementSummary: true,
      compact: true,
    }))
    expect(mockGuestLuggageCard.mock.calls.every(([props]) => (
      props?.showAcknowledgementSummary === true
      && props?.compact === true
      && props?.showAcknowledge === undefined
      && props?.accessWorkTaskId === undefined
    ))).toBe(true)
    ui.unmount()
  } finally {
    for (const key of Object.keys(mockTask)) delete mockTask[key]
    Object.assign(mockTask, before)
  }
})

test('completed key-handover work record keeps the authorized guest-notified button', async () => {
  const before = { ...mockTask }
  Object.assign(mockTask, {
    id: 'completed-key-handover-record',
    status: 'done',
    work_record_read_only: true,
    work_record_state: 'completed',
    order_id_checkin: 'checkin-order-1',
    read_only_views: {
      guest_context: true,
      media_scope: 'manager',
      media_source_ids: ['cleaning-1'],
    },
    available_actions: [{
      id: 'record_guest_ready_notified',
      label: '已通知客人',
      placement: 'primary',
      enabled: true,
      target: 'TaskDetail',
      intent: 'manager',
      source_type: 'orders',
      source_id: 'checkin-order-1',
    }],
  })

  try {
    const ManagerDailyTaskScreen = jest.requireActual<typeof import('./ManagerDailyTaskScreen')>('./ManagerDailyTaskScreen').default as React.ComponentType<any>
    const ui = render(
      <I18nProvider>
        <ManagerDailyTaskScreen
          navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
          route={{ key: 'manager-completed-key-handover', name: 'ManagerDailyTask', params: { taskId: mockTask.id } } as any}
        />
      </I18nProvider>,
    )

    await waitFor(() => expect(ui.getByTestId('work-record-read-only-info')).toBeTruthy())
    expect(ui.getByTestId('manager-guest-ready-action-record_guest_ready_notified')).toBeTruthy()
    expect(ui.queryByText('保存修改')).toBeNull()
    ui.unmount()
  } finally {
    for (const key of Object.keys(mockTask)) delete mockTask[key]
    Object.assign(mockTask, before)
  }
})

test('manager history without exact media capability never falls back to live media endpoints', async () => {
  const before = { ...mockTask }
  Object.assign(mockTask, {
    id: 'history-no-media-capability',
    work_record_read_only: true,
    source_id: 'must-not-load-source',
    source_ids: ['must-not-load-source'],
    cleaning_task_ids: ['must-not-load-source'],
    inspection_task_ids: ['must-not-load-inspection'],
    read_only_views: { media_scope: 'manager', media_source_ids: [] },
  })
  const navigation = { navigate: jest.fn(), addListener: jest.fn(() => () => {}) }

  try {
    const ManagerDailyTaskScreen = jest.requireActual<typeof import('./ManagerDailyTaskScreen')>('./ManagerDailyTaskScreen').default as React.ComponentType<any>
    const ui = render(
      <I18nProvider>
        <ManagerDailyTaskScreen
          navigation={navigation as any}
          route={{ key: 'manager-history-no-capability', name: 'ManagerDailyTask', params: { taskId: mockTask.id } } as any}
        />
      </I18nProvider>,
    )

    await waitFor(() => expect(ui.getByTestId('work-record-read-only-info')).toBeTruthy())
    expect(api.getWorkTaskFormPhotos).not.toHaveBeenCalled()
    expect(api.getCleaningConsumables).not.toHaveBeenCalled()
    expect(api.getCompletionPhotos).not.toHaveBeenCalled()
    expect(api.getInspectionPhotos).not.toHaveBeenCalled()
    expect(api.getRestockProof).not.toHaveBeenCalled()
  } finally {
    for (const key of Object.keys(mockTask)) delete mockTask[key]
    Object.assign(mockTask, before)
  }
})

test.each([
  ['admin'],
  ['offline_manager'],
] as const)('%s manager detail keeps the restored media and task-information sections', async (role) => {
  const beforeUser = { ...mockAuthState.user, roles: [...mockAuthState.user.roles] }
  mockAuthState.user = { id: `${role}-1`, username: role, role, roles: [role] }
  try {
    const ManagerDailyTaskScreen = jest.requireActual<typeof import('./ManagerDailyTaskScreen')>('./ManagerDailyTaskScreen').default as React.ComponentType<any>
    const ui = render(
      <I18nProvider>
        <ManagerDailyTaskScreen
          navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
          route={{ key: `manager-role-preview-${role}`, name: 'ManagerDailyTask', params: { taskId: mockTask.id } } as any}
        />
      </I18nProvider>,
    )
    await waitFor(() => {
      expect(ui.getByText('钥匙与挂钥匙视频')).toBeTruthy()
      expect(ui.getByText('清洁现场照片')).toBeTruthy()
      expect(ui.getByText('检查照片')).toBeTruthy()
      expect(ui.getByText('补品照片记录')).toBeTruthy()
    })
    ui.unmount()
  } finally {
    mockAuthState.user = beforeUser
  }
})

test('key count stays local through note keyboard and scrolling, cancel keeps the current value, and save submits once', async () => {
  const ManagerDailyTaskScreen = jest.requireActual<typeof import('./ManagerDailyTaskScreen')>('./ManagerDailyTaskScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <ManagerDailyTaskScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'manager-key-draft', name: 'ManagerDailyTask', params: { taskId: mockTask.id } } as any}
      />
    </I18nProvider>,
  )

  const note = ui.getByTestId('manager-guest-note')
  fireEvent(note, 'focus')
  fireEvent.changeText(note, '更新后的特殊需求')
  fireEvent.scroll(ui.getByTestId('manager-task-scroll'), { nativeEvent: { contentOffset: { y: 180 } } })
  fireEvent(note, 'blur')

  expect(ui.getByTestId('manager-keys-current').props.children).toBe('2 套')
  fireEvent.press(ui.getByTestId('manager-keys-edit'))
  expect(ui.getByTestId('manager-keys-option-2').props.accessibilityState).toEqual(expect.objectContaining({ selected: true }))
  fireEvent.press(ui.getByTestId('manager-keys-cancel'))
  expect(ui.queryByTestId('manager-keys-editor')).toBeNull()
  expect(ui.getByTestId('manager-keys-current').props.children).toBe('2 套')

  fireEvent.press(ui.getByTestId('manager-keys-edit'))
  fireEvent.press(ui.getByTestId('manager-keys-option-1'))
  expect(ui.queryByTestId('manager-keys-editor')).toBeNull()
  expect(ui.getByTestId('manager-keys-current').props.children).toBe('1 套')
  expect(api.updateCleaningTaskManagerFields).not.toHaveBeenCalled()

  fireEvent(note, 'focus')
  fireEvent.scroll(ui.getByTestId('manager-task-scroll'), { nativeEvent: { contentOffset: { y: 360 } } })
  fireEvent(note, 'blur')
  expect(ui.getByTestId('manager-keys-current').props.children).toBe('1 套')
  expect(ui.getByDisplayValue('更新后的特殊需求')).toBeTruthy()

  fireEvent.press(ui.getByText('保存修改'))
  await waitFor(() => expect(api.updateCleaningTaskManagerFields).toHaveBeenCalledWith(
    mockAuthState.token,
    expect.objectContaining({
      task_ids: ['cleaning-1'],
      items: [{ id: 'cleaning-1', guest_special_request: '更新后的特殊需求' }],
      keys_required: 1,
    }),
  ))
  expect(api.updateCleaningTaskManagerFields).toHaveBeenCalledTimes(1)
})

test('checkout-only key save patches the checkout side and never reports a check-in-side cache value', async () => {
  const store = jest.requireMock('../../lib/workTasksStore') as any
  const before = {
    task_type: mockTask.task_type,
    has_checkin_task: mockTask.has_checkin_task,
    keys_required: mockTask.keys_required,
    keys_required_checkout: mockTask.keys_required_checkout,
    keys_required_checkin: mockTask.keys_required_checkin,
    turnover_display: mockTask.turnover_display,
  }
  try {
    mockTask.task_type = 'checkout_clean'
    mockTask.has_checkin_task = false
    mockTask.keys_required = 1
    mockTask.keys_required_checkout = 1
    delete mockTask.keys_required_checkin
    mockTask.turnover_display = {
      checkout_order_id: 'checkout-order-1',
      old_code: 'old-code',
      old_code_task_id: 'cleaning-1',
      new_code: null,
      new_code_task_id: null,
      active_source_ids: ['cleaning-1'],
    }
    const ManagerDailyTaskScreen = jest.requireActual<typeof import('./ManagerDailyTaskScreen')>('./ManagerDailyTaskScreen').default as React.ComponentType<any>
    const ui = render(
      <I18nProvider>
        <ManagerDailyTaskScreen
          navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
          route={{ key: 'manager-checkout-only-keys', name: 'ManagerDailyTask', params: { taskId: mockTask.id } } as any}
        />
      </I18nProvider>,
    )

    expect(ui.getByTestId('manager-keys-current').props.children).toBe('1 套')
    fireEvent.press(ui.getByTestId('manager-keys-edit'))
    fireEvent.press(ui.getByTestId('manager-keys-option-2'))
    fireEvent.press(ui.getByText('保存修改'))

    await waitFor(() => expect(api.updateCleaningTaskManagerFields).toHaveBeenCalledWith(
      mockAuthState.token,
      expect.objectContaining({ task_ids: ['cleaning-1'], keys_required: 2 }),
    ))
    await waitFor(() => expect(store.patchWorkTaskItem).toHaveBeenCalledWith(
      mockTask.id,
      expect.objectContaining({ keys_required: 2, keys_required_checkout: 2 }),
    ))
    const cachePatch = store.patchWorkTaskItem.mock.calls.at(-1)?.[1]
    expect(cachePatch).not.toHaveProperty('keys_required_checkin')
    ui.unmount()
  } finally {
    Object.assign(mockTask, before)
    if (before.keys_required === undefined) delete mockTask.keys_required
    if (before.keys_required_checkout === undefined) delete mockTask.keys_required_checkout
    if (before.keys_required_checkin === undefined) delete mockTask.keys_required_checkin
  }
})

test('manager save retries reuse one operation id and a later edit gets a new id', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert')
  ;(api.updateCleaningTaskManagerFields as jest.Mock)
    .mockRejectedValueOnce(new Error('response_lost'))
    .mockResolvedValue({ ok: true })
  const ManagerDailyTaskScreen = jest.requireActual<typeof import('./ManagerDailyTaskScreen')>('./ManagerDailyTaskScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <ManagerDailyTaskScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'manager-operation-retry', name: 'ManagerDailyTask', params: { taskId: mockTask.id } } as any}
      />
    </I18nProvider>,
  )

  fireEvent.changeText(ui.getByTestId('manager-guest-note'), 'response lost draft')
  fireEvent.press(ui.getByText('保存修改'))
  await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(expect.any(String), 'response_lost'))
  const firstPayload = (api.updateCleaningTaskManagerFields as jest.Mock).mock.calls[0]?.[1]
  expect(firstPayload.operation_id).toMatch(/^mobile-manager-save-/)

  fireEvent.press(ui.getByText('保存修改'))
  await waitFor(() => expect(api.updateCleaningTaskManagerFields).toHaveBeenCalledTimes(2))
  const retryPayload = (api.updateCleaningTaskManagerFields as jest.Mock).mock.calls[1]?.[1]
  expect(retryPayload.operation_id).toBe(firstPayload.operation_id)

  fireEvent.changeText(ui.getByTestId('manager-guest-note'), 'intentional later edit')
  fireEvent.press(ui.getByText('保存修改'))
  await waitFor(() => expect(api.updateCleaningTaskManagerFields).toHaveBeenCalledTimes(3))
  const laterPayload = (api.updateCleaningTaskManagerFields as jest.Mock).mock.calls[2]?.[1]
  expect(laterPayload.operation_id).not.toBe(firstPayload.operation_id)
  ui.unmount()
})

test.each([
  ['unknown version', { ok: true, manager_fields_receipt_version: 2, authoritative_updates: [] }],
  ['incomplete v1', { ok: true, manager_fields_receipt_version: 1 }],
])('a %s receipt never takes the legacy cache path and keeps the operation id for retry', async (_label, response) => {
  const alertSpy = jest.spyOn(Alert, 'alert')
  const store = jest.requireMock('../../lib/workTasksStore') as any
  const notices = jest.requireMock('../../lib/noticesStore') as any
  ;(api.updateCleaningTaskManagerFields as jest.Mock)
    .mockResolvedValueOnce(response)
    .mockImplementationOnce(async (_token: string, payload: any) => ({
      ok: true,
      operation_id: payload.operation_id,
      manager_fields_receipt_version: 1,
      authoritative_updates: [],
      projection_refresh_required: false,
    }))
  store.applyManagerTaskSaveReceipt
    .mockResolvedValueOnce({
      supported: false,
      accepted: true,
      appliedItems: 0,
      persisted: false,
      projectionRefreshRequired: true,
    })
    .mockResolvedValueOnce({
      supported: true,
      accepted: true,
      appliedItems: 0,
      persisted: true,
      projectionRefreshRequired: false,
    })
  const ManagerDailyTaskScreen = jest.requireActual<typeof import('./ManagerDailyTaskScreen')>('./ManagerDailyTaskScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <ManagerDailyTaskScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: `manager-invalid-receipt-${_label}`, name: 'ManagerDailyTask', params: { taskId: mockTask.id } } as any}
      />
    </I18nProvider>,
  )

  fireEvent.changeText(ui.getByTestId('manager-guest-note'), 'receipt must be authoritative')
  fireEvent.press(ui.getByText('保存修改'))
  await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(
    expect.any(String),
    '保存回执异常，已安排后台权威刷新，请稍后重试',
  ))
  await waitFor(() => expect(store.requestWorkTasksRefresh).toHaveBeenCalledWith(expect.objectContaining({
    mode: 'consistency',
    reason: 'manager_task_receipt_invalid',
  })))
  const firstPayload = (api.updateCleaningTaskManagerFields as jest.Mock).mock.calls[0]?.[1]
  expect(firstPayload.operation_id).toMatch(/^mobile-manager-save-/)
  expect(store.patchWorkTaskItem).not.toHaveBeenCalled()
  expect(store.patchWorkTaskItems).not.toHaveBeenCalled()
  expect(store.reconcileActiveWorkTasksAfterLocalPatch).not.toHaveBeenCalled()
  expect(notices.prependNotice).not.toHaveBeenCalled()

  fireEvent.press(ui.getByText('保存修改'))
  await waitFor(() => expect(api.updateCleaningTaskManagerFields).toHaveBeenCalledTimes(2))
  const retryPayload = (api.updateCleaningTaskManagerFields as jest.Mock).mock.calls[1]?.[1]
  expect(retryPayload.operation_id).toBe(firstPayload.operation_id)
  expect(store.patchWorkTaskItem).not.toHaveBeenCalled()
  await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(expect.any(String), '已保存'))
  ui.unmount()
})

test('a late old-backend response rejected after a session switch never patches the new session cache', async () => {
  const store = jest.requireMock('../../lib/workTasksStore') as any
  ;(api.updateCleaningTaskManagerFields as jest.Mock).mockResolvedValueOnce({ ok: true })
  store.applyManagerTaskSaveReceipt.mockResolvedValueOnce({
    supported: false,
    accepted: false,
    appliedItems: 0,
    persisted: false,
    projectionRefreshRequired: true,
  })
  const ManagerDailyTaskScreen = jest.requireActual<typeof import('./ManagerDailyTaskScreen')>('./ManagerDailyTaskScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <ManagerDailyTaskScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'manager-late-legacy-session-switch', name: 'ManagerDailyTask', params: { taskId: mockTask.id } } as any}
      />
    </I18nProvider>,
  )

  fireEvent.changeText(ui.getByTestId('manager-guest-note'), 'must not cross authority sessions')
  fireEvent.press(ui.getByText('保存修改'))
  await waitFor(() => expect(store.applyManagerTaskSaveReceipt).toHaveBeenCalled())
  await waitFor(() => expect(ui.getByText('保存修改')).toBeTruthy())
  expect(store.patchWorkTaskItem).not.toHaveBeenCalled()
  expect(store.patchWorkTaskItems).not.toHaveBeenCalled()
  expect(store.reconcileActiveWorkTasksAfterLocalPatch).not.toHaveBeenCalled()
  expect(store.requestWorkTasksRefresh).not.toHaveBeenCalledWith(expect.objectContaining({
    reason: 'manager_task_saved_legacy_backend',
  }))
  const notices = jest.requireMock('../../lib/noticesStore') as any
  expect(notices.prependNotice).not.toHaveBeenCalled()
  ui.unmount()
})

test('password authority shows review state and same-value verification previews impact before an atomic save', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert')
  const ManagerDailyTaskScreen = jest.requireActual<typeof import('./ManagerDailyTaskScreen')>('./ManagerDailyTaskScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <ManagerDailyTaskScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'manager-password-authority', name: 'ManagerDailyTask', params: { taskId: mockTask.id } } as any}
      />
    </I18nProvider>,
  )

  expect(ui.getByTestId('manager-old-code-authority').props.children).toBe('待核对')
  expect(ui.getByTestId('manager-new-code-authority').props.children).toBe('已关联来源')
  const store = jest.requireMock('../../lib/workTasksStore') as any
  store.requestWorkTasksRefresh.mockResolvedValueOnce(false)
  fireEvent.press(ui.getByTestId('manager-password-authority-verify'))

  await waitFor(() => expect(api.previewCleaningTaskPasswordAuthority).toHaveBeenCalledWith(
    mockAuthState.token,
    { task_ids: ['cleaning-1', 'inspection-1'], fields: ['old_code', 'new_code'] },
  ))
  const confirmation = alertSpy.mock.calls.find((call) => call[0] === '确认核对密码来源？')
  expect(String(confirmation?.[1] || '')).toContain('关联更新：2 条')
  const confirmButton = (confirmation?.[2] as any[])?.find((button) => button.text === '确认核对')
  await act(async () => {
    confirmButton.onPress()
  })

  await waitFor(() => expect(api.updateCleaningTaskManagerFields).toHaveBeenCalledWith(
    mockAuthState.token,
    expect.objectContaining({
      task_ids: ['cleaning-1'],
      password_task_ids: ['cleaning-1', 'inspection-1'],
      password_verification: expect.objectContaining({ fields: ['old_code', 'new_code'], client: 'mobile' }),
    }),
  ))
  const submitted = (api.updateCleaningTaskManagerFields as jest.Mock).mock.calls.at(-1)?.[1]
  expect(submitted.operation_id).toMatch(/^mobile-manager-save-/)
  expect(submitted.password_verification.request_id).toBe(submitted.operation_id)
  expect(submitted).not.toHaveProperty('old_code')
  expect(submitted).not.toHaveProperty('new_code')
  await waitFor(() => expect(store.requestWorkTasksRefresh).toHaveBeenCalledWith(expect.objectContaining({ mode: 'force', reason: 'manager_task_saved_legacy_backend' })))
  await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(
    expect.any(String),
    '已保存',
  ))
  for (const [, patch] of store.patchWorkTaskItem.mock.calls) {
    expect(patch).not.toHaveProperty('old_code')
    expect(patch).not.toHaveProperty('new_code')
  }
  ui.unmount()
})

test('changed password previews the affected chain and requires explicit confirmation before save', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert')
  const ManagerDailyTaskScreen = jest.requireActual<typeof import('./ManagerDailyTaskScreen')>('./ManagerDailyTaskScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <ManagerDailyTaskScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'manager-password-change-preview', name: 'ManagerDailyTask', params: { taskId: mockTask.id } } as any}
      />
    </I18nProvider>,
  )

  fireEvent.changeText(ui.getByPlaceholderText('旧密码'), 'changed-old-code')
  fireEvent.press(ui.getByText('保存修改'))

  await waitFor(() => expect(api.previewCleaningTaskPasswordAuthority).toHaveBeenCalledWith(
    mockAuthState.token,
    { task_ids: ['cleaning-1'], fields: ['old_code'] },
  ))
  expect(api.updateCleaningTaskManagerFields).not.toHaveBeenCalled()

  const confirmation = alertSpy.mock.calls.find((call) => call[0] === '确认保存密码修改？')
  expect(String(confirmation?.[1] || '')).toContain('关联更新：2 条')
  const confirmButton = (confirmation?.[2] as any[])?.find((button) => button.text === '确认保存')
  await act(async () => {
    confirmButton.onPress()
  })

  await waitFor(() => expect(api.updateCleaningTaskManagerFields).toHaveBeenCalledWith(
    mockAuthState.token,
    expect.objectContaining({
      task_ids: ['cleaning-1'],
      old_code: 'changed-old-code',
      password_verification: expect.objectContaining({ fields: ['old_code'], client: 'mobile' }),
    }),
  ))
  const submitted = (api.updateCleaningTaskManagerFields as jest.Mock).mock.calls.at(-1)?.[1]
  expect(submitted).not.toHaveProperty('new_code')
  ui.unmount()
})

test('successful check-in password save applies the receipt without awaiting a 15-day refresh and survives immediate reopen', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert')
  const store = jest.requireMock('../../lib/workTasksStore') as any
  const before = {
    task_type: mockTask.task_type,
    has_checkin_task: mockTask.has_checkin_task,
    turnover_display: mockTask.turnover_display,
    password_authority: mockTask.password_authority,
  }
  try {
    mockTask.task_type = 'checkin_clean'
    mockTask.has_checkin_task = true
    mockTask.turnover_display = {
      checkin_order_id: 'checkin-order-1',
      old_code: null,
      old_code_task_id: null,
      new_code: 'CI-INITIAL',
      new_code_task_id: 'cleaning-1',
      active_source_ids: ['cleaning-1'],
    }
    mockTask.password_authority = { new_code_status: 'needs_review' }
    ;(api.updateCleaningTaskManagerFields as jest.Mock).mockImplementationOnce(async (_token: string, payload: any) => ({
      ok: true,
      operation_id: payload.operation_id,
      manager_fields_receipt_version: 1,
      authoritative_updates: [{ task_id: 'cleaning-1', task_type: 'checkin_clean', new_code: 'MOB-CI-914', sequence_no: 801 }],
      projection_refresh_required: false,
    }))
    store.applyManagerTaskSaveReceipt.mockImplementationOnce(async () => {
      mockFoundTask = {
        ...mockTask,
        new_code: 'MOB-CI-914',
        turnover_display: {
          ...mockTask.turnover_display,
          new_code: 'MOB-CI-914',
          new_code_authority_status: 'manual_confirmed',
        },
        password_authority: { new_code_status: 'manual_confirmed' },
      }
      return { supported: true, appliedItems: 1, persisted: true, projectionRefreshRequired: false }
    })

    const ManagerDailyTaskScreen = jest.requireActual<typeof import('./ManagerDailyTaskScreen')>('./ManagerDailyTaskScreen').default as React.ComponentType<any>
    const renderScreen = (key: string) => render(
      <I18nProvider>
        <ManagerDailyTaskScreen
          navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
          route={{ key, name: 'ManagerDailyTask', params: { taskId: mockTask.id } } as any}
        />
      </I18nProvider>,
    )
    const first = renderScreen('manager-checkin-password-cache-first')
    fireEvent.changeText(first.getByPlaceholderText('新密码'), 'MOB-CI-914')
    fireEvent.press(first.getByText('保存修改'))
    await waitFor(() => expect(api.previewCleaningTaskPasswordAuthority).toHaveBeenCalled())
    const confirmation = alertSpy.mock.calls.find((call) => call[0] === '确认保存密码修改？')
    const confirmButton = (confirmation?.[2] as any[])?.find((button) => button.text === '确认保存')
    await act(async () => {
      confirmButton.onPress()
    })

    await waitFor(() => expect(store.applyManagerTaskSaveReceipt).toHaveBeenCalledWith(expect.objectContaining({
      manager_fields_receipt_version: 1,
      authoritative_updates: [expect.objectContaining({ task_id: 'cleaning-1', new_code: 'MOB-CI-914' })],
    })))
    expect(store.patchWorkTaskItem).not.toHaveBeenCalled()
    expect(store.reconcileActiveWorkTasksAfterLocalPatch).not.toHaveBeenCalled()
    expect(store.requestWorkTasksRefresh).not.toHaveBeenCalledWith(expect.objectContaining({ reason: expect.stringContaining('manager_task') }))
    await waitFor(() => expect(first.getByDisplayValue('MOB-CI-914')).toBeTruthy())
    first.unmount()

    const reopened = renderScreen('manager-checkin-password-cache-reopen')
    expect(reopened.getByDisplayValue('MOB-CI-914')).toBeTruthy()
    reopened.unmount()
  } finally {
    Object.assign(mockTask, before)
    mockFoundTask = null
  }
})

test('a projection reconciliation ignores its transient empty detail bucket and issues only one list request', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert')
  const store = jest.requireMock('../../lib/workTasksStore') as any
  ;(api.updateCleaningTaskManagerFields as jest.Mock).mockImplementationOnce(async (_token: string, payload: any) => ({
    ok: true,
    operation_id: payload.operation_id,
    manager_fields_receipt_version: 1,
    authoritative_updates: [{ task_id: 'inspection-1', task_type: 'checkin_clean', checkin_time: '2:45pm', sequence_no: 901 }],
    projection_refresh_required: true,
  }))
  store.applyManagerTaskSaveReceipt.mockResolvedValueOnce({
    supported: true,
    appliedItems: 1,
    persisted: true,
    projectionRefreshRequired: true,
  })
  let resolveProjectionRefresh!: (value: boolean) => void
  store.requestWorkTasksRefresh.mockImplementationOnce(() => new Promise<boolean>((resolve) => {
    resolveProjectionRefresh = resolve
  }))

  const ManagerDailyTaskScreen = jest.requireActual<typeof import('./ManagerDailyTaskScreen')>('./ManagerDailyTaskScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <ManagerDailyTaskScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'manager-receipt-background-projection', name: 'ManagerDailyTask', params: { taskId: mockTask.id } } as any}
      />
    </I18nProvider>,
  )
  fireEvent.changeText(ui.getByTestId('manager-checkin-time'), '2:45pm')
  fireEvent.press(ui.getByText('保存修改'))

  await waitFor(() => expect(store.requestWorkTasksRefresh).toHaveBeenCalledWith(expect.objectContaining({
    mode: 'consistency',
    reason: 'manager_task_projection_reconcile',
  })))
  // The real store initializes the new 15-day detail bucket as empty before
  // its list response arrives. That transient emit must not be mistaken for a
  // genuinely missing task and trigger manager_task_fallback.
  act(() => {
    mockFoundTask = null
    mockWorkTasksStoreListener?.()
  })
  await Promise.resolve()
  await Promise.resolve()
  expect(store.requestWorkTasksRefresh).toHaveBeenCalledTimes(1)
  await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(expect.any(String), '已保存'))

  act(() => {
    mockFoundTask = { ...mockTask, checkin_time: '2:45pm', end_time: '2:45pm' }
    mockWorkTasksStoreListener?.()
    resolveProjectionRefresh(true)
  })
  await waitFor(() => expect(store.requestWorkTasksRefresh).toHaveBeenCalledTimes(1))
  expect(store.requestWorkTasksRefresh).not.toHaveBeenCalledWith(expect.objectContaining({ reason: 'manager_task_fallback' }))
  ui.unmount()
})

test('an initially uncached route still performs one detail fallback request', async () => {
  const store = jest.requireMock('../../lib/workTasksStore') as any
  mockFoundTask = null

  const ManagerDailyTaskScreen = jest.requireActual<typeof import('./ManagerDailyTaskScreen')>('./ManagerDailyTaskScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <ManagerDailyTaskScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'manager-initially-uncached', name: 'ManagerDailyTask', params: { taskId: 'uncached-task-1' } } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => expect(store.requestWorkTasksRefresh).toHaveBeenCalledTimes(1))
  expect(store.requestWorkTasksRefresh).toHaveBeenCalledWith(expect.objectContaining({
    mode: 'force',
    reason: 'manager_task_fallback',
  }))
  ui.unmount()
})

test('a same-user authority session change resets the resolved-route fallback guard', async () => {
  const store = jest.requireMock('../../lib/workTasksStore') as any
  const beforeToken = mockAuthState.token
  const beforeRole = mockAuthState.user.role
  const beforeRoles = mockAuthState.user.roles
  const beforePermissions = (mockAuthState.user as any).permissions
  let ui: ReturnType<typeof render> | null = null
  try {
    const ManagerDailyTaskScreen = jest.requireActual<typeof import('./ManagerDailyTaskScreen')>('./ManagerDailyTaskScreen').default as React.ComponentType<any>
    ui = render(
      <I18nProvider>
        <ManagerDailyTaskScreen
          navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
          route={{ key: 'manager-authority-session-change', name: 'ManagerDailyTask', params: { taskId: mockTask.id } } as any}
        />
      </I18nProvider>,
    )
    expect(store.requestWorkTasksRefresh).not.toHaveBeenCalled()

    mockAuthState.token = 'rotated-local-preview-token'
    mockAuthState.user.role = 'admin'
    mockAuthState.user.roles = ['admin']
    ;(mockAuthState.user as any).permissions = ['cleaning.schedule.manage']
    act(() => {
      mockFoundTask = null
      mockWorkTasksStoreListener?.()
    })

    await waitFor(() => expect(store.requestWorkTasksRefresh).toHaveBeenCalledTimes(1))
    expect(store.requestWorkTasksRefresh).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'force',
      reason: 'manager_task_fallback',
      token: 'rotated-local-preview-token',
    }))
  } finally {
    ui?.unmount()
    mockAuthState.token = beforeToken
    mockAuthState.user.role = beforeRole
    mockAuthState.user.roles = beforeRoles
    if (beforePermissions === undefined) delete (mockAuthState.user as any).permissions
    else (mockAuthState.user as any).permissions = beforePermissions
  }
})

test('blank first-time new password refreshes a stale target projection and saves against the exact check-in task', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert')
  const store = jest.requireMock('../../lib/workTasksStore') as any
  const before = {
    active_source_ids: mockTask.active_source_ids,
    inspection_mode: mockTask.inspection_mode,
    turnover_display: mockTask.turnover_display,
  }
  try {
    mockTask.active_source_ids = ['cleaning-1']
    mockTask.inspection_mode = 'pending_decision'
    mockTask.turnover_display = {
      checkout_order_id: 'checkout-order-1',
      checkin_order_id: 'checkin-order-1',
      old_code: 'old-code',
      old_code_task_id: 'cleaning-1',
      new_code: null,
      new_code_task_id: null,
      active_source_ids: ['cleaning-1'],
    }
    const provideRefreshedTarget = async () => {
      mockFoundTask = {
        ...mockTask,
        turnover_display: {
          ...mockTask.turnover_display,
          new_code_task_id: 'checkin-refreshed-target',
        },
      }
      return true
    }
    store.requestWorkTasksRefresh
      .mockImplementationOnce(provideRefreshedTarget)
      .mockImplementationOnce(provideRefreshedTarget)

    const ManagerDailyTaskScreen = jest.requireActual<typeof import('./ManagerDailyTaskScreen')>('./ManagerDailyTaskScreen').default as React.ComponentType<any>
    const ui = render(
      <I18nProvider>
        <ManagerDailyTaskScreen
          navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
          route={{ key: 'manager-blank-new-code-target-refresh', name: 'ManagerDailyTask', params: { taskId: mockTask.id } } as any}
        />
      </I18nProvider>,
    )

    expect(mockTask).not.toHaveProperty('inspector_id')
    fireEvent.changeText(ui.getByPlaceholderText('新密码'), 'first-new-code')
    fireEvent.press(ui.getByText('保存修改'))

    await waitFor(() => expect(store.requestWorkTasksRefresh).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'force',
      reason: 'manager_password_preview_target_missing',
    })))
    expect(ui.getByDisplayValue('first-new-code')).toBeTruthy()
    await waitFor(() => expect(api.previewCleaningTaskPasswordAuthority).toHaveBeenCalledWith(
      mockAuthState.token,
      { task_ids: ['checkin-refreshed-target'], fields: ['new_code'] },
    ))
    const confirmation = alertSpy.mock.calls.find((call) => call[0] === '确认保存密码修改？')
    const confirmButton = (confirmation?.[2] as any[])?.find((button) => button.text === '确认保存')
    await act(async () => {
      confirmButton.onPress()
    })

    await waitFor(() => expect(api.updateCleaningTaskManagerFields).toHaveBeenCalledWith(
      mockAuthState.token,
      expect.objectContaining({
        task_ids: ['cleaning-1'],
        password_task_ids: ['checkin-refreshed-target'],
        new_code: 'first-new-code',
      }),
    ))
    ui.unmount()
  } finally {
    Object.assign(mockTask, before)
    mockFoundTask = null
  }
})

test('offline target refresh sends no password request and keeps the draft for retry', async () => {
  const store = jest.requireMock('../../lib/workTasksStore') as any
  const before = mockTask.turnover_display
  try {
    mockTask.turnover_display = {
      checkout_order_id: 'checkout-order-1',
      checkin_order_id: 'checkin-order-1',
      old_code: 'old-code',
      old_code_task_id: 'cleaning-1',
      new_code: null,
      new_code_task_id: null,
      active_source_ids: ['cleaning-1'],
    }
    store.requestWorkTasksRefresh.mockRejectedValueOnce(new Error('offline'))
    const ManagerDailyTaskScreen = jest.requireActual<typeof import('./ManagerDailyTaskScreen')>('./ManagerDailyTaskScreen').default as React.ComponentType<any>
    const ui = render(
      <I18nProvider>
        <ManagerDailyTaskScreen
          navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
          route={{ key: 'manager-password-target-offline', name: 'ManagerDailyTask', params: { taskId: mockTask.id } } as any}
        />
      </I18nProvider>,
    )
    fireEvent.changeText(ui.getByPlaceholderText('新密码'), 'offline-draft')
    fireEvent.press(ui.getByText('保存修改'))
    await waitFor(() => expect(store.requestWorkTasksRefresh).toHaveBeenCalledWith(expect.objectContaining({
      reason: 'manager_password_preview_target_missing',
    })))
    expect(api.previewCleaningTaskPasswordAuthority).not.toHaveBeenCalled()
    expect(api.updateCleaningTaskManagerFields).not.toHaveBeenCalled()
    expect(ui.getByDisplayValue('offline-draft')).toBeTruthy()
    ui.unmount()
  } finally {
    mockTask.turnover_display = before
  }
})

test('a lost save response ignores a repeated confirmation and keeps the password draft', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert')
  let rejectUpdate: ((error: Error) => void) | null = null
  ;(api.updateCleaningTaskManagerFields as jest.Mock).mockImplementationOnce(() => new Promise((_resolve, reject) => {
    rejectUpdate = reject
  }))
  const ManagerDailyTaskScreen = jest.requireActual<typeof import('./ManagerDailyTaskScreen')>('./ManagerDailyTaskScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <ManagerDailyTaskScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'manager-password-response-lost', name: 'ManagerDailyTask', params: { taskId: mockTask.id } } as any}
      />
    </I18nProvider>,
  )
  fireEvent.changeText(ui.getByPlaceholderText('旧密码'), 'response-lost-draft')
  fireEvent.press(ui.getByText('保存修改'))
  await waitFor(() => expect(api.previewCleaningTaskPasswordAuthority).toHaveBeenCalled())
  const confirmation = alertSpy.mock.calls.find((call) => call[0] === '确认保存密码修改？')
  const confirmButton = (confirmation?.[2] as any[])?.find((button) => button.text === '确认保存')
  await act(async () => {
    confirmButton.onPress()
    confirmButton.onPress()
  })
  await waitFor(() => expect(api.updateCleaningTaskManagerFields).toHaveBeenCalledTimes(1))
  await act(async () => {
    rejectUpdate?.(new Error('response_lost'))
  })
  await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(expect.any(String), 'response_lost'))
  expect(ui.getByDisplayValue('response-lost-draft')).toBeTruthy()
  ui.unmount()
})

test('role-split turnover previews and saves passwords against both exact source tasks', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert')
  const ManagerDailyTaskScreen = jest.requireActual<typeof import('./ManagerDailyTaskScreen')>('./ManagerDailyTaskScreen').default as React.ComponentType<any>
  const before = {
    task_kind: mockTask.task_kind,
    active_source_ids: mockTask.active_source_ids,
    cleaning_task_ids: mockTask.cleaning_task_ids,
    inspection_task_ids: mockTask.inspection_task_ids,
    turnover_display: mockTask.turnover_display,
  }
  try {
    mockTask.task_kind = 'inspection'
    mockTask.active_source_ids = ['checkout-source-1', 'checkin-source-1']
    mockTask.cleaning_task_ids = ['checkout-source-1']
    mockTask.inspection_task_ids = ['checkin-source-1']
    mockTask.turnover_display = {
      checkout_order_id: 'checkout-order-1',
      checkin_order_id: 'checkin-order-1',
      old_code: 'old-code',
      old_code_task_id: 'checkout-source-1',
      new_code: 'new-code',
      new_code_task_id: 'checkin-source-1',
    }
    const ui = render(
      <I18nProvider>
        <ManagerDailyTaskScreen
          navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
          route={{ key: 'manager-role-split-passwords', name: 'ManagerDailyTask', params: { taskId: mockTask.id } } as any}
        />
      </I18nProvider>,
    )

    fireEvent.changeText(ui.getByPlaceholderText('例如 11am'), '10:30am')
    fireEvent.changeText(ui.getByTestId('manager-checkin-time'), '2:30pm')
    fireEvent.changeText(ui.getByPlaceholderText('旧密码'), 'updated-old-code')
    fireEvent.changeText(ui.getByPlaceholderText('新密码'), 'updated-new-code')
    fireEvent.press(ui.getByTestId('manager-password-authority-verify'))
    await waitFor(() => expect(api.previewCleaningTaskPasswordAuthority).toHaveBeenCalledWith(
      mockAuthState.token,
      { task_ids: ['checkout-source-1', 'checkin-source-1'], fields: ['old_code', 'new_code'] },
    ))
    const confirmation = alertSpy.mock.calls.find((call) => call[0] === '确认核对密码来源？')
    const confirmButton = (confirmation?.[2] as any[])?.find((button) => button.text === '确认核对')
    await act(async () => {
      confirmButton.onPress()
    })
    await waitFor(() => expect(api.updateCleaningTaskManagerFields).toHaveBeenCalledWith(
      mockAuthState.token,
      expect.objectContaining({
        task_ids: ['checkout-source-1', 'checkin-source-1'],
        password_task_ids: ['checkout-source-1', 'checkin-source-1'],
        items: [
          { id: 'checkin-source-1', checkin_time: '2:30pm' },
          { id: 'checkout-source-1', checkout_time: '10:30am' },
        ],
        old_code: 'updated-old-code',
        new_code: 'updated-new-code',
        password_verification: expect.objectContaining({ fields: ['old_code', 'new_code'] }),
      }),
    ))
    ui.unmount()
  } finally {
    Object.assign(mockTask, before)
  }
})

test.each([
  ['ios', 320, 568],
  ['android', 360, 640],
])('small %s viewport keeps the note and standalone key editor usable', async (os, width, height) => {
  const originalOS = Platform.OS
  const originalWindow = Dimensions.get('window')
  const originalScreen = Dimensions.get('screen')
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os })
  ;(Dimensions as any).set({
    window: { ...originalWindow, width, height },
    screen: { ...originalScreen, width, height },
  })

  try {
    const ManagerDailyTaskScreen = jest.requireActual<typeof import('./ManagerDailyTaskScreen')>('./ManagerDailyTaskScreen').default as React.ComponentType<any>
    const ui = render(
      <I18nProvider>
        <ManagerDailyTaskScreen
          navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
          route={{ key: `manager-small-${os}`, name: 'ManagerDailyTask', params: { taskId: mockTask.id } } as any}
        />
      </I18nProvider>,
    )

    const keyRowStyle = StyleSheet.flatten(ui.getByTestId('manager-keys-row').props.style)
    expect(keyRowStyle.flexWrap).toBe('wrap')
    expect(ui.getByTestId('manager-guest-note').props.editable).toBe(true)
    expect(ui.getByTestId('manager-keys-current').props.children).toBe('2 套')
    fireEvent.press(ui.getByTestId('manager-keys-edit'))
    expect(ui.getByTestId('manager-keys-option-1')).toBeTruthy()
    expect(ui.getByTestId('manager-keys-option-2')).toBeTruthy()
    expect(ui.getByTestId('manager-keys-cancel')).toBeTruthy()
    ui.unmount()
  } finally {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS })
    ;(Dimensions as any).set({ window: originalWindow, screen: originalScreen })
  }
})

test.each([
  ['ios', 320, 568],
  ['android', 360, 640],
])('MZ067 check-in note keeps the time inputs aligned at a small %s viewport', async (os, width, height) => {
  const originalOS = Platform.OS
  const originalWindow = Dimensions.get('window')
  const originalScreen = Dimensions.get('screen')
  const before = {
    task_type: mockTask.task_type,
    has_checkin_task: mockTask.has_checkin_task,
    end_time: mockTask.end_time,
    checkin_time_note: mockTask.checkin_time_note,
  }
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os })
  ;(Dimensions as any).set({
    window: { ...originalWindow, width, height, fontScale: 1.3 },
    screen: { ...originalScreen, width, height, fontScale: 1.3 },
  })
  mockTask.task_type = 'checkout_clean'
  mockTask.has_checkin_task = false
  mockTask.end_time = null
  mockTask.checkin_time_note = '1pm'

  try {
    const ManagerDailyTaskScreen = jest.requireActual<typeof import('./ManagerDailyTaskScreen')>('./ManagerDailyTaskScreen').default as React.ComponentType<any>
    const ui = render(
      <I18nProvider>
        <ManagerDailyTaskScreen
          navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
          route={{ key: `manager-mz067-note-layout-${os}`, name: 'ManagerDailyTask', params: { taskId: mockTask.id } } as any}
        />
      </I18nProvider>,
    )

    expect(ui.getByText('退房时间')).toBeTruthy()
    expect(ui.getByText('入住时间备注')).toBeTruthy()
    expect(ui.getByTestId('manager-checkin-time').props.value).toBe('1pm')
    expect(ui.getByText('仅记录时间，不会创建入住任务')).toBeTruthy()
    expect(ui.queryByText('入住时间备注（未创建入住任务）')).toBeNull()

    const rendered = flattenedText(ui.toJSON())
    expect(rendered.indexOf('退房时间')).toBeLessThan(rendered.indexOf('入住时间备注'))
    expect(rendered.indexOf('入住时间备注')).toBeLessThan(rendered.indexOf('仅记录时间，不会创建入住任务'))
    expect(rendered.indexOf('仅记录时间，不会创建入住任务')).toBeLessThan(rendered.indexOf('旧密码'))
    ui.unmount()
  } finally {
    Object.assign(mockTask, before)
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS })
    ;(Dimensions as any).set({ window: originalWindow, screen: originalScreen })
  }
})

test('MZ048 manager history keeps legacy appliance labels and shows new storage labels by their own keys', async () => {
  mockConsumablesResponse = {
    living_room_photo_urls: [],
    items: [
      { item_id: 'coffee_machine_photo', photo_url: 'cleaning/legacy-coffee.jpg' },
      { item_id: 'cutlery_drawer_photo_v2', photo_url: 'cleaning/cutlery-drawer.jpg' },
      { item_id: 'kitchen_utensils_drawer_photo_v2', photo_url: 'cleaning/kitchen-drawer.jpg' },
      { item_id: 'cups_dishes_cabinet_photo_v2', photo_url: 'cleaning/cabinet.jpg' },
    ],
  }
  const ManagerDailyTaskScreen = jest.requireActual<typeof import('./ManagerDailyTaskScreen')>('./ManagerDailyTaskScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <ManagerDailyTaskScreen
        navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
        route={{ key: 'manager-mz048-history', name: 'ManagerDailyTask', params: { taskId: mockTask.id } } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByText('咖啡机')).toBeTruthy())
  expect(ui.getByText('刀叉勺抽屉')).toBeTruthy()
  expect(ui.getByText('厨房用品抽屉')).toBeTruthy()
  expect(ui.getByText('杯子、碗碟柜')).toBeTruthy()
})

test('disabled guest-ready action remains pressable to explain the server reason', async () => {
  const originalActions = mockTask.available_actions
  mockTask.available_actions = [{
    id: 'record_guest_ready_notified',
    label: '已通知客人',
    placement: 'primary',
    enabled: false,
    disabled_reason: 'property_not_ready',
    target: 'TaskDetail',
    intent: 'manager',
    source_id: 'checkin-order-1',
  }]
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})

  try {
    const ManagerDailyTaskScreen = jest.requireActual<typeof import('./ManagerDailyTaskScreen')>('./ManagerDailyTaskScreen').default as React.ComponentType<any>
    const ui = render(
      <I18nProvider>
        <ManagerDailyTaskScreen
          navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}) } as any}
          route={{ key: 'manager-ready-disabled', name: 'ManagerDailyTask', params: { taskId: mockTask.id } } as any}
        />
      </I18nProvider>,
    )

    await waitFor(() => expect(ui.getByText('钥匙与挂钥匙视频')).toBeTruthy())
    fireEvent.press(ui.getByTestId('manager-guest-ready-action-record_guest_ready_notified'))
    expect(alert).toHaveBeenCalledWith('暂不可操作', '房屋尚未设为可入住')
  } finally {
    alert.mockRestore()
    mockTask.available_actions = originalActions
  }
})
