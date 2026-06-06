import { cloneFileForUpload } from '../utils/cloneUploadFile'
import { apiFetchJson } from './apiClient'

/**
 * Upload one floor plan — same path as Analyze tab.
 */
export async function analyzeFloorPlan(
  file,
  { isolateUpload = true, detectionId = null, excludedRegionIds = [] } = {},
) {
  const uploadFile = isolateUpload ? await cloneFileForUpload(file) : file

  const form = new FormData()
  form.append('file', uploadFile, uploadFile.name)
  if (detectionId) {
    form.append('detection_id', detectionId)
  }
  if (excludedRegionIds?.length) {
    form.append('excluded_region_ids', JSON.stringify(excludedRegionIds))
  }

  return apiFetchJson('/analyze', {
    method: 'POST',
    body: form,
    cache: 'no-store',
    context: 'analyze',
    headers: {
      'X-Request-Id': crypto.randomUUID(),
    },
  })
}
