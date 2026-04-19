import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearClientLogs,
  exportClientLogsText,
  getClientLogs,
  logError,
  logInfo
} from '@/lib/logger'

describe('client logger', () => {
  beforeEach(() => {
    localStorage.clear()
    clearClientLogs()
  })

  it('stores logs for later export', () => {
    logInfo('rtc', 'publisher started', { roomId: 'river-sky-42' })
    logError('signaling', 'websocket closed', { code: 1006 })

    const logs = getClientLogs()

    expect(logs).toHaveLength(2)
    expect(exportClientLogsText()).toContain('[INFO] [rtc] publisher started')
    expect(exportClientLogsText()).toContain('"roomId":"river-sky-42"')
    expect(exportClientLogsText()).toContain('[ERROR] [signaling] websocket closed')
  })
})
