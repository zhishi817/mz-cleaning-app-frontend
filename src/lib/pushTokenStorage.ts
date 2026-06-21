import AsyncStorage from '@react-native-async-storage/async-storage'

const EXPO_PUSH_TOKEN_KEY = 'mzstay.push.expo_token'
const PUSH_DEVICE_ID_KEY = 'mzstay.push.device_id'

export async function setRegisteredExpoPushToken(token: string) {
  const value = String(token || '').trim()
  if (!value) {
    await AsyncStorage.removeItem(EXPO_PUSH_TOKEN_KEY)
    return
  }
  await AsyncStorage.setItem(EXPO_PUSH_TOKEN_KEY, value)
}

export async function getRegisteredExpoPushToken() {
  return String((await AsyncStorage.getItem(EXPO_PUSH_TOKEN_KEY)) || '').trim() || null
}

export async function clearRegisteredExpoPushToken() {
  await AsyncStorage.removeItem(EXPO_PUSH_TOKEN_KEY)
}

function randomSegment() {
  return Math.random().toString(36).slice(2, 10)
}

export async function getPushDeviceId() {
  const existing = String((await AsyncStorage.getItem(PUSH_DEVICE_ID_KEY)) || '').trim()
  if (existing) return existing
  const next = `pushdev_${Date.now().toString(36)}_${randomSegment()}${randomSegment()}`
  await AsyncStorage.setItem(PUSH_DEVICE_ID_KEY, next)
  return next
}
