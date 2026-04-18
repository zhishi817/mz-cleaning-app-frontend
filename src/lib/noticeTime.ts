function toIso(raw: any) {
  const text = String(raw ?? '').trim()
  if (!text || text === 'null' || text === 'undefined') return null
  if (!/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}(?::?\d{2})?)?)?$/.test(text)) return null
  const normalized = text.includes(' ') ? text.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00') : text
  const parsed = new Date(normalized)
  if (!Number.isFinite(parsed.getTime())) return null
  return parsed.toISOString()
}

function extractIsoLike(text: string) {
  const match = text.match(/\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}(?::?\d{2})?)?)?/)
  if (!match) return null
  return toIso(match[0])
}

function collectIsoCandidates(values: any[]) {
  const out: string[] = []
  for (const candidate of values) {
    const text = String(candidate ?? '').trim()
    if (!text) continue
    const direct = toIso(text)
    if (direct) {
      out.push(direct)
      continue
    }
    const embedded = extractIsoLike(text)
    if (embedded) out.push(embedded)
  }
  return out
}

export function resolveNoticeCreatedAt(rawCreatedAt: any, ...fallbackCandidates: any[]) {
  const direct = toIso(rawCreatedAt)
  if (direct) return direct

  for (const candidate of fallbackCandidates) {
    const text = String(candidate ?? '').trim()
    if (!text) continue
    const embedded = extractIsoLike(text)
    if (embedded) return embedded
    const parsed = toIso(text)
    if (parsed) return parsed
  }

  return null
}

export function reconcileNoticeCreatedAt(...candidates: any[]) {
  const times = collectIsoCandidates(candidates)
  if (!times.length) return null
  times.sort()
  return times[0] || null
}
