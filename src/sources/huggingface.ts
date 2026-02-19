import type { RawItem } from '../types.js'
import type { DataSource } from './base.js'
import { fetchJson } from '../utils/http.js'
import { logger } from '../utils/logger.js'

const HF_API = 'https://huggingface.co/api/daily_papers'

interface HFAuthor {
  name: string
}

interface HFPaper {
  id: string
  title: string
  summary: string
  authors: HFAuthor[]
  publishedAt: string
  upvotes: number
  ai_summary?: string
  ai_keywords?: string[]
  githubRepo?: string
  githubStars?: number
}

interface HFDailyPaper {
  title: string
  summary: string
  publishedAt: string
  paper: HFPaper
}

export class HuggingFaceSource implements DataSource {
  name = 'huggingface'

  async fetch(): Promise<RawItem[]> {
    const allPapers: RawItem[] = []
    const seen = new Set<string>()

    // Fetch past 7 days
    for (let i = 0; i < 7; i++) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().slice(0, 10)
      const url = `${HF_API}?date=${dateStr}`

      logger.info(`Fetching HuggingFace papers for ${dateStr}...`)
      try {
        const papers = await fetchJson<HFDailyPaper[]>(url)
        for (const item of papers) {
          if (seen.has(item.paper.id)) continue
          seen.add(item.paper.id)
          allPapers.push({
            sourceId: this.name,
            externalId: item.paper.id,
            title: item.paper.title,
            url: `https://huggingface.co/papers/${item.paper.id}`,
            content: item.paper.summary,
            authors: item.paper.authors.map(a => a.name),
            publishedAt: new Date(item.publishedAt),
            metadata: {
              upvotes: item.paper.upvotes,
              aiSummary: item.paper.ai_summary,
              aiKeywords: item.paper.ai_keywords,
              githubRepo: item.paper.githubRepo,
              githubStars: item.paper.githubStars,
            },
          })
        }
      } catch (err) {
        logger.warn(`Failed to fetch HuggingFace papers for ${dateStr}:`, err)
      }
    }

    logger.info(`Fetched ${allPapers.length} HuggingFace papers (past 7 days)`)
    return allPapers
  }
}
