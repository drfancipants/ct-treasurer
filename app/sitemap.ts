import type { MetadataRoute } from 'next'
import { GUIDES } from '@/lib/guides'

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.cttreasurer.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = ['', '/quickstart', '/guides', '/terms', '/privacy'].map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: path === '' ? 1 : 0.7,
  }))

  const guidePages = GUIDES.map((g) => ({
    url: `${siteUrl}/guides/${g.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }))

  return [...staticPages, ...guidePages]
}
