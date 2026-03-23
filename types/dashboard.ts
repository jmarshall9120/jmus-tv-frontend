/** One row from MasterAttributableDataSet (aggregated by attribution_id). */
export interface AttributableRow {
  attribution_id: string
  /** Present when spot actually aired (postlog). */
  postlog_id?: string
  week: string
  /** Spot air datetime (e.g. YYYY-MM-DD HH:mm:ss). Used to derive dow_actual. */
  date_time?: string
  /** Day of week from data (day_of_week_actual) or derived from date_time. Set when data is loaded. */
  dow_actual?: string
  /** Day part from data (daypart_actual) or derived from time_planned. Set when data is loaded. */
  day_part?: string
  /** Day part from CSV (e.g. Prime, Early Fringe). */
  daypart_actual?: string
  /** Day of week from CSV (e.g. Saturday, Wednesday). */
  day_of_week_actual?: string
  station: string
  spots_planned: number
  rotation_fb: string
  day_planned: string
  time_planned: string
  rate_planned: number
  length_planned: number
  spots_actual: number
  creative_actual: string
  length_actual: number
  audience_actual: number
  viewership_25_54: number
  viewership_a35_: number
  viewership_a50_: number
  cpm_25_54_planned: number
  cpm_50plus_planned: number
  cpm_50plus_actual: number
  cost_fb: number
  audience_fb: number
  cost_actual: number
  sales_records: number
  commercial: string
  gross_calls: number
  queued_calls: number
  written_count: number
  /** Statistical lift: contribution to calls not on dubbed lines. When lift toggle is on, effective = base + lift. */
  lift_calls?: number
  lift_queued?: number
  lift_written?: number
  is_tfn_active: number
  /** True when calls went to a station; null/False = exclude from call totals. */
  tfn_is_station?: boolean | string | null
  /** Web/GA lift metrics (for Web Lift card). */
  lift_views?: number
  lift_sessions?: number
  lift_active_users?: number
  /** GRP and lift_goal_* from schema (GA). */
  [key: string]: unknown
}

/** Subset of non-attributable sales row used for dashboard (week/station aggregates). */
export interface NonAttributableRow {
  week: string
  station: string
  gross_calls: number
  queued_calls: number
  written_count: number
  lift_calls?: number
  lift_queued?: number
  lift_written?: number
  /** True when calls went to a station; null/False = exclude from call totals. */
  tfn_is_station?: boolean | string | null
  [key: string]: unknown
}

export interface AttributableApiResponse {
  data: AttributableRow[]
  total: number
}

export interface NonAttributableApiResponse {
  data: NonAttributableRow[]
  total: number
}
