import React, { useCallback, useEffect, useRef } from 'react'
import { AppState, StyleSheet, View } from 'react-native'
import { API_BASE_URL, DEV_PREVIEW_ACTIVITY_ENABLED } from '../config/env'

const DEBOUNCE_MS = 5_000

export function buildDevPreviewActivityUrl(apiBaseUrl: string) {
  const base = String(apiBaseUrl || '').trim().replace(/\/+$/g, '')
  return base ? `${base}/health/dev-preview-activity` : ''
}

export function DevPreviewActivityBoundary({ children }: { children: React.ReactNode }) {
  const lastSentAtRef = useRef(0)
  const activityUrl = buildDevPreviewActivityUrl(API_BASE_URL)
  const reportActivity = useCallback(() => {
    if (!DEV_PREVIEW_ACTIVITY_ENABLED || !activityUrl) return
    const now = Date.now()
    if (now - lastSentAtRef.current < DEBOUNCE_MS) return
    lastSentAtRef.current = now
    void fetch(activityUrl, { method: 'POST', cache: 'no-store' }).catch(() => undefined)
  }, [activityUrl])

  useEffect(() => {
    if (!DEV_PREVIEW_ACTIVITY_ENABLED || !activityUrl) return undefined
    reportActivity()
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') reportActivity()
    })
    return () => subscription.remove()
  }, [activityUrl, reportActivity])

  if (!DEV_PREVIEW_ACTIVITY_ENABLED || !activityUrl) return <>{children}</>

  return (
    <View testID="dev-preview-activity-boundary" style={styles.root} onTouchStart={reportActivity}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
