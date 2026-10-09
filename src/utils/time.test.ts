import { describe, expect, it } from 'vitest'
import { formatDuration, formatDurationShort, formatDurationWithSeconds, nowMinutes, toMinutes } from './time'

describe('toMinutes', () => {
  it('converts an HH:MM wall-clock string to minutes since midnight', () => {
    expect(toMinutes('09:00')).toBe(540)
    expect(toMinutes('00:00')).toBe(0)
    expect(toMinutes('23:59')).toBe(1439)
  })
})

describe('nowMinutes', () => {
  it('includes a fractional minute for seconds', () => {
    const date = new Date(2026, 7, 28, 9, 30, 30)
    expect(nowMinutes(date)).toBeCloseTo(9 * 60 + 30.5, 5)
  })
})

describe('formatDuration', () => {
  it('formats under an hour as minutes', () => {
    expect(formatDuration(45)).toBe('45 min')
  })

  it('pads hours and minutes above an hour', () => {
    expect(formatDuration(90)).toBe('01h 30')
    expect(formatDuration(180)).toBe('03h 00')
  })

  it('clamps negative durations to zero', () => {
    expect(formatDuration(-10)).toBe('0 min')
  })
})

describe('formatDurationShort', () => {
  it('drops the minutes when they are zero', () => {
    expect(formatDurationShort(180)).toBe('3h')
  })

  it('keeps unpadded minutes when present', () => {
    expect(formatDurationShort(90)).toBe('1h30')
  })

  it('stays in minutes under an hour', () => {
    expect(formatDurationShort(45)).toBe('45 min')
  })
})

describe('formatDurationWithSeconds', () => {
  it('formats under an hour as m:ss', () => {
    expect(formatDurationWithSeconds(1.5)).toBe('1:30')
  })

  it('formats an hour or more as h:mm:ss', () => {
    expect(formatDurationWithSeconds(61)).toBe('1:01:00')
  })
})
