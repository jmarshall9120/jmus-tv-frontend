import type { AttributableRow } from '~/types/dashboard'
import { isTfnStation } from '~/utils/tfnIsStation'

export type GroupKey = 'week' | 'station' | 'day_planned' | 'dow_actual' | 'rotation_fb' | 'day_part'

const SUM_KEYS: (keyof AttributableRow)[] = [
  'spots_planned', 'spots_actual', 'audience_actual', 'viewership_25_54', 'viewership_a35_', 'viewership_a50_',
  'cost_actual', 'sales_records', 'is_tfn_active'
]
// gross_calls, queued_calls, written_count summed only when tfn_is_station === True (exclude null/False)
// cost_fb and audience_fb summed only when spots_actual > 0 (spot actually ran), for correct Cost actual and CPM
const FIRST_KEYS: (keyof AttributableRow)[] = ['rotation_fb', 'day_planned', 'time_planned', 'creative_actual', 'commercial']
const MEAN_KEYS: (keyof AttributableRow)[] = ['rate_planned', 'length_planned', 'length_actual', 'cpm_25_54_planned', 'cpm_50plus_planned', 'cpm_50plus_actual']

export interface AggregatedRow extends Record<string, unknown> {
  week?: string
  station?: string
  day_planned?: string
  dow_actual?: string
  rotation_fb?: string
  day_part?: string
  spots_planned: number
  spots_actual: number
  cost_actual: number
  audience_actual: number
  gross_calls: number
  queued_calls: number
  written_count: number
  rate_planned?: number
  planned_spend?: number
  cost_fb?: number
  queued_per_cost?: number
  queued_per_spot?: number
  [key: string]: unknown
}

/** Day part from row (day_part from data/daypart_actual) or fallback to time_planned. */
function dayPartFrom (row: AttributableRow & { day_part?: string }): string {
  const fromData = row.day_part
  if (fromData != null && String(fromData).trim() !== '') return String(fromData).trim()
  const t = row.time_planned
  return (t != null && String(t).trim() !== '') ? String(t).trim() : '—'
}

/** Add day_part to row for grouping (use existing day_part from data when present). */
function rowWithDayPart (row: AttributableRow & { day_part?: string }): AttributableRow & { day_part: string } {
  return { ...row, day_part: dayPartFrom(row) }
}

/** Filter rows to weeks in [startWeek, endWeek] (inclusive). Weeks are sorted ISO date strings. */
export function filterByWeekRange (
  rows: AttributableRow[],
  startWeek: string,
  endWeek: string
): AttributableRow[] {
  return rows.filter((r) => {
    const w = String(r.week ?? '')
    return w >= startWeek && w <= endWeek
  })
}

/** Aggregate attributable rows by the given group keys. */
export function aggregateBy (
  rows: AttributableRow[],
  groupKeys: GroupKey[]
): AggregatedRow[] {
  if (groupKeys.length === 0) {
    return rows.map((r) => {
      const withDp = rowWithDayPart(r)
      return { ...withDp, day_part: withDp.day_part }
    }) as AggregatedRow[]
  }

  const keyFn = (r: AttributableRow & { day_part?: string }) =>
    groupKeys.map((k) => (k === 'day_part' ? dayPartFrom(r) : String((r as Record<string, unknown>)[k] ?? ''))).join('\0')

  const rowsWithDayPart = rows.map(rowWithDayPart) as (AttributableRow & { day_part: string })[]
  const groups = new Map<string, (AttributableRow & { day_part: string })[]>()

  for (const row of rowsWithDayPart) {
    const key = keyFn(row)
    const list = groups.get(key) ?? []
    list.push(row)
    groups.set(key, list)
  }

  const result: AggregatedRow[] = []
  for (const list of groups.values()) {
    const first = list[0]!
    const agg: AggregatedRow = {
      spots_planned: 0,
      spots_actual: 0,
      cost_actual: 0,
      audience_actual: 0,
      gross_calls: 0,
      queued_calls: 0,
      written_count: 0,
      planned_spend: 0,
      cost_fb: 0,
      audience_fb: 0
    }
    for (const k of MEAN_KEYS) {
      agg[k] = 0
    }
    for (const k of groupKeys) {
      const key = k === 'day_part' ? 'day_part' : k
      agg[key] = first[key as keyof typeof first]
    }
    for (const row of list) {
      for (const k of SUM_KEYS) {
        agg[k] = (Number(agg[k]) || 0) + (Number(row[k]) || 0)
      }
      const rowRecord = row as Record<string, unknown>
      // gross_calls, queued_calls, written_count: only include when tfn_is_station === True
      if (isTfnStation(rowRecord)) {
        agg.gross_calls = (Number(agg.gross_calls) || 0) + (Number(row.gross_calls) || 0)
        agg.queued_calls = (Number(agg.queued_calls) || 0) + (Number(row.queued_calls) || 0)
        agg.written_count = (Number(agg.written_count) || 0) + (Number(row.written_count) || 0)
      }
      for (const k of MEAN_KEYS) {
        agg[k] = (Number(agg[k]) || 0) + (Number(row[k]) || 0)
      }
      // Cost (actual) and audience_fb: only include when spot actually ran (spots_actual > 0)
      const spotsAct = Number(row.spots_actual) || 0
      if (spotsAct > 0) {
        agg.cost_fb = (Number(agg.cost_fb) || 0) + (Number(row.cost_fb) || 0)
        agg.audience_fb = (Number(agg.audience_fb) || 0) + (Number(row.audience_fb) || 0)
      }
      // Planned spend: only include when spots were planned (spots_planned > 0)
      const spotsPlan = Number(row.spots_planned) || 0
      if (spotsPlan > 0) {
        agg.planned_spend = (Number(agg.planned_spend) || 0) + (Number(row.rate_planned) || 0) * spotsPlan
      }
    }
    const n = list.length
    for (const k of MEAN_KEYS) {
      agg[k] = n > 0 ? (Number(agg[k]) || 0) / n : 0
    }
    agg.gross_calls = Math.round(Number(agg.gross_calls) || 0)
    agg.queued_calls = Math.round(Number(agg.queued_calls) || 0)
    agg.written_count = Math.round(Number(agg.written_count) || 0)
    for (const k of FIRST_KEYS) {
      if (!(k in agg)) agg[k] = first[k]
    }
    const costFb = Number(agg.cost_fb) || 0
    const spotsAct = Number(agg.spots_actual) || 0
    const queued = Number(agg.queued_calls) || 0
    const round5 = (x: number) => Math.round(x * 1e5) / 1e5
    agg.queued_per_cost = costFb > 0 ? round5(queued / costFb) : 0
    agg.queued_per_spot = spotsAct > 0 ? round5(queued / spotsAct) : 0
    result.push(agg)
  }

  return result
}
