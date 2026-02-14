import type { RawItem } from '../types.js'
import type { DataSource } from './base.js'
import { fetchText } from '../utils/http.js'
import { logger } from '../utils/logger.js'

const ARXIV_API = 'https://export.arxiv.org/api/query'
const CATEGORIES = ['cs.AI', 'cs.CL', 'cs.LG', 'cs.CV']
const MAX_RESULTS = 100

interface ArxivEntry {
  id: string
  title: string
  summary: string
  authors: string[]
  published: string
  link: string
  categories: string[]
}

function parseEntries(xml: string): ArxivEntry[] {
  const entries: ArxivEntry[] = []
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
  let match: RegExpExecArray | null

  while ((match = entryRegex.exec(xml)) !== null) {
    const block = match[1]

    const id = block.match(/<id>(.*?)<\/id>/)?.[1] ?? ''
    const title = (block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '').replace(/\s+/g, ' ').trim()
    const summary = (block.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] ?? '').replace(/\s+/g, ' ').trim()
    const published = block.match(/<published>(.*?)<\/published>/)?.[1] ?? ''

    const linkMatch = block.match(/<link[^>]*href="([^"]*)"[^>]*rel="alternate"/) ??
                      block.match(/<link[^>]*rel="alternate"[^>]*href="([^"]*)"/)
    const link = linkMatch?.[1] ?? id

    const authors: string[] = []
    const authorRegex = /<author>\s*<name>(.*?)<\/name>/g
    let authorMatch: RegExpExecArray | null
    while ((authorMatch = authorRegex.exec(block)) !== null) {
      authors.push(authorMatch[1])
    }

    const categories: string[] = []
    const catRegex = /<category[^>]*term="([^"]*)"/g
    let catMatch: RegExpExecArray | null
    while ((catMatch = catRegex.exec(block)) !== null) {
      categories.push(catMatch[1])
    }

    entries.push({ id, title, summary, authors, published, link, categories })
  }

  return entries
}

export class ArxivSource implements DataSource {
  name = 'arxiv'

  async fetch(): Promise<RawItem[]> {
    const categoryQuery = CATEGORIES.map(c => `cat:${c}`).join('+OR+')
    const url = `${ARXIV_API}?search_query=${categoryQuery}&sortBy=submittedDate&sortOrder=descending&max_results=${MAX_RESULTS}`

    logger.info(`Fetching arXiv papers...`)
    const xml = await fetchText(url)
    const entries = parseEntries(xml)
    logger.info(`Fetched ${entries.length} arXiv papers`)

    return entries.map(entry => ({
      sourceId: this.name,
      externalId: entry.id,
      title: entry.title,
      url: entry.link,
      content: entry.summary,
      authors: entry.authors,
      publishedAt: new Date(entry.published),
      metadata: { categories: entry.categories },
    }))
  }
}
