import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { runDailyPipeline } from './pipeline/daily.js'
import { generateMarkdown } from './output/markdown.js'
import { pushToFeishu } from './output/feishu.js'
import { logger } from './utils/logger.js'

async function main() {
  logger.info('AI Daily Monitor starting...')

  const report = await runDailyPipeline()
  const markdown = generateMarkdown(report)

  // Save to file
  const outDir = join(process.cwd(), 'reports')
  mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, `${report.date}.md`)
  writeFileSync(outPath, markdown, 'utf-8')
  logger.info(`Report saved to ${outPath}`)

  // Push to Feishu
  await pushToFeishu(report, markdown)

  // Print to stdout
  console.log(markdown)
}

main().catch(err => {
  logger.error('Fatal error:', err)
  process.exit(1)
})
