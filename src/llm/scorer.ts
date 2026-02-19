import { callLLM, extractJson } from './client.js'
import type { RawItem } from '../types.js'
import { logger } from '../utils/logger.js'

const SYSTEM_PROMPT = `你是一个 AI/ML 领域的重要性评估专家。你的任务是评估文章与 AI/ML 的相关性和重要性。

**核心原则：本周报只关注 AI/ML/深度学习/大模型 相关内容。**

评分标准（1-10）：
- 9-10: AI 领域重大突破、新模型发布、行业变革性事件
- 7-8: 重要 AI 研究进展、知名 AI 公司/团队的显著成果
- 5-6: 有价值的 AI 研究、AI 相关实用工具或方法
- 3-4: 与 AI 间接相关的一般性内容
- 1-2: 与 AI/ML 无关的内容（如纯前端、政策法规、硬件评测、通用编程语言、传统软件等），无论多热门都给低分

关键判断：
- GitHub 仓库必须是 AI/ML 相关（模型、框架、数据集、AI 工具）才给 5+ 分
- Hacker News 文章必须直接涉及 AI/ML 技术才给 5+ 分
- 纯政策新闻、社会评论、非 AI 技术文章 → 1-2 分

只返回 JSON 数组，不要任何其他文字。`

const BATCH_SIZE = 30

interface ScoreResult {
  index: number
  score: number
  tags: string[]
}

export async function scoreItems(items: RawItem[]): Promise<Map<string, { score: number; tags: string[] }>> {
  if (items.length === 0) return new Map()

  const scores = new Map<string, { score: number; tags: string[] }>()

  for (let start = 0; start < items.length; start += BATCH_SIZE) {
    const chunk = items.slice(start, start + BATCH_SIZE)
    const batch = chunk.map((item, i) => ({
      index: i,
      title: item.title,
      content: item.content?.slice(0, 200) ?? '',
      source: item.sourceId,
    }))

    const prompt = `评估以下 ${chunk.length} 篇文章的重要性。

${JSON.stringify(batch)}

返回 JSON 数组：[{"index": 0, "score": 7, "tags": ["LLM", "效率优化"]}, ...]
score: 1-10 整数, tags: 2-3 个中文标签`

    logger.info(`Scoring batch ${start + 1}-${start + chunk.length} of ${items.length}...`)
    const response = await callLLM(prompt, SYSTEM_PROMPT)

    try {
      const parsed = JSON.parse(extractJson(response)) as ScoreResult[]
      for (const entry of parsed) {
        const item = chunk[entry.index]
        if (item) {
          scores.set(`${item.sourceId}:${item.externalId}`, {
            score: Math.min(10, Math.max(1, Math.round(entry.score))),
            tags: entry.tags ?? [],
          })
        }
      }
    } catch {
      logger.error(`Failed to parse scorer response for batch ${start + 1}-${start + chunk.length}`)
    }
  }

  return scores
}
