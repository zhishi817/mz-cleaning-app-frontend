import React, { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View, type ImageProps, type StyleProp, type ViewStyle } from 'react-native'
import { buildCleaningMediaImageSource } from '../lib/cleaningMedia'
import { loadCleaningMediaImage, type CleaningMediaReadFailure } from '../lib/cleaningMediaCache'

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
  style?: StyleProp<ViewStyle>
  resizeMode?: ImageProps['resizeMode']
  testID?: string
}

export default function CleaningMediaPreview({ token, reference, localUri, thumbnailReference, accessTaskId, accessWorkTaskId, guestLuggageId, offlineWorkTaskMedia, dayEndUserId, dayEndDate, style, resizeMode = 'contain', testID }: Props) {
  const [previewLoaded, setPreviewLoaded] = useState(false)
  const [previewFailed, setPreviewFailed] = useState(false)
  const [thumbnailFailed, setThumbnailFailed] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [cachedThumbnailUri, setCachedThumbnailUri] = useState<string | null>(null)
  const [cachedPreviewUri, setCachedPreviewUri] = useState<string | null>(null)
  const [thumbnailCacheSettled, setThumbnailCacheSettled] = useState(false)
  const [previewCacheSettled, setPreviewCacheSettled] = useState(false)
  const [thumbnailNativeFailed, setThumbnailNativeFailed] = useState(false)
  const [previewNativeFailed, setPreviewNativeFailed] = useState(false)
  const [thumbnailReadFailure, setThumbnailReadFailure] = useState<CleaningMediaReadFailure | null>(null)
  const [previewReadFailure, setPreviewReadFailure] = useState<CleaningMediaReadFailure | null>(null)
  const thumbnailSource = useMemo(() => buildCleaningMediaImageSource(token, localUri || thumbnailReference || reference, 'thumbnail', { accessTaskId, accessWorkTaskId, guestLuggageId, offlineWorkTaskMedia, dayEndUserId, dayEndDate }), [accessTaskId, accessWorkTaskId, dayEndDate, dayEndUserId, guestLuggageId, localUri, offlineWorkTaskMedia, reference, thumbnailReference, token])
  const previewSource = useMemo(() => buildCleaningMediaImageSource(token, localUri || reference, 'preview', { accessTaskId, accessWorkTaskId, guestLuggageId, offlineWorkTaskMedia, dayEndUserId, dayEndDate }), [accessTaskId, accessWorkTaskId, dayEndDate, dayEndUserId, guestLuggageId, localUri, offlineWorkTaskMedia, reference, token])

  useEffect(() => {
    setPreviewLoaded(false)
    setPreviewFailed(false)
    setThumbnailFailed(false)
    setRetryKey(0)
    setCachedThumbnailUri(null)
    setCachedPreviewUri(null)
    setThumbnailCacheSettled(false)
    setPreviewCacheSettled(false)
    setThumbnailNativeFailed(false)
    setPreviewNativeFailed(false)
    setThumbnailReadFailure(null)
    setPreviewReadFailure(null)
  }, [accessTaskId, accessWorkTaskId, dayEndDate, dayEndUserId, guestLuggageId, localUri, offlineWorkTaskMedia, reference, thumbnailReference, token])

  useEffect(() => {
    let active = true
    void loadCleaningMediaImage(thumbnailSource).then((result) => {
      if (!active) return
      if (result.uri) {
        setCachedThumbnailUri(result.uri)
        setThumbnailFailed(false)
      }
      setThumbnailReadFailure(result.failure)
      setThumbnailCacheSettled(true)
    })
    return () => {
      active = false
    }
  }, [thumbnailSource, retryKey])

  useEffect(() => {
    let active = true
    void loadCleaningMediaImage(previewSource).then((result) => {
      if (!active) return
      if (result.uri) {
        setCachedPreviewUri(result.uri)
        setPreviewFailed(false)
      }
      setPreviewReadFailure(result.failure)
      setPreviewCacheSettled(true)
    })
    return () => {
      active = false
    }
  }, [previewSource, retryKey])

  useEffect(() => {
    if (thumbnailCacheSettled && thumbnailNativeFailed && !cachedThumbnailUri) setThumbnailFailed(true)
  }, [cachedThumbnailUri, thumbnailCacheSettled, thumbnailNativeFailed])

  useEffect(() => {
    if (previewCacheSettled && previewNativeFailed && !cachedPreviewUri) setPreviewFailed(true)
  }, [cachedPreviewUri, previewCacheSettled, previewNativeFailed])

  if (!reference && !localUri) return <View style={[styles.container, style]} />

  const terminalReadFailure = [previewReadFailure, thumbnailReadFailure].find((failure) => failure && !failure.retryable) || null
  const readFailure = terminalReadFailure || previewReadFailure || thumbnailReadFailure
  const canRetry = !readFailure || readFailure.retryable
  const failureMessage = readFailure?.message || (previewFailed ? '原图加载失败，点击重试' : '照片预览加载失败，点击重试')

  return (
    <View style={[styles.container, style]}>
      <Image
        key={`thumbnail:${thumbnailSource.uri}:${retryKey}`}
        testID={testID ? `${testID}-thumbnail` : undefined}
        source={cachedThumbnailUri ? { uri: cachedThumbnailUri } : thumbnailSource}
        style={styles.media}
        resizeMode={resizeMode}
        fadeDuration={0}
        onError={() => {
          setThumbnailNativeFailed(true)
          if (cachedThumbnailUri) setThumbnailFailed(true)
        }}
      />
      {!previewFailed ? (
        <Image
          key={`preview:${previewSource.uri}:${retryKey}`}
          testID={testID ? `${testID}-preview` : undefined}
          source={cachedPreviewUri ? { uri: cachedPreviewUri } : previewSource}
          style={[styles.media, previewLoaded ? null : styles.hiddenMedia]}
          resizeMode={resizeMode}
          fadeDuration={0}
          onLoad={() => {
            setPreviewNativeFailed(false)
            setPreviewFailed(false)
            setPreviewReadFailure(null)
            setPreviewLoaded(true)
          }}
          onError={() => {
            setPreviewLoaded(false)
            setPreviewNativeFailed(true)
            if (cachedPreviewUri) setPreviewFailed(true)
          }}
        />
      ) : null}
      {!previewLoaded && !previewFailed && !thumbnailFailed && !readFailure ? (
        <View style={styles.statusOverlay} pointerEvents="none">
          <ActivityIndicator color="#FFFFFF" />
          <Text style={styles.statusText}>高清图加载中…</Text>
        </View>
      ) : null}
      {previewFailed || thumbnailFailed || readFailure ? (
        canRetry ? (
          <Pressable testID={testID ? `${testID}-retry` : undefined} style={styles.retryOverlay} onPress={() => { setPreviewFailed(false); setThumbnailFailed(false); setPreviewLoaded(false); setCachedThumbnailUri(null); setCachedPreviewUri(null); setThumbnailCacheSettled(false); setPreviewCacheSettled(false); setThumbnailNativeFailed(false); setPreviewNativeFailed(false); setThumbnailReadFailure(null); setPreviewReadFailure(null); setRetryKey((value) => value + 1) }}>
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
