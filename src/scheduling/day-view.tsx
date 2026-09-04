import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { formatInTimeZone } from 'date-fns-tz'

import type { Appointment } from '@/contract/appointment'
import { appointmentsQueryOptions } from '@/appointments/queries'
import { barbersQueryOptions } from '@/barbers/queries'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { customersQueryOptions } from '@/customers/queries'
import { servicesQueryOptions } from '@/services/queries'
import { type CalendarDate, dayRangeUtc, shiftDate, todayInShop } from './day-range'

/**
 * The Shop's day: every Barber's Appointments for one Shop-local calendar
 * date, grouped by Barber and ordered by start time. Four resources are read
 * in parallel and joined here rather than embedded in the Appointment
 * response, so that Barbers, Services and Customers stay resources of their
 * own — the same ones the booking flow in ticket #9 picks from.
 *
 * Navigation is a callback rather than a `Link` built in here, so this
 * component says nothing about which route it lives under or what its search
 * schema looks like — the route decides both.
 */
export function DayView({
  shopId,
  shopTimezone,
  date,
  onNavigate,
}: {
  shopId: string
  shopTimezone: string
  date: CalendarDate
  onNavigate: (date: CalendarDate) => void
}) {
  const range = dayRangeUtc(date, shopTimezone)

  const barbers = useQuery(barbersQueryOptions(shopId))
  const services = useQuery(servicesQueryOptions(shopId))
  const customers = useQuery(customersQueryOptions(shopId))
  const appointments = useQuery(appointmentsQueryOptions(shopId, range))

  const queries: UseQueryResult[] = [barbers, services, customers, appointments]
  const erroredQueries = queries.filter((query) => query.status === 'error')

  return (
    <section aria-label="Day" className="flex flex-col gap-4">
      <nav aria-label="Change day" className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => onNavigate(shiftDate(date, -1))}>
          Previous day
        </Button>
        <Button variant="outline" size="sm" onClick={() => onNavigate(todayInShop(shopTimezone))}>
          Today
        </Button>
        <Button variant="outline" size="sm" onClick={() => onNavigate(shiftDate(date, 1))}>
          Next day
        </Button>
      </nav>

      <h2 className="text-base font-semibold">
        {formatInTimeZone(range.from, shopTimezone, 'EEEE, d MMMM yyyy')}
      </h2>

      {erroredQueries.length > 0 ? (
        <div className="flex flex-col items-start gap-2">
          <p role="alert">Could not load the day.</p>
          <button
            type="button"
            className="underline underline-offset-4"
            onClick={() => erroredQueries.forEach((query) => query.refetch())}
          >
            Try again
          </button>
        </div>
      ) : barbers.data && services.data && customers.data && appointments.data ? (
        appointments.data.length === 0 ? (
          <p>Nothing booked for this day.</p>
        ) : (
          <DayGroupedByBarber
            shopTimezone={shopTimezone}
            appointments={appointments.data}
            barbers={barbers.data}
            services={services.data}
            customers={customers.data}
          />
        )
      ) : (
        <p>Loading the day…</p>
      )}
    </section>
  )
}

function DayGroupedByBarber({
  shopTimezone,
  appointments,
  barbers,
  services,
  customers,
}: {
  shopTimezone: string
  appointments: readonly Appointment[]
  barbers: readonly { id: string; name: string }[]
  services: readonly { id: string; name: string }[]
  customers: readonly { id: string; name: string }[]
}) {
  const serviceNameById = new Map(services.map((service) => [service.id, service.name]))
  const customerNameById = new Map(customers.map((customer) => [customer.id, customer.name]))

  const byBarber = new Map<string, Appointment[]>()
  for (const appointment of appointments) {
    const group = byBarber.get(appointment.barberId) ?? []
    group.push(appointment)
    byBarber.set(appointment.barberId, group)
  }
  for (const group of byBarber.values()) {
    group.sort((a, b) => a.start.localeCompare(b.start))
  }

  const barbersWithAppointments = barbers.filter((barber) => byBarber.has(barber.id))

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {barbersWithAppointments.map((barber) => (
        <Card key={barber.id}>
          <CardHeader>
            <CardTitle>
              <h3>{barber.name}</h3>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {byBarber.get(barber.id)!.map((appointment) => (
                <li
                  key={appointment.id}
                  className={
                    appointment.status === 'cancelled'
                      ? 'flex flex-col gap-0.5 text-muted-foreground line-through'
                      : 'flex flex-col gap-0.5'
                  }
                >
                  <span className="font-medium">
                    {formatInTimeZone(appointment.start, shopTimezone, 'HH:mm')}
                    {' — '}
                    {customerNameById.get(appointment.customerId) ?? 'Unknown Customer'}
                  </span>
                  <span className="text-sm text-muted-foreground no-underline">
                    {serviceNameById.get(appointment.serviceId) ?? 'Unknown Service'}
                    {appointment.status === 'cancelled' ? ' · Cancelled' : ''}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
