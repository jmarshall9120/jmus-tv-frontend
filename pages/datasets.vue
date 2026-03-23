<template>
  <v-container fluid class="pa-4">
    <v-row>
      <v-col cols="12">
        <v-card variant="outlined" class="stryker-chart-card">
          <v-card-title class="d-flex align-center flex-wrap gap-2 stryker-chart-title">
            <v-icon start size="small" class="stryker-accent-icon">mdi-database</v-icon>
            <span>Pull & monitor data sets</span>
          </v-card-title>
          <v-card-text>
            <p class="text-caption text-medium-emphasis mb-4">
              Pull data from sources (e.g. GA, Athena) and monitor dataset availability, freshness, and row counts. This page will list datasets, trigger pulls, and show last-updated and status.
            </p>
            <v-alert type="info" density="compact" class="mb-4">
              Placeholder: Wire to backend APIs for listing datasets, triggering pulls (e.g. <code>PULL_GA</code> or dataset-specific mutations), and querying metadata (e.g. <code>getSalesAttributionMetadata</code>, dataset tables).
            </v-alert>
            <v-tabs v-model="datasetsTab" class="mb-4">
              <v-tab value="pull">Pull data</v-tab>
              <v-tab value="monitor">Monitor datasets</v-tab>
            </v-tabs>
            <v-window v-model="datasetsTab">
              <v-window-item value="pull">
                <p class="text-body-2 text-medium-emphasis">
                  Trigger data pulls (GA, external APIs). Options: source, date range, client. Results and history will appear below or in Monitor.
                </p>
                <v-btn color="primary" disabled class="mt-2">Pull data (coming soon)</v-btn>
              </v-window-item>
              <v-window-item value="monitor">
                <p class="text-body-2 text-medium-emphasis">
                  View dataset status: last updated, row counts, date ranges, available stations/weeks. Tables: sales attributable, non-attributable, metadata.
                </p>
                <v-skeleton-loader type="table" class="mt-4" />
              </v-window-item>
            </v-window>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
const datasetsTab = ref<'pull' | 'monitor'>('pull')
</script>
