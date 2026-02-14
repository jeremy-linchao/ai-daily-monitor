import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ArxivSource } from '../../src/sources/arxiv.js'

const MOCK_XML = `<?xml version='1.0' encoding='UTF-8'?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2602.12345v1</id>
    <title>A Novel Approach to Language Models</title>
    <summary>We present a new method for training large language models that improves efficiency.</summary>
    <published>2026-02-13T18:00:00Z</published>
    <link href="https://arxiv.org/abs/2602.12345v1" rel="alternate" type="text/html"/>
    <author><name>Alice Smith</name></author>
    <author><name>Bob Jones</name></author>
    <category term="cs.CL" scheme="http://arxiv.org/schemas/atom"/>
    <category term="cs.AI" scheme="http://arxiv.org/schemas/atom"/>
  </entry>
  <entry>
    <id>http://arxiv.org/abs/2602.12346v1</id>
    <title>Vision Transformers for Object Detection</title>
    <summary>This paper explores vision transformers applied to real-time object detection.</summary>
    <published>2026-02-13T17:00:00Z</published>
    <link href="https://arxiv.org/abs/2602.12346v1" rel="alternate" type="text/html"/>
    <author><name>Charlie Brown</name></author>
    <category term="cs.CV" scheme="http://arxiv.org/schemas/atom"/>
  </entry>
</feed>`

describe('ArxivSource', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('parses arXiv XML feed into RawItems', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(MOCK_XML, { status: 200 })
    )

    const source = new ArxivSource()
    const items = await source.fetch()

    expect(items).toHaveLength(2)
    expect(source.name).toBe('arxiv')

    expect(items[0]).toMatchObject({
      sourceId: 'arxiv',
      externalId: 'http://arxiv.org/abs/2602.12345v1',
      title: 'A Novel Approach to Language Models',
      url: 'https://arxiv.org/abs/2602.12345v1',
      authors: ['Alice Smith', 'Bob Jones'],
    })
    expect(items[0].content).toContain('new method for training')
    expect(items[0].metadata.categories).toEqual(['cs.CL', 'cs.AI'])

    expect(items[1]).toMatchObject({
      sourceId: 'arxiv',
      title: 'Vision Transformers for Object Detection',
      authors: ['Charlie Brown'],
    })
  })

  it('handles empty feed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<feed></feed>', { status: 200 })
    )

    const source = new ArxivSource()
    const items = await source.fetch()
    expect(items).toHaveLength(0)
  })

  it('throws on HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Not Found', { status: 404, statusText: 'Not Found' })
    )

    const source = new ArxivSource()
    await expect(source.fetch()).rejects.toThrow('HTTP 404')
  })
})
