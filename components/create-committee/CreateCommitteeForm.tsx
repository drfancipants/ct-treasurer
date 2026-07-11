'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createCommittee } from '@/actions/committees'
import { OFFICE_LABELS, type CommitteeType, type OfficeSought } from '@/lib/types'
import { OFFICE_INDIVIDUAL_LIMITS } from '@/lib/limits'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

export default function CreateCommitteeForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [customSlug, setCustomSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [electionYear, setElectionYear] = useState('')
  const [city, setCity] = useState('')
  const [type, setType] = useState<CommitteeType>('PARTY')
  const [candidateName, setCandidateName] = useState('')
  const [officeSought, setOfficeSought] = useState<OfficeSought | ''>('')
  const [district, setDistrict] = useState('')
  const [primaryDate, setPrimaryDate] = useState('')
  const [electionDate, setElectionDate] = useState('')
  const [cepParticipant, setCepParticipant] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; slug?: string; candidateName?: string; officeSought?: string; general?: string }>({})

  // Derived from name until the user edits the slug field directly
  const slug = slugEdited ? customSlug : slugify(name)

  function handleSlugChange(val: string) {
    setSlugEdited(true)
    setCustomSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 50))
    setErrors((e) => ({ ...e, slug: undefined }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!name.trim()) errs.name = 'Committee name is required'
    if (!slug.trim()) errs.slug = 'URL slug is required'
    if (slug && !/^[a-z0-9-]+$/.test(slug)) errs.slug = 'Only lowercase letters, numbers, and hyphens'
    if (type === 'CANDIDATE') {
      if (!candidateName.trim()) errs.candidateName = 'Candidate name is required'
      if (!officeSought) errs.officeSought = 'Select the office being sought'
      if (primaryDate && electionDate && primaryDate >= electionDate) {
        errs.general = 'The primary date must be before the election date'
      }
    }
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    setErrors({})
    try {
      const committee = await createCommittee({
        name: name.trim(),
        slug,
        electionYear: electionYear ? parseInt(electionYear) : undefined,
        city: city.trim() || undefined,
        type,
        ...(type === 'CANDIDATE'
          ? {
              candidateName: candidateName.trim(),
              officeSought: officeSought as OfficeSought,
              district: district.trim() || undefined,
              primaryDate: primaryDate || undefined,
              electionDate: electionDate || undefined,
              cepParticipant,
            }
          : {}),
      })
      router.push(`/app/${committee.slug}/dashboard`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      if (msg.includes('URL')) setErrors({ slug: msg })
      else setErrors({ general: msg })
    } finally {
      setSaving(false)
    }
  }

  const currentYear = new Date().getFullYear()

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Committee type */}
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-slate-700">Committee type</label>
        <div className="grid grid-cols-2 gap-3">
          {([
            { value: 'PARTY', title: 'Party committee', desc: 'A town committee (DTC / RTC)' },
            { value: 'CANDIDATE', title: 'Candidate committee', desc: "One candidate's campaign" },
          ] as const).map((opt) => (
            <button
              type="button"
              key={opt.value}
              onClick={() => setType(opt.value)}
              className={[
                'text-left rounded-xl border p-3 transition-colors',
                type === opt.value
                  ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300 bg-white',
              ].join(' ')}
            >
              <p className="text-sm font-medium text-slate-900">{opt.title}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</p>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate-400">This can’t be changed later.</p>
      </div>

      {/* Name */}
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-slate-700">
          Committee name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setErrors((er) => ({ ...er, name: undefined })) }}
          placeholder={type === 'CANDIDATE' ? 'Friends of Jane Smith' : 'New Haven Democratic Town Committee'}
          autoFocus
          className={inputCls(!!errors.name)}
        />
        {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
      </div>

      {/* Candidate details */}
      {type === 'CANDIDATE' && (
        <div className="space-y-4 rounded-xl border border-slate-200 p-4 bg-slate-50/50">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Candidate & election</p>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700">
              Candidate name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={candidateName}
              onChange={(e) => { setCandidateName(e.target.value); setErrors((er) => ({ ...er, candidateName: undefined })) }}
              placeholder="Jane Smith"
              className={inputCls(!!errors.candidateName)}
            />
            {errors.candidateName && <p className="text-xs text-red-600">{errors.candidateName}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700">
              Office sought <span className="text-red-500">*</span>
            </label>
            <select
              value={officeSought}
              onChange={(e) => { setOfficeSought(e.target.value as OfficeSought); setErrors((er) => ({ ...er, officeSought: undefined })) }}
              className={inputCls(!!errors.officeSought)}
            >
              <option value="">Select an office…</option>
              {(Object.keys(OFFICE_LABELS) as OfficeSought[]).map((o) => (
                <option key={o} value={o}>
                  {OFFICE_LABELS[o]} — ${OFFICE_INDIVIDUAL_LIMITS[o].toLocaleString()}/donor per phase
                </option>
              ))}
            </select>
            {errors.officeSought && <p className="text-xs text-red-600">{errors.officeSought}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700">District (optional)</label>
            <input
              type="text"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="98th Assembly District"
              className={inputCls(false)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700">Primary date</label>
              <input
                type="date"
                value={primaryDate}
                onChange={(e) => setPrimaryDate(e.target.value)}
                className={inputCls(false)}
              />
              <p className="text-[11px] text-slate-400">Leave blank if not in a primary — limits apply separately to primary and election.</p>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700">Election date</label>
              <input
                type="date"
                value={electionDate}
                onChange={(e) => setElectionDate(e.target.value)}
                className={inputCls(false)}
              />
            </div>
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={cepParticipant}
              onChange={(e) => setCepParticipant(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs text-slate-600">
              <span className="font-medium text-slate-700">Citizens’ Election Program participant</span>
              <br />
              Caps individual gifts at $340 (2026 cycle, $5 minimum) and prohibits committee, PAC, and state-contractor contributions.
            </span>
          </label>
        </div>
      )}

      {/* Slug */}
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-slate-700">
          Committee URL <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-slate-400 whitespace-nowrap">/app/</span>
          <input
            type="text"
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            placeholder="friends-of-jane-smith"
            className={inputCls(!!errors.slug)}
          />
        </div>
        {errors.slug
          ? <p className="text-xs text-red-600">{errors.slug}</p>
          : <p className="text-xs text-slate-400">Lowercase letters, numbers, and hyphens only</p>
        }
      </div>

      {/* Election year + city */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-700">Election year</label>
          <input
            type="number"
            value={electionYear}
            onChange={(e) => setElectionYear(e.target.value)}
            placeholder={String(currentYear)}
            min={2000}
            max={2100}
            className={inputCls(false)}
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-700">City / town</label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="New Haven"
            className={inputCls(false)}
          />
        </div>
      </div>

      {errors.general && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {errors.general}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Creating…' : 'Create committee'}
      </button>
    </form>
  )
}

const inputCls = (hasError: boolean) =>
  [
    'w-full px-3 py-2 rounded-lg border text-sm text-slate-900 placeholder:text-slate-400',
    'focus:outline-none focus:ring-2 focus:border-transparent bg-white',
    hasError ? 'border-red-300 focus:ring-red-400' : 'border-slate-200 focus:ring-blue-500',
  ].join(' ')
