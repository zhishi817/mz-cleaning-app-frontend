import React from 'react'
import { Alert, Dimensions, Platform, StyleSheet } from 'react-native'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { I18nProvider } from '../../lib/i18n'
import * as api from '../../lib/api'

const mockTodayKey = (() => {
  const now = new Date()
  const pad2 = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
})()

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

const mockAuthState = {
  token: 'local-preview-token',
  user: { id: 'customer-service-1', username: 'customer-service', role: 'customer_service', roles: ['customer_service'] },
}

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
  saveGuestLuggageNotice: jest.fn(),
  updateCleaningTaskManagerFields: jest.fn(),
  uploadMzappMedia: jest.fn(),
}))

jest.mock('../../lib/workTasksStore', () => ({
  findWorkTaskItemByAnyId: () => mockTask,
  getWorkTasksSnapshot: () => ({ items: [mockTask] }),
  patchWorkTaskItem: jest.fn(async () => {}),
  patchWorkTaskItems: jest.fn(async () => {}),
  requestWorkTasksRefresh: jest.fn(async () => {}),
  subscribeWorkTasks: jest.fn(() => () => {}),
}))

jest.mock('../../lib/noticesStore', () => ({ prependNotice: jest.fn(async () => {}) }))

jest.mock('../../components/GuestLuggageCard', () => () => null)
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
      guest_special_request: '更新后的特殊需求',
      keys_required: 1,
    }),
  ))
  expect(api.updateCleaningTaskManagerFields).toHaveBeenCalledTimes(1)
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
