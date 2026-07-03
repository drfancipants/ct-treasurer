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

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled'

export interface Committee {
  id: string
  name: string
  slug: string
  seecId?: string
  anedotAccountId?: string
  address1?: string
  address2?: string
  city?: string
  state?: string
  zip?: string
  phone?: string
  email?: string
  electionYear?: number
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  subscriptionStatus?: SubscriptionStatus
  trialEndsAt?: string
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

// ─── Committee roster ─────────────────────────────────────────────────────────

/**
 * A member of the political committee itself (the DTC/RTC roster) — distinct
 * from CommitteeMember, which is an app user with login access.
 */
export interface RosterMember {
  id: string
  committeeId: string
  firstName: string
  lastName: string
  email?: string
  phone?: string
  address1?: string
  address2?: string
  city?: string
  state: string
  zip?: string
  isActive: boolean
  duesPaid: boolean
  notes?: string
  /** Linked donor record (set automatically when donations match this member) */
  contributorId?: string
  /** Sum of this committee's contributions from the linked donor (or email match if unlinked) — derived, read-only */
  contributionTotal: number
  /** Number of contributions behind contributionTotal — derived, read-only */
  contributionCount: number
  createdAt: string
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
  /** When the covering SEEC filing period was marked filed */
  filedAt?: string
  /** Linked fundraising event (SEEC Section B event columns) */
  eventId?: string
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

/**
 * Expense categories are the official SEEC Section P "Purpose of Expenditure"
 * codes, taken verbatim from the eCRIS Form 20 template's Code List sheet.
 * Stored directly on Expenditure.category, so the Form 20 export needs no
 * mapping. Descriptions are lightly copy-edited (the template has typos).
 */
export type ExpenseCategory =
  | 'A-ATM' | 'A-DM' | 'A-MAG' | 'A-NEWS' | 'A-OTH' | 'A-PH-BNK' | 'A-RAD'
  | 'A-SIGN' | 'A-TV' | 'A-WEB'
  | 'ATT' | 'BNK' | 'CCP' | 'CEF' | 'CHAR' | 'CNSLT' | 'CNTRB' | 'EFV'
  | 'FNDR' | 'FOOD' | 'GIFT' | 'INAUG' | 'LOAN' | 'MISC' | 'OFFICE' | 'OVHD'
  | 'PBA-ATT' | 'PBA-OTH' | 'PBA-TRVL' | 'PETTY' | 'POC' | 'POLLS' | 'POST'
  | 'PRNT' | 'PTY-BLDG' | 'REF' | 'RMB' | 'SRPLS' | 'TRAIN' | 'TRVL'
  | 'WAGE' | 'WEB'

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  'A-ATM': 'Advertise using automated telephone/fax message',
  'A-DM': 'Advertise through direct mail',
  'A-MAG': 'Advertise through a magazine',
  'A-NEWS': 'Advertise through a newspaper',
  'A-OTH': 'Other advertising',
  'A-PH-BNK': 'Use of phone banks',
  'A-RAD': 'Advertise on radio',
  'A-SIGN': 'Lawn or billboard signs',
  'A-TV': 'Advertise on television',
  'A-WEB': 'Advertise on the web',
  ATT: 'Fee for attending a fundraiser',
  BNK: 'Bank fees, interest charges, or penalties',
  CCP: 'Payment of a credit card bill',
  CEF: 'Payment to Citizens Election Fund',
  CHAR: 'Payment to tax-exempt charitable organization',
  CNSLT: 'Payments to a professional consultant',
  CNTRB: 'Contributions to another committee',
  EFV: 'Equipment, furniture, and vehicles',
  FNDR: 'Committee fundraiser expenses',
  FOOD: 'Food and beverage (paid directly to vendor)',
  GIFT: 'Purchase of items to be given as a gift',
  INAUG: 'Costs of hosting an inaugural event',
  LOAN: 'Payment of committee loan',
  MISC: 'Miscellaneous expenses not listed above',
  OFFICE: 'Office supplies',
  OVHD: 'Overhead operating costs',
  'PBA-ATT': 'Party building — attendance or admission fee',
  'PBA-OTH': 'Party building — other expenditures',
  'PBA-TRVL': 'Party building — travel and lodging',
  PETTY: 'Petty cash fund',
  POC: 'Payment to another committee',
  POLLS: 'Conducting polls and surveys',
  POST: 'Postage',
  PRNT: 'Printing, photocopying, or reproducing literature',
  'PTY-BLDG': 'Party building activities',
  REF: 'Contributor returns or other revenue refunds',
  RMB: 'Reimbursement',
  SRPLS: 'Surplus distribution (committee termination)',
  TRAIN: 'Campaign training events',
  TRVL: 'Transportation and lodging costs',
  WAGE: 'Wages and benefits for committee staff',
  WEB: 'Website and web presence costs',
}

/** Legacy app categories (pre-July-2026 rows) → SEEC purpose codes. */
export const LEGACY_EXPENSE_CATEGORY_TO_CODE: Record<string, ExpenseCategory> = {
  PRINTING: 'PRNT',
  ADVERTISING: 'A-NEWS',
  EVENT: 'FNDR',
  POSTAGE: 'POST',
  OFFICE_SUPPLIES: 'OFFICE',
  TECHNOLOGY: 'WEB',
  PROFESSIONAL_SERVICES: 'CNSLT',
  HEADQUARTERS: 'OVHD',
  SIGNAGE: 'A-SIGN',
  OTHER: 'MISC',
}

/** Badge color by code family — 42 individual colors would be noise. */
export function expenseCategoryColor(category: string): string {
  if (category.startsWith('A-')) return 'bg-purple-50 text-purple-700'       // advertising
  if (category.startsWith('PBA') || category === 'PTY-BLDG' || category === 'TRAIN')
    return 'bg-teal-50 text-teal-700'                                        // party building
  if (['FNDR', 'FOOD', 'ATT', 'INAUG', 'GIFT'].includes(category))
    return 'bg-orange-50 text-orange-700'                                    // events & hospitality
  if (['PRNT', 'POST', 'OFFICE', 'PETTY', 'WEB', 'EFV', 'OVHD'].includes(category))
    return 'bg-blue-50 text-blue-700'                                        // operations
  if (['WAGE', 'CNSLT', 'POLLS'].includes(category))
    return 'bg-indigo-50 text-indigo-700'                                    // people & services
  if (['BNK', 'CCP', 'LOAN', 'REF', 'RMB', 'SRPLS', 'CEF', 'CNTRB', 'POC', 'CHAR'].includes(category))
    return 'bg-amber-50 text-amber-700'                                      // financial & transfers
  return 'bg-slate-100 text-slate-600'
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
  /** When the covering SEEC filing period was marked filed */
  filedAt?: string
  /** Linked fundraising event (SEEC Section P event columns) */
  eventId?: string
  createdAt: string
}

// ─── Worker reimbursements (SEEC Form 20 Section T) ───────────────────────────

/**
 * A payment a committee worker or consultant made to a vendor out of pocket,
 * itemized on Form 20 Section T ("Itemization of Reimbursements and Secondary
 * Payees"). The committee's repayment to the worker is a normal Section P
 * expenditure (purpose code RMB) — link it via expenditureId so the export can
 * fill Section T's Expenditure Number column.
 */
export interface Reimbursement {
  id: string
  committeeId: string
  workerLastName: string
  workerFirstName: string
  workerMiddleInitial?: string
  /** What the worker purchased */
  description: string
  /** Date the worker paid the vendor */
  date: string
  amount: number
  method: PaymentMethod
  checkNumber?: string
  vendorName?: string
  street?: string
  city?: string
  state: string
  zip?: string
  /** SEEC purpose code for the underlying purchase (same codes as Section P) */
  category: ExpenseCategory
  /** The Section P reimbursement payment this itemizes */
  expenditureId?: string
  eventId?: string
  memo?: string
  filedAt?: string
  createdAt: string
}

// ─── Contributions from other committees (SEEC Form 20 Section C1) ────────────

export interface CommitteeContribution {
  id: string
  committeeId: string
  fromName: string
  treasurerName?: string
  street?: string
  city?: string
  state: string
  zip?: string
  date: string
  amount: number
  eventId?: string
  memo?: string
  filedAt?: string
  createdAt: string
}

// ─── In-kind contributions (SEEC Form 20 Section M) ───────────────────────────

export type InKindEntityType = 'IS' | 'CO' | 'OT'

export const IN_KIND_ENTITY_LABELS: Record<InKindEntityType, string> = {
  IS: 'Individual / Sole proprietorship',
  CO: 'Committee',
  OT: 'Other',
}

export interface InKindContribution {
  id: string
  committeeId: string
  entityType: InKindEntityType
  lastName: string
  firstName?: string
  middleInitial?: string
  entityName?: string
  street?: string
  city?: string
  state: string
  zip?: string
  date: string
  fairMarketValue: number
  description: string
  isStateContractorPrincipal: boolean
  contractorBranch?: string
  isLobbyist: boolean
  eventId?: string
  memo?: string
  filedAt?: string
  createdAt: string
}

// ─── Fundraising events (SEEC Form 20 Section L1) ─────────────────────────────

export interface CommitteeEvent {
  id: string
  committeeId: string
  date: string
  letter: string
  description: string
  isFundraiser: boolean
  street?: string
  city?: string
  state: string
  zip?: string
  isPersonalResidence: boolean
  hadDonatedGoods: boolean
  wasTagSale: boolean
  hadProgramBook: boolean
  soldFoodAtFair: boolean
  foodReceipts: number
  tagSaleReceipts: number
  notes?: string
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
