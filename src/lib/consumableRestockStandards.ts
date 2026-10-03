const STANDARDS_BY_ITEM_ID: Record<string, string> = {
  toilet_paper: '每个卫生间按入住天数补充',
  facial_tissue: '每个房间 1–2 盒',
  shampoo: '不少于 1/3',
  conditioner: '不少于 1/3',
  body_wash: '不少于 1/3',
  hand_soap: '不少于 1/2',
  dish_sponge: '1 个',
  tea_bags: '不少于 2/3',
  coffee: '不少于 2/3',
  sugar_sticks: '不少于 2/3',
  bin_bags_large: '不少于 5 个',
  bin_bags_small: '不少于 5 个',
  cooking_oil: '不少于 1/3',
  dish_detergent: '不少于 1/3',
  dish_soap: '不少于 1/3',
  laundry_powder: '不少于 1/4',
  salt_sugar: '柜子里需有补充装，台面罐内不少于 1/2',
  pepper: '不少于 1/3',
  toilet_cleaner: '不少于 1/3',
  bleach: '不少于 1/3',
  spare_pillowcase: '按需确认',
}

const STANDARDS_BY_LABEL: { labels: string[]; standard: string }[] = [
  { labels: ['卷纸', '厕纸', '卫生纸'], standard: STANDARDS_BY_ITEM_ID.toilet_paper },
  { labels: ['抽纸', '纸巾'], standard: STANDARDS_BY_ITEM_ID.facial_tissue },
  { labels: ['洗发水'], standard: STANDARDS_BY_ITEM_ID.shampoo },
  { labels: ['护发素'], standard: STANDARDS_BY_ITEM_ID.conditioner },
  { labels: ['沐浴露'], standard: STANDARDS_BY_ITEM_ID.body_wash },
  { labels: ['洗手液'], standard: STANDARDS_BY_ITEM_ID.hand_soap },
  { labels: ['洗碗海绵'], standard: STANDARDS_BY_ITEM_ID.dish_sponge },
  { labels: ['茶包'], standard: STANDARDS_BY_ITEM_ID.tea_bags },
  { labels: ['咖啡'], standard: STANDARDS_BY_ITEM_ID.coffee },
  { labels: ['条装糖'], standard: STANDARDS_BY_ITEM_ID.sugar_sticks },
  { labels: ['大垃圾袋'], standard: STANDARDS_BY_ITEM_ID.bin_bags_large },
  { labels: ['小垃圾袋'], standard: STANDARDS_BY_ITEM_ID.bin_bags_small },
  { labels: ['食用油'], standard: STANDARDS_BY_ITEM_ID.cooking_oil },
  { labels: ['洗洁精', '洗碗皂'], standard: STANDARDS_BY_ITEM_ID.dish_detergent },
  { labels: ['洗衣粉'], standard: STANDARDS_BY_ITEM_ID.laundry_powder },
  { labels: ['盐糖'], standard: STANDARDS_BY_ITEM_ID.salt_sugar },
  { labels: ['花椒'], standard: STANDARDS_BY_ITEM_ID.pepper },
  { labels: ['洁厕灵'], standard: STANDARDS_BY_ITEM_ID.toilet_cleaner },
  { labels: ['漂白水'], standard: STANDARDS_BY_ITEM_ID.bleach },
  { labels: ['备用枕套'], standard: STANDARDS_BY_ITEM_ID.spare_pillowcase },
]

function normalizeLabel(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .replace(/[（(].*$/, '')
    .replace(/\s+/g, '')
}

export function consumableRestockStandard(itemId?: string | null, label?: string | null) {
  const id = String(itemId || '').trim().toLowerCase()
  if (id && STANDARDS_BY_ITEM_ID[id]) return STANDARDS_BY_ITEM_ID[id]

  const normalizedLabel = normalizeLabel(label)
  if (!normalizedLabel) return null
  return STANDARDS_BY_LABEL.find(({ labels }) => labels.some((candidate) => normalizedLabel === candidate))?.standard || null
}
