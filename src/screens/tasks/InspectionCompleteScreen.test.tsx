import React from 'react'
import { Alert, StyleSheet } from 'react-native'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { I18nProvider } from '../../lib/i18n'

let mockQueueItems: any[] = []
let mockInspectionPanelQueueListener: (() => void) | null = null
const mockGetInspectionPanelBatch = jest.fn(async (_taskId?: string) => null)
const mockSnapshot: any = {
  items: [
    {
      id: 'w1',
      task_kind: 'inspection',
      source_type: 'cleaning_tasks',
      source_id: 'ct1',
      title: 'X 仅改密码',
      task_type: 'checkin_clean',
      inspection_scope: 'password_only',
      inspection_mode: 'same_day',
      status: 'to_hang_keys',
      end_time: '3pm',
      old_code: '1111',
      new_code: '2222',
      property: { id: 'p1', code: 'X' },
      available_actions: [
        {
          id: 'upload_access_video',
          label: '改密码并完成',
          placement: 'primary',
          enabled: true,
          target: 'InspectionComplete',
          intent: 'site_action',
        },
      ],
    },
  ],
}

function readyInspectionSnapshot(roomPhotoRequirement: 'required' | 'guest_arrival_confirmed' = 'required') {
  const roomPhotos = roomPhotoRequirement === 'guest_arrival_confirmed'
    ? { living: [], sofa: [], bedroom: [], kitchen: [], bathroom: [] }
    : {
        living: [{ id: 'living', uploaded_url: 'https://example.com/living.jpg' }],
        sofa: [{ id: 'sofa', uploaded_url: 'https://example.com/sofa.jpg' }],
        bedroom: [{ id: 'bedroom', uploaded_url: 'https://example.com/bedroom.jpg' }],
        kitchen: [{ id: 'kitchen', uploaded_url: 'https://example.com/kitchen.jpg' }],
        bathroom: [{ id: 'bathroom', uploaded_url: 'https://example.com/bathroom.jpg' }],
      }
  return {
    room_photo_requirement: roomPhotoRequirement,
    restock_confirmed_sufficient: true,
    restock: [],
    room_photos: roomPhotos,
    cleaning_issue: [],
  }
}

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

jest.mock('expo-av', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    ResizeMode: { CONTAIN: 'contain' },
    Video: (props: any) => React.createElement(View, { ...props, testID: 'video' }),
  }
})

jest.mock('expo-image-picker', () => ({
  UIImagePickerControllerQualityType: { High: 1 },
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
}))

jest.mock('../../lib/auth', () => ({
  useAuth: () => ({ token: 't1' }),
}))

jest.mock('../../lib/api', () => ({
  deleteLockboxVideo: jest.fn(async () => ({})),
  getInspectionPhotos: jest.fn(async () => ({ items: [], formal_submission: { status: 'none', submit_id: null, saved_at: null } })),
  uploadLockboxVideo: jest.fn(async () => ({})),
}))

jest.mock('../../lib/inspectionPanelSubmitQueue', () => ({
  bindInspectionPanelCleaningTaskId: jest.fn(async () => null),
  getInspectionPanelBatch: mockGetInspectionPanelBatch,
  resolveInspectionPanelBatch: jest.fn(async (params: any) => ({
    item: await mockGetInspectionPanelBatch(params.task_id),
    matched_by: 'display_task_id',
    ambiguous_count: 0,
  })),
  getInspectionPanelVideoReadiness: jest.fn((batch: any) => ({
    ready: !!batch?.snapshot,
    reason: batch?.snapshot ? null : '请先提交本页检查与补充，确保照片已保存到本机。',
    skipInspectionPhotos: batch?.snapshot?.room_photo_requirement === 'guest_arrival_confirmed',
  })),
  subscribeInspectionPanelSubmitQueue: jest.fn((listener: () => void) => {
    mockInspectionPanelQueueListener = listener
    return () => {
      if (mockInspectionPanelQueueListener === listener) mockInspectionPanelQueueListener = null
    }
  }),
}))

jest.mock('../../lib/inspectionMediaQueue', () => ({
  enqueueInspectionMediaItem: jest.fn(async () => ({})),
  listInspectionMediaQueueItemsForTask: jest.fn(async () => mockQueueItems),
  processInspectionMediaQueue: jest.fn(async () => ({})),
  removeInspectionMediaItem: jest.fn(async () => {}),
  subscribeInspectionMediaQueue: jest.fn(() => () => {}),
  updateInspectionMediaItem: jest.fn(async () => {}),
}))

jest.mock('../../lib/workTasksStore', () => ({
  getWorkTasksSnapshot: () => mockSnapshot,
  patchWorkTaskItem: jest.fn(async () => {}),
}))

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
	const api = require('../../lib/api')
	;(api.deleteLockboxVideo as jest.Mock).mockReset().mockResolvedValue({})
	;(api.getInspectionPhotos as jest.Mock).mockReset().mockResolvedValue({ items: [], formal_submission: { status: 'none', submit_id: null, saved_at: null } })
	;(api.uploadLockboxVideo as jest.Mock).mockReset().mockResolvedValue({})
	const mediaQueue = require('../../lib/inspectionMediaQueue')
	;(mediaQueue.enqueueInspectionMediaItem as jest.Mock).mockReset().mockResolvedValue({})
	;(mediaQueue.listInspectionMediaQueueItemsForTask as jest.Mock).mockReset().mockImplementation(async () => mockQueueItems)
	;(mediaQueue.processInspectionMediaQueue as jest.Mock).mockReset().mockResolvedValue({ processed: 0, remaining: 1 })
	;(mediaQueue.removeInspectionMediaItem as jest.Mock).mockReset().mockResolvedValue(undefined)
	;(mediaQueue.updateInspectionMediaItem as jest.Mock).mockReset().mockResolvedValue(undefined)
	  mockInspectionPanelQueueListener = null
	  const queue = require('../../lib/inspectionPanelSubmitQueue')
	  ;(queue.getInspectionPanelBatch as jest.Mock).mockResolvedValue(null)
	  ;(queue.resolveInspectionPanelBatch as jest.Mock).mockImplementation(async (params: any) => ({
	    item: await queue.getInspectionPanelBatch(params.task_id),
	    matched_by: 'display_task_id',
	    ambiguous_count: 0,
	  }))
	  mockQueueItems = [
	    {
	      id: 'q1',
	      task_id: 'ct1',
      kind: 'lockbox_video',
      local_uri: '',
      uploaded_url: 'https://example.com/video.mov',
      business_saved: false,
      upload_status: 'uploaded',
	      created_at: '2026-07-03T00:00:00.000Z',
	    },
	  ]
	mockSnapshot.items[0].source_id = 'ct1'
  mockSnapshot.items[0].title = 'X 仅改密码'
	mockSnapshot.items[0].task_kind = 'inspection'
	mockSnapshot.items[0].task_type = 'checkin_clean'
	mockSnapshot.items[0].inspection_mode = 'same_day'
  mockSnapshot.items[0].inspection_scope = 'password_only'
	delete mockSnapshot.items[0].source_key_handover_completed
	delete mockSnapshot.items[0].lockbox_video_url
	  mockSnapshot.items[0].available_actions = [
    {
      id: 'upload_access_video',
      label: '改密码并完成',
      placement: 'primary',
      enabled: true,
      target: 'InspectionComplete',
      intent: 'site_action',
    },
	  ]
	})

test('self-complete cleaner can record this task key handover without inspection batch', async () => {
  const queue = require('../../lib/inspectionPanelSubmitQueue')
  mockQueueItems = []
  mockSnapshot.items[0] = {
    ...mockSnapshot.items[0],
    title: 'LA910 自完成',
    task_kind: 'cleaning',
    task_type: 'checkout_clean',
    inspection_mode: 'self_complete',
    inspection_scope: 'inspect_and_hang',
    source_key_handover_completed: false,
    lockbox_video_url: 'https://example.invalid/related-task-lockbox.mp4',
    available_actions: [{
      id: 'upload_access_video',
      label: '挂钥匙并完成',
      placement: 'primary',
      enabled: true,
      target: 'InspectionComplete',
      intent: 'site_action',
      source_id: 'ct1',
    }],
  }
  const navigation = { goBack: jest.fn(), navigate: jest.fn(), addListener: jest.fn(() => () => {}) }
  const InspectionCompleteScreen = require('./InspectionCompleteScreen').default as React.ComponentType<any>

  const ui = render(
    <I18nProvider>
      <InspectionCompleteScreen
        navigation={navigation as any}
        route={{ key: 'self-complete-key-handover', name: 'InspectionComplete', params: { taskId: 'w1', sourceId: 'ct1', skipInspectionPhotos: true } } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByText('这是自完成任务的挂钥匙步骤；补品和清洁资料已单独保存，无需重复检查照片。')).toBeTruthy())
  expect(queue.getInspectionPanelBatch).not.toHaveBeenCalled()
  expect(ui.getByTestId('inspection-complete-upload-video').props.disabled).not.toBe(true)
  expect(ui.getByText('拍视频并上传')).toBeTruthy()
  expect(ui.queryByText('视频已同步')).toBeNull()
  expect(ui.queryByText('进入检查与补充')).toBeNull()
})

test('uploaded object awaiting business save still plays the preserved local video', async () => {
  mockQueueItems[0] = {
    ...mockQueueItems[0], local_uri: 'file:///synthetic/pending-video.mov',
    uploaded_url: 'https://synthetic.r2.dev/cleaning/pending-video.mov', business_saved: false,
  }
  const Screen = require('./InspectionCompleteScreen').default as React.ComponentType<any>
  const ui = render(<I18nProvider><Screen navigation={{ goBack: jest.fn(), navigate: jest.fn(), addListener: jest.fn(() => () => {}) }} route={{ key: 'pending-business-save', name: 'InspectionComplete', params: { taskId: 'w1' } }} /></I18nProvider>)
  await waitFor(() => expect(ui.getByTestId('video').props.source).toEqual({ uri: 'file:///synthetic/pending-video.mov' }))
  expect(require('../../lib/inspectionMediaQueue').removeInspectionMediaItem).not.toHaveBeenCalled()
})

function mockNextQueueProcessingAsSaved(finalizationPending = false) {
  const mediaQueue = require('../../lib/inspectionMediaQueue')
  ;(mediaQueue.processInspectionMediaQueue as jest.Mock).mockImplementationOnce(async () => {
    mockQueueItems = mockQueueItems.map((item) => ({
      ...item,
      upload_status: 'uploaded',
      business_saved: true,
      business_saved_at: '2026-09-24T00:00:00.000Z',
      last_error: null,
      meta: { ...(item.meta || {}), business_finalization_pending: finalizationPending },
    }))
    return { processed: 1, remaining: 0 }
  })
}

test('inspection queue event refreshes silently without restoring the blocking validation state', async () => {
  const queue = require('../../lib/inspectionPanelSubmitQueue')
  ;(queue.getInspectionPanelBatch as jest.Mock).mockResolvedValue({
    task_id: 'w1',
    cleaning_task_id: 'ct1',
    status: 'synced',
    snapshot: { ...readyInspectionSnapshot(), cleaning_task_id: 'ct1' },
  })
  mockSnapshot.items[0].title = 'X 检查后挂钥匙'
  mockSnapshot.items[0].inspection_scope = 'inspect_and_hang'
  mockSnapshot.items[0].available_actions = [{ id: 'upload_access_video', enabled: true, target: 'InspectionComplete' }]
  const navigation = { goBack: jest.fn(), navigate: jest.fn(), addListener: jest.fn(() => () => {}) }
  const InspectionCompleteScreen = require('./InspectionCompleteScreen').default as React.ComponentType<any>

  const ui = render(
    <I18nProvider>
      <InspectionCompleteScreen
        navigation={navigation as any}
        route={{ key: 'inspection-complete-silent-refresh', name: 'InspectionComplete', params: { taskId: 'w1' } } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByText('检查与补充已同步完成。')).toBeTruthy())
  expect(mockInspectionPanelQueueListener).toEqual(expect.any(Function))

  await act(async () => {
    mockInspectionPanelQueueListener?.()
  })

  await waitFor(() => expect(queue.getInspectionPanelBatch).toHaveBeenCalledTimes(2))
  expect(ui.queryByText(/正在校验检查与补充状态/)).toBeNull()
  expect(ui.queryByText('加载中...')).toBeNull()
})

test('replacement video is queued before the old pending local video is removed', async () => {
  const imagePicker = require('expo-image-picker')
  const mediaQueue = require('../../lib/inspectionMediaQueue')
  mockQueueItems = [{
    id: 'q-old',
    task_id: 'ct1',
    kind: 'lockbox_video',
    local_uri: 'file:///private/old.mov',
    uploaded_url: '',
    business_saved: false,
    upload_status: 'pending',
    created_at: '2026-08-17T00:00:00.000Z',
  }]
  ;(imagePicker.launchCameraAsync as jest.Mock).mockResolvedValueOnce({
    canceled: false,
    assets: [{ uri: 'file:///private/new.mov', fileName: 'new.mov', mimeType: 'video/quicktime' }],
  })
  ;(mediaQueue.enqueueInspectionMediaItem as jest.Mock).mockClear().mockResolvedValueOnce({
    id: 'q-new', task_id: 'ct1', kind: 'lockbox_video', local_uri: 'file:///private/queued-new.mov', upload_status: 'pending', business_saved: false,
  })
  ;(mediaQueue.removeInspectionMediaItem as jest.Mock).mockClear().mockResolvedValueOnce(undefined)
  const navigation = { goBack: jest.fn(), navigate: jest.fn(), addListener: jest.fn(() => () => {}) }
  const InspectionCompleteScreen = require('./InspectionCompleteScreen').default as React.ComponentType<any>

  const ui = render(
    <I18nProvider>
      <InspectionCompleteScreen
        navigation={navigation as any}
        route={{ key: 'inspection-complete-replace-video', name: 'InspectionComplete', params: { taskId: 'w1', skipInspectionPhotos: true } } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByTestId('inspection-complete-upload-video').props.accessibilityState?.disabled).toBe(false))
  fireEvent.press(ui.getByTestId('inspection-complete-upload-video'))

  await waitFor(() => expect(mediaQueue.removeInspectionMediaItem).toHaveBeenCalledWith('q-old'))
  expect(mediaQueue.enqueueInspectionMediaItem.mock.invocationCallOrder[0]).toBeLessThan(mediaQueue.removeInspectionMediaItem.mock.invocationCallOrder[0])
})

test('failed replacement enqueue keeps the old pending local video', async () => {
  const imagePicker = require('expo-image-picker')
  const mediaQueue = require('../../lib/inspectionMediaQueue')
  mockQueueItems = [{
    id: 'q-old',
    task_id: 'ct1',
    kind: 'lockbox_video',
    local_uri: 'file:///private/old.mov',
    uploaded_url: '',
    business_saved: false,
    upload_status: 'pending',
    created_at: '2026-08-17T00:00:00.000Z',
  }]
  ;(imagePicker.launchCameraAsync as jest.Mock).mockResolvedValueOnce({
    canceled: false,
    assets: [{ uri: 'file:///private/new.mov', fileName: 'new.mov', mimeType: 'video/quicktime' }],
  })
  ;(mediaQueue.enqueueInspectionMediaItem as jest.Mock).mockClear().mockRejectedValueOnce(new Error('新视频本机保存失败'))
  ;(mediaQueue.removeInspectionMediaItem as jest.Mock).mockClear()
  const navigation = { goBack: jest.fn(), navigate: jest.fn(), addListener: jest.fn(() => () => {}) }
  const InspectionCompleteScreen = require('./InspectionCompleteScreen').default as React.ComponentType<any>

  const ui = render(
    <I18nProvider>
      <InspectionCompleteScreen
        navigation={navigation as any}
        route={{ key: 'inspection-complete-replace-video-failed', name: 'InspectionComplete', params: { taskId: 'w1', skipInspectionPhotos: true } } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByTestId('inspection-complete-upload-video').props.accessibilityState?.disabled).toBe(false))
  fireEvent.press(ui.getByTestId('inspection-complete-upload-video'))

  await waitFor(() => expect(mediaQueue.enqueueInspectionMediaItem).toHaveBeenCalled())
  expect(mediaQueue.removeInspectionMediaItem).not.toHaveBeenCalled()
  expect(Alert.alert).toHaveBeenCalledWith(expect.any(String), '新视频本机保存失败')
})

test('password-only access video completion does not require inspection panel batch', async () => {
  const api = require('../../lib/api')
  const mediaQueue = require('../../lib/inspectionMediaQueue')
  const navigation = { goBack: jest.fn(), navigate: jest.fn(), addListener: jest.fn(() => () => {}) }
  const InspectionCompleteScreen = require('./InspectionCompleteScreen').default as React.ComponentType<any>

  const ui = render(
    <I18nProvider>
      <InspectionCompleteScreen
        navigation={navigation as any}
        route={{ key: 'inspection-complete', name: 'InspectionComplete', params: { taskId: 'w1', skipInspectionPhotos: true } } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText(/无需重复检查照片或消耗品确认/)).toBeTruthy()
    expect(ui.queryByText('进入检查与补充')).toBeNull()
    expect(ui.getByText(/视频文件已上传/)).toBeTruthy()
  })

  for (const testID of ['inspection-complete-upload-video', 'inspection-complete-submit']) {
    expect(StyleSheet.flatten(ui.getByTestId(testID).props.style)).toEqual(expect.objectContaining({
      flex: 1,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
    }))
  }

  ;(mediaQueue.processInspectionMediaQueue as jest.Mock).mockClear()
  mockNextQueueProcessingAsSaved()
  fireEvent.press(ui.getByText('改密码完成'))

  await waitFor(() => {
    expect(mediaQueue.processInspectionMediaQueue).toHaveBeenCalledWith('t1')
    expect(api.uploadLockboxVideo).not.toHaveBeenCalled()
    expect(Alert.alert).toHaveBeenCalledWith(expect.any(String), '视频已提交，任务已完成')
  })
})

test('uploaded video business-save failure shows the real save error instead of an offline message', async () => {
  mockQueueItems[0].last_error = '保存任务超时'
  const navigation = { goBack: jest.fn(), navigate: jest.fn(), addListener: jest.fn(() => () => {}) }
  const InspectionCompleteScreen = require('./InspectionCompleteScreen').default as React.ComponentType<any>

  const ui = render(
    <I18nProvider>
      <InspectionCompleteScreen
        navigation={navigation as any}
        route={{ key: 'inspection-complete-save-error', name: 'InspectionComplete', params: { taskId: 'w1', skipInspectionPhotos: true } } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText(/视频文件已上传，但任务记录保存失败：保存任务超时/)).toBeTruthy()
    expect(ui.queryByText(/联网恢复后/)).toBeNull()
  })
})

	test('server disabled upload_access_video blocks completion screen submit', async () => {
  const api = require('../../lib/api')
  ;(api.uploadLockboxVideo as jest.Mock).mockClear()
  mockSnapshot.items[0].available_actions = [
    {
      id: 'upload_access_video',
      label: '改密码并完成',
      placement: 'primary',
      enabled: false,
      disabled_reason: 'not_participant',
      target: 'InspectionComplete',
      intent: 'site_action',
    },
  ]
  const navigation = { goBack: jest.fn(), navigate: jest.fn(), addListener: jest.fn(() => () => {}) }
  const InspectionCompleteScreen = require('./InspectionCompleteScreen').default as React.ComponentType<any>

  const ui = render(
    <I18nProvider>
      <InspectionCompleteScreen
        navigation={navigation as any}
        route={{ key: 'inspection-complete-denied', name: 'InspectionComplete', params: { taskId: 'w1', skipInspectionPhotos: true } } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText('暂不可操作：你已不再是执行人')).toBeTruthy()
  })

  fireEvent.press(ui.getByText('改密码完成'))

	  expect(api.uploadLockboxVideo).not.toHaveBeenCalled()
	  expect(navigation.goBack).not.toHaveBeenCalled()
	})

		test('access video completion uses route sourceId when work task source_id is not the action target', async () => {
		  const api = require('../../lib/api')
		  const mediaQueue = require('../../lib/inspectionMediaQueue')
	  mockSnapshot.items[0].source_id = 'ct-wrong-from-merged-card'
	  mockQueueItems[0].task_id = 'ct-action-target'
	  const navigation = { goBack: jest.fn(), navigate: jest.fn(), addListener: jest.fn(() => () => {}) }
	  const InspectionCompleteScreen = require('./InspectionCompleteScreen').default as React.ComponentType<any>

	  const ui = render(
	    <I18nProvider>
	      <InspectionCompleteScreen
	        navigation={navigation as any}
	        route={{ key: 'inspection-complete-target', name: 'InspectionComplete', params: { taskId: 'w1', sourceId: 'ct-action-target', skipInspectionPhotos: true } } as any}
	      />
	    </I18nProvider>,
	  )

	  await waitFor(() => {
	    expect(ui.getByText(/视频文件已上传/)).toBeTruthy()
		  })

		  ;(mediaQueue.processInspectionMediaQueue as jest.Mock).mockClear()
		  mockNextQueueProcessingAsSaved()
		  fireEvent.press(ui.getByText('改密码完成'))

		  await waitFor(() => {
		    expect(mediaQueue.listInspectionMediaQueueItemsForTask).toHaveBeenCalledWith('ct-action-target', ['lockbox_video'])
		    expect(mediaQueue.processInspectionMediaQueue).toHaveBeenCalledWith('t1')
		    expect(api.uploadLockboxVideo).not.toHaveBeenCalled()
		  })
		})

test('non-password inspection can finish access video while inspection photos are still pending sync', async () => {
  const api = require('../../lib/api')
  const mediaQueue = require('../../lib/inspectionMediaQueue')
  const queue = require('../../lib/inspectionPanelSubmitQueue')
  ;(queue.getInspectionPanelBatch as jest.Mock).mockResolvedValue({
    status: 'pending_submit',
    last_error: '已保存到本机，等待任务信息刷新后自动同步。',
    snapshot: readyInspectionSnapshot(),
  })
  mockSnapshot.items[0].title = 'X 检查后挂钥匙'
  mockSnapshot.items[0].source_id = 'ct-merged-source'
  mockSnapshot.items[0].inspection_scope = 'inspect_and_hang'
  mockSnapshot.items[0].available_actions = [
    {
      id: 'submit_inspection',
      label: '检查与补充',
      placement: 'primary',
      enabled: true,
      target: 'InspectionPanel',
      intent: 'inspection',
      source_id: 'ct-inspection-target',
    },
    {
      id: 'upload_access_video',
      label: '标记已完成',
      placement: 'primary',
      enabled: true,
      target: 'InspectionComplete',
      intent: 'inspection',
      source_id: 'ct-video-target',
    },
  ]
  mockQueueItems[0].task_id = 'ct-video-target'
  const navigation = { goBack: jest.fn(), navigate: jest.fn(), addListener: jest.fn(() => () => {}) }
  const InspectionCompleteScreen = require('./InspectionCompleteScreen').default as React.ComponentType<any>

  const ui = render(
    <I18nProvider>
      <InspectionCompleteScreen
        navigation={navigation as any}
        route={{ key: 'inspection-complete-pending', name: 'InspectionComplete', params: { taskId: 'w1' } } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText(/检查与补充照片已完整保存到本机/)).toBeTruthy()
    expect(ui.getByText(/视频文件已上传/)).toBeTruthy()
  })

  fireEvent.press(ui.getByText('进入检查与补充'))
  expect(navigation.navigate).toHaveBeenCalledWith('InspectionPanel', { taskId: 'w1', sourceId: 'ct-inspection-target' })

  ;(mediaQueue.processInspectionMediaQueue as jest.Mock).mockClear()
  mockNextQueueProcessingAsSaved()
  fireEvent.press(ui.getByText('提交视频（任务待完成）'))

  await waitFor(() => {
    expect(mediaQueue.processInspectionMediaQueue).toHaveBeenCalledWith('t1')
    expect(api.uploadLockboxVideo).not.toHaveBeenCalled()
    expect(Alert.alert).toHaveBeenCalledWith(expect.any(String), '视频已提交，检查照片待同步，任务尚未完成。')
  })
})

test('non-password inspection can leave with a locally queued video while offline', async () => {
  const api = require('../../lib/api')
  const mediaQueue = require('../../lib/inspectionMediaQueue')
  ;(api.uploadLockboxVideo as jest.Mock).mockClear()
  mockSnapshot.items[0].title = 'X 弱网视频提交'
  mockSnapshot.items[0].source_id = 'ct-offline-video'
  mockSnapshot.items[0].inspection_scope = 'inspect_and_hang'
  mockSnapshot.items[0].available_actions = [
    {
      id: 'upload_access_video',
      label: '标记已完成',
      placement: 'primary',
      enabled: true,
      target: 'InspectionComplete',
      intent: 'inspection',
      source_id: 'ct-offline-video',
    },
  ]
  mockQueueItems[0] = {
    id: 'q-offline',
    task_id: 'ct-offline-video',
    kind: 'lockbox_video',
    local_uri: 'file:///private/video.mov',
    uploaded_url: '',
    upload_status: 'pending',
    business_saved: false,
    created_at: '2026-07-23T00:00:00.000Z',
  }
  const queue = require('../../lib/inspectionPanelSubmitQueue')
  ;(queue.getInspectionPanelBatch as jest.Mock).mockResolvedValue({
    status: 'pending_submit',
    snapshot: readyInspectionSnapshot(),
  })
  const navigation = { goBack: jest.fn(), navigate: jest.fn(), addListener: jest.fn(() => () => {}) }
  const InspectionCompleteScreen = require('./InspectionCompleteScreen').default as React.ComponentType<any>

  const ui = render(
    <I18nProvider>
      <InspectionCompleteScreen
        navigation={navigation as any}
        route={{ key: 'inspection-complete-offline', name: 'InspectionComplete', params: { taskId: 'w1' } } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText(/视频已保存到本机/)).toBeTruthy()
    expect(ui.getByText('视频状态：已保存本机 · 待上传')).toBeTruthy()
    expect(ui.getByText('删除本机待上传视频')).toBeTruthy()
    expect(ui.queryByText('删除已上传视频')).toBeNull()
    expect(ui.getByText('提交视频（任务待完成）')).toBeTruthy()
  })

  fireEvent.press(ui.getByText('提交视频（任务待完成）'))

  await waitFor(() => {
    expect(mediaQueue.processInspectionMediaQueue).toHaveBeenCalledWith('t1')
    expect(api.uploadLockboxVideo).not.toHaveBeenCalled()
    expect(Alert.alert).toHaveBeenCalledWith(expect.any(String), '视频已安全保存在本机，系统会继续上传并自动保存任务记录。')
    expect(navigation.goBack).toHaveBeenCalled()
  })
})

test('blocks ordinary inspection video until the local photo batch is ready', async () => {
  const imagePicker = require('expo-image-picker')
  imagePicker.requestCameraPermissionsAsync.mockClear()
  mockSnapshot.items[0].inspection_scope = 'inspect_and_hang'
  mockSnapshot.items[0].available_actions = [{ id: 'upload_access_video', enabled: true, target: 'InspectionComplete' }]
  const navigation = { goBack: jest.fn(), navigate: jest.fn(), addListener: jest.fn(() => () => {}) }
  const InspectionCompleteScreen = require('./InspectionCompleteScreen').default as React.ComponentType<any>

  const ui = render(
    <I18nProvider>
      <InspectionCompleteScreen
        navigation={navigation as any}
        route={{ key: 'inspection-complete-gate', name: 'InspectionComplete', params: { taskId: 'w1' } } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText(/服务器尚未确认本任务正式检查批次/)).toBeTruthy()
    expect(ui.getByText('先完成检查与补充')).toBeTruthy()
  })

  expect(imagePicker.requestCameraPermissionsAsync).not.toHaveBeenCalled()
})

test('guest-arrival-confirmed batch can proceed to video without room photos', async () => {
  const api = require('../../lib/api')
  const mediaQueue = require('../../lib/inspectionMediaQueue')
  const queue = require('../../lib/inspectionPanelSubmitQueue')
  ;(queue.getInspectionPanelBatch as jest.Mock).mockResolvedValue({
    status: 'pending_submit',
    snapshot: readyInspectionSnapshot('guest_arrival_confirmed'),
  })
  mockSnapshot.items[0].title = 'X 客人已到达'
  mockSnapshot.items[0].source_id = 'ct-guest-arrival'
  mockSnapshot.items[0].inspection_scope = 'inspect_and_hang'
  mockSnapshot.items[0].available_actions = [{ id: 'upload_access_video', enabled: true, target: 'InspectionComplete' }]
  mockQueueItems[0].task_id = 'ct-guest-arrival'
  const navigation = { goBack: jest.fn(), navigate: jest.fn(), addListener: jest.fn(() => () => {}) }
  const InspectionCompleteScreen = require('./InspectionCompleteScreen').default as React.ComponentType<any>

  const ui = render(
    <I18nProvider>
      <InspectionCompleteScreen
        navigation={navigation as any}
        route={{ key: 'inspection-complete-guest-arrival', name: 'InspectionComplete', params: { taskId: 'w1' } } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByText(/检查与补充照片已完整保存到本机/)).toBeTruthy())
  ;(mediaQueue.processInspectionMediaQueue as jest.Mock).mockClear()
  mockNextQueueProcessingAsSaved()
  fireEvent.press(ui.getByText('提交视频（任务待完成）'))

  await waitFor(() => {
    expect(mediaQueue.processInspectionMediaQueue).toHaveBeenCalledWith('t1')
    expect(api.uploadLockboxVideo).not.toHaveBeenCalled()
  })
})

test('accepts an exact formal server inspection submission when the local batch is unavailable', async () => {
  const api = require('../../lib/api')
  const queue = require('../../lib/inspectionPanelSubmitQueue')
  mockSnapshot.items[0].title = 'MSQ4504E 检查'
  mockSnapshot.items[0].source_id = 'source-msq4504e-fixture'
  mockSnapshot.items[0].inspection_scope = 'inspect_and_hang'
  mockSnapshot.items[0].available_actions = [
    { id: 'submit_inspection', enabled: true, target: 'InspectionPanel' },
    { id: 'upload_access_video', enabled: true, target: 'InspectionComplete' },
  ]
  ;(queue.resolveInspectionPanelBatch as jest.Mock).mockResolvedValue({
    item: null,
    matched_by: 'none',
    ambiguous_count: 0,
  })
  ;(api.getInspectionPhotos as jest.Mock).mockResolvedValue({
    items: [
      { id: 'photo-living', category: 'living', url: 'https://example.com/living.jpg' },
      { id: 'photo-sofa', category: 'sofa', url: 'https://example.com/sofa.jpg' },
      { id: 'photo-bedroom-1', category: 'bedroom', url: 'https://example.com/bedroom-1.jpg' },
      { id: 'photo-bedroom-2', category: 'bedroom', url: 'https://example.com/bedroom-2.jpg' },
      { id: 'photo-bedroom-3', category: 'bedroom', url: 'https://example.com/bedroom-3.jpg' },
      { id: 'photo-bedroom-4', category: 'bedroom', url: 'https://example.com/bedroom-4.jpg' },
    ],
    formal_submission: {
      status: 'submitted',
      submit_id: 'inspection-batch-msq4504e-fixture',
      saved_at: '2026-10-24T00:39:02.000Z',
      guest_arrival_confirmed: false,
    },
  })
  const navigation = { goBack: jest.fn(), navigate: jest.fn(), addListener: jest.fn(() => () => {}) }
  const InspectionCompleteScreen = require('./InspectionCompleteScreen').default as React.ComponentType<any>

  const ui = render(
    <I18nProvider>
      <InspectionCompleteScreen
        navigation={navigation as any}
        route={{ key: 'inspection-complete-server-recovery', name: 'InspectionComplete', params: { taskId: 'w1' } } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(api.getInspectionPhotos).toHaveBeenCalledWith('t1', 'source-msq4504e-fixture')
    expect(ui.getByTestId('inspection-server-submission-ready')).toBeTruthy()
    expect(ui.getByText('服务器已确认本任务正式检查批次，可继续拍摄视频')).toBeTruthy()
    expect(ui.getByTestId('inspection-complete-upload-video').props.accessibilityState?.disabled).toBe(false)
  })
})

test('keeps a local draft authoritative over an older formal server submission', async () => {
  const api = require('../../lib/api')
  const queue = require('../../lib/inspectionPanelSubmitQueue')
  mockSnapshot.items[0].inspection_scope = 'inspect_and_hang'
  mockSnapshot.items[0].available_actions = [
    { id: 'submit_inspection', enabled: true, target: 'InspectionPanel' },
    { id: 'upload_access_video', enabled: true, target: 'InspectionComplete' },
  ]
  ;(queue.resolveInspectionPanelBatch as jest.Mock).mockResolvedValue({
    item: { status: 'draft', snapshot: { room_photos: {}, restock: [] } },
    matched_by: 'source_task_id',
    ambiguous_count: 0,
  })
  ;(queue.getInspectionPanelVideoReadiness as jest.Mock).mockReturnValue({
    ready: false,
    reason: '本机有尚未提交的新检查内容。',
    skipInspectionPhotos: false,
  })
  ;(api.getInspectionPhotos as jest.Mock).mockResolvedValue({
    items: [{ id: 'server-photo', category: 'living', url: 'https://example.com/server.jpg' }],
    formal_submission: {
      status: 'submitted',
      submit_id: 'older-formal-submit',
      saved_at: '2026-10-24T00:39:02.000Z',
    },
  })
  const navigation = { goBack: jest.fn(), navigate: jest.fn(), addListener: jest.fn(() => () => {}) }
  const InspectionCompleteScreen = require('./InspectionCompleteScreen').default as React.ComponentType<any>

  const ui = render(
    <I18nProvider>
      <InspectionCompleteScreen
        navigation={navigation as any}
        route={{ key: 'inspection-complete-local-draft', name: 'InspectionComplete', params: { taskId: 'w1' } } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText(/本机有尚未提交的新检查内容/)).toBeTruthy()
    expect(ui.queryByTestId('inspection-server-submission-ready')).toBeNull()
    expect(ui.getByTestId('inspection-complete-upload-video').props.accessibilityState?.disabled).toBe(true)
  })
})

test('fails closed when multiple local inspection rounds match the same source task', async () => {
  const api = require('../../lib/api')
  const queue = require('../../lib/inspectionPanelSubmitQueue')
  mockSnapshot.items[0].inspection_scope = 'inspect_and_hang'
  mockSnapshot.items[0].available_actions = [
    { id: 'submit_inspection', enabled: true, target: 'InspectionPanel' },
    { id: 'upload_access_video', enabled: true, target: 'InspectionComplete' },
  ]
  ;(queue.resolveInspectionPanelBatch as jest.Mock).mockResolvedValue({
    item: null,
    matched_by: 'ambiguous',
    ambiguous_count: 2,
  })
  ;(api.getInspectionPhotos as jest.Mock).mockResolvedValue({
    items: [{ id: 'server-photo', category: 'living', url: 'https://example.com/server.jpg' }],
    formal_submission: {
      status: 'submitted',
      submit_id: 'formal-submit',
      saved_at: '2026-10-24T00:39:02.000Z',
    },
  })
  const navigation = { goBack: jest.fn(), navigate: jest.fn(), addListener: jest.fn(() => () => {}) }
  const InspectionCompleteScreen = require('./InspectionCompleteScreen').default as React.ComponentType<any>

  const ui = render(
    <I18nProvider>
      <InspectionCompleteScreen
        navigation={navigation as any}
        route={{ key: 'inspection-complete-ambiguous-rounds', name: 'InspectionComplete', params: { taskId: 'w1' } } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText(/本机存在多个同源检查批次/)).toBeTruthy()
    expect(ui.queryByTestId('inspection-server-submission-ready')).toBeNull()
    expect(ui.getByTestId('inspection-complete-upload-video').props.accessibilityState?.disabled).toBe(true)
  })
})

test('fails closed when the exact local display batch conflicts with the current source', async () => {
  const api = require('../../lib/api')
  const queue = require('../../lib/inspectionPanelSubmitQueue')
  ;(queue.bindInspectionPanelCleaningTaskId as jest.Mock).mockClear()
  mockSnapshot.items[0].inspection_scope = 'inspect_and_hang'
  mockSnapshot.items[0].available_actions = [
    { id: 'submit_inspection', enabled: true, target: 'InspectionPanel' },
    { id: 'upload_access_video', enabled: true, target: 'InspectionComplete' },
  ]
  ;(queue.resolveInspectionPanelBatch as jest.Mock).mockResolvedValue({
    item: null,
    matched_by: 'conflict',
    ambiguous_count: 1,
  })
  ;(api.getInspectionPhotos as jest.Mock).mockResolvedValue({
    items: [{ area: 'living', url: 'https://example.com/server.jpg' }],
    formal_submission: {
      status: 'submitted',
      submit_id: 'formal-submit-conflict-fixture',
      saved_at: '2026-10-24T00:39:02.000Z',
    },
  })
  const navigation = { goBack: jest.fn(), navigate: jest.fn(), addListener: jest.fn(() => () => {}) }
  const InspectionCompleteScreen = require('./InspectionCompleteScreen').default as React.ComponentType<any>

  const ui = render(
    <I18nProvider>
      <InspectionCompleteScreen
        navigation={navigation as any}
        route={{ key: 'inspection-complete-source-conflict', name: 'InspectionComplete', params: { taskId: 'w1' } } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText(/本机检查批次与当前任务来源不一致/)).toBeTruthy()
    expect(ui.queryByTestId('inspection-server-submission-ready')).toBeNull()
    expect(ui.getByTestId('inspection-complete-upload-video').props.accessibilityState?.disabled).toBe(true)
    expect(queue.bindInspectionPanelCleaningTaskId).not.toHaveBeenCalled()
  })
})
