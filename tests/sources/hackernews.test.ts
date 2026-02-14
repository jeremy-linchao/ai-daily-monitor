import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HackerNewsSource } from '../../src/sources/hackernews.js'

const MOCK_IDS = [100, 200, 300]

const MOCK_STORIES: Record<number, unknown> = {
  100: {
    id: 100,
    title: 'Show HN: An AI Tool',
    url: 'https://example.com/ai-tool',
    score: 250,
    time: 1707868800,
    by: 'user1',
    descendants: 45,
    type: 'story',
  },
  200: {
    id: 200,
    title: 'Ask HN: Best LLM for coding?',
    score: 120,
    time: 1707865200,
    by: 'user2',
    descendants: 89,
    type: 'story',
  },
  300: {
    id: 300,
    title: 'A comment',
    type: 'comment',
    by: 'user3',
    time: 1707861600,
  },
}

describe('HackerNewsSource', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches and filters HN stories', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('topstories')) {
        return new Response(JSON.stringify(MOCK_IDS), { status: 200 })
      }
      const idMatch = url.match(/item\/(\d+)\.json/)
      if (idMatch) {
        const id = Number(idMatch[1])
        return new Response(JSON.stringify(MOCK_STORIES[id]), { status: 200 })
      }
      return new Response('Not Found', { status: 404 })
    })

    const source = new HackerNewsSource()
    const items = await source.fetch()

    // Should filter out the comment (type !== 'story')
    expect(items).toHaveLength(2)
    expect(source.name).toBe('hackernews')

    expect(items[0]).toMatchObject({
      sourceId: 'hackernews',
      externalId: '100',
      title: 'Show HN: An AI Tool',
      url: 'https://example.com/ai-tool',
    })
    expect(items[0].metadata).toMatchObject({ score: 250, by: 'user1', comments: 45 })

    // Ask HN without url should use HN link
    expect(items[1].url).toBe('https://news.ycombinator.com/item?id=200')
  })
})
