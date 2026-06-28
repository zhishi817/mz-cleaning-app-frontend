import React from 'react'
import { Alert } from 'react-native'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { I18nProvider } from '../../lib/i18n'

const mockAuthState = {
  token: 'local:test',
  user: { id: 'manager-1', username: 'admin-user', role: 'admin', roles: ['admin', 'offline_manager'] as string[] },
}

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true })),
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

jest.mock('../../lib/auth', () => ({
  useAuth: () => mockAuthState,
}))

jest.mock('../../lib/api', () => ({
  isRetryableApiError: jest.fn((error: any) => !!error?.retryable),
  listCleaningAppLinenTypes: jest.fn(async () => []),
  listCleaningAppPropertyCodes: jest.fn(async () => []),
  listCleaningAppTasks: jest.fn(async () => []),
  listDayEndBackupKeys: jest.fn(async () => ({ items: [] })),
  listDayEndHandover: jest.fn(async () => ({})),
  listWorkTasks: jest.fn(async () => []),
  uploadCleaningMedia: jest.fn(async () => ({ url: 'https://example.com/photo.jpg' })),
  uploadDayEndHandover: jest.fn(async () => ({})),
}))

jest.mock('../../lib/dayEndHandoverQueue', () => ({
  clearDayEndHandoverDraft: jest.fn(async () => {}),
  getDayEndHandoverDraft: jest.fn(async () => null),
  persistDayEndDraftPhoto: jest.fn(async () => null),
  saveDayEndHandoverDraft: jest.fn(async () => {}),
}))

afterEach(() => {
  mockAuthState.token = 'local:test'
  mockAuthState.user = { id: 'manager-1', username: 'admin-user', role: 'admin', roles: ['admin', 'offline_manager'] as string[] }
  const api = require('../../lib/api') as {
    listDayEndHandover: jest.Mock
    uploadDayEndHandover: jest.Mock
  }
  api.listDayEndHandover.mockImplementation(async () => ({}))
  api.uploadDayEndHandover.mockImplementation(async () => ({}))
  jest.clearAllMocks()
  jest.restoreAllMocks()
})

test('manager viewing inspector handover sees consumable and reject sections only', async () => {
  const Screen = require('./DayEndBackupKeysScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <Screen
        navigation={{ push: jest.fn(), goBack: jest.fn() } as any}
        route={{ key: 'day-end-inspector', name: 'DayEndBackupKeys', params: { date: '2026-06-24', userId: 'inspector-1', userName: '检查A', targetRoles: ['inspection'], taskRoomCodes: ['MQ201'] } } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText('1. 剩余消耗品照片')).toBeTruthy()
    expect(ui.getByText('2. Reject 床品登记')).toBeTruthy()
    expect(ui.queryByText('1. 备用钥匙照片')).toBeNull()
    expect(ui.queryByText('3. 仓库钥匙照片')).toBeNull()
  })
})

test('manager viewing cleaner handover sees key, dirty linen, warehouse key and reject sections', async () => {
  const Screen = require('./DayEndBackupKeysScreen').default as React.ComponentType<any>
  const ui = render(
    <I18nProvider>
      <Screen
        navigation={{ push: jest.fn(), goBack: jest.fn() } as any}
        route={{ key: 'day-end-cleaner', name: 'DayEndBackupKeys', params: { date: '2026-06-24', userId: 'cleaner-1', userName: '清洁A', targetRoles: ['cleaning'], taskRoomCodes: ['MQ101'] } } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText('1. 备用钥匙照片')).toBeTruthy()
    expect(ui.getByText('2. 脏床品照片')).toBeTruthy()
    expect(ui.getByText('3. 仓库钥匙照片')).toBeTruthy()
    expect(ui.getByText('4. Reject 床品登记')).toBeTruthy()
    expect(ui.queryByText('1. 剩余消耗品照片')).toBeNull()
  })
})

test('retryable timeout saves day-end section as offline draft', async () => {
  mockAuthState.user = { id: 'cleaner-1', username: 'cleaner-a', role: 'cleaner', roles: ['cleaner'] as string[] }
  const api = require('../../lib/api') as {
    listDayEndHandover: jest.Mock
    uploadDayEndHandover: jest.Mock
  }
  const queue = require('../../lib/dayEndHandoverQueue') as {
    saveDayEndHandoverDraft: jest.Mock
  }
  api.listDayEndHandover.mockResolvedValue({
    key_photos: [{ id: 'key-1', url: 'https://cdn.example.com/key-1.jpg', captured_at: '2026-06-29T01:00:00.000Z' }],
    return_wash_photos: [],
    warehouse_key_photos: [],
    consumable_photos: [],
    reject_items: [],
  })
  api.uploadDayEndHandover.mockRejectedValueOnce(Object.assign(new Error('网络超时，请检查网络后重试'), { code: 'TIMEOUT', retryable: true }))
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined as any)
  const Screen = require('./DayEndBackupKeysScreen').default as React.ComponentType<any>

  const ui = render(
    <I18nProvider>
      <Screen
        navigation={{ push: jest.fn(), goBack: jest.fn() } as any}
        route={{ key: 'day-end-self', name: 'DayEndBackupKeys', params: { date: '2026-06-29', targetRoles: ['cleaning'], taskRoomCodes: ['MQ101'] } } as any}
      />
    </I18nProvider>,
  )

  await waitFor(() => expect(ui.getByText('已上传')).toBeTruthy())
  fireEvent.press(ui.getByText('保存备用钥匙照片'))

  await waitFor(() => {
    expect(queue.saveDayEndHandoverDraft).toHaveBeenCalled()
    expect(alertSpy).toHaveBeenCalledWith('确定', '已离线保存，网络恢复后可再次保存')
  })
})
