import { describe, expect, it } from 'vitest'

import { dayRangeUtc, shiftDate } from './day-range'

describe('dayRangeUtc', () => {
  it('spans exactly 24 hours on an ordinary day', () => {
    const { from, to } = dayRangeUtc('2026-09-10', 'Europe/Lisbon')

    expect(new Date(to).getTime() - new Date(from).getTime()).toBe(24 * 60 * 60 * 1000)
  })

  it('spans 23 hours on the day the Shop springs forward, per ADR-0002', () => {
    // The last Sunday of March 2026 — Portugal's clocks move forward at 01:00
    // UTC, so the day is one hour shorter in wall-clock terms.
    const { from, to } = dayRangeUtc('2026-03-29', 'Europe/Lisbon')

    expect(from).toBe('2026-03-29T00:00:00.000Z')
    expect(to).toBe('2026-03-29T23:00:00.000Z')
  })

  it('spans 25 hours on the day the Shop falls back', () => {
    // The last Sunday of October 2026.
    const { from, to } = dayRangeUtc('2026-10-25', 'Europe/Lisbon')

    expect(from).toBe('2026-10-24T23:00:00.000Z')
    expect(to).toBe('2026-10-26T00:00:00.000Z')
  })
})

describe('shiftDate', () => {
  it('moves forward and back by whole days', () => {
    expect(shiftDate('2026-09-10', 1)).toBe('2026-09-11')
    expect(shiftDate('2026-09-10', -1)).toBe('2026-09-09')
  })

  it('rolls over a month and a year boundary', () => {
    expect(shiftDate('2026-09-30', 1)).toBe('2026-10-01')
    expect(shiftDate('2025-12-31', 1)).toBe('2026-01-01')
  })
})
