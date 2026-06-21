export function normalizeHttpUrl(raw: string | null | undefined) {
  const s0 = String(raw || '').trim()
  if (!s0) return null
  const href = s0.match(/href\s*=\s*["']([^"']+)["']/i)?.[1] || s0
  const url = href.match(/https?:\/\/[^\s"'<>]+/i)?.[0] || href.trim()
  if (!url) return null
  if (/^https?:\/\//i.test(url)) return url
  return `https://${url}`
}
