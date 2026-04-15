import { Image } from 'react-native'
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'

async function getImageSize(uri: string): Promise<{ width: number; height: number } | null> {
  return await new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve(null),
    )
  })
}

export async function compressImageForUpload(uri: string) {
  const u = String(uri || '').trim()
  if (!u) throw new Error('missing uri')
  const size = await getImageSize(u)
  const width = Number(size?.width || 0)
  const actions = width > 2560 ? [{ resize: { width: 2560 } }] : []
  const r = await manipulateAsync(
    u,
    actions,
    { compress: 0.92, format: SaveFormat.JPEG },
  )
  return r.uri
}
