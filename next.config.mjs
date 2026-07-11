/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // No allowedOrigins: Server Actions default to same-origin only (Next
    // compares Origin to Host), which covers both localhost dev and the
    // production domain. Listing extra origins would only widen CSRF surface.
    serverActions: { bodySizeLimit: '10mb' },
  },
  // Native addon (prebuilt binary) — must be resolved at runtime via require(),
  // not bundled, or Turbopack fails on its non-ESM binding file.
  // pdfkit ships font metrics (.afm) files it reads relative to its own
  // location at runtime — bundling moves/inlines the JS but not those data
  // files, so it must also resolve via plain require().
  serverExternalPackages: ['@napi-rs/canvas', 'pdfkit'],
  // Chart text fonts (lib/chart-font.ts) — read from disk at runtime, so
  // every serverless function that can render a chart must bundle them.
  outputFileTracingIncludes: {
    '/**': ['./lib/fonts/*.ttf'],
  },
  // Baseline security headers applied to every response. `frame-ancestors
  // 'none'` (plus X-Frame-Options for older browsers) blocks clickjacking; it
  // only controls who may frame *this* app, so it doesn't affect Plaid Link or
  // Stripe, which the app embeds/redirects to (governed by frame-src, left
  // open). A full script-src CSP is intentionally deferred — it needs testing
  // against Next's inline runtime — but these safe headers can ship now.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
        ],
      },
    ]
  },
}

export default nextConfig
