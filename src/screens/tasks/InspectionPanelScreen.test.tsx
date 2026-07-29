import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { I18nProvider } from '../../lib/i18n'

const mockSnapshot = {
  items: [{
    id: 'w-inspection',
    task_kind: 'inspection',
    source_type: 'cleaning_tasks',
    source_id: 'cleaning-1',
    title: '测试房源检查',
    property_id: 'property-1',
    property: { id: 'property-1', code: 'TEST-1', address: '测试地址' },
    available_actions: [{ id: 'submit_inspection', enabled: true, target: 'InspectionPanel' }],
    restock_items: [{ item_id: 'stock-1', label: '清洁袋', qty: 1 }],
  }],
}

const mockSuppliesCatalogItems = [
  { id: 'manual-other', label: '其他补充用品', kind: 'consumable' },
  { id: 'manual-next', label: '下次补充用品', kind: 'consumable' },
]

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

jest.mock('@react-native-community/netinfo', () => ({
  useNetInfo: () => ({ isConnected: true, isInternetReachable: true }),
}))

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
}))

jest.mock('../../lib/auth', () => ({ useAuth: () => ({ token: 'test-token', user: { id: 'inspector-1', role: 'cleaning_inspector' } }) }))
jest.mock('../../lib/inspectionPanelFeedbackDraft', () => ({ getInspectionPanelFeedbackDraft: jest.fn(async () => null) }))
jest.mock('../../lib/inspectionPanelDraft', () => ({
  clearInspectionPanelDraft: jest.fn(async () => {}),
  getInspectionPanelDraft: jest.fn(async () => null),
  setInspectionPanelDraft: jest.fn(async () => {}),
}))
jest.mock('../../lib/inspectionPanelSubmitQueue', () => ({
  bindInspectionPanelCleaningTaskId: jest.fn(async () => null),
  createInspectionPanelLocalMedia: jest.fn(async () => ({ id: 'media-1', local_uri: 'file:///test.jpg' })),
  discardInspectionPanelBatch: jest.fn(async () => null),
  findInspectionPanelValidationIssue: jest.fn(() => null),
  getInspectionPanelBatch: jest.fn(async () => null),
  inspectionPanelFailedStepDetails: jest.fn(() => []),
  inspectionPanelLocalMediaSummary: jest.fn(() => null),
  processInspectionPanelSubmitQueue: jest.fn(async () => null),
  saveInspectionPanelDraftBatch: jest.fn(async () => null),
  submitInspectionPanelBatch: jest.fn(async () => null),
  subscribeInspectionPanelSubmitQueue: jest.fn(() => () => {}),
  validateInspectionPanelSnapshot: jest.fn(() => null),
}))
jest.mock('../../lib/cleaningInspection', () => ({
  inspectionScopeLabel: () => '房间检查',
  isPasswordOnlyInspectionTask: () => false,
}))
jest.mock('../../lib/imageCompression', () => ({ compressImageForUpload: jest.fn(async (uri: string) => uri) }))
jest.mock('../../lib/taskTime', () => ({ canSkipInspectionPhotosForGuestArrival: () => false, isEarlyCheckinTime: () => false }))
jest.mock('../../lib/useSuppliesCatalogStore', () => ({
  ensureSuppliesCatalogLoaded: jest.fn(async () => {}),
  retrySuppliesCatalog: jest.fn(async () => {}),
  useSuppliesCatalogStore: () => ({ items: mockSuppliesCatalogItems, hydrated: true, loading: false, refreshing: false, error: null, isFromCache: false, lastSyncedAt: null }),
}))
jest.mock('../../lib/workTasksStore', () => ({
  getWorkTasksSnapshot: () => mockSnapshot,
  patchWorkTaskItem: jest.fn(async () => {}),
  subscribeWorkTasks: jest.fn(() => () => {}),
}))
jest.mock('../../lib/storage', () => ({
  getJson: jest.fn(async () => null),
  setJson: jest.fn(async () => {}),
  remove: jest.fn(async () => {}),
}))
jest.mock('../../lib/api', () => ({
  appendInspectionIssuePhotos: jest.fn(async () => ({ ok: true, appended: 1 })),
  getCleaningConsumables: jest.fn(async () => null),
  getInspectionPhotos: jest.fn(async () => ({ items: [] })),
  uploadCleaningMedia: jest.fn(async () => ({ url: 'https://example.test/inspection-issue.jpg' })),
}))
jest.mock('../../components/GuestLuggageCard', () => () => null)
jest.mock('../../components/CleaningMediaImage', () => () => null)
jest.mock('../../components/CleaningMediaPreview', () => (props: any) => {
  const mockReact = require('react')
  const { View } = require('react-native')
  return mockReact.createElement(View, { testID: props.testID || 'cleaning-media-preview' })
})
jest.mock('../../components/ui/ResponsiveImageGrid', () => (props: any) => {
  const mockReact = require('react')
  return mockReact.createElement(
    mockReact.Fragment,
    null,
    (props.items || []).map((item: any, index: number) => mockReact.createElement(mockReact.Fragment, { key: item.key || item.id || index }, props.renderItem(item))),
  )
})
jest.mock('../../components/ui/SafeAreaBottomBar', () => () => null)
jest.mock('../../components/ui/AppButton', () => (props: any) => {
  const mockReact = require('react')
  const { Pressable, Text } = require('react-native')
  return mockReact.createElement(Pressable, { onPress: props.onPress, disabled: props.disabled, testID: props.testID }, mockReact.createElement(Text, null, props.label))
})
jest.mock('../../components/ui/AppTextInput', () => (props: any) => {
  const mockReact = require('react')
  const { TextInput } = require('react-native')
  return mockReact.createElement(TextInput, props)
})

test('检查人员可打开检查与补充页面并看到四个核心步骤', async () => {
  const InspectionPanelScreen = require('./InspectionPanelScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), addListener: jest.fn(() => () => {}), setOptions: jest.fn() }
  const ui = render(
    <I18nProvider>
      <InspectionPanelScreen navigation={navigation} route={{ key: 'inspection', name: 'InspectionPanel', params: { taskId: 'w-inspection' } }} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText('检查与补充')).toBeTruthy()
    expect(ui.getByText('1. 消耗品补充')).toBeTruthy()
    expect(ui.getByTestId('inspection-add-other-restock')).toBeTruthy()
    expect(ui.getByTestId('inspection-add-next-restock')).toBeTruthy()
    expect(ui.getByText('4. 房间检查照片')).toBeTruthy()
    expect(ui.getByText('建议拍客厅整体')).toBeTruthy()
    expect(ui.getByText('建议拍沙发表面')).toBeTruthy()
    expect(ui.getByText('浴室')).toBeTruthy()
    expect(ui.getByText('需要拍浴室整体')).toBeTruthy()
    expect(ui.getByText('5. 标记已完成')).toBeTruthy()
    expect(ui.getByTestId('inspection-sync-status-card')).toBeTruthy()
  })
})

test('检查人员可区分添加其他补充项和下次退房补充项', async () => {
  const InspectionPanelScreen = require('./InspectionPanelScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), addListener: jest.fn(() => () => {}), setOptions: jest.fn() }
  const ui = render(
    <I18nProvider>
      <InspectionPanelScreen navigation={navigation} route={{ key: 'inspection-add-restock', name: 'InspectionPanel', params: { taskId: 'w-inspection' } }} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByTestId('inspection-add-other-restock')).toBeTruthy()
    expect(ui.getByTestId('inspection-add-next-restock')).toBeTruthy()
  })

  fireEvent.press(ui.getByTestId('inspection-add-other-restock'))
  await waitFor(() => expect(ui.getByText('选择其他要补充项')).toBeTruthy())
  fireEvent.press(ui.getByText('关闭'))

  fireEvent.press(ui.getByTestId('inspection-add-next-restock'))
  await waitFor(() => expect(ui.getByText('选择下次退房要补充项')).toBeTruthy())
  fireEvent.press(ui.getByText('下次补充用品'))
  fireEvent.press(ui.getByText('加入补充列表'))

  await waitFor(() => {
    expect(ui.getByTestId('inspection-restock-manual-next-carry-forward').props.style).toEqual(expect.arrayContaining([
      expect.objectContaining({ backgroundColor: '#2563EB' }),
    ]))
  })
})

test('补充项读取期间不先显示没有待补充项，读取完成后显示缺失项目', async () => {
  const api = require('../../lib/api')
  const previousRestockItems = mockSnapshot.items[0].restock_items
  mockSnapshot.items[0].restock_items = []
  let resolveConsumables: (value: any) => void = () => {}
  const pendingConsumables = new Promise((resolve) => {
    resolveConsumables = resolve
  })
  ;(api.getCleaningConsumables as jest.Mock).mockReturnValueOnce(pendingConsumables)

  try {
    const InspectionPanelScreen = require('./InspectionPanelScreen').default as React.ComponentType<any>
    const navigation = { navigate: jest.fn(), addListener: jest.fn(() => () => {}), setOptions: jest.fn() }
    const ui = render(
      <I18nProvider>
        <InspectionPanelScreen navigation={navigation} route={{ key: 'inspection-restock-loading', name: 'InspectionPanel', params: { taskId: 'w-inspection' } }} />
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(ui.getByTestId('inspection-restock-loading')).toBeTruthy()
      expect(ui.queryByText(/当前没有待补充项/)).toBeNull()
    })

    resolveConsumables({ items: [{ item_id: 'conditioner', item_label: '护发素', qty: 1, need_restock: true }] })
    await waitFor(() => {
      expect(ui.getByText('护发素')).toBeTruthy()
      expect(ui.getByText('补充标准：不少于 1/3')).toBeTruthy()
    })
    ui.unmount()
  } finally {
    mockSnapshot.items[0].restock_items = previousRestockItems
  }
})

test('补充项读取失败不显示虚假空状态，并支持重试', async () => {
  const api = require('../../lib/api')
  const previousRestockItems = mockSnapshot.items[0].restock_items
  mockSnapshot.items[0].restock_items = []
  ;(api.getCleaningConsumables as jest.Mock)
    .mockRejectedValueOnce(new Error('network failure'))
    .mockResolvedValueOnce({ items: [{ item_id: 'conditioner', item_label: '护发素', qty: 1, need_restock: true }] })

  try {
    const InspectionPanelScreen = require('./InspectionPanelScreen').default as React.ComponentType<any>
    const navigation = { navigate: jest.fn(), addListener: jest.fn(() => () => {}), setOptions: jest.fn() }
    const ui = render(
      <I18nProvider>
        <InspectionPanelScreen navigation={navigation} route={{ key: 'inspection-restock-error', name: 'InspectionPanel', params: { taskId: 'w-inspection' } }} />
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(ui.getByTestId('inspection-restock-load-error')).toBeTruthy()
      expect(ui.queryByText(/当前没有待补充项/)).toBeNull()
    })

    fireEvent.press(ui.getByTestId('inspection-retry-restock-load'))
    await waitFor(() => expect(ui.getByText('护发素')).toBeTruthy())
    ui.unmount()
  } finally {
    mockSnapshot.items[0].restock_items = previousRestockItems
  }
})

test('点击已补充会先打开相机，拍照成功后才标记并保留补货照片', async () => {
  const imagePicker = require('expo-image-picker') as { launchCameraAsync: jest.Mock }
  imagePicker.launchCameraAsync.mockResolvedValueOnce({
    canceled: false,
    assets: [{ uri: 'file:///restock.jpg', fileName: 'restock.jpg', mimeType: 'image/jpeg' }],
  })
  const InspectionPanelScreen = require('./InspectionPanelScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), addListener: jest.fn(() => () => {}), setOptions: jest.fn() }
  const ui = render(
    <I18nProvider>
      <InspectionPanelScreen navigation={navigation} route={{ key: 'inspection', name: 'InspectionPanel', params: { taskId: 'w-inspection' } }} />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByText('已补充')).toBeTruthy())
  fireEvent.press(ui.getByText('已补充'))

  await waitFor(() => {
    expect(imagePicker.launchCameraAsync).toHaveBeenCalled()
    expect(ui.getByText('本地草稿照片')).toBeTruthy()
  })
})

test('浴室整体照片最多可以拍摄三张', async () => {
  const imagePicker = require('expo-image-picker') as { launchCameraAsync: jest.Mock }
  imagePicker.launchCameraAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///bathroom.jpg', fileName: 'bathroom.jpg', mimeType: 'image/jpeg' }],
  })
  const InspectionPanelScreen = require('./InspectionPanelScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), addListener: jest.fn(() => () => {}), setOptions: jest.fn() }
  const ui = render(
    <I18nProvider>
      <InspectionPanelScreen navigation={navigation} route={{ key: 'inspection-bathroom', name: 'InspectionPanel', params: { taskId: 'w-inspection' } }} />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByText('浴室')).toBeTruthy())
  for (let i = 0; i < 3; i += 1) {
    const addButtons = ui.getAllByText('添加')
    fireEvent.press(addButtons[addButtons.length - 1])
    await waitFor(() => expect(imagePicker.launchCameraAsync).toHaveBeenCalledTimes(i + 1))
  }

  expect(ui.getByText('3/3')).toBeTruthy()
  expect(ui.getByText('已达上限')).toBeTruthy()
})

test('完成任务仍可只读查看已同步检查照片，且不显示修改或提交入口', async () => {
  const api = require('../../lib/api')
  ;(api.getInspectionPhotos as jest.Mock).mockResolvedValueOnce({
    items: [
      { area: 'living', url: 'https://example.com/living.jpg', captured_at: '2026-07-25T01:00:00.000Z' },
      { area: 'sofa', url: 'https://example.com/sofa.jpg', captured_at: '2026-07-25T01:01:00.000Z' },
      { area: 'bathroom', url: 'https://example.com/bathroom.jpg', captured_at: '2026-07-25T01:02:00.000Z' },
    ],
  })
  const InspectionPanelScreen = require('./InspectionPanelScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), addListener: jest.fn(() => () => {}), setOptions: jest.fn() }
  const ui = render(
    <I18nProvider>
      <InspectionPanelScreen navigation={navigation} route={{ key: 'inspection-read-only', name: 'InspectionPanel', params: { taskId: 'w-inspection', sourceId: 'cleaning-1', readOnly: true } }} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(api.getInspectionPhotos).toHaveBeenCalledWith('test-token', 'cleaning-1')
    expect(ui.getByTestId('inspection-read-only-banner')).toBeTruthy()
    expect(ui.getByTestId('inspection-read-only-complete-hint')).toBeTruthy()
    expect(ui.getAllByText('1/3')).toHaveLength(2)
    expect(ui.getByText('1/2')).toBeTruthy()
    expect(ui.queryByText('保存照片')).toBeNull()
    expect(ui.queryByText('提交本页检查与补充')).toBeNull()
    expect(ui.queryByText('添加')).toBeNull()
  })
})

test('已完成任务从未携带只读参数的入口查看检查与补充时不再确认房号', async () => {
  const previousStatus = (mockSnapshot.items[0] as any).status
  ;(mockSnapshot.items[0] as any).status = 'done'
  try {
    const InspectionPanelScreen = require('./InspectionPanelScreen').default as React.ComponentType<any>
    const navigation = { navigate: jest.fn(), addListener: jest.fn(() => () => {}), setOptions: jest.fn(), goBack: jest.fn() }
    const ui = render(
      <I18nProvider>
        <InspectionPanelScreen navigation={navigation} route={{ key: 'inspection-completed-direct-view', name: 'InspectionPanel', params: { taskId: 'w-inspection' } }} />
      </I18nProvider>,
    )

    await waitFor(() => expect(ui.getByText('检查与补充')).toBeTruthy())
    expect(ui.queryByTestId('inspection-room-confirmation')).toBeNull()
    ui.unmount()
  } finally {
    ;(mockSnapshot.items[0] as any).status = previousStatus
  }
})

test('点击全屏照片内容区域可以关闭预览', async () => {
  const api = require('../../lib/api')
  ;(api.getInspectionPhotos as jest.Mock).mockResolvedValueOnce({
    items: [{ area: 'living', url: 'https://example.com/living.jpg', captured_at: '2026-07-25T01:00:00.000Z' }],
  })
  const InspectionPanelScreen = require('./InspectionPanelScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), addListener: jest.fn(() => () => {}), setOptions: jest.fn() }
  const ui = render(
    <I18nProvider>
      <InspectionPanelScreen navigation={navigation} route={{ key: 'inspection-viewer', name: 'InspectionPanel', params: { taskId: 'w-inspection', sourceId: 'cleaning-1', readOnly: true } }} />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByTestId('inspection-photo-living-0')).toBeTruthy())
  fireEvent.press(ui.getByTestId('inspection-photo-living-0'))
  await waitFor(() => expect(ui.getByText('点击任意位置关闭')).toBeTruthy())

  fireEvent.press(ui.getByTestId('inspection-photo-viewer'))
  await waitFor(() => expect(ui.queryByText('点击任意位置关闭')).toBeNull())
})

test('进入检查与补充先确认房号，成功同步后仅可从相册追加清洁问题并保留失败断点重试', async () => {
  const queue = require('../../lib/inspectionPanelSubmitQueue')
  const api = require('../../lib/api')
  const imagePicker = require('expo-image-picker')
  queue.getInspectionPanelBatch.mockResolvedValue({
    submit_id: 'inspection-synced-1',
    task_id: 'w-inspection',
    cleaning_task_id: 'cleaning-1',
    status: 'synced',
    snapshot: {
      task_id: 'w-inspection',
      cleaning_task_id: 'cleaning-1',
      room_photo_requirement: 'required',
      restock_confirmed_sufficient: false,
      restock: [],
      room_photos: { living: [], sofa: [], bedroom: [], kitchen: [], bathroom: [] },
      cleaning_issue: [],
      feedback: null,
    },
  })
  imagePicker.launchImageLibraryAsync.mockResolvedValueOnce({
    canceled: false,
    assets: [{ uri: 'file:///issue.jpg', fileName: 'issue.jpg', mimeType: 'image/jpeg' }],
  })
  api.appendInspectionIssuePhotos
    .mockRejectedValueOnce(new Error('业务保存失败'))
    .mockResolvedValueOnce({ ok: true, appended: 1 })
  const InspectionPanelScreen = require('./InspectionPanelScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), addListener: jest.fn(() => () => {}), setOptions: jest.fn(), goBack: jest.fn() }
  const ui = render(
    <I18nProvider>
      <InspectionPanelScreen navigation={navigation} route={{ key: 'inspection-synced', name: 'InspectionPanel', params: { taskId: 'w-inspection' } }} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByTestId('inspection-room-confirmation')).toBeTruthy()
    expect(ui.getByTestId('inspection-room-confirmation-code').props.children).toBe('TEST-1')
    expect(ui.getByTestId('inspection-post-submit-issue-library')).toBeTruthy()
  })
  expect(ui.queryByText('拍照上传')).toBeNull()
  expect(ui.queryByText('相册上传')).toBeNull()

  fireEvent.press(ui.getByText('房号正确，继续'))
  await waitFor(() => expect(ui.queryByTestId('inspection-room-confirmation')).toBeNull())
  fireEvent.press(ui.getByTestId('inspection-post-submit-issue-library'))
  await waitFor(() => expect(ui.getByTestId('inspection-post-submit-issue-submit')).toBeTruthy())
  fireEvent.press(ui.getByTestId('inspection-post-submit-issue-submit'))

  await waitFor(() => {
    expect(ui.getByText('业务保存失败')).toBeTruthy()
    expect(api.uploadCleaningMedia).toHaveBeenCalledWith(
      'test-token',
      expect.objectContaining({ uri: 'file:///test.jpg' }),
      expect.objectContaining({ purpose: 'inspection_issue' }),
    )
    expect(api.appendInspectionIssuePhotos).toHaveBeenCalledWith(
      'test-token',
      'cleaning-1',
      expect.objectContaining({
        items: [expect.objectContaining({ url: 'https://example.test/inspection-issue.jpg', note: null })],
        step_key: 'append_inspection_issue_photos',
      }),
      { skipAuthInvalidation: true },
    )
  })

  fireEvent.press(ui.getByTestId('inspection-post-submit-issue-submit'))
  await waitFor(() => {
    expect(api.appendInspectionIssuePhotos).toHaveBeenCalledTimes(2)
    expect(api.uploadCleaningMedia).toHaveBeenCalledTimes(1)
    expect(ui.queryByTestId('inspection-post-submit-issue-submit')).toBeNull()
  }, { timeout: 5_000 })
}, 10_000)
