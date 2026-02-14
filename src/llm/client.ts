import Anthropic from '@anthropic-ai/sdk'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'

let client: Anthropic | null = null

export function getClient(): Anthropic {
  if (!client) {
    if (!config.anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set')
    }
    client = new Anthropic({ apiKey: config.anthropicApiKey })
  }
  return client
}

export async function callLLM(prompt: string, systemPrompt?: string): Promise<string> {
  const anthropic = getClient()
  logger.debug('Calling LLM...')

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    system: systemPrompt ?? 'You are a helpful AI assistant.',
    messages: [{ role: 'user', content: prompt }],
  })

  const block = message.content[0]
  if (block.type !== 'text') {
    throw new Error(`Unexpected response type: ${block.type}`)
  }
  return block.text
}
