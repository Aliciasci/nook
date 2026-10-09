import { describe, expect, it } from 'vitest'
import type { Item, TimeBlock } from '@/types'
import { actualMinutes, actualSecondsByDayItem, blockStatus, plannedMinutes, summarize } from './planning'

function makeBlock(overrides: Partial<TimeBlock> = {}): TimeBlock {
  return {
    id: 'block-1',
    itemId: 'item-1',
    title: 'Bloc',
    day: '2026-08-28',
    startMinute: 9 * 60,
    endMinute: 10 * 60,
    color: null,
    kind: 'travail',
    notes: null,
    ...overrides,
  }
}

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-1',
    folderId: null,
    type: 'task',
    title: 'Tâche',
    status: 'todo',
    archivedAt: null,
    createdAt: '2026-08-28T00:00:00.000Z',
    updatedAt: '2026-08-28T00:00:00.000Z',
    ...overrides,
  }
}

describe('actualSecondsByDayItem', () => {
  it('sums sessions by the calendar day the session started on', () => {
    const map = actualSecondsByDayItem([
      { item_id: 'a', started_at: '2026-08-28T09:00:00', actual_duration: 600 },
      { item_id: 'a', started_at: '2026-08-28T14:00:00', actual_duration: 300 },
      { item_id: 'a', started_at: '2026-08-29T09:00:00', actual_duration: 100 },
    ])
    expect(map.get('2026-08-28|a')).toBe(900)
    expect(map.get('2026-08-29|a')).toBe(100)
  })

  it('ignores sessions with no linked task', () => {
    const map = actualSecondsByDayItem([{ item_id: null, started_at: '2026-08-28T09:00:00', actual_duration: 600 }])
    expect(map.size).toBe(0)
  })
})

describe('plannedMinutes / actualMinutes', () => {
  it('computes planned minutes from the block bounds', () => {
    expect(plannedMinutes(makeBlock({ startMinute: 540, endMinute: 630 }))).toBe(90)
  })

  it('reads actual minutes for the block day+item, rounded from seconds', () => {
    const actual = new Map([['2026-08-28|item-1', 90]])
    expect(actualMinutes(makeBlock(), actual)).toBe(2)
  })

  it('is zero for a free block regardless of the actual map', () => {
    const actual = new Map([['2026-08-28|item-1', 600]])
    expect(actualMinutes(makeBlock({ itemId: null }), actual)).toBe(0)
  })
})

describe('blockStatus', () => {
  it('is free for a block with no linked task', () => {
    expect(blockStatus(makeBlock({ itemId: null }), undefined, 0)).toBe('free')
  })

  it('is kept when the task is done, even with zero actual time', () => {
    expect(blockStatus(makeBlock(), makeItem({ status: 'done' }), 0)).toBe('kept')
  })

  it('is missed when nothing was logged', () => {
    expect(blockStatus(makeBlock(), makeItem(), 0)).toBe('missed')
  })

  it('is kept once at least half the planned time was logged', () => {
    const block = makeBlock({ startMinute: 0, endMinute: 60 }) // 60 min planned
    expect(blockStatus(block, makeItem(), 30)).toBe('kept')
    expect(blockStatus(block, makeItem(), 29)).toBe('partial')
  })
})

describe('summarize', () => {
  it('tallies status counts, minutes and the planned-by-kind breakdown', () => {
    const blocks: TimeBlock[] = [
      makeBlock({ id: 'b1', itemId: 'a', kind: 'travail', startMinute: 0, endMinute: 60 }),
      makeBlock({ id: 'b2', itemId: 'b', kind: 'pause', startMinute: 0, endMinute: 30 }),
      makeBlock({ id: 'b3', itemId: null, kind: null, startMinute: 0, endMinute: 15 }),
    ]
    const items = new Map([
      ['a', makeItem({ id: 'a', status: 'done' })],
      ['b', makeItem({ id: 'b', status: 'todo' })],
    ])
    const actual = new Map<string, number>() // nothing logged for 'b'

    const summary = summarize(blocks, (id) => (id ? items.get(id) : undefined), actual)

    expect(summary.blockCount).toBe(3)
    expect(summary.plannedMin).toBe(60 + 30 + 15)
    expect(summary.kept).toBe(1) // b1, done
    expect(summary.missed).toBe(1) // b2, nothing logged
    expect(summary.freeBlocks).toBe(1) // b3
    expect(summary.plannedByKind.travail).toBe(60)
    expect(summary.plannedByKind.pause).toBe(30)
    expect(summary.plannedByKind.autre).toBe(15)
  })
})
