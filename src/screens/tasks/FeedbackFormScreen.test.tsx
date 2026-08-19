import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { Image, StyleSheet } from 'react-native'
import { I18nProvider } from '../../lib/i18n'

let mockUser = { id: 'inspector-1', username: 'inspector', role: 'cleaning_inspector', roles: ['cleaning_inspector'] }

jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }))
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }))
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
}))
jest.mock('../../lib/auth', () => ({ useAuth: () => ({ token: 'test-token', user: mockUser }) }))
jest.mock('../../lib/workTasksStore', () => ({
  getWorkTasksSnapshot: () => ({ items: [{ id: 'w-feedback', task_kind: 'inspection', source_type: 'cleaning_tasks', source_id: 'cleaning-1', title: '测试房源反馈', property: { id: 'property-1', code: 'TEST-1', address: '测试地址' } }] }),
}))
jest.mock('../../lib/storage', () => ({ getJson: jest.fn(async () => null), setJson: jest.fn(async () => {}), remove: jest.fn(async () => {}) }))
jest.mock('../../lib/inspectionPanelFeedbackDraft', () => ({
  clearInspectionPanelFeedbackDraft: jest.fn(async () => {}),
  getInspectionPanelFeedbackDraft: jest.fn(async () => null),
  setInspectionPanelFeedbackDraft: jest.fn(async () => {}),
}))
jest.mock('../../lib/localMediaDrafts', () => ({
  deleteDraftMedia: jest.fn(),
  draftFileExists: jest.fn(() => true),
  draftMimeTypeFrom: jest.fn(() => 'image/jpeg'),
  persistCompressedDraftMedia: jest.fn(async () => ({ localUri: 'file:///feedback.jpg', name: 'feedback.jpg', mimeType: 'image/jpeg' })),
}))
jest.mock('../../lib/cleaningMediaCache', () => ({
  loadCleaningMediaImage: jest.fn(async () => ({ uri: null, failure: null })),
}))
jest.mock('../../lib/api', () => ({
  completePropertyFeedbackProject: jest.fn(async () => ({})),
  createPropertyFeedback: jest.fn(async () => ({})),
  createPropertyFeedbackBatch: jest.fn(async () => ({})),
  createPropertyFeedbackProject: jest.fn(async () => ({})),
  deletePropertyFeedback: jest.fn(async () => ({})),
  listDailyNecessityOptions: jest.fn(async () => []),
  listPropertyFeedbacks: jest.fn(async () => []),
  movePropertyFeedback: jest.fn(async () => ({})),
  updatePropertyFeedback: jest.fn(async () => ({})),
  updatePropertyFeedbackProject: jest.fn(async () => ({})),
  uploadCleaningMedia: jest.fn(async () => ({ key: 'cleaning/feedback.jpg', url: 'https://example.test/feedback.jpg' })),
}))

test('检查人员可进入房源反馈并选择维修类型', async () => {
  const FeedbackFormScreen = require('./FeedbackFormScreen').default as React.ComponentType<any>
  const navigation = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }
  const ui = render(
    <I18nProvider>
      <FeedbackFormScreen navigation={navigation} route={{ key: 'feedback', name: 'FeedbackForm', params: { taskId: 'w-feedback' } }} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText('选择反馈类型')).toBeTruthy()
    expect(ui.getByText('请先选择反馈类型')).toBeTruthy()
  })

  fireEvent.press(ui.getAllByText('房源维修')[0])
  await waitFor(() => {
    expect(ui.getByText('维修记录 1')).toBeTruthy()
    expect(ui.getByText('问题区域')).toBeTruthy()
  })

  const cameraButton = ui.getByRole('button', { name: '拍照上传' })
  const libraryButton = ui.getByRole('button', { name: '相册选择' })
  const resolvePressableStyle = (node: any) => StyleSheet.flatten(typeof node.props.style === 'function' ? node.props.style({ pressed: false }) : node.props.style)
  expect(resolvePressableStyle(cameraButton)).toMatchObject({ flex: 1, minWidth: 0, minHeight: 44 })
  expect(resolvePressableStyle(libraryButton)).toMatchObject({ flex: 1, minWidth: 0, minHeight: 44 })
})

test('清洁和检查人员都能查看同一任务房源已报问题', async () => {
  const FeedbackFormScreen = require('./FeedbackFormScreen').default as React.ComponentType<any>
  const { listPropertyFeedbacks } = require('../../lib/api') as { listPropertyFeedbacks: jest.Mock }
  listPropertyFeedbacks.mockResolvedValue([{
    id: 'feedback-1',
    property_id: 'property-1',
    kind: 'maintenance',
    area: '客厅',
    detail: '水龙头漏水',
    media_urls: [],
    created_at: '2026-08-04T00:00:00.000Z',
    status: 'open',
  }])

  const renderForRole = async (role: string) => {
    mockUser = { id: `${role}-1`, username: role, role, roles: [role] }
    const ui = render(
      <I18nProvider>
        <FeedbackFormScreen navigation={{ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }} route={{ key: `feedback-${role}`, name: 'FeedbackForm', params: { taskId: 'w-feedback', source: 'inspection_panel_batch' } }} />
      </I18nProvider>,
    )
    await waitFor(() => {
      expect(ui.getByText('本房源历史反馈')).toBeTruthy()
      expect(ui.getByText('客厅：水龙头漏水')).toBeTruthy()
    })
    expect(listPropertyFeedbacks).toHaveBeenCalledWith('test-token', expect.objectContaining({ property_id: 'property-1' }))
    expect(listPropertyFeedbacks.mock.calls.some(([, params]) => Object.prototype.hasOwnProperty.call(params, 'source_task_id'))).toBe(false)
    ui.unmount()
  }

  await renderForRole('cleaner')
  listPropertyFeedbacks.mockClear()
  await renderForRole('cleaning_inspector')
  mockUser = { id: 'inspector-1', username: 'inspector', role: 'cleaning_inspector', roles: ['cleaning_inspector'] }
})

test('检查批次反馈照片会持久化稳定 media id 供提交队列续传', async () => {
  const FeedbackFormScreen = require('./FeedbackFormScreen').default as React.ComponentType<any>
  const imagePicker = require('expo-image-picker') as { launchCameraAsync: jest.Mock }
  const panelDraft = require('../../lib/inspectionPanelFeedbackDraft') as { setInspectionPanelFeedbackDraft: jest.Mock }
  imagePicker.launchCameraAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///inspection-feedback-picked.jpg', fileName: 'inspection-feedback.jpg', mimeType: 'image/jpeg' }],
  })
  const ui = render(
    <I18nProvider>
      <FeedbackFormScreen navigation={{ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }} route={{ key: 'inspection-feedback-media-id', name: 'FeedbackForm', params: { taskId: 'w-feedback', source: 'inspection_panel_batch' } }} />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByText('选择反馈类型')).toBeTruthy())
  fireEvent.press(ui.getAllByText('房源维修')[0])
  fireEvent.press(ui.getByText('客厅'))
  fireEvent.changeText(ui.getByPlaceholderText('请描述问题'), '水龙头松动')
  fireEvent.press(ui.getByRole('button', { name: '拍照上传' }))

  await waitFor(() => expect(panelDraft.setInspectionPanelFeedbackDraft).toHaveBeenCalledWith(
    'w-feedback',
    expect.objectContaining({
      photo_meta: expect.objectContaining({
        'file:///feedback.jpg': expect.objectContaining({ media_id: expect.stringMatching(/^feedback-/) }),
      }),
    }),
  ))
})

test('历史反馈操作入口只按服务端 capability 显示', async () => {
  const FeedbackFormScreen = require('./FeedbackFormScreen').default as React.ComponentType<any>
  const { listPropertyFeedbacks } = require('../../lib/api') as { listPropertyFeedbacks: jest.Mock }
  listPropertyFeedbacks.mockResolvedValue([{
    id: 'feedback-capability-1',
    property_id: 'property-1',
    kind: 'daily_necessities',
    item_name: '纸巾',
    quantity: 1,
    detail: '纸巾不足',
    media_urls: [],
    created_at: '2026-08-06T00:00:00.000Z',
    status: 'need_replace',
    capabilities: { can_edit_content: true, can_delete: false, can_move_category: false },
  }])
  const ui = render(
    <I18nProvider>
      <FeedbackFormScreen navigation={{ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }} route={{ key: 'feedback-capability', name: 'FeedbackForm', params: { taskId: 'w-feedback' } }} />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByRole('button', { name: '编辑反馈记录' })).toBeTruthy())
  expect(ui.queryByRole('button', { name: '调整反馈类型' })).toBeNull()
  expect(ui.queryByRole('button', { name: '删除反馈记录' })).toBeNull()
})

test('历史反馈加载失败时隐藏后端细节并允许重试', async () => {
  const FeedbackFormScreen = require('./FeedbackFormScreen').default as React.ComponentType<any>
  const { listPropertyFeedbacks } = require('../../lib/api') as { listPropertyFeedbacks: jest.Mock }
  const rawError = 'property_feedbacks_failed: maintenance:column m.feedback_source does not exist'
  listPropertyFeedbacks.mockRejectedValueOnce(new Error(rawError))
  const ui = render(
    <I18nProvider>
      <FeedbackFormScreen navigation={{ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }} route={{ key: 'feedback-error', name: 'FeedbackForm', params: { taskId: 'w-feedback' } }} />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText('历史反馈暂时无法加载，请稍后重试。')).toBeTruthy()
  })
  expect(ui.queryByText(rawError)).toBeNull()

  const callsBeforeRetry = listPropertyFeedbacks.mock.calls.length
  listPropertyFeedbacks.mockResolvedValue([])
  fireEvent.press(ui.getByRole('button', { name: '重新加载历史反馈' }))
  await waitFor(() => {
    expect(listPropertyFeedbacks.mock.calls.length).toBe(callsBeforeRetry + 3)
  })
})

test('反馈照片先保留本地副本，上传失败可重试且完成提交不重复创建反馈或项目', async () => {
  const FeedbackFormScreen = require('./FeedbackFormScreen').default as React.ComponentType<any>
  const imagePicker = require('expo-image-picker') as { launchCameraAsync: jest.Mock }
  const localMedia = require('../../lib/localMediaDrafts') as { persistCompressedDraftMedia: jest.Mock }
  const api = require('../../lib/api') as {
    completePropertyFeedbackProject: jest.Mock
    createPropertyFeedback: jest.Mock
    createPropertyFeedbackProject: jest.Mock
    uploadCleaningMedia: jest.Mock
  }
  imagePicker.launchCameraAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///picked.jpg', fileName: 'picked.jpg', mimeType: 'image/jpeg' }],
  })
  localMedia.persistCompressedDraftMedia
    .mockResolvedValueOnce({ localUri: 'file:///feedback-before.jpg', name: 'feedback-before.jpg', mimeType: 'image/jpeg' })
    .mockResolvedValueOnce({ localUri: 'file:///feedback-after.jpg', name: 'feedback-after.jpg', mimeType: 'image/jpeg' })
  api.uploadCleaningMedia
    .mockRejectedValueOnce(new Error('temporary_network_failure'))
    .mockResolvedValue({ key: 'cleaning/feedback.jpg', url: 'https://example.test/feedback.jpg' })
  api.createPropertyFeedback.mockResolvedValue({ existing_id: 'feedback-1' })
  api.createPropertyFeedbackProject.mockResolvedValue({ item: { id: 'project-1' } })
  api.completePropertyFeedbackProject.mockRejectedValueOnce(new Error('temporary_network_failure')).mockResolvedValue({ ok: true })

  const ui = render(
    <I18nProvider>
      <FeedbackFormScreen navigation={{ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }} route={{ key: 'feedback-complete', name: 'FeedbackForm', params: { taskId: 'w-feedback' } }} />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByText('选择反馈类型')).toBeTruthy())
  fireEvent.press(ui.getAllByText('房源维修')[0])
  fireEvent.press(ui.getByText('客厅'))
  fireEvent.changeText(ui.getByPlaceholderText('请描述问题'), '水龙头松动')
  fireEvent.press(ui.getByText('已完成'))

  fireEvent.press(ui.getAllByRole('button', { name: '拍照上传' })[0])
  await waitFor(() => expect(localMedia.persistCompressedDraftMedia).toHaveBeenCalledTimes(1))
  expect(api.uploadCleaningMedia).not.toHaveBeenCalled()
  const imageSources = ui.UNSAFE_getAllByType(Image).map((node) => node.props.source)
  expect(imageSources).toContainEqual({ uri: 'file:///feedback-before.jpg' })

  fireEvent.press(ui.getAllByRole('button', { name: '拍照上传' })[1])
  await waitFor(() => expect(localMedia.persistCompressedDraftMedia).toHaveBeenCalledTimes(2))
  fireEvent.press(ui.getByText('提交记录'))
  await waitFor(() => expect(api.uploadCleaningMedia).toHaveBeenCalledTimes(1))
  expect(api.createPropertyFeedback).not.toHaveBeenCalled()
  expect(ui.UNSAFE_getAllByType(Image).map((node) => node.props.source)).toContainEqual({ uri: 'file:///feedback-before.jpg' })
  await waitFor(() => expect(ui.getByText('提交记录').parent?.props.disabled).toBeFalsy())

  fireEvent.press(ui.getByText('提交记录'))
  await waitFor(() => expect(api.uploadCleaningMedia).toHaveBeenCalledTimes(3))
  await waitFor(() => expect(api.completePropertyFeedbackProject).toHaveBeenCalledTimes(1))
  expect(api.uploadCleaningMedia).toHaveBeenLastCalledWith(
    'test-token',
    expect.objectContaining({ uri: 'file:///feedback-after.jpg', mimeType: 'image/jpeg' }),
    expect.objectContaining({ purpose: 'feedback', task_id: 'cleaning-1', media_id: expect.any(String) }),
    { skipImageCompression: true },
  )
  expect(api.createPropertyFeedback).toHaveBeenCalledWith('test-token', expect.objectContaining({ source_task_id: 'cleaning-1' }))
  expect(api.completePropertyFeedbackProject).toHaveBeenCalledWith('test-token', 'maintenance', 'feedback-1', 'project-1', expect.objectContaining({ source_task_id: 'cleaning-1' }))

  await waitFor(() => expect(ui.getByText('提交记录').parent?.props.disabled).toBeFalsy())
  fireEvent.press(ui.getByText('提交记录'))
  await waitFor(() => expect(api.completePropertyFeedbackProject).toHaveBeenCalledTimes(2))
  expect(api.uploadCleaningMedia).toHaveBeenCalledTimes(3)
  expect(api.createPropertyFeedback).toHaveBeenCalledTimes(1)
  expect(api.createPropertyFeedbackProject).toHaveBeenCalledTimes(1)
})

test('私有反馈照片全屏预览不提供浏览器打开入口', async () => {
  const FeedbackFormScreen = require('./FeedbackFormScreen').default as React.ComponentType<any>
  const { listPropertyFeedbacks } = require('../../lib/api') as { listPropertyFeedbacks: jest.Mock }
  listPropertyFeedbacks.mockResolvedValue([{
    id: 'feedback-photo-1',
    property_id: 'property-1',
    kind: 'maintenance',
    area: '客厅',
    detail: '水龙头漏水',
    media_urls: ['cleaning/feedback-photo.jpg'],
    created_at: '2026-08-07T00:00:00.000Z',
    status: 'open',
  }])
  const ui = render(
    <I18nProvider>
      <FeedbackFormScreen navigation={{ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }} route={{ key: 'feedback-photo', name: 'FeedbackForm', params: { taskId: 'w-feedback' } }} />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByRole('button', { name: '查看反馈照片' })).toBeTruthy())
  fireEvent.press(ui.getByRole('button', { name: '查看反馈照片' }))
  await waitFor(() => expect(ui.getByText('关闭')).toBeTruthy())
  expect(ui.queryByText('浏览器打开')).toBeNull()
})

test('历史深清照片在反馈列表通过认证代理并保留当前任务上下文', async () => {
  const FeedbackFormScreen = require('./FeedbackFormScreen').default as React.ComponentType<any>
  const { listPropertyFeedbacks } = require('../../lib/api') as { listPropertyFeedbacks: jest.Mock }
  listPropertyFeedbacks.mockResolvedValue([{
    id: 'deep-cleaning-photo-1',
    property_id: 'property-1',
    kind: 'deep_cleaning',
    areas: ['浴室'],
    detail: '历史深清照片',
    media_urls: ['deep-cleaning/before-photo.jpg'],
    repair_photo_urls: ['https://media.r2.dev/deep-cleaning-upload/after-photo.jpg'],
    created_at: '2026-08-17T00:00:00.000Z',
    status: 'open',
  }])
  const ui = render(
    <I18nProvider>
      <FeedbackFormScreen navigation={{ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }} route={{ key: 'deep-cleaning-photo', name: 'FeedbackForm', params: { taskId: 'w-feedback' } }} />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByRole('button', { name: '查看反馈照片' })).toBeTruthy())
  expect(ui.UNSAFE_getAllByType(Image).some((image) => String(image.props.source?.uri || '').includes('key=deep-cleaning%2Fbefore-photo.jpg&variant=thumbnail&source_task_id=cleaning-1'))).toBe(true)
})

test('历史维修的已保存完工照片会在反馈详情通过认证代理显示', async () => {
  const FeedbackFormScreen = require('./FeedbackFormScreen').default as React.ComponentType<any>
  const { listPropertyFeedbacks } = require('../../lib/api') as { listPropertyFeedbacks: jest.Mock }
  listPropertyFeedbacks.mockResolvedValue([{
    id: 'feedback-completion-photo-1',
    property_id: 'property-1',
    kind: 'maintenance',
    area: '厨房',
    detail: '洗碗机不排水',
    repair_photo_urls: ['mzapp/maintenance-completion.jpg'],
    created_at: '2026-08-08T00:00:00.000Z',
    status: 'resolved',
    review_status: 'pending',
  }])
  const ui = render(
    <I18nProvider>
      <FeedbackFormScreen navigation={{ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }} route={{ key: 'feedback-completion-photo', name: 'FeedbackForm', params: { taskId: 'w-feedback' } }} />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByText('已完成待复核')).toBeTruthy())
  fireEvent.press(ui.getByText('展开'))
  await waitFor(() => expect(ui.getByRole('button', { name: '查看反馈详情' })).toBeTruthy())
  fireEvent.press(ui.getByRole('button', { name: '查看反馈详情' }))
  await waitFor(() => expect(ui.getByText('维修后照片')).toBeTruthy())
  expect(ui.UNSAFE_getAllByType(Image).some((image) => String(image.props.source?.uri || '').includes('key=mzapp%2Fmaintenance-completion.jpg'))).toBe(true)
})

test('日用品更换前后照片在反馈详情都通过认证代理显示', async () => {
  const FeedbackFormScreen = require('./FeedbackFormScreen').default as React.ComponentType<any>
  const { listPropertyFeedbacks } = require('../../lib/api') as { listPropertyFeedbacks: jest.Mock }
  listPropertyFeedbacks.mockResolvedValue([{
    id: 'daily-replacement-photo-1',
    property_id: 'property-1',
    kind: 'daily_necessities',
    item_name: '卷纸',
    quantity: 1,
    detail: '需要补货',
    media_urls: ['inventory/daily-before.jpg'],
    repair_photo_urls: ['inventory/daily-after.jpg'],
    created_at: '2026-08-17T00:00:00.000Z',
    status: 'replaced',
  }])
  const ui = render(
    <I18nProvider>
      <FeedbackFormScreen navigation={{ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }} route={{ key: 'daily-replacement-photo', name: 'FeedbackForm', params: { taskId: 'w-feedback' } }} />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByText('展开')).toBeTruthy())
  fireEvent.press(ui.getByText('展开'))
  await waitFor(() => expect(ui.getByRole('button', { name: '查看反馈详情' })).toBeTruthy())
  fireEvent.press(ui.getByRole('button', { name: '查看反馈详情' }))
  await waitFor(() => expect(ui.getByText('更换后照片')).toBeTruthy())
  const imageUris = ui.UNSAFE_getAllByType(Image).map((image) => String(image.props.source?.uri || ''))
  expect(imageUris.some((uri) => uri.includes('key=inventory%2Fdaily-before.jpg'))).toBe(true)
  expect(imageUris.some((uri) => uri.includes('key=inventory%2Fdaily-after.jpg'))).toBe(true)
})
