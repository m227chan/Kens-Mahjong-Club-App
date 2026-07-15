import { describe, expect, it } from 'vitest'
import { calculateSkillRound, displayedSkill, initialSkillState, SKILL_PROVISIONAL_GAMES } from '../lib/skill-rating'

describe('experience-aware skill rating', () => {
  it('starts every player at a neutral displayed rating', () => {
    expect(displayedSkill(initialSkillState())).toBe(1500)
  })

  it('uses placement rather than score margin', () => {
    const state = initialSkillState()
    const small = calculateSkillRound([
      { playerId: 'a', score: 8, ...state }, { playerId: 'b', score: 0, ...state }, { playerId: 'c', score: 0, ...state }, { playerId: 'd', score: -8, ...state }
    ])
    const large = calculateSkillRound([
      { playerId: 'a', score: 384, ...state }, { playerId: 'b', score: 0, ...state }, { playerId: 'c', score: 0, ...state }, { playerId: 'd', score: -384, ...state }
    ])
    expect(large.map((result) => result.delta)).toEqual(small.map((result) => result.delta))
  })

  it('reduces evidence for an established player facing provisional opponents', () => {
    const initial = initialSkillState()
    const established = { ...initial, gamesPlayed: SKILL_PROVISIONAL_GAMES, sigma: 3 }
    const protectedResult = calculateSkillRound([
      { playerId: 'veteran', score: 8, ...established },
      { playerId: 'new-1', score: 0, ...initial }, { playerId: 'new-2', score: 0, ...initial }, { playerId: 'new-3', score: -8, ...initial }
    ]).find((result) => result.playerId === 'veteran')!
    const normalResult = calculateSkillRound([
      { playerId: 'veteran', score: 8, ...established },
      ...['a', 'b', 'c'].map((playerId, index) => ({ playerId, score: index === 2 ? -8 : 0, ...established }))
    ]).find((result) => result.playerId === 'veteran')!
    expect(Math.abs(protectedResult.delta)).toBeLessThan(Math.abs(normalResult.delta))
  })
})
