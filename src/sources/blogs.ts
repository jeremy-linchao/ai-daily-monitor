import RSSParser from 'rss-parser'
import * as cheerio from 'cheerio'
import type { RawItem } from '../types.js'
import type { DataSource } from './base.js'
import { fetchText } from '../utils/http.js'
import { logger } from '../utils/logger.js'
import { enrichWithSnippets } from '../utils/content-enricher.js'

interface BlogFeedConfig {
  id: string
  name: string
  type: 'rss' | 'html'
  url: string
  /** CSS selector for article list items (html type only) */
  selector?: string
  /** Base URL for relative links */
  baseUrl?: string
}

const FEEDS: BlogFeedConfig[] = [
  // --- Official RSS feeds ---
  {
    id: 'openai-blog',
    name: 'OpenAI Blog',
    type: 'rss',
    url: 'https://openai.com/news/rss.xml',
  },
  {
    id: 'deepmind-blog',
    name: 'Google DeepMind Blog',
    type: 'rss',
    url: 'https://deepmind.google/blog/rss.xml',
  },
  // --- Community-maintained RSS ---
  {
    id: 'anthropic-blog',
    name: 'Anthropic Blog',
    type: 'rss',
    url: 'https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_news.xml',
  },
  // --- HTML scraping (no RSS) ---
  {
    id: 'mistral-blog',
    name: 'Mistral AI Blog',
    type: 'html',
    url: 'https://mistral.ai/news',
    selector: 'a[href^="/news/"]',
    baseUrl: 'https://mistral.ai',
  },
  {
    id: 'meta-ai-blog',
    name: 'Meta AI Blog',
    type: 'html',
    url: 'https://ai.meta.com/blog/',
    selector: 'a[href*="/blog/"]',
    baseUrl: 'https://ai.meta.com',
  },
]

const MAX_ITEMS_PER_FEED = 10
const RECENT_DAYS = 7

function isRecent(date: Date): boolean {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  return diff < RECENT_DAYS * 24 * 60 * 60 * 1000
}

async function fetchRSSFeed(feed: BlogFeedConfig): Promise<RawItem[]> {
  const xml = await fetchText(feed.url)
  const parser = new RSSParser()
  const parsed = await parser.parseString(xml)

  const items: RawItem[] = []
  for (const entry of parsed.items.slice(0, MAX_ITEMS_PER_FEED)) {
    const pubDate = entry.pubDate ? new Date(entry.pubDate) : new Date()
    if (!isRecent(pubDate)) continue

    items.push({
      sourceId: feed.id,
      externalId: entry.guid ?? entry.link ?? entry.title ?? '',
      title: entry.title ?? '(untitled)',
      url: entry.link ?? '',
      content: entry.contentSnippet ?? entry.content ?? '',
      publishedAt: pubDate,
      metadata: {
        blogName: feed.name,
        categories: entry.categories ?? [],
      },
    })
  }
  return items
}

async function fetchHTMLBlog(feed: BlogFeedConfig): Promise<RawItem[]> {
  const html = await fetchText(feed.url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ai-daily-monitor/0.1)' },
  })
  const $ = cheerio.load(html)
  const items: RawItem[] = []
  const seen = new Set<string>()

  $(feed.selector ?? 'a').each((_i, el) => {
    if (items.length >= MAX_ITEMS_PER_FEED) return false

    const $el = $(el)
    let href = $el.attr('href')
    if (!href) return

    // Build absolute URL
    if (href.startsWith('/') && feed.baseUrl) {
      href = feed.baseUrl + href
    }

    // Dedup by URL
    if (seen.has(href)) return
    seen.add(href)

    // Skip non-article links (nav, footer, etc.)
    if (href === feed.url || href === feed.baseUrl + '/') return

    const title = $el.text().trim() ||
                  $el.find('h2, h3, h4, span').first().text().trim()
    if (!title || title.length < 5) return

    items.push({
      sourceId: feed.id,
      externalId: href,
      title,
      url: href,
      publishedAt: new Date(),
      metadata: { blogName: feed.name },
    })
  })

  // Enrich HTML blog items with page snippets (they have no content yet)
  const enrichedItems = await enrichWithSnippets(items)
  return enrichedItems
}

export class BlogsSource implements DataSource {
  name = 'blogs'

  async fetch(): Promise<RawItem[]> {
    logger.info(`Fetching ${FEEDS.length} company blogs...`)
    const allItems: RawItem[] = []

    const results = await Promise.allSettled(
      FEEDS.map(async feed => {
        try {
          const items = feed.type === 'rss'
            ? await fetchRSSFeed(feed)
            : await fetchHTMLBlog(feed)
          logger.info(`  ${feed.name}: ${items.length} items`)
          return items
        } catch (err) {
          logger.warn(`  ${feed.name}: failed - ${err instanceof Error ? err.message : err}`)
          return []
        }
      })
    )

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allItems.push(...result.value)
      }
    }

    logger.info(`Fetched ${allItems.length} blog posts total`)
    return allItems
  }
}
