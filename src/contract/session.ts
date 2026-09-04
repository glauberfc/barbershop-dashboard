import { z } from 'zod'

import { membershipSchema } from './membership'

/**
 * What an Account offers to prove who it is. Per ADR-0003 this schema is
 * parsed in two places — the login form before it submits, and the handler
 * before it looks anything up — so the two can never disagree about what
 * counts as valid input. The messages are written for the person reading them
 * because the form has nowhere else to get them from.
 */
export const credentialsSchema = z.object({
  // Lowercased here rather than in either caller, so that the form and the
  // handler cannot disagree about whether ANA@… and ana@… are the same
  // Account. Email domains are case-insensitive, and a phone that capitalises
  // the first letter should not be able to lock someone out.
  email: z.email('Enter an email address.').toLowerCase(),
  // Deliberately not trimmed. Trimming is right for an address and wrong for a
  // secret: a password with an outer space would be altered before it was ever
  // sent, and could then never be typed correctly.
  password: z.string().min(1, 'Enter your password.'),
})

export type Credentials = z.infer<typeof credentialsSchema>

/**
 * An Account as the API describes it. There is no password here, and that
 * absence is load-bearing: the handler serialises the stored record through
 * this schema, and `z.object` strips what it does not name, so the mock's
 * password column cannot reach the wire even by accident.
 */
export const accountSchema = z.object({
  id: z.string(),
  email: z.email(),
})

export type Account = z.infer<typeof accountSchema>

/**
 * What `GET /api/session` returns for a signed-in Account. An object rather
 * than the bare Account, so that the Memberships it carries sit alongside it
 * without changing the shape of what already exists.
 */
export const sessionSchema = z.object({
  account: accountSchema,
  memberships: z.array(membershipSchema),
})

export type Session = z.infer<typeof sessionSchema>
