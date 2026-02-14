# AI Daily Monitor - Architecture

## Directory Structure

```
ai-daily-monitor/
├── CLAUDE.md                # Project rules
├── SPEC.md                  # Project specification
├── ARCHITECTURE.md          # This file
├── TASKS.md                 # Task checklist
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── .gitignore
├── .env.example
├── src/
│   ├── index.ts             # CLI entry point
│   ├── types.ts             # Core type definitions
│   ├── config.ts            # Environment config
│   ├── sources/
│   │   ├── base.ts          # DataSource interface
│   │   ├── arxiv.ts         # arXiv OAI-PMH / Atom feed
│   │   ├── huggingface.ts   # HuggingFace Daily Papers API
│   │   ├── hackernews.ts    # Hacker News Firebase API
│   │   └── github-trending.ts # GitHub Trending HTML parser
│   ├── llm/
│   │   ├── client.ts        # Anthropic SDK wrapper
│   │   ├── summarizer.ts    # Chinese summary generation
│   │   ├── scorer.ts        # Importance scoring (1-10)
│   │   └── dedup.ts         # Cross-source deduplication
│   ├── pipeline/
│   │   └── daily.ts         # Daily pipeline orchestration
│   └── output/
│       ├── markdown.ts      # Markdown report generator
│       └── feishu.ts        # Feishu webhook push
└── tests/
    └── sources/
        ├── arxiv.test.ts
        ├── huggingface.test.ts
        ├── hackernews.test.ts
        └── github-trending.test.ts
```

## Three-Layer Architecture

```
┌─────────────────────────────────────────────────┐
│  Layer 3: LLM Intelligence                      │
│  ┌───────────┐ ┌────────┐ ┌──────┐             │
│  │ Summarizer│ │ Scorer │ │ Dedup│             │
│  │ (Chinese) │ │ (1-10) │ │      │             │
│  └───────────┘ └────────┘ └──────┘             │
│  Uses: @anthropic-ai/sdk, batch calls           │
├─────────────────────────────────────────────────┤
│  Layer 2: Browser-Assisted (Future)             │
│  Twitter / WeChat / Zhihu via Jina Reader       │
│  (Not implemented in Tier 1)                    │
├─────────────────────────────────────────────────┤
│  Layer 1: Deterministic Fetching                │
│  ┌───────┐ ┌────────────┐ ┌────┐ ┌──────────┐ │
│  │ arXiv │ │HuggingFace │ │ HN │ │ GitHub   │ │
│  │       │ │Daily Papers│ │    │ │ Trending │ │
│  └───────┘ └────────────┘ └────┘ └──────────┘ │
│  Pure code, zero tokens, HTTP only              │
└─────────────────────────────────────────────────┘
```

## Core Types

```typescript
// Raw item from any data source
interface RawItem {
  sourceId: string        // e.g., "arxiv", "hackernews"
  externalId: string      // Source-specific unique ID
  title: string
  url: string
  content?: string        // Abstract, description, etc.
  authors?: string[]
  publishedAt: Date
  metadata: Record<string, unknown>  // Source-specific data
}

// After LLM processing
interface ScoredItem extends RawItem {
  score: number           // 1-10 importance
  summary: string         // Chinese summary
  tags: string[]          // Auto-generated tags
  dedupKey: string        // For cross-source dedup
}

// Daily report
interface DailyReport {
  date: string            // YYYY-MM-DD
  items: ScoredItem[]     // Sorted by score desc
  generatedAt: Date
}
```

## Data Flow

```
1. FETCH     sources/*.fetch() → RawItem[]
                    ↓
2. MERGE     [...arxiv, ...hf, ...hn, ...github]
                    ↓
3. DEDUP     llm/dedup.ts → unique RawItem[]
                    ↓
4. SCORE     llm/scorer.ts → ScoredItem[] (with scores)
                    ↓
5. SUMMARIZE llm/summarizer.ts → ScoredItem[] (with summaries)
                    ↓
6. SORT      sort by score descending
                    ↓
7. FORMAT    output/markdown.ts → Markdown string
                    ↓
8. PUSH      output/feishu.ts → Feishu webhook
```

## Module Dependencies

```
index.ts
  └── pipeline/daily.ts
        ├── sources/base.ts (interface)
        │     ├── sources/arxiv.ts
        │     ├── sources/huggingface.ts
        │     ├── sources/hackernews.ts
        │     └── sources/github-trending.ts
        ├── llm/client.ts
        │     ├── llm/summarizer.ts
        │     ├── llm/scorer.ts
        │     └── llm/dedup.ts
        ├── output/markdown.ts
        └── output/feishu.ts

config.ts ← used by all modules
utils/http.ts ← used by sources/*
utils/logger.ts ← used by all modules
types.ts ← used by all modules
```

## Key Design Decisions

1. **No database**: File-based output only. Daily reports saved as Markdown files.
2. **No web UI**: CLI + Feishu push. Keep it simple.
3. **Batch LLM calls**: Collect all items first, then call LLM in batch to minimize API calls.
4. **Graceful degradation**: If a source fails, continue with others. If LLM fails, output raw items without scores/summaries.
5. **ESM only**: Modern Node.js, no CommonJS compatibility layer.
