import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'

export async function compressImageForUpload(uri: string) {
  const u = String(uri || '').trim()
  if (!u) throw new Error('missing uri')
  const r = await manipulateAsync(
    u,
    [{ resize: { width: 1280 } }],
    { compress: 0.65, format: SaveFormat.JPEG },
  )
  return r.uri
}

