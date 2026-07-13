import Link from 'next/link'
import { Scale } from 'lucide-react'

export const metadata = {
  title: 'Terms of Service · CT Committee Treasurer Suite',
  alternates: { canonical: '/terms' },
}

export default function TermsPage() {
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
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-slate-400 mb-10">Effective date: June 28, 2026</p>

        <div className="prose prose-slate max-w-none text-sm leading-7 space-y-8">

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">1. Acceptance</h2>
            <p className="text-slate-600">
              By creating an account or using CT Committee Treasurer Suite (&quot;the Service&quot;), you agree to these Terms of Service. If you do not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">2. Description of Service</h2>
            <p className="text-slate-600">
              CT Committee Treasurer Suite is a software-as-a-service application that helps Connecticut political committees track donations and expenditures, generate SEEC Form 20 reports, and manage campaign finance compliance. We are not a law firm and do not provide legal advice. You are responsible for ensuring your filings comply with Connecticut General Statutes and SEEC regulations.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">3. Accounts</h2>
            <p className="text-slate-600">
              You must provide accurate information when creating an account. You are responsible for maintaining the confidentiality of your credentials and for all activity that occurs under your account. You must notify us immediately of any unauthorized access.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">4. Acceptable Use</h2>
            <p className="text-slate-600">You agree not to:</p>
            <ul className="list-disc pl-5 text-slate-600 space-y-1 mt-2">
              <li>Use the Service for any purpose that violates applicable law</li>
              <li>Attempt to gain unauthorized access to any part of the Service</li>
              <li>Interfere with or disrupt the integrity or performance of the Service</li>
              <li>Reverse engineer or attempt to extract the source code</li>
              <li>Use the Service on behalf of a committee you are not authorized to represent</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">5. Fees and Payment</h2>
            <p className="text-slate-600">
              Paid plans are billed monthly. You may cancel at any time; cancellation takes effect at the end of the current billing period. We reserve the right to change pricing with 30 days&apos; notice. We do not issue refunds for partial billing periods.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">6. Data and Privacy</h2>
            <p className="text-slate-600">
              Your use of the Service is also governed by our <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>. You retain ownership of all data you enter into the Service. We do not sell your data to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">7. Disclaimer of Warranties</h2>
            <p className="text-slate-600">
              The Service is provided &quot;as is&quot; without warranties of any kind, express or implied. We do not warrant that the Service will be uninterrupted, error-free, or that the data you generate will satisfy SEEC or any other regulatory requirements. You are solely responsible for reviewing all filings before submission.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">8. Limitation of Liability</h2>
            <p className="text-slate-600">
              To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service, including but not limited to penalties assessed by SEEC or other regulatory bodies.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">9. Termination</h2>
            <p className="text-slate-600">
              We may suspend or terminate your account if you violate these Terms or if your account is past due. You may delete your account at any time. Upon termination, your data will be retained for 30 days and then permanently deleted.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">10. Governing Law</h2>
            <p className="text-slate-600">
              These Terms are governed by the laws of the State of Connecticut, without regard to its conflict-of-law provisions. Any disputes shall be resolved in the state or federal courts located in Connecticut.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">11. Changes to These Terms</h2>
            <p className="text-slate-600">
              We may update these Terms from time to time. We will notify you by email or in-app notice before material changes take effect. Continued use of the Service after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">12. Contact</h2>
            <p className="text-slate-600">
              Questions about these Terms? Email us at <a href="mailto:support@cttreasurer.com" className="text-blue-600 hover:underline">support@cttreasurer.com</a>.
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
