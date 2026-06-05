/** SHA-256 hex digest of file bytes (for verifying upload integrity). */
export async function sha256Hex(file) {
  const buffer = await file.arrayBuffer()
  const hash = await crypto.subtle.digest('SHA-256', buffer)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
