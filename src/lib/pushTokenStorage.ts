import AsyncStorage from '@react-native-async-storage/async-storage'

const EXPO_PUSH_TOKEN_KEY = 'mzstay.push.expo_token'

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
