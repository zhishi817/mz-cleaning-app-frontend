import React from 'react'
import { Alert } from 'react-native'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { I18nProvider } from '../../lib/i18n'

const mockSnapshot = {
  items: [{
    id: 'w-supplies',
    task_kind: 'cleaning',
    source_type: 'cleaning_tasks',
    source_id: 'cleaning-1',
    title: '测试房源补品',
    property: { id: 'property-1', code: 'TEST-1', address: '测试地址' },
  }],
}

const mockSuppliesCatalogState = {
  items: [] as any[],
  hydrated: false,
  loading: false,
  refreshing: false,
  error: null as string | null,
  isFromCache: false,
  lastSyncedAt: null as string | null,
}

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }))
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
jest.mock('../../lib/cleaningConsumablesDraft', () => ({
  deleteCleaningConsumablesPhoto: jest.fn(),
  enqueueCleaningConsumablesMediaCleanup: jest.fn(async () => {}),
  getCleaningConsumablesDraft: jest.fn(async () => null),
  isLocalCleaningConsumablesPhotoUri: jest.fn((value: any) => String(value || '').startsWith('file://')),
  persistCompressedCleaningConsumablesPhoto: jest.fn(async () => ({ localUri: 'file:///photo.jpg', name: 'photo.jpg', mimeType: 'image/jpeg' })),
  setCleaningConsumablesDraft: jest.fn(async () => {}),
}))
jest.mock('../../lib/cleaningConsumablesSubmitQueue', () => ({
  enqueueAndProcessCleaningConsumablesSubmit: jest.fn(async () => ({ processed: 1, remaining: 0, succeeded_task_ids: ['cleaning-1'] })),
  subscribeCleaningConsumablesSubmitQueue: jest.fn(() => () => {}),
}))
jest.mock('../../lib/storage', () => ({ getJson: jest.fn(async () => null), setJson: jest.fn(async () => {}), remove: jest.fn(async () => {}) }))
jest.mock('../../lib/useSuppliesCatalogStore', () => ({
  ensureSuppliesCatalogLoaded: jest.fn(async () => {}),
  retrySuppliesCatalog: jest.fn(async () => {}),
  useSuppliesCatalogStore: () => mockSuppliesCatalogState,
}))
jest.mock('../../lib/api', () => ({
  getCleaningConsumables: jest.fn(async () => ({ items: [] })),
  isRetryableApiError: jest.fn(() => false),
  submitCleaningConsumables: jest.fn(async () => ({})),
  uploadCleaningMedia: jest.fn(async () => ({ url: 'https://example.test/photo.jpg' })),
}))
jest.mock('../../components/ui/ResponsiveImageGrid', () => () => null)
jest.mock('../../components/ui/AppButton', () => (props: any) => {
  const mockReact = require('react')
  const { Pressable, Text } = require('react-native')
  return mockReact.createElement(
    Pressable,
    { onPress: props.onPress, disabled: props.disabled, testID: props.testID },
    mockReact.createElement(Text, { testID: props.testID ? `${props.testID}-label` : undefined }, props.label),
  )
})
jest.mock('../../components/ui/AppTextInput', () => (props: any) => {
  const mockReact = require('react')
  const { TextInput } = require('react-native')
  return mockReact.createElement(TextInput, props)
})

beforeEach(() => {
  jest.clearAllMocks()
  mockSuppliesCatalogState.items = []
  mockSuppliesCatalogState.hydrated = false
  mockSuppliesCatalogState.loading = false
  mockSuppliesCatalogState.refreshing = false
  mockSuppliesCatalogState.error = null
  mockSuppliesCatalogState.isFromCache = false
  mockSuppliesCatalogState.lastSyncedAt = null
  require('expo-image-picker').launchCameraAsync.mockResolvedValue({ canceled: true, assets: [] })
  require('../../lib/cleaningConsumablesDraft').persistCompressedCleaningConsumablesPhoto.mockResolvedValue({
    localUri: 'file:///photo.jpg',
    name: 'photo.jpg',
    mimeType: 'image/jpeg',
  })
})

function renderSuppliesForm(params: { taskId?: string; readOnly?: boolean } = {}) {
  const SuppliesFormScreen = require('./SuppliesFormScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }
  return render(
    <I18nProvider>
      <SuppliesFormScreen navigation={navigation} route={{ key: 'supplies', name: 'SuppliesForm', params: { taskId: params.taskId || 'w-supplies', ...(params.readOnly ? { readOnly: true } : {}) } }} />
    </I18nProvider>,
  )
}

test('任务执行人看到补品检查清单和缓存/弱网提示入口', async () => {
  const api = require('../../lib/api')
  const ui = renderSuppliesForm()

  await waitFor(() => {
    expect(ui.getByText('补品填报')).toBeTruthy()
    expect(ui.getByText('补品检查')).toBeTruthy()
    expect(ui.getByText(/消耗品照片会先保存在本机/)).toBeTruthy()
  })
  expect(api.getCleaningConsumables).toHaveBeenCalledWith('test-token', 'cleaning-1')
})

test('进入补品消耗页面先确认任务房号', async () => {
  const ui = renderSuppliesForm()

  await waitFor(() => {
    expect(ui.getByTestId('supplies-room-confirmation')).toBeTruthy()
    expect(ui.getByTestId('supplies-room-confirmation-code').props.children).toBe('TEST-1')
  })

  fireEvent.press(ui.getByText('房号正确，继续'))
  await waitFor(() => expect(ui.queryByTestId('supplies-room-confirmation')).toBeNull())
})

test('电视与空调遥控器只拍一张，电视遥控器仍为必拍项', async () => {
  const imagePicker = require('expo-image-picker')
  imagePicker.launchCameraAsync.mockResolvedValueOnce({
    canceled: false,
    assets: [{ uri: 'file:///remote-source.jpg', fileName: 'remote.jpg', mimeType: 'image/jpeg' }],
  })

  const ui = renderSuppliesForm()
  await waitFor(() => expect(ui.getByTestId('supplies-remote-photo')).toBeTruthy())
  expect(ui.getByText('电视与空调遥控器')).toBeTruthy()
  expect(ui.getByText('电视遥控器必须拍到；空调遥控器嵌在墙上时可不拍。')).toBeTruthy()

  fireEvent.press(ui.getByText('房号正确，继续'))
  fireEvent.press(ui.getByTestId('supplies-remote-photo'))

  await waitFor(() => expect(imagePicker.launchCameraAsync).toHaveBeenCalledTimes(1))
  expect(ui.getByText('已拍')).toBeTruthy()
})

test('厨房照片一次只拍一个待拍项目，取消后按钮可继续使用', async () => {
  const imagePicker = require('expo-image-picker')
  const draft = require('../../lib/cleaningConsumablesDraft')
  imagePicker.launchCameraAsync
    .mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///coffee-source.jpg', fileName: 'coffee.jpg', mimeType: 'image/jpeg' }] })
    .mockResolvedValueOnce({ canceled: true, assets: [] })
  draft.persistCompressedCleaningConsumablesPhoto.mockResolvedValueOnce({ localUri: 'file:///coffee.jpg', name: 'coffee.jpg', mimeType: 'image/jpeg' })

  const ui = renderSuppliesForm()
  await waitFor(() => expect(ui.getByTestId('supplies-kitchen-photo')).toBeTruthy())

  fireEvent.press(ui.getByTestId('supplies-kitchen-photo'))
  await waitFor(() => expect(imagePicker.launchCameraAsync).toHaveBeenCalledTimes(1))
  expect(ui.getAllByText('已拍')).toHaveLength(1)
  expect(ui.getByTestId('supplies-kitchen-photo-label').props.children).toBe('拍照')
  expect(ui.getByText('有 1 张照片待上传，点击“上传并保存”后上传。')).toBeTruthy()
  expect(ui.getByTestId('supplies-submit-label').props.children).toBe('上传并保存')

  fireEvent.press(ui.getByTestId('supplies-kitchen-photo'))
  await waitFor(() => expect(imagePicker.launchCameraAsync).toHaveBeenCalledTimes(2))
  expect(ui.getAllByText('已拍')).toHaveLength(1)
  expect(ui.getByTestId('supplies-kitchen-photo-label').props.children).toBe('拍照')
})

test('离线提交待同步时显示重试上传', async () => {
  const draft = require('../../lib/cleaningConsumablesDraft')
  draft.getCleaningConsumablesDraft.mockResolvedValueOnce({
    task_id: 'cleaning-1',
    updated_at: '2026-07-25T00:00:00.000Z',
    pending_submit: true,
    items: [],
    extra_photo_urls: {},
    photo_meta: {},
  })

  const ui = renderSuppliesForm()
  await waitFor(() => expect(ui.getByText('已离线保存，待联网自动同步照片和补品记录。')).toBeTruthy())
  expect(ui.getByTestId('supplies-submit-label').props.children).toBe('重试上传')
})

test('已有远端照片时显示已上传同步', async () => {
  const draft = require('../../lib/cleaningConsumablesDraft')
  draft.getCleaningConsumablesDraft.mockResolvedValueOnce({
    task_id: 'cleaning-1',
    updated_at: '2026-07-25T00:00:00.000Z',
    pending_submit: false,
    items: [],
    extra_photo_urls: { coffee_machine_photo: 'https://example.test/coffee.jpg' },
    photo_meta: {},
  })

  const ui = renderSuppliesForm()
  await waitFor(() => expect(ui.getByText('已有照片已上传并同步。')).toBeTruthy())
})

test('恢复只点过一项的草稿时，其余补品仍保持待确认', async () => {
  mockSuppliesCatalogState.items = [
    { id: 'shampoo', label: '洗发水', kind: 'consumable', required: true, requires_photo_when_low: false },
    { id: 'tissue', label: '纸巾', kind: 'consumable', required: true, requires_photo_when_low: false },
  ]
  mockSuppliesCatalogState.hydrated = true
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

  const ui = renderSuppliesForm()

  await waitFor(() => {
    expect(ui.getByText('1/2')).toBeTruthy()
    expect(ui.getAllByText('已确认足够')).toHaveLength(1)
    expect(ui.getByText('补充标准：不少于 1/3')).toBeTruthy()
  })
})

test('已完成补品任务可只读查看照片且没有编辑提交控件', async () => {
  const draft = require('../../lib/cleaningConsumablesDraft')
  draft.getCleaningConsumablesDraft.mockResolvedValueOnce({
    task_id: 'cleaning-1',
    updated_at: '2026-07-25T00:00:00.000Z',
    pending_submit: false,
    items: [],
    extra_photo_urls: { coffee_machine_photo: 'https://example.test/coffee.jpg' },
    photo_meta: {},
  })

  const ui = renderSuppliesForm({ readOnly: true })
  await waitFor(() => expect(ui.getByTestId('supplies-read-only-banner')).toBeTruthy())
  expect(ui.getByText('已有照片已上传并同步。')).toBeTruthy()
  expect(ui.queryByTestId('supplies-submit')).toBeNull()
  expect(ui.queryByTestId('supplies-kitchen-photo')).toBeNull()
})

test('厨房照片本地保存失败后解除拍照中状态', async () => {
  const imagePicker = require('expo-image-picker')
  const draft = require('../../lib/cleaningConsumablesDraft')
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  imagePicker.launchCameraAsync.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///coffee-source.jpg' }] })
  draft.persistCompressedCleaningConsumablesPhoto.mockRejectedValueOnce(new Error('保存失败'))

  const ui = renderSuppliesForm()
  await waitFor(() => expect(ui.getByTestId('supplies-kitchen-photo')).toBeTruthy())
  fireEvent.press(ui.getByTestId('supplies-kitchen-photo'))

  await waitFor(() => expect(ui.getByTestId('supplies-kitchen-photo-label').props.children).toBe('拍照'))
  expect(alertSpy).toHaveBeenCalled()
  alertSpy.mockRestore()
})
