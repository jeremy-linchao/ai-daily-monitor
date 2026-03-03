import type { DailyReport, ScoredItem } from '../types.js'
import { config } from '../config.js'
import { getCategory } from '../pipeline/daily.js'

function toBeijingTime(date: Date): string {
  return date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
}

function getModelName(): string {
  if (config.llmProvider === 'anthropic') return 'Claude Sonnet 4.6 (Anthropic)'
  return 'DeepSeek Chat (DeepSeek)'
}

/** Display order for categories */
const CATEGORY_ORDER = [
  '技术热点',
  '开源项目',
  '官方博客',
  '论文（arXiv）',
  '论文（HuggingFace）',
]

function groupByCategory(items: ScoredItem[]): Map<string, ScoredItem[]> {
  const groups = new Map<string, ScoredItem[]>()
  for (const item of items) {
    const category = getCategory(item.sourceId)
    const list = groups.get(category) ?? []
    list.push(item)
    groups.set(category, list)
  }
  return groups
}

export function generateMarkdown(report: DailyReport): string {
  const lines: string[] = []

  lines.push(`# AI 周报 - ${report.date}`)
  lines.push('')
  lines.push(`> 生成时间: ${toBeijingTime(report.generatedAt)} (北京时间)`)
  lines.push(`> 分析模型: ${getModelName()}`)
  lines.push(`> 共 ${report.items.length} 条`)
  lines.push('')

  if (report.items.length === 0) {
    lines.push('本周暂无重要内容。')
    return lines.join('\n')
  }

  // Highlights section
  lines.push('## 本周精华')
  lines.push('')
  lines.push(report.highlights)
  lines.push('')
  lines.push('---')
  lines.push('')

  // Group by category and render in order
  const groups = groupByCategory(report.items)

  for (const category of CATEGORY_ORDER) {
    const items = groups.get(category)
    if (!items || items.length === 0) continue

    lines.push(`## ${category}`)
    lines.push('')

    for (const item of items) {
      const scoreEmoji = item.score >= 8 ? '🔥' : item.score >= 6 ? '⭐' : '📌'
      lines.push(`### ${scoreEmoji} [${item.score}/10] ${item.title}`)
      lines.push('')
      lines.push(`**标签**: ${item.tags.join(', ')}`)
      lines.push('')
      lines.push(item.summary)
      lines.push('')
      lines.push(`🔗 [原文链接](${item.url})`)
      lines.push('')
    }

    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}
