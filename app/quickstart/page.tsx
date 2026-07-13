import Link from 'next/link'
import { Scale, CheckCircle2 } from 'lucide-react'

export const metadata = {
  title: 'Quickstart Tutorial · CT Committee Treasurer Suite',
  description:
    'Go from signup to your first SEEC filing: set up your committee, record donations and expenses, connect your bank, and export Form 20 or Form 30.',
  alternates: { canonical: '/quickstart' },
}

const STEPS = [
  {
    title: 'Create your account and committee',
    body: (
      <>
        <p>
          <Link href="/signup" className="text-blue-600 hover:underline">Sign up</Link>{' '}
          with your email, then create your committee. You&apos;ll choose the committee type up front:
        </p>
        <ul>
          <li>
            <strong>Town committee</strong> — a party committee. Contributions are limited per donor per
            calendar year.
          </li>
          <li>
            <strong>Candidate committee</strong>{' '}
            — a single candidate&apos;s campaign. You&apos;ll enter the
            office sought, district, primary and election dates, and whether the campaign participates in the
            Citizens&apos; Election Program (CEP). These drive your contribution limits and filing calendar.
          </li>
        </ul>
        <p>
          The committee type can&apos;t be changed later, so pick carefully. Your committee&apos;s address
          and contact details can be filled in anytime from the <strong>Settings</strong> page.
        </p>
      </>
    ),
  },
  {
    title: 'Invite your team',
    body: (
      <>
        <p>
          From the <strong>Members</strong> page, invite the rest of your committee by email. Roles control
          what each person can do:
        </p>
        <ul>
          <li>
            <strong>Treasurer</strong> and <strong>Assistant Treasurer</strong> can record and edit financial
            activity — donations, expenses, bank connections, and filings.
          </li>
          <li>
            All other roles (Chairperson, Secretary, and so on) have read-only access to financial records.
          </li>
        </ul>
        <p>
          Invitees receive an email link, set a password, and land directly in your committee. You can run
          the whole quickstart solo and invite people later.
        </p>
      </>
    ),
  },
  {
    title: 'Record your donations',
    body: (
      <>
        <p>Head to <strong>Donations</strong> and add your first contribution. Two ways to get data in:</p>
        <ul>
          <li>
            <strong>Manual entry</strong> — record cash, check, or card donations one at a time.
          </li>
          <li>
            <strong>Anedot import</strong> — upload the CSV export from your Anedot account. Duplicates are
            detected automatically, refunds are skipped, and each row is checked against your contribution
            limits before import.
          </li>
        </ul>
        <p>
          Connecticut requires itemized donor details — address, employer, and occupation — for any
          contribution of $50 or more. The suite flags each donation&apos;s compliance status automatically,
          and the dashboard shows a running compliance summary so nothing surprises you at filing time.
          Contribution limits (calendar-year for party committees, per-phase office-based limits and CEP caps
          for candidates) are checked as you enter each donation.
        </p>
      </>
    ),
  },
  {
    title: 'Record your expenses',
    body: (
      <>
        <p>
          On the <strong>Expenses</strong> page, record each expenditure with a category — printing, postage,
          signs, consulting, and so on. Categories map directly to official SEEC purpose codes, so your
          exported filings use the right codes without any manual lookup.
        </p>
      </>
    ),
  },
  {
    title: 'Connect your bank (optional)',
    body: (
      <>
        <p>
          From the <strong>Bank</strong>{' '}
          page, connect your committee checking account via Plaid.
          Transactions import automatically and stay in sync, and you can match deposits and withdrawals to
          the contributions and expenses you&apos;ve recorded — an easy ongoing reconciliation check that your
          books match the bank.
        </p>
      </>
    ),
  },
  {
    title: 'Generate your first filing',
    body: (
      <>
        <p>
          The <strong>Filings</strong>{' '}
          page shows your filing calendar: quarterly periods, plus — for
          candidate committees — the statutory &quot;7th day preceding&quot; pre-primary and pre-election
          statements.
        </p>
        <p>
          For any period, export a pre-filled eCRIS workbook: <strong>Form 20</strong> for town committees
          and municipal or probate campaigns, <strong>Form 30</strong> for statewide and General Assembly
          campaigns — the suite picks the right form for you. Review the preview totals, download the{' '}
          <code>.xls</code> file, and upload it at{' '}
          <a
            href="https://seec.ct.gov"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            seec.ct.gov
          </a>
          . Once it&apos;s submitted, mark the period as filed to keep your calendar current.
        </p>
      </>
    ),
  },
]

export default function QuickstartPage() {
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
          <Link href="/login" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
            Sign in
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-14">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Quickstart tutorial</h1>
        <p className="text-slate-500 mb-10">
          From a brand-new account to your first SEEC filing. Most treasurers finish setup in under an hour.
        </p>

        <div className="space-y-10">
          {STEPS.map((step, i) => (
            <section key={step.title} className="flex gap-5">
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-slate-900 mb-2">{step.title}</h2>
                <div className="text-sm text-slate-600 leading-7 space-y-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
                  {step.body}
                </div>
              </div>
            </section>
          ))}
        </div>

        <div className="mt-14 bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center">
          <CheckCircle2 className="w-8 h-8 text-blue-600 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-900 mb-2">That&apos;s the whole loop</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
            Record activity as it happens, keep an eye on the dashboard&apos;s compliance summary, and export
            a filing each period. Ready to try it?
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
          >
            Start your 14-day free trial
          </Link>
          <p className="text-xs text-slate-400 mt-3">No credit card required</p>
        </div>
      </main>

      <footer className="border-t border-slate-200 py-8 mt-10">
        <div className="max-w-3xl mx-auto px-6 flex gap-6 text-sm text-slate-400">
          <Link href="/" className="hover:text-slate-600 transition-colors">Home</Link>
          <Link href="/terms" className="hover:text-slate-600 transition-colors">Terms</Link>
          <Link href="/privacy" className="hover:text-slate-600 transition-colors">Privacy</Link>
        </div>
      </footer>
    </div>
  )
}
