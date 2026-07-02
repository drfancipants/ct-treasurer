import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Scale,
  FileText,
  DollarSign,
  Building2,
  Users,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

// ─── Price — update this one value to change all pricing mentions ─────────────
const MONTHLY_PRICE = 9.99

export default async function LandingPage() {
  // Redirect logged-in users straight to the app
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/app')

  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <Hero />
      <Features />
      <HowItWorks />
      <Pricing />
      <Footer />
    </div>
  )
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <Scale className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-slate-900">CT Committee Treasurer Suite</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="#pricing" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
            Pricing
          </Link>
          <Link href="/login" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="bg-navy-900 text-white">
      <div className="max-w-6xl mx-auto px-6 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-medium mb-6">
          <ShieldCheck className="w-3.5 h-3.5" />
          Built for Connecticut SEEC compliance
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-5 leading-tight">
          Campaign finance compliance,<br className="hidden sm:block" /> simplified
        </h1>
        <p className="text-lg text-slate-300 max-w-2xl mx-auto mb-8">
          The treasurer suite built for Connecticut political committees. Track donations, record expenses,
          sync your bank, and generate SEEC Form 20 reports — all in one place.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-400 transition-colors"
          >
            Start free trial
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
          >
            Sign in to your account
          </Link>
        </div>
        <p className="mt-4 text-sm text-slate-400">14-day free trial · No credit card required</p>
      </div>
    </section>
  )
}

// ─── Features ─────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: FileText,
    title: 'SEEC Form 20 export',
    description:
      'Generate the official eCRIS upload template pre-filled with your contributions and expenses. Download and upload directly to seec.ct.gov.',
  },
  {
    icon: DollarSign,
    title: 'Donation tracking',
    description:
      'Record cash and check donations manually or import directly from Anedot. SEEC compliance status is flagged automatically for contributions ≥ $50.',
  },
  {
    icon: Building2,
    title: 'Bank account sync',
    description:
      'Connect your committee checking account via Plaid. Transactions import automatically and can be matched to your contributions and expenses.',
  },
  {
    icon: Users,
    title: 'Multi-user access',
    description:
      'Invite your treasurer, assistant treasurer, chairperson, or secretary. Role-based access keeps sensitive actions locked to authorized members.',
  },
]

function Features() {
  return (
    <section className="py-20 bg-slate-50" id="features">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900 mb-3">Everything your committee needs</h2>
          <p className="text-slate-500 max-w-xl mx-auto">
            Purpose-built for Connecticut SEEC requirements — not a generic finance tool adapted for campaigns.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {FEATURES.map((f) => {
            const Icon = f.icon
            return (
              <div key={f.title} className="bg-white border border-slate-200 rounded-2xl p-6">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─── How it works ─────────────────────────────────────────────────────────────

const STEPS = [
  { n: '1', title: 'Create your committee', body: 'Sign up and set up your committee in minutes. Add your SEEC registration ID and election year from the Settings page.' },
  { n: '2', title: 'Record your activity', body: 'Enter donations and expenses as they happen, or import from Anedot and sync your bank account via Plaid.' },
  { n: '3', title: 'File with confidence', body: 'Generate a pre-filled SEEC Form 20 for any filing period and upload it directly to eCRIS at seec.ct.gov.' },
]

function HowItWorks() {
  return (
    <section className="py-20" id="how-it-works">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900 mb-3">How it works</h2>
          <p className="text-slate-500">From setup to your first filing in under an hour.</p>
        </div>
        <div className="space-y-6">
          {STEPS.map((s) => (
            <div key={s.n} className="flex gap-5">
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center shrink-0 mt-0.5">
                {s.n}
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900 mb-1">{s.title}</h3>
                <p className="text-sm text-slate-500">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

const PLAN_FEATURES = [
  'Unlimited donations & expenses',
  'SEEC Form 20 export (eCRIS template)',
  'Anedot CSV import',
  'Plaid bank account sync',
  'Up to 10 committee members',
  'Multi-committee support',
  'Filing period tracker',
  'Email support',
]

function Pricing() {
  return (
    <section className="py-20 bg-slate-50" id="pricing">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900 mb-3">Simple, transparent pricing</h2>
          <p className="text-slate-500">One plan, everything included. No per-seat fees.</p>
        </div>
        <div className="max-w-sm mx-auto">
          <div className="bg-navy-900 text-white rounded-2xl p-8">
            <p className="text-sm font-medium text-blue-300 mb-2">Pro</p>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-bold">${MONTHLY_PRICE}</span>
              <span className="text-slate-400 text-sm mb-1">/month per committee</span>
            </div>
            <p className="text-sm text-slate-400 mb-6">Billed monthly · Cancel anytime</p>

            <ul className="space-y-3 mb-8">
              {PLAN_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>

            <Link
              href="/signup"
              className="block w-full text-center py-3 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-400 transition-colors"
            >
              Start 14-day free trial
            </Link>
            <p className="text-center text-xs text-slate-500 mt-3">No credit card required to start</p>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-slate-200 py-10">
      <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center">
            <Scale className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm text-slate-500">CT Committee Treasurer Suite</span>
        </div>
        <div className="flex items-center gap-6 text-sm text-slate-400">
          <Link href="#features" className="hover:text-slate-600 transition-colors">Features</Link>
          <Link href="#pricing" className="hover:text-slate-600 transition-colors">Pricing</Link>
          <Link href="/login" className="hover:text-slate-600 transition-colors">Sign in</Link>
          <Link href="/terms" className="hover:text-slate-600 transition-colors">Terms</Link>
          <Link href="/privacy" className="hover:text-slate-600 transition-colors">Privacy</Link>
          <a href="https://seec.ct.gov" target="_blank" rel="noopener noreferrer" className="hover:text-slate-600 transition-colors">
            SEEC ↗
          </a>
        </div>
      </div>
    </footer>
  )
}
