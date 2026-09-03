# Account is separate from Barber and Customer

The platform is multi-tenant and both staff and customers eventually log in, so
a single "user" table would have had to mean three different things at once: an
authentication identity, a member of staff at a shop, and a shop's record of a
person it cuts hair for. We split them. An **Account** is only an email and a
password. A **Barber** is staff at one Shop. A **Customer** is one Shop's record
of a person, and the same human visiting two Shops is two Customers linked to
one Account.

## Consequences

- Shops cannot see each other's notes about the same person. Tenant isolation
  falls out of the model rather than depending on every query remembering to
  filter.
- A Customer does not need an Account. Staff can book someone who has never
  used the app, which is how most appointments actually get made.
- An owner who does not cut hair is an Account with an Owner **Membership** and
  no Barber record. Role therefore lives on Membership, not on Barber.
- The word "user" is banned in this codebase. It cannot be used without
  ambiguity.
