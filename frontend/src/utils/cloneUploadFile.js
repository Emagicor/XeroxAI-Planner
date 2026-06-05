/**
 * Build an independent File for each /analyze request.
 * Avoids shared stream/state when the same File is uploaded multiple times in a batch.
 */
export async function cloneFileForUpload(file) {
  if (!file) {
    throw new Error('No file to upload')
  }

  const buffer = await file.arrayBuffer()
  const type = file.type || guessMimeFromName(file.name) || 'application/octet-stream'
  const name = file.name || 'upload'

  return new File([buffer], name, {
    type,
    lastModified: file.lastModified ?? Date.now(),
  })
}

function guessMimeFromName(name) {
  const lower = (name || '').toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  return null
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
