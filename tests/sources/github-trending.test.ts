import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GitHubTrendingSource } from '../../src/sources/github-trending.js'

const MOCK_HTML = `
<html>
<body>
  <article class="Box-row">
    <h2 class="h3 lh-condensed">
      <a href="/openai/gpt-5">openai / gpt-5</a>
    </h2>
    <p class="col-9 color-fg-muted">Next generation language model</p>
    <span itemprop="programmingLanguage">Python</span>
    <span class="d-inline-block float-sm-right">128 stars today</span>
  </article>
  <article class="Box-row">
    <h2 class="h3 lh-condensed">
      <a href="/facebook/react">facebook / react</a>
    </h2>
    <p class="col-9 color-fg-muted">A JavaScript library for building user interfaces</p>
    <span itemprop="programmingLanguage">JavaScript</span>
    <span class="d-inline-block float-sm-right">85 stars today</span>
  </article>
  <article class="Box-row">
    <h2 class="h3 lh-condensed">
      <a href="/user/no-desc-repo">user / no-desc-repo</a>
    </h2>
  </article>
</body>
</html>
`

const MOCK_REPO_API = {
  'openai/gpt-5': {
    description: 'Next generation language model with advanced reasoning capabilities',
    topics: ['ai', 'llm', 'deep-learning'],
  },
  'facebook/react': {
    description: 'The library for web and native user interfaces.',
    topics: ['javascript', 'ui', 'frontend'],
  },
  'user/no-desc-repo': {
    description: null,
    topics: [],
  },
}

const MOCK_README_CONTENT = Buffer.from(
  '# GPT-5\n\n![badge](https://img.shields.io/badge)\n\nGPT-5 is the next generation large language model that pushes the boundaries of AI reasoning and code generation.\n\n## Installation\n'
).toString('base64')

describe('GitHubTrendingSource', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('parses GitHub trending HTML and enriches via API', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString()

      // Trending page
      if (url.includes('github.com/trending')) {
        return new Response(MOCK_HTML, { status: 200 })
      }

      // GitHub API: repo info
      const repoMatch = url.match(/api\.github\.com\/repos\/([\w-]+\/[\w-]+)$/)
      if (repoMatch) {
        const name = repoMatch[1] as keyof typeof MOCK_REPO_API
        const data = MOCK_REPO_API[name]
        if (data) {
          return new Response(JSON.stringify(data), { status: 200 })
        }
        return new Response('Not Found', { status: 404 })
      }

      // GitHub API: README
      const readmeMatch = url.match(/api\.github\.com\/repos\/([\w-]+\/[\w-]+)\/readme/)
      if (readmeMatch) {
        const name = readmeMatch[1]
        if (name === 'openai/gpt-5') {
          return new Response(JSON.stringify({ content: MOCK_README_CONTENT, encoding: 'base64' }), { status: 200 })
        }
        return new Response('Not Found', { status: 404 })
      }

      return new Response('Not Found', { status: 404 })
    })

    const source = new GitHubTrendingSource()
    const items = await source.fetch()

    expect(items).toHaveLength(3)
    expect(source.name).toBe('github-trending')

    // First repo: should have enriched content from API + README
    expect(items[0]).toMatchObject({
      sourceId: 'github-trending',
      externalId: 'openai/gpt-5',
      title: 'openai/gpt-5',
      url: 'https://github.com/openai/gpt-5',
    })
    expect(items[0].content).toContain('advanced reasoning capabilities')
    expect(items[0].content).toContain('ai, llm, deep-learning')
    expect(items[0].content).toContain('pushes the boundaries')
    expect(items[0].metadata).toMatchObject({ language: 'Python', todayStars: 128 })

    // Second repo: API info but no README
    expect(items[1]).toMatchObject({
      externalId: 'facebook/react',
      title: 'facebook/react',
      url: 'https://github.com/facebook/react',
    })
    expect(items[1].content).toContain('web and native user interfaces')
    expect(items[1].metadata).toMatchObject({ language: 'JavaScript', todayStars: 85 })

    // Third repo: no description, no README - content should be empty or from API failure
    expect(items[2].externalId).toBe('user/no-desc-repo')
  })

  it('handles empty page', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html><body></body></html>', { status: 200 })
    )

    const source = new GitHubTrendingSource()
    const items = await source.fetch()
    expect(items).toHaveLength(0)
  })

  it('handles GitHub API failures gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('github.com/trending')) {
        return new Response(MOCK_HTML, { status: 200 })
      }
      // All API calls fail
      throw new Error('API rate limited')
    })

    const source = new GitHubTrendingSource()
    const items = await source.fetch()

    // Should still return items from HTML scraping
    expect(items).toHaveLength(3)
    expect(items[0].title).toBe('openai/gpt-5')
  })
})
