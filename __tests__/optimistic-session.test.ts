import { describe, expect, it } from 'vitest'
import {
  optimisticallyClearAllTables,
  optimisticallyClearTable,
  optimisticallyRemovePlayer,
  optimisticallySeatPlayer,
} from '@/lib/optimistic-session'

const session = {
  id: 'session-1',
  tableCount: 2,
  participants: ['a', 'b', 'c', 'd', 'e'],
  tables: { '1': ['a', 'b'], '2': ['c', 'd'] },
  sideline: ['e'],
}

describe('optimistic session layouts', () => {
  it('seats a player immediately and removes their previous assignment', () => {
    const next = optimisticallySeatPlayer(session, '1', 'c')

    expect(next.tables).toEqual({ '1': ['a', 'b', 'c'], '2': ['d'] })
    expect(next.sideline).toEqual(['e'])
    expect(session.tables).toEqual({ '1': ['a', 'b'], '2': ['c', 'd'] })
  })

  it('moves removed players to the sideline without duplicates', () => {
    const next = optimisticallyRemovePlayer(session, '1', 'a')
    const repeated = optimisticallyRemovePlayer(next, '1', 'a')

    expect(repeated.tables['1']).toEqual(['b'])
    expect(repeated.sideline).toEqual(['e', 'a'])
  })

  it('clears one table or every table while preserving all participants', () => {
    expect(optimisticallyClearTable(session, '1')).toMatchObject({
      tables: { '1': [], '2': ['c', 'd'] },
      sideline: ['e', 'a', 'b'],
    })
    expect(optimisticallyClearAllTables(session)).toMatchObject({
      tables: { '1': [], '2': [] },
      sideline: ['e', 'a', 'b', 'c', 'd'],
    })
  })
})
