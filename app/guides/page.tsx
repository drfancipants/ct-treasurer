import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { GUIDES } from '@/lib/guides'

export const metadata = {
  title: 'Guides for Connecticut Committee Treasurers',
  description:
    'Practical guides to Connecticut campaign finance for committee treasurers — SEEC filings, Form 20 and Form 30, contribution limits, and eCRIS deadlines.',
  alternates: { canonical: '/guides' },
}

export default function GuidesIndexPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-14">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Treasurer guides</h1>
      <p className="text-slate-500 mb-10">
        Plain-English guides to Connecticut campaign-finance compliance — written for the volunteers who
        keep their committee’s books and file with SEEC.
      </p>

      <div className="space-y-4">
        {GUIDES.map((g) => (
          <Link
            key={g.slug}
            href={`/guides/${g.slug}`}
            className="block bg-white border border-slate-200 rounded-2xl p-6 hover:border-blue-300 hover:bg-blue-50/40 transition-colors group"
          >
            <h2 className="text-base font-semibold text-slate-900 mb-1.5 group-hover:text-blue-700">{g.title}</h2>
            <p className="text-sm text-slate-500 leading-relaxed">{g.blurb}</p>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 mt-3">
              Read guide <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-12 bg-navy-900 text-white rounded-2xl p-8 text-center">
        <h2 className="text-lg font-semibold mb-2">Stop filing by hand</h2>
        <p className="text-sm text-slate-300 max-w-md mx-auto mb-6">
          Track your donations and expenses, and the app generates your ready-to-upload SEEC filing. 14-day
          free trial, no credit card required.
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-400 transition-colors"
        >
          Start your free trial
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </main>
  )
}
