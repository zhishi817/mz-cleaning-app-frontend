import React from 'react'
import { Linking } from 'react-native'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { I18nProvider } from '../../lib/i18n'
import ContactsScreen from './ContactsScreen'

test('contacts call button invokes system dialer', async () => {
  const canSpy = jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true as any)
  const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as any)

  const ui = render(
    <I18nProvider>
      <ContactsScreen navigation={{ navigate: jest.fn() } as any} route={{ key: 'k', name: 'ContactsList' } as any} />
    </I18nProvider>,
  )

  fireEvent.press(ui.getByLabelText('call-c1'))

  await waitFor(() => {
    expect(openSpy).toHaveBeenCalled()
  })

  canSpy.mockRestore()
  openSpy.mockRestore()
})
