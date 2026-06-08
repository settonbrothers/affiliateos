# Audit Gap Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the four real (non-owner-gated) gaps found in the plan-vs-implementation audit: the magic-link signup bypass, the unscheduled eval cron, the duplicate dead email templates, and the missing secrets-rotation script.

**Architecture:** Small, isolated changes. (1) Magic-link uses `shouldCreateUser: false` so it logs in existing users only — new accounts must go through invite-gated signup; a pure helper maps the resulting error. (2) A Vercel cron hits a new `/api/cron/eval` route that forwards to the existing `eval-cron` Supabase edge function (where the Anthropic key lives) — secrets stay in env, config stays in-repo. (3) Delete the two unused Node email templates (the live ones live on the Deno/edge side). (4) Add `scripts/rotate-secrets.sh` to propagate rotated secrets to Supabase and checklist the Vercel side.

**Tech Stack:** Next.js 15 App Router, Supabase (Auth + edge functions), Vitest, Vercel cron, bash.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/lib/auth/magicLink.ts` | Pure error-message mapping for magic-link | Create |
| `src/lib/auth/magicLink.test.ts` | Unit test for the mapper | Create |
| `src/lib/actions/auth.ts` | `sendMagicLink` — add `shouldCreateUser: false` + use mapper | Modify |
| `src/lib/cron/auth.ts` | Pure `isAuthorizedCron` bearer check | Create |
| `src/lib/cron/auth.test.ts` | Unit test for the cron auth check | Create |
| `src/app/api/cron/eval/route.ts` | Verifies Vercel cron auth, forwards to edge fn per vertical | Create |
| `vercel.json` | Nightly cron schedule | Create |
| `src/lib/email/templates.ts` | Remove `lowCreditsEmail` + `agentFailureEmail` (dead) | Modify |
| `src/lib/email/templates.test.ts` | Remove their imports + tests | Modify |
| `scripts/rotate-secrets.sh` | Rotate/propagate secrets to Supabase + Vercel checklist | Create |

**Commands:** test = `pnpm test`; single file = `pnpm exec vitest run <path>`; `pnpm typecheck`; `pnpm lint`.

---

## Task 1: Close the magic-link signup bypass

**Why:** `sendMagicLink` calls `signInWithOtp` with `shouldCreateUser` defaulting to `true`, so any email can create an account via magic link — bypassing the invite-only gate. Fix: only log in existing users; surface an invite-aware message otherwise.

**Files:**
- Create: `src/lib/auth/magicLink.ts`
- Test: `src/lib/auth/magicLink.test.ts`
- Modify: `src/lib/actions/auth.ts:102-116`

- [ ] **Step 1: Write the failing test**

Create `src/lib/auth/magicLink.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { magicLinkErrorMessage } from './magicLink'

describe('magicLinkErrorMessage', () => {
  it('maps "Signups not allowed for otp" to an invite-aware message', () => {
    expect(magicLinkErrorMessage('Signups not allowed for otp')).toMatch(
      /invite code/i
    )
  })

  it('maps otp_disabled the same way', () => {
    expect(magicLinkErrorMessage('otp_disabled')).toMatch(/invite code/i)
  })

  it('passes through unrelated errors unchanged', () => {
    expect(magicLinkErrorMessage('Email rate limit exceeded')).toBe(
      'Email rate limit exceeded'
    )
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/lib/auth/magicLink.test.ts`
Expected: FAIL — `Failed to resolve import "./magicLink"`.

- [ ] **Step 3: Write the helper**

Create `src/lib/auth/magicLink.ts`:

```ts
// Magic-link is a LOGIN path only — signup is invite-only. When sendMagicLink
// uses shouldCreateUser:false, Supabase rejects unknown emails with a
// "Signups not allowed for otp" / otp_disabled error. Map that to an
// invite-aware message instead of leaking that magic-link could be a signup.
export function magicLinkErrorMessage(rawError: string): string {
  const e = rawError.toLowerCase()
  if (e.includes('signups not allowed') || e.includes('otp_disabled')) {
    return 'No account found for that email. Sign up with an invite code first.'
  }
  return rawError
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/lib/auth/magicLink.test.ts`
Expected: PASS (3 passed).

- [ ] **Step 5: Wire the helper + flag into `sendMagicLink`**

In `src/lib/actions/auth.ts`, add the import near the other `@/lib` imports (after line 7):

```ts
import { magicLinkErrorMessage } from '@/lib/auth/magicLink'
```

Replace the body of `sendMagicLink` (current lines 108-115) — the `signInWithOtp` call and error handling — with:

```ts
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      // Login only — never create an account here (invite-only signup).
      shouldCreateUser: false,
      emailRedirectTo: `${await siteOrigin()}/callback`,
    },
  })
  if (error) return { error: magicLinkErrorMessage(error.message) }

  return { message: 'Magic link sent. Check your email.' }
```

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth/magicLink.ts src/lib/auth/magicLink.test.ts src/lib/actions/auth.ts
git commit -m "fix(auth): magic-link logs in existing users only (close invite bypass)"
```

---

## Task 2: Schedule the eval cron

**Why:** `supabase/functions/eval-cron` exists and self-authorizes via `x-cron-secret`, but nothing triggers it on a schedule (M3 DoD: nightly 03:00). Add a Vercel cron → `/api/cron/eval` route that forwards to the edge function per vertical. Secrets stay in env; only config is committed.

**Files:**
- Create: `src/lib/cron/auth.ts`
- Test: `src/lib/cron/auth.test.ts`
- Create: `src/app/api/cron/eval/route.ts`
- Create: `vercel.json`

- [ ] **Step 1: Write the failing test**

Create `src/lib/cron/auth.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { isAuthorizedCron } from './auth'

describe('isAuthorizedCron', () => {
  it('accepts a matching bearer token', () => {
    expect(isAuthorizedCron('Bearer s3cret', 's3cret')).toBe(true)
  })

  it('rejects a mismatched token', () => {
    expect(isAuthorizedCron('Bearer wrong', 's3cret')).toBe(false)
  })

  it('rejects when no secret is configured', () => {
    expect(isAuthorizedCron('Bearer s3cret', undefined)).toBe(false)
  })

  it('rejects a missing header', () => {
    expect(isAuthorizedCron(null, 's3cret')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/lib/cron/auth.test.ts`
Expected: FAIL — `Failed to resolve import "./auth"`.

- [ ] **Step 3: Write the helper**

Create `src/lib/cron/auth.ts`:

```ts
// Vercel sends `Authorization: Bearer <CRON_SECRET>` on scheduled invocations
// when the CRON_SECRET env var is set. Reject anything that doesn't match.
export function isAuthorizedCron(
  authHeader: string | null,
  secret: string | undefined
): boolean {
  if (!secret) return false
  return authHeader === `Bearer ${secret}`
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/lib/cron/auth.test.ts`
Expected: PASS (4 passed).

- [ ] **Step 5: Create the cron route**

Create `src/app/api/cron/eval/route.ts`:

```ts
import { NextResponse } from 'next/server'

import { isAuthorizedCron } from '@/lib/cron/auth'

export const runtime = 'nodejs'
// The edge fn runs the eval in the background; we just fan out the triggers.
export const maxDuration = 60

// Verticals to replay nightly. ai_saas is the only one with a labeled golden
// set today; health/mental are triggered too and harmlessly 400 until labeled.
const VERTICALS = ['ai_saas', 'health', 'mental_wellness']

export async function GET(req: Request): Promise<Response> {
  if (
    !isAuthorizedCron(req.headers.get('authorization'), process.env.CRON_SECRET)
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const cronSecret = process.env.CRON_SECRET
  if (!supabaseUrl || !anonKey || !cronSecret) {
    return NextResponse.json({ error: 'Cron not configured' }, { status: 503 })
  }

  const results: Record<string, number> = {}
  for (const vertical of VERTICALS) {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/eval-cron`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${anonKey}`,
          'x-cron-secret': cronSecret,
        },
        body: JSON.stringify({ vertical, trigger: 'cron' }),
      })
      results[vertical] = res.status
    } catch {
      results[vertical] = 0
    }
  }

  return NextResponse.json({ triggered: results })
}
```

- [ ] **Step 6: Create the Vercel cron schedule**

Create `vercel.json`:

```json
{
  "crons": [{ "path": "/api/cron/eval", "schedule": "0 3 * * *" }]
}
```

- [ ] **Step 7: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/cron/auth.ts src/lib/cron/auth.test.ts src/app/api/cron/eval/route.ts vercel.json
git commit -m "feat(eval): nightly Vercel cron forwards to eval-cron edge fn"
```

- [ ] **Step 9: Owner step (document, do NOT block on it)**

Note in the PR/handoff: the cron is inert until `CRON_SECRET` is set **both** in Vercel env **and** as a Supabase secret (`pnpm dlx supabase@latest secrets set CRON_SECRET=<same-value>`), and the same value must match. Until then the route returns 503 and the edge fn still requires an admin JWT.

---

## Task 3: Remove the dead Node email templates

**Why:** `lowCreditsEmail` and `agentFailureEmail` in `src/lib/email/templates.ts` are never called from Node — the live versions run on the Deno/edge side (`_shared/credits.ts` low-credit, `_shared/dlq.ts` agent-failure). They are dead code with tests that imply they're wired.

**Files:**
- Modify: `src/lib/email/templates.ts:65-89`
- Modify: `src/lib/email/templates.test.ts`

- [ ] **Step 1: Remove the two functions**

In `src/lib/email/templates.ts`, delete `lowCreditsEmail` (lines 65-73) and `agentFailureEmail` (lines 75-89) in full. The file should end after `paymentFailedEmail` (its closing `}` on line 63).

- [ ] **Step 2: Update the test file**

In `src/lib/email/templates.test.ts`, change the import block (lines 3-8) to drop the two removed names:

```ts
import { receiptEmail, welcomeEmail } from './templates'
```

Then delete these two `it(...)` blocks (current lines 30-38):

```ts
  it('low credits shows the balance', () => {
    expect(lowCreditsEmail({ balance: 5 }).html).toContain('5 credits')
  })

  it('agent failure includes orchestrator + error', () => {
    const e = agentFailureEmail({ orchestrator: 'UnderwritingOrchestrator', error: 'boom' })
    expect(e.subject).toContain('UnderwritingOrchestrator')
    expect(e.html).toContain('boom')
  })
```

The `describe` block should now end after the `receipt formats the dollar amount` test.

- [ ] **Step 3: Run the email tests to verify they pass**

Run: `pnpm exec vitest run src/lib/email/templates.test.ts`
Expected: PASS (3 passed — welcome×2, receipt).

- [ ] **Step 4: Confirm no remaining references**

Run: `pnpm exec vitest run` then `pnpm typecheck`
Expected: no `lowCreditsEmail`/`agentFailureEmail` import errors; full suite green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/email/templates.ts src/lib/email/templates.test.ts
git commit -m "refactor(email): drop dead Node low-credit/agent-failure templates (live on edge)"
```

---

## Task 4: Add the secrets-rotation script

**Why:** M6 scope lists `scripts/rotate-secrets.sh`; it does not exist. Third-party keys are minted in provider dashboards, so the script's job is to propagate freshly-issued values to Supabase secrets and checklist the Vercel side so nothing is missed.

**Files:**
- Create: `scripts/rotate-secrets.sh`

- [ ] **Step 1: Write the script**

Create `scripts/rotate-secrets.sh`:

```bash
#!/usr/bin/env bash
#
# rotate-secrets.sh — propagate rotated AffiliateOS secrets.
#
# Third-party keys (Anthropic, Stripe, Resend) are *issued* in each provider's
# dashboard — this script does NOT mint them. It takes freshly-issued values,
# pushes the Supabase-side ones, then prints the manual Vercel checklist.
#
# Usage:    bash scripts/rotate-secrets.sh
# Requires: supabase CLI access via pnpm dlx (project linked).
set -euo pipefail

cd "$(dirname "$0")/.."

echo "AffiliateOS secret rotation"
echo "Enter new values; leave a prompt blank to skip that secret."
echo

# Secrets that live on the Supabase side (edge functions read these).
supabase_secrets=(
  ANTHROPIC_API_KEY
  RESEND_API_KEY
  CRON_SECRET
  ADMIN_ALERT_EMAIL
  EMAIL_FROM
  POSTHOG_KEY
  POSTHOG_HOST
)

to_set=()
for name in "${supabase_secrets[@]}"; do
  read -r -s -p "New ${name} (Supabase, blank=skip): " value || true
  echo
  if [ -n "${value:-}" ]; then
    to_set+=("${name}=${value}")
  fi
done

if [ "${#to_set[@]}" -gt 0 ]; then
  echo "Pushing ${#to_set[@]} secret(s) to Supabase…"
  pnpm dlx supabase@latest secrets set "${to_set[@]}"
else
  echo "No Supabase secrets entered — skipping."
fi

cat <<'EOF'

Supabase done. Remaining MANUAL steps (rotate in dashboard, then set in Vercel):

  Vercel env (Project Settings -> Environment Variables, or `vercel env add`):
    - STRIPE_SECRET_KEY                    (Stripe -> Developers -> API keys)
    - STRIPE_WEBHOOK_SECRET                (Stripe -> Webhooks -> signing secret)
    - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    - SUPABASE_SERVICE_ROLE_KEY            (Supabase -> Settings -> API; rotate with care)
    - RESEND_API_KEY                       (also pushed to Supabase above)
    - CRON_SECRET                          (MUST equal the Supabase CRON_SECRET above)
    - NEXT_PUBLIC_SENTRY_DSN / NEXT_PUBLIC_POSTHOG_KEY

  After rotating SUPABASE_SERVICE_ROLE_KEY or the anon key, redeploy Vercel.
  After changing CRON_SECRET, confirm the nightly /api/cron/eval still returns 200.
EOF
```

- [ ] **Step 2: Make it executable + sanity-check syntax**

Run: `chmod +x scripts/rotate-secrets.sh && bash -n scripts/rotate-secrets.sh`
Expected: no output (syntax OK). Do **not** run it end-to-end here (it prompts for live secrets).

- [ ] **Step 3: Commit**

```bash
git add scripts/rotate-secrets.sh
git commit -m "chore(ops): add scripts/rotate-secrets.sh (M6 secrets rotation)"
```

---

## Final Verification

- [ ] Run the full suite: `pnpm test` — all green (includes the 2 new test files; email suite reduced by 2).
- [ ] `pnpm typecheck` — clean.
- [ ] `pnpm lint` — clean.
- [ ] `Remove-Item -Recurse -Force .next` then `pnpm build` — builds (new `/api/cron/eval` route compiles; `vercel.json` is valid JSON).
- [ ] Manual auth check (proves Task 1): with the anon Supabase client, `signInWithOtp({ email: '<random-never-registered>@example.com', options: { shouldCreateUser: false } })` returns an error (no account created). Existing users still receive a link.
- [ ] Post-deploy (owner): set matching `CRON_SECRET` in Vercel + Supabase, then `GET /api/cron/eval` with `Authorization: Bearer <CRON_SECRET>` returns `{ triggered: { ai_saas: 200, ... } }` and a new row appears in `/admin/eval`.

## Notes / out of scope (owner-gated, unchanged by this plan)
Labeling the golden set + hitting >75% accuracy (needs `ANTHROPIC_API_KEY` + manual labels), the live Stripe round-trip, and external monitoring accounts (Better Stack/Sentry/PostHog dashboards, SMS alerting) remain owner tasks.
