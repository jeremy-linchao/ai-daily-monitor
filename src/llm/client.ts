import OpenAI from 'openai'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'

let client: OpenAI | null = null

export function getClient(): OpenAI {
  if (!client) {
    if (!config.deepseekApiKey) {
      throw new Error('DEEPSEEK_API_KEY is not set')
    }
    client = new OpenAI({
      apiKey: config.deepseekApiKey,
      baseURL: 'https://api.deepseek.com',
    })
  }
  return client
}

export async function callLLM(prompt: string, systemPrompt?: string): Promise<string> {
  const openai = getClient()
  logger.debug('Calling DeepSeek LLM...')

  const completion = await openai.chat.completions.create({
    model: 'deepseek-chat',
    max_tokens: 4096,
    messages: [
      { role: 'system', content: systemPrompt ?? 'You are a helpful AI assistant.' },
      { role: 'user', content: prompt },
    ],
  })

  const content = completion.choices[0]?.message?.content
  if (!content) {
    throw new Error('Empty response from DeepSeek')
  }
  return content
}
