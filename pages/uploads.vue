<template>
  <v-container fluid class="pa-4">
    <v-row>
      <v-col cols="12">
        <v-card variant="outlined" class="stryker-chart-card">
          <v-card-title class="d-flex align-center flex-wrap gap-2 stryker-chart-title">
            <v-icon start size="small" class="stryker-accent-icon">mdi-upload</v-icon>
            <span>File Uploads</span>
            <v-spacer />
            <v-select
              v-model="selectedClient"
              :items="clientOptions"
              label="Client"
              density="compact"
              hide-details
              style="max-width: 200px"
              class="mr-2"
            />
          </v-card-title>
          <v-card-text>
            <p class="text-caption text-medium-emphasis mb-3">
              Upload raw data files for processing. Supports buysheets, postlogs, and sales data files. Files are validated and parsed before being added to the dataset.
            </p>

            <!-- Upload Section -->
            <v-card variant="outlined" class="mb-4">
              <v-card-title class="text-subtitle-2">Upload Files</v-card-title>
              <v-card-text>
                <v-tabs v-model="fileTypeTab" class="mb-4">
                  <v-tab value="buysheet">Buysheets</v-tab>
                  <v-tab value="postlog">Postlogs</v-tab>
                  <v-tab value="sales">Sales Data</v-tab>
                </v-tabs>

                <v-file-input
                  v-model="selectedFiles"
                  :label="`Select ${fileTypeTab === 'buysheet' ? 'Buysheet' : fileTypeTab === 'postlog' ? 'Postlog' : 'Sales Data'} Files`"
                  multiple
                  accept=".csv,.xlsx,.xls"
                  prepend-icon="mdi-file-document"
                  show-size
                  class="mb-2"
                />

                <v-alert
                  v-if="uploadError"
                  type="error"
                  density="compact"
                  class="mb-2"
                >
                  {{ uploadError }}
                </v-alert>

                <v-btn
                  color="primary"
                  prepend-icon="mdi-upload"
                  :loading="uploading"
                  :disabled="!selectedFiles?.length || !selectedClient"
                  @click="uploadFiles"
                >
                  Upload {{ selectedFiles?.length || 0 }} File(s)
                </v-btn>
              </v-card-text>
            </v-card>

            <!-- Upload History -->
            <v-card variant="outlined">
              <v-card-title class="d-flex align-center">
                <span class="text-subtitle-2">Upload History</span>
                <v-spacer />
                <v-btn
                  icon="mdi-refresh"
                  size="small"
                  variant="text"
                  @click="loadUploadHistory"
                />
              </v-card-title>
              <v-card-text>
                <p v-if="!historyLoading && uploadHistory.length === 0" class="text-body-2 text-medium-emphasis mb-3">
                  No {{ fileTypeTab === 'buysheet' ? 'buysheet' : fileTypeTab === 'postlog' ? 'postlog' : 'sales data' }} upload records for this client.
                </p>
                <v-data-table
                  :headers="historyHeaders"
                  :items="uploadHistory"
                  :loading="historyLoading"
                  item-value="id"
                  density="comfortable"
                  class="dashboard-table"
                >
                  <template #[`item.uploadedAtSort`]="{ item }">
                    {{ item.uploadedAt }}
                  </template>
                  <template #[`item.fileType`]="{ item }">
                    <v-chip size="small" :color="getFileTypeColor(item.fileType)" variant="flat" text-color="black">
                      {{ item.fileType }}
                    </v-chip>
                  </template>
                  <template #[`item.status`]="{ item }">
                    <v-chip
                      size="small"
                      :color="getStatusColor(item.status, item.rawStatus)"
                      variant="flat"
                      text-color="black"
                    >
                      {{ item.rawStatus }}
                    </v-chip>
                  </template>
                  <template #[`item.actions`]="{ item }">
                    <div class="d-flex align-center gap-2">
                      <v-btn
                        v-if="item.fileType === 'postlog' && item.rawStatus !== 'MERGED'"
                        :icon="getFileActionState(item).icon"
                        size="small"
                        variant="text"
                        :color="getFileActionState(item).color"
                        :title="getFileActionState(item).title"
                        :loading="getFileActionState(item).icon === 'mdi-refresh'"
                        @click="handlePostlogAction(item)"
                      />
                      <v-btn
                        v-else-if="item.rawStatus === 'MERGED'"
                        icon="mdi-check-circle"
                        size="small"
                        variant="text"
                        color="success"
                        title="View mapping (merged)"
                        @click="openProcessDialog(item, true)"
                      />
                      <v-btn
                        v-else-if="item.fileType === 'sales'"
                        :icon="getFileActionState(item).icon"
                        size="small"
                        variant="text"
                        :color="getFileActionState(item).color"
                        :title="getFileActionState(item).title"
                        :loading="getFileActionState(item).icon === 'mdi-refresh'"
                        @click="handleSalesAction(item)"
                      />
                      <v-btn
                        v-else-if="(item.status === 'pending' || item.status === 'completed') && item.fileType !== 'postlog'"
                        icon="mdi-play"
                        size="small"
                        variant="text"
                        color="primary"
                        title="Process file"
                        @click="openProcessDialog(item)"
                      />
                      <v-btn
                        v-if="item.status === 'processing'"
                        icon="mdi-refresh"
                        size="small"
                        variant="text"
                        title="Check status"
                        @click="checkStatus(item)"
                      />
                      <v-btn
                        v-if="item.status === 'failed' && item.error"
                        icon="mdi-alert-circle"
                        size="small"
                        variant="text"
                        color="error"
                        title="View error"
                        @click="showError(item)"
                      />
                      <span v-if="getFileActionState(item).showTimer" class="text-caption text-medium-emphasis">
                        {{ formatElapsedTime(getFileActionState(item).timerSeconds) }}
                      </span>
                    </div>
                  </template>
                </v-data-table>
              </v-card-text>
            </v-card>
          </v-card-text>
        </v-card>

        <!-- Analytics Glue processes section -->
        <v-card variant="outlined" class="stryker-chart-card mt-6">
          <v-card-title class="d-flex align-center flex-wrap gap-2 stryker-chart-title">
            <v-icon start size="small" class="stryker-accent-icon">mdi-cog-play</v-icon>
            <span>Run analytics (Glue)</span>
          </v-card-title>
          <v-card-text>
            <p class="text-caption text-medium-emphasis mb-3">
              Start backend Glue/analytics jobs that are not tied to a single file (e.g. clean data, merge buys, pull GA, attribution). File-based jobs (parse postlogs, ingest sales) are triggered from the upload history above.
            </p>
            <v-alert type="info" density="compact" class="mb-4">
              Run and scheduling UI will be wired to <code>startAnalyticsJob</code> and job monitoring. File-based jobs (PARSE_POSTLOGS, PARSE_POSTLOGS_2, INGEST_SALES, PARSE_BUYSHEETS) are started from the upload history above.
            </v-alert>
            <v-list density="comfortable" class="bg-transparent">
              <v-list-item
                v-for="job in analyticsJobTypes"
                :key="job.value"
                class="px-0"
              >
                <template #prepend>
                  <v-icon size="small" class="mr-2">mdi-play-circle-outline</v-icon>
                </template>
                <v-list-item-title class="text-body-2">{{ job.title }}</v-list-item-title>
                <v-list-item-subtitle class="text-caption">{{ job.description }}</v-list-item-subtitle>
                <template #append>
                  <div class="d-flex align-center gap-1">
                    <span v-if="getAnalyticsRunActionState(job).showTimer" class="text-caption text-medium-emphasis mr-1">
                      {{ formatElapsedTime(getAnalyticsRunActionState(job).timerSeconds) }}
                    </span>
                    <v-btn
                      :icon="getAnalyticsRunActionState(job).icon"
                      size="small"
                      variant="text"
                      :color="getAnalyticsRunActionState(job).color"
                      :title="getAnalyticsRunActionState(job).title"
                      :loading="getAnalyticsRunActionState(job).icon === 'mdi-refresh'"
                      @click="handleAnalyticsRunAction(job)"
                    />
                    <v-icon
                      v-if="!getAnalyticsRunActionState(job).showTimer && analyticsRunStateByType[job.value]?.status === 'SUCCESS'"
                      size="small"
                      color="success"
                      class="ml-1"
                      title="Last run succeeded"
                    >
                      mdi-check-circle
                    </v-icon>
                    <v-icon
                      v-else-if="!getAnalyticsRunActionState(job).showTimer && analyticsRunStateByType[job.value]?.status === 'FAILED'"
                      size="small"
                      color="error"
                      class="ml-1"
                      title="Last run failed"
                    >
                      mdi-alert-circle
                    </v-icon>
                  </div>
                </template>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Run analytics job dialog: params, current run, history -->
    <v-dialog v-model="analyticsRunDialogOpen" max-width="640" persistent>
      <v-card v-if="analyticsRunJob">
        <v-card-title class="d-flex align-center">
          <v-icon start>mdi-cog-play</v-icon>
          Run: {{ analyticsRunJob.title }}
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" size="small" @click="closeAnalyticsRunDialog" />
        </v-card-title>
        <v-card-text>
          <p class="text-caption text-medium-emphasis mb-3">{{ analyticsRunJob.description }}</p>
          <!-- Params form -->
          <v-row dense class="mb-4">
            <v-col v-if="analyticsJobParamConfig[analyticsRunJob.value]?.weeks_back" cols="12" sm="4">
              <v-text-field
                v-model.number="analyticsRunParams.weeks_back"
                type="number"
                label="Weeks back"
                density="compact"
                hide-details
                min="1"
              />
              <p v-if="analyticsRunParams.weeks_back" class="text-caption text-medium-emphasis mt-1 mb-0">
                Targeting {{ analyticsRunParams.weeks_back }} week{{ analyticsRunParams.weeks_back !== 1 ? 's' : '' }}
              </p>
            </v-col>
            <v-col v-if="analyticsJobParamConfig[analyticsRunJob.value]?.start_week" cols="12" sm="4">
              <v-select
                v-model="analyticsRunParams.start_week"
                :items="weekOptions"
                item-title="title"
                item-value="value"
                label="Start week"
                density="compact"
                hide-details
                clearable
              />
            </v-col>
            <v-col v-if="analyticsJobParamConfig[analyticsRunJob.value]?.end_week" cols="12" sm="4">
              <v-select
                v-model="analyticsRunParams.end_week"
                :items="weekOptions"
                item-title="title"
                item-value="value"
                label="End week"
                density="compact"
                hide-details
                clearable
              />
            </v-col>
            <v-col v-if="analyticsRunTargetedWeeks != null" cols="12" class="pt-0">
              <p class="text-caption text-medium-emphasis mb-0">
                Targeting {{ analyticsRunTargetedWeeks }} week{{ analyticsRunTargetedWeeks !== 1 ? 's' : '' }}
              </p>
            </v-col>
            <v-col v-if="analyticsJobParamConfig[analyticsRunJob.value]?.header_row" cols="12" sm="4">
              <v-text-field
                v-model.number="analyticsRunParams.header_row"
                type="number"
                label="Header row"
                density="compact"
                hide-details
                min="0"
              />
            </v-col>
          </v-row>
          <v-btn
            color="primary"
            prepend-icon="mdi-play"
            :loading="analyticsRunLoading"
            :disabled="analyticsRunLoading || (analyticsRunStateByType[analyticsRunJob.value]?.status === 'RUNNING')"
            @click="startAnalyticsRun"
          >
            Start job
          </v-btn>

          <!-- Current run (from per-job-type state so it stays in sync when dialog is reopened) -->
          <v-alert v-if="analyticsRunStateByType[analyticsRunJob.value]" :type="(analyticsRunStateByType[analyticsRunJob.value]?.status === 'FAILED') ? 'error' : (analyticsRunStateByType[analyticsRunJob.value]?.status === 'SUCCESS') ? 'success' : 'info'" density="compact" class="mt-4">
            <div class="d-flex align-center flex-wrap gap-2">
              <span>Status: {{ analyticsRunStateByType[analyticsRunJob.value]?.status }}</span>
              <span v-if="analyticsRunStateByType[analyticsRunJob.value]?.status === 'RUNNING'" class="text-caption">
                {{ formatElapsedTime(analyticsRunStateByType[analyticsRunJob.value]?.elapsedSeconds ?? 0) }}
              </span>
            </div>
            <div v-if="analyticsRunStateByType[analyticsRunJob.value]?.error_message" class="text-caption mt-1">{{ analyticsRunStateByType[analyticsRunJob.value]?.error_message }}</div>
          </v-alert>

          <!-- History -->
          <div class="mt-4">
            <div class="d-flex align-center mb-2">
              <span class="text-subtitle-2">Run history</span>
              <v-btn icon="mdi-refresh" size="x-small" variant="text" :loading="analyticsRunHistoryLoading" @click="loadAnalyticsRunHistory" />
            </div>
            <v-data-table
              :headers="[
                { title: 'Job ID', key: 'job_id', width: '120px' },
                { title: 'Status', key: 'status', width: '90px' },
                { title: 'Started', key: 'started_at', width: '140px' },
                { title: 'Duration', key: 'duration_seconds' },
              ]"
              :items="analyticsRunHistory"
              :loading="analyticsRunHistoryLoading"
              item-value="SK"
              density="compact"
              class="elevation-0"
            >
              <template #[`item.started_at`]="{ item }">
                {{ item.started_at ? formatAnalyticsJobDate(item.started_at) : '—' }}
              </template>
              <template #[`item.duration_seconds`]="{ item }">
                {{ item.duration_seconds != null ? `${item.duration_seconds}s` : (item.status === 'RUNNING' ? '…' : '—') }}
              </template>
              <template #[`item.status`]="{ item }">
                <v-chip :color="item.status === 'SUCCESS' ? 'success' : item.status === 'FAILED' ? 'error' : 'warning'" size="small" variant="flat">
                  {{ item.status }}
                </v-chip>
              </template>
            </v-data-table>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- Error Dialog -->
    <v-dialog v-model="errorDialogOpen" max-width="600">
      <v-card>
        <v-card-title>{{ errorItem && (errorItem.fileType === 'postlog' || errorItem.fileType === 'sales') && getFileState(errorItem.id).errorMessage ? 'Processing Error' : 'Upload Error' }}</v-card-title>
        <v-card-text>
          <pre class="text-body-2">{{ errorDetails }}</pre>
          <p class="text-caption text-medium-emphasis mt-3 mb-0">
            If the error was due to a bug or system fix, you can try again. If the error is in the file (e.g. invalid data), fix the file and re-upload.
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            v-if="errorItem"
            color="primary"
            variant="tonal"
            @click="tryAgainAfterError"
          >
            Try Again
          </v-btn>
          <v-btn variant="text" @click="closeErrorDialog">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Processing Dialog -->
    <v-dialog v-model="processDialogOpen" max-width="1200" scrollable>
      <v-card v-if="processingFile">
        <v-card-title class="d-flex align-center">
          <v-icon start>{{ processDialogViewOnly ? 'mdi-check-circle' : 'mdi-cog' }}</v-icon>
          <span>{{ processDialogTitle }}</span>
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" size="small" @click="closeProcessDialog" />
        </v-card-title>
        <v-card-text>
          <!-- BUYSHEET and SALES workflow -->
          <div v-if="processingFile.fileType === 'buysheet' || processingFile.fileType === 'sales'">
            <!-- Sales view-only: completed ingest summary from context.ingest_sales -->
            <template v-if="processingFile.fileType === 'sales' && processDialogViewOnly">
              <v-alert type="success" density="compact" class="mb-4">
                Sales file has been ingested.
              </v-alert>
              <v-card v-if="salesIngestSummary" variant="outlined">
                <v-card-title class="text-subtitle-2">Ingest summary</v-card-title>
                <v-card-text>
                  <div class="text-body-2">
                    <div><strong>Rows written:</strong> {{ salesIngestSummary.rows_written != null ? salesIngestSummary.rows_written.toLocaleString() : '—' }}</div>
                    <div v-if="salesIngestSummary.min_date || salesIngestSummary.max_date">
                      <strong>Date range:</strong> {{ salesIngestSummary.min_date || '—' }} to {{ salesIngestSummary.max_date || '—' }}
                    </div>
                  </div>
                </v-card-text>
              </v-card>
            </template>

            <template v-else-if="processingFile.fileType === 'sales' || processingFile.fileType === 'buysheet'">
              <v-alert v-if="!parsingResult && (!phase1Status || processingFile.fileType === 'buysheet')" type="info" class="mb-4">
                Click "Parse File" to analyze the uploaded file.
              </v-alert>
              <!-- Sales: show Phase 1 status and timer while ingesting (same pattern as postlog) -->
              <v-alert v-if="processingFile.fileType === 'sales' && !parsingResult && phase1Status" :type="phase1Status === 'FAILED' ? 'error' : phase1Status === 'SUCCESS' ? 'success' : 'info'" density="compact" class="mb-4">
                <div class="d-flex align-center">
                  <span>Ingesting: {{ phase1Status }}</span>
                  <v-spacer />
                  <span v-if="phase1Status === 'RUNNING' && phase1ElapsedSeconds > 0" class="text-caption">
                    {{ formatElapsedTime(phase1ElapsedSeconds) }}
                  </span>
                </div>
              </v-alert>

              <div v-if="parsingResult">
                <!-- Parsing Results -->
                <v-card variant="outlined" class="mb-4">
                  <v-card-title class="text-subtitle-2">Parsing Results</v-card-title>
                  <v-card-text>
                    <v-row>
                      <v-col cols="12" md="6">
                        <div class="text-body-2 mb-2"><strong>Total Rows:</strong> {{ parsingResult.row_count != null ? parsingResult.row_count.toLocaleString() : '???' }}</div>
                        <div v-if="parsingResult.metrics" class="text-body-2">
                          <div v-if="parsingResult.file_type === 'BUY'">
                            <div><strong>Total Spots:</strong> {{ parsingResult.metrics.total_spots?.toLocaleString() }}</div>
                            <div><strong>Total Cost:</strong> ${{ parsingResult.metrics.total_cost?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</div>
                            <div><strong>Stations:</strong> {{ parsingResult.metrics.stations?.join(', ') }}</div>
                            <div><strong>Date Range:</strong> {{ parsingResult.metrics.date_range?.start }} to {{ parsingResult.metrics.date_range?.end }}</div>
                          </div>
                          <div v-else-if="parsingResult.file_type === 'SALE'">
                            <div><strong>Total Sales:</strong> {{ parsingResult.metrics.total_sales?.toLocaleString() }}</div>
                            <div><strong>Total Revenue:</strong> ${{ parsingResult.metrics.total_revenue?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</div>
                            <div><strong>Attribution IDs:</strong> {{ parsingResult.metrics.attribution_ids }}</div>
                            <div><strong>Date Range:</strong> {{ parsingResult.metrics.date_range?.start }} to {{ parsingResult.metrics.date_range?.end }}</div>
                          </div>
                        </div>
                      </v-col>
                    </v-row>

                    <!-- Sample Data Table -->
                    <v-data-table
                      v-if="parsingResult.sample_data"
                      :headers="getSampleDataHeaders()"
                      :items="parsingResult.sample_data"
                      density="compact"
                      class="mt-4"
                    />
                  </v-card-text>
                </v-card>

                <!-- Upload to Model: only for buysheet, not for sales -->
                <div v-if="processingFile.fileType === 'buysheet'" class="d-flex justify-end">
                  <v-btn
                    color="primary"
                    prepend-icon="mdi-upload"
                    :loading="uploadingToModel"
                    @click="uploadToModel"
                  >
                    Upload to Model
                  </v-btn>
                </div>
              </div>

              <div v-else class="d-flex justify-end">
                <v-btn
                  color="primary"
                  prepend-icon="mdi-file-document-outline"
                  :loading="parsing"
                  @click="parseFile"
                >
                  Parse File
                </v-btn>
              </div>
            </template>
          </div>

          <!-- POSTLOG workflow -->
          <div v-if="processingFile.fileType === 'postlog'">
            <v-alert v-if="!parsingResult && !processDialogViewOnly" type="info" class="mb-4">
              Click "Parse File" to run Phase 1 (parse) and detect columns, then map fields and run Phase 2 (upload).
            </v-alert>
            <v-alert v-if="processDialogViewOnly && parsingResult" type="success" density="compact" class="mb-4">
              View-only: this file has been merged. Mapping and sample are shown below.
            </v-alert>
            <v-alert v-if="!parsingResult && phase1Status && !processDialogViewOnly" :type="phase1Status === 'FAILED' ? 'error' : phase1Status === 'SUCCESS' ? 'success' : 'info'" density="compact" class="mb-4">
              <div class="d-flex align-center">
                <span>Phase 1: {{ phase1Status }}</span>
                <v-spacer />
                <span v-if="phase1Status === 'RUNNING' && phase1ElapsedSeconds > 0" class="text-caption">
                  {{ formatElapsedTime(phase1ElapsedSeconds) }}
                </span>
              </div>
            </v-alert>

            <div v-if="parsingResult">
              <!-- Parsing Results -->
              <v-card variant="outlined" class="mb-4">
                <v-card-title class="text-subtitle-2">Parsing Results</v-card-title>
                <v-card-text>
                  <div class="text-body-2 mb-4">
                    <strong>Total Rows:</strong> {{ parsingResult.row_count != null ? parsingResult.row_count.toLocaleString() : '???' }}
                  </div>
                  <div class="text-body-2 mb-4">
                    <strong>Detected Headers:</strong> {{ parsingResult.parsed_headers?.join(', ') }}
                  </div>

                  <!-- Phase 2 running status + timer -->
                  <v-alert v-if="uploadingToModel && phase2Status" :type="phase2Status === 'FAILED' ? 'error' : 'info'" density="compact" class="mb-4">
                    <div class="d-flex align-center">
                      <span>Phase 2 (upload to model): {{ phase2Status }}</span>
                      <v-spacer />
                      <span v-if="phase2Status === 'RUNNING' && phase2ElapsedSeconds > 0" class="text-caption">
                        {{ formatElapsedTime(phase2ElapsedSeconds) }}
                      </span>
                    </div>
                  </v-alert>

                  <!-- Field Mapping -->
                  <v-card variant="outlined" class="mb-4">
                    <v-card-title class="text-subtitle-2">Field Mapping</v-card-title>
                    <v-card-text>
                      <p class="text-caption text-medium-emphasis mb-3">
                        Map the detected file headers to our standard fields. Required fields are marked with <span class="text-error">*</span>.
                      </p>
                      <v-table density="compact">
                        <thead>
                          <tr>
                            <th>Standard Field</th>
                            <th>Required</th>
                            <th>Mapped File Header</th>
                            <th>Station Selection</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="field in standardFields" :key="field.name">
                            <td>
                              <strong>{{ field.label }}</strong>
                              <span v-if="field.required" class="text-error">*</span>
                            </td>
                            <td>
                              <v-chip v-if="field.required" size="x-small" color="error" variant="flat" text-color="white">Required</v-chip>
                              <span v-else class="text-medium-emphasis">Optional</span>
                            </td>
                            <td>
                              <template v-if="field.fixedMapping">
                                <span class="text-medium-emphasis">{{ field.fixedMapping }}</span>
                                <div class="text-caption text-medium-emphasis">(set by parser)</div>
                              </template>
                              <v-select
                                v-else
                                v-model="fieldMapping[field.name]"
                                :items="parsingResult.parsed_headers || []"
                                density="compact"
                                hide-details
                                placeholder="Select header..."
                                clearable
                                :error="field.required && (field.name === 'station' ? !(fieldMapping[field.name] || stationSelection) : !fieldMapping[field.name])"
                                :disabled="uploadingToModel || processDialogViewOnly"
                              />
                            </td>
                            <td>
                              <v-select
                                v-if="field.name === 'station' && !fieldMapping[field.name]"
                                v-model="stationSelection"
                                :items="stationOptions"
                                density="compact"
                                hide-details
                                placeholder="Select station..."
                                clearable
                                :error="field.required && !stationSelection"
                                :disabled="uploadingToModel || processDialogViewOnly"
                              />
                            </td>
                          </tr>
                        </tbody>
                      </v-table>
                    </v-card-text>
                  </v-card>

                  <!-- Sample Data Preview -->
                  <v-card variant="outlined">
                    <v-card-title class="text-subtitle-2">Sample Data Preview</v-card-title>
                    <v-card-text>
                      <v-data-table
                        v-if="parsingResult.sample_data"
                        :headers="getPostlogSampleHeaders()"
                        :items="parsingResult.sample_data"
                        density="compact"
                      />
                    </v-card-text>
                  </v-card>
                </v-card-text>
              </v-card>

              <!-- Upload to Model Button (hidden in view-only) -->
              <div v-if="!processDialogViewOnly" class="d-flex justify-end">
                <v-btn
                  color="primary"
                  prepend-icon="mdi-upload"
                  :loading="uploadingToModel"
                  :disabled="!canSubmitPostlog || uploadingToModel"
                  @click="uploadToModel"
                >
                  Upload to Model
                </v-btn>
              </div>
            </div>

            <div v-else-if="!processDialogViewOnly" class="d-flex justify-end">
              <v-btn
                color="primary"
                prepend-icon="mdi-file-document-outline"
                :loading="parsing"
                @click="parseFile"
              >
                Parse File
              </v-btn>
            </div>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
// Auth is handled by auth.global.ts middleware
import type { FileMetadata } from '~/types/graphql'
import { useUploadHistory } from '~/composables/useUploadHistory'
import { useMatchTables } from '~/composables/useMatchTables'

interface UploadRecord {
  id: string
  fileName: string
  fileType: string
  clientId: string
  /** Display category for chip color: pending | processing | completed | failed */
  status: string
  /** Raw API status for display: UPLOADED, PARSING, MERGED, etc. */
  rawStatus: string
  /** Formatted for display (e.g. "2/13/26, 9:23 AM") */
  uploadedAt: string
  /** ISO string for correct date sort (table sorts by this) */
  uploadedAtSort: string
  processedAt?: string
  error?: string
  recordCount?: number
}

const { listFileMetadata } = useUploadHistory()
const { report: notifyError } = useErrorNotify()
const { listStationMappings } = useMatchTables()
const {
  presignUpload,
  uploadFileToS3,
  createFileMetadata,
  getFileMetadata,
  getPostlogSample,
  getAnalyticsJob,
  runPhase1,
  runPhase2,
  runSalesIngest,
  startAnalyticsJob,
  waitForJobCompletion,
  listAnalyticsJobs,
  sha256Hex,
} = usePostlogPipeline()
const { getUserEmail } = useAuth()

const fileTypeTab = ref<'buysheet' | 'postlog' | 'sales'>('buysheet')
const selectedFiles = ref<File[]>([])
const selectedClient = ref<string | null>(null)
const uploading = ref(false)
const uploadError = ref<string | null>(null)
const allUploadHistory = ref<UploadRecord[]>([])
const historyLoading = ref(false)
const errorDialogOpen = ref(false)
const errorDetails = ref('')
const errorItem = ref<UploadRecord | null>(null)

// Processing dialog state
const processDialogOpen = ref(false)
const processDialogViewOnly = ref(false)
const processingFile = ref<UploadRecord | null>(null)
const processDialogTitle = computed(() => {
  const file = processingFile.value
  if (!file) return ''
  const name = file.fileName || 'File'
  if (processDialogViewOnly.value) {
    if (file.fileType === 'sales') return `Sales file (ingested): ${name}`
    return `View mapping (merged): ${name}`
  }
  return `Process File: ${name}`
})
/** Set when opening a completed sales file; shows ingest_sales from context (rows_written, min_date, max_date). */
const salesIngestSummary = ref<{ rows_written?: number; min_date?: string; max_date?: string } | null>(null)
const parsing = ref(false)
const parsingResult = ref<any>(null)
const uploadingToModel = ref(false)
const fieldMapping = ref<Record<string, string>>({})
const stationSelection = ref<string | null>(null)
const stationOptions = ref<{ title: string; value: string }[]>([])

// Per-file processing state for parallel processing
interface FileProcessingState {
  phase1Status: string | null // 'RUNNING' | 'SUCCESS' | 'FAILED' | null
  phase1ElapsedSeconds: number
  phase2Status: string | null // 'RUNNING' | 'SUCCESS' | 'FAILED' | null
  phase2ElapsedSeconds: number
  phase2JobSk: string | null // SK of the most recent PARSE_POSTLOGS_2 job
  fieldMapping: Record<string, string>
  stationSelection: string | null
  parsingResult: any | null
  needsInput: boolean // Phase 1 complete, needs Phase 2 mapping
  errorMessage: string | null // When phase1 or phase2 failed
}
const fileProcessingStates = ref<Map<string, FileProcessingState>>(new Map())

// Analytics job types for "Run analytics" section (non–file-based; file-based PARSE_*/INGEST_SALES are triggered from upload history)
// Matches schema AnalyticsJobType enum (deprecated CLEAN_DATA, MERGE_BUYS, BUY_ATTRIBUTION removed)
const analyticsJobTypes = [
  { value: 'PULL_GA', title: 'Pull GA', description: 'Pull Google Analytics data' },
  { value: 'ATTRIBUTE_POSTLOGS', title: 'Attribute postlogs', description: 'Attribution for postlogs' },
  { value: 'ATTRIBUTE_SALES_NUMBERS', title: 'Attribute sales (numbers)', description: 'Attribution by numbers' },
  { value: 'ATTRIBUTE_SALES_TIME_BASIS_2', title: 'Attribute sales (time basis 2)', description: 'Time-based attribution' },
  { value: 'ATTRIBUTE_WEBLOGS_STATION_FEATURES', title: 'Attribute weblogs station features', description: 'Weblog station features' },
  { value: 'BUILD_MASTER_DATASET', title: 'Build master dataset', description: 'Build the master dataset from all sources' },
]

/** Which optional StartAnalyticsJobInput params to show per job type (schema: weeks_back, start_week, end_week, header_row). */
const analyticsJobParamConfig: Record<string, { weeks_back?: boolean; start_week?: boolean; end_week?: boolean; header_row?: boolean }> = {
  PULL_GA: { weeks_back: true, start_week: true, end_week: true },
  ATTRIBUTE_POSTLOGS: { start_week: true, end_week: true },
  ATTRIBUTE_SALES_NUMBERS: { start_week: true, end_week: true },
  ATTRIBUTE_SALES_TIME_BASIS_2: { start_week: true, end_week: true },
  ATTRIBUTE_WEBLOGS_STATION_FEATURES: { start_week: true, end_week: true },
  BUILD_MASTER_DATASET: { start_week: true, end_week: true },
}

/** Mondays going backwards from the most recent, for week dropdowns (YYYY-MM-DD). */
const WEEK_OPTIONS_COUNT = 104
function getWeekOptions (): { title: string; value: string }[] {
  const options: { title: string; value: string }[] = []
  const d = new Date()
  const day = d.getDay()
  const daysSinceMonday = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - daysSinceMonday)
  d.setHours(0, 0, 0, 0)
  for (let i = 0; i < WEEK_OPTIONS_COUNT; i++) {
    const value = d.toISOString().slice(0, 10)
    const yyyy = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const title = `${yyyy}/${m}/${dd}`
    options.push({ title, value })
    d.setDate(d.getDate() - 7)
  }
  return options
}
const weekOptions = computed(() => getWeekOptions())

/** Number of weeks targeted from start_week/end_week (inclusive), or null if invalid. */
function getTargetedWeeksCount (startWeek: string, endWeek: string): number | null {
  if (!startWeek || !endWeek) return null
  const start = new Date(startWeek)
  const end = new Date(endWeek)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null
  const days = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
  return Math.floor(days / 7) + 1
}

const analyticsRunTargetedWeeks = computed(() => getTargetedWeeksCount(analyticsRunParams.value.start_week, analyticsRunParams.value.end_week))

// Run analytics dialog state
const analyticsRunDialogOpen = ref(false)
const analyticsRunJob = ref<{ value: string; title: string; description: string } | null>(null)
const analyticsRunParams = ref({ weeks_back: 4, start_week: '', end_week: '', header_row: 1 })
const analyticsRunCurrent = ref<{ sk: string; status: string; started_at: string; error_message?: string; elapsedSeconds?: number } | null>(null)
const analyticsRunHistory = ref<Array<{ SK: string; job_id: string; type: string; status: string; started_at: string; completed_at?: string | null; duration_seconds?: number | null; rows_processed?: number | null; error_message?: string | null }>>([])
const analyticsRunLoading = ref(false)
const analyticsRunHistoryLoading = ref(false)

/** Per-job-type run state (persists when dialog is closed; used for table play/spinner/timer/error) */
const analyticsRunStateByType = ref<Record<string, { status: string; started_at: string; elapsedSeconds: number; error_message?: string }>>({})
let analyticsRunTimerId: ReturnType<typeof setInterval> | null = null

function ensureAnalyticsRunTimer () {
  if (analyticsRunTimerId != null) return
  analyticsRunTimerId = setInterval(() => {
    const state = analyticsRunStateByType.value
    let hasRunning = false
    const next: Record<string, { status: string; started_at: string; elapsedSeconds: number; error_message?: string }> = {}
    for (const [k, s] of Object.entries(state)) {
      if (s.status === 'RUNNING') {
        hasRunning = true
        next[k] = { ...s, elapsedSeconds: Math.floor((Date.now() - new Date(s.started_at).getTime()) / 1000) }
      } else {
        next[k] = s
      }
    }
    analyticsRunStateByType.value = next
    if (!hasRunning && analyticsRunTimerId != null) {
      clearInterval(analyticsRunTimerId)
      analyticsRunTimerId = null
    }
  }, 1000)
}

function getAnalyticsRunActionState (job: { value: string; title: string; description: string }): { icon: string; color: string; title: string; showTimer: boolean; timerSeconds: number } {
  const s = analyticsRunStateByType.value[job.value]
  if (s?.status === 'RUNNING') {
    return { icon: 'mdi-refresh', color: 'primary', title: 'Running...', showTimer: true, timerSeconds: s.elapsedSeconds }
  }
  if (s?.status === 'FAILED') {
    return { icon: 'mdi-play', color: 'primary', title: 'Last run failed – click to retry', showTimer: false, timerSeconds: 0 }
  }
  return { icon: 'mdi-play', color: 'primary', title: 'Run job', showTimer: false, timerSeconds: 0 }
}

function handleAnalyticsRunAction (job: { value: string; title: string; description: string }) {
  const s = analyticsRunStateByType.value[job.value]
  if (s?.status === 'RUNNING') return
  if (s?.status === 'FAILED') {
    openAnalyticsRunDialog(job)
    return
  }
  openAnalyticsRunDialog(job)
}

// Standard fields for POSTLOG mapping (fixedMapping = parser-set column, not user-editable)
const standardFields = [
  { name: 'station', label: 'Station', required: true },
  { name: 'date', label: 'Date', required: true },
  { name: 'air_time', label: 'Air Time', required: true, fixedMapping: 'air_time' as const },
  { name: 'campaign', label: 'Campaign', required: false },
  { name: 'rotation', label: 'Rotation', required: false },
  { name: 'program', label: 'Program', required: false },
  { name: 'length', label: 'Length', required: false },
  { name: 'type', label: 'Type', required: false },
  { name: 'creative', label: 'Creative', required: false },
  { name: 'cost', label: 'Cost', required: false },
  { name: 'audience', label: 'Audience', required: false },
  { name: 'rating', label: 'Rating', required: false }
]

// Filter upload history by selected tab, then sort by Uploaded (newest first) then File Name (A–Z ascending)
const uploadHistory = computed(() => {
  const tabToFileType: Record<string, string> = {
    buysheet: 'buysheet',
    postlog: 'postlog',
    sales: 'sales'
  }
  const selectedType = tabToFileType[fileTypeTab.value]
  const filtered = allUploadHistory.value.filter(item => item.fileType === selectedType)
  return [...filtered].sort((a, b) => {
    const dateA = a.uploadedAtSort || ''
    const dateB = b.uploadedAtSort || ''
    if (dateB !== dateA) return dateB.localeCompare(dateA) // desc: newest first
    return (a.fileName || '').localeCompare(b.fileName || '', undefined, { sensitivity: 'base' }) // asc: A–Z
  })
})

const historyHeaders = [
  { title: 'File Name', key: 'fileName', sortable: true },
  { title: 'Type', key: 'fileType', sortable: true },
  { title: 'Status', key: 'status', sortable: true },
  { title: 'Uploaded', key: 'uploadedAtSort', sortable: true },
  { title: 'Records', key: 'recordCount', sortable: true, align: 'end' as const },
  { title: 'Actions', key: 'actions', sortable: false, width: '120px' }
]

const clientOptions = ref<{ title: string; value: string }[]>([])

function fileMetadataToRecord (item: FileMetadata): UploadRecord {
  const typeMap: Record<string, string> = {
    BUY: 'buysheet',
    POSTLOG: 'postlog',
    SALE: 'sales',
    GA: 'ga',
  }
  const rawStatus = (item.status ?? 'UPLOADED').toUpperCase()
  const isProcessing = ['PARSING', 'CLEANING', 'MERGING'].includes(rawStatus)
  const isFailed = rawStatus.endsWith('_FAILED')
  const status = isProcessing ? 'processing' : isFailed ? 'failed' : rawStatus === 'UPLOADED' ? 'pending' : 'completed'
  const createdAt = item._created_at ? formatUploadDate(item._created_at) : '—'
  const createdAtSort = item._created_at ?? ''
  return {
    id: item.SK ?? item.file_id ?? '',
    fileName: item.file_name ?? '—',
    fileType: typeMap[item.type ?? ''] ?? (item.type ?? '—').toLowerCase(),
    clientId: item.created_by ?? '',
    status,
    rawStatus,
    uploadedAt: createdAt,
    uploadedAtSort: createdAtSort,
    error: item.error_message ?? undefined,
    recordCount: item.row_count ?? undefined,
  }
}

function formatUploadDate (iso: string): string {
  try {
    const d = new Date(iso)
    return Number.isFinite(d.getTime()) ? d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : iso
  } catch {
    return iso
  }
}

async function loadClients () {
  try {
    // Stub client data for development/testing
    // TODO: Replace with actual API when client list is available
    clientOptions.value = [
      { title: 'JMUS Demo Client', value: 'jmus-demo' },
      { title: 'Client A', value: 'client-a' },
      { title: 'Client B', value: 'client-b' },
      { title: 'Client C', value: 'client-c' }
    ]
    // Set default selection
    if (!selectedClient.value && clientOptions.value.length > 0) {
      const firstClient = clientOptions.value[0]
      if (firstClient) {
        selectedClient.value = firstClient.value
      }
    }
  } catch (error) {
    console.error('Failed to load clients:', error)
  }
}

async function loadUploadHistory () {
  historyLoading.value = true
  try {
    const useStubData = false
    let items: FileMetadata[] = []
    if (useStubData) {
      const response = await fetch('/stub-file-metadata.json')
      if (!response.ok) {
        throw new Error(`Failed to load stub data: ${response.statusText}`)
      }
      items = await response.json()
    } else {
      const result = await listFileMetadata({ limit: 100 })
      items = result.items
    }
    allUploadHistory.value = items.map(fileMetadataToRecord)
    // So postlogs with DISCOVERY_COMPLETE show orange "!" (needs input) after refresh
    syncFileProcessingStateFromHistory(allUploadHistory.value)
  } catch (error) {
    if (import.meta.dev) {
      console.error('[uploads] loadUploadHistory failed:', error)
    }
    notifyError(error, 'Load upload history')
  } finally {
    historyLoading.value = false
  }
}

async function uploadFiles () {
  if (!selectedFiles.value?.length || !selectedClient.value) return
  const tab = fileTypeTab.value
  if (tab !== 'postlog' && tab !== 'sales') {
    uploadError.value = 'Upload is supported for Postlogs and Sales Data. Select the Postlogs or Sales Data tab and try again.'
    return
  }
  uploading.value = true
  uploadError.value = null
  try {
    const createdBy = getUserEmail() || selectedClient.value || 'unknown'
    const batchTimestamp = new Date().toISOString()
    const uploadType = tab === 'sales' ? 'SALES' as const : 'POSTLOGS' as const
    const fileType = tab === 'sales' ? 'SALE' as const : 'POSTLOG' as const
    for (const file of selectedFiles.value) {
      const presigned = await presignUpload({ fileName: file.name, fileSize: file.size, uploadType })
      await uploadFileToS3(file, presigned.url)
      const fileHash = await sha256Hex(file)
      const fileId = crypto.randomUUID()
      const s3RawPath = `s3://${presigned.bucket}/${presigned.key}`
      const created = await createFileMetadata({
        file_id: fileId,
        file_name: file.name,
        file_hash: fileHash,
        s3_raw_path: s3RawPath,
        created_by: createdBy,
        type: fileType,
      })
      const record = fileMetadataToRecord({ ...created, created_by: createdBy, _created_at: batchTimestamp } as FileMetadata)
      allUploadHistory.value = [record, ...allUploadHistory.value]
    }
    selectedFiles.value = []
  } catch (error) {
    uploadError.value = error instanceof Error ? error.message : 'Upload failed'
    notifyError(error, 'Upload file')
  } finally {
    uploading.value = false
  }
}

function getFileTypeColor (type: string) {
  const colors: Record<string, string> = {
    buysheet: 'primary',
    postlog: 'secondary',
    sales: 'success'
  }
  return colors[type] || 'default'
}

function getStatusColor (status: string, rawStatus?: string) {
  if (rawStatus?.toUpperCase() === 'MERGED') return 'success'
  const colors: Record<string, string> = {
    pending: 'warning',
    processing: 'info',
    completed: 'info',
    failed: 'error'
  }
  return colors[status] || 'default'
}

function checkStatus (item: UploadRecord) {
  // TODO: Poll for status update
  loadUploadHistory()
}

// Per-file state helpers
function getFileState (fileId: string): FileProcessingState {
  if (!fileProcessingStates.value.has(fileId)) {
    fileProcessingStates.value.set(fileId, {
      phase1Status: null,
      phase1ElapsedSeconds: 0,
      phase2Status: null,
      phase2ElapsedSeconds: 0,
      phase2JobSk: null,
      fieldMapping: {},
      stationSelection: null,
      parsingResult: null,
      needsInput: false,
      errorMessage: null
    })
  }
  return fileProcessingStates.value.get(fileId)!
}

/** After loading history, set needsInput from backend status so DISCOVERY_COMPLETE shows orange "!" after refresh. */
function syncFileProcessingStateFromHistory (records: UploadRecord[]) {
  for (const item of records) {
    if (item.fileType === 'postlog' && item.rawStatus !== 'MERGED') {
      const needsInput = item.rawStatus?.toUpperCase() === 'DISCOVERY_COMPLETE' || item.rawStatus?.toUpperCase() === 'PARSED'
      if (needsInput) {
        const state = getFileState(item.id)
        state.needsInput = true
      }
      continue
    }
    if (item.fileType === 'sales') {
      const raw = item.rawStatus?.toUpperCase() ?? ''
      if (raw === 'PARSED' || raw === 'MERGED' || (raw !== 'UPLOADED' && raw !== 'PARSING' && raw !== 'PARSING_FAILED')) {
        const state = getFileState(item.id)
        state.phase1Status = 'SUCCESS'
      }
    }
  }
}

function getFileActionState (item: UploadRecord): { icon: string; color: string; title: string; showTimer: boolean; timerSeconds: number } {
  if (item.rawStatus === 'MERGED') {
    return { icon: 'mdi-check-circle', color: 'success', title: 'View mapping (merged)', showTimer: false, timerSeconds: 0 }
  }
  if (item.fileType === 'sales') {
    const state = getFileState(item.id)
    if (state.phase1Status === 'RUNNING') {
      return { icon: 'mdi-refresh', color: 'primary', title: 'Ingesting sales data...', showTimer: true, timerSeconds: state.phase1ElapsedSeconds }
    }
    if (state.phase1Status === 'SUCCESS') {
      return { icon: 'mdi-check-circle', color: 'success', title: 'View results', showTimer: false, timerSeconds: 0 }
    }
    if (state.phase1Status === 'FAILED') {
      return { icon: 'mdi-alert-circle', color: 'error', title: 'Ingest failed', showTimer: false, timerSeconds: 0 }
    }
    return { icon: 'mdi-play', color: 'primary', title: 'Start ingest', showTimer: false, timerSeconds: 0 }
  }
  const state = getFileState(item.id)
  if (state.phase2Status === 'RUNNING') {
    return { icon: 'mdi-refresh', color: 'primary', title: 'Uploading to model...', showTimer: true, timerSeconds: state.phase2ElapsedSeconds }
  }
  if (state.phase2Status === 'SUCCESS') {
    return { icon: 'mdi-check-circle', color: 'success', title: 'Merged', showTimer: false, timerSeconds: 0 }
  }
  if (state.needsInput) {
    return { icon: 'mdi-alert-circle', color: 'warning', title: 'Needs field mapping', showTimer: false, timerSeconds: 0 }
  }
  if (state.phase1Status === 'RUNNING') {
    return { icon: 'mdi-refresh', color: 'primary', title: 'Parsing...', showTimer: true, timerSeconds: state.phase1ElapsedSeconds }
  }
  if (state.phase1Status === 'FAILED' || state.phase2Status === 'FAILED') {
    return { icon: 'mdi-alert-circle', color: 'error', title: 'Processing failed', showTimer: false, timerSeconds: 0 }
  }
  // Default: ready to start
  return { icon: 'mdi-play', color: 'primary', title: 'Start processing', showTimer: false, timerSeconds: 0 }
}

async function handlePostlogAction (item: UploadRecord) {
  const state = getFileState(item.id)
  if (state.needsInput) {
    // Open Phase 2 dialog for mapping
    openPhase2Dialog(item)
  } else if (state.phase1Status === 'FAILED' || state.phase2Status === 'FAILED') {
    // Show error popup
    showProcessingError(item)
  } else if (!state.phase1Status) {
    // Start Phase 1
    await startPhase1Parse(item)
  }
  // If running, do nothing (button is disabled/loading)
}

function handleSalesAction (item: UploadRecord) {
  const state = getFileState(item.id)
  if (state.phase1Status === 'RUNNING') return
  if (state.phase1Status === 'FAILED') {
    showProcessingError(item)
    return
  }
  if (state.phase1Status === 'SUCCESS') {
    openProcessDialog(item)
    return
  }
  // Ready to start: run ingest in background (no dialog)
  startSalesIngest(item)
}

async function startSalesIngest (item: UploadRecord) {
  const state = getFileState(item.id)
  state.phase1Status = 'RUNNING'
  state.phase1ElapsedSeconds = 0
  const startTime = Date.now()
  const timerInterval = setInterval(() => {
    state.phase1ElapsedSeconds = Math.floor((Date.now() - startTime) / 1000)
  }, 1000)
  try {
    const meta = await runSalesIngest(item.id, { onProgress: (status: string) => { state.phase1Status = status } })
    clearInterval(timerInterval)
    state.phase1Status = 'SUCCESS'
    const ctx = (meta.context && typeof meta.context === 'object' && !Array.isArray(meta.context))
      ? meta.context as Record<string, unknown>
      : {}
    state.parsingResult = {
      file_id: item.id,
      file_name: item.fileName,
      file_type: 'SALE',
      status: 'PARSED',
      row_count: meta.row_count ?? undefined,
      metrics: (ctx.metrics && typeof ctx.metrics === 'object') ? ctx.metrics as Record<string, unknown> : {},
      sample_data: Array.isArray(ctx.sample_data) ? ctx.sample_data : [],
    }
    if (!processDialogOpen.value || processingFile.value?.id !== item.id) {
      await loadUploadHistory()
    }
  } catch (error) {
    clearInterval(timerInterval)
    state.phase1Status = 'FAILED'
    state.errorMessage = error instanceof Error ? error.message : String(error)
    notifyError(error, 'Sales ingest')
  }
}

async function startPhase1Parse (item: UploadRecord) {
  const state = getFileState(item.id)
  state.phase1Status = 'RUNNING'
  state.phase1ElapsedSeconds = 0
  const startTime = Date.now()
  
  // Timer interval
  const timerInterval = setInterval(() => {
    state.phase1ElapsedSeconds = Math.floor((Date.now() - startTime) / 1000)
  }, 1000)
  
  try {
    const meta = await runPhase1(item.id, (status: string) => {
      state.phase1Status = status
    })
    clearInterval(timerInterval)
    state.phase1Status = 'SUCCESS'
    
    const ctx = parseFileMetadataContext(meta.context)
    if (ctx) {
      // Apply context to state
      applyPhase1ContextToState(item.id, ctx, meta)
      await fetchSampleIfNeededForState(item.id, ctx)
    } else {
      state.parsingResult = {
        file_id: item.id,
        file_name: item.fileName,
        file_type: 'POSTLOG',
        status: 'PARSED',
        row_count: meta.row_count ?? undefined,
        parsed_headers: [],
        sample_data: [],
      }
    }
    // Phase 1 complete - needs input
    state.needsInput = true
    if (!processDialogOpen.value || processingFile.value?.id === item.id) {
      await loadUploadHistory()
    }
  } catch (error) {
    clearInterval(timerInterval)
    state.phase1Status = 'FAILED'
    state.errorMessage = error instanceof Error ? error.message : String(error)
    notifyError(error, 'Phase 1 parse')
  }
}

async function showProcessingError (item: UploadRecord) {
  const state = getFileState(item.id)
  errorDetails.value = state.errorMessage || 'Processing failed.'
  errorItem.value = item
  errorDialogOpen.value = true

  // Fetch richer context from the AnalyticsJob when a Phase 2 job SK is known
  if (state.phase2JobSk) {
    try {
      const job = await getAnalyticsJob(state.phase2JobSk)
      if (job?.context && errorDialogOpen.value) {
        const ctx = typeof job.context === 'string' ? JSON.parse(job.context) : job.context
        errorDetails.value = (state.errorMessage || 'Processing failed.') +
          '\n\nJob context:\n' + JSON.stringify(ctx, null, 2)
      }
    } catch {
      // context enrichment failed — keep original error message
    }
  }
}

function showError (item: UploadRecord) {
  errorDetails.value = item.error || 'Unknown error'
  errorItem.value = item
  errorDialogOpen.value = true
}

function closeErrorDialog () {
  errorDialogOpen.value = false
  errorDetails.value = ''
  errorItem.value = null
}

function tryAgainAfterError () {
  const item = errorItem.value
  closeErrorDialog()
  if (!item) return
  const state = getFileState(item.id)
  if (item.fileType === 'postlog' && (state.phase1Status === 'FAILED' || state.phase2Status === 'FAILED')) {
    state.errorMessage = null
    startPhase1Parse(item)
  } else {
    if (item.fileType === 'sales') state.errorMessage = null
    openProcessDialog(item)
  }
}

// Phase 1 job status for postlog (e.g. "RUNNING", "SUCCESS")
const phase1Status = ref<string | null>(null)
const phase1ElapsedSeconds = ref<number>(0)
// Phase 2 (upload to model) status and timer
const phase2Status = ref<string | null>(null)
const phase2ElapsedSeconds = ref<number>(0)

/**
 * Parse context from getFileMetadata. Backend may return:
 * - Double JSON-encoded string: "\"{'key': 'value'}\"" (inner is Python repr with single quotes)
 * - Single JSON string: "{\"key\": \"value\"}"
 * - Already an object
 */
function parseFileMetadataContext (context: string | Record<string, unknown> | null | undefined): Record<string, unknown> | undefined {
  if (context == null) return undefined
  if (typeof context !== 'string') return context as Record<string, unknown>
  let raw: unknown
  try {
    raw = JSON.parse(context)
  } catch {
    return undefined
  }
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
  if (typeof raw !== 'string') return undefined
  // Inner may be wrapped in double quotes: "\"{'key': 'val'}\""
  let inner = raw.trim()
  if (inner.length >= 2 && inner.startsWith('"') && inner.endsWith('"')) {
    inner = inner.slice(1, -1)
  }
  // Try parsing as JSON (double-encoded valid JSON)
  try {
    const parsed = JSON.parse(inner) as unknown
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
  } catch {
    // not valid JSON
  }
  // Python repr: single-quoted dict e.g. {'phase': 'X', 'detected_columns': ['A', 'B']}
  const trimmed = inner.trim()
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return undefined
  try {
    let asJson = trimmed
      .replace(/\\'/g, '\u0001')
      .replace(/'/g, '"')
      .replace(/\u0001/g, '\\"')
    asJson = asJson.replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false').replace(/\bNone\b/g, 'null')
    return JSON.parse(asJson) as Record<string, unknown>
  } catch {
    return undefined
  }
}

// Processing functions
async function openProcessDialog (item: UploadRecord, viewOnly = false) {
  processingFile.value = item
  parsingResult.value = null
  salesIngestSummary.value = null
  fieldMapping.value = {}
  stationSelection.value = null
  phase1Status.value = null
  phase1ElapsedSeconds.value = 0
  phase2Status.value = null
  phase2ElapsedSeconds.value = 0
  processDialogViewOnly.value = viewOnly
  processDialogOpen.value = true

  if (item.fileType === 'postlog') {
    loadStationOptions()
    try {
      const meta = await getFileMetadata(item.id)
      const ctx = parseFileMetadataContext(meta.context)
      const fileStatus = meta.status?.toUpperCase() ?? ''
      const itemRawStatus = item.rawStatus?.toUpperCase() ?? ''
      // Phase 1 is complete if: context has phase=DISCOVERY_COMPLETE, or has parse_postlogs, or status indicates parsing is done
      const hasParsePostlogs = ctx?.parse_postlogs && typeof ctx.parse_postlogs === 'object'
      const phase1Complete = !!ctx && (
        ctx.phase === 'DISCOVERY_COMPLETE' ||
        hasParsePostlogs ||
        fileStatus === 'PARSED' ||
        itemRawStatus === 'PARSED' ||
        (itemRawStatus !== 'UPLOADED' && itemRawStatus !== 'PARSING' && itemRawStatus !== 'PARSING_FAILED')
      )
      if (import.meta.dev) {
        console.log('[openProcessDialog] Postlog file:', {
          itemRawStatus,
          fileStatus,
          hasContext: !!ctx,
          phase: ctx?.phase,
          hasParsePostlogs: !!ctx?.parse_postlogs,
          phase1Complete
        })
      }
      if (phase1Complete && ctx) {
        applyPhase1Context(ctx, meta)
        await fetchSampleIfNeeded(item.id, ctx)
      }
    } catch (error) {
      if (import.meta.dev) {
        console.log('[openProcessDialog] Failed to load file metadata:', error)
      }
      // Not found or no context yet
    }
  }
  if (item.fileType === 'sales') {
    // Sync dialog refs from per-file state so RUNNING/FAILED and timer show correctly
    const salesState = getFileState(item.id)
    phase1Status.value = salesState.phase1Status
    phase1ElapsedSeconds.value = salesState.phase1ElapsedSeconds
    try {
      const meta = await getFileMetadata(item.id)
      const ctx = parseFileMetadataContext(meta.context) as Record<string, unknown> | undefined
      const ingestSales = ctx?.ingest_sales && typeof ctx.ingest_sales === 'object' ? ctx.ingest_sales as Record<string, unknown> : null
      const isCompleted = ingestSales || (meta.status && ['CLEANED', 'PARSED', 'MERGED'].includes(String(meta.status).toUpperCase()))
      if (isCompleted && ingestSales) {
        processDialogViewOnly.value = true
        salesIngestSummary.value = {
          rows_written: typeof ingestSales.rows_written === 'number' ? ingestSales.rows_written : undefined,
          min_date: typeof ingestSales.min_date === 'string' ? ingestSales.min_date : undefined,
          max_date: typeof ingestSales.max_date === 'string' ? ingestSales.max_date : undefined,
        }
      } else if (meta.row_count != null || (ctx && (ctx.metrics || ctx.sample_data))) {
        parsingResult.value = {
          file_id: item.id,
          file_name: item.fileName,
          file_type: 'SALE',
          status: meta.status ?? 'PARSED',
          row_count: meta.row_count ?? undefined,
          metrics: (ctx?.metrics && typeof ctx.metrics === 'object') ? ctx.metrics as Record<string, unknown> : {},
          sample_data: Array.isArray(ctx?.sample_data) ? ctx.sample_data : [],
        }
      }
    } catch {
      // Not found or no context yet
    }
  }
}

/** When the dialog is showing this file and it has just merged, switch to disabled merge view. Only switches if dialog is still for the given fileId. */
async function switchDialogToMergedView (fileId: string) {
  if (!processingFile.value || processingFile.value.fileType !== 'postlog') return
  if (processingFile.value.id !== fileId) return
  try {
    const meta = await getFileMetadata(processingFile.value.id)
    const ctx = parseFileMetadataContext(meta.context)
    if (ctx) {
      applyPhase1Context(ctx, meta)
      await fetchSampleIfNeeded(processingFile.value.id, ctx)
    }
    processDialogViewOnly.value = true
  } catch (error) {
    if (import.meta.dev) {
      console.log('[switchDialogToMergedView] Failed to load file metadata:', error)
    }
  }
}

/** If context has an intermediate path but no sample_data, fetch first 5 rows via getPostlogSample (when backend supports it). */
async function fetchSampleIfNeeded (fileSk: string, ctx: Record<string, unknown>) {
  const hasPath = !!(ctx.intermediate_s3_path || (ctx.parse_postlogs as Record<string, unknown>)?.intermediate_s3_path)
  const hasSample = (parsingResult.value?.sample_data?.length ?? 0) > 0
  if (!hasPath || hasSample) return
  const sample = await getPostlogSample(fileSk, 5)
  if (sample.length > 0 && parsingResult.value) {
    parsingResult.value = { ...parsingResult.value, sample_data: sample }
  }
}

/** Apply Phase 1 context to per-file state (for parallel processing). */
function applyPhase1ContextToState (fileId: string, ctx: Record<string, unknown>, meta?: { row_count?: number | null }) {
  const state = getFileState(fileId)
  // Reuse existing applyPhase1Context logic but store in state
  const parsedHeaders: string[] = []
  const mapping: Record<string, string> = {}
  
  let detected = ctx.detected_columns
  if (typeof detected === 'string') {
    try {
      detected = JSON.parse(detected) as unknown
    } catch {
      detected = undefined
    }
  }
  
  if (Array.isArray(detected)) {
    detected.forEach((col: unknown) => {
      if (typeof col === 'string') parsedHeaders.push(col)
    })
  } else if (detected && typeof detected === 'object' && !Array.isArray(detected)) {
    const detectedObj = detected as Record<string, Record<string, { column?: string }>>
    for (const fileKey of Object.keys(detectedObj)) {
      const fields = detectedObj[fileKey]
      if (fields && typeof fields === 'object') {
        for (const [standardField, info] of Object.entries(fields)) {
          const col = info?.column
          if (col && !parsedHeaders.includes(col)) parsedHeaders.push(col)
          if (col) mapping[standardField] = col
        }
      }
    }
  }
  
  const parsePostlogs = ctx.parse_postlogs as Record<string, unknown> | undefined
  const discoveredList = parsePostlogs?.discovered_columns as string[] | undefined
  if (discoveredList?.length && parsedHeaders.length === 0) {
    discoveredList.forEach((c: string) => parsedHeaders.push(c))
  }
  
  // Apply field_bindings and match_table
  const fieldBindings = (ctx.field_bindings ?? (ctx.user as Record<string, unknown>)?.field_bindings) as Record<string, string> | undefined
  if (fieldBindings && typeof fieldBindings === 'object') {
    for (const [backendKey, header] of Object.entries(fieldBindings)) {
      if (header && typeof header === 'string') {
        const ourKey = BACKEND_TO_STANDARD_FIELD[backendKey] ?? backendKey
        mapping[ourKey] = header
        if (parsedHeaders.length && !parsedHeaders.includes(header)) parsedHeaders.push(header)
      }
    }
  }
  const matchTable = (ctx.user as Record<string, unknown>)?.match_table as Array<{ discovered_column?: string; standard_field?: string }> | undefined
  if (Array.isArray(matchTable)) {
    for (const row of matchTable) {
      const discovered = row.discovered_column
      const standard = row.standard_field
      if (discovered && standard) {
        const ourKey = BACKEND_TO_STANDARD_FIELD[standard] ?? standard
        mapping[ourKey] = discovered
        if (parsedHeaders.length && !parsedHeaders.includes(discovered)) parsedHeaders.push(discovered)
      }
    }
  }
  
  if (parsedHeaders.length === 0 && Object.keys(mapping).length > 0) {
    const fromMapping = [...new Set(Object.values(mapping))]
    fromMapping.forEach((h: string) => parsedHeaders.push(h))
  }
  
  if (parsedHeaders.includes('air_time')) {
    mapping.air_time = 'air_time'
  }
  
  // Sample data
  let rawSample = ctx.sample ?? parsePostlogs?.sample_data ?? parsePostlogs?.sample_rows ?? ctx.sample_rows ?? ctx.sample_data
  if (typeof rawSample === 'string') {
    try {
      rawSample = JSON.parse(rawSample) as unknown
    } catch {
      rawSample = undefined
    }
  }
  let sampleData: Record<string, unknown>[] = []
  if (Array.isArray(rawSample)) {
    const first = rawSample[0]
    if (Array.isArray(first)) {
      const headers = parsedHeaders.length > 0 ? parsedHeaders : (ctx.detected_columns as string[]) || []
      sampleData = (rawSample as unknown[][]).map((row) => {
        const obj: Record<string, unknown> = {}
        headers.forEach((col, i) => {
          obj[col] = row[i]
        })
        return obj
      })
    } else if (first !== null && typeof first === 'object') {
      sampleData = rawSample as Record<string, unknown>[]
    }
  }
  
  const rowCount = meta?.row_count != null ? meta.row_count : (ctx.total_spots as number | undefined)
  
  state.fieldMapping = mapping
  state.parsingResult = {
    file_id: fileId,
    file_name: allUploadHistory.value.find(r => r.id === fileId)?.fileName ?? '',
    file_type: 'POSTLOG',
    status: 'PARSED',
    row_count: rowCount ?? undefined,
    parsed_headers: parsedHeaders.length ? parsedHeaders : undefined,
    sample_data: sampleData,
    phase1Context: ctx,
  }
}

async function fetchSampleIfNeededForState (fileId: string, ctx: Record<string, unknown>) {
  const state = getFileState(fileId)
  const hasPath = !!(ctx.intermediate_s3_path || (ctx.parse_postlogs as Record<string, unknown>)?.intermediate_s3_path)
  const hasSample = (state.parsingResult?.sample_data?.length ?? 0) > 0
  if (!hasPath || hasSample) return
  const sample = await getPostlogSample(fileId, 5)
  if (sample.length > 0 && state.parsingResult) {
    state.parsingResult = { ...state.parsingResult, sample_data: sample }
  }
}

async function openPhase2Dialog (item: UploadRecord) {
  const state = getFileState(item.id)
  if (!state.parsingResult) {
    try {
      const meta = await getFileMetadata(item.id)
      const ctx = parseFileMetadataContext(meta.context)
      if (ctx) {
        applyPhase1ContextToState(item.id, ctx, meta)
        await fetchSampleIfNeededForState(item.id, ctx)
      }
    } catch (error) {
      if (import.meta.dev) {
        console.log('[openPhase2Dialog] Failed to load file metadata:', error)
      }
    }
  }
  const currentState = getFileState(item.id)
  processingFile.value = item
  parsingResult.value = currentState.parsingResult
  fieldMapping.value = { ...currentState.fieldMapping }
  stationSelection.value = currentState.stationSelection
  phase1Status.value = currentState.phase1Status
  phase1ElapsedSeconds.value = currentState.phase1ElapsedSeconds
  phase2Status.value = currentState.phase2Status
  phase2ElapsedSeconds.value = currentState.phase2ElapsedSeconds
  uploadingToModel.value = currentState.phase2Status === 'RUNNING'
  processDialogViewOnly.value = false
  processDialogOpen.value = true
  loadStationOptions()
}

function applyPhase1Context (ctx: Record<string, unknown>, meta?: { row_count?: number | null }) {
  if (import.meta.dev) {
    console.log('[applyPhase1Context] Context keys:', Object.keys(ctx))
  }
  let detected = ctx.detected_columns
  if (typeof detected === 'string') {
    try {
      detected = JSON.parse(detected) as unknown
    } catch {
      detected = undefined
    }
  }
  const parsedHeaders: string[] = []
  const mapping: Record<string, string> = {}

  // Backend can return detected_columns as array of column names (e.g. ["Day", "Air Date", "Spot Ref", ...])
  if (Array.isArray(detected)) {
    detected.forEach((col: unknown) => {
      if (typeof col === 'string') parsedHeaders.push(col)
    })
  } else if (detected && typeof detected === 'object' && !Array.isArray(detected)) {
    // Legacy shape: { "<file>": { "standard_field": { "column": "..." } } }
    const detectedObj = detected as Record<string, Record<string, { column?: string }>>
    for (const fileKey of Object.keys(detectedObj)) {
      const fields = detectedObj[fileKey]
      if (fields && typeof fields === 'object') {
        for (const [standardField, info] of Object.entries(fields)) {
          const col = info?.column
          if (col && !parsedHeaders.includes(col)) parsedHeaders.push(col)
          if (col) mapping[standardField] = col
        }
      }
    }
  }
  const parsePostlogs = ctx.parse_postlogs as Record<string, unknown> | undefined
  const discoveredList = parsePostlogs?.discovered_columns as string[] | undefined
  if (discoveredList?.length && parsedHeaders.length === 0) {
    discoveredList.forEach((c: string) => parsedHeaders.push(c))
  }

  // MERGED / Phase 2 complete: apply field_bindings and user.match_table so view-only shows bound fields
  const fieldBindings = (ctx.field_bindings ?? (ctx.user as Record<string, unknown>)?.field_bindings) as Record<string, string> | undefined
  if (fieldBindings && typeof fieldBindings === 'object') {
    for (const [backendKey, header] of Object.entries(fieldBindings)) {
      if (header && typeof header === 'string') {
        const ourKey = BACKEND_TO_STANDARD_FIELD[backendKey] ?? backendKey
        mapping[ourKey] = header
        if (parsedHeaders.length && !parsedHeaders.includes(header)) parsedHeaders.push(header)
      }
    }
  }
  const matchTable = (ctx.user as Record<string, unknown>)?.match_table as Array<{ discovered_column?: string; standard_field?: string }> | undefined
  if (Array.isArray(matchTable)) {
    for (const row of matchTable) {
      const discovered = row.discovered_column
      const standard = row.standard_field
      if (discovered && standard) {
        const ourKey = BACKEND_TO_STANDARD_FIELD[standard] ?? standard
        mapping[ourKey] = discovered
        if (parsedHeaders.length && !parsedHeaders.includes(discovered)) parsedHeaders.push(discovered)
      }
    }
  }

  // If we still have no headers but have mapping, derive headers from mapping values (for display/sample)
  if (parsedHeaders.length === 0 && Object.keys(mapping).length > 0) {
    const fromMapping = [...new Set(Object.values(mapping))]
    fromMapping.forEach((h: string) => parsedHeaders.push(h))
  }

  // Parser always renames detected datetime column to air_time — fix mapping (user cannot change)
  if (parsedHeaders.includes('air_time')) {
    mapping.air_time = 'air_time'
  }

  // Sample: backend may send context.sample as array-of-arrays (rows × cells) or sample_data as array-of-objects
  let rawSample = ctx.sample ?? parsePostlogs?.sample_data ?? parsePostlogs?.sample_rows ?? ctx.sample_rows ?? ctx.sample_data
  if (typeof rawSample === 'string') {
    try {
      rawSample = JSON.parse(rawSample) as unknown
    } catch {
      rawSample = undefined
    }
  }
  let sampleData: Record<string, unknown>[] = []
  if (Array.isArray(rawSample)) {
    const first = rawSample[0]
    if (Array.isArray(first)) {
      // context.sample = [[val, val, ...], ...] — convert to [{ col1: val, col2: val, ... }, ...] using parsedHeaders
      const headers = parsedHeaders.length > 0 ? parsedHeaders : (ctx.detected_columns as string[]) || []
      sampleData = (rawSample as unknown[][]).map((row) => {
        const obj: Record<string, unknown> = {}
        headers.forEach((col, i) => {
          obj[col] = row[i]
        })
        return obj
      })
    } else if (first !== null && typeof first === 'object') {
      // Already array of objects
      sampleData = rawSample as Record<string, unknown>[]
    }
  }

  // row_count from getFileMetadata response (meta.row_count) or context.total_spots
  const rowCount = meta?.row_count != null ? meta.row_count : (ctx.total_spots as number | undefined)

  fieldMapping.value = mapping
  parsingResult.value = {
    file_id: processingFile.value?.id,
    file_name: processingFile.value?.fileName,
    file_type: 'POSTLOG',
    status: 'PARSED',
    row_count: rowCount ?? undefined,
    parsed_headers: parsedHeaders.length ? parsedHeaders : undefined,
    sample_data: sampleData,
    phase1Context: ctx,
  }
}

function closeProcessDialog () {
  if (processingFile.value && !processDialogViewOnly.value) {
    // Save state back to per-file state
    const state = getFileState(processingFile.value.id)
    state.fieldMapping = { ...fieldMapping.value }
    state.stationSelection = stationSelection.value
    state.parsingResult = parsingResult.value
    // If Phase 2 was started in dialog, continue it in background
    if (phase2Status.value === 'RUNNING' && !state.phase2Status) {
      state.phase2Status = 'RUNNING'
      state.phase2ElapsedSeconds = phase2ElapsedSeconds.value
      // Continue Phase 2 in background
      continuePhase2Upload(processingFile.value.id)
    }
  }
  processDialogOpen.value = false
  processDialogViewOnly.value = false
  processingFile.value = null
  parsingResult.value = null
  salesIngestSummary.value = null
  fieldMapping.value = {}
  stationSelection.value = null
  phase1Status.value = null
  phase1ElapsedSeconds.value = 0
  phase2Status.value = null
  phase2ElapsedSeconds.value = 0
}

function formatAnalyticsJobDate (iso: string): string {
  try {
    const d = new Date(iso)
    return Number.isFinite(d.getTime()) ? d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : iso
  } catch {
    return iso
  }
}

async function openAnalyticsRunDialog (job: { value: string; title: string; description: string }) {
  analyticsRunJob.value = job
  const config = analyticsJobParamConfig[job.value]
  const weeks = weekOptions.value
  const defaultWeek = weeks[0]?.value ?? '' // most recent Monday = last week only
  analyticsRunParams.value = {
    weeks_back: 4,
    start_week: (config?.start_week || config?.end_week) ? defaultWeek : '',
    end_week: (config?.start_week || config?.end_week) ? defaultWeek : '',
    header_row: 1,
  }
  analyticsRunCurrent.value = null
  analyticsRunDialogOpen.value = true
  await loadAnalyticsRunHistory()
}

function closeAnalyticsRunDialog () {
  analyticsRunDialogOpen.value = false
  analyticsRunJob.value = null
  analyticsRunCurrent.value = null
}

async function loadAnalyticsRunHistory () {
  const job = analyticsRunJob.value
  if (!job) return
  analyticsRunHistoryLoading.value = true
  try {
    const res = await listAnalyticsJobs({ type: job.value, limit: 30 })
    analyticsRunHistory.value = res.items
  } catch (e) {
    notifyError(e, 'Load job history')
  } finally {
    analyticsRunHistoryLoading.value = false
  }
}

/** Rehydrate per-job run state from API so green/red last-run indicator shows after refresh. */
async function loadAnalyticsRunStateFromHistory () {
  try {
    const res = await listAnalyticsJobs({ limit: 200 })
    const items = res.items.filter((j) => j.status === 'SUCCESS' || j.status === 'FAILED')
    const byType: Record<string, { status: string; started_at: string; elapsedSeconds: number; error_message?: string }> = {}
    for (const j of items) {
      const existing = byType[j.type]
      if (!existing || (j.started_at && existing.started_at && j.started_at > existing.started_at)) {
        byType[j.type] = {
          status: j.status,
          started_at: j.started_at ?? new Date().toISOString(),
          elapsedSeconds: j.duration_seconds ?? 0,
          error_message: j.error_message ?? undefined,
        }
      }
    }
    analyticsRunStateByType.value = { ...analyticsRunStateByType.value, ...byType }
  } catch {
    // Non-blocking; indicator just won't show until next run
  }
}

async function startAnalyticsRun () {
  const job = analyticsRunJob.value
  if (!job || analyticsRunLoading.value) return
  const jobType = job.value
  analyticsRunLoading.value = true
  const now = new Date().toISOString()
  analyticsRunStateByType.value = { ...analyticsRunStateByType.value, [jobType]: { status: 'RUNNING', started_at: now, elapsedSeconds: 0 } }
  analyticsRunCurrent.value = { sk: '', status: 'RUNNING', started_at: now, elapsedSeconds: 0 }
  ensureAnalyticsRunTimer()
  const config = analyticsJobParamConfig[jobType]
  const input: Record<string, unknown> = { jobType }
  if (config?.weeks_back) input.weeks_back = analyticsRunParams.value.weeks_back
  if (config?.start_week && analyticsRunParams.value.start_week) input.start_week = analyticsRunParams.value.start_week
  if (config?.end_week && analyticsRunParams.value.end_week) input.end_week = analyticsRunParams.value.end_week
  if (config?.header_row) input.header_row = analyticsRunParams.value.header_row
  try {
    const started = await startAnalyticsJob(input as { jobType: string; weeks_back?: number; start_week?: string; end_week?: string; header_row?: number })
    analyticsRunCurrent.value = { ...analyticsRunCurrent.value, sk: started.SK }
    await waitForJobCompletion(started.SK, {
      onProgress: (status: string) => {
        const prev = analyticsRunStateByType.value[jobType]
        if (prev) {
          const next: Record<string, { status: string; started_at: string; elapsedSeconds: number; error_message?: string }> = { ...analyticsRunStateByType.value, [jobType]: { status, started_at: prev.started_at, elapsedSeconds: prev.elapsedSeconds } }
          analyticsRunStateByType.value = next
        }
        if (analyticsRunCurrent.value) analyticsRunCurrent.value = { ...analyticsRunCurrent.value, status }
      },
    })
    const finalElapsed = analyticsRunStateByType.value[jobType]?.elapsedSeconds ?? 0
    analyticsRunStateByType.value = { ...analyticsRunStateByType.value, [jobType]: { status: 'SUCCESS', started_at: now, elapsedSeconds: finalElapsed } }
    analyticsRunCurrent.value = { ...analyticsRunCurrent.value, status: 'SUCCESS' }
    await loadAnalyticsRunHistory()
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    analyticsRunStateByType.value = { ...analyticsRunStateByType.value, [jobType]: { status: 'FAILED', started_at: now, elapsedSeconds: analyticsRunStateByType.value[jobType]?.elapsedSeconds ?? 0, error_message: errMsg } }
    analyticsRunCurrent.value = { ...analyticsRunCurrent.value, status: 'FAILED', error_message: errMsg }
    notifyError(e, 'Start analytics job')
  } finally {
    analyticsRunLoading.value = false
  }
}

async function loadStationOptions () {
  try {
    const stations = await listStationMappings()
    const options = stations.map(s => ({
      title: s.normalized || s.aliases[0] || 'Unknown',
      value: s.normalized || s.aliases[0] || ''
    }))
    options.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
    stationOptions.value = options
  } catch (error) {
    console.error('Failed to load stations:', error)
    notifyError(error, 'Load station options')
  }
}

async function parseFile () {
  if (!processingFile.value) return
  if (processingFile.value.fileType === 'postlog') {
    await runPhase1Parse()
    return
  }
  if (processingFile.value.fileType === 'sales') {
    const fileId = processingFile.value.id
    const state = getFileState(fileId)
    state.phase1Status = 'RUNNING'
    state.phase1ElapsedSeconds = 0
    phase1Status.value = 'RUNNING'
    phase1ElapsedSeconds.value = 0
    parsing.value = true
    const startTime = Date.now()
    const timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      state.phase1ElapsedSeconds = elapsed
      phase1ElapsedSeconds.value = elapsed
    }, 1000)
    try {
      const meta = await runSalesIngest(fileId, {
        onProgress: (status: string) => {
          phase1Status.value = status
        }
      })
      clearInterval(timerInterval)
      state.phase1Status = 'SUCCESS'
      phase1Status.value = 'SUCCESS'
      const ctx = (meta.context && typeof meta.context === 'object' && !Array.isArray(meta.context))
        ? meta.context as Record<string, unknown>
        : {}
      parsingResult.value = {
        file_id: fileId,
        file_name: processingFile.value.fileName,
        file_type: 'SALE',
        status: 'PARSED',
        row_count: meta.row_count ?? undefined,
        metrics: (ctx.metrics && typeof ctx.metrics === 'object') ? ctx.metrics as Record<string, unknown> : {},
        sample_data: Array.isArray(ctx.sample_data) ? ctx.sample_data : [],
      }
      await loadUploadHistory()
    } catch (error) {
      clearInterval(timerInterval)
      state.phase1Status = 'FAILED'
      state.errorMessage = error instanceof Error ? error.message : String(error)
      phase1Status.value = 'FAILED'
      notifyError(error, 'Sales ingest')
    } finally {
      parsing.value = false
    }
    return
  }
  // Buysheet or other: stub for now
  parsing.value = true
  try {
    const response = await fetch('/stub-parsing-results.json')
    if (!response.ok) throw new Error('Stub data not found')
    const allResults = await response.json()
    const fileId = processingFile.value.id.split('#').pop() || processingFile.value.id
    parsingResult.value = allResults[fileId] ?? {
      file_id: fileId,
      file_name: processingFile.value.fileName,
      file_type: 'POSTLOG',
      status: 'PARSED',
      row_count: processingFile.value.recordCount ?? 1000,
      metrics: {},
      sample_data: [],
      parsed_headers: [],
    }
  } catch (error) {
    notifyError(error, 'Parse file')
  } finally {
    parsing.value = false
  }
}

function formatElapsedTime (seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

async function runPhase1Parse () {
  if (!processingFile.value || processingFile.value.fileType !== 'postlog') return
  parsing.value = true
  phase1Status.value = 'RUNNING'
  phase1ElapsedSeconds.value = 0
  try {
    const meta = await runPhase1(processingFile.value.id, (status: string) => {
      phase1Status.value = status
    })
    phase1Status.value = 'SUCCESS'
    const ctx = parseFileMetadataContext(meta.context)
    if (ctx) {
      applyPhase1Context(ctx, meta)
      await fetchSampleIfNeeded(processingFile.value!.id, ctx)
    } else {
      parsingResult.value = {
        file_id: processingFile.value.id,
        file_name: processingFile.value.fileName,
        file_type: 'POSTLOG',
        status: 'PARSED',
        row_count: meta.row_count ?? undefined,
        parsed_headers: [],
        sample_data: [],
      }
    }
    await loadUploadHistory()
  } catch (error) {
    phase1Status.value = 'FAILED'
    notifyError(error, 'Phase 1 parse')
  } finally {
    parsing.value = false
  }
}

async function uploadToModel () {
  if (!processingFile.value) return
  if (processingFile.value.fileType === 'postlog') {
    await runPhase2Upload()
    return
  }
  uploadingToModel.value = true
  try {
    console.log('Upload to model (non-postlog):', processingFile.value.id)
    await loadUploadHistory()
  } catch (error) {
    notifyError(error, 'Upload to model')
  } finally {
    uploadingToModel.value = false
  }
}

/** Backend expects field_bindings keys; map our standard names only where backend uses different names. */
const FIELD_BINDINGS_KEYS: Record<string, string> = {
  length: 'spot_length',
  campaign: 'advertiser',
}

/** When reading context back: backend key -> our standard field name (only where backend uses a different key). */
const BACKEND_TO_STANDARD_FIELD: Record<string, string> = {
  spot_length: 'length',
  advertiser: 'campaign',
}

async function runPhase2Upload () {
  if (!processingFile.value || processingFile.value.fileType !== 'postlog') return
  if (!canSubmitPostlog.value) {
    notifyError(new Error('Please map all required fields (Station, Date, Air Time)'), 'Field mapping incomplete')
    return
  }
  const currentFileId = processingFile.value.id
  uploadingToModel.value = true
  phase2Status.value = 'RUNNING'
  phase2ElapsedSeconds.value = 0
  
  // Also update per-file state
  const state = getFileState(currentFileId)
  state.phase2Status = 'RUNNING'
  state.phase2ElapsedSeconds = 0
  state.needsInput = false
  
  const startTime = Date.now()
  const timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000)
    phase2ElapsedSeconds.value = elapsed
    state.phase2ElapsedSeconds = elapsed
  }, 1000)
  
  try {
    const meta = await getFileMetadata(currentFileId)
    const existingContext = parseFileMetadataContext(meta.context) ?? {}

    const matchTable: Array<{ discovered_column: string; standard_field: string }> = []
    const fieldBindings: Record<string, string> = {}
    for (const [standardField, discoveredColumn] of Object.entries(fieldMapping.value)) {
      if (discoveredColumn) {
        matchTable.push({ discovered_column: discoveredColumn, standard_field: standardField })
        const bindingsKey = FIELD_BINDINGS_KEYS[standardField] ?? standardField
        fieldBindings[bindingsKey] = discoveredColumn
      }
    }
    const airTimeField = standardFields.find(f => f.name === 'air_time' && f.fixedMapping)
    if (airTimeField && !matchTable.some(m => m.standard_field === 'air_time')) {
      matchTable.push({ discovered_column: 'air_time', standard_field: 'air_time' })
      fieldBindings.air_time = 'air_time'
    }
    if (standardFields.some(f => f.name === 'station') && !fieldMapping.value.station && stationSelection.value) {
      matchTable.push({ discovered_column: stationSelection.value, standard_field: 'station' })
      fieldBindings.station = stationSelection.value
    }
    await runPhase2(
      currentFileId,
      existingContext,
      matchTable,
      {
        field_bindings: fieldBindings,
        onProgress: (status: string) => {
          phase2Status.value = status
        },
        onJobStarted: (sk: string) => {
          state.phase2JobSk = sk
        }
      }
    )
    clearInterval(timerInterval)
    phase2Status.value = 'SUCCESS'
    state.phase2Status = 'SUCCESS'
    await loadUploadHistory()
    await switchDialogToMergedView(currentFileId)
  } catch (error) {
    clearInterval(timerInterval)
    phase2Status.value = 'FAILED'
    state.phase2Status = 'FAILED'
    state.errorMessage = error instanceof Error ? error.message : String(error)
    notifyError(error, 'Phase 2 upload')
  } finally {
    uploadingToModel.value = false
  }
}

async function continuePhase2Upload (fileId: string) {
  const state = getFileState(fileId)
  if (state.phase2Status === 'RUNNING') return // Already running
  
  state.phase2Status = 'RUNNING'
  state.phase2ElapsedSeconds = 0
  const startTime = Date.now()
  const timerInterval = setInterval(() => {
    state.phase2ElapsedSeconds = Math.floor((Date.now() - startTime) / 1000)
  }, 1000)
  
  try {
    const meta = await getFileMetadata(fileId)
    const existingContext = parseFileMetadataContext(meta.context) ?? {}
    
    const matchTable: Array<{ discovered_column: string; standard_field: string }> = []
    const fieldBindings: Record<string, string> = {}
    for (const [standardField, discoveredColumn] of Object.entries(state.fieldMapping)) {
      if (discoveredColumn) {
        matchTable.push({ discovered_column: discoveredColumn, standard_field: standardField })
        const bindingsKey = FIELD_BINDINGS_KEYS[standardField] ?? standardField
        fieldBindings[bindingsKey] = discoveredColumn
      }
    }
    const airTimeField = standardFields.find(f => f.name === 'air_time' && f.fixedMapping)
    if (airTimeField && !matchTable.some(m => m.standard_field === 'air_time')) {
      matchTable.push({ discovered_column: 'air_time', standard_field: 'air_time' })
      fieldBindings.air_time = 'air_time'
    }
    if (standardFields.some(f => f.name === 'station') && !state.fieldMapping.station && state.stationSelection) {
      matchTable.push({ discovered_column: state.stationSelection, standard_field: 'station' })
      fieldBindings.station = state.stationSelection
    }
    
    await runPhase2(
      fileId,
      existingContext,
      matchTable,
      {
        field_bindings: fieldBindings,
        onProgress: (status: string) => {
          state.phase2Status = status
        },
        onJobStarted: (sk: string) => {
          state.phase2JobSk = sk
        }
      }
    )
    clearInterval(timerInterval)
    state.phase2Status = 'SUCCESS'
    if (!processDialogOpen.value) {
      await loadUploadHistory()
    } else if (processingFile.value?.id === fileId) {
      await loadUploadHistory()
      await switchDialogToMergedView(fileId)
    }
  } catch (error) {
    clearInterval(timerInterval)
    state.phase2Status = 'FAILED'
    state.errorMessage = error instanceof Error ? error.message : String(error)
    notifyError(error, 'Phase 2 upload')
  }
}

const canSubmitPostlog = computed(() => {
  if (!processingFile.value || processingFile.value.fileType !== 'postlog') return true
  
  const headers = parsingResult.value?.parsed_headers || []
  const requiredFields = standardFields.filter(f => f.required)
  return requiredFields.every(field => {
    if (field.fixedMapping) {
      return headers.includes(field.fixedMapping) || !!fieldMapping.value[field.name]
    }
    if (field.name === 'station') {
      return fieldMapping.value[field.name] || stationSelection.value
    }
    return !!fieldMapping.value[field.name]
  })
})

function getSampleDataHeaders () {
  if (!parsingResult.value?.sample_data || parsingResult.value.sample_data.length === 0) return []
  
  const firstRow = parsingResult.value.sample_data[0]
  return Object.keys(firstRow).map(key => ({
    title: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    key: key,
    sortable: true
  }))
}

/** Set of sample column names that are currently mapped in the form (for green highlight). */
const mappedSampleColumns = computed(() => {
  const mapped = new Set<string>()
  Object.values(fieldMapping.value).forEach((col) => {
    if (col) mapped.add(col)
  })
  const headers = parsingResult.value?.parsed_headers || []
  if (headers.includes('air_time')) mapped.add('air_time')
  return mapped
})

function getPostlogSampleHeaders () {
  if (!parsingResult.value?.sample_data || parsingResult.value.sample_data.length === 0) return []
  const mapped = mappedSampleColumns.value
  const firstRow = parsingResult.value.sample_data[0]
  return Object.keys(firstRow).map(key => ({
    title: key,
    key: key,
    sortable: true,
    headerProps: mapped.has(key) ? { class: 'postlog-sample-column-mapped' } : undefined,
    cellProps: mapped.has(key) ? () => ({ class: 'postlog-sample-column-mapped' }) : undefined
  }))
}

watch(selectedClient, () => {
  loadUploadHistory()
})

onMounted(() => {
  loadClients()
  loadUploadHistory()
  loadAnalyticsRunStateFromHistory()
})
</script>

<style scoped>
/* Highlight sample table columns that are mapped in the form above */
:deep(.postlog-sample-column-mapped) {
  background-color: rgba(var(--v-theme-success, 76, 175, 80), 0.2) !important;
}
.stryker-chart-card {
  background: rgba(255, 255, 255, 0.02);
}
.stryker-chart-title {
  color: rgb(var(--v-theme-on-surface));
}
.stryker-accent-icon {
  color: rgb(var(--v-theme-secondary));
}
pre {
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
