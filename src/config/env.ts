export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || '').trim()

export const LOCAL_LOGIN_ENABLED = String(process.env.EXPO_PUBLIC_LOCAL_LOGIN_ENABLED || '').trim() === '1'
export const LOCAL_LOGIN_USERNAME = (process.env.EXPO_PUBLIC_LOCAL_LOGIN_USERNAME || 'demo').trim()
export const LOCAL_LOGIN_PASSWORD = (process.env.EXPO_PUBLIC_LOCAL_LOGIN_PASSWORD || 'demo1234').trim()
export const LOCAL_LOGIN_ROLE = (process.env.EXPO_PUBLIC_LOCAL_LOGIN_ROLE || 'cleaner').trim() || 'cleaner'
