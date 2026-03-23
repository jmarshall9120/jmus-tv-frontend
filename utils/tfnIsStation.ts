/**
 * True only when tfn_is_station is explicitly True (calls that went to a station).
 * Excludes null, undefined, "False", empty string, so we don't take credit for events/lift that didn't go to a station.
 */
export function isTfnStation (row: Record<string, unknown>): boolean {
  const v = row.tfn_is_station
  if (v === true || v === 1) return true
  if (v === false || v === 0) return false
  if (v == null) return false
  const s = String(v).trim().toLowerCase()
  return s === 'true' || s === '1'
}
