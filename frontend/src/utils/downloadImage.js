/**
 * Trigger a browser download for an image src (data URL or http URL).
 */
export async function downloadImageFromSrc(src, filename = 'image.jpg') {
  if (!src) return

  const res = await fetch(src)
  if (!res.ok) throw new Error('Image download failed')

  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}
