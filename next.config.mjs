/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'], bodySizeLimit: '10mb' },
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
}

export default nextConfig
