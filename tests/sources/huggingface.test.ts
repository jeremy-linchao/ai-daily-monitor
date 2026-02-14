import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HuggingFaceSource } from '../../src/sources/huggingface.js'

const MOCK_RESPONSE = [
  {
    title: 'MemFly: Memory Optimization',
    summary: 'Long-term memory for LLM agents',
    publishedAt: '2026-02-13T04:00:00.000Z',
    paper: {
      id: '2602.07885',
      title: 'MemFly: Memory Optimization',
      summary: 'Long-term memory enables large language model agents to handle complex tasks.',
      authors: [
        { name: 'Zhenyuan Zhang' },
        { name: 'Wei Liu' },
      ],
      publishedAt: '2026-02-13T09:00:00.000Z',
      upvotes: 15,
      ai_summary: 'MemFly addresses memory optimization challenges.',
      ai_keywords: ['memory', 'optimization', 'LLM'],
      githubRepo: 'https://github.com/example/memfly',
      githubStars: 42,
    },
  },
  {
    title: 'New Vision Model',
    summary: 'A vision model paper',
    publishedAt: '2026-02-13T05:00:00.000Z',
    paper: {
      id: '2602.07900',
      title: 'New Vision Model',
      summary: 'We introduce a new vision-language model.',
      authors: [{ name: 'Jane Doe' }],
      publishedAt: '2026-02-13T10:00:00.000Z',
      upvotes: 8,
    },
  },
]

describe('HuggingFaceSource', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('parses HuggingFace daily papers response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(MOCK_RESPONSE), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const source = new HuggingFaceSource()
    const items = await source.fetch()

    expect(items).toHaveLength(2)
    expect(source.name).toBe('huggingface')

    expect(items[0]).toMatchObject({
      sourceId: 'huggingface',
      externalId: '2602.07885',
      title: 'MemFly: Memory Optimization',
      url: 'https://huggingface.co/papers/2602.07885',
      authors: ['Zhenyuan Zhang', 'Wei Liu'],
    })
    expect(items[0].metadata).toMatchObject({
      upvotes: 15,
      githubRepo: 'https://github.com/example/memfly',
      githubStars: 42,
    })

    expect(items[1]).toMatchObject({
      sourceId: 'huggingface',
      externalId: '2602.07900',
      title: 'New Vision Model',
      authors: ['Jane Doe'],
    })
  })

  it('handles empty response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })
    )

    const source = new HuggingFaceSource()
    const items = await source.fetch()
    expect(items).toHaveLength(0)
  })
})
