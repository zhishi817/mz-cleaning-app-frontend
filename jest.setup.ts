jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>()
  return {
    setItem: jest.fn(async (key: string, value: string) => {
      store.set(key, value)
    }),
    getItem: jest.fn(async (key: string) => {
      return store.has(key) ? store.get(key)! : null
    }),
    removeItem: jest.fn(async (key: string) => {
      store.delete(key)
    }),
    multiRemove: jest.fn(async (keys: string[]) => {
      for (const k of keys) store.delete(k)
    }),
    clear: jest.fn(async () => {
      store.clear()
    }),
  }
})

jest.mock('@expo/vector-icons', () => {
  const React = require('react')
  const MockIcon = (props: any) => React.createElement('Icon', props, null)
  return {
    Ionicons: MockIcon,
  }
})

jest.mock('expo-image-picker', () => {
  return {
    MediaTypeOptions: { Images: 'Images' },
    requestCameraPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
    requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
    launchCameraAsync: jest.fn(async () => ({
      canceled: false,
      assets: [{ uri: 'file://test-camera.jpg' }],
    })),
    launchImageLibraryAsync: jest.fn(async () => ({
      canceled: false,
      assets: [{ uri: 'file://test-library.jpg' }],
    })),
  }
})

jest.mock('expo-image-manipulator', () => {
  return {
    SaveFormat: { JPEG: 'jpeg' },
    manipulateAsync: jest.fn(async (uri: string) => ({ uri })),
  }
})

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>()
  return {
    getItemAsync: jest.fn(async (key: string) => (store.has(key) ? store.get(key)! : null)),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value)
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key)
    }),
  }
})
