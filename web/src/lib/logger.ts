export type LogLevel = 'info' | 'warn' | 'error'

export interface ClientLogEntry {
  timestamp: string
  level: LogLevel
  scope: string
  message: string
  data?: unknown
}

const LOG_STORAGE_KEY = 'voice-first-sfu:client-logs'
const MAX_LOG_ENTRIES = 400

let entries: ClientLogEntry[] = loadEntries()
const listeners = new Set<(entries: ClientLogEntry[]) => void>()

export function logInfo(scope: string, message: string, data?: unknown) {
  writeLog('info', scope, message, data)
}

export function logWarn(scope: string, message: string, data?: unknown) {
  writeLog('warn', scope, message, data)
}

export function logError(scope: string, message: string, data?: unknown) {
  writeLog('error', scope, message, data)
}

export function getClientLogs() {
  return [...entries]
}

export function subscribeClientLogs(listener: (entries: ClientLogEntry[]) => void) {
  listeners.add(listener)
  listener(getClientLogs())
  return () => {
    listeners.delete(listener)
  }
}

export function clearClientLogs() {
  entries = []
  persistEntries()
  emit()
}

export function exportClientLogsText() {
  return entries
    .map((entry) => {
      const details = entry.data === undefined ? '' : ` ${safeSerialize(entry.data)}`
      return `${entry.timestamp} [${entry.level.toUpperCase()}] [${entry.scope}] ${entry.message}${details}`
    })
    .join('\n')
}

function writeLog(level: LogLevel, scope: string, message: string, data?: unknown) {
  const prefix = `[voice-first][${scope}] ${message}`
  if (level === 'info') {
    console.info(prefix, data ?? '')
  } else if (level === 'warn') {
    console.warn(prefix, data ?? '')
  } else {
    console.error(prefix, data ?? '')
  }

  entries = [
    ...entries,
    {
      timestamp: new Date().toISOString(),
      level,
      scope,
      message,
      data: cloneSerializable(data)
    }
  ].slice(-MAX_LOG_ENTRIES)

  persistEntries()
  emit()
}

function emit() {
  const snapshot = getClientLogs()
  listeners.forEach((listener) => listener(snapshot))
}

function persistEntries() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Best effort log persistence only.
  }
}

function loadEntries() {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(LOG_STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as ClientLogEntry[]) : []
  } catch {
    return []
  }
}

function cloneSerializable(data: unknown) {
  if (data === undefined) {
    return undefined
  }

  try {
    return JSON.parse(JSON.stringify(data))
  } catch {
    return String(data)
  }
}

function safeSerialize(data: unknown) {
  try {
    return JSON.stringify(data)
  } catch {
    return String(data)
  }
}
