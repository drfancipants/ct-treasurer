import { describe, it, expect } from 'vitest'
import { toSubscriptionStatus } from '@/lib/billing'

describe('toSubscriptionStatus', () => {
  it('maps paying statuses directly', () => {
    expect(toSubscriptionStatus('trialing')).toBe('trialing')
    expect(toSubscriptionStatus('active')).toBe('active')
  })

  it('maps recoverable non-paying statuses to past_due', () => {
    expect(toSubscriptionStatus('past_due')).toBe('past_due')
    expect(toSubscriptionStatus('unpaid')).toBe('past_due')
    expect(toSubscriptionStatus('incomplete')).toBe('past_due')
  })

  it('maps terminal statuses to canceled', () => {
    expect(toSubscriptionStatus('canceled')).toBe('canceled')
    expect(toSubscriptionStatus('incomplete_expired')).toBe('canceled')
  })

  it('fails closed: paused and unknown statuses become past_due, never active', () => {
    expect(toSubscriptionStatus('paused')).toBe('past_due')
    expect(toSubscriptionStatus('some_future_status')).toBe('past_due')
    expect(toSubscriptionStatus('')).toBe('past_due')
  })
})
