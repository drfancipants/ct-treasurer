import { Lock, ArrowRight } from 'lucide-react'

export default function ChangePasswordCard() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Lock className="w-4.5 h-4.5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">Password</p>
            <p className="text-xs text-slate-500 mt-0.5">Change the password for your login</p>
          </div>
        </div>
        <a
          href="/reset-password"
          className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Change password
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  )
}
