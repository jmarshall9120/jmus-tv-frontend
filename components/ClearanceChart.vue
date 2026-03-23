<template>
  <div
    class="clearance-chart"
    :class="{ 'clearance-chart--clickable': clickableStationLabels }"
    :style="chartContainerStyle"
  >
    <Bar
      v-if="chartData.datasets.length && chartData.labels?.length"
      :data="chartData"
      :options="options"
    />
    <p v-else class="text-body-2 text-medium-emphasis mb-0 pa-4">
      No clearance data in selected week range.
    </p>
  </div>
</template>

<script setup lang="ts">
import { Bar } from 'vue-chartjs'
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  BarElement,
  Title,
  Tooltip
} from 'chart.js'
import type { ClearanceRow } from '~/utils/clearance'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const props = withDefaults(
  defineProps<{
    rows: ClearanceRow[]
    clickableStationLabels?: boolean
  }>(),
  { clickableStationLabels: false }
)

const emit = defineEmits<{ stationClick: [station: string] }>()

const BAR_HEIGHT_PX = 32
const CHART_PADDING_PX = 120
const MIN_CHART_HEIGHT_PX = 200

const chartContainerStyle = computed(() => {
  const n = props.rows.length
  const height =
    n === 0
      ? MIN_CHART_HEIGHT_PX
      : Math.max(MIN_CHART_HEIGHT_PX, n * BAR_HEIGHT_PX + CHART_PADDING_PX)
  return { height: `${height}px` }
})

const chartData = computed(() => {
  const rows = props.rows
  return {
    labels: rows.map((r) => r.label),
    datasets: [
      {
        label: 'Paid',
        data: rows.map((r) => r.paid_pct),
        backgroundColor: 'rgba(14, 165, 233, 0.80)',
        borderColor: 'rgb(14, 165, 233)',
        borderWidth: 1
      },
      {
        label: 'Bonus',
        data: rows.map((r) => r.bonus_pct),
        backgroundColor: 'rgba(226, 192, 80, 0.85)',
        borderColor: 'rgb(226, 192, 80)',
        borderWidth: 1
      }
    ]
  }
})

function handleChartClick (
  event: unknown,
  _elements: { index?: number }[],
  chart: { getElementsAtEventForMode: (e: unknown, mode: string, opts: { intersect: boolean }, useFinalPosition?: boolean) => { index?: number }[] }
) {
  if (!props.clickableStationLabels || !chart?.getElementsAtEventForMode) return
  // Use intersect: false so clicking the y-axis label (station name) still hits the bar for that row
  const hit = chart.getElementsAtEventForMode(event, 'index', { intersect: false }, false)
  if (!hit?.length) return
  const idx = hit[0]?.index ?? -1
  const row = props.rows[idx]
  if (row?.station) emit('stationClick', row.station)
}

const options = computed(() => ({
  indexAxis: 'y' as const,
  responsive: true,
  maintainAspectRatio: false,
  onClick: handleChartClick,
  plugins: {
    legend: { position: 'top' as const, labels: { color: 'rgba(255,255,255,0.85)' } },
    tooltip: {
      callbacks: {
        label: (ctx: { datasetIndex?: number; dataIndex?: number; raw?: unknown }) => {
          const row = props.rows[ctx.dataIndex ?? 0]
          if (!row) return ''
          if (ctx.datasetIndex === 0) {
            return `Paid: ${row.spots_actual_paid} spots (${row.paid_pct}%)`
          }
          return `Bonus: ${row.spots_actual_bonus} spots (${row.bonus_pct}%)`
        },
        afterBody: (items: { dataIndex?: number }[]) => {
          const idx = items[0]?.dataIndex ?? 0
          const row = props.rows[idx]
          if (!row) return []
          return [
            `Planned: ${row.spots_planned}`,
            `Clearance: ${row.clearance_pct}% (${row.spots_actual} actual spots)`
          ]
        }
      }
    }
  },
  scales: {
    x: {
      stacked: true,
      max: 150,
      beginAtZero: true,
      title: { display: true, text: 'Clearance % (actual / planned)', color: 'rgba(255,255,255,0.6)' },
      ticks: { color: 'rgba(255,255,255,0.75)', callback: (value: number | string) => `${Number(value)}%` },
      grid: { color: 'rgba(255,255,255,0.07)' }
    },
    y: {
      stacked: true,
      grid: { display: false },
      ticks: { color: 'rgba(255,255,255,0.75)', font: { size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 20 }
    }
  }
}))
</script>

<style scoped>
.clearance-chart {
  width: 100%;
}

.clearance-chart--clickable :deep(canvas) {
  cursor: pointer;
}
</style>
