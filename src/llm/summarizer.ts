import { callLLM } from './client.js'
import type { RawItem } from '../types.js'
import { logger } from '../utils/logger.js'

const SYSTEM_PROMPT = `你是一个 AI/科技领域的技术编辑。你的任务是为技术文章生成简洁的中文摘要。

要求：
- 用中文输出
- 每篇摘要 2-3 句话，不超过 150 字
- 突出核心创新点和实际意义
- 使用专业但易懂的语言
- 返回纯 JSON 格式，不要 markdown 代码块`

export async function summarizeItems(items: RawItem[]): Promise<Map<string, string>> {
  if (items.length === 0) return new Map()

  const batch = items.map((item, i) => ({
    index: i,
    title: item.title,
    content: item.content?.slice(0, 500) ?? '',
    source: item.sourceId,
  }))

  const prompt = `为以下 ${items.length} 篇文章生成中文摘要。

文章列表：
${JSON.stringify(batch, null, 2)}

返回 JSON 数组，格式：[{"index": 0, "summary": "中文摘要..."}, ...]`

  logger.info(`Summarizing ${items.length} items...`)
  const response = await callLLM(prompt, SYSTEM_PROMPT)

  const summaries = new Map<string, string>()
  try {
    const parsed = JSON.parse(response) as Array<{ index: number; summary: string }>
    for (const entry of parsed) {
      const item = items[entry.index]
      if (item) {
        summaries.set(`${item.sourceId}:${item.externalId}`, entry.summary)
      }
    }
  } catch {
    logger.error('Failed to parse summarizer response')
  }

  return summaries
}
