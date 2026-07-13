import { describe, it, expect } from 'vitest'
import { anedotPayloadSchema, mapWebhookDonation, type WebhookPayload } from '../anedot-webhook'

const base: WebhookPayload = {
  account_uid: 'aa3480c1cb0b039147824',
  first_name: 'Jane',
  last_name: 'Hook',
  email: 'jane.hook@x.com',
  amount_in_dollars: '52.40',
  created_at_iso8601: '2026-07-01T12:00:00Z',
  address_line_1: '12 Elm St',
  address_city: 'Guilford',
  address_region: 'CT',
  address_postal_code: '06437',
  donation: { id: 'wh_1' },
}

describe('mapWebhookDonation', () => {
  it('maps a minimal payload with the CREDIT_CARD default', () => {
    const m = mapWebhookDonation(base)
    expect(m.amount).toBe(52.4)
    expect(m.contributor).toMatchObject({
      firstName: 'Jane', lastName: 'Hook', address1: '12 Elm St', city: 'Guilford', zip: '06437',
    })
    expect(m.contribution.date.toISOString()).toBe('2026-07-01T12:00:00.000Z')
    expect(m.contribution.method).toBe('CREDIT_CARD')
    expect(m.contribution.isRecurring).toBe(false)
    expect(m.contribution.isStateContractor).toBe(false)
    expect(m.contribution.isLobbyist).toBe(false)
  })

  it('parses the documented donation_completed sample end to end', () => {
    // Trimmed from the sample in https://help.anedot.com/knowledge/webhooks
    const event = {
      event: 'donation_completed',
      payload: {
        date: '2023-05-19 21:16:55 UTC',
        name: 'Annie Dot',
        email: 'annie@anedot.com',
        phone: '12252501301',
        origin: 'hosted',
        source: 'credit_card',
        status: 'completed',
        donation: {
          id: 'd6b2fcd4406f382b4c23a',
          fees: { anedot_fees: { amount: '4.30' }, vendor_fees: [] },
          fund: { id: '5181b4d8', name: 'General Fund', identifier: '1001' },
          products: [],
          card_type: 'master',
          card_last_digits: '5454',
          credit_card_expiration: '05/2023',
        },
        frequency: 'once',
        last_name: 'Dot',
        recurring: 'false',
        created_at: '2023-05-19 21:16:54 UTC',
        first_name: 'Annie',
        net_amount: '95.70',
        occupation: '',
        account_uid: 'aa3480c1cb0b039147824',
        middle_name: '',
        address_city: 'New Orleans',
        check_number: '',
        date_iso8601: '2023-05-19T21:16:55Z',
        event_amount: '100.00',
        employer_name: '',
        address_line_1: '1340 Poydras Street',
        address_line_2: '',
        address_region: 'LA',
        commitment_uid: '',
        address_country: 'US',
        action_page_name: 'Feed the Children - March Gala',
        amount_in_dollars: '100.0',
        created_at_iso8601: '2023-05-19T21:16:54Z',
        address_postal_code: '70113',
        payment_description: 'MasterCard •••• 5454',
        custom_field_responses: { number_of_tickets: null },
        is_recurring_commitment: 'false',
      },
    }
    const parsed = anedotPayloadSchema.parse(event.payload)
    const m = mapWebhookDonation(parsed)
    expect(m.amount).toBe(100)
    expect(m.contributor).toMatchObject({
      firstName: 'Annie', lastName: 'Dot', email: 'annie@anedot.com',
      address1: '1340 Poydras Street', city: 'New Orleans', state: 'LA', zip: '70113',
    })
    expect(m.contributor.middleInitial).toBeUndefined() // empty string, not ''
    expect(m.contributor.employer).toBeUndefined()
    expect(m.contribution.method).toBe('CREDIT_CARD')
    expect(m.contribution.processingFee).toBe(4.3)
    expect(m.contribution.netAmount).toBe(95.7)
    expect(m.contribution.cardType).toBe('master')
    expect(m.contribution.cardLast4).toBe('5454')
    expect(m.contribution.isRecurring).toBe(false)
    expect(m.contribution.campaign).toBe('Feed the Children - March Gala')
    expect(m.contribution.date.toISOString()).toBe('2023-05-19T21:16:54.000Z')
  })

  it('maps ach source and sums anedot + vendor fees', () => {
    const m = mapWebhookDonation({
      ...base,
      source: 'ach',
      net_amount: '$50.00',
      donation: {
        id: 'wh_2',
        fees: { anedot_fees: { amount: '1.20' }, vendor_fees: [{ amount: '1.20' }] },
      },
    })
    expect(m.contribution.method).toBe('ONLINE')
    expect(m.contribution.processingFee).toBe(2.4)
    expect(m.contribution.netAmount).toBe(50)
  })

  it('derives recurring from the recurring flag, frequency, or commitment', () => {
    expect(mapWebhookDonation({ ...base, recurring: 'true' }).contribution.isRecurring).toBe(true)
    expect(mapWebhookDonation({ ...base, recurring: 'false', commitment_uid: 'cmt_1' }).contribution.isRecurring).toBe(false)
    expect(mapWebhookDonation({ ...base, frequency: 'monthly' }).contribution.isRecurring).toBe(true)
    expect(mapWebhookDonation({ ...base, frequency: 'once' }).contribution.isRecurring).toBe(false)
    expect(mapWebhookDonation({ ...base, commitment_uid: 'cmt_1' }).contribution.isRecurring).toBe(true)
  })

  it('maps snake_cased CT custom-question responses to standard fields', () => {
    const m = mapWebhookDonation({
      ...base,
      custom_field_responses: {
        name_of_employer_if_self_employed_list_name_of_business: 'NH BOE',
        principal_occupation_if_self_employed_provide_job_description: 'Teacher',
        are_you_a_principal_of_a_state_contractor_or_prospective_state_contractor_if_yes_please_indicate_which_branch_of_the_government_the_contract_is_with:
          'Yes - Legislative Branch',
        are_you_a_communicator_lobbyist_or_the_spouse_or_dependent_child_of_a_communicator_lobbyist: 'Yes',
      },
    })
    expect(m.contributor.employer).toBe('NH BOE')
    expect(m.contributor.occupation).toBe('Teacher')
    expect(m.contribution.isStateContractor).toBe(true)
    expect(m.contribution.contractorBranch).toBe('L')
    expect(m.contribution.isLobbyist).toBe(true)
  })

  it('lets built-in employer win over the custom question answer', () => {
    const m = mapWebhookDonation({
      ...base,
      employer_name: 'Built-in Corp',
      custom_field_responses: {
        name_of_employer_if_self_employed_list_name_of_business: 'Custom Corp',
        principal_occupation_if_self_employed_provide_job_description: 'Engineer',
      },
    })
    expect(m.contributor.employer).toBe('Built-in Corp') // built-in wins
    expect(m.contributor.occupation).toBe('Engineer')    // custom fills the gap
  })

  it('keeps middle initial to one character', () => {
    const m = mapWebhookDonation({ ...base, middle_name: 'Quincy' })
    expect(m.contributor.middleInitial).toBe('Q')
  })

  it('accepts a payload without account_uid (real deliveries omit it)', () => {
    const { account_uid: _omitted, ...rest } = base
    const parsed = anedotPayloadSchema.parse(rest)
    expect(parsed.account_uid).toBeUndefined()
    expect(mapWebhookDonation(parsed).amount).toBe(52.4)
  })

  it('normalizes empty strings and falls back to CT for a missing state', () => {
    const m = mapWebhookDonation({
      ...base,
      email: '',
      phone: '',
      address_region: '',
    })
    expect(m.contributor.email).toBeUndefined()
    expect(m.contributor.phone).toBeUndefined()
    expect(m.contributor.state).toBe('CT')
  })
})
