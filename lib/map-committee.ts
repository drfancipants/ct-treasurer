import type { SubscriptionStatus, Prisma } from '@prisma/client'
import type { Committee } from '@/lib/types'

type CommitteeRow = {
  id: string; name: string; slug: string; seecId: string | null
  anedotAccountId: string | null; address1: string | null; address2: string | null
  city: string | null; state: string; zip: string | null; phone: string | null
  email: string | null; electionYear: number | null
  dashboardBankAccountId: string | null
  stripeCustomerId: string | null; stripeSubscriptionId: string | null
  subscriptionStatus: SubscriptionStatus | null; trialEndsAt: Date | null
  duesAnedotCampaign: string | null; duesThreshold: Prisma.Decimal | null
}

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
    dashboardBankAccountId: c.dashboardBankAccountId ?? undefined,
    stripeCustomerId: c.stripeCustomerId ?? undefined,
    stripeSubscriptionId: c.stripeSubscriptionId ?? undefined,
    subscriptionStatus: c.subscriptionStatus ?? undefined,
    trialEndsAt: c.trialEndsAt?.toISOString() ?? undefined,
    duesAnedotCampaign: c.duesAnedotCampaign ?? undefined,
    duesThreshold: c.duesThreshold ? Number(c.duesThreshold.toString()) : undefined,
  }
}
