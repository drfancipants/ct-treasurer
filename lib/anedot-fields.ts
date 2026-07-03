import type { PaymentMethod } from './types'

/**
 * Field-mapping rules shared by the Anedot CSV importer and the Anedot
 * webhook, so account-specific fields (payment types, CT compliance custom
 * questions) land in the same standard fields no matter how a donation
 * arrives.
 */

export const METHOD_MAP: Record<string, PaymentMethod> = {
  credit_card: 'CREDIT_CARD',
  'credit card': 'CREDIT_CARD',
  creditcard: 'CREDIT_CARD',
  card: 'CREDIT_CARD',
  debit_card: 'DEBIT_CARD',
  'debit card': 'DEBIT_CARD',
  check: 'CHECK',
  cash: 'CASH',
  ach: 'ONLINE',
  bank: 'ONLINE',
  bank_account: 'ONLINE',
  online: 'ONLINE',
  other: 'OTHER',
}

export function parseMethod(raw: string | undefined): PaymentMethod {
  return METHOD_MAP[raw?.toLowerCase().trim() ?? ''] ?? 'OTHER'
}

export function parseAmount(raw: string): number {
  const n = parseFloat(raw.replace(/[$,\s]/g, ''))
  return isNaN(n) ? NaN : n
}

export function parseBoolish(raw: string | undefined): boolean {
  const v = raw?.trim().toLowerCase() ?? ''
  return v !== '' && !['no', 'false', '0', 'none', 'one-time', 'once'].includes(v)
}

/** "No" → false; "Yes …Executive…" → true + E; Legislative → L; both → B */
export function parseContractorAnswer(raw: string | undefined): { isStateContractor: boolean; branch?: string } {
  const v = raw?.trim().toLowerCase() ?? ''
  if (!v || v.startsWith('no')) return { isStateContractor: false }
  const exec = v.includes('exec')
  const legis = v.includes('legis')
  return {
    isStateContractor: true,
    branch: exec && legis ? 'B' : exec ? 'E' : legis ? 'L' : undefined,
  }
}

/**
 * CT committees collect compliance data via free-text custom questions whose
 * labels vary by account config — match by substring on a normalized label.
 */
const QUESTION_KEYS: [string, string][] = [
  ['principal of a state contractor', 'stateContractorAnswer'],
  ['communicator lobbyist', 'lobbyistAnswer'],
  ['name of employer', 'employer'],
  ['principal occupation', 'occupation'],
]

export function matchQuestionKey(label: string): string | undefined {
  const normalized = label.toLowerCase().replace(/\s+/g, ' ')
  return QUESTION_KEYS.find(([needle]) => normalized.includes(needle))?.[1]
}

export interface CustomAnswerFields {
  employer?: string
  occupation?: string
  isStateContractor?: boolean
  contractorBranch?: string
  isLobbyist?: boolean
}

/**
 * Map [question label, answer] pairs to standard fields. Several labels can
 * feed one field (e.g. two lobbyist question variants) — an affirmative or
 * filled answer is never clobbered by an empty/"No" one.
 */
export function mapCustomAnswers(pairs: [string, string][]): CustomAnswerFields {
  const raw: Record<string, string> = {}
  for (const [label, value] of pairs) {
    const key = matchQuestionKey(label)
    const v = value?.trim() ?? ''
    if (key && !(key in raw && (!v || v.toLowerCase() === 'no'))) raw[key] = v
  }

  const out: CustomAnswerFields = {}
  if (raw.employer) out.employer = raw.employer
  if (raw.occupation) out.occupation = raw.occupation
  if (raw.stateContractorAnswer !== undefined) {
    const contractor = parseContractorAnswer(raw.stateContractorAnswer)
    out.isStateContractor = contractor.isStateContractor
    out.contractorBranch = contractor.branch
  }
  if (raw.lobbyistAnswer !== undefined) {
    out.isLobbyist = raw.lobbyistAnswer.trim().toLowerCase().startsWith('yes')
  }
  return out
}
