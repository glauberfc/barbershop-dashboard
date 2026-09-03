import type { z } from 'zod'

/** A response the mock — later, the real backend — refused. */
export class ApiError extends Error {
  readonly status: number

  constructor(method: string, path: string, status: number) {
    super(`${method} ${path} failed with ${status}`)
    this.name = 'ApiError'
    this.status = status
  }
}

/**
 * The HTTP boundary. Every response is parsed with its contract schema, so the
 * day the mock is replaced by a real backend, a disagreement surfaces here as a
 * concrete failure rather than as an undefined field somewhere in the tree.
 *
 * Requests are resolved against the document's origin so that the same relative
 * paths work under the browser worker and under `setupServer` in tests.
 */
export async function apiGet<Schema extends z.ZodType>(
  path: string,
  schema: Schema,
): Promise<z.infer<Schema>> {
  const response = await fetch(new URL(path, window.location.origin), {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new ApiError('GET', path, response.status)
  }

  return schema.parse(await response.json())
}
