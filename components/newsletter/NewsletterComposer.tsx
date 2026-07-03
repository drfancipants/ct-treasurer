'use client'

import { useState } from 'react'
import { Search, ChevronDown, Loader2, Send, Mail, ImageIcon, Clock } from 'lucide-react'
import type { RosterMember } from '@/lib/types'
import type { GmailConnection, NewsletterHistoryItem } from '@/actions/newsletter'
import { sendNewsletter, sendTestNewsletter, previewNewsletterChart } from '@/actions/newsletter'
import { formatDistanceToNow, parseISO } from 'date-fns'
import ErrorBanner from '@/components/ui/ErrorBanner'

interface Props {
  rosterMembers: RosterMember[]
  gmailConnection: GmailConnection
  recentNewsletters: NewsletterHistoryItem[]
  committeeSlug: string
  committeeName: string
  canEdit: boolean
}

type Filter = 'all' | 'active' | 'inactive' | 'dues_unpaid'

const FILTERS: [Filter, string][] = [
  ['all', 'All'],
  ['active', 'Active'],
  ['inactive', 'Inactive'],
  ['dues_unpaid', 'Dues unpaid'],
]

export default function NewsletterComposer({
  rosterMembers,
  gmailConnection,
  recentNewsletters,
  committeeSlug,
  committeeName,
  canEdit,
}: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [includeChart, setIncludeChart] = useState(false)
  const [chartPreview, setChartPreview] = useState<string | null>(null)
  const [chartLoading, setChartLoading] = useState(false)

  const [sending, setSending] = useState(false)
  const [testSending, setTestSending] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [history, setHistory] = useState(recentNewsletters)

  const visible = rosterMembers.filter((r) => {
    if (filter === 'active' && !r.isActive) return false
    if (filter === 'inactive' && r.isActive) return false
    if (filter === 'dues_unpaid' && r.duesPaid) return false
    if (query) {
      const q = query.toLowerCase()
      const hay = `${r.firstName} ${r.lastName} ${r.email ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
  const visibleWithEmail = visible.filter((r) => r.email)
  const allVisibleSelected = visibleWithEmail.length > 0 && visibleWithEmail.every((r) => selected.has(r.id))

  function toggleMember(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        visibleWithEmail.forEach((r) => next.delete(r.id))
      } else {
        visibleWithEmail.forEach((r) => next.add(r.id))
      }
      return next
    })
  }

  async function handleChartToggle(checked: boolean) {
    setIncludeChart(checked)
    if (checked && !chartPreview) {
      setChartLoading(true)
      try {
        const preview = await previewNewsletterChart(committeeSlug)
        setChartPreview(preview)
      } catch {
        setError('Failed to render chart preview')
        setIncludeChart(false)
      } finally {
        setChartLoading(false)
      }
    }
  }

  async function handleSendTest() {
    setTestSending(true)
    setError('')
    setSuccessMessage('')
    try {
      await sendTestNewsletter(committeeSlug, { subject, body, includeChart })
      setSuccessMessage(`Test sent to ${gmailConnection.email} — check your inbox before sending to everyone.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send test email')
    } finally {
      setTestSending(false)
    }
  }

  async function handleSend() {
    setSending(true)
    setError('')
    setSuccessMessage('')
    try {
      const result = await sendNewsletter(committeeSlug, {
        subject,
        body,
        rosterMemberIds: [...selected],
        includeChart,
      })
      setSuccessMessage(
        `Sent to ${result.sent} ${result.sent === 1 ? 'member' : 'members'}` +
          (result.skipped > 0 ? ` (${result.skipped} skipped — no email on file)` : '')
      )
      setHistory((prev) => [
        { id: `local-${Date.now()}`, subject, recipientCount: result.sent, includedChart: includeChart, sentAt: new Date().toISOString() },
        ...prev,
      ])
      setSubject('')
      setBody('')
      setSelected(new Set())
      setIncludeChart(false)
      setChartPreview(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send newsletter')
    } finally {
      setSending(false)
    }
  }

  if (!canEdit) {
    return (
      <p className="text-sm text-slate-500">
        You don&apos;t have permission to send newsletters for {committeeName}.
      </p>
    )
  }

  if (!gmailConnection.email) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
        <Mail className="w-8 h-8 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-700 font-medium">Connect a Gmail account to send newsletters</p>
        <p className="text-sm text-slate-500 mt-1">
          Head to <a href={`/app/${committeeSlug}/settings`} className="text-blue-600 hover:underline">Settings</a> to connect one.
        </p>
      </div>
    )
  }

  const canSend = !!subject.trim() && !!body.trim() && selected.size > 0 && !sending

  return (
    <div className="space-y-6">
      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
      {successMessage && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
          {successMessage}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Recipients</h2>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or email…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            />
          </div>
          <div className="relative">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as Filter)}
              aria-label="Filter roster"
              className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
            >
              {FILTERS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          </div>
        </div>

        <div className="border border-slate-200 rounded-lg max-h-72 overflow-y-auto">
          <label className="flex items-center gap-3 px-3 py-2 border-b border-slate-100 bg-slate-50 sticky top-0">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleSelectAllVisible}
              className="w-4 h-4 rounded border-slate-300"
            />
            <span className="text-xs font-medium text-slate-600">
              Select all filtered ({visibleWithEmail.length})
            </span>
          </label>
          {visible.length === 0 && (
            <p className="px-3 py-6 text-sm text-slate-400 text-center">No members match your filters</p>
          )}
          {visible.map((m) => (
            <label
              key={m.id}
              className={`flex items-center gap-3 px-3 py-2 border-b border-slate-50 last:border-0 ${
                m.email ? 'hover:bg-slate-50 cursor-pointer' : 'opacity-50 cursor-not-allowed'
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(m.id)}
                disabled={!m.email}
                onChange={() => toggleMember(m.id)}
                className="w-4 h-4 rounded border-slate-300"
              />
              <span className="text-sm text-slate-800 flex-1">{m.firstName} {m.lastName}</span>
              <span className="text-xs text-slate-400">{m.email ?? 'no email on file'}</span>
            </label>
          ))}
        </div>

        <p className="text-xs text-slate-500">{selected.size} recipient{selected.size !== 1 ? 's' : ''} selected</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Message</h2>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="This month's committee update"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            placeholder="Write your update here…"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includeChart}
            onChange={(e) => handleChartToggle(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300"
          />
          <span className="text-sm text-slate-700 flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
            Include donor contributions chart
          </span>
        </label>

        {includeChart && (
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
            {chartLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> Rendering preview…
              </div>
            ) : chartPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={chartPreview} alt="Donor contributions by month preview" className="w-full max-w-md mx-auto" />
            ) : null}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={handleSendTest}
            disabled={testSending || !subject.trim() || !body.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {testSending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Send test to yourself
          </button>
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Send to {selected.size} recipient{selected.size !== 1 ? 's' : ''}
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Recently sent</h2>
        {history.length === 0 ? (
          <p className="text-sm text-slate-400">No newsletters sent yet</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {history.map((n) => (
              <li key={n.id} className="py-2.5 flex items-center justify-between text-sm">
                <div>
                  <p className="text-slate-800">{n.subject}</p>
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(parseISO(n.sentAt), { addSuffix: true })}
                  </p>
                </div>
                <span className="text-xs text-slate-500 tabular">
                  {n.recipientCount} recipient{n.recipientCount !== 1 ? 's' : ''}{n.includedChart ? ' · chart' : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
