import { Image } from 'react-native'

type ImageManipulatorModule = {
  manipulateAsync?: (
    uri: string,
    actions: { resize: { width: number } }[],
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
  return await compressImageForLocalStorage(uri, { maxWidth: 1920, quality: 0.76 })
}

export function isCompressibleImageMimeType(mimeType: string) {
  const value = String(mimeType || '').trim().toLowerCase()
  return value.startsWith('image/') && value !== 'image/gif' && value !== 'image/svg+xml'
}

export async function compressImageForLocalStorage(uri: string, options?: { maxWidth?: number; quality?: number }) {
  const u = String(uri || '').trim()
  if (!u) throw new Error('missing uri')
  const size = await getImageSize(u)
  const width = Number(size?.width || 0)
  const maxWidth = Math.max(1, Math.trunc(Number(options?.maxWidth || 1800) || 1800))
  const quality = Math.min(1, Math.max(0.1, Number(options?.quality || 0.72) || 0.72))
  const actions = width > maxWidth ? [{ resize: { width: maxWidth } }] : []
  try {
    const mod = (await import('expo-image-manipulator')) as ImageManipulatorModule
    if (typeof mod?.manipulateAsync !== 'function') return u
    const r = await mod.manipulateAsync(
      u,
      actions,
      { compress: quality, format: mod.SaveFormat?.JPEG || 'jpeg' },
    )
    return String(r?.uri || '').trim() || u
  } catch {
    return u
  }
}
