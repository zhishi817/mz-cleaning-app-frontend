import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useRef, useState } from 'react'
import { listInspectionPanelDraftRecoverySnapshots } from './inspectionPanelDraftRecovery'

export type AppRestartBlockerKind = 'unsaved' | 'uploading' | 'submitting' | 'storage_error' | 'state_changing'

export type AppRestartBlocker = {
  kind: AppRestartBlockerKind
  message: string
}

export type AppRestartSafetyResult = {
  safe: boolean
  generation: number
  blockers: AppRestartBlocker[]
}

const runtimeBlockers = new Map<string, AppRestartBlocker>()
const listeners = new Set<() => void>()
let generation = 0
let reservation: symbol | null = null

const QUEUE_KEYS = new Set([
  'mzstay.inspection_media_queue.v1',
  'mzstay.inspection_panel_submit_queue.v1',
  'mzstay.key_upload_queue.v2',
  'mzstay.day_end_handover_queue.v2',
  'mzstay.cleaning_consumables_submit_queue.v1',
  'mzstay.cleaning_consumables_submit_queue.v2',
])

const DRAFT_PREFIXES = [
  'mzstay.inspection_panel_draft.v2:',
  'mzstay.inspection_panel_feedback_draft.v1:',
  'mzstay.inspection_post_submit_issue_draft.v1:',
  'mzstay.cleaning_consumables_draft.v1:',
  'mzstay.cleaning_consumables_draft.v2:',
  'mzstay.maintenance_completion_photo_draft.v1:',
  'mzstay.work_task_completion_photo_pending.v1:',
  'personnel-claim-draft:v1:',
  'feedback_form_draft_v2_',
]

function emit() {
  generation += 1
  for (const listener of listeners) {
    try {
      listener()
    } catch {}
  }
}

function cleanText(value: unknown) {
  return String(value || '').trim()
}

function addBlocker(target: AppRestartBlocker[], blocker: AppRestartBlocker) {
  if (!target.some((item) => item.kind === blocker.kind && item.message === blocker.message)) target.push(blocker)
}

function parseStoredValue(raw: string | null) {
  if (raw === null) return null
  return JSON.parse(raw)
}

function hasArrayItem(value: unknown, predicate: (item: any) => boolean) {
  return Array.isArray(value) && value.some(predicate)
}

function queueBlocker(key: string, value: any): AppRestartBlocker | null {
  if (key === 'mzstay.inspection_media_queue.v1') {
    return hasArrayItem(value, (item) => item && item.upload_status !== 'expired_local_cleaned' && item.business_saved !== true)
      ? { kind: 'uploading', message: '有照片或视频尚未上传并保存完成' }
      : null
  }
  if (key === 'mzstay.inspection_panel_submit_queue.v1') {
    return hasArrayItem(value, (item) => cleanText(item?.status) !== 'synced')
      ? { kind: 'submitting', message: '有检查记录仍在提交队列中' }
      : null
  }
  if (key === 'mzstay.key_upload_queue.v2') {
    return hasArrayItem(value, (item) => cleanText(item?.status) !== 'synced')
      ? { kind: 'uploading', message: '有钥匙照片仍在上传或等待保存' }
      : null
  }
  if (key === 'mzstay.cleaning_consumables_submit_queue.v1') {
    return Array.isArray(value) && value.length
      ? { kind: 'submitting', message: '有补品记录仍在提交队列中' }
      : null
  }
  if (key === 'mzstay.cleaning_consumables_submit_queue.v2') {
    return hasArrayItem(value, (item) => cleanText(item?.status) !== 'synced')
      ? { kind: 'submitting', message: '有补品记录仍在提交队列中' }
      : null
  }
  if (key === 'mzstay.day_end_handover_queue.v2') {
    const entries = value && typeof value === 'object' ? Object.values(value) : []
    return entries.some((item: any) => {
      if (!item || typeof item !== 'object') return false
      if (item.pending_submit === true || cleanText(item.status) === 'syncing') return true
      const groups = ['key_items', 'warehouse_key_items', 'return_wash_items', 'reject_items', 'consumable_items']
      return groups.some((name) => hasArrayItem(item[name], (entry) => {
        const status = cleanText(entry?.status || entry?.upload_status)
        return status !== 'synced' && status !== 'uploaded' && status !== 'succeeded'
      }))
    })
      ? { kind: 'submitting', message: '有日结照片或记录尚未提交完成' }
      : null
  }
  return null
}

function isDraftKey(key: string) {
  return DRAFT_PREFIXES.some((prefix) => key.startsWith(prefix))
}

function hasMeaningfulDraft(value: any) {
  if (value === null || value === undefined) return false
  if (Array.isArray(value)) return value.length > 0
  if (typeof value !== 'object') return cleanText(value).length > 0
  if (Array.isArray(value.photos)) return value.photos.length > 0
  if (Array.isArray(value.photo_references)) return value.photo_references.length > 0
  return Object.keys(value).length > 0
}

function runtimeSnapshot() {
  return Array.from(runtimeBlockers.values())
}

async function scanPersistentBlockers() {
  const blockers: AppRestartBlocker[] = []
  const getAllKeys = (AsyncStorage as any).getAllKeys
  if (typeof getAllKeys !== 'function') throw new Error('APP_RESTART_STORAGE_ENUMERATION_UNAVAILABLE')
  const keys = await getAllKeys()
  for (const key0 of Array.isArray(keys) ? keys : []) {
    const key = cleanText(key0)
    if (!QUEUE_KEYS.has(key) && !isDraftKey(key)) continue
    const value = parseStoredValue(await AsyncStorage.getItem(key))
    if (QUEUE_KEYS.has(key)) {
      const blocker = queueBlocker(key, value)
      if (blocker) addBlocker(blockers, blocker)
    } else if (hasMeaningfulDraft(value)) {
      addBlocker(blockers, { kind: 'unsaved', message: '有尚未完成的本地表单或照片草稿' })
    }
  }
  const recoverySnapshots = await listInspectionPanelDraftRecoverySnapshots()
  if (recoverySnapshots.length) {
    addBlocker(blockers, { kind: 'unsaved', message: '有尚未恢复或提交的检查照片草稿' })
  }
  return blockers
}

export function subscribeAppRestartSafety(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function notifyAppRestartSafetyStateChanged() {
  emit()
}

export function setAppRestartBlocker(id: string, blocker: AppRestartBlocker | null) {
  const key = cleanText(id)
  if (!key) return
  const previous = runtimeBlockers.get(key)
  if (!blocker) {
    if (runtimeBlockers.delete(key)) emit()
    return
  }
  if (previous?.kind === blocker.kind && previous.message === blocker.message) return
  runtimeBlockers.set(key, blocker)
  emit()
}

export function useAppRestartBlocker(id: string, active: boolean, blocker: AppRestartBlocker) {
  const blockerRef = useRef(blocker)
  blockerRef.current = blocker
  useEffect(() => {
    if (!active) {
      setAppRestartBlocker(id, null)
      return
    }
    setAppRestartBlocker(id, blockerRef.current)
    return () => setAppRestartBlocker(id, null)
  }, [active, id, blocker.kind, blocker.message])
}

function navigationIsFocused(navigation: any) {
  try {
    return typeof navigation?.isFocused === 'function' ? navigation.isFocused() !== false : true
  } catch {
    return true
  }
}

export function useAppRestartScreenFocus(navigation: any) {
  const [focused, setFocused] = useState(() => navigationIsFocused(navigation))
  useEffect(() => {
    setFocused(navigationIsFocused(navigation))
    const unsubscribeFocus = navigation?.addListener?.('focus', () => setFocused(true))
    const unsubscribeBlur = navigation?.addListener?.('blur', () => setFocused(false))
    return () => {
      if (typeof unsubscribeFocus === 'function') unsubscribeFocus()
      if (typeof unsubscribeBlur === 'function') unsubscribeBlur()
    }
  }, [navigation])
  return focused
}

export function beginAppRestartUnsafeOperation(id: string, blocker: AppRestartBlocker) {
  const key = `${cleanText(id) || 'operation'}:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`
  let active = true
  setAppRestartBlocker(key, blocker)
  return () => {
    if (!active) return
    active = false
    setAppRestartBlocker(key, null)
  }
}

export async function checkAppRestartSafety(): Promise<AppRestartSafetyResult> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const before = generation
    const blockers = runtimeSnapshot()
    try {
      for (const blocker of await scanPersistentBlockers()) addBlocker(blockers, blocker)
    } catch {
      addBlocker(blockers, { kind: 'storage_error', message: '无法核对本地草稿和上传队列，请稍后重试' })
    }
    if (before === generation) {
      return { safe: blockers.length === 0, generation: before, blockers }
    }
  }
  return {
    safe: false,
    generation,
    blockers: [{ kind: 'state_changing', message: '表单或上传状态正在变化，请等待片刻后重试' }],
  }
}

export function reserveAppRestart(expectedGeneration: number) {
  if (reservation || expectedGeneration !== generation || runtimeBlockers.size > 0) return null
  const token = Symbol('app-restart')
  reservation = token
  return token
}

export function releaseAppRestartReservation(token: symbol | null) {
  if (token && reservation === token) reservation = null
}

export function __resetAppRestartSafetyForTests() {
  runtimeBlockers.clear()
  reservation = null
  generation = 0
  listeners.clear()
}
