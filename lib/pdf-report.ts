import PDFDocument from 'pdfkit'
import { formatCurrency, formatShortDate } from '@/lib/utils'
import type { Contribution, CommitteeContribution, InKindContribution, Expenditure, CommitteeEvent } from '@/lib/types'
import { PAYMENT_METHOD_LABELS, EXPENSE_CATEGORY_LABELS } from '@/lib/types'
import type { MonthlyData, CategoryData, DonorTotal, MemberGivingSummary } from '@/lib/analytics'

export interface ReportData {
  committeeName: string
  committeeAddress?: string
  seecId?: string
  periodLabel: string
  generatedAt: string
  totalRaised: number
  totalSpent: number
  netBalance: number
  /** Balance of the same bank account the dashboard's card shows */
  bankBalance?: { amount: number; accountLabel: string }
  monthly: MonthlyData[]
  chartImage: Buffer
  /** Dues-status donut, absent when the committee has no roster members */
  duesChartImage?: Buffer
  paymentMethodBreakdown: CategoryData[]
  expenseCategoryBreakdown: CategoryData[]
  topDonors: DonorTotal[]
  contributions: Contribution[]
  committeeContributions: CommitteeContribution[]
  inKindContributions: InKindContribution[]
  expenditures: Expenditure[]
  events: CommitteeEvent[]
  memberGiving: MemberGivingSummary
}

const PAGE_MARGIN = 36
const PAGE_WIDTH = 612 // LETTER
const PAGE_HEIGHT = 792
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2

// Running header/footer bands on content pages. Body content lives between
// CONTENT_TOP and CONTENT_BOTTOM; the bands themselves are stamped after the
// body is laid out (they need the final page count).
const HEADER_RULE_Y = PAGE_MARGIN + 16
const CONTENT_TOP = HEADER_RULE_Y + 14
const FOOTER_RULE_Y = PAGE_HEIGHT - PAGE_MARGIN - 14
const CONTENT_BOTTOM = FOOTER_RULE_Y - 8

const COLOR = {
  text: '#0f172a',
  gray: '#64748b',
  lightGray: '#94a3b8',
  border: '#e2e8f0',
  cardBg: '#f8fafc',
  headerBg: '#f1f5f9',
  emerald: '#059669',
  red: '#dc2626',
  blue: '#1d4ed8',
}

const ROW_HEIGHT = 18

interface TableColumn {
  label: string
  width: number
  align?: 'left' | 'right'
  get: (row: unknown) => string
}

/** Layout cursor. Body drawing goes through this so tables can paginate. */
interface Ctx {
  doc: PDFKit.PDFDocument
  y: number
}

/**
 * Truncates text with an ellipsis to fit maxWidth, measured against the
 * document's current font/size. pdfkit's own `ellipsis`/`lineBreak` text
 * options don't reliably suppress wrapping in this version — confirmed by
 * direct testing, where a long string still wrapped to two lines with both
 * options set — so width is enforced manually here instead.
 */
function truncateToWidth(doc: PDFKit.PDFDocument, text: string, maxWidth: number): string {
  if (doc.widthOfString(text) <= maxWidth) return text
  const ellipsis = '…'
  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (doc.widthOfString(text.slice(0, mid) + ellipsis) <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return text.slice(0, lo) + ellipsis
}

function newPage(ctx: Ctx) {
  ctx.doc.addPage()
  ctx.y = CONTENT_TOP
}

/** Starts a new page unless at least `space` points remain on this one. */
function ensure(ctx: Ctx, space: number) {
  if (ctx.y + space > CONTENT_BOTTOM) newPage(ctx)
}

function sectionTitle(ctx: Ctx, text: string) {
  // Keep the title attached to at least a header row and two data rows.
  ensure(ctx, 16 + ROW_HEIGHT * 3)
  ctx.doc.fontSize(10.5).font('Helvetica-Bold').fillColor(COLOR.text)
  ctx.doc.text(text, PAGE_MARGIN, ctx.y)
  ctx.y += 16
}

function tableHeaderRow(doc: PDFKit.PDFDocument, x: number, y: number, width: number, columns: TableColumn[]) {
  doc.rect(x, y, width, ROW_HEIGHT).fillColor(COLOR.headerBg).fill()
  doc.rect(x, y, width, ROW_HEIGHT).strokeColor(COLOR.border).lineWidth(1).stroke()
  let cx = x
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor(COLOR.gray)
  for (const col of columns) {
    const label = truncateToWidth(doc, col.label.toUpperCase(), col.width - 10)
    doc.text(label, cx + 5, y + 5, { width: col.width - 10, align: col.align ?? 'left', lineBreak: false })
    cx += col.width
  }
}

function tableCells(doc: PDFKit.PDFDocument, x: number, y: number, columns: TableColumn[], cells: string[]) {
  let cx = x
  for (let i = 0; i < columns.length; i++) {
    const text = truncateToWidth(doc, cells[i], columns[i].width - 10)
    doc.text(text, cx + 5, y + 5, { width: columns[i].width - 10, align: columns[i].align ?? 'left', lineBreak: false })
    cx += columns[i].width
  }
}

/**
 * Full-width table that paginates: rows that would cross into the footer band
 * start a new page and re-stamp the header row. An optional bold total row is
 * kept on the same page as at least the last data row.
 */
function drawPagedTable(
  ctx: Ctx,
  columns: TableColumn[],
  rows: unknown[],
  opts: { empty: string; total?: string[] }
) {
  const { doc } = ctx
  const x = PAGE_MARGIN
  const width = columns.reduce((s, c) => s + c.width, 0)

  tableHeaderRow(doc, x, ctx.y, width, columns)
  ctx.y += ROW_HEIGHT

  if (rows.length === 0) {
    doc.rect(x, ctx.y, width, ROW_HEIGHT).strokeColor(COLOR.border).lineWidth(1).stroke()
    doc.fontSize(8.5).font('Helvetica').fillColor(COLOR.lightGray)
    doc.text(opts.empty, x, ctx.y + 5, { width, align: 'center' })
    ctx.y += ROW_HEIGHT
    return
  }

  for (let i = 0; i < rows.length; i++) {
    // Reserve room for the total row alongside the final data row so a total
    // never lands alone at the top of a page.
    const needed = i === rows.length - 1 && opts.total ? ROW_HEIGHT * 2 : ROW_HEIGHT
    if (ctx.y + needed > CONTENT_BOTTOM) {
      newPage(ctx)
      tableHeaderRow(doc, x, ctx.y, width, columns)
      ctx.y += ROW_HEIGHT
    }
    doc.rect(x, ctx.y, width, ROW_HEIGHT).strokeColor(COLOR.border).lineWidth(1).stroke()
    doc.fontSize(8.5).font('Helvetica').fillColor(COLOR.text)
    tableCells(doc, x, ctx.y, columns, columns.map((c) => c.get(rows[i])))
    ctx.y += ROW_HEIGHT
  }

  if (opts.total) {
    doc.rect(x, ctx.y, width, ROW_HEIGHT).fillColor(COLOR.cardBg).fill()
    doc.rect(x, ctx.y, width, ROW_HEIGHT).strokeColor(COLOR.border).lineWidth(1).stroke()
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(COLOR.text)
    tableCells(doc, x, ctx.y, columns, opts.total)
    ctx.y += ROW_HEIGHT
  }
}

/** Fixed-position table (no pagination) for the side-by-side breakdowns; returns end y. */
function drawStaticTable(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  columns: TableColumn[],
  rows: unknown[],
  emptyLabel: string
): number {
  const width = columns.reduce((s, c) => s + c.width, 0)
  let cy = y
  tableHeaderRow(doc, x, cy, width, columns)
  cy += ROW_HEIGHT

  if (rows.length === 0) {
    doc.rect(x, cy, width, ROW_HEIGHT).strokeColor(COLOR.border).lineWidth(1).stroke()
    doc.fontSize(8.5).font('Helvetica').fillColor(COLOR.lightGray)
    doc.text(emptyLabel, x, cy + 5, { width, align: 'center' })
    return cy + ROW_HEIGHT
  }

  for (const row of rows) {
    doc.rect(x, cy, width, ROW_HEIGHT).strokeColor(COLOR.border).lineWidth(1).stroke()
    doc.fontSize(8.5).font('Helvetica').fillColor(COLOR.text)
    tableCells(doc, x, cy, columns, columns.map((c) => c.get(row)))
    cy += ROW_HEIGHT
  }
  return cy
}

// ─── Cover sheet ──────────────────────────────────────────────────────────────

function drawCover(doc: PDFKit.PDFDocument, data: ReportData) {
  // Accent bar
  doc.rect(PAGE_MARGIN, PAGE_MARGIN, CONTENT_WIDTH, 5).fillColor(COLOR.blue).fill()

  // Committee identity block
  let y = 170
  doc.fontSize(24).font('Helvetica-Bold').fillColor(COLOR.text)
  doc.text(data.committeeName, PAGE_MARGIN, y, { width: CONTENT_WIDTH, align: 'center' })
  y = doc.y + 6
  doc.fontSize(10).font('Helvetica').fillColor(COLOR.gray)
  if (data.committeeAddress) {
    doc.text(data.committeeAddress, PAGE_MARGIN, y, { width: CONTENT_WIDTH, align: 'center' })
    y = doc.y + 2
  }
  if (data.seecId) {
    doc.text(`Committee ref: ${data.seecId}`, PAGE_MARGIN, y, { width: CONTENT_WIDTH, align: 'center' })
    y = doc.y + 2
  }

  // Title block
  y = 320
  doc.moveTo(PAGE_WIDTH / 2 - 90, y).lineTo(PAGE_WIDTH / 2 + 90, y).strokeColor(COLOR.border).lineWidth(1).stroke()
  y += 24
  doc.fontSize(20).font('Helvetica-Bold').fillColor(COLOR.blue)
  doc.text('Financial Summary Report', PAGE_MARGIN, y, { width: CONTENT_WIDTH, align: 'center' })
  y = doc.y + 10
  doc.fontSize(12).font('Helvetica').fillColor(COLOR.text)
  doc.text(data.periodLabel, PAGE_MARGIN, y, { width: CONTENT_WIDTH, align: 'center' })

  // Key totals — with the bank balance leading, like the dashboard's card row
  y = 470
  const cards: { label: string; value: string; color: string; sub?: string }[] = [
    ...(data.bankBalance
      ? [{ label: 'Bank Balance', value: formatCurrency(data.bankBalance.amount), color: COLOR.blue, sub: data.bankBalance.accountLabel }]
      : []),
    { label: 'Total Raised', value: formatCurrency(data.totalRaised), color: COLOR.emerald },
    { label: 'Total Spent', value: formatCurrency(data.totalSpent), color: COLOR.red },
    { label: 'Net', value: formatCurrency(data.netBalance), color: COLOR.text },
  ]
  const cardGap = 10
  const cardWidth = cards.length === 4 ? 124 : 140
  const cardHeight = 62
  const cardsLeft = (PAGE_WIDTH - (cardWidth * cards.length + cardGap * (cards.length - 1))) / 2
  cards.forEach((card, i) => {
    const cx = cardsLeft + i * (cardWidth + cardGap)
    doc.roundedRect(cx, y, cardWidth, cardHeight, 4).fillColor(COLOR.cardBg).fill()
    doc.roundedRect(cx, y, cardWidth, cardHeight, 4).strokeColor(COLOR.border).lineWidth(1).stroke()
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(COLOR.gray)
    doc.text(card.label.toUpperCase(), cx, y + 10, { width: cardWidth, align: 'center' })
    doc.fontSize(15).font('Helvetica-Bold').fillColor(card.color)
    doc.text(card.value, cx, y + 26, { width: cardWidth, align: 'center' })
    if (card.sub) {
      doc.fontSize(7).font('Helvetica').fillColor(COLOR.lightGray)
      doc.text(truncateToWidth(doc, card.sub, cardWidth - 8), cx, y + 46, { width: cardWidth, align: 'center', lineBreak: false })
    }
  })
  y += cardHeight + 16

  const inKindTotal = data.inKindContributions.reduce((s, i) => s + i.fairMarketValue, 0)
  const countsParts = [
    `${data.contributions.length} donation${data.contributions.length === 1 ? '' : 's'}`,
    `${data.committeeContributions.length} committee donation${data.committeeContributions.length === 1 ? '' : 's'}`,
    `${data.inKindContributions.length} in-kind (${formatCurrency(inKindTotal)})`,
    `${data.expenditures.length} expenditure${data.expenditures.length === 1 ? '' : 's'}`,
  ]
  doc.fontSize(9.5).font('Helvetica').fillColor(COLOR.gray)
  doc.text(countsParts.join('   ·   '), PAGE_MARGIN, y, { width: CONTENT_WIDTH, align: 'center' })

  // Generated line
  doc.fontSize(9).font('Helvetica').fillColor(COLOR.lightGray)
  doc.text(`Generated ${data.generatedAt}`, PAGE_MARGIN, PAGE_HEIGHT - PAGE_MARGIN - 30, {
    width: CONTENT_WIDTH,
    align: 'center',
    lineBreak: false,
  })
}

// ─── Report ───────────────────────────────────────────────────────────────────

export async function renderReportPdf(data: ReportData): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'LETTER', margin: PAGE_MARGIN, bufferPages: true })
  const chunks: Buffer[] = []
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))))

  const left = PAGE_MARGIN

  drawCover(doc, data)

  // ── Overview ──
  const ctx: Ctx = { doc, y: 0 }
  newPage(ctx)

  sectionTitle(ctx, 'Monthly Activity')
  const chartHeight = CONTENT_WIDTH * (320 / 700)
  doc.image(data.chartImage, left, ctx.y, { width: CONTENT_WIDTH })
  ctx.y += chartHeight + 14

  // Breakdown tables, side by side
  const colGap = 12
  const colWidth = (CONTENT_WIDTH - colGap) / 2
  const breakdownColumns = (w: number): TableColumn[] => [
    { label: 'Category', width: w * 0.55, get: (r) => (r as CategoryData).name },
    { label: 'Count', width: w * 0.2, align: 'right', get: (r) => String((r as CategoryData).count) },
    { label: 'Amount', width: w * 0.25, align: 'right', get: (r) => formatCurrency((r as CategoryData).amount) },
  ]
  const breakdownRows = Math.max(data.paymentMethodBreakdown.length, data.expenseCategoryBreakdown.length, 1)
  ensure(ctx, 16 + ROW_HEIGHT * (breakdownRows + 1))
  const breakdownTop = ctx.y
  doc.fontSize(10.5).font('Helvetica-Bold').fillColor(COLOR.text)
  doc.text('By Payment Method', left, breakdownTop)
  doc.text('By Expense Category', left + colWidth + colGap, breakdownTop)
  const leftEnd = drawStaticTable(doc, left, breakdownTop + 16, breakdownColumns(colWidth), data.paymentMethodBreakdown, 'No activity in this period')
  const rightEnd = drawStaticTable(doc, left + colWidth + colGap, breakdownTop + 16, breakdownColumns(colWidth), data.expenseCategoryBreakdown, 'No activity in this period')
  ctx.y = Math.max(leftEnd, rightEnd) + 14

  // Top donors
  sectionTitle(ctx, 'Top Donors')
  drawPagedTable(ctx, [
    { label: 'Donor', width: CONTENT_WIDTH * 0.6, get: (r) => (r as DonorTotal).name },
    { label: 'Gifts', width: CONTENT_WIDTH * 0.15, align: 'right', get: (r) => String((r as DonorTotal).count) },
    { label: 'Total', width: CONTENT_WIDTH * 0.25, align: 'right', get: (r) => formatCurrency((r as DonorTotal).amount) },
  ], data.topDonors, { empty: 'No contributions in this period' })
  ctx.y += 18

  // ── Donations ──
  sectionTitle(ctx, 'Donations')
  const donationsTotal = data.contributions.reduce((s, c) => s + c.amount, 0)
  drawPagedTable(ctx, [
    { label: 'Date', width: 70, get: (r) => formatShortDate((r as Contribution).date) },
    { label: 'Donor', width: 230, get: (r) => {
      const c = (r as Contribution).contributor
      return `${c.firstName} ${c.lastName}`.trim()
    } },
    { label: 'Method', width: 150, get: (r) => PAYMENT_METHOD_LABELS[(r as Contribution).method] ?? (r as Contribution).method },
    { label: 'Amount', width: 90, align: 'right', get: (r) => formatCurrency((r as Contribution).amount) },
  ], data.contributions, {
    empty: 'No donations in this period',
    total: ['', `Total (${data.contributions.length})`, '', formatCurrency(donationsTotal)],
  })
  ctx.y += 18

  // ── Committee donations ──
  sectionTitle(ctx, 'Committee Donations')
  const committeeTotal = data.committeeContributions.reduce((s, c) => s + c.amount, 0)
  drawPagedTable(ctx, [
    { label: 'Date', width: 70, get: (r) => formatShortDate((r as CommitteeContribution).date) },
    { label: 'From', width: 280, get: (r) => (r as CommitteeContribution).fromName },
    { label: 'Method', width: 100, get: (r) => {
      const m = (r as CommitteeContribution).method
      return m ? PAYMENT_METHOD_LABELS[m] ?? m : '—'
    } },
    { label: 'Amount', width: 90, align: 'right', get: (r) => formatCurrency((r as CommitteeContribution).amount) },
  ], data.committeeContributions, {
    empty: 'No committee donations in this period',
    total: ['', `Total (${data.committeeContributions.length})`, '', formatCurrency(committeeTotal)],
  })
  ctx.y += 18

  // ── In-kind donations ──
  sectionTitle(ctx, 'In-Kind Donations')
  const inKindTotal = data.inKindContributions.reduce((s, i) => s + i.fairMarketValue, 0)
  drawPagedTable(ctx, [
    { label: 'Date', width: 70, get: (r) => formatShortDate((r as InKindContribution).date) },
    { label: 'From', width: 160, get: (r) => {
      const i = r as InKindContribution
      return i.entityName ?? `${i.firstName ?? ''} ${i.lastName}`.trim()
    } },
    { label: 'Description', width: 220, get: (r) => (r as InKindContribution).description },
    { label: 'Fair Market Value', width: 90, align: 'right', get: (r) => formatCurrency((r as InKindContribution).fairMarketValue) },
  ], data.inKindContributions, {
    empty: 'No in-kind donations in this period',
    total: ['', `Total (${data.inKindContributions.length})`, '', formatCurrency(inKindTotal)],
  })
  ctx.y += 18

  // ── Fundraising events ──
  sectionTitle(ctx, 'Fundraising Events')
  const eventReceipts = data.events.reduce((s, e) => s + e.foodReceipts + e.tagSaleReceipts, 0)
  drawPagedTable(ctx, [
    { label: '#', width: 30, get: (r) => (r as CommitteeEvent).letter },
    { label: 'Date', width: 70, get: (r) => formatShortDate((r as CommitteeEvent).date) },
    { label: 'Event', width: 350, get: (r) => (r as CommitteeEvent).description },
    { label: 'Receipts', width: 90, align: 'right', get: (r) => {
      const e = r as CommitteeEvent
      return e.foodReceipts + e.tagSaleReceipts > 0 ? formatCurrency(e.foodReceipts + e.tagSaleReceipts) : '—'
    } },
  ], data.events, {
    empty: 'No events in this period',
    total: ['', '', `Total receipts (${data.events.length} event${data.events.length === 1 ? '' : 's'})`, formatCurrency(eventReceipts)],
  })
  ctx.y += 18

  // ── Expenses ──
  sectionTitle(ctx, 'Expenses')
  const expensesTotal = data.expenditures.reduce((s, e) => s + e.amount, 0)
  drawPagedTable(ctx, [
    { label: 'Date', width: 70, get: (r) => formatShortDate((r as Expenditure).date) },
    { label: 'Payee', width: 130, get: (r) => (r as Expenditure).payee },
    { label: 'Purpose', width: 150, get: (r) => (r as Expenditure).purpose },
    { label: 'Category', width: 110, get: (r) => EXPENSE_CATEGORY_LABELS[(r as Expenditure).category] ?? (r as Expenditure).category },
    { label: 'Amount', width: 80, align: 'right', get: (r) => formatCurrency((r as Expenditure).amount) },
  ], data.expenditures, {
    empty: 'No expenses in this period',
    total: ['', `Total (${data.expenditures.length})`, '', '', formatCurrency(expensesTotal)],
  })
  ctx.y += 18

  // ── Member donations ──
  sectionTitle(ctx, 'Member Donations')
  const mg = data.memberGiving
  ensure(ctx, 14 + ROW_HEIGHT * 3)
  doc.fontSize(8.5).font('Helvetica').fillColor(COLOR.gray)
  doc.text(
    `${mg.membersWhoGave} of ${mg.activeMembers} active member${mg.activeMembers === 1 ? '' : 's'} donated during this period.`,
    left,
    ctx.y
  )
  ctx.y += 14

  if (data.duesChartImage) {
    const duesChartWidth = 320
    const duesChartHeight = duesChartWidth * (190 / 460)
    ensure(ctx, 14 + duesChartHeight + ROW_HEIGHT * 3)
    doc.fontSize(9).font('Helvetica-Bold').fillColor(COLOR.text)
    doc.text('Dues status', left, ctx.y)
    ctx.y += 14
    doc.image(data.duesChartImage, left, ctx.y, { width: duesChartWidth })
    ctx.y += duesChartHeight + 12
  }
  const memberTotal = mg.rows.reduce((s, r) => s + r.amount, 0)
  drawPagedTable(ctx, [
    { label: 'Member', width: CONTENT_WIDTH * 0.6, get: (r) => (r as MemberGivingSummary['rows'][number]).name },
    { label: 'Gifts', width: CONTENT_WIDTH * 0.15, align: 'right', get: (r) => String((r as MemberGivingSummary['rows'][number]).count) },
    { label: 'Total', width: CONTENT_WIDTH * 0.25, align: 'right', get: (r) => formatCurrency((r as MemberGivingSummary['rows'][number]).amount) },
  ], mg.rows, {
    empty: 'No member donations in this period',
    total: [`Total (${mg.membersWhoGave})`, '', formatCurrency(memberTotal)],
  })

  // ── Running header + footer on content pages ──
  // The cover (page 0) stays clean. The bottom margin is zeroed while
  // stamping: any text whose line box crosses the margin edge makes pdfkit's
  // line-wrapper silently addPage() to "continue" it, producing extra
  // near-blank trailing pages — and the footer sits close enough to the edge
  // that its line height crosses it. With no bottom margin the wrapper never
  // fires.
  const pageRange = doc.bufferedPageRange()
  const contentPages = pageRange.count - 1
  for (let i = 1; i < pageRange.count; i++) {
    doc.switchToPage(pageRange.start + i)
    doc.page.margins.bottom = 0

    doc.fontSize(8).font('Helvetica-Bold').fillColor(COLOR.gray)
    doc.text(data.committeeName, left, PAGE_MARGIN, { width: CONTENT_WIDTH / 2, lineBreak: false })
    doc.fontSize(8).font('Helvetica').fillColor(COLOR.lightGray)
    doc.text(`Financial Summary Report · ${data.periodLabel}`, left, PAGE_MARGIN, {
      width: CONTENT_WIDTH,
      align: 'right',
      lineBreak: false,
    })
    doc.moveTo(left, HEADER_RULE_Y).lineTo(left + CONTENT_WIDTH, HEADER_RULE_Y).strokeColor(COLOR.border).lineWidth(1).stroke()

    doc.moveTo(left, FOOTER_RULE_Y).lineTo(left + CONTENT_WIDTH, FOOTER_RULE_Y).strokeColor(COLOR.border).lineWidth(1).stroke()
    doc.fontSize(8).font('Helvetica').fillColor(COLOR.lightGray)
    doc.text(`Generated ${data.generatedAt}`, left, FOOTER_RULE_Y + 6, { width: CONTENT_WIDTH / 2, lineBreak: false })
    doc.text(`Page ${i} of ${contentPages}`, left, FOOTER_RULE_Y + 6, { width: CONTENT_WIDTH, align: 'right', lineBreak: false })
  }

  doc.end()
  return done
}
