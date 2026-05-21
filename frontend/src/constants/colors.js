export const ROOM_HEX_COLORS = [
  '#1D9E75',
  '#7F77DD',
  '#BA7517',
  '#D85A30',
  '#378ADD',
  '#639922',
  '#D4537E',
  '#888780',
]

export function roomColor(index) {
  return ROOM_HEX_COLORS[index % ROOM_HEX_COLORS.length]
}
