import { describe, expect, it } from 'vitest'
import {
  MAX_SESSION_TABLES,
  clampSessionTableCount,
  createInitialSessionLayout,
  normalizeSessionLayout,
} from '../lib/session-layout'

describe('session layouts', () => {
  it('limits sessions to 99 tables', () => {
    expect(clampSessionTableCount(100)).toBe(MAX_SESSION_TABLES)
    expect(Object.keys(createInitialSessionLayout([], 100).tables)).toHaveLength(MAX_SESSION_TABLES)
    expect(Object.keys(normalizeSessionLayout([], 100).tables)).toHaveLength(MAX_SESSION_TABLES)
  })

  it('starts every selected player on the sideline', () => {
    expect(createInitialSessionLayout(['a', 'b', 'c', 'd', 'e'], 2)).toEqual({
      tables: { '1': [], '2': [] },
      sideline: ['a', 'b', 'c', 'd', 'e'],
    })
  })

  it('recovers sessions created with legacy auto-seated table keys', () => {
    expect(
      normalizeSessionLayout(
        ['a', 'b', 'c', 'd', 'e'],
        2,
        {
          table_1: ['a', 'b', 'c'],
          table_2: ['d', 'e'],
        },
        [],
      ),
    ).toEqual({
      tables: { '1': [], '2': [] },
      sideline: ['a', 'b', 'c', 'd', 'e'],
    })
  })

  it('keeps numeric table assignments and recovers only unassigned players', () => {
    expect(
      normalizeSessionLayout(
        ['a', 'b', 'c', 'd', 'e'],
        2,
        {
          '1': ['a', 'b'],
          '2': ['c', 'd'],
        },
        [],
      ),
    ).toEqual({
      tables: { '1': ['a', 'b'], '2': ['c', 'd'] },
      sideline: ['e'],
    })
  })

  it('drops unknown and duplicate players and limits each table to four seats', () => {
    expect(
      normalizeSessionLayout(
        ['a', 'b', 'c', 'd', 'e', 'f'],
        2,
        {
          '1': ['a', 'b', 'c', 'd', 'e', 'unknown'],
          '2': ['a', 'e'],
        },
        ['unknown', 'f'],
      ),
    ).toEqual({
      tables: { '1': ['a', 'b', 'c', 'd'], '2': ['e'] },
      sideline: ['f'],
    })
  })
})
