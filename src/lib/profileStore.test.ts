import AsyncStorage from '@react-native-async-storage/async-storage'
import { defaultProfileFromUser, getProfile, setProfile } from './profileStore'

beforeEach(async () => {
  await (AsyncStorage as any).clear()
})

test('profile store persists and restores profile', async () => {
  const p = defaultProfileFromUser({ username: 'demo', role: 'cleaner' })
  const updated = {
    ...p,
    display_name: 'Alice',
    phone_au: '0412 345 678',
    avatar_url: 'http://example.com/a.png',
    visa_document_url: 'http://example.com/visa.jpg',
    visa_grant_number: 'VISA-123456',
  }
  await setProfile({ id: 'u1', username: 'demo' }, updated)
  const read = await getProfile({ id: 'u1', username: 'demo' })
  expect(read).toMatchObject({ ...updated, visa_document_url: 'uploaded' })
  expect(read?.visa_document_url).toBe('uploaded')
})

test('migrates a cached Photo ID URL to a persisted presence marker', async () => {
  const key = 'mzstay.profile.v2:u1'
  await (AsyncStorage as any).setItem(key, JSON.stringify({
    ...defaultProfileFromUser({ username: 'demo', role: 'cleaner' }),
    photo_id_url: 'https://legacy.invalid/private/photo-id.jpg',
    visa_document_url: null,
    visa_grant_number: '',
    owner_id: 'u1',
    owner_username: 'demo',
  }))

  const read = await getProfile({ id: 'u1', username: 'demo' })
  const persisted = JSON.parse((await (AsyncStorage as any).getItem(key)) || '{}')

  expect(read?.photo_id_url).toBe('uploaded')
  expect(persisted.photo_id_url).toBe('uploaded')
  expect(JSON.stringify(persisted)).not.toContain('photo-id.jpg')
})
