'use client'

import { useState } from 'react'
import { FileText, Download, CheckCircle2, Clock, Wallet, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Contribution, Expenditure, CommitteeEvent, CommitteeContribution, InKindContribution, Reimbursement } from '@/lib/types'
import type { Committee } from '@/lib/types'
import { FORM_30_OFFICES } from '@/lib/types'
import { FORM_SECTIONS } from '@/lib/seec-export'
import type { SeecFilingRecord, CustomFilingPeriodRecord } from '@/actions/filings'
import type { FilingPeriod } from '@/lib/filing-periods'
import { generateQuarterlyPeriods, generateStatutoryCandidatePeriods, mergeFilingPeriods } from '@/lib/filing-periods'
import FilingExportDialog from '@/components/filings/FilingExportDialog'
import FilingBalanceDialog from '@/components/filings/FilingBalanceDialog'
import CustomPeriodDialog from '@/components/filings/CustomPeriodDialog'
import { formatCurrency } from '@/lib/utils'
import { markFiled, deleteCustomFilingPeriod } from '@/actions/filings'

type Period = FilingPeriod

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
  customPeriods: CustomFilingPeriodRecord[]
  canEdit: boolean
}

export default function FilingsList({ contributions, expenditures, events, committeeContributions, inKindContributions, reimbursements, committee, filings: initialFilings, customPeriods: initialCustomPeriods, canEdit }: Props) {
  const [exportPeriod, setExportPeriod] = useState<{ start: string; end: string } | null>(null)
  const [balancePeriod, setBalancePeriod] = useState<Period | null>(null)
  const [showAddPeriod, setShowAddPeriod] = useState(false)
  const [filings, setFilings] = useState(initialFilings)
  const [customPeriods, setCustomPeriods] = useState(initialCustomPeriods)

  // Newest-first, matching generateQuarterlyPeriods' order — so the
  // "previous" period (chronologically earlier) for periods[i] is periods[i + 1]
  const periods = mergeFilingPeriods(generateQuarterlyPeriods(committee.electionYear), [
    ...generateStatutoryCandidatePeriods(committee),
    ...customPeriods,
  ])

  // Statewide & General Assembly candidate committees file Form 30; everyone
  // else (party committees, municipal & probate candidates) files Form 20.
  const formNumber: 20 | 30 =
    committee.type === 'CANDIDATE' && committee.officeSought && FORM_30_OFFICES.includes(committee.officeSought)
      ? 30
      : 20

  async function handleDeleteCustomPeriod(id: string) {
    const snapshot = customPeriods
    setCustomPeriods((prev) => prev.filter((p) => p.id !== id))
    try {
      await deleteCustomFilingPeriod(id, committee.slug)
    } catch {
      setCustomPeriods(snapshot)
    }
  }

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
            {formNumber === 30 ? 'Prepare Form 30 statements for eCRIS' : 'Generate Form 20 uploads for eCRIS'}
            {committee.seecId && (
              <>
                {' '}· Ref: <span className="font-mono text-slate-700">{committee.seecId}</span>
              </>
            )}
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
            `Click "Generate Form ${formNumber}" for the filing period below`,
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
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            Filing periods
          </p>
          {canEdit && (
            <button
              onClick={() => setShowAddPeriod(true)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              Add filing period
            </button>
          )}
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
                    <p className="text-sm font-medium text-slate-900">
                      {period.label}
                      {period.isCustom && (
                        <span className="ml-1.5 inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 ring-1 ring-purple-200 align-middle">
                          Custom
                        </span>
                      )}
                      {period.isStatutory && (
                        <span className="ml-1.5 inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-50 text-sky-700 ring-1 ring-sky-200 align-middle">
                          Statutory
                        </span>
                      )}
                    </p>
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
                  {canEdit && period.isCustom && period.customId && (
                    <button
                      onClick={() => handleDeleteCustomPeriod(period.customId!)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      aria-label="Delete custom filing period"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
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
                    Generate Form {formNumber}
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
            { section: FORM_SECTIONS[formNumber].small, desc: 'Small contributor total', detail: 'Non-itemized donations (aggregate)' },
            { section: FORM_SECTIONS[formNumber].itemized, desc: 'Itemized contributions', detail: 'Individual donors with full address + employer' },
            { section: FORM_SECTIONS[formNumber].expenses, desc: 'Committee expenses', detail: 'All expenditures with SEEC purpose codes' },
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
          Sections {FORM_SECTIONS[formNumber].committee} (committee contributions),
          {' '}{FORM_SECTIONS[formNumber].inKind} (in-kind), {FORM_SECTIONS[formNumber].events} (events),
          and {FORM_SECTIONS[formNumber].reimbursements} (worker reimbursements) are also filled from your
          data. Any remaining sections are included as empty sheets — fill them manually in Excel if needed
          before uploading.
        </p>
      </div>

      {exportPeriod && (
        <FilingExportDialog
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
          formNumber={formNumber}
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

      {showAddPeriod && (
        <CustomPeriodDialog
          open
          onClose={() => setShowAddPeriod(false)}
          onSave={(period) => {
            setCustomPeriods((prev) => [period, ...prev])
            setShowAddPeriod(false)
          }}
          committeeId={committee.id}
          committeeSlug={committee.slug}
        />
      )}
    </>
  )
}
