import type { MetadataRoute } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.cttreasurer.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // The authenticated app and API routes have no SEO value and shouldn't be crawled
      disallow: ['/app/', '/api/', '/mfa', '/auth/'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
