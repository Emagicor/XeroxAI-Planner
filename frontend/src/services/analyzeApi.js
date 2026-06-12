import { cloneFileForUpload } from '../utils/cloneUploadFile'
import { apiFetchJson } from './apiClient'

/**
 * Upload one floor plan — same path as Analyze tab.
 */
export async function analyzeFloorPlan(
  file,
  {
    isolateUpload = true,
    visionProvider = null,
    visionModel = null,
  } = {},
) {
  const uploadFile = isolateUpload ? await cloneFileForUpload(file) : file

  const form = new FormData()
  form.append('file', uploadFile, uploadFile.name)
  if (visionProvider) {
    form.append('vision_provider', visionProvider)
  }
  if (visionModel) {
    form.append('vision_model', visionModel)
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
