import { ProxyAgent } from 'undici'
import { config } from '../config.js'
import { logger } from './logger.js'

let proxyAgent: ProxyAgent | undefined

function getDispatcher(): ProxyAgent | undefined {
  if (!config.httpProxy) return undefined
  if (!proxyAgent) {
    proxyAgent = new ProxyAgent(config.httpProxy)
    logger.info(`Using HTTP proxy: ${config.httpProxy}`)
  }
  return proxyAgent
}

async function proxyFetch(url: string, init?: RequestInit): Promise<Response> {
  const dispatcher = getDispatcher()
  if (!dispatcher) return fetch(url, init)
  // Node.js 22 native fetch accepts undici dispatcher but TypeScript doesn't know
  return fetch(url, Object.assign({}, init, { dispatcher }) as RequestInit)
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  logger.debug(`GET ${url}`)
  const res = await proxyFetch(url, init)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${url}`)
  }
  return res.json() as Promise<T>
}

export async function fetchText(url: string, init?: RequestInit): Promise<string> {
  logger.debug(`GET ${url}`)
  const res = await proxyFetch(url, init)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${url}`)
  }
  return res.text()
}

/** Proxy-aware fetch for use as SDK custom fetch */
export { proxyFetch }
