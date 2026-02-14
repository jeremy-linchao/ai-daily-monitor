import type { RawItem } from '../types.js'

export interface DataSource {
  name: string
  fetch(): Promise<RawItem[]>
}
