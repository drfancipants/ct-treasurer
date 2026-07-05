import { describe, it, expect } from 'vitest'
import { parseRosterCsv, parseFlag, splitFullName } from '../roster-csv'
import type { RosterMember } from '../types'

function makeRosterMember(o: Partial<RosterMember> = {}): RosterMember {
  return {
    id: 'rm_1', committeeId: 'com_1',
    firstName: 'Janet', lastName: 'Ainsworth',
    email: 'janet@example.com', state: 'CT',
    isActive: true, duesPaid: false,
    contributionTotal: 0, contributionCount: 0,
    duesPaidViaAnedot: false, anedotDuesTotal: 0,
    createdAt: '2026-01-01T00:00:00Z',
    ...o,
  }
}

describe('parseFlag', () => {
  it('recognizes yes/no words', () => {
    expect(parseFlag('Yes')).toBe(true)
    expect(parseFlag('y')).toBe(true)
    expect(parseFlag('PAID')).toBe(true)
    expect(parseFlag('Active')).toBe(true)
    expect(parseFlag('no')).toBe(false)
    expect(parseFlag('Unpaid')).toBe(false)
    expect(parseFlag('Inactive')).toBe(false)
    expect(parseFlag('lapsed')).toBe(false)
  })

  it('treats dollar amounts as paid/unpaid', () => {
    expect(parseFlag('$25')).toBe(true)
    expect(parseFlag('25.00')).toBe(true)
    expect(parseFlag('0')).toBe(false)
  })

  it('returns undefined for blank or unrecognized values', () => {
    expect(parseFlag('')).toBeUndefined()
    expect(parseFlag(undefined)).toBeUndefined()
    expect(parseFlag('maybe')).toBeUndefined()
  })
})

describe('splitFullName', () => {
  it('splits "First Last"', () => {
    expect(splitFullName('Jane Smith')).toEqual({ firstName: 'Jane', lastName: 'Smith' })
  })
  it('splits "Last, First"', () => {
    expect(splitFullName('Smith, Jane')).toEqual({ firstName: 'Jane', lastName: 'Smith' })
  })
  it('keeps middle names with the first name', () => {
    expect(splitFullName('Mary Jo Kopechne')).toEqual({ firstName: 'Mary Jo', lastName: 'Kopechne' })
  })
})

describe('parseRosterCsv', () => {
  it('parses split-name headers with flexible casing', () => {
    const csv = 'FIRST NAME,Last Name,E-Mail,Town,Dues Paid,Status\nJane,Smith,JANE@Example.com,Guilford,$25,Active'
    const r = parseRosterCsv(csv, [])
    expect(r.createCount).toBe(1)
    const row = r.rows[0]
    expect(row.firstName).toBe('Jane')
    expect(row.lastName).toBe('Smith')
    expect(row.email).toBe('jane@example.com') // lowercased
    expect(row.city).toBe('Guilford')
    expect(row.duesPaid).toBe(true)
    expect(row.isActive).toBe(true)
  })

  it('parses a single combined Name column', () => {
    const csv = 'Name,Email\n"Smith, Jane",jane@example.com\nBob T Jones,bob@example.com'
    const r = parseRosterCsv(csv, [])
    expect(r.rows[0]).toMatchObject({ firstName: 'Jane', lastName: 'Smith' })
    expect(r.rows[1]).toMatchObject({ firstName: 'Bob T', lastName: 'Jones' })
  })

  it('matches existing members by email (case-insensitive) as updates', () => {
    const existing = [makeRosterMember({ id: 'rm_9', email: 'janet@example.com' })]
    const csv = 'First Name,Last Name,Email\nJanet,Renamed,Janet@EXAMPLE.com\nNew,Person,new@example.com'
    const r = parseRosterCsv(csv, existing)
    expect(r.updateCount).toBe(1)
    expect(r.createCount).toBe(1)
    expect(r.rows[0]).toMatchObject({ action: 'update', existingId: 'rm_9' })
    expect(r.rows[1].action).toBe('create')
  })

  it('falls back to name matching when the CSV has no email', () => {
    const existing = [makeRosterMember({ id: 'rm_7', firstName: 'Janet', lastName: 'Ainsworth' })]
    const csv = 'First Name,Last Name,Phone\njanet,AINSWORTH,203-555-0101'
    const r = parseRosterCsv(csv, existing)
    expect(r.rows[0]).toMatchObject({ action: 'update', existingId: 'rm_7' })
  })

  it('leaves flags undefined when columns are absent', () => {
    const csv = 'First Name,Last Name\nJane,Smith'
    const r = parseRosterCsv(csv, [])
    expect(r.rows[0].isActive).toBeUndefined()
    expect(r.rows[0].duesPaid).toBeUndefined()
  })

  it('flags rows without a name and in-file duplicates as errors', () => {
    const csv = 'First Name,Last Name,Email\nJane,Smith,jane@example.com\n,,\nJanet,Smyth,jane@example.com'
    const r = parseRosterCsv(csv, [])
    expect(r.errorCount).toBe(2)
    expect(r.rows[1].errorMessage).toBe('Missing name')
    expect(r.rows[2].errorMessage).toBe('Duplicate of row 2')
    expect(r.createCount).toBe(1)
  })
})
