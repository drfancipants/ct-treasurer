import { describe, it, expect } from 'vitest'
import { getSeecStatus } from '../types'
import { makeContribution } from './helpers'

describe('getSeecStatus', () => {
  it('marks a complete itemized contribution compliant', () => {
    const result = getSeecStatus(makeContribution({ amount: 100 }))
    expect(result.status).toBe('compliant')
    expect(result.issues).toEqual([])
  })

  it('does not require employer/occupation under $50', () => {
    const result = getSeecStatus(
      makeContribution({
        amount: 49.99,
        contributor: { employer: undefined, occupation: undefined },
      })
    )
    expect(result.status).toBe('compliant')
  })

  it('requires employer and occupation at exactly $50', () => {
    const result = getSeecStatus(
      makeContribution({
        amount: 50,
        contributor: { employer: undefined, occupation: undefined },
      })
    )
    expect(result.status).toBe('missing_info')
    expect(result.issues).toContain('Missing employer (required for itemized)')
    expect(result.issues).toContain('Missing occupation (required for itemized)')
  })

  it('flags only the missing field when one of employer/occupation is present', () => {
    const result = getSeecStatus(
      makeContribution({ amount: 75, contributor: { occupation: undefined } })
    )
    expect(result.status).toBe('missing_info')
    expect(result.issues).toEqual(['Missing occupation (required for itemized)'])
  })

  it('marks missing address incomplete regardless of amount', () => {
    const result = getSeecStatus(
      makeContribution({ amount: 10, contributor: { address1: '' } })
    )
    expect(result.status).toBe('incomplete')
    expect(result.issues).toContain('Missing street address')
  })

  it('marks missing donor name incomplete', () => {
    const result = getSeecStatus(makeContribution({ contributor: { lastName: '' } }))
    expect(result.status).toBe('incomplete')
    expect(result.issues).toContain('Missing donor name')
  })

  it('reports incomplete before missing_info when both apply', () => {
    const result = getSeecStatus(
      makeContribution({
        amount: 100,
        contributor: { city: '', employer: undefined },
      })
    )
    expect(result.status).toBe('incomplete')
    expect(result.issues).toEqual(['Missing city'])
  })
})
