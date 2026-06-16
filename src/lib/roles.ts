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

export function permissionCodesOf(user: any): string[] {
  const values = Array.isArray(user?.permissions) ? user.permissions : []
  return Array.from(new Set(values.map((x: any) => String(x || '').trim()).filter(Boolean)))
}

export function hasPermission(user: any, code: string) {
  const wanted = String(code || '').trim()
  if (!wanted) return false
  return permissionCodesOf(user).includes(wanted)
}

export function hasAnyPermission(user: any, codes: string[]) {
  const set = new Set(permissionCodesOf(user))
  return (codes || []).some((code) => set.has(String(code || '').trim()))
}

export function isTaskManagerUser(user: any) {
  return hasAnyRole(user, ['admin', 'offline_manager', 'customer_service'])
}

export function canSwitchTaskMode(user: any) {
  return isTaskManagerUser(user) && hasAnyRole(user, ['cleaner', 'cleaner_inspector'])
}

export function isTaskInspectorUser(user: any) {
  return hasAnyRole(user, ['cleaning_inspector', 'cleaner_inspector'])
}
