// ─── Committee & membership ──────────────────────────────────────────────────

export type MemberRole =
  | 'TREASURER'
  | 'ASSISTANT_TREASURER'
  | 'CHAIRPERSON'
  | 'SECRETARY'
  | 'MEMBER'
  | 'VIEWER'

export const ROLE_LABELS: Record<MemberRole, string> = {
  TREASURER: 'Treasurer',
  ASSISTANT_TREASURER: 'Asst. Treasurer',
  CHAIRPERSON: 'Chairperson',
  SECRETARY: 'Secretary',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
}

export const ROLE_ORDER: Record<MemberRole, number> = {
  TREASURER: 0,
  ASSISTANT_TREASURER: 1,
  CHAIRPERSON: 2,
  SECRETARY: 3,
  MEMBER: 4,
  VIEWER: 5,
}

export interface Committee {
  id: string
  name: string
  slug: string
  seecId?: string
  city?: string
  state?: string
  electionYear?: number
}

export interface CommitteeMember {
  id: string
  committeeId: string
  userId: string
  name: string
  email: string
  role: MemberRole
  phone?: string
  joinedAt: string
}

// ─── Contributions ───────────────────────────────────────────────────────────

export type PaymentMethod =
  | 'CHECK'
  | 'CASH'
  | 'CREDIT_CARD'
  | 'DEBIT_CARD'
  | 'ONLINE'
  | 'OTHER'

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CHECK: 'Check',
  CASH: 'Cash',
  CREDIT_CARD: 'Credit card',
  DEBIT_CARD: 'Debit card',
  ONLINE: 'Online',
  OTHER: 'Other',
}

export type ContributionSource = 'MANUAL' | 'ANEDOT' | 'BANK_IMPORT'

export const SOURCE_LABELS: Record<ContributionSource, string> = {
  MANUAL: 'Manual',
  ANEDOT: 'Anedot',
  BANK_IMPORT: 'Bank import',
}

export interface Contributor {
  id: string
  firstName: string
  lastName: string
  email?: string
  phone?: string
  address1: string
  address2?: string
  city: string
  state: string
  zip: string
  employer?: string
  occupation?: string
}

export interface Contribution {
  id: string
  committeeId: string
  contributor: Contributor
  amount: number
  date: string
  method: PaymentMethod
  checkNumber?: string
  memo?: string
  source: ContributionSource
  anedotId?: string
  isItemized: boolean
  createdAt: string
}

// ─── SEEC compliance ─────────────────────────────────────────────────────────

export type SeecStatus = 'compliant' | 'missing_info' | 'incomplete'

export interface SeecStatusResult {
  status: SeecStatus
  label: string
  issues: string[]
}

export function getSeecStatus(contribution: Contribution): SeecStatusResult {
  const c = contribution.contributor
  const issues: string[] = []

  if (!c.firstName || !c.lastName) issues.push('Missing donor name')
  if (!c.address1) issues.push('Missing street address')
  if (!c.city) issues.push('Missing city')
  if (!c.zip) issues.push('Missing ZIP code')

  if (issues.length > 0) {
    return { status: 'incomplete', label: 'Incomplete', issues }
  }

  if (contribution.amount >= 50) {
    if (!c.employer) issues.push('Missing employer (required for itemized)')
    if (!c.occupation) issues.push('Missing occupation (required for itemized)')
  }

  if (issues.length > 0) {
    return { status: 'missing_info', label: 'Missing info', issues }
  }

  return { status: 'compliant', label: 'Compliant', issues: [] }
}

// ─── Anedot webhook ──────────────────────────────────────────────────────────

export interface AnedotWebhookPayload {
  event: string
  donation: {
    uid: string
    amount: string
    created_at: string
    first_name: string
    last_name: string
    email: string
    employer?: string
    occupation?: string
    billing_address?: {
      street: string
      street_2?: string
      city: string
      state: string
      zip: string
    }
    payment_method: string
    note?: string
  }
}

// ─── Expenditures ─────────────────────────────────────────────────────────────

export type ExpenseCategory =
  | 'PRINTING'
  | 'ADVERTISING'
  | 'EVENT'
  | 'POSTAGE'
  | 'OFFICE_SUPPLIES'
  | 'TECHNOLOGY'
  | 'PROFESSIONAL_SERVICES'
  | 'HEADQUARTERS'
  | 'SIGNAGE'
  | 'OTHER'

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  PRINTING: 'Printing & literature',
  ADVERTISING: 'Advertising',
  EVENT: 'Event expenses',
  POSTAGE: 'Postage & delivery',
  OFFICE_SUPPLIES: 'Office supplies',
  TECHNOLOGY: 'Web & technology',
  PROFESSIONAL_SERVICES: 'Professional services',
  HEADQUARTERS: 'Headquarters & rent',
  SIGNAGE: 'Signage',
  OTHER: 'Other',
}

export const EXPENSE_CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  PRINTING: 'bg-blue-50 text-blue-700',
  ADVERTISING: 'bg-purple-50 text-purple-700',
  EVENT: 'bg-orange-50 text-orange-700',
  POSTAGE: 'bg-teal-50 text-teal-700',
  OFFICE_SUPPLIES: 'bg-slate-100 text-slate-600',
  TECHNOLOGY: 'bg-indigo-50 text-indigo-700',
  PROFESSIONAL_SERVICES: 'bg-violet-50 text-violet-700',
  HEADQUARTERS: 'bg-amber-50 text-amber-700',
  SIGNAGE: 'bg-emerald-50 text-emerald-700',
  OTHER: 'bg-slate-100 text-slate-500',
}

export interface Expenditure {
  id: string
  committeeId: string
  amount: number
  date: string
  payee: string
  purpose: string
  category: ExpenseCategory
  method: PaymentMethod
  checkNumber?: string
  memo?: string
  createdAt: string
}

// ─── Bank accounts & transactions ─────────────────────────────────────────────

export interface BankAccount {
  id: string
  committeeId: string
  plaidAccountId?: string
  name: string
  institution: string
  accountType: string
  lastFour: string
  currentBalance: number
  availableBalance?: number
  lastSyncedAt?: string
  createdAt: string
}

export type TransactionMatchType = 'CONTRIBUTION' | 'EXPENDITURE' | 'UNMATCHED' | 'IGNORED'

export interface BankTransaction {
  id: string
  bankAccountId: string
  plaidTransactionId?: string
  /** Positive = deposit (money in), negative = withdrawal (money out) */
  amount: number
  date: string
  description: string
  merchantName?: string
  category?: string
  matchType: TransactionMatchType
  matchedContributionId?: string
  matchedExpenditureId?: string
  isReconciled: boolean
  createdAt: string
}
