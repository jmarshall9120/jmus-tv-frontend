import type { FileMetadata } from '~/types/graphql'

export interface PresignedResult {
  ok: boolean
  method: string
  url: string
  bucket: string
  key: string
  expiresIn: number
}

export interface Phase1Context {
  phase?: string
  detected_columns?: Record<string, Record<string, { column?: string }>>
  intermediate_s3_path?: string
  spot_counts?: Record<string, number>
  total_spots?: number
  parse_postlogs?: {
    phase1_job_sk?: string
    intermediate_s3_path?: string
    discovered_columns?: string[]
  }
}

interface PipelineStep {
  name: string
  type: string
  path: string
}

interface PipelineRow {
  name: string
  stateMachineArn: string
  status: string
  steps: PipelineStep[]
}

interface PipelineExecution {
  executionArn: string
  executionName: string
  status: string
  startedAt: string
  stoppedAt?: string | null
  error?: string | null
  pipelineJobSk?: string | null
  stepJobSks?: string | Record<string, string> | null
}

interface JobSchedule {
  name: string
  scheduleExpression: string
  scheduleExpressionTimezone?: string
  state: 'ENABLED' | 'DISABLED'
  targetJobType: string
  targetInput?: Record<string, unknown>
  arn: string
  createdAt: string
  lastModificationDate?: string
}

async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

function nowIso(): string {
  return new Date().toISOString()
}

function makeJob(type: string, status: string = 'SUCCESS') {
  const ts = nowIso()
  return {
    PK: 'ANALYTICS_JOB#stub',
    SK: `JOB#${ts}#${type}`,
    job_id: `job_${Date.now()}`,
    type,
    status,
    started_at: ts,
    completed_at: ts,
    duration_seconds: 42,
    rows_processed: 1234,
    error_message: null,
    context: { stub: true },
  }
}

function makeMetadata(fileSk: string, status: string = 'SUCCESS'): FileMetadata & { context?: Phase1Context } {
  return {
    PK: `FILE#${fileSk}`,
    SK: fileSk,
    type: 'POSTLOG' as FileMetadata['type'],
    file_id: fileSk,
    file_name: 'demo-file.csv',
    file_hash: 'stub-hash',
    s3_raw_path: 's3://jmus-demos/raw/demo-file.csv',
    s3_parsed_path: 's3://jmus-demos/parsed/demo-file.parquet',
    s3_cleaned_path: 's3://jmus-demos/cleaned/demo-file.parquet',
    created_by: 'demo@jmus.io',
    status: status as FileMetadata['status'],
    error_message: null,
    row_count: 1234,
    context: {
      phase: 'completed',
      intermediate_s3_path: 's3://jmus-demos/parsed/demo-file.parquet',
      total_spots: 1234,
      parse_postlogs: {
        phase1_job_sk: `JOB#${nowIso()}#PARSE_POSTLOGS`,
        intermediate_s3_path: 's3://jmus-demos/parsed/demo-file.parquet',
        discovered_columns: ['station', 'date', 'time', 'tfn'],
      },
    },
    _created_at: nowIso(),
    _updated_at: nowIso(),
  } as FileMetadata & { context?: Phase1Context }
}

const DEMO_PIPELINE_STEPS: PipelineStep[] = [
  { name: 'AttributePostlogs', type: 'Task', path: 'AttributePostlogs' },
  { name: 'AttributeParallel', type: 'Parallel', path: 'AttributeParallel' },
  { name: 'SalesNumbers', type: 'Task', path: 'AttributeParallel.SalesNumbers' },
  { name: 'SalesTimeBasis', type: 'Task', path: 'AttributeParallel.SalesTimeBasis' },
  { name: 'Weblogs', type: 'Task', path: 'AttributeParallel.Weblogs' },
  { name: 'BuildMasterDataset', type: 'Task', path: 'BuildMasterDataset' },
  { name: 'PipelineComplete', type: 'Succeed', path: 'PipelineComplete' },
]

function makeDemoStepJobSks(): Record<string, string> {
  return {
    attribute_postlogs: makeJob('ATTRIBUTE_POSTLOGS').SK,
    sales_numbers: makeJob('ATTRIBUTE_SALES_NUMBERS').SK,
    sales_time_basis: makeJob('ATTRIBUTE_SALES_TIME_BASIS').SK,
    weblogs: makeJob('ATTRIBUTE_WEBLOGS').SK,
    build_master_dataset: makeJob('BUILD_MASTER_DATASET').SK,
    pipeline_complete: makeJob('PIPELINE').SK,
  }
}

export function usePostlogPipeline() {
  async function presignUpload(params: {
    fileName: string
    fileSize: number
    uploadType?: 'POSTLOGS' | 'SALES'
  }): Promise<PresignedResult> {
    return {
      ok: true,
      method: 'PUT',
      url: `https://example.invalid/upload/${encodeURIComponent(params.fileName)}`,
      bucket: 'jmus-demo-stub-bucket',
      key: `uploads/${params.fileName}`,
      expiresIn: 3600,
    }
  }

  async function uploadFileToS3(_file: File, _presignedUrl: string): Promise<void> {}

  async function createFileMetadata(input: {
    file_id: string
    file_name: string
    file_hash: string
    s3_raw_path: string
    created_by: string
    context?: Record<string, unknown>
    type?: 'POSTLOG' | 'SALE'
  }): Promise<FileMetadata> {
    return {
      PK: `FILE#${input.file_id}`,
      SK: `METADATA#${nowIso()}`,
      type: (input.type ?? 'POSTLOG') as FileMetadata['type'],
      file_id: input.file_id,
      file_name: input.file_name,
      file_hash: input.file_hash,
      s3_raw_path: input.s3_raw_path,
      created_by: input.created_by,
      status: 'PENDING' as FileMetadata['status'],
      _created_at: nowIso(),
      _updated_at: nowIso(),
    } as FileMetadata
  }

  async function getFileMetadata(sk: string): Promise<FileMetadata & { context?: Phase1Context }> {
    return makeMetadata(sk)
  }

  async function updateFileMetadata(
    sk: string,
    input: { context?: Record<string, unknown>; status?: string; row_count?: number; error_message?: string }
  ): Promise<FileMetadata> {
    const meta = makeMetadata(sk, input.status ?? 'SUCCESS')
    if (input.context) (meta as FileMetadata & { context?: Record<string, unknown> }).context = input.context
    return meta
  }

  async function startAnalyticsJob(params: {
    jobType: string
    file_sk?: string
    file_sks?: string
    header_row?: number
    weeks_back?: number
    start_week?: string
    end_week?: string
  }) {
    const job = makeJob(params.jobType)
    return { SK: job.SK, job_id: job.job_id, type: job.type, status: job.status }
  }

  async function listAnalyticsJobs(options?: { type?: string; limit?: number; nextToken?: string }) {
    const items = [
      makeJob('PARSE_POSTLOGS'),
      makeJob('PARSE_POSTLOGS_2'),
      makeJob('INGEST_SALES'),
    ].filter((x) => (options?.type ? x.type === options.type : true))

    return {
      items: items.slice(0, options?.limit ?? 50),
      count: items.length,
      nextToken: null,
    }
  }

  async function getAnalyticsJob(sk: string) {
    return {
      SK: sk,
      status: 'SUCCESS',
      started_at: nowIso(),
      completed_at: nowIso(),
      duration_seconds: 42,
      rows_processed: 1234,
      error_message: null,
      context: { stub: true },
    }
  }

  async function waitForJobCompletion(
    _jobSk: string,
    options?: { timeoutMs?: number; onProgress?: (status: string) => void; timeout?: number }
  ): Promise<{ status: string; error_message?: string }> {
    options?.onProgress?.('RUNNING')
    options?.onProgress?.('SUCCESS')
    return { status: 'SUCCESS' }
  }

  async function runPhase1(
    fileSk: string,
    onProgress?: (status: string) => void
  ): Promise<FileMetadata & { context?: Phase1Context }> {
    onProgress?.('RUNNING')
    onProgress?.('SUCCESS')
    return makeMetadata(fileSk)
  }

  async function getPostlogSample(_fileSk: string, limit: number = 5): Promise<Record<string, unknown>[]> {
    return [
      { station: 'KSBW-TV', date: '2026-03-16', time: '18:00', tfn: '800-867-5309' },
      { station: 'KNTV', date: '2026-03-17', time: '19:30', tfn: '800-555-1234' },
      { station: 'KTVU', date: '2026-03-18', time: '20:00', tfn: '800-123-4567' },
    ].slice(0, Math.max(1, limit))
  }

  async function runPhase2(
    fileSk: string,
    _existingContext: Record<string, unknown>,
    _matchTable: Array<{ discovered_column: string; standard_field: string }>,
    options?: {
      field_bindings?: Record<string, string>
      media_year?: number
      onProgress?: (status: string) => void
      onJobStarted?: (sk: string) => void
      skipSubscribe?: boolean
    }
  ): Promise<FileMetadata> {
    const job = makeJob('PARSE_POSTLOGS_2')
    options?.onJobStarted?.(job.SK)
    options?.onProgress?.('RUNNING')
    options?.onProgress?.('SUCCESS')
    return makeMetadata(fileSk)
  }

  async function runSalesIngest(
    fileSk: string,
    options?: { onProgress?: (status: string) => void; file_sks?: string[]; weeks_back?: number }
  ): Promise<FileMetadata & { context?: Phase1Context }> {
    options?.onProgress?.('RUNNING')
    options?.onProgress?.('SUCCESS')
    return makeMetadata(fileSk)
  }

  async function listPipelines(options?: {
    limit?: number
    nextToken?: string
    namePrefix?: string
  }): Promise<{ items: PipelineRow[]; nextToken?: string | null }> {
    const all: PipelineRow[] = [
      {
        name: 'demo-postlog-pipeline',
        stateMachineArn: 'arn:aws:states:us-west-2:000000000000:stateMachine:demo-postlog-pipeline',
        status: 'ACTIVE',
        steps: DEMO_PIPELINE_STEPS,
      },
    ]

    const filtered = all.filter((p) => (options?.namePrefix ? p.name.startsWith(options.namePrefix) : true))
    return { items: filtered.slice(0, options?.limit ?? 50), nextToken: null }
  }

  async function runPipelineFor(
    pipelineArn: string,
    _params?: { start_week?: string; end_week?: string }
  ): Promise<{
    ok: boolean
    executionArn?: string | null
    executionName?: string | null
    status?: string | null
    startedAt?: string | null
    stoppedAt?: string | null
    error?: string | null
    pipelineJobSk?: string | null
    stepJobSks?: string | Record<string, string> | null
  }> {
    return {
      ok: true,
      executionArn: `arn:aws:states:us-west-2:000000000000:execution:${pipelineArn.split(':').pop()}:demo-exec`,
      executionName: 'demo-exec',
      status: 'SUCCEEDED',
      startedAt: nowIso(),
      stoppedAt: nowIso(),
      error: null,
      pipelineJobSk: makeJob('PIPELINE').SK,
      stepJobSks: makeDemoStepJobSks(),
    }
  }

  async function runPipeline(params?: { start_week?: string; end_week?: string }) {
    return runPipelineFor('arn:aws:states:us-west-2:000000000000:stateMachine:demo-postlog-pipeline', params)
  }

  async function getPipelineStatus(executionArn: string) {
    return {
      ok: true,
      executionArn,
      executionName: executionArn.split(':').pop() ?? 'demo-exec',
      status: 'SUCCEEDED',
      startedAt: nowIso(),
      stoppedAt: nowIso(),
      error: null,
      pipelineJobSk: makeJob('PIPELINE').SK,
      stepJobSks: makeDemoStepJobSks(),
    }
  }

  async function listPipelineExecutions(options?: { status?: string; limit?: number; nextToken?: string }) {
    const items: PipelineExecution[] = [
      {
        executionArn: 'arn:aws:states:us-west-2:000000000000:execution:demo-postlog-pipeline:demo-exec-1',
        executionName: 'demo-exec-1',
        status: 'SUCCEEDED',
        startedAt: nowIso(),
        stoppedAt: nowIso(),
        error: null,
        pipelineJobSk: makeJob('PIPELINE').SK,
        stepJobSks: makeDemoStepJobSks(),
      },
    ]

    const filtered = items.filter((x) => (options?.status ? x.status === options.status : true))
    return { items: filtered.slice(0, options?.limit ?? 50), nextToken: null }
  }

  async function listPipelineExecutionsByPipeline(
    _pipelineArn: string,
    options?: { status?: string; limit?: number; nextToken?: string }
  ) {
    return listPipelineExecutions(options)
  }

  async function listJobRuns(options?: { type?: string; status?: string; limit?: number; nextToken?: string }) {
    const jobs = [makeJob('PARSE_POSTLOGS'), makeJob('INGEST_SALES')]
      .filter((j) => (options?.type ? j.type === options.type : true))
      .filter((j) => (options?.status ? j.status === options.status : true))

    return {
      items: jobs.slice(0, options?.limit ?? 50),
      count: jobs.length,
      nextToken: null,
    }
  }

  async function listAnalyticsJobSchedules(options?: {
    limit?: number
    nextToken?: string
    namePrefix?: string
  }): Promise<{ items: JobSchedule[]; nextToken?: string | null }> {
    const schedules: JobSchedule[] = [
      {
        name: 'demo-daily-parse',
        scheduleExpression: 'cron(0 12 * * ? *)',
        scheduleExpressionTimezone: 'UTC',
        state: 'ENABLED',
        targetJobType: 'PARSE_POSTLOGS',
        targetInput: { weeks_back: 1 },
        arn: 'arn:aws:scheduler:us-west-2:000000000000:schedule/default/demo-daily-parse',
        createdAt: nowIso(),
        lastModificationDate: nowIso(),
      },
    ]

    const filtered = schedules.filter((s) => (options?.namePrefix ? s.name.startsWith(options.namePrefix) : true))
    return { items: filtered.slice(0, options?.limit ?? 50), nextToken: null }
  }

  async function scheduleAnalyticsJob(input: {
    name: string
    scheduleExpression: string
    scheduleExpressionTimezone?: string
    targetJobType: string
    targetInput?: Record<string, unknown>
  }): Promise<JobSchedule> {
    return {
      name: input.name,
      scheduleExpression: input.scheduleExpression,
      scheduleExpressionTimezone: input.scheduleExpressionTimezone,
      state: 'ENABLED',
      targetJobType: input.targetJobType,
      targetInput: input.targetInput,
      arn: `arn:aws:scheduler:us-west-2:000000000000:schedule/default/${input.name}`,
      createdAt: nowIso(),
      lastModificationDate: nowIso(),
    }
  }

  async function setAnalyticsJobScheduleState(name: string, enabled: boolean) {
    return {
      name,
      state: enabled ? 'ENABLED' : 'DISABLED',
    }
  }

  async function deleteAnalyticsJobSchedule(name: string) {
    return {
      success: true,
      name,
    }
  }

  async function getAwsCosts(_options?: { refresh?: boolean }) {
    return {
      cached_at: nowIso(),
      from_cache: true,
      daily_flat: [
        { date: '2026-03-20', total: 3.21 },
        { date: '2026-03-21', total: 2.98 },
      ],
      daily_by_service: [
        { service: 'AWS Glue', data: [{ date: '2026-03-21', cost: 1.12 }] },
        { service: 'AWS Lambda', data: [{ date: '2026-03-21', cost: 0.44 }] },
      ],
      monthly: [
        {
          month: '2026-03',
          total: 64.55,
          services: [
            { service: 'AWS Glue', cost: 32.11 },
            { service: 'AWS Lambda', cost: 8.55 },
          ],
        },
      ],
      services_last30: [
        { service: 'AWS Glue', cost: 32.11 },
        { service: 'AWS Lambda', cost: 8.55 },
      ],
    }
  }

  return {
    presignUpload,
    uploadFileToS3,
    createFileMetadata,
    getFileMetadata,
    updateFileMetadata,
    startAnalyticsJob,
    listAnalyticsJobs,
    getAnalyticsJob,
    waitForJobCompletion,
    runPhase1,
    runPhase2,
    runSalesIngest,
    getPostlogSample,
    listPipelines,
    runPipelineFor,
    runPipeline,
    getPipelineStatus,
    listPipelineExecutions,
    listPipelineExecutionsByPipeline,
    listJobRuns,
    listAnalyticsJobSchedules,
    scheduleAnalyticsJob,
    setAnalyticsJobScheduleState,
    deleteAnalyticsJobSchedule,
    getAwsCosts,
    sha256Hex,
  }
}
