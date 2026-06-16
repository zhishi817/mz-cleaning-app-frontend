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

function normalizeImageList(input: any) {
  const arr = Array.isArray(input) ? input : []
  return Array.from(new Set(arr.map((item) => cleanText(item)).filter(Boolean)))
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

function eventTitle(propertyCode: string, action: string) {
  return propertyCode ? `${propertyCode} · ${action}` : action
}

function withoutOriginalValue(line: string) {
  return cleanText(line).replace(/（原[:：]?[^）]*）/g, '').trim()
}

function changedValueSummary(line: string) {
  const normalized = cleanText(line)
  const match = normalized.match(/^([^:：]+)[:：]\s*(.*?)（原[:：]?\s*(.*?)）$/)
  if (!match) return withoutOriginalValue(normalized)
  const label = cleanText(match[1])
  const next = cleanText(match[2]) || '-'
  const previous = cleanText(match[3]) || '-'
  if (label === '需挂钥匙套数' || label === '需要挂钥匙数') return `${previous} 套 → ${next} 套`
  return `${label}：${previous} → ${next}`
}

function addDetail(lines: string[], label: string, value: any) {
  const text = cleanText(value)
  if (!text) return
  const next = `${label}：${text}`
  const exists = lines.some((line) => cleanText(line).toLowerCase() === next.toLowerCase())
  if (!exists) lines.push(next)
}

function resolveTaskDate(data: any, relatedTask: any) {
  return cleanText(data?.task_date || data?.date || relatedTask?.scheduled_date || relatedTask?.date)
}

function resolveActorName(data: any) {
  return cleanText(data?.actor_name || data?.actor_user_name || data?.updated_by_name)
}

function resolveGuestSpecialRequest(data: any, relatedTask: any) {
  const hasDirectValue = Object.prototype.hasOwnProperty.call(data || {}, 'guest_special_request')
  return cleanText(hasDirectValue ? data?.guest_special_request : relatedTask?.guest_special_request)
}

function getRestockEntries(task: any) {
  const items = Array.isArray(task?.restock_items) ? task.restock_items : []
  return items
    .map((item: any) => {
      const label = cleanText(item?.label || item?.item_label || item?.item_id)
      const photoUrl = cleanText(item?.photo_url)
      const qty0 = item?.qty == null ? null : Number(item.qty)
      const qty = Number.isFinite(qty0 as any) ? Number(qty0) : null
      const status = cleanText(item?.status).toLowerCase()
      if (!label) return null
      const needRestock = status === 'low' || qty != null
      return { label, photoUrl, qty, needRestock }
    })
    .filter((item: any) => !!item && item.needRestock)
}

function getRestockEntriesFromNoticeData(data: any) {
  const items = Array.isArray(data?.restock_items) ? data.restock_items : []
  return items
    .map((item: any) => {
      const label = cleanText(item?.label || item?.item_label || item?.item_id)
      const photoUrl = cleanText(item?.photo_url)
      const qty0 = item?.qty == null ? null : Number(item.qty)
      const qty = Number.isFinite(qty0 as any) ? Number(qty0) : null
      const status = cleanText(item?.status).toLowerCase()
      if (!label) return null
      const needRestock = status === 'low' || qty != null
      return { label, photoUrl, qty, needRestock }
    })
    .filter((item: any) => !!item && item.needRestock)
}

export function getPresentedNotice(notice: Notice) {
  const propertyCode = resolvePropertyCode(notice)
  const relatedTask = resolveRelatedTask(notice)
  const data = notice?.data && typeof notice.data === 'object' ? notice.data : {}
  const kind = cleanText((data as any).kind)
  const directPhoto = cleanText((data as any).photo_url)
  const directPhotos = normalizeImageList((data as any).photo_urls)
  const taskLivingPhoto = cleanText((relatedTask as any)?.living_room_photo_url)
  const rawLines = parseLines(notice.content)
  const restockEntries = getRestockEntriesFromNoticeData(data).length ? getRestockEntriesFromNoticeData(data) : getRestockEntries(relatedTask)
  const taskDate = resolveTaskDate(data, relatedTask)
  const actorName = resolveActorName(data)
  const guestSpecialRequest = resolveGuestSpecialRequest(data, relatedTask)
  const keysRequired0 = Number((data as any).keys_required ?? (relatedTask as any)?.keys_required)
  const keysRequired = Number.isFinite(keysRequired0) && keysRequired0 > 0 ? Math.trunc(keysRequired0) : null

  let title = cleanText(notice.title) || '通知'
  let summary = cleanText(notice.summary)
  const contentLines: string[] = []
  let images: string[] = []

  const cleaningTaskKinds = new Set([
    'key_photo_uploaded',
    'key_photo_deleted',
    'guest_checked_out',
    'guest_checked_out_cancelled',
    'cleaning_task_manager_fields_updated',
    'consumables_submitted',
    'consumables_updated',
    'inspection_complete',
    'issue_reported',
    'restock_done',
    'completion_photos_saved',
    'lockbox_video_uploaded',
    'self_completed',
    'restock_proof_saved',
    'ready',
    'key_upload_reminder',
    'key_upload_sla',
  ])
  if (cleaningTaskKinds.has(kind)) {
    addDetail(contentLines, '时间', taskDate)
    addDetail(contentLines, '操作人', actorName || '系统')
    addDetail(contentLines, '任务要求', guestSpecialRequest || '无')
    if (keysRequired && keysRequired > 1) addDetail(contentLines, '钥匙要求', `需挂 ${keysRequired} 套钥匙`)
  }

  if (kind === 'key_photo_uploaded') {
    title = eventTitle(propertyCode, '钥匙照片已上传')
    summary = actorName ? `${actorName} 已上传钥匙照片` : '钥匙照片已上传'
  } else if (kind === 'key_photo_deleted') {
    title = eventTitle(propertyCode, '钥匙照片已删除')
    summary = actorName ? `${actorName} 删除了钥匙照片` : '已上传的钥匙照片被删除'
  } else if (kind === 'guest_checked_out') {
    title = eventTitle(propertyCode, '客人已退房')
    summary = '清洁任务可以开始'
    addDetail(contentLines, '状态', '客人已退房')
  } else if (kind === 'guest_checked_out_cancelled') {
    title = eventTitle(propertyCode, '退房状态已撤销')
    summary = '房源仍待退房'
    addDetail(contentLines, '状态', '房源还未退房')
  } else if (kind === 'cleaning_task_manager_fields_updated') {
    const changes = rawLines
      .filter((line) => /^(退房时间|入住时间|旧密码|新密码|客人需求|需挂钥匙套数|需要挂钥匙数)[:：]/.test(line))
      .map(changedValueSummary)
    const keysOnly = changes.length > 0 && rawLines
      .filter((line) => /^(退房时间|入住时间|旧密码|新密码|客人需求|需挂钥匙套数|需要挂钥匙数)[:：]/.test(line))
      .every((line) => /^(需挂钥匙套数|需要挂钥匙数)[:：]/.test(line))
    title = eventTitle(propertyCode, keysOnly ? '钥匙要求已修改' : '任务要求已修改')
    summary = changes[0] || '任务信息已更新'
    for (const change of changes) addDetail(contentLines, '变更', change)
  } else if (kind === 'consumables_submitted' || kind === 'consumables_updated') {
    title = eventTitle(propertyCode, kind === 'consumables_updated' ? '补品记录已更新' : '清洁已完成')
    const restockLabels = restockEntries.map((item: { label: string; qty: number | null }) => (item.qty != null ? `${item.label} x${item.qty}` : item.label))
    summary = restockLabels.length ? `${restockLabels.length} 项需要补货` : (kind === 'consumables_updated' ? '补品记录已更新' : '待检查')
    if (restockLabels.length) addDetail(contentLines, '待补货', restockLabels.join('、'))
  } else if (kind === 'inspection_complete') {
    title = eventTitle(propertyCode, '检查已完成')
    summary = '检查结果和凭证已提交'
  } else if (kind === 'issue_reported') {
    title = eventTitle(propertyCode, '发现房源问题')
    summary = cleanText((data as any).issue_title) || cleanText(notice.summary).replace(/^收到新的问题反馈[:：]\s*/, '') || '请查看问题详情'
    addDetail(contentLines, '问题', summary)
    addDetail(contentLines, '严重程度', (data as any).severity)
    addDetail(contentLines, '问题详情', (data as any).issue_detail)
  } else if (kind === 'restock_done') {
    title = eventTitle(propertyCode, '补货已完成')
    summary = '等待检查'
  } else if (kind === 'completion_photos_saved') {
    title = eventTitle(propertyCode, '房间照片已提交')
    summary = '清洁完成照片已上传'
  } else if (kind === 'lockbox_video_uploaded') {
    title = eventTitle(propertyCode, '挂钥匙视频已上传')
    summary = '等待后续确认'
  } else if (kind === 'self_completed') {
    title = eventTitle(propertyCode, '清洁任务已完成')
    summary = '等待检查或确认'
  } else if (kind === 'restock_proof_saved') {
    title = eventTitle(propertyCode, '补货凭证已提交')
    summary = '补货证明已上传'
  } else if (kind === 'ready') {
    title = eventTitle(propertyCode, '房源可入住')
    summary = '房源已完成准备'
  } else if (kind === 'guest_luggage_updated') {
    title = eventTitle(propertyCode, '当天临时通知')
    summary = rawLines.find((line) => !/^照片[:：]/.test(line)) || '请查看照片和说明'
    addDetail(contentLines, '临时安排', summary)
    const photoCount = directPhotos.length || (directPhoto ? 1 : 0)
    if (photoCount) addDetail(contentLines, '照片', `${photoCount} 张`)
  } else if (kind === 'guest_luggage_deleted') {
    title = eventTitle(propertyCode, '当天临时通知已移除')
    summary = '该临时安排不再生效'
  } else if (kind === 'key_upload_reminder') {
    title = propertyCode ? eventTitle(propertyCode, '钥匙照片待上传') : '钥匙照片待上传'
    summary = cleanText((data as any).audience) === 'manager' ? '请检查今日钥匙照片上传情况' : '请尽快上传钥匙照片'
  } else if (kind === 'key_upload_sla') {
    const escalated = cleanText((data as any).level) !== 'remind'
    title = eventTitle(propertyCode, escalated ? '钥匙照片上传超时' : '钥匙照片待上传')
    summary = escalated ? '清洁员未按时上传钥匙照片' : '请尽快上传钥匙照片'
  } else if (kind === 'day_end_handover_reminder') {
    title = '日终交接待提交'
    summary = taskDate ? `${taskDate} · 请完成日终交接` : '请完成日终交接'
  } else if (kind === 'day_end_handover_manager_reminder') {
    title = '有人未提交日终交接'
    const targetName = cleanText((data as any).target_user_name)
    summary = [targetName, taskDate].filter(Boolean).join(' · ') || '请及时跟进'
  } else if (kind === 'work_task_updated') {
    title = eventTitle(propertyCode, '任务已更新')
    summary = cleanText((data as any).task_title) || cleanText(notice.summary) || '请查看最新任务内容'
  } else if (kind === 'work_task_completed') {
    title = eventTitle(propertyCode, '任务已完成')
    summary = cleanText((data as any).task_title) || cleanText(notice.summary) || '任务已标记完成'
  } else {
    if (propertyCode && !title.includes(propertyCode)) title = eventTitle(propertyCode, title.replace(/^[^：]+[:：]\s*/, ''))
    summary = summary || '请查看详情'
  }

  const structuredKinds = new Set([
    'key_photo_uploaded',
    'key_photo_deleted',
    'guest_checked_out',
    'guest_checked_out_cancelled',
    'cleaning_task_manager_fields_updated',
    'consumables_submitted',
    'consumables_updated',
    'inspection_complete',
    'issue_reported',
    'restock_done',
    'completion_photos_saved',
    'lockbox_video_uploaded',
    'self_completed',
    'restock_proof_saved',
    'ready',
    'guest_luggage_updated',
    'guest_luggage_deleted',
    'key_upload_reminder',
    'key_upload_sla',
    'day_end_handover_reminder',
    'day_end_handover_manager_reminder',
    'work_task_updated',
    'work_task_completed',
  ])
  for (const line of rawLines) {
    if (structuredKinds.has(kind)) continue
    if (/^房源[:：]/.test(line)) continue
    if (contentLines.some((item) => withoutOriginalValue(item) === withoutOriginalValue(line))) continue
    if (line === summary) continue
    contentLines.push(line)
  }

  if (kind === 'key_photo_uploaded' || kind === 'key_photo_deleted') {
    const taskPhoto = cleanText((relatedTask as any)?.key_photo_url)
    images = Array.from(new Set([...directPhotos, directPhoto, taskPhoto, ...extractImageUrls(notice.content)].filter(Boolean)))
  } else if (kind === 'consumables_submitted' || kind === 'consumables_updated') {
    images = Array.from(new Set([...directPhotos, ...restockEntries.map((item: { photoUrl: string }) => item.photoUrl).filter(Boolean), taskLivingPhoto, directPhoto, ...extractImageUrls(notice.content)].filter(Boolean)))
  } else {
    images = Array.from(new Set([...directPhotos, directPhoto, ...extractImageUrls(notice.content)].filter(Boolean)))
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
