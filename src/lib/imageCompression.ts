import { Image } from 'react-native'

type ImageManipulatorModule = {
  manipulateAsync?: (
    uri: string,
    actions: Array<{ resize: { width: number } }>,
    saveOptions: { compress: number; format: string },
  ) => Promise<{ uri?: string | null }>
  SaveFormat?: { JPEG?: string }
}

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
  const actions = width > 1920 ? [{ resize: { width: 1920 } }] : []
  try {
    const mod = (await import('expo-image-manipulator')) as ImageManipulatorModule
    if (typeof mod?.manipulateAsync !== 'function') return u
    const r = await mod.manipulateAsync(
      u,
      actions,
      { compress: 0.76, format: mod.SaveFormat?.JPEG || 'jpeg' },
    )
    return String(r?.uri || '').trim() || u
  } catch {
    return u
  }
}
