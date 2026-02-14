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
    max_tokens: 8192,
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

/** Extract JSON array from LLM response that may be wrapped in markdown code blocks */
export function extractJson(text: string): string {
  // Try to extract from ```json ... ``` or ``` ... ```
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (codeBlockMatch) return codeBlockMatch[1].trim()

  // Try to find raw JSON array
  const arrayMatch = text.match(/\[[\s\S]*\]/)
  if (arrayMatch) return arrayMatch[0]

  return text.trim()
}
