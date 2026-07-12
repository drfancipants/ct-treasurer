import Link from 'next/link'
import { Scale } from 'lucide-react'

export default function GuidesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <Scale className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-900">CT Committee Treasurer Suite</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/guides" className="text-slate-500 hover:text-slate-900 transition-colors">Guides</Link>
            <Link
              href="/signup"
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
            >
              Start free trial
            </Link>
          </div>
        </div>
      </header>

      {children}

      <footer className="border-t border-slate-200 py-10 mt-10">
        <div className="max-w-3xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center">
                <Scale className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm text-slate-500">CT Committee Treasurer Suite</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-400">
              <Link href="/" className="hover:text-slate-600 transition-colors">Home</Link>
              <Link href="/guides" className="hover:text-slate-600 transition-colors">Guides</Link>
              <Link href="/terms" className="hover:text-slate-600 transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-slate-600 transition-colors">Privacy</Link>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-6 text-center sm:text-left leading-relaxed">
            CT Committee Treasurer Suite is an independent product and is not affiliated with, endorsed by, or
            connected to the State of Connecticut, the Office of the State Treasurer, or the State Elections
            Enforcement Commission (SEEC). These guides are general information, not legal advice — consult the
            official rules at{' '}
            <a href="https://seec.ct.gov" target="_blank" rel="noopener noreferrer" className="hover:text-slate-600 transition-colors">seec.ct.gov</a>{' '}
            or an attorney for your committee’s specific obligations.
          </p>
        </div>
      </footer>
    </div>
  )
}
