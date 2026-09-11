import { describe, expect, it } from 'vitest'
import {
  applyTableWindPatch,
  continueWindsAfterRosterChange,
  initTableWinds,
  nextWindState,
  reconcileTableWindsMap,
  seatWindForPlayer,
  seatWindsForOrder,
  shouldRotateWinds,
} from '@/lib/table-winds'
import {
  DEFAULT_WIND_ROTATION_SETTINGS,
  validateWindRotationSettings,
  windRotationSettingsFromRow,
} from '@/lib/wind-rotation-settings'

const seats = ['p1', 'p2', 'p3', 'p4']

describe('wind rotation settings', () => {
  it('defaults to non-dealer win + draw', () => {
    expect(DEFAULT_WIND_ROTATION_SETTINGS.mode).toBe('non_dealer_and_draw')
    expect(windRotationSettingsFromRow({})).toEqual(DEFAULT_WIND_ROTATION_SETTINGS)
  })

  it('validates known modes only', () => {
    expect(validateWindRotationSettings({ mode: 'always' })).toEqual({ mode: 'always' })
    expect(() => validateWindRotationSettings({ mode: 'nope' })).toThrow(/valid wind rotation/)
  })
})

describe('table winds', () => {
  it('initializes East round with chosen starter as dealer', () => {
    const state = initTableWinds('p3', seats)
    expect(state).toEqual({
      roundWind: 'east',
      dealerPlayerId: 'p3',
      roundStarterPlayerId: 'p3',
      handNumber: 1,
      seatOrder: seats,
    })
    expect(seatWindForPlayer(state, 'p3')).toBe('east')
    expect(seatWindForPlayer(state, 'p4')).toBe('south')
    expect(seatWindForPlayer(state, 'p1')).toBe('west')
    expect(seatWindForPlayer(state, 'p2')).toBe('north')
  })

  it('rotates on non-dealer win and draw for the default mode', () => {
    expect(
      shouldRotateWinds({
        mode: 'non_dealer_and_draw',
        outcome: 'self_draw',
        winnerPlayerId: 'p2',
        dealerPlayerId: 'p1',
      }),
    ).toBe(true)
    expect(
      shouldRotateWinds({
        mode: 'non_dealer_and_draw',
        outcome: 'draw',
        winnerPlayerId: null,
        dealerPlayerId: 'p1',
      }),
    ).toBe(true)
    expect(
      shouldRotateWinds({
        mode: 'non_dealer_and_draw',
        outcome: 'self_draw',
        winnerPlayerId: 'p1',
        dealerPlayerId: 'p1',
      }),
    ).toBe(false)
  })

  it('keeps winds on draw when mode is non_dealer_only', () => {
    expect(
      shouldRotateWinds({
        mode: 'non_dealer_only',
        outcome: 'draw',
        winnerPlayerId: null,
        dealerPlayerId: 'p1',
      }),
    ).toBe(false)
  })

  it('advances round wind after a full dealer cycle', () => {
    const state = initTableWinds('p1', seats)
    const afterNorth = {
      ...state,
      dealerPlayerId: 'p4',
      handNumber: 4,
    }
    const next = nextWindState({
      mode: 'non_dealer_and_draw',
      outcome: 'discard',
      winnerPlayerId: 'p2',
      state: afterNorth,
    })
    expect(next.rotated).toBe(true)
    expect(next.advancedRound).toBe(true)
    expect(next.state.dealerPlayerId).toBe('p1')
    expect(next.state.roundWind).toBe('south')
    expect(next.state.roundStarterPlayerId).toBe('p1')
    expect(next.state.handNumber).toBe(5)
  })

  it('continues winds after a roster swap when dealer remains seated', () => {
    const state = initTableWinds('p1', seats)
    const continued = continueWindsAfterRosterChange(state, ['p1', 'p5', 'p3', 'p4'])
    expect(continued?.dealerPlayerId).toBe('p1')
    expect(continued?.seatOrder).toEqual(['p1', 'p5', 'p3', 'p4'])
  })

  it('pauses winds while the table is short a player', () => {
    const state = {
      ...initTableWinds('p1', seats),
      roundWind: 'south' as const,
      handNumber: 3,
    }
    const paused = continueWindsAfterRosterChange(state, ['p1', 'p2', 'p3'])
    expect(paused).toEqual(state)
  })

  it('lets a swapped-in player inherit the departed seat wind roles', () => {
    const state = {
      ...initTableWinds('p1', seats),
      roundWind: 'west' as const,
      handNumber: 6,
    }
    const afterRemove = continueWindsAfterRosterChange(state, ['p2', 'p3', 'p4'])
    expect(afterRemove).toEqual(state)

    const afterSeat = continueWindsAfterRosterChange(afterRemove!, [
      'p5',
      'p2',
      'p3',
      'p4',
    ])
    expect(afterSeat).toEqual({
      roundWind: 'west',
      dealerPlayerId: 'p5',
      roundStarterPlayerId: 'p5',
      handNumber: 6,
      seatOrder: ['p5', 'p2', 'p3', 'p4'],
    })
  })

  it('keeps round and hand when a non-dealer is swapped', () => {
    const state = {
      ...initTableWinds('p1', seats),
      roundWind: 'south' as const,
      handNumber: 4,
    }
    const paused = continueWindsAfterRosterChange(state, ['p1', 'p2', 'p3'])
    const continued = continueWindsAfterRosterChange(paused!, [
      'p1',
      'p2',
      'p3',
      'p9',
    ])
    expect(continued).toEqual({
      roundWind: 'south',
      dealerPlayerId: 'p1',
      roundStarterPlayerId: 'p1',
      handNumber: 4,
      seatOrder: ['p1', 'p2', 'p3', 'p9'],
    })
  })

  it('clears continue state only for a completely new lineup', () => {
    const state = initTableWinds('p1', seats)
    expect(
      continueWindsAfterRosterChange(state, ['p5', 'p6', 'p7', 'p8']),
    ).toBeNull()
  })

  it('clears winds when a table is emptied', () => {
    const state = initTableWinds('p1', seats)
    expect(continueWindsAfterRosterChange(state, [])).toBeNull()
  })

  it('reconciles winds after a dashboard player move', () => {
    const map = {
      '1': {
        ...initTableWinds('p1', seats),
        roundWind: 'south' as const,
        handNumber: 3,
      },
    }
    const next = reconcileTableWindsMap(map, {
      '1': ['p5', 'p2', 'p3', 'p4'],
    })
    expect(next['1']).toEqual({
      roundWind: 'south',
      dealerPlayerId: 'p5',
      roundStarterPlayerId: 'p5',
      handNumber: 3,
      seatOrder: ['p5', 'p2', 'p3', 'p4'],
    })
  })

  it('still assigns distinct seat winds when the dealer left the table', () => {
    const winds = seatWindsForOrder('gone', seats)
    expect(winds).toEqual({
      p1: 'east',
      p2: 'south',
      p3: 'west',
      p4: 'north',
    })
  })

  it('patches table wind and dealer without restarting', () => {
    const state = initTableWinds('p1', seats)
    const patched = applyTableWindPatch(state, {
      roundWind: 'south',
      dealerPlayerId: 'p3',
    })
    expect(patched.roundWind).toBe('south')
    expect(patched.dealerPlayerId).toBe('p3')
    expect(patched.roundStarterPlayerId).toBe('p1')
    expect(patched.handNumber).toBe(1)
    expect(seatWindForPlayer(patched, 'p3')).toBe('east')
  })
})
