import { useApiStore } from '../stores/apiStore'
import { cloneFileForUpload } from '../utils/cloneUploadFile'
import { logApiFailure, parseApiErrorResponse } from '../utils/apiErrors'
import { logError } from '../utils/logger'

/**
 * Stream analyze results — one SSE event per floor plan region.
 */
export async function analyzeFloorPlanStream(
  file,
  handlers = {},
  { detectionId = null, excludedRegionIds = [] } = {},
) {
  const base = useApiStore.getState().apiBaseUrl.replace(/\/$/, '')
  const url = `${base}/analyze/stream`
  const uploadFile = await cloneFileForUpload(file)

  const form = new FormData()
  form.append('file', uploadFile, uploadFile.name)
  if (detectionId) {
    form.append('detection_id', detectionId)
  }
  if (excludedRegionIds?.length) {
    form.append('excluded_region_ids', JSON.stringify(excludedRegionIds))
  }

  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      body: form,
      cache: 'no-store',
      headers: {
        'X-Request-Id': crypto.randomUUID(),
      },
    })
  } catch (err) {
    throw logApiFailure(err, { context: 'analyze/stream', url })
  }

  if (!res.ok) {
    const apiError = await parseApiErrorResponse(res, { context: 'analyze/stream', url })
    throw logApiFailure(apiError, { context: 'analyze/stream', url })
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('Streaming not supported by this browser')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''

    for (const part of parts) {
      const line = part.trim()
      if (!line.startsWith('data:')) continue
      try {
        const json = JSON.parse(line.slice(5).trim())

        if (json.type === 'detected') handlers.onDetected?.(json)
        else if (json.type === 'progress') handlers.onProgress?.(json)
        else if (json.type === 'done') handlers.onDone?.(json)
        else if (json.type === 'error') handlers.onError?.(json.message)
      } catch (parseErr) {
        logError('analyze/stream.parse', parseErr, { chunk: line.slice(0, 120) })
      }
    }
  }
}
