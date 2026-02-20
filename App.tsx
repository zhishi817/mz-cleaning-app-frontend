import { StatusBar } from 'expo-status-bar'
import React from 'react'
import RootNavigator from './src/navigation/RootNavigator'
import { AuthProvider } from './src/lib/auth'
import { I18nProvider } from './src/lib/i18n'

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <RootNavigator />
        <StatusBar style="auto" />
      </AuthProvider>
    </I18nProvider>
  )
}
