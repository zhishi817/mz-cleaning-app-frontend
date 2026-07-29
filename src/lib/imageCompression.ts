import { Image } from 'react-native'

type ImageManipulatorModule = {
  manipulateAsync?: (
    uri: string,
    actions: { resize: { width: number } }[],
    saveOptions: { compress: number; format: string },
  ) => Promise<{ uri?: string | null }>
  SaveFormat?: { JPEG?: string }
  default?: ImageManipulatorModule
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
    const mod = require('expo-image-manipulator') as ImageManipulatorModule
    const manipulateAsync = mod?.manipulateAsync || mod?.default?.manipulateAsync
    const saveFormat = mod?.SaveFormat || mod?.default?.SaveFormat
    if (typeof manipulateAsync !== 'function') {
      const error: any = new Error('照片格式转换失败，请重新拍摄')
      error.code = 'IMAGE_CONVERSION_FAILED'
      throw error
    }
    const r = await manipulateAsync(
      u,
      actions,
      { compress: quality, format: saveFormat?.JPEG || 'jpeg' },
    )
    const outputUri = String(r?.uri || '').trim()
    if (!outputUri || outputUri === u) {
      const error: any = new Error('照片格式转换失败，请重新拍摄')
      error.code = 'IMAGE_CONVERSION_FAILED'
      throw error
    }
    return outputUri
  } catch (error: any) {
    if (error?.code === 'IMAGE_CONVERSION_FAILED') throw error
    const conversionError: any = new Error('照片格式转换失败，请重新拍摄')
    conversionError.code = 'IMAGE_CONVERSION_FAILED'
    throw conversionError
  }
}
