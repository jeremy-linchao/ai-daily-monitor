import type { RawItem, ScoredItem, DailyReport } from '../types.js'
import type { DataSource } from '../sources/base.js'
import { ArxivSource } from '../sources/arxiv.js'
import { HuggingFaceSource } from '../sources/huggingface.js'
import { HackerNewsSource } from '../sources/hackernews.js'
import { GitHubTrendingSource } from '../sources/github-trending.js'
import { dedup } from '../llm/dedup.js'
import { scoreItems } from '../llm/scorer.js'
import { summarizeItems } from '../llm/summarizer.js'
import { logger } from '../utils/logger.js'

function getSources(): DataSource[] {
  return [
    new ArxivSource(),
    new HuggingFaceSource(),
    new HackerNewsSource(),
    new GitHubTrendingSource(),
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

  // Step 3: Score
  const scores = await scoreItems(dedupedItems)

  // Step 4: Summarize
  const summaries = await summarizeItems(dedupedItems)

  // Step 5: Merge into ScoredItems
  const scoredItems: ScoredItem[] = dedupedItems.map(item => {
    const key = `${item.sourceId}:${item.externalId}`
    const scoreData = scores.get(key) ?? { score: 5, tags: [] }
    return {
      ...item,
      score: scoreData.score,
      tags: scoreData.tags,
      summary: summaries.get(key) ?? item.content?.slice(0, 150) ?? '',
      dedupKey: dedupKeys.get(key) ?? item.title.toLowerCase().slice(0, 50),
    }
  })

  // Step 6: Sort by score descending
  scoredItems.sort((a, b) => b.score - a.score)

  const report: DailyReport = {
    date: today,
    items: scoredItems,
    generatedAt: new Date(),
  }

  logger.info(`Pipeline complete: ${report.items.length} items in report`)
  return report
}
