import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getGuide } from '@/lib/guides'
import { Section, GuideCta } from '@/components/marketing/GuideParts'

const guide = getGuide('reconciling-your-committee-bank-account')!

export const metadata = {
  title: guide.title,
  description: guide.description,
  alternates: { canonical: `/guides/${guide.slug}` },
  openGraph: { title: guide.title, description: guide.description, type: 'article', url: `/guides/${guide.slug}` },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: guide.title,
  description: guide.description,
  author: { '@type': 'Organization', name: 'CT Committee Treasurer Suite' },
  publisher: { '@type': 'Organization', name: 'CT Committee Treasurer Suite' },
}

export default function ReconcileGuide() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Link href="/guides" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" />
        All guides
      </Link>

      <article className="prose prose-slate max-w-none">
        <h1 className="text-3xl font-bold text-slate-900 mb-4 leading-tight">
          Reconciling Your Committee Bank Account with SEEC Filings
        </h1>
        <p className="text-lg text-slate-600 leading-relaxed mb-8">
          Every SEEC statement reports a balance on hand — and that number has to match your committee’s actual
          bank balance. Reconciling is the routine of making sure your records and your bank agree. Done a
          little at a time it’s trivial; left until filing night it’s where errors and stress come from. Here’s
          a simple approach.
        </p>

        <Section title="Why reconciliation matters">
          <p>
            Your filing’s <strong>ending balance on hand</strong> should equal what your committee bank account
            actually holds at the end of the period. If they don’t match, something is missing or miscoded — a
            contribution never recorded, an expense entered twice, a bank fee no one logged. A filing whose
            balance doesn’t reconcile is a red flag both to you and to SEEC, so catching the gap before you
            file is the whole point.
          </p>
        </Section>

        <Section title="What throws a committee’s books off">
          <ul>
            <li><strong>Unrecorded bank fees</strong> and, for online donations, <strong>processing fees</strong> deducted before the money lands.</li>
            <li><strong>Deposits recorded on a different date</strong> than the bank posted them.</li>
            <li><strong>Checks that haven’t cleared</strong> yet, so your records and the bank temporarily disagree.</li>
            <li><strong>Duplicate entries</strong> — the same donation recorded twice, or an expense counted from both a receipt and the bank line.</li>
            <li><strong>In-kind contributions</strong> counted as cash — they’re reported, but they never touch the bank account.</li>
          </ul>
        </Section>

        <Section title="A simple reconciliation routine">
          <ol>
            <li><strong>Pick a period</strong> — reconcile at least once per filing period, ideally monthly.</li>
            <li><strong>Compare your recorded balance to the bank</strong> statement’s closing balance.</li>
            <li><strong>Match line by line</strong> — every bank deposit should tie to a recorded contribution, every withdrawal to a recorded expense.</li>
            <li><strong>Investigate the difference</strong> — anything on the bank statement but not in your books (or vice versa) is what to fix.</li>
            <li><strong>Adjust and re-check</strong> until the two agree, then you’re ready to file.</li>
          </ol>
        </Section>

        <Section title="Make it nearly automatic with bank sync">
          <p>
            You can do all of this by hand against a paper statement, but it’s far faster to connect the
            account. CT Committee Treasurer Suite links your committee checking account through Plaid — the
            same secure connection standard used by Quickbooks and TurboTax — imports transactions
            automatically, and lets you match each one to the contribution or expense it belongs to. Your
            dashboard balance stays current, so when a filing period closes, reconciling is a quick review
            instead of an evening with a calculator.
          </p>
          <p>
            Keeping balances reconciled also keeps your{' '}
            <Link href="/guides/seec-filing-deadlines">filing periods</Link> honest, since each period’s
            beginning balance carries forward from the last.
          </p>
        </Section>
      </article>

      <GuideCta
        heading="Connect your bank and stop reconciling by hand"
        body="Automatic transaction import and matching against your contributions and expenses, so your SEEC balance always ties out. 14-day free trial, no credit card required."
      />
    </main>
  )
}
