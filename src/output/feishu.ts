import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import type { DailyReport } from '../types.js'

export async function pushToFeishu(report: DailyReport, markdown: string): Promise<void> {
  if (!config.feishuWebhookUrl || config.feishuWebhookUrl.includes('xxxxx')) {
    logger.warn('FEISHU_WEBHOOK_URL not configured, skipping Feishu push')
    return
  }

  const title = `AI 日报 - ${report.date} (${report.items.length} 条)`

  const body = {
    msg_type: 'interactive',
    card: {
      header: {
        title: { tag: 'plain_text', content: title },
        template: 'blue',
      },
      elements: [
        {
          tag: 'markdown',
          content: truncateForFeishu(markdown),
        },
      ],
    },
  }

  logger.info(`Pushing to Feishu...`)
  const res = await fetch(config.feishuWebhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(`Feishu webhook failed: HTTP ${res.status}`)
  }

  const result = await res.json() as Record<string, unknown>
  if (result.code !== 0) {
    throw new Error(`Feishu webhook error: ${JSON.stringify(result)}`)
  }

  logger.info('Feishu push successful')
}

function truncateForFeishu(content: string): string {
  // Feishu card markdown has a ~30KB limit
  const MAX_LENGTH = 28000
  if (content.length <= MAX_LENGTH) return content
  return content.slice(0, MAX_LENGTH) + '\n\n... (内容已截断)'
}
