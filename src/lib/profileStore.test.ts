import { defaultProfileFromUser, getProfile, setProfile } from './profileStore'

test('profile store persists and restores profile', async () => {
  const p = defaultProfileFromUser({ username: 'demo', role: 'cleaner' })
  const updated = { ...p, name: 'Alice', mobileAu: '0412 345 678', department: 'Ops', title: 'Lead' }
  await setProfile(updated)
  const read = await getProfile()
  expect(read).toEqual(updated)
})

