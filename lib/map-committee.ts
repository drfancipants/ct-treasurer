import type { SubscriptionStatus, CommitteeType, OfficeSought, Prisma } from '@prisma/client'
import type { Committee } from '@/lib/types'

type CommitteeRow = {
  id: string; name: string; slug: string; seecId: string | null
  anedotAccountId: string | null; address1: string | null; address2: string | null
  city: string | null; state: string; zip: string | null; phone: string | null
  email: string | null; electionYear: number | null
  type: CommitteeType
  candidateName: string | null; officeSought: OfficeSought | null; district: string | null
  cepParticipant: boolean; primaryDate: Date | null; electionDate: Date | null
  dashboardBankAccountId: string | null
  stripeCustomerId: string | null; stripeSubscriptionId: string | null
  subscriptionStatus: SubscriptionStatus | null; trialEndsAt: Date | null
  duesAnedotCampaign: string | null; duesThreshold: Prisma.Decimal | null
}

const isoDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : undefined)

export function mapCommittee(c: CommitteeRow): Committee {
  return {
    id: c.id, name: c.name, slug: c.slug,
    seecId: c.seecId ?? undefined,
    anedotAccountId: c.anedotAccountId ?? undefined,
    address1: c.address1 ?? undefined,
    address2: c.address2 ?? undefined,
    city: c.city ?? undefined,
    state: c.state,
    zip: c.zip ?? undefined,
    phone: c.phone ?? undefined,
    email: c.email ?? undefined,
    electionYear: c.electionYear ?? undefined,
    type: c.type,
    candidateName: c.candidateName ?? undefined,
    officeSought: c.officeSought ?? undefined,
    district: c.district ?? undefined,
    cepParticipant: c.cepParticipant,
    primaryDate: isoDate(c.primaryDate),
    electionDate: isoDate(c.electionDate),
    dashboardBankAccountId: c.dashboardBankAccountId ?? undefined,
    stripeCustomerId: c.stripeCustomerId ?? undefined,
    stripeSubscriptionId: c.stripeSubscriptionId ?? undefined,
    subscriptionStatus: c.subscriptionStatus ?? undefined,
    trialEndsAt: c.trialEndsAt?.toISOString() ?? undefined,
    duesAnedotCampaign: c.duesAnedotCampaign ?? undefined,
    duesThreshold: c.duesThreshold ? Number(c.duesThreshold.toString()) : undefined,
  }
}
