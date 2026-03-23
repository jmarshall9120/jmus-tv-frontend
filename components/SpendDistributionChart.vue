<template>
  <div class="spend-distribution-chart">
    <Line
      v-if="chartData.datasets.length && chartData.datasets.some(d => d.data.length)"
      :data="chartData"
      :options="options"
    />
    <p v-else class="text-body-2 text-medium-emphasis mb-0 pa-4">
      No spend data in selected week range.
    </p>
  </div>
</template>

<script setup lang="ts">
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

export interface SpendDistributionPoint {
  dateTime: number
  dateTimeLabel: string
  groupKey: string
  spend: number
}

const props = defineProps<{
  points: SpendDistributionPoint[]
  groupBy: 'rotation' | 'daypart' | 'week'
}>()

// Group points by groupKey, then build cumulative spend over time for each group
const chartData = computed(() => {
  const groups = new Map<string, SpendDistributionPoint[]>()
  for (const p of props.points) {
    const list = groups.get(p.groupKey) || []
    list.push(p)
    groups.set(p.groupKey, list)
  }

  // For each group, sort by time and build cumulative spend
  const datasets: Array<{
    label: string
    data: { x: number; y: number }[]
    borderColor: string
    backgroundColor: string
    fill: boolean
    tension: number
    pointRadius: number
    pointHoverRadius: number
  }> = []

  const colors = [
    'rgb(226, 192, 80)',   // gold
    'rgb(14, 165, 233)',   // sky blue
    'rgb(196, 124, 32)',   // amber
    'rgb(251, 146, 60)',   // orange
    'rgb(168, 85, 247)',   // purple
    'rgb(34, 197, 94)',    // green
    'rgb(236, 72, 153)',   // pink
    'rgb(20, 184, 166)'    // teal
  ]

  let colorIndex = 0
  for (const [groupKey, points] of groups.entries()) {
    const sorted = [...points].sort((a, b) => a.dateTime - b.dateTime)
    let cumulative = 0
    const data = sorted.map((p) => {
      cumulative += p.spend
      return { x: p.dateTime, y: Math.round(cumulative * 100) / 100 }
    })

    if (data.length > 0) {
      datasets.push({
        label: groupKey || '—',
        data,
        borderColor: colors[colorIndex % colors.length],
        backgroundColor: colors[colorIndex % colors.length].replace('rgb', 'rgba').replace(')', ', 0.1)'),
        fill: false,
        tension: 0.1,
        pointRadius: 2,
        pointHoverRadius: 4
      })
      colorIndex++
    }
  }

  return {
    datasets: datasets.sort((a, b) => {
      // Sort by final cumulative value (descending) so largest spend groups appear on top
      const aMax = a.data.length ? a.data[a.data.length - 1].y : 0
      const bMax = b.data.length ? b.data[b.data.length - 1].y : 0
      return bMax - aMax
    })
  }
})

const options = computed(() => {
  const pts = props.points
  const minX = pts.length ? Math.min(...pts.map((p) => p.dateTime)) : 0
  const maxX = pts.length ? Math.max(...pts.map((p) => p.dateTime)) : 0
  
  return {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 2.5,
    interaction: {
      mode: 'index' as const,
      intersect: false
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          boxWidth: 12,
          padding: 8,
          font: { size: 11 },
          color: 'rgba(255,255,255,0.85)'
        }
      },
      tooltip: {
        callbacks: {
          title: (items: { raw?: { x?: number; y?: number } }[]) => {
            const x = items[0]?.raw?.x
            return x != null ? new Date(x).toLocaleString() : ''
          },
          label: (ctx: { dataset?: { label?: string }; parsed?: { y?: number }; raw?: { y?: number } }) => {
            const label = ctx.dataset?.label || ''
            const value = ctx.parsed?.y ?? ctx.raw?.y ?? 0
            return `${label}: ${formatCurrency(value)}`
          }
        }
      }
    },
    scales: {
      x: {
        type: 'linear' as const,
        min: minX,
        max: maxX,
        title: {
          display: true,
          text: 'Date/time'
        },
        grid: { display: true, color: 'rgba(255,255,255,0.07)' },
        ticks: {
          callback: (value: number | string) => {
            const v = Number(value)
            if (Number.isNaN(v)) return ''
            return new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
          },
          maxRotation: 45,
          font: { size: 10 },
          maxTicksLimit: 12,
          color: 'rgba(255,255,255,0.75)'
        }
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Cumulative spend ($)',
          color: 'rgba(255,255,255,0.6)'
        },
        ticks: {
          color: 'rgba(255,255,255,0.75)',
          callback: (value: number | string) => formatCurrency(Number(value))
        },
        grid: { color: 'rgba(255,255,255,0.07)' }
      }
    }
  }
})

function formatCurrency (value: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(value)
}
</script>

<style scoped>
.spend-distribution-chart {
  min-height: 320px;
}
</style>
