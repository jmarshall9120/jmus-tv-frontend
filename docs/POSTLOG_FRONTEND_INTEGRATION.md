type AnalyticsJob @aws_iam @aws_cognito_user_pools {
  PK: String!
  SK: String!
  type: AnalyticsJobType!
  job_id: ID!
  file_id: ID
  userId: String
  status: JobStatus!
  started_at: AWSDateTime!
  completed_at: AWSDateTime
  duration_seconds: Float
  rows_processed: Int
  error_message: String
  glue_job_run_id: String
  input_paths: [String]
  output_paths: [String]
  context: AWSJSON
  _created_at: AWSDateTime!
  _updated_at: AWSDateTime!
  _is_retired: Boolean
}

type FileMetadata {
  PK: String
  SK: String
  type: String
  file_id: ID
  status: String
  created_by: String
  file_name: String
  file_hash: String
  s3_raw_path: String
  s3_parsed_path: String
  s3_cleaned_path: String
  error_message: String
  row_count: Int
  context: AWSJSON
  is_rebase: Boolean
  rebase_period: String
  rebase_start: String
  rebase_end: String
  merged_at: AWSDateTime
  merge_batch_id: String
  merge_claimed_at: AWSDateTime
  _created_at: AWSDateTime
  _updated_at: AWSDateTime
  _is_retired: Boolean
  _row_hash: String
}

type STDMatch {
  PK: String!
  SK: String!
  type: String!
  canonical_name: String
  aliases: [String!]!
  context: AWSJSON
  _created_at: AWSDateTime!
  _updated_at: AWSDateTime!
  _is_retired: Boolean!
}

type Query {
  getAnalyticsJob(SK: String!): AnalyticsJob
  listAnalyticsJobByPK(PK: String!): [AnalyticsJob]
  getFileMetadata(SK: String!): FileMetadata
  listFileMetadataByPK(PK: String!): [FileMetadata]
  getSTDMatch(SK: String!): STDMatch
  listSTDMatchByPK(PK: String!): [STDMatch]
  listSTDMatches(type: String, limit: Int, nextToken: String): STDMatchConnection!
  listFileMetadata(type: FileType, status: FileStatus, created_by: String, limit: Int, nextToken: String): FileMetadataConnection!
  listAnalyticsJobs(type: AnalyticsJobType, file_id: ID, limit: Int, nextToken: String): AnalyticsJobConnection!
  listSalesAttributable(input: SalesAttributableInput): [SalesAttributable!]!
  listSalesNonAttributable(input: SalesNonAttributableInput): [SalesNonAttributable!]!
  getSalesAttributionMetadata: SalesAttributionMetadata!
  getInitialSalesAttributable(input: InitialDataInput): SalesAttributableInitialData!
  getInitialSalesNonAttributable(input: InitialDataInput): SalesNonAttributableInitialData!
}

scalar AWSDateTime

scalar AWSJSON

scalar AWSEmail

scalar AWSURL

scalar AWSPhone

scalar AWSIPAddress

scalar AWSDate

scalar AWSTime

scalar AWSTimestamp

directive @aws_iam on FIELD_DEFINITION | OBJECT

directive @aws_cognito_user_pools on FIELD_DEFINITION | OBJECT

"""
AnalyticsJob API GraphQL Schema
Audit trail for data processing jobs: PARSE, CLEAN, MERGE, BUY_ATTRIBUTION

Status flow: RUNNING → SUCCESS or FAILED
Job types: PARSE, CLEAN, MERGE, BUY_ATTRIBUTION
"""
input AnalyticsJobInput {
  type: AnalyticsJobType!
  job_id: ID!
  file_id: ID
  userId: String
  status: JobStatus!
  started_at: AWSDateTime!
  context: AWSJSON
}

input AnalyticsJobUpdateInput {
  status: JobStatus
  completed_at: AWSDateTime
  duration_seconds: Float
  rows_processed: Int
  error_message: String
  glue_job_run_id: String
  input_paths: [String!]
  output_paths: [String!]
  context: AWSJSON
}

enum AnalyticsJobType {
  PARSE_BUYSHEETS
  PARSE_POSTLOGS
  PARSE_POSTLOGS_2
  CLEAN_DATA
  MERGE_BUYS
  BUY_ATTRIBUTION
}

enum JobStatus {
  RUNNING
  SUCCESS
  FAILED
}

type AnalyticsJobConnection {
  items: [AnalyticsJob!]!
  count: Int!
  nextToken: String
}

type DeleteAnalyticsJobResponse {
  success: Boolean!
  job_id: ID!
}

input StartAnalyticsJobInput {
  jobType: AnalyticsJobType!
  file_sk: String
  file_sks: String
}

type StartAnalyticsJobResponse {
  ok: Boolean!
  job_id: ID!
  type: AnalyticsJobType!
  status: JobStatus!
  message: String
  error: String
}

type Mutation {
  presignUpload(input: PresignUploadInput!): PresignedUrl!
  startAnalyticsJob(input: StartAnalyticsJobInput!): AnalyticsJob!
  createSTDMatch(input: STDMatchInput!): STDMatch!
  updateSTDMatch(SK: String!, input: STDMatchUpdateInput!): STDMatch!
  deleteSTDMatch(SK: String!): DeleteSTDMatchResponse!
  bulkImportSTDMatches(items: [STDMatchInput!]!): BulkImportResponse!
  createFileMetadata(input: FileMetadataInput!): FileMetadata!
  updateFileMetadata(SK: String!, input: FileMetadataUpdateInput!): FileMetadata!
  deleteFileMetadata(SK: String!): DeleteFileMetadataResponse!
  createAnalyticsJob(input: AnalyticsJobInput!): AnalyticsJob!
  updateAnalyticsJob(SK: String!, input: AnalyticsJobUpdateInput!): AnalyticsJob! @aws_iam
  deleteAnalyticsJob(SK: String!): DeleteAnalyticsJobResponse!
}

type Subscription {
  onAnalyticsJobUpdate: AnalyticsJob @aws_subscribe(mutations: ["updateAnalyticsJob"])
}

input PresignUploadInput {
  uploadType: UploadType!
  fileName: String!
  fileSize: Int
  station: String
  metadata: AWSJSON
}

type PresignedUrl {
  ok: Boolean!
  method: String!
  url: AWSURL!
  bucket: String!
  key: String!
  expiresIn: Int!
}

enum UploadType {
  BUYS
  POSTLOGS
  SALES
  TFN_MAPPINGS
}

"""
FileMetadata API GraphQL Schema
Track file uploads through the data pipeline
Status flow: UPLOADED → PARSING → PARSED → CLEANING → CLEANED → MERGING → MERGED

Note: Mutation and Query operations are defined in base.graphql
This file only defines input types, enums, and response types
"""
input FileMetadataInput {
  type: FileType!
  file_id: ID!
  file_name: String!
  file_hash: String!
  s3_raw_path: String!
  created_by: String!
  context: AWSJSON
  is_rebase: Boolean
  rebase_period: String
}

input FileMetadataUpdateInput {
  status: FileStatus
  s3_parsed_path: String
  s3_cleaned_path: String
  error_message: String
  row_count: Int
  context: AWSJSON
}

enum FileType {
  BUY
  POSTLOG
  SALE
  GA
}

enum FileStatus {
  UPLOADED
  PARSING
  PARSED
  PARSING_FAILED
  CLEANING
  CLEANED
  CLEANING_FAILED
  MERGING
  MERGED
  MERGING_FAILED
}

type FileMetadataConnection {
  items: [FileMetadata!]!
  count: Int!
  nextToken: String
}

type DeleteFileMetadataResponse {
  success: Boolean!
  file_id: ID
}

"""
Sales Attribution GraphQL Schema
Query aggregated attributable and detailed non-attributable sales data from Athena
"""
input SalesAttributableInput {
  year: Int
  week_start: AWSDate
  week_end: AWSDate
  station: String
  postlog_id: String
  """
  Total number of records to return. If not set, returns all matching records. Pagination handled automatically.
  """
  limit: Int
  """
  Number of records per page/request (default: 1000, max: 1000). Controls batch size for Athena queries.
  """
  pageSize: Int
}

input SalesNonAttributableInput {
  year: Int
  week_start: AWSDate
  week_end: AWSDate
  station: String
  postlog_id: String
  """
  Total number of records to return. If not set, returns all matching records. Pagination handled automatically.
  """
  limit: Int
  """
  Number of records per page/request (default: 500, max: 1000). Controls batch size for Athena queries. Default is 500 for non-attributable due to large column count (226 fields).
  """
  pageSize: Int
}

input InitialDataInput {
  """Number of records to return (default: 500, max: 1000)"""
  limit: Int
  """Offset for pagination (default: 0)"""
  offset: Int
}

type SalesAttributionMetadata {
  """The most recent week date with available data"""
  latest_week: AWSDateTime!
  """The earliest week date with available data"""
  earliest_week: AWSDateTime!
  """Total number of distinct weeks available"""
  total_weeks: Int!
  """Total number of records in the dataset"""
  total_records: Int!
  """List of all available stations"""
  available_stations: [String!]!
  """Last time the data was updated"""
  last_updated: AWSDateTime!
}

type SalesAttributableInitialData {
  """Last 3 weeks of attributable sales records"""
  records: [SalesAttributable!]!
  """All distinct weeks available in the dataset"""
  available_weeks: [AWSDateTime!]!
  """The most recent week in the data"""
  latest_week: AWSDateTime!
  """Total number of records returned in this page"""
  total_records: Int!
  """Total number of records available in last 3 weeks"""
  total_available: Int!
  """Whether more records are available"""
  has_more: Boolean!
}

type SalesNonAttributableInitialData {
  """Last 3 weeks of non-attributable sales records"""
  records: [SalesNonAttributable!]!
  """All distinct weeks available in the dataset"""
  available_weeks: [AWSDateTime!]!
  """The most recent week in the data"""
  latest_week: AWSDateTime!
  """Total number of records returned in this page"""
  total_records: Int!
  """Total number of records available in last 3 weeks"""
  total_available: Int!
  """Whether more records are available"""
  has_more: Boolean!
}

type SalesAttributableMetadata {
  last_available_week: AWSDateTime
  first_available_week: AWSDateTime
  total_weeks: Int
  total_records: Int
  stations: [String!]
}

type SalesAttributable {
  attribution_id: ID
  week: AWSDateTime!
  year: Int!
  station: String!
  postlog_id: String
  date_time: AWSDateTime
  spots_planned: Int
  rotation_fb: String
  day_planned: String
  time_planned: String
  rate_planned: Float
  length_planned: Float
  spots_actual: Int
  creative_actual: String
  length_actual: Int
  audience_actual: Float
  daypart_actual: String
  day_of_week_actual: String
  cpm_25_54_planned: Float
  cpm_50plus_planned: Float
  cpm_50plus_actual: Float
  cost_fb: Float
  audience_fb: Float
  cost_actual: Float
  sales_records: Int
  commercial: String
  gross_calls: Int
  queued_calls: Int
  written_count: Int
  is_tfn_active: Int
  lift_calls: Float
  lift_queued: Float
  lift_written: Float
  tfn_is_station: Boolean
  tfn_is_station_ct: Int
  grp_25_54_mtl: Float
  grp_25_54_tor: Float
  grp_a35__cal: Float
  grp_a35__edm: Float
  grp_a35__mtl: Float
  grp_a35__nat: Float
  grp_a35__tor: Float
  grp_a35__van: Float
  grp_a50__cal: Float
  grp_a50__edm: Float
  grp_a50__mtl: Float
  grp_a50__nat: Float
  grp_a50__tor: Float
  grp_a50__van: Float
  viewership_25_54: Float
  viewership_a35_: Float
  viewership_a50_: Float
  lift_views: Float
  lift_sessions: Float
  lift_active_users: Float
  lift_goal_demander_un_rappel_merci: Float
  lift_goal_FBLImerci: Float
  lift_goal_fr_soumission_sans_obligation_merci: Float
  lift_goal_communiquez_avec_nous_merci: Float
  lift_goal_soumission_rapide_merci: Float
  lift_goal_en_no_obligation_quote_thank_you: Float
  lift_goal_quick_quote_thank_you: Float
  lift_goal_request_a_callback_thankyou: Float
  lift_goal_call_now_en_fr: Float
  lift_goal_contact_thank_you: Float
  lift_goal_get_a_personalized_quote_submit_form: Float
  lift_goal_ci_no_obligation_quote_thankyou: Float
  lift_goal_FBLIthankyou: Float
  _created_at: AWSDateTime
  _updated_at: AWSDateTime
  _is_retired: Boolean
  _row_hash: String
}

type SalesNonAttributable {
  sales_attribution_id: ID
  attribution_id: String
  postlog_id: String
  buy_id: String
  week: AWSDateTime!
  year: Int
  date_time: AWSDateTime
  air_time_actual: AWSDateTime
  station: String
  day_planned: String
  time_planned: String
  rate_planned: Float
  creative_actual: String
  length_actual: Int
  cost_actual: Float
  audience_actual: Float
  daypart_actual: String
  day_of_week_actual: String
  gross_calls: Int
  queued_calls: Int
  written_count: Int
  lift_calls: Float
  lift_queued: Float
  lift_written: Float
  baseline_calls: Float
  baseline_queued: Float
  baseline_written: Float
  actual_calls: Float
  actual_queued: Float
  actual_written: Float
  lift_sessions: Float
  lift_views: Float
  lift_active_users: Float
  baseline_sessions: Float
  baseline_views: Float
  baseline_active_users: Float
  actual_sessions: Float
  actual_views: Float
  actual_active_users: Float
  true_sessions: Float
  true_views: Float
  true_active_users: Float
  goals: AWSJSON
  tfn_is_station: Boolean
  is_tfn_active: Boolean
  lead_status: String
  policy_number: String
  voice_call_id: String
  _created_at: AWSDateTime
  _updated_at: AWSDateTime
  _is_retired: Boolean
  _row_hash: String
}

type AthenaQueryResponse {
  queryExecutionId: String!
  status: String!
  message: String!
  query: String
}

type SalesAttributableConnection {
  items: [SalesAttributable!]!
  nextToken: String
  queryExecutionId: String
}

type SalesNonAttributableConnection {
  items: [SalesNonAttributable!]!
  nextToken: String
  queryExecutionId: String
}

"""
STDMatch API GraphQL Schema
Canonical name mappings for stations, clients, creatives, and TFNs

Note: Mutation and Query operations are defined in base.graphql
This file only defines input types, enums, and response types
"""
input STDMatchInput {
  type: STDMatchType!
  canonical_name: String!
  aliases: [String!]!
  context: AWSJSON
}

input STDMatchUpdateInput {
  aliases: [String!]
  context: AWSJSON
}

type STDMatchConnection {
  items: [STDMatch!]!
  count: Int!
  nextToken: String
}

type DeleteSTDMatchResponse {
  success: Boolean!
  canonical_name: String
}

type BulkImportResponse {
  success: Boolean!
  imported_count: Int!
  failed_count: Int!
  errors: [String!]
}

enum STDMatchType {
  STATION
  CLIENT
  CREATIVE
  TFN
}

---

## File metadata list query (frontend)

**Use `listFileMetadata`**, not `listFileMetadataByPK`. The latter exists in the schema but has **no resolver** and returns null.

```graphql
query ListFileMetadata($type: FileType, $status: FileStatus, $limit: Int, $nextToken: String) {
  listFileMetadata(type: $type, status: $status, limit: $limit, nextToken: $nextToken) {
    items {
      PK
      SK
      type
      file_id
      status
      created_by
      file_name
      file_hash
      s3_raw_path
      s3_parsed_path
      s3_cleaned_path
      error_message
      row_count
      _created_at
      _updated_at
    }
    count
    nextToken
  }
}
```

Example variables: `{ "type": "POSTLOG", "limit": 100 }` (omit `type` to get all types).

---

## Sample rows for Phase 2 UI (optional)

The Phase 2 setup screen can show a small preview of the parsed data (e.g. first 5 rows). Preferred approach:

### Option A – Embed sample in Phase 1 context (recommended)

When the Phase 1 job writes the FileMetadata `context` (e.g. after PARSE_POSTLOGS completes), add a `sample_data` array to that context:

- **Location:** `context.sample_data` or `context.parse_postlogs.sample_data`
- **Shape:** Array of row objects, e.g. `[{ "Day": "Mon", "Air Date": "2026-01-06", ... }, ...]`
- **DynamoDB limit:** Each item has a **400 KB** limit. The whole `context` (including `phase`, `detected_columns`, `parse_postlogs`, `intermediate_s3_path`, and `sample_data`) is one attribute. To stay safe:
  - **Rows:** Use at most **5 rows** (or 3 if columns are wide).
  - **Columns:** Either include all discovered columns, or a subset (e.g. first 10–15) to keep size down.
  - **Cell size:** Truncate long strings (e.g. max 50–100 chars per cell) so a few wide values don’t blow the item size.
  - **Rough check:** 5 rows × 20 columns × ~50 chars ≈ 5 KB; leave plenty of room for the rest of context.

If the full context approaches the limit, prefer trimming or omitting `sample_data` rather than risking write failure; the UI still works without it.

### Option B – Separate sample API (fallback)

If embedding would push context over the DynamoDB item limit, expose a query that reads from the intermediate S3 path and returns the first N rows, e.g.:

```graphql
query GetPostlogSample($file_sk: String!, $limit: Int) {
  getPostlogSample(file_sk: $file_sk, limit: $limit)
}
```

- **file_sk:** FileMetadata SK (e.g. `POSTLOG#...`).
- **limit:** Max rows to return (default 5).
- **Return:** List of row objects (e.g. `[AWSJSON]` or `[[String]]`). Each row should be keyed by column name so the UI can build the preview table.

Backend implementation: resolve by loading the intermediate file(s) at the path from `getFileMetadata(SK: $file_sk).context.intermediate_s3_path` (or `parse_postlogs.intermediate_s3_path`), read the first `limit` rows (Parquet/CSV), and return them as JSON.

## Troubleshooting

### "Cannot return null for non-nullable type" on startAnalyticsJob

If Phase 1 fails with:

```text
GraphQL startAnalyticsJob failed: Cannot return null for non-nullable type: 'String' within parent 'AnalyticsJob' (/startAnalyticsJob/PK); ... (/startAnalyticsJob/SK); ... (/startAnalyticsJob/job_id); ...
```

the **backend** `startAnalyticsJob` resolver is not returning a full `AnalyticsJob` object. The schema declares `startAnalyticsJob(input: StartAnalyticsJobInput!): AnalyticsJob!`, so the resolver must return an object with at least these non-null fields:

- `PK`, `SK`, `job_id`, `type`, `status`, `started_at`

Fix: in the backend resolver, after creating the analytics job record, **return that full AnalyticsJob** (e.g. the item you write to DynamoDB or the record returned from your job service), not a different shape like `StartAnalyticsJobResponse`. The frontend needs `SK` to poll `getAnalyticsJob(SK)` until the job completes.

### "startAnalyticsJob did not return type/job_id" when starting a second job

The frontend runs Phase 1 in parallel (multiple files can be parsing at once). The backend **must support concurrent `startAnalyticsJob`** calls: each invocation must create and return its own full `AnalyticsJob` (with `PK`, `SK`, `job_id`, `type`, `status`, `started_at`). If the resolver only supports one in-flight request or returns a shared/partial response when a second call happens, the second call will fail. Ensure the resolver is stateless per request and returns the newly created job for that request.

## Real-time job updates (subscription)

The frontend uses the same pattern as bloggenai: **kick off job → subscribe to events → wait for completion** (with polling fallback).

- **Schema:** `onAnalyticsJobUpdate: AnalyticsJob @aws_subscribe(mutations: ["updateAnalyticsJob"])`
- **Backend:** When an analytics job’s status changes, the backend must call **`updateAnalyticsJob(SK, input)`** (e.g. with `status: SUCCESS` or `status: FAILED`, and optionally `error_message`, `completed_at`). AppSync then pushes that update to all active `onAnalyticsJobUpdate` subscribers.
- **Frontend:** A single WebSocket subscription is opened when the first job is started (`stores/analyticsJobs.ts`). Listeners are registered per job SK; when a matching update is received, the corresponding Phase 1 or Phase 2 promise resolves. Polling `getAnalyticsJob(SK)` still runs in parallel as a fallback if the subscription misses an update.

**Verifying the subscription (dev):** In the browser console you should see: `[analyticsJobsStore] Subscription document:` (the exact GraphQL subscription), `[analyticsJobsStore] registerListener: watching for job SK: <SK>` (the job SK we're waiting for), and `[analyticsJobsStore] Subscription message:` for every WebSocket message. If you never see a message with `data.onAnalyticsJobUpdate`, the backend is not calling `updateAnalyticsJob(SK, input)` for that job. In DevTools → Network → WS, inspect the AppSync WebSocket frames for `connection_ack`, `start_ack`, and data payloads.