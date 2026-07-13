/**
 * Registry of the public SEO guide pages. Shared by the /guides index, the
 * sitemap, and cross-links between guides. Add an entry here and create the
 * matching page at app/guides/<slug>/page.tsx.
 */
export interface GuideMeta {
  slug: string
  title: string
  /** ~155-char meta description for search snippets */
  description: string
  /** short blurb shown on the index card */
  blurb: string
}

export const GUIDES: GuideMeta[] = [
  {
    slug: 'how-to-file-seec-form-20',
    title: 'How to File SEEC Form 20: A Connecticut Treasurer’s Guide',
    description:
      'A step-by-step guide to filing Connecticut SEEC Form 20 through eCRIS — who files it, the itemization rules, each section, deadlines, and common mistakes to avoid.',
    blurb:
      'Everything a town-committee treasurer needs to prepare and upload a Form 20 filing to eCRIS — sections, the $50 itemization rule, deadlines, and pitfalls.',
  },
  {
    slug: 'how-to-file-seec-form-30',
    title: 'How to File SEEC Form 30: A Guide for Candidate Committees',
    description:
      'How Connecticut candidate committees for statewide and General Assembly offices file SEEC Form 30 through eCRIS — per-phase limits, the CEP, statutory statements, and each section.',
    blurb:
      'For candidate campaigns filing Form 30 — how it differs from Form 20, per-phase contribution limits, the Citizens’ Election Program, statutory statements, and each section.',
  },
]

export function getGuide(slug: string): GuideMeta | undefined {
  return GUIDES.find((g) => g.slug === slug)
}
