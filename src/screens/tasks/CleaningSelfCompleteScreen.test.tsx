import React from 'react'
import { StyleSheet } from 'react-native'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { I18nProvider } from '../../lib/i18n'

const mockSnapshot = {
  items: [{
    id: 'w-cleaning',
    task_kind: 'cleaning',
    source_type: 'cleaning_tasks',
    source_id: 'cleaning-1',
    task_type: 'stayover_clean',
    title: '测试房源清洁',
    property: { id: 'property-1', code: 'TEST-1', address: '测试地址' },
    available_actions: [{ id: 'self_complete', enabled: true, target: 'CleaningSelfComplete' }],
  }],
}

let mockLockboxQueueItems: any[] = []

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
jest.mock('../../lib/cleaningInspection', () => ({ effectiveInspectionMode: () => 'self_complete' }))
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
  mockSnapshot.items[0].task_type = 'stayover_clean'
  delete (mockSnapshot.items[0] as any).status
  const imagePicker = require('expo-image-picker')
  imagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true })
  imagePicker.launchCameraAsync.mockResolvedValue({ canceled: true, assets: [] })
  mockSuppliesCatalogState.items = []
  const draft = require('../../lib/cleaningConsumablesDraft')
  draft.getCleaningConsumablesDraft.mockClear()
  draft.setCleaningConsumablesDraft.mockClear()
  draft.getCleaningConsumablesDraft.mockResolvedValue(null)
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
