import React, { useEffect, useMemo, useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View, type ImageProps } from 'react-native'
import {
  buildCleaningMediaImageSource,
  type CleaningMediaImageVariant,
  selectCleaningMediaReference,
} from '../lib/cleaningMedia'
import { loadCleaningMediaImage, type CleaningMediaReadFailure } from '../lib/cleaningMediaCache'

type Props = Omit<ImageProps, 'source'> & {
  token?: string | null
  isOnline?: boolean
  localUri?: string | null
  thumbnailUri?: string | null
  remoteReference?: string | null
  variant?: CleaningMediaImageVariant
  accessTaskId?: string | null
  accessWorkTaskId?: string | null
  offlineWorkTaskMedia?: boolean
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
  offlineWorkTaskMedia,
  onError,
  ...imageProps
}: Props) {
  const [remoteFailed, setRemoteFailed] = useState(false)
  const [thumbnailFailed, setThumbnailFailed] = useState(false)
  const [cachedRemoteUri, setCachedRemoteUri] = useState<string | null>(null)
  const [remoteReadFailure, setRemoteReadFailure] = useState<CleaningMediaReadFailure | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    setRemoteFailed(false)
    setThumbnailFailed(false)
    setCachedRemoteUri(null)
    setRemoteReadFailure(null)
  }, [isOnline, localUri, remoteReference, thumbnailUri])

  const selected = selectCleaningMediaReference({
    localUri,
    thumbnailUri,
    remoteReference,
    isOnline,
    remoteFailed,
    thumbnailFailed,
  })
  const selectedSource = useMemo(
    () => buildCleaningMediaImageSource(token, selected.reference, variant, { accessTaskId, accessWorkTaskId, offlineWorkTaskMedia }),
    [accessTaskId, accessWorkTaskId, offlineWorkTaskMedia, selected.reference, token, variant],
  )

  useEffect(() => {
    if (selected.kind !== 'remote') return undefined
    let active = true
    void loadCleaningMediaImage(selectedSource).then(({ uri, failure }) => {
      if (!active) return
      if (uri) setCachedRemoteUri(uri)
      setRemoteReadFailure(failure)
    })
    return () => {
      active = false
    }
  }, [retryKey, selected.kind, selected.reference, selectedSource, token])

  if (selected.kind === 'remote' && remoteReadFailure) {
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

  return (
    <Image
      {...imageProps}
      source={selected.kind === 'remote' && cachedRemoteUri ? { uri: cachedRemoteUri } : selectedSource}
      onError={(event) => {
        if (selected.kind === 'remote' && thumbnailUri) setRemoteFailed(true)
        else if (selected.kind === 'remote') setRemoteReadFailure({ status: null, message: '照片加载失败，点击重试', retryable: true })
        else if (selected.kind === 'thumbnail') setThumbnailFailed(true)
        onError?.(event)
      }}
    />
  )
}

const styles = StyleSheet.create({
  failureContainer: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#64748B', minWidth: 44, minHeight: 44 },
  failureAction: { width: '100%', height: '100%', minHeight: 44, alignItems: 'center', justifyContent: 'center', padding: 8 },
  failureText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', textAlign: 'center', lineHeight: 17, padding: 8 },
})
