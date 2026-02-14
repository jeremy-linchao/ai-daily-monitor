# AI Daily Monitor - Task Checklist

## Task 1: Project Scaffolding
- [x] `git init`
- [x] `pnpm init` + configure package.json (ESM, scripts)
- [x] tsconfig.json (strict, ESM, Node22 target)
- [x] tsup.config.ts
- [x] vitest.config.ts
- [x] .gitignore, .env.example
- [x] src/index.ts placeholder

## Task 2: Core Abstractions
- [x] `src/types.ts` - RawItem, ScoredItem, DailyReport
- [x] `src/sources/base.ts` - DataSource interface
- [x] `src/config.ts` - Environment config
- [x] `src/utils/http.ts` - HTTP utility
- [x] `src/utils/logger.ts` - Logger

## Task 3: arXiv Data Source
- [ ] `src/sources/arxiv.ts` - arXiv API fetcher
- [ ] `tests/sources/arxiv.test.ts` - Unit tests

## Task 4: HuggingFace Daily Papers
- [ ] `src/sources/huggingface.ts` - HF API fetcher
- [ ] `tests/sources/huggingface.test.ts` - Unit tests

## Task 5: Hacker News
- [ ] `src/sources/hackernews.ts` - HN Firebase API fetcher
- [ ] `tests/sources/hackernews.test.ts` - Unit tests

## Task 6: GitHub Trending
- [ ] `src/sources/github-trending.ts` - GitHub trending HTML parser
- [ ] `tests/sources/github-trending.test.ts` - Unit tests

## Task 7: Anthropic Client + Summarizer
- [ ] `src/llm/client.ts` - Anthropic SDK wrapper
- [ ] `src/llm/summarizer.ts` - Chinese summary generation

## Task 8: Importance Scorer
- [ ] `src/llm/scorer.ts` - Score items 1-10

## Task 9: Cross-Source Dedup
- [ ] `src/llm/dedup.ts` - Deduplicate across sources

## Task 10: Daily Pipeline
- [ ] `src/pipeline/daily.ts` - fetch → dedup → score → summarize → format

## Task 11: Markdown Report
- [ ] `src/output/markdown.ts` - Generate Markdown daily report

## Task 12: Feishu Webhook
- [ ] `src/output/feishu.ts` - Push to Feishu

## Task 13: CLI Entry Point
- [ ] `src/index.ts` - CLI with `pnpm start` support
