import Link from 'next/link'
import { Scale } from 'lucide-react'

export const metadata = {
  title: 'Privacy Policy · CT Committee Treasurer Suite',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPage() {
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
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-slate-400 mb-10">Effective date: July 12, 2026</p>

        <div className="prose prose-slate max-w-none text-sm leading-7 space-y-8">

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">1. What We Collect</h2>
            <p className="text-slate-600">We collect the following categories of information:</p>
            <ul className="list-disc pl-5 text-slate-600 space-y-1 mt-2">
              <li><strong>Account information</strong> — your name and email address when you sign up</li>
              <li><strong>Committee data</strong> — the donations, expenditures, and committee details you enter into the Service</li>
              <li><strong>Donor and roster details</strong> — contact information (and, for donors, employer and occupation as required by SEEC) of contributors and committee roster members, entered by your committee; these individuals may not themselves be users of the Service</li>
              <li><strong>Bank data</strong> — transaction data fetched via Plaid when you connect a bank account</li>
              <li><strong>Billing information</strong> — subscription payments are processed by Stripe; we store your subscription status but never your card number</li>
              <li><strong>Usage data</strong> — pages visited, actions taken, and errors encountered, used to improve the Service</li>
              <li><strong>Cookies</strong> — session cookies required to keep you signed in</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">2. How We Use Your Data</h2>
            <p className="text-slate-600">We use your data to:</p>
            <ul className="list-disc pl-5 text-slate-600 space-y-1 mt-2">
              <li>Provide and operate the Service</li>
              <li>Generate SEEC Form 20 and Form 30 reports and other exports you request</li>
              <li>Send transactional emails (account invites, password resets)</li>
              <li>Send newsletters to your committee&apos;s roster members, only at your committee&apos;s direction and through your committee&apos;s own email account</li>
              <li>Diagnose errors and improve reliability</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p className="text-slate-600 mt-3">We do not sell your data, use it for advertising, or share it with third parties except as described in Section 3.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">3. Third-Party Services</h2>
            <p className="text-slate-600">We use the following sub-processors to operate the Service:</p>
            <ul className="list-disc pl-5 text-slate-600 space-y-1 mt-2">
              <li><strong>Vercel</strong> — application hosting</li>
              <li><strong>Supabase</strong> — authentication and database hosting</li>
              <li><strong>Stripe</strong> — subscription billing and payment processing</li>
              <li><strong>Plaid</strong> — bank account connectivity (only if you connect a bank account); Plaid&apos;s handling of your data is described in{' '}
                <a href="https://plaid.com/legal/#end-user-privacy-policy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Plaid&apos;s End User Privacy Policy</a></li>
              <li><strong>Anedot</strong> — donation import (only if you use the Anedot integration)</li>
              <li><strong>Google (Gmail)</strong> — newsletter delivery through your committee&apos;s own Gmail account (only if you connect one)</li>
            </ul>
            <p className="text-slate-600 mt-3">Each sub-processor is subject to data processing agreements and their own privacy policies.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">4. Data Retention</h2>
            <p className="text-slate-600">
              We retain your data for as long as your account is active. If you delete your account, your data is permanently deleted within 30 days. Bank access tokens are deleted immediately when you remove a bank account.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">5. Security</h2>
            <p className="text-slate-600">
              All data is transmitted over HTTPS. Database access is controlled by row-level security policies. Bank access tokens (Plaid) and connected email credentials are stored encrypted and never exposed in the UI. Optional two-factor authentication (authenticator app) is available on every account. We conduct periodic security reviews.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">6. Your Rights</h2>
            <p className="text-slate-600">You may at any time:</p>
            <ul className="list-disc pl-5 text-slate-600 space-y-1 mt-2">
              <li>Export your committee data from the Settings page</li>
              <li>Request a copy of all personal data we hold about you</li>
              <li>Request deletion of your account and all associated data</li>
              <li>Correct inaccurate account information in Settings</li>
            </ul>
            <p className="text-slate-600 mt-3">To exercise any of these rights, email <a href="mailto:support@cttreasurer.com" className="text-blue-600 hover:underline">support@cttreasurer.com</a>.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">7. Connecticut Residents</h2>
            <p className="text-slate-600">
              Connecticut residents may have additional rights under the Connecticut Data Privacy Act (CTDPA), including the right to opt out of certain data processing. We do not engage in the sale of personal data or targeted advertising as defined by the CTDPA.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">8. Children</h2>
            <p className="text-slate-600">
              The Service is not directed at children under 13. We do not knowingly collect personal information from children.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">9. Changes to This Policy</h2>
            <p className="text-slate-600">
              We may update this Privacy Policy from time to time. We will notify you by email before material changes take effect. The current effective date is always shown at the top of this page.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">10. Contact</h2>
            <p className="text-slate-600">
              Questions about this policy? Email us at <a href="mailto:support@cttreasurer.com" className="text-blue-600 hover:underline">support@cttreasurer.com</a>.
            </p>
          </section>

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
