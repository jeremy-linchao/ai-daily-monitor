import type { RawItem } from '../types.js'
import type { DataSource } from './base.js'
import { fetchJson } from '../utils/http.js'
import { logger } from '../utils/logger.js'

const HN_API = 'https://hacker-news.firebaseio.com/v0'
const TOP_STORIES_LIMIT = 30

interface HNStory {
  id: number
  title: string
  url?: string
  score: number
  time: number
  by: string
  descendants?: number
  type: string
}

export class HackerNewsSource implements DataSource {
  name = 'hackernews'

  async fetch(): Promise<RawItem[]> {
    logger.info('Fetching Hacker News top stories...')
    const ids = await fetchJson<number[]>(`${HN_API}/topstories.json`)
    const topIds = ids.slice(0, TOP_STORIES_LIMIT)

    const stories = await Promise.all(
      topIds.map(id => fetchJson<HNStory>(`${HN_API}/item/${id}.json`))
    )

    const validStories = stories.filter(s => s && s.type === 'story')
    logger.info(`Fetched ${validStories.length} Hacker News stories`)

    return validStories.map(story => ({
      sourceId: this.name,
      externalId: String(story.id),
      title: story.title,
      url: story.url ?? `https://news.ycombinator.com/item?id=${story.id}`,
      publishedAt: new Date(story.time * 1000),
      metadata: {
        score: story.score,
        by: story.by,
        comments: story.descendants ?? 0,
      },
    }))
  }
}
