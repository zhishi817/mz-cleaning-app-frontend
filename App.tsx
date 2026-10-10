import { StatusBar } from 'expo-status-bar'
import React from 'react'
import RootNavigator from './src/navigation/RootNavigator'
import { AuthProvider } from './src/lib/auth'
import { I18nProvider } from './src/lib/i18n'
import { configureDefaultTextScaling } from './src/lib/scale'
import { DevPreviewActivityBoundary } from './src/components/DevPreviewActivityBoundary'

configureDefaultTextScaling()

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <DevPreviewActivityBoundary>
          <RootNavigator />
          <StatusBar style="auto" />
        </DevPreviewActivityBoundary>
      </AuthProvider>
    </I18nProvider>
  )
}
