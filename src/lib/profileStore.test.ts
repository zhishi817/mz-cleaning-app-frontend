import { defaultProfileFromUser, getProfile, setProfile } from './profileStore'

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
