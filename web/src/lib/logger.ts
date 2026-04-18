export function logInfo(scope: string, message: string, data?: unknown) {
  console.info(`[voice-first][${scope}] ${message}`, data ?? '')
}

export function logWarn(scope: string, message: string, data?: unknown) {
  console.warn(`[voice-first][${scope}] ${message}`, data ?? '')
}

export function logError(scope: string, message: string, data?: unknown) {
  console.error(`[voice-first][${scope}] ${message}`, data ?? '')
}
