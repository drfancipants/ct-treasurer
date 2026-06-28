/**
 * Development mock data — replace fetch calls with real Prisma queries once
 * your database is configured. See README.md for setup instructions.
 */

import type { Committee, CommitteeMember, Contribution, Contributor, Expenditure, BankAccount, BankTransaction } from './types'

// ─── Committees ──────────────────────────────────────────────────────────────

export const MOCK_COMMITTEES: Committee[] = [
  {
    id: 'com_guilford_dtc',
    name: 'Guilford Democratic Town Committee',
    slug: 'guilford-dtc',
    seecId: 'CT-DTC-20240142',
    city: 'Guilford',
    state: 'CT',
    electionYear: 2024,
  },
  {
    id: 'com_madison_rtc',
    name: 'Madison Republican Town Committee',
    slug: 'madison-rtc',
    seecId: 'CT-RTC-20240087',
    city: 'Madison',
    state: 'CT',
    electionYear: 2024,
  },
  {
    id: 'com_north_branford_ipc',
    name: 'North Branford Independent Party Committee',
    slug: 'north-branford-ipc',
    seecId: 'CT-IPC-20240211',
    city: 'North Branford',
    state: 'CT',
    electionYear: 2024,
  },
]

// ─── Committee members ───────────────────────────────────────────────────────

export const MOCK_MEMBERS: CommitteeMember[] = [
  // Guilford DTC
  { id: 'mem_1', committeeId: 'com_guilford_dtc', userId: 'usr_1', name: 'Sarah Chen', email: 'schen@guilforddemocrats.org', role: 'TREASURER', phone: '203-555-0101', joinedAt: '2023-01-15' },
  { id: 'mem_2', committeeId: 'com_guilford_dtc', userId: 'usr_2', name: 'Robert Martinez', email: 'rmartinez@guilforddemocrats.org', role: 'ASSISTANT_TREASURER', phone: '203-555-0102', joinedAt: '2023-02-20' },
  { id: 'mem_3', committeeId: 'com_guilford_dtc', userId: 'usr_3', name: 'Patricia Walsh', email: 'pwalsh@guilforddemocrats.org', role: 'CHAIRPERSON', phone: '203-555-0103', joinedAt: '2023-03-10' },
  { id: 'mem_4', committeeId: 'com_guilford_dtc', userId: 'usr_4', name: "James O'Brien", email: 'jobrien@guilforddemocrats.org', role: 'SECRETARY', joinedAt: '2023-04-05' },
  { id: 'mem_5', committeeId: 'com_guilford_dtc', userId: 'usr_5', name: 'Linda Kowalski', email: 'lkowalski@guilforddemocrats.org', role: 'MEMBER', joinedAt: '2024-01-08' },
  { id: 'mem_6', committeeId: 'com_guilford_dtc', userId: 'usr_6', name: 'David Nakamura', email: 'dnakamura@guilforddemocrats.org', role: 'VIEWER', phone: '203-555-0106', joinedAt: '2024-02-14' },
  // Madison RTC
  { id: 'mem_7', committeeId: 'com_madison_rtc', userId: 'usr_7', name: 'Thomas Hendricks', email: 'thendricks@madisonrtc.org', role: 'TREASURER', phone: '203-555-0201', joinedAt: '2022-11-01' },
  { id: 'mem_8', committeeId: 'com_madison_rtc', userId: 'usr_8', name: 'Carol Simmons', email: 'csimmons@madisonrtc.org', role: 'CHAIRPERSON', joinedAt: '2023-01-20' },
  { id: 'mem_9', committeeId: 'com_madison_rtc', userId: 'usr_9', name: 'Frank Deluca', email: 'fdeluca@madisonrtc.org', role: 'MEMBER', joinedAt: '2023-06-15' },
]

// ─── Donors / contributors ───────────────────────────────────────────────────

const CONTRIBUTORS: Contributor[] = [
  {
    id: 'con_1',
    firstName: 'Michael',
    lastName: 'Thompson',
    email: 'mthompson@gmail.com',
    address1: '14 Whitfield Street',
    city: 'Guilford',
    state: 'CT',
    zip: '06437',
    employer: 'Yale-New Haven Hospital',
    occupation: 'Physician',
  },
  {
    id: 'con_2',
    firstName: 'Jennifer',
    lastName: 'Katsaros',
    email: 'jkatsaros@gmail.com',
    address1: '22 Boston Street',
    city: 'Guilford',
    state: 'CT',
    zip: '06437',
    employer: 'Guilford Public Schools',
    occupation: 'Teacher',
  },
  {
    id: 'con_3',
    firstName: 'David',
    lastName: 'Rosenberg',
    email: 'drosenberg@lawfirm.com',
    address1: '8 Broad Street',
    city: 'Guilford',
    state: 'CT',
    zip: '06437',
    employer: 'Rosenberg & Associates LLC',
    occupation: 'Attorney',
  },
  {
    id: 'con_4',
    firstName: 'Maria',
    lastName: 'Santos',
    email: 'msantos@state.ct.us',
    address1: '67 Route 77',
    city: 'Guilford',
    state: 'CT',
    zip: '06437',
    employer: 'State of Connecticut',
    occupation: 'Public Administrator',
  },
  {
    // Missing employer/occupation — triggers SEEC warning
    id: 'con_5',
    firstName: 'William',
    lastName: 'Park',
    address1: '3 Church Street',
    city: 'Guilford',
    state: 'CT',
    zip: '06437',
  },
  {
    id: 'con_6',
    firstName: 'Eleanor',
    lastName: 'Briggs',
    email: 'ebriggs@gmail.com',
    address1: '109 Long Hill Road',
    city: 'Guilford',
    state: 'CT',
    zip: '06437',
    employer: 'Retired',
    occupation: 'Retired',
  },
  {
    id: 'con_7',
    firstName: 'Christopher',
    lastName: 'Nault',
    email: 'cnault@southernctgas.com',
    address1: '45 Granite Lane',
    city: 'North Branford',
    state: 'CT',
    zip: '06471',
    employer: 'Southern Connecticut Gas',
    occupation: 'Engineer',
  },
  {
    id: 'con_8',
    firstName: 'Anne',
    lastName: 'Fitzgerald',
    email: 'afitz@gmail.com',
    address1: '7 Vineyard Road',
    city: 'Guilford',
    state: 'CT',
    zip: '06437',
    employer: 'Guilford Savings Bank',
    occupation: 'Branch Manager',
  },
]

// ─── Contributions ───────────────────────────────────────────────────────────

export const MOCK_CONTRIBUTIONS: Contribution[] = [
  { id: 'don_1', committeeId: 'com_guilford_dtc', contributor: CONTRIBUTORS[0], amount: 250.00, date: '2024-09-15', method: 'CHECK', checkNumber: '1042', source: 'MANUAL', isItemized: true, createdAt: '2024-09-16T10:30:00Z' },
  { id: 'don_2', committeeId: 'com_guilford_dtc', contributor: CONTRIBUTORS[1], amount: 100.00, date: '2024-09-18', method: 'CHECK', checkNumber: '2214', source: 'MANUAL', isItemized: true, createdAt: '2024-09-18T14:00:00Z' },
  { id: 'don_3', committeeId: 'com_guilford_dtc', contributor: CONTRIBUTORS[2], amount: 500.00, date: '2024-10-02', method: 'CHECK', checkNumber: '0887', source: 'MANUAL', isItemized: true, createdAt: '2024-10-02T09:15:00Z' },
  { id: 'don_4', committeeId: 'com_guilford_dtc', contributor: CONTRIBUTORS[3], amount: 75.00, date: '2024-10-10', method: 'CREDIT_CARD', source: 'ANEDOT', anedotId: 'ane_97432', isItemized: true, createdAt: '2024-10-10T16:45:00Z' },
  { id: 'don_5', committeeId: 'com_guilford_dtc', contributor: CONTRIBUTORS[4], amount: 200.00, date: '2024-10-22', method: 'CHECK', checkNumber: '4521', source: 'MANUAL', isItemized: true, createdAt: '2024-10-22T11:00:00Z' },
  { id: 'don_6', committeeId: 'com_guilford_dtc', contributor: CONTRIBUTORS[5], amount: 50.00, date: '2024-11-01', method: 'CASH', source: 'MANUAL', isItemized: false, createdAt: '2024-11-01T15:30:00Z' },
  { id: 'don_7', committeeId: 'com_guilford_dtc', contributor: CONTRIBUTORS[6], amount: 150.00, date: '2024-11-08', method: 'CREDIT_CARD', source: 'ANEDOT', anedotId: 'ane_98156', isItemized: true, createdAt: '2024-11-08T08:20:00Z' },
  { id: 'don_8', committeeId: 'com_guilford_dtc', contributor: CONTRIBUTORS[0], amount: 250.00, date: '2024-11-12', method: 'CHECK', checkNumber: '1067', source: 'MANUAL', isItemized: true, createdAt: '2024-11-12T13:00:00Z' },
  { id: 'don_9', committeeId: 'com_guilford_dtc', contributor: CONTRIBUTORS[7], amount: 300.00, date: '2024-11-15', method: 'CHECK', checkNumber: '0334', source: 'MANUAL', isItemized: true, createdAt: '2024-11-15T10:00:00Z' },
  { id: 'don_10', committeeId: 'com_guilford_dtc', contributor: CONTRIBUTORS[3], amount: 125.00, date: '2024-11-18', method: 'CREDIT_CARD', source: 'ANEDOT', anedotId: 'ane_99201', isItemized: true, createdAt: '2024-11-18T14:30:00Z' },
]

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getCommittee(slug: string): Committee | undefined {
  return MOCK_COMMITTEES.find((c) => c.slug === slug)
}

export function getMembersForCommittee(committeeId: string): CommitteeMember[] {
  return MOCK_MEMBERS.filter((m) => m.committeeId === committeeId)
}

export function getContributionsForCommittee(committeeId: string): Contribution[] {
  return MOCK_CONTRIBUTIONS.filter((c) => c.committeeId === committeeId)
}

// ─── Expenditures ─────────────────────────────────────────────────────────────

export const MOCK_EXPENDITURES: Expenditure[] = [
  {
    id: 'exp_1',
    committeeId: 'com_guilford_dtc',
    amount: 1250.00,
    date: '2024-09-10',
    payee: 'Guilford Printing Co.',
    purpose: 'Fall mailer — 2,500 pieces',
    category: 'PRINTING',
    method: 'CHECK',
    checkNumber: '5001',
    createdAt: '2024-09-10T10:00:00Z',
  },
  {
    id: 'exp_2',
    committeeId: 'com_guilford_dtc',
    amount: 850.00,
    date: '2024-09-20',
    payee: 'CT Sign Company',
    purpose: 'Yard signs — 200 units',
    category: 'SIGNAGE',
    method: 'CHECK',
    checkNumber: '5002',
    createdAt: '2024-09-20T11:00:00Z',
  },
  {
    id: 'exp_3',
    committeeId: 'com_guilford_dtc',
    amount: 175.00,
    date: '2024-10-01',
    payee: 'USPS',
    purpose: 'Postage — fall mailer',
    category: 'POSTAGE',
    method: 'CHECK',
    checkNumber: '5003',
    createdAt: '2024-10-01T09:00:00Z',
  },
  {
    id: 'exp_4',
    committeeId: 'com_guilford_dtc',
    amount: 450.00,
    date: '2024-10-15',
    payee: 'Guilford Community Center',
    purpose: 'Venue rental — fall fundraiser',
    category: 'EVENT',
    method: 'CHECK',
    checkNumber: '5004',
    createdAt: '2024-10-15T14:00:00Z',
  },
  {
    id: 'exp_5',
    committeeId: 'com_guilford_dtc',
    amount: 89.00,
    date: '2024-10-20',
    payee: 'Squarespace',
    purpose: 'Website annual subscription',
    category: 'TECHNOLOGY',
    method: 'CREDIT_CARD',
    createdAt: '2024-10-20T16:00:00Z',
  },
  {
    id: 'exp_6',
    committeeId: 'com_guilford_dtc',
    amount: 320.00,
    date: '2024-11-01',
    payee: 'Shore Line Times',
    purpose: 'Election Day ad placement',
    category: 'ADVERTISING',
    method: 'CHECK',
    checkNumber: '5005',
    createdAt: '2024-11-01T09:30:00Z',
  },
  {
    id: 'exp_7',
    committeeId: 'com_guilford_dtc',
    amount: 42.50,
    date: '2024-11-03',
    payee: 'Staples',
    purpose: 'Office supplies — pens, folders, paper',
    category: 'OFFICE_SUPPLIES',
    method: 'CREDIT_CARD',
    createdAt: '2024-11-03T11:00:00Z',
  },
]

export function getExpendituresForCommittee(committeeId: string): Expenditure[] {
  return MOCK_EXPENDITURES.filter((e) => e.committeeId === committeeId)
}

// ─── Bank accounts ─────────────────────────────────────────────────────────────

export const MOCK_BANK_ACCOUNTS: BankAccount[] = [
  {
    id: 'bank_1',
    committeeId: 'com_guilford_dtc',
    plaidAccountId: 'plaid_acc_abc123',
    name: 'Checking',
    institution: 'Guilford Savings Bank',
    accountType: 'checking',
    lastFour: '4821',
    currentBalance: 1847.23,
    availableBalance: 1847.23,
    lastSyncedAt: new Date().toISOString(),
    createdAt: '2024-09-01T00:00:00Z',
  },
]

export const MOCK_BANK_TRANSACTIONS: BankTransaction[] = [
  // Deposits that match existing contributions
  { id: 'tx_1', bankAccountId: 'bank_1', plaidTransactionId: 'plaid_tx_001', amount: 250.00, date: '2024-09-16', description: 'CHECK DEPOSIT', category: 'Transfer', matchType: 'CONTRIBUTION', matchedContributionId: 'don_1', isReconciled: true, createdAt: '2024-09-16T00:00:00Z' },
  { id: 'tx_2', bankAccountId: 'bank_1', plaidTransactionId: 'plaid_tx_002', amount: 100.00, date: '2024-09-19', description: 'CHECK DEPOSIT', category: 'Transfer', matchType: 'CONTRIBUTION', matchedContributionId: 'don_2', isReconciled: true, createdAt: '2024-09-19T00:00:00Z' },
  { id: 'tx_3', bankAccountId: 'bank_1', plaidTransactionId: 'plaid_tx_003', amount: 500.00, date: '2024-10-03', description: 'CHECK DEPOSIT', category: 'Transfer', matchType: 'CONTRIBUTION', matchedContributionId: 'don_3', isReconciled: true, createdAt: '2024-10-03T00:00:00Z' },
  { id: 'tx_4', bankAccountId: 'bank_1', plaidTransactionId: 'plaid_tx_004', amount: 75.00, date: '2024-10-11', description: 'ANEDOT INC TRANSFER', category: 'Transfer', matchType: 'CONTRIBUTION', matchedContributionId: 'don_4', isReconciled: true, createdAt: '2024-10-11T00:00:00Z' },
  // Withdrawals that match expenditures
  { id: 'tx_5', bankAccountId: 'bank_1', plaidTransactionId: 'plaid_tx_005', amount: -1250.00, date: '2024-09-11', description: 'CHECK #5001 GUILFORD PRINTING', category: 'Service', matchType: 'EXPENDITURE', matchedExpenditureId: 'exp_1', isReconciled: true, createdAt: '2024-09-11T00:00:00Z' },
  { id: 'tx_6', bankAccountId: 'bank_1', plaidTransactionId: 'plaid_tx_006', amount: -850.00, date: '2024-09-21', description: 'CHECK #5002 CT SIGN COMPANY', category: 'Shopping', matchType: 'EXPENDITURE', matchedExpenditureId: 'exp_2', isReconciled: true, createdAt: '2024-09-21T00:00:00Z' },
  { id: 'tx_7', bankAccountId: 'bank_1', plaidTransactionId: 'plaid_tx_007', amount: -175.00, date: '2024-10-02', description: 'CHECK #5003 USPS', category: 'Shipping', matchType: 'EXPENDITURE', matchedExpenditureId: 'exp_3', isReconciled: true, createdAt: '2024-10-02T00:00:00Z' },
  // Unreconciled — awaiting match
  { id: 'tx_8', bankAccountId: 'bank_1', plaidTransactionId: 'plaid_tx_008', amount: 200.00, date: '2024-10-23', description: 'CHECK DEPOSIT', category: 'Transfer', matchType: 'UNMATCHED', isReconciled: false, createdAt: '2024-10-23T00:00:00Z' },
  { id: 'tx_9', bankAccountId: 'bank_1', plaidTransactionId: 'plaid_tx_009', amount: -450.00, date: '2024-10-16', description: 'CHECK #5004 GUILFORD COMM CTR', category: 'Recreation', matchType: 'UNMATCHED', isReconciled: false, createdAt: '2024-10-16T00:00:00Z' },
  { id: 'tx_10', bankAccountId: 'bank_1', plaidTransactionId: 'plaid_tx_010', amount: 50.00, date: '2024-11-02', description: 'CHECK DEPOSIT', category: 'Transfer', matchType: 'UNMATCHED', isReconciled: false, createdAt: '2024-11-02T00:00:00Z' },
  { id: 'tx_11', bankAccountId: 'bank_1', plaidTransactionId: 'plaid_tx_011', amount: -89.00, date: '2024-10-21', description: 'SQUARESPACE INC', category: 'Software', matchType: 'UNMATCHED', isReconciled: false, createdAt: '2024-10-21T00:00:00Z' },
  // Ignored — bank fees, internal
  { id: 'tx_12', bankAccountId: 'bank_1', plaidTransactionId: 'plaid_tx_012', amount: -12.00, date: '2024-10-31', description: 'MONTHLY SERVICE FEE', category: 'Bank Fees', matchType: 'IGNORED', isReconciled: true, createdAt: '2024-10-31T00:00:00Z' },
]

export function getBankAccountsForCommittee(committeeId: string): BankAccount[] {
  return MOCK_BANK_ACCOUNTS.filter((a) => a.committeeId === committeeId)
}

export function getTransactionsForAccount(bankAccountId: string): BankTransaction[] {
  return MOCK_BANK_TRANSACTIONS
    .filter((t) => t.bankAccountId === bankAccountId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}
