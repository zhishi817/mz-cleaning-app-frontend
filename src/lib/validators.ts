export type ValidationErrors<T extends Record<string, unknown>> = Partial<Record<keyof T, string>>

export function validateLoginForm(input: { username: string; password: string }) {
  const errors: ValidationErrors<typeof input> = {}
  const username = input.username.trim()
  const password = input.password.trim()

  if (!username) errors.username = '请输入用户名/手机号'
  if (!password) errors.password = '请输入密码'

  return { username, password, errors }
}

export function validateEmail(input: { email: string }) {
  const errors: ValidationErrors<typeof input> = {}
  const email = input.email.trim()
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  if (!email) errors.email = '请输入邮箱'
  else if (!ok) errors.email = '邮箱格式不正确'
  return { email, errors }
}

