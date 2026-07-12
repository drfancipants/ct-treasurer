import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import MfaSettings from '@/components/settings/MfaSettings'

export const metadata = {
  title: 'Account security · CT Committee Treasurer Suite',
}

export default async function SecurityPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-lg mx-auto pt-10">
        <Link
          href="/app"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to your committees
        </Link>
        <h1 className="text-xl font-semibold text-slate-900 mb-1">Account security</h1>
        <p className="text-sm text-slate-500 mb-6">
          Signed in as <strong>{user.email}</strong>. These settings apply to your account across all
          committees.
        </p>
        <MfaSettings />
      </div>
    </div>
  )
}
