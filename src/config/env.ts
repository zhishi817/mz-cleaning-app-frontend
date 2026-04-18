function env(name: string) {
  return String((process.env as any)?.[name] || '').trim()
}

const DEFAULT_API_BASE_DEV = 'https://mz-property-system-v3-2.onrender.com'
const DEFAULT_API_BASE_PROD = 'https://mz-property-system-v3-docker.onrender.com'

const apiBaseOverride = env('EXPO_PUBLIC_API_BASE_URL')
const apiBaseDev = apiBaseOverride || env('EXPO_PUBLIC_API_BASE_URL_DEV') || DEFAULT_API_BASE_DEV
const apiBaseProd = apiBaseOverride || env('EXPO_PUBLIC_API_BASE_URL_PROD') || DEFAULT_API_BASE_PROD

const appEnv = env('EXPO_PUBLIC_APP_ENV')

export const API_BASE_URL = (
  appEnv === 'dev' ? apiBaseDev : appEnv === 'prod' ? apiBaseProd : __DEV__ ? apiBaseDev : apiBaseProd
).trim()

export const LOCAL_LOGIN_ENABLED = String(process.env.EXPO_PUBLIC_LOCAL_LOGIN_ENABLED || '').trim() === '1'
export const LOCAL_LOGIN_USERNAME = (process.env.EXPO_PUBLIC_LOCAL_LOGIN_USERNAME || 'demo').trim()
export const LOCAL_LOGIN_PASSWORD = (process.env.EXPO_PUBLIC_LOCAL_LOGIN_PASSWORD || 'demo1234').trim()
export const LOCAL_LOGIN_ROLE = (process.env.EXPO_PUBLIC_LOCAL_LOGIN_ROLE || 'cleaner').trim() || 'cleaner'
