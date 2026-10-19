export type MzappExpenseReceiptImageSource = {
  uri: string
  headers: Record<string, string>
}

function normalizeBase(base: string) {
  return String(base || '').trim().replace(/\/+$/g, '')
}

function unique(items: string[]) {
  return Array.from(new Set(items)).filter(Boolean)
}

function expenseReceiptImageUrl(base: string, receiptId: string, imageId: string) {
  const raw = normalizeBase(base)
  if (!raw) return null
  const receipt = String(receiptId || '').trim()
  const image = String(imageId || '').trim()
  if (!receipt || !image) return null
  const stripAuth = raw.replace(/\/auth\/?$/g, '')
  const stripApi = stripAuth.replace(/\/api\/?$/g, '')
  const suffix = `mzapp/expense-receipts/${encodeURIComponent(receipt)}/images/${encodeURIComponent(image)}`
  return unique([`${raw}/${suffix}`, `${stripAuth}/${suffix}`, `${stripApi}/${suffix}`]
    .map((url) => url.replace(/([^:]\/)\/+/g, '$1')))[0] || null
}

/**
 * Returns the only client display source for a persisted expense-receipt image.
 * Draft images use their local URI until the receipt has a saved image id.
 */
export function buildMzappExpenseReceiptImageSource(
  apiBaseUrl: string,
  token: string | null | undefined,
  receiptId: string | null | undefined,
  imageId: string | null | undefined,
): MzappExpenseReceiptImageSource | null {
  const bearer = String(token || '').trim()
  const uri = expenseReceiptImageUrl(apiBaseUrl, String(receiptId || ''), String(imageId || ''))
  if (!bearer || !uri) return null
  return {
    uri,
    headers: {
      Authorization: `Bearer ${bearer}`,
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
    },
  }
}
