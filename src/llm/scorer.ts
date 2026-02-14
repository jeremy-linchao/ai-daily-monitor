import { callLLM } from './client.js'
import type { RawItem } from '../types.js'
import { logger } from '../utils/logger.js'

const SYSTEM_PROMPT = `你是一个 AI/科技领域的重要性评估专家。你的任务是评估技术文章的重要性。

评分标准（1-10）：
- 9-10: 重大突破、新模型发布、行业变革性事件
- 7-8: 重要研究进展、知名公司/团队的显著成果
- 5-6: 有价值的研究、实用工具或方法
- 3-4: 一般性内容、增量改进
- 1-2: 边缘内容、低关注度

考虑因素：
- 来源权威性（顶会论文 > 博客）
- 社区关注度（HN 高分、GitHub 高星）
- 创新程度
- 实际影响力

返回纯 JSON 格式，不要 markdown 代码块`

interface ScoreResult {
  index: number
  score: number
  tags: string[]
}

export async function scoreItems(items: RawItem[]): Promise<Map<string, { score: number; tags: string[] }>> {
  if (items.length === 0) return new Map()

  const batch = items.map((item, i) => ({
    index: i,
    title: item.title,
    content: item.content?.slice(0, 300) ?? '',
    source: item.sourceId,
    metadata: item.metadata,
  }))

  const prompt = `评估以下 ${items.length} 篇文章的重要性。

文章列表：
${JSON.stringify(batch, null, 2)}

返回 JSON 数组，格式：[{"index": 0, "score": 7, "tags": ["LLM", "效率优化"]}, ...]
- score: 1-10 的整数
- tags: 2-4 个中文标签`

  logger.info(`Scoring ${items.length} items...`)
  const response = await callLLM(prompt, SYSTEM_PROMPT)

  const scores = new Map<string, { score: number; tags: string[] }>()
  try {
    const parsed = JSON.parse(response) as ScoreResult[]
    for (const entry of parsed) {
      const item = items[entry.index]
      if (item) {
        scores.set(`${item.sourceId}:${item.externalId}`, {
          score: Math.min(10, Math.max(1, Math.round(entry.score))),
          tags: entry.tags,
        })
      }
    }
  } catch {
    logger.error('Failed to parse scorer response')
  }

  return scores
}
