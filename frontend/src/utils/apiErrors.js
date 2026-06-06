import { useApiStore } from '../stores/apiStore'
import { logError } from './logger'

export const ERROR_CODES = {
  NETWORK: 'NETWORK_ERROR',
  BACKEND_OFFLINE: 'BACKEND_OFFLINE',
  HTTP: 'HTTP_ERROR',
  PARSE: 'PARSE_ERROR',
}

/**
 * @param {unknown} err
 * @param {{ context?: string, url?: string }} meta
 */
export function normalizeNetworkError(err, meta = {}) {
  const baseUrl = useApiStore.getState().apiBaseUrl
  const message = err?.message ?? String(err)

  const isFetchFailure =
    err instanceof TypeError ||
    /failed to fetch|networkerror|load failed|network request failed/i.test(message)

  const apiError = new Error(
    isFetchFailure
      ? `Cannot reach the backend at ${baseUrl}. Start it with .\\start-backend.ps1 in backend2.0, then retry.`
      : message,
  )
  apiError.isApiError = true
  apiError.code = isFetchFailure ? ERROR_CODES.BACKEND_OFFLINE : ERROR_CODES.NETWORK
  apiError.userTitle = isFetchFailure ? 'Backend not running' : 'Connection error'
  apiError.userMessage = apiError.message
  apiError.technicalMessage = message
  apiError.context = meta.context
  apiError.url = meta.url
  apiError.cause = err
  return apiError
}

/**
 * @param {Response} res
 * @param {{ context?: string, url?: string }} meta
 */
export async function parseApiErrorResponse(res, meta = {}) {
  let body = {}
  try {
    body = await res.json()
  } catch {
    body = {}
  }

  const detail = body.detail
  let message =
    typeof detail === 'string'
      ? detail
      : detail?.message ||
        (Array.isArray(detail) ? detail[0]?.msg : null) ||
        body.error ||
        body.message ||
        `Request failed (${res.status})`

  if (detail?.code === 'QUOTA_EXCEEDED') {
    message = detail.message || message
  } else if (/quota|429|rate limit/i.test(String(message))) {
    message =
      'Gemini API quota exceeded. Wait for the limit to reset or change GEMINI_MODEL in backend .env.'
  }

  const apiError = new Error(message)
  apiError.isApiError = true
  apiError.code = detail?.code ?? ERROR_CODES.HTTP
  apiError.userTitle = res.status >= 500 ? 'Server error' : 'Request failed'
  apiError.userMessage = message
  apiError.technicalMessage = message
  apiError.status = res.status
  apiError.context = meta.context
  apiError.url = meta.url
  apiError.responseBody = body
  return apiError
}

/**
 * @param {unknown} err
 * @param {{ context?: string, url?: string }} [meta]
 */
export function toUserError(err, meta = {}) {
  if (err?.isApiError) return err
  return normalizeNetworkError(err, meta)
}

/**
 * @param {unknown} err
 * @param {{ context?: string }} [meta]
 */
export function logApiFailure(err, meta = {}) {
  const normalized = toUserError(err, meta)
  logError(meta.context ?? 'api', normalized, {
    status: normalized.status,
    code: normalized.code,
    url: normalized.url,
  })
  return normalized
}
