import { useApiStore } from '../stores/apiStore'
import { logApiFailure, normalizeNetworkError, parseApiErrorResponse } from '../utils/apiErrors'

function resolveUrl(path) {
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const base = useApiStore.getState().apiBaseUrl.replace(/\/$/, '')
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * Fetch wrapper with consistent network + HTTP error handling.
 * @param {string} path
 * @param {RequestInit & { context?: string }} options
 */
export async function apiFetch(path, options = {}) {
  const { context = path, ...init } = options
  const url = resolveUrl(path)

  let res
  try {
    res = await fetch(url, init)
  } catch (err) {
    throw logApiFailure(err, { context, url })
  }

  if (!res.ok) {
    const apiError = await parseApiErrorResponse(res, { context, url })
    throw logApiFailure(apiError, { context, url })
  }

  return res
}

export async function apiFetchJson(path, options = {}) {
  const res = await apiFetch(path, options)
  try {
    return await res.json()
  } catch (err) {
    throw logApiFailure(normalizeNetworkError(err, { context: options.context ?? path }), {
      context: options.context ?? path,
      url: resolveUrl(path),
    })
  }
}
