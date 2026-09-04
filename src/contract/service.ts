import { z } from 'zod'

/**
 * Something a Shop sells that takes time, per `CONTEXT.md`. Its duration is
 * what an Appointment's end is derived from — an Appointment never stores its
 * own end.
 */
export const serviceSchema = z.object({
  id: z.string(),
  shopId: z.string(),
  name: z.string(),
  durationMinutes: z.number().int().positive(),
})

export type Service = z.infer<typeof serviceSchema>
