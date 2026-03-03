import type { RawItem, ScoredItem, DailyReport } from '../types.js'
import type { DataSource } from '../sources/base.js'
import { ArxivSource } from '../sources/arxiv.js'
import { HuggingFaceSource } from '../sources/huggingface.js'
import { HackerNewsSource } from '../sources/hackernews.js'
import { GitHubTrendingSource } from '../sources/github-trending.js'
import { BlogsSource } from '../sources/blogs.js'
import { dedup } from '../llm/dedup.js'
import { scoreItems } from '../llm/scorer.js'
import { summarizeItems, generateHighlights } from '../llm/summarizer.js'
import { logger } from '../utils/logger.js'

const MIN_SCORE = 5
const ITEMS_PER_CATEGORY = 5

/** Map sourceId to display category for grouping and capping */
export function getCategory(sourceId: string): string {
  if (sourceId.endsWith('-blog')) return '官方博客'
  switch (sourceId) {
    case 'hackernews': return '技术热点'
    case 'github-trending': return '开源项目'
    case 'arxiv': return '论文（arXiv）'
    case 'huggingface': return '论文（HuggingFace）'
    default: return '其他'
  }
}

/** Display order for categories */
const CATEGORY_ORDER = [
  '技术热点',
  '开源项目',
  '官方博客',
  '论文（arXiv）',
  '论文（HuggingFace）',
]

/** Truncate text at a sentence boundary, avoiding mid-word cuts */
function truncateAtSentence(text: string, maxLen: number): string {
  if (!text) return ''
  if (text.length <= maxLen) return text

  const truncated = text.slice(0, maxLen)
  // Try to cut at the last sentence-ending punctuation
  const lastSentence = truncated.search(/[.。！!？?;；]\s*[^.。！!？?;；]*$/)
  if (lastSentence > maxLen * 0.4) {
    return truncated.slice(0, lastSentence + 1)
  }
  // Fallback: cut at last space to avoid mid-word break
  const lastSpace = truncated.lastIndexOf(' ')
  if (lastSpace > maxLen * 0.4) {
    return truncated.slice(0, lastSpace) + '...'
  }
  return truncated + '...'
}

function getSources(): DataSource[] {
  return [
    new ArxivSource(),
    new HuggingFaceSource(),
    new HackerNewsSource(),
    new GitHubTrendingSource(),
    new BlogsSource(),
  ]
}

async function fetchAll(sources: DataSource[]): Promise<RawItem[]> {
  const results = await Promise.allSettled(
    sources.map(async s => {
      try {
        return await s.fetch()
      } catch (err) {
        logger.error(`Source ${s.name} failed:`, err)
        return []
      }
    })
  )

  const items: RawItem[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      items.push(...result.value)
    }
  }
  return items
}

export async function runDailyPipeline(): Promise<DailyReport> {
  const today = new Date().toISOString().slice(0, 10)
  logger.info(`Starting weekly pipeline for ${today}`)

  // Step 1: Fetch from all sources
  const sources = getSources()
  const rawItems = await fetchAll(sources)
  logger.info(`Fetched ${rawItems.length} items from ${sources.length} sources`)

  if (rawItems.length === 0) {
    logger.warn('No items fetched, generating empty report')
    return { date: today, items: [], highlights: '本周暂无重要 AI 资讯。', generatedAt: new Date() }
  }

  // Step 2: Dedup
  const { items: dedupedItems, dedupKeys } = await dedup(rawItems)

  // Step 3: Score all items
  const scores = await scoreItems(dedupedItems)

  // Step 4: Filter by score
  const worthyItems: RawItem[] = []
  const worthyScores = new Map<string, { score: number; tags: string[] }>()
  for (const item of dedupedItems) {
    const key = `${item.sourceId}:${item.externalId}`
    const scoreData = scores.get(key)
    const score = scoreData?.score ?? 5
    if (score >= MIN_SCORE) {
      worthyItems.push(item)
      if (scoreData) worthyScores.set(key, scoreData)
    }
  }
  logger.info(`Filtered to ${worthyItems.length} items (score >= ${MIN_SCORE})`)

  // Step 5: Pre-select top items per category (saves LLM tokens on summarization)
  const scored: Array<{ item: RawItem; score: number; tags: string[]; dedupKey: string }> = worthyItems.map(item => {
    const key = `${item.sourceId}:${item.externalId}`
    const scoreData = worthyScores.get(key) ?? { score: 5, tags: [] }
    return {
      item,
      score: scoreData.score,
      tags: scoreData.tags,
      dedupKey: dedupKeys.get(key) ?? item.title.toLowerCase().slice(0, 50),
    }
  })
  scored.sort((a, b) => b.score - a.score)

  // Group by category and take top N per category
  const categoryCounts = new Map<string, number>()
  const selectedItems = scored.filter(entry => {
    const category = getCategory(entry.item.sourceId)
    const count = categoryCounts.get(category) ?? 0
    if (count >= ITEMS_PER_CATEGORY) return false
    categoryCounts.set(category, count + 1)
    return true
  })

  logger.info(`Selected ${selectedItems.length} items (top ${ITEMS_PER_CATEGORY} per category)`)

  // Step 6: Summarize only selected items
  const itemsToSummarize = selectedItems.map(e => e.item)
  const summaries = await summarizeItems(itemsToSummarize)

  // Step 7: Build final ScoredItems in category order
  const scoredItems: ScoredItem[] = selectedItems.map(entry => {
    const key = `${entry.item.sourceId}:${entry.item.externalId}`
    const summaryResult = summaries.get(key)
    return {
      ...entry.item,
      title: summaryResult?.titleZh ?? entry.item.title,
      score: entry.score,
      tags: entry.tags,
      summary: summaryResult?.summary ?? truncateAtSentence(entry.item.content ?? '', 150),
      dedupKey: entry.dedupKey,
    }
  })

  // Sort by category order, then by score within category
  const finalItems = scoredItems.sort((a, b) => {
    const catA = CATEGORY_ORDER.indexOf(getCategory(a.sourceId))
    const catB = CATEGORY_ORDER.indexOf(getCategory(b.sourceId))
    if (catA !== catB) return catA - catB
    return b.score - a.score
  })

  // Step 8: Generate highlights from top items
  const highlights = await generateHighlights(finalItems)

  const report: DailyReport = {
    date: today,
    items: finalItems,
    highlights,
    generatedAt: new Date(),
  }

  logger.info(`Pipeline complete: ${finalItems.length} items in report (from ${dedupedItems.length} total)`)
  return report
}
