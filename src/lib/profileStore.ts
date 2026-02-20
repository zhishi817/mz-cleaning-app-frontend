import { getJson, remove, setJson } from './storage'

export type Profile = {
  avatarUri: string | null
  name: string
  mobileAu: string
  department: string
  title: string
}

const STORAGE_KEY = 'mzstay.profile.v1'

export async function getProfile() {
  return getJson<Profile>(STORAGE_KEY)
}

export async function setProfile(p: Profile) {
  await setJson(STORAGE_KEY, p)
}

export async function clearProfile() {
  await remove(STORAGE_KEY)
}

export function defaultProfileFromUser(user: { username: string; role: string } | null): Profile {
  const username = String(user?.username || '').trim()
  return {
    avatarUri: null,
    name: username || 'Alice',
    mobileAu: '',
    department: String(user?.role || '').trim() || 'Staff',
    title: '',
  }
}

