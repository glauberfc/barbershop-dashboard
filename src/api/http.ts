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
 * Requests are resolved against the document's origin so that the same relative
 * paths work under the browser worker and under `setupServer` in tests, and
 * always with credentials, so that the session cookie the mock issues is sent
 * back without any code here having to know it exists.
 *
 * A refusal becomes an `ApiError` carrying its status; a network that could not
 * be reached fails as whatever `fetch` threw. Callers depend on that
 * difference — a 401 means signed out, an unreachable API means try again.
 */
async function send(method: string, path: string, body?: unknown): Promise<Response> {
  const response = await fetch(new URL(path, window.location.origin), {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (!response.ok) {
    throw new ApiError(method, path, response.status)
  }

  return response
}

/**
 * The HTTP boundary. Every response is parsed with its contract schema, so the
 * day the mock is replaced by a real backend, a disagreement surfaces here as a
 * concrete failure rather than as an undefined field somewhere in the tree.
 */
export async function apiGet<Schema extends z.ZodType>(
  path: string,
  schema: Schema,
): Promise<z.infer<Schema>> {
  const response = await send('GET', path)

  return schema.parse(await response.json())
}

export async function apiPost<Schema extends z.ZodType>(
  path: string,
  body: unknown,
  schema: Schema,
): Promise<z.infer<Schema>> {
  const response = await send('POST', path, body)

  return schema.parse(await response.json())
}

/** For endpoints whose success is the absence of a body. */
export async function apiDelete(path: string): Promise<void> {
  await send('DELETE', path)
}
