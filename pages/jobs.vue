<template>
  <v-container fluid class="pa-4">
    <v-row>
      <v-col cols="12">
        <v-card variant="outlined" class="stryker-chart-card">
          <v-card-title class="d-flex align-center flex-wrap gap-2 stryker-chart-title">
            <v-icon start size="small" class="stryker-accent-icon">mdi-cog-clockwise</v-icon>
            <span>Jobs</span>
          </v-card-title>
          <v-card-text>
            <v-tabs v-model="jobsTab" class="mb-4">
              <v-tab value="pipeline">Pipelines</v-tab>
              <v-tab value="runs">Job runs</v-tab>
              <v-tab value="schedule">Scheduling</v-tab>
              <v-tab value="costs">Costs</v-tab>
            </v-tabs>
            <v-window v-model="jobsTab">

              <!-- ==================== PIPELINES ==================== -->
              <v-window-item value="pipeline">
                <!-- Toolbar -->
                <div class="d-flex align-center gap-2 mb-4 flex-wrap">
                  <v-text-field
                    v-model="pipelineSearch"
                    prepend-inner-icon="mdi-magnify"
                    placeholder="Search pipelines…"
                    density="compact"
                    hide-details
                    clearable
                    style="max-width: 300px"
                    variant="outlined"
                  />
                  <v-select
                    v-model="pipelineStatusFilter"
                    :items="PIPELINE_STATUS_FILTERS"
                    item-title="title"
                    item-value="value"
                    density="compact"
                    hide-details
                    clearable
                    label="Status"
                    style="max-width: 150px"
                    variant="outlined"
                  />
                  <v-spacer />
                  <v-btn size="small" variant="text" icon="mdi-refresh" :loading="pipelinesLoading" @click="loadPipelines" title="Refresh" />
                </div>

                <v-progress-linear v-if="pipelinesLoading && !pipelineRows.length" indeterminate class="mb-4" />

                <!-- Pipeline table -->
                <v-data-table
                  v-if="pipelineRows.length || !pipelinesLoading"
                  :headers="pipelineHeaders"
                  :items="filteredPipelines"
                  :loading="pipelinesLoading"
                  item-value="stateMachineArn"
                  density="comfortable"
                  class="dashboard-table pipeline-table"
                  :sort-by="[{ key: 'sortKey', order: 'asc' }]"
                  hover
                  @click:row="onRowClick"
                >
                  <template #[`item.name`]="{ item }">
                    <span class="font-weight-medium">{{ item.name }}</span>
                  </template>
                  <template #[`item.steps`]="{ item }">
                    <span class="text-caption text-medium-emphasis">{{ item.steps.length }} step{{ item.steps.length !== 1 ? 's' : '' }}</span>
                  </template>
                  <template #[`item.status`]="{ item }">
                    <div class="d-flex align-center gap-1">
                      <v-icon :color="rowStatusColor(item)" size="16">{{ rowStatusIcon(item) }}</v-icon>
                      <span class="text-body-2">{{ rowStatusLabel(item) }}</span>
                      <v-chip v-if="item.activeExecArn" size="x-small" color="warning" variant="flat" class="ml-1">{{ activeElapsed(item.stateMachineArn) }}</v-chip>
                    </div>
                  </template>
                  <template #[`item.lastRun`]="{ item }">
                    <span v-if="item.lastRunAt">{{ formatDate(item.lastRunAt) }}</span>
                    <span v-else class="text-medium-emphasis">never</span>
                  </template>
                  <template #[`item.lastDuration`]="{ item }">{{ item.lastDuration != null ? formatDuration(item.lastDuration) : '—' }}</template>
                  <template #[`item.actions`]="{ item }">
                    <v-btn icon size="small" variant="text" :color="item.activeExecArn ? 'warning' : 'primary'" @click.stop="openDetail(item)">
                      <v-icon>{{ item.activeExecArn ? 'mdi-eye' : 'mdi-play' }}</v-icon>
                    </v-btn>
                  </template>
                </v-data-table>

                <!-- ---- Detail dialog ---- -->
                <v-dialog v-model="detailOpen" max-width="820" scrollable>
                  <v-card v-if="detailRow">
                    <v-card-title class="d-flex align-center gap-2 flex-wrap">
                      <v-icon size="small">mdi-pipe</v-icon>
                      <span class="font-weight-bold">{{ detailRow.name }}</span>
                      <v-spacer />
                      <v-btn icon="mdi-close" size="small" variant="text" @click.stop="detailOpen = false" />
                    </v-card-title>
                    <v-divider />
                    <v-card-text class="pa-4">
                      <!-- Pipeline diagram -->
                      <div class="pipeline-diagram mb-4">
                        <!-- Diagram mode toggle when viewing history -->
                        <div v-if="selectedHistEntry" class="d-flex align-center gap-2 mb-3">
                          <v-chip
                            size="x-small"
                            :color="execColor(selectedHistEntry.status)"
                            variant="flat"
                            prepend-icon="mdi-history"
                          >
                            {{ formatDate(selectedHistEntry.startedAt) }} — {{ selectedHistEntry.status }}
                          </v-chip>
                          <v-btn size="x-small" variant="text" @click="clearHistSelection">
                            <v-icon size="14" class="mr-1">mdi-close</v-icon>
                            Back to live
                          </v-btn>
                          <v-progress-circular v-if="histStagesLoading" indeterminate size="16" width="2" class="ml-1" />
                        </div>
                        <div class="pipeline-flow">
                          <template v-for="(node, idx) in buildDiagramNodes(detailRow.steps, diagramRun)" :key="idx">
                            <!-- Arrow between nodes -->
                            <div v-if="idx > 0" class="flow-arrow">
                              <v-icon size="16" color="grey-lighten-1">mdi-chevron-right</v-icon>
                            </div>
                            <!-- Parallel group -->
                            <div v-if="node.parallel" class="parallel-group">
                              <div class="parallel-label text-caption text-medium-emphasis mb-1">parallel</div>
                              <div class="parallel-branches">
                                <div
                                  v-for="(branch, bi) in node.branches"
                                  :key="bi"
                                  class="step-chip parallel-branch step-clickable"
                                  :class="[stepChipClass(branch.status), selectedStepName === branch.name ? 'step-selected' : '']"
                                  @click="selectStep(branch.name)"
                                >
                                  <v-icon size="13" class="mr-1">{{ stepChipIcon(branch.status) }}</v-icon>
                                  <span>{{ branch.name }}</span>
                                </div>
                              </div>
                            </div>
                            <!-- Single step -->
                            <div
                              v-else
                              class="step-chip step-clickable"
                              :class="[stepChipClass(node.status), selectedStepName === node.name ? 'step-selected' : '']"
                              @click="selectStep(node.name)"
                            >
                              <v-icon size="13" class="mr-1">{{ stepChipIcon(node.status) }}</v-icon>
                              <span>{{ node.name }}</span>
                              <v-icon v-if="node.errorMsg" size="11" class="ml-1">mdi-alert-circle</v-icon>
                            </div>
                          </template>
                        </div>
                      </div>

                      <!-- Step detail panel -->
                      <v-expand-transition>
                        <v-card v-if="selectedStepName && selectedStepDetail" variant="outlined" class="mb-4 step-detail-card">
                          <v-card-text class="pa-3">
                            <!-- Header row -->
                            <div class="d-flex align-center gap-2 mb-2">
                              <v-icon :color="stageColor(selectedStepDetail.status)" size="16">{{ stageIcon(selectedStepDetail.status) }}</v-icon>
                              <span class="text-subtitle-2 font-weight-bold">{{ selectedStepName }}</span>
                              <v-chip size="x-small" :color="stageColor(selectedStepDetail.status)" variant="flat">{{ stageLabel(selectedStepDetail.status) }}</v-chip>
                              <v-spacer />
                              <v-btn icon="mdi-close" size="x-small" variant="text" @click="clearStepSelection" />
                            </div>

                            <!-- Job metrics -->
                            <div v-if="selectedStepDetail.job" class="d-flex align-center flex-wrap gap-4 mb-2 text-caption text-medium-emphasis">
                              <span v-if="selectedStepDetail.job.started_at">
                                <v-icon size="11" class="mr-1">mdi-clock-start</v-icon>{{ formatDate(selectedStepDetail.job.started_at) }}
                              </span>
                              <span v-if="selectedStepDetail.job.duration_seconds != null">
                                <v-icon size="11" class="mr-1">mdi-timer-outline</v-icon>{{ formatDuration(selectedStepDetail.job.duration_seconds) }}
                              </span>
                              <span v-if="selectedStepDetail.job.rows_processed != null">
                                <v-icon size="11" class="mr-1">mdi-table-row</v-icon>{{ selectedStepDetail.job.rows_processed.toLocaleString() }} rows
                              </span>
                            </div>

                            <!-- Error message -->
                            <div v-if="selectedStepDetail.error" class="mb-2">
                              <div class="text-caption font-weight-medium text-error mb-1">
                                <v-icon size="12" color="error" class="mr-1">mdi-alert-circle</v-icon>Error
                              </div>
                              <pre class="error-pre text-caption text-error step-detail-pre">{{ selectedStepDetail.error }}</pre>
                            </div>

                            <!-- Job context -->
                            <div v-if="stepContextLoading" class="d-flex align-center gap-2 text-caption text-medium-emphasis mt-1">
                              <v-progress-circular indeterminate size="12" width="2" />
                              Loading job context…
                            </div>
                            <div v-else-if="selectedStepContext">
                              <div class="text-caption font-weight-medium text-medium-emphasis mb-1">
                                <v-icon size="12" class="mr-1">mdi-code-json</v-icon>Job context
                              </div>
                              <pre class="text-caption step-detail-pre">{{ JSON.stringify(selectedStepContext, null, 2) }}</pre>
                            </div>
                            <div v-else-if="!selectedStepDetail.error && selectedStepDetail.status === 'PENDING'" class="text-caption text-medium-emphasis mt-1">
                              This step has not run yet.
                            </div>
                            <div v-else-if="!selectedStepDetail.error && !selectedStepDetail.job" class="text-caption text-medium-emphasis mt-1">
                              No additional detail available for this step.
                            </div>
                          </v-card-text>
                        </v-card>
                      </v-expand-transition>

                      <!-- Launch params -->
                      <div class="d-flex align-center gap-3 flex-wrap mb-4">
                        <v-select
                          v-model="detailStartWeek"
                          :items="weekOptions"
                          item-title="title"
                          item-value="value"
                          label="Start week"
                          density="compact"
                          hide-details
                          clearable
                          placeholder="Default"
                          style="max-width: 180px"
                        />
                        <v-select
                          v-model="detailEndWeek"
                          :items="weekOptions"
                          item-title="title"
                          item-value="value"
                          label="End week"
                          density="compact"
                          hide-details
                          clearable
                          placeholder="Default"
                          style="max-width: 180px"
                        />
                        <span v-if="detailWeeksCount > 0" class="text-caption text-medium-emphasis">{{ detailWeeksCount }} week{{ detailWeeksCount !== 1 ? 's' : '' }}</span>
                        <span v-else class="text-caption text-medium-emphasis">Default (last 4 weeks)</span>
                        <v-spacer />
                        <v-btn color="primary" :loading="detailLaunching" prepend-icon="mdi-play" :disabled="!!detailRow.activeExecArn" @click="launchFromDetail">Run</v-btn>
                      </div>

                      <v-alert v-if="detailError" type="error" density="compact" closable class="mb-4" @click:close="detailError = ''">{{ detailError }}</v-alert>
                      <v-alert v-if="detailAlreadyRunning" type="warning" density="compact" class="mb-4">Pipeline already running — tracking the active execution below.</v-alert>

                      <!-- Active run status bar -->
                      <template v-if="detailRow.activeExecArn">
                        <div class="d-flex align-center gap-2 mb-3 px-1">
                          <v-icon color="warning" size="16" class="mdi-spin">mdi-loading</v-icon>
                          <span class="text-body-2 font-weight-medium">Running</span>
                          <v-chip size="x-small" color="warning" variant="flat">{{ activeElapsed(detailRow.stateMachineArn) }}</v-chip>
                          <v-spacer />
                          <span class="text-caption text-medium-emphasis">{{ activeRuns.get(detailRow.stateMachineArn)?.executionName }}</span>
                        </div>
                        <!-- Per-step errors (shown below diagram if any) -->
                        <div v-for="step in detailRow.steps" :key="step.name">
                          <div v-if="stageErrorFor(detailRow.stateMachineArn, step.name)" class="text-caption text-error mb-1 ml-2">
                            <strong>{{ step.name }}:</strong> {{ stageErrorFor(detailRow.stateMachineArn, step.name) }}
                          </div>
                        </div>
                      </template>

                      <!-- Execution history for this pipeline -->
                      <div class="text-subtitle-2 mb-2 d-flex align-center gap-2">
                        Execution history
                        <v-spacer />
                        <v-btn icon="mdi-refresh" size="x-small" variant="text" :loading="detailHistLoading" @click="loadDetailHistory" />
                      </div>
                      <v-progress-linear v-if="detailHistLoading && !detailHist.length" indeterminate class="mb-2" />
                      <div v-if="!detailHist.length && !detailHistLoading" class="text-body-2 text-medium-emphasis text-center pa-4">No executions yet.</div>
                      <v-table v-else density="compact" class="mb-2 hist-table">
                        <thead><tr><th style="width:36px"></th><th>Started</th><th>Stopped</th><th>Duration</th><th>Status</th><th style="width:48px"></th></tr></thead>
                        <tbody>
                          <tr
                            v-for="h in detailHist"
                            :key="h.executionArn"
                            class="hist-row"
                            :class="{ 'hist-row-selected': selectedHistEntry?.executionArn === h.executionArn }"
                            @click="selectHistEntry(h)"
                          >
                            <td><v-icon :color="execColor(h.status)" size="16">{{ execIcon(h.status) }}</v-icon></td>
                            <td class="text-body-2">{{ formatDate(h.startedAt) }}</td>
                            <td class="text-body-2">{{ formatDate(h.stoppedAt) }}</td>
                            <td class="text-body-2">{{ h.durationDisplay || '—' }}</td>
                            <td><v-chip size="x-small" :color="execColor(h.status)" variant="flat">{{ h.status }}</v-chip></td>
                            <td><v-btn v-if="h.error" icon="mdi-alert-circle-outline" size="x-small" variant="text" color="error" @click.stop="showExecError(h)" /></td>
                          </tr>
                        </tbody>
                      </v-table>
                      <div v-if="detailHistNext" class="d-flex justify-center">
                        <v-btn variant="text" size="small" :loading="detailHistLoading" @click="loadMoreDetailHistory">Load more</v-btn>
                      </div>
                    </v-card-text>
                  </v-card>
                </v-dialog>

                <!-- Execution error dialog -->
                <v-dialog v-model="execErrorOpen" max-width="500">
                  <v-card>
                    <v-card-title class="d-flex align-center"><v-icon start color="error">mdi-alert-circle</v-icon>Execution error</v-card-title>
                    <v-card-text><pre class="error-pre text-body-2">{{ execErrorText }}</pre></v-card-text>
                    <v-card-actions><v-spacer /><v-btn variant="text" @click="execErrorOpen = false">Close</v-btn></v-card-actions>
                  </v-card>
                </v-dialog>
              </v-window-item>

              <!-- ==================== JOB RUNS ==================== -->
              <v-window-item value="runs">
                <div class="d-flex align-center gap-2 mb-4 flex-wrap">
                  <v-select
                    v-model="filterJobType"
                    :items="jobTypeFilterOptions"
                    item-title="title"
                    item-value="value"
                    label="Job type"
                    density="compact"
                    hide-details
                    clearable
                    style="max-width:220px"
                    variant="outlined"
                  />
                  <v-select
                    v-model="filterJobStatus"
                    :items="JOB_STATUS_OPTIONS"
                    item-title="title"
                    item-value="value"
                    label="Status"
                    density="compact"
                    hide-details
                    clearable
                    style="max-width:150px"
                    variant="outlined"
                  />
                  <v-spacer />
                  <v-btn icon="mdi-refresh" size="small" variant="text" :loading="jobsLoading" title="Refresh" @click="loadJobs" />
                </div>
                <v-row class="mb-4">
                  <v-col cols="6" sm="3"><v-card variant="tonal" color="info" class="text-center pa-3"><div class="text-h5">{{ totalJobCount }}</div><div class="text-caption">Total</div></v-card></v-col>
                  <v-col cols="6" sm="3"><v-card variant="tonal" color="warning" class="text-center pa-3"><div class="text-h5">{{ runningJobCount }}</div><div class="text-caption">Running</div></v-card></v-col>
                  <v-col cols="6" sm="3"><v-card variant="tonal" color="success" class="text-center pa-3"><div class="text-h5">{{ successJobCount }}</div><div class="text-caption">Succeeded</div></v-card></v-col>
                  <v-col cols="6" sm="3"><v-card variant="tonal" color="error" class="text-center pa-3"><div class="text-h5">{{ failedJobCount }}</div><div class="text-caption">Failed</div></v-card></v-col>
                </v-row>
                <v-progress-linear v-if="jobsLoading && !allJobs.length" indeterminate class="mb-4" />
                <v-data-table :headers="jobHeaders" :items="filteredJobs" :loading="jobsLoading" item-value="SK" density="comfortable" class="dashboard-table" :sort-by="[{ key: 'started_at', order: 'desc' }]">
                  <template #[`item.type`]="{ item }"><v-chip size="small" :color="JOB_TYPE_COLORS[item.type] ?? 'default'" variant="flat">{{ JOB_TYPE_LABELS[item.type] ?? item.type }}</v-chip></template>
                  <template #[`item.status`]="{ item }">
                    <v-chip size="small" :color="jobStatusColor(item.status)" variant="flat">
                      <v-icon v-if="item.status === 'RUNNING'" start size="12" class="mdi-spin">mdi-loading</v-icon>
                      {{ item.status }}
                    </v-chip>
                  </template>
                  <template #[`item.started_at`]="{ item }">{{ formatDate(item.started_at) }}</template>
                  <template #[`item.completed_at`]="{ item }">{{ item.completed_at ? formatDate(item.completed_at) : (item.status === 'RUNNING' ? '…' : '—') }}</template>
                  <template #[`item.duration_seconds`]="{ item }">{{ item.duration_seconds != null ? formatDuration(item.duration_seconds) : (item.status === 'RUNNING' ? '…' : '—') }}</template>
                  <template #[`item.rows_processed`]="{ item }">{{ item.rows_processed != null ? item.rows_processed.toLocaleString() : '—' }}</template>
                  <template #[`item.actions`]="{ item }"><v-btn v-if="item.error_message" icon="mdi-alert-circle-outline" size="small" variant="text" color="error" title="View error" @click="openJobError(item)" /></template>
                </v-data-table>
              </v-window-item>

              <!-- ==================== SCHEDULING ==================== -->
              <v-window-item value="schedule">
                <div class="d-flex align-center gap-2 mb-4 flex-wrap">
                  <v-text-field
                    v-model="scheduleSearch"
                    prepend-inner-icon="mdi-magnify"
                    placeholder="Search schedules…"
                    density="compact"
                    hide-details
                    clearable
                    style="max-width:260px"
                    variant="outlined"
                  />
                  <v-spacer />
                  <v-btn icon="mdi-refresh" size="small" variant="text" :loading="schedulesLoading" title="Refresh" @click="loadSchedules" />
                  <v-btn color="primary" size="small" prepend-icon="mdi-plus" @click="openNewSchedule">Add schedule</v-btn>
                </div>
                <v-progress-linear v-if="schedulesLoading && !schedules.length" indeterminate class="mb-4" />
                <div v-if="!schedules.length && !schedulesLoading" class="text-center text-medium-emphasis pa-8">
                  <v-icon size="40" class="mb-2">mdi-calendar-clock-outline</v-icon>
                  <div class="text-body-1">No schedules configured.</div>
                  <div class="text-body-2 mt-1">Add a schedule to automate recurring Glue jobs.</div>
                </div>
                <v-data-table v-else :headers="scheduleHeaders" :items="filteredSchedules" :loading="schedulesLoading" item-value="name" density="comfortable" class="dashboard-table">
                  <template #[`item.targetJobType`]="{ item }"><v-chip size="small" :color="JOB_TYPE_COLORS[item.targetJobType] ?? 'default'" variant="flat">{{ JOB_TYPE_LABELS[item.targetJobType] ?? item.targetJobType ?? '—' }}</v-chip></template>
                  <template #[`item.scheduleExpression`]="{ item }"><code class="text-body-2">{{ item.scheduleExpression }}</code></template>
                  <template #[`item.scheduleExpressionTimezone`]="{ item }">{{ item.scheduleExpressionTimezone || 'UTC' }}</template>
                  <template #[`item.state`]="{ item }">
                    <v-switch
                      :model-value="item.state === 'ENABLED'"
                      density="compact"
                      hide-details
                      color="success"
                      :loading="scheduleTogglingName === item.name"
                      @update:model-value="toggleSchedule(item)"
                    />
                  </template>
                  <template #[`item.lastModificationDate`]="{ item }">{{ formatDate(item.lastModificationDate) }}</template>
                  <template #[`item.actions`]="{ item }">
                    <v-btn icon="mdi-pencil" size="small" variant="text" title="Edit" @click="openEditSchedule(item)" />
                    <v-btn icon="mdi-delete" size="small" variant="text" color="error" title="Delete" :loading="scheduleDeletingName === item.name" @click="confirmDeleteSchedule(item)" />
                  </template>
                </v-data-table>
              </v-window-item>

              <!-- ==================== COSTS ==================== -->
              <v-window-item value="costs">
                <div class="d-flex align-center mb-4 gap-2">
                  <v-btn icon="mdi-refresh" size="small" variant="text" :loading="costsLoading" title="Refresh (cached)" @click="loadCosts(false)" />
                  <v-btn size="small" variant="outlined" prepend-icon="mdi-cloud-refresh-outline" :loading="costsLoading" @click="loadCosts(true)">Refresh from AWS</v-btn>
                  <v-spacer />
                  <span v-if="costData" class="text-caption text-medium-emphasis">{{ costData.from_cache ? 'Cached' : 'Fresh' }} &mdash; {{ formatDate(costData.cached_at) }}</span>
                </div>
                <v-progress-linear v-if="costsLoading && !costData" indeterminate class="mb-4" />
                <template v-if="costData">
                  <v-row class="mb-4">
                    <v-col cols="6" sm="3"><v-card variant="tonal" color="primary" class="text-center pa-3"><div class="text-h5">${{ last30Total }}</div><div class="text-caption">Last 30 days</div></v-card></v-col>
                    <v-col cols="6" sm="3"><v-card variant="tonal" class="text-center pa-3"><div class="text-h5">${{ currentMonthTotal }}</div><div class="text-caption">Current month</div></v-card></v-col>
                    <v-col cols="6" sm="3"><v-card variant="tonal" class="text-center pa-3"><div class="text-h5">${{ previousMonthTotal }}</div><div class="text-caption">Previous month</div></v-card></v-col>
                    <v-col cols="6" sm="3"><v-card variant="tonal" class="text-center pa-3"><div class="text-h5">{{ costData.services_last30.length }}</div><div class="text-caption">Active services</div></v-card></v-col>
                  </v-row>
                  <v-card variant="outlined" class="mb-4"><v-card-title class="text-subtitle-2">Cost by service (last 30 days)</v-card-title><v-card-text><v-data-table :headers="svcHeaders" :items="svcRows" item-value="service" density="compact" class="elevation-0" :sort-by="[{ key: 'cost', order: 'desc' }]"><template #[`item.cost`]="{ item }">${{ item.cost.toFixed(2) }}</template><template #[`item.pct`]="{ item }">{{ item.pct }}%</template></v-data-table></v-card-text></v-card>
                  <v-card variant="outlined" class="mb-4"><v-card-title class="text-subtitle-2">Monthly totals</v-card-title><v-card-text><v-data-table :headers="monthlyHeaders" :items="monthlyRows" item-value="month" density="compact" class="elevation-0"><template #[`item.total`]="{ item }">${{ item.total.toFixed(2) }}</template><template #[`item.topServices`]="{ item }"><span class="text-caption">{{ item.topServices }}</span></template></v-data-table></v-card-text></v-card>
                  <v-card variant="outlined" class="mb-4"><v-card-title class="text-subtitle-2">Daily totals</v-card-title><v-card-text><v-data-table :headers="dailyHeaders" :items="dailyRows" item-value="date" density="compact" class="elevation-0" :sort-by="[{ key: 'date', order: 'desc' }]"><template #[`item.total`]="{ item }">${{ item.total.toFixed(2) }}</template></v-data-table></v-card-text></v-card>
                </template>
                <v-alert v-else-if="!costsLoading" type="warning" density="compact">No cost data loaded. Click refresh to fetch.</v-alert>
              </v-window-item>
            </v-window>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Add / Edit schedule dialog -->
    <v-dialog v-model="scheduleDialogOpen" max-width="560" persistent>
      <v-card>
        <v-card-title class="d-flex align-center gap-2">
          <v-icon start>{{ scheduleEditMode ? 'mdi-pencil' : 'mdi-calendar-plus' }}</v-icon>
          {{ scheduleEditMode ? 'Edit schedule' : 'Add schedule' }}
        </v-card-title>
        <v-card-text>
          <v-alert v-if="scheduleFormError" type="error" density="compact" closable class="mb-4" @click:close="scheduleFormError = ''">{{ scheduleFormError }}</v-alert>
          <v-row dense>
            <v-col cols="12">
              <v-text-field
                v-model="scheduleForm.name"
                label="Schedule name"
                density="compact"
                variant="outlined"
                :disabled="scheduleEditMode"
                hint="Unique identifier (no spaces)"
                persistent-hint
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-select
                v-model="scheduleForm.jobType"
                :items="JOB_TYPE_OPTIONS"
                item-title="title"
                item-value="value"
                label="Job type"
                density="compact"
                variant="outlined"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-select
                v-model="scheduleForm.scheduleExpressionTimezone"
                :items="TIMEZONE_OPTIONS"
                item-title="title"
                item-value="value"
                label="Timezone"
                density="compact"
                variant="outlined"
                hint="Schedule fires at this local time"
                persistent-hint
              />
            </v-col>
            <v-col cols="12">
              <v-text-field
                v-model="scheduleForm.scheduleExpression"
                label="Schedule expression"
                density="compact"
                variant="outlined"
                placeholder="cron(59 23 ? * WED *)"
                hint="EventBridge Scheduler format, e.g. cron(0 6 ? * MON *)"
                persistent-hint
              />
            </v-col>
            <v-col cols="6">
              <v-select
                v-model="scheduleForm.start_week"
                :items="weekOptions"
                item-title="title"
                item-value="value"
                label="Start week (optional)"
                density="compact"
                variant="outlined"
                clearable
                hide-details
              />
            </v-col>
            <v-col cols="6">
              <v-select
                v-model="scheduleForm.end_week"
                :items="weekOptions"
                item-title="title"
                item-value="value"
                label="End week (optional)"
                density="compact"
                variant="outlined"
                clearable
                hide-details
              />
            </v-col>
            <v-col cols="6">
              <v-text-field
                v-model.number="scheduleForm.weeks_back"
                label="Weeks back (optional)"
                density="compact"
                variant="outlined"
                type="number"
                min="1"
                clearable
                hide-details
                hint="If no start/end week"
              />
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="scheduleFormSaving" @click="scheduleDialogOpen = false">Cancel</v-btn>
          <v-btn color="primary" :loading="scheduleFormSaving" @click="saveSchedule">{{ scheduleEditMode ? 'Save' : 'Create' }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete schedule confirm -->
    <v-dialog v-model="scheduleDeleteOpen" max-width="400">
      <v-card>
        <v-card-title>Delete schedule?</v-card-title>
        <v-card-text>Remove <strong>{{ scheduleDeleteTarget?.name }}</strong>? This cannot be undone.</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="scheduleDeleteOpen = false">Cancel</v-btn>
          <v-btn color="error" :loading="!!scheduleDeletingName" @click="doDeleteSchedule">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Job error dialog -->
    <v-dialog v-model="jobErrorOpen" max-width="600">
      <v-card>
        <v-card-title class="d-flex align-center"><v-icon start color="error">mdi-alert-circle</v-icon>Job error</v-card-title>
        <v-card-text>
          <div v-if="jobErrorItem" class="mb-3">
            <div class="text-body-2"><strong>Job:</strong> {{ JOB_TYPE_LABELS[jobErrorItem.type] ?? jobErrorItem.type }}</div>
            <div class="text-body-2"><strong>Started:</strong> {{ formatDate(jobErrorItem.started_at) }}</div>
          </div>
          <v-divider class="mb-3" />
          <pre class="error-pre text-body-2">{{ jobErrorItem?.error_message || 'No error message.' }}</pre>
        </v-card-text>
        <v-card-actions><v-spacer /><v-btn variant="text" @click="jobErrorOpen = false">Close</v-btn></v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { usePostlogPipeline } from '~/composables/usePostlogPipeline'
import { useAnalyticsJobsStore } from '~/stores/analyticsJobs'
import type { AnalyticsJobUpdate } from '~/stores/analyticsJobs'

const {
  listPipelines, runPipelineFor, listAnalyticsJobs, getAnalyticsJob, getAwsCosts,
  getPipelineStatus, listPipelineExecutionsByPipeline, listPipelineExecutions,
  listJobRuns, listAnalyticsJobSchedules, scheduleAnalyticsJob, setAnalyticsJobScheduleState, deleteAnalyticsJobSchedule,
} = usePostlogPipeline()
const analyticsJobsStore = useAnalyticsJobsStore()

const jobsTab = ref<string>('pipeline')

// ===================== HELPERS =====================

function formatDate (iso: string | null | undefined): string {
  if (!iso) return '—'
  try { const d = new Date(iso); return Number.isFinite(d.getTime()) ? d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : iso } catch { return iso }
}
function formatDuration (s: number): string {
  if (s < 60) return `${Math.round(s)}s`
  const m = Math.floor(s / 60); const sec = Math.round(s % 60)
  if (m < 60) return `${m}m ${sec}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}
function calcWeeks (start: string | null, end: string | null): number {
  if (!start || !end) return 0
  const a = new Date(start).getTime(); const b = new Date(end).getTime()
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0
  return Math.round((b - a) / (7 * 86_400_000)) + 1
}

const WEEK_COUNT = 104
const weekOptions = computed(() => {
  const opts: { title: string; value: string }[] = []
  const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); d.setHours(0, 0, 0, 0)
  for (let i = 0; i < WEEK_COUNT; i++) {
    const v = d.toISOString().slice(0, 10)
    opts.push({ title: `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`, value: v })
    d.setDate(d.getDate() - 7)
  }
  return opts
})

// ===================== PIPELINE TABLE =====================

interface PipelineStep { name: string; type: string; path: string }

interface PipelineRow {
  name: string
  stateMachineArn: string
  steps: PipelineStep[]
  lastRunStatus: string | null
  lastRunAt: string | null
  lastDuration: number | null
  activeExecArn: string | null
  sortKey: number
}

const pipelineRows = ref<PipelineRow[]>([])
const pipelinesLoading = ref(false)
const pipelineSearch = ref('')
const pipelineStatusFilter = ref<string | null>(null)

const PIPELINE_STATUS_FILTERS = [
  { title: 'Running', value: 'running' },
  { title: 'Succeeded', value: 'succeeded' },
  { title: 'Failed', value: 'failed' },
  { title: 'Idle', value: 'idle' },
]

const pipelineHeaders = [
  { title: 'Pipeline', key: 'name', sortable: true },
  { title: 'Steps', key: 'steps', sortable: false, width: '80px' },
  { title: 'Status', key: 'status', sortable: false },
  { title: 'Last run', key: 'lastRun', sortable: true },
  { title: 'Duration', key: 'lastDuration', sortable: true, width: '100px' },
  { title: '', key: 'actions', sortable: false, width: '60px' },
]

const filteredPipelines = computed(() => {
  let list = pipelineRows.value
  if (pipelineSearch.value) {
    const q = pipelineSearch.value.toLowerCase()
    list = list.filter((r) => r.name.toLowerCase().includes(q))
  }
  if (pipelineStatusFilter.value) {
    const f = pipelineStatusFilter.value
    list = list.filter((r) => {
      if (f === 'running') return !!r.activeExecArn
      if (f === 'succeeded') return !r.activeExecArn && r.lastRunStatus === 'SUCCEEDED'
      if (f === 'failed') return !r.activeExecArn && (r.lastRunStatus === 'FAILED' || r.lastRunStatus === 'TIMED_OUT' || r.lastRunStatus === 'ABORTED')
      if (f === 'idle') return !r.activeExecArn && !r.lastRunStatus
      return true
    })
  }
  return list
})

function rowStatusColor (row: PipelineRow): string {
  if (row.activeExecArn) return 'warning'
  if (row.lastRunStatus === 'SUCCEEDED') return 'success'
  if (row.lastRunStatus === 'FAILED' || row.lastRunStatus === 'TIMED_OUT' || row.lastRunStatus === 'ABORTED') return 'error'
  return 'grey'
}
function rowStatusIcon (row: PipelineRow): string {
  if (row.activeExecArn) return 'mdi-loading mdi-spin'
  if (row.lastRunStatus === 'SUCCEEDED') return 'mdi-check-circle'
  if (row.lastRunStatus === 'FAILED' || row.lastRunStatus === 'TIMED_OUT' || row.lastRunStatus === 'ABORTED') return 'mdi-alert-circle'
  return 'mdi-circle-outline'
}
function rowStatusLabel (row: PipelineRow): string {
  if (row.activeExecArn) return 'Running'
  if (row.lastRunStatus === 'SUCCEEDED') return 'Succeeded'
  if (row.lastRunStatus === 'FAILED') return 'Failed'
  if (row.lastRunStatus === 'TIMED_OUT') return 'Timed out'
  if (row.lastRunStatus === 'ABORTED') return 'Aborted'
  return 'Idle'
}
function computeSortKey (row: PipelineRow): number {
  if (row.activeExecArn) return 0
  if (row.lastRunStatus === 'FAILED' || row.lastRunStatus === 'TIMED_OUT' || row.lastRunStatus === 'ABORTED') return 1
  if (row.lastRunStatus === 'SUCCEEDED') return 2
  return 3
}

async function loadPipelines () {
  pipelinesLoading.value = true
  try {
    const res = await listPipelines({ limit: 100 })
    const rows: PipelineRow[] = res.items.map((p) => ({
      name: p.name,
      stateMachineArn: p.stateMachineArn,
      steps: p.steps,
      lastRunStatus: null,
      lastRunAt: null,
      lastDuration: null,
      activeExecArn: null,
      sortKey: 3,
    }))

    const TERMINAL = ['SUCCEEDED', 'FAILED', 'TIMED_OUT', 'ABORTED']
    await Promise.all(rows.map(async (row) => {
      try {
        const execs = await listPipelineExecutionsByPipeline(row.stateMachineArn, { limit: 5 })
        for (const ex of execs.items) {
          if (ex.status === 'RUNNING' && !row.activeExecArn) {
            row.activeExecArn = ex.executionArn
            // Build stage statuses directly here — row.steps is available on the local row object
            const stages: Record<string, StageStatus> = {}
            for (const s of row.steps) stages[s.name] = 'RUNNING'
            activeRuns.set(row.stateMachineArn, {
              executionArn: ex.executionArn,
              executionName: ex.executionName ?? '',
              startedAt: ex.startedAt ?? new Date().toISOString(),
              stepJobSks: parseStepJobSks(ex.stepJobSks),
              stageStatuses: reactive(stages),
              stageErrors: reactive({}),
              elapsedSeconds: 0,
              elapsedDisplay: '0s',
            })
          }
          if (!row.lastRunStatus && ex.status && TERMINAL.includes(ex.status)) {
            row.lastRunStatus = ex.status
            row.lastRunAt = ex.startedAt ?? null
            if (ex.startedAt && ex.stoppedAt) {
              const dur = (new Date(ex.stoppedAt).getTime() - new Date(ex.startedAt).getTime()) / 1000
              if (dur > 0) row.lastDuration = dur
            }
          }
        }
      } catch (e) { console.warn('[pipeline] failed to load executions for', row.name, e) }
      row.sortKey = computeSortKey(row)
    }))

    // Assign rows AFTER all enrichment is done
    pipelineRows.value = rows
    if (rows.some((r) => r.activeExecArn)) startMonitoring()
  } catch (e) { console.error('[pipeline] loadPipelines:', e) }
  finally { pipelinesLoading.value = false }
}

// ===================== ACTIVE RUN TRACKING =====================

type StageStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED'

interface ActiveRunState {
  executionArn: string
  executionName: string
  startedAt: string
  stepJobSks: Record<string, string> | null  // always stored parsed
  stageStatuses: Record<string, StageStatus>
  stageErrors: Record<string, string>
  elapsedSeconds: number
  elapsedDisplay: string
}

const activeRuns = reactive(new Map<string, ActiveRunState>())
let tickTimer: ReturnType<typeof setInterval> | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let subCleanup: (() => void) | null = null

function initActiveRun (pipelineArn: string, exec: { executionArn: string; executionName?: string | null; startedAt?: string | null; stepJobSks?: string | Record<string, string> | null }) {
  if (activeRuns.has(pipelineArn)) return
  const row = pipelineRows.value.find((r) => r.stateMachineArn === pipelineArn)
  const stages: Record<string, StageStatus> = {}
  if (row) for (const s of row.steps) stages[s.name] = 'RUNNING'
  activeRuns.set(pipelineArn, {
    executionArn: exec.executionArn,
    executionName: exec.executionName ?? '',
    startedAt: exec.startedAt ?? new Date().toISOString(),
    stepJobSks: parseStepJobSks(exec.stepJobSks),
    stageStatuses: reactive(stages),
    stageErrors: reactive({}),
    elapsedSeconds: 0,
    elapsedDisplay: '0s',
  })
}

function activeElapsed (pipelineArn: string): string {
  return activeRuns.get(pipelineArn)?.elapsedDisplay ?? '0s'
}

function stageStatusFor (pipelineArn: string, stepName: string): StageStatus {
  return activeRuns.get(pipelineArn)?.stageStatuses[stepName] ?? 'PENDING'
}

function stageErrorFor (pipelineArn: string, stepName: string): string | null {
  return activeRuns.get(pipelineArn)?.stageErrors[stepName] ?? null
}

function handleSubUpdate (update: AnalyticsJobUpdate) {
  // Log every incoming update with all step names/paths so we can verify matching
  const allSteps = pipelineRows.value.flatMap((r) => r.steps.map((s) => `${s.name}|${s.path}|${s.type}`))
  console.log(`[pipeline:sub] SK=${update.SK} type=${update.type} status=${update.status} | steps: [${allSteps.join(', ')}]`)

  let matched = false
  for (const [arn, run] of activeRuns.entries()) {
    const row = pipelineRows.value.find((r) => r.stateMachineArn === arn)
    if (!row) continue
    for (const step of row.steps) {
      if (stepMatchesUpdate(step, update)) {
        const mapped: StageStatus = update.status === 'SUCCESS' ? 'SUCCESS' : update.status === 'FAILED' ? 'FAILED' : 'RUNNING'
        run.stageStatuses[step.name] = mapped
        if (update.error_message) run.stageErrors[step.name] = update.error_message
        matched = true
        console.log(`[pipeline:sub] ✅ matched → step.name=${step.name} step.path=${step.path} | stageStatuses now:`, { ...run.stageStatuses })
        return
      }
    }
  }
  if (!matched) {
    console.warn(`[pipeline:sub] ❌ NO MATCH for SK=${update.SK} type=${update.type}`)
  }
}

/**
 * Match a pipeline step definition to an incoming subscription update.
 * The SK looks like "ATTRIBUTE_SALES_NUMBERS#<uuid>" and update.type is "ATTRIBUTE_SALES_NUMBERS".
 * The step.path from the backend may be "SalesNumbers", "AttributeParallel.SalesNumbers", etc.
 * We try multiple strategies to find the right step.
 */
function stepMatchesUpdate (step: PipelineStep, update: AnalyticsJobUpdate): boolean {
  // 1. Direct SK prefix match against step.path or step.name
  if (update.SK.startsWith(`${step.path}#`)) return true
  if (update.SK.startsWith(`${step.name}#`)) return true

  // 2. Match update.type against step.path or step.name (case-insensitive, ignoring underscores)
  const normalize = (s: string) => s.replace(/[_\-\s]/g, '').toLowerCase()
  const updateType = normalize(update.type ?? '')
  if (updateType && normalize(step.name) === updateType) return true
  if (updateType && normalize(step.path) === updateType) return true

  // 3. Match update.type against step.path suffix after last dot
  //    e.g. step.path "AttributeParallel.SalesNumbers" → "SalesNumbers" vs "ATTRIBUTESALESNUMBERS"
  const pathLeaf = step.path.includes('.') ? step.path.split('.').pop()! : step.path
  if (updateType && normalize(pathLeaf) === updateType) return true

  // 4. SK starts with the AnalyticsJobType prefix matching the step path leaf
  //    e.g. SK "ATTRIBUTE_SALES_NUMBERS#..." and pathLeaf "SalesNumbers"
  //    ATTRIBUTE_SALES_NUMBERS → attributesalesnumbers matches salesnumbers? No — check substring
  if (updateType && updateType.includes(normalize(pathLeaf))) return true
  if (updateType && normalize(pathLeaf).length > 4 && updateType.endsWith(normalize(pathLeaf))) return true

  return false
}

function startMonitoring () {
  if (!tickTimer) {
    tickTimer = setInterval(() => {
      const now = Date.now()
      for (const run of activeRuns.values()) {
        run.elapsedSeconds = Math.max(0, Math.round((now - new Date(run.startedAt).getTime()) / 1000))
        run.elapsedDisplay = formatDuration(run.elapsedSeconds)
      }
    }, 1000)
  }
  if (!pollTimer) pollTimer = setInterval(pollActive, 15_000)
  if (!subCleanup) {
    const listener = (u: AnalyticsJobUpdate) => handleSubUpdate(u)
    analyticsJobsStore.registerGlobalListener(listener)
    subCleanup = () => analyticsJobsStore.unregisterGlobalListener(listener)
  }
}

function stopMonitoring () {
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null }
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  if (subCleanup) { subCleanup(); subCleanup = null }
}

const TERMINAL = ['SUCCEEDED', 'FAILED', 'TIMED_OUT', 'ABORTED']

async function pollActive () {
  let anyFinished = false
  for (const [arn, run] of activeRuns.entries()) {
    try {
      const exec = await getPipelineStatus(run.executionArn)
      if (exec.status && TERMINAL.includes(exec.status)) {
        const row = pipelineRows.value.find((r) => r.stateMachineArn === arn)
        if (row) {
          row.lastRunStatus = exec.status
          row.lastRunAt = run.startedAt
          row.lastDuration = run.elapsedSeconds
          row.activeExecArn = null
          row.sortKey = computeSortKey(row)
        }
        activeRuns.delete(arn)
        anyFinished = true
        // If this pipeline's detail is open, refresh history
        if (detailRow.value?.stateMachineArn === arn) {
          loadDetailHistory()
        }
      }
    } catch (e) { console.error('[pipeline] poll error:', e) }
  }
  if (anyFinished && activeRuns.size === 0) stopMonitoring()
}

// ===================== STAGE DISPLAY =====================

// ===================== DIAGRAM =====================

interface DiagramNode {
  parallel: false
  name: string
  type: string
  status: StageStatus
  errorMsg?: string | null
  clickable?: boolean
}
interface DiagramParallelNode {
  parallel: true
  branches: Array<{ name: string; type: string; status: StageStatus }>
}
type AnyDiagramNode = DiagramNode | DiagramParallelNode

function buildDiagramNodes (steps: PipelineStep[], run: { stageStatuses: Record<string, StageStatus>; stageErrors: Record<string, string> } | null | undefined): AnyDiagramNode[] {
  const nodes: AnyDiagramNode[] = []
  let i = 0
  while (i < steps.length) {
    const step = steps[i]
    const status = (name: string): StageStatus => run ? (run.stageStatuses[name] ?? 'PENDING') : 'PENDING'

    if (step.type === 'Parallel' || step.type === 'parallel') {
      // Collect consecutive Task steps whose path contains the parallel step name
      // e.g. path "AttributeParallel.SalesNumbers" or path that starts with the parallel step
      const parallelName = step.name
      const branches: DiagramParallelNode['branches'] = []
      i++
      while (i < steps.length) {
        const next = steps[i]
        const isChild = next.path.includes(parallelName) ||
          next.path.startsWith(parallelName) ||
          // fallback: consecutive Task steps until a non-Task or a step at top-level path
          ((next.type === 'Task' || next.type === 'task') && next.path.includes('.'))
        if (isChild) {
          branches.push({ name: next.name, type: next.type, status: status(next.name) })
          i++
        } else {
          break
        }
      }
      // If we couldn't identify children by path, fall back to next 3 tasks
      if (branches.length === 0) {
        while (i < steps.length && (steps[i].type === 'Task' || steps[i].type === 'task') && branches.length < 6) {
          branches.push({ name: steps[i].name, type: steps[i].type, status: status(steps[i].name) })
          i++
        }
      }
      nodes.push({ parallel: true, branches: branches.length ? branches : [{ name: parallelName, type: step.type, status: status(parallelName) }] })
    } else {
      const errMsg = run?.stageErrors[step.name] ?? null
      nodes.push({ parallel: false, name: step.name, type: step.type, status: status(step.name), errorMsg: errMsg, clickable: !!errMsg })
      i++
    }
  }
  return nodes
}

function stepChipClass (status: StageStatus): string {
  if (status === 'RUNNING') return 'step-running'
  if (status === 'SUCCESS') return 'step-success'
  if (status === 'FAILED') return 'step-failed'
  return 'step-idle'
}

function stepChipIcon (status: StageStatus): string {
  if (status === 'RUNNING') return 'mdi-loading mdi-spin'
  if (status === 'SUCCESS') return 'mdi-check-circle'
  if (status === 'FAILED') return 'mdi-alert-circle'
  return 'mdi-circle-outline'
}

function stageIcon (s: StageStatus): string {
  if (s === 'RUNNING') return 'mdi-loading mdi-spin'; if (s === 'SUCCESS') return 'mdi-check-circle'; if (s === 'FAILED') return 'mdi-alert-circle'; return 'mdi-circle-outline'
}
function stageColor (s: StageStatus): string {
  if (s === 'RUNNING') return 'warning'; if (s === 'SUCCESS') return 'success'; if (s === 'FAILED') return 'error'; return 'grey'
}
function stageLabel (s: StageStatus): string {
  if (s === 'RUNNING') return 'Running'; if (s === 'SUCCESS') return 'Done'; if (s === 'FAILED') return 'Failed'; return 'Waiting'
}
function execColor (status?: string | null): string {
  if (status === 'RUNNING') return 'warning'; if (status === 'SUCCEEDED') return 'success'; return 'error'
}
function execIcon (status?: string | null): string {
  if (status === 'RUNNING') return 'mdi-loading mdi-spin'; if (status === 'SUCCEEDED') return 'mdi-check-circle'; return 'mdi-alert-circle'
}

// ===================== DETAIL DIALOG =====================

const detailOpen = ref(false)
const detailRow = ref<PipelineRow | null>(null)
const detailStartWeek = ref<string | null>(null)
const detailEndWeek = ref<string | null>(null)
const detailLaunching = ref(false)
const detailError = ref('')
const detailAlreadyRunning = ref(false)
const detailWeeksCount = computed(() => calcWeeks(detailStartWeek.value, detailEndWeek.value))

interface HistEntry {
  executionArn: string; executionName?: string | null; status: string
  startedAt?: string | null; stoppedAt?: string | null; error?: string | null; durationDisplay?: string | null
  stepJobSks?: string | Record<string, string> | null
}
const detailHist = ref<HistEntry[]>([])
const detailHistLoading = ref(false)
const detailHistNext = ref<string | null>(null)

function toHistEntry (item: { executionArn: string; executionName?: string | null; status: string; startedAt?: string | null; stoppedAt?: string | null; error?: string | null; stepJobSks?: string | Record<string, string> | null }): HistEntry {
  let dd: string | null = null
  if (item.startedAt && item.stoppedAt) {
    const d = (new Date(item.stoppedAt).getTime() - new Date(item.startedAt).getTime()) / 1000
    if (d > 0) dd = formatDuration(d)
  }
  return { ...item, durationDisplay: dd }
}

function onRowClick (_event: Event, row: { item: PipelineRow }) {
  openDetail(row.item)
}

function openDetail (row: PipelineRow) {
  detailRow.value = row
  detailStartWeek.value = null
  detailEndWeek.value = null
  detailError.value = ''
  detailAlreadyRunning.value = false
  detailHist.value = []
  detailHistNext.value = null
  selectedHistEntry.value = null
  histRunState.value = null
  clearStepSelection()
  // nextTick ensures the dialog opens after the click event that triggered this
  // fully propagates — prevents the click-outside handler from immediately closing it
  nextTick(() => {
    detailOpen.value = true
    loadDetailHistory()
  })
}

async function loadDetailHistory () {
  if (!detailRow.value) return
  detailHistLoading.value = true
  try {
    const res = await listPipelineExecutionsByPipeline(detailRow.value.stateMachineArn, { limit: 15 })
    detailHist.value = res.items.map(toHistEntry)
    detailHistNext.value = res.nextToken ?? null
  } catch (e) { console.error('[pipeline] loadDetailHistory:', e) }
  finally { detailHistLoading.value = false }
}

async function loadMoreDetailHistory () {
  if (!detailRow.value || !detailHistNext.value) return
  detailHistLoading.value = true
  try {
    const res = await listPipelineExecutionsByPipeline(detailRow.value.stateMachineArn, { limit: 15, nextToken: detailHistNext.value })
    detailHist.value.push(...res.items.map(toHistEntry))
    detailHistNext.value = res.nextToken ?? null
  } catch (e) { console.error('[pipeline] loadMoreDetailHistory:', e) }
  finally { detailHistLoading.value = false }
}

async function launchFromDetail () {
  if (!detailRow.value) return
  detailLaunching.value = true
  detailError.value = ''
  detailAlreadyRunning.value = false
  try {
    const exec = await runPipelineFor(detailRow.value.stateMachineArn, {
      start_week: detailStartWeek.value ?? undefined,
      end_week: detailEndWeek.value ?? undefined,
    })
    if (!exec.ok && exec.status === 'RUNNING') {
      detailAlreadyRunning.value = true
      if (exec.executionArn) {
        detailRow.value.activeExecArn = exec.executionArn
        initActiveRun(detailRow.value.stateMachineArn, exec)
        startMonitoring()
      }
      return
    }
    if (!exec.ok) { detailError.value = exec.error || 'Failed to start pipeline.'; return }
    detailRow.value.activeExecArn = exec.executionArn!
    detailRow.value.sortKey = 0
    // Remove any stale entry so initActiveRun builds fresh stage statuses
    activeRuns.delete(detailRow.value.stateMachineArn)
    initActiveRun(detailRow.value.stateMachineArn, exec)
    startMonitoring()
    // Refresh execution history to show the new run
    await loadDetailHistory()
  } catch (e: unknown) { detailError.value = e instanceof Error ? e.message : String(e) }
  finally { detailLaunching.value = false }
}

const execErrorOpen = ref(false)
const execErrorText = ref('')
function showExecError (h: HistEntry) { execErrorText.value = h.error || 'No details.'; execErrorOpen.value = true }
// When the user clicks a history row, we fetch the pipeline status for that
// execution and reconstruct a synthetic ActiveRunState to drive the diagram.

const selectedHistEntry = ref<HistEntry | null>(null)
const histStagesLoading = ref(false)

// Synthetic stageStatuses/stageErrors/stageJobs built from a historical execution.
const histRunState = ref<{ stageStatuses: Record<string, StageStatus>; stageErrors: Record<string, string>; stageJobs: Record<string, StageJobDetail> } | null>(null)

// Per-step job detail carried from historical match queries.
interface StageJobDetail {
  SK: string
  started_at: string
  completed_at?: string | null
  duration_seconds?: number | null
  rows_processed?: number | null
  error_message?: string | null
}

// The run to feed into buildDiagramNodes: live activeRun if no hist selection,
// historical synthetic state if a row is selected.
const diagramRun = computed<{ stageStatuses: Record<string, StageStatus>; stageErrors: Record<string, string>; stageJobs?: Record<string, StageJobDetail> } | null>(() => {
  if (selectedHistEntry.value && histRunState.value) return histRunState.value
  if (!detailRow.value) return null
  const live = activeRuns.get(detailRow.value.stateMachineArn)
  return live ?? null
})

// Flattened list of error messages visible in the diagram panel.
// AWSJSON fields from AppSync come back as raw JSON strings — parse them before use.
function parseStepJobSks (raw: unknown): Record<string, string> | null {
  if (!raw) return null
  if (typeof raw === 'object') return raw as Record<string, string>
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return null }
  }
  return null
}

// Map an execution-level status (SUCCEEDED/FAILED) to per-step guess when we
// only have the overall execution object (no individual job records yet).
function statusFromExec (execStatus: string): StageStatus {
  if (execStatus === 'SUCCEEDED') return 'SUCCESS'
  if (execStatus === 'FAILED') return 'FAILED'
  return 'RUNNING'
}

async function selectHistEntry (h: HistEntry) {
  // Toggle off if already selected
  if (selectedHistEntry.value?.executionArn === h.executionArn) {
    clearHistSelection()
    return
  }
  selectedHistEntry.value = h
  histRunState.value = null
  histStagesLoading.value = true

  try {
    const row = detailRow.value
    if (!row) return

    // Fetch the execution — this now returns pipelineJobSk + stepJobSks from the backend.
    const execStatus = await getPipelineStatus(h.executionArn)

    // stepJobSks is a map like { "attribute_postlogs": "ATTRIBUTE_POSTLOGS#uuid", ... }
    // AWSJSON fields come back from AppSync as raw JSON strings — parse with module-level helper.
    // Prefer the value from getPipelineStatus; fall back to what was stored on the HistEntry.
    const resolvedStepJobSks: Record<string, string> | null =
      parseStepJobSks(execStatus.stepJobSks) ?? parseStepJobSks(h.stepJobSks) ?? null

    // Build synthetic stage map from the steps defined on the pipeline.
    const stages: Record<string, StageStatus> = {}
    const errors: Record<string, string> = {}
    const stageJobs: Record<string, StageJobDetail> = {}

    // Default every step to PENDING — fast path / fallback will override with real data.
    // Using the execution-level status as default was wrong: steps that have no matching
    // analytics job (e.g. PipelineComplete) would inherit FAILED even if they never ran.
    for (const step of row.steps) {
      stages[step.name] = 'PENDING'
    }

    if (resolvedStepJobSks && Object.keys(resolvedStepJobSks).length > 0) {
      // ── Fast path: stepJobSks is authoritative — fetch every job in parallel,
      // then map each result back to the matching step chip.
      const normalize = (s: string) => s.replace(/[_\-\s.]/g, '').toLowerCase()

      const jobResults = await Promise.all(
        Object.entries(resolvedStepJobSks).map(async ([key, sk]) => {
          try {
            const job = await getAnalyticsJob(sk)
            return { key, job }
          } catch (e) {
            console.warn('[hist drill-down] getAnalyticsJob failed for', key, sk, e)
            return { key, job: null }
          }
        })
      )

      for (const { key, job } of jobResults) {
        if (!job) continue
        // Find the step whose name/path matches this backend key
        const step = row.steps.find((s) =>
          normalize(s.name) === normalize(key) ||
          normalize(s.path) === normalize(key) ||
          normalize(key).includes(normalize(s.name)) ||
          normalize(key).includes(normalize(s.path))
        )
        if (!step) {
          console.warn('[hist drill-down] no step found for stepJobSks key', key)
          continue
        }
        stages[step.name] = job.status === 'SUCCESS' ? 'SUCCESS' : job.status === 'FAILED' ? 'FAILED' : 'RUNNING'
        if (job.error_message) errors[step.name] = job.error_message
        stageJobs[step.name] = {
          SK: job.SK,
          started_at: job.started_at ?? '',
          completed_at: job.completed_at,
          duration_seconds: job.duration_seconds ?? null,
          rows_processed: job.rows_processed ?? null,
          error_message: job.error_message,
        }
      }
    } else {
      // ── Fallback: time-window heuristic (pre-deploy executions) ───────────
      if (h.startedAt) {
        const SK_PREFIXES = [
          'ATTRIBUTE_POSTLOGS', 'ATTRIBUTE_SALES_NUMBERS', 'ATTRIBUTE_SALES_TIME_BASIS',
          'ATTRIBUTE_WEBLOGS', 'BUILD_MASTER_DATASET', 'PIPELINE',
        ]
        const jobs = await listAnalyticsJobs({ limit: 50 })
        const startMs = new Date(h.startedAt).getTime()
        const endMs = h.stoppedAt ? new Date(h.stoppedAt).getTime() : Date.now()
        const windowJobs = jobs.items.filter((j) => {
          const jMs = new Date(j.started_at).getTime()
          return jMs >= startMs - 5_000 && jMs <= endMs + 5_000 && SK_PREFIXES.some((p) => j.SK.startsWith(p))
        })
        for (const step of row.steps) {
          const match = windowJobs.find((j) => stepMatchesUpdate(step, {
            PK: j.PK, SK: j.SK, type: j.type, status: j.status, job_id: j.job_id, started_at: j.started_at,
          }))
          if (match) {
            stages[step.name] = match.status === 'SUCCESS' ? 'SUCCESS' : match.status === 'FAILED' ? 'FAILED' : 'RUNNING'
            if (match.error_message) errors[step.name] = match.error_message
            stageJobs[step.name] = {
              SK: match.SK,
              started_at: match.started_at,
              completed_at: match.completed_at,
              duration_seconds: match.duration_seconds,
              rows_processed: match.rows_processed,
              error_message: match.error_message,
            }
          }
        }
      }
    }

    histRunState.value = { stageStatuses: reactive(stages), stageErrors: reactive(errors), stageJobs }
  } catch (e) {
    console.error('[hist drill-down] failed to load step statuses:', e)
    // Fall back to uniform status derived from the execution's overall status.
    const row = detailRow.value
    if (row) {
      const stages: Record<string, StageStatus> = {}
      const errors: Record<string, string> = {}
      const s = statusFromExec(h.status)
      for (const step of row.steps) stages[step.name] = s
      if (h.error) errors['_exec'] = h.error
      histRunState.value = { stageStatuses: reactive(stages), stageErrors: reactive(errors), stageJobs: {} }
    }
  } finally {
    histStagesLoading.value = false
  }
}

function clearHistSelection () {
  selectedHistEntry.value = null
  histRunState.value = null
  histStagesLoading.value = false
  clearStepSelection()
}

// ===================== STEP DETAIL PANEL =====================

const selectedStepName = ref<string | null>(null)
const selectedStepContext = ref<unknown>(null)
const stepContextLoading = ref(false)

const selectedStepDetail = computed(() => {
  if (!selectedStepName.value) return null
  const name = selectedStepName.value
  const run = diagramRun.value
  const status: StageStatus = run?.stageStatuses[name] ?? 'PENDING'
  const error = run?.stageErrors[name] ?? null
  const job = run?.stageJobs?.[name] ?? null
  return { name, status, error, job }
})

async function selectStep (stepName: string) {
  // Toggle off if already selected
  if (selectedStepName.value === stepName) {
    clearStepSelection()
    return
  }
  selectedStepName.value = stepName
  selectedStepContext.value = null
  stepContextLoading.value = false

  const jobSk = diagramRun.value?.stageJobs?.[stepName]?.SK
  if (!jobSk) return

  stepContextLoading.value = true
  try {
    const job = await getAnalyticsJob(jobSk)
    if (selectedStepName.value === stepName && job?.context) {
      selectedStepContext.value = typeof job.context === 'string' ? JSON.parse(job.context) : job.context
    }
  } catch {
    // context fetch failed — don't surface error, panel already shows error_message
  } finally {
    stepContextLoading.value = false
  }
}

function clearStepSelection () {
  selectedStepName.value = null
  selectedStepContext.value = null
  stepContextLoading.value = false
}

// ===================== JOB RUNS =====================

interface JobRecord {
  PK: string; SK: string; job_id: string; type: string; status: string; started_at: string
  completed_at?: string | null; duration_seconds?: number | null; rows_processed?: number | null; error_message?: string | null
}
const allJobs = ref<JobRecord[]>([])
const jobsLoading = ref(false)
const filterJobType = ref<string | null>(null)
const filterJobStatus = ref<string | null>(null)

const JOB_TYPE_LABELS: Record<string, string> = {
  PARSE_BUYSHEETS: 'Parse buysheets', PARSE_POSTLOGS: 'Parse postlogs (1)', PARSE_POSTLOGS_2: 'Parse postlogs (2)',
  INGEST_SALES: 'Ingest sales', PULL_GA: 'Pull GA', ATTRIBUTE_POSTLOGS: 'Attribute postlogs',
  ATTRIBUTE_SALES_NUMBERS: 'Attribute sales (numbers)', ATTRIBUTE_SALES_TIME_BASIS_2: 'Attribute sales (time basis)',
  ATTRIBUTE_WEBLOGS_STATION_FEATURES: 'Attribute weblogs', BUILD_MASTER_DATASET: 'Build master dataset',
}
const JOB_TYPE_COLORS: Record<string, string> = {
  PARSE_BUYSHEETS: 'blue-grey', PARSE_POSTLOGS: 'indigo', PARSE_POSTLOGS_2: 'deep-purple', INGEST_SALES: 'teal',
  PULL_GA: 'cyan', ATTRIBUTE_POSTLOGS: 'orange', ATTRIBUTE_SALES_NUMBERS: 'amber', ATTRIBUTE_SALES_TIME_BASIS_2: 'lime',
  ATTRIBUTE_WEBLOGS_STATION_FEATURES: 'brown', BUILD_MASTER_DATASET: 'deep-orange',
}
const JOB_TYPE_OPTIONS = Object.entries(JOB_TYPE_LABELS).map(([value, title]) => ({ value, title }))
const JOB_STATUS_OPTIONS = [{ title: 'Running', value: 'RUNNING' }, { title: 'Success', value: 'SUCCESS' }, { title: 'Failed', value: 'FAILED' }]

const TIMEZONE_OPTIONS = [
  { title: 'UTC', value: 'UTC' },
  { title: 'Eastern — New York (ET)', value: 'America/New_York' },
  { title: 'Central — Chicago (CT)', value: 'America/Chicago' },
  { title: 'Mountain — Denver (MT)', value: 'America/Denver' },
  { title: 'Mountain — Phoenix (no DST)', value: 'America/Phoenix' },
  { title: 'Pacific — Los Angeles (PT)', value: 'America/Los_Angeles' },
  { title: 'Alaska (AKT)', value: 'America/Anchorage' },
  { title: 'Hawaii (HT)', value: 'Pacific/Honolulu' },
  { title: 'Atlantic — Halifax (AT)', value: 'America/Halifax' },
  { title: 'Toronto (ET, Canada)', value: 'America/Toronto' },
  { title: 'London (GMT/BST)', value: 'Europe/London' },
  { title: 'Paris / Berlin (CET)', value: 'Europe/Paris' },
  { title: 'Sydney (AEDT)', value: 'Australia/Sydney' },
]
const jobTypeFilterOptions = computed(() => { const t = new Set(allJobs.value.map((j) => j.type)); return [...t].sort().map((x) => ({ title: JOB_TYPE_LABELS[x] ?? x, value: x })) })
const filteredJobs = computed(() => {
  let l = allJobs.value
  if (filterJobType.value) l = l.filter((j) => j.type === filterJobType.value)
  if (filterJobStatus.value) l = l.filter((j) => j.status === filterJobStatus.value)
  return l
})
const totalJobCount = computed(() => allJobs.value.length)
const runningJobCount = computed(() => allJobs.value.filter((j) => j.status === 'RUNNING').length)
const successJobCount = computed(() => allJobs.value.filter((j) => j.status === 'SUCCESS').length)
const failedJobCount = computed(() => allJobs.value.filter((j) => j.status === 'FAILED').length)
const jobHeaders = [
  { title: 'Type', key: 'type', sortable: true }, { title: 'Status', key: 'status', sortable: true, width: '120px' },
  { title: 'Started', key: 'started_at', sortable: true }, { title: 'Completed', key: 'completed_at', sortable: true },
  { title: 'Duration', key: 'duration_seconds', sortable: true }, { title: 'Rows', key: 'rows_processed', sortable: true, align: 'end' as const },
  { title: '', key: 'actions', sortable: false, width: '60px' },
]
function jobStatusColor (s: string): string { if (s === 'RUNNING') return 'warning'; if (s === 'SUCCESS') return 'success'; if (s === 'FAILED') return 'error'; return 'default' }
async function loadJobs () {
  jobsLoading.value = true
  try {
    const r = await listJobRuns({ limit: 200 })
    allJobs.value = r.items as JobRecord[]
  } catch (e) { console.error('[jobs]:', e) }
  finally { jobsLoading.value = false }
}
const jobErrorOpen = ref(false)
const jobErrorItem = ref<JobRecord | null>(null)
function openJobError (j: JobRecord) { jobErrorItem.value = j; jobErrorOpen.value = true }

// ===================== SCHEDULING =====================

interface ScheduleRecord {
  name: string
  scheduleExpression: string
  scheduleExpressionTimezone?: string | null
  state: string
  targetJobType?: string | null
  arn?: string | null
  createdAt?: string | null
  lastModificationDate?: string | null
}
const schedules = ref<ScheduleRecord[]>([])
const schedulesLoading = ref(false)
const scheduleSearch = ref('')
const scheduleHeaders = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Job type', key: 'targetJobType', sortable: true },
  { title: 'Schedule expression', key: 'scheduleExpression' },
  { title: 'TZ', key: 'scheduleExpressionTimezone', width: '140px' },
  { title: 'State', key: 'state', width: '90px' },
  { title: 'Modified', key: 'lastModificationDate', sortable: true },
  { title: '', key: 'actions', sortable: false, width: '100px' },
]
const filteredSchedules = computed(() => {
  if (!scheduleSearch.value) return schedules.value
  const q = scheduleSearch.value.toLowerCase()
  return schedules.value.filter((s) => s.name.toLowerCase().includes(q) || s.jobType.toLowerCase().includes(q))
})
const scheduleTogglingName = ref<string | null>(null)
const scheduleDeletingName = ref<string | null>(null)

async function loadSchedules () {
  schedulesLoading.value = true
  try {
    const r = await listAnalyticsJobSchedules({ limit: 100 })
    schedules.value = r.items as ScheduleRecord[]
  } catch (e) { console.error('[schedules]:', e) }
  finally { schedulesLoading.value = false }
}

async function toggleSchedule (item: ScheduleRecord) {
  scheduleTogglingName.value = item.name
  const nowEnabled = item.state !== 'ENABLED'
  try {
    const updated = await setAnalyticsJobScheduleState(item.name, nowEnabled)
    const idx = schedules.value.findIndex((s) => s.name === item.name)
    if (idx !== -1) schedules.value[idx] = { ...schedules.value[idx], state: updated.state }
  } catch (e) { console.error('[schedules] toggle:', e) }
  finally { scheduleTogglingName.value = null }
}

// Schedule form dialog
const scheduleDialogOpen = ref(false)
const scheduleEditMode = ref(false)
const scheduleFormSaving = ref(false)
const scheduleFormError = ref('')
const scheduleForm = reactive({
  name: '',
  scheduleExpression: '',
  scheduleExpressionTimezone: '',
  jobType: '',
  start_week: null as string | null,
  end_week: null as string | null,
  weeks_back: null as number | null,
})

function openNewSchedule () {
  scheduleEditMode.value = false
  scheduleFormError.value = ''
  scheduleForm.name = ''
  scheduleForm.scheduleExpression = ''
  scheduleForm.scheduleExpressionTimezone = ''
  scheduleForm.jobType = ''
  scheduleForm.start_week = null
  scheduleForm.end_week = null
  scheduleForm.weeks_back = null
  scheduleDialogOpen.value = true
}

function openEditSchedule (item: ScheduleRecord) {
  scheduleEditMode.value = true
  scheduleFormError.value = ''
  scheduleForm.name = item.name
  scheduleForm.scheduleExpression = item.scheduleExpression
  scheduleForm.scheduleExpressionTimezone = item.scheduleExpressionTimezone ?? ''
  scheduleForm.jobType = item.targetJobType ?? ''
  scheduleForm.start_week = null
  scheduleForm.end_week = null
  scheduleForm.weeks_back = null
  scheduleDialogOpen.value = true
}

async function saveSchedule () {
  scheduleFormError.value = ''
  if (!scheduleForm.name.trim()) { scheduleFormError.value = 'Name is required.'; return }
  if (!scheduleForm.scheduleExpression.trim()) { scheduleFormError.value = 'Schedule expression is required.'; return }
  if (!scheduleForm.jobType) { scheduleFormError.value = 'Job type is required.'; return }
  scheduleFormSaving.value = true
  try {
    const saved = await scheduleAnalyticsJob({
      name: scheduleForm.name.trim(),
      scheduleExpression: scheduleForm.scheduleExpression.trim(),
      scheduleExpressionTimezone: scheduleForm.scheduleExpressionTimezone || undefined,
      jobType: scheduleForm.jobType,
      start_week: scheduleForm.start_week ?? undefined,
      end_week: scheduleForm.end_week ?? undefined,
      weeks_back: scheduleForm.weeks_back ?? undefined,
    })
    const idx = schedules.value.findIndex((s) => s.name === saved.name)
    if (idx !== -1) schedules.value[idx] = saved as ScheduleRecord
    else schedules.value.unshift(saved as ScheduleRecord)
    scheduleDialogOpen.value = false
  } catch (e: unknown) { scheduleFormError.value = e instanceof Error ? e.message : String(e) }
  finally { scheduleFormSaving.value = false }
}

const scheduleDeleteOpen = ref(false)
const scheduleDeleteTarget = ref<ScheduleRecord | null>(null)

function confirmDeleteSchedule (item: ScheduleRecord) {
  scheduleDeleteTarget.value = item
  scheduleDeleteOpen.value = true
}

async function doDeleteSchedule () {
  if (!scheduleDeleteTarget.value) return
  const name = scheduleDeleteTarget.value.name
  scheduleDeletingName.value = name
  scheduleDeleteOpen.value = false
  try {
    await deleteAnalyticsJobSchedule(name)
    schedules.value = schedules.value.filter((s) => s.name !== name)
  } catch (e) { console.error('[schedules] delete:', e) }
  finally { scheduleDeletingName.value = null; scheduleDeleteTarget.value = null }
}

// ===================== COSTS =====================
interface AwsCostSummary { cached_at: string; from_cache: boolean; daily_flat: Array<{ date: string; total: number }>; daily_by_service: Array<{ service: string; data: Array<{ date: string; cost: number }> }>; monthly: Array<{ month: string; total: number; services: Array<{ service: string; cost: number }> }>; services_last30: Array<{ service: string; cost: number }> }
const costData = ref<AwsCostSummary | null>(null)
const costsLoading = ref(false)
async function loadCosts (refresh: boolean) { costsLoading.value = true; try { const d = await getAwsCosts({ refresh }); if (d) costData.value = d } catch (e) { console.error('[costs]:', e) } finally { costsLoading.value = false } }
const last30Total = computed(() => !costData.value ? '0.00' : costData.value.services_last30.reduce((s, x) => s + x.cost, 0).toFixed(2))
const currentMonthTotal = computed(() => { if (!costData.value?.monthly.length) return '0.00'; return [...costData.value.monthly].sort((a, b) => b.month.localeCompare(a.month))[0].total.toFixed(2) })
const previousMonthTotal = computed(() => { if (!costData.value?.monthly.length || costData.value.monthly.length < 2) return '0.00'; return [...costData.value.monthly].sort((a, b) => b.month.localeCompare(a.month))[1].total.toFixed(2) })
const svcHeaders = [{ title: 'Service', key: 'service' }, { title: 'Cost', key: 'cost', align: 'end' as const }, { title: '%', key: 'pct', align: 'end' as const }]
const svcRows = computed(() => { if (!costData.value) return []; const t = costData.value.services_last30.reduce((s, x) => s + x.cost, 0); return [...costData.value.services_last30].sort((a, b) => b.cost - a.cost).map((s) => ({ ...s, pct: t > 0 ? ((s.cost / t) * 100).toFixed(1) : '0.0' })) })
const monthlyHeaders = [{ title: 'Month', key: 'month' }, { title: 'Total', key: 'total', align: 'end' as const }, { title: 'Top services', key: 'topServices' }]
const monthlyRows = computed(() => { if (!costData.value) return []; return [...costData.value.monthly].sort((a, b) => b.month.localeCompare(a.month)).map((m) => ({ month: m.month, total: m.total, topServices: [...m.services].sort((a, b) => b.cost - a.cost).slice(0, 3).map((s) => `${s.service}: $${s.cost.toFixed(2)}`).join(', ') })) })
const dailyHeaders = [{ title: 'Date', key: 'date' }, { title: 'Total', key: 'total', align: 'end' as const }]
const dailyRows = computed(() => costData.value?.daily_flat ?? [])

// ===================== LIFECYCLE =====================
onMounted(() => { loadPipelines(); loadJobs(); loadSchedules(); loadCosts(false) })
onBeforeUnmount(() => stopMonitoring())
</script>

<style scoped>
.stryker-chart-card { background: rgba(255, 255, 255, 0.02); }
.stryker-chart-title { color: rgb(var(--v-theme-on-surface)); }
.stryker-accent-icon { color: rgb(var(--v-theme-secondary)); }
.error-pre { white-space: pre-wrap; word-break: break-word; }
.pipeline-table :deep(tr) { cursor: pointer; }

/* ---- Pipeline diagram ---- */
.pipeline-diagram {
  background: #f0f0f0;
  border: 1px solid #d0d0d0;
  border-radius: 10px;
  padding: 16px 20px;
  overflow-x: auto;
}
.pipeline-flow {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
  min-width: min-content;
}
.flow-arrow {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  color: #999;
}
.step-chip {
  display: inline-flex;
  align-items: center;
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 0.76rem;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
  border: 2px solid transparent;
  transition: all 0.2s;
  letter-spacing: 0.01em;
}
.step-idle {
  background: #ffffff;
  border-color: #c0c0c0;
  color: #555;
}
.step-running {
  background: #fff8e1;
  border-color: #f59e0b;
  color: #92400e;
  animation: pulse-border 1.5s ease-in-out infinite;
}
.step-success {
  background: #f0fdf4;
  border-color: #22c55e;
  color: #15803d;
}
.step-failed {
  background: #fef2f2;
  border-color: #ef4444;
  color: #b91c1c;
}

/* Parallel group */
.parallel-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
}
.parallel-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #888;
  margin-bottom: 5px;
  font-weight: 600;
}
.parallel-branches {
  display: flex;
  flex-direction: column;
  gap: 4px;
  border: 2px dashed #c0c0c0;
  border-radius: 10px;
  padding: 8px 10px;
  background: rgba(255,255,255,0.6);
}
.parallel-branch {
  font-size: 0.72rem;
  padding: 4px 10px;
}

@keyframes pulse-border {
  0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
  50%       { box-shadow: 0 0 0 5px rgba(245, 158, 11, 0); }
}
.stage-row + .stage-row { margin-top: 2px; }

/* History table row interaction */
.hist-table :deep(tbody tr.hist-row) { cursor: pointer; transition: background 0.15s; }
.hist-table :deep(tbody tr.hist-row:hover) { background: #f5f5f5; }
.hist-table :deep(tbody tr.hist-row-selected) { background: #e8f4fd !important; border-left: 3px solid #1976d2; }

/* Clickable step chip */
.step-clickable { cursor: pointer; }
.step-clickable:hover { filter: brightness(0.93); transform: translateY(-1px); }
.step-selected {
  outline: 2px solid #1976d2;
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(25, 118, 210, 0.15);
}

/* Step detail panel */
.step-detail-card {
  border-color: #1976d2 !important;
  border-radius: 8px !important;
}
.step-detail-pre {
  white-space: pre-wrap;
  word-break: break-word;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 4px;
  padding: 8px 10px;
  max-height: 260px;
  overflow-y: auto;
  font-family: 'Roboto Mono', monospace, monospace;
  font-size: 0.72rem;
  line-height: 1.5;
}
</style>
