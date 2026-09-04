import { z } from 'zod'

/**
 * Scheduled or Cancelled, per `CONTEXT.md`. Cancellation is a status
 * transition — never a deletion, never a soft-delete flag — so that Slot
 * computation and conflict detection have exactly one thing to ignore.
 */
export const appointmentStatusSchema = z.enum(['scheduled', 'cancelled'])

export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>

/**
 * A commitment that one Barber will perform one Service for one Customer,
 * starting at a known instant. Per ADR-0002, `start` is a UTC instant — the
 * Shop's timezone is what the interface renders it through, not something
 * stored on the Appointment itself. There is no `end`: it is derived from the
 * Service's duration, which is looked up rather than stored, so a Service's
 * duration can never drift out of step with an Appointment already booked
 * against it.
 */
export const appointmentSchema = z.object({
  id: z.string(),
  shopId: z.string(),
  barberId: z.string(),
  customerId: z.string(),
  serviceId: z.string(),
  // `z.iso.datetime()` without `offset: true` requires the `Z` suffix, so
  // every instant on the wire is UTC — which is also what keeps the mock's
  // string-stored column sortable lexically in the same order as
  // chronologically, with no parsing needed to range-query it.
  start: z.iso.datetime(),
  status: appointmentStatusSchema,
})

export type Appointment = z.infer<typeof appointmentSchema>

/**
 * What `GET /api/shops/:shopId/appointments` takes: a UTC instant range, half
 * open. The day view converts the Shop's local calendar day to this range
 * through the Shop's timezone before asking, per ADR-0002 — the API itself
 * knows nothing about calendar days, only instants.
 */
export const appointmentRangeSchema = z.object({
  from: z.iso.datetime(),
  to: z.iso.datetime(),
})

export type AppointmentRange = z.infer<typeof appointmentRangeSchema>
