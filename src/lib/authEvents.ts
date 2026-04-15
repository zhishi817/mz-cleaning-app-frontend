export type AuthInvalidationReason = 'session_expired'

type AuthInvalidatedListener = (reason: AuthInvalidationReason) => void

const listeners = new Set<AuthInvalidatedListener>()

export function subscribeAuthInvalidated(listener: AuthInvalidatedListener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function notifyAuthInvalidated(reason: AuthInvalidationReason = 'session_expired') {
  for (const listener of Array.from(listeners)) {
    try {
      listener(reason)
    } catch {}
  }
}
