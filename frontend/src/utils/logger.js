const isDev = import.meta.env.DEV

/**
 * Lightweight structured logging for API and UI errors.
 */
export function logError(context, error, extra = {}) {
  const payload = {
    context,
    message: error?.message ?? String(error),
    ...extra,
    ...(error?.status != null ? { status: error.status } : {}),
    ...(error?.url ? { url: error.url } : {}),
    ...(error?.code ? { code: error.code } : {}),
  }
  console.error(`[FloorPlan AI] ${context}`, payload, error)
  return payload
}

export function logWarn(context, message, extra = {}) {
  if (isDev) {
    console.warn(`[FloorPlan AI] ${context}`, message, extra)
  }
}

export function logInfo(context, message, extra = {}) {
  if (isDev) {
    console.info(`[FloorPlan AI] ${context}`, message, extra)
  }
}
