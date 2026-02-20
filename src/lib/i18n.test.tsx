import React from 'react'
import { Pressable, Text } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { I18nProvider, useI18n, LOCALE_STORAGE_KEY } from './i18n'

function Demo() {
  const { t, setLocale } = useI18n()
  return (
    <Pressable onPress={() => setLocale('en')} accessibilityRole="button" accessibilityLabel="switch">
      <Text>{t('tabs_tasks')}</Text>
    </Pressable>
  )
}

test('i18n switches language and persists locale', async () => {
  const ui = render(
    <I18nProvider>
      <Demo />
    </I18nProvider>,
  )

  expect(ui.getByText('任务')).toBeTruthy()
  fireEvent.press(ui.getByLabelText('switch'))

  await waitFor(() => {
    expect(ui.getByText('Tasks')).toBeTruthy()
  })

  expect((AsyncStorage.setItem as any).mock.calls.some((c: any[]) => c[0] === LOCALE_STORAGE_KEY)).toBe(true)
})
