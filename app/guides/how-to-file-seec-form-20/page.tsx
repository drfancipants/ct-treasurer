import Link from 'next/link'
import { ArrowRight, ArrowLeft } from 'lucide-react'
import { getGuide } from '@/lib/guides'
import { Section, Row } from '@/components/marketing/GuideParts'

const guide = getGuide('how-to-file-seec-form-20')!

export const metadata = {
  title: guide.title,
  description: guide.description,
  alternates: { canonical: `/guides/${guide.slug}` },
  openGraph: {
    title: guide.title,
    description: guide.description,
    type: 'article',
    url: `/guides/${guide.slug}`,
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: guide.title,
  description: guide.description,
  author: { '@type': 'Organization', name: 'CT Committee Treasurer Suite' },
  publisher: { '@type': 'Organization', name: 'CT Committee Treasurer Suite' },
}

export default function Form20Guide() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Link href="/guides" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" />
        All guides
      </Link>

      <article className="prose prose-slate max-w-none">
        <h1 className="text-3xl font-bold text-slate-900 mb-4 leading-tight">
          How to File SEEC Form 20: A Connecticut Treasurer’s Guide
        </h1>
        <p className="text-lg text-slate-600 leading-relaxed mb-8">
          If you’re the treasurer of a Connecticut town committee, SEEC Form 20 is the campaign-finance
          statement you file with the State Elections Enforcement Commission. This guide walks through what it
          is, who files it, what goes in each section, and how to upload it through eCRIS — plus the mistakes
          that most often get filings kicked back.
        </p>

        <Section title="What is SEEC Form 20?">
          <p>
            Form 20 is the <strong>Itemized Campaign Finance Disclosure Statement</strong> that Connecticut
            party committees — most commonly town committees — use to report their financial activity to SEEC.
            It lists the money the committee took in (contributions) and the money it spent (expenditures)
            during a filing period, in the itemized format SEEC requires.
          </p>
          <p>
            Filings are submitted electronically through <strong>eCRIS</strong> (the Electronic Campaign
            Reporting Information System) at{' '}
            <a href="https://seec.ct.gov" target="_blank" rel="noopener noreferrer">seec.ct.gov</a>. You upload
            a completed spreadsheet template rather than typing every transaction into a web form.
          </p>
        </Section>

        <Section title="Who has to file Form 20?">
          <p>
            <strong>Party committees</strong>, including Democratic and Republican town committees, file Form
            20. Some candidate committees do too — municipal and probate candidates generally use Form 20,
            while candidates for statewide office or the General Assembly file{' '}
            <Link href="/guides/how-to-file-seec-form-30">Form 30</Link> instead. If you’re unsure which form applies to your committee, SEEC’s
            registration materials specify it, and it follows from the office being sought.
          </p>
        </Section>

        <Section title="When is Form 20 due?">
          <p>
            Committees file on a <strong>quarterly</strong> schedule — statements covering January–March,
            April–June, July–September, and October–December, each due on a set date after the period closes.
            In an election year there are additional statements, including a{' '}
            <strong>“7th day preceding”</strong> pre-primary or pre-election statement so the public can see
            late money before they vote.
          </p>
          <p>
            Deadlines are firm and late filings can carry civil penalties, so confirm the exact due dates for
            your committee’s current cycle on{' '}
            <a href="https://seec.ct.gov" target="_blank" rel="noopener noreferrer">seec.ct.gov</a> and file a
            few days early rather than at the deadline.
          </p>
        </Section>

        <Section title="The $50 itemization rule">
          <p>
            The single most important compliance concept in Form 20 is the <strong>$50 threshold</strong>. For
            any contributor whose total giving in the cycle reaches <strong>$50 or more</strong>, you must
            itemize the contribution with the donor’s full details:
          </p>
          <ul>
            <li>Full name and residential address</li>
            <li><strong>Employer and occupation</strong> (the field most often left blank — and the most common reason a filing is incomplete)</li>
            <li>The date, amount, and payment method of each contribution</li>
          </ul>
          <p>
            Contributions <em>under</em> $50 from a donor don’t need individual itemization — they’re reported
            as an aggregate total. But it’s the running total that matters: several small gifts that add up to
            $50 or more cross the threshold, so track each donor cumulatively.
          </p>
        </Section>

        <Section title="What goes in each section">
          <p>Form 20 is organized into lettered sections. The ones a typical town committee uses:</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse my-4">
              <thead>
                <tr className="border-b border-slate-300 text-left">
                  <th className="py-2 pr-4 font-semibold text-slate-900">Section</th>
                  <th className="py-2 font-semibold text-slate-900">What it reports</th>
                </tr>
              </thead>
              <tbody className="text-slate-600">
                <Row s="A" d="Aggregate total of small (under $50) contributions that aren’t itemized individually" />
                <Row s="B" d="Itemized individual contributions — name, address, employer, occupation, amount, method" />
                <Row s="C1" d="Contributions received from other committees" />
                <Row s="M" d="In-kind contributions — donated goods or services, at fair market value" />
                <Row s="P" d="Expenditures, each tagged with a SEEC purpose code (printing, postage, etc.)" />
                <Row s="T" d="Reimbursements to workers or consultants for out-of-pocket spending" />
                <Row s="L1" d="Fundraising events, with SEEC’s event questions and receipts" />
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="How to file, step by step">
          <ol>
            <li><strong>Gather your records</strong> for the filing period — every contribution and every expense, with dates, amounts, and (for $50+ donors) employer and occupation.</li>
            <li><strong>Determine your beginning balance on hand</strong> — for the first period you set it directly; after that it carries from the prior period’s ending balance.</li>
            <li><strong>Complete the eCRIS Form 20 template</strong>, placing each transaction in the correct section and using SEEC’s method and purpose codes.</li>
            <li><strong>Reconcile</strong> — your ending balance should match your committee bank account.</li>
            <li><strong>Upload the completed file</strong> at <a href="https://seec.ct.gov" target="_blank" rel="noopener noreferrer">seec.ct.gov</a> → eCRIS → Upload Report, and submit before the deadline.</li>
          </ol>
        </Section>

        <Section title="Common mistakes to avoid">
          <ul>
            <li><strong>Missing employer/occupation</strong> on $50+ contributions — the top reason filings come back as incomplete.</li>
            <li><strong>Forgetting cumulative totals</strong> — a donor who gives $30 twice has crossed $50 and must be itemized.</li>
            <li><strong>Wrong purpose codes</strong> on expenses, or leaving them blank.</li>
            <li><strong>Balance that doesn’t reconcile</strong> to the bank statement.</li>
            <li><strong>Filing late</strong> — deadlines are strict and penalties are avoidable.</li>
          </ul>
        </Section>

        <Section title="Let the software do the itemization">
          <p>
            Doing this by hand in a spreadsheet is where errors creep in. CT Committee Treasurer Suite tracks
            each donation and expense as you go, flags any $50+ contribution that’s missing employer or
            occupation <em>before</em> you file, and generates the completed eCRIS Form 20 template for any
            period — you just download it and upload it to SEEC. See the{' '}
            <Link href="/quickstart">quickstart guide</Link> for the full setup, from creating your committee
            to your first filing.
          </p>
        </Section>
      </article>

      <div className="mt-12 bg-navy-900 text-white rounded-2xl p-8 text-center">
        <h2 className="text-lg font-semibold mb-2">Generate your Form 20 instead of building it</h2>
        <p className="text-sm text-slate-300 max-w-md mx-auto mb-6">
          Track donations and expenses, and export a ready-to-upload SEEC filing for any period. 14-day free
          trial, no credit card required.
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
