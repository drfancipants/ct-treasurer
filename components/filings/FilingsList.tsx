'use client'

import { useState } from 'react'
import { FileText, Download, CheckCircle2, Clock, Wallet, Pencil } from 'lucide-react'
import type { Contribution, Expenditure, CommitteeEvent, CommitteeContribution, InKindContribution, Reimbursement } from '@/lib/types'
import type { Committee } from '@/lib/types'
import type { SeecFilingRecord } from '@/actions/filings'
import Form20ExportDialog from '@/components/filings/Form20ExportDialog'
import FilingBalanceDialog from '@/components/filings/FilingBalanceDialog'
import { formatCurrency } from '@/lib/utils'
import { markFiled } from '@/actions/filings'

// ─── Period generation ────────────────────────────────────────────────────────

const QUARTER_DEFS = [
  { label: 'Jan 1 – Mar 31', start: '-01-01', end: '-03-31', due: (y: number) => `Apr 10, ${y}` },
  { label: 'Apr 1 – Jun 30', start: '-04-01', end: '-06-30', due: (y: number) => `Jul 10, ${y}` },
  { label: 'Jul 1 – Sep 30', start: '-07-01', end: '-09-30', due: (y: number) => `Oct 10, ${y}` },
  { label: 'Oct 1 – Dec 31', start: '-10-01', end: '-12-31', due: (y: number) => `Jan 10, ${y + 1}` },
]

interface Period {
  label: string
  start: string
  end: string
  due: string
}

function generatePeriods(electionYear?: number): Period[] {
  const today = new Date().toISOString().slice(0, 10)
  const currentYear = new Date().getFullYear()
  const startYear = electionYear ? Math.min(electionYear, currentYear - 1) : currentYear - 1

  const periods: Period[] = []
  for (let year = currentYear; year >= startYear; year--) {
    for (let qi = 3; qi >= 0; qi--) {
      const q = QUARTER_DEFS[qi]
      const start = `${year}${q.start}`
      if (start > today) continue
      periods.push({
        label: `Q${qi + 1} ${year} — ${q.label}`,
        start,
        end: `${year}${q.end}`,
        due: q.due(year),
      })
    }
  }
  return periods
}

function getPeriodStatus(
  start: string,
  end: string,
  filings: SeecFilingRecord[]
): 'filed' | 'ready' {
  const match = filings.find((f) => f.periodStart === start && f.periodEnd === end)
  return match?.status === 'FILED' || match?.status === 'AMENDED' ? 'filed' : 'ready'
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  ready: { icon: Clock, label: 'Ready to file', color: 'text-amber-700 bg-amber-50 ring-amber-200' },
  filed: { icon: CheckCircle2, label: 'Filed', color: 'text-emerald-700 bg-emerald-50 ring-emerald-200' },
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  contributions: Contribution[]
  expenditures: Expenditure[]
  events: CommitteeEvent[]
  committeeContributions: CommitteeContribution[]
  inKindContributions: InKindContribution[]
  reimbursements: Reimbursement[]
  committee: Committee
  filings: SeecFilingRecord[]
  canEdit: boolean
}

export default function FilingsList({ contributions, expenditures, events, committeeContributions, inKindContributions, reimbursements, committee, filings: initialFilings, canEdit }: Props) {
  const [exportPeriod, setExportPeriod] = useState<{ start: string; end: string } | null>(null)
  const [balancePeriod, setBalancePeriod] = useState<Period | null>(null)
  const [filings, setFilings] = useState(initialFilings)

  // Newest-first, matching generatePeriods' order — so the "previous" period
  // (chronologically earlier) for periods[i] is periods[i + 1]
  const periods = generatePeriods(committee.electionYear)

  function updateFilingRecord(record: SeecFilingRecord) {
    setFilings((prev) => {
      const idx = prev.findIndex((f) => f.periodStart === record.periodStart && f.periodEnd === record.periodEnd)
      if (idx !== -1) {
        const updated = [...prev]
        updated[idx] = record
        return updated
      }
      return [...prev, record]
    })
  }

  async function handleFiled(start: string, end: string) {
    const record = await markFiled(committee.id, start, end, committee.slug)
    updateFilingRecord(record)
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">SEEC Filings</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Generate Form 20 uploads for eCRIS · SEEC ID:{' '}
            <span className="font-mono text-slate-700">{committee.seecId ?? '—'}</span>
          </p>
        </div>
        <a
          href="https://seec.ct.gov"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          Open eCRIS ↗
        </a>
      </div>

      {/* How it works */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-blue-800 mb-2">How to file</p>
        <ol className="space-y-1">
          {[
            'Click "Generate Form 20" for the filing period below',
            "Download the .xlsx file — it's pre-filled with your contributions and expenses",
            'Log in to eCRIS at seec.ct.gov and select your filing period',
            'Click "Upload Report" and select the downloaded file',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-blue-700">
              <span className="w-4 h-4 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      {/* Filing periods */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            Filing periods
          </p>
        </div>
        <div className="divide-y divide-slate-100">
          {periods.map((period, index) => {
            const status = getPeriodStatus(period.start, period.end, filings)
            const cfg = STATUS_CONFIG[status]
            const Icon = cfg.icon

            const periodContribs = contributions.filter(
              (c) => c.date >= period.start && c.date <= period.end
            )
            const periodCommitteeContribs = committeeContributions.filter(
              (c) => c.date >= period.start && c.date <= period.end
            )
            const periodExpends = expenditures.filter(
              (e) => e.date >= period.start && e.date <= period.end
            )
            const totalRaised =
              periodContribs.reduce((s, c) => s + c.amount, 0) +
              periodCommitteeContribs.reduce((s, c) => s + c.amount, 0)
            const totalSpent = periodExpends.reduce((s, e) => s + e.amount, 0)

            // periods is newest-first, so the chronologically-preceding
            // period (whose ending balance seeds this one's beginning
            // balance) is the next array entry
            const filing = filings.find((f) => f.periodStart === period.start && f.periodEnd === period.end)
            const previousPeriod = periods[index + 1]
            const previousFiling = previousPeriod
              ? filings.find((f) => f.periodStart === previousPeriod.start && f.periodEnd === previousPeriod.end)
              : undefined
            const suggestedBeginningBalance = previousFiling?.endingBalance
            const displayBeginningBalance = filing?.beginningBalance ?? suggestedBeginningBalance
            const displayEndingBalance =
              filing?.endingBalance ??
              (displayBeginningBalance !== undefined ? displayBeginningBalance + totalRaised - totalSpent : undefined)

            return (
              <div
                key={period.start}
                className="flex items-center justify-between px-4 py-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{period.label}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-slate-500">Due {period.due}</span>
                      {totalRaised > 0 && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="text-xs text-emerald-700">
                            +{formatCurrency(totalRaised)} raised
                          </span>
                        </>
                      )}
                      {totalSpent > 0 && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="text-xs text-rose-700">
                            ({formatCurrency(totalSpent)}) spent
                          </span>
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => canEdit && setBalancePeriod(period)}
                      disabled={!canEdit}
                      className="flex items-center gap-1.5 mt-1 text-xs text-slate-500 hover:text-slate-700 disabled:hover:text-slate-500 transition-colors group/balance"
                    >
                      <Wallet className="w-3 h-3 text-slate-400" />
                      Balance:{' '}
                      {displayBeginningBalance !== undefined ? formatCurrency(displayBeginningBalance) : '—'}
                      {' → '}
                      {displayEndingBalance !== undefined ? formatCurrency(displayEndingBalance) : '—'}
                      {canEdit && (
                        <Pencil className="w-3 h-3 text-slate-300 group-hover/balance:text-slate-500 transition-colors" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${cfg.color}`}
                  >
                    <Icon className="w-3 h-3" />
                    {cfg.label}
                  </span>
                  <button
                    onClick={() => setExportPeriod({ start: period.start, end: period.end })}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Generate Form 20
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Sections reference */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
          What gets exported
        </p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { section: 'A', desc: 'Small contributor total', detail: 'Non-itemized donations (aggregate)' },
            { section: 'B', desc: 'Itemized contributions', detail: 'Individual donors with full address + employer' },
            { section: 'P', desc: 'Committee expenses', detail: 'All expenditures with SEEC purpose codes' },
          ].map((s) => (
            <div key={s.section} className="rounded-lg bg-slate-50 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                  {s.section}
                </span>
                <p className="text-xs font-medium text-slate-700">{s.desc}</p>
              </div>
              <p className="text-[11px] text-slate-500">{s.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mt-3">
          Sections C1 (committee contributions), M (in-kind), L1 (events), and T (worker
          reimbursements) are also filled from your data. All other sections (D, E, K, Q, R, S…)
          are included as empty sheets — fill them manually in Excel if needed before uploading.
        </p>
      </div>

      {exportPeriod && (
        <Form20ExportDialog
          key={exportPeriod.start}
          open
          onClose={() => setExportPeriod(null)}
          contributions={contributions}
          expenditures={expenditures}
          events={events}
          committeeContributions={committeeContributions}
          inKindContributions={inKindContributions}
          reimbursements={reimbursements}
          committeeName={committee.name}
          initialPeriod={exportPeriod}
          onFiled={canEdit ? handleFiled : undefined}
        />
      )}

      {balancePeriod && (() => {
        const idx = periods.findIndex((p) => p.start === balancePeriod.start)
        const previousPeriod = periods[idx + 1]
        const previousFiling = previousPeriod
          ? filings.find((f) => f.periodStart === previousPeriod.start && f.periodEnd === previousPeriod.end)
          : undefined
        const filing = filings.find((f) => f.periodStart === balancePeriod.start && f.periodEnd === balancePeriod.end)

        // Same totals as the row display — individual + committee
        // contributions minus expenses. In-kind contributions are
        // deliberately excluded: they're not cash, so they don't move cash
        // balance on hand.
        const periodContribs = contributions.filter(
          (c) => c.date >= balancePeriod.start && c.date <= balancePeriod.end
        )
        const periodCommitteeContribs = committeeContributions.filter(
          (c) => c.date >= balancePeriod.start && c.date <= balancePeriod.end
        )
        const periodExpends = expenditures.filter(
          (e) => e.date >= balancePeriod.start && e.date <= balancePeriod.end
        )
        const totalRaised =
          periodContribs.reduce((s, c) => s + c.amount, 0) +
          periodCommitteeContribs.reduce((s, c) => s + c.amount, 0)
        const totalSpent = periodExpends.reduce((s, e) => s + e.amount, 0)

        return (
          <FilingBalanceDialog
            key={balancePeriod.start}
            open
            onClose={() => setBalancePeriod(null)}
            onSave={(record) => {
              updateFilingRecord(record)
              setBalancePeriod(null)
            }}
            committeeId={committee.id}
            committeeSlug={committee.slug}
            periodLabel={balancePeriod.label}
            periodStart={balancePeriod.start}
            periodEnd={balancePeriod.end}
            filing={filing}
            suggestedBeginningBalance={previousFiling?.endingBalance}
            netChange={totalRaised - totalSpent}
          />
        )
      })()}
    </>
  )
}
