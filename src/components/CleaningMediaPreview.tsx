import React, { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View, type ImageProps, type StyleProp, type ViewStyle } from 'react-native'
import { buildCleaningMediaImageSource } from '../lib/cleaningMedia'
import {
  getCleaningMediaCacheEpoch,
  loadCleaningMediaImage,
  removeCleaningMediaCachedImage,
  subscribeCleaningMediaCache,
  type CleaningMediaReadFailure,
} from '../lib/cleaningMediaCache'

type Props = {
  token?: string | null
  reference?: string | null
  localUri?: string | null
  thumbnailReference?: string | null
  accessTaskId?: string | null
  accessWorkTaskId?: string | null
  guestLuggageId?: string | null
  offlineWorkTaskMedia?: boolean
  dayEndUserId?: string | null
  dayEndDate?: string | null
  /** List/grid callers keep this false; the open/current viewer page opts in. */
  loadPreview?: boolean
  style?: StyleProp<ViewStyle>
  resizeMode?: ImageProps['resizeMode']
  testID?: string
}

function isHttpUri(value: any) {
  return /^https?:\/\//i.test(String(value || '').trim())
}

function retryableUnavailableFailure(): CleaningMediaReadFailure {
  return { status: null, message: '照片暂时无法加载，点击重试', retryable: true }
}

export default function CleaningMediaPreview({ token, reference, localUri, thumbnailReference, accessTaskId, accessWorkTaskId, guestLuggageId, offlineWorkTaskMedia, dayEndUserId, dayEndDate, loadPreview = true, style, resizeMode = 'contain', testID }: Props) {
  const [previewLoaded, setPreviewLoaded] = useState(false)
  const [previewFailed, setPreviewFailed] = useState(false)
  const [thumbnailFailed, setThumbnailFailed] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [cachedThumbnailUri, setCachedThumbnailUri] = useState<string | null>(null)
  const [cachedPreviewUri, setCachedPreviewUri] = useState<string | null>(null)
  const [thumbnailReadFailure, setThumbnailReadFailure] = useState<CleaningMediaReadFailure | null>(null)
  const [previewReadFailure, setPreviewReadFailure] = useState<CleaningMediaReadFailure | null>(null)
  const [cacheEpoch, setCacheEpoch] = useState(getCleaningMediaCacheEpoch)
  const thumbnailSource = useMemo(() => buildCleaningMediaImageSource(token, localUri || thumbnailReference || reference, 'thumbnail', { accessTaskId, accessWorkTaskId, guestLuggageId, offlineWorkTaskMedia, dayEndUserId, dayEndDate }), [accessTaskId, accessWorkTaskId, dayEndDate, dayEndUserId, guestLuggageId, localUri, offlineWorkTaskMedia, reference, thumbnailReference, token])
  const previewSource = useMemo(() => buildCleaningMediaImageSource(token, localUri || reference, 'preview', { accessTaskId, accessWorkTaskId, guestLuggageId, offlineWorkTaskMedia, dayEndUserId, dayEndDate }), [accessTaskId, accessWorkTaskId, dayEndDate, dayEndUserId, guestLuggageId, localUri, offlineWorkTaskMedia, reference, token])
  const thumbnailNeedsCache = isHttpUri(thumbnailSource.uri)
  const previewNeedsCache = loadPreview && isHttpUri(previewSource.uri)

  useEffect(() => {
    return subscribeCleaningMediaCache(() => setCacheEpoch(getCleaningMediaCacheEpoch()))
  }, [])

  useEffect(() => {
    setPreviewLoaded(false)
    setPreviewFailed(false)
    setThumbnailFailed(false)
    setRetryKey(0)
    setCachedThumbnailUri(null)
    setCachedPreviewUri(null)
    setThumbnailReadFailure(null)
    setPreviewReadFailure(null)
  }, [accessTaskId, accessWorkTaskId, cacheEpoch, dayEndDate, dayEndUserId, guestLuggageId, localUri, loadPreview, offlineWorkTaskMedia, reference, thumbnailReference, token])

  useEffect(() => {
    if (!thumbnailNeedsCache) return undefined
    let active = true
    void loadCleaningMediaImage(thumbnailSource).then((result) => {
      if (!active) return
      setCachedThumbnailUri(result.uri)
      setThumbnailReadFailure(result.failure || (result.uri ? null : retryableUnavailableFailure()))
    })
    return () => {
      active = false
    }
  }, [cacheEpoch, retryKey, thumbnailNeedsCache, thumbnailSource])

  useEffect(() => {
    if (!loadPreview || !previewNeedsCache) return undefined
    let active = true
    void loadCleaningMediaImage(previewSource).then((result) => {
      if (!active) return
      setCachedPreviewUri(result.uri)
      setPreviewReadFailure(result.failure || (result.uri ? null : retryableUnavailableFailure()))
    })
    return () => {
      active = false
    }
  }, [cacheEpoch, loadPreview, previewNeedsCache, previewSource, retryKey])

  if (!reference && !localUri) return <View style={[styles.container, style]} />

  const terminalReadFailure = [
    loadPreview ? previewReadFailure : null,
    thumbnailReadFailure,
  ].find((failure) => failure && !failure.retryable) || null
  const readFailure = terminalReadFailure || (loadPreview ? previewReadFailure : null) || thumbnailReadFailure
  const canRetry = !readFailure || readFailure.retryable
  const failureMessage = readFailure?.message || (previewFailed ? '原图加载失败，点击重试' : '照片预览加载失败，点击重试')
  const thumbnailDisplaySource = thumbnailNeedsCache ? (cachedThumbnailUri ? { uri: cachedThumbnailUri } : null) : thumbnailSource
  const previewDisplaySource = previewNeedsCache ? (cachedPreviewUri ? { uri: cachedPreviewUri } : null) : previewSource

  return (
    <View style={[styles.container, style]}>
      {thumbnailDisplaySource ? (
        <Image
          key={`thumbnail:${thumbnailSource.uri}:${retryKey}`}
          testID={testID ? `${testID}-thumbnail` : undefined}
          source={thumbnailDisplaySource}
          style={styles.media}
          resizeMode={resizeMode}
          fadeDuration={0}
          onError={() => {
            if (thumbnailNeedsCache) void removeCleaningMediaCachedImage(thumbnailSource)
            setCachedThumbnailUri(null)
            setThumbnailFailed(true)
          }}
        />
      ) : null}
      {loadPreview && !previewFailed && previewDisplaySource ? (
        <Image
          key={`preview:${previewSource.uri}:${retryKey}`}
          testID={testID ? `${testID}-preview` : undefined}
          source={previewDisplaySource}
          style={[styles.media, previewLoaded ? null : styles.hiddenMedia]}
          resizeMode={resizeMode}
          fadeDuration={0}
          onLoad={() => {
            setPreviewFailed(false)
            setPreviewReadFailure(null)
            setPreviewLoaded(true)
          }}
          onError={() => {
            if (previewNeedsCache) void removeCleaningMediaCachedImage(previewSource)
            setCachedPreviewUri(null)
            setPreviewLoaded(false)
            setPreviewFailed(true)
          }}
        />
      ) : null}
      {loadPreview && !previewLoaded && !previewFailed && !thumbnailFailed && !readFailure ? (
        <View style={styles.statusOverlay} pointerEvents="none">
          <ActivityIndicator color="#FFFFFF" />
          <Text style={styles.statusText}>高清图加载中…</Text>
        </View>
      ) : null}
      {previewFailed || thumbnailFailed || readFailure ? (
        canRetry ? (
          <Pressable testID={testID ? `${testID}-retry` : undefined} style={styles.retryOverlay} onPress={() => { setPreviewFailed(false); setThumbnailFailed(false); setPreviewLoaded(false); setCachedThumbnailUri(null); setCachedPreviewUri(null); setThumbnailReadFailure(null); setPreviewReadFailure(null); setRetryKey((value) => value + 1) }}>
            <Text style={styles.retryText}>{failureMessage}</Text>
          </Pressable>
        ) : (
          <View testID={testID ? `${testID}-terminal` : undefined} style={styles.retryOverlay}>
            <Text style={styles.retryText}>{failureMessage}</Text>
          </View>
        )
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden', backgroundColor: '#111827' },
  media: { ...StyleSheet.absoluteFillObject },
  hiddenMedia: { opacity: 0 },
  statusOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(0, 0, 0, 0.18)' },
  statusText: { color: '#FFFFFF', fontSize: 13 },
  retryOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0, 0, 0, 0.42)' },
  retryText: { color: '#FFFFFF', fontSize: 14, textAlign: 'center' },
})
