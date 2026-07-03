import { describe, it, expect } from 'vitest'
import { mapWebhookDonation, type WebhookDonation } from '../anedot-webhook'

const base: WebhookDonation = {
  uid: 'wh_1',
  amount: '52.40',
  created_at: '2026-07-01T12:00:00Z',
  first_name: 'Jane',
  last_name: 'Hook',
  email: 'jane.hook@x.com',
  billing_address: { street: '12 Elm St', city: 'Guilford', state: 'CT', zip: '06437' },
}

describe('mapWebhookDonation', () => {
  it('maps a minimal payload with the historical CREDIT_CARD default', () => {
    const m = mapWebhookDonation(base)
    expect(m.amount).toBe(52.4)
    expect(m.contributor).toMatchObject({
      firstName: 'Jane', lastName: 'Hook', address1: '12 Elm St', city: 'Guilford', zip: '06437',
    })
    expect(m.contribution.method).toBe('CREDIT_CARD')
    expect(m.contribution.isRecurring).toBe(false)
    expect(m.contribution.isStateContractor).toBe(false)
    expect(m.contribution.isLobbyist).toBe(false)
  })

  it('maps processor detail: fee, net, card object variant, recurring flag', () => {
    const m = mapWebhookDonation({
      ...base,
      fee: '$2.40',
      net_amount: '$50.00',
      card: { brand: 'visa', last_four: '4242' },
      recurring: 'Monthly',
      campaign: { name: 'Spring Appeal' },
    })
    expect(m.contribution.processingFee).toBe(2.4)
    expect(m.contribution.netAmount).toBe(50)
    expect(m.contribution.cardType).toBe('visa')
    expect(m.contribution.cardLast4).toBe('4242')
    expect(m.contribution.isRecurring).toBe(true)
    expect(m.contribution.campaign).toBe('Spring Appeal')
  })

  it('maps payment_method when present and treats commitment_uid as recurring', () => {
    const m = mapWebhookDonation({ ...base, payment_method: 'ach', commitment_uid: 'cmt_1' })
    expect(m.contribution.method).toBe('ONLINE')
    expect(m.contribution.isRecurring).toBe(true)
  })

  it('maps CT custom-question responses to standard fields', () => {
    const m = mapWebhookDonation({
      ...base,
      custom_field_responses: [
        { name: 'Name of Employer (If self employed list name of business)', response: 'NH BOE' },
        { name: 'Principal Occupation (If self employed provide job description)', response: 'Teacher' },
        { name: 'Are you a principal of a state contractor or prospective state contractor? If Yes, please indicate which branch of the government the contract is with.', response: 'Yes - Legislative Branch' },
        { name: 'Are you a communicator lobbyist, OR the spouse or dependent child of a communicator lobbyist?', response: 'Yes' },
      ],
    })
    expect(m.contributor.employer).toBe('NH BOE')
    expect(m.contributor.occupation).toBe('Teacher')
    expect(m.contribution.isStateContractor).toBe(true)
    expect(m.contribution.contractorBranch).toBe('L')
    expect(m.contribution.isLobbyist).toBe(true)
  })

  it('accepts custom_fields record form and lets built-in employer win', () => {
    const m = mapWebhookDonation({
      ...base,
      employer: 'Built-in Corp',
      custom_fields: {
        'Name of Employer  (If self employed list name of business)': 'Custom Corp',
        'Principal Occupation (If self employed provide job description)': 'Engineer',
      },
    })
    expect(m.contributor.employer).toBe('Built-in Corp') // built-in wins
    expect(m.contributor.occupation).toBe('Engineer')    // custom fills the gap
  })

  it('keeps middle initial to one character', () => {
    const m = mapWebhookDonation({ ...base, middle_initial: 'Quincy' })
    expect(m.contributor.middleInitial).toBe('Q')
  })
})
