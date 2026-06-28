import { notFound } from 'next/navigation'
import { getCommitteeBySlug } from '@/actions/committees'
import { getBankAccounts, getTransactions } from '@/actions/bank'
import { getContributions } from '@/actions/donations'
import { getExpenditures } from '@/actions/expenses'
import BankPageClient from '@/components/bank/BankPageClient'

export default async function BankPage({ params }: { params: { committeeSlug: string } }) {
  const committee = await getCommitteeBySlug(params.committeeSlug)
  if (!committee) notFound()

  const accounts = await getBankAccounts(committee.id)
  const [transactions, contributions, expenditures] = await Promise.all([
    getTransactions(accounts.map((a) => a.id)),
    getContributions(committee.id),
    getExpenditures(committee.id),
  ])

  return (
    <BankPageClient
      committeeId={committee.id}
      committeeSlug={params.committeeSlug}
      accounts={accounts}
      transactions={transactions}
      contributions={contributions}
      expenditures={expenditures}
    />
  )
}
