import type { Ref } from 'vue'
import { ref } from 'vue'
import type { AttributableRow, NonAttributableRow } from '~/types/dashboard'
import { dayOfWeekFromDate, normalizeDayOfWeek } from '~/utils/dateHelpers'

export interface DashboardData {
  attributable: Ref<{ data: AttributableRow[]; total: number }>
  nonAttributable: Ref<{ data: NonAttributableRow[]; total: number }>
  availableWeeks: Ref<string[]>
  loading: Ref<boolean>
  error: Ref<string | null>
  refresh: () => Promise<void>
  loadInitial: () => Promise<void>
  loadWeekRange: (weekStart: string, weekEnd: string) => Promise<void>
}

interface StubResponse {
  records: Record<string, unknown>[]
  available_weeks: unknown[]
}

function weekToDateString(v: string | number | null | undefined): string {
  if (v == null || v === '') return ''
  const s = String(v).trim()
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  return s.slice(0, 10)
}

function mapAttributable(row: Record<string, unknown>): AttributableRow & { dow_actual?: string; day_part?: string } {
  const week = weekToDateString(row.week as string) || String(row.week ?? '')
  const datePart = row.date_time ? String(row.date_time).trim().slice(0, 10) : ''
  const dowRaw = row.day_of_week_actual != null && String(row.day_of_week_actual).trim() !== ''
    ? String(row.day_of_week_actual)
    : (datePart ? dayOfWeekFromDate(datePart) : dayOfWeekFromDate(week))

  return {
    attribution_id: String(row.attribution_id ?? ''),
    postlog_id: row.postlog_id != null ? String(row.postlog_id) : undefined,
    week,
    date_time: row.date_time != null ? String(row.date_time) : undefined,
    dow_actual: normalizeDayOfWeek(dowRaw),
    day_part: row.daypart_actual != null ? String(row.daypart_actual) : String(row.time_planned ?? '—'),
    daypart_actual: row.daypart_actual != null ? String(row.daypart_actual) : undefined,
    day_of_week_actual: row.day_of_week_actual != null ? String(row.day_of_week_actual) : undefined,
    station: String(row.station ?? ''),
    spots_planned: Number(row.spots_planned) || 0,
    rotation_fb: String(row.rotation_fb ?? ''),
    day_planned: String(row.day_planned ?? ''),
    time_planned: String(row.time_planned ?? ''),
    rate_planned: Number(row.rate_planned) || 0,
    length_planned: Number(row.length_planned) || 0,
    spots_actual: Number(row.spots_actual) || 0,
    creative_actual: String(row.creative_actual ?? ''),
    length_actual: Number(row.length_actual) || 0,
    audience_actual: Number(row.audience_actual) || 0,
    viewership_25_54: Number(row.viewership_25_54) || 0,
    viewership_a35_: Number(row.viewership_a35_) || 0,
    viewership_a50_: Number(row.viewership_a50_) || 0,
    cpm_25_54_planned: Number(row.cpm_25_54_planned) || 0,
    cpm_50plus_planned: Number(row.cpm_50plus_planned) || 0,
    cpm_50plus_actual: Number(row.cpm_50plus_actual) || 0,
    cost_fb: Number(row.cost_fb) || 0,
    audience_fb: Number(row.audience_fb) || 0,
    cost_actual: Number(row.cost_actual) || 0,
    sales_records: Number(row.sales_records) || 0,
    commercial: String(row.commercial ?? ''),
    gross_calls: Number(row.gross_calls) || 0,
    queued_calls: Number(row.queued_calls) || 0,
    written_count: Number(row.written_count) || 0,
    lift_calls: row.lift_calls != null ? Number(row.lift_calls) : undefined,
    lift_queued: row.lift_queued != null ? Number(row.lift_queued) : undefined,
    lift_written: row.lift_written != null ? Number(row.lift_written) : undefined,
    is_tfn_active: Number(row.is_tfn_active) || 0,
    tfn_is_station: row.tfn_is_station as boolean | string | null | undefined,
    lift_views: row.lift_views != null ? Number(row.lift_views) : 0,
    lift_sessions: row.lift_sessions != null ? Number(row.lift_sessions) : 0,
    lift_active_users: row.lift_active_users != null ? Number(row.lift_active_users) : 0,
  }
}

function mapNonAttributable(row: Record<string, unknown>): NonAttributableRow {
  return {
    week: weekToDateString(row.week as string) || String(row.week ?? ''),
    station: String(row.station ?? ''),
    gross_calls: Number(row.gross_calls) || 0,
    queued_calls: Number(row.queued_calls) || 0,
    written_count: Number(row.written_count) || 0,
    lift_calls: row.lift_calls != null ? Number(row.lift_calls) : undefined,
    lift_queued: row.lift_queued != null ? Number(row.lift_queued) : undefined,
    lift_written: row.lift_written != null ? Number(row.lift_written) : undefined,
    tfn_is_station: row.tfn_is_station as boolean | string | null | undefined,
  }
}

function normalizeAvailableWeeks(raw: unknown[]): string[] {
  const out = new Set<string>()
  for (const v of raw) {
    const s = weekToDateString(v as string)
    if (s) out.add(s)
  }
  return Array.from(out).sort()
}

async function loadStub(path: string): Promise<StubResponse> {
  const response = await fetch(path)
  if (!response.ok) throw new Error(`Failed to load stub data: ${path}`)
  return response.json() as Promise<StubResponse>
}

function inRange(week: string, start: string, end: string): boolean {
  return week >= start && week <= end
}

export function useDashboardData(): DashboardData {
  const attributable = ref<{ data: AttributableRow[]; total: number }>({ data: [], total: 0 })
  const nonAttributable = ref<{ data: NonAttributableRow[]; total: number }>({ data: [], total: 0 })
  const availableWeeks = ref<string[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  let lastWeekStart = ''
  let lastWeekEnd = ''

  async function loadInitial() {
    loading.value = true
    error.value = null
    try {
      const [attrib, nonAttrib] = await Promise.all([
        loadStub('/stub-dashboard-attributable.json'),
        loadStub('/stub-dashboard-non-attributable.json'),
      ])

      const attribRows = (attrib.records ?? []).map(mapAttributable)
      const nonAttribRows = (nonAttrib.records ?? []).map(mapNonAttributable)

      attributable.value = { data: attribRows, total: attribRows.length }
      nonAttributable.value = { data: nonAttribRows, total: nonAttribRows.length }

      const weeks = normalizeAvailableWeeks(
        (attrib.available_weeks?.length ? attrib.available_weeks : nonAttrib.available_weeks) ?? []
      )
      availableWeeks.value = weeks
    } catch (e) {
      attributable.value = { data: [], total: 0 }
      nonAttributable.value = { data: [], total: 0 }
      availableWeeks.value = []
      error.value = e instanceof Error ? e.message : 'Failed to load dashboard data'
    } finally {
      loading.value = false
    }
  }

  async function loadWeekRange(weekStart: string, weekEnd: string) {
    if (!weekStart || !weekEnd) return
    loading.value = true
    error.value = null
    lastWeekStart = weekStart
    lastWeekEnd = weekEnd

    try {
      const [attrib, nonAttrib] = await Promise.all([
        loadStub('/stub-dashboard-attributable.json'),
        loadStub('/stub-dashboard-non-attributable.json'),
      ])

      const attribRows = (attrib.records ?? [])
        .map(mapAttributable)
        .filter((r) => inRange(r.week, weekStart, weekEnd))

      const nonAttribRows = (nonAttrib.records ?? [])
        .map(mapNonAttributable)
        .filter((r) => inRange(r.week, weekStart, weekEnd))

      attributable.value = { data: attribRows, total: attribRows.length }
      nonAttributable.value = { data: nonAttribRows, total: nonAttribRows.length }
    } catch (e) {
      attributable.value = { data: [], total: 0 }
      nonAttributable.value = { data: [], total: 0 }
      error.value = e instanceof Error ? e.message : 'Failed to load dashboard data'
    } finally {
      loading.value = false
    }
  }

  async function refresh() {
    if (lastWeekStart && lastWeekEnd) {
      await loadWeekRange(lastWeekStart, lastWeekEnd)
      return
    }
    await loadInitial()
  }

  return {
    attributable,
    nonAttributable,
    availableWeeks,
    loading,
    error,
    refresh,
    loadInitial,
    loadWeekRange,
  }
}
