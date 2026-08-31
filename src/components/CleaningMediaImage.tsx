import React, { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View, type ImageProps } from 'react-native'
import {
  buildCleaningMediaImageSource,
  type CleaningMediaImageVariant,
  selectCleaningMediaReference,
} from '../lib/cleaningMedia'
import {
  getCleaningMediaCacheEpoch,
  loadCleaningMediaImage,
  removeCleaningMediaCachedImage,
  subscribeCleaningMediaCache,
  type CleaningMediaReadFailure,
} from '../lib/cleaningMediaCache'

type Props = Omit<ImageProps, 'source'> & {
  token?: string | null
  isOnline?: boolean
  localUri?: string | null
  thumbnailUri?: string | null
  remoteReference?: string | null
  variant?: CleaningMediaImageVariant
  accessTaskId?: string | null
  accessWorkTaskId?: string | null
  guestLuggageId?: string | null
  offlineWorkTaskMedia?: boolean
  dayEndUserId?: string | null
  dayEndDate?: string | null
}

export default function CleaningMediaImage({
  token,
  isOnline = true,
  localUri,
  thumbnailUri,
  remoteReference,
  variant = 'thumbnail',
  accessTaskId,
  accessWorkTaskId,
  guestLuggageId,
  offlineWorkTaskMedia,
  dayEndUserId,
  dayEndDate,
  onError,
  ...imageProps
}: Props) {
  const [remoteFailed, setRemoteFailed] = useState(false)
  const [thumbnailFailed, setThumbnailFailed] = useState(false)
  const [cachedRemoteUri, setCachedRemoteUri] = useState<string | null>(null)
  const [remoteReadFailure, setRemoteReadFailure] = useState<CleaningMediaReadFailure | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [cacheEpoch, setCacheEpoch] = useState(getCleaningMediaCacheEpoch)

  useEffect(() => {
    return subscribeCleaningMediaCache(() => setCacheEpoch(getCleaningMediaCacheEpoch()))
  }, [])

  useEffect(() => {
    setRemoteFailed(false)
    setThumbnailFailed(false)
    setCachedRemoteUri(null)
    setRemoteReadFailure(null)
  }, [cacheEpoch, isOnline, localUri, remoteReference, thumbnailUri])

  const selected = selectCleaningMediaReference({
    localUri,
    thumbnailUri,
    remoteReference,
    isOnline,
    remoteFailed,
    thumbnailFailed,
  })
  const selectedSource = useMemo(
    () => buildCleaningMediaImageSource(token, selected.reference, variant, { accessTaskId, accessWorkTaskId, guestLuggageId, offlineWorkTaskMedia, dayEndUserId, dayEndDate }),
    [accessTaskId, accessWorkTaskId, dayEndDate, dayEndUserId, guestLuggageId, offlineWorkTaskMedia, selected.reference, token, variant],
  )
  const shouldUsePrivateFile = /^https?:\/\//i.test(String(selectedSource.uri || ''))
  const hasLocalThumbnailFallback = /^file:/i.test(String(thumbnailUri || '').trim())

  useEffect(() => {
    if (!shouldUsePrivateFile) return undefined
    let active = true
    void loadCleaningMediaImage(selectedSource).then(({ uri, failure }) => {
      if (!active) return
      if (!uri && failure?.retryable && selected.kind === 'remote' && hasLocalThumbnailFallback) {
        setCachedRemoteUri(null)
        setRemoteReadFailure(null)
        setRemoteFailed(true)
        return
      }
      if (uri) setCachedRemoteUri(uri)
      else setCachedRemoteUri(null)
      setRemoteReadFailure(failure || (uri ? null : { status: null, message: '照片暂时无法加载，点击重试', retryable: true }))
    })
    return () => {
      active = false
    }
  }, [cacheEpoch, hasLocalThumbnailFallback, retryKey, selected.kind, selectedSource, shouldUsePrivateFile])

  if (shouldUsePrivateFile && remoteReadFailure) {
    const failureBody = <Text style={styles.failureText}>{remoteReadFailure.message}</Text>
    return (
      <View testID={imageProps.testID} style={[styles.failureContainer, imageProps.style]}>
        {remoteReadFailure.retryable ? (
          <Pressable
            testID={imageProps.testID ? `${imageProps.testID}-retry` : undefined}
            style={styles.failureAction}
            onPress={() => {
              setCachedRemoteUri(null)
              setRemoteReadFailure(null)
              setRetryKey((value) => value + 1)
            }}
          >
            {failureBody}
          </Pressable>
        ) : failureBody}
      </View>
    )
  }

  if (shouldUsePrivateFile && !cachedRemoteUri) {
    return (
      <View testID={imageProps.testID} style={[styles.loadingContainer, imageProps.style]}>
        <ActivityIndicator color="#FFFFFF" />
      </View>
    )
  }

  return (
    <Image
      {...imageProps}
      source={shouldUsePrivateFile && cachedRemoteUri ? { uri: cachedRemoteUri } : selectedSource}
      onError={(event) => {
        if (shouldUsePrivateFile) {
          void removeCleaningMediaCachedImage(selectedSource)
          setCachedRemoteUri(null)
          setRemoteReadFailure({ status: null, message: '照片加载失败，点击重试', retryable: true })
        } else if (selected.kind === 'remote' && thumbnailUri) setRemoteFailed(true)
        else if (selected.kind === 'thumbnail') setThumbnailFailed(true)
        onError?.(event)
      }}
    />
  )
}

const styles = StyleSheet.create({
  loadingContainer: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#64748B', minWidth: 44, minHeight: 44 },
  failureContainer: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#64748B', minWidth: 44, minHeight: 44 },
  failureAction: { width: '100%', height: '100%', minHeight: 44, alignItems: 'center', justifyContent: 'center', padding: 8 },
  failureText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', textAlign: 'center', lineHeight: 17, padding: 8 },
})
