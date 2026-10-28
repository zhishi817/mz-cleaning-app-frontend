import { StatusBar } from 'expo-status-bar'
import React from 'react'
import RootNavigator from './src/navigation/RootNavigator'
import { AuthProvider } from './src/lib/auth'
import { I18nProvider } from './src/lib/i18n'
import { configureDefaultTextScaling } from './src/lib/scale'
import { DevPreviewActivityBoundary } from './src/components/DevPreviewActivityBoundary'
import { AppUpdateNoticeProvider } from './src/components/AppUpdateNoticeProvider'

configureDefaultTextScaling()

export default function App() {
  return (
    <I18nProvider>
      <AppUpdateNoticeProvider>
        <AuthProvider>
          <DevPreviewActivityBoundary>
            <RootNavigator />
            <StatusBar style="auto" />
          </DevPreviewActivityBoundary>
        </AuthProvider>
      </AppUpdateNoticeProvider>
    </I18nProvider>
  )
}
