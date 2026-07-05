'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import JSZip from 'jszip'
import { exportCommitteeData } from '@/actions/export'

interface Props {
  committeeId: string
  committeeName: string
}

export default function ExportDataCard({ committeeId, committeeName }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleExport() {
    setLoading(true)
    setError('')
    try {
      const files = await exportCommitteeData(committeeId)

      const zip = new JSZip()
      for (const file of files) zip.file(file.filename, file.content)
      const blob = await zip.generateAsync({ type: 'blob' })

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const safeName = committeeName.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40)
      const date = new Date().toISOString().split('T')[0]
      a.href = url
      a.download = `${safeName}_export_${date}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export data')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Download className="w-4.5 h-4.5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">Export all data</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Download every record — donations, expenses, roster, bank transactions, and filings — as a ZIP of CSV files
            </p>
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={loading}
          className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {loading ? 'Preparing…' : 'Export CSV'}
        </button>
      </div>
      {error && (
        <p className="mt-3 text-xs text-red-600">{error}</p>
      )}
    </div>
  )
}
