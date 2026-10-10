import { describe, expect, it } from 'vitest'
import {
  applyTableWindPatch,
  continueWindsAfterRosterChange,
  initTableWinds,
  nextWindState,
  normalizeTableWindState,
  reconcileTableWindsMap,
  seatReplacementOrder,
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
  it('initializes East round with chosen starter seat as dealer', () => {
    const state = initTableWinds('p3', seats)
    expect(state).toEqual({
      roundWind: 'east',
      dealerPlayerId: 'p3',
      roundStarterSeatIndex: 2,
      handNumber: 1,
      seatOrder: seats,
    })
    expect(seatWindForPlayer(state, 'p3')).toBe('east')
    expect(seatWindForPlayer(state, 'p4')).toBe('south')
    expect(seatWindForPlayer(state, 'p1')).toBe('west')
    expect(seatWindForPlayer(state, 'p2')).toBe('north')
  })

  it('migrates legacy player-based starter ids to seat indexes', () => {
    const normalized = normalizeTableWindState({
      roundWind: 'east',
      dealerPlayerId: 'p1',
      roundStarterPlayerId: 'p3',
      handNumber: 2,
      seatOrder: seats,
    })
    expect(normalized?.roundStarterSeatIndex).toBe(2)
    expect(normalized && 'roundStarterPlayerId' in normalized).toBe(false)
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

  it('advances round wind after a full dealer cycle back to the starter seat', () => {
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
    expect(next.state.roundStarterSeatIndex).toBe(0)
    expect(next.state.handNumber).toBe(5)
  })

  it('continues winds after a roster swap when dealer remains seated', () => {
    const state = initTableWinds('p1', seats)
    const continued = continueWindsAfterRosterChange(state, ['p1', 'p5', 'p3', 'p4'])
    expect(continued?.dealerPlayerId).toBe('p1')
    expect(continued?.roundStarterSeatIndex).toBe(0)
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

  it('keeps the starter seat when a substituted player inherits dealer', () => {
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
      roundStarterSeatIndex: 0,
      handNumber: 6,
      seatOrder: ['p5', 'p2', 'p3', 'p4'],
    })
  })

  it('preserves the vacated seat index when a substitute is appended in live order', () => {
    const state = initTableWinds('p1', seats)
    const paused = continueWindsAfterRosterChange(state, ['p1', 'p2', 'p4'])
    const continued = continueWindsAfterRosterChange(paused!, [
      'p1',
      'p2',
      'p4',
      'p9',
    ])
    expect(continued).toEqual({
      roundWind: 'east',
      dealerPlayerId: 'p1',
      roundStarterSeatIndex: 0,
      handNumber: 1,
      seatOrder: ['p1', 'p2', 'p9', 'p4'],
    })
  })

  it('uses live seat order when a one-for-one change also reshuffles the table', () => {
    const state = {
      ...initTableWinds('p1', seats),
      dealerPlayerId: 'p2',
      handNumber: 3,
    }
    const shuffled = continueWindsAfterRosterChange(state, [
      'p3',
      'p5',
      'p2',
      'p1',
    ])
    expect(shuffled).toEqual({
      roundWind: 'east',
      dealerPlayerId: 'p2',
      roundStarterSeatIndex: 0,
      handNumber: 3,
      seatOrder: ['p3', 'p5', 'p2', 'p1'],
    })
  })

  it('moves East with the seat when two seated players swap', () => {
    const state = initTableWinds('p1', seats)
    const swapped = continueWindsAfterRosterChange(state, ['p2', 'p1', 'p3', 'p4'])
    expect(swapped).toEqual({
      roundWind: 'east',
      dealerPlayerId: 'p2',
      roundStarterSeatIndex: 0,
      handNumber: 1,
      seatOrder: ['p2', 'p1', 'p3', 'p4'],
    })
    expect(seatWindForPlayer(swapped!, 'p2')).toBe('east')
    expect(seatWindForPlayer(swapped!, 'p1')).toBe('south')
  })

  it('keeps the starter seat when the same four are fully reshuffled', () => {
    const state = {
      ...initTableWinds('p1', seats),
      dealerPlayerId: 'p3',
      handNumber: 4,
    }
    const reshuffled = continueWindsAfterRosterChange(state, [
      'p4',
      'p3',
      'p1',
      'p2',
    ])
    expect(reshuffled).toEqual({
      roundWind: 'east',
      dealerPlayerId: 'p3',
      roundStarterSeatIndex: 0,
      handNumber: 4,
      seatOrder: ['p4', 'p3', 'p1', 'p2'],
    })
  })

  it('keeps round starter on the seat when non-East seats rearrange', () => {
    const state = {
      ...initTableWinds('p1', seats),
      dealerPlayerId: 'p3',
      handNumber: 3,
    }
    const swapped = continueWindsAfterRosterChange(state, ['p1', 'p4', 'p3', 'p2'])
    expect(swapped?.dealerPlayerId).toBe('p3')
    expect(swapped?.roundStarterSeatIndex).toBe(0)
    expect(swapped?.seatOrder).toEqual(['p1', 'p4', 'p3', 'p2'])
  })

  it('heals a stale dealer mid-advance so round wind can still change', () => {
    const drifted = {
      ...initTableWinds('p1', seats),
      dealerPlayerId: 'p4',
      handNumber: 4,
      seatOrder: seats,
    }
    const next = nextWindState({
      mode: 'non_dealer_and_draw',
      outcome: 'discard',
      winnerPlayerId: 'p2',
      state: drifted,
      liveSeatOrder: ['p1', 'p2', 'p3', 'p5'],
    })
    expect(next.rotated).toBe(true)
    expect(next.advancedRound).toBe(true)
    expect(next.state.roundWind).toBe('south')
    expect(next.state.dealerPlayerId).toBe('p1')
    expect(next.state.roundStarterSeatIndex).toBe(0)
  })

  it('fills the vacated chair instead of appending on seatReplacementOrder', () => {
    expect(seatReplacementOrder(seats, ['p1', 'p2', 'p4'], 'p9')).toEqual([
      'p1',
      'p2',
      'p9',
      'p4',
    ])
    expect(seatReplacementOrder(undefined, ['p1', 'p2', 'p3'], 'p9')).toEqual([
      'p1',
      'p2',
      'p3',
      'p9',
    ])
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
      roundStarterSeatIndex: 0,
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
      roundStarterSeatIndex: 0,
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
    expect(patched.roundStarterSeatIndex).toBe(0)
    expect(patched.handNumber).toBe(1)
    expect(seatWindForPlayer(patched, 'p3')).toBe('east')
  })

  it('advances when a new occupant sits in the starter seat after a sub', () => {
    const state = {
      ...initTableWinds('p1', seats),
      dealerPlayerId: 'p4',
      handNumber: 4,
    }
    const afterSub = continueWindsAfterRosterChange(state, [
      'p5',
      'p2',
      'p3',
      'p4',
    ])!
    expect(afterSub.roundStarterSeatIndex).toBe(0)
    const next = nextWindState({
      mode: 'non_dealer_and_draw',
      outcome: 'draw',
      winnerPlayerId: null,
      state: afterSub,
    })
    expect(next.advancedRound).toBe(true)
    expect(next.state.dealerPlayerId).toBe('p5')
    expect(next.state.roundWind).toBe('south')
    expect(next.state.roundStarterSeatIndex).toBe(0)
  })
})
