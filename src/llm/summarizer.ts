import { callLLM, extractJson } from './client.js'
import type { RawItem, ScoredItem } from '../types.js'
import { logger } from '../utils/logger.js'

const SYSTEM_PROMPT = `你是一个 AI/科技领域的技术编辑。你的任务是为技术文章生成简洁的中文摘要。

要求：
- 用中文输出
- 每篇摘要 2-3 句话，不超过 150 字
- 突出核心创新点和实际意义
- 使用专业但易懂的语言
- 如果文章标题是英文，必须返回 title_zh 字段（中文翻译标题），所有数据源都需要

只返回 JSON 数组，不要任何其他文字。`

const BATCH_SIZE = 20

export interface SummaryResult {
  summary: string
  titleZh?: string
}

export async function summarizeItems(items: RawItem[]): Promise<Map<string, SummaryResult>> {
  if (items.length === 0) return new Map()

  const summaries = new Map<string, SummaryResult>()

  for (let start = 0; start < items.length; start += BATCH_SIZE) {
    const chunk = items.slice(start, start + BATCH_SIZE)
    const batch = chunk.map((item, i) => ({
      index: i,
      title: item.title,
      content: item.content?.slice(0, 500) ?? '',
      source: item.sourceId,
    }))

    const prompt = `为以下 ${chunk.length} 篇文章生成中文摘要。

${JSON.stringify(batch)}

返回 JSON 数组：[{"index": 0, "summary": "中文摘要...", "title_zh": "中文标题（英文标题必须翻译，已是中文则原样返回）"}, ...]`

    logger.info(`Summarizing batch ${start + 1}-${start + chunk.length} of ${items.length}...`)
    const response = await callLLM(prompt, SYSTEM_PROMPT)

    try {
      const parsed = JSON.parse(extractJson(response)) as Array<{ index: number; summary: string; title_zh?: string }>
      for (const entry of parsed) {
        const item = chunk[entry.index]
        if (item) {
          summaries.set(`${item.sourceId}:${item.externalId}`, {
            summary: entry.summary,
            titleZh: entry.title_zh,
          })
        }
      }
    } catch {
      logger.error(`Failed to parse summarizer response for batch ${start + 1}-${start + chunk.length}`)
    }
  }

  return summaries
}

const HIGHLIGHTS_PROMPT = `你是一个 AI/科技领域的资深编辑。请根据本周最重要的 AI 资讯，撰写一段精华总结。

要求：
- 用中文输出
- 3-5 句话概括本周 AI 领域最值得关注的动态和趋势
- 突出重大发布、突破性研究、行业趋势
- 语言简洁有力，适合快速阅读
- 直接输出总结文本，不要任何前缀或格式标记`

export async function generateHighlights(items: ScoredItem[]): Promise<string> {
  if (items.length === 0) return '本周暂无重要 AI 资讯。'

  const topItems = items.slice(0, 10).map(item => ({
    title: item.title,
    summary: item.summary,
    score: item.score,
    source: item.sourceId,
  }))

  const prompt = `以下是本周最重要的 AI 资讯（按重要性排序）：

${JSON.stringify(topItems)}

请撰写本周 AI 领域精华总结。`

  logger.info('Generating weekly highlights...')
  try {
    return await callLLM(prompt, HIGHLIGHTS_PROMPT)
  } catch {
    logger.error('Failed to generate highlights')
    return '本周精华总结生成失败。'
  }
}
