'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TrendingUp, TrendingDown, Scale, AlertCircle, Landmark, RefreshCw, CheckCircle2 } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { formatCurrency, cn } from '@/lib/utils'
import { setDashboardBankAccount } from '@/actions/bank'
import { getSeecSummary } from '@/lib/analytics'
import type { BankAccount, Contribution, CommitteeContribution, Expenditure } from '@/lib/types'

type Range = 'last12' | 'ytd' | 'all'

const RANGE_OPTIONS: { key: Range; label: string }[] = [
  { key: 'last12', label: 'Last 12 months' },
  { key: 'ytd', label: 'Year to date' },
  { key: 'all', label: 'Total' },
]

function inRange(dateStr: string, range: Range, now: Date): boolean {
  if (range === 'all') return true
  const date = new Date(dateStr)
  if (range === 'ytd') return date.getFullYear() === now.getFullYear()
  // Trailing 12 months, including the current month
  const cutoff = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  return date >= cutoff
}

interface Props {
  contributions: Contribution[]
  committeeContributions: CommitteeContribution[]
  expenditures: Expenditure[]
  bankAccounts?: BankAccount[]
  selectedBankAccountId?: string
  canEdit?: boolean
  committeeSlug?: string
}

export default function DashboardSummaryCards({
  contributions,
  committeeContributions,
  expenditures,
  bankAccounts = [],
  selectedBankAccountId,
  canEdit = false,
  committeeSlug,
}: Props) {
  const [range, setRange] = useState<Range>('ytd')
  const showBank = bankAccounts.length > 0

  const now = new Date()
  const filteredContributions = contributions.filter((c) => inRange(c.date, range, now))
  const filteredCommitteeContributions = committeeContributions.filter((c) => inRange(c.date, range, now))
  const filteredExpenditures = expenditures.filter((e) => inRange(e.date, range, now))

  const totalRaised =
    filteredContributions.reduce((s, c) => s + c.amount, 0) +
    filteredCommitteeContributions.reduce((s, c) => s + c.amount, 0)
  const totalSpent = filteredExpenditures.reduce((s, e) => s + e.amount, 0)
  const contributionCount = filteredContributions.length + filteredCommitteeContributions.length
  const expenditureCount = filteredExpenditures.length
  const seec = getSeecSummary(filteredContributions)

  const balance = totalRaised - totalSpent
  const balancePositive = balance >= 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-1">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setRange(opt.key)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              range === opt.key
                ? 'bg-blue-600 text-white'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className={`grid grid-cols-2 gap-4 ${showBank ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
        {showBank && committeeSlug && (
          <BankBalanceCard
            accounts={bankAccounts}
            selectedId={selectedBankAccountId}
            canEdit={canEdit}
            committeeSlug={committeeSlug}
          />
        )}
        <Card
          label="Net balance"
          value={formatCurrency(balance)}
          sub={balancePositive ? 'Ahead of spending' : 'Spending exceeds income'}
          valueColor={balancePositive ? 'text-emerald-700' : 'text-red-700'}
          iconBg={balancePositive ? 'bg-emerald-50' : 'bg-red-50'}
          icon={<Scale className={`w-4 h-4 ${balancePositive ? 'text-emerald-600' : 'text-red-600'}`} />}
          highlight={!balancePositive}
        />
        <Card
          label="Total raised"
          value={formatCurrency(totalRaised)}
          sub={`${contributionCount} contributions`}
          valueColor="text-emerald-700"
          iconBg="bg-emerald-50"
          icon={<TrendingUp className="w-4 h-4 text-emerald-600" />}
        />
        <Card
          label="Total spent"
          value={formatCurrency(totalSpent)}
          sub={`${expenditureCount} expenditures`}
          valueColor="text-rose-700"
          iconBg="bg-rose-50"
          icon={<TrendingDown className="w-4 h-4 text-rose-600" />}
        />
        <Card
          label="SEEC issues"
          value={String(seec.needsReview + seec.incomplete)}
          sub={
            seec.needsReview + seec.incomplete === 0
              ? 'All contributions compliant'
              : `${seec.incomplete} incomplete · ${seec.needsReview} need info`
          }
          valueColor={seec.needsReview + seec.incomplete > 0 ? 'text-amber-700' : 'text-slate-700'}
          iconBg={seec.needsReview + seec.incomplete > 0 ? 'bg-amber-50' : 'bg-slate-100'}
          icon={
            <AlertCircle
              className={`w-4 h-4 ${seec.needsReview + seec.incomplete > 0 ? 'text-amber-600' : 'text-slate-400'}`}
            />
          }
          highlight={seec.needsReview + seec.incomplete > 0}
        />
      </div>
    </div>
  )
}

function BankBalanceCard({
  accounts,
  selectedId,
  canEdit,
  committeeSlug,
}: {
  accounts: BankAccount[]
  selectedId?: string
  canEdit: boolean
  committeeSlug: string
}) {
  const router = useRouter()
  // Fall back to the first linked account until one is explicitly chosen
  const initial = accounts.find((a) => a.id === selectedId) ?? accounts[0]
  const [account, setAccount] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<'ok' | 'error' | null>(null)

  async function handleSelect(id: string) {
    const next = accounts.find((a) => a.id === id)
    if (!next || next.id === account.id) return
    const prev = account
    setAccount(next)
    setSaving(true)
    try {
      await setDashboardBankAccount(id, committeeSlug)
    } catch {
      setAccount(prev)
    } finally {
      setSaving(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/plaid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankAccountId: account.id }),
      })
      setSyncResult(res.ok ? 'ok' : 'error')
      if (res.ok) router.refresh()
    } catch {
      setSyncResult('error')
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncResult(null), 3000)
    }
  }

  const synced = account.lastSyncedAt
    ? `Synced ${formatDistanceToNow(parseISO(account.lastSyncedAt), { addSuffix: true })}`
    : 'Not synced yet'

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Bank balance</p>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-blue-50">
          <Landmark className="w-4 h-4 text-blue-600" />
        </div>
      </div>
      <p className="text-2xl font-semibold tabular leading-none mb-1 text-slate-900">
        {formatCurrency(account.currentBalance)}
      </p>
      {canEdit && accounts.length > 1 ? (
        <select
          value={account.id}
          onChange={(e) => handleSelect(e.target.value)}
          disabled={saving}
          aria-label="Bank account shown on the dashboard"
          className="w-full mt-0.5 -ml-1 text-xs text-slate-500 bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-blue-400 rounded cursor-pointer disabled:opacity-50"
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ••{a.lastFour}
            </option>
          ))}
        </select>
      ) : (
        <p className="text-xs text-slate-400 leading-snug">
          {account.name} ••{account.lastFour}
        </p>
      )}
      <div className="flex items-center justify-between mt-0.5">
        {syncResult === 'ok' ? (
          <span className="flex items-center gap-1 text-[10px] text-emerald-600">
            <CheckCircle2 className="w-2.5 h-2.5" /> Up to date
          </span>
        ) : syncResult === 'error' ? (
          <span className="text-[10px] text-red-600">Sync failed</span>
        ) : (
          <p className="text-[10px] text-slate-400">{synced}</p>
        )}
        {canEdit && (
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-700 disabled:opacity-50 transition-colors"
            title="Sync this account with Plaid"
          >
            <RefreshCw className={`w-2.5 h-2.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync'}
          </button>
        )}
      </div>
    </div>
  )
}

function Card({
  label,
  value,
  sub,
  valueColor,
  iconBg,
  icon,
  highlight,
}: {
  label: string
  value: string
  sub: string
  valueColor: string
  iconBg: string
  icon: React.ReactNode
  highlight?: boolean
}) {
  return (
    <div
      className={`bg-white border rounded-xl p-4 ${
        highlight ? 'border-amber-200' : 'border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
      </div>
      <p className={`text-2xl font-semibold tabular leading-none mb-1 ${valueColor}`}>{value}</p>
      <p className="text-xs text-slate-400 leading-snug">{sub}</p>
    </div>
  )
}
