import React from 'react'
import { StyleSheet } from 'react-native'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { I18nProvider } from '../../lib/i18n'

const baseMockTask = {
  id: 'w-cleaning',
  task_kind: 'cleaning',
  source_type: 'cleaning_tasks',
  source_id: 'cleaning-1',
  task_type: 'stayover_clean',
  title: '测试房源清洁',
  property: { id: 'property-1', code: 'TEST-1', address: '测试地址' },
  available_actions: [{ id: 'self_complete', enabled: true, target: 'CleaningSelfComplete' }],
}

const mockSnapshot = { items: [{ ...baseMockTask }] }

let mockLockboxQueueItems: any[] = []
let mockInspectionMode = 'self_complete'

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }))
jest.mock('expo-av', () => {
  const React = require('react')
  const { View } = require('react-native')
  return { ResizeMode: { CONTAIN: 'contain' }, Video: (props: any) => React.createElement(View, props) }
})
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
}))
jest.mock('../../lib/auth', () => ({ useAuth: () => ({ token: 'test-token', user: { id: 'cleaner-1', username: 'executor', role: 'cleaner' } }) }))
jest.mock('../../lib/workTasksStore', () => ({
  findWorkTaskItemByAnyId: (id: string) => mockSnapshot.items.find((item: any) => item.id === id || item.source_id === id) || null,
  patchWorkTaskItem: jest.fn(async () => {}),
  subscribeWorkTasks: jest.fn(() => () => {}),
}))
jest.mock('../../lib/cleaningInspection', () => ({ effectiveInspectionMode: () => mockInspectionMode }))
jest.mock('../../lib/cleaningConsumablesDraft', () => ({
  deleteCleaningConsumablesPhoto: jest.fn(),
  enqueueCleaningConsumablesMediaCleanup: jest.fn(async () => {}),
  getCleaningConsumablesDraft: jest.fn(async () => null),
  isLocalCleaningConsumablesPhotoUri: jest.fn(() => false),
  persistCompressedCleaningConsumablesPhoto: jest.fn(async () => 'file:///photo.jpg'),
  setCleaningConsumablesDraft: jest.fn(async () => {}),
}))
jest.mock('../../lib/cleaningConsumablesSubmitQueue', () => ({
  enqueueAndProcessCleaningConsumablesSubmit: jest.fn(async () => ({ processed: 1, remaining: 0, succeeded_task_ids: ['cleaning-1'] })),
  subscribeCleaningConsumablesSubmitQueue: jest.fn(() => () => {}),
}))
jest.mock('../../lib/inspectionMediaQueue', () => ({
  enqueueInspectionMediaItem: jest.fn(async (params: any) => {
    const item = {
      id: 'self-lockbox-queue-1',
      task_id: params.task_id,
      kind: params.kind,
      local_uri: params.source_uri,
      name: params.name,
      mime_type: params.mime_type,
      created_at: '2026-07-29T02:03:04.000Z',
      captured_at: '2026-07-29T02:03:04.000Z',
      uploaded_url: null,
      upload_status: 'pending',
      business_saved: false,
      retain_until: '2026-08-29T02:03:04.000Z',
      meta: params.meta,
    }
    mockLockboxQueueItems = [item]
    return item
  }),
  listInspectionMediaQueueItemsForTask: jest.fn(async () => mockLockboxQueueItems),
  processInspectionMediaQueue: jest.fn(async () => ({ processed: 0, remaining: mockLockboxQueueItems.length })),
  removeInspectionMediaItem: jest.fn(async (id: string) => {
    mockLockboxQueueItems = mockLockboxQueueItems.filter((item) => item.id !== id)
  }),
  subscribeInspectionMediaQueue: jest.fn(() => () => {}),
  updateInspectionMediaItem: jest.fn(async (id: string, patch: any) => {
    mockLockboxQueueItems = mockLockboxQueueItems.map((item) => item.id === id ? { ...item, ...patch } : item)
  }),
}))
jest.mock('../../lib/useSuppliesCatalogStore', () => ({
  ensureSuppliesCatalogLoaded: jest.fn(async () => {}),
  retrySuppliesCatalog: jest.fn(async () => {}),
  useSuppliesCatalogStore: () => mockSuppliesCatalogState,
}))
jest.mock('../../lib/api', () => ({
  getCompletionPhotos: jest.fn(async () => ({ items: [] })),
  getCleaningConsumables: jest.fn(async () => ({ items: [] })),
  getRestockProof: jest.fn(async () => ({ items: [] })),
  getWorkTaskFormPhotos: jest.fn(async () => ({ items: [] })),
  isRetryableApiError: jest.fn(() => false),
  saveCompletionPhotos: jest.fn(async () => ({})),
  selfCompleteCleaningTask: jest.fn(async () => ({})),
  submitCleaningConsumables: jest.fn(async () => ({})),
  uploadCleaningMedia: jest.fn(async () => ({ url: 'https://example.test/photo.jpg' })),
  uploadCleaningVideo: jest.fn(async () => ({ url: 'https://example.test/video.mov' })),
  uploadSelfLockboxVideo: jest.fn(async () => ({})),
}))
jest.mock('../../components/ui/ResponsiveImageGrid', () => (props: any) => {
  const mockReact = require('react')
  const { View } = require('react-native')
  return mockReact.createElement(
    View,
    null,
    props.items.map((item: any, index: number) => mockReact.createElement(View, { key: props.keyExtractor?.(item, index) || index }, props.renderItem(item, index))),
  )
})
jest.mock('../../components/CleaningMediaImage', () => () => null)
jest.mock('../../components/CleaningMediaPreview', () => () => null)
jest.mock('../../components/ui/SafeAreaBottomBar', () => () => null)
jest.mock('../../components/ui/AppButton', () => (props: any) => {
  const mockReact = require('react')
  const { Pressable, Text } = require('react-native')
  return mockReact.createElement(Pressable, { onPress: props.onPress }, mockReact.createElement(Text, null, props.label))
})
jest.mock('../../components/ui/AppTextInput', () => (props: any) => {
  const mockReact = require('react')
  const { TextInput } = require('react-native')
  return mockReact.createElement(TextInput, props)
})

const mockSuppliesCatalogState = {
  items: [] as any[],
  hydrated: true,
  loading: false,
  refreshing: false,
  error: null as string | null,
  isFromCache: false,
  lastSyncedAt: null as string | null,
}

beforeEach(() => {
  mockSnapshot.items = [{
    ...baseMockTask,
    property: { ...baseMockTask.property },
    available_actions: baseMockTask.available_actions.map((action) => ({ ...action })),
  }]
  const imagePicker = require('expo-image-picker')
  imagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true })
  imagePicker.launchCameraAsync.mockResolvedValue({ canceled: true, assets: [] })
  mockSuppliesCatalogState.items = []
  mockInspectionMode = 'self_complete'
  const draft = require('../../lib/cleaningConsumablesDraft')
  draft.getCleaningConsumablesDraft.mockClear()
  draft.setCleaningConsumablesDraft.mockClear()
  draft.getCleaningConsumablesDraft.mockResolvedValue(null)
  const queue = require('../../lib/inspectionMediaQueue')
  queue.listInspectionMediaQueueItemsForTask.mockClear()
  queue.processInspectionMediaQueue.mockClear()
  queue.subscribeInspectionMediaQueue.mockClear()
  const api = require('../../lib/api')
  api.getWorkTaskFormPhotos.mockReset()
  api.getWorkTaskFormPhotos.mockResolvedValue({ items: [] })
  mockLockboxQueueItems = []
})

test('任务执行人看到清洁完成的照片和完成门槛', async () => {
  const CleaningSelfCompleteScreen = require('./CleaningSelfCompleteScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }
  const ui = render(
    <I18nProvider>
      <CleaningSelfCompleteScreen navigation={navigation} route={{ key: 'cleaning', name: 'CleaningSelfComplete', params: { taskId: 'w-cleaning' } }} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getAllByText('房间完成照片').length).toBeGreaterThan(0)
    expect(ui.getAllByText('标记已完成').length).toBeGreaterThan(0)
    expect(ui.getByText(/入住中清洁只需补齐完成照片/)).toBeTruthy()
    expect(ui.getByText('浴室下水口')).toBeTruthy()
    expect(ui.getByText('客厅')).toBeTruthy()
    expect(ui.getAllByText('拍整体照片（至少 1 张）')).toHaveLength(2)
    expect(ui.getByText('沙发')).toBeTruthy()
    expect(ui.getByText('拍坐垫表面（至少 1 张）')).toBeTruthy()
    expect(ui.getByText('卧室')).toBeTruthy()
    expect(ui.getByText('拍地毯（至少 1 张）')).toBeTruthy()
    expect(ui.getByText('厨房')).toBeTruthy()
    expect(ui.getByText('电视和空调遥控器')).toBeTruthy()
    expect(ui.getByText('两种遥控器同框拍 1 张（必拍）')).toBeTruthy()
    expect(ui.queryByText('空调遥控器在墙上时可不拍')).toBeNull()
    expect(ui.getAllByText('拍照')).toHaveLength(8)
    const capture = ui.getByTestId('completion-photo-remote_tv-capture')
    const captureStyle = typeof capture.props.style === 'function' ? capture.props.style({ pressed: false }) : capture.props.style
    expect(StyleSheet.flatten(captureStyle)).toMatchObject({ backgroundColor: '#2563EB' })
    expect(ui.queryByTestId('completion-photo-remote_ac-capture')).toBeNull()
  })
})

test('自完成未结束任务先确认房号，已结束任务直接查看', async () => {
  mockSnapshot.items[0].task_type = 'turnover_clean'
  ;(mockSnapshot.items[0] as any).status = 'in_progress'
  const CleaningSelfCompleteScreen = require('./CleaningSelfCompleteScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }
  const active = render(
    <I18nProvider>
      <CleaningSelfCompleteScreen navigation={navigation} route={{ key: 'active-cleaning', name: 'CleaningSelfComplete', params: { taskId: 'w-cleaning' } }} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(active.getByTestId('self-complete-room-confirmation')).toBeTruthy()
    expect(active.getByTestId('self-complete-room-confirmation-code').props.children).toBe('TEST-1')
  })
  fireEvent.press(active.getByText('房号正确，继续'))
  await waitFor(() => expect(active.queryByTestId('self-complete-room-confirmation')).toBeNull())
  active.unmount()

  ;(mockSnapshot.items[0] as any).status = 'cleaned'
  const completed = render(
    <I18nProvider>
      <CleaningSelfCompleteScreen navigation={navigation} route={{ key: 'completed-cleaning', name: 'CleaningSelfComplete', params: { taskId: 'w-cleaning' } }} />
    </I18nProvider>,
  )
  await waitFor(() => expect(completed.queryByTestId('self-complete-room-confirmation')).toBeNull())
})

test('活动普通同日检查不会显示自完成挂钥匙要求，并继续阻止误入自完成提交页', async () => {
  mockInspectionMode = 'same_day'
  mockSnapshot.items[0].task_type = 'checkout_clean'
  ;(mockSnapshot.items[0] as any).status = 'in_progress'
  const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation((...args: unknown[]) => {
    const buttons = args[2] as any[] | undefined
    buttons?.[0]?.onPress?.()
  })
  const CleaningSelfCompleteScreen = require('./CleaningSelfCompleteScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }

  const ui = render(
    <I18nProvider>
      <CleaningSelfCompleteScreen navigation={navigation} route={{ key: 'same-day-active', name: 'CleaningSelfComplete', params: { taskId: 'w-cleaning' } }} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(alertSpy).toHaveBeenCalledWith('待确认检查安排', expect.any(String), expect.any(Array))
    expect(navigation.goBack).toHaveBeenCalled()
  })
  expect(ui.queryByText('挂钥匙视频')).toBeNull()
  alertSpy.mockRestore()
})

test('Root 结构化已挂钥匙跳过房号确认，明确无事实时不信任 raw keys_hung', async () => {
  const task = mockSnapshot.items[0] as any
  task.task_type = 'turnover_clean'
  task.status = 'keys_hung'
  task.key_handover = {
    state: 'completed',
    source_task_id: 'cleaning-1',
    completed_at: '2026-10-21T01:02:03.000Z',
  }
  const CleaningSelfCompleteScreen = require('./CleaningSelfCompleteScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }

  const completed = render(
    <I18nProvider>
      <CleaningSelfCompleteScreen navigation={navigation} route={{ key: 'self-complete-structured-key-handover', name: 'CleaningSelfComplete', params: { taskId: 'w-cleaning' } }} />
    </I18nProvider>,
  )
  await waitFor(() => expect(completed.queryByTestId('self-complete-room-confirmation')).toBeNull())
  completed.unmount()

  task.key_handover = null
  const noFact = render(
    <I18nProvider>
      <CleaningSelfCompleteScreen navigation={navigation} route={{ key: 'self-complete-explicit-no-key-handover', name: 'CleaningSelfComplete', params: { taskId: 'w-cleaning' } }} />
    </I18nProvider>,
  )
  await waitFor(() => expect(noFact.getByTestId('self-complete-room-confirmation')).toBeTruthy())
  noFact.unmount()
})

test('完成照片读取失败时保留已经显示的照片', async () => {
  const api = require('../../lib/api')
  api.getCompletionPhotos.mockResolvedValueOnce({
    items: ['toilet', 'living', 'sofa', 'bedroom', 'kitchen', 'shower_drain', 'remote_tv', 'vacuum_used'].map((area) => ({ area, url: `cleaning/test/${area}.jpg` })),
  })
  const focusRef: { current: (() => void) | null } = { current: null }
  const CleaningSelfCompleteScreen = require('./CleaningSelfCompleteScreen').default as React.ComponentType<any>
  const navigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn(),
    addListener: jest.fn((_event: string, callback: () => void) => {
      focusRef.current = callback
      return () => {}
    }),
  }
  const ui = render(
    <I18nProvider>
      <CleaningSelfCompleteScreen navigation={navigation} route={{ key: 'cleaning', name: 'CleaningSelfComplete', params: { taskId: 'w-cleaning' } }} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getAllByText('已满足').length).toBeGreaterThan(0)
  })

  api.getCompletionPhotos.mockRejectedValueOnce(new Error('network'))
  await act(async () => {
    focusRef.current?.()
  })
  await waitFor(() => {
    expect(ui.getAllByText('已满足').length).toBeGreaterThan(0)
  })
})

test('旧空调遥控器完成照片重进后合并为单一遥控器拍照位', async () => {
  const api = require('../../lib/api')
  api.getCompletionPhotos.mockResolvedValueOnce({
    items: ['toilet', 'living', 'sofa', 'bedroom', 'kitchen', 'shower_drain', 'remote_ac', 'vacuum_used']
      .map((area) => ({ area, url: `cleaning/test/${area}.jpg` })),
  })
  const CleaningSelfCompleteScreen = require('./CleaningSelfCompleteScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }
  const ui = render(
    <I18nProvider>
      <CleaningSelfCompleteScreen navigation={navigation} route={{ key: 'cleaning', name: 'CleaningSelfComplete', params: { taskId: 'w-cleaning' } }} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText('电视和空调遥控器')).toBeTruthy()
    expect(ui.getAllByText('已满足').length).toBeGreaterThan(0)
  })
})

test('自完成挂钥匙视频会恢复队列状态，而不是误显示为已上传', async () => {
  mockSnapshot.items[0].task_type = 'turnover_clean'
  mockLockboxQueueItems = [{
    id: 'self-lockbox-pending-save',
    task_id: 'cleaning-1',
    kind: 'lockbox_video',
    local_uri: 'file:///documents/video.mov',
    name: 'video.mov',
    mime_type: 'video/quicktime',
    created_at: '2026-07-29T02:03:04.000Z',
    captured_at: '2026-07-29T02:03:04.000Z',
    uploaded_url: 'cleaning/media/self-lockbox.mov',
    upload_status: 'uploaded',
    business_saved: false,
    retain_until: '2026-08-29T02:03:04.000Z',
    last_error: '任务保存超时',
    meta: { lockbox_submission_mode: 'self_complete' },
  }]
  const CleaningSelfCompleteScreen = require('./CleaningSelfCompleteScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }
  const ui = render(
    <I18nProvider>
      <CleaningSelfCompleteScreen navigation={navigation} route={{ key: 'self-lockbox', name: 'CleaningSelfComplete', params: { taskId: 'w-cleaning' } }} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getAllByText('保存失败').length).toBeGreaterThan(0)
    expect(ui.getByTestId('self-complete-lockbox-sync-hint').props.children).toContain('任务保存超时')
    expect(ui.getByText('重试同步')).toBeTruthy()
  })
})

test('清洁历史记录恢复原页面顺序，只读取准确来源并禁止重做原任务', async () => {
  const previousTask = { ...mockSnapshot.items[0] }
  mockSnapshot.items[0] = {
    ...previousTask,
    task_type: 'turnover_clean',
    status: 'done',
    work_record_read_only: true,
    property: {
      ...previousTask.property,
      wifi_ssid: 'SYNTHETIC-WIFI',
      wifi_password: 'synthetic-only',
      router_location: '客厅电视柜',
      access_guide_link: 'https://example.invalid/synthetic-guide',
    },
    read_only_views: {
      media_scope: 'cleaner',
      media_source_ids: ['cleaning-1'],
      property_access: true,
      guest_context: true,
      lock_codes: true,
    },
    available_actions: [{
      id: 'report_issue',
      label: '问题反馈与报修记录',
      enabled: true,
      target: 'FeedbackForm',
      source_type: 'cleaning_tasks',
      source_id: 'cleaning-1',
    }],
  } as any
  const api = require('../../lib/api')
  const queue = require('../../lib/inspectionMediaQueue')
  api.getCleaningConsumables.mockClear()
  api.getRestockProof.mockClear()
  const historicalMedia = {
    items: [
      { id: 'completion-living', task_id: 'cleaning-1', source: 'completion', area: 'living', url: 'cleaning/media/completion-living.jpg' },
      { id: 'lockbox-video', task_id: 'cleaning-1', source: 'lockbox_video', url: 'cleaning/media/lockbox-video.mov' },
      { id: 'consumable-shampoo', task_id: 'cleaning-1', source: 'consumable', item_id: 'shampoo', label: '洗发水', url: 'cleaning/media/consumable-shampoo.jpg' },
      { id: 'restock-shampoo', task_id: 'cleaning-1', source: 'restock', item_id: 'shampoo', label: '洗发水', url: 'cleaning/media/restock-shampoo.jpg' },
    ],
  }
  api.getWorkTaskFormPhotos.mockResolvedValue(historicalMedia)
  const CleaningSelfCompleteScreen = require('./CleaningSelfCompleteScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }

  try {
    const ui = render(
      <I18nProvider>
        <CleaningSelfCompleteScreen navigation={navigation} route={{ key: 'cleaning-history', name: 'CleaningSelfComplete', params: { taskId: 'w-cleaning', readOnly: true } }} />
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(api.getWorkTaskFormPhotos).toHaveBeenCalledWith('test-token', 'w-cleaning', ['cleaning-1'], 'cleaner', { includeVideos: true })
      expect(api.getWorkTaskFormPhotos).toHaveBeenCalledTimes(1)
      expect(ui.getByTestId('self-complete-feedback-before-photos')).toBeTruthy()
      expect(ui.getByText('本次清洁已保存的照片可点击查看大图。')).toBeTruthy()
      expect(ui.getAllByText('挂钥匙视频').length).toBeGreaterThan(0)
      expect(ui.getByText('路由器位置：客厅电视柜')).toBeTruthy()
      expect(ui.queryByText('拍照')).toBeNull()
      expect(ui.queryByText('重试同步')).toBeNull()
      expect(queue.listInspectionMediaQueueItemsForTask).not.toHaveBeenCalled()
      expect(queue.processInspectionMediaQueue).not.toHaveBeenCalled()
      expect(queue.subscribeInspectionMediaQueue).not.toHaveBeenCalled()
      expect(api.getCleaningConsumables).not.toHaveBeenCalled()
      expect(api.getRestockProof).not.toHaveBeenCalled()
    })

    const rendered = JSON.stringify(ui.toJSON())
    expect(rendered.indexOf('消耗品补充')).toBeLessThan(rendered.indexOf('房源问题反馈'))
    expect(rendered.indexOf('房源问题反馈')).toBeLessThan(rendered.indexOf('房间完成照片'))
    expect(rendered.indexOf('房间完成照片')).toBeLessThan(rendered.indexOf('完成记录'))
  } finally {
    mockSnapshot.items[0] = previousTask
  }
})

test('普通同日检查历史沿用清洁只读页面，不套用自完成挂钥匙门槛，并恢复准确同源资料', async () => {
  mockInspectionMode = 'same_day'
  mockSuppliesCatalogState.items = [{ id: 'current-only', label: '当前目录新品', required: true }]
  const previousTask = { ...mockSnapshot.items[0] }
  mockSnapshot.items[0] = {
    ...previousTask,
    task_type: 'checkout_clean',
    status: 'done',
    work_record_read_only: true,
    restock_items: [
      { item_id: 'paper', label: '卷纸', qty: 2, note: '已补两卷', status: 'restocked', photo_url: 'cleaning/media/restock-paper.jpg' },
      { item_id: 'soap', label: '洗手液', qty: null, status: 'unavailable', photo_url: 'cleaning/media/restock-soap.jpg' },
      { item_id: 'towels', label: '毛巾', qty: 0, status: 'restocked' },
    ],
    read_only_views: {
      media_scope: 'cleaner',
      media_source_ids: ['cleaning-1'],
      cleaner_photos: true,
      guest_key_photo: true,
      lockbox_video: false,
    },
  } as any
  const api = require('../../lib/api')
  api.getWorkTaskFormPhotos.mockResolvedValue({
    items: [
      { id: 'key', task_id: 'cleaning-1', source: 'key', area: 'guest_key', url: 'cleaning/media/key.jpg' },
      { id: 'completion', task_id: 'cleaning-1', source: 'completion', area: 'living', url: 'cleaning/media/living.jpg' },
      { id: 'consumable', task_id: 'cleaning-1', source: 'consumable', item_id: 'paper', label: '卷纸', url: 'cleaning/media/consumable-paper.jpg' },
      { id: 'restock', task_id: 'cleaning-1', source: 'restock', item_id: 'paper', label: '卷纸', url: 'cleaning/media/restock-paper.jpg' },
      { id: 'inspection', task_id: 'cleaning-1', source: 'inspection', area: 'kitchen', url: 'cleaning/media/inspection-must-not-show.jpg' },
      { id: 'video', task_id: 'cleaning-1', source: 'lockbox_video', area: 'key_handover', url: 'cleaning/media/video-must-not-be-required.mov' },
      { id: 'wrong-source', task_id: 'other-cleaning', source: 'completion', area: 'sofa', url: 'cleaning/media/wrong-source.jpg' },
    ],
  })
  const CleaningSelfCompleteScreen = require('./CleaningSelfCompleteScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }

  try {
    const ui = render(
      <I18nProvider>
        <CleaningSelfCompleteScreen navigation={navigation} route={{ key: 'same-day-history', name: 'CleaningSelfComplete', params: { taskId: 'w-cleaning', readOnly: true } }} />
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(ui.getByTestId('cleaning-history-key-photo')).toBeTruthy()
      expect(ui.getByTestId('completion-photo-living-0')).toBeTruthy()
      expect(ui.getByText('已保存数量：2')).toBeTruthy()
      expect(ui.getByText('已保存数量：0')).toBeTruthy()
      expect(ui.getByText('备注：已补两卷')).toBeTruthy()
      expect(ui.getByText('卷纸')).toBeTruthy()
      expect(ui.getByText('洗手液')).toBeTruthy()
      expect(ui.getByText('毛巾')).toBeTruthy()
    })
    expect(ui.queryByText('已保存数量：1')).toBeNull()
    expect(ui.queryByTestId('self-restock-paper-sufficient')).toBeNull()
    expect(ui.queryByTestId('self-restock-paper-restocked')).toBeNull()
    expect(ui.queryByTestId('self-restock-paper-carry-forward')).toBeNull()
    expect(ui.queryByPlaceholderText('补充数量（可选）')).toBeNull()
    expect(ui.queryByPlaceholderText('备注（可选）')).toBeNull()
    expect(ui.queryByPlaceholderText('添加其他补充项（可选）')).toBeNull()
    expect(ui.queryByText('拍补货凭证')).toBeNull()
    expect(ui.queryByText('继续拍凭证 (1)')).toBeNull()
    expect(ui.queryByText('提交消耗品补充')).toBeNull()
    expect(ui.queryByText('当前目录新品')).toBeNull()
    expect(ui.queryByTestId('completion-photo-sofa-0')).toBeNull()
    expect(ui.queryByText('挂钥匙视频')).toBeNull()
    expect(ui.queryByText('未满足')).toBeNull()
    expect(ui.queryByText('未提交')).toBeNull()
    expect(ui.getByText('普通同日检查任务由检查流程负责挂钥匙；清洁历史这里只展示清洁本人已保存的内容。')).toBeTruthy()
    expect(JSON.stringify(ui.toJSON())).not.toContain('inspection-must-not-show.jpg')
  } finally {
    mockSnapshot.items[0] = previousTask
  }
})

test('真正自完成历史仅只读显示本次挂钥匙记录，不把缺少记录标为待上传', async () => {
  mockInspectionMode = 'self_complete'
  mockSuppliesCatalogState.items = [{ id: 'current-only', label: '当前目录新品', required: true }]
  const previousTask = { ...mockSnapshot.items[0] }
  mockSnapshot.items[0] = {
    ...previousTask,
    task_type: 'checkout_clean',
    status: 'done',
    work_record_read_only: true,
    read_only_views: { media_scope: 'cleaner', media_source_ids: ['cleaning-1'], cleaner_photos: true, lockbox_video: true },
  } as any
  const api = require('../../lib/api')
  api.getWorkTaskFormPhotos.mockResolvedValue({ items: [] })
  const CleaningSelfCompleteScreen = require('./CleaningSelfCompleteScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }

  try {
    const ui = render(
      <I18nProvider>
        <CleaningSelfCompleteScreen navigation={navigation} route={{ key: 'self-complete-history-empty', name: 'CleaningSelfComplete', params: { taskId: 'w-cleaning', readOnly: true } }} />
      </I18nProvider>,
    )
    await waitFor(() => expect(ui.getByText('本次自完成记录没有已保存的挂钥匙视频。')).toBeTruthy())
    expect(ui.queryByText('未上传')).toBeNull()
    expect(ui.queryByText('完成前请上传挂钥匙视频，可重复拍摄覆盖。')).toBeNull()
    expect(ui.queryByText('标记已完成')).toBeNull()
    expect(ui.queryByText('当前目录新品')).toBeNull()
    expect(ui.getByText('完成记录')).toBeTruthy()
  } finally {
    mockSnapshot.items[0] = previousTask
  }
})

test('清洁历史记录返回页面时会刷新一次，不会并发重复读取同一来源', async () => {
  const previousTask = { ...mockSnapshot.items[0] }
  mockSnapshot.items[0] = {
    ...previousTask,
    task_type: 'turnover_clean',
    status: 'done',
    work_record_read_only: true,
    read_only_views: { media_scope: 'cleaner', media_source_ids: ['cleaning-1'] },
  } as any
  const api = require('../../lib/api')
  api.getWorkTaskFormPhotos
    .mockResolvedValueOnce({ items: [{ id: 'first', task_id: 'cleaning-1', source: 'completion', area: 'living', url: 'cleaning/media/first.jpg' }] })
    .mockResolvedValueOnce({ items: [{ id: 'second', task_id: 'cleaning-1', source: 'completion', area: 'sofa', url: 'cleaning/media/second.jpg' }] })
  const focusRef: { current: (() => void) | null } = { current: null }
  const CleaningSelfCompleteScreen = require('./CleaningSelfCompleteScreen').default as React.ComponentType<any>
  const navigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn(),
    addListener: jest.fn((_event: string, callback: () => void) => {
      focusRef.current = callback
      return () => {}
    }),
  }

  try {
    const ui = render(
      <I18nProvider>
        <CleaningSelfCompleteScreen navigation={navigation} route={{ key: 'cleaning-history-focus', name: 'CleaningSelfComplete', params: { taskId: 'w-cleaning', readOnly: true } }} />
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(api.getWorkTaskFormPhotos).toHaveBeenCalledTimes(1)
      expect(ui.getByTestId('completion-photo-living-0')).toBeTruthy()
    })
    await act(async () => {
      focusRef.current?.()
    })
    await waitFor(() => {
      expect(api.getWorkTaskFormPhotos).toHaveBeenCalledTimes(2)
      expect(ui.getByTestId('completion-photo-sofa-0')).toBeTruthy()
      expect(ui.queryByTestId('completion-photo-living-0')).toBeNull()
    })
  } finally {
    mockSnapshot.items[0] = previousTask
  }
})

test('清洁历史照片首次读取失败后可在返回页面时重试', async () => {
  const previousTask = { ...mockSnapshot.items[0] }
  mockSnapshot.items[0] = {
    ...previousTask,
    task_type: 'turnover_clean',
    status: 'done',
    work_record_read_only: true,
    read_only_views: { media_scope: 'cleaner', media_source_ids: ['cleaning-1'] },
  } as any
  const api = require('../../lib/api')
  api.getWorkTaskFormPhotos
    .mockRejectedValueOnce(new Error('temporary network failure'))
    .mockResolvedValueOnce({ items: [{ id: 'retry', task_id: 'cleaning-1', source: 'completion', area: 'living', url: 'cleaning/media/retry.jpg' }] })
  const focusRef: { current: (() => void) | null } = { current: null }
  const CleaningSelfCompleteScreen = require('./CleaningSelfCompleteScreen').default as React.ComponentType<any>
  const navigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn(),
    addListener: jest.fn((_event: string, callback: () => void) => {
      focusRef.current = callback
      return () => {}
    }),
  }

  try {
    const ui = render(
      <I18nProvider>
        <CleaningSelfCompleteScreen navigation={navigation} route={{ key: 'cleaning-history-retry', name: 'CleaningSelfComplete', params: { taskId: 'w-cleaning', readOnly: true } }} />
      </I18nProvider>,
    )
    await waitFor(() => {
      expect(api.getWorkTaskFormPhotos).toHaveBeenCalledTimes(1)
      expect(ui.getByText('资料暂时读取失败，页面不会把它误显示成“未拍”或“未提交”。')).toBeTruthy()
      expect(ui.queryByText('未满足')).toBeNull()
      expect(ui.queryByText('本次未保存照片')).toBeNull()
      expect(ui.getAllByText('本区域照片尚未读取成功，请在页面上方重试。').length).toBeGreaterThan(0)
    })
    await act(async () => {
      fireEvent.press(ui.getByTestId('cleaning-history-retry'))
    })
    await waitFor(() => {
      expect(api.getWorkTaskFormPhotos).toHaveBeenCalledTimes(2)
      expect(ui.getByTestId('completion-photo-living-0')).toBeTruthy()
    })
    expect(focusRef.current).toEqual(expect.any(Function))
  } finally {
    mockSnapshot.items[0] = previousTask
  }
})

test('切换清洁历史任务时丢弃旧请求结果并按新来源刷新', async () => {
  const taskA = {
    ...baseMockTask,
    id: 'w-cleaning-a',
    source_id: 'cleaning-a',
    task_type: 'turnover_clean',
    status: 'done',
    work_record_read_only: true,
    read_only_views: { media_scope: 'cleaner', media_source_ids: ['cleaning-a'] },
  }
  const taskB = {
    ...baseMockTask,
    id: 'w-cleaning-b',
    source_id: 'cleaning-b',
    task_type: 'turnover_clean',
    status: 'done',
    work_record_read_only: true,
    read_only_views: { media_scope: 'cleaner', media_source_ids: ['cleaning-b'] },
  }
  mockSnapshot.items = [taskA, taskB] as any
  const api = require('../../lib/api')
  let resolveTaskA!: (value: any) => void
  api.getWorkTaskFormPhotos
    .mockImplementationOnce(() => new Promise((resolve) => { resolveTaskA = resolve }))
    .mockResolvedValueOnce({ items: [{ id: 'task-b', task_id: 'cleaning-b', source: 'completion', area: 'sofa', url: 'cleaning/media/task-b.jpg' }] })
  const CleaningSelfCompleteScreen = require('./CleaningSelfCompleteScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }

  const ui = render(
    <I18nProvider>
      <CleaningSelfCompleteScreen navigation={navigation} route={{ key: 'cleaning-history-switch', name: 'CleaningSelfComplete', params: { taskId: 'w-cleaning-a', readOnly: true } }} />
    </I18nProvider>,
  )
  await waitFor(() => expect(api.getWorkTaskFormPhotos).toHaveBeenCalledTimes(1))
  ui.rerender(
    <I18nProvider>
      <CleaningSelfCompleteScreen navigation={navigation} route={{ key: 'cleaning-history-switch', name: 'CleaningSelfComplete', params: { taskId: 'w-cleaning-b', readOnly: true } }} />
    </I18nProvider>,
  )
  await waitFor(() => {
    expect(api.getWorkTaskFormPhotos).toHaveBeenCalledTimes(2)
    expect(ui.getByTestId('completion-photo-sofa-0')).toBeTruthy()
  })
  await act(async () => {
    resolveTaskA({ items: [{ id: 'task-a', task_id: 'cleaning-a', source: 'completion', area: 'living', url: 'cleaning/media/task-a.jpg' }] })
  })
  await waitFor(() => {
    expect(ui.getByTestId('completion-photo-sofa-0')).toBeTruthy()
    expect(ui.queryByTestId('completion-photo-living-0')).toBeNull()
  })
})

test('已显示历史照片后切换任务会在新请求完成前同步隐藏旧任务媒体', async () => {
  const taskA = {
    ...baseMockTask,
    id: 'w-cleaning-a',
    source_id: 'cleaning-a',
    task_type: 'turnover_clean',
    status: 'done',
    work_record_read_only: true,
    read_only_views: { media_scope: 'cleaner', media_source_ids: ['cleaning-a'] },
  }
  const taskB = {
    ...baseMockTask,
    id: 'w-cleaning-b',
    source_id: 'cleaning-b',
    task_type: 'turnover_clean',
    status: 'done',
    work_record_read_only: true,
    read_only_views: { media_scope: 'cleaner', media_source_ids: ['cleaning-b'] },
  }
  mockSnapshot.items = [taskA, taskB] as any
  const api = require('../../lib/api')
  let resolveTaskB!: (value: any) => void
  api.getWorkTaskFormPhotos
    .mockResolvedValueOnce({ items: [{ id: 'task-a', task_id: 'cleaning-a', source: 'completion', area: 'living', url: 'cleaning/media/task-a.jpg' }] })
    .mockImplementationOnce(() => new Promise((resolve) => { resolveTaskB = resolve }))
    .mockResolvedValueOnce({ items: [{ id: 'task-a-return', task_id: 'cleaning-a', source: 'completion', area: 'bedroom', url: 'cleaning/media/task-a-return.jpg' }] })
  const CleaningSelfCompleteScreen = require('./CleaningSelfCompleteScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }
  const ui = render(
    <I18nProvider>
      <CleaningSelfCompleteScreen navigation={navigation} route={{ key: 'cleaning-history-switch-visible', name: 'CleaningSelfComplete', params: { taskId: 'w-cleaning-a', readOnly: true } }} />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByTestId('completion-photo-living-0')).toBeTruthy())
  fireEvent.press(ui.getByTestId('completion-photo-living-0'))
  await waitFor(() => expect(ui.getByTestId('self-complete-photo-viewer-mask')).toBeTruthy())
  ui.rerender(
    <I18nProvider>
      <CleaningSelfCompleteScreen navigation={navigation} route={{ key: 'cleaning-history-switch-visible', name: 'CleaningSelfComplete', params: { taskId: 'w-cleaning-b', readOnly: true } }} />
    </I18nProvider>,
  )
  expect(ui.queryByTestId('completion-photo-living-0')).toBeNull()
  expect(ui.queryByTestId('self-complete-photo-viewer-mask')).toBeNull()
  await waitFor(() => expect(api.getWorkTaskFormPhotos).toHaveBeenCalledTimes(2))

  await act(async () => {
    resolveTaskB({ items: [{ id: 'task-b', task_id: 'cleaning-b', source: 'completion', area: 'sofa', url: 'cleaning/media/task-b.jpg' }] })
  })
  await waitFor(() => expect(ui.getByTestId('completion-photo-sofa-0')).toBeTruthy())
  ui.rerender(
    <I18nProvider>
      <CleaningSelfCompleteScreen navigation={navigation} route={{ key: 'cleaning-history-switch-visible', name: 'CleaningSelfComplete', params: { taskId: 'w-cleaning-a', readOnly: true } }} />
    </I18nProvider>,
  )
  expect(ui.queryByTestId('self-complete-photo-viewer-mask')).toBeNull()
  await waitFor(() => {
    expect(api.getWorkTaskFormPhotos).toHaveBeenCalledTimes(3)
    expect(ui.getByTestId('completion-photo-bedroom-0')).toBeTruthy()
    expect(ui.queryByTestId('self-complete-photo-viewer-mask')).toBeNull()
  })
})

test('A 到 B 再回 A 时较早的 A 响应不能覆盖较新的 A 响应', async () => {
  const taskA = {
    ...baseMockTask,
    id: 'w-cleaning-a',
    source_id: 'cleaning-a',
    task_type: 'turnover_clean',
    status: 'done',
    work_record_read_only: true,
    read_only_views: { media_scope: 'cleaner', media_source_ids: ['cleaning-a'] },
  }
  const taskB = {
    ...baseMockTask,
    id: 'w-cleaning-b',
    source_id: 'cleaning-b',
    task_type: 'turnover_clean',
    status: 'done',
    work_record_read_only: true,
    read_only_views: { media_scope: 'cleaner', media_source_ids: ['cleaning-b'] },
  }
  mockSnapshot.items = [taskA, taskB] as any
  const api = require('../../lib/api')
  let resolveFirstTaskA!: (value: any) => void
  let resolveSecondTaskA!: (value: any) => void
  api.getWorkTaskFormPhotos
    .mockImplementationOnce(() => new Promise((resolve) => { resolveFirstTaskA = resolve }))
    .mockResolvedValueOnce({ items: [{ id: 'task-b', task_id: 'cleaning-b', source: 'completion', area: 'sofa', url: 'cleaning/media/task-b.jpg' }] })
    .mockImplementationOnce(() => new Promise((resolve) => { resolveSecondTaskA = resolve }))
  const CleaningSelfCompleteScreen = require('./CleaningSelfCompleteScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }
  const renderScreen = (taskId: string) => (
    <I18nProvider>
      <CleaningSelfCompleteScreen navigation={navigation} route={{ key: 'cleaning-history-switch-back', name: 'CleaningSelfComplete', params: { taskId, readOnly: true } }} />
    </I18nProvider>
  )
  const ui = render(renderScreen('w-cleaning-a'))

  await waitFor(() => expect(api.getWorkTaskFormPhotos).toHaveBeenCalledTimes(1))
  ui.rerender(renderScreen('w-cleaning-b'))
  await waitFor(() => {
    expect(api.getWorkTaskFormPhotos).toHaveBeenCalledTimes(2)
    expect(ui.getByTestId('completion-photo-sofa-0')).toBeTruthy()
  })
  ui.rerender(renderScreen('w-cleaning-a'))
  await waitFor(() => expect(api.getWorkTaskFormPhotos).toHaveBeenCalledTimes(3))

  await act(async () => {
    resolveSecondTaskA({ items: [{ id: 'task-a-new', task_id: 'cleaning-a', source: 'completion', area: 'bedroom', url: 'cleaning/media/task-a-new.jpg' }] })
  })
  await waitFor(() => expect(ui.getByTestId('completion-photo-bedroom-0')).toBeTruthy())

  await act(async () => {
    resolveFirstTaskA({ items: [{ id: 'task-a-old', task_id: 'cleaning-a', source: 'completion', area: 'living', url: 'cleaning/media/task-a-old.jpg' }] })
  })
  await waitFor(() => {
    expect(ui.getByTestId('completion-photo-bedroom-0')).toBeTruthy()
    expect(ui.queryByTestId('completion-photo-living-0')).toBeNull()
  })
})

test('清洁只读工作记录缺少精确媒体来源时关闭图库和视频且不回退任务字段', async () => {
  const previousTask = { ...mockSnapshot.items[0] }
  mockSnapshot.items[0] = {
    ...previousTask,
    status: 'done',
    work_record_read_only: true,
    lockbox_video_url: 'cleaning/media/must-not-fallback.mov',
    read_only_views: { media_scope: 'cleaner', media_source_ids: [] },
  } as any
  const api = require('../../lib/api')
  api.getWorkTaskFormPhotos.mockClear()
  api.getCleaningConsumables.mockClear()
  api.getRestockProof.mockClear()
  const CleaningSelfCompleteScreen = require('./CleaningSelfCompleteScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }

  try {
    const ui = render(
      <I18nProvider>
        <CleaningSelfCompleteScreen navigation={navigation} route={{ key: 'cleaning-history-no-source', name: 'CleaningSelfComplete', params: { taskId: 'w-cleaning', readOnly: true } }} />
      </I18nProvider>,
    )

    await waitFor(() => expect(ui.getByText('本次清洁已保存的照片可点击查看大图。')).toBeTruthy())
    expect(api.getWorkTaskFormPhotos).not.toHaveBeenCalled()
    expect(api.getCleaningConsumables).not.toHaveBeenCalled()
    expect(api.getRestockProof).not.toHaveBeenCalled()
    expect(JSON.stringify(ui.toJSON())).not.toContain('must-not-fallback.mov')
  } finally {
    mockSnapshot.items[0] = previousTask
  }
})

test('本地完成照片打开大图时显示同一水印，并可重拍单一遥控器照片', async () => {
  const imagePicker = require('expo-image-picker')
  imagePicker.launchCameraAsync.mockResolvedValueOnce({
    canceled: false,
    assets: [{ uri: 'file:///captured-remote.jpg', fileName: 'captured-remote.jpg', mimeType: 'image/jpeg' }],
  })
  const draft = require('../../lib/cleaningConsumablesDraft')
  draft.persistCompressedCleaningConsumablesPhoto.mockResolvedValueOnce({
    localUri: 'file:///completion-remote.jpg',
    name: 'completion-remote.jpg',
    mimeType: 'image/jpeg',
  })
  const CleaningSelfCompleteScreen = require('./CleaningSelfCompleteScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }
  const ui = render(
    <I18nProvider>
      <CleaningSelfCompleteScreen navigation={navigation} route={{ key: 'cleaning', name: 'CleaningSelfComplete', params: { taskId: 'w-cleaning' } }} />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByTestId('completion-photo-remote_tv-capture')).toBeTruthy())
  fireEvent.press(ui.getByTestId('completion-photo-remote_tv-capture'))
  await waitFor(() => {
    expect(ui.getByText('重拍')).toBeTruthy()
    expect(ui.getByTestId('completion-photo-remote_tv-0')).toBeTruthy()
  })
  fireEvent.press(ui.getByTestId('completion-photo-remote_tv-0'))
  await waitFor(() => {
    expect(ui.getByTestId('self-complete-photo-viewer-mask')).toBeTruthy()
    expect(ui.getByText('左右滑动查看')).toBeTruthy()
    expect(ui.getByText(/TEST-1[\s\S]*executor/)).toBeTruthy()
  })
})

test('补充与完成入口恢复只点过一项的草稿时，其余补品仍待确认', async () => {
  mockSnapshot.items[0].task_type = 'turnover_clean'
  mockSuppliesCatalogState.items = [
    { id: 'shampoo', label: '洗发水', kind: 'consumable', required: true, requires_photo_when_low: false },
    { id: 'tissue', label: '纸巾', kind: 'consumable', required: true, requires_photo_when_low: false },
  ]
  const draft = require('../../lib/cleaningConsumablesDraft')
  draft.getCleaningConsumablesDraft.mockResolvedValueOnce({
    task_id: 'cleaning-1',
    updated_at: '2026-07-25T00:00:00.000Z',
    pending_submit: false,
    items: [
      { item_id: 'shampoo', status: 'ok', qty: null, note: null, photo_urls: [] },
      { item_id: 'tissue', status: null, qty: null, note: null, photo_urls: [] },
    ],
    extra_photo_urls: {},
    photo_meta: {},
  })
  const CleaningSelfCompleteScreen = require('./CleaningSelfCompleteScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }
  const ui = render(
    <I18nProvider>
      <CleaningSelfCompleteScreen navigation={navigation} route={{ key: 'cleaning', name: 'CleaningSelfComplete', params: { taskId: 'w-cleaning' } }} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getAllByText('待确认').length).toBeGreaterThan(0)
    expect(ui.getAllByText('现场够用').length).toBeGreaterThan(0)
    expect(ui.getByText('补充标准：不少于 1/3')).toBeTruthy()
  })
})

test('自完成草稿只保存已明确选择的消耗品状态', async () => {
  mockSnapshot.items[0].task_type = 'turnover_clean'
  mockSuppliesCatalogState.items = [
    { id: 'shampoo', label: '洗发水', kind: 'consumable', required: true, requires_photo_when_low: false },
    { id: 'tissue', label: '纸巾', kind: 'consumable', required: true, requires_photo_when_low: false },
  ]
  const draft = require('../../lib/cleaningConsumablesDraft')
  const CleaningSelfCompleteScreen = require('./CleaningSelfCompleteScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }
  const ui = render(
    <I18nProvider>
      <CleaningSelfCompleteScreen navigation={navigation} route={{ key: 'cleaning', name: 'CleaningSelfComplete', params: { taskId: 'w-cleaning' } }} />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByTestId('self-restock-shampoo-sufficient')).toBeTruthy())
  fireEvent.press(ui.getByTestId('self-restock-shampoo-sufficient'))
  await waitFor(() => {
    const calls = draft.setCleaningConsumablesDraft.mock.calls
    const savedDraft = calls[calls.length - 1]?.[1]
    expect(savedDraft.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ item_id: 'shampoo', status: 'ok', restock_status: 'unavailable' }),
      expect.objectContaining({ item_id: 'tissue', status: null, restock_status: null }),
    ]))
  })
})

test('曾被默认写成 ok 但没有补货结果的草稿会恢复为待确认', async () => {
  mockSnapshot.items[0].task_type = 'turnover_clean'
  mockSuppliesCatalogState.items = [
    { id: 'shampoo', label: '洗发水', kind: 'consumable', required: true, requires_photo_when_low: false },
    { id: 'tissue', label: '纸巾', kind: 'consumable', required: true, requires_photo_when_low: false },
  ]
  const draft = require('../../lib/cleaningConsumablesDraft')
  draft.getCleaningConsumablesDraft.mockResolvedValueOnce({
    task_id: 'cleaning-1',
    updated_at: '2026-07-28T00:00:00.000Z',
    pending_submit: false,
    items: [
      { item_id: 'shampoo', status: 'ok', restock_status: null, qty: null, note: null, photo_urls: [] },
      { item_id: 'tissue', status: 'ok', restock_status: null, qty: null, note: null, photo_urls: [] },
    ],
    extra_photo_urls: {},
    photo_meta: {},
  })
  const CleaningSelfCompleteScreen = require('./CleaningSelfCompleteScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }
  const ui = render(
    <I18nProvider>
      <CleaningSelfCompleteScreen navigation={navigation} route={{ key: 'cleaning', name: 'CleaningSelfComplete', params: { taskId: 'w-cleaning' } }} />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getAllByText('待确认')).toHaveLength(2))
})

test('补品草稿已清理时，服务端已保存的现场够用状态仍会回显', async () => {
  mockSnapshot.items[0].task_type = 'turnover_clean'
  mockSuppliesCatalogState.items = [
    { id: 'shampoo', label: '洗发水', kind: 'consumable', required: true, requires_photo_when_low: false },
    { id: 'tissue', label: '纸巾', kind: 'consumable', required: true, requires_photo_when_low: false },
  ]
  const api = require('../../lib/api')
  api.getCleaningConsumables.mockResolvedValueOnce({
    items: [{ id: 'usage-1', item_id: 'shampoo', status: 'ok', qty: 0, need_restock: false }],
  })
  const CleaningSelfCompleteScreen = require('./CleaningSelfCompleteScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }
  const ui = render(
    <I18nProvider>
      <CleaningSelfCompleteScreen navigation={navigation} route={{ key: 'cleaning', name: 'CleaningSelfComplete', params: { taskId: 'w-cleaning' } }} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getAllByText('现场够用').length).toBeGreaterThan(0)
    expect(ui.getAllByText('待确认').length).toBeGreaterThan(0)
  })
})
