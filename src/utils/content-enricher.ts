import * as cheerio from 'cheerio'
import { fetchText } from './http.js'
import { logger } from './logger.js'

const TIMEOUT_MS = 8000
const MAX_SNIPPET_LENGTH = 500

/**
 * Extract a text snippet from a web page URL.
 * Tries: og:description → meta description → first <p> with enough text.
 * Returns empty string on any failure (Layer 1: no LLM, no crash).
 */
export async function extractPageSnippet(url: string): Promise<string> {
  try {
    const html = await fetchText(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ai-daily-monitor/0.1)' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    const $ = cheerio.load(html)

    // Try og:description first
    const ogDesc = $('meta[property="og:description"]').attr('content')?.trim()
    if (ogDesc && ogDesc.length > 20) {
      return ogDesc.slice(0, MAX_SNIPPET_LENGTH)
    }

    // Try meta description
    const metaDesc = $('meta[name="description"]').attr('content')?.trim()
    if (metaDesc && metaDesc.length > 20) {
      return metaDesc.slice(0, MAX_SNIPPET_LENGTH)
    }

    // Fallback: first substantial <p> tag
    let firstParagraph = ''
    $('article p, main p, .content p, .post p, p').each((_i, el) => {
      if (firstParagraph) return false
      const text = $(el).text().trim()
      if (text.length > 50) {
        firstParagraph = text
        return false
      }
    })

    if (firstParagraph) {
      return firstParagraph.slice(0, MAX_SNIPPET_LENGTH)
    }

    return ''
  } catch (err) {
    logger.debug(`content-enricher failed for ${url}: ${err instanceof Error ? err.message : err}`)
    return ''
  }
}

/**
 * Enrich multiple items with page snippets, with concurrency control.
 */
export async function enrichWithSnippets<T extends { url: string; content?: string }>(
  items: T[],
  concurrency = 5,
): Promise<T[]> {
  const results = [...items]

  // Process in batches for concurrency control
  for (let i = 0; i < results.length; i += concurrency) {
    const batch = results.slice(i, i + concurrency)
    const snippets = await Promise.all(
      batch.map(item => {
        if (item.content && item.content.length > 50) return Promise.resolve('')
        return extractPageSnippet(item.url)
      })
    )

    for (let j = 0; j < batch.length; j++) {
      if (snippets[j]) {
        results[i + j] = { ...results[i + j], content: snippets[j] }
      }
    }
  }

  return results
}
