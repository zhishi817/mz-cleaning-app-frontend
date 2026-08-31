import type { CompanyContentCategory, CompanyGuideRole } from './api'

export type CompanyContentStepItem = { type: 'text' | 'image' | 'video'; text?: string; url?: string; caption?: string }

export type CompanyContentBlock =
  | { type: 'heading'; text?: string; level?: number }
  | { type: 'paragraph'; text?: string }
  | { type: 'callout'; text?: string }
  | { type: 'image'; url?: string; caption?: string }
  | { type: 'video'; url?: string; caption?: string }
  | { type: 'step'; title?: string; contents?: CompanyContentStepItem[] }
  | { type: 'list'; ordered?: boolean; items?: string[] }
  | { type: 'quote'; text?: string }
  | { type: 'code'; text?: string; language?: string }
  | { type: 'legacy_html'; html?: string }

export function parseCompanyContentBlocks(content: string | null | undefined): { blocks: CompanyContentBlock[]; raw: string } {
  const raw = String(content || '')
  const trimmed = raw.trim()
  if (!trimmed) return { blocks: [], raw }
  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) return { blocks: parsed as CompanyContentBlock[], raw }
  } catch {}
  return { blocks: parseLegacyCompanyContent(raw), raw }
}

function stripLegacyHtml(content: string) {
  return String(content || '')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*(p|div|section|article|li|ul|ol|blockquote)\s*>/gi, '\n')
    .replace(/<\s*h([1-4])[^>]*>(.*?)<\/\s*h\1\s*>/gis, (_m, level, text) => `\n${'#'.repeat(Math.max(1, Math.min(4, Number(level) || 2)))} ${String(text || '').trim()}\n`)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
}

function flushParagraph(lines: string[], blocks: CompanyContentBlock[]) {
  const text = lines.join('\n').trim()
  lines.length = 0
  if (text) blocks.push({ type: 'paragraph', text })
}

function parseMarkdownImage(line: string) {
  const match = line.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\s*$/)
  if (!match) return null
  return { caption: String(match[1] || match[3] || '').trim(), url: String(match[2] || '').trim() }
}

function isNumberedSectionLine(line: string) {
  const match = line.match(/^(\d{1,2})[.、]\s*(\S.{1,36})$/)
  if (!match) return false
  const text = String(match[2] || '').trim()
  if (/关于|重点|要求|注意|说明|反馈|沟通|更新|上传|填写|交接|标准/.test(text)) return true
  return !/[。；;:：，,]$/.test(text) && text.length <= 18
}

function parseLegacyCompanyContent(content: string): CompanyContentBlock[] {
  const normalized = stripLegacyHtml(content).replace(/\r\n?/g, '\n')
  const lines = normalized.split('\n')
  const blocks: CompanyContentBlock[] = []
  const paragraph: string[] = []
  let i = 0

  while (i < lines.length) {
    const raw = lines[i] || ''
    const line = raw.trimEnd()
    const trimmed = line.trim()

    if (!trimmed) {
      flushParagraph(paragraph, blocks)
      i += 1
      continue
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/)
    if (heading) {
      flushParagraph(paragraph, blocks)
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2].trim() })
      i += 1
      continue
    }

    if (isNumberedSectionLine(trimmed)) {
      flushParagraph(paragraph, blocks)
      blocks.push({ type: 'heading', level: 2, text: trimmed.replace(/^\d{1,2}[.、]\s*/, '').trim() })
      i += 1
      continue
    }

    if (/^((请.+注意|特别注意|重要提醒)[:：]?|最后[，,、]?|说明[:：]?)$/.test(trimmed)) {
      flushParagraph(paragraph, blocks)
      blocks.push({ type: 'callout', text: trimmed })
      i += 1
      continue
    }

    const image = parseMarkdownImage(trimmed)
    if (image?.url) {
      flushParagraph(paragraph, blocks)
      blocks.push({ type: 'image', url: image.url, caption: image.caption })
      i += 1
      continue
    }

    if (trimmed.startsWith('>')) {
      flushParagraph(paragraph, blocks)
      const quoteLines: string[] = []
      while (i < lines.length) {
        const quoteLine = String(lines[i] || '').trim()
        if (!quoteLine.startsWith('>')) break
        quoteLines.push(quoteLine.replace(/^>\s?/, '').trim())
        i += 1
      }
      if (quoteLines.length) blocks.push({ type: 'quote', text: quoteLines.join('\n').trim() })
      continue
    }

    const listMatch = trimmed.match(/^((?:[-*+•])|\d+[.)])\s*(.+)$/)
    if (listMatch) {
      flushParagraph(paragraph, blocks)
      const ordered = /^\d+[.)]$/.test(listMatch[1])
      const items: string[] = []
      while (i < lines.length) {
        const itemLine = String(lines[i] || '').trim()
        const itemMatch = itemLine.match(/^((?:[-*+•])|\d+[.)])\s*(.+)$/)
        if (!itemMatch) break
        if (isNumberedSectionLine(itemLine)) break
        const nextOrdered = /^\d+[.)]$/.test(itemMatch[1])
        if (nextOrdered !== ordered) break
        items.push(itemMatch[2].trim())
        i += 1
      }
      if (items.length) blocks.push({ type: 'list', ordered, items })
      continue
    }

    paragraph.push(trimmed)
    i += 1
  }

  flushParagraph(paragraph, blocks)
  return blocks.length ? blocks : [{ type: 'legacy_html', html: content }]
}

export function extractTextLinesFromCompanyContent(content: string | null | undefined): string[] {
  const { blocks, raw } = parseCompanyContentBlocks(content)
  if (!blocks.length) return []
  if (blocks.length === 1 && blocks[0]?.type === 'legacy_html') {
    return raw
      .replace(/<[^>]+>/g, ' ')
      .split(/\n+/)
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
  }

  const lines: string[] = []
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue
    if (block.type === 'heading' || block.type === 'paragraph' || block.type === 'callout') {
      const text = String(block.text || '').trim()
      if (text) lines.push(text)
      continue
    }
    if (block.type === 'quote' || block.type === 'code') {
      const text = String(block.text || '').trim()
      if (text) lines.push(text)
      continue
    }
    if (block.type === 'list') {
      const items = Array.isArray(block.items) ? block.items : []
      lines.push(...items.map((item) => String(item || '').trim()).filter(Boolean))
      continue
    }
    if (block.type === 'image' || block.type === 'video') {
      const caption = String(block.caption || '').trim()
      if (caption) lines.push(caption)
      continue
    }
    if (block.type === 'step') {
      const title = String(block.title || '').trim()
      if (title) lines.push(title)
      const contents = Array.isArray(block.contents) ? block.contents : []
      for (const item of contents) {
        const text = String(item?.text || item?.caption || '').trim()
        if (text) lines.push(text)
      }
    }
  }
  return lines
}

export function companyContentBody(content: string | null | undefined) {
  return extractTextLinesFromCompanyContent(content).join('\n')
}

export function companyContentSummary(content: string | null | undefined, fallback = '暂无内容') {
  const merged = extractTextLinesFromCompanyContent(content).slice(0, 3).join(' ').replace(/\s+/g, ' ').trim()
  if (!merged) return fallback
  return merged.length > 84 ? `${merged.slice(0, 84).trim()}...` : merged
}

export function hasStructuredCompanyContent(content: string | null | undefined) {
  const { blocks } = parseCompanyContentBlocks(content)
  return blocks.some((block) => block && block.type !== 'legacy_html')
}

export function companyGuideRoleLabel(role: CompanyGuideRole | null | undefined) {
  if (role === 'cleaning_inspector') return '检查员'
  if (role === 'cleaner') return '清洁员'
  return ''
}

export function companyContentCategoryLabel(category: CompanyContentCategory | null | undefined) {
  if (category === 'company_rule') return '公司制度'
  if (category === 'starter_guide') return '新手指南'
  if (category === 'role_guide') return '角色使用说明'
  if (category === 'work_guide') return '现场工作指南'
  if (category === 'customer_service_manual') return '客服手册'
  return '公司文档'
}
