<template>
  <div class="queued-calls-chart" :style="chartContainerStyle">
    <Bar
      v-if="chartData.datasets[0].data.length"
      :data="chartData"
      :options="options"
    />
    <p v-else class="text-body-2 text-medium-emphasis mb-0 pa-4">
      No queued calls data in selected week range.
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

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const props = withDefaults(
  defineProps<{
    labels: string[]
    data: number[]
    title?: string
    /** When true, cap chart size so few bars don't grow huge (e.g. in drill-down) */
    dynamicSize?: boolean
    onBarClick?: (label: string) => void
    /** Optional context per bar (e.g. station name) shown in tooltip; same length as labels */
    tooltipContext?: string[]
  }>(),
  { dynamicSize: false }
)

const CAPPED_HEIGHT_PX = 340
/** Max characters for x-axis category labels so rotation vs station charts scale similarly */
const MAX_LABEL_LENGTH = 15

function truncateLabel (text: string): string {
  if (text.length <= MAX_LABEL_LENGTH) return text
  return text.slice(0, MAX_LABEL_LENGTH - 3) + '...'
}

const chartContainerStyle = computed(() => ({
  height: `${CAPPED_HEIGHT_PX}px`,
  width: '100%'
}))

const chartData = computed(() => ({
  labels: props.labels,
  datasets: [
    {
      label: 'Queued calls',
      data: props.data,
      backgroundColor: [
        'rgba(226, 192, 80, 0.90)',
        'rgba(14, 165, 233, 0.75)',
        'rgba(226, 192, 80, 0.65)',
        'rgba(14, 165, 233, 0.65)',
        'rgba(226, 192, 80, 0.55)',
        'rgba(14, 165, 233, 0.55)',
        'rgba(226, 192, 80, 0.45)',
        'rgba(14, 165, 233, 0.48)',
        'rgba(226, 192, 80, 0.38)',
        'rgba(14, 165, 233, 0.40)'
      ],
      borderColor: [
        'rgb(226, 192, 80)',
        'rgb(14, 165, 233)',
        'rgb(226, 192, 80)',
        'rgb(14, 165, 233)',
        'rgb(226, 192, 80)',
        'rgb(14, 165, 233)',
        'rgb(226, 192, 80)',
        'rgb(14, 165, 233)',
        'rgb(226, 192, 80)',
        'rgb(14, 165, 233)'
      ],
      borderWidth: 1
    }
  ]
}))

const options = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  onClick (_event: MouseEvent, elements: { index?: number }[], chart: { data?: { labels?: string[] } }) {
    const cb = props.onBarClick
    if (!cb || !elements.length) return
    const idx = elements[0]?.index
    const label = chart.data?.labels?.[idx ?? -1]
    if (label != null) cb(String(label))
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        title: (items: { dataIndex: number }[]) => {
          const idx = items[0]?.dataIndex
          return idx != null ? (props.labels[idx] ?? '') : ''
        },
        label: (ctx: { raw?: unknown }) => `Queued calls: ${Number(ctx.raw ?? 0).toLocaleString()}`,
        afterLabel: (ctx: { dataIndex: number }) => {
          const ctxLine = props.tooltipContext?.[ctx.dataIndex]
          return ctxLine ? ctxLine : ''
        }
      }
    }
  },
  scales: {
    x: {
      ticks: {
        maxRotation: 45,
        minRotation: 35,
        color: 'rgba(255,255,255,0.75)',
        callback: (_value: unknown, index: number) => truncateLabel(props.labels[index] ?? '')
      },
      grid: { display: false }
    },
    y: {
      beginAtZero: true,
      title: { display: true, text: 'Queued calls', color: 'rgba(255,255,255,0.6)' },
      ticks: { color: 'rgba(255,255,255,0.75)', callback: (value: number | string) => Number(value).toLocaleString() },
      grid: { color: 'rgba(255,255,255,0.07)' }
    }
  }
}))
</script>

<style scoped>
.queued-calls-chart {
  min-height: 280px;
}

.queued-calls-chart--dynamic {
  min-height: 0;
}
</style>
