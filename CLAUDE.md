# AI Daily Monitor - Project Rules

## Tech Stack

- Runtime: Node.js 22+ with TypeScript (ESM only)
- Package manager: pnpm
- Test: vitest
- Build: tsup
- LLM SDK: @anthropic-ai/sdk

## Coding Standards

- ESM only: use `import`/`export`, never `require`
- Strict TypeScript: no `any`, no `as` casts unless absolutely necessary
- Prefer `const` over `let`, never use `var`
- Use named exports, avoid default exports
- File naming: kebab-case (e.g., `github-trending.ts`)
- Function naming: camelCase
- Type/Interface naming: PascalCase
- Keep functions small and focused; prefer pure functions

## Project Structure

- `src/sources/` - Data source implementations (one file per source)
- `src/llm/` - LLM integration (summarizer, scorer, dedup)
- `src/pipeline/` - Pipeline orchestration
- `src/output/` - Output formatters (markdown, feishu)
- `src/utils/` - Shared utilities (http, logger)
- `tests/` - Test files mirror src structure

## Architecture Principle

**Separation of fetching and intelligence.** Layer 1 (fetching) is deterministic code with zero LLM tokens. Layer 3 (intelligence) is LLM-powered. Never mix them.

## Commit Convention

- Format: `<type>(<scope>): <description>`
- Types: feat, fix, refactor, test, docs, chore
- Scope: source name, module name, or omit
- Examples:
  - `feat(arxiv): implement arXiv data source`
  - `chore: project scaffolding`
  - `test(hackernews): add unit tests`

## Testing

- Every data source must have a corresponding vitest test
- Tests go in `tests/` mirroring `src/` structure
- Use `vi.fn()` for mocks, avoid real HTTP calls in tests
- Run tests: `pnpm test`

## Environment Variables

- All config via environment variables, loaded from `.env`
- Prefix: none (keep simple)
- Required vars documented in `.env.example`

## Error Handling

- Use typed errors, not string throws
- Data source failures should not crash the pipeline
- Log errors and continue with available data
