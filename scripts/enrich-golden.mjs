// Enrich golden offers with REAL extracted facts by running the deployed
// ingest-source pipeline (fetch + Haiku) on each offer's affiliate URL, then
// writing the extracted facts into golden_set_offers.facts_snapshot. Only
// overwrites when real facts come back; reports per-offer counts. Uses a
// throwaway admin + temp offers, cleaned up.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const svc = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// external_id -> a real, fetchable URL describing the affiliate program.
const URLS = {
  'gold-001': 'https://www.jasper.ai/partners',
  'gold-002': 'https://www.shopify.com/affiliates',
  'gold-003': 'https://www.clickfunnels.com/affiliates',
  'gold-006': 'https://nordvpn.com/affiliate/',
  'gold-007': 'https://www.semrush.com/company/partners/affiliate-program/',
  'gold-012': 'https://webflow.com/affiliates',
  'gold-004': 'https://www.notion.com/affiliates',
  'gold-005': 'https://www.grammarly.com/affiliates',
}

const stamp = `${Date.now()}`
let userId, wsId
let enriched = 0

try {
  const { data: created } = await svc.auth.admin.createUser({
    email: `enrich+${stamp}@example.com`,
    password: 'Test-Password-123!',
    email_confirm: true,
  })
  userId = created.user.id
  await svc.from('profiles').update({ system_role: 'admin' }).eq('id', userId)
  const { data: mem } = await svc
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .maybeSingle()
  wsId = mem?.workspace_id

  const userClient = createClient(URL_, ANON, { auth: { persistSession: false } })
  const { data: signIn } = await userClient.auth.signInWithPassword({
    email: `enrich+${stamp}@example.com`,
    password: 'Test-Password-123!',
  })
  const token = signIn.session.access_token

  for (const [ext, url] of Object.entries(URLS)) {
    const { data: gold } = await svc
      .from('golden_set_offers')
      .select('id, vertical_id, offer_name')
      .eq('external_id', ext)
      .maybeSingle()
    if (!gold) {
      console.log(`  ${ext}: golden row not found, skipping`)
      continue
    }

    // Temp offer to ingest against.
    const { data: offer } = await svc
      .from('offers')
      .insert({
        name: `enrich-${ext}-${stamp}`,
        slug: `enrich-${ext}-${stamp}`,
        vertical_id: gold.vertical_id,
        created_by_user_id: userId,
        workspace_id: wsId,
        status: 'draft',
        visibility: 'admin_only',
      })
      .select('id')
      .single()

    const res = await fetch(`${URL_}/functions/v1/ingest-source`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: ANON,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ offer_id: offer.id, url }),
    })
    const body = await res.json().catch(() => ({}))
    let jobStatus = res.status === 200 ? 'queued' : `http_${res.status}`

    if (body.job_id) {
      for (let i = 0; i < 25; i++) {
        await sleep(2000)
        const { data: job } = await svc
          .from('source_fetch_jobs')
          .select('status, error_message')
          .eq('id', body.job_id)
          .maybeSingle()
        jobStatus = job?.status ?? '?'
        if (['completed', 'failed'].includes(jobStatus)) {
          if (jobStatus === 'failed') jobStatus = `failed (${job.error_message})`
          break
        }
      }
    }

    const { data: facts } = await svc
      .from('extracted_facts')
      .select('fact_type, fact_value, source_quote, confidence_score')
      .eq('offer_id', offer.id)

    const n = facts?.length ?? 0
    if (n > 0) {
      await svc
        .from('golden_set_offers')
        .update({
          facts_snapshot: facts,
          notes:
            'Facts ingested from real URL (Haiku extraction). Verdict still AI-drafted — review.',
        })
        .eq('id', gold.id)
      enriched++
      console.log(`  ${ext.padEnd(9)} ${gold.offer_name.padEnd(14)} -> ${n} real fact(s)  [${jobStatus}]`)
    } else {
      console.log(`  ${ext.padEnd(9)} ${gold.offer_name.padEnd(14)} -> 0 facts (kept synthetic)  [${jobStatus}]`)
    }

    // Cleanup temp offer.
    await svc.from('extracted_facts').delete().eq('offer_id', offer.id)
    await svc.from('source_fetch_jobs').delete().eq('offer_id', offer.id)
    await svc.from('source_documents').delete().eq('offer_id', offer.id)
    await svc.from('ai_runs').delete().eq('offer_id', offer.id)
    await svc.from('offers').delete().eq('id', offer.id)
  }
} catch (err) {
  console.error('error:', err.message ?? err)
} finally {
  if (wsId) await svc.from('workspaces').delete().eq('id', wsId)
  if (userId) await svc.auth.admin.deleteUser(userId)
  console.log(`\nEnriched ${enriched}/${Object.keys(URLS).length} golden offers with real facts.`)
}
