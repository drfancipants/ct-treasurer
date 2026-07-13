import Link from 'next/link'
import { ArrowRight, ArrowLeft } from 'lucide-react'
import { getGuide } from '@/lib/guides'
import { Section, Row } from '@/components/marketing/GuideParts'

const guide = getGuide('how-to-file-seec-form-30')!

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

export default function Form30Guide() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Link href="/guides" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" />
        All guides
      </Link>

      <article className="prose prose-slate max-w-none">
        <h1 className="text-3xl font-bold text-slate-900 mb-4 leading-tight">
          How to File SEEC Form 30: A Guide for Candidate Committees
        </h1>
        <p className="text-lg text-slate-600 leading-relaxed mb-8">
          SEEC Form 30 is the campaign-finance statement filed by Connecticut candidate committees for
          statewide and General Assembly offices. It covers the same ground as{' '}
          <Link href="/guides/how-to-file-seec-form-20">Form 20</Link> — contributions in, expenditures out —
          but with rules built around a candidate’s campaign: separate primary and general-election phases,
          per-office contribution limits, and the Citizens’ Election Program. This guide covers what’s
          different and how to file.
        </p>

        <Section title="Form 30 vs. Form 20 — which do you file?">
          <p>
            The form follows the office. Candidates for <strong>statewide office</strong> (governor, attorney
            general, and the other constitutional offices) and the <strong>General Assembly</strong> (state
            Senate and House) file <strong>Form 30</strong>. Candidates for municipal and probate offices —
            and party/town committees — file <strong>Form 20</strong> instead.
          </p>
          <p>
            Form 30 also has a slightly different layout: its Section B for itemized contributions includes an
            extra <strong>Contribution ID</strong> column, and its sections use different letters than Form
            20 (below). If you register with SEEC as a candidate committee for a covered office, Form 30 is
            what eCRIS expects.
          </p>
        </Section>

        <Section title="Primary and general election are separate phases">
          <p>
            The biggest difference from a town committee is that a candidate’s contribution limits apply{' '}
            <strong>separately to each phase</strong> of the campaign. A donor can give up to the applicable
            limit for the <strong>primary</strong> and again, separately, for the <strong>general
            election</strong>. Money has to be attributed to the correct phase, and if your campaign has a
            primary, the two buckets are tracked independently rather than as one calendar-year total.
          </p>
          <p>
            The per-donor limit itself depends on the office sought. Confirm the current figures for your
            office on <a href="https://seec.ct.gov" target="_blank" rel="noopener noreferrer">seec.ct.gov</a>,
            and track each donor’s giving against the right phase so no one goes over.
          </p>
        </Section>

        <Section title="The Citizens’ Election Program (CEP)">
          <p>
            Connecticut’s <strong>Citizens’ Election Program</strong> offers public grants to participating
            candidates who agree to strict rules in exchange. If your campaign participates, the compliance
            picture changes significantly:
          </p>
          <ul>
            <li>Contributions are capped at a <strong>per-cycle limit</strong> rather than the standard office limits.</li>
            <li>Money from <strong>other committees, PACs, and state contractors</strong> is generally prohibited.</li>
            <li>You must raise a qualifying amount in small contributions to receive a grant.</li>
          </ul>
          <p>
            Whether or not you join the CEP is one of the first decisions a candidate committee makes, and it
            determines which limit rules apply for the whole cycle.
          </p>
        </Section>

        <Section title="The $50 itemization rule still applies">
          <p>
            Like Form 20, Form 30 requires full itemization for any contributor whose giving reaches{' '}
            <strong>$50 or more</strong>: full name, residential address, and — the field most often left
            blank — <strong>employer and occupation</strong>. Track each donor cumulatively, since several
            smaller gifts can cross the $50 threshold.
          </p>
        </Section>

        <Section title="Form 30 sections">
          <p>Form 30 organizes activity into these sections:</p>
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
                <Row s="B" d="Itemized individual contributions — name, address, employer, occupation, amount, method, and a Contribution ID" />
                <Row s="C1" d="Contributions received from other committees" />
                <Row s="J1" d="Fundraising events, with SEEC’s event questions and receipts" />
                <Row s="K" d="In-kind contributions — donated goods or services, at fair market value" />
                <Row s="N" d="Expenditures, each tagged with a SEEC purpose code" />
                <Row s="R" d="Reimbursements to workers or consultants for out-of-pocket spending" />
              </tbody>
            </table>
          </div>
          <p className="text-sm text-slate-500">
            (For comparison, Form 20 uses A/B/C1/L1/M/P/T for the same categories — the letters differ, so use
            the template that matches your form.)
          </p>
        </Section>

        <Section title="Deadlines and statutory statements">
          <p>
            Candidate committees file on the regular schedule, plus additional statutory statements tied to
            the election calendar — including a <strong>“7th day preceding”</strong> statement before a
            primary and before the general election, so voters can see late money. If your campaign faces a
            primary, expect a pre-primary statement on top of the pre-election one.
          </p>
          <p>
            Deadlines are firm and carry penalties, so confirm your committee’s exact dates on{' '}
            <a href="https://seec.ct.gov" target="_blank" rel="noopener noreferrer">seec.ct.gov</a> and file
            early.
          </p>
        </Section>

        <Section title="How to file, step by step">
          <ol>
            <li><strong>Attribute each contribution to a phase</strong> (primary or general) and track donors against the right per-phase limit.</li>
            <li><strong>Gather full details</strong> for every $50+ donor — including employer and occupation.</li>
            <li><strong>Complete the eCRIS Form 30 template</strong>, placing each transaction in the correct section (A/B/C1/J1/K/N/R) with SEEC method and purpose codes.</li>
            <li><strong>Reconcile</strong> your ending balance to the campaign bank account.</li>
            <li><strong>Upload</strong> the completed file at <a href="https://seec.ct.gov" target="_blank" rel="noopener noreferrer">seec.ct.gov</a> → eCRIS → Upload Report before the deadline.</li>
          </ol>
        </Section>

        <Section title="Let the software handle the phase and limit tracking">
          <p>
            The per-phase limits, CEP rules, and office-based caps are exactly where candidate filings get
            complicated by hand. CT Committee Treasurer Suite applies the right limit rules for your office
            and phase automatically, flags over-limit and missing-detail contributions before you file, and
            generates the completed eCRIS <strong>Form 30</strong> template — including the statutory
            pre-primary and pre-election statements. See the{' '}
            <Link href="/quickstart">quickstart guide</Link> to set up a candidate committee, or the{' '}
            <Link href="/guides/how-to-file-seec-form-20">Form 20 guide</Link> if you file that instead.
          </p>
        </Section>
      </article>

      <div className="mt-12 bg-navy-900 text-white rounded-2xl p-8 text-center">
        <h2 className="text-lg font-semibold mb-2">Run your campaign’s books without the spreadsheet</h2>
        <p className="text-sm text-slate-300 max-w-md mx-auto mb-6">
          Per-phase limits, CEP support, and one-click Form 30 export for any filing period. 14-day free
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
