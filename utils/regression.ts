/**
 * Simple linear regression: y = slope * x + intercept.
 * Returns slope, intercept, R², and predicted y at given x values.
 */
export interface LinearRegressionResult {
  slope: number
  intercept: number
  r2: number
  /** Predicted y at min x and max x for drawing the trend line */
  trendYAtMinX: number
  trendYAtMaxX: number
}

export function linearRegression (
  points: { x: number; y: number }[]
): LinearRegressionResult | null {
  const n = points.length
  if (n < 2) return null

  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const sumX = xs.reduce((a, b) => a + b, 0)
  const sumY = ys.reduce((a, b) => a + b, 0)
  const meanX = sumX / n
  const meanY = sumY / n

  let ssXX = 0
  let ssXY = 0
  let ssYY = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX
    const dy = ys[i] - meanY
    ssXX += dx * dx
    ssXY += dx * dy
    ssYY += dy * dy
  }

  if (ssXX === 0) return null

  const slope = ssXY / ssXX
  const intercept = meanY - slope * meanX
  const r2 = ssYY === 0 ? 1 : (ssXY * ssXY) / (ssXX * ssYY)

  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const trendYAtMinX = slope * minX + intercept
  const trendYAtMaxX = slope * maxX + intercept

  return {
    slope,
    intercept,
    r2,
    trendYAtMinX,
    trendYAtMaxX
  }
}
