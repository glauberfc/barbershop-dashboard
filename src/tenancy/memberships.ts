import type { Session } from '@/contract/session'

/** Whether the session's Account holds a Membership in the given Shop. */
export function hasMembership(session: Session, shopId: string): boolean {
  return session.memberships.some((membership) => membership.shopId === shopId)
}

/**
 * The Shop to land an Account on when it asked for nothing in particular: its
 * one Shop, when it holds exactly one Membership, so that it is never asked to
 * choose from a list of one. `undefined` when there is a real choice to make,
 * or none at all.
 */
export function soleShopId(session: Session): string | undefined {
  return session.memberships.length === 1 ? session.memberships[0]?.shopId : undefined
}
