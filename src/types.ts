export interface RawItem {
  sourceId: string
  externalId: string
  title: string
  url: string
  content?: string
  authors?: string[]
  publishedAt: Date
  metadata: Record<string, unknown>
}

export interface ScoredItem extends RawItem {
  score: number
  summary: string
  tags: string[]
  dedupKey: string
}

export interface DailyReport {
  date: string
  items: ScoredItem[]
  highlights: string
  generatedAt: Date
}
