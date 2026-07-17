import { describe, expect, it } from 'vitest'

import { realtimeChannelName } from '@/lib/realtime-channel'

describe('Realtime channel names', () => {
  it('creates a unique topic for every subscription instance', () => {
    const names = Array.from({ length: 100 }, () =>
      realtimeChannelName('players:CLUB1'),
    )

    expect(new Set(names)).toHaveLength(names.length)
    expect(names.every((name) => name.startsWith('players:CLUB1:'))).toBe(true)
  })
})
