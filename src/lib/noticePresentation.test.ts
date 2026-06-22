jest.mock('./workTasksStore', () => ({
  findWorkTaskItemByAnyId: jest.fn(() => null),
  findWorkTaskItemByAnyIds: jest.fn(() => null),
}))

import { getPresentedNotice } from './noticePresentation'
import type { Notice } from './noticesStore'

function notice(input: Partial<Notice> & Pick<Notice, 'data'>): Notice {
  return {
    id: 'event-1',
    type: 'update',
    title: '通知',
    summary: '',
    content: '',
    createdAt: '2026-06-15T10:18:21.334Z',
    ...input,
  }
}

test('checkout notice shows guest request and only calls out non-default keys', () => {
  const presented = getPresentedNotice(notice({
    title: '已退房：Aura2707',
    summary: '已退房（2把钥匙）',
    content: '已退房（2把钥匙）',
    data: {
      kind: 'guest_checked_out',
      property_code: 'Aura2707',
      task_date: '2026-06-15',
      actor_name: '客服 A',
      guest_special_request: '保留客人行李',
      keys_required: 2,
    },
  }))

  expect(presented.title).toBe('Aura2707 · 客人已退房')
  expect(presented.summary).toBe('清洁任务可以开始')
  expect(presented.content).not.toContain('房源：Aura2707')
  expect(presented.content).toContain('任务日期：2026-06-15')
  expect(presented.content).toContain('操作人：客服 A')
  expect(presented.content).toContain('任务要求：保留客人行李')
  expect(presented.content).toContain('钥匙要求：需挂 2 套钥匙')
  expect(presented.content).not.toContain('已退房（2把钥匙）')
})

test('cleaning and inspection notices show no guest request and hide the default key count', () => {
  for (const kind of ['consumables_submitted', 'inspection_complete']) {
    const presented = getPresentedNotice(notice({
      data: {
        kind,
        property_code: 'Aura2707',
        task_date: '2026-06-15',
        actor_name: kind === 'inspection_complete' ? '检查员 A' : '清洁员 A',
        guest_special_request: null,
        keys_required: 1,
      },
    }))

    expect(presented.content).not.toContain('房源：Aura2707')
    expect(presented.content).toContain('任务日期：2026-06-15')
    expect(presented.content).toContain('任务要求：无')
    expect(presented.content).not.toContain('钥匙要求')
  }
})

test('keys hung notice uses room-code title and clear summary', () => {
  const presented = getPresentedNotice(notice({
    type: 'key',
    title: '房间已挂钥匙',
    summary: '检查员已上传挂钥匙视频，房间钥匙已挂好',
    content: '检查员已上传挂钥匙视频，房间钥匙已挂好',
    data: {
      kind: 'keys_hung',
      property_code: 'Aura2707',
      task_date: '2026-06-15',
      actor_name: '检查员 A',
    },
  }))

  expect(presented.title).toBe('Aura2707 · 房间已挂钥匙')
  expect(presented.summary).toBe('挂钥匙视频已上传，房间钥匙已挂好')
  expect(presented.content).toContain('任务日期：2026-06-15')
  expect(presented.content).toContain('操作人：检查员 A')
})

test('key requirement change uses concise before and after values', () => {
  const presented = getPresentedNotice(notice({
    type: 'key',
    title: '任务信息更新：Aura2707',
    summary: '需挂钥匙套数：2（原：1）',
    content: '需挂钥匙套数：2（原：1）',
    data: {
      kind: 'cleaning_task_manager_fields_updated',
      property_code: 'Aura2707',
      actor_name: '客服 A',
    },
  }))

  expect(presented.title).toBe('Aura2707 · 钥匙要求已修改')
  expect(presented.summary).toBe('1 套 → 2 套')
  expect(presented.content).toContain('操作人：客服 A')
  expect(presented.content).toContain('变更：1 套 → 2 套')
})

test('key photo and issue notifications expose actor and issue details', () => {
  const keyPhoto = getPresentedNotice(notice({
    type: 'key',
    data: {
      kind: 'key_photo_uploaded',
      property_code: 'Aura2707',
      actor_name: '清洁员 A',
      photo_url: 'https://example.com/key.jpg',
    },
  }))
  expect(keyPhoto.title).toBe('Aura2707 · 钥匙照片已上传')
  expect(keyPhoto.summary).toBe('清洁员 A 已上传钥匙照片')
  expect(keyPhoto.images).toEqual(['https://example.com/key.jpg'])

  const issue = getPresentedNotice(notice({
    summary: '收到新的问题反馈：浴室漏水',
    data: {
      kind: 'issue_reported',
      property_code: 'Aura2707',
      issue_title: '浴室漏水',
      issue_detail: '洗手盆下方持续滴水',
      severity: 'high',
      photo_urls: ['https://example.com/issue-1.jpg', 'https://example.com/issue-2.jpg'],
    },
  }))
  expect(issue.title).toBe('Aura2707 · 发现房源问题')
  expect(issue.summary).toBe('浴室漏水')
  expect(issue.content).toContain('房源：Aura2707')
  expect(issue.content).toContain('问题详情：洗手盆下方持续滴水')
  expect(issue.images).toEqual(['https://example.com/issue-1.jpg', 'https://example.com/issue-2.jpg'])
})
