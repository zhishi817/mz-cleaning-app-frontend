import type { ManualCleaningTurnoverLinkCandidate } from './api'

export type ManualTurnoverLinkChoice = string | 'independent' | null

export function createManualCleaningRequestId() {
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.map((value) => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function normalizeManualTurnoverLinkCandidates(value: unknown) {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value
    .map((item: any) => ({
      id: String(item?.id || '').trim(),
      property_id: String(item?.property_id || '').trim(),
      property_code: String(item?.property_code || '').trim(),
      task_date: String(item?.task_date || '').slice(0, 10),
      checkout_time: String(item?.checkout_time || '').trim() || null,
      checkin_time: String(item?.checkin_time || '').trim() || null,
      status: String(item?.status || '').trim() || null,
      inspection_scope: item?.inspection_scope === 'password_only' ? 'password_only' as const : item?.inspection_scope === 'inspect_and_hang' ? 'inspect_and_hang' as const : null,
    }))
    .filter((item) => {
      if (!item.id || seen.has(item.id)) return false
      seen.add(item.id)
      return true
    }) as ManualCleaningTurnoverLinkCandidate[]
}

export function defaultManualTurnoverLinkChoice(candidates: ManualCleaningTurnoverLinkCandidate[]): ManualTurnoverLinkChoice {
  if (candidates.length === 0) return 'independent'
  if (candidates.length === 1) return candidates[0].id
  return null
}

export function reconcileManualTurnoverLinkChoice(
  previous: ManualTurnoverLinkChoice,
  candidates: ManualCleaningTurnoverLinkCandidate[],
): ManualTurnoverLinkChoice {
  if (previous === 'independent') return previous
  if (previous && candidates.some((candidate) => candidate.id === previous)) return previous
  return defaultManualTurnoverLinkChoice(candidates)
}

export function manualTurnoverLinkDecision(choice: ManualTurnoverLinkChoice) {
  if (!choice) return null
  if (choice === 'independent') return { id: null, decision: 'independent' as const }
  return { id: choice, decision: 'link' as const }
}
