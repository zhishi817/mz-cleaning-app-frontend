import React, { useEffect, useMemo, useState } from 'react'
import { Image, type ImageProps } from 'react-native'
import {
  buildCleaningMediaImageSource,
  type CleaningMediaImageVariant,
  selectCleaningMediaReference,
} from '../lib/cleaningMedia'
import { cacheCleaningMediaImage } from '../lib/cleaningMediaCache'

type Props = Omit<ImageProps, 'source'> & {
  token?: string | null
  isOnline?: boolean
  localUri?: string | null
  thumbnailUri?: string | null
  remoteReference?: string | null
  variant?: CleaningMediaImageVariant
  accessTaskId?: string | null
  accessWorkTaskId?: string | null
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
  onError,
  ...imageProps
}: Props) {
  const [remoteFailed, setRemoteFailed] = useState(false)
  const [thumbnailFailed, setThumbnailFailed] = useState(false)
  const [cachedRemoteUri, setCachedRemoteUri] = useState<string | null>(null)

  useEffect(() => {
    setRemoteFailed(false)
    setThumbnailFailed(false)
    setCachedRemoteUri(null)
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
    () => buildCleaningMediaImageSource(token, selected.reference, variant, { accessTaskId, accessWorkTaskId }),
    [accessTaskId, accessWorkTaskId, selected.reference, token, variant],
  )

  useEffect(() => {
    if (selected.kind !== 'remote') return undefined
    let active = true
    void cacheCleaningMediaImage(selectedSource).then((uri) => {
      if (active && uri) setCachedRemoteUri(uri)
    })
    return () => {
      active = false
    }
  }, [selected.kind, selected.reference, selectedSource, token])

  return (
    <Image
      {...imageProps}
      source={selected.kind === 'remote' && cachedRemoteUri ? { uri: cachedRemoteUri } : selectedSource}
      onError={(event) => {
        if (selected.kind === 'remote' && thumbnailUri) setRemoteFailed(true)
        else if (selected.kind === 'thumbnail') setThumbnailFailed(true)
        onError?.(event)
      }}
    />
  )
}
