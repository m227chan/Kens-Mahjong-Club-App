import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TITLE_RULES,
  titleBandSizes,
  titleForRank,
  validateTitleRules,
  type TitleRules,
} from '@/lib/title-rules'

describe('club title rules', () => {
  it('preserves the existing proportional defaults', () => {
    expect(titleBandSizes(100, DEFAULT_TITLE_RULES)).toEqual([4, 7, 12, 17, 20, 17, 12, 7, 4])
    expect(titleForRank(1, 100, DEFAULT_TITLE_RULES)).toBe('Messiah')
    expect(titleForRank(100, 100, DEFAULT_TITLE_RULES)).toBe('Moron')
  })

  it('supports exact top and bottom counts with a remainder title', () => {
    const rules: TitleRules = {
      mode: 'count',
      bands: [
        { id: 'champion', title: 'Champion', value: 1 },
        { id: 'master', title: 'Master', value: 2 },
        { id: 'member', title: 'Member', value: 0, remainder: true },
        { id: 'student', title: 'Student', value: 2 },
        { id: 'novice', title: 'Novice', value: 1 },
      ],
    }
    expect(titleBandSizes(10, rules)).toEqual([1, 2, 4, 2, 1])
    expect(titleForRank(1, 10, rules)).toBe('Champion')
    expect(titleForRank(4, 10, rules)).toBe('Member')
    expect(titleForRank(10, 10, rules)).toBe('Novice')
  })

  it('validates proportional totals and one count-mode remainder', () => {
    expect(() => validateTitleRules({ mode: 'proportion', bands: [{ id: 'a', title: 'A', value: 90 }] })).toThrow(/100%/)
    expect(() => validateTitleRules({ mode: 'count', bands: [{ id: 'a', title: 'A', value: 1 }] })).toThrow(/exactly one title/i)
  })

  it('never creates negative bands for heavily rounded custom proportions', () => {
    const bands = Array.from({ length: 20 }, (_, index) => ({ id: `t${index}`, title: `T${index}`, value: 5 }))
    const sizes = titleBandSizes(10, { mode: 'proportion', bands })
    expect(sizes.every((size) => size >= 0)).toBe(true)
    expect(sizes.reduce((sum, size) => sum + size, 0)).toBe(10)
  })
})
