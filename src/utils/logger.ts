const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const
type LogLevel = keyof typeof LEVELS

function getLevel(): LogLevel {
  const env = process.env.LOG_LEVEL as string | undefined
  if (env && env in LEVELS) return env as LogLevel
  return 'info'
}

function log(level: LogLevel, message: string, ...args: unknown[]) {
  if (LEVELS[level] < LEVELS[getLevel()]) return
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`
  if (level === 'error') {
    console.error(prefix, message, ...args)
  } else if (level === 'warn') {
    console.warn(prefix, message, ...args)
  } else {
    console.log(prefix, message, ...args)
  }
}

export const logger = {
  debug: (msg: string, ...args: unknown[]) => log('debug', msg, ...args),
  info: (msg: string, ...args: unknown[]) => log('info', msg, ...args),
  warn: (msg: string, ...args: unknown[]) => log('warn', msg, ...args),
  error: (msg: string, ...args: unknown[]) => log('error', msg, ...args),
}
