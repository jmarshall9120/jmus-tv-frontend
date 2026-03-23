/**
 * GraphQL types for JMUS demo backend API
 * Aligned with the local demo GraphQL schema
 * AWSJSON fields are parsed types (arrays/objects), not strings
 */

// ============ SCALARS ============
export type AWSDateTime = string
export type AWSTimestamp = number
export type AWSJSON = string
export type AWSURL = string

// ============ ENUMS ============
export type AnalyticsJobType =
  | 'PARSE_BUYSHEETS'
  | 'PARSE_POSTLOGS'
  | 'PARSE_POSTLOGS_2'
  | 'INGEST_SALES'
  | 'PULL_GA'
  | 'ATTRIBUTE_POSTLOGS'
  | 'ATTRIBUTE_SALES_NUMBERS'
  | 'ATTRIBUTE_SALES_TIME_BASIS_2'
  | 'ATTRIBUTE_WEBLOGS_STATION_FEATURES'
  | 'BUILD_MASTER_DATASET'

export type JobStatus = 'RUNNING' | 'SUCCESS' | 'FAILED'

export type FileType = 'BUY' | 'POSTLOG' | 'SALE' | 'GA'

export type FileStatus =
  | 'UPLOADED'
  | 'PARSING'
  | 'PARSED'
  | 'PARSING_FAILED'
  | 'CLEANING'
  | 'CLEANED'
  | 'CLEANING_FAILED'
  | 'MERGING'
  | 'MERGED'
  | 'MERGING_FAILED'

export type STDMatchType = 'STATION' | 'CLIENT' | 'CREATIVE' | 'TFN'

export type UploadType = 'BUYS' | 'POSTLOGS' | 'SALES' | 'TFN_MAPPINGS'

// ============ ENTITY TYPES ============
export interface AnalyticsJob {
  PK: string
  SK: string
  type: AnalyticsJobType
  job_id: string
  file_id?: string | null
  userId?: string | null
  status: JobStatus
  started_at: string
  completed_at?: string | null
  duration_seconds?: number | null
  rows_processed?: number | null
  error_message?: string | null
  glue_job_run_id?: string | null
  input_paths?: string[] | null
  output_paths?: string[] | null
  context?: Record<string, unknown> | null
  _created_at: string
  _updated_at: string
  _is_retired?: boolean | null
}

export interface FileMetadata {
  PK?: string | null
  SK?: string | null
  type?: string | null
  file_id?: string | null
  status?: string | null
  created_by?: string | null
  file_name?: string | null
  file_hash?: string | null
  s3_raw_path?: string | null
  s3_parsed_path?: string | null
  s3_cleaned_path?: string | null
  error_message?: string | null
  row_count?: number | null
  context?: Record<string, unknown> | null
  is_rebase?: boolean | null
  rebase_period?: string | null
  rebase_start?: string | null
  rebase_end?: string | null
  merged_at?: string | null
  merge_batch_id?: string | null
  merge_claimed_at?: string | null
  _created_at?: string | null
  _updated_at?: string | null
  _is_retired?: boolean | null
  _row_hash?: string | null
}

export interface STDMatch {
  PK: string
  SK: string
  type: string
  canonical_name?: string | null
  aliases: string[]
  context?: Record<string, unknown> | null
  _created_at: string
  _updated_at: string
  _is_retired: boolean
}

// ============ CONNECTION TYPES ============
export interface AnalyticsJobConnection {
  items: AnalyticsJob[]
  count: number
  nextToken?: string | null
}

export interface FileMetadataConnection {
  items: FileMetadata[]
  count: number
  nextToken?: string | null
}

export interface STDMatchConnection {
  items: STDMatch[]
  count: number
  nextToken?: string | null
}

// ============ RESPONSE TYPES ============
export interface PresignedUrl {
  ok: boolean
  method: string
  url: string
  bucket: string
  key: string
  expiresIn: number
}

export interface StartAnalyticsJobResponse {
  ok: boolean
  job_id: string
  type: AnalyticsJobType
  status: JobStatus
  message?: string | null
  error?: string | null
}
