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
