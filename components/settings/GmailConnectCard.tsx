'use client'

import { useState } from 'react'
import { Mail, CheckCircle2, Loader2, ExternalLink } from 'lucide-react'
import { connectGmailAccount, disconnectGmailAccount, type GmailConnection } from '@/actions/newsletter'

interface Props {
  committeeSlug: string
  initialConnection: GmailConnection
}

export default function GmailConnectCard({ committeeSlug, initialConnection }: Props) {
  const [connection, setConnection] = useState(initialConnection)
  const [email, setEmail] = useState('')
  const [appPassword, setAppPassword] = useState('')
  const [loading, setLoading] = useState<'connect' | 'disconnect' | null>(null)
  const [error, setError] = useState('')
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    setLoading('connect')
    setError('')
    try {
      const result = await connectGmailAccount(committeeSlug, email.trim(), appPassword)
      setConnection({ email: result.email, connectedAt: new Date().toISOString() })
      setEmail('')
      setAppPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect Gmail account')
    } finally {
      setLoading(null)
    }
  }

  async function handleDisconnect() {
    setLoading('disconnect')
    setError('')
    try {
      await disconnectGmailAccount(committeeSlug)
      setConnection({ email: null, connectedAt: null })
      setShowDisconnectConfirm(false)
    } catch {
      setError('Failed to disconnect. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  const connectedDate = connection.connectedAt
    ? new Date(connection.connectedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
          <Mail className="w-4.5 h-4.5 text-blue-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Newsletter email</h3>
          <p className="text-xs text-slate-500">Connect a Gmail account to send roster newsletters</p>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {connection.email ? (
        <>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1 text-emerald-700 bg-emerald-50 ring-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Connected
          </span>
          <p className="text-sm text-slate-700 mt-3">{connection.email}</p>
          {connectedDate && <p className="text-xs text-slate-400 mt-0.5">Connected {connectedDate}</p>}

          <button
            onClick={() => setShowDisconnectConfirm(true)}
            disabled={!!loading}
            className="mt-4 px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            Disconnect
          </button>
        </>
      ) : (
        <form onSubmit={handleConnect} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Gmail address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="treasurer@gmail.com"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">App password</label>
            <input
              type="password"
              required
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              placeholder="16-character app password"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <a
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1.5"
            >
              Use a Gmail App Password, not your regular password — generate one here
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <button
            type="submit"
            disabled={!!loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading === 'connect' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Connect
          </button>
        </form>
      )}

      {showDisconnectConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-slate-900">Disconnect Gmail?</h2>
            <p className="text-sm text-slate-500 mt-1.5">
              You won&apos;t be able to send roster newsletters until you reconnect a Gmail account.
            </p>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowDisconnectConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnect}
                disabled={loading === 'disconnect'}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {loading === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
