import { useApiStore } from '../stores/apiStore'
import { logError } from './logger'
import { isProduction } from '../config/features'

export const ERROR_CODES = {
  NETWORK: 'NETWORK_ERROR',
  BACKEND_OFFLINE: 'BACKEND_OFFLINE',
  HTTP: 'HTTP_ERROR',
  PARSE: 'PARSE_ERROR',
}

/** Backend provider / pipeline codes — show server message verbatim. */
export const SERVER_PROVIDER_ERROR_CODES = new Set([
  'MISSING_API_KEY',
  'INVALID_API_KEY',
  'QUOTA_EXCEEDED',
  'BILLING_CREDITS_DEPLETED',
  'MODEL_NOT_FOUND',
  'GEMINI_ERROR',
  'OPENAI_ERROR',
  'GROQ_ERROR',
  'VISION_PROVIDER_ERROR',
  'JSON_PARSE_ERROR',
])

const SERVER_ERROR_CODES = new Set([
  ...SERVER_PROVIDER_ERROR_CODES,
  'INTERNAL_ERROR',
])

const PROVIDER_FAILURE_MESSAGE_MARKERS =
  /503|429|unavailable|high demand|api key|quota|rate limit|gemini|openai|groq/i

/** User-safe copy for provider codes (production hides technical detail). */
const PRODUCTION_USER_MESSAGES = {
  JSON_PARSE_ERROR:
    'The analysis could not be completed because the vision model returned an unreadable response. Please try again.',
  MISSING_API_KEY:
    'The analysis service is not fully configured. Please contact support.',
  INVALID_API_KEY:
    'The analysis service could not authenticate with the vision provider. Please contact support.',
  QUOTA_EXCEEDED:
    'The vision provider rate limit was reached. Please wait a moment and try again.',
  BILLING_CREDITS_DEPLETED:
    'Vision provider credits are depleted. Please contact your administrator.',
  MODEL_NOT_FOUND:
    'The configured vision model is unavailable. Please contact support.',
  GEMINI_ERROR:
    'The Gemini vision service returned an error. Please try again shortly.',
  OPENAI_ERROR:
    'The OpenAI vision service returned an error. Please try again shortly.',
  GROQ_ERROR:
    'The Groq vision service returned an error. Please try again shortly.',
  VISION_PROVIDER_ERROR:
    'The vision provider returned an error. Please try again shortly.',
  INTERNAL_ERROR:
    'Something went wrong while analyzing your file. Please try again.',
}

function backendOfflineMessage(baseUrl) {
  if (isProduction) {
    return 'Cannot reach the analysis service. Check your connection and try again.'
  }
  return `Cannot reach the backend at ${baseUrl}. Start it with .\\start-backend.ps1 in backend2.0, then retry.`
}

function backendOfflineTitle() {
  return isProduction ? 'Service unavailable' : 'Backend not running'
}

export function userFacingProviderMessage(code, serverMessage) {
  if (!code) return serverMessage
  if (isProduction && PRODUCTION_USER_MESSAGES[code]) {
    return PRODUCTION_USER_MESSAGES[code]
  }
  return serverMessage
}

export function isProviderFailureCode(code) {
  return Boolean(code && SERVER_PROVIDER_ERROR_CODES.has(code))
}

export function isProviderFailureMessage(message) {
  return Boolean(message && PROVIDER_FAILURE_MESSAGE_MARKERS.test(message))
}

/**
 * Build a normalized API error from an SSE or JSON error payload.
 * @param {{ code?: string, message?: string }} payload
 */
export function createApiErrorFromPayload(payload, meta = {}) {
  const serverMessage = payload?.message ?? 'Analysis failed'
  const code = payload?.code ?? undefined
  const message = userFacingProviderMessage(code, serverMessage)
  const apiError = new Error(message)
  apiError.isApiError = true
  apiError.code = isProviderFailureCode(code) ? code : code ?? ERROR_CODES.HTTP
  apiError.userTitle = isProviderFailureCode(code) ? 'Vision provider error' : 'Analysis failed'
  apiError.userMessage = message
  apiError.technicalMessage = serverMessage
  apiError.context = meta.context
  apiError.url = meta.url
  return apiError
}

function extractServerDetail(body) {
  const detail = body?.detail
  if (typeof detail === 'string') {
    return { code: null, message: detail }
  }
  if (detail && typeof detail === 'object') {
    return {
      code: detail.code ?? null,
      message: detail.message ?? null,
    }
  }
  return {
    code: body?.code ?? null,
    message: body?.message ?? null,
  }
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
    isFetchFailure ? backendOfflineMessage(baseUrl) : message,
  )
  apiError.isApiError = true
  apiError.code = isFetchFailure ? ERROR_CODES.BACKEND_OFFLINE : ERROR_CODES.NETWORK
  apiError.userTitle = isFetchFailure ? backendOfflineTitle() : 'Connection error'
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

  const { code, message: serverMessage } = extractServerDetail(body)
  let message =
    serverMessage ||
    (Array.isArray(body.detail) ? body.detail[0]?.msg : null) ||
    body.error ||
    `Request failed (${res.status})`

  if (code && SERVER_ERROR_CODES.has(code) && serverMessage) {
    message = userFacingProviderMessage(code, serverMessage)
  }

  const apiError = new Error(message)
  apiError.isApiError = true
  apiError.code = code ?? ERROR_CODES.HTTP
  apiError.userTitle = res.status >= 500 ? 'Server error' : 'Request failed'
  apiError.userMessage = message
  apiError.technicalMessage = serverMessage || message
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
