// Mint a Supabase session for the local user and print the auth cookie
const fs = require('fs')
const path = require('path')

const ROOT = '/home/todd/ct-treasurer'
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/)
  if (m) process.env[m[1]] = m[2]
}

// supabase-js wants native WebSocket (Node 22+); realtime is unused here
if (typeof globalThis.WebSocket === 'undefined') {
  try { globalThis.WebSocket = require(path.join(ROOT, 'node_modules/ws')) }
  catch { globalThis.WebSocket = class {} }
}

const { createClient } = require(path.join(ROOT, 'node_modules/@supabase/supabase-js'))

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const email = process.argv[2] || 'tfanciullo@gmail.com'

async function main() {
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkErr) throw new Error('generateLink: ' + linkErr.message)

  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
    type: 'email',
    token_hash: linkData.properties.hashed_token,
  })
  if (otpErr) throw new Error('verifyOtp: ' + otpErr.message)

  const session = otpData.session
  const ref = new URL(url).hostname.split('.')[0]
  const value = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url')
  console.log(JSON.stringify({ name: `sb-${ref}-auth-token`, value, length: value.length }))
}

main().catch((e) => { console.error(e.message); process.exit(1) })
