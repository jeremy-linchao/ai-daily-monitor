import { callLLM, extractJson } from './client.js'
import type { RawItem } from '../types.js'
import { logger } from '../utils/logger.js'

const SYSTEM_PROMPT = `你是一个去重专家。你的任务是识别多个数据源中报道同一事件的条目。

去重规则：
- 同一篇论文在 arXiv 和 HuggingFace 都出现 → 合并
- 同一个 GitHub 项目在多个源出现 → 合并
- 同一事件的不同角度报道 → 合并
- 仅主题相似但不是同一事件 → 不合并

只返回 JSON 数组，不要任何其他文字。`

interface DedupGroup {
  keepIndex: number
  duplicateIndices: number[]
  dedupKey: string
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    // Remove trailing slash, hash, common tracking params
    u.hash = ''
    u.searchParams.delete('utm_source')
    u.searchParams.delete('utm_medium')
    u.searchParams.delete('utm_campaign')
    u.searchParams.delete('ref')
    let path = u.pathname.replace(/\/+$/, '')
    return `${u.host}${path}${u.search}`
  } catch {
    return url.toLowerCase().trim()
  }
}

/** Deterministic URL-based dedup: remove items whose URL points to the same page */
function urlDedup(items: RawItem[]): RawItem[] {
  const seen = new Map<string, number>()
  const result: RawItem[] = []

  // Priority: prefer blog/official sources over aggregators like HN
  const sourcePriority: Record<string, number> = {
    'openai-blog': 1, 'deepmind-blog': 1, 'anthropic-blog': 1,
    'mistral-blog': 1, 'meta-ai-blog': 1,
    'arxiv': 2, 'huggingface': 2,
    'github-trending': 3,
    'hackernews': 4,
  }

  // Sort by source priority (lower = keep first)
  const sorted = [...items].sort((a, b) =>
    (sourcePriority[a.sourceId] ?? 5) - (sourcePriority[b.sourceId] ?? 5)
  )

  for (const item of sorted) {
    const key = normalizeUrl(item.url)
    if (seen.has(key)) continue
    seen.set(key, 1)
    result.push(item)
  }

  return result
}

export async function dedup(items: RawItem[]): Promise<{ items: RawItem[]; dedupKeys: Map<string, string> }> {
  // Phase 1: Deterministic URL dedup
  const urlDedupedItems = urlDedup(items)
  if (urlDedupedItems.length < items.length) {
    logger.info(`URL dedup: ${items.length} → ${urlDedupedItems.length} items`)
  }

  if (urlDedupedItems.length <= 1) {
    const dedupKeys = new Map<string, string>()
    for (const item of urlDedupedItems) {
      dedupKeys.set(`${item.sourceId}:${item.externalId}`, item.title.toLowerCase().slice(0, 50))
    }
    return { items: urlDedupedItems, dedupKeys }
  }

  // Phase 2: LLM semantic dedup (same event reported differently)
  // Only send titles and URLs for dedup (much smaller payload)
  const batch = urlDedupedItems.map((item, i) => ({
    index: i,
    title: item.title,
    source: item.sourceId,
    url: item.url,
  }))

  const prompt = `分析以下 ${urlDedupedItems.length} 个条目，找出重复项（同一事件/论文/项目）。

条目列表：
${JSON.stringify(batch)}

只返回有重复的组，格式：[{"keepIndex": 0, "duplicateIndices": [3], "dedupKey": "简短描述"}, ...]
如果没有任何重复，返回空数组 []`

  logger.info(`Deduplicating ${urlDedupedItems.length} items (semantic)...`)
  const response = await callLLM(prompt, SYSTEM_PROMPT)

  const dedupKeys = new Map<string, string>()
  const removeIndices = new Set<number>()

  try {
    const parsed = JSON.parse(extractJson(response)) as DedupGroup[]
    for (const group of parsed) {
      const keepItem = urlDedupedItems[group.keepIndex]
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

  const dedupedItems = urlDedupedItems.filter((_, i) => !removeIndices.has(i))

  for (const item of dedupedItems) {
    const key = `${item.sourceId}:${item.externalId}`
    if (!dedupKeys.has(key)) {
      dedupKeys.set(key, item.title.toLowerCase().slice(0, 50))
    }
  }

  logger.info(`Deduplication: ${items.length} → ${dedupedItems.length} items (URL: -${items.length - urlDedupedItems.length}, semantic: -${urlDedupedItems.length - dedupedItems.length})`)
  return { items: dedupedItems, dedupKeys }
}
