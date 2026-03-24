import { defaultProfileFromUser, getProfile, setProfile } from './profileStore'

test('profile store persists and restores profile', async () => {
  const p = defaultProfileFromUser({ username: 'demo', role: 'cleaner' })
  const updated = { ...p, display_name: 'Alice', phone_au: '0412 345 678', avatar_url: 'http://example.com/a.png' }
  await setProfile({ id: 'u1', username: 'demo' }, updated)
  const read = await getProfile({ id: 'u1', username: 'demo' })
  expect(read).toMatchObject(updated)
})
