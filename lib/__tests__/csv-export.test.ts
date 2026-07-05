import { describe, it, expect } from 'vitest'
import {
  contributionsToCsv,
  expendituresToCsv,
  eventsToCsv,
  rosterToCsv,
  bankTransactionsToCsv,
  committeeContributionsToCsv,
} from '../csv-export'
import { makeContribution, makeExpenditure } from './helpers'
import type { CommitteeEvent, RosterMember, BankAccount, BankTransaction } from '../types'

const events = new Map<string, CommitteeEvent>()

describe('contributionsToCsv', () => {
  it('includes the header row and the donor/amount/method for each contribution', () => {
    const csv = contributionsToCsv([makeContribution({ amount: 150, method: 'CREDIT_CARD' })], events)
    const lines = csv.split('\r\n')
    expect(lines[0]).toContain('First Name')
    expect(lines[0]).toContain('Amount')
    expect(lines[1]).toContain('Jane')
    expect(lines[1]).toContain('Donor')
    expect(lines[1]).toContain('150')
    expect(lines[1]).toContain('Credit card')
  })

  it('resolves a linked event to its letter', () => {
    const withEvent = new Map<string, CommitteeEvent>([
      ['evt_1', { id: 'evt_1', committeeId: 'com_1', date: '2026-06-01', letter: 'A', description: 'Gala', isFundraiser: true, state: 'CT', isPersonalResidence: false, hadDonatedGoods: false, wasTagSale: false, hadProgramBook: false, soldFoodAtFair: false, foodReceipts: 0, tagSaleReceipts: 0, createdAt: '2026-06-01T00:00:00.000Z' }],
    ])
    const csv = contributionsToCsv([makeContribution({ eventId: 'evt_1' })], withEvent)
    expect(csv).toContain('Event A')
  })

  it('leaves the event column blank when there is no linked event', () => {
    const csv = contributionsToCsv([makeContribution()], events)
    const lines = csv.split('\r\n')
    const header = lines[0].split(',')
    const eventCol = header.indexOf('Event')
    expect(lines[1].split(',')[eventCol]).toBe('')
  })

  it('returns just a header row (no crash) for an empty list', () => {
    const csv = contributionsToCsv([], events)
    expect(csv.split('\r\n')).toHaveLength(1)
  })
})

describe('expendituresToCsv', () => {
  it('includes both the human-readable category label and the raw SEEC code', () => {
    const csv = expendituresToCsv([makeExpenditure({ category: 'A-RAD' })], events)
    expect(csv).toContain('Advertise on radio')
    expect(csv).toContain('A-RAD')
  })
})

describe('eventsToCsv', () => {
  it('maps boolean flags to Yes/No', () => {
    const event: CommitteeEvent = {
      id: 'evt_1', committeeId: 'com_1', date: '2026-06-01', letter: 'A', description: 'Gala',
      isFundraiser: true, state: 'CT', isPersonalResidence: true, hadDonatedGoods: false,
      wasTagSale: false, hadProgramBook: false, soldFoodAtFair: true, foodReceipts: 200, tagSaleReceipts: 0,
      createdAt: '2026-06-01T00:00:00.000Z',
    }
    const csv = eventsToCsv([event])
    const lines = csv.split('\r\n')
    const header = lines[0].split(',')
    const row = lines[1].split(',')
    expect(row[header.indexOf('Personal Residence')]).toBe('Yes')
    expect(row[header.indexOf('Donated Goods/Services')]).toBe('No')
    expect(row[header.indexOf('Sold Food')]).toBe('Yes')
  })
})

describe('rosterToCsv', () => {
  const base: RosterMember = {
    id: 'r1', committeeId: 'com_1', firstName: 'Pat', lastName: 'Voter', state: 'CT',
    isActive: true, duesPaid: false, contributionTotal: 0, contributionCount: 0,
    duesPaidViaAnedot: false, anedotDuesTotal: 0, createdAt: '2026-01-01T00:00:00.000Z',
  }

  it('shows dues as paid when marked manually', () => {
    const csv = rosterToCsv([{ ...base, duesPaid: true }])
    expect(csv).toContain('Yes')
  })

  it('shows dues as paid when satisfied via the Anedot campaign, even if not manually marked', () => {
    const csv = rosterToCsv([{ ...base, duesPaid: false, duesPaidViaAnedot: true }])
    const lines = csv.split('\r\n')
    const header = lines[0].split(',')
    const row = lines[1].split(',')
    expect(row[header.indexOf('Dues Paid')]).toBe('Yes')
  })

  it('shows dues as unpaid when neither is true', () => {
    const csv = rosterToCsv([base])
    const lines = csv.split('\r\n')
    const header = lines[0].split(',')
    const row = lines[1].split(',')
    expect(row[header.indexOf('Dues Paid')]).toBe('No')
  })
})

describe('bankTransactionsToCsv', () => {
  it('resolves the bank account id to its name', () => {
    const accounts = new Map<string, BankAccount>([
      ['acc_1', { id: 'acc_1', committeeId: 'com_1', name: 'Operating', institution: 'Chase', accountType: 'checking', lastFour: '1234', currentBalance: 500, createdAt: '2026-01-01T00:00:00.000Z' }],
    ])
    const tx: BankTransaction = {
      id: 't1', bankAccountId: 'acc_1', amount: 100, date: '2026-05-01', description: 'Deposit',
      matchType: 'UNMATCHED', isReconciled: false, createdAt: '2026-05-01T00:00:00.000Z',
    }
    const csv = bankTransactionsToCsv([tx], accounts)
    expect(csv).toContain('Operating')
  })
})

describe('committeeContributionsToCsv', () => {
  it('leaves the method column blank when no payment method was recorded', () => {
    const csv = committeeContributionsToCsv([{
      id: 'cc1', committeeId: 'com_1', fromName: 'Neighboring Town Committee', state: 'CT',
      date: '2026-05-01', amount: 250, createdAt: '2026-05-01T00:00:00.000Z',
    }], events)
    const lines = csv.split('\r\n')
    const header = lines[0].split(',')
    const row = lines[1].split(',')
    expect(row[header.indexOf('Method')]).toBe('')
  })
})
