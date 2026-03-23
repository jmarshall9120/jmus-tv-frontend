<template>
  <div class="queued-per-spot-chart">
    <Line
      v-if="chartData.datasets[0].data.length"
      :data="chartData"
      :options="options"
    />
    <p v-else class="text-body-2 text-medium-emphasis mb-0 pa-4">
      No spot-level data with date_time in selected week range.
    </p>
  </div>
</template>

<script setup lang="ts">
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { linearRegression } from '~/utils/regression'

ChartJS.register(
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

export interface QueuedPerSpotPoint {
  dateTime: number
  dateTimeLabel: string
  queuedCalls: number
  spots: number
  queuedPerSpot: number
  /** Spend (cost_fb) at this time for overlay trend */
  spend?: number
}

const props = defineProps<{
  points: QueuedPerSpotPoint[]
}>()

function isSunday (ts: number): boolean {
  return new Date(ts).getDay() === 0
}

const chartData = computed(() => {
  const pointsNoSunday = props.points.filter((p) => !isSunday(p.dateTime))
  const dataPoints = pointsNoSunday.map((p) => ({
    x: p.dateTime,
    y: Math.round(p.queuedPerSpot * 100) / 100
  }))
  const reg = linearRegression(dataPoints)
  const minX = dataPoints.length ? Math.min(...dataPoints.map((d) => d.x)) : 0
  const maxX = dataPoints.length ? Math.max(...dataPoints.map((d) => d.x)) : 0
  // Daily spend: one point per calendar day (excluding Sundays), total spend that day
  const byDay = new Map<number, number>()
  for (const p of pointsNoSunday) {
    if (p.spend == null) continue
    const dayStart = new Date(p.dateTime).setHours(0, 0, 0, 0)
    const current = byDay.get(dayStart) ?? 0
    byDay.set(dayStart, current + (Number(p.spend) || 0))
  }
  const dailySpendPoints = Array.from(byDay.entries())
    .map(([dayStart, total]) => ({ x: dayStart, y: Math.round(total * 100) / 100 }))
    .sort((a, b) => a.x - b.x)
  const datasets: Array<{
    label: string
    data: { x: number; y: number }[]
    borderColor: string
    backgroundColor?: string
    fill?: boolean
    tension?: number
    pointRadius?: number
    pointHoverRadius?: number
    hitRadius?: number
    borderDash?: number[]
    borderWidth?: number
    showLine?: boolean
    yAxisID?: string
  }> = [
    {
      label: 'Queued calls per spot',
      data: dataPoints,
      showLine: false,
      yAxisID: 'y',
      borderColor: 'rgb(226, 192, 80)',
      backgroundColor: 'rgba(226, 192, 80, 0.1)',
      fill: false,
      pointRadius: 3,
      pointHoverRadius: 5,
      hitRadius: 10
    }
  ]
  if (reg) {
    datasets.push({
      label: `Trend queued/spot (R² = ${reg.r2.toFixed(3)})`,
      data: [
        { x: minX, y: reg.trendYAtMinX },
        { x: maxX, y: reg.trendYAtMaxX }
      ],
      yAxisID: 'y',
      borderColor: 'rgb(234, 88, 12)',
      borderWidth: 2,
      borderDash: [6, 4],
      pointRadius: 0,
      pointHoverRadius: 0,
      hitRadius: 0,
      fill: false
    })
  }
  if (dailySpendPoints.length) {
    datasets.push({
      label: 'Daily spend',
      data: dailySpendPoints,
      showLine: true,
      yAxisID: 'y1',
      borderColor: 'rgb(22, 163, 74)',
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      hitRadius: 10,
      fill: false,
      tension: 0
    })
  }
  return { datasets }
})

function formatTime (ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const options = computed(() => {
  const pts = props.points
  const minX = pts.length ? Math.min(...pts.map((p) => p.dateTime)) : 0
  const maxX = pts.length ? Math.max(...pts.map((p) => p.dateTime)) : 0
  return {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 2.8,
    plugins: {
      legend: { display: true, position: 'top', labels: { color: 'rgba(255,255,255,0.85)' } },
      tooltip: {
        callbacks: {
          title: (items: { raw?: { x?: number } }[]) => {
            const x = items[0]?.raw?.x
            return x != null ? formatTime(x) : ''
          },
          label: (ctx: { datasetIndex?: number; dataIndex?: number; raw?: { y?: number }; parsed?: { y?: number } }) => {
            const di = ctx.datasetIndex ?? 0
            const pts = props.points
            if (di === 0) {
              const p = pts[ctx.dataIndex ?? 0]
              if (!p) return ''
              return [
                `Queued per spot: ${p.queuedPerSpot.toFixed(2)}`,
                `Queued: ${p.queuedCalls.toLocaleString()}`,
                `Spots: ${p.spots.toLocaleString()}`
              ]
            }
            if (di === 2) {
              const y = ctx.parsed?.y ?? ctx.raw?.y
              return [`Daily spend: $${Number(y).toLocaleString()}`]
            }
            const y = ctx.parsed?.y ?? ctx.raw?.y
            if (di === 1) return [`Trend queued/spot: ${Number(y).toFixed(2)}`]
            return []
          }
        }
      }
    },
    scales: {
      x: {
        type: 'linear',
        min: minX,
        max: maxX,
        title: { display: true, text: 'Date/time (spot air — minute-to-minute)', color: 'rgba(255,255,255,0.6)' },
        grid: { display: false },
        ticks: {
          color: 'rgba(255,255,255,0.75)',
          callback: (value: number | string) => {
            const v = Number(value)
            if (Number.isNaN(v)) return ''
            return new Date(v).toLocaleDateString(undefined, { weekday: 'short' })
          },
          maxRotation: 45,
          font: { size: 10 },
          maxTicksLimit: 12
        }
      },
      y: {
        type: 'linear',
        position: 'left',
        beginAtZero: true,
        title: { display: true, text: 'Queued calls per spot', color: 'rgba(255,255,255,0.6)' },
        ticks: { color: 'rgba(255,255,255,0.75)', callback: (value: number | string) => Number(value).toLocaleString() },
        grid: { color: 'rgba(255,255,255,0.07)' }
      },
      y1: {
        type: 'linear',
        position: 'right',
        beginAtZero: true,
        title: { display: true, text: 'Daily spend ($)', color: 'rgba(255,255,255,0.6)' },
        grid: { drawOnChartArea: false },
        ticks: { color: 'rgba(255,255,255,0.75)', callback: (value: number | string) => `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}` }
      }
    }
  }
})
</script>

<style scoped>
.queued-per-spot-chart {
  min-height: 280px;
}
</style>
