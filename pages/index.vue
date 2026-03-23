<template>
  <v-container fluid class="pa-4">
    <v-row>
      <v-col cols="12">
        <h1 class="text-h4 font-weight-bold mb-1">
          <v-icon class="mr-2" size="32">mdi-view-dashboard</v-icon>
          Dashboard
        </h1>
        <p class="text-caption text-medium-emphasis d-flex align-center flex-wrap gap-1">
          <v-icon size="small">mdi-open-in-new</v-icon>
          <strong>Station detail popup:</strong> click any station bar (Queued by station, Top stations) or a station name in the table to open that station’s full detail.
        </p>
      </v-col>
    </v-row>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4" closable>
      {{ error }}
    </v-alert>

    <!-- Dashboard content is client-only to avoid hydration mismatch (week options, Vuetify IDs differ on server vs client) -->
    <ClientOnly>
      <template v-if="loading">
        <v-row justify="center" class="py-12">
          <v-progress-circular indeterminate color="primary" size="48" />
        </v-row>
      </template>

      <template v-else>
        <!-- Global toolbar: only dates and KPIs (affect all data) - black text for readability -->
        <v-card variant="flat" class="mb-4 pa-3 toolbar-card toolbar-dates-kpis rounded-lg">
        <div class="d-flex flex-wrap align-center gap-3 ga-2">
          <span class="text-caption text-uppercase font-weight-medium toolbar-dates-kpis-label">Dates</span>
          <v-select
            v-model="weekRangeStartIndex"
            :items="weekRangeOptions"
            item-title="label"
            item-value="index"
            density="compact"
            hide-details
            variant="outlined"
            class="toolbar-week-select"
            style="max-width: 160px"
            @update:model-value="clampWeekRange"
          />
          <span class="text-body-2 toolbar-dates-kpis-text">–</span>
          <v-select
            v-model="weekRangeEndIndex"
            :items="weekRangeOptions"
            item-title="label"
            item-value="index"
            density="compact"
            hide-details
            variant="outlined"
            class="toolbar-week-select"
            style="max-width: 160px"
            @update:model-value="clampWeekRange"
          />
          <v-divider vertical class="mx-1 stryker-toolbar-divider" />
          <span class="text-caption text-uppercase font-weight-medium stryker-toolbar-label">KPIs</span>
          <div class="d-flex align-center toolbar-kpi-switch">
            <v-switch
              v-model="useLift"
              hide-details
              density="compact"
              color="secondary"
              class="toolbar-kpi-switch-control"
            />
            <span class="text-caption toolbar-kpi-label toolbar-dates-kpis-text">Include lift</span>
          </div>
        </div>
      </v-card>

      <!-- Summary cards: Stryker palette - dark grey, white text, yellow accent -->
      <v-row class="mb-4">
        <v-col cols="12" sm="6" md="3">
          <v-card variant="flat" class="stryker-kpi-card rounded-lg">
            <v-card-text>
              <div class="text-caption stryker-kpi-label">Spots</div>
              <div class="text-h4 font-weight-bold stryker-kpi-value">{{ totals.spotsActual.toLocaleString() }}</div>
              <div
                class="text-caption font-weight-medium stryker-kpi-sub"
                style="margin-top: 2px"
              >
                {{ totals.spotsDeliveryPctText }}
              </div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6" md="3">
          <v-card variant="flat" class="stryker-kpi-card rounded-lg">
            <v-card-text>
              <div class="text-caption stryker-kpi-label">Spend</div>
              <div class="text-h4 font-weight-bold stryker-kpi-value">{{ formatCurrency(totals.spend) }}</div>
              <div class="text-caption font-weight-medium stryker-kpi-sub" style="margin-top: 2px">
                {{ formatCurrency(totals.plannedSpend) }} planned
              </div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6" md="3">
          <v-card variant="flat" class="stryker-kpi-card rounded-lg">
            <v-card-text>
              <div class="text-caption stryker-kpi-label mb-2">Calls</div>
              <v-row class="text-center">
                <v-col cols="4">
                  <div class="text-h5 font-weight-bold stryker-kpi-value">{{ callTotals.grossCalls.toLocaleString() }}</div>
                  <div class="text-caption stryker-kpi-sub">Gross</div>
                </v-col>
                <v-col cols="4">
                  <div class="text-h5 font-weight-bold stryker-kpi-value">{{ callTotals.queuedCalls.toLocaleString() }}</div>
                  <div class="text-caption stryker-kpi-sub">Queued</div>
                </v-col>
                <v-col cols="4">
                  <div class="text-h5 font-weight-bold stryker-kpi-value">{{ callTotals.writtenCount.toLocaleString() }}</div>
                  <div class="text-caption stryker-kpi-sub">Written</div>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6" md="3">
          <v-card variant="flat" class="stryker-kpi-card rounded-lg">
            <v-card-text>
              <div class="text-caption stryker-kpi-label">Overall CPM</div>
              <div class="text-h4 font-weight-bold stryker-kpi-value">{{ formatCPM(totals.overallCPM) }}</div>
              <div class="text-caption stryker-kpi-sub" style="margin-top: 2px">
                {{ (totals.audienceFb ?? 0).toLocaleString() }} imp.
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Web Lift Widget -->
      <v-row class="mb-4">
        <v-col cols="12">
          <v-card variant="outlined" class="stryker-chart-card">
            <v-card-title class="d-flex align-center flex-wrap ga-2 stryker-chart-title">
              <v-icon start size="small" class="stryker-accent-icon">mdi-web</v-icon>
              <span>Web Lift (attributed to TV spots)</span>
              <v-spacer />
              <v-btn
                icon
                size="small"
                variant="text"
                :disabled="webLiftCarousel === 0"
                @click="webLiftCarousel = Math.max(0, webLiftCarousel - 1)"
              >
                <v-icon>mdi-chevron-left</v-icon>
              </v-btn>
              <v-btn
                icon
                size="small"
                variant="text"
                :disabled="webLiftCarousel >= webLiftTotalSlides - 1"
                @click="webLiftCarousel = Math.min(webLiftTotalSlides - 1, webLiftCarousel + 1)"
              >
                <v-icon>mdi-chevron-right</v-icon>
              </v-btn>
            </v-card-title>
            <v-card-text>
              <p class="text-caption text-medium-emphasis mb-3">
                Web attribution metrics showing lift from TV spots for the selected week range.
              </p>
              <v-carousel
                v-model="webLiftCarousel"
                hide-delimiters
                :show-arrows="false"
                height="auto"
                class="web-lift-carousel"
              >
                <!-- Main metrics slide -->
                <v-carousel-item>
                  <div class="pa-2">
                    <h4 class="text-subtitle-2 mb-3">Main Metrics</h4>
                    <v-row>
                      <v-col cols="12" sm="4">
                        <v-card variant="flat" class="stryker-kpi-card rounded-lg">
                          <v-card-text>
                            <div class="text-caption stryker-kpi-label">Views</div>
                            <div class="text-h4 font-weight-bold stryker-kpi-value">{{ webLiftTotals.liftViews.toLocaleString() }}</div>
                          </v-card-text>
                        </v-card>
                      </v-col>
                      <v-col cols="12" sm="4">
                        <v-card variant="flat" class="stryker-kpi-card rounded-lg">
                          <v-card-text>
                            <div class="text-caption stryker-kpi-label">Sessions</div>
                            <div class="text-h4 font-weight-bold stryker-kpi-value">{{ webLiftTotals.liftSessions.toLocaleString() }}</div>
                          </v-card-text>
                        </v-card>
                      </v-col>
                      <v-col cols="12" sm="4">
                        <v-card variant="flat" class="stryker-kpi-card rounded-lg">
                          <v-card-text>
                            <div class="text-caption stryker-kpi-label">Active Users</div>
                            <div class="text-h4 font-weight-bold stryker-kpi-value">{{ webLiftTotals.liftActiveUsers.toLocaleString() }}</div>
                          </v-card-text>
                        </v-card>
                      </v-col>
                    </v-row>
                  </div>
                </v-carousel-item>
                <!-- Goal performance slides (multiple goals per slide) -->
                <v-carousel-item v-for="(goalChunk, chunkIndex) in webLiftGoalChunks" :key="`chunk-${chunkIndex}`">
                  <div class="pa-2">
                    <h4 class="text-subtitle-2 mb-3">Goal Performance</h4>
                    <v-row>
                      <v-col
                        v-for="goal in goalChunk"
                        :key="goal.key"
                        cols="12"
                        sm="6"
                        md="4"
                      >
                        <v-card variant="flat" class="stryker-kpi-card rounded-lg">
                          <v-card-text>
                            <div class="text-caption stryker-kpi-label">{{ goal.name }}</div>
                            <div class="text-h4 font-weight-bold stryker-kpi-value">{{ goal.value.toLocaleString() }}</div>
                            <div class="text-caption stryker-kpi-sub" style="margin-top: 2px">
                              Lift attributed
                            </div>
                          </v-card-text>
                        </v-card>
                      </v-col>
                    </v-row>
                  </div>
                </v-carousel-item>
              </v-carousel>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Queued calls bar charts -->
      <v-row class="mb-4">
        <v-col cols="12" md="6">
          <v-card variant="outlined" class="stryker-chart-card">
            <v-card-title class="text-subtitle-1 d-flex align-center flex-wrap ga-2 stryker-chart-title">
              <v-icon start size="small" class="stryker-accent-icon">mdi-chart-bar</v-icon>
              <span>Queued calls by {{ queuedChartTitle }}</span>
              <v-btn-toggle
                v-model="queuedChartGroupBy"
                mandatory
                density="compact"
                variant="outlined"
                class="ml-auto"
              >
                <v-btn value="rotation" size="small">Rotation</v-btn>
                <v-btn value="daypart" size="small">Day part</v-btn>
                <v-btn value="dow" size="small">DOW</v-btn>
              </v-btn-toggle>
            </v-card-title>
            <v-card-text>
              <ClientOnly>
                <QueuedCallsBarChart
                  :labels="queuedCallsRotationOrDayPartData?.labels ?? []"
                  :data="queuedCallsRotationOrDayPartData?.data ?? []"
                  :tooltip-context="queuedCallsRotationOrDayPartData?.tooltipContext"
                />
                <template #fallback>
                  <div class="pa-4 text-center text-medium-emphasis">Loading chart…</div>
                </template>
              </ClientOnly>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" md="6">
          <v-card variant="outlined" class="stryker-chart-card">
            <v-card-title class="text-subtitle-1 stryker-chart-title">
              <v-icon start size="small" class="stryker-accent-icon">mdi-chart-bar</v-icon>
              Queued calls by station
            </v-card-title>
            <v-card-text>
              <p class="text-caption text-medium-emphasis mb-2">
                <v-icon size="small" class="mr-1">mdi-cursor-default-click</v-icon>
                Click a bar to open that station’s detail popup.
              </p>
              <ClientOnly>
                <QueuedCallsBarChart
                  :labels="queuedCallsByStation?.labels ?? []"
                  :data="queuedCallsByStation?.data ?? []"
                  :on-bar-click="openStationDrillDown"
                />
                <template #fallback>
                  <div class="pa-4 text-center text-medium-emphasis">Loading chart…</div>
                </template>
              </ClientOnly>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Clearance: planned vs actual spots by station (or station + rotation), bonus breakout -->
      <v-row class="mb-4">
        <v-col cols="12">
          <v-card variant="outlined" class="stryker-chart-card">
            <v-card-title class="text-subtitle-1 d-flex align-center flex-wrap ga-2 stryker-chart-title">
              <v-icon start size="small" class="stryker-accent-icon">mdi-chart-timeline-variant</v-icon>
              <span>Clearance (planned vs actual)</span>
              <v-select
                v-model="clearanceStationFilter"
                :items="clearanceStations"
                label="Station"
                placeholder="All stations"
                clearable
                density="compact"
                hide-details
                class="clearance-station-filter"
                style="max-width: 220px"
              />
              <v-btn-toggle
                v-model="clearanceByStationAndRotation"
                mandatory
                density="compact"
                variant="outlined"
                class="ml-auto"
              >
                <v-btn :value="false" size="small">By Station</v-btn>
                <v-btn :value="true" size="small">Station + Rotation</v-btn>
              </v-btn-toggle>
            </v-card-title>
            <v-card-text>
              <p class="text-caption text-medium-emphasis mb-2">
                Clearance % = spots that ran ÷ spots planned. Paid = ran with cost &gt; 0; Bonus = ran with 0 cost. Rotations with 0 planned but spots that ran show as 100%.
              </p>
              <ClientOnly>
                <ClearanceChart
                  :rows="clearanceDataFiltered"
                  :clickable-station-labels="!clearanceByStationAndRotation"
                  @station-click="onClearanceStationClick"
                />
                <template #fallback>
                  <div class="pa-4 text-center text-medium-emphasis">Loading chart…</div>
                </template>
              </ClientOnly>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- DOW × Rotation / Day part cross-tab -->
      <v-row class="mb-4">
        <v-col cols="12">
          <v-card variant="outlined" class="stryker-chart-card">
            <v-card-title class="text-subtitle-1 d-flex align-center flex-wrap ga-2 stryker-chart-title">
              <v-icon start size="small" class="stryker-accent-icon">mdi-table</v-icon>
              <span>Queued calls: DOW × {{ dowCrossTabUseRotation ? 'Rotation' : 'Day part' }}</span>
              <v-btn-toggle
                v-model="dowCrossTabUseRotation"
                mandatory
                density="compact"
                variant="outlined"
                class="ml-auto"
              >
                <v-btn :value="true" size="small">By Rotation</v-btn>
                <v-btn :value="false" size="small">By Day part</v-btn>
              </v-btn-toggle>
            </v-card-title>
            <v-card-text>
              <v-data-table
                v-if="dowCrossTab.rows.length"
                :headers="dowCrossTab.headers"
                :items="dowCrossTab.rows"
                item-value="dow"
                density="compact"
                class="elevation-0"
              >
                <template v-for="col in dowCrossTab.headers.slice(1)" :key="col.key" #[`item.${col.key}`]="{ item }">
                  {{ (item as Record<string, number>)[col.key]?.toLocaleString() ?? '0' }}
                </template>
              </v-data-table>
              <p v-else class="text-body-2 text-medium-emphasis mb-0 pa-4">
                No data for selected week range.
              </p>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Top rotations and top stations by KPI (queued calls) -->
      <v-row class="mb-4">
        <v-col cols="12" md="6">
          <v-card variant="outlined" class="stryker-chart-card">
            <v-card-title class="text-subtitle-1 stryker-chart-title">
              <v-icon start size="small" class="stryker-accent-icon">mdi-chart-bar</v-icon>
              Top rotations by queued calls
            </v-card-title>
            <v-card-text>
              <p class="text-caption text-medium-emphasis mb-2">
                Ranked by queued calls (KPI). Hover for gross and written.
              </p>
              <ClientOnly>
                <TopKpiBarChart :items="topRotationsByKpi" />
                <template #fallback>
                  <div class="pa-4 text-center text-medium-emphasis">Loading chart…</div>
                </template>
              </ClientOnly>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" md="6">
          <v-card variant="outlined" class="stryker-chart-card">
            <v-card-title class="text-subtitle-1 stryker-chart-title">
              <v-icon start size="small" class="stryker-accent-icon">mdi-chart-bar</v-icon>
              Top stations by queued calls
            </v-card-title>
            <v-card-text>
              <p class="text-caption text-medium-emphasis mb-2">
                Ranked by queued calls (KPI). Click a bar to open station drill-down.
              </p>
              <ClientOnly>
                <TopKpiBarChart :items="topStationsByKpi" :on-bar-click="openStationDrillDown" />
                <template #fallback>
                  <div class="pa-4 text-center text-medium-emphasis">Loading chart…</div>
                </template>
              </ClientOnly>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Queued calls per spot over time (efficiency with frequency) -->
      <v-row class="mb-4">
        <v-col cols="12">
          <v-card variant="outlined" class="stryker-chart-card">
            <v-card-title class="text-subtitle-1 stryker-chart-title">
              <v-icon start size="small" class="stryker-accent-icon">mdi-chart-line</v-icon>
              Queued calls per spot over time
            </v-card-title>
            <v-card-text>
              <p class="text-caption text-medium-emphasis mb-2">
                Minute-to-minute by spot air <strong>date_time</strong> (not week). Queued calls ÷ actual spots for each spot in the selected week range.
              </p>
              <ClientOnly>
                <QueuedPerSpotOverTimeChart :points="queuedPerSpotOverTime" />
                <template #fallback>
                  <div class="pa-4 text-center text-medium-emphasis">Loading chart…</div>
                </template>
              </ClientOnly>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Sales data gut check: attributable + non-attributable totals -->
      <v-row class="mb-4">
        <v-col cols="12">
          <v-card variant="outlined" class="stryker-chart-card">
            <v-card-title class="text-subtitle-1 d-flex align-center flex-wrap ga-2 stryker-chart-title">
              <v-icon start size="small" class="stryker-accent-icon">mdi-phone-in-talk</v-icon>
              <span>Sales data (gut check)</span>
              <v-btn-toggle
                v-model="salesGutCheckView"
                mandatory
                density="compact"
                variant="outlined"
                class="ml-auto"
              >
                <v-btn value="summary" size="small">Summary</v-btn>
                <v-btn value="station" size="small">By station</v-btn>
                <v-btn value="tfn" size="small">TFN active</v-btn>
              </v-btn-toggle>
            </v-card-title>
            <v-card-text>
              <p class="text-caption text-medium-emphasis mb-3">
                Totals for selected week range. Attributable = calls tied to spots; Non-attributable = sales not tied to spots.
              </p>
              <v-table v-if="salesGutCheckView === 'summary'" density="compact" class="sales-gut-check-table">
                <thead>
                  <tr>
                    <th class="text-left">Source</th>
                    <th class="text-right">Gross calls</th>
                    <th class="text-right">Queued calls</th>
                    <th class="text-right">Written</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Attributable</td>
                    <td class="text-right">{{ salesGutCheck.attributable.grossCalls.toLocaleString() }}</td>
                    <td class="text-right">{{ salesGutCheck.attributable.queuedCalls.toLocaleString() }}</td>
                    <td class="text-right">{{ salesGutCheck.attributable.writtenCount.toLocaleString() }}</td>
                  </tr>
                  <tr>
                    <td>Non-attributable</td>
                    <td class="text-right">{{ salesGutCheck.nonAttributable.grossCalls.toLocaleString() }}</td>
                    <td class="text-right">{{ salesGutCheck.nonAttributable.queuedCalls.toLocaleString() }}</td>
                    <td class="text-right">{{ salesGutCheck.nonAttributable.writtenCount.toLocaleString() }}</td>
                  </tr>
                  <tr class="font-weight-bold">
                    <td>Total</td>
                    <td class="text-right">{{ salesGutCheck.total.grossCalls.toLocaleString() }}</td>
                    <td class="text-right">{{ salesGutCheck.total.queuedCalls.toLocaleString() }}</td>
                    <td class="text-right">{{ salesGutCheck.total.writtenCount.toLocaleString() }}</td>
                  </tr>
                </tbody>
              </v-table>
              <v-table v-else-if="salesGutCheckView === 'station'" density="compact" class="sales-gut-check-table">
                <thead>
                  <tr>
                    <th class="text-left">Station</th>
                    <th class="text-right">Gross</th>
                    <th class="text-right">Queued</th>
                    <th class="text-right">Written</th>
                    <th class="text-right">Source</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in salesByStation" :key="row.station + row.source">
                    <td>{{ row.station || '—' }}</td>
                    <td class="text-right">{{ row.grossCalls.toLocaleString() }}</td>
                    <td class="text-right">{{ row.queuedCalls.toLocaleString() }}</td>
                    <td class="text-right">{{ row.writtenCount.toLocaleString() }}</td>
                    <td class="text-right text-caption">{{ row.source }}</td>
                  </tr>
                </tbody>
              </v-table>
              <v-table v-else density="compact" class="sales-gut-check-table">
                <thead>
                  <tr>
                    <th class="text-left">TFN active</th>
                    <th class="text-right">Gross</th>
                    <th class="text-right">Queued</th>
                    <th class="text-right">Written</th>
                    <th class="text-right">Spots attributed</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in salesByTfn" :key="String(row.tfnActive)">
                    <td>{{ row.tfnActive ? 'Yes' : 'No' }}</td>
                    <td class="text-right">{{ row.grossCalls.toLocaleString() }}</td>
                    <td class="text-right">{{ row.queuedCalls.toLocaleString() }}</td>
                    <td class="text-right">{{ row.writtenCount.toLocaleString() }}</td>
                    <td class="text-right">{{ row.spotsAttributed.toLocaleString() }}</td>
                  </tr>
                </tbody>
              </v-table>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Call center performance: queued/gross, written/gross, written/queued · whole week / by week / by hour -->
      <v-row class="mb-4">
        <v-col cols="12">
          <v-card variant="outlined" class="stryker-chart-card">
            <v-card-title class="d-flex align-center flex-wrap ga-2 stryker-chart-title">
              <v-icon start size="small" class="stryker-accent-icon">mdi-phone-check</v-icon>
              <span>Call center performance</span>
              <v-btn-toggle
                v-model="callCenterActivityMode"
                mandatory
                density="compact"
                variant="outlined"
                class="ml-2"
              >
                <v-btn value="attributed" size="small">Attributed</v-btn>
                <v-btn value="attributed_lift" size="small">Attributed + lift</v-btn>
                <v-btn value="total" size="small">Total</v-btn>
              </v-btn-toggle>
              <v-spacer />
              <v-btn
                icon
                size="small"
                variant="text"
                :disabled="callCenterCarousel === 0"
                @click="callCenterCarousel = Math.max(0, callCenterCarousel - 1)"
              >
                <v-icon>mdi-chevron-left</v-icon>
              </v-btn>
              <v-btn
                icon
                size="small"
                variant="text"
                :disabled="callCenterCarousel === 2"
                @click="callCenterCarousel = Math.min(2, callCenterCarousel + 1)"
              >
                <v-icon>mdi-chevron-right</v-icon>
              </v-btn>
            </v-card-title>
            <v-card-text>
              <p class="text-caption text-medium-emphasis mb-3">
                Ratios: Queued : Gross, Written : Gross, Written : Queued. Whole week = selected range total; by DOW = per day of week; by hour = hour of day (0–23). Total = attributable + non-attributable; by hour for Total uses attributable only.
              </p>
              <v-carousel
                v-model="callCenterCarousel"
                hide-delimiters
                :show-arrows="false"
                height="auto"
                class="call-center-carousel"
              >
                <v-carousel-item>
                  <div class="pa-2 call-center-whole-slide">
                    <h4 class="text-subtitle-2 mb-2">Whole week (selected range)</h4>
                    <div class="d-flex flex-wrap gap-4 justify-center">
                      <div class="call-center-kpi-card">
                        <div class="text-caption text-medium-emphasis">Queued : Gross</div>
                        <div class="text-h5">{{ callCenterRatios(callCenterWholeCurrent).queuedOfGross.toFixed(1) }}%</div>
                      </div>
                      <div class="call-center-kpi-card">
                        <div class="text-caption text-medium-emphasis">Written : Gross</div>
                        <div class="text-h5">{{ callCenterRatios(callCenterWholeCurrent).writtenOfGross.toFixed(1) }}%</div>
                      </div>
                      <div class="call-center-kpi-card">
                        <div class="text-caption text-medium-emphasis">Written : Queued</div>
                        <div class="text-h5">{{ callCenterRatios(callCenterWholeCurrent).writtenOfQueued.toFixed(1) }}%</div>
                      </div>
                    </div>
                    <p class="text-caption mt-2 text-disabled text-center">
                      Gross: {{ callCenterWholeCurrent.gross.toLocaleString() }} ·
                      Queued: {{ callCenterWholeCurrent.queued.toLocaleString() }} ·
                      Written: {{ callCenterWholeCurrent.written.toLocaleString() }}
                    </p>
                  </div>
                </v-carousel-item>
                <v-carousel-item>
                  <div class="pa-2">
                    <h4 class="text-subtitle-2 mb-2">By DOW</h4>
                    <v-table density="compact" class="call-center-table">
                      <thead>
                        <tr>
                          <th class="text-left">Day</th>
                          <th class="text-right">Queued : Gross</th>
                          <th class="text-right">Written : Gross</th>
                          <th class="text-right">Written : Queued</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="row in callCenterByDow" :key="row.dow">
                          <td>{{ row.dow }}</td>
                          <td class="text-right">{{ callCenterRatios(callCenterRowTotals(row)).queuedOfGross.toFixed(1) }}%</td>
                          <td class="text-right">{{ callCenterRatios(callCenterRowTotals(row)).writtenOfGross.toFixed(1) }}%</td>
                          <td class="text-right">{{ callCenterRatios(callCenterRowTotals(row)).writtenOfQueued.toFixed(1) }}%</td>
                        </tr>
                      </tbody>
                    </v-table>
                  </div>
                </v-carousel-item>
                <v-carousel-item>
                  <div class="pa-2">
                    <h4 class="text-subtitle-2 mb-2">By hour (0–23)</h4>
                    <p v-if="callCenterActivityMode === 'total'" class="text-caption text-warning mb-2">Total by hour uses attributable activity only (non-attributable has no hour breakdown).</p>
                    <v-table density="compact" class="call-center-table">
                      <thead>
                        <tr>
                          <th class="text-left">Hour</th>
                          <th class="text-right">Queued : Gross</th>
                          <th class="text-right">Written : Gross</th>
                          <th class="text-right">Written : Queued</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="row in callCenterByHourFiltered" :key="row.hour">
                          <td>{{ row.label }}</td>
                          <td class="text-right">{{ callCenterRatios(callCenterRowTotals(row)).queuedOfGross.toFixed(1) }}%</td>
                          <td class="text-right">{{ callCenterRatios(callCenterRowTotals(row)).writtenOfGross.toFixed(1) }}%</td>
                          <td class="text-right">{{ callCenterRatios(callCenterRowTotals(row)).writtenOfQueued.toFixed(1) }}%</td>
                        </tr>
                      </tbody>
                    </v-table>
                  </div>
                </v-carousel-item>
              </v-carousel>
              <div class="d-flex justify-center gap-2 mt-2">
                <v-btn size="small" variant="outlined" :color="callCenterCarousel === 0 ? 'primary' : undefined" @click="callCenterCarousel = 0; callCenterTimeView = 'whole'">Whole week</v-btn>
                <v-btn size="small" variant="outlined" :color="callCenterCarousel === 1 ? 'primary' : undefined" @click="callCenterCarousel = 1; callCenterTimeView = 'dow'">By DOW</v-btn>
                <v-btn size="small" variant="outlined" :color="callCenterCarousel === 2 ? 'primary' : undefined" @click="callCenterCarousel = 2; callCenterTimeView = 'hour'">By hour</v-btn>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Table: aggregated data with dynamic columns -->
      <v-row>
        <v-col cols="12">
          <v-card variant="outlined" class="stryker-chart-card">
            <v-card-title class="d-flex align-center flex-wrap gap-2 stryker-chart-title">
              <v-icon start size="small" class="stryker-accent-icon">mdi-table</v-icon>
              <span>{{ spotLevelView ? 'Spot-level data' : 'Attributable data (grouped)' }}</span>
              <v-chip size="small" variant="outlined">
                {{ filteredTableData.length }} of {{ (tableData ?? []).length }} rows
              </v-chip>
              <v-spacer />
              <v-text-field
                v-model="tableSearch"
                density="compact"
                hide-details
                placeholder="Search table..."
                prepend-inner-icon="mdi-magnify"
                clearable
                style="max-width: 220px"
                class="mr-2"
              />
              <v-menu location="bottom end" :close-on-content-click="false">
                <template #activator="{ props: menuProps }">
                  <v-btn v-bind="menuProps" variant="outlined" size="small">
                    <v-icon start>mdi-view-column</v-icon>
                    Columns
                  </v-btn>
                </template>
                <v-card min-width="240" class="pa-2">
                  <v-card-title class="text-subtitle-2 pa-2">Show columns</v-card-title>
                  <v-divider />
                  <v-list density="compact" class="py-0">
                    <v-list-item
                      v-for="col in allHeadersForView"
                      :key="col.key"
                      class="px-2"
                      @click="toggleColumn(col.key)"
                    >
                      <template #prepend>
                        <v-checkbox
                          :model-value="visibleColumns[col.key] !== false"
                          hide-details
                          density="compact"
                          @click.stop
                          @update:model-value="(v: boolean | null) => setColumnVisible(col.key, v === true)"
                        />
                      </template>
                      <v-list-item-title class="text-body-2">{{ col.title }}</v-list-item-title>
                    </v-list-item>
                  </v-list>
                </v-card>
              </v-menu>
              <v-btn variant="outlined" size="small" @click="downloadTableAsCsv">
                <v-icon start>mdi-download</v-icon>
                Download CSV
              </v-btn>
              <v-btn variant="outlined" size="small" :loading="loading" @click="refresh">
                <v-icon start>mdi-refresh</v-icon>
                Refresh
              </v-btn>
            </v-card-title>
            <!-- Table toolbar: view and group by (only affect this table) -->
            <div class="px-4 pb-3 pt-0 d-flex flex-wrap align-center gap-2 table-toolbar">
              <span class="text-caption text-medium-emphasis mr-2">
                <v-icon size="small" class="mr-1">mdi-cursor-default-click</v-icon>
                Click a station name to open its detail popup.
              </span>
              <v-divider vertical class="mx-1" />
              <span class="text-caption text-disabled">View</span>
              <v-btn
                :variant="spotLevelView ? 'tonal' : 'outlined'"
                size="small"
                density="comfortable"
                @click="spotLevelView = !spotLevelView"
              >
                Spot-level
              </v-btn>
              <v-btn
                :variant="!spotLevelView ? 'tonal' : 'outlined'"
                size="small"
                density="comfortable"
                @click="spotLevelView = false"
              >
                Grouped
              </v-btn>
              <template v-if="!spotLevelView">
                <span class="text-caption text-disabled ml-2">Group by</span>
                <v-chip
                  :variant="groupByWeek ? 'tonal' : 'outlined'"
                  size="small"
                  @click="groupByWeek = !groupByWeek"
                >
                  Week
                </v-chip>
                <v-chip
                  :variant="groupByStation ? 'tonal' : 'outlined'"
                  size="small"
                  @click="groupByStation = !groupByStation"
                >
                  Station
                </v-chip>
                <v-chip
                  :variant="groupByDow ? 'tonal' : 'outlined'"
                  size="small"
                  @click="groupByDow = !groupByDow"
                >
                  DOW
                </v-chip>
                <v-chip
                  :variant="groupByRotationFlag ? 'tonal' : 'outlined'"
                  size="small"
                  @click="setRotation(!groupByRotationFlag)"
                >
                  Rotation
                </v-chip>
                <v-chip
                  :variant="groupByDayPartFlag ? 'tonal' : 'outlined'"
                  size="small"
                  @click="setDayPart(!groupByDayPartFlag)"
                >
                  Day part
                </v-chip>
                <v-tooltip location="bottom" max-width="280">
                  <template #activator="{ props: tooltipProps }">
                    <v-icon v-bind="tooltipProps" size="small" color="disabled" class="ml-1">
                      mdi-information-outline
                    </v-icon>
                  </template>
                  <span>Rotation and Day part are mutually exclusive; selecting one clears the other.</span>
                </v-tooltip>
              </template>
            </div>
            <v-divider />
            <v-card-text class="pa-0">
              <v-data-table
                :headers="tableHeaders"
                :items="filteredTableData"
                :items-length="filteredTableData.length"
                item-value="__key"
                density="comfortable"
                class="dashboard-table"
                fixed-header
                height="480"
                :sort-by="[{ key: 'station', order: 'asc' }]"
              >
                <template #[`item.week`]="{ item }">
                  <span class="text-no-wrap">{{ item.week }}</span>
                </template>
                <template #[`item.station`]="{ item }">
                  <v-btn
                    variant="text"
                    size="small"
                    class="text-none px-0 min-w-0"
                    color="secondary"
                    :text="String((item as Record<string, unknown>).station ?? '—')"
                    @click="openStationDrillDown(String((item as Record<string, unknown>).station ?? ''))"
                  />
                </template>
                <template #[`item.cost_fb`]="{ item }">
                  {{ formatCurrency(Number(item.cost_fb) || 0) }}
                </template>
                <template #[`item.planned_spend`]="{ item }">
                  {{ formatCurrency(Number(item.planned_spend) ?? (Number(item.rate_planned) || 0) * (Number(item.spots_planned) || 0)) }}
                </template>
                <template #[`item.cpm_25_54_planned`]="{ item }">
                  {{ formatCPM(Number((item as Record<string, unknown>).cpm_25_54_planned) || 0) }}
                </template>
                <template #[`item.cpm_50plus_planned`]="{ item }">
                  {{ formatCPM(Number((item as Record<string, unknown>).cpm_50plus_planned) || 0) }}
                </template>
                <template #[`item.cpm_50plus_actual`]="{ item }">
                  {{ formatCPM(Number((item as Record<string, unknown>).cpm_50plus_actual) || 0) }}
                </template>
                <template #[`item.queued_per_cost`]="{ item }">
                  {{ formatRatio(Number(item.queued_per_cost) ?? 0) }}
                </template>
                <template #[`item.queued_per_spot`]="{ item }">
                  {{ formatRatio(Number(item.queued_per_spot) ?? 0) }}
                </template>
                <template #[`item.spots_planned`]="{ item }">
                  {{ formatNumber(Number(item.spots_planned) || 0) }}
                </template>
                <template #[`item.spots_actual`]="{ item }">
                  {{ formatNumber(Number(item.spots_actual) || 0) }}
                </template>
                <template #[`item.audience_actual`]="{ item }">
                  {{ formatNumber(Number(item.audience_actual) || 0) }}
                </template>
                <template #[`item.audience_fb`]="{ item }">
                  {{ formatNumber(Number(item.audience_fb) || 0) }}
                </template>
                <template #[`item.gross_calls`]="{ item }">
                  {{ formatNumber(Number(item.gross_calls) || 0) }}
                </template>
                <template #[`item.queued_calls`]="{ item }">
                  {{ formatNumber(Number(item.queued_calls) || 0) }}
                </template>
                <template #[`item.written_count`]="{ item }">
                  {{ formatNumber(Number(item.written_count) || 0) }}
                </template>
              </v-data-table>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Station drill-down popup: full detail for one station -->
      <v-dialog
        :model-value="!!drillDownStation"
        fullscreen
        transition="dialog-bottom-transition"
        scrollable
        class="station-drill-dialog"
        persistent
        @update:model-value="(v) => !v && closeStationDrillDown()"
      >
        <v-card v-if="drillDownStation" class="station-drill-card d-flex flex-column">
          <!-- Title bar: station name + close -->
          <v-card-title class="stryker-chart-title d-flex align-center py-3">
            <v-icon start size="small" class="stryker-accent-icon">mdi-broadcast</v-icon>
            <span class="flex-grow-1">Station detail: {{ drillDownStation }}</span>
            <v-btn
              icon
              variant="text"
              size="small"
              class="ml-2"
              aria-label="Close"
              @click="closeStationDrillDown"
            >
              <v-icon>mdi-close</v-icon>
            </v-btn>
          </v-card-title>
          <v-divider />
          <!-- Scrollable content -->
          <v-card-text class="station-drill-content flex-grow-1 pa-4">
            <p class="text-caption text-medium-emphasis mb-4">
              All metrics for this station in the selected week range. Close to return to the dashboard.
            </p>

            <!-- Station KPIs -->
            <h3 class="text-subtitle-1 font-weight-bold mb-2">Summary</h3>
            <v-row dense class="mb-4">
              <v-col cols="6">
                <v-card variant="tonal" class="stryker-kpi-card">
                  <v-card-text class="py-2 px-3">
                    <div class="text-caption stryker-kpi-label">Spots</div>
                    <div class="text-h6 font-weight-bold stryker-kpi-value">{{ stationTotals.spotsActual.toLocaleString() }}</div>
                    <div class="text-caption stryker-kpi-sub">{{ stationTotals.spotsDeliveryPctText }}</div>
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="6">
                <v-card variant="tonal" class="stryker-kpi-card">
                  <v-card-text class="py-2 px-3">
                    <div class="text-caption stryker-kpi-label">Spend</div>
                    <div class="text-h6 font-weight-bold stryker-kpi-value">{{ formatCurrency(stationTotals.spend) }}</div>
                    <div class="text-caption stryker-kpi-sub">{{ formatCurrency(stationTotals.plannedSpend) }} planned</div>
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="6">
                <v-card variant="tonal" class="stryker-kpi-card">
                  <v-card-text class="py-2 px-3">
                    <div class="text-caption stryker-kpi-label">Calls</div>
                    <div class="text-body-2 font-weight-bold stryker-kpi-value">
                      G {{ stationTotals.grossCalls.toLocaleString() }} · Q {{ stationTotals.queuedCalls.toLocaleString() }} · W {{ stationTotals.writtenCount.toLocaleString() }}
                    </div>
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="6">
                <v-card variant="tonal" class="stryker-kpi-card">
                  <v-card-text class="py-2 px-3">
                    <div class="text-caption stryker-kpi-label">CPM</div>
                    <div class="text-h6 font-weight-bold stryker-kpi-value">{{ formatCPM(stationTotals.overallCPM) }}</div>
                    <div class="text-caption stryker-kpi-sub">{{ (stationTotals.audienceFb ?? 0).toLocaleString() }} imp.</div>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>

            <!-- Clearance by rotation -->
            <h3 class="text-subtitle-1 font-weight-bold mb-2 mt-4">Clearance</h3>
            <v-card variant="outlined" class="mb-3">
              <v-card-title class="text-subtitle-2 stryker-chart-title py-2">
                <v-icon start size="small" class="stryker-accent-icon">mdi-chart-timeline-variant</v-icon>
                Planned vs actual by rotation
              </v-card-title>
              <v-card-text class="pt-0">
                <ClientOnly>
                  <ClearanceChart :rows="stationClearance" />
                  <template #fallback><div class="pa-2 text-medium-emphasis text-caption">Loading…</div></template>
                </ClientOnly>
              </v-card-text>
            </v-card>

            <!-- Queued calls by rotation / DOW / day part: same-size cards that fill the row, wrap on narrow -->
            <div class="d-flex flex-wrap ga-3 mb-3 drill-down-queued-row">
              <v-card variant="outlined" class="drill-down-queued-card">
                <v-card-title class="text-subtitle-2 stryker-chart-title py-2">
                  <v-icon start size="small" class="stryker-accent-icon">mdi-chart-bar</v-icon>
                  Queued calls by rotation
                </v-card-title>
                <v-card-text class="pt-0">
                  <ClientOnly>
                    <QueuedCallsBarChart
                      :labels="stationQueuedByRotation.labels"
                      :data="stationQueuedByRotation.data"
                      :dynamic-size="true"
                      :tooltip-context="stationQueuedByRotation.labels.map(() => drillDownStation ?? '')"
                    />
                    <template #fallback><div class="pa-2 text-caption">Loading…</div></template>
                  </ClientOnly>
                </v-card-text>
              </v-card>

              <v-card variant="outlined" class="drill-down-queued-card">
                <v-card-title class="text-subtitle-2 stryker-chart-title py-2">
                  <v-icon start size="small" class="stryker-accent-icon">mdi-chart-bar</v-icon>
                  Queued calls by DOW
                </v-card-title>
                <v-card-text class="pt-0">
                  <ClientOnly>
                    <QueuedCallsBarChart
                      :labels="stationQueuedByDow.labels"
                      :data="stationQueuedByDow.data"
                      :dynamic-size="true"
                    />
                    <template #fallback><div class="pa-2 text-caption">Loading…</div></template>
                  </ClientOnly>
                </v-card-text>
              </v-card>

              <v-card variant="outlined" class="drill-down-queued-card">
                <v-card-title class="text-subtitle-2 stryker-chart-title py-2">
                  <v-icon start size="small" class="stryker-accent-icon">mdi-chart-bar</v-icon>
                  Queued calls by day part
                </v-card-title>
                <v-card-text class="pt-0">
                  <ClientOnly>
                    <QueuedCallsBarChart
                      :labels="stationQueuedByDayPart.labels"
                      :data="stationQueuedByDayPart.data"
                      :dynamic-size="true"
                    />
                    <template #fallback><div class="pa-2 text-caption">Loading…</div></template>
                  </ClientOnly>
                </v-card-text>
              </v-card>
            </div>

            <!-- CPM by rotation -->
            <h3 class="text-subtitle-1 font-weight-bold mb-2 mt-4">CPMs</h3>
            <v-card variant="outlined" class="mb-3">
              <v-card-title class="text-subtitle-2 stryker-chart-title py-2 d-flex align-center">
                <v-icon start size="small" class="stryker-accent-icon">mdi-currency-usd</v-icon>
                <span class="flex-grow-1">CPM by rotation</span>
                <v-menu location="bottom end" :close-on-content-click="false">
                  <template #activator="{ props: menuProps }">
                    <v-btn v-bind="menuProps" variant="text" size="small" class="text-none">
                      <v-icon start size="small">mdi-view-column</v-icon>
                      Columns
                    </v-btn>
                  </template>
                  <v-card min-width="240" class="pa-2">
                    <v-card-title class="text-subtitle-2 pa-2">Show columns</v-card-title>
                    <v-divider />
                    <v-list density="compact" class="py-0">
                      <v-list-item class="px-2" @click="cpmColumnVisibility.cpm_25_54_planned = !cpmColumnVisibility.cpm_25_54_planned">
                        <template #prepend>
                          <v-checkbox
                            :model-value="cpmColumnVisibility.cpm_25_54_planned"
                            hide-details
                            density="compact"
                            @click.stop
                            @update:model-value="(v: boolean | null) => cpmColumnVisibility.cpm_25_54_planned = v === true"
                          />
                        </template>
                        <v-list-item-title class="text-body-2">CPM 35-54 planned</v-list-item-title>
                      </v-list-item>
                      <v-list-item class="px-2" @click="cpmColumnVisibility.cpm_50plus_planned = !cpmColumnVisibility.cpm_50plus_planned">
                        <template #prepend>
                          <v-checkbox
                            :model-value="cpmColumnVisibility.cpm_50plus_planned"
                            hide-details
                            density="compact"
                            @click.stop
                            @update:model-value="(v: boolean | null) => cpmColumnVisibility.cpm_50plus_planned = v === true"
                          />
                        </template>
                        <v-list-item-title class="text-body-2">CPM 50+ planned</v-list-item-title>
                      </v-list-item>
                      <v-list-item class="px-2" @click="cpmColumnVisibility.cpm_50plus_actual = !cpmColumnVisibility.cpm_50plus_actual">
                        <template #prepend>
                          <v-checkbox
                            :model-value="cpmColumnVisibility.cpm_50plus_actual"
                            hide-details
                            density="compact"
                            @click.stop
                            @update:model-value="(v: boolean | null) => cpmColumnVisibility.cpm_50plus_actual = v === true"
                          />
                        </template>
                        <v-list-item-title class="text-body-2">CPM 50+ actual</v-list-item-title>
                      </v-list-item>
                      <v-divider class="my-1" />
                      <v-list-item class="px-2" @click="cpmColumnVisibility.audience_fb = !cpmColumnVisibility.audience_fb">
                        <template #prepend>
                          <v-checkbox
                            :model-value="cpmColumnVisibility.audience_fb"
                            hide-details
                            density="compact"
                            @click.stop
                            @update:model-value="(v: boolean | null) => cpmColumnVisibility.audience_fb = v === true"
                          />
                        </template>
                        <v-list-item-title class="text-body-2">Audience FB (impressions)</v-list-item-title>
                      </v-list-item>
                      <v-list-item class="px-2" @click="cpmColumnVisibility.audience_actual = !cpmColumnVisibility.audience_actual">
                        <template #prepend>
                          <v-checkbox
                            :model-value="cpmColumnVisibility.audience_actual"
                            hide-details
                            density="compact"
                            @click.stop
                            @update:model-value="(v: boolean | null) => cpmColumnVisibility.audience_actual = v === true"
                          />
                        </template>
                        <v-list-item-title class="text-body-2">Audience actual</v-list-item-title>
                      </v-list-item>
                      <v-list-item class="px-2" @click="cpmColumnVisibility.viewership_25_54 = !cpmColumnVisibility.viewership_25_54">
                        <template #prepend>
                          <v-checkbox
                            :model-value="cpmColumnVisibility.viewership_25_54"
                            hide-details
                            density="compact"
                            @click.stop
                            @update:model-value="(v: boolean | null) => cpmColumnVisibility.viewership_25_54 = v === true"
                          />
                        </template>
                        <v-list-item-title class="text-body-2">Viewership 35-54</v-list-item-title>
                      </v-list-item>
                      <v-list-item class="px-2" @click="cpmColumnVisibility.viewership_a50_ = !cpmColumnVisibility.viewership_a50_">
                        <template #prepend>
                          <v-checkbox
                            :model-value="cpmColumnVisibility.viewership_a50_"
                            hide-details
                            density="compact"
                            @click.stop
                            @update:model-value="(v: boolean | null) => cpmColumnVisibility.viewership_a50_ = v === true"
                          />
                        </template>
                        <v-list-item-title class="text-body-2">Viewership 50+</v-list-item-title>
                      </v-list-item>
                    </v-list>
                  </v-card>
                </v-menu>
              </v-card-title>
              <v-card-text class="pt-0">
                <v-table density="compact">
                  <thead>
                    <tr>
                      <th class="text-left">Rotation</th>
                      <th v-if="cpmColumnVisibility.cpm_25_54_planned" class="text-right">CPM 35-54 planned</th>
                      <th v-if="cpmColumnVisibility.cpm_50plus_planned" class="text-right">CPM 50+ planned</th>
                      <th v-if="cpmColumnVisibility.cpm_50plus_actual" class="text-right">CPM 50+ actual</th>
                      <th v-if="cpmColumnVisibility.audience_fb" class="text-right">
                        <v-tooltip location="top" max-width="300">
                          <template #activator="{ props: tooltipProps }">
                            <span v-bind="tooltipProps" class="d-inline-flex align-center">
                              Audience FB (imp.)
                              <v-icon size="small" class="ml-1">mdi-information-outline</v-icon>
                            </span>
                          </template>
                          <span>Uses actual audience from postlogs when available, otherwise falls back to audience from planning data.</span>
                        </v-tooltip>
                      </th>
                      <th v-if="cpmColumnVisibility.audience_actual" class="text-right">Audience actual</th>
                      <th v-if="cpmColumnVisibility.viewership_25_54" class="text-right">Viewership 35-54</th>
                      <th v-if="cpmColumnVisibility.viewership_a50_" class="text-right">Viewership 50+</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in stationCpmByRotation" :key="row.rotation_fb">
                      <td>{{ row.rotation_fb }}</td>
                      <td v-if="cpmColumnVisibility.cpm_25_54_planned" class="text-right">{{ formatCPM(row.cpm_25_54_planned) }}</td>
                      <td v-if="cpmColumnVisibility.cpm_50plus_planned" class="text-right">{{ formatCPM(row.cpm_50plus_planned) }}</td>
                      <td v-if="cpmColumnVisibility.cpm_50plus_actual" class="text-right">{{ formatCPM(row.cpm_50plus_actual) }}</td>
                      <td v-if="cpmColumnVisibility.audience_fb" class="text-right">{{ (row.audience_fb * 1000).toLocaleString() }}</td>
                      <td v-if="cpmColumnVisibility.audience_actual" class="text-right">{{ row.audience_actual.toLocaleString() }}</td>
                      <td v-if="cpmColumnVisibility.viewership_25_54" class="text-right">{{ row.viewership_25_54.toLocaleString() }}</td>
                      <td v-if="cpmColumnVisibility.viewership_a50_" class="text-right">{{ row.viewership_a50_.toLocaleString() }}</td>
                    </tr>
                  </tbody>
                </v-table>
              </v-card-text>
            </v-card>

            <!-- DOW × Rotation -->
            <v-card variant="outlined" class="mb-3">
              <v-card-title class="text-subtitle-2 stryker-chart-title py-2">
                <v-icon start size="small" class="stryker-accent-icon">mdi-table</v-icon>
                DOW × Rotation (queued calls)
              </v-card-title>
              <v-card-text class="pt-0">
                <v-data-table
                  v-if="stationDowCrosstab.rows.length"
                  :headers="stationDowCrosstab.headers"
                  :items="stationDowCrosstab.rows"
                  density="compact"
                  class="elevation-0"
                />
                <p v-else class="text-caption text-medium-emphasis">No data</p>
              </v-card-text>
            </v-card>

            <!-- Queued per spot over time -->
            <h3 class="text-subtitle-1 font-weight-bold mb-2 mt-4">Over time</h3>
            <v-card variant="outlined" class="mb-3">
              <v-card-title class="text-subtitle-2 stryker-chart-title py-2">
                <v-icon start size="small" class="stryker-accent-icon">mdi-chart-line</v-icon>
                Queued per spot over time
              </v-card-title>
              <v-card-text class="pt-0">
                <ClientOnly>
                  <QueuedPerSpotOverTimeChart :points="stationQueuedPerSpotOverTime" />
                  <template #fallback><div class="pa-2 text-caption">Loading…</div></template>
                </ClientOnly>
              </v-card-text>
            </v-card>

            <!-- Individual spots table -->
            <h3 class="text-subtitle-1 font-weight-bold mb-2 mt-4">Individual spots</h3>
            <v-card variant="outlined" class="mb-3">
              <v-card-title class="text-subtitle-2 stryker-chart-title py-2">
                <v-icon start size="small" class="stryker-accent-icon">mdi-table</v-icon>
                Spot-level data ({{ stationSpotLevelTableData.length }} spots)
              </v-card-title>
              <v-card-text class="pt-0">
                <v-data-table
                  :headers="stationSpotTableHeaders"
                  :items="stationSpotLevelTableData"
                  item-value="__key"
                  density="compact"
                  class="elevation-0"
                  fixed-header
                  height="400"
                  :sort-by="[{ key: 'date_time', order: 'asc' }]"
                >
                  <template #[`item.cost_fb`]="{ item }">
                    {{ formatCurrency(Number((item as Record<string, unknown>).cost_fb) || 0) }}
                  </template>
                  <template #[`item.planned_spend`]="{ item }">
                    {{ formatCurrency(Number((item as Record<string, unknown>).planned_spend) ?? 0) }}
                  </template>
                  <template #[`item.cpm_25_54_planned`]="{ item }">
                    {{ formatCPM(Number((item as Record<string, unknown>).cpm_25_54_planned) || 0) }}
                  </template>
                  <template #[`item.cpm_50plus_planned`]="{ item }">
                    {{ formatCPM(Number((item as Record<string, unknown>).cpm_50plus_planned) || 0) }}
                  </template>
                  <template #[`item.cpm_50plus_actual`]="{ item }">
                    {{ formatCPM(Number((item as Record<string, unknown>).cpm_50plus_actual) || 0) }}
                  </template>
                  <template #[`item.queued_per_cost`]="{ item }">
                    {{ formatRatio(Number((item as Record<string, unknown>).queued_per_cost) ?? 0) }}
                  </template>
                  <template #[`item.queued_per_spot`]="{ item }">
                    {{ formatRatio(Number((item as Record<string, unknown>).queued_per_spot) ?? 0) }}
                  </template>
                </v-data-table>
              </v-card-text>
            </v-card>
          </v-card-text>
        </v-card>
      </v-dialog>
      </template>
      <template #fallback>
        <v-row justify="center" class="py-12">
          <v-progress-circular indeterminate color="primary" size="48" />
        </v-row>
      </template>
    </ClientOnly>
  </v-container>
</template>

<script setup lang="ts">
import type { AttributableRow, NonAttributableRow } from '~/types/dashboard'
import type { GroupKey } from '~/utils/aggregateAttributable'
import { aggregateBy, filterByWeekRange } from '~/utils/aggregateAttributable'
import { clearanceBy } from '~/utils/clearance'
import { DOW_ORDER, getNaiveDayOfWeek, getNaiveHour, naiveToTimestamp, normalizeDayOfWeek, parseDateTimeNaive } from '~/utils/dateHelpers'
import { isTfnStation } from '~/utils/tfnIsStation'

defineOptions({ name: 'DashboardIndex' })

const { attributable, nonAttributable, availableWeeks, loading, error, refresh, loadInitial, loadWeekRange } = useDashboardData()

// Spot-level = raw spots for week range (no grouping). When on, group toggles are disabled.
const spotLevelView = ref(false)

// Lift toggle: when on, KPIs use base + lift (gross_calls + lift_calls, queued_calls + lift_queued, written_count + lift_written) throughout.
const useLift = ref(true)
const liftVersion = ref(0)
function toggleLift () {
  const next = !useLift.value
  console.log('[lift] toggleLift called, useLift was', useLift.value, '->', next)
  useLift.value = next
  liftVersion.value += 1
}
watch(useLift, (val) => {
  console.log('[lift] watch(useLift) fired, useLift is now', val)
  liftVersion.value += 1
}, { flush: 'sync' })

// Call totals (Gross, Queued, Written) – sum over same rows as the Attributable data table so cards match table
const callTotals = computed(() => {
  void liftVersion.value
  const rows = tableFilteredData.value as AttributableRow[]
  let grossCalls = 0
  let queuedCalls = 0
  let writtenCount = 0
  for (const row of rows) {
    grossCalls += Number(row.gross_calls) || 0
    queuedCalls += Number(row.queued_calls) || 0
    writtenCount += Number(row.written_count) || 0
  }
  return {
    grossCalls: Math.round(grossCalls),
    queuedCalls: Math.round(queuedCalls),
    writtenCount: Math.round(writtenCount)
  }
})

const effectiveAttributableData = computed(() => {
  const raw = attributable.value.data as AttributableRow[]
  const includeLift = useLift.value
  if (!includeLift) return raw.slice() // new array so downstream computeds re-run when toggling
  return raw.map((r) => ({
    ...r,
    gross_calls: Math.round((Number(r.gross_calls) || 0) + (Number(r.lift_calls) || 0)),
    queued_calls: Math.round((Number(r.queued_calls) || 0) + (Number(r.lift_queued) || 0)),
    written_count: Math.round((Number(r.written_count) || 0) + (Number(r.lift_written) || 0))
  }))
})

// Grouping: default week + station. Rotation and day_part mutually exclusive (clicking one turns the other off).
const groupByWeek = ref(true)
const groupByStation = ref(true)
const groupByDow = ref(false)
const groupByRotationFlag = ref(false)
const groupByDayPartFlag = ref(false)

function setRotation (v: boolean) {
  groupByRotationFlag.value = v
  if (v) groupByDayPartFlag.value = false
}

function setDayPart (v: boolean) {
  groupByDayPartFlag.value = v
  if (v) groupByRotationFlag.value = false
}

const groupKeys = computed<GroupKey[]>(() => {
  const keys: GroupKey[] = []
  if (groupByWeek.value) keys.push('week')
  if (groupByStation.value) keys.push('station')
  if (groupByDow.value) keys.push('day_planned')
  if (groupByRotationFlag.value) keys.push('rotation_fb')
  if (groupByDayPartFlag.value) keys.push('day_part')
  return keys
})

// Week options from initial query (available_weeks in dataset); never show weeks without data
const allWeeks = computed(() => availableWeeks.value)

const weekRangeStartIndex = ref(0)
const weekRangeEndIndex = ref(0)

const weekRangeOptions = computed(() =>
  allWeeks.value.map((w, i) => ({ label: w, index: i }))
)

const selectedStartWeek = computed(() => allWeeks.value[weekRangeStartIndex.value] ?? '—')
const selectedEndWeek = computed(() => allWeeks.value[weekRangeEndIndex.value] ?? '—')

function clampWeekRange () {
  const len = allWeeks.value.length
  if (len === 0) return
  let a = weekRangeStartIndex.value
  let b = weekRangeEndIndex.value
  if (a > b) [a, b] = [b, a]
  a = Math.max(0, Math.min(a, len - 1))
  b = Math.max(0, Math.min(b, len - 1))
  weekRangeStartIndex.value = a
  weekRangeEndIndex.value = b
}

// Initial load: backend returns last 3 weeks of data + full list of available weeks
onMounted(() => { loadInitial() })

// When initial data arrives, default to showing only the latest week (1 week)
watch(
  () => allWeeks.value.length,
  (len) => {
    if (len > 0 && weekRangeEndIndex.value === 0 && weekRangeStartIndex.value === 0) {
      const lastIdx = len - 1
      weekRangeStartIndex.value = lastIdx
      weekRangeEndIndex.value = lastIdx
    }
    clampWeekRange()
  },
  { immediate: true }
)

// When user selects a range we don't have, fetch that range
const weeksInCurrentData = computed(() => new Set((attributable.value.data as AttributableRow[]).map((r) => String(r.week ?? '')).filter(Boolean)))
watch([selectedStartWeek, selectedEndWeek], () => {
  const start = selectedStartWeek.value
  const end = selectedEndWeek.value
  if (!start || !end || start === '—' || end === '—') return
  const haveStart = weeksInCurrentData.value.has(start)
  const haveEnd = weeksInCurrentData.value.has(end)
  if (!haveStart || !haveEnd) loadWeekRange(start, end)
})

// Filter by week range then aggregate (uses effective data when lift is on)
const filteredData = computed(() => {
  void liftVersion.value // force re-run when lift toggle changes so table/charts update
  const raw = effectiveAttributableData.value
  const start = selectedStartWeek.value
  const end = selectedEndWeek.value
  if (!start || !end) return []
  
  const filtered = filterByWeekRange(raw, start, end)
  
  // DEBUG week 2026-01-19: what we're counting (rows = data rows; spots = sum of spots_actual)
  if (import.meta.dev && start === '2026-01-19' && end === '2026-01-19') {
    const weekRows = filtered.filter((r: AttributableRow) => String(r.week ?? '') === '2026-01-19')
    const totalSpots = weekRows.reduce((sum: number, r: AttributableRow) => sum + (Number(r.spots_actual) || 0), 0)
    const uniqueWeeks = [...new Set(raw.map((r: AttributableRow) => r.week))].sort()
    console.log('[DEBUG filteredData] ROW COUNTS = number of data rows. SPOTS = sum of spots_actual.', {
      raw_row_count: raw.length,
      filtered_row_count: filtered.length,
      rows_with_week_20260119: weekRows.length,
      sum_spots_actual: totalSpots,
      selectedRange: `${start} to ${end}`,
      unique_weeks_in_raw: uniqueWeeks,
      sample: raw.slice(0, 5).map((r: AttributableRow) => ({ week: r.week, spots_actual: r.spots_actual }))
    })
  }
  
  return filtered
})

// Attributable data table: only rows where tfn_is_station === True
const tableFilteredData = computed(() =>
  filteredData.value.filter((r) => isTfnStation(r as Record<string, unknown>))
)

// Non-attributable data filtered by same week range (for sales gut check)
const nonAttributableFiltered = computed(() => {
  const raw = nonAttributable.value.data as NonAttributableRow[]
  const start = selectedStartWeek.value
  const end = selectedEndWeek.value
  if (!start || !end) return []
  return filterByWeekRange(raw as unknown as AttributableRow[], start, end)
})

// Sales gut check: totals from attributable + non-attributable
const salesGutCheckView = ref<'summary' | 'station' | 'tfn'>('summary')
const salesGutCheck = computed(() => {
  const attrib = filteredData.value as AttributableRow[]
  const nonAttrib = nonAttributableFiltered.value as NonAttributableRow[]
  let aGross = 0
  let aQueued = 0
  let aWritten = 0
  for (const r of attrib) {
    aGross += Number(r.gross_calls) || 0
    aQueued += Number(r.queued_calls) || 0
    aWritten += Number(r.written_count) || 0
  }
  let nGross = 0
  let nQueued = 0
  let nWritten = 0
  for (const r of nonAttrib) {
    nGross += Number(r.gross_calls) || 0
    nQueued += Number(r.queued_calls) || 0
    nWritten += Number(r.written_count) || 0
  }
  return {
    attributable: {
      grossCalls: Math.round(aGross),
      queuedCalls: Math.round(aQueued),
      writtenCount: Math.round(aWritten)
    },
    nonAttributable: {
      grossCalls: Math.round(nGross),
      queuedCalls: Math.round(nQueued),
      writtenCount: Math.round(nWritten)
    },
    total: {
      grossCalls: Math.round(aGross + nGross),
      queuedCalls: Math.round(aQueued + nQueued),
      writtenCount: Math.round(aWritten + nWritten)
    }
  }
})

// Call center performance: queued/gross, written/gross, written/queued for attributed / attributed+lift / total
type CallCenterTotals = { gross: number; queued: number; written: number }
function callCenterRatios (t: CallCenterTotals) {
  const { gross: g, queued: q, written: w } = t
  return {
    queuedOfGross: g > 0 ? (q / g) * 100 : 0,
    writtenOfGross: g > 0 ? (w / g) * 100 : 0,
    writtenOfQueued: q > 0 ? (w / q) * 100 : 0
  }
}

const callCenterWhole = computed(() => {
  const start = selectedStartWeek.value
  const end = selectedEndWeek.value
  const empty: CallCenterTotals = { gross: 0, queued: 0, written: 0 }
  if (!start || !end) return { attributed: empty, attributed_lift: empty, total: empty }
  const rawAttrib = attributable.value.data as AttributableRow[]
  const attribRows = filterByWeekRange(rawAttrib, start, end)
  const nonAttribRows = nonAttributableFiltered.value as NonAttributableRow[]
  let aG = 0; let aQ = 0; let aW = 0
  let aLiftG = 0; let aLiftQ = 0; let aLiftW = 0
  for (const r of attribRows) {
    const g = Number(r.gross_calls) || 0
    const q = Number(r.queued_calls) || 0
    const w = Number(r.written_count) || 0
    aG += g
    aQ += q
    aW += w
    const ru = r as unknown as Record<string, unknown>
    aLiftG += g + (Number(ru.lift_calls) || 0)
    aLiftQ += q + (Number(ru.lift_queued) || 0)
    aLiftW += w + (Number(ru.lift_written) || 0)
  }
  let nG = 0; let nQ = 0; let nW = 0
  for (const r of nonAttribRows) {
    nG += Number(r.gross_calls) || 0
    nQ += Number(r.queued_calls) || 0
    nW += Number(r.written_count) || 0
  }
  return {
    attributed: { gross: Math.round(aG), queued: Math.round(aQ), written: Math.round(aW) },
    attributed_lift: { gross: Math.round(aLiftG), queued: Math.round(aLiftQ), written: Math.round(aLiftW) },
    total: { gross: Math.round(aG + nG), queued: Math.round(aQ + nQ), written: Math.round(aW + nW) }
  }
})

const callCenterByWeek = computed(() => {
  const start = selectedStartWeek.value
  const end = selectedEndWeek.value
  if (!start || !end) return []
  const rawAttrib = attributable.value.data as AttributableRow[]
  const attribRows = filterByWeekRange(rawAttrib, start, end)
  const nonAttribRows = nonAttributableFiltered.value as NonAttributableRow[]
  const weekOrder = allWeeks.value.filter((w) => w >= start && w <= end)
  const byWeek = new Map<string, { aG: number; aQ: number; aW: number; aLiftG: number; aLiftQ: number; aLiftW: number; nG: number; nQ: number; nW: number }>()
  for (const w of weekOrder) {
    byWeek.set(w, { aG: 0, aQ: 0, aW: 0, aLiftG: 0, aLiftQ: 0, aLiftW: 0, nG: 0, nQ: 0, nW: 0 })
  }
  for (const r of attribRows) {
    const w = String(r.week ?? '')
    const entry = byWeek.get(w)
    if (!entry) continue
    const g = Number(r.gross_calls) || 0
    const q = Number(r.queued_calls) || 0
    const written = Number(r.written_count) || 0
    const ru = r as unknown as Record<string, unknown>
    entry.aG += g
    entry.aQ += q
    entry.aW += written
    entry.aLiftG += g + (Number(ru.lift_calls) || 0)
    entry.aLiftQ += q + (Number(ru.lift_queued) || 0)
    entry.aLiftW += written + (Number(ru.lift_written) || 0)
  }
  for (const r of nonAttribRows) {
    const w = String(r.week ?? '')
    const entry = byWeek.get(w)
    if (!entry) continue
    entry.nG += Number(r.gross_calls) || 0
    entry.nQ += Number(r.queued_calls) || 0
    entry.nW += Number(r.written_count) || 0
  }
  return weekOrder.map((week) => {
    const e = byWeek.get(week)!
    return {
      week,
      attributed: { gross: Math.round(e.aG), queued: Math.round(e.aQ), written: Math.round(e.aW) },
      attributed_lift: { gross: Math.round(e.aLiftG), queued: Math.round(e.aLiftQ), written: Math.round(e.aLiftW) },
      total: { gross: Math.round(e.aG + e.nG), queued: Math.round(e.aQ + e.nQ), written: Math.round(e.aW + e.nW) }
    }
  })
})

const callCenterByDow = computed(() => {
  const start = selectedStartWeek.value
  const end = selectedEndWeek.value
  if (!start || !end) return []
  const rawAttrib = attributable.value.data as AttributableRow[]
  const attribRows = filterByWeekRange(rawAttrib, start, end)
  const nonAttribRows = nonAttributableFiltered.value as NonAttributableRow[]
  const byDow = new Map<string, { aG: number; aQ: number; aW: number; aLiftG: number; aLiftQ: number; aLiftW: number; nG: number; nQ: number; nW: number }>()
  for (const d of DOW_ORDER) {
    byDow.set(d, { aG: 0, aQ: 0, aW: 0, aLiftG: 0, aLiftQ: 0, aLiftW: 0, nG: 0, nQ: 0, nW: 0 })
  }
  function getDow (r: AttributableRow): string {
    const d = String(r.dow_actual ?? '').trim()
    return d ? normalizeDayOfWeek(d) : '—'
  }
  for (const r of attribRows) {
    const d = getDow(r)
    const entry = byDow.get(d) ?? byDow.get('Mon')!
    const g = Number(r.gross_calls) || 0
    const q = Number(r.queued_calls) || 0
    const written = Number(r.written_count) || 0
    const ru = r as unknown as Record<string, unknown>
    entry.aG += g
    entry.aQ += q
    entry.aW += written
    entry.aLiftG += g + (Number(ru.lift_calls) || 0)
    entry.aLiftQ += q + (Number(ru.lift_queued) || 0)
    entry.aLiftW += written + (Number(ru.lift_written) || 0)
  }
  for (const r of nonAttribRows) {
    const ru = r as unknown as Record<string, unknown>
    let d = String(ru.day_of_week_actual ?? ru.dow_actual ?? '').trim()
    if (d) d = normalizeDayOfWeek(d)
    else {
      const naive = parseDateTimeNaive(ru.date_time)
      d = naive ? getNaiveDayOfWeek(naive) : '—'
    }
    const entry = byDow.get(d) ?? byDow.get('Mon')!
    entry.nG += Number(r.gross_calls) || 0
    entry.nQ += Number(r.queued_calls) || 0
    entry.nW += Number(r.written_count) || 0
  }
  return DOW_ORDER.map((dow) => {
    const e = byDow.get(dow)!
    return {
      dow,
      attributed: { gross: Math.round(e.aG), queued: Math.round(e.aQ), written: Math.round(e.aW) },
      attributed_lift: { gross: Math.round(e.aLiftG), queued: Math.round(e.aLiftQ), written: Math.round(e.aLiftW) },
      total: { gross: Math.round(e.aG + e.nG), queued: Math.round(e.aQ + e.nQ), written: Math.round(e.aW + e.nW) }
    }
  })
})

const callCenterByHour = computed(() => {
  const start = selectedStartWeek.value
  const end = selectedEndWeek.value
  if (!start || !end) return []
  const rawAttrib = attributable.value.data as AttributableRow[]
  const attribRows = filterByWeekRange(rawAttrib, start, end)
  const buckets: { aG: number; aQ: number; aW: number; aLiftG: number; aLiftQ: number; aLiftW: number }[] = Array.from({ length: 24 }, () => ({ aG: 0, aQ: 0, aW: 0, aLiftG: 0, aLiftQ: 0, aLiftW: 0 }))
  for (const r of attribRows) {
    const naive = parseDateTimeNaive(r.date_time)
    const hour = naive ? getNaiveHour(naive) : 0
    const safeHour = Math.min(23, Math.max(0, hour))
    const g = Number(r.gross_calls) || 0
    const q = Number(r.queued_calls) || 0
    const written = Number(r.written_count) || 0
    const ru = r as unknown as Record<string, unknown>
    const b = buckets[safeHour]
    b.aG += g
    b.aQ += q
    b.aW += written
    b.aLiftG += g + (Number(ru.lift_calls) || 0)
    b.aLiftQ += q + (Number(ru.lift_queued) || 0)
    b.aLiftW += written + (Number(ru.lift_written) || 0)
  }
  return buckets.map((b, hour) => ({
    hour,
    label: `${hour}:00`,
    attributed: { gross: Math.round(b.aG), queued: Math.round(b.aQ), written: Math.round(b.aW) },
    attributed_lift: { gross: Math.round(b.aLiftG), queued: Math.round(b.aLiftQ), written: Math.round(b.aLiftW) },
    total: { gross: Math.round(b.aG), queued: Math.round(b.aQ), written: Math.round(b.aW) }
  }))
})

// By-hour view: only rows where the current activity mode has at least one non-zero value
const callCenterByHourFiltered = computed(() => {
  const rows = callCenterByHour.value
  const mode = callCenterActivityMode.value
  return rows.filter((row) => {
    const t = row[mode]
    return (t.gross > 0) || (t.queued > 0) || (t.written > 0)
  })
})

const callCenterActivityMode = ref<'attributed' | 'attributed_lift' | 'total'>('total')
const callCenterTimeView = ref<'whole' | 'dow' | 'hour'>('whole')
const callCenterCarousel = ref(0)

watch(callCenterCarousel, (v) => {
  callCenterTimeView.value = (['whole', 'dow', 'hour'] as const)[v] ?? 'whole'
})

const callCenterWholeCurrent = computed(() => callCenterWhole.value[callCenterActivityMode.value])
function callCenterRowTotals (row: { attributed: CallCenterTotals; attributed_lift: CallCenterTotals; total: CallCenterTotals }) {
  return row[callCenterActivityMode.value]
}

// Sales by station (attributable and non-attributable rows grouped by station)
const salesByStation = computed(() => {
  const attrib = filteredData.value as AttributableRow[]
  const nonAttrib = nonAttributableFiltered.value
  const byKey = new Map<string, { station: string; source: string; grossCalls: number; queuedCalls: number; writtenCount: number }>()
  function add (station: string, source: string, gross: number, queued: number, written: number) {
    const key = `${station}\0${source}`
    const cur = byKey.get(key)
    if (cur) {
      cur.grossCalls += gross
      cur.queuedCalls += queued
      cur.writtenCount += written
    } else {
      byKey.set(key, { station, source, grossCalls: gross, queuedCalls: queued, writtenCount: written })
    }
  }
  for (const r of attrib) {
    const station = String(r.station ?? '').trim() || '—'
    const g = Number(r.gross_calls) || 0
    const q = Number(r.queued_calls) || 0
    const w = Number(r.written_count) || 0
    add(station, 'Attributable', g, q, w)
  }
  for (const r of nonAttrib) {
    const station = String(r.station ?? '').trim() || '—'
    const g = Number(r.gross_calls) || 0
    const q = Number(r.queued_calls) || 0
    const w = Number(r.written_count) || 0
    add(station, 'Non-attributable', g, q, w)
  }
  const out = Array.from(byKey.values()).sort((a, b) => (a.station + a.source).localeCompare(b.station + b.source))
  return out
})

// Sales by TFN active (attributable only; non-attributable has no is_tfn_active)
const salesByTfn = computed(() => {
  const attrib = filteredData.value as AttributableRow[]
  const yes: { grossCalls: number; queuedCalls: number; writtenCount: number; spotsAttributed: number } = { grossCalls: 0, queuedCalls: 0, writtenCount: 0, spotsAttributed: 0 }
  const no: { grossCalls: number; queuedCalls: number; writtenCount: number; spotsAttributed: number } = { grossCalls: 0, queuedCalls: 0, writtenCount: 0, spotsAttributed: 0 }
  for (const r of attrib) {
    const tfn = Number(r.is_tfn_active) !== 0
    const target = tfn ? yes : no
    target.grossCalls += Number(r.gross_calls) || 0
    target.queuedCalls += Number(r.queued_calls) || 0
    target.writtenCount += Number(r.written_count) || 0
    target.spotsAttributed += 1
  }
  return [
    { tfnActive: true, ...yes, grossCalls: Math.round(yes.grossCalls), queuedCalls: Math.round(yes.queuedCalls), writtenCount: Math.round(yes.writtenCount), spotsAttributed: yes.spotsAttributed },
    { tfnActive: false, ...no, grossCalls: Math.round(no.grossCalls), queuedCalls: Math.round(no.queuedCalls), writtenCount: Math.round(no.writtenCount), spotsAttributed: no.spotsAttributed }
  ]
})

const aggregatedData = computed(() => {
  const rows = aggregateBy(tableFilteredData.value, groupKeys.value)
  return rows.map((r, i) => ({ ...r, __key: `agg-${i}-${(r as Record<string, unknown>).week}-${(r as Record<string, unknown>).station}` }))
})

const spotLevelTableData = computed(() => {
  const expanded: Record<string, unknown>[] = []

  tableFilteredData.value.forEach((r, rowIndex) => {
    const spotsAct = Math.max(0, Math.round(Number(r.spots_actual) || 0))
    if (spotsAct <= 0) return

    const spotsPlan = Number(r.spots_planned) || 0
    const ratePlanned = Number(r.rate_planned) || 0
    const costFb = Number(r.cost_fb) || 0
    const audienceActual = Number(r.audience_actual) || 0
    const audienceFb = Number(r.audience_fb) || 0
    const grossCalls = Number(r.gross_calls) || 0
    const queuedCalls = Number(r.queued_calls) || 0
    const writtenCount = Number(r.written_count) || 0

    // Distribute aggregate metrics evenly so spot-level sums still match grouped totals.
    const spotsPlannedPerSpot = spotsPlan / spotsAct
    const costPerSpot = costFb / spotsAct
    const audienceActualPerSpot = audienceActual / spotsAct
    const audienceFbPerSpot = audienceFb / spotsAct
    const grossPerSpot = grossCalls / spotsAct
    const queuedPerSpot = queuedCalls / spotsAct
    const writtenPerSpot = writtenCount / spotsAct
    const plannedSpendPerSpot = spotsPlannedPerSpot * ratePlanned
    const queuedPerCost = costPerSpot > 0 ? queuedPerSpot / costPerSpot : 0

    for (let spotIndex = 0; spotIndex < spotsAct; spotIndex += 1) {
      expanded.push({
        ...r,
        __key: `spot-${rowIndex}-${r.attribution_id ?? rowIndex}-${spotIndex + 1}`,
        spots_actual: 1,
        spots_planned: spotsPlannedPerSpot,
        cost_fb: costPerSpot,
        audience_actual: audienceActualPerSpot,
        audience_fb: audienceFbPerSpot,
        gross_calls: grossPerSpot,
        queued_calls: queuedPerSpot,
        written_count: writtenPerSpot,
        planned_spend: plannedSpendPerSpot,
        queued_per_cost: queuedPerCost,
        queued_per_spot: queuedPerSpot
      })
    }
  })

  return expanded
})

const tableData = computed(() =>
  spotLevelView.value ? spotLevelTableData.value : aggregatedData.value
)

// Chart data: queued calls by rotation and by station (selected week range)
const queuedCallsByRotation = computed(() => {
  const raw = filteredData.value as (AttributableRow & { rotation_fb?: string; station?: string })[]
  const byRotation = new Map<string, { total: number; stations: Set<string> }>()
  for (const r of raw) {
    const rot = String(r.rotation_fb ?? '').trim()
    if (!rot) continue // exclude null/empty rotation from this chart
    const st = String(r.station ?? '').trim()
    if (!byRotation.has(rot)) byRotation.set(rot, { total: 0, stations: new Set() })
    const entry = byRotation.get(rot)!
    entry.total += Number(r.queued_calls) || 0
    if (st) entry.stations.add(st)
  }
  const labels = [...byRotation.keys()]
  const data = labels.map((rot) => byRotation.get(rot)!.total)
  const tooltipContext = labels.map((rot) => {
    const stations = [...(byRotation.get(rot)?.stations ?? [])].sort()
    if (stations.length === 0) return ''
    if (stations.length === 1) return `Station: ${stations[0]}`
    return `Stations: ${stations.join(', ')}`
  })
  return { labels, data, tooltipContext }
})

// Queued calls by station: only tfn_is_station === True, labels alphabetically
const queuedCallsByStation = computed(() => {
  const rows = aggregateBy(tableFilteredData.value, ['station'])
  const sorted = [...rows].sort((a, b) =>
    String((a as Record<string, unknown>).station ?? '').localeCompare(String((b as Record<string, unknown>).station ?? ''))
  )
  const labels = sorted.map((r) => String((r as Record<string, unknown>).station ?? '—'))
  const data = sorted.map((r) => Number(r.queued_calls) || 0)
  return { labels, data }
})

// Day part chart: only daypart_actual column, only standard labels, in display order (no rotation/time fallbacks like 9p-559p)
const DAY_PART_ORDER = ['Morning', 'Afternoon', 'Early Fringe', 'Primtime', 'Late Fringe', 'Overnight'] as const
const DAY_PART_SET = new Set<string>(DAY_PART_ORDER)
const queuedCallsByDayPart = computed(() => {
  const rows = filteredData.value as (AttributableRow & { daypart_actual?: string })[]
  const byPart = new Map<string, number>()
  for (const r of rows) {
    const dp = String(r.daypart_actual ?? '').trim()
    if (!dp || !DAY_PART_SET.has(dp)) continue
    byPart.set(dp, (byPart.get(dp) ?? 0) + (Number(r.queued_calls) || 0))
  }
  const labels = [...DAY_PART_ORDER]
  const data = labels.map((dp) => Math.round(byPart.get(dp) ?? 0))
  return { labels, data }
})

const queuedCallsByDow = computed(() => {
  const rows = aggregateBy(filteredData.value, ['dow_actual'])
  const labels = DOW_ORDER.filter((d) =>
    rows.some((r) => String((r as Record<string, unknown>).dow_actual ?? '') === d)
  )
  const data = labels.map((d) => {
    const r = rows.find((x) => String((x as Record<string, unknown>).dow_actual ?? '') === d)
    return r ? Number(r.queued_calls) || 0 : 0
  })
  return { labels, data }
})

// Toggle for left chart: rotation | day part | DOW
type QueuedChartGroupBy = 'rotation' | 'daypart' | 'dow'
const queuedChartGroupBy = ref<QueuedChartGroupBy>('rotation')
const queuedCallsRotationOrDayPartData = computed(() => {
  if (queuedChartGroupBy.value === 'rotation') return queuedCallsByRotation.value
  if (queuedChartGroupBy.value === 'daypart') return queuedCallsByDayPart.value
  return queuedCallsByDow.value
})
const queuedChartTitle = computed(() => {
  if (queuedChartGroupBy.value === 'rotation') return 'rotation'
  if (queuedChartGroupBy.value === 'daypart') return 'day part'
  return 'DOW'
})

// Clearance: planned vs actual by station (or station + rotation), bonus = 0 cost
const clearanceByStationAndRotation = ref(false)
const clearanceStationFilter = ref<string | null>(null)

// Station drill-down: when set, flyout shows all metrics for that station
const drillDownStation = ref<string | null>(null)
function openStationDrillDown (station: string) {
  const s = String(station ?? '').trim()
  if (s) drillDownStation.value = s
}
function closeStationDrillDown () {
  drillDownStation.value = null
}
const clearanceStations = computed(() => {
  const raw = filteredData.value as AttributableRow[]
  const set = new Set(raw.map((r) => String(r.station ?? '').trim()).filter(Boolean))
  return Array.from(set).sort()
})
const clearanceData = computed(() =>
  clearanceBy(filteredData.value as AttributableRow[], clearanceByStationAndRotation.value)
)
const clearanceDataFiltered = computed(() => {
  const rows = clearanceData.value
  const station = clearanceStationFilter.value?.trim()
  if (!station) return rows
  return rows.filter((r) => (r.station ?? '').trim() === station)
})

function onClearanceStationClick (station: string) {
  clearanceStationFilter.value = station.trim() || null
  clearanceByStationAndRotation.value = true
}

// Station drill-down: data and metrics for the selected station only (same week range)
const stationFilteredData = computed(() => {
  const s = drillDownStation.value?.trim()
  if (!s) return []
  return (filteredData.value as AttributableRow[]).filter((r) => String(r.station ?? '').trim() === s)
})
const stationCallTotals = computed(() => {
  const rows = stationFilteredData.value
  let grossCalls = 0
  let queuedCalls = 0
  let writtenCount = 0
  for (const row of rows) {
    if (!isTfnStation(row as Record<string, unknown>)) continue
    grossCalls += Number(row.gross_calls) || 0
    queuedCalls += Number(row.queued_calls) || 0
    writtenCount += Number(row.written_count) || 0
  }
  return { grossCalls: Math.round(grossCalls), queuedCalls: Math.round(queuedCalls), writtenCount: Math.round(writtenCount) }
})
const stationTotals = computed(() => {
  const rows = stationFilteredData.value
  const calls = stationCallTotals.value
  let spotsPlanned = 0
  let spotsActual = 0
  let spend = 0
  let plannedSpend = 0
  let audienceFb = 0
  for (const row of rows) {
    spotsPlanned += Number(row.spots_planned) || 0
    spotsActual += Number(row.spots_actual) || 0
    const spotsAct = Number(row.spots_actual) || 0
    const spotsPlan = Number(row.spots_planned) || 0
    if (spotsAct > 0) {
      spend += Number(row.cost_fb) || 0
      audienceFb += Number(row.audience_fb) || 0
    }
    if (spotsPlan > 0) {
      plannedSpend += (Number(row.rate_planned) || 0) * spotsPlan
    }
  }
  const spotsDeliveryPct = spotsPlanned > 0 ? Math.round((spotsActual / spotsPlanned) * 100) : 0
  return {
    spotsPlanned,
    spotsActual,
    spotsDeliveryPct,
    spotsDeliveryPctText: spotsPlanned > 0 ? `${spotsDeliveryPct}% cleared` : '—',
    spend,
    plannedSpend,
    grossCalls: calls.grossCalls,
    queuedCalls: calls.queuedCalls,
    writtenCount: calls.writtenCount,
    audienceFb,
    overallCPM: audienceFb > 0 ? spend / audienceFb : 0
  }
})
const stationClearance = computed(() =>
  clearanceBy(stationFilteredData.value as AttributableRow[], true)
)
const stationQueuedByRotation = computed(() => {
  const rows = aggregateBy(stationFilteredData.value as AttributableRow[], ['rotation_fb'])
  return {
    labels: rows.map((r) => String((r as Record<string, unknown>).rotation_fb ?? '—')),
    data: rows.map((r) => Number(r.queued_calls) || 0)
  }
})
const stationQueuedByDayPart = computed(() => {
  const rows = aggregateBy(stationFilteredData.value as AttributableRow[], ['day_part'])
  return {
    labels: rows.map((r) => String((r as Record<string, unknown>).day_part ?? '—')),
    data: rows.map((r) => Number(r.queued_calls) || 0)
  }
})
const stationQueuedByDow = computed(() => {
  const rows = aggregateBy(stationFilteredData.value as AttributableRow[], ['dow_actual'])
  const labels = DOW_ORDER.filter((d) =>
    rows.some((r) => String((r as Record<string, unknown>).dow_actual ?? '') === d)
  )
  const data = labels.map((d) => {
    const r = rows.find((x) => String((x as Record<string, unknown>).dow_actual ?? '') === d)
    return r ? Number(r.queued_calls) || 0 : 0
  })
  return { labels, data }
})
const stationDowCrosstab = computed(() => {
  const keys: GroupKey[] = ['dow_actual', 'rotation_fb']
  const rows = aggregateBy(stationFilteredData.value as AttributableRow[], keys)
  const dowSet = new Set(rows.map((r) => String((r as Record<string, unknown>).dow_actual ?? '')).filter(Boolean))
  const uniqueDows = DOW_ORDER.filter((d) => dowSet.has(d))
  const uniqueCols = [...new Set(rows.map((r) => String((r as Record<string, unknown>).rotation_fb ?? '')))].filter(Boolean).sort()
  const crossRows = uniqueDows.map((dow) => {
    const row: Record<string, string | number> = { dow }
    for (const col of uniqueCols) {
      const cell = rows.find(
        (r) =>
          String((r as Record<string, unknown>).dow_actual ?? '') === dow &&
          String((r as Record<string, unknown>).rotation_fb ?? '') === col
      )
      row[col] = cell ? Number(cell.queued_calls) || 0 : 0
    }
    return row
  })
  const headers = [
    { title: 'DOW', key: 'dow', sortable: true },
    ...uniqueCols.map((c) => ({ title: c, key: c, sortable: true, align: 'end' as const }))
  ]
  return { headers, rows: crossRows }
})
// Station spend distribution: cumulative spend over time, grouped by rotation/daypart/week (for station drill-down)
const stationSpendDistributionGroupBy = ref<'rotation' | 'daypart' | 'week'>('rotation')
const stationSpendDistributionPoints = computed(() => {
  const rows = stationFilteredData.value as AttributableRow[]
  const groupBy = stationSpendDistributionGroupBy.value
  const byTimeAndGroup = new Map<string, { dateTime: number; dateTimeLabel: string; groupKey: string; spend: number }>()
  
  for (const r of rows) {
    const naive = parseDateTimeNaive(r.date_time)
    const ts = naive ? naiveToTimestamp(naive) : NaN
    if (Number.isNaN(ts)) continue

    const spend = Number(r.cost_fb) || 0
    if (spend <= 0) continue

    let groupKey = '—'
    if (groupBy === 'rotation') {
      groupKey = String(r.rotation_fb ?? '').trim() || '—'
    } else if (groupBy === 'daypart') {
      groupKey = String(r.day_part ?? '').trim() || '—'
    } else if (groupBy === 'week') {
      groupKey = String(r.week ?? '').trim() || '—'
    }

    const dateTimeLabel = r.date_time != null ? String(r.date_time).trim() : '—'
    const key = `${ts}\0${groupKey}`
    const existing = byTimeAndGroup.get(key)
    if (existing) {
      existing.spend += spend
    } else {
      byTimeAndGroup.set(key, {
        dateTime: ts,
        dateTimeLabel,
        groupKey,
        spend
      })
    }
  }
  
  return Array.from(byTimeAndGroup.values())
})

// Station spot-level table: each individual spot for the selected station
const stationSpotTableHeaders = [
  { title: 'Week', key: 'week', sortable: true, width: '100px' },
  { title: 'Date/time', key: 'date_time', sortable: true, minWidth: '140px' },
  { title: 'Rotation', key: 'rotation_fb', sortable: true, minWidth: '120px' },
  { title: 'DOW', key: 'day_planned', sortable: true, width: '80px' },
  { title: 'Day part', key: 'day_part', sortable: true, minWidth: '90px' },
  { title: 'Spots planned', key: 'spots_planned', sortable: true, align: 'end' as const },
  { title: 'Spots actual', key: 'spots_actual', sortable: true, align: 'end' as const },
  { title: 'Planned spend', key: 'planned_spend', sortable: true, align: 'end' as const },
  { title: 'Cost (actual)', key: 'cost_fb', sortable: true, align: 'end' as const },
  { title: 'CPM 35-54 planned', key: 'cpm_25_54_planned', sortable: true, align: 'end' as const },
  { title: 'CPM 50+ planned', key: 'cpm_50plus_planned', sortable: true, align: 'end' as const },
  { title: 'CPM 50+ actual', key: 'cpm_50plus_actual', sortable: true, align: 'end' as const },
  { title: 'Gross', key: 'gross_calls', sortable: true, align: 'end' as const },
  { title: 'Queued', key: 'queued_calls', sortable: true, align: 'end' as const },
  { title: 'Written', key: 'written_count', sortable: true, align: 'end' as const },
  { title: 'Queued / Cost', key: 'queued_per_cost', sortable: true, align: 'end' as const },
  { title: 'Queued / Spot', key: 'queued_per_spot', sortable: true, align: 'end' as const }
]
const stationSpotLevelTableData = computed(() =>
  stationFilteredData.value.map((r, i) => {
    const costFb = Number(r.cost_fb) || 0
    const spotsAct = Number(r.spots_actual) || 0
    const queued = Number(r.queued_calls) || 0
    const planned = (Number(r.rate_planned) || 0) * (Number(r.spots_planned) || 0)
    const queuedPerCost = costFb > 0 ? queued / costFb : 0
    const queuedPerSpot = spotsAct > 0 ? queued / spotsAct : 0
    return {
      ...r,
      __key: `station-spot-${i}-${r.attribution_id ?? i}`,
      planned_spend: planned,
      queued_per_cost: queuedPerCost,
      queued_per_spot: queuedPerSpot
    }
  })
)

const stationQueuedPerSpotOverTime = computed(() => {
  const rows = stationFilteredData.value as AttributableRow[]
  const byTime = new Map<number, { queuedCalls: number; spots: number; spend: number; dateTimeLabel: string }>()
  for (const r of rows) {
    const naive = parseDateTimeNaive(r.date_time)
    const ts = naive ? naiveToTimestamp(naive) : NaN
    if (Number.isNaN(ts)) continue
    const queued = Number(r.queued_calls) || 0
    const spots = Number(r.spots_actual) || 0
    const spend = Number(r.cost_fb) || 0
    if (spots <= 0) continue
    const dateTimeLabel = r.date_time != null ? String(r.date_time).trim() : '—'
    const existing = byTime.get(ts)
    if (existing) {
      existing.queuedCalls += queued
      existing.spots += spots
      existing.spend += spend
    } else {
      byTime.set(ts, { queuedCalls: queued, spots, spend, dateTimeLabel })
    }
  }
  return Array.from(byTime.entries())
    .map(([dateTime, agg]) => ({
      dateTime,
      dateTimeLabel: agg.dateTimeLabel,
      queuedCalls: Math.round(agg.queuedCalls),
      spots: Math.round(agg.spots),
      queuedPerSpot: agg.spots > 0 ? agg.queuedCalls / agg.spots : 0,
      spend: Math.round(agg.spend * 100) / 100
    }))
    .sort((a, b) => a.dateTime - b.dateTime)
})
const stationCpmByRotation = computed(() => {
  const rows = aggregateBy(stationFilteredData.value as AttributableRow[], ['rotation_fb'])
  return rows.map((r) => {
    const row = r as Record<string, unknown>
    return {
      rotation_fb: String(row.rotation_fb ?? '—'),
      cpm_25_54_planned: Number(row.cpm_25_54_planned) || 0,
      cpm_50plus_planned: Number(row.cpm_50plus_planned) || 0,
      cpm_50plus_actual: Number(row.cpm_50plus_actual) || 0,
      audience_fb: Number(row.audience_fb) || 0,
      audience_actual: Number(row.audience_actual) || 0,
      viewership_25_54: Number(row.viewership_25_54) || 0,
      viewership_a50_: Number(row.viewership_a50_) || 0
    }
  })
})

// CPM table column visibility
const cpmColumnVisibility = ref({
  cpm_25_54_planned: true,
  cpm_50plus_planned: true,
  cpm_50plus_actual: true,
  audience_fb: true,
  audience_actual: false,
  viewership_25_54: false,
  viewership_a50_: false
})

// DOW × Rotation / Day part cross-tab (queued calls); DOW from day_of_week_actual, day part from daypart_actual
/** True if label looks like a rotation time slot (e.g. "11a-5p", "1a-4a"), not a day part (e.g. "Early Fringe"). */
function looksLikeTimeSlot (label: string): boolean {
  const s = String(label ?? '').trim()
  return /^\d[\d.:]*[ap]-\d[\d.:]*[ap]$/i.test(s)
}
function buildDowCrossTab (groupKey: 'rotation_fb' | 'day_part') {
  const keys: GroupKey[] = groupKey === 'rotation_fb' ? ['dow_actual', 'rotation_fb'] : ['dow_actual', 'day_part']
  const rows = aggregateBy(filteredData.value, keys)
  const dowSet = new Set(rows.map((r) => String((r as Record<string, unknown>).dow_actual ?? '')).filter(Boolean))
  const uniqueDows = DOW_ORDER.filter((d) => dowSet.has(d))
  let uniqueCols = [...new Set(rows.map((r) => String((r as Record<string, unknown>)[groupKey] ?? '')))].filter(Boolean).sort()
  if (groupKey === 'day_part') {
    uniqueCols = uniqueCols.filter((c) => !looksLikeTimeSlot(c))
  }
  const crossRows = uniqueDows.map((dow) => {
    const row: Record<string, string | number> = { dow }
    for (const col of uniqueCols) {
      const cell = rows.find(
        (r) =>
          String((r as Record<string, unknown>).dow_actual ?? '') === dow &&
          String((r as Record<string, unknown>)[groupKey] ?? '') === col
      )
      row[col] = cell ? Number(cell.queued_calls) || 0 : 0
    }
    return row
  })
  const headers = [
    { title: 'DOW', key: 'dow', sortable: true },
    ...uniqueCols.map((c) => ({ title: c, key: c, sortable: true, align: 'end' as const }))
  ]
  return { headers, rows: crossRows }
}
const dowCrossTabByRotation = computed(() => buildDowCrossTab('rotation_fb'))
const dowCrossTabByDayPart = computed(() => buildDowCrossTab('day_part'))
const dowCrossTabUseRotation = ref(true)
const dowCrossTab = computed(() => (dowCrossTabUseRotation.value ? dowCrossTabByRotation.value : dowCrossTabByDayPart.value))

// Top rotations and top stations by KPI (queued calls), selected week range
const topRotationsByKpi = computed(() => {
  const rows = aggregateBy(filteredData.value, ['rotation_fb'])
  return rows
    .map((r) => ({
      name: String((r as Record<string, unknown>).rotation_fb ?? '—').trim(),
      queuedCalls: Math.round(Number(r.queued_calls) || 0),
      grossCalls: Math.round(Number(r.gross_calls) || 0),
      writtenCount: Math.round(Number(r.written_count) || 0)
    }))
    .filter((r) => r.name && r.name !== '—')
    .sort((a, b) => b.queuedCalls - a.queuedCalls)
    .slice(0, 10)
})

const topStationsByKpi = computed(() => {
  const rows = aggregateBy(filteredData.value, ['station'])
  return rows
    .map((r) => ({
      name: String((r as Record<string, unknown>).station ?? '—').trim(),
      queuedCalls: Math.round(Number(r.queued_calls) || 0),
      grossCalls: Math.round(Number(r.gross_calls) || 0),
      writtenCount: Math.round(Number(r.written_count) || 0)
    }))
    .filter((r) => r.name && r.name !== '—')
    .sort((a, b) => b.queuedCalls - a.queuedCalls)
    .slice(0, 10)
})

// Queued calls per spot over time: one point per unique date_time (aggregate so the chart draws a line, not vertical spikes). Includes spend (cost_fb) per time for overlay trend.
const queuedPerSpotOverTime = computed(() => {
  const rows = filteredData.value as AttributableRow[]
  const byTime = new Map<number, { queuedCalls: number; spots: number; spend: number; dateTimeLabel: string }>()
  for (const r of rows) {
    const naive = parseDateTimeNaive(r.date_time)
    const ts = naive ? naiveToTimestamp(naive) : NaN
    if (Number.isNaN(ts)) continue
    const queued = Number(r.queued_calls) || 0
    const spots = Number(r.spots_actual) || 0
    const spend = Number(r.cost_fb) || 0
    if (spots <= 0) continue
    const dateTimeLabel = r.date_time != null ? String(r.date_time).trim() : '—'
    const existing = byTime.get(ts)
    if (existing) {
      existing.queuedCalls += queued
      existing.spots += spots
      existing.spend += spend
    } else {
      byTime.set(ts, { queuedCalls: queued, spots, spend, dateTimeLabel })
    }
  }
  return Array.from(byTime.entries())
    .map(([dateTime, agg]) => ({
      dateTime,
      dateTimeLabel: agg.dateTimeLabel,
      queuedCalls: Math.round(agg.queuedCalls),
      spots: Math.round(agg.spots),
      queuedPerSpot: agg.spots > 0 ? agg.queuedCalls / agg.spots : 0,
      spend: Math.round(agg.spend * 100) / 100
    }))
    .sort((a, b) => a.dateTime - b.dateTime)
})

// Column visibility: which columns to show (key -> visible). Default all true.
const ALL_SPOT_HEADERS: { title: string; key: string; sortable: boolean; align?: 'end'; width?: string; minWidth?: string }[] = [
  { title: 'Week', key: 'week', sortable: true, width: '110px' },
  { title: 'Date/time', key: 'date_time', sortable: true, minWidth: '140px' },
  { title: 'Station', key: 'station', sortable: true, minWidth: '140px' },
  { title: 'Attribution ID', key: 'attribution_id', sortable: true, minWidth: '100px' },
  { title: 'Rotation', key: 'rotation_fb', sortable: true, minWidth: '160px' },
  { title: 'DOW', key: 'day_planned', sortable: true, minWidth: '100px' },
  { title: 'Day part', key: 'day_part', sortable: true, minWidth: '90px' },
  { title: 'Time planned', key: 'time_planned', sortable: true, minWidth: '90px' },
  { title: 'Spots planned', key: 'spots_planned', sortable: true, align: 'end' },
  { title: 'Spots actual', key: 'spots_actual', sortable: true, align: 'end' },
  { title: 'Rate planned', key: 'rate_planned', sortable: true, align: 'end' },
  { title: 'Length planned', key: 'length_planned', sortable: true, align: 'end' },
  { title: 'Length actual', key: 'length_actual', sortable: true, align: 'end' },
  { title: 'Planned spend', key: 'planned_spend', sortable: true, align: 'end' },
  { title: 'Cost (actual)', key: 'cost_fb', sortable: true, align: 'end' },
  { title: 'Audience (actual)', key: 'audience_actual', sortable: true, align: 'end' },
  { title: 'Audience FB', key: 'audience_fb', sortable: true, align: 'end' },
  { title: 'CPM 35-54 planned', key: 'cpm_25_54_planned', sortable: true, align: 'end' },
  { title: 'CPM 50+ planned', key: 'cpm_50plus_planned', sortable: true, align: 'end' },
  { title: 'CPM 50+ actual', key: 'cpm_50plus_actual', sortable: true, align: 'end' },
  { title: 'Commercial', key: 'commercial', sortable: true, minWidth: '120px' },
  { title: 'Creative actual', key: 'creative_actual', sortable: true, minWidth: '120px' },
  { title: 'Gross calls', key: 'gross_calls', sortable: true, align: 'end' },
  { title: 'Queued', key: 'queued_calls', sortable: true, align: 'end' },
  { title: 'Written', key: 'written_count', sortable: true, align: 'end' },
  { title: 'Sales records', key: 'sales_records', sortable: true, align: 'end' },
  { title: 'Lift calls', key: 'lift_calls', sortable: true, align: 'end' },
  { title: 'Lift queued', key: 'lift_queued', sortable: true, align: 'end' },
  { title: 'Lift written', key: 'lift_written', sortable: true, align: 'end' },
  { title: 'Viewership 35-54', key: 'viewership_25_54', sortable: true, align: 'end' },
  { title: 'Viewership A35', key: 'viewership_a35_', sortable: true, align: 'end' },
  { title: 'Viewership A50', key: 'viewership_a50_', sortable: true, align: 'end' },
  { title: 'Lift views', key: 'lift_views', sortable: true, align: 'end' },
  { title: 'Lift sessions', key: 'lift_sessions', sortable: true, align: 'end' },
  { title: 'Lift active users', key: 'lift_active_users', sortable: true, align: 'end' },
  { title: 'Queued / Cost (actual)', key: 'queued_per_cost', sortable: true, align: 'end' },
  { title: 'Queued / Spot', key: 'queued_per_spot', sortable: true, align: 'end' }
]
const AGG_METRIC_HEADERS: { title: string; key: string; sortable: boolean; align?: 'end'; width?: string; minWidth?: string }[] = [
  { title: 'Spots planned', key: 'spots_planned', sortable: true, align: 'end' },
  { title: 'Spots actual', key: 'spots_actual', sortable: true, align: 'end' },
  { title: 'Planned spend', key: 'planned_spend', sortable: true, align: 'end' },
  { title: 'Cost (actual)', key: 'cost_fb', sortable: true, align: 'end' },
  { title: 'Audience (actual)', key: 'audience_actual', sortable: true, align: 'end' },
  { title: 'Audience FB', key: 'audience_fb', sortable: true, align: 'end' },
  { title: 'CPM 35-54 planned', key: 'cpm_25_54_planned', sortable: true, align: 'end' },
  { title: 'CPM 50+ planned', key: 'cpm_50plus_planned', sortable: true, align: 'end' },
  { title: 'CPM 50+ actual', key: 'cpm_50plus_actual', sortable: true, align: 'end' },
  { title: 'Gross calls', key: 'gross_calls', sortable: true, align: 'end' },
  { title: 'Queued', key: 'queued_calls', sortable: true, align: 'end' },
  { title: 'Written', key: 'written_count', sortable: true, align: 'end' },
  { title: 'Queued / Cost (actual)', key: 'queued_per_cost', sortable: true, align: 'end' },
  { title: 'Queued / Spot', key: 'queued_per_spot', sortable: true, align: 'end' }
]
const visibleColumns = ref<Record<string, boolean>>({})
function setColumnVisible (key: string, visible: boolean) {
  visibleColumns.value = { ...visibleColumns.value, [key]: visible }
}
function toggleColumn (key: string) {
  setColumnVisible(key, visibleColumns.value[key] !== false ? false : true)
}

const allHeadersForView = computed(() => {
  if (spotLevelView.value) return ALL_SPOT_HEADERS
  const list: { title: string; key: string; sortable: boolean; align?: 'end'; width?: string; minWidth?: string }[] = []
  if (groupKeys.value.includes('week')) list.push({ title: 'Week', key: 'week', sortable: true, width: '110px' })
  if (groupKeys.value.includes('station')) list.push({ title: 'Station', key: 'station', sortable: true, minWidth: '140px' })
  if (groupKeys.value.includes('day_planned')) list.push({ title: 'DOW', key: 'day_planned', sortable: true, minWidth: '100px' })
  if (groupKeys.value.includes('rotation_fb')) list.push({ title: 'Rotation', key: 'rotation_fb', sortable: true, minWidth: '160px' })
  if (groupKeys.value.includes('day_part')) list.push({ title: 'Day part', key: 'day_part', sortable: true, minWidth: '100px' })
  list.push(...AGG_METRIC_HEADERS)
  return list
})

// When available columns change, add any new keys to visibleColumns (default true)
watch(allHeadersForView, (headers) => {
  const keys = headers.map((h) => h.key)
  let changed = false
  const next = { ...visibleColumns.value }
  keys.forEach((k) => {
    if (!(k in next)) { next[k] = true; changed = true }
  })
  if (changed) visibleColumns.value = next
}, { immediate: true })

const tableHeaders = computed(() =>
  allHeadersForView.value.filter((h) => visibleColumns.value[h.key] !== false)
)

/** Escape a cell for CSV (quotes and commas). */
function csvEscape (val: unknown): string {
  const s = val == null ? '' : String(val)
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/** Download current table view (filtered rows, visible columns only) as CSV. */
function downloadTableAsCsv () {
  const headers = tableHeaders.value
  const rows = filteredTableData.value as Record<string, unknown>[]
  const headerLine = headers.map((h) => csvEscape(h.title)).join(',')
  const dataLines = rows.map((row) =>
    headers.map((h) => csvEscape(row[h.key])).join(',')
  )
  const csv = [headerLine, ...dataLines].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `attributable-export-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const tableSearch = ref('')
const filteredTableData = computed(() => {
  const rows = tableData.value ?? []
  const q = (tableSearch.value ?? '').trim().toLowerCase()
  if (!q) return rows
  const visibleKeys = tableHeaders.value.map((h) => h.key)
  return rows.filter((row) => {
    const str = visibleKeys.map((k) => String((row as Record<string, unknown>)[k] ?? '')).join(' ').toLowerCase()
    return str.includes(q)
  })
})

const totals = computed(() => {
  const calls = callTotals.value
  const spotRows = filteredData.value
  const rows = tableData.value ?? []
  
  // DEBUG week 2026-01-19: KPI uses tableData for spots. ROW COUNTS = rows; SPOTS = sum(spots_actual).
  if (import.meta.dev && selectedStartWeek.value === '2026-01-19' && selectedEndWeek.value === '2026-01-19') {
    const weekRows = spotRows.filter((r: AttributableRow) => String(r.week ?? '') === '2026-01-19')
    const weekTableRows = rows.filter((r: any) => String(r.week ?? '') === '2026-01-19')
    const spotsFromFiltered = weekRows.reduce((sum: number, r: AttributableRow) => sum + (Number(r.spots_actual) || 0), 0)
    const spotsFromTable = weekTableRows.reduce((sum: number, r: any) => sum + (Number(r.spots_actual) || 0), 0)
    console.log('[DEBUG totals] ROW COUNTS = number of rows. SPOTS = sum(spots_actual). KPI displays spotsFromTable.', {
      filteredData_row_count: spotRows.length,
      tableData_row_count: rows.length,
      rows_with_week_20260119_in_filtered: weekRows.length,
      rows_with_week_20260119_in_table: weekTableRows.length,
      sum_spots_actual_from_filteredData: spotsFromFiltered,
      sum_spots_actual_from_tableData: spotsFromTable,
      note: 'The Spots KPI uses tableData; if aggregated, table rows can be fewer but each row has summed spots_actual.'
    })
  }
  
  let spotsPlanned = 0
  let spotsActual = 0
  for (const row of rows) {
    spotsPlanned += Number(row.spots_planned) || 0
    spotsActual += Number(row.spots_actual) || 0
  }
  const spotsDeliveryPct = spotsPlanned > 0 ? Math.round((spotsActual / spotsPlanned) * 100) : 0

  // Actual spend = sum of cost_fb where spots_actual > 0. Planned = sum of rate_planned where spots_planned > 0.
  // CPM = (sum cost_fb) / (sum audience_fb) for rows where spots_actual > 0. (audience_fb is in thousands.)
  let spend = 0
  let plannedSpend = 0
  let audienceFb = 0
  for (const row of spotRows) {
    const spotsAct = Number(row.spots_actual) || 0
    const spotsPlan = Number(row.spots_planned) || 0
    if (spotsAct > 0) {
      spend += Number(row.cost_fb) || 0
      audienceFb += Number(row.audience_fb) || 0
    }
    if (spotsPlan > 0) {
      plannedSpend += (Number(row.rate_planned) || 0) * spotsPlan
    }
  }
  return {
    spotsPlanned,
    spotsActual,
    spotsDeliveryPct,
    spotsDeliveryPctText: spotsPlanned > 0 ? `${spotsDeliveryPct}% cleared` : '—',
    spend,
    plannedSpend,
    grossCalls: calls.grossCalls,
    queuedCalls: calls.queuedCalls,
    writtenCount: calls.writtenCount,
    audienceFb,
    overallCPM: audienceFb > 0 ? spend / audienceFb : 0
  }
})

/** Format web lift / goal value:  don’t show as 0. */
/** lift_goal_* key → display label (strip prefix, snake_case to Title Case). */
function formatGoalName (key: string): string {
  const name = key.replace(/^lift_goal_/, '').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
  return name || key
}

// Web lift: main metrics + sum every column starting with lift_goal_ (nulls → 0), show in carousel
const webLiftTotals = computed(() => {
  const rows = filteredData.value as Record<string, unknown>[]
  let liftViews = 0
  let liftSessions = 0
  let liftActiveUsers = 0
  const goalsSums = new Map<string, number>()

  for (const r of rows) {
    liftViews += (r.lift_views != null && r.lift_views !== '') ? Number(r.lift_views) || 0 : 0
    liftSessions += (r.lift_sessions != null && r.lift_sessions !== '') ? Number(r.lift_sessions) || 0 : 0
    liftActiveUsers += (r.lift_active_users != null && r.lift_active_users !== '') ? Number(r.lift_active_users) || 0 : 0
    for (const key of Object.keys(r)) {
      if (!key.startsWith('lift_goal_')) continue
      const v = r[key]
      const n = (v != null && v !== '') ? Number(v) : NaN
      const add = Number.isFinite(n) ? n : 0
      goalsSums.set(key, (goalsSums.get(key) ?? 0) + add)
    }
  }

  const goals = Array.from(goalsSums.entries())
    .map(([key, sum]) => ({ key, name: formatGoalName(key), value: Math.round(sum) }))
    .sort((a, b) => b.value - a.value)

  return {
    liftViews: Math.round(liftViews),
    liftSessions: Math.round(liftSessions),
    liftActiveUsers: Math.round(liftActiveUsers),
    goals,
  }
})

// Chunk goals into groups of 3 for carousel slides
const webLiftGoalChunks = computed(() => {
  const goals = webLiftTotals.value.goals
  const chunkSize = 3
  const chunks: typeof goals[] = []
  for (let i = 0; i < goals.length; i += chunkSize) {
    chunks.push(goals.slice(i, i + chunkSize))
  }
  return chunks
})

const webLiftCarousel = ref(0)
const webLiftTotalSlides = computed(() => 1 + webLiftGoalChunks.value.length)

function formatCurrency (value: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(value)
}

function formatCPM (value: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 1 }).format(value) + ' CPM'
}

function formatNumber (value: number): string {
  if (!Number.isFinite(value)) return '—'
  // Cap floats to 5 decimal places, remove trailing zeros
  const rounded = Math.round(value * 100000) / 100000
  return rounded.toLocaleString('en-CA', { maximumFractionDigits: 5 })
}

function formatRatio (value: number): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 5 }).format(value)
}
</script>

<style scoped>
/* Stryker toolbar: dark strip like hero (strykermediagroup.com) */
.stryker-toolbar {
  position: relative;
  overflow: hidden;
  background-color: rgb(var(--v-theme-primary)) !important;
  border: 1px solid rgba(255, 255, 255, 0.12);
}
.stryker-toolbar::after,
.stryker-kpi-card::after,
.stryker-chart-title::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  opacity: 0.06;
  background-image:
    radial-gradient(circle at 18% 18%, rgba(255, 255, 255, 0.035) 0%, rgba(255, 255, 255, 0) 100%),
    url('/noise-256.png');
  background-size: auto, 256px 256px;
  background-repeat: no-repeat, repeat;
  background-blend-mode: screen, soft-light;
}
.stryker-toolbar > *,
.stryker-kpi-card > *,
.stryker-chart-title > * {
  position: relative;
  z-index: 1;
}
.stryker-toolbar-label {
  color: rgb(var(--v-theme-secondary)) !important;
}
.stryker-toolbar-text {
  color: rgba(255, 255, 255, 0.95) !important;
}
.stryker-toolbar-divider {
  border-color: rgba(255, 255, 255, 0.2) !important;
}
.stryker-toolbar :deep(.v-field) {
  --v-field-input-opacity: 1;
}
.stryker-toolbar :deep(.v-field__input) {
  color: #fff;
}
.stryker-toolbar :deep(.v-field__outline) {
  --v-border-opacity: 0.4;
  color: rgba(255, 255, 255, 0.5);
}
.toolbar-card:not(.stryker-toolbar) {
  background-color: rgba(0, 0, 0, 0.03);
  border: 1px solid rgba(0, 0, 0, 0.08);
}
/* Dates/KPIs toolbar: white text on dark green */
.toolbar-dates-kpis .toolbar-dates-kpis-label,
.toolbar-dates-kpis .toolbar-dates-kpis-text,
.toolbar-dates-kpis .toolbar-kpi-label,
.toolbar-dates-kpis .stryker-toolbar-label {
  color: rgba(255,255,255,0.85) !important;
}
.toolbar-dates-kpis :deep(.v-field__input) {
  color: #fff !important;
}
.toolbar-week-select {
  min-height: 36px;
}
.toolbar-kpi-switch {
  gap: 0.5rem;
}
.toolbar-week-select :deep(.v-field__input),
.toolbar-week-select :deep(.v-select__selection-text),
.toolbar-week-select :deep(.v-field__outline),
.toolbar-week-select :deep(.v-icon) {
  color: #fff !important;
}

/* Stryker KPI cards: dark grey, white text, yellow value */
.stryker-kpi-card {
  position: relative;
  overflow: hidden;
  background-color: rgb(var(--v-theme-primary)) !important;
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.stryker-kpi-label {
  color: rgba(255, 255, 255, 0.85) !important;
}
.stryker-kpi-value {
  color: rgb(var(--v-theme-secondary)) !important;
}
.stryker-kpi-sub {
  color: rgba(255, 255, 255, 0.75) !important;
}

/* Chart/section cards: dark title bar, yellow icon, white button text */
.stryker-chart-title {
  position: relative;
  overflow: hidden;
  background-color: rgb(var(--v-theme-primary)) !important;
  color: #fff !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.stryker-chart-title .stryker-accent-icon {
  color: rgb(var(--v-theme-secondary)) !important;
}
.stryker-chart-title :deep(.v-btn),
.stryker-chart-title :deep(.v-btn-toggle .v-btn) {
  color: #fff !important;
}
.stryker-chart-title :deep(.v-btn.v-btn--active),
.stryker-chart-title :deep(.v-btn.v-btn--selected) {
  background: rgba(255, 255, 255, 0.2);
  color: #fff !important;
}
.stryker-chart-title :deep(.v-field__input),
.stryker-chart-title :deep(.v-select .v-field__input) {
  color: #fff !important;
}
.stryker-chart-title :deep(.v-field__outline) {
  color: rgba(255, 255, 255, 0.5) !important;
}

/* Station drill-down popup: fullscreen dialog, scrollable content */
.station-drill-dialog :deep(.v-overlay__content) {
  max-width: 100%;
  max-height: 100%;
  height: 100%;
}
.station-drill-card {
  height: 100%;
  min-height: 0;
}
.station-drill-content {
  overflow-x: auto;
  overflow-y: auto;
  min-height: 0;
}

/* Drill-down: Queued by rotation / DOW / day part — same size, fill the row, wrap on narrow */
.drill-down-queued-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.drill-down-queued-card {
  flex: 1 1 300px;
  min-width: 280px;
  min-height: 0;
}

/* Call center performance */
.call-center-carousel :deep(.v-carousel__item) {
  align-items: flex-start;
}
.call-center-whole-slide {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.call-center-whole-slide .text-disabled {
  text-align: center;
}
.call-center-kpi-card {
  min-width: 120px;
  padding: 12px 16px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.call-center-table {
  max-height: 320px;
  overflow-y: auto;
}

</style>
