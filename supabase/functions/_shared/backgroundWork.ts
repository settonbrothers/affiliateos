// Toolkit for background work that cannot finish inside one edge-function
// invocation.
//
// Measured on this project: no run has ever survived past ~224s of wall clock,
// and there is no setting to extend it — `[edge_runtime]` in config.toml only
// carries policy, inspector port and Deno version. Work bigger than that has to
// be split across invocations, and the two places that need it (the discovery
// deep pass, and eval-cron) were each about to grow their own mechanism. One
// mechanism, two consumers.
import { requireAdmin } from './auth.ts'

/**
 * Is this an internal continuation rather than a user request?
 *
 * The shared-secret shape is the one already proven in eval-cron: a caller that
 * is not a person presents `x-cron-secret`. The platform still requires a valid
 * JWT at the gateway (verify_jwt defaults on), so a self-invocation carries the
 * anon key in Authorization as well — see invokeSelf.
 */
export function isCronCall(req: Request): boolean {
  const header = req.headers.get('x-cron-secret')
  if (!header) return false

  // CRON_SECRET first, for the Vercel cron → eval-cron path.
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (cronSecret && header === cronSecret) return true

  // Fall back to the service-role key, which the runtime always has. Without
  // this a self-invocation depends on a secret that has to be provisioned
  // separately — and CRON_SECRET is in fact NOT set on this project, which is
  // why the nightly eval has never produced a run: eval-cron falls through to
  // requireAdmin and the cron call, carrying only the anon key, gets a 401.
  // Anyone holding the service-role key already has full database access, so
  // this grants nothing new.
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  return !!serviceKey && header === serviceKey
}

/**
 * Admin OR internal continuation. Throws the same errors requireAdmin does, so
 * callers keep their existing 401/403 mapping.
 */
export async function requireAdminOrCron(req: Request): Promise<void> {
  if (isCronCall(req)) return
  await requireAdmin(req)
}

/**
 * Invoke another (or the same) edge function to continue work on a fresh clock.
 *
 * Fire-and-forget by design: the caller is usually about to be killed, and a
 * failed hand-off must not throw inside a background task. Returns whether the
 * call was accepted, so the caller can fall back to finalising instead of
 * leaving a job stranded mid-flight.
 */
export async function invokeSelf(
  functionName: string,
  body: Record<string, unknown>
): Promise<boolean> {
  const url = Deno.env.get('SUPABASE_URL')
  // The service-role key is always present in the runtime, so a hand-off needs
  // no extra configuration. It satisfies the gateway's JWT check and marks the
  // call as internal in one go.
  const key =
    Deno.env.get('CRON_SECRET') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const auth = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !key || !auth) return false

  try {
    const res = await fetch(`${url}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth}`,
        'x-cron-secret': key,
      },
      body: JSON.stringify(body),
    })
    return res.ok
  } catch {
    return false
  }
}

export type WaveResult<R> = {
  results: R[]
  /** Items never started because the deadline passed. */
  remaining: number
  timedOut: boolean
}

/**
 * Process items in parallel waves, stopping before a wave that would run past
 * the deadline.
 *
 * Generalises eval-cron's `mapPool`, which had the concurrency but no clock —
 * so it ran until the runtime killed it and wrote nothing at all. Here a caller
 * always gets back what completed plus an honest count of what did not, and can
 * persist that rather than lose it.
 */
export async function processInWaves<T, R>(
  items: T[],
  concurrency: number,
  deadline: () => boolean,
  fn: (item: T) => Promise<R>
): Promise<WaveResult<R>> {
  const results: R[] = []
  let index = 0

  for (; index < items.length; index += concurrency) {
    if (deadline()) {
      return { results, remaining: items.length - index, timedOut: true }
    }
    const wave = items.slice(index, index + concurrency)
    results.push(...(await Promise.all(wave.map(fn))))
  }

  return { results, remaining: 0, timedOut: false }
}

/**
 * A deadline predicate measured from now.
 *
 * Each invocation gets its own clock — that is the whole point of chaining, so
 * the budget must not be inherited from the invocation that handed off.
 */
export function deadlineAfter(ms: number): () => boolean {
  const startedAt = Date.now()
  return () => Date.now() - startedAt > ms
}
