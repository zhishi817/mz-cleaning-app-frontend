export function roleNamesOf(user: any): string[] {
  const values = Array.isArray(user?.roles) ? user.roles : []
  const ids = values.map((x: any) => String(x || '').trim()).filter(Boolean)
  const primary = String(user?.role || '').trim()
  if (primary) ids.unshift(primary)
  return Array.from(new Set(ids))
}

export function hasRole(user: any, roleName: string) {
  return roleNamesOf(user).includes(String(roleName || '').trim())
}

export function hasAnyRole(user: any, roleNames: string[]) {
  const set = new Set(roleNamesOf(user))
  return (roleNames || []).some((roleName) => set.has(String(roleName || '').trim()))
}

export function isTaskManagerUser(user: any) {
  return hasAnyRole(user, ['admin', 'offline_manager', 'customer_service'])
}

export function isTaskInspectorUser(user: any) {
  return hasAnyRole(user, ['cleaning_inspector', 'cleaner_inspector'])
}
