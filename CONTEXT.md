# Barbershop Platform

A multi-tenant scheduling platform for barbershops. Shops manage their barbers'
calendars and their own client records; customers eventually book their own
appointments. Every shop's data is private to that shop.

## Language

### Identity

**Account**:
An authentication identity on the platform — one email address and password.
An Account is not a person's role; it is only how someone proves who they are.
_Avoid_: User, Login, Profile

**Membership**:
The link that gives one Account access to one Shop, carrying the role it holds
there: Owner or Barber. An Account may hold several Memberships, which is how
one person runs two locations with one login.
_Avoid_: Role, Permission, Access, Seat

**Barber**:
A member of staff at one Shop, with their own calendar and working hours.
Linked to an Account.
_Avoid_: User, Staff, Employee, Stylist

**Owner**:
The role of a Membership that may see every Barber's calendar and manage the
Shop's staff and Services. An Owner need not cut hair, and so need not be a
Barber.
_Avoid_: Admin, Manager, Superuser

**Customer**:
One Shop's record of a person it cuts hair for — their name, contact details
and appointment history. Scoped to a single Shop and never shared between
Shops, even when the same human visits two of them. May be linked to an
Account, but does not have to be.
_Avoid_: User, Client, Guest, Patron

### Scheduling

**Shop**:
A single barbershop location. The tenant boundary: all Barbers, Customers,
Services and Appointments belong to exactly one Shop.
_Avoid_: Tenant, Salon, Store, Business, Organisation

**Service**:
Something a Shop sells that takes time and has a price — a haircut, a beard
trim. Its duration is what determines how long an Appointment lasts.
_Avoid_: Treatment, Product, Offering, Item

**Appointment**:
A commitment that one Barber will perform one Service for one Customer,
starting at a known instant. Either Scheduled or Cancelled.
_Avoid_: Booking, Reservation, Slot, Visit, Event

**Working Hours**:
The recurring weekly pattern of when a Barber is available to take
Appointments, expressed in the Shop's local wall-clock time.
_Avoid_: Availability, Schedule, Shift, Roster

**Slot**:
A start time at which a given Service could be booked with a given Barber —
derived by subtracting existing Appointments from Working Hours. A Slot is
computed, never stored.
_Avoid_: Opening, Gap, Availability
