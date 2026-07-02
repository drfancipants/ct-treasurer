import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Scale, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import CreateCommitteeForm from '@/components/create-committee/CreateCommitteeForm'

export default async function CreateCommitteePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 mb-4">
            <Scale className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Create a committee</h1>
          <p className="text-slate-500 mt-1.5 text-sm">
            You&apos;ll be set as treasurer and can invite others from the Members page.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <CreateCommitteeForm />
        </div>

        <div className="mt-4 text-center">
          <Link
            href="/app"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to committees
          </Link>
        </div>
      </div>
    </div>
  )
}
