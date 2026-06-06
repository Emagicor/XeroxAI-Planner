import { cloneFileForUpload } from '../utils/cloneUploadFile'

import { apiFetchJson } from './apiClient'



/**

 * Detect and clip floor plan regions with Grounding DINO.

 */

export async function detectFloorPlans(file, { isolateUpload = true } = {}) {

  const uploadFile = isolateUpload ? await cloneFileForUpload(file) : file



  const form = new FormData()

  form.append('file', uploadFile, uploadFile.name)



  return apiFetchJson('/detect', {

    method: 'POST',

    body: form,

    cache: 'no-store',

    context: 'detect',

    headers: {

      'X-Request-Id': crypto.randomUUID(),

    },

  })

}


