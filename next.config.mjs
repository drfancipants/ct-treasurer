/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'], bodySizeLimit: '10mb' },
  },
  // Native addon (prebuilt binary) — must be resolved at runtime via require(),
  // not bundled, or Turbopack fails on its non-ESM binding file.
  serverExternalPackages: ['@napi-rs/canvas'],
}

export default nextConfig
