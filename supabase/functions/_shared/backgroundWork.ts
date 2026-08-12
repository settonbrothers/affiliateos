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
  const secret = Deno.env.get('CRON_SECRET')
  const header = req.headers.get('x-cron-secret')
  return !!secret && !!header && header === secret
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
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  const secret = Deno.env.get('CRON_SECRET')
  if (!url || !anon || !secret) return false

  try {
    const res = await fetch(`${url}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anon}`,
        'x-cron-secret': secret,
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
