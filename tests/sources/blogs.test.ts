import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BlogsSource } from '../../src/sources/blogs.js'

const MOCK_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>OpenAI Blog</title>
    <item>
      <title>Introducing GPT-5</title>
      <link>https://openai.com/blog/gpt-5</link>
      <description>We are releasing GPT-5, our most capable model.</description>
      <guid>https://openai.com/blog/gpt-5</guid>
      <pubDate>${new Date().toUTCString()}</pubDate>
      <category>Product</category>
    </item>
    <item>
      <title>Safety Update</title>
      <link>https://openai.com/blog/safety-update</link>
      <description>Our latest safety research progress.</description>
      <guid>https://openai.com/blog/safety-update</guid>
      <pubDate>${new Date(Date.now() - 2 * 86400000).toUTCString()}</pubDate>
    </item>
    <item>
      <title>Old Post</title>
      <link>https://openai.com/blog/old-post</link>
      <description>This is an old post.</description>
      <guid>https://openai.com/blog/old-post</guid>
      <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`

const MOCK_HTML = `
<html><body>
  <a href="/news/mistral-large-2">Mistral Large 2 is here</a>
  <a href="/news/codestral">Codestral: our coding model</a>
  <a href="/">Home</a>
  <a href="/news/">News</a>
</body></html>`

describe('BlogsSource', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('parses RSS feeds and filters recent items', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(MOCK_RSS, { status: 200 })
    )

    const source = new BlogsSource()
    const items = await source.fetch()

    // All feeds get the same mock, but only recent items should pass
    // Each RSS feed should return 2 items (today + 2 days ago, not the 2024 one)
    const openaiItems = items.filter(i => i.sourceId === 'openai-blog')
    expect(openaiItems.length).toBe(2)

    expect(openaiItems[0]).toMatchObject({
      sourceId: 'openai-blog',
      title: 'Introducing GPT-5',
      url: 'https://openai.com/blog/gpt-5',
    })
    expect(openaiItems[0].content).toContain('most capable model')
    expect(openaiItems[0].metadata).toMatchObject({
      blogName: 'OpenAI Blog',
    })
  })

  it('handles feed failures gracefully', async () => {
    let callCount = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++
      if (callCount === 1) {
        return new Response(MOCK_RSS, { status: 200 })
      }
      throw new Error('Network error')
    })

    const source = new BlogsSource()
    const items = await source.fetch()

    // Should still return items from the first successful feed
    expect(items.length).toBeGreaterThan(0)
  })
})
