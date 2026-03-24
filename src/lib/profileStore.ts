import { getJson, remove, setJson } from './storage'

export type Profile = {
  avatar_url: string | null
  display_name: string
  phone_au: string
  owner_id?: string
  owner_username?: string
}

const LEGACY_STORAGE_KEY = 'mzstay.profile.v1'
function storageKey(ownerId: string) {
  return `mzstay.profile.v2:${ownerId}`
}

export async function getProfile(owner: { id?: string | null; username?: string | null } | null) {
  const id = String(owner?.id || '').trim()
  if (!id) return null
  const key = storageKey(id)
  const v2 = await getJson<Profile>(key)
  if (v2) return v2
  const legacy = await getJson<any>(LEGACY_STORAGE_KEY)
  if (!legacy) return null
  const legacyName = String(legacy.name || legacy.display_name || '').trim()
  const u = String(owner?.username || '').trim()
  if (legacyName && u && legacyName === u) {
    const migrated: Profile = {
      avatar_url: legacy.avatarUri || legacy.avatar_url || null,
      display_name: legacy.name || legacy.display_name || u,
      phone_au: legacy.mobileAu || legacy.phone_au || '',
      owner_id: id,
      owner_username: u,
    }
    await setJson(key, migrated)
    return migrated
  }
  return null
}

export async function setProfile(owner: { id?: string | null; username?: string | null } | null, p: Profile) {
  const id = String(owner?.id || '').trim()
  if (!id) return
  const u = String(owner?.username || '').trim()
  await setJson(storageKey(id), { ...p, owner_id: id, owner_username: u || undefined })
}

export async function clearProfile() {
  await remove(LEGACY_STORAGE_KEY)
}

export function defaultProfileFromUser(user: { username: string; role: string } | null): Profile {
  const username = String(user?.username || '').trim()
  return {
    avatar_url: null,
    display_name: username || 'User',
    phone_au: '',
  }
}
