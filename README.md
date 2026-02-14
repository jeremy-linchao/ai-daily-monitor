# AI Daily Monitor

Automated daily digest of the most important AI papers, news, open-source projects, and company updates. Uses LLM-powered scoring and deduplication to filter signal from noise, generates Chinese summaries, and pushes to Feishu (Lark) group chat.

## Sample Output

```
## [9/10] GPT-5.2 derives a new result in theoretical physics
Source: openai-blog | Tags: LLM, AI Research, Theoretical Physics

GPT-5.2 derived a novel gluon amplitude formula in theoretical physics,
later formally proven by OpenAI and academic collaborators.

## [8/10] Introducing GPT-5.3-Codex-Spark
Source: openai-blog | Tags: LLM, Code Generation, Real-time Inference

OpenAI released its first real-time coding model with 15x faster generation
and 128K context support.
```

## Data Sources

| Source | Method | Description |
|--------|--------|-------------|
| arXiv | API | Latest papers from cs.AI / cs.CL / cs.LG / cs.CV, top 10 by score |
| HuggingFace | API | Daily recommended papers |
| Hacker News | API | Top stories, filtered to AI-related only |
| GitHub Trending | HTML scraping | Daily trending repos, filtered to AI-related only |
| OpenAI Blog | RSS | Official blog |
| Google DeepMind Blog | RSS | Official blog |
| Anthropic Blog | RSS | Community-maintained feed |
| Mistral AI Blog | HTML scraping | Official news page |
| Meta AI Blog | HTML scraping | Official blog |

## Pipeline

```
Fetch (5 sources in parallel)
  → URL dedup (deterministic) + semantic dedup (LLM)
  → Importance scoring (1-10, non-AI content auto-filtered)
  → Filter (score >= 5)
  → Chinese summary generation
  → Sort by score → Markdown report
  → Push to Feishu
```

## Getting Started

### Prerequisites

- Node.js >= 22
- pnpm

### Install

```bash
git clone https://github.com/jeremy-linchao/ai-daily-monitor.git
cd ai-daily-monitor
pnpm install
```

### Configure

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# Required: DeepSeek API Key (https://platform.deepseek.com/api_keys)
DEEPSEEK_API_KEY=sk-xxxxx

# Optional: Feishu bot webhook for daily push
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/xxxxx

# Optional: HTTP proxy (accordng to your need)
HTTP_PROXY=your-proxy
```

### Run

```bash
# Run once, generate today's report
pnpm start

# Report saved to reports/YYYY-MM-DD.md
```

### Schedule (macOS)

Create `~/Library/LaunchAgents/com.ai-daily-monitor.plist` to run daily at 7:00 AM. If the machine is asleep at the scheduled time, it runs on wake.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.ai-daily-monitor</string>
    <key>ProgramArguments</key>
    <array>
        <string>/path/to/pnpm</string>
        <string>start</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/path/to/ai-daily-monitor</string>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>7</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
</dict>
</plist>
```

```bash
launchctl load ~/Library/LaunchAgents/com.ai-daily-monitor.plist
```

### Schedule (Linux)

```bash
# crontab -e
0 7 * * * cd /path/to/ai-daily-monitor && /path/to/pnpm start >> logs/cron.log 2>&1
```

## Feishu (Lark) Setup

1. Create a Feishu group chat
2. Group Settings → Bots → Add "Custom Bot"
3. Copy the webhook URL into `FEISHU_WEBHOOK_URL` in `.env`

## Project Structure

```
src/
├── sources/          # Data source fetchers
│   ├── arxiv.ts
│   ├── huggingface.ts
│   ├── hackernews.ts
│   ├── github-trending.ts
│   └── blogs.ts
├── llm/              # LLM intelligence layer
│   ├── client.ts     # DeepSeek API client
│   ├── dedup.ts      # Deduplication (URL + semantic)
│   ├── scorer.ts     # Importance scoring
│   └── summarizer.ts # Chinese summarization
├── pipeline/
│   └── daily.ts      # Pipeline orchestration
├── output/
│   ├── markdown.ts   # Markdown formatter
│   └── feishu.ts     # Feishu webhook push
└── index.ts          # CLI entry point
```

## Development

```bash
# Run tests
pnpm test

# Type check
pnpm typecheck

# Build
pnpm build
```

## Customization

**Add/remove sources**: Edit the `FEEDS` array in `src/sources/blogs.ts`

**Adjust filtering thresholds**: Edit constants in `src/pipeline/daily.ts`
- `MIN_SCORE` — Minimum score threshold (default: 5)
- `MAX_REPORT_ITEMS` — Max items in report (default: 50)
- `SOURCE_CAPS` — Per-source limits (e.g. arXiv capped at 10)

**Adjust scoring criteria**: Edit the system prompt in `src/llm/scorer.ts`

## License

MIT
