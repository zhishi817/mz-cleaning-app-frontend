import {
  isAuthenticatedCleaningMediaReference,
  normalizeCleaningTaskNoticeId,
  normalizeGuestLuggageNoticeId,
  type CleaningMediaAccessOptions,
} from './cleaningMedia'

export type NoticeMediaContext = {
  testIdPrefix: string
  access: CleaningMediaAccessOptions
}

function noticeKind(data: any) {
  return String(data?.kind || '').trim().toLowerCase()
}

function taskId(data: any) {
  return normalizeCleaningTaskNoticeId(data?.task_id)
}

function offlineWorkTaskId(data: any) {
  const id = taskId(data)
  const prefix = 'cleaning_offline_tasks:'
  return id && id.startsWith(prefix) && id.slice(prefix.length).trim() ? id : null
}

export function resolveNoticeMediaContext(data: any): NoticeMediaContext | null {
  switch (noticeKind(data)) {
    case 'guest_luggage_updated': {
      const guestLuggageId = normalizeGuestLuggageNoticeId(data?.guest_luggage_id)
      return guestLuggageId ? { testIdPrefix: 'guest-luggage-notice', access: { guestLuggageId } } : null
    }
    case 'key_photo_uploaded':
    case 'keys_hung': {
      const accessTaskId = taskId(data)
      return accessTaskId ? { testIdPrefix: 'key-media-notice', access: { accessTaskId } } : null
    }
    case 'inspection_complete': {
      const accessTaskId = taskId(data)
      return accessTaskId ? { testIdPrefix: 'inspection-complete-notice', access: { accessTaskId } } : null
    }
    case 'consumables_submitted':
    case 'consumables_updated': {
      const accessTaskId = taskId(data)
      return accessTaskId ? { testIdPrefix: 'consumables-notice', access: { accessTaskId } } : null
    }
    case 'issue_reported': {
      const accessTaskId = taskId(data)
      return accessTaskId ? { testIdPrefix: 'issue-reported-notice', access: { accessTaskId } } : null
    }
    case 'work_task_completed': {
      const accessWorkTaskId = offlineWorkTaskId(data)
      return accessWorkTaskId
        ? { testIdPrefix: 'offline-work-task-completed-notice', access: { accessWorkTaskId, offlineWorkTaskMedia: true } }
        : null
    }
    default:
      return null
  }
}

export function isNoticeMediaReferenceEligible(data: any, reference: any) {
  return Boolean(resolveNoticeMediaContext(data) && isAuthenticatedCleaningMediaReference(reference))
}
