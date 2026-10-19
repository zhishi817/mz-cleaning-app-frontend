import React from 'react'
import { Alert } from 'react-native'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { I18nProvider } from '../../lib/i18n'

const mockSnapshot = {
  items: [
    {
      id: 'w-supplies',
      task_kind: 'cleaning',
      source_type: 'cleaning_tasks',
      source_id: 'cleaning-1',
      title: '测试房源补品',
      property: { id: 'property-1', code: 'TEST-1', address: '测试地址' },
    },
    {
      id: 'w-supplies-2',
      task_kind: 'cleaning',
      source_type: 'cleaning_tasks',
      source_id: 'cleaning-2',
      title: '第二个测试房源补品',
      property: { id: 'property-2', code: 'TEST-2', address: '第二个测试地址' },
    },
  ],
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

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return { promise, resolve, reject }
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
  mockSnapshot.items[0].source_id = 'cleaning-1'
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
  require('../../lib/cleaningConsumablesDraft').getCleaningConsumablesDraft.mockResolvedValue(null)
  require('../../lib/storage').getJson.mockResolvedValue(null)
  require('../../lib/api').getCleaningConsumables.mockResolvedValue({ items: [] })
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
}, 15_000)

test('进入补品消耗页面先确认任务房号', async () => {
  const api = require('../../lib/api')
  const ui = renderSuppliesForm()

  await waitFor(() => {
    expect(ui.getByTestId('supplies-room-confirmation')).toBeTruthy()
    expect(ui.getByTestId('supplies-room-confirmation-code').props.children).toBe('TEST-1')
  })
  await waitFor(() => expect(api.getCleaningConsumables).toHaveBeenCalledWith('test-token', 'cleaning-1'))
  await waitFor(() => expect(ui.getByTestId('supplies-room-confirm').props.accessibilityState?.disabled).toBeFalsy())

  fireEvent.press(ui.getByTestId('supplies-room-confirm'))
  await waitFor(() => expect(ui.queryByTestId('supplies-room-confirmation')).toBeNull())
})

test('MZ048 新任务只显示三个按顺序的厨房收纳拍照项', async () => {
  const ui = renderSuppliesForm()

  await waitFor(() => expect(ui.getByText('刀叉勺抽屉')).toBeTruthy())
  expect(ui.getByText('厨房用品抽屉')).toBeTruthy()
  expect(ui.getByText('杯子、碗碟柜')).toBeTruthy()
  expect(ui.queryByText('咖啡机')).toBeNull()
  expect(ui.queryByText('烧水壶')).toBeNull()
  expect(ui.queryByText('面包机')).toBeNull()
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
  expect(draft.persistCompressedCleaningConsumablesPhoto).toHaveBeenCalledWith(
    'file:///coffee-source.jpg',
    'coffee.jpg',
    'image/jpeg',
    'cutlery_drawer_photo_v2',
  )
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

test('MZ048 恢复旧草稿时固定旧模板并保留旧照片 key', async () => {
  const api = require('../../lib/api')
  const draft = require('../../lib/cleaningConsumablesDraft')
  draft.getCleaningConsumablesDraft.mockResolvedValueOnce({
    task_id: 'cleaning-1',
    updated_at: '2026-10-18T00:00:00.000Z',
    pending_submit: false,
    submit_status: 'draft',
    items: [],
    extra_photo_urls: { coffee_machine_photo: 'file:///legacy-coffee.jpg' },
    photo_meta: {},
  })

  const ui = renderSuppliesForm()
  await waitFor(() => expect(ui.getByText('咖啡机')).toBeTruthy())
  expect(ui.queryByText('刀叉勺抽屉')).toBeNull()
  expect(api.getCleaningConsumables).not.toHaveBeenCalled()
  expect(ui.getByTestId('supplies-room-confirm').props.accessibilityState?.disabled).toBeFalsy()
  await waitFor(() => expect(draft.setCleaningConsumablesDraft).toHaveBeenCalledWith(
    'cleaning-1',
    expect.objectContaining({
      scene_photo_template_version: 'kitchen_appliances_v1',
      extra_photo_urls: expect.objectContaining({ coffee_machine_photo: 'file:///legacy-coffee.jpg' }),
    }),
  ))
})

test('MZ048 有缓存时可离线进入且旧服务端记录返回后合并已拍新照片', async () => {
  const api = require('../../lib/api')
  const draft = require('../../lib/cleaningConsumablesDraft')
  const imagePicker = require('expo-image-picker')
  const storage = require('../../lib/storage')
  const localDraft = deferred<any>()
  const remoteRecord = deferred<any>()
  const firstDraftWrite = deferred<any>()
  draft.getCleaningConsumablesDraft.mockReturnValueOnce(localDraft.promise)
  storage.getJson.mockImplementation(async (key: string) => (
    key === 'supplies_record_cleaning-1' ? { living_room_photo_url: null, items: [] } : null
  ))
  draft.setCleaningConsumablesDraft.mockImplementationOnce(() => firstDraftWrite.promise)
  api.getCleaningConsumables.mockReturnValueOnce(remoteRecord.promise)
  imagePicker.launchCameraAsync.mockResolvedValueOnce({
    canceled: false,
    assets: [{ uri: 'file:///new-cutlery-source.jpg', fileName: 'new-cutlery.jpg', mimeType: 'image/jpeg' }],
  })
  draft.persistCompressedCleaningConsumablesPhoto.mockResolvedValueOnce({
    localUri: 'file:///new-cutlery.jpg',
    name: 'new-cutlery.jpg',
    mimeType: 'image/jpeg',
  })

  const ui = renderSuppliesForm()
  expect(ui.getByTestId('supplies-room-confirm').props.accessibilityState?.disabled).toBe(true)
  expect(api.getCleaningConsumables).not.toHaveBeenCalled()

  await act(async () => {
    localDraft.resolve(null)
  })
  await waitFor(() => expect(api.getCleaningConsumables).toHaveBeenCalledWith('test-token', 'cleaning-1'))
  await waitFor(() => expect(ui.getByTestId('supplies-room-confirm').props.accessibilityState?.disabled).toBeFalsy())
  fireEvent.press(ui.getByTestId('supplies-room-confirm'))
  await waitFor(() => expect(ui.queryByTestId('supplies-room-confirmation')).toBeNull())
  fireEvent.press(ui.getByTestId('supplies-kitchen-photo'))
  await waitFor(() => expect(draft.persistCompressedCleaningConsumablesPhoto).toHaveBeenCalledWith(
    'file:///new-cutlery-source.jpg',
    'new-cutlery.jpg',
    'image/jpeg',
    'cutlery_drawer_photo_v2',
  ))
  await waitFor(() => expect(draft.setCleaningConsumablesDraft).toHaveBeenCalledTimes(1))

  await act(async () => {
    remoteRecord.resolve({
      items: [{ item_id: 'coffee_machine_photo', photo_url: 'https://example.test/legacy-coffee.jpg' }],
    })
  })
  await waitFor(() => {
    expect(ui.getByText('咖啡机')).toBeTruthy()
  })
  expect(ui.queryByText('刀叉勺抽屉')).toBeNull()
  expect(draft.setCleaningConsumablesDraft).toHaveBeenCalledTimes(1)
  await act(async () => {
    firstDraftWrite.resolve(null)
  })
  await waitFor(() => expect(draft.setCleaningConsumablesDraft).toHaveBeenCalledWith(
    'cleaning-1',
    expect.objectContaining({
      scene_photo_template_version: 'kitchen_appliances_v1',
      extra_photo_urls: expect.objectContaining({
        coffee_machine_photo: 'https://example.test/legacy-coffee.jpg',
        cutlery_drawer_photo_v2: 'file:///new-cutlery.jpg',
      }),
    }),
  ))
})

test('MZ048 无草稿或缓存时必须成功读取线上清单后才能确认房号', async () => {
  const api = require('../../lib/api')
  api.getCleaningConsumables
    .mockRejectedValueOnce(new Error('network unavailable'))
    .mockResolvedValueOnce({ items: [] })

  const ui = renderSuppliesForm()

  await waitFor(() => expect(api.getCleaningConsumables).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(ui.getByText('无法在线确认该任务使用的新旧拍照清单，请联网后重试；不会覆盖已有照片。')).toBeTruthy())
  expect(ui.getByTestId('supplies-room-confirm-label').props.children).toBe('重新联网确认')
  expect(ui.getByTestId('supplies-room-confirm').props.accessibilityState?.disabled).toBeFalsy()
  expect(ui.getByTestId('supplies-room-confirmation')).toBeTruthy()

  fireEvent.press(ui.getByTestId('supplies-room-confirm'))
  await waitFor(() => expect(api.getCleaningConsumables).toHaveBeenCalledTimes(2))
  await waitFor(() => expect(ui.getByTestId('supplies-room-confirm-label').props.children).toBe('房号正确，继续'))
  expect(ui.getByTestId('supplies-room-confirm').props.accessibilityState?.disabled).toBeFalsy()
  expect(ui.getByTestId('supplies-room-confirmation')).toBeTruthy()

  fireEvent.press(ui.getByTestId('supplies-room-confirm'))
  await waitFor(() => expect(ui.queryByTestId('supplies-room-confirmation')).toBeNull())
})

test('MZ048 畸形缓存不能绕过首次联网确认门', async () => {
  const api = require('../../lib/api')
  const storage = require('../../lib/storage')
  storage.getJson.mockResolvedValueOnce({ living_room_photo_url: null, items: [{}] })
  api.getCleaningConsumables.mockRejectedValueOnce(new Error('network unavailable'))

  const ui = renderSuppliesForm()

  await waitFor(() => expect(api.getCleaningConsumables).toHaveBeenCalledWith('test-token', 'cleaning-1'))
  await waitFor(() => expect(ui.getByText('无法在线确认该任务使用的新旧拍照清单，请联网后重试；不会覆盖已有照片。')).toBeTruthy())
  expect(ui.getByTestId('supplies-room-confirm-label').props.children).toBe('重新联网确认')
  expect(ui.getByTestId('supplies-room-confirmation')).toBeTruthy()
})

test('MZ048 畸形线上响应不能解除首次联网确认门或写入缓存', async () => {
  const api = require('../../lib/api')
  const storage = require('../../lib/storage')
  api.getCleaningConsumables.mockResolvedValueOnce({ living_room_photo_url: null, items: [null] })

  const ui = renderSuppliesForm()

  await waitFor(() => expect(api.getCleaningConsumables).toHaveBeenCalledWith('test-token', 'cleaning-1'))
  await waitFor(() => expect(ui.getByText('无法在线确认该任务使用的新旧拍照清单，请联网后重试；不会覆盖已有照片。')).toBeTruthy())
  expect(ui.getByTestId('supplies-room-confirm-label').props.children).toBe('重新联网确认')
  expect(storage.setJson).not.toHaveBeenCalled()
})

test('MZ048 切换任务后旧请求迟到失败不会污染新任务进入门', async () => {
  const api = require('../../lib/api')
  const staleRemote = deferred<any>()
  api.getCleaningConsumables.mockImplementation((_token: string, taskId: string) => (
    taskId === 'cleaning-1' ? staleRemote.promise : Promise.resolve({ items: [] })
  ))
  const SuppliesFormScreen = require('./SuppliesFormScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }
  const screen = (taskId: string) => (
    <I18nProvider>
      <SuppliesFormScreen navigation={navigation} route={{ key: `supplies-${taskId}`, name: 'SuppliesForm', params: { taskId } }} />
    </I18nProvider>
  )
  const ui = render(screen('w-supplies'))
  await waitFor(() => expect(api.getCleaningConsumables).toHaveBeenCalledWith('test-token', 'cleaning-1'))

  ui.rerender(screen('w-supplies-2'))
  await waitFor(() => expect(api.getCleaningConsumables).toHaveBeenCalledWith('test-token', 'cleaning-2'))
  await waitFor(() => expect(ui.getByTestId('supplies-room-confirm-label').props.children).toBe('房号正确，继续'))

  await act(async () => {
    staleRemote.reject(new Error('late failure'))
  })
  expect(ui.queryByText('无法在线确认该任务使用的新旧拍照清单，请联网后重试；不会覆盖已有照片。')).toBeNull()
  expect(ui.getByTestId('supplies-room-confirm-label').props.children).toBe('房号正确，继续')
})

test('MZ048 同一路由的真实任务 key 更新后重新显示联网确认门', async () => {
  const api = require('../../lib/api')
  const refreshedRemote = deferred<any>()
  api.getCleaningConsumables
    .mockResolvedValueOnce({ items: [] })
    .mockReturnValueOnce(refreshedRemote.promise)
  const SuppliesFormScreen = require('./SuppliesFormScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }
  const screen = () => (
    <I18nProvider>
      <SuppliesFormScreen navigation={navigation} route={{ key: 'supplies', name: 'SuppliesForm', params: { taskId: 'w-supplies' } }} />
    </I18nProvider>
  )
  const ui = render(screen())
  await waitFor(() => expect(ui.getByTestId('supplies-room-confirm-label').props.children).toBe('房号正确，继续'))
  fireEvent.press(ui.getByTestId('supplies-room-confirm'))
  await waitFor(() => expect(ui.queryByTestId('supplies-room-confirmation')).toBeNull())

  mockSnapshot.items[0].source_id = 'cleaning-1-refreshed'
  ui.rerender(screen())
  await waitFor(() => expect(api.getCleaningConsumables).toHaveBeenCalledWith('test-token', 'cleaning-1-refreshed'))
  expect(ui.getByTestId('supplies-room-confirmation')).toBeTruthy()
  expect(ui.getByTestId('supplies-room-confirm').props.accessibilityState?.disabled).toBe(true)

  await act(async () => {
    refreshedRemote.reject(new Error('network unavailable'))
  })
  await waitFor(() => expect(ui.getByTestId('supplies-room-confirm-label').props.children).toBe('重新联网确认'))
  expect(ui.getByTestId('supplies-room-confirmation')).toBeTruthy()
})

test('MZ048 本地草稿读取失败时保持锁定且不读取远端或自动保存', async () => {
  const api = require('../../lib/api')
  const draft = require('../../lib/cleaningConsumablesDraft')
  draft.getCleaningConsumablesDraft.mockRejectedValueOnce(new Error('storage unavailable'))

  const ui = renderSuppliesForm()
  await waitFor(() => expect(ui.getByText('本地补品草稿读取失败，请返回任务列表后重试。')).toBeTruthy())
  expect(ui.getByTestId('supplies-room-confirm').props.accessibilityState?.disabled).toBe(true)
  fireEvent.press(ui.getByTestId('supplies-room-confirm'))
  expect(ui.getByTestId('supplies-room-confirmation')).toBeTruthy()
  expect(api.getCleaningConsumables).not.toHaveBeenCalled()
  expect(draft.setCleaningConsumablesDraft).not.toHaveBeenCalled()
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
  expect(ui.getByText('咖啡机')).toBeTruthy()
  expect(ui.queryByText('刀叉勺抽屉')).toBeNull()
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
  await waitFor(() => expect(ui.getByTestId('supplies-room-confirm-label').props.children).toBe('房号正确，继续'))
  fireEvent.press(ui.getByTestId('supplies-room-confirm'))
  await waitFor(() => expect(ui.queryByTestId('supplies-room-confirmation')).toBeNull())
  fireEvent.press(ui.getByTestId('supplies-kitchen-photo'))

  await waitFor(() => expect(ui.getByTestId('supplies-kitchen-photo-label').props.children).toBe('拍照'))
  expect(alertSpy).toHaveBeenCalled()
  alertSpy.mockRestore()
})
