import type { RawItem, ScoredItem, DailyReport } from '../types.js'
import type { DataSource } from '../sources/base.js'
import { ArxivSource } from '../sources/arxiv.js'
import { HuggingFaceSource } from '../sources/huggingface.js'
import { HackerNewsSource } from '../sources/hackernews.js'
import { GitHubTrendingSource } from '../sources/github-trending.js'
import { BlogsSource } from '../sources/blogs.js'
import { dedup } from '../llm/dedup.js'
import { scoreItems } from '../llm/scorer.js'
import { summarizeItems } from '../llm/summarizer.js'
import { logger } from '../utils/logger.js'

const MIN_SCORE = 5
const MAX_REPORT_ITEMS = 50
/** Per-source caps applied after scoring (keeps top N by score for each source) */
const SOURCE_CAPS: Record<string, number> = {
  arxiv: 10,
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
  logger.info(`Starting daily pipeline for ${today}`)

  // Step 1: Fetch from all sources
  const sources = getSources()
  const rawItems = await fetchAll(sources)
  logger.info(`Fetched ${rawItems.length} items from ${sources.length} sources`)

  if (rawItems.length === 0) {
    logger.warn('No items fetched, generating empty report')
    return { date: today, items: [], generatedAt: new Date() }
  }

  // Step 2: Dedup
  const { items: dedupedItems, dedupKeys } = await dedup(rawItems)

  // Step 3: Score all items
  const scores = await scoreItems(dedupedItems)

  // Step 4: Filter by score — only summarize high-value items (saves LLM tokens)
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

  // Step 5: Summarize only worthy items
  const summaries = await summarizeItems(worthyItems)

  // Step 6: Merge into ScoredItems, sort, and cap
  const scoredItems: ScoredItem[] = worthyItems.map(item => {
    const key = `${item.sourceId}:${item.externalId}`
    const scoreData = worthyScores.get(key) ?? { score: 5, tags: [] }
    const summaryResult = summaries.get(key)
    return {
      ...item,
      title: summaryResult?.titleZh ?? item.title,
      score: scoreData.score,
      tags: scoreData.tags,
      summary: summaryResult?.summary ?? item.content?.slice(0, 150) ?? '',
      dedupKey: dedupKeys.get(key) ?? item.title.toLowerCase().slice(0, 50),
    }
  })

  scoredItems.sort((a, b) => b.score - a.score)

  // Apply per-source caps (e.g. keep only top 10 arXiv papers)
  const sourceCounts = new Map<string, number>()
  const cappedItems = scoredItems.filter(item => {
    const cap = SOURCE_CAPS[item.sourceId]
    if (cap === undefined) return true
    const count = sourceCounts.get(item.sourceId) ?? 0
    if (count >= cap) return false
    sourceCounts.set(item.sourceId, count + 1)
    return true
  })

  const finalItems = cappedItems.slice(0, MAX_REPORT_ITEMS)

  const report: DailyReport = {
    date: today,
    items: finalItems,
    generatedAt: new Date(),
  }

  logger.info(`Pipeline complete: ${finalItems.length} items in report (from ${dedupedItems.length} total)`)
  return report
}
