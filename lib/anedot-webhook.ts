import { z } from 'zod'
import { parseMethod, parseAmount, parseBoolish, mapCustomAnswers } from './anedot-fields'
import type { PaymentMethod } from './types'

/**
 * Anedot webhook event body (default template): flat donor/transaction fields
 * under `payload`, with processor detail nested in `payload.donation`.
 * Anedot sends empty strings rather than omitting fields, so everything
 * non-core is optional and empties are normalized away in the mapper.
 * Documented at https://help.anedot.com/knowledge/webhooks
 */
export const anedotEventSchema = z.object({
  event: z.string(),
  payload: z.object({
    account_uid: z.string().min(1),
    first_name: z.string(),
    last_name: z.string(),
    middle_name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    employer_name: z.string().optional(),
    occupation: z.string().optional(),
    address_line_1: z.string().optional(),
    address_line_2: z.string().optional(),
    address_city: z.string().optional(),
    address_region: z.string().optional(),
    address_postal_code: z.string().optional(),
    // Payment method: credit_card, ach, check…
    source: z.string().optional(),
    amount_in_dollars: z.string(),
    net_amount: z.string().optional(),
    created_at_iso8601: z.string().optional(),
    date_iso8601: z.string().optional(),
    created_at: z.string().optional(),
    recurring: z.string().optional(),
    frequency: z.string().optional(),
    commitment_uid: z.string().optional(),
    action_page_name: z.string().optional(),
    donation: z.object({
      id: z.string().min(1),
      fees: z
        .object({
          anedot_fees: z.object({ amount: z.string().optional() }).optional(),
          vendor_fees: z.array(z.object({ amount: z.string().optional() })).optional(),
        })
        .optional(),
      card_type: z.string().optional(),
      card_last_digits: z.string().optional(),
    }),
    // Account-specific custom questions (CT compliance fields), keyed by
    // snake_cased question name: { name_of_employer_: "NH BOE", … }
    custom_field_responses: z.record(z.string(), z.string().nullable()).optional(),
  }),
})

export type AnedotEvent = z.infer<typeof anedotEventSchema>
export type WebhookPayload = AnedotEvent['payload']

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

/** Empty strings (Anedot's "not provided") → undefined. */
function str(v: string | undefined): string | undefined {
  const t = v?.trim()
  return t || undefined
}

function money(v: string | undefined): number | undefined {
  if (!v?.trim()) return undefined
  const n = parseAmount(v)
  return isNaN(n) ? undefined : n
}

/** Map an Anedot webhook payload onto the app's standard fields. */
export function mapWebhookDonation(p: WebhookPayload): MappedWebhookDonation {
  // Custom question answers arrive keyed by snake_cased question name —
  // underscores → spaces lets the shared label matcher recognize them
  const custom = mapCustomAnswers(
    Object.entries(p.custom_field_responses ?? {}).map(([key, value]) => [
      key.replace(/_/g, ' '),
      value ?? '',
    ])
  )

  const cardType = str(p.donation.card_type)
  const cardLast4 = str(p.donation.card_last_digits)
  let method = str(p.source) ? parseMethod(p.source) : 'CREDIT_CARD'
  if (method === 'OTHER' && (cardType || cardLast4)) method = 'CREDIT_CARD'

  const isRecurring = str(p.recurring)
    ? parseBoolish(p.recurring)
    : str(p.frequency)
      ? parseBoolish(p.frequency)
      : Boolean(str(p.commitment_uid))

  const feeParts = [
    p.donation.fees?.anedot_fees?.amount,
    ...(p.donation.fees?.vendor_fees ?? []).map((f) => f.amount),
  ]
    .map(money)
    .filter((n): n is number => n !== undefined)
  const processingFee = feeParts.length
    ? Number(feeParts.reduce((a, b) => a + b, 0).toFixed(2))
    : undefined

  const rawDate = str(p.created_at_iso8601) ?? str(p.date_iso8601) ?? str(p.created_at)
  let date = rawDate ? new Date(rawDate) : new Date()
  if (isNaN(date.getTime())) date = new Date()

  return {
    amount: parseAmount(p.amount_in_dollars),
    contributor: {
      firstName: p.first_name,
      middleInitial: str(p.middle_name)?.slice(0, 1),
      lastName: p.last_name,
      email: str(p.email),
      phone: str(p.phone),
      address1: p.address_line_1?.trim() ?? '',
      address2: str(p.address_line_2),
      city: p.address_city?.trim() ?? '',
      state: str(p.address_region) ?? 'CT',
      zip: p.address_postal_code?.trim() ?? '',
      // Built-in fields win; the CT custom questions fill the usual gaps
      employer: str(p.employer_name) ?? custom.employer,
      occupation: str(p.occupation) ?? custom.occupation,
    },
    contribution: {
      date,
      method,
      netAmount: money(p.net_amount),
      processingFee,
      cardType,
      cardLast4,
      isRecurring,
      campaign: str(p.action_page_name),
      isStateContractor: custom.isStateContractor ?? false,
      contractorBranch: custom.contractorBranch,
      isLobbyist: custom.isLobbyist ?? false,
    },
  }
}
