# Copy evidence-story v4 rollout

## Safety state

The code, schemas, migration and prompts are staged. Production remains on the legacy engine unless **both** flags are set:

- server: `AD_COPY_EVIDENCE_V4_ENABLED=true`
- client: `NEXT_PUBLIC_AD_COPY_EVIDENCE_V4_ENABLED=true`

Do not set either flag until the sealed live evaluation passes. Candidate prompt files exist in git, while `_active.json` continues to point at the production versions.

## Pre-activation sequence

1. Apply migration `0046_copy_evidence_story_v4.sql`.
2. Run `pnpm prompts:sync` without `--activate`; verify only content insertion and expected inactive-version drift.
3. Run `pnpm eval:copy-evidence`. A `PENDING` result validates fixtures and preregistration only; it is not an eval pass.
4. Produce 72 live pipeline outputs: 12 sealed cases × baseline/candidate × three repetitions. Do not expose holdout during calibration.
5. Build the blind packet with `pnpm eval:copy-owner-packet -- --results <file>` and collect all 12 owner pairs.
6. Score with `pnpm eval:copy-evidence -- --results <completed-file>`. Required: candidate wins ≥8, losses ≤2, average delta ≥0.5, zero truth violations, stable mode ≥11/12, judge-owner agreement ≥80%, zero truth false-pass.
7. If holdout fails, retire it to regression and create a new sealed holdout. Never tune and retest on the same revealed cases.
8. Only after PASS: activate the v4 prompt versions atomically, set the server flag for admin-only traffic, and set the client flag only in the admin deployment.

## Shadow and rollout

- Shadow ten internal offers and compare status, evidence mode, kill flags, cost and latency against the legacy output.
- Keep evidence traces internal; user output contains the copy, readiness message and compact source summary.
- Advance admin-only → internal workspace → limited percentage → default only when no truth false-pass appears.
- Taste Corpus receives only explicit saved edits/ratings, never unreviewed model output.

## Rollback

Unset both flags first. This immediately restores the legacy runtime and legacy template selector. If prompts were activated, roll each orchestrator back to its previous version through the existing prompt rollback path. The new tables are additive and need not be removed.
