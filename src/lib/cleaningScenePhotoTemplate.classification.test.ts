import {
  classifyHistoricalCleaningCompletionPhoto,
  classifyLegacyConsumableScenePhoto,
} from './cleaningScenePhotoTemplate'

test.each([
  ['remote_tv', undefined, 'remote_tv'],
  ['remote_ac', undefined, 'remote_tv'],
  ['vacuum_used_photo', undefined, 'vacuum_used'],
  ['shower_drain_photo_1', undefined, 'shower_drain'],
  ['cutlery_drawer_photo_v2', undefined, 'kitchen'],
  ['kitchen_utensils_drawer_photo_v2', undefined, 'kitchen'],
  ['coffee_machine_photo', undefined, 'kitchen'],
  [undefined, 'living', 'living'],
])('classifies legacy scene photo %s/%s as %s completion evidence', (itemId, area, expectedArea) => {
  expect(classifyLegacyConsumableScenePhoto(itemId, area)).toMatchObject({
    area: expectedArea,
    legacyConsumable: true,
  })
})

test('keeps real, removed, and unknown consumable ids outside the scene-photo classifier', () => {
  expect(classifyLegacyConsumableScenePhoto('toilet-paper')).toBeNull()
  expect(classifyLegacyConsumableScenePhoto('retired-supply-id')).toBeNull()
  expect(classifyLegacyConsumableScenePhoto('future-unknown-record')).toBeNull()
})

test('normalizes modern completion media without treating unrelated sources as completion photos', () => {
  expect(classifyHistoricalCleaningCompletionPhoto({ source: 'completion', area: 'remote_ac' })).toMatchObject({
    area: 'remote_tv',
    legacyConsumable: false,
  })
  expect(classifyHistoricalCleaningCompletionPhoto({ source: 'consumable', item_id: 'shower_drain_photo_2' })).toMatchObject({
    area: 'shower_drain',
    legacyConsumable: true,
  })
  expect(classifyHistoricalCleaningCompletionPhoto({ source: 'consumable', item_id: 'toilet-paper' })).toBeNull()
  expect(classifyHistoricalCleaningCompletionPhoto({ source: 'inspection', area: 'kitchen' })).toBeNull()
  expect(classifyHistoricalCleaningCompletionPhoto({ source: 'key', area: 'guest_key' })).toBeNull()
})
