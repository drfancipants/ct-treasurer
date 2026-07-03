import Papa from 'papaparse'
import type { Contribution, PaymentMethod, RosterMember } from './types'
import { donorKey, getDonorYearTotals, INDIVIDUAL_ANNUAL_LIMIT, CASH_CONTRIBUTION_MAX } from './limits'
import { parseMethod, parseAmount, parseBoolish, parseContractorAnswer, matchQuestionKey } from './anedot-fields'

// ─── Column name mapping ──────────────────────────────────────────────────────
// Anedot's CSV export uses these header names (varies slightly by account config)

const COL: Record<string, string> = {
  // Date
  'Date': 'date',
  'Created At': 'date',
  'Donation Date': 'date',
  'Processed Date': 'processedDate',
  // Name
  'First Name': 'firstName',
  'Middle Initial': 'middleInitial',
  'Last Name': 'lastName',
  // Contact
  'Email': 'email',
  'Email Address': 'email',
  'Phone': 'phone',
  'Phone Number': 'phone',
  'Mobile': 'phone',
  'Cell Phone': 'phone',
  // Amount
  'Amount': 'amount',
  'Total Amount': 'amount',
  'Donation Amount': 'amount',
  // Processor money detail (ledger export)
  'Net Amount': 'netAmount',
  'Anedot Fee': 'fee',
  'Donor Covered Fees': 'donorCoveredFees',
  // Method
  'Payment Method': 'method',
  'Payment Type': 'method',
  'Source Type': 'method', // ledger export: credit_card / check / …
  'Card Type': 'cardType',
  'Card Last 4': 'cardLast4',
  // Record type (ledger export mixes donations with refunds/withdrawals)
  'Type': 'recordType',
  // Recurring / campaign
  'Recurring': 'recurring',
  'Campaign': 'campaign',
  // Check
  'Check Number': 'checkNumber',
  'Check #': 'checkNumber',
  // Address
  'Address Line 1': 'address1',
  'Address 1': 'address1',
  'Street': 'address1',
  'Address': 'address1',
  'Address Line 2': 'address2',
  'Address 2': 'address2',
  'City': 'city',
  'State': 'state',
  'Zip': 'zip',
  'Postal Code': 'zip',
  'Zip Code': 'zip',
  // SEEC required
  'Employer': 'employer',
  'Employer Name': 'employer',
  'Occupation': 'occupation',
  // IDs
  'Donation ID': 'anedotId',
  'UID': 'anedotId',
  'ID': 'anedotId',
  'Transaction ID': 'anedotId',
  // Notes / designation → contribution memo
  'Note': 'memo',
  'Notes': 'memo',
  'Comment': 'memo',
  'Comments': 'memo',
  'Memo': 'memo',
  'Message': 'memo',
  'Designation': 'memo',
  'Fund': 'memo',
  // Status (used to filter out refunds)
  'Status': 'status',
}

// Known Anedot-format header signatures
const ANEDOT_SIGNATURES = ['Donation ID', 'UID', 'Action Page', 'Campaign']

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedRow {
  rowIndex: number
  anedotId?: string
  date: string
  firstName: string
  middleInitial?: string
  lastName: string
  email?: string
  phone?: string
  amount: number
  method: PaymentMethod
  checkNumber?: string
  memo?: string
  address1: string
  address2?: string
  city: string
  state: string
  zip: string
  employer?: string
  occupation?: string
  // Processor detail (ledger export)
  processedDate?: string
  netAmount?: number
  processingFee?: number
  donorCoveredFees?: boolean
  cardType?: string
  cardLast4?: string
  isRecurring?: boolean
  campaign?: string
  // SEEC answers (ledger export)
  isStateContractor?: boolean
  contractorBranch?: string
  isLobbyist?: boolean
  // Flags
  seecIssues: string[]
  limitIssues: string[]
  isDuplicate: boolean
  isError: boolean
  errorMessage?: string
  /** Name of the committee roster member this donor matches, if any */
  rosterMatch?: string
  rawRow: Record<string, string>
}

export interface ParseResult {
  rows: ParsedRow[]
  formatDetected: boolean
  totalAmount: number
  importableCount: number
  duplicateCount: number
  seecIssueCount: number
  limitIssueCount: number
  errorCount: number
  /** Importable rows whose donor matches a committee roster member */
  rosterMatchCount: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDate(raw: string): string {
  // Handle "2024-03-22T17:36:09Z", "2024-03-22 17:36:09 UTC",
  // "2026-04-09 20:57:08 -0400", "03/22/2024"
  if (!raw) return ''
  // ISO-dated strings: take the date part as-is — round-tripping through
  // Date would shift evening times with timezone offsets to the next day
  const iso = raw.trim().match(/^(\d{4}-\d{2}-\d{2})/)
  if (iso) return iso[1]
  const clean = raw.trim().replace(' UTC', 'Z').replace(' ', 'T')
  const d = new Date(clean)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function mapRow(raw: Record<string, string>): Record<string, string> {
  const mapped: Record<string, string> = {}
  for (const [header, value] of Object.entries(raw)) {
    const v = value?.trim() ?? ''
    // Exact column names first, then the fuzzy CT custom-question labels
    // (their headers are long free text with embedded line breaks)
    const key: string | undefined = COL[header.trim()] ?? matchQuestionKey(header)
    // Several headers can map to one key (e.g. two lobbyist questions) —
    // an affirmative/filled value must not be clobbered by an empty one
    if (key && !(key in mapped && (!v || v.toLowerCase() === 'no'))) mapped[key] = v
  }
  return mapped
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseAnedotCsv(
  csvText: string,
  existingContributions: Contribution[],
  rosterMembers: RosterMember[] = []
): ParseResult {
  const { data, errors } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  if (errors.length && data.length === 0) {
    return {
      rows: [],
      formatDetected: false,
      totalAmount: 0,
      importableCount: 0,
      duplicateCount: 0,
      seecIssueCount: 0,
      limitIssueCount: 0,
      errorCount: 1,
      rosterMatchCount: 0,
    }
  }

  // Roster lookups: email is a strong signal; name is a fallback
  const rosterByEmail = new Map<string, string>()
  const rosterByName = new Map<string, string>()
  for (const m of rosterMembers) {
    const name = `${m.firstName} ${m.lastName}`.trim()
    if (m.email) rosterByEmail.set(m.email.toLowerCase(), name)
    rosterByName.set(`${m.firstName.trim().toLowerCase()}|${m.lastName.trim().toLowerCase()}`, name)
  }

  const headers = data.length > 0 ? Object.keys(data[0]) : []
  const formatDetected = ANEDOT_SIGNATURES.some((sig) => headers.includes(sig))

  // Build a set of existing anedotIds for fast duplicate checking
  const existingIds = new Set(
    existingContributions.map((c) => c.anedotId).filter(Boolean)
  )

  const rows: ParsedRow[] = data.map((raw, idx) => {
    const m = mapRow(raw)

    // Ledger exports mix donations with refunds, withdrawals, and fees —
    // only Donation rows are contributions
    if (m.recordType && m.recordType.toLowerCase() !== 'donation') {
      return {
        rowIndex: idx + 2,
        anedotId: m.anedotId || undefined,
        date: '',
        firstName: m.firstName ?? '',
        lastName: m.lastName ?? '',
        amount: 0,
        method: 'OTHER' as PaymentMethod,
        address1: '',
        city: '',
        state: '',
        zip: '',
        seecIssues: [],
        limitIssues: [],
        isDuplicate: false,
        isError: true,
        errorMessage: `Skipped — type: ${m.recordType}`,
        rawRow: raw,
      }
    }

    // Skip refunds / non-completed
    if (m.status && !['completed', 'complete', ''].includes(m.status.toLowerCase())) {
      return {
        rowIndex: idx + 2,
        anedotId: m.anedotId || undefined,
        date: '',
        firstName: m.firstName ?? '',
        lastName: m.lastName ?? '',
        amount: 0,
        method: 'OTHER',
        address1: '',
        city: '',
        state: '',
        zip: '',
        seecIssues: [],
        limitIssues: [],
        isDuplicate: false,
        isError: true,
        errorMessage: `Skipped — status: ${m.status}`,
        rawRow: raw,
      }
    }

    const amount = parseAmount(m.amount ?? '')
    const date = parseDate(m.date ?? '')
    const firstName = m.firstName ?? ''
    const lastName = m.lastName ?? ''
    const address1 = m.address1 ?? ''
    const city = m.city ?? ''
    const state = m.state ?? ''
    const zip = m.zip ?? ''
    const employer = m.employer || undefined
    const occupation = m.occupation || undefined

    // Validate
    const seecIssues: string[] = []
    let isError = false
    let errorMessage: string | undefined

    if (isNaN(amount) || amount <= 0) {
      isError = true
      errorMessage = 'Invalid amount'
    } else if (!date) {
      isError = true
      errorMessage = 'Invalid date'
    } else if (!firstName || !lastName) {
      seecIssues.push('Missing donor name')
    } else if (!address1 || !city || !zip) {
      seecIssues.push('Missing address')
    }

    if (!isError && amount >= 50) {
      if (!employer) seecIssues.push('Missing employer')
      if (!occupation) seecIssues.push('Missing occupation')
    }

    const isDuplicate = !!m.anedotId && existingIds.has(m.anedotId)

    const rosterMatch =
      (m.email ? rosterByEmail.get(m.email.toLowerCase()) : undefined) ??
      rosterByName.get(`${firstName.trim().toLowerCase()}|${lastName.trim().toLowerCase()}`)

    // Ledger export has no Payment Method column — derive from Source Type
    // (mapped to method) and fall back to card presence
    let method = parseMethod(m.method ?? '')
    if (method === 'OTHER' && (m.cardType || m.cardLast4)) method = 'CREDIT_CARD'

    const netAmount = m.netAmount ? parseAmount(m.netAmount) : NaN
    const fee = m.fee ? parseAmount(m.fee) : NaN
    const contractor = parseContractorAnswer(m.stateContractorAnswer)

    return {
      rowIndex: idx + 2,
      anedotId: m.anedotId || undefined,
      date,
      firstName,
      middleInitial: m.middleInitial ? m.middleInitial.slice(0, 1) : undefined,
      lastName,
      email: m.email || undefined,
      phone: m.phone || undefined,
      amount,
      method,
      checkNumber: m.checkNumber || undefined,
      memo: m.memo || undefined,
      address1,
      address2: m.address2 || undefined,
      city,
      state,
      zip,
      employer,
      occupation,
      processedDate: m.processedDate ? parseDate(m.processedDate) || undefined : undefined,
      netAmount: isNaN(netAmount) ? undefined : netAmount,
      processingFee: isNaN(fee) ? undefined : fee,
      donorCoveredFees: m.donorCoveredFees ? parseBoolish(m.donorCoveredFees) : undefined,
      cardType: m.cardType || undefined,
      cardLast4: m.cardLast4 || undefined,
      isRecurring: m.recurring ? parseBoolish(m.recurring) : undefined,
      campaign: m.campaign || undefined,
      isStateContractor: m.stateContractorAnswer ? contractor.isStateContractor : undefined,
      contractorBranch: contractor.branch,
      isLobbyist: m.lobbyistAnswer ? m.lobbyistAnswer.trim().toLowerCase().startsWith('yes') : undefined,
      seecIssues,
      limitIssues: [],
      isDuplicate,
      isError,
      errorMessage,
      rosterMatch,
      rawRow: raw,
    }
  })

  // ── Annual-limit flags (CT: $2,000/individual/calendar year to a town
  // committee; cash contributions capped at $100 each — CGS § 9-611).
  // Accumulate existing totals plus earlier rows in this same file so a batch
  // of small donations that collectively cross the limit still gets flagged.
  const yearTotals = new Map<string, number>()
  for (const d of getDonorYearTotals(existingContributions)) {
    yearTotals.set(`${d.key}@${d.year}`, d.total)
  }
  for (const r of rows) {
    if (r.isError || r.isDuplicate) continue
    const key = `${donorKey({ email: r.email, firstName: r.firstName, lastName: r.lastName, zip: r.zip })}@${r.date.slice(0, 4)}`
    const prior = yearTotals.get(key) ?? 0
    const newTotal = prior + r.amount
    if (newTotal > INDIVIDUAL_ANNUAL_LIMIT) {
      r.limitIssues.push(
        `Donor reaches $${newTotal.toLocaleString()} for ${r.date.slice(0, 4)} — over the $${INDIVIDUAL_ANNUAL_LIMIT.toLocaleString()} annual limit`
      )
    }
    if (r.method === 'CASH' && r.amount > CASH_CONTRIBUTION_MAX) {
      r.limitIssues.push(`Cash contribution over $${CASH_CONTRIBUTION_MAX} (CGS § 9-611)`)
    }
    yearTotals.set(key, newTotal)
  }

  const importable = rows.filter((r) => !r.isError && !r.isDuplicate)

  return {
    rows,
    formatDetected,
    totalAmount: importable.reduce((s, r) => s + r.amount, 0),
    importableCount: importable.length,
    duplicateCount: rows.filter((r) => r.isDuplicate).length,
    seecIssueCount: importable.filter((r) => r.seecIssues.length > 0).length,
    limitIssueCount: importable.filter((r) => r.limitIssues.length > 0).length,
    errorCount: rows.filter((r) => r.isError).length,
    rosterMatchCount: importable.filter((r) => r.rosterMatch).length,
  }
}

// ─── Convert parsed rows → Contribution objects ───────────────────────────────

export function parsedRowToContribution(
  row: ParsedRow,
  committeeId: string
): Contribution {
  // Capture timestamp + random suffix once — two Date.now() calls in the same
  // synchronous .map() return the same millisecond, causing duplicate IDs
  const uid = `${Date.now()}_${row.rowIndex}_${Math.random().toString(36).slice(2, 7)}`
  return {
    id: `don_import_${uid}`,
    committeeId,
    contributor: {
      id: `con_import_${uid}`,
      firstName: row.firstName,
      middleInitial: row.middleInitial,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      address1: row.address1,
      address2: row.address2,
      city: row.city,
      state: row.state || 'CT',
      zip: row.zip,
      employer: row.employer,
      occupation: row.occupation,
    },
    amount: row.amount,
    date: row.date,
    method: row.method,
    checkNumber: row.checkNumber,
    memo: row.memo,
    source: 'ANEDOT',
    anedotId: row.anedotId,
    isItemized: row.amount >= 50,
    processedDate: row.processedDate,
    netAmount: row.netAmount,
    processingFee: row.processingFee,
    donorCoveredFees: row.donorCoveredFees,
    cardType: row.cardType,
    cardLast4: row.cardLast4,
    isRecurring: row.isRecurring,
    campaign: row.campaign,
    isStateContractor: row.isStateContractor,
    contractorBranch: row.contractorBranch,
    isLobbyist: row.isLobbyist,
    createdAt: new Date().toISOString(),
  }
}
