import React from 'react'
import { Linking } from 'react-native'
import { act, render, fireEvent, waitFor } from '@testing-library/react-native'
import { I18nProvider } from '../../lib/i18n'
import { setContactsSnapshot } from '../../lib/contactsStore'
import ContactsScreen from './ContactsScreen'

jest.mock('../../lib/auth', () => {
  return {
    useAuth: () => ({ token: 't1', user: { id: 'u1', username: 'tester', role: 'staff' } }),
  }
})

test('contacts call button invokes system dialer', async () => {
  const canSpy = jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true as any)
  const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as any)

  setContactsSnapshot({
    items: [],
    updated_at: Date.now(),
  })

  const ui = render(
    <I18nProvider>
      <ContactsScreen navigation={{ navigate: jest.fn() } as any} route={{ key: 'k', name: 'ContactsList' } as any} />
    </I18nProvider>,
  )

  act(() => {
    setContactsSnapshot({
      items: [
        {
          id: 'user:u1',
          source: 'system',
          name: 'tester',
          phone_au: '0412 345 678',
          username: 'tester',
          role: 'staff',
        },
      ],
      updated_at: Date.now(),
    })
  })

  await waitFor(() => {
    expect(ui.getByLabelText('call-user:u1')).toBeTruthy()
  })
  fireEvent.press(ui.getByLabelText('call-user:u1'))

  await waitFor(() => {
    expect(openSpy).toHaveBeenCalled()
  })

  canSpy.mockRestore()
  openSpy.mockRestore()
})
