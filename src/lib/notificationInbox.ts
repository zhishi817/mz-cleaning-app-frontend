import { listInboxNotifications, type InboxNotificationItem } from './api'
import { resolveNoticeCreatedAt } from './noticeTime'
import { upsertNotices, type Notice } from './noticesStore'

function noticeType(item: InboxNotificationItem): Notice['type'] {
  const type = String(item.type || '').toUpperCase()
  const changes = Array.isArray(item.changes) ? item.changes.map((value) => String(value || '').toLowerCase()) : []
  const data = item.data && typeof item.data === 'object' ? item.data : {}
  const kind = String((data as any).kind || '').trim()
  if (kind === 'guest_checked_out' || kind === 'guest_checked_out_cancelled') return 'update'
  const keyKinds = new Set(['key_photo_uploaded', 'key_photo_deleted', 'key_upload_reminder', 'key_upload_sla'])
  if (keyKinds.has(kind)) return 'key'
  if (kind === 'cleaning_task_manager_fields_updated') return changes.includes('keys') ? 'key' : 'update'
  return type.includes('KEY') ? 'key' : 'update'
}

export function inboxNotificationToNotice(item: InboxNotificationItem) {
  const body = String(item.body || '').trim()
  const title = String(item.title || '').trim() || '通知'
  const data = item.data && typeof item.data === 'object' ? item.data : {}
  return {
    id: String(item.event_id || item.id || '').trim(),
    type: noticeType(item),
    title,
    summary: body,
    content: body,
    data: {
      ...data,
      _server_id: String(item.id || '').trim(),
      event_id: String(item.event_id || '').trim(),
    },
    createdAt: resolveNoticeCreatedAt(item.created_at, item.event_id, item.id) || new Date().toISOString(),
    unread: !item.read_at,
  }
}

export async function syncInboxNotifications(params: {
  token: string
  limit?: number
  cursor?: string | null
  replace?: boolean
  include?: (notice: ReturnType<typeof inboxNotificationToNotice>) => boolean
}) {
  const { items, next_cursor } = await listInboxNotifications(params.token, {
    limit: params.limit || 50,
    cursor: params.cursor || null,
  })
  const notices = (items || [])
    .map(inboxNotificationToNotice)
    .filter((notice) => !!notice.id)
    .filter((notice) => !params.include || params.include(notice))
  await upsertNotices(notices, { replace: params.replace === true })
  return { notices, nextCursor: next_cursor }
}
