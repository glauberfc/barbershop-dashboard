import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'

import { apiGet } from '@/api/http'
import { appointmentSchema } from '@/contract/appointment'

/**
 * Every Barber's Appointments for a UTC instant range, in one request — per
 * ticket #6, never one request per Barber. The query key carries the range
 * literally, so a different day is a different cache entry rather than a
 * refetch of the same key with different data underneath it.
 */
export function appointmentsQueryOptions(shopId: string, range: { from: string; to: string }) {
  return queryOptions({
    queryKey: [shopId, 'appointments', range] as const,
    queryFn: () => {
      const params = new URLSearchParams({ from: range.from, to: range.to })

      return apiGet(
        `/api/shops/${encodeURIComponent(shopId)}/appointments?${params.toString()}`,
        z.array(appointmentSchema),
      )
    },
  })
}
