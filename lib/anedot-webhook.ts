import { parseMethod, parseAmount, mapCustomAnswers } from './anedot-fields'
import type { PaymentMethod } from './types'

/**
 * Flexible view of an Anedot webhook donation. Anedot's payloads vary by
 * account configuration and API version, so every non-core field is optional
 * and several shapes are accepted for cards, campaigns, and custom fields.
 */
export interface WebhookDonation {
  uid: string
  amount: string
  created_at: string
  first_name: string
  middle_initial?: string
  last_name: string
  email?: string
  phone?: string
  employer?: string
  occupation?: string
  billing_address?: {
    street: string
    street_2?: string
    city: string
    state: string
    zip: string
  }
  payment_method?: string
  note?: string
  // Processor detail
  fee?: string
  net_amount?: string
  card_type?: string
  card_last4?: string
  card?: { brand?: string; last_four?: string; last4?: string }
  recurring?: boolean | string
  commitment_uid?: string
  campaign?: string | { name?: string }
  action_page?: string | { name?: string }
  // Account-specific custom questions (CT compliance fields)
  custom_field_responses?: {
    name?: string
    label?: string
    question?: string
    response?: string
    value?: string
    answer?: string
  }[]
  custom_fields?: Record<string, string>
}

export interface MappedWebhookDonation {
  amount: number
  contributor: {
    firstName: string
    middleInitial?: string
    lastName: string
    email?: string
    phone?: string
    address1: string
    address2?: string
    city: string
    state: string
    zip: string
    employer?: string
    occupation?: string
  }
  contribution: {
    date: Date
    method: PaymentMethod
    memo?: string
    netAmount?: number
    processingFee?: number
    cardType?: string
    cardLast4?: string
    isRecurring: boolean
    campaign?: string
    isStateContractor: boolean
    contractorBranch?: string
    isLobbyist: boolean
  }
}

function nameOf(v: string | { name?: string } | undefined): string | undefined {
  if (!v) return undefined
  return typeof v === 'string' ? v : v.name
}

function money(v: string | undefined): number | undefined {
  if (!v) return undefined
  const n = parseAmount(v)
  return isNaN(n) ? undefined : n
}

/** Map an Anedot webhook donation onto the app's standard fields. */
export function mapWebhookDonation(d: WebhookDonation): MappedWebhookDonation {
  // Custom question answers — label/value key names vary by payload version
  const pairs: [string, string][] = []
  for (const f of d.custom_field_responses ?? []) {
    const label = f.name ?? f.label ?? f.question ?? ''
    const value = f.response ?? f.value ?? f.answer ?? ''
    if (label) pairs.push([label, value])
  }
  for (const [label, value] of Object.entries(d.custom_fields ?? {})) {
    pairs.push([label, value ?? ''])
  }
  const custom = mapCustomAnswers(pairs)

  const cardType = d.card_type ?? d.card?.brand
  const cardLast4 = d.card_last4 ?? d.card?.last_four ?? d.card?.last4

  let method = d.payment_method ? parseMethod(d.payment_method) : 'CREDIT_CARD'
  if (method === 'OTHER' && (cardType || cardLast4)) method = 'CREDIT_CARD'

  const isRecurring =
    typeof d.recurring === 'boolean'
      ? d.recurring
      : typeof d.recurring === 'string'
        ? !['', 'no', 'false', 'none', 'one-time', 'once'].includes(d.recurring.toLowerCase())
        : !!d.commitment_uid

  return {
    amount: parseAmount(d.amount),
    contributor: {
      firstName: d.first_name,
      middleInitial: d.middle_initial?.slice(0, 1) || undefined,
      lastName: d.last_name,
      email: d.email,
      phone: d.phone,
      address1: d.billing_address?.street ?? '',
      address2: d.billing_address?.street_2,
      city: d.billing_address?.city ?? '',
      state: d.billing_address?.state ?? 'CT',
      zip: d.billing_address?.zip ?? '',
      // Built-in fields win; the CT custom questions fill the usual gaps
      employer: d.employer || custom.employer,
      occupation: d.occupation || custom.occupation,
    },
    contribution: {
      date: new Date(d.created_at),
      method,
      memo: d.note,
      netAmount: money(d.net_amount),
      processingFee: money(d.fee),
      cardType: cardType || undefined,
      cardLast4: cardLast4 || undefined,
      isRecurring,
      campaign: nameOf(d.campaign) ?? nameOf(d.action_page),
      isStateContractor: custom.isStateContractor ?? false,
      contractorBranch: custom.contractorBranch,
      isLobbyist: custom.isLobbyist ?? false,
    },
  }
}
