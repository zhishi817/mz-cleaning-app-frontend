import {
  CURRENT_KITCHEN_PHOTO_TEMPLATE_VERSION,
  CURRENT_KITCHEN_REQUIRED_PHOTOS,
  LEGACY_KITCHEN_PHOTO_TEMPLATE_VERSION,
  resolveCleaningKitchenPhotoTemplate,
} from './cleaningScenePhotoTemplate'

test('fresh tasks use the MZ048 kitchen storage photo order and new storage keys', () => {
  expect(resolveCleaningKitchenPhotoTemplate(null)).toBe(CURRENT_KITCHEN_PHOTO_TEMPLATE_VERSION)
  expect(CURRENT_KITCHEN_REQUIRED_PHOTOS).toEqual([
    { id: 'cutlery_drawer_photo_v2', label: '刀叉勺抽屉' },
    { id: 'kitchen_utensils_drawer_photo_v2', label: '厨房用品抽屉' },
    { id: 'cups_dishes_cabinet_photo_v2', label: '杯子、碗碟柜' },
  ])
})

test('unversioned existing drafts stay on the legacy appliance template', () => {
  expect(resolveCleaningKitchenPhotoTemplate({ items: [], extra_photo_urls: {} })).toBe(LEGACY_KITCHEN_PHOTO_TEMPLATE_VERSION)
})

test('persisted template version is authoritative for a resumed draft', () => {
  expect(resolveCleaningKitchenPhotoTemplate({
    scene_photo_template_version: CURRENT_KITCHEN_PHOTO_TEMPLATE_VERSION,
    extra_photo_urls: { coffee_machine_photo: 'file:///legacy.jpg' },
  })).toBe(CURRENT_KITCHEN_PHOTO_TEMPLATE_VERSION)
})

test('stored old and new photo keys select their matching historical template', () => {
  expect(resolveCleaningKitchenPhotoTemplate(null, [{ item_id: 'coffee_machine_photo' }])).toBe(LEGACY_KITCHEN_PHOTO_TEMPLATE_VERSION)
  expect(resolveCleaningKitchenPhotoTemplate(null, [{ item_id: 'cutlery_drawer_photo_v2' }])).toBe(CURRENT_KITCHEN_PHOTO_TEMPLATE_VERSION)
})

test('mixed server keys keep the legacy task boundary on the next load', () => {
  expect(resolveCleaningKitchenPhotoTemplate(null, [
    { item_id: 'coffee_machine_photo' },
    { item_id: 'cutlery_drawer_photo_v2' },
  ])).toBe(LEGACY_KITCHEN_PHOTO_TEMPLATE_VERSION)
})
