'use server'

import { requireCommitteeMemberById } from '@/lib/auth'
import { getContributions } from '@/actions/donations'
import { getCommitteeContributions } from '@/actions/committee-contributions'
import { getInKindContributions } from '@/actions/in-kind-contributions'
import { getExpenditures } from '@/actions/expenses'
import { getReimbursements } from '@/actions/reimbursements'
import { getEvents } from '@/actions/events'
import { getRosterMembers } from '@/actions/roster'
import { getPayees } from '@/actions/payees'
import { getBankAccounts, getTransactions } from '@/actions/bank'
import { getFilings, getCustomFilingPeriods } from '@/actions/filings'
import type { CommitteeEvent, BankAccount } from '@/lib/types'
import {
  contributionsToCsv,
  committeeContributionsToCsv,
  inKindContributionsToCsv,
  expendituresToCsv,
  reimbursementsToCsv,
  eventsToCsv,
  rosterToCsv,
  payeesToCsv,
  bankAccountsToCsv,
  bankTransactionsToCsv,
  filingsToCsv,
  customFilingPeriodsToCsv,
  type ExportFile,
} from '@/lib/csv-export'

/**
 * Every full committee export in one shot — one CSV per data type, returned
 * as plain strings so the client can zip and download them (a Server Action
 * round-tripping a binary Blob is trickier than round-tripping text). Each
 * get*() call already re-verifies committee membership on its own, but check
 * it here too so an empty committee still fails closed instead of silently
 * returning an all-empty export to someone who was never a member.
 */
export async function exportCommitteeData(committeeId: string): Promise<ExportFile[]> {
  await requireCommitteeMemberById(committeeId)

  const [
    contributions,
    committeeContributions,
    inKindContributions,
    expenditures,
    reimbursements,
    events,
    roster,
    payees,
    bankAccounts,
    filings,
    customFilingPeriods,
  ] = await Promise.all([
    getContributions(committeeId),
    getCommitteeContributions(committeeId),
    getInKindContributions(committeeId),
    getExpenditures(committeeId),
    getReimbursements(committeeId),
    getEvents(committeeId),
    getRosterMembers(committeeId),
    getPayees(committeeId),
    getBankAccounts(committeeId),
    getFilings(committeeId),
    getCustomFilingPeriods(committeeId),
  ])

  const transactions = bankAccounts.length
    ? await getTransactions(bankAccounts.map((a) => a.id))
    : []

  const eventsById = new Map<string, CommitteeEvent>(events.map((e) => [e.id, e]))
  const accountsById = new Map<string, BankAccount>(bankAccounts.map((a) => [a.id, a]))

  return [
    { filename: 'donations.csv', content: contributionsToCsv(contributions, eventsById) },
    { filename: 'committee_contributions.csv', content: committeeContributionsToCsv(committeeContributions, eventsById) },
    { filename: 'in_kind_contributions.csv', content: inKindContributionsToCsv(inKindContributions, eventsById) },
    { filename: 'expenses.csv', content: expendituresToCsv(expenditures, eventsById) },
    { filename: 'reimbursements.csv', content: reimbursementsToCsv(reimbursements, eventsById) },
    { filename: 'events.csv', content: eventsToCsv(events) },
    { filename: 'roster.csv', content: rosterToCsv(roster) },
    { filename: 'payees.csv', content: payeesToCsv(payees) },
    { filename: 'bank_accounts.csv', content: bankAccountsToCsv(bankAccounts) },
    { filename: 'bank_transactions.csv', content: bankTransactionsToCsv(transactions, accountsById) },
    { filename: 'filings.csv', content: filingsToCsv(filings) },
    { filename: 'custom_filing_periods.csv', content: customFilingPeriodsToCsv(customFilingPeriods) },
  ]
}
