import { describe, it, expect } from 'vitest'
import { canEditFinances, canEditRoster, FINANCE_ROLES, ROSTER_ROLES } from '../auth'

describe('canEditFinances', () => {
  it('allows treasurer and assistant treasurer', () => {
    expect(canEditFinances('TREASURER')).toBe(true)
    expect(canEditFinances('ASSISTANT_TREASURER')).toBe(true)
  })

  it('denies every other role', () => {
    expect(canEditFinances('CHAIRPERSON')).toBe(false)
    expect(canEditFinances('SECRETARY')).toBe(false)
    expect(canEditFinances('MEMBER')).toBe(false)
    expect(canEditFinances('VIEWER')).toBe(false)
  })

  it('denies garbage/empty input rather than throwing', () => {
    expect(canEditFinances('')).toBe(false)
    expect(canEditFinances('treasurer')).toBe(false) // case-sensitive — must match the enum exactly
    expect(canEditFinances('NOT_A_REAL_ROLE')).toBe(false)
  })
})

describe('canEditRoster', () => {
  it('allows treasurer, assistant treasurer, chairperson, and secretary', () => {
    expect(canEditRoster('TREASURER')).toBe(true)
    expect(canEditRoster('ASSISTANT_TREASURER')).toBe(true)
    expect(canEditRoster('CHAIRPERSON')).toBe(true)
    expect(canEditRoster('SECRETARY')).toBe(true)
  })

  it('denies member and viewer', () => {
    expect(canEditRoster('MEMBER')).toBe(false)
    expect(canEditRoster('VIEWER')).toBe(false)
  })

  it('denies garbage input rather than throwing', () => {
    expect(canEditRoster('')).toBe(false)
    expect(canEditRoster('NOT_A_REAL_ROLE')).toBe(false)
  })
})

describe('role hierarchy invariant', () => {
  it('every finance role can also edit the roster — a looser gate must not exclude a stricter one', () => {
    for (const role of FINANCE_ROLES) {
      expect(ROSTER_ROLES).toContain(role)
    }
  })
})
