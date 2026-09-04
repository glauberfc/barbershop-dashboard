import { z } from 'zod'

/**
 * The role a Membership carries. An Owner may see every Barber's calendar and
 * manage the Shop's staff and Services; a Barber sees its own day. Role lives
 * on Membership and never on Barber, per ADR-0001 — an Owner who does not cut
 * hair holds a Membership with no Barber record.
 */
export const membershipRoleSchema = z.enum(['owner', 'barber'])

export type MembershipRole = z.infer<typeof membershipRoleSchema>

/**
 * The link that gives one Account access to one Shop. An Account may hold
 * several, which is how one person runs two locations with one login — and how
 * the tenant boundary is proven to deny, since holding none for a Shop is what
 * that Shop being not-found to this Account means.
 */
export const membershipSchema = z.object({
  shopId: z.string(),
  role: membershipRoleSchema,
})

export type Membership = z.infer<typeof membershipSchema>
