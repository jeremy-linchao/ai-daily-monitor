# AI Daily Monitor - 项目规格书

## 概述

每日 AI/软件/IT 领域重要信息自动聚合、评分、摘要、推送工具。

## 技术栈决策

- **Runtime**: Node.js 22+ with TypeScript (ESM only)
- **Package manager**: pnpm
- **Test**: vitest
- **Build**: tsup
- **LLM SDK**: @anthropic-ai/sdk (Claude)

选择 TypeScript 的原因： I/O 密集型项目适合 Node.js、类型安全对多数据源聚合重要。

## 架构：三层分离

```
Layer 3: LLM 智能层（摘要/评分/翻译/去重，每日一次批量调用）
Layer 2: 浏览器辅助层（仅 Twitter/微信/知乎，用 Jina Reader）
Layer 1: 确定性抓取层（80% 的源，纯代码，零 token，cron 定时）
```

核心原则：**抓取和智能分离**。抓取是确定性代码，智能是 LLM。不混在一起。

## 数据源（按优先级）

### Tier 1 - 第一手信源（必做）
| 数据源 | 获取方式 | 需要浏览器 |
|--------|---------|-----------|
| arXiv (cs.AI, cs.CL, cs.LG, cs.CV) | 免费 API，无需 key | 否 |
| HuggingFace Daily Papers | `huggingface.co/api/daily_papers` | 否 |
| Hacker News | Firebase API，免费，无限速 | 否 |
| GitHub Trending | GitHub API + HTML 解析 | 否 |

### Tier 2 - 讨论和传播层（重要）
| 数据源 | 获取方式 | 需要浏览器 |
|--------|---------|-----------|
| 公司官方博客 (OpenAI, Anthropic, Google DeepMind, Meta AI, Mistral, xAI, DeepSeek, Moonshot, 智谱AI) | RSS/Atom Feed | 否 |
| Reddit (r/MachineLearning, r/LocalLLaMA) | Reddit API | 否 |
| Twitter/X 关键账号 | 第三方 API 或 Jina Reader | 是 |

### Tier 3 - 中文生态（补充）
| 数据源 | 获取方式 | 需要浏览器 |
|--------|---------|-----------|
| 机器之心 / 量子位 | RSS Feed | 否 |
| 微信公众号 | Jina Reader | 是 |
| 知乎 AI 话题 | Jina Reader | 是 |

### Tier 4 - 聚合验证（可选）
| 数据源 | 获取方式 |
|--------|---------|
| Papers With Code | API |
| Product Hunt AI | API/RSS |
| AI Newsletters (The Batch, TLDR AI) | RSS |

## 核心抽象

```typescript
interface DataSource<T> {
  name: string
  fetch(): Promise<T[]>
}
```

未来扩展到其他行业只需新增 DataSource 实现，不需要现在构建通用配置系统。

## 输出

- 每日 Markdown 格式日报
- 按重要性评分（1-10）排序
- 中文摘要 + 原文链接
- 跨源去重（同一事件多源报道合并）
- 推送到飞书

## 范围限制

- 当前只做 AI/软件/IT 领域，不做通用行业
- 先跑通 Tier 1 数据源，验证 pipeline 后再扩展
- 不做 Web UI，命令行 + 飞书推送即可

## 开发流程 (SDD)

不使用外部 SDD 工具，使用 Claude Code 原生能力：
1. CLAUDE.md - 持久规则
2. SPEC.md - 本文件
3. ARCHITECTURE.md - 技术架构（待生成）
4. TASKS.md - 任务清单（待生成）

每个任务完成后 commit，每 3-4 个任务用 subagent 做代码审查。
