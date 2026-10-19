export const LEGACY_KITCHEN_PHOTO_TEMPLATE_VERSION = 'kitchen_appliances_v1' as const
export const CURRENT_KITCHEN_PHOTO_TEMPLATE_VERSION = 'kitchen_storage_v2' as const

export type CleaningKitchenPhotoTemplateVersion =
  | typeof LEGACY_KITCHEN_PHOTO_TEMPLATE_VERSION
  | typeof CURRENT_KITCHEN_PHOTO_TEMPLATE_VERSION

export type CleaningKitchenRequiredPhoto = {
  id: string
  label: string
}

export const LEGACY_KITCHEN_REQUIRED_PHOTOS = [
  { id: 'coffee_machine_photo', label: '咖啡机' },
  { id: 'kettle_photo', label: '烧水壶' },
  { id: 'toaster_photo', label: '面包机' },
] as const

export const CURRENT_KITCHEN_REQUIRED_PHOTOS = [
  { id: 'cutlery_drawer_photo_v2', label: '刀叉勺抽屉' },
  { id: 'kitchen_utensils_drawer_photo_v2', label: '厨房用品抽屉' },
  { id: 'cups_dishes_cabinet_photo_v2', label: '杯子、碗碟柜' },
] as const

export const ALL_KITCHEN_SCENE_PHOTOS = [
  ...LEGACY_KITCHEN_REQUIRED_PHOTOS,
  ...CURRENT_KITCHEN_REQUIRED_PHOTOS,
] as const

const LEGACY_KITCHEN_PHOTO_IDS = new Set<string>(LEGACY_KITCHEN_REQUIRED_PHOTOS.map((item) => item.id))
const CURRENT_KITCHEN_PHOTO_IDS = new Set<string>(CURRENT_KITCHEN_REQUIRED_PHOTOS.map((item) => item.id))

type TemplateEvidence = {
  scene_photo_template_version?: unknown
  extra_photo_urls?: Record<string, unknown> | null
  items?: { item_id?: unknown }[] | null
} | null | undefined

function normalizedVersion(value: unknown): CleaningKitchenPhotoTemplateVersion | null {
  if (value === LEGACY_KITCHEN_PHOTO_TEMPLATE_VERSION || value === CURRENT_KITCHEN_PHOTO_TEMPLATE_VERSION) return value
  return null
}

function evidenceItemIds(evidence: TemplateEvidence, recordItems: { item_id?: unknown }[]) {
  const ids = new Set<string>()
  for (const item of [...(Array.isArray(evidence?.items) ? evidence.items : []), ...recordItems]) {
    const id = String(item?.item_id || '').trim()
    if (id) ids.add(id)
  }
  for (const id of Object.keys(evidence?.extra_photo_urls || {})) {
    const normalized = String(id || '').trim()
    if (normalized) ids.add(normalized)
  }
  return ids
}

export function resolveCleaningKitchenPhotoTemplate(
  evidence: TemplateEvidence,
  recordItems: { item_id?: unknown }[] = [],
): CleaningKitchenPhotoTemplateVersion {
  const explicitVersion = normalizedVersion(evidence?.scene_photo_template_version)
  if (explicitVersion) return explicitVersion

  const itemIds = evidenceItemIds(evidence, recordItems)
  // Mixed server history can occur if a user captured a v2 photo before a
  // delayed legacy record arrived. Legacy evidence wins so that task does not
  // silently migrate on its next load; explicit local v2 remains authoritative.
  if (Array.from(itemIds).some((id) => LEGACY_KITCHEN_PHOTO_IDS.has(id))) {
    return LEGACY_KITCHEN_PHOTO_TEMPLATE_VERSION
  }
  if (Array.from(itemIds).some((id) => CURRENT_KITCHEN_PHOTO_IDS.has(id))) {
    return CURRENT_KITCHEN_PHOTO_TEMPLATE_VERSION
  }

  // Drafts created by clients before MZ048 have no discriminator. Keep those
  // tasks on their original appliance checklist instead of silently migrating
  // in-progress/offline photos to the new meanings.
  if (evidence) return LEGACY_KITCHEN_PHOTO_TEMPLATE_VERSION
  return CURRENT_KITCHEN_PHOTO_TEMPLATE_VERSION
}

export function kitchenRequiredPhotosForTemplate(version: CleaningKitchenPhotoTemplateVersion): readonly CleaningKitchenRequiredPhoto[] {
  return version === LEGACY_KITCHEN_PHOTO_TEMPLATE_VERSION
    ? LEGACY_KITCHEN_REQUIRED_PHOTOS
    : CURRENT_KITCHEN_REQUIRED_PHOTOS
}
