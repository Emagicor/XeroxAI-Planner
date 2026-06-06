import { useCallback, useEffect, useState } from 'react'
import { useApiStore } from '../stores/apiStore'
import { logInfo } from '../utils/logger'

/**
 * Poll backend /health — used for header status indicator.
 */
export function useBackendHealth({ intervalMs = 20000 } = {}) {
  const apiBaseUrl = useApiStore((s) => s.apiBaseUrl)
  const [status, setStatus] = useState('checking') // checking | online | offline

  const check = useCallback(async () => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    try {
      const res = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/health`, {
        signal: controller.signal,
        cache: 'no-store',
      })
      setStatus(res.ok ? 'online' : 'offline')
      if (res.ok) logInfo('health', 'Backend online', { url: apiBaseUrl })
    } catch {
      setStatus('offline')
    } finally {
      clearTimeout(timeout)
    }
  }, [apiBaseUrl])

  useEffect(() => {
    check()
    const id = setInterval(check, intervalMs)
    return () => clearInterval(id)
  }, [check, intervalMs])

  return { status, recheck: check, apiBaseUrl }
}
