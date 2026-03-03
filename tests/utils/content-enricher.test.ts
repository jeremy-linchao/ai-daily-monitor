import { describe, it, expect, vi, beforeEach } from 'vitest'
import { extractPageSnippet, enrichWithSnippets } from '../../src/utils/content-enricher.js'

const MOCK_HTML_OG = `
<html>
<head>
  <meta property="og:description" content="This is a great article about AI advancements in 2025." />
</head>
<body><p>Body text here.</p></body>
</html>`

const MOCK_HTML_META = `
<html>
<head>
  <meta name="description" content="A comprehensive guide to machine learning pipelines and best practices." />
</head>
<body><p>Body text here.</p></body>
</html>`

const MOCK_HTML_PARAGRAPH = `
<html>
<head><title>Test</title></head>
<body>
  <article>
    <p>Short.</p>
    <p>This is a longer paragraph that describes the main topic of the article in sufficient detail for extraction.</p>
  </article>
</body>
</html>`

const MOCK_HTML_EMPTY = `<html><head></head><body><p>Hi</p></body></html>`

describe('extractPageSnippet', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('extracts og:description when available', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(MOCK_HTML_OG, { status: 200 })
    )

    const snippet = await extractPageSnippet('https://example.com/article')
    expect(snippet).toBe('This is a great article about AI advancements in 2025.')
  })

  it('falls back to meta description', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(MOCK_HTML_META, { status: 200 })
    )

    const snippet = await extractPageSnippet('https://example.com/guide')
    expect(snippet).toBe('A comprehensive guide to machine learning pipelines and best practices.')
  })

  it('falls back to first substantial paragraph', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(MOCK_HTML_PARAGRAPH, { status: 200 })
    )

    const snippet = await extractPageSnippet('https://example.com/article')
    expect(snippet).toContain('longer paragraph')
  })

  it('returns empty string for pages without extractable content', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(MOCK_HTML_EMPTY, { status: 200 })
    )

    const snippet = await extractPageSnippet('https://example.com/empty')
    expect(snippet).toBe('')
  })

  it('returns empty string on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))

    const snippet = await extractPageSnippet('https://example.com/fail')
    expect(snippet).toBe('')
  })
})

describe('enrichWithSnippets', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('enriches items without content', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(MOCK_HTML_OG, { status: 200 })
    )

    const items = [
      { url: 'https://example.com/a', content: undefined },
      { url: 'https://example.com/b', content: 'Already has content that is long enough to not need enrichment.' },
    ]

    const result = await enrichWithSnippets(items)

    // First item should be enriched
    expect(result[0].content).toBe('This is a great article about AI advancements in 2025.')
    // Second item should keep original content (already has enough)
    expect(result[1].content).toBe('Already has content that is long enough to not need enrichment.')
  })
})
