import type { MonthlyData } from './analytics'

const WIDTH = 700
const HEIGHT = 320
const PADDING = { top: 40, right: 20, bottom: 44, left: 64 }
const RAISED_COLOR = '#059669'
const SPENT_COLOR = '#dc2626'

function formatAxisDollar(v: number): string {
  return v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`
}

/**
 * Renders a "raised vs. spent by month" grouped-bar chart as a PNG buffer for
 * the PDF report. `@napi-rs/canvas` is imported lazily (see newsletter-chart.ts
 * for why) so a native-loading failure only breaks chart rendering, not every
 * caller of this module.
 */
export async function renderReportChart(monthly: MonthlyData[]): Promise<Buffer> {
  const { createCanvas } = await import('@napi-rs/canvas')
  const canvas = createCanvas(WIDTH, HEIGHT)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  ctx.fillStyle = '#0f172a'
  ctx.font = '600 15px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('Raised vs. spent by month', PADDING.left, 22)

  // Legend
  ctx.font = '11px sans-serif'
  ctx.fillStyle = RAISED_COLOR
  ctx.fillRect(WIDTH - 170, 10, 10, 10)
  ctx.fillStyle = '#475569'
  ctx.fillText('Raised', WIDTH - 155, 19)
  ctx.fillStyle = SPENT_COLOR
  ctx.fillRect(WIDTH - 95, 10, 10, 10)
  ctx.fillStyle = '#475569'
  ctx.fillText('Spent', WIDTH - 80, 19)

  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom
  const maxValue = Math.max(1, ...monthly.map((m) => Math.max(m.raised, m.spent)))

  const steps = 4
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 1
  ctx.fillStyle = '#94a3b8'
  ctx.font = '11px sans-serif'
  ctx.textAlign = 'right'
  for (let i = 0; i <= steps; i++) {
    const value = (maxValue / steps) * i
    const y = PADDING.top + plotHeight - (value / maxValue) * plotHeight
    ctx.beginPath()
    ctx.moveTo(PADDING.left, y)
    ctx.lineTo(WIDTH - PADDING.right, y)
    ctx.stroke()
    ctx.fillText(formatAxisDollar(value), PADDING.left - 8, y + 4)
  }

  const n = Math.max(monthly.length, 1)
  const slot = plotWidth / n
  const barWidth = Math.min(20, slot * 0.28)
  const gap = 4
  ctx.textAlign = 'center'
  monthly.forEach((m, i) => {
    const centerX = PADDING.left + slot * i + slot / 2
    const raisedHeight = (m.raised / maxValue) * plotHeight
    const spentHeight = (m.spent / maxValue) * plotHeight

    ctx.fillStyle = RAISED_COLOR
    ctx.fillRect(centerX - barWidth - gap / 2, PADDING.top + plotHeight - raisedHeight, barWidth, raisedHeight)

    ctx.fillStyle = SPENT_COLOR
    ctx.fillRect(centerX + gap / 2, PADDING.top + plotHeight - spentHeight, barWidth, spentHeight)

    ctx.fillStyle = '#64748b'
    ctx.font = '10px sans-serif'
    ctx.fillText(m.month, centerX, HEIGHT - PADDING.bottom + 16)
  })

  return canvas.encodeSync('png')
}
