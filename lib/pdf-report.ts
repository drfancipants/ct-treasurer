import PDFDocument from 'pdfkit'
import { formatCurrency } from '@/lib/utils'
import type { MonthlyData, CategoryData, DonorTotal } from '@/lib/analytics'

export interface ReportData {
  committeeName: string
  committeeAddress?: string
  seecId?: string
  periodLabel: string
  generatedAt: string
  totalRaised: number
  totalSpent: number
  netBalance: number
  contributionCount: number
  expenditureCount: number
  monthly: MonthlyData[]
  chartImage: Buffer
  paymentMethodBreakdown: CategoryData[]
  expenseCategoryBreakdown: CategoryData[]
  topDonors: DonorTotal[]
}

const PAGE_MARGIN = 36
const PAGE_WIDTH = 612 // LETTER
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2

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

interface TableColumn {
  label: string
  width: number
  align?: 'left' | 'right'
  get: (row: unknown) => string
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

/** Draws a bordered table with a shaded header row; returns the y position just below it. */
function drawTable(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  columns: TableColumn[],
  rows: unknown[],
  emptyLabel: string
): number {
  const rowHeight = 18
  const headerHeight = 18
  let cy = y

  doc.rect(x, cy, width, headerHeight).fillColor(COLOR.headerBg).fill()
  doc.rect(x, cy, width, headerHeight).strokeColor(COLOR.border).lineWidth(1).stroke()
  let cx = x
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor(COLOR.gray)
  for (const col of columns) {
    const label = truncateToWidth(doc, col.label.toUpperCase(), col.width - 10)
    doc.text(label, cx + 5, cy + 5, { width: col.width - 10, align: col.align ?? 'left', lineBreak: false })
    cx += col.width
  }
  cy += headerHeight

  if (rows.length === 0) {
    doc.rect(x, cy, width, rowHeight).strokeColor(COLOR.border).lineWidth(1).stroke()
    doc.fontSize(8.5).font('Helvetica').fillColor(COLOR.lightGray)
    doc.text(emptyLabel, x, cy + 5, { width, align: 'center' })
    return cy + rowHeight
  }

  for (const row of rows) {
    doc.rect(x, cy, width, rowHeight).strokeColor(COLOR.border).lineWidth(1).stroke()
    cx = x
    doc.fontSize(8.5).font('Helvetica').fillColor(COLOR.text)
    for (const col of columns) {
      const text = truncateToWidth(doc, col.get(row), col.width - 10)
      doc.text(text, cx + 5, cy + 5, { width: col.width - 10, align: col.align ?? 'left', lineBreak: false })
      cx += col.width
    }
    cy += rowHeight
  }
  return cy
}

function sectionTitle(doc: PDFKit.PDFDocument, text: string, x: number, y: number): number {
  doc.fontSize(10.5).font('Helvetica-Bold').fillColor(COLOR.text)
  doc.text(text, x, y)
  return y + 16
}

export async function renderReportPdf(data: ReportData): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'LETTER', margin: PAGE_MARGIN, bufferPages: true })
  const chunks: Buffer[] = []
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))))

  const left = PAGE_MARGIN
  let y = PAGE_MARGIN

  // ── Header ──
  doc.fontSize(16).font('Helvetica-Bold').fillColor(COLOR.text)
  doc.text(data.committeeName, left, y, { width: 300 })
  let leftY = doc.y
  if (data.committeeAddress) {
    doc.fontSize(9).font('Helvetica').fillColor(COLOR.gray)
    doc.text(data.committeeAddress, left, leftY + 2, { width: 300 })
    leftY = doc.y
  }
  if (data.seecId) {
    doc.fontSize(9).font('Helvetica').fillColor(COLOR.gray)
    doc.text(`SEEC ID: ${data.seecId}`, left, leftY + 2, { width: 300 })
    leftY = doc.y
  }

  doc.fontSize(13).font('Helvetica-Bold').fillColor(COLOR.blue)
  doc.text('Financial Summary Report', left, y, { width: CONTENT_WIDTH, align: 'right' })
  let rightY = doc.y
  doc.fontSize(9).font('Helvetica').fillColor(COLOR.gray)
  doc.text(data.periodLabel, left, rightY + 2, { width: CONTENT_WIDTH, align: 'right' })
  rightY = doc.y
  doc.text(`Generated ${data.generatedAt}`, left, rightY + 2, { width: CONTENT_WIDTH, align: 'right' })
  rightY = doc.y

  y = Math.max(leftY, rightY) + 10
  doc.moveTo(left, y).lineTo(left + CONTENT_WIDTH, y).strokeColor(COLOR.border).lineWidth(1).stroke()
  y += 16

  // ── Summary cards ──
  const cards: { label: string; value: string; color: string }[] = [
    { label: 'Total Raised', value: formatCurrency(data.totalRaised), color: COLOR.emerald },
    { label: 'Total Spent', value: formatCurrency(data.totalSpent), color: COLOR.red },
    { label: 'Net', value: formatCurrency(data.netBalance), color: COLOR.text },
    { label: 'Contributions', value: String(data.contributionCount), color: COLOR.text },
    { label: 'Expenditures', value: String(data.expenditureCount), color: COLOR.text },
  ]
  const cardGap = 8
  const cardWidth = (CONTENT_WIDTH - cardGap * (cards.length - 1)) / cards.length
  const cardHeight = 46
  cards.forEach((card, i) => {
    const cx = left + i * (cardWidth + cardGap)
    doc.roundedRect(cx, y, cardWidth, cardHeight, 4).fillColor(COLOR.cardBg).fill()
    doc.roundedRect(cx, y, cardWidth, cardHeight, 4).strokeColor(COLOR.border).lineWidth(1).stroke()
    doc.fontSize(7).font('Helvetica-Bold').fillColor(COLOR.gray)
    doc.text(card.label.toUpperCase(), cx + 6, y + 7, { width: cardWidth - 12 })
    doc.fontSize(13).font('Helvetica-Bold').fillColor(card.color)
    doc.text(card.value, cx + 6, y + 22, { width: cardWidth - 12 })
  })
  y += cardHeight + 14

  // ── Chart ──
  y = sectionTitle(doc, 'Monthly Activity', left, y)
  const chartAspect = 320 / 700
  const chartHeight = CONTENT_WIDTH * chartAspect
  doc.image(data.chartImage, left, y, { width: CONTENT_WIDTH })
  y += chartHeight + 14

  // ── Breakdown tables (side by side) ──
  const colGap = 12
  const colWidth = (CONTENT_WIDTH - colGap) / 2
  const breakdownColumns: TableColumn[] = [
    { label: 'Category', width: colWidth * 0.55, get: (r) => (r as CategoryData).name },
    { label: 'Count', width: colWidth * 0.2, align: 'right', get: (r) => String((r as CategoryData).count) },
    { label: 'Amount', width: colWidth * 0.25, align: 'right', get: (r) => formatCurrency((r as CategoryData).amount) },
  ]

  const titleY = sectionTitle(doc, 'By Payment Method', left, y)
  sectionTitle(doc, 'By Expense Category', left + colWidth + colGap, y)
  const leftTableEnd = drawTable(doc, left, titleY, colWidth, breakdownColumns, data.paymentMethodBreakdown, 'No activity in this period')
  const rightTableEnd = drawTable(doc, left + colWidth + colGap, titleY, colWidth, breakdownColumns, data.expenseCategoryBreakdown, 'No activity in this period')
  y = Math.max(leftTableEnd, rightTableEnd) + 14

  // ── Top donors ──
  y = sectionTitle(doc, 'Top Donors', left, y)
  const donorColumns: TableColumn[] = [
    { label: 'Donor', width: CONTENT_WIDTH * 0.6, get: (r) => (r as DonorTotal).name },
    { label: 'Gifts', width: CONTENT_WIDTH * 0.15, align: 'right', get: (r) => String((r as DonorTotal).count) },
    { label: 'Total', width: CONTENT_WIDTH * 0.25, align: 'right', get: (r) => formatCurrency((r as DonorTotal).amount) },
  ]
  drawTable(doc, left, y, CONTENT_WIDTH, donorColumns, data.topDonors, 'No contributions in this period')

  // ── Footer (page numbers) on every page ──
  // The bottom margin is zeroed while stamping footers: any text whose line
  // box crosses the margin edge makes pdfkit's line-wrapper silently
  // addPage() to "continue" it, producing extra near-blank trailing pages —
  // and the footer sits close enough to the edge that its line height
  // crosses it. With no bottom margin the wrapper never fires.
  const pageRange = doc.bufferedPageRange()
  for (let i = 0; i < pageRange.count; i++) {
    doc.switchToPage(pageRange.start + i)
    doc.page.margins.bottom = 0
    const footerY = doc.page.height - PAGE_MARGIN - 14
    doc.moveTo(left, footerY).lineTo(left + CONTENT_WIDTH, footerY).strokeColor(COLOR.border).lineWidth(1).stroke()
    doc.fontSize(8).font('Helvetica').fillColor(COLOR.lightGray)
    doc.text(data.committeeName, left, footerY + 6, { width: CONTENT_WIDTH / 2, lineBreak: false })
    doc.text(`Page ${i + 1} of ${pageRange.count}`, left, footerY + 6, { width: CONTENT_WIDTH, align: 'right', lineBreak: false })
  }

  doc.end()
  return done
}
