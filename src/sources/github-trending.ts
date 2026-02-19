import * as cheerio from 'cheerio'
import type { RawItem } from '../types.js'
import type { DataSource } from './base.js'
import { fetchText } from '../utils/http.js'
import { logger } from '../utils/logger.js'

const GITHUB_TRENDING_URL = 'https://github.com/trending'

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

    logger.info(`Fetched ${items.length} GitHub trending repos`)
    return items
  }
}
