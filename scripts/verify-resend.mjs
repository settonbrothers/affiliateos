// One-off: verify RESEND_API_KEY by sending a real test email via the same
// Resend REST call the app uses. Reads .env.local; never prints the key.
//   node scripts/verify-resend.mjs [recipient]
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)

const key = env.RESEND_API_KEY
if (!key) {
  console.error('RESEND_API_KEY is empty in .env.local')
  process.exit(1)
}
const from = env.EMAIL_FROM || 'AffiliateOS <onboarding@resend.dev>'
const to = process.argv[2] || 'setmarketing18@gmail.com'

console.log(`Sending test email  from: ${from}  to: ${to}`)
const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from,
    to,
    subject: 'AffiliateOS — Resend test ✅',
    html: '<p>If you can read this, transactional email is wired up correctly.</p>',
  }),
})
const body = await res.json().catch(() => ({}))
console.log(`HTTP ${res.status}`)
console.log(JSON.stringify(body, null, 2)) // contains an email id on success, or an error — no secrets
console.log(res.ok ? '\n✅ Resend works — check the inbox.' : '\n❌ Resend rejected the send (see error above).')
process.exit(res.ok ? 0 : 1)
