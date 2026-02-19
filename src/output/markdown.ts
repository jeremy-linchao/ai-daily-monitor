import type { DailyReport } from '../types.js'
import { config } from '../config.js'

function toBeijingTime(date: Date): string {
  return date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
}

function getModelName(): string {
  if (config.llmProvider === 'anthropic') return 'Claude Sonnet 4.5 (Anthropic)'
  return 'DeepSeek Chat (DeepSeek)'
}

export function generateMarkdown(report: DailyReport): string {
  const lines: string[] = []

  lines.push(`# AI 日报 - ${report.date}`)
  lines.push('')
  lines.push(`> 生成时间: ${toBeijingTime(report.generatedAt)} (北京时间)`)
  lines.push(`> 分析模型: ${getModelName()}`)
  lines.push(`> 共 ${report.items.length} 条`)
  lines.push('')

  if (report.items.length === 0) {
    lines.push('今日暂无重要内容。')
    return lines.join('\n')
  }

  for (const item of report.items) {
    const scoreEmoji = item.score >= 8 ? '🔥' : item.score >= 6 ? '⭐' : '📌'
    lines.push(`## ${scoreEmoji} [${item.score}/10] ${item.title}`)
    lines.push('')
    lines.push(`**来源**: ${item.sourceId} | **标签**: ${item.tags.join(', ')}`)
    lines.push('')
    lines.push(item.summary)
    lines.push('')
    lines.push(`🔗 [原文链接](${item.url})`)
    if (item.authors?.length && item.sourceId !== 'arxiv') {
      lines.push(`👤 ${item.authors.join(', ')}`)
    }
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}
