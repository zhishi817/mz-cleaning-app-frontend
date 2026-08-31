import { getJson, remove, setJson } from './storage'

export type Profile = {
  avatar_url: string | null
  display_name: string
  phone_au: string
  legal_name: string
  bank_account_name: string
  bank_bsb: string
  bank_account_number: string
  personal_abn: string
  photo_id_url: string | null
  visa_document_url: string | null
  visa_grant_number: string
  owner_id?: string
  owner_username?: string
}

export const PROFILE_DOCUMENT_PRESENT = 'uploaded'

export function profileDocumentPresence(value: unknown): string | null {
  return String(value || '').trim() ? PROFILE_DOCUMENT_PRESENT : null
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
  if (v2) {
    const normalized: Profile = {
      ...v2,
      photo_id_url: profileDocumentPresence(v2.photo_id_url),
      visa_document_url: profileDocumentPresence(v2.visa_document_url),
      visa_grant_number: v2.visa_grant_number || '',
    }
    if (
      normalized.photo_id_url !== v2.photo_id_url ||
      normalized.visa_document_url !== v2.visa_document_url ||
      normalized.visa_grant_number !== v2.visa_grant_number
    ) {
      await setJson(key, normalized)
    }
    return normalized
  }
  const legacy = await getJson<any>(LEGACY_STORAGE_KEY)
  if (!legacy) return null
  const legacyName = String(legacy.name || legacy.display_name || '').trim()
  const u = String(owner?.username || '').trim()
  if (legacyName && u && legacyName === u) {
    const migrated: Profile = {
      avatar_url: legacy.avatarUri || legacy.avatar_url || null,
      display_name: legacy.name || legacy.display_name || u,
      phone_au: legacy.mobileAu || legacy.phone_au || '',
      legal_name: legacy.legal_name || '',
      bank_account_name: legacy.bank_account_name || '',
      bank_bsb: legacy.bank_bsb || '',
      bank_account_number: legacy.bank_account_number || '',
      personal_abn: legacy.personal_abn || '',
      photo_id_url: profileDocumentPresence(legacy.photo_id_url),
      visa_document_url: profileDocumentPresence(legacy.visa_document_url),
      visa_grant_number: legacy.visa_grant_number || '',
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
  await setJson(storageKey(id), {
    ...p,
    photo_id_url: profileDocumentPresence(p.photo_id_url),
    visa_document_url: profileDocumentPresence(p.visa_document_url),
    owner_id: id,
    owner_username: u || undefined,
  })
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
    legal_name: '',
    bank_account_name: '',
    bank_bsb: '',
    bank_account_number: '',
    personal_abn: '',
    photo_id_url: null,
    visa_document_url: null,
    visa_grant_number: '',
  }
}
