export type PersonnelClaimEvidenceImageSource = {
  uri: string
  headers: Record<string, string>
}

function normalizeBase(base: string) {
  return String(base || '').trim().replace(/\/+$/g, '')
}

export function buildPersonnelClaimEvidenceImageSource(
  apiBaseUrl: string,
  token: string | null | undefined,
  claimId: string | null | undefined,
  evidenceId: string | null | undefined,
): PersonnelClaimEvidenceImageSource | null {
  const raw = normalizeBase(apiBaseUrl)
  const bearer = String(token || '').trim()
  const claim = String(claimId || '').trim()
  const evidence = String(evidenceId || '').trim()
  if (!raw || !bearer || !claim || !evidence) return null
  const stripAuth = raw.replace(/\/auth\/?$/g, '')
  const stripApi = stripAuth.replace(/\/api\/?$/g, '')
  const suffix = `finance/settlements/my-claims/${encodeURIComponent(claim)}/evidence/${encodeURIComponent(evidence)}/image`
  const uri = Array.from(new Set([`${raw}/${suffix}`, `${stripAuth}/${suffix}`, `${stripApi}/${suffix}`]
    .map((url) => url.replace(/([^:]\/)\/+/g, '$1')))).filter(Boolean)[0]
  return uri ? {
    uri,
    headers: {
      Authorization: `Bearer ${bearer}`,
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
    },
  } : null
}
