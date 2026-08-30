import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { I18nProvider } from '../../lib/i18n'
import ProfileEditScreen from './ProfileEditScreen'

const mockProfile = {
  avatar_url: null,
  display_name: 'Cleaner One',
  phone_au: '',
  legal_name: '',
  bank_account_name: '',
  bank_bsb: '',
  bank_account_number: '',
  personal_abn: '',
  photo_id_url: null,
  visa_document_url: null,
  visa_grant_number: '',
}
const mockUploadMzappMedia = jest.fn(async (...args: any[]) => {
  const type = String(args[2]?.profile_document_type || 'photo_id')
  return { url: `mzapp/profile-documents/cleaner-1/${type}/document.jpg`, key: `mzapp/profile-documents/cleaner-1/${type}/document.jpg` }
})
const mockUpdateMyProfile = jest.fn(async (params: any) => ({ ...mockProfile, ...params }))

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  launchImageLibraryAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: 'file:///document.jpg', fileName: 'document.jpg', mimeType: 'image/jpeg' }],
  })),
}))

jest.mock('../../lib/auth', () => ({
  useAuth: () => ({ token: 'profile-token', user: { id: 'cleaner-1', username: 'cleaner-one', role: 'cleaner', roles: ['cleaner'] } }),
}))

jest.mock('../../lib/profileStore', () => ({
  PROFILE_DOCUMENT_PRESENT: 'uploaded',
  profileDocumentPresence: (value: any) => String(value || '').trim() ? 'uploaded' : null,
  defaultProfileFromUser: () => mockProfile,
  getProfile: jest.fn(() => new Promise(() => {})),
  setProfile: jest.fn(async () => {}),
}))

jest.mock('../../lib/api', () => ({
  getMyProfile: jest.fn(async () => mockProfile),
  profileDocumentImageSource: (_token: string, type: string) => ({ uri: `https://api.example.test/users/me/profile-documents/${type}`, headers: { Authorization: 'Bearer profile-token' } }),
  updateMyProfile: (...args: any[]) => mockUpdateMyProfile(args[1]),
  uploadMzappMedia: (token: string, file: any, options?: any) => mockUploadMzappMedia(token, file, options),
}))

afterEach(() => {
  jest.clearAllMocks()
})

test('个人资料页显示签证上传和 Visa Grant Number 字段', async () => {
  const ui = render(
    <I18nProvider>
      <ProfileEditScreen />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText('签证信息')).toBeTruthy()
    expect(ui.getByText('Visa Grant Number')).toBeTruthy()
    expect(ui.getByText('上传签证文件')).toBeTruthy()
  })
})

test('Photo ID 和签证的本地预览均显示整版水印，并按资料类型上传', async () => {
  const ui = render(
    <I18nProvider>
      <ProfileEditScreen />
    </I18nProvider>,
  )

  await waitFor(() => {
    expect(ui.getByText('签证信息')).toBeTruthy()
  })

  fireEvent.press(ui.getByTestId('profile-photo-id-upload'))
  await waitFor(() => {
    expect(ui.getByTestId('profile-photo-id-preview')).toBeTruthy()
    expect(mockUploadMzappMedia).toHaveBeenCalledWith(
      'profile-token',
      expect.objectContaining({ uri: 'file:///document.jpg' }),
      { watermark_mode: 'photo_id_full', profile_document_type: 'photo_id' },
    )
    expect(mockUpdateMyProfile).toHaveBeenCalledWith({ photo_id_url: 'mzapp/profile-documents/cleaner-1/photo_id/document.jpg' })
  })
  fireEvent.press(ui.getByTestId('profile-photo-id-preview'))
  expect(ui.getByTestId('profile-document-fullscreen')).toBeTruthy()
  expect(ui.getByTestId('profile-document-fullscreen-zoom').props.maximumZoomScale).toBe(4)
  expect(ui.getByTestId('profile-document-fullscreen-zoom').props.minimumZoomScale).toBe(1)
  fireEvent.press(ui.getByTestId('profile-document-fullscreen-close'))
  expect(ui.queryByTestId('profile-document-fullscreen')).toBeNull()

  fireEvent.press(ui.getByTestId('profile-visa-document-upload'))
  await waitFor(() => {
    expect(ui.getByTestId('profile-visa-document-preview')).toBeTruthy()
    expect(mockUploadMzappMedia).toHaveBeenCalledWith(
      'profile-token',
      expect.objectContaining({ uri: 'file:///document.jpg' }),
      { watermark_mode: 'profile_document_full', profile_document_type: 'visa_document' },
    )
    expect(mockUpdateMyProfile).toHaveBeenCalledWith({ visa_document_url: 'mzapp/profile-documents/cleaner-1/visa_document/document.jpg' })
  })
  fireEvent.press(ui.getByTestId('profile-visa-document-preview'))
  expect(ui.getByTestId('profile-document-fullscreen')).toBeTruthy()
  expect(ui.getByTestId('profile-document-fullscreen-zoom').props.maximumZoomScale).toBe(4)
  fireEvent.press(ui.getByTestId('profile-document-fullscreen-backdrop'))
  expect(ui.queryByTestId('profile-document-fullscreen')).toBeNull()
})
