'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createCommittee } from '@/actions/committees'

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
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [electionYear, setElectionYear] = useState('')
  const [city, setCity] = useState('')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; slug?: string; general?: string }>({})

  useEffect(() => {
    if (!slugEdited) setSlug(slugify(name))
  }, [name, slugEdited])

  function handleSlugChange(val: string) {
    setSlugEdited(true)
    setSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 50))
    setErrors((e) => ({ ...e, slug: undefined }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!name.trim()) errs.name = 'Committee name is required'
    if (!slug.trim()) errs.slug = 'URL slug is required'
    if (slug && !/^[a-z0-9-]+$/.test(slug)) errs.slug = 'Only lowercase letters, numbers, and hyphens'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    setErrors({})
    try {
      const committee = await createCommittee({
        name: name.trim(),
        slug,
        electionYear: electionYear ? parseInt(electionYear) : undefined,
        city: city.trim() || undefined,
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
      {/* Name */}
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-slate-700">
          Committee name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setErrors((er) => ({ ...er, name: undefined })) }}
          placeholder="Friends of Jane Smith"
          autoFocus
          className={inputCls(!!errors.name)}
        />
        {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
      </div>

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
