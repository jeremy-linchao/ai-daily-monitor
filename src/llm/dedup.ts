import { callLLM } from './client.js'
import type { RawItem } from '../types.js'
import { logger } from '../utils/logger.js'

const SYSTEM_PROMPT = `你是一个去重专家。你的任务是识别多个数据源中报道同一事件的条目。

去重规则：
- 同一篇论文在 arXiv 和 HuggingFace 都出现 → 合并
- 同一个 GitHub 项目在多个源出现 → 合并
- 同一事件的不同角度报道 → 合并
- 仅主题相似但不是同一事件 → 不合并

返回纯 JSON 格式，不要 markdown 代码块`

interface DedupGroup {
  keepIndex: number
  duplicateIndices: number[]
  dedupKey: string
}

export async function dedup(items: RawItem[]): Promise<{ items: RawItem[]; dedupKeys: Map<string, string> }> {
  if (items.length <= 1) {
    const dedupKeys = new Map<string, string>()
    for (const item of items) {
      dedupKeys.set(`${item.sourceId}:${item.externalId}`, item.title.toLowerCase().slice(0, 50))
    }
    return { items, dedupKeys }
  }

  const batch = items.map((item, i) => ({
    index: i,
    title: item.title,
    source: item.sourceId,
    url: item.url,
    content: item.content?.slice(0, 200) ?? '',
  }))

  const prompt = `分析以下 ${items.length} 个条目，找出重复项（同一事件/论文/项目）。

条目列表：
${JSON.stringify(batch, null, 2)}

返回 JSON 数组，每组重复中保留最佳来源：
[{"keepIndex": 0, "duplicateIndices": [3, 7], "dedupKey": "简短描述"}, ...]

- keepIndex: 保留的条目索引（优先保留有更多信息的来源）
- duplicateIndices: 要去掉的重复条目索引
- dedupKey: 该事件的简短标识
- 没有重复的条目也要包含，duplicateIndices 为空数组`

  logger.info(`Deduplicating ${items.length} items...`)
  const response = await callLLM(prompt, SYSTEM_PROMPT)

  const dedupKeys = new Map<string, string>()
  const removeIndices = new Set<number>()

  try {
    const parsed = JSON.parse(response) as DedupGroup[]
    for (const group of parsed) {
      const keepItem = items[group.keepIndex]
      if (keepItem) {
        dedupKeys.set(`${keepItem.sourceId}:${keepItem.externalId}`, group.dedupKey)
      }
      for (const idx of group.duplicateIndices) {
        removeIndices.add(idx)
      }
    }
  } catch {
    logger.error('Failed to parse dedup response, keeping all items')
  }

  const dedupedItems = items.filter((_, i) => !removeIndices.has(i))

  // Ensure all kept items have a dedup key
  for (const item of dedupedItems) {
    const key = `${item.sourceId}:${item.externalId}`
    if (!dedupKeys.has(key)) {
      dedupKeys.set(key, item.title.toLowerCase().slice(0, 50))
    }
  }

  logger.info(`Deduplication: ${items.length} → ${dedupedItems.length} items`)
  return { items: dedupedItems, dedupKeys }
}
