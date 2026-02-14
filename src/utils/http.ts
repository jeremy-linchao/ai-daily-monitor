import { logger } from './logger.js'

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  logger.debug(`GET ${url}`)
  const res = await fetch(url, init)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${url}`)
  }
  return res.json() as Promise<T>
}

export async function fetchText(url: string, init?: RequestInit): Promise<string> {
  logger.debug(`GET ${url}`)
  const res = await fetch(url, init)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${url}`)
  }
  return res.text()
}
