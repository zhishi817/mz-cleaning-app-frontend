import React from 'react'
import { Alert } from 'react-native'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { I18nProvider } from '../../lib/i18n'

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
  mockConsumablesResponse = defaultConsumablesResponse
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
  expect(text.indexOf('客服信息')).toBeLessThan(text.indexOf('当天任务临时通知'))
  expect(text.indexOf('当天任务临时通知')).toBeLessThan(text.indexOf('钥匙与挂钥匙视频'))
  expect(text.indexOf('钥匙与挂钥匙视频')).toBeLessThan(text.indexOf('清洁现场照片'))
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
