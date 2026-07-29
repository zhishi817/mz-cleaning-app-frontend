import React from 'react'
import { Alert } from 'react-native'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { I18nProvider } from '../../lib/i18n'

let mockQueueItems: any[] = []
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
  uploadLockboxVideo: jest.fn(async () => ({})),
}))

jest.mock('../../lib/inspectionPanelSubmitQueue', () => ({
  bindInspectionPanelCleaningTaskId: jest.fn(async () => null),
  getInspectionPanelBatch: jest.fn(async () => null),
  getInspectionPanelVideoReadiness: jest.fn((batch: any) => ({
    ready: !!batch?.snapshot,
    reason: batch?.snapshot ? null : '请先提交本页检查与补充，确保照片已保存到本机。',
    skipInspectionPhotos: batch?.snapshot?.room_photo_requirement === 'guest_arrival_confirmed',
  })),
  subscribeInspectionPanelSubmitQueue: jest.fn(() => () => {}),
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
	  const queue = require('../../lib/inspectionPanelSubmitQueue')
	  ;(queue.getInspectionPanelBatch as jest.Mock).mockResolvedValue(null)
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
  mockSnapshot.items[0].inspection_scope = 'password_only'
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

test('password-only access video completion does not require inspection panel batch', async () => {
  const api = require('../../lib/api')
  ;(api.uploadLockboxVideo as jest.Mock).mockClear()
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

  fireEvent.press(ui.getByText('改密码完成'))

  await waitFor(() => {
    expect(api.uploadLockboxVideo).toHaveBeenCalledWith('t1', 'ct1', { media_url: 'https://example.com/video.mov' })
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
	  ;(api.uploadLockboxVideo as jest.Mock).mockClear()
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

	  fireEvent.press(ui.getByText('改密码完成'))

	  await waitFor(() => {
	    expect(api.uploadLockboxVideo).toHaveBeenCalledWith('t1', 'ct-action-target', { media_url: 'https://example.com/video.mov' })
	  })
	})

test('non-password inspection can finish access video while inspection photos are still pending sync', async () => {
  const api = require('../../lib/api')
  const queue = require('../../lib/inspectionPanelSubmitQueue')
  ;(api.uploadLockboxVideo as jest.Mock).mockClear()
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

  fireEvent.press(ui.getByText('提交视频（任务待完成）'))

  await waitFor(() => {
    expect(api.uploadLockboxVideo).toHaveBeenCalledWith('t1', 'ct-video-target', { media_url: 'https://example.com/video.mov' })
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
    expect(ui.getByText('提交视频（任务待完成）')).toBeTruthy()
  })

  fireEvent.press(ui.getByText('提交视频（任务待完成）'))

  await waitFor(() => {
    expect(mediaQueue.processInspectionMediaQueue).toHaveBeenCalledWith('t1')
    expect(api.uploadLockboxVideo).not.toHaveBeenCalled()
    expect(Alert.alert).toHaveBeenCalledWith(expect.any(String), '视频已保存到本机，任务记录尚未保存；请点击完成重试。')
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
    expect(ui.getByText(/请先提交本页检查与补充/)).toBeTruthy()
    expect(ui.getByText('先完成检查与补充')).toBeTruthy()
  })

  expect(imagePicker.requestCameraPermissionsAsync).not.toHaveBeenCalled()
})

test('guest-arrival-confirmed batch can proceed to video without room photos', async () => {
  const api = require('../../lib/api')
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
  fireEvent.press(ui.getByText('提交视频（任务待完成）'))

  await waitFor(() => {
    expect(api.uploadLockboxVideo).toHaveBeenCalledWith('t1', 'ct-guest-arrival', { media_url: 'https://example.com/video.mov' })
  })
})
