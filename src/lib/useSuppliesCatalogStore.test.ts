jest.mock('./api', () => ({
  listChecklistItems: jest.fn(),
}))

const CACHE_KEY = 'mzstay.checklist_items_cache.v1'
const LEGACY_CACHE_KEY = 'supplies_checklist_v1'

const cachedItems = [
  { id: 'toilet_paper', label: '卷纸', kind: 'consumable', required: true, requires_photo_when_low: true },
]

function getAsyncStorage() {
  return require('@react-native-async-storage/async-storage') as {
    clear: () => Promise<void>
    getItem: (key: string) => Promise<string | null>
    setItem: (key: string, value: string) => Promise<void>
  }
}

beforeEach(async () => {
  jest.resetModules()
  await getAsyncStorage().clear()
})

test('hydrates supplies catalog from primary cache', async () => {
  const AsyncStorage = getAsyncStorage()
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ items: cachedItems, updated_at: '2026-06-23T01:02:03.000Z' }))
  const mod = require('./useSuppliesCatalogStore') as typeof import('./useSuppliesCatalogStore')
  mod.resetSuppliesCatalogStoreForTests()

  await mod.hydrateSuppliesCatalog()

  expect(mod.getSuppliesCatalogSnapshot()).toMatchObject({
    items: cachedItems,
    hydrated: true,
    isFromCache: true,
    lastSyncedAt: '2026-06-23T01:02:03.000Z',
  })
})

test('hydrates from legacy cache and migrates to primary cache', async () => {
  const AsyncStorage = getAsyncStorage()
  await AsyncStorage.setItem(LEGACY_CACHE_KEY, JSON.stringify(cachedItems))
  const mod = require('./useSuppliesCatalogStore') as typeof import('./useSuppliesCatalogStore')
  mod.resetSuppliesCatalogStoreForTests()

  await mod.hydrateSuppliesCatalog()

  const migratedRaw = await AsyncStorage.getItem(CACHE_KEY)
  const migrated = migratedRaw ? JSON.parse(migratedRaw) : null

  expect(mod.getSuppliesCatalogSnapshot().items).toEqual(cachedItems)
  expect(Array.isArray(migrated?.items)).toBe(true)
  expect(migrated?.items).toEqual(cachedItems)
  expect(typeof migrated?.updated_at).toBe('string')
})

test('refresh success updates state and cache', async () => {
  const AsyncStorage = getAsyncStorage()
  const api = require('./api') as { listChecklistItems: jest.Mock }
  api.listChecklistItems.mockResolvedValue([
    { id: 'shampoo', label: '洗发水', kind: 'consumable', required: false, requires_photo_when_low: false },
  ])
  const mod = require('./useSuppliesCatalogStore') as typeof import('./useSuppliesCatalogStore')
  mod.resetSuppliesCatalogStoreForTests()

  await mod.refreshSuppliesCatalog('token-1')

  const snapshot = mod.getSuppliesCatalogSnapshot()
  expect(snapshot.items).toEqual([
    { id: 'shampoo', label: '洗发水', kind: 'consumable', required: false, requires_photo_when_low: false },
  ])
  expect(snapshot.isFromCache).toBe(false)
  expect(snapshot.error).toBeNull()
  expect(typeof snapshot.lastSyncedAt).toBe('string')

  const cachedRaw = await AsyncStorage.getItem(CACHE_KEY)
  const cached = cachedRaw ? JSON.parse(cachedRaw) : null
  expect(cached?.items).toEqual(snapshot.items)
})

test('refresh failure keeps cached items and exposes retryable error state', async () => {
  const AsyncStorage = getAsyncStorage()
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ items: cachedItems, updated_at: '2026-06-23T04:05:06.000Z' }))
  const api = require('./api') as { listChecklistItems: jest.Mock }
  api.listChecklistItems.mockRejectedValue(new Error('网络超时'))
  const mod = require('./useSuppliesCatalogStore') as typeof import('./useSuppliesCatalogStore')
  mod.resetSuppliesCatalogStoreForTests()

  await mod.hydrateSuppliesCatalog()
  await expect(mod.refreshSuppliesCatalog('token-2')).rejects.toThrow('网络超时')

  expect(mod.getSuppliesCatalogSnapshot()).toMatchObject({
    items: cachedItems,
    isFromCache: true,
    error: '网络超时',
    lastSyncedAt: '2026-06-23T04:05:06.000Z',
  })
})

test('refresh failure without cache leaves empty state and error', async () => {
  const api = require('./api') as { listChecklistItems: jest.Mock }
  api.listChecklistItems.mockRejectedValue(new Error('离线'))
  const mod = require('./useSuppliesCatalogStore') as typeof import('./useSuppliesCatalogStore')
  mod.resetSuppliesCatalogStoreForTests()

  await expect(mod.refreshSuppliesCatalog('token-3')).rejects.toThrow('离线')

  expect(mod.getSuppliesCatalogSnapshot()).toMatchObject({
    items: [],
    hydrated: true,
    isFromCache: false,
    error: '离线',
  })
})
