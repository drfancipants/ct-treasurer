import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getGuide } from '@/lib/guides'
import { Section, GuideCta } from '@/components/marketing/GuideParts'

const guide = getGuide('seec-filing-deadlines')!

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

export default function FilingDeadlinesGuide() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Link href="/guides" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" />
        All guides
      </Link>

      <article className="prose prose-slate max-w-none">
        <h1 className="text-3xl font-bold text-slate-900 mb-4 leading-tight">
          SEEC Filing Deadlines: The Connecticut Committee Calendar
        </h1>
        <p className="text-lg text-slate-600 leading-relaxed mb-8">
          Missing a SEEC filing deadline can mean civil penalties, and the schedule has more moving parts in an
          election year than most new treasurers expect. Here’s how the Connecticut committee filing calendar
          works — the regular quarterly rhythm, the extra statements candidates owe near an election, and a
          routine for never getting caught out.
        </p>

        <Section title="The quarterly rhythm">
          <p>
            The backbone of the calendar is <strong>quarterly</strong>. Committees file statements covering
            four periods each year:
          </p>
          <ul>
            <li><strong>Q1</strong> — January through March</li>
            <li><strong>Q2</strong> — April through June</li>
            <li><strong>Q3</strong> — July through September</li>
            <li><strong>Q4</strong> — October through December</li>
          </ul>
          <p>
            Each statement is due on a set date shortly after its period closes. The exact due dates are fixed
            by statute — confirm the current year’s dates on{' '}
            <a href="https://seec.ct.gov" target="_blank" rel="noopener noreferrer">seec.ct.gov</a> — but the
            pattern is dependable enough to plan your year around.
          </p>
        </Section>

        <Section title="Election years add statutory statements">
          <p>
            In an election year, candidate committees owe extra statements on top of the quarterly ones. The
            key additions are the <strong>“7th day preceding” statements</strong> — one filed a week before a
            primary and another a week before the general election — so the public can see late money before
            they vote. If a campaign faces a primary, it files both; if not, just the pre-election statement.
          </p>
          <p>
            These are covered in more detail in the{' '}
            <Link href="/guides/how-to-file-seec-form-30">Form 30 guide</Link>. The practical point: an election
            year is not just four filings — map the whole cycle in advance.
          </p>
        </Section>

        <Section title="What “balance on hand” carries between filings">
          <p>
            Each statement reports a <strong>beginning and ending balance on hand</strong>. The first period’s
            beginning balance is set directly; after that, each period’s beginning balance carries forward from
            the previous period’s ending balance. That chaining is why filing periods can’t be treated as
            independent one-offs — an error in one flows into the next. Reconciling each period to the bank
            keeps the chain honest (see{' '}
            <Link href="/guides/reconciling-your-committee-bank-account">reconciling your bank account</Link>).
          </p>
        </Section>

        <Section title="How to never miss a deadline">
          <ol>
            <li><strong>Put every due date on a calendar</strong> at the start of the year, including election-year statements.</li>
            <li><strong>Record activity as it happens</strong>, not in a scramble the night before — reconstructing a quarter from memory is where mistakes and late filings come from.</li>
            <li><strong>File a few days early.</strong> eCRIS uploads can hit snags, and “I tried at 11:58 PM” is not a defense.</li>
            <li><strong>Keep balances reconciled</strong> so preparing a filing is a download, not an investigation.</li>
          </ol>
        </Section>

        <Section title="Let the app track the calendar for you">
          <p>
            CT Committee Treasurer Suite generates your committee’s filing calendar automatically — quarterly
            periods plus, for candidate committees, the statutory pre-primary and pre-election statements — and
            each period is one click from a ready-to-upload eCRIS filing. See the{' '}
            <Link href="/quickstart">quickstart guide</Link> to set it up.
          </p>
        </Section>
      </article>

      <GuideCta
        heading="See your whole filing calendar at a glance"
        body="Quarterly and statutory periods generated for your committee, each one a click from a ready-to-file SEEC export. 14-day free trial, no credit card required."
      />
    </main>
  )
}
