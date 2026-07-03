import Papa from 'papaparse'
import type { RosterMember } from './types'

// ─── Column name mapping ──────────────────────────────────────────────────────
// Roster spreadsheets come from many sources (town committee lists, mail-merge
// sheets, old Excel files), so accept a generous set of header variants.
// Headers are matched case-insensitively.

const COL: Record<string, string> = {
  // Single combined name column ("Jane Smith" or "Smith, Jane")
  'name': 'fullName',
  'full name': 'fullName',
  'member': 'fullName',
  'member name': 'fullName',
  // Split name columns
  'first name': 'firstName',
  'first': 'firstName',
  'given name': 'firstName',
  'firstname': 'firstName',
  'last name': 'lastName',
  'last': 'lastName',
  'surname': 'lastName',
  'family name': 'lastName',
  'lastname': 'lastName',
  // Contact
  'email': 'email',
  'e-mail': 'email',
  'email address': 'email',
  'phone': 'phone',
  'phone number': 'phone',
  'telephone': 'phone',
  'mobile': 'phone',
  'cell': 'phone',
  'cell phone': 'phone',
  'home phone': 'phone',
  // Address
  'address': 'address1',
  'address 1': 'address1',
  'address line 1': 'address1',
  'street': 'address1',
  'street address': 'address1',
  'home address': 'address1',
  'address 2': 'address2',
  'address line 2': 'address2',
  'apt': 'address2',
  'unit': 'address2',
  'city': 'city',
  'town': 'city',
  'state': 'state',
  'zip': 'zip',
  'zip code': 'zip',
  'zipcode': 'zip',
  'postal code': 'zip',
  // Flags
  'active': 'active',
  'is active': 'active',
  'status': 'active',
  'member status': 'active',
  'dues': 'dues',
  'dues paid': 'dues',
  'paid dues': 'dues',
  'paid': 'dues',
  'dues status': 'dues',
  // Notes
  'notes': 'notes',
  'note': 'notes',
  'comment': 'notes',
  'comments': 'notes',
  'memo': 'notes',
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedRosterRow {
  rowIndex: number
  firstName: string
  lastName: string
  email?: string
  phone?: string
  address1?: string
  address2?: string
  city?: string
  state?: string
  zip?: string
  /** undefined = column absent or blank — leave the existing value untouched */
  isActive?: boolean
  duesPaid?: boolean
  notes?: string
  action: 'create' | 'update'
  /** Set when action = 'update': the matched roster member's id */
  existingId?: string
  isError: boolean
  errorMessage?: string
}

export interface RosterParseResult {
  rows: ParsedRosterRow[]
  createCount: number
  updateCount: number
  errorCount: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TRUE_WORDS = new Set(['yes', 'y', 'true', '1', 'paid', 'active', 'current', 'x'])
const FALSE_WORDS = new Set(['no', 'n', 'false', '0', 'unpaid', 'not paid', 'inactive', 'lapsed', 'former', 'resigned'])

/**
 * Parse a yes/no-ish cell. Also treats a dollar amount > 0 as "paid" so a
 * "Dues" column holding "$25" works. Blank or unrecognized → undefined
 * (meaning: don't change the flag).
 */
export function parseFlag(raw: string | undefined): boolean | undefined {
  const v = raw?.trim().toLowerCase()
  if (!v) return undefined
  if (TRUE_WORDS.has(v)) return true
  if (FALSE_WORDS.has(v)) return false
  const n = parseFloat(v.replace(/[$,\s]/g, ''))
  if (!isNaN(n)) return n > 0
  return undefined
}

/** Split "Smith, Jane" or "Jane Smith" (last token = last name). */
export function splitFullName(raw: string): { firstName: string; lastName: string } {
  const v = raw.trim().replace(/\s+/g, ' ')
  if (!v) return { firstName: '', lastName: '' }
  if (v.includes(',')) {
    const [last, first] = v.split(',', 2)
    return { firstName: (first ?? '').trim(), lastName: last.trim() }
  }
  const parts = v.split(' ')
  if (parts.length === 1) return { firstName: '', lastName: parts[0] }
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] }
}

function mapRow(raw: Record<string, string>): Record<string, string> {
  const mapped: Record<string, string> = {}
  for (const [header, value] of Object.entries(raw)) {
    const key = COL[header.trim().toLowerCase()]
    if (key && !(key in mapped && !value?.trim())) mapped[key] = value?.trim() ?? ''
  }
  return mapped
}

function nameKey(firstName: string, lastName: string): string {
  return `${firstName.trim().toLowerCase()}|${lastName.trim().toLowerCase()}`
}

// ─── Main parser ──────────────────────────────────────────────────────────────

/**
 * Parse a roster CSV and match each row against the existing roster:
 * a row matching an existing member (by email, else by first+last name,
 * both case-insensitive) becomes an update; anything else is a create.
 * Duplicate rows within the same file are flagged as errors.
 */
export function parseRosterCsv(
  csvText: string,
  existingMembers: RosterMember[]
): RosterParseResult {
  const { data, errors } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  if (errors.length && data.length === 0) {
    return { rows: [], createCount: 0, updateCount: 0, errorCount: 1 }
  }

  const byEmail = new Map(
    existingMembers.filter((m) => m.email).map((m) => [m.email!.toLowerCase(), m.id])
  )
  const byName = new Map(existingMembers.map((m) => [nameKey(m.firstName, m.lastName), m.id]))

  // Track keys seen earlier in this same file to flag duplicate rows
  const seen = new Map<string, number>()

  const rows: ParsedRosterRow[] = data.map((raw, idx) => {
    const m = mapRow(raw)
    const rowIndex = idx + 2 // header is row 1

    let firstName = m.firstName ?? ''
    let lastName = m.lastName ?? ''
    if (!firstName && !lastName && m.fullName) {
      ;({ firstName, lastName } = splitFullName(m.fullName))
    }

    const base: Omit<ParsedRosterRow, 'action' | 'isError'> = {
      rowIndex,
      firstName,
      lastName,
      email: m.email?.toLowerCase() || undefined,
      phone: m.phone || undefined,
      address1: m.address1 || undefined,
      address2: m.address2 || undefined,
      city: m.city || undefined,
      state: m.state || undefined,
      zip: m.zip || undefined,
      isActive: parseFlag(m.active),
      duesPaid: parseFlag(m.dues),
      notes: m.notes || undefined,
    }

    if (!lastName) {
      return { ...base, action: 'create', isError: true, errorMessage: 'Missing name' }
    }

    const dupKey = base.email ?? nameKey(firstName, lastName)
    const firstSeenAt = seen.get(dupKey)
    if (firstSeenAt !== undefined) {
      return {
        ...base,
        action: 'create',
        isError: true,
        errorMessage: `Duplicate of row ${firstSeenAt}`,
      }
    }
    seen.set(dupKey, rowIndex)

    const existingId =
      (base.email ? byEmail.get(base.email) : undefined) ?? byName.get(nameKey(firstName, lastName))

    return {
      ...base,
      action: existingId ? 'update' : 'create',
      existingId,
      isError: false,
    }
  })

  return {
    rows,
    createCount: rows.filter((r) => !r.isError && r.action === 'create').length,
    updateCount: rows.filter((r) => !r.isError && r.action === 'update').length,
    errorCount: rows.filter((r) => r.isError).length,
  }
}
