import { z } from 'zod'

/**
 * The contract for a Shop. Per ADR-0003 this schema is the single source of
 * truth: the mock handler serialises through it, the query layer parses
 * responses with it, and the TypeScript type is inferred from it rather than
 * written alongside it.
 */
export const shopSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** IANA timezone. Per ADR-0002, the Shop's day is rendered in this zone. */
  timezone: z.string(),
})

export type Shop = z.infer<typeof shopSchema>
