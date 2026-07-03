import { describe, it, expect } from 'vitest'
import { matchRosterToContributors, type MatchableContributor, type MatchableMember } from '../roster-links'

const member = (o: Partial<MatchableMember> = {}): MatchableMember => ({
  id: 'm1', firstName: 'Janet', lastName: 'Ainsworth', email: 'janet@example.com', ...o,
})
const contributor = (o: Partial<MatchableContributor> = {}): MatchableContributor => ({
  id: 'c1', firstName: 'Janet', lastName: 'Ainsworth', email: 'janet@example.com', isCommitteeDonor: true, ...o,
})

describe('matchRosterToContributors', () => {
  it('matches by email case-insensitively', () => {
    const links = matchRosterToContributors(
      [member({ email: 'JANET@Example.com' })],
      [contributor({ firstName: 'J', lastName: 'A' })] // name differs — email wins
    )
    expect(links.get('m1')).toBe('c1')
  })

  it('falls back to name matching for committee donors only', () => {
    const links = matchRosterToContributors(
      [member({ email: null })],
      [contributor({ email: null, isCommitteeDonor: true })]
    )
    expect(links.get('m1')).toBe('c1')

    const noLink = matchRosterToContributors(
      [member({ email: null })],
      [contributor({ email: null, isCommitteeDonor: false })]
    )
    expect(noLink.size).toBe(0)
  })

  it('skips ambiguous name matches', () => {
    const links = matchRosterToContributors(
      [member({ email: null })],
      [contributor({ id: 'c1', email: null }), contributor({ id: 'c2', email: null })]
    )
    expect(links.size).toBe(0)
  })

  it('never links one contributor to two members or reuses an existing link', () => {
    const links = matchRosterToContributors(
      [member({ id: 'm1' }), member({ id: 'm2' })],
      [contributor()]
    )
    expect(links.size).toBe(1)

    const none = matchRosterToContributors([member()], [contributor()], new Set(['c1']))
    expect(none.size).toBe(0)
  })
})
