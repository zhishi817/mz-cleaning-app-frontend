import React from 'react'
import { StyleSheet } from 'react-native'
import { render } from '@testing-library/react-native'
import { I18nProvider } from '../../lib/i18n'
import MeScreen from './MeScreen'

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}))

jest.mock('../../lib/auth', () => ({
  useAuth: () => ({
    token: null,
    user: { id: 'customer-service-1', username: 'zhisCS', role: 'customer_service', roles: ['customer_service'] },
    signOut: jest.fn(async () => {}),
  }),
}))

jest.mock('../../lib/profileStore', () => ({
  defaultProfileFromUser: (user: { username?: string } | null) => ({
    avatar_url: null,
    display_name: user?.username || '',
    phone_au: '',
    legal_name: '',
    bank_account_name: '',
    bank_bsb: '',
    bank_account_number: '',
    personal_abn: '',
    photo_id_url: null,
  }),
  getProfile: jest.fn(async () => null),
}))

jest.mock('../../lib/roles', () => ({
  hasAnyPermission: jest.fn(() => false),
}))

test('我页的退出登录文字在红色按钮内垂直和水平居中', () => {
  const ui = render(
    <I18nProvider>
      <MeScreen navigation={{ navigate: jest.fn() } as any} route={{ key: 'me-home', name: 'MeHome' } as any} />
    </I18nProvider>,
  )

  const logoutAction = ui.getByTestId('me-logout-action')
  const logoutActionStyle = StyleSheet.flatten(
    typeof logoutAction.props.style === 'function'
      ? logoutAction.props.style({ pressed: false })
      : logoutAction.props.style,
  )

  expect(logoutActionStyle).toEqual(expect.objectContaining({
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  }))
})
