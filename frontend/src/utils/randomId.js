/**
 * UUID v4 that also works over plain HTTP.
 *
 * `crypto.randomUUID()` is exposed only in secure contexts (HTTPS, localhost, 127.0.0.1).
 * When the app is served from a LAN address such as http://192.168.1.40 it is `undefined`,
 * and calling it throws `TypeError: crypto.randomUUID is not a function`. `getRandomValues`
 * carries no such restriction, so it backs the fallback path.
 */
export function randomId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 10xx

  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0'))
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-')
}
