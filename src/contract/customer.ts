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

/**
 * An empty field and an absent one are the same "no email on file" to a form:
 * `FormData` reads an empty `<input>` back as `''`, never as `undefined`. This
 * is what lets `createCustomerSchema` parse either without the form having to
 * know the difference.
 */
const optionalEmail = z.preprocess(
  (value) => (value === '' || value == null ? undefined : value),
  z.email('Enter a valid email address.').optional(),
)

/**
 * What `POST /api/shops/:shopId/customers` takes. No `id` and no `shopId`:
 * the mock assigns the first, and the second is already the address the
 * request was sent to — repeating it in the body would be one more place for
 * the two to disagree. Parsed by the Customers form before it submits and by
 * the handler before it creates a row, so the two can never accept different
 * things.
 */
export const createCustomerSchema = z.object({
  name: z.string().min(1, 'Enter a name.'),
  phone: z.string().min(1, 'Enter a phone number.'),
  email: optionalEmail,
})

export type CreateCustomer = z.infer<typeof createCustomerSchema>
