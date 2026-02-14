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

describe('GitHubTrendingSource', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('parses GitHub trending HTML', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(MOCK_HTML, { status: 200 })
    )

    const source = new GitHubTrendingSource()
    const items = await source.fetch()

    expect(items).toHaveLength(3)
    expect(source.name).toBe('github-trending')

    expect(items[0]).toMatchObject({
      sourceId: 'github-trending',
      externalId: 'openai/gpt-5',
      title: 'openai/gpt-5',
      url: 'https://github.com/openai/gpt-5',
      content: 'Next generation language model',
    })
    expect(items[0].metadata).toMatchObject({ language: 'Python', todayStars: 128 })

    expect(items[1]).toMatchObject({
      externalId: 'facebook/react',
      title: 'facebook/react',
      url: 'https://github.com/facebook/react',
    })
    expect(items[1].metadata).toMatchObject({ language: 'JavaScript', todayStars: 85 })

    // Repo without description
    expect(items[2].content).toBeUndefined()
  })

  it('handles empty page', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html><body></body></html>', { status: 200 })
    )

    const source = new GitHubTrendingSource()
    const items = await source.fetch()
    expect(items).toHaveLength(0)
  })
})
