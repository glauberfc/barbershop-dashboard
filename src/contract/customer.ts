import { z } from 'zod'

/**
 * One Shop's record of a person it cuts hair for, per `CONTEXT.md`. Scoped to
 * a single Shop and never shared between Shops, even for the same human — see
 * ADR-0001.
 */
export const customerSchema = z.object({
  id: z.string(),
  shopId: z.string(),
  name: z.string(),
  phone: z.string(),
  email: z.email().optional(),
})

export type Customer = z.infer<typeof customerSchema>
