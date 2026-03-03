import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { proxyFetch } from '../utils/http.js'

let deepseekClient: OpenAI | null = null
let anthropicClient: Anthropic | null = null
let anthropicIsOAuth = false

function getDeepSeekClient(): OpenAI {
  if (!deepseekClient) {
    if (!config.deepseekApiKey) {
      throw new Error('DEEPSEEK_API_KEY is not set')
    }
    deepseekClient = new OpenAI({
      apiKey: config.deepseekApiKey,
      baseURL: 'https://api.deepseek.com',
    })
  }
  return deepseekClient
}

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    if (!config.anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set')
    }
    anthropicIsOAuth = config.anthropicApiKey.includes('-oat')
    const fetchFn = config.httpProxy ? proxyFetch as unknown as typeof globalThis.fetch : undefined
    if (anthropicIsOAuth) {
      anthropicClient = new Anthropic({
        authToken: config.anthropicApiKey,
        apiKey: null,
        dangerouslyAllowBrowser: true,
        defaultHeaders: {
          'anthropic-beta': 'claude-code-20250219,oauth-2025-04-20',
          'anthropic-dangerous-direct-browser-access': 'true',
          'user-agent': 'claude-cli/2.1.2 (external, cli)',
          'x-app': 'cli',
        },
        fetch: fetchFn,
      })
    } else {
      anthropicClient = new Anthropic({ apiKey: config.anthropicApiKey, fetch: fetchFn })
    }
  }
  return anthropicClient
}

async function callDeepSeek(prompt: string, systemPrompt: string): Promise<string> {
  const client = getDeepSeekClient()
  const completion = await client.chat.completions.create({
    model: 'deepseek-chat',
    max_tokens: 8192,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
  })
  const content = completion.choices[0]?.message?.content
  if (!content) throw new Error('Empty response from DeepSeek')
  return content
}

async function callAnthropic(prompt: string, systemPrompt: string): Promise<string> {
  const client = getAnthropicClient()

  // OAuth tokens require Claude Code identity in system prompt
  const system: Anthropic.MessageCreateParams['system'] = anthropicIsOAuth
    ? [
        { type: 'text', text: 'You are Claude Code, Anthropic\'s official CLI for Claude.' },
        { type: 'text', text: systemPrompt },
      ]
    : systemPrompt

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system,
    messages: [
      { role: 'user', content: prompt },
    ],
  })
  const block = message.content[0]
  if (!block || block.type !== 'text') throw new Error('Empty response from Anthropic')
  return block.text
}

export async function callLLM(prompt: string, systemPrompt?: string): Promise<string> {
  const system = systemPrompt ?? 'You are a helpful AI assistant.'
  logger.debug(`Calling LLM (${config.llmProvider})...`)

  if (config.llmProvider === 'anthropic') {
    return callAnthropic(prompt, system)
  }
  return callDeepSeek(prompt, system)
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
