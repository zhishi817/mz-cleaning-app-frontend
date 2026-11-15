import { assertMediaCaptureSession, clearMediaCaptureSession, getOwnedMediaJson, guardMediaRequest, mediaCaptureStorageKey, removeOwnedMediaJson, setMediaCaptureSession, setOwnedMediaJson } from './mediaCaptureIdentity'
import { getJson, setJson, remove } from './storage'
const mockValues = new Map<string, unknown>()
jest.mock('./storage', () => ({
  getJson: jest.fn(async (key: string) => mockValues.get(key) ?? null),
  setJson: jest.fn(async (key: string, value: unknown) => { mockValues.set(key, value) }),
  remove: jest.fn(async (key: string) => { mockValues.delete(key) }),
}))
beforeEach(() => { mockValues.clear(); jest.clearAllMocks(); clearMediaCaptureSession() })
test('requires an authenticated session; never adopts unowned legacy data', async () => {
  mockValues.set('queue', [{ task_id: 'same' }])
  expect(await getOwnedMediaJson('queue')).toBeNull()
  await expect(setOwnedMediaJson('queue', [])).rejects.toThrow('OWNER_MISSING')
  setMediaCaptureSession('A', 'tokenA')
  expect(await getOwnedMediaJson('queue')).toBeNull()
  expect(mockValues.get('queue')).toEqual([{ task_id: 'same' }])
})
test('account switch preserves A data and B cannot read or remove it', async () => {
  setMediaCaptureSession('A', 'tokenA')
  const aKey = mediaCaptureStorageKey('queue')
  await setOwnedMediaJson('queue', [{ captured_by_user_id: 'A', photo: 'local-photo' }])
  setMediaCaptureSession('B', 'tokenB')
  expect(await getOwnedMediaJson('queue')).toBeNull()
  await removeOwnedMediaJson('queue')
  expect(mockValues.has(aKey)).toBe(true)
  setMediaCaptureSession('A', 'renewedA')
  expect(await getOwnedMediaJson('queue')).toEqual([{ captured_by_user_id: 'A', photo: 'local-photo' }])
})
test('rejects old token and foreign owner, even if B has broad permissions', () => {
  setMediaCaptureSession('B', 'tokenB')
  expect(() => assertMediaCaptureSession('tokenA', 'A')).toThrow('OWNER_MISMATCH')
  expect(() => assertMediaCaptureSession('tokenB', 'A')).toThrow('OWNER_MISMATCH')
})
test('rejects A read continuation after switch, without copying data into B', async () => {
  setMediaCaptureSession('A', 'tokenA')
  let resolve!: (value: unknown) => void
  ;(getJson as jest.Mock).mockImplementationOnce(() => new Promise(r => { resolve = r }))
  const pending = getOwnedMediaJson('queue')
  setMediaCaptureSession('B', 'tokenB')
  resolve([{ captured_by_user_id: 'A' }])
  await expect(pending).rejects.toThrow('SESSION_CHANGED')
  expect(setJson).not.toHaveBeenCalled()
})
test('rejects foreign nested capture metadata on write', async () => {
  setMediaCaptureSession('B', 'tokenB')
  await expect(setOwnedMediaJson('queue', [{ nested: { captured_by_user_id: 'A' } }])).rejects.toThrow('OWNER_MISMATCH')
  expect(setJson).not.toHaveBeenCalled()
})
test('in-flight request detects logout and does not authorize next network action', async () => {
  setMediaCaptureSession('A', 'tokenA')
  let resolve!: (value: string) => void
  const request = jest.fn(() => new Promise<string>(r => { resolve = r }))
  const guarded = guardMediaRequest(request)
  const pending = guarded('tokenA')
  clearMediaCaptureSession()
  resolve('already uploaded')
  await expect(pending).rejects.toThrow('OWNER_MISMATCH')
  await expect(guarded('tokenA')).rejects.toThrow('OWNER_MISMATCH')
  expect(request).toHaveBeenCalledTimes(1)
  expect(remove).not.toHaveBeenCalled()
})


test('legacy notice ignores completed queues and empty forms but retains pending captures', () => {
  const { hasPendingUnownedMedia } = require('./mediaCaptureIdentity')
  expect(hasPendingUnownedMedia([{ status: 'synced', local_uri: 'file:///old.jpg' }])).toBe(false)
  expect(hasPendingUnownedMedia([{ business_saved: true, local_uri: 'file:///old.mov' }])).toBe(false)
  expect(hasPendingUnownedMedia({ room_photos: { living: [] } })).toBe(false)
  expect(hasPendingUnownedMedia({ room_photos: { living: [{ local_uri: 'file:///pending.jpg' }] } })).toBe(true)
})
