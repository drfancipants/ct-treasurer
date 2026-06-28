import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Building2, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'

export default async function AppPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const memberships = await prisma.committeeMembership.findMany({
    where: { userId: user.id },
    include: { committee: true },
    orderBy: { committee: { name: 'asc' } },
  })

  if (memberships.length === 1) {
    redirect(`/app/${memberships[0].committee.slug}/donations`)
  }

  if (memberships.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-6 h-6 text-slate-400" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900 mb-2">No committees yet</h1>
          <p className="text-sm text-slate-500 mb-6">
            You haven&apos;t been added to any committees yet.
          </p>
          <Link
            href="/app/create-committee"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create a committee
          </Link>
          <p className="text-xs text-slate-400 mt-4">
            Or ask your treasurer to send you an invitation.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 mb-4">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Select a committee</h1>
          <p className="text-slate-500 mt-1.5 text-sm">
            You have access to {memberships.length} committees
          </p>
        </div>
        <div className="space-y-2">
          {memberships.map(({ committee: c }: { committee: { id: string; name: string; slug: string; seecId: string | null; city: string | null; electionYear: number | null } }) => (
            <Link
              key={c.id}
              href={`/app/${c.slug}/donations`}
              className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-colors group"
            >
              <div>
                <p className="font-medium text-slate-900 text-sm">{c.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {[c.city, c.seecId, c.electionYear].filter(Boolean).join(' · ')}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
            </Link>
          ))}
          <Link
            href="/app/create-committee"
            className="flex items-center justify-center gap-2 p-4 bg-white border border-dashed border-slate-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 text-sm text-slate-500 hover:text-blue-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create another committee
          </Link>
        </div>
      </div>
    </div>
  )
}
