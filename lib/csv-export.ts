import Papa from 'papaparse'
import {
  PAYMENT_METHOD_LABELS,
  SOURCE_LABELS,
  EXPENSE_CATEGORY_LABELS,
  IN_KIND_ENTITY_LABELS,
  type Contribution,
  type CommitteeContribution,
  type InKindContribution,
  type Expenditure,
  type Reimbursement,
  type CommitteeEvent,
  type RosterMember,
  type BankAccount,
  type BankTransaction,
  type Payee,
} from '@/lib/types'
import type { SeecFilingRecord, CustomFilingPeriodRecord } from '@/actions/filings'

export interface ExportFile {
  filename: string
  content: string
}

function toCsv(rows: Record<string, unknown>[]): string {
  return Papa.unparse(rows)
}

/** SEEC Section B/P/C1/M event columns reference an event by letter, not id. */
function eventLabel(eventId: string | undefined, eventsById: Map<string, CommitteeEvent>): string {
  if (!eventId) return ''
  const event = eventsById.get(eventId)
  return event ? `Event ${event.letter}` : ''
}

export function contributionsToCsv(rows: Contribution[], eventsById: Map<string, CommitteeEvent>): string {
  return toCsv(rows.map((c) => ({
    Date: c.date,
    'First Name': c.contributor.firstName,
    'Middle Initial': c.contributor.middleInitial ?? '',
    'Last Name': c.contributor.lastName,
    Email: c.contributor.email ?? '',
    Phone: c.contributor.phone ?? '',
    Address: c.contributor.address1,
    'Address 2': c.contributor.address2 ?? '',
    City: c.contributor.city,
    State: c.contributor.state,
    Zip: c.contributor.zip,
    Employer: c.contributor.employer ?? '',
    Occupation: c.contributor.occupation ?? '',
    Amount: c.amount,
    Method: PAYMENT_METHOD_LABELS[c.method],
    'Check Number': c.checkNumber ?? '',
    Source: SOURCE_LABELS[c.source],
    Itemized: c.isItemized ? 'Yes' : 'No',
    Event: eventLabel(c.eventId, eventsById),
    Memo: c.memo ?? '',
    'Processing Fee': c.processingFee ?? '',
    'Net Amount': c.netAmount ?? '',
    'Card Type': c.cardType ?? '',
    'Card Last 4': c.cardLast4 ?? '',
    Recurring: c.isRecurring ? 'Yes' : 'No',
    Campaign: c.campaign ?? '',
    'State Contractor': c.isStateContractor ? 'Yes' : 'No',
    Lobbyist: c.isLobbyist ? 'Yes' : 'No',
    'Filed Date': c.filedAt ?? '',
  })))
}

export function committeeContributionsToCsv(rows: CommitteeContribution[], eventsById: Map<string, CommitteeEvent>): string {
  return toCsv(rows.map((c) => ({
    Date: c.date,
    'From Committee': c.fromName,
    'Treasurer Name': c.treasurerName ?? '',
    Street: c.street ?? '',
    City: c.city ?? '',
    State: c.state,
    Zip: c.zip ?? '',
    Amount: c.amount,
    Method: c.method ? PAYMENT_METHOD_LABELS[c.method] : '',
    'Check Number': c.checkNumber ?? '',
    Event: eventLabel(c.eventId, eventsById),
    Memo: c.memo ?? '',
    'Filed Date': c.filedAt ?? '',
  })))
}

export function inKindContributionsToCsv(rows: InKindContribution[], eventsById: Map<string, CommitteeEvent>): string {
  return toCsv(rows.map((c) => ({
    Date: c.date,
    'Entity Type': IN_KIND_ENTITY_LABELS[c.entityType],
    'Last Name': c.lastName,
    'First Name': c.firstName ?? '',
    'Middle Initial': c.middleInitial ?? '',
    'Entity Name': c.entityName ?? '',
    Street: c.street ?? '',
    City: c.city ?? '',
    State: c.state,
    Zip: c.zip ?? '',
    'Fair Market Value': c.fairMarketValue,
    Description: c.description,
    'State Contractor Principal': c.isStateContractorPrincipal ? 'Yes' : 'No',
    'Contractor Branch': c.contractorBranch ?? '',
    Lobbyist: c.isLobbyist ? 'Yes' : 'No',
    Event: eventLabel(c.eventId, eventsById),
    Memo: c.memo ?? '',
    'Filed Date': c.filedAt ?? '',
  })))
}

export function expendituresToCsv(rows: Expenditure[], eventsById: Map<string, CommitteeEvent>): string {
  return toCsv(rows.map((e) => ({
    Date: e.date,
    Payee: e.payee,
    'Payee Address': e.payeeAddress1 ?? '',
    'Payee City': e.payeeCity ?? '',
    'Payee State': e.payeeState ?? '',
    'Payee Zip': e.payeeZip ?? '',
    Purpose: e.purpose,
    Category: EXPENSE_CATEGORY_LABELS[e.category],
    'Category Code': e.category,
    Amount: e.amount,
    Method: PAYMENT_METHOD_LABELS[e.method],
    'Check Number': e.checkNumber ?? '',
    Event: eventLabel(e.eventId, eventsById),
    Memo: e.memo ?? '',
    'Filed Date': e.filedAt ?? '',
  })))
}

export function reimbursementsToCsv(rows: Reimbursement[], eventsById: Map<string, CommitteeEvent>): string {
  return toCsv(rows.map((r) => ({
    Date: r.date,
    'Worker Last Name': r.workerLastName,
    'Worker First Name': r.workerFirstName,
    'Worker Middle Initial': r.workerMiddleInitial ?? '',
    Description: r.description,
    Amount: r.amount,
    Method: PAYMENT_METHOD_LABELS[r.method],
    'Check Number': r.checkNumber ?? '',
    'Vendor Name': r.vendorName ?? '',
    Street: r.street ?? '',
    City: r.city ?? '',
    State: r.state,
    Zip: r.zip ?? '',
    Category: EXPENSE_CATEGORY_LABELS[r.category],
    Event: eventLabel(r.eventId, eventsById),
    Memo: r.memo ?? '',
    'Filed Date': r.filedAt ?? '',
  })))
}

export function eventsToCsv(rows: CommitteeEvent[]): string {
  return toCsv(rows.map((e) => ({
    Letter: e.letter,
    Date: e.date,
    Description: e.description,
    Fundraiser: e.isFundraiser ? 'Yes' : 'No',
    Street: e.street ?? '',
    City: e.city ?? '',
    State: e.state,
    Zip: e.zip ?? '',
    'Personal Residence': e.isPersonalResidence ? 'Yes' : 'No',
    'Donated Goods/Services': e.hadDonatedGoods ? 'Yes' : 'No',
    'Tag Sale': e.wasTagSale ? 'Yes' : 'No',
    'Program Book': e.hadProgramBook ? 'Yes' : 'No',
    'Sold Food': e.soldFoodAtFair ? 'Yes' : 'No',
    'Food Receipts': e.foodReceipts,
    'Tag Sale Receipts': e.tagSaleReceipts,
    Notes: e.notes ?? '',
  })))
}

export function rosterToCsv(rows: RosterMember[]): string {
  return toCsv(rows.map((m) => ({
    'First Name': m.firstName,
    'Last Name': m.lastName,
    Email: m.email ?? '',
    Phone: m.phone ?? '',
    Address: m.address1 ?? '',
    'Address 2': m.address2 ?? '',
    City: m.city ?? '',
    State: m.state,
    Zip: m.zip ?? '',
    Active: m.isActive ? 'Yes' : 'No',
    'Dues Paid': (m.duesPaid || m.duesPaidViaAnedot) ? 'Yes' : 'No',
    'Total Contributed': m.contributionTotal,
    'Contribution Count': m.contributionCount,
    Notes: m.notes ?? '',
  })))
}

export function payeesToCsv(rows: Payee[]): string {
  return toCsv(rows.map((p) => ({
    Name: p.name,
    Address: p.address1 ?? '',
    City: p.city ?? '',
    State: p.state,
    Zip: p.zip ?? '',
    'Default Category': EXPENSE_CATEGORY_LABELS[p.defaultCategory],
    'Default Purpose': p.defaultPurpose ?? '',
  })))
}

export function bankAccountsToCsv(rows: BankAccount[]): string {
  return toCsv(rows.map((a) => ({
    Name: a.name,
    Institution: a.institution,
    Type: a.accountType,
    'Last 4': a.lastFour,
    'Current Balance': a.currentBalance,
    'Last Synced': a.lastSyncedAt ?? '',
  })))
}

export function bankTransactionsToCsv(rows: BankTransaction[], accountsById: Map<string, BankAccount>): string {
  return toCsv(rows.map((t) => ({
    Account: accountsById.get(t.bankAccountId)?.name ?? '',
    Date: t.date,
    Description: t.description,
    Merchant: t.merchantName ?? '',
    Category: t.category ?? '',
    Amount: t.amount,
    'Matched To': t.matchType,
    Reconciled: t.isReconciled ? 'Yes' : 'No',
  })))
}

export function filingsToCsv(rows: SeecFilingRecord[]): string {
  return toCsv(rows.map((f) => ({
    'Period Start': f.periodStart,
    'Period End': f.periodEnd,
    Status: f.status,
    'Beginning Balance': f.beginningBalance ?? '',
    'Ending Balance': f.endingBalance ?? '',
  })))
}

export function customFilingPeriodsToCsv(rows: CustomFilingPeriodRecord[]): string {
  return toCsv(rows.map((p) => ({
    Label: p.label,
    'Period Start': p.periodStart,
    'Period End': p.periodEnd,
    'Due Date': p.dueDate ?? '',
  })))
}
