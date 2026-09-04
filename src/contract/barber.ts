import { z } from 'zod'

/**
 * A member of staff at one Shop, per `CONTEXT.md`. Working Hours are added to
 * this schema by Slot computation, which is the first module that needs them.
 */
export const barberSchema = z.object({
  id: z.string(),
  shopId: z.string(),
  name: z.string(),
})

export type Barber = z.infer<typeof barberSchema>
