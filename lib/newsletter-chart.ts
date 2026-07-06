import type { MonthlyData } from './analytics'
import { CHART_FONT, ensureChartFont } from './chart-font'

const WIDTH = 700
const HEIGHT = 350
const PADDING = { top: 36, right: 20, bottom: 44, left: 64 }
const BAR_COLOR = '#059669' // matches the dashboard's "Raised" bar color

function formatAxisDollar(v: number): string {
  return v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`
}

/**
 * Renders a static "donor contributions by month" bar chart (the `raised` series only) as a PNG
 * buffer for email embedding. `@napi-rs/canvas` (a native addon) is imported lazily here — not at
 * module top-level — so that a native-loading failure (e.g. a missing system library on some
 * serverless runtimes) only breaks chart rendering, not every page/action that merely imports this
 * module's siblings (`actions/newsletter.ts` exports several Gmail-connection functions that never
 * touch a canvas at all).
 */
export async function renderContributionsChart(monthly: MonthlyData[]): Promise<Buffer> {
  await ensureChartFont()
  const { createCanvas } = await import('@napi-rs/canvas')
  const canvas = createCanvas(WIDTH, HEIGHT)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  ctx.fillStyle = '#0f172a'
  ctx.font = `600 15px ${CHART_FONT}`
  ctx.textAlign = 'left'
  ctx.fillText('Donor contributions by month', PADDING.left, 22)

  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom
  const maxRaised = Math.max(1, ...monthly.map((m) => m.raised))

  // Gridlines + y-axis labels
  const steps = 4
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 1
  ctx.fillStyle = '#94a3b8'
  ctx.font = `11px ${CHART_FONT}`
  ctx.textAlign = 'right'
  for (let i = 0; i <= steps; i++) {
    const value = (maxRaised / steps) * i
    const y = PADDING.top + plotHeight - (value / maxRaised) * plotHeight
    ctx.beginPath()
    ctx.moveTo(PADDING.left, y)
    ctx.lineTo(WIDTH - PADDING.right, y)
    ctx.stroke()
    ctx.fillText(formatAxisDollar(value), PADDING.left - 8, y + 4)
  }

  // Bars + month labels
  const n = Math.max(monthly.length, 1)
  const slot = plotWidth / n
  const barWidth = Math.min(36, slot * 0.55)
  ctx.textAlign = 'center'
  monthly.forEach((m, i) => {
    const x = PADDING.left + slot * i + slot / 2
    const barHeight = (m.raised / maxRaised) * plotHeight

    ctx.fillStyle = BAR_COLOR
    ctx.fillRect(x - barWidth / 2, PADDING.top + plotHeight - barHeight, barWidth, barHeight)

    ctx.fillStyle = '#64748b'
    ctx.font = `10px ${CHART_FONT}`
    ctx.fillText(m.month, x, HEIGHT - PADDING.bottom + 16)
  })

  return canvas.encodeSync('png')
}
