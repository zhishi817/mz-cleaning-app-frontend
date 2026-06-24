import React, { useEffect, useState } from 'react'
import { Image, type ImageProps } from 'react-native'
import {
  buildCleaningMediaImageSource,
  selectCleaningMediaReference,
} from '../lib/cleaningMedia'

type Props = Omit<ImageProps, 'source'> & {
  token?: string | null
  isOnline: boolean
  localUri?: string | null
  thumbnailUri?: string | null
  remoteReference?: string | null
}

export default function CleaningMediaImage({
  token,
  isOnline,
  localUri,
  thumbnailUri,
  remoteReference,
  onError,
  ...imageProps
}: Props) {
  const [remoteFailed, setRemoteFailed] = useState(false)
  const [thumbnailFailed, setThumbnailFailed] = useState(false)

  useEffect(() => {
    setRemoteFailed(false)
    setThumbnailFailed(false)
  }, [isOnline, localUri, remoteReference, thumbnailUri])

  const selected = selectCleaningMediaReference({
    localUri,
    thumbnailUri,
    remoteReference,
    isOnline,
    remoteFailed,
    thumbnailFailed,
  })

  return (
    <Image
      {...imageProps}
      source={buildCleaningMediaImageSource(token, selected.reference)}
      onError={(event) => {
        if (selected.kind === 'remote' && thumbnailUri) setRemoteFailed(true)
        else if (selected.kind === 'thumbnail') setThumbnailFailed(true)
        onError?.(event)
      }}
    />
  )
}
