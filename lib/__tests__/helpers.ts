import type { Contribution, Contributor, Expenditure } from '../types'

export function makeContributor(overrides: Partial<Contributor> = {}): Contributor {
  return {
    id: 'con_1',
    firstName: 'Jane',
    lastName: 'Donor',
    email: 'jane@example.com',
    address1: '12 Elm St',
    city: 'Madison',
    state: 'CT',
    zip: '06443',
    employer: 'Acme Corp',
    occupation: 'Engineer',
    ...overrides,
  }
}

type ContributionOverrides = Partial<Omit<Contribution, 'contributor'>> & {
  contributor?: Partial<Contributor>
}

export function makeContribution(overrides: ContributionOverrides = {}): Contribution {
  const { contributor, ...rest } = overrides
  return {
    id: 'don_1',
    committeeId: 'com_1',
    contributor: makeContributor(contributor),
    amount: 100,
    date: '2026-05-15',
    method: 'CHECK',
    source: 'MANUAL',
    isItemized: true,
    createdAt: '2026-05-15T12:00:00.000Z',
    ...rest,
  }
}

export function makeExpenditure(overrides: Partial<Expenditure> = {}): Expenditure {
  return {
    id: 'exp_1',
    committeeId: 'com_1',
    amount: 250,
    date: '2026-05-20',
    payee: 'Shoreline Printing',
    purpose: 'Palm cards',
    category: 'PRNT',
    method: 'CHECK',
    checkNumber: '1042',
    createdAt: '2026-05-20T12:00:00.000Z',
    ...overrides,
  }
}
