import { config as dotenvConfig } from 'dotenv'

dotenvConfig()

export const config = {
  llmProvider: (process.env.LLM_PROVIDER ?? 'deepseek') as 'deepseek' | 'anthropic',
  deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  feishuWebhookUrl: process.env.FEISHU_WEBHOOK_URL ?? '',
  logLevel: (process.env.LOG_LEVEL ?? 'info') as 'debug' | 'info' | 'warn' | 'error',
  httpProxy: process.env.HTTP_PROXY ?? '',
}
