import type { MonthlyData, DuesStatusData } from './analytics'

// Colors match the dashboard charts (MonthlyChart / DuesStatusChart)
const RAISED_COLOR = '#059669'
const SPENT_COLOR = '#e11d48'
const BALANCE_COLOR = '#2563eb'
const DUES_COLORS = ['#059669', '#d97706']
const GRID_COLOR = '#f1f5f9'
const TICK_COLOR = '#94a3b8'
const LABEL_COLOR = '#475569'

function formatAxisDollar(v: number): string {
  return v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`
}

type Canvas2D = import('@napi-rs/canvas').SKRSContext2D

function roundedTopBar(ctx: Canvas2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h)
  ctx.beginPath()
  ctx.moveTo(x, y + h)
  ctx.lineTo(x, y + radius)
  ctx.arcTo(x, y, x + radius, y, radius)
  ctx.lineTo(x + w - radius, y)
  ctx.arcTo(x + w, y, x + w, y + radius, radius)
  ctx.lineTo(x + w, y + h)
  ctx.closePath()
  ctx.fill()
}

function legendItem(ctx: Canvas2D, x: number, y: number, color: string, label: string): number {
  ctx.beginPath()
  ctx.arc(x + 4, y - 3.5, 4, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.fillStyle = LABEL_COLOR
  ctx.textAlign = 'left'
  ctx.font = '11px sans-serif'
  ctx.fillText(label, x + 13, y)
  return x + 13 + ctx.measureText(label).width + 18
}

/**
 * Renders the report's monthly activity chart as a PNG buffer, styled like the
 * dashboard's MonthlyChart: rounded-top Raised/Spent bars on light dashed
 * gridlines, an optional blue bank-balance line on its own right-hand scale
 * (drawn only through months that have a balance, like connectNulls={false}),
 * and a centered dot legend underneath. `@napi-rs/canvas` is imported lazily
 * (see newsletter-chart.ts for why) so a native-loading failure only breaks
 * chart rendering, not every caller of this module.
 */
export async function renderReportChart(monthly: MonthlyData[]): Promise<Buffer> {
  const WIDTH = 700
  const HEIGHT = 320
  const hasBalance = monthly.some((m) => m.bankBalance != null)
  const PADDING = { top: 16, right: hasBalance ? 56 : 20, bottom: 52, left: 56 }

  const { createCanvas } = await import('@napi-rs/canvas')
  const canvas = createCanvas(WIDTH, HEIGHT)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom
  const maxBar = Math.max(1, ...monthly.map((m) => Math.max(m.raised, m.spent)))
  const balances = monthly.filter((m) => m.bankBalance != null).map((m) => m.bankBalance!)
  const maxBalance = Math.max(1, ...balances)
  // Keep the line's floor at zero (or below-zero balances) so it reads on the
  // same visual baseline as the bars.
  const minBalance = Math.min(0, ...balances)

  // Gridlines + axis tick labels
  const steps = 4
  ctx.lineWidth = 1
  ctx.font = '11px sans-serif'
  for (let i = 0; i <= steps; i++) {
    const y = PADDING.top + plotHeight - (plotHeight / steps) * i

    ctx.strokeStyle = GRID_COLOR
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(PADDING.left, y)
    ctx.lineTo(WIDTH - PADDING.right, y)
    ctx.stroke()
    ctx.setLineDash([])

    ctx.fillStyle = TICK_COLOR
    ctx.textAlign = 'right'
    ctx.fillText(formatAxisDollar((maxBar / steps) * i), PADDING.left - 8, y + 4)
    if (hasBalance) {
      ctx.textAlign = 'left'
      const balValue = minBalance + ((maxBalance - minBalance) / steps) * i
      ctx.fillText(formatAxisDollar(balValue), WIDTH - PADDING.right + 8, y + 4)
    }
  }

  // Bars + month labels
  const n = Math.max(monthly.length, 1)
  const slot = plotWidth / n
  const barWidth = Math.min(20, slot * 0.28)
  const gap = 4
  ctx.textAlign = 'center'
  monthly.forEach((m, i) => {
    const centerX = PADDING.left + slot * i + slot / 2
    const raisedHeight = (m.raised / maxBar) * plotHeight
    const spentHeight = (m.spent / maxBar) * plotHeight

    ctx.fillStyle = RAISED_COLOR
    roundedTopBar(ctx, centerX - barWidth - gap / 2, PADDING.top + plotHeight - raisedHeight, barWidth, raisedHeight, 4)
    ctx.fillStyle = SPENT_COLOR
    roundedTopBar(ctx, centerX + gap / 2, PADDING.top + plotHeight - spentHeight, barWidth, spentHeight, 4)

    ctx.fillStyle = TICK_COLOR
    ctx.font = '11px sans-serif'
    ctx.fillText(m.month, centerX, PADDING.top + plotHeight + 18)
  })

  // Bank balance line + dots, breaking across months with no balance
  if (hasBalance) {
    const pointFor = (m: MonthlyData, i: number): { x: number; y: number } | null => {
      if (m.bankBalance == null) return null
      const x = PADDING.left + slot * i + slot / 2
      const y = PADDING.top + plotHeight - ((m.bankBalance - minBalance) / (maxBalance - minBalance || 1)) * plotHeight
      return { x, y }
    }
    ctx.strokeStyle = BALANCE_COLOR
    ctx.lineWidth = 2
    let prev: { x: number; y: number } | null = null
    monthly.forEach((m, i) => {
      const pt = pointFor(m, i)
      if (pt && prev) {
        ctx.beginPath()
        ctx.moveTo(prev.x, prev.y)
        ctx.lineTo(pt.x, pt.y)
        ctx.stroke()
      }
      prev = pt
    })
    ctx.fillStyle = BALANCE_COLOR
    monthly.forEach((m, i) => {
      const pt = pointFor(m, i)
      if (!pt) return
      ctx.beginPath()
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  // Centered dot legend under the plot, like the dashboard's
  ctx.font = '11px sans-serif'
  const items: [string, string][] = [
    [RAISED_COLOR, 'Raised'],
    [SPENT_COLOR, 'Spent'],
    ...(hasBalance ? ([[BALANCE_COLOR, 'Bank balance']] as [string, string][]) : []),
  ]
  const totalWidth = items.reduce((s, [, label]) => s + 13 + ctx.measureText(label).width + 18, 0) - 18
  let lx = (WIDTH - totalWidth) / 2
  const ly = HEIGHT - 12
  for (const [color, label] of items) lx = legendItem(ctx, lx, ly, color, label)

  return canvas.encodeSync('png')
}

/**
 * Renders the dues-status donut styled like the dashboard's DuesStatusChart:
 * paid/unpaid slices with a small pad angle, and a legend with per-slice
 * percentage and member counts. Returns null when there are no members.
 */
export async function renderDuesChart(data: DuesStatusData[], total: number): Promise<Buffer | null> {
  if (total === 0) return null
  const WIDTH = 460
  const HEIGHT = 190

  const { createCanvas } = await import('@napi-rs/canvas')
  const canvas = createCanvas(WIDTH, HEIGHT)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  const cx = 95
  const cy = HEIGHT / 2
  const outer = 78
  const inner = 52
  const padAngle = 0.05

  const slices = data.filter((d) => d.value > 0)
  let angle = -Math.PI / 2
  for (const slice of slices) {
    const sweep = (slice.value / total) * Math.PI * 2
    // No gap when a single slice fills the ring
    const pad = slices.length > 1 ? padAngle : 0
    const a0 = angle + pad / 2
    const a1 = angle + sweep - pad / 2
    ctx.beginPath()
    ctx.arc(cx, cy, outer, a0, a1)
    ctx.arc(cx, cy, inner, a1, a0, true)
    ctx.closePath()
    ctx.fillStyle = DUES_COLORS[data.indexOf(slice) % DUES_COLORS.length]
    ctx.fill()
    angle += sweep
  }

  // Legend
  const lx = 210
  let ly = cy - (data.length * 26) / 2 + 16
  for (let i = 0; i < data.length; i++) {
    const entry = data[i]
    const pct = Math.round((entry.value / total) * 100)
    ctx.beginPath()
    ctx.arc(lx + 4, ly - 4, 4, 0, Math.PI * 2)
    ctx.fillStyle = DUES_COLORS[i % DUES_COLORS.length]
    ctx.fill()
    ctx.font = '12px sans-serif'
    ctx.fillStyle = LABEL_COLOR
    ctx.textAlign = 'left'
    ctx.fillText(entry.name, lx + 14, ly)
    ctx.fillStyle = TICK_COLOR
    ctx.textAlign = 'right'
    ctx.fillText(`${pct}% · ${entry.value} ${entry.value === 1 ? 'member' : 'members'}`, WIDTH - 16, ly)
    ly += 26
  }

  return canvas.encodeSync('png')
}
