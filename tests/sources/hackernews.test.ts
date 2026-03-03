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

const MOCK_ARTICLE_HTML = `
<html>
<head>
  <meta property="og:description" content="An amazing AI tool that helps developers write better code faster." />
</head>
<body><p>Article body</p></body>
</html>`

describe('HackerNewsSource', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches and filters HN stories with enriched content', async () => {
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
      // Article page fetch for content enrichment
      if (url === 'https://example.com/ai-tool') {
        return new Response(MOCK_ARTICLE_HTML, { status: 200 })
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

    // First item should have enriched content from the article page
    expect(items[0].content).toBe('An amazing AI tool that helps developers write better code faster.')

    // Ask HN without url should use HN link (not enriched since it's an HN self-page)
    expect(items[1].url).toBe('https://news.ycombinator.com/item?id=200')
    expect(items[1].content).toBeUndefined()
  })

  it('handles enrichment failures gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('topstories')) {
        return new Response(JSON.stringify([100]), { status: 200 })
      }
      const idMatch = url.match(/item\/(\d+)\.json/)
      if (idMatch) {
        return new Response(JSON.stringify(MOCK_STORIES[100]), { status: 200 })
      }
      // Article page fetch fails
      throw new Error('Network error')
    })

    const source = new HackerNewsSource()
    const items = await source.fetch()

    // Should still return the item even if enrichment fails
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('Show HN: An AI Tool')
    expect(items[0].content).toBeUndefined()
  })
})
