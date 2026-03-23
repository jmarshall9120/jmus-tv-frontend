<template>
  <div class="top-kpi-chart">
    <Bar
      v-if="chartData.datasets.length && chartData.labels?.length"
      :data="chartData"
      :options="options"
    />
    <p v-else class="text-body-2 text-medium-emphasis mb-0 pa-4">
      No data in selected week range.
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

export interface TopKpiItem {
  name: string
  queuedCalls: number
  grossCalls: number
  writtenCount: number
}

const props = defineProps<{
  items: TopKpiItem[]
}>()

const chartData = computed(() => {
  const items = props.items
  return {
    labels: items.map((i) => i.name),
    datasets: [
      {
        label: 'Queued calls',
        data: items.map((i) => i.queuedCalls),
        backgroundColor: 'rgba(226, 192, 80, 0.85)',
        borderColor: 'rgb(226, 192, 80)',
        borderWidth: 1
      }
    ]
  }
})

const options = computed(() => ({
  indexAxis: 'y' as const,
  responsive: true,
  maintainAspectRatio: true,
  aspectRatio: 1.2,
  onClick (_event: MouseEvent, elements: { index?: number }[]) {
    const cb = props.onBarClick
    if (!cb || !elements.length) return
    const idx = elements[0]?.index
    const item = props.items[idx ?? -1]
    if (item?.name) cb(item.name)
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx: { dataIndex?: number; raw?: unknown }) => {
          const item = props.items[ctx.dataIndex ?? 0]
          if (!item) return ''
          return [
            `Queued: ${item.queuedCalls.toLocaleString()}`,
            `Gross: ${item.grossCalls.toLocaleString()}`,
            `Written: ${item.writtenCount.toLocaleString()}`
          ]
        }
      }
    }
  },
  scales: {
    x: {
      beginAtZero: true,
      title: { display: true, text: 'Queued calls', color: 'rgba(255,255,255,0.6)' },
      ticks: { color: 'rgba(255,255,255,0.75)', callback: (value: number | string) => Number(value).toLocaleString() },
      grid: { color: 'rgba(255,255,255,0.07)' }
    },
    y: {
      grid: { display: false },
      ticks: { color: 'rgba(255,255,255,0.75)', font: { size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 }
    }
  }
}))
</script>

<style scoped>
.top-kpi-chart {
  min-height: 260px;
}
</style>
