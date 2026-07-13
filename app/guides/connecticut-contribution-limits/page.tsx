import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getGuide } from '@/lib/guides'
import { Section, GuideCta } from '@/components/marketing/GuideParts'

const guide = getGuide('connecticut-contribution-limits')!

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

export default function ContributionLimitsGuide() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Link href="/guides" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" />
        All guides
      </Link>

      <article className="prose prose-slate max-w-none">
        <h1 className="text-3xl font-bold text-slate-900 mb-4 leading-tight">
          Connecticut Campaign Contribution Limits, Explained
        </h1>
        <p className="text-lg text-slate-600 leading-relaxed mb-8">
          Contribution limits are where committee treasurers most often get tripped up — partly because the
          rules are genuinely different depending on what kind of committee you run. This guide breaks down
          how limits work for Connecticut town committees and candidate campaigns, the cash cap everyone
          forgets, and what changes if a candidate joins the Citizens’ Election Program.
        </p>

        <Section title="Limits depend on your committee type">
          <p>
            There isn’t one Connecticut contribution limit — there are a few sets of rules, and which applies
            depends on whether you’re a <strong>party (town) committee</strong> or a{' '}
            <strong>candidate committee</strong>, and whether that candidate participates in public financing.
            Getting the category right is the first step; the specific dollar amounts follow from it.
          </p>
        </Section>

        <Section title="Town (party) committees: a calendar-year limit">
          <p>
            Party committees — including Democratic and Republican town committees — track each donor’s giving
            against a <strong>per-donor, per-calendar-year</strong> limit (on the order of $2,000 per
            individual per year; confirm the current figure on{' '}
            <a href="https://seec.ct.gov" target="_blank" rel="noopener noreferrer">seec.ct.gov</a>). The clock
            resets each January 1, and it’s the donor’s <em>cumulative</em> total across the year that counts —
            not any single gift.
          </p>
        </Section>

        <Section title="Candidate committees: limits apply per phase">
          <p>
            Candidate committees work differently. Limits are set by the <strong>office being sought</strong>,
            and they apply <strong>separately to the primary and the general election</strong>. A donor can
            give up to the limit for the primary and, separately, up to the limit again for the general — so
            you have to attribute each contribution to the correct phase and track donors against the right
            bucket. This is covered in more depth in the{' '}
            <Link href="/guides/how-to-file-seec-form-30">Form 30 guide</Link>.
          </p>
        </Section>

        <Section title="The $100 cash cap everyone forgets">
          <p>
            Regardless of committee type, there’s a separate limit on <strong>cash</strong>: a single cash
            contribution is capped at <strong>$100</strong> (per CGS § 9-611). Anything above that has to come
            by check or another traceable method. It’s an easy rule to miss when someone hands you $200 at an
            event — split it, decline the excess, or take it another way.
          </p>
        </Section>

        <Section title="The Citizens’ Election Program changes the rules">
          <p>
            If a candidate committee participates in Connecticut’s <strong>Citizens’ Election Program (CEP)</strong>,
            the public-financing program, the limit framework changes entirely:
          </p>
          <ul>
            <li>Contributions are capped at a <strong>per-cycle limit</strong> instead of the standard office limits.</li>
            <li>Money from <strong>other committees, PACs, and state contractors</strong> is generally off-limits.</li>
            <li>You must raise a set amount in qualifying small contributions to receive a grant.</li>
          </ul>
          <p>Participation is a per-cycle choice, and it governs which rules you follow all the way through.</p>
        </Section>

        <Section title="Limits vs. the $50 itemization threshold">
          <p>
            Don’t confuse the two numbers treasurers deal with. The <strong>contribution limit</strong> is the
            most a donor may give; the <strong>$50 itemization threshold</strong> is the point at which you
            must report a donor’s full details (name, address, employer, occupation) on your filing. A donor
            can be well under the limit but still need full itemization once they cross $50.
          </p>
        </Section>

        <Section title="How to stay under the limits without a spreadsheet">
          <p>
            The hard part is tracking each donor’s <em>running total</em> — especially when the same person
            gives several times, or gives under slightly different names. CT Committee Treasurer Suite groups a
            donor’s contributions (even across duplicate records), applies the right limit rule for your
            committee type and phase, and warns you the moment a contribution would put someone over — before
            you accept it or file. See the <Link href="/quickstart">quickstart guide</Link> to get set up.
          </p>
        </Section>
      </article>

      <GuideCta
        heading="Catch over-limit contributions before they’re a problem"
        body="Automatic per-donor limit tracking for town committees and candidate campaigns, CEP included. 14-day free trial, no credit card required."
      />
    </main>
  )
}
