import { notFound } from 'next/navigation'
import { getCommitteeBySlug } from '@/actions/committees'
import { requireCommitteeMember, canEditFinances } from '@/lib/auth'
import { getBankAccounts, getTransactions } from '@/actions/bank'
import { getContributions } from '@/actions/donations'
import { getExpenditures } from '@/actions/expenses'
import BankPageClient from '@/components/bank/BankPageClient'

export default async function BankPage({ params }: { params: Promise<{ committeeSlug: string }> }) {
  const { committeeSlug } = await params
  const committee = await getCommitteeBySlug(committeeSlug)
  if (!committee) notFound()

  const { role } = await requireCommitteeMember(committeeSlug)
  const canEdit = canEditFinances(role)

  const accounts = await getBankAccounts(committee.id)
  const [transactions, contributions, expenditures] = await Promise.all([
    getTransactions(accounts.map((a) => a.id)),
    getContributions(committee.id),
    getExpenditures(committee.id),
  ])

  return (
    <BankPageClient
      committeeId={committee.id}
      committeeSlug={committeeSlug}
      accounts={accounts}
      transactions={transactions}
      contributions={contributions}
      expenditures={expenditures}
      canEdit={canEdit}
    />
  )
}
