import { notFound } from 'next/navigation'
import { getCommitteeBySlug } from '@/actions/committees'
import { getContributions } from '@/actions/donations'
import { getExpenditures } from '@/actions/expenses'
import { getBankAccounts } from '@/actions/bank'
import { getRosterMembers } from '@/actions/roster'
import { requireCommitteeMember, canEditFinances } from '@/lib/auth'
import {
  getMonthlyData, getCumulativeData, getDuesStatusBreakdown,
  getExpenseCategoryBreakdown, getSeecSummary, getRecentActivity,
} from '@/lib/analytics'
import DashboardSummaryCards from '@/components/dashboard/DashboardSummaryCards'
import MonthlyChart from '@/components/dashboard/MonthlyChart'
import DuesStatusChart from '@/components/dashboard/DuesStatusChart'
import CumulativeBalanceChart from '@/components/dashboard/CumulativeBalanceChart'
import ExpenseCategoryChart from '@/components/dashboard/ExpenseCategoryChart'
import RecentActivity from '@/components/dashboard/RecentActivity'
import SeecWidget from '@/components/dashboard/SeecWidget'

interface Props {
  params: Promise<{ committeeSlug: string }>
}

export default async function DashboardPage({ params }: Props) {
  const { committeeSlug } = await params
  const committee = await getCommitteeBySlug(committeeSlug)
  if (!committee) notFound()

  const { role } = await requireCommitteeMember(committeeSlug)

  const [contributions, expenditures, bankAccounts, rosterMembers] = await Promise.all([
    getContributions(committee.id),
    getExpenditures(committee.id),
    getBankAccounts(committee.id),
    getRosterMembers(committee.id),
  ])

  const totalRaised = contributions.reduce((s, c) => s + c.amount, 0)
  const totalSpent = expenditures.reduce((s, e) => s + e.amount, 0)

  const monthly = getMonthlyData(contributions, expenditures)
  const cumulative = getCumulativeData(monthly)
  const duesStatus = getDuesStatusBreakdown(rosterMembers)
  const categories = getExpenseCategoryBreakdown(expenditures)
  const seec = getSeecSummary(contributions)
  const activity = getRecentActivity(contributions, expenditures, 8)

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {committee.name} · {committee.electionYear} election cycle
          </p>
        </div>
        <DashboardSummaryCards
          totalRaised={totalRaised}
          totalSpent={totalSpent}
          seec={seec}
          contributionCount={contributions.length}
          expenditureCount={expenditures.length}
          bankAccounts={bankAccounts}
          selectedBankAccountId={committee.dashboardBankAccountId}
          canEdit={canEditFinances(role)}
          committeeSlug={committeeSlug}
        />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2"><MonthlyChart data={monthly} /></div>
          <div><DuesStatusChart data={duesStatus} total={rosterMembers.length} /></div>
        </div>
        <CumulativeBalanceChart data={cumulative} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ExpenseCategoryChart data={categories} />
          <RecentActivity items={activity} committeeSlug={committeeSlug} />
        </div>
        <SeecWidget summary={seec} committeeSlug={committeeSlug} />
      </div>
    </div>
  )
}
