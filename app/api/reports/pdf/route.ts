import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireCommitteeMemberById } from '@/lib/auth'
import { mapCommittee } from '@/lib/map-committee'
import { getContributions } from '@/actions/donations'
import { getCommitteeContributions } from '@/actions/committee-contributions'
import { getInKindContributions } from '@/actions/in-kind-contributions'
import { getExpenditures } from '@/actions/expenses'
import { getRosterMembers } from '@/actions/roster'
import {
  getMonthlyData,
  getExpenseCategoryBreakdown,
  getPaymentMethodBreakdown,
  getTopDonors,
  getMemberGivingSummary,
} from '@/lib/analytics'
import { renderReportChart } from '@/lib/report-chart'
import { renderReportPdf } from '@/lib/pdf-report'
import { formatDate } from '@/lib/utils'
import { format } from 'date-fns'

const schema = z.object({
  committeeId: z.string(),
  start: z.string(),
  end: z.string(),
})

/**
 * Deliberately a Route Handler, not a Server Action: returning the PDF bytes
 * directly as the response body skips the base64 round-trip a Server Action
 * would need for binary data.
 */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const { committeeId, start, end } = parsed.data

  try {
    await requireCommitteeMemberById(committeeId)
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const committeeRow = await prisma.committee.findUniqueOrThrow({ where: { id: committeeId } })
  const committee = mapCommittee(committeeRow)

  const [allContributions, allCommitteeContributions, allInKind, allExpenditures, rosterMembers] = await Promise.all([
    getContributions(committeeId),
    getCommitteeContributions(committeeId),
    getInKindContributions(committeeId),
    getExpenditures(committeeId),
    getRosterMembers(committeeId),
  ])

  const contributions = allContributions.filter((c) => c.date >= start && c.date <= end)
  const committeeContributions = allCommitteeContributions.filter((c) => c.date >= start && c.date <= end)
  const inKindContributions = allInKind.filter((i) => i.date >= start && i.date <= end)
  const expenditures = allExpenditures.filter((e) => e.date >= start && e.date <= end)

  const totalRaised = contributions.reduce((s, c) => s + c.amount, 0) + committeeContributions.reduce((s, c) => s + c.amount, 0)
  const totalSpent = expenditures.reduce((s, e) => s + e.amount, 0)

  const monthly = getMonthlyData(contributions, expenditures, committeeContributions)
  const chartImage = await renderReportChart(monthly)

  const addressParts = [
    committee.address1,
    committee.city && committee.state ? `${committee.city}, ${committee.state}` : committee.city,
    committee.zip,
  ].filter(Boolean)

  const pdfBuffer = await renderReportPdf({
    committeeName: committee.name,
    committeeAddress: addressParts.length ? addressParts.join(' ') : undefined,
    seecId: committee.seecId,
    periodLabel: `${formatDate(start)} – ${formatDate(end)}`,
    // Server-local date, not toISOString() — UTC would date evening
    // generations tomorrow.
    generatedAt: format(new Date(), 'MMM d, yyyy'),
    totalRaised,
    totalSpent,
    netBalance: totalRaised - totalSpent,
    monthly,
    chartImage,
    paymentMethodBreakdown: getPaymentMethodBreakdown(contributions),
    expenseCategoryBreakdown: getExpenseCategoryBreakdown(expenditures),
    topDonors: getTopDonors(contributions),
    contributions,
    committeeContributions,
    inKindContributions,
    expenditures,
    memberGiving: getMemberGivingSummary(rosterMembers, contributions),
  })

  const safeName = committee.name.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40)
  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeName}_Report_${start}_${end}.pdf"`,
    },
  })
}
