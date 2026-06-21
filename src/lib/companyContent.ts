import type { CompanyGuideRole } from './api'

export type CompanyContentStepItem = { type: 'text' | 'image' | 'video'; text?: string; url?: string; caption?: string }

export type CompanyContentBlock =
  | { type: 'heading'; text?: string }
  | { type: 'paragraph'; text?: string }
  | { type: 'callout'; text?: string }
  | { type: 'image'; url?: string; caption?: string }
  | { type: 'video'; url?: string; caption?: string }
  | { type: 'step'; title?: string; contents?: CompanyContentStepItem[] }
  | { type: 'legacy_html'; html?: string }

export function parseCompanyContentBlocks(content: string | null | undefined): { blocks: CompanyContentBlock[]; raw: string } {
  const raw = String(content || '')
  const trimmed = raw.trim()
  if (!trimmed) return { blocks: [], raw }
  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) return { blocks: parsed as CompanyContentBlock[], raw }
  } catch {}
  return { blocks: [{ type: 'legacy_html', html: raw }], raw }
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
