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
    const today = new Date().toISOString().slice(0, 10)
    const url = `${HF_API}?date=${today}`

    logger.info(`Fetching HuggingFace daily papers...`)
    const papers = await fetchJson<HFDailyPaper[]>(url)
    logger.info(`Fetched ${papers.length} HuggingFace papers`)

    return papers.map(item => ({
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
    }))
  }
}
