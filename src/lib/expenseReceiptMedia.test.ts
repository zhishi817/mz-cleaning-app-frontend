import { buildMzappExpenseReceiptImageSource } from './expenseReceiptMedia'

describe('expense receipt authenticated media source', () => {
  it('uses the dedicated receipt-image route with bearer credentials', () => {
    expect(buildMzappExpenseReceiptImageSource('https://api.example.test/api', 'token-1', 'receipt/1', 'image 1')).toEqual({
      uri: 'https://api.example.test/api/mzapp/expense-receipts/receipt%2F1/images/image%201',
      headers: {
        Authorization: 'Bearer token-1',
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    })
  })

  it('refuses to turn incomplete receipt context into a raw media URL', () => {
    expect(buildMzappExpenseReceiptImageSource('https://api.example.test', '', 'receipt-1', 'image-1')).toBeNull()
    expect(buildMzappExpenseReceiptImageSource('https://api.example.test', 'token-1', '', 'image-1')).toBeNull()
    expect(buildMzappExpenseReceiptImageSource('https://api.example.test', 'token-1', 'receipt-1', '')).toBeNull()
  })
})
