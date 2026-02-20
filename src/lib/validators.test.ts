import { validateEmail, validateLoginForm } from './validators'

test('validateLoginForm requires username and password', () => {
  const r = validateLoginForm({ username: ' ', password: '' })
  expect(r.errors.username).toBeTruthy()
  expect(r.errors.password).toBeTruthy()
})

test('validateLoginForm trims fields', () => {
  const r = validateLoginForm({ username: ' admin ', password: ' 123 ' })
  expect(r.username).toBe('admin')
  expect(r.password).toBe('123')
  expect(r.errors).toEqual({})
})

test('validateEmail checks format', () => {
  expect(validateEmail({ email: '' }).errors.email).toBeTruthy()
  expect(validateEmail({ email: 'nope' }).errors.email).toBeTruthy()
  expect(validateEmail({ email: 'a@b.com' }).errors.email).toBeUndefined()
})

