import { z } from 'npm:zod@3'

export class ZodValidationError extends Error {
  constructor(public readonly zodError: z.ZodError) {
    super(`Validation failed: ${zodError.message}`)
    this.name = 'ZodValidationError'
  }
}

// Parse-or-throw with a typed error the caller can route to the DLQ.
export function parseOrThrow<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): z.infer<T> {
  const result = schema.safeParse(data)
  if (!result.success) throw new ZodValidationError(result.error)
  return result.data
}
