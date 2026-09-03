# Appointments are UTC instants; working hours are wall-clock

Shops can be in different timezones, so every Appointment stores a UTC instant
(`timestamptz`) and every Shop carries an IANA timezone used for display. But
Working Hours are deliberately *not* instants: "we open at 9am" is a recurring
wall-clock fact that stays 9am across a daylight-saving change, so they are
stored as a local time-of-day plus a weekday.

## Consequences

- Rendering and slot computation must convert through the Shop's timezone
  rather than the viewer's. A barber checking their calendar from holiday sees
  the shop's day, not their own.
- These are two different types and must not be assigned to one another. The
  DST bug this prevents is a shop silently opening an hour early twice a year.
- Chosen before any data existed, because retrofitting it makes every existing
  row ambiguous with no way to recover the intended meaning.
