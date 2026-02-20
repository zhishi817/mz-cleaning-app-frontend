import AsyncStorage from '@react-native-async-storage/async-storage'
import { LOCALE_STORAGE_KEY } from './i18n'
import { NOTICES_STORAGE_KEY } from './noticesStore'

const PROFILE_KEY = 'mzstay.profile.v1'
const TASKS_KEY = 'mzstay.tasks.store.v1'
const REPAIRS_KEY = 'mzstay.repairs.store.v1'

export async function clearAppLocalData() {
  await AsyncStorage.multiRemove([LOCALE_STORAGE_KEY, NOTICES_STORAGE_KEY, PROFILE_KEY, TASKS_KEY, REPAIRS_KEY])
}
