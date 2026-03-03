import * as cheerio from 'cheerio'
import type { RawItem } from '../types.js'
import type { DataSource } from './base.js'
import { fetchJson, fetchText } from '../utils/http.js'
import { logger } from '../utils/logger.js'

const GITHUB_TRENDING_URL = 'https://github.com/trending'
const GITHUB_API = 'https://api.github.com'
const README_SNIPPET_LENGTH = 500

interface GitHubRepoInfo {
  description: string | null
  topics: string[]
}

interface GitHubReadmeResponse {
  content: string
  encoding: string
}

/**
 * Extract the first meaningful paragraph from a README (skip badges, headings, blank lines).
 */
function extractReadmeSnippet(base64Content: string): string {
  const text = Buffer.from(base64Content, 'base64').toString('utf-8')
  const lines = text.split('\n')
  const paragraphLines: string[] = []
  let collecting = false

  for (const line of lines) {
    const trimmed = line.trim()
    // Skip headings, badges, HTML tags, empty lines at start
    if (!collecting) {
      if (
        !trimmed ||
        trimmed.startsWith('#') ||
        trimmed.startsWith('![') ||
        trimmed.startsWith('[![') ||
        trimmed.startsWith('<') ||
        trimmed.startsWith('---') ||
        trimmed.startsWith('```')
      ) continue
      collecting = true
    }

    if (collecting) {
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('```')) break
      paragraphLines.push(trimmed)
    }
  }

  return paragraphLines.join(' ').slice(0, README_SNIPPET_LENGTH)
}

/** Fetch repo info and README snippet from GitHub API (unauthenticated) */
async function enrichRepoFromAPI(fullName: string): Promise<string> {
  const parts: string[] = []

  try {
    const repo = await fetchJson<GitHubRepoInfo>(`${GITHUB_API}/repos/${fullName}`, {
      headers: {
        'User-Agent': 'ai-daily-monitor/0.1',
        'Accept': 'application/vnd.github.v3+json',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (repo.description) parts.push(repo.description)
    if (repo.topics?.length) parts.push(`Topics: ${repo.topics.join(', ')}`)
  } catch (err) {
    logger.debug(`GitHub API /repos/${fullName} failed: ${err instanceof Error ? err.message : err}`)
  }

  try {
    const readme = await fetchJson<GitHubReadmeResponse>(`${GITHUB_API}/repos/${fullName}/readme`, {
      headers: {
        'User-Agent': 'ai-daily-monitor/0.1',
        'Accept': 'application/vnd.github.v3+json',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (readme.content) {
      const snippet = extractReadmeSnippet(readme.content)
      if (snippet) parts.push(snippet)
    }
  } catch (err) {
    logger.debug(`GitHub API /repos/${fullName}/readme failed: ${err instanceof Error ? err.message : err}`)
  }

  return parts.join('\n\n')
}

export class GitHubTrendingSource implements DataSource {
  name = 'github-trending'

  async fetch(): Promise<RawItem[]> {
    logger.info('Fetching GitHub Trending (weekly)...')
    const html = await fetchText(`${GITHUB_TRENDING_URL}?since=weekly`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ai-daily-monitor/0.1)',
      },
    })

    const $ = cheerio.load(html)
    const items: RawItem[] = []

    $('article.Box-row').each((_i, el) => {
      const $el = $(el)

      const repoLink = $el.find('h2 a').attr('href')?.trim()
      if (!repoLink) return

      const fullName = repoLink.slice(1) // remove leading "/"
      const description = $el.find('p').text().trim() || undefined
      const language = $el.find('[itemprop="programmingLanguage"]').text().trim() || undefined

      const starsText = $el.find('.d-inline-block.float-sm-right, span.float-sm-right').text().trim()
      const todayStars = parseInt(starsText.replace(/[^0-9]/g, ''), 10) || 0

      items.push({
        sourceId: this.name,
        externalId: fullName,
        title: fullName,
        url: `https://github.com${repoLink}`,
        content: description,
        publishedAt: new Date(),
        metadata: {
          language,
          todayStars,
        },
      })
    })

    logger.info(`Fetched ${items.length} GitHub trending repos, enriching via API...`)

    // Enrich repos with GitHub API data (concurrency 5)
    const CONCURRENCY = 5
    for (let i = 0; i < items.length; i += CONCURRENCY) {
      const batch = items.slice(i, i + CONCURRENCY)
      const enriched = await Promise.all(
        batch.map(item => enrichRepoFromAPI(item.externalId))
      )
      for (let j = 0; j < batch.length; j++) {
        if (enriched[j]) {
          items[i + j].content = enriched[j]
        }
      }
    }

    logger.info(`Enriched ${items.length} GitHub trending repos`)
    return items
  }
}
