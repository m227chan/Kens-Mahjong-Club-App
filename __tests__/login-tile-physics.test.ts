import { describe, expect, it } from 'vitest'
import {
  clampPhysicsDelta,
  stepTilePhysics,
  type TilePhysicsBody,
} from '../lib/login-tile-physics'

const bounds = { width: 200, height: 120 }

const body = (
  overrides: Partial<TilePhysicsBody> = {},
): TilePhysicsBody => ({
  x: 50,
  y: 50,
  vx: 0,
  vy: 0,
  radius: 10,
  ...overrides,
})

describe('login tile physics', () => {
  it('clamps long and invalid frame deltas', () => {
    expect(clampPhysicsDelta(1)).toBeCloseTo(1 / 30)
    expect(clampPhysicsDelta(-1)).toBe(0)
    expect(clampPhysicsDelta(Number.NaN)).toBe(0)
    expect(clampPhysicsDelta(1, 1 / 60)).toBeCloseTo(1 / 60)
  })

  it('advances a body using seconds and leaves its input untouched', () => {
    const input = [body({ vx: 60 })]

    const result = stepTilePhysics(input, bounds, 1, {
      linearDamping: 0,
    })

    expect(result[0].x).toBeCloseTo(52)
    expect(input[0]).toEqual(body({ vx: 60 }))
    expect(result[0]).not.toBe(input[0])
  })

  it('bounces a tile off world boundaries using its collision radius', () => {
    const [result] = stepTilePhysics(
      [body({ x: 189, y: 11, vx: 180, vy: -180 })],
      bounds,
      1 / 120,
      { linearDamping: 0, wallRestitution: 0.5 },
    )

    expect(result.x).toBe(190)
    expect(result.y).toBe(10)
    expect(result.vx).toBeCloseTo(-90)
    expect(result.vy).toBeCloseTo(90)
  })

  it('exchanges velocity in an elastic equal-mass collision', () => {
    const [first, second] = stepTilePhysics(
      [
        body({ x: 50, vx: 60 }),
        body({ x: 69, vx: -60 }),
      ],
      bounds,
      0,
      { linearDamping: 0, restitution: 1 },
    )

    expect(first.vx).toBeCloseTo(-60)
    expect(second.vx).toBeCloseTo(60)
    expect(Math.hypot(second.x - first.x, second.y - first.y)).toBeCloseTo(20)
  })

  it('uses body mass when sharing collision impulse', () => {
    const [light, heavy] = stepTilePhysics(
      [
        body({ x: 50, vx: 100, mass: 1 }),
        body({ x: 69, mass: 3 }),
      ],
      bounds,
      0,
      { linearDamping: 0, restitution: 1 },
    )

    expect(light.vx).toBeCloseTo(-50)
    expect(heavy.vx).toBeCloseTo(50)
  })

  it('keeps a dragged tile fixed while its pointer motion strikes another tile', () => {
    const [dragged, struck] = stepTilePhysics(
      [body({ x: 20 }), body({ x: 99 })],
      bounds,
      0,
      {
        linearDamping: 0,
        restitution: 0.5,
        dragged: { index: 0, x: 80, y: 50, vx: 120, vy: 0 },
      },
    )

    expect(dragged).toMatchObject({ x: 80, y: 50, vx: 120, vy: 0 })
    expect(struck.x).toBe(100)
    expect(struck.vx).toBeCloseTo(180)
  })

  it('retains drag velocity so the released tile continues as a flick', () => {
    const [whileDragged] = stepTilePhysics([body()], bounds, 1 / 60, {
      linearDamping: 0,
      dragged: { index: 0, x: 80, y: 70, vx: 120, vy: -60 },
    })
    const [released] = stepTilePhysics([whileDragged], bounds, 1 / 60, {
      linearDamping: 0,
    })

    expect(released.x).toBeCloseTo(82)
    expect(released.y).toBeCloseTo(69)
  })

  it('corrects and bounces a tile at a static obstacle edge', () => {
    const [result] = stepTilePhysics(
      [body({ x: 49, y: 60, vx: 240 })],
      bounds,
      1 / 120,
      {
        linearDamping: 0,
        obstacleRestitution: 0.5,
        obstacles: [{ left: 60, top: 20, right: 100, bottom: 100 }],
      },
    )

    expect(result.x).toBe(50)
    expect(result.y).toBe(60)
    expect(result.vx).toBeCloseTo(-120)
  })

  it('uses adaptive substeps to stop fast tiles crossing protected content', () => {
    const [result] = stepTilePhysics(
      [body({ x: 20, y: 60, vx: 6_000 })],
      bounds,
      1 / 30,
      {
        linearDamping: 0,
        obstacleRestitution: 0.5,
        obstacles: [{ left: 90, top: 20, right: 110, bottom: 100 }],
      },
    )

    expect(result.x).toBeLessThanOrEqual(80)
    expect(result.vx).toBeLessThan(0)
  })

  it('chooses a world-feasible side when centered inside a wide obstacle', () => {
    const [result] = stepTilePhysics(
      [body({ x: 100, y: 60 })],
      bounds,
      0,
      {
        linearDamping: 0,
        obstacles: [{ left: 0, top: 50, right: 200, bottom: 70 }],
      },
    )

    expect(result.x).toBe(100)
    expect(result.y).toBe(40)
  })

  it('does not allow a dragged tile to be placed over an obstacle', () => {
    const [result] = stepTilePhysics([body({ x: 30 })], bounds, 0, {
      linearDamping: 0,
      obstacles: [{ left: 80, top: 30, right: 120, bottom: 90 }],
      dragged: { index: 0, x: 100, y: 60, vx: 120, vy: 0 },
    })

    expect(result.x).toBe(70)
    expect(result.y).toBe(60)
    expect(result.vx).toBeCloseTo(-86.4)
  })

  it('separates coincident bodies deterministically without non-finite values', () => {
    const result = stepTilePhysics(
      [body(), body()],
      bounds,
      0,
      { linearDamping: 0 },
    )

    expect(result[0].x).toBe(40)
    expect(result[1].x).toBe(60)
    expect(result.flatMap(({ x, y, vx, vy }) => [x, y, vx, vy]).every(Number.isFinite)).toBe(true)
  })
})
