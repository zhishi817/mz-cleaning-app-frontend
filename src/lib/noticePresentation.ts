import type { Notice } from './noticesStore'
import { findWorkTaskItemByAnyId, findWorkTaskItemByAnyIds } from './workTasksStore'

function cleanText(value: any) {
  return String(value ?? '').trim()
}

function parseLines(text: string) {
  return cleanText(text)
    .split('\n')
    .map((line) => cleanText(line))
    .filter(Boolean)
}

function extractImageUrls(text: string) {
  const urls: string[] = []
  for (const line of parseLines(text)) {
    const matches = line.match(/https?:\/\/\S+/gi) || []
    for (const raw of matches) {
      const url = cleanText(raw).replace(/[),.。；;]$/g, '')
      if (!url) continue
      const lower = url.toLowerCase()
      if (lower.includes('.jpg') || lower.includes('.jpeg') || lower.includes('.png') || lower.includes('.webp') || lower.includes('.gif')) urls.push(url)
    }
  }
  return Array.from(new Set(urls))
}

function resolvePropertyCode(notice: Notice) {
  const relatedTask = resolveRelatedTask(notice)
  const taskCode = cleanText(relatedTask?.property?.code || relatedTask?.title)
  if (taskCode) return taskCode
  const data = notice?.data && typeof notice.data === 'object' ? notice.data : {}
  const direct = cleanText((data as any).property_code)
  if (direct) return direct

  const candidateIds = Array.from(
    new Set(
      [
        (data as any).task_id,
        (data as any).entityId,
        (data as any).entity_id,
        notice.id,
        ...(Array.isArray((data as any).task_ids) ? (data as any).task_ids : []),
      ]
        .map((value) => cleanText(value))
        .filter(Boolean),
    ),
  )
  if (!candidateIds.length) return ''

  const task = findWorkTaskItemByAnyId(candidateIds[0]) || findWorkTaskItemByAnyIds(candidateIds)
  return cleanText(task?.property?.code || task?.title)
}

function resolveRelatedTask(notice: Notice) {
  const data = notice?.data && typeof notice.data === 'object' ? notice.data : {}
  const candidateIds = Array.from(
    new Set(
      [
        (data as any).task_id,
        (data as any).entityId,
        (data as any).entity_id,
        ...(Array.isArray((data as any).task_ids) ? (data as any).task_ids : []),
      ]
        .map((value) => cleanText(value))
        .filter(Boolean),
    ),
  )
  if (!candidateIds.length) return null
  return findWorkTaskItemByAnyId(candidateIds[0]) || findWorkTaskItemByAnyIds(candidateIds) || null
}

function titleWithProperty(title: string, propertyCode: string) {
  if (!propertyCode) return title
  if (title.includes(propertyCode)) return title
  if (title.includes('：')) return `${title}${propertyCode}`
  return `${title}：${propertyCode}`
}

export function getPresentedNotice(notice: Notice) {
  const propertyCode = resolvePropertyCode(notice)
  const relatedTask = resolveRelatedTask(notice)
  const data = notice?.data && typeof notice.data === 'object' ? notice.data : {}
  const kind = cleanText((data as any).kind)
  const directPhoto = cleanText((data as any).photo_url)
  const taskPhoto = cleanText((relatedTask as any)?.key_photo_url)
  const images = Array.from(new Set([directPhoto, taskPhoto, ...extractImageUrls(notice.content)].filter(Boolean)))
  const rawLines = parseLines(notice.content)

  let title = cleanText(notice.title) || '通知'
  let summary = cleanText(notice.summary)
  const contentLines = rawLines.slice()

  if (propertyCode && !contentLines.some((line) => /^房源\s*[:：]/.test(line))) {
    contentLines.unshift(`房源：${propertyCode}`)
  }

  if (kind === 'key_photo_uploaded') {
    title = titleWithProperty(title || '钥匙已上传', propertyCode)
    if (!summary || /^清洁员已上传钥匙照片$/.test(summary)) {
      summary = propertyCode ? `房源：${propertyCode}` : '清洁员已上传钥匙照片'
    }
  } else if (kind === 'key_photo_deleted') {
    title = titleWithProperty(title || '钥匙照片已删除', propertyCode)
    if (!summary) summary = propertyCode ? `房源：${propertyCode}` : '清洁员删除了已上传的钥匙照片'
  } else if (propertyCode) {
    title = titleWithProperty(title, propertyCode)
    if (!summary) summary = `房源：${propertyCode}`
  }

  const content = contentLines.join('\n').trim() || cleanText(notice.content) || summary || title
  if (!summary) {
    const firstLine = contentLines.find((line) => !/^照片\s*[:：]/.test(line)) || ''
    summary = firstLine || title
  }

  return {
    ...notice,
    title,
    summary,
    content,
    propertyCode,
    images,
  }
}
