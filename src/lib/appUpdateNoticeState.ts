import AsyncStorage from '@react-native-async-storage/async-storage'
import type { AppReleaseNotes } from './appReleaseNotes'

export const APP_UPDATE_NOTICE_STORAGE_KEY = 'mzstay.app_update_notice.v1'

export type AppUpdatePendingTarget = {
  update_id: string
  runtime_version: string | null
  channel: string | null
  platform: 'ios' | 'android'
  created_at: string | null
  observed_at: string
}
export type AppUpdateAppliedRecord = {
  update_id: string
  runtime_version: string | null
  channel: string | null
  platform: 'ios' | 'android'
  applied_at: string
  release: AppReleaseNotes | null
}

export type AppUpdateNoticeStoredState = {
  version: 1
  last_seen_update_id: string | null
  pending: AppUpdatePendingTarget | null
  dismissed_pending_id: string | null
  acknowledged_applied_id: string | null
  last_applied: AppUpdateAppliedRecord | null
}

export type AppUpdateNoticeView =
  | { kind: 'unsupported' }
  | { kind: 'current' }
  | { kind: 'pending'; target: AppUpdatePendingTarget }
  | { kind: 'applied'; applied: AppUpdateAppliedRecord }
  | { kind: 'rollback_pending' }
  | { kind: 'rolled_back' }
  | { kind: 'cache_missing'; target: AppUpdatePendingTarget }
  | { kind: 'emergency' }

export type AppUpdateNoticeResolution = {
  state: AppUpdateNoticeStoredState
  view: AppUpdateNoticeView
  should_prompt: boolean
}

const EMPTY_STATE: AppUpdateNoticeStoredState = {
  version: 1,
  last_seen_update_id: null,
  pending: null,
  dismissed_pending_id: null,
  acknowledged_applied_id: null,
  last_applied: null,
}

function cleanText(value: unknown) {
  return String(value || '').trim()
}

function cleanNullable(value: unknown) {
  return cleanText(value) || null
}

function normalizePlatform(value: unknown): 'ios' | 'android' | null {
  return value === 'ios' || value === 'android' ? value : null
}

function normalizeRelease(value: unknown): AppReleaseNotes | null {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : null
  const releaseKey = cleanText(row?.release_key)
  const title = cleanText(row?.title)
  const items = Array.isArray(row?.items) ? row.items.map(cleanText).filter(Boolean).slice(0, 12) : []
  if (!releaseKey || !title) return null
  return { release_key: releaseKey, title, items }
}

export function normalizeAppUpdatePendingTarget(value: unknown): AppUpdatePendingTarget | null {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : null
  const updateId = cleanText(row?.update_id)
  const platform = normalizePlatform(row?.platform)
  const observedAt = cleanText(row?.observed_at)
  if (!row || !updateId || !platform || !observedAt) return null
  return {
    update_id: updateId,
    runtime_version: cleanNullable(row.runtime_version),
    channel: cleanNullable(row.channel),
    platform,
    created_at: cleanNullable(row.created_at),
    observed_at: observedAt,
  }
}

export function normalizeAppUpdateAppliedRecord(value: unknown): AppUpdateAppliedRecord | null {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : null
  const updateId = cleanText(row?.update_id)
  const platform = normalizePlatform(row?.platform)
  const appliedAt = cleanText(row?.applied_at)
  if (!row || !updateId || !platform || !appliedAt) return null
  return {
    update_id: updateId,
    runtime_version: cleanNullable(row.runtime_version),
    channel: cleanNullable(row.channel),
    platform,
    applied_at: appliedAt,
    release: normalizeRelease(row.release),
  }
}

export function normalizeAppUpdateNoticeState(value: unknown): AppUpdateNoticeStoredState {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : null
  if (!row || row.version !== 1) return { ...EMPTY_STATE }
  return {
    version: 1,
    last_seen_update_id: cleanNullable(row.last_seen_update_id),
    pending: normalizeAppUpdatePendingTarget(row.pending),
    dismissed_pending_id: cleanNullable(row.dismissed_pending_id),
    acknowledged_applied_id: cleanNullable(row.acknowledged_applied_id),
    last_applied: normalizeAppUpdateAppliedRecord(row.last_applied),
  }
}

export async function loadAppUpdateNoticeState() {
  const raw = await AsyncStorage.getItem(APP_UPDATE_NOTICE_STORAGE_KEY)
  if (!raw) return { ...EMPTY_STATE }
  try { return normalizeAppUpdateNoticeState(JSON.parse(raw)) } catch { return { ...EMPTY_STATE } }
}

export async function saveAppUpdateNoticeState(state: AppUpdateNoticeStoredState) {
  const normalized = normalizeAppUpdateNoticeState(state)
  await AsyncStorage.setItem(APP_UPDATE_NOTICE_STORAGE_KEY, JSON.stringify(normalized))
  return normalized
}

export function appUpdatePendingTarget(input: {
  updateId: unknown
  runtimeVersion: unknown
  channel: unknown
  platform: unknown
  createdAt: unknown
  observedAt?: string
}): AppUpdatePendingTarget | null {
  return normalizeAppUpdatePendingTarget({
    update_id: input.updateId,
    runtime_version: input.runtimeVersion,
    channel: input.channel,
    platform: input.platform,
    created_at: input.createdAt instanceof Date ? input.createdAt.toISOString() : input.createdAt,
    observed_at: input.observedAt || new Date().toISOString(),
  })
}

export function resolveAppUpdateNotice(input: {
  stored: AppUpdateNoticeStoredState
  enabled: boolean
  startupComplete: boolean
  runningUpdateId: unknown
  runtimeVersion: unknown
  channel: unknown
  platform: unknown
  isEmbeddedLaunch: boolean
  isEmergencyLaunch: boolean
  downloadedTarget: AppUpdatePendingTarget | null
  updatePending: boolean
  rollbackPending: boolean
  release: AppReleaseNotes | null
  now?: string
}): AppUpdateNoticeResolution {
  const state = normalizeAppUpdateNoticeState(input.stored)
  if (!input.enabled || !normalizePlatform(input.platform)) return { state, view: { kind: 'unsupported' }, should_prompt: false }
  if (!input.startupComplete) return { state, view: state.pending ? { kind: 'pending', target: state.pending } : { kind: 'current' }, should_prompt: false }
  if (input.isEmergencyLaunch) return { state, view: { kind: 'emergency' }, should_prompt: false }

  const runningUpdateId = cleanText(input.runningUpdateId)
  const now = input.now || new Date().toISOString()
  const platform = normalizePlatform(input.platform)!
  const makeApplied = (): AppUpdateAppliedRecord => ({
    update_id: runningUpdateId,
    runtime_version: cleanNullable(input.runtimeVersion),
    channel: cleanNullable(input.channel),
    platform,
    applied_at: now,
    release: normalizeRelease(input.release),
  })

  if (input.rollbackPending) {
    return { state, view: { kind: 'rollback_pending' }, should_prompt: false }
  }

  if (input.updatePending && !input.downloadedTarget) {
    return {
      state,
      view: state.pending ? { kind: 'pending', target: state.pending } : { kind: 'current' },
      should_prompt: false,
    }
  }

  if (input.updatePending && input.downloadedTarget && input.downloadedTarget.update_id !== runningUpdateId) {
    const next = {
      ...state,
      pending: input.downloadedTarget,
      dismissed_pending_id: state.pending?.update_id === input.downloadedTarget.update_id ? state.dismissed_pending_id : null,
    }
    return {
      state: next,
      view: { kind: 'pending', target: input.downloadedTarget },
      should_prompt: next.dismissed_pending_id !== input.downloadedTarget.update_id,
    }
  }

  const pendingApplied = !!runningUpdateId && state.pending?.update_id === runningUpdateId
  const runningChanged = !!runningUpdateId && !!state.last_seen_update_id && state.last_seen_update_id !== runningUpdateId
  if (pendingApplied) {
    const applied = makeApplied()
    const next = {
      ...state,
      last_seen_update_id: runningUpdateId,
      pending: null,
      dismissed_pending_id: null,
      last_applied: applied,
    }
    return {
      state: next,
      view: { kind: 'applied', applied },
      should_prompt: next.acknowledged_applied_id !== runningUpdateId,
    }
  }

  if (state.pending && runningUpdateId !== state.pending.update_id) {
    return {
      state: { ...state, pending: null, dismissed_pending_id: null, last_seen_update_id: runningUpdateId || state.last_seen_update_id },
      view: { kind: 'cache_missing', target: state.pending },
      should_prompt: false,
    }
  }

  if (runningChanged && input.isEmbeddedLaunch) {
    return {
      state: { ...state, last_seen_update_id: runningUpdateId || state.last_seen_update_id, pending: null, dismissed_pending_id: null },
      view: { kind: 'rolled_back' },
      should_prompt: false,
    }
  }

  if (runningChanged) {
    return {
      state: { ...state, last_seen_update_id: runningUpdateId },
      view: { kind: 'current' },
      should_prompt: false,
    }
  }

  const next = runningUpdateId && !state.last_seen_update_id
    ? { ...state, last_seen_update_id: runningUpdateId }
    : state
  return { state: next, view: { kind: 'current' }, should_prompt: false }
}

export function dismissPendingAppUpdate(state: AppUpdateNoticeStoredState, updateId: string) {
  return normalizeAppUpdateNoticeState({ ...state, dismissed_pending_id: cleanText(updateId) || null })
}

export function acknowledgeAppliedAppUpdate(state: AppUpdateNoticeStoredState, updateId: string) {
  return normalizeAppUpdateNoticeState({ ...state, acknowledged_applied_id: cleanText(updateId) || null })
}
