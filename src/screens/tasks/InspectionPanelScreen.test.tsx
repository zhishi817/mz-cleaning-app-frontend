import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
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

let inspectionQueueListener: (() => void) | null = null
const mockGetInspectionPanelBatch = jest.fn(async (_taskId?: string) => null)

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
jest.mock('expo-av', () => {
  const mockReact = require('react')
  const { View } = require('react-native')
  return { ResizeMode: { CONTAIN: 'contain' }, Video: (props: any) => mockReact.createElement(View, props) }
})

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
  getInspectionPanelBatch: mockGetInspectionPanelBatch,
  resolveInspectionPanelBatch: jest.fn(async (params: any) => ({
    item: await mockGetInspectionPanelBatch(params.task_id),
    matched_by: 'display_task_id',
    ambiguous_count: 0,
  })),
  inspectionPanelFailedStepDetails: jest.fn(() => []),
  inspectionPanelLocalMediaSummary: jest.fn(() => null),
  processInspectionPanelSubmitQueue: jest.fn(async () => null),
  saveInspectionPanelDraftBatch: jest.fn(async () => null),
  submitInspectionPanelBatch: jest.fn(async () => null),
  subscribeInspectionPanelSubmitQueue: jest.fn((listener: () => void) => {
    inspectionQueueListener = listener
    return () => {
      inspectionQueueListener = null
    }
  }),
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
  getWorkTaskFormPhotos: jest.fn(async () => ({ items: [] })),
  uploadCleaningMedia: jest.fn(async () => ({ url: 'https://example.test/inspection-issue.jpg' })),
}))
jest.mock('../../components/GuestLuggageCard', () => () => null)
jest.mock('../../components/CleaningMediaImage', () => (props: any) => {
  const mockReact = require('react')
  const { View } = require('react-native')
  return mockReact.createElement(View, { ...props, testID: 'inspection-media-image' })
})
jest.mock('../../components/CleaningMediaPreview', () => (props: any) => {
  const mockReact = require('react')
  const { View } = require('react-native')
  return mockReact.createElement(View, { ...props, testID: props.testID || 'cleaning-media-preview' })
})
jest.mock('../../components/ui/ResponsiveImageGrid', () => (props: any) => {
  const mockReact = require('react')
  return mockReact.createElement(
    mockReact.Fragment,
    null,
    (props.items || []).map((item: any, index: number) => mockReact.createElement(mockReact.Fragment, { key: item.key || item.id || index }, props.renderItem(item, index))),
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

test.each([false, true])('补品照片缩略图和大图携带准确服务端来源（历史=%s）', async (readOnly) => {
  const previous = mockSnapshot.items[0]
  mockSnapshot.items[0] = {
    ...previous,
    source_ids: ['cleaning-1', 'inspection-1'],
    work_record_read_only: readOnly,
    read_only_views: { media_source_ids: ['cleaning-1', 'inspection-1'] },
    restock_items: [{ item_id: 'stock-1', label: '卷纸', qty: 1, photo_url: 'cleaning/synthetic/stock.jpg' }],
  } as any
  const api = require('../../lib/api')
  api.getWorkTaskFormPhotos.mockResolvedValue({ items: [{ id: 'proof-1', task_id: 'cleaning-1', source: 'consumable', item_id: 'stock-1', label: '卷纸', url: 'cleaning/synthetic/stock.jpg' }] })
  api.getCleaningConsumables.mockResolvedValue({ items: [{ item_id: 'stock-1', item_label: '卷纸', need_restock: true, qty: 1, photo_url: 'cleaning/synthetic/stock.jpg' }] })
  try {
    const Screen = require('./InspectionPanelScreen').default
    const ui = render(<I18nProvider><Screen navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}), setOptions: jest.fn() }} route={{ key: 'proof', name: 'InspectionPanel', params: { taskId: 'w-inspection', readOnly } }} /></I18nProvider>)
    await waitFor(() => expect(ui.getByText('清洁员补货照片')).toBeTruthy())
    const proof = ui.getAllByTestId('inspection-media-image').find((item) => item.props.remoteReference === 'cleaning/synthetic/stock.jpg')!
    expect(proof.props.mediaScope).toBe('inspector')
    expect(proof.props.accessSourceIds).toEqual(['cleaning-1', 'inspection-1'])
    fireEvent.press(ui.getByText('清洁员补货照片'))
    const viewer = ui.getByTestId('inspection-photo-viewer')
    expect(viewer.props.accessSourceIds).toEqual(['cleaning-1', 'inspection-1'])
    expect(viewer.props.mediaScope).toBe('inspector')
  } finally {
    mockSnapshot.items[0] = previous
    api.getCleaningConsumables.mockReset().mockResolvedValue(null)
    api.getWorkTaskFormPhotos.mockReset().mockResolvedValue({ items: [] })
  }
})

test('历史检查页不展示清洁房间完成照，仍保留真实补品与检查员自己的检查照片', async () => {
  const previous = mockSnapshot.items[0]
  mockSnapshot.items[0] = {
    ...previous,
    status: 'done',
    source_ids: ['cleaning-1', 'inspection-1'],
    work_record_read_only: true,
    read_only_views: { media_source_ids: ['cleaning-1', 'inspection-1'] },
    restock_items: [{ item_id: 'toilet-paper', label: '卷纸', qty: 1, photo_url: 'cleaning/synthetic/toilet-paper.jpg' }],
  } as any
  const api = require('../../lib/api')
  api.getWorkTaskFormPhotos.mockResolvedValue({
    items: [
      { id: 'paper', task_id: 'cleaning-1', source: 'consumable', item_id: 'toilet-paper', label: '卷纸', url: 'cleaning/synthetic/toilet-paper.jpg' },
      { id: 'retired', task_id: 'cleaning-1', source: 'consumable', item_id: 'retired-supply', label: '历史下架补品', url: 'cleaning/synthetic/retired.jpg' },
      { id: 'living-modern', task_id: 'cleaning-1', source: 'completion', area: 'living', url: 'cleaning/synthetic/living.jpg' },
      { id: 'living-legacy', task_id: 'cleaning-1', source: 'consumable', area: 'living', url: 'cleaning/synthetic/living.jpg' },
      { id: 'remote', task_id: 'cleaning-1', source: 'consumable', item_id: 'remote_tv', url: 'cleaning/synthetic/remote.jpg' },
      { id: 'vacuum', task_id: 'cleaning-1', source: 'consumable', item_id: 'vacuum_used_photo', url: 'cleaning/synthetic/vacuum.jpg' },
      { id: 'shower', task_id: 'cleaning-1', source: 'consumable', item_id: 'shower_drain_photo_1', url: 'cleaning/synthetic/shower.jpg' },
      { id: 'kitchen-current', task_id: 'cleaning-1', source: 'consumable', item_id: 'cutlery_drawer_photo_v2', url: 'cleaning/synthetic/kitchen-current.jpg' },
      { id: 'kitchen-legacy', task_id: 'cleaning-1', source: 'consumable', item_id: 'coffee_machine_photo', url: 'cleaning/synthetic/kitchen-legacy.jpg' },
      { id: 'inspection-living', task_id: 'inspection-1', source: 'inspection', area: 'living', url: 'cleaning/synthetic/inspection-living.jpg' },
    ],
  })

  try {
    const Screen = require('./InspectionPanelScreen').default
    const ui = render(<I18nProvider><Screen navigation={{ navigate: jest.fn(), addListener: jest.fn(() => () => {}), setOptions: jest.fn() }} route={{ key: 'classified-history', name: 'InspectionPanel', params: { taskId: 'w-inspection', readOnly: true } }} /></I18nProvider>)

    await waitFor(() => {
      expect(ui.getByText('卷纸')).toBeTruthy()
      expect(ui.getByText('已保存数量：1')).toBeTruthy()
      expect(ui.getByText('历史下架补品')).toBeTruthy()
      expect(ui.getAllByText('已保存状态：未记录').length).toBeGreaterThanOrEqual(1)
    })
    expect(ui.queryByTestId('inspection-read-only-cleaner-completion')).toBeNull()
    expect(ui.queryByTestId('inspection-cleaner-completion-living-0')).toBeNull()
    expect(ui.queryByTestId('inspection-cleaner-completion-remote_tv-0')).toBeNull()
    expect(ui.queryByTestId('inspection-cleaner-completion-vacuum_used-0')).toBeNull()
    expect(ui.queryByTestId('inspection-cleaner-completion-shower_drain-0')).toBeNull()
    expect(ui.queryByTestId('inspection-cleaner-completion-kitchen-0')).toBeNull()
    expect(ui.queryByText('remote_tv')).toBeNull()
    expect(ui.queryByText('vacuum_used_photo')).toBeNull()
    expect(ui.queryByText('shower_drain_photo_1')).toBeNull()
    expect(ui.queryByText('cutlery_drawer_photo_v2')).toBeNull()
    expect(ui.queryByText('coffee_machine_photo')).toBeNull()
    expect(ui.getByTestId('inspection-photo-living-0')).toBeTruthy()
    expect(ui.queryByTestId('inspection-add-other-restock')).toBeNull()
    expect(ui.queryByText('拍照上传')).toBeNull()
    expect(ui.queryByText('提交本页检查与补充')).toBeNull()
    expect(ui.queryByText('现场够用')).toBeNull()
    const rendered = JSON.stringify(ui.toJSON())
    expect(rendered).not.toContain('cleaning/synthetic/living.jpg')
    expect(rendered).not.toContain('cleaning/synthetic/remote.jpg')
    expect(rendered).not.toContain('cleaning/synthetic/vacuum.jpg')
    expect(rendered).not.toContain('cleaning/synthetic/shower.jpg')
    expect(rendered).not.toContain('cleaning/synthetic/kitchen-current.jpg')
    expect(rendered).not.toContain('cleaning/synthetic/kitchen-legacy.jpg')
    expect(rendered).toContain('cleaning/synthetic/inspection-living.jpg')
  } finally {
    mockSnapshot.items[0] = previous
    api.getWorkTaskFormPhotos.mockReset().mockResolvedValue({ items: [] })
  }
})

test('检查人员可打开检查与补充页面并看到四个核心步骤', async () => {
  const InspectionPanelScreen = require('./InspectionPanelScreen').default as React.ComponentType<any>
  const api = require('../../lib/api')
  api.getWorkTaskFormPhotos.mockClear()
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
    expect(ui.getByText('阳台')).toBeTruthy()
    expect(ui.getByText('有阳台时拍摄（可选）')).toBeTruthy()
    expect(ui.getByText('5. 标记已完成')).toBeTruthy()
    expect(ui.getByTestId('inspection-sync-status-card')).toBeTruthy()
  }, { timeout: 5_000 })
  expect(api.getWorkTaskFormPhotos).not.toHaveBeenCalled()
}, 10_000)

test('历史检查记录的问题反馈入口位于照片区域之前', async () => {
  const previousTask = { ...mockSnapshot.items[0] }
  mockSnapshot.items[0] = {
    ...previousTask,
    status: 'done',
    work_record_read_only: true,
    available_actions: [{
      id: 'report_issue',
      label: '问题反馈与报修记录',
      enabled: true,
      target: 'FeedbackForm',
      source_type: 'cleaning_tasks',
      source_id: 'cleaning-1',
    }],
  } as any
  const InspectionPanelScreen = require('./InspectionPanelScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), addListener: jest.fn(() => () => {}), setOptions: jest.fn() }

  try {
    const ui = render(
      <I18nProvider>
        <InspectionPanelScreen navigation={navigation} route={{ key: 'inspection-history-feedback', name: 'InspectionPanel', params: { taskId: 'w-inspection', readOnly: true } }} />
      </I18nProvider>,
    )

    await waitFor(() => expect(ui.getByTestId('inspection-feedback-before-photos')).toBeTruthy())
    const rendered = JSON.stringify(ui.toJSON())
    expect(rendered.indexOf('inspection-feedback-before-photos')).toBeGreaterThanOrEqual(0)
    expect(rendered.indexOf('inspection-feedback-before-photos')).toBeLessThan(rendered.indexOf('4. 房间检查照片'))
  } finally {
    mockSnapshot.items[0] = previousTask
  }
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
  const storage = require('../../lib/storage')
  const draft = require('../../lib/inspectionPanelDraft')
  const feedbackDraft = require('../../lib/inspectionPanelFeedbackDraft')
  const queue = require('../../lib/inspectionPanelSubmitQueue')
  draft.getInspectionPanelDraft.mockClear()
  feedbackDraft.getInspectionPanelFeedbackDraft.mockClear()
  queue.getInspectionPanelBatch.mockClear()
  queue.subscribeInspectionPanelSubmitQueue.mockClear()
  storage.getJson.mockClear()
  api.getCleaningConsumables.mockClear()
  ;(api.getWorkTaskFormPhotos as jest.Mock).mockResolvedValueOnce({
    items: [
      { id: 'inspection-living', task_id: 'cleaning-1', source: 'inspection', area: 'living', url: 'https://example.com/living.jpg', captured_at: '2026-07-25T01:00:00.000Z' },
      { id: 'inspection-sofa', task_id: 'cleaning-1', source: 'inspection', area: 'sofa', url: 'https://example.com/sofa.jpg', captured_at: '2026-07-25T01:01:00.000Z' },
      { id: 'inspection-bathroom', task_id: 'cleaning-1', source: 'inspection', area: 'bathroom', url: 'https://example.com/bathroom.jpg', captured_at: '2026-07-25T01:02:00.000Z' },
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
    expect(api.getWorkTaskFormPhotos).toHaveBeenCalledWith('test-token', 'w-inspection', ['cleaning-1'], 'inspector')
    expect(ui.getByTestId('inspection-read-only-banner')).toBeTruthy()
    expect(ui.getByTestId('inspection-read-only-complete-hint')).toBeTruthy()
    expect(ui.getAllByText('1/3')).toHaveLength(2)
    expect(ui.getByText('1/2')).toBeTruthy()
    expect(ui.queryByText('保存照片')).toBeNull()
    expect(ui.queryByText('提交本页检查与补充')).toBeNull()
    expect(ui.queryByText('添加')).toBeNull()
    expect(ui.queryByTestId('inspection-sync-status-card')).toBeNull()
    expect(draft.getInspectionPanelDraft).not.toHaveBeenCalled()
    expect(feedbackDraft.getInspectionPanelFeedbackDraft).not.toHaveBeenCalled()
    expect(queue.getInspectionPanelBatch).not.toHaveBeenCalled()
    expect(queue.subscribeInspectionPanelSubmitQueue).not.toHaveBeenCalled()
    expect(storage.getJson).not.toHaveBeenCalledWith('mzstay.inspection_post_submit_issue_draft.v1:w-inspection')
    expect(api.getCleaningConsumables).not.toHaveBeenCalled()
  })
})

test('历史检查记录保留已保存补品内容但完全隐藏补品写操作', async () => {
  const before = { ...mockSnapshot.items[0] }
  mockSnapshot.items[0] = {
    ...before,
    status: 'done',
    work_record_read_only: true,
    restock_items: [{
      item_id: 'stock-1',
      label: '清洁袋',
      qty: 2,
      note: '已补两包',
      status: 'restocked',
      photo_url: 'cleaning/media/restock-stock-1.jpg',
    }],
  } as any
  const InspectionPanelScreen = require('./InspectionPanelScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), addListener: jest.fn(() => () => {}), setOptions: jest.fn() }

  try {
    const ui = render(
      <I18nProvider>
        <InspectionPanelScreen navigation={navigation} route={{ key: 'inspection-read-only-restock', name: 'InspectionPanel', params: { taskId: 'w-inspection', sourceId: 'cleaning-1', readOnly: true } }} />
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(ui.getByText('已保存数量：2')).toBeTruthy()
      expect(ui.getByText('备注：已补两包')).toBeTruthy()
      expect(ui.getByText('清洁员补货照片')).toBeTruthy()
    })
    expect(ui.queryByTestId('inspection-add-other-restock')).toBeNull()
    expect(ui.queryByTestId('inspection-add-next-restock')).toBeNull()
    expect(ui.queryByTestId('inspection-restock-stock-1-carry-forward')).toBeNull()
    expect(ui.queryByPlaceholderText('备注（可选）')).toBeNull()
    expect(ui.queryByText('拍照上传')).toBeNull()
    expect(ui.queryByText('继续拍照')).toBeNull()
    expect(ui.queryByText('移除')).toBeNull()
    ui.unmount()
  } finally {
    mockSnapshot.items[0] = before
  }
})

test('活动检查任务不把投影中的历史补品状态和备注带入可编辑草稿', async () => {
  const before = { ...mockSnapshot.items[0] }
  mockSnapshot.items[0] = {
    ...before,
    restock_items: [{
      item_id: 'stock-1',
      label: '清洁袋',
      qty: 2,
      note: '历史备注不可带入',
      status: 'carry_forward',
      photo_url: 'cleaning/media/restock-stock-1.jpg',
    }],
  } as any
  const InspectionPanelScreen = require('./InspectionPanelScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), addListener: jest.fn(() => () => {}), setOptions: jest.fn() }

  try {
    const ui = render(
      <I18nProvider>
        <InspectionPanelScreen navigation={navigation} route={{ key: 'inspection-active-restock', name: 'InspectionPanel', params: { taskId: 'w-inspection', sourceId: 'cleaning-1' } }} />
      </I18nProvider>,
    )

    await waitFor(() => expect(ui.getByTestId('inspection-restock-stock-1-carry-forward')).toBeTruthy())
    expect(ui.getByTestId('inspection-restock-stock-1-carry-forward').props.style).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ backgroundColor: '#2563EB' }),
    ]))
    expect(ui.getByPlaceholderText('备注（可选）').props.value).toBe('')
    expect(ui.queryByText('已保存状态：下次退房补')).toBeNull()
    ui.unmount()
  } finally {
    mockSnapshot.items[0] = before
  }
})

test('只读工作记录缺少精确媒体来源时关闭图库且不回退旧接口', async () => {
  const before = { ...mockSnapshot.items[0] }
  mockSnapshot.items[0] = {
    ...before,
    status: 'done',
    work_record_read_only: true,
    read_only_views: { media_scope: 'inspector', media_source_ids: [] },
  } as any
  const api = require('../../lib/api')
  api.getWorkTaskFormPhotos.mockClear()
  api.getCleaningConsumables.mockClear()
  const InspectionPanelScreen = require('./InspectionPanelScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), addListener: jest.fn(() => () => {}), setOptions: jest.fn() }

  try {
    const ui = render(
      <I18nProvider>
        <InspectionPanelScreen navigation={navigation} route={{ key: 'inspection-read-only-no-source', name: 'InspectionPanel', params: { taskId: 'w-inspection', readOnly: true } }} />
      </I18nProvider>,
    )

    await waitFor(() => expect(ui.getByTestId('inspection-read-only-banner')).toBeTruthy())
    expect(api.getWorkTaskFormPhotos).not.toHaveBeenCalled()
    expect(api.getCleaningConsumables).not.toHaveBeenCalled()
    expect(ui.queryByTestId('inspection-read-only-key-media')).toBeNull()
  } finally {
    mockSnapshot.items[0] = before
  }
})

test('历史检查页按投影权限拒绝钥匙照和挂钥匙视频但仍显示检查员自己的照片', async () => {
  const before = { ...mockSnapshot.items[0] }
  mockSnapshot.items[0] = {
    ...before,
    status: 'done',
    work_record_read_only: true,
    source_ids: ['cleaning-1'],
    read_only_views: {
      media_scope: 'inspector',
      media_source_ids: ['cleaning-1'],
      guest_key_photo: false,
      lockbox_video: false,
    },
  } as any
  const api = require('../../lib/api')
  api.getWorkTaskFormPhotos.mockClear()
  api.getWorkTaskFormPhotos.mockResolvedValue({
    items: [
      { id: 'key-1', task_id: 'cleaning-1', source: 'key', url: 'cleaning/synthetic/key.jpg' },
      { id: 'video-1', task_id: 'cleaning-1', source: 'lockbox_video', url: 'cleaning/synthetic/key-video.mp4' },
      { id: 'inspection-1', task_id: 'cleaning-1', source: 'inspection', area: 'living', url: 'cleaning/synthetic/inspection.jpg' },
    ],
  })
  const InspectionPanelScreen = require('./InspectionPanelScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), addListener: jest.fn(() => () => {}), setOptions: jest.fn() }

  try {
    const ui = render(
      <I18nProvider>
        <InspectionPanelScreen navigation={navigation} route={{ key: 'inspection-read-only-capabilities-off', name: 'InspectionPanel', params: { taskId: 'w-inspection', readOnly: true } }} />
      </I18nProvider>,
    )

    await waitFor(() => expect(ui.getByTestId('inspection-photo-living-0')).toBeTruthy())
    expect(api.getWorkTaskFormPhotos).toHaveBeenCalledWith('test-token', 'w-inspection', ['cleaning-1'], 'inspector')
    expect(ui.queryByTestId('inspection-read-only-key-media')).toBeNull()
    expect(ui.queryByTestId('inspection-read-only-key-photo')).toBeNull()
    expect(ui.queryByTestId('inspection-read-only-lockbox-video')).toBeNull()
    ui.unmount()
  } finally {
    mockSnapshot.items[0] = before
    api.getWorkTaskFormPhotos.mockReset().mockResolvedValue({ items: [] })
  }
})

test('历史检查页仅在投影授权时请求并显示钥匙照和挂钥匙视频', async () => {
  const before = { ...mockSnapshot.items[0] }
  mockSnapshot.items[0] = {
    ...before,
    status: 'done',
    work_record_read_only: true,
    source_ids: ['cleaning-1'],
    read_only_views: {
      media_scope: 'inspector',
      media_source_ids: ['cleaning-1'],
      guest_key_photo: true,
      lockbox_video: true,
    },
  } as any
  const api = require('../../lib/api')
  api.getWorkTaskFormPhotos.mockClear()
  api.getWorkTaskFormPhotos.mockResolvedValue({
    items: [
      { id: 'key-1', task_id: 'cleaning-1', source: 'key', url: 'cleaning/synthetic/key.jpg' },
      { id: 'video-1', task_id: 'cleaning-1', source: 'lockbox_video', url: 'cleaning/synthetic/key-video.mp4' },
    ],
  })
  const InspectionPanelScreen = require('./InspectionPanelScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), addListener: jest.fn(() => () => {}), setOptions: jest.fn() }

  try {
    const ui = render(
      <I18nProvider>
        <InspectionPanelScreen navigation={navigation} route={{ key: 'inspection-read-only-capabilities-on', name: 'InspectionPanel', params: { taskId: 'w-inspection', readOnly: true } }} />
      </I18nProvider>,
    )

    await waitFor(() => expect(ui.getByTestId('inspection-read-only-key-media')).toBeTruthy())
    expect(api.getWorkTaskFormPhotos).toHaveBeenCalledWith('test-token', 'w-inspection', ['cleaning-1'], 'inspector', { includeVideos: true })
    expect(ui.getByTestId('inspection-read-only-key-photo')).toBeTruthy()
    expect(ui.getByTestId('inspection-read-only-lockbox-video')).toBeTruthy()
    ui.unmount()
  } finally {
    mockSnapshot.items[0] = before
    api.getWorkTaskFormPhotos.mockReset().mockResolvedValue({ items: [] })
  }
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

test('历史工作记录即使旧入口漏传只读参数也不能恢复草稿队列或写操作', async () => {
  const before = { ...mockSnapshot.items[0] }
  mockSnapshot.items[0] = {
    ...before,
    status: 'done',
    work_record_read_only: true,
    read_only_views: { media_scope: 'inspector', media_source_ids: ['cleaning-1'] },
  } as any
  const draft = require('../../lib/inspectionPanelDraft')
  const feedbackDraft = require('../../lib/inspectionPanelFeedbackDraft')
  const queue = require('../../lib/inspectionPanelSubmitQueue')
  draft.getInspectionPanelDraft.mockClear()
  feedbackDraft.getInspectionPanelFeedbackDraft.mockClear()
  queue.getInspectionPanelBatch.mockClear()
  queue.subscribeInspectionPanelSubmitQueue.mockClear()
  const InspectionPanelScreen = require('./InspectionPanelScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), addListener: jest.fn(() => () => {}), setOptions: jest.fn(), goBack: jest.fn() }

  try {
    const ui = render(
      <I18nProvider>
        <InspectionPanelScreen navigation={navigation} route={{ key: 'inspection-history-legacy-route', name: 'InspectionPanel', params: { taskId: 'w-inspection' } }} />
      </I18nProvider>,
    )

    await waitFor(() => expect(ui.getByTestId('inspection-read-only-banner')).toBeTruthy())
    expect(draft.getInspectionPanelDraft).not.toHaveBeenCalled()
    expect(feedbackDraft.getInspectionPanelFeedbackDraft).not.toHaveBeenCalled()
    expect(queue.getInspectionPanelBatch).not.toHaveBeenCalled()
    expect(queue.subscribeInspectionPanelSubmitQueue).not.toHaveBeenCalled()
    expect(ui.queryByText('保存照片')).toBeNull()
    expect(ui.queryByText('提交本页检查与补充')).toBeNull()
  } finally {
    mockSnapshot.items[0] = before
  }
})

test('Root 结构化已挂钥匙跳过房号确认，明确无事实时不信任 raw keys_hung', async () => {
  const task = mockSnapshot.items[0] as any
  const previousStatus = task.status
  const hadKeyHandover = Object.prototype.hasOwnProperty.call(task, 'key_handover')
  const previousKeyHandover = task.key_handover
  task.status = 'keys_hung'
  task.key_handover = {
    state: 'completed',
    source_task_id: 'cleaning-1',
    completed_at: '2026-10-21T01:02:03.000Z',
  }

  const InspectionPanelScreen = require('./InspectionPanelScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), addListener: jest.fn(() => () => {}), setOptions: jest.fn(), goBack: jest.fn() }
  let completed: ReturnType<typeof render> | null = null
  let noFact: ReturnType<typeof render> | null = null
  try {
    completed = render(
      <I18nProvider>
        <InspectionPanelScreen navigation={navigation} route={{ key: 'inspection-structured-key-handover', name: 'InspectionPanel', params: { taskId: 'w-inspection' } }} />
      </I18nProvider>,
    )
    await waitFor(() => expect(completed?.getByText('检查与补充')).toBeTruthy())
    expect(completed.queryByTestId('inspection-room-confirmation')).toBeNull()
    completed.unmount()
    completed = null

    task.key_handover = null
    noFact = render(
      <I18nProvider>
        <InspectionPanelScreen navigation={navigation} route={{ key: 'inspection-explicit-no-key-handover', name: 'InspectionPanel', params: { taskId: 'w-inspection' } }} />
      </I18nProvider>,
    )
    await waitFor(() => expect(noFact?.getByTestId('inspection-room-confirmation')).toBeTruthy())
  } finally {
    completed?.unmount()
    noFact?.unmount()
    if (previousStatus === undefined) delete task.status
    else task.status = previousStatus
    if (hadKeyHandover) task.key_handover = previousKeyHandover
    else delete task.key_handover
  }
})

test('点击全屏照片内容区域可以关闭预览', async () => {
  const api = require('../../lib/api')
  ;(api.getWorkTaskFormPhotos as jest.Mock).mockResolvedValueOnce({
    items: [{ id: 'inspection-living', task_id: 'cleaning-1', source: 'inspection', area: 'living', url: 'https://example.com/living.jpg', captured_at: '2026-07-25T01:00:00.000Z' }],
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
      expect.objectContaining({ purpose: 'inspection_issue', task_id: 'cleaning-1', media_id: 'media-1' }),
      { skipImageCompression: true },
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

test('纯入住检查不因旧 cleaning_submission_ready=false 在本地被阻止', async () => {
  const queue = require('../../lib/inspectionPanelSubmitQueue')
  const previousReady = (mockSnapshot.items[0] as any).cleaning_submission_ready
  const previousTaskType = (mockSnapshot.items[0] as any).task_type
  const previousInspectionScope = (mockSnapshot.items[0] as any).inspection_scope
  ;(mockSnapshot.items[0] as any).cleaning_submission_ready = false
  ;(mockSnapshot.items[0] as any).task_type = 'checkin_clean'
  ;(mockSnapshot.items[0] as any).inspection_scope = 'inspect_and_hang'
  queue.getInspectionPanelBatch.mockReset().mockResolvedValue(null)
  queue.submitInspectionPanelBatch.mockReset().mockResolvedValue({
    task_id: 'w-inspection',
    status: 'pending_submit',
    snapshot: { room_photo_requirement: 'required' },
  })
  try {
    const InspectionPanelScreen = require('./InspectionPanelScreen').default as React.ComponentType<any>
    const navigation = { navigate: jest.fn(), addListener: jest.fn(() => () => {}), setOptions: jest.fn() }
    const ui = render(
      <I18nProvider>
        <InspectionPanelScreen navigation={navigation} route={{ key: 'inspection-checkin', name: 'InspectionPanel', params: { taskId: 'w-inspection' } }} />
      </I18nProvider>,
    )

    await waitFor(() => expect(ui.getByTestId('inspection-room-confirmation')).toBeTruthy())
    fireEvent.press(ui.getByText('房号正确，继续'))
    await waitFor(() => expect(ui.queryByTestId('inspection-room-confirmation')).toBeNull())
    fireEvent.press(ui.getByText('提交本页检查与补充'))
    await waitFor(() => expect(queue.submitInspectionPanelBatch).toHaveBeenCalledWith('w-inspection'))
    ui.unmount()
  } finally {
    if (previousReady === undefined) delete (mockSnapshot.items[0] as any).cleaning_submission_ready
    else (mockSnapshot.items[0] as any).cleaning_submission_ready = previousReady
    if (previousTaskType === undefined) delete (mockSnapshot.items[0] as any).task_type
    else (mockSnapshot.items[0] as any).task_type = previousTaskType
    if (previousInspectionScope === undefined) delete (mockSnapshot.items[0] as any).inspection_scope
    else (mockSnapshot.items[0] as any).inspection_scope = previousInspectionScope
  }
})

test('检查照片队列进度只刷新状态，不重新读取整份草稿', async () => {
  const queue = require('../../lib/inspectionPanelSubmitQueue')
  const draft = require('../../lib/inspectionPanelDraft')
  queue.getInspectionPanelBatch.mockReset().mockResolvedValue(null)
  draft.getInspectionPanelDraft.mockClear().mockResolvedValue(null)
  inspectionQueueListener = null
  const InspectionPanelScreen = require('./InspectionPanelScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), addListener: jest.fn(() => () => {}), setOptions: jest.fn() }
  const ui = render(
    <I18nProvider>
      <InspectionPanelScreen navigation={navigation} route={{ key: 'inspection-queue-progress', name: 'InspectionPanel', params: { taskId: 'w-inspection' } }} />
    </I18nProvider>,
  )

  await waitFor(() => expect(inspectionQueueListener).toEqual(expect.any(Function)))
  await waitFor(() => expect(draft.getInspectionPanelDraft).toHaveBeenCalled())
  const initialDraftReads = draft.getInspectionPanelDraft.mock.calls.length
  queue.getInspectionPanelBatch.mockResolvedValueOnce({
    task_id: 'w-inspection',
    cleaning_task_id: 'cleaning-1',
    status: 'syncing',
    last_error: null,
    snapshot: { cleaning_task_id: 'cleaning-1', room_photo_requirement: 'required' },
  })
  await act(async () => {
    inspectionQueueListener?.()
  })
  await waitFor(() => expect(ui.getByText('当前状态：同步中')).toBeTruthy())
  expect(draft.getInspectionPanelDraft.mock.calls.length).toBe(initialDraftReads)
  ui.unmount()
})

test('同一检查任务的来源任务变化时会受控重读草稿', async () => {
  const queue = require('../../lib/inspectionPanelSubmitQueue')
  const draft = require('../../lib/inspectionPanelDraft')
  queue.getInspectionPanelBatch.mockReset().mockResolvedValue(null)
  draft.getInspectionPanelDraft.mockClear().mockResolvedValue(null)
  const InspectionPanelScreen = require('./InspectionPanelScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), addListener: jest.fn(() => () => {}), setOptions: jest.fn() }
  const ui = render(
    <I18nProvider>
      <InspectionPanelScreen navigation={navigation} route={{ key: 'inspection-source-refresh', name: 'InspectionPanel', params: { taskId: 'w-inspection', sourceId: 'cleaning-1' } }} />
    </I18nProvider>,
  )

  await waitFor(() => expect(draft.getInspectionPanelDraft).toHaveBeenCalled())
  const initialDraftReads = draft.getInspectionPanelDraft.mock.calls.length
  ui.rerender(
    <I18nProvider>
      <InspectionPanelScreen navigation={navigation} route={{ key: 'inspection-source-refresh', name: 'InspectionPanel', params: { taskId: 'w-inspection', sourceId: 'cleaning-2' } }} />
    </I18nProvider>,
  )
  await waitFor(() => expect(draft.getInspectionPanelDraft.mock.calls.length).toBeGreaterThan(initialDraftReads))
  ui.unmount()
})

test('活动检查页从准确源任务恢复服务器正式批次并显示 MSQ4504E 六张照片', async () => {
  const queue = require('../../lib/inspectionPanelSubmitQueue')
  const api = require('../../lib/api')
  queue.getInspectionPanelBatch.mockReset().mockResolvedValue(null)
  ;(queue.resolveInspectionPanelBatch as jest.Mock).mockImplementation(async (params: any) => ({
    item: await queue.getInspectionPanelBatch(params.task_id),
    matched_by: 'none',
    ambiguous_count: 0,
  }))
  ;(api.getInspectionPhotos as jest.Mock).mockResolvedValueOnce({
    items: [
      { area: 'living', url: 'cleaning/msq/living.jpg' },
      { area: 'sofa', url: 'cleaning/msq/sofa.jpg' },
      { area: 'bedroom', url: 'cleaning/msq/bedroom-1.jpg' },
      { area: 'bedroom', url: 'cleaning/msq/bedroom-2.jpg' },
      { area: 'bedroom', url: 'cleaning/msq/bedroom-3.jpg' },
      { area: 'bedroom', url: 'cleaning/msq/bedroom-4.jpg' },
    ],
    formal_submission: {
      status: 'submitted',
      submit_id: 'inspection_batch_msq4504e',
      saved_at: '2026-10-24T00:39:02.000Z',
      guest_arrival_confirmed: false,
    },
  })
  const InspectionPanelScreen = require('./InspectionPanelScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), addListener: jest.fn(() => () => {}), setOptions: jest.fn() }
  const ui = render(
    <I18nProvider>
      <InspectionPanelScreen navigation={navigation} route={{ key: 'inspection-server-recovery', name: 'InspectionPanel', params: { taskId: 'w-inspection', sourceId: 'cleaning-1' } }} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(api.getInspectionPhotos).toHaveBeenCalledWith('test-token', 'cleaning-1')
    expect(ui.getByTestId('inspection-server-photos-restored').props.children).toBe('已从本任务服务器记录恢复 6 张检查照片。')
    expect(ui.getAllByText('1/3').length).toBeGreaterThanOrEqual(1)
    expect(ui.getByText('1/2')).toBeTruthy()
    expect(ui.getByText('4/8')).toBeTruthy()
    expect(ui.getByText('进入标记已完成')).toBeTruthy()
    expect(ui.queryByText('添加')).toBeNull()
  })
  const ownRoomPhoto = ui.getAllByTestId('inspection-media-image').find((item) => item.props.remoteReference === 'cleaning/msq/living.jpg')!
  expect(ownRoomPhoto.props.mediaScope).toBeUndefined()
  expect(ownRoomPhoto.props.accessSourceIds).toBeUndefined()
  fireEvent.press(ui.getByTestId('inspection-photo-living-0'))
  expect(ui.getByTestId('inspection-photo-viewer').props.mediaScope).toBeUndefined()
  expect(ui.getByTestId('inspection-photo-viewer').props.accessSourceIds).toBeUndefined()
  ui.unmount()
})

test('服务器读取失败保留本机待同步照片且不会把空白误报为已读取', async () => {
  const queue = require('../../lib/inspectionPanelSubmitQueue')
  const api = require('../../lib/api')
  queue.getInspectionPanelBatch.mockReset().mockResolvedValue({
    submit_id: 'local-draft',
    task_id: 'w-inspection',
    cleaning_task_id: 'cleaning-1',
    property_id: 'property-1',
    property_code: 'TEST-1',
    status: 'draft',
    snapshot: {
      task_id: 'w-inspection',
      cleaning_task_id: 'cleaning-1',
      room_photo_requirement: 'required',
      restock_confirmed_sufficient: false,
      restock: [],
      room_photos: {
        living: [{ id: 'pending-living', local_uri: 'file:///pending-living.jpg', uploaded_url: null, name: 'pending.jpg', mime_type: 'image/jpeg', captured_at: '2026-10-24T00:30:00.000Z' }],
        sofa: [], bedroom: [], kitchen: [], bathroom: [], balcony: [],
      },
      cleaning_issue: [],
      feedback: null,
    },
    steps: {},
  })
  ;(queue.resolveInspectionPanelBatch as jest.Mock).mockImplementation(async (params: any) => ({
    item: await queue.getInspectionPanelBatch(params.task_id),
    matched_by: 'display_task_id',
    ambiguous_count: 0,
  }))
  ;(api.getInspectionPhotos as jest.Mock).mockRejectedValueOnce(new Error('offline'))
  const InspectionPanelScreen = require('./InspectionPanelScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), addListener: jest.fn(() => () => {}), setOptions: jest.fn() }
  const ui = render(
    <I18nProvider>
      <InspectionPanelScreen navigation={navigation} route={{ key: 'inspection-server-failed', name: 'InspectionPanel', params: { taskId: 'w-inspection', sourceId: 'cleaning-1' } }} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByTestId('inspection-server-photos-failed')).toBeTruthy()
    expect(ui.getByTestId('inspection-photo-living-0')).toBeTruthy()
    expect(ui.getAllByText('待重试').length).toBeGreaterThan(0)
  })
  ui.unmount()
})

test('本机批次来源冲突时正式服务器回执也不能绕过门禁', async () => {
  const queue = require('../../lib/inspectionPanelSubmitQueue')
  const api = require('../../lib/api')
  ;(queue.bindInspectionPanelCleaningTaskId as jest.Mock).mockClear()
  ;(queue.resolveInspectionPanelBatch as jest.Mock).mockResolvedValue({
    item: null,
    matched_by: 'conflict',
    ambiguous_count: 1,
  })
  ;(api.getInspectionPhotos as jest.Mock).mockResolvedValue({
    items: [{ area: 'living', url: 'cleaning/fixture/living.jpg' }],
    formal_submission: {
      status: 'submitted',
      submit_id: 'formal-submit-conflict-fixture',
      saved_at: '2026-10-24T00:39:02.000Z',
    },
  })
  const InspectionPanelScreen = require('./InspectionPanelScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), addListener: jest.fn(() => () => {}), setOptions: jest.fn() }
  const ui = render(
    <I18nProvider>
      <InspectionPanelScreen navigation={navigation} route={{ key: 'inspection-source-conflict', name: 'InspectionPanel', params: { taskId: 'w-inspection', sourceId: 'cleaning-1' } }} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByTestId('inspection-source-batch-conflict')).toBeTruthy()
    expect(ui.getByText(/本机检查批次与当前任务来源不一致/)).toBeTruthy()
    expect(ui.queryByText('进入标记已完成')).toBeNull()
    expect(queue.bindInspectionPanelCleaningTaskId).not.toHaveBeenCalled()
  })
  ui.unmount()
})

test('只为缺少来源的旧本机批次补绑定准确源任务', async () => {
  const queue = require('../../lib/inspectionPanelSubmitQueue')
  const api = require('../../lib/api')
  const legacyBatch = {
    submit_id: 'legacy-waiting-source',
    task_id: 'legacy-display-task',
    cleaning_task_id: '',
    property_id: 'property-1',
    property_code: 'TEST-1',
    status: 'pending_submit',
    last_error: '已保存到本机，等待任务信息刷新后自动同步。',
    snapshot: {
      task_id: 'legacy-display-task',
      cleaning_task_id: '',
      property_id: 'property-1',
      property_code: 'TEST-1',
      room_photo_requirement: 'guest_arrival_confirmed',
      restock_confirmed_sufficient: true,
      restock: [],
      room_photos: { living: [], sofa: [], bedroom: [], kitchen: [], bathroom: [], balcony: [] },
      cleaning_issue: [],
      feedback: null,
    },
    steps: {},
  }
  const boundBatch = {
    ...legacyBatch,
    cleaning_task_id: 'cleaning-1',
    snapshot: { ...legacyBatch.snapshot, cleaning_task_id: 'cleaning-1' },
  }
  ;(queue.bindInspectionPanelCleaningTaskId as jest.Mock).mockClear().mockResolvedValue(boundBatch)
  ;(queue.resolveInspectionPanelBatch as jest.Mock)
    .mockResolvedValueOnce({ item: legacyBatch, matched_by: 'display_task_id', ambiguous_count: 0 })
    .mockResolvedValue({ item: boundBatch, matched_by: 'display_task_id', ambiguous_count: 0 })
  ;(api.getInspectionPhotos as jest.Mock).mockResolvedValue({
    items: [],
    formal_submission: { status: 'none', submit_id: null, saved_at: null },
  })
  const InspectionPanelScreen = require('./InspectionPanelScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), addListener: jest.fn(() => () => {}), setOptions: jest.fn() }
  const ui = render(
    <I18nProvider>
      <InspectionPanelScreen navigation={navigation} route={{ key: 'inspection-legacy-source-bind', name: 'InspectionPanel', params: { taskId: 'w-inspection', sourceId: 'cleaning-1' } }} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(queue.bindInspectionPanelCleaningTaskId).toHaveBeenCalledTimes(1)
    expect(queue.bindInspectionPanelCleaningTaskId).toHaveBeenCalledWith(expect.objectContaining({
      task_id: 'legacy-display-task',
      cleaning_task_id: 'cleaning-1',
    }))
    expect(ui.getByText('当前状态：待同步')).toBeTruthy()
  })
  ui.unmount()
})

test('展示任务 ID 变化后继续使用唯一同源本机批次的原存储键提交', async () => {
  const queue = require('../../lib/inspectionPanelSubmitQueue')
  const draft = require('../../lib/inspectionPanelDraft')
  const api = require('../../lib/api')
  const sourceBatch = {
    submit_id: 'old-local-batch',
    task_id: 'old-display-task-id',
    cleaning_task_id: 'cleaning-1',
    property_id: 'property-1',
    property_code: 'TEST-1',
    status: 'draft',
    snapshot: {
      task_id: 'old-display-task-id',
      cleaning_task_id: 'cleaning-1',
      property_id: 'property-1',
      property_code: 'TEST-1',
      room_photo_requirement: 'required',
      restock_confirmed_sufficient: true,
      restock: [],
      room_photos: {
        living: [{ id: 'local-living', local_uri: 'file:///living.jpg', uploaded_url: null, name: 'living.jpg', mime_type: 'image/jpeg', captured_at: '2026-10-24T00:30:00.000Z' }],
        sofa: [], bedroom: [], kitchen: [], bathroom: [], balcony: [],
      },
      cleaning_issue: [],
      feedback: {
        task_id: 'old-display-task-id',
        updated_at: '2026-10-24T00:30:00.000Z',
        kind: 'maintenance',
        maintenanceDrafts: [{
          clientId: 'feedback-old-display',
          client_item_id: 'feedback-old-display',
          area: null,
          detail: '保留旧展示键下的问题草稿',
          media: [],
          submitAsCompleted: false,
          completionNote: '',
          completionAfterPhotos: [],
        }],
        deepCleaningDrafts: [],
        dailyDrafts: [],
      },
    },
    steps: {},
  }
  ;(queue.resolveInspectionPanelBatch as jest.Mock).mockResolvedValue({
    item: sourceBatch,
    matched_by: 'source_task_id',
    ambiguous_count: 0,
  })
  ;(queue.saveInspectionPanelDraftBatch as jest.Mock).mockClear().mockResolvedValue(sourceBatch)
  ;(queue.submitInspectionPanelBatch as jest.Mock).mockClear().mockResolvedValue({ ...sourceBatch, status: 'pending_submit' })
  ;(queue.processInspectionPanelSubmitQueue as jest.Mock).mockClear().mockResolvedValue({ processed: 0, remaining: 1 })
  ;(draft.setInspectionPanelDraft as jest.Mock).mockClear().mockResolvedValue(undefined)
  ;(api.getInspectionPhotos as jest.Mock).mockReset().mockResolvedValue({
    items: [],
    formal_submission: { status: 'none', submit_id: null, saved_at: null },
  })
  const InspectionPanelScreen = require('./InspectionPanelScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), addListener: jest.fn(() => () => {}), setOptions: jest.fn() }
  const ui = render(
    <I18nProvider>
      <InspectionPanelScreen navigation={navigation} route={{ key: 'inspection-display-id-changed', name: 'InspectionPanel', params: { taskId: 'w-inspection', sourceId: 'cleaning-1' } }} />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByTestId('inspection-photo-living-0')).toBeTruthy())
  const focusCalls = (navigation.addListener.mock.calls as unknown as any[][])
    .filter((call) => call[0] === 'focus')
  const focusCallback = focusCalls[focusCalls.length - 1]?.[1] as (() => void) | undefined
  if (!focusCallback) throw new Error('focus listener was not registered')
  await act(async () => {
    focusCallback()
    await Promise.resolve()
    await Promise.resolve()
  })
  fireEvent.press(ui.getByText('房号正确，继续'))
  await waitFor(() => expect(ui.queryByTestId('inspection-room-confirmation')).toBeNull())
  fireEvent.press(ui.getByText('提交本页检查与补充'))

  await waitFor(() => {
    expect(draft.setInspectionPanelDraft).toHaveBeenCalledWith('old-display-task-id', expect.objectContaining({
      task_id: 'old-display-task-id',
      cleaning_task_id: 'cleaning-1',
    }))
    expect(queue.saveInspectionPanelDraftBatch).toHaveBeenCalledWith(expect.objectContaining({
      task_id: 'old-display-task-id',
      cleaning_task_id: 'cleaning-1',
      snapshot: expect.objectContaining({
        feedback: expect.objectContaining({
          maintenanceDrafts: [expect.objectContaining({ detail: '保留旧展示键下的问题草稿' })],
        }),
      }),
    }))
    expect(queue.submitInspectionPanelBatch).toHaveBeenCalledWith('old-display-task-id')
  })
  ui.unmount()
})
