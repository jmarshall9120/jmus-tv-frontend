import type { AttributableRow } from '~/types/dashboard'

export interface ClearanceRow {
  label: string
  station: string
  rotation_fb?: string
  spots_planned: number
  spots_actual_paid: number
  spots_actual_bonus: number
  spots_actual: number
  clearance_pct: number
  paid_pct: number
  bonus_pct: number
}

/**
 * Aggregate clearance (planned vs actual spots) by station, or by station + rotation.
 * Bonus = actual spots with 0 cost (cost_fb === 0).
 */
export function clearanceBy (
  rows: AttributableRow[],
  byStationAndRotation: boolean
): ClearanceRow[] {
  const keyFn = (r: AttributableRow) => {
    const station = String(r.station ?? '').trim()
    if (!byStationAndRotation) return station
    const rotation = String(r.rotation_fb ?? '').trim()
    return `${station}\0${rotation}`
  }

  const labelFn = (station: string, rotation?: string) => {
    const rot = (rotation ?? '').trim()
    return byStationAndRotation && rot ? `${station} · ${rot}` : (station || '—')
  }

  const groups = new Map<string, { station: string; rotation_fb?: string; planned: number; paid: number; bonus: number }>()

  for (const r of rows) {
    const key = keyFn(r)
    const planned = Number(r.spots_planned) || 0
    const actual = Number(r.spots_actual) || 0
    const cost = Number(r.cost_fb) || 0
    const isBonus = cost <= 0
    const paid = isBonus ? 0 : actual
    const bonus = isBonus ? actual : 0

    const g = groups.get(key)
    if (!g) {
      groups.set(key, {
        station: String(r.station ?? '').trim(),
        rotation_fb: byStationAndRotation ? String(r.rotation_fb ?? '').trim() : undefined,
        planned,
        paid,
        bonus
      })
    } else {
      g.planned += planned
      g.paid += paid
      g.bonus += bonus
    }
  }

  const result: ClearanceRow[] = []
  for (const g of groups.values()) {
    const planned = g.planned
    const actual = g.paid + g.bonus
    const clearance_pct = planned > 0 ? Math.min(100, (actual / planned) * 100) : (actual > 0 ? 100 : 0)
    const divisor = planned > 0 ? planned : (actual > 0 ? actual : 1)
    const paid_pct = (g.paid / divisor) * 100
    const bonus_pct = (g.bonus / divisor) * 100
    result.push({
      label: labelFn(g.station, g.rotation_fb),
      station: g.station,
      rotation_fb: g.rotation_fb,
      spots_planned: Math.round(planned),
      spots_actual_paid: Math.round(g.paid),
      spots_actual_bonus: Math.round(g.bonus),
      spots_actual: Math.round(actual),
      clearance_pct: Math.round(clearance_pct * 10) / 10,
      paid_pct: Math.round(paid_pct * 100) / 100,
      bonus_pct: Math.round(bonus_pct * 100) / 100
    })
  }

  return result
    .filter((r) => r.spots_planned > 0 || r.spots_actual > 0)
    .sort((a, b) => (a.label || '').localeCompare(b.label || '', undefined, { sensitivity: 'base' }))
}
