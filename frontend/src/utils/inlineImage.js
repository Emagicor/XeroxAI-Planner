/** Build a data-URL from inline base64 image data from the API. */
export function inlineImageSrc(base64, mime = 'image/jpeg') {
  if (!base64) return null
  if (base64.startsWith('data:')) return base64
  return `data:${mime};base64,${base64}`
}
