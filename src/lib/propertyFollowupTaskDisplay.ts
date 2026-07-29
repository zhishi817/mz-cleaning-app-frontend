const DAILY_NECESSITIES_GENERIC_TITLES = new Set(['日用品更换', '补日用品', '日用品补充'])

function text(value: any) {
  return String(value ?? '').trim()
}

export function isPropertyFollowupTask(task: any) {
  const sourceType = text(task?.source_type)
  return sourceType === 'property_maintenance'
    || sourceType === 'property_deep_cleaning'
    || sourceType === 'property_daily_necessities'
}

function dailyNecessityItemName(task: any) {
  const rawTitle = text(task?.title)
  const propertyCode = text(task?.property?.code)
  if (!rawTitle || rawTitle === propertyCode || DAILY_NECESSITIES_GENERIC_TITLES.has(rawTitle)) return ''
  return rawTitle
}

export function propertyFollowupTaskTitle(task: any) {
  const sourceType = text(task?.source_type)
  if (sourceType === 'property_daily_necessities') {
    const itemName = dailyNecessityItemName(task)
    return itemName ? `补日用品：${itemName}` : '补日用品'
  }
  return ''
}

export function propertyFollowupTaskDetail(task: any, summary: any) {
  if (text(task?.source_type) !== 'property_daily_necessities') return text(summary)
  const title = propertyFollowupTaskTitle(task)
  const detail = text(summary)
  return [title, detail].filter(Boolean).join('，')
}
