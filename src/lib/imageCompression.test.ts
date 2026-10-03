const mockManipulateAsync = jest.fn()

jest.mock('react-native', () => ({
  Image: {
    getSize: (_uri: string, onSuccess: (width: number, height: number) => void) => onSuccess(1200, 900),
  },
}))

jest.mock('expo-image-manipulator', () => ({
  __esModule: true,
  manipulateAsync: mockManipulateAsync,
  SaveFormat: { JPEG: 'jpeg' },
}))

beforeEach(() => {
  mockManipulateAsync.mockReset()
})

test('converts a captured image to a new JPEG URI', async () => {
  mockManipulateAsync.mockResolvedValue({ uri: 'file:///cache/photo.jpg' })
  const { compressImageForUpload } = require('./imageCompression') as typeof import('./imageCompression')

  await expect(compressImageForUpload('file:///camera/photo.heic')).resolves.toBe('file:///cache/photo.jpg')
  expect(mockManipulateAsync).toHaveBeenCalledWith(
    'file:///camera/photo.heic',
    [],
    { compress: 0.76, format: 'jpeg' },
  )
})

test('does not fall back to uploading the source when conversion fails', async () => {
  mockManipulateAsync.mockRejectedValue(new Error('unsupported image format'))
  const { compressImageForUpload } = require('./imageCompression') as typeof import('./imageCompression')

  await expect(compressImageForUpload('file:///camera/photo.heic')).rejects.toMatchObject({
    code: 'IMAGE_CONVERSION_FAILED',
  })
})

test('does not accept the source URI as a fake conversion result', async () => {
  mockManipulateAsync.mockResolvedValue({ uri: 'file:///camera/photo.heic' })
  const { compressImageForUpload } = require('./imageCompression') as typeof import('./imageCompression')

  await expect(compressImageForUpload('file:///camera/photo.heic')).rejects.toMatchObject({
    code: 'IMAGE_CONVERSION_FAILED',
  })
})
