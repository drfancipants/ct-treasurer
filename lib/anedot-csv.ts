import Papa from 'papaparse'
import type { Contribution, PaymentMethod } from './types'

// ─── Column name mapping ──────────────────────────────────────────────────────
// Anedot's CSV export uses these header names (varies slightly by account config)

const COL: Record<string, string> = {
  // Date
  'Date': 'date',
  'Created At': 'date',
  'Donation Date': 'date',
  // Name
  'First Name': 'firstName',
  'Last Name': 'lastName',
  // Contact
  'Email': 'email',
  'Phone': 'phone',
  // Amount
  'Amount': 'amount',
  'Total Amount': 'amount',
  'Donation Amount': 'amount',
  // Method
  'Payment Method': 'method',
  'Payment Type': 'method',
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
  // Status (used to filter out refunds)
  'Status': 'status',
}

// Known Anedot-format header signatures
const ANEDOT_SIGNATURES = ['Donation ID', 'UID', 'Action Page', 'Campaign']

const METHOD_MAP: Record<string, PaymentMethod> = {
  credit_card: 'CREDIT_CARD',
  'credit card': 'CREDIT_CARD',
  creditcard: 'CREDIT_CARD',
  debit_card: 'DEBIT_CARD',
  'debit card': 'DEBIT_CARD',
  check: 'CHECK',
  cash: 'CASH',
  ach: 'ONLINE',
  bank: 'ONLINE',
  online: 'ONLINE',
  other: 'OTHER',
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedRow {
  rowIndex: number
  anedotId?: string
  date: string
  firstName: string
  lastName: string
  email?: string
  amount: number
  method: PaymentMethod
  checkNumber?: string
  address1: string
  address2?: string
  city: string
  state: string
  zip: string
  employer?: string
  occupation?: string
  // Flags
  seecIssues: string[]
  isDuplicate: boolean
  isError: boolean
  errorMessage?: string
  rawRow: Record<string, string>
}

export interface ParseResult {
  rows: ParsedRow[]
  formatDetected: boolean
  totalAmount: number
  importableCount: number
  duplicateCount: number
  seecIssueCount: number
  errorCount: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseAmount(raw: string): number {
  const n = parseFloat(raw.replace(/[$,\s]/g, ''))
  return isNaN(n) ? NaN : n
}

function parseDate(raw: string): string {
  // Handle "2024-03-22T17:36:09Z", "2024-03-22 17:36:09 UTC", "03/22/2024"
  if (!raw) return ''
  const clean = raw.trim().replace(' UTC', 'Z').replace(' ', 'T')
  const d = new Date(clean)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function parseMethod(raw: string): PaymentMethod {
  return METHOD_MAP[raw.toLowerCase().trim()] ?? 'OTHER'
}

function mapRow(raw: Record<string, string>): Record<string, string> {
  const mapped: Record<string, string> = {}
  for (const [header, value] of Object.entries(raw)) {
    const key = COL[header.trim()]
    if (key) mapped[key] = value?.trim() ?? ''
  }
  return mapped
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseAnedotCsv(
  csvText: string,
  existingContributions: Contribution[]
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
      errorCount: 1,
    }
  }

  const headers = data.length > 0 ? Object.keys(data[0]) : []
  const formatDetected = ANEDOT_SIGNATURES.some((sig) => headers.includes(sig))

  // Build a set of existing anedotIds for fast duplicate checking
  const existingIds = new Set(
    existingContributions.map((c) => c.anedotId).filter(Boolean)
  )

  const rows: ParsedRow[] = data.map((raw, idx) => {
    const m = mapRow(raw)

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

    return {
      rowIndex: idx + 2,
      anedotId: m.anedotId || undefined,
      date,
      firstName,
      lastName,
      email: m.email || undefined,
      amount,
      method: parseMethod(m.method ?? ''),
      checkNumber: m.checkNumber || undefined,
      address1,
      address2: m.address2 || undefined,
      city,
      state,
      zip,
      employer,
      occupation,
      seecIssues,
      isDuplicate,
      isError,
      errorMessage,
      rawRow: raw,
    }
  })

  const importable = rows.filter((r) => !r.isError && !r.isDuplicate)

  return {
    rows,
    formatDetected,
    totalAmount: importable.reduce((s, r) => s + r.amount, 0),
    importableCount: importable.length,
    duplicateCount: rows.filter((r) => r.isDuplicate).length,
    seecIssueCount: importable.filter((r) => r.seecIssues.length > 0).length,
    errorCount: rows.filter((r) => r.isError).length,
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
      lastName: row.lastName,
      email: row.email,
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
    source: 'ANEDOT',
    anedotId: row.anedotId,
    isItemized: row.amount >= 50,
    createdAt: new Date().toISOString(),
  }
}
