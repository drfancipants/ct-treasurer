import path from 'path'

/**
 * Font family for all server-rendered (@napi-rs/canvas) charts. Generic
 * families like `sans-serif` resolve against *system* fonts, and Vercel's
 * serverless runtime ships none — chart text silently renders as nothing in
 * production. So the repo vendors Liberation Sans (SIL OFL, metrically
 * Helvetica-compatible) and every chart registers it explicitly before
 * drawing. `outputFileTracingIncludes` in next.config.mjs keeps the .ttf
 * files in the serverless bundle.
 */
export const CHART_FONT = 'ChartSans'

let registered = false

export async function ensureChartFont(): Promise<void> {
  if (registered) return
  const { GlobalFonts } = await import('@napi-rs/canvas')
  const dir = path.join(process.cwd(), 'lib', 'fonts')
  GlobalFonts.registerFromPath(path.join(dir, 'LiberationSans-Regular.ttf'), CHART_FONT)
  GlobalFonts.registerFromPath(path.join(dir, 'LiberationSans-Bold.ttf'), CHART_FONT)
  registered = true
}
