export interface TilePhysicsBody {
  /** Center position in world pixels. */
  x: number
  y: number
  /** Velocity in pixels per second. */
  vx: number
  vy: number
  /** Collision radius in pixels. The visual tile itself may remain rectangular. */
  radius: number
  /** Defaults to the area of the collision circle. */
  mass?: number
}

export interface TilePhysicsBounds {
  width: number
  height: number
}

export interface TilePhysicsObstacle {
  left: number
  top: number
  right: number
  bottom: number
}

export interface DraggedTile {
  index: number
  /** Center position supplied by the active pointer. */
  x: number
  y: number
  /** Pointer velocity in pixels per second, retained for a release flick. */
  vx: number
  vy: number
}

export interface TilePhysicsOptions {
  /** Tile-to-tile bounciness, from 0 (inelastic) to 1 (elastic). */
  restitution?: number
  /** World-edge bounciness, from 0 to 1. */
  wallRestitution?: number
  /** Static-obstacle bounciness. Defaults to wallRestitution. */
  obstacleRestitution?: number
  /** Exponential velocity decay per second. Set to 0 for no damping. */
  linearDamping?: number
  /** Maximum simulated time per animation frame, in seconds. */
  maxDeltaSeconds?: number
  /** Extra collision solver passes for crowded layouts. */
  collisionPasses?: number
  /** A pointer-controlled tile. It is kinematic while supplied. */
  dragged?: DraggedTile | null
  /** Protected world-space rectangles that tile circles cannot overlap. */
  obstacles?: readonly TilePhysicsObstacle[]
}

export const DEFAULT_MAX_DELTA_SECONDS = 1 / 30

const DEFAULT_RESTITUTION = 0.82
const DEFAULT_WALL_RESTITUTION = 0.72
const DEFAULT_LINEAR_DAMPING = 0.12
const DEFAULT_COLLISION_PASSES = 2
const MAX_SUBSTEP_SECONDS = 1 / 120
const MAX_SUBSTEPS = 48
const MAX_COLLISION_PASSES = 8
const MAX_STATIC_GEOMETRY_PASSES = 8
const MIN_RADIUS = 0.001
const MIN_MASS = 0.001

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

const finiteOr = (value: number, fallback: number) =>
  Number.isFinite(value) ? value : fallback

export function clampPhysicsDelta(
  deltaSeconds: number,
  maxDeltaSeconds = DEFAULT_MAX_DELTA_SECONDS,
) {
  const safeMaximum = Math.max(
    0,
    finiteOr(maxDeltaSeconds, DEFAULT_MAX_DELTA_SECONDS),
  )
  return clamp(finiteOr(deltaSeconds, 0), 0, safeMaximum)
}

function bodyMass(body: TilePhysicsBody) {
  if (body.mass !== undefined && Number.isFinite(body.mass)) {
    return Math.max(MIN_MASS, body.mass)
  }

  return Math.max(MIN_MASS, Math.PI * body.radius * body.radius)
}

function constrainToBounds(
  body: TilePhysicsBody,
  bounds: TilePhysicsBounds,
  wallRestitution: number,
  isDragged: boolean,
) {
  const diameter = body.radius * 2

  if (bounds.width <= diameter) {
    body.x = bounds.width / 2
    if (!isDragged) body.vx = 0
  } else if (body.x < body.radius) {
    body.x = body.radius
    if (!isDragged && body.vx < 0) body.vx = -body.vx * wallRestitution
  } else if (body.x > bounds.width - body.radius) {
    body.x = bounds.width - body.radius
    if (!isDragged && body.vx > 0) body.vx = -body.vx * wallRestitution
  }

  if (bounds.height <= diameter) {
    body.y = bounds.height / 2
    if (!isDragged) body.vy = 0
  } else if (body.y < body.radius) {
    body.y = body.radius
    if (!isDragged && body.vy < 0) body.vy = -body.vy * wallRestitution
  } else if (body.y > bounds.height - body.radius) {
    body.y = bounds.height - body.radius
    if (!isDragged && body.vy > 0) body.vy = -body.vy * wallRestitution
  }
}

interface ObstacleSeparation {
  x: number
  y: number
  normalX: number
  normalY: number
  distance: number
}

function normalizeObstacle(
  obstacle: TilePhysicsObstacle,
): TilePhysicsObstacle | null {
  if (
    !Number.isFinite(obstacle.left) ||
    !Number.isFinite(obstacle.top) ||
    !Number.isFinite(obstacle.right) ||
    !Number.isFinite(obstacle.bottom)
  ) {
    return null
  }

  const left = Math.min(obstacle.left, obstacle.right)
  const right = Math.max(obstacle.left, obstacle.right)
  const top = Math.min(obstacle.top, obstacle.bottom)
  const bottom = Math.max(obstacle.top, obstacle.bottom)

  if (left === right || top === bottom) return null
  return { left, top, right, bottom }
}

function centerLimits(body: TilePhysicsBody, bounds: TilePhysicsBounds) {
  const horizontalCenter = bounds.width / 2
  const verticalCenter = bounds.height / 2
  const hasHorizontalRoom = bounds.width > body.radius * 2
  const hasVerticalRoom = bounds.height > body.radius * 2

  return {
    minimumX: hasHorizontalRoom ? body.radius : horizontalCenter,
    maximumX: hasHorizontalRoom ? bounds.width - body.radius : horizontalCenter,
    minimumY: hasVerticalRoom ? body.radius : verticalCenter,
    maximumY: hasVerticalRoom ? bounds.height - body.radius : verticalCenter,
  }
}

function isWithinWorld(
  separation: ObstacleSeparation,
  body: TilePhysicsBody,
  bounds: TilePhysicsBounds,
) {
  const limits = centerLimits(body, bounds)
  return (
    separation.x >= limits.minimumX &&
    separation.x <= limits.maximumX &&
    separation.y >= limits.minimumY &&
    separation.y <= limits.maximumY
  )
}

function sideSeparations(
  body: TilePhysicsBody,
  obstacle: TilePhysicsObstacle,
): ObstacleSeparation[] {
  return [
    {
      x: obstacle.left - body.radius,
      y: body.y,
      normalX: -1,
      normalY: 0,
      distance: Math.abs(body.x - (obstacle.left - body.radius)),
    },
    {
      x: obstacle.right + body.radius,
      y: body.y,
      normalX: 1,
      normalY: 0,
      distance: Math.abs(obstacle.right + body.radius - body.x),
    },
    {
      x: body.x,
      y: obstacle.top - body.radius,
      normalX: 0,
      normalY: -1,
      distance: Math.abs(body.y - (obstacle.top - body.radius)),
    },
    {
      x: body.x,
      y: obstacle.bottom + body.radius,
      normalX: 0,
      normalY: 1,
      distance: Math.abs(obstacle.bottom + body.radius - body.y),
    },
  ]
}

function resolveObstacle(
  body: TilePhysicsBody,
  obstacle: TilePhysicsObstacle,
  bounds: TilePhysicsBounds,
  restitution: number,
) {
  const closestX = clamp(body.x, obstacle.left, obstacle.right)
  const closestY = clamp(body.y, obstacle.top, obstacle.bottom)
  const deltaX = body.x - closestX
  const deltaY = body.y - closestY
  const distanceSquared = deltaX * deltaX + deltaY * deltaY

  if (distanceSquared >= body.radius * body.radius) return false

  const distance = Math.sqrt(distanceSquared)
  let separation: ObstacleSeparation | undefined

  if (distance > 0) {
    const normalX = deltaX / distance
    const normalY = deltaY / distance
    const penetration = body.radius - distance
    const radialSeparation = {
      x: body.x + normalX * penetration,
      y: body.y + normalY * penetration,
      normalX,
      normalY,
      distance: penetration,
    }

    if (isWithinWorld(radialSeparation, body, bounds)) {
      separation = radialSeparation
    }
  }

  // A center inside the AABB has no radial normal. Picking the nearest feasible
  // face also handles obstacles whose horizontal sides lie outside the world.
  separation ??= sideSeparations(body, obstacle)
    .filter((candidate) => isWithinWorld(candidate, body, bounds))
    .sort((first, second) => first.distance - second.distance)[0]

  // If an obstacle covers every possible center point, no valid separation
  // exists. Leave the body world-constrained rather than producing bad values.
  if (!separation) return false

  body.x = separation.x
  body.y = separation.y
  const velocityAlongNormal =
    body.vx * separation.normalX + body.vy * separation.normalY

  if (velocityAlongNormal < 0) {
    body.vx -=
      (1 + restitution) * velocityAlongNormal * separation.normalX
    body.vy -=
      (1 + restitution) * velocityAlongNormal * separation.normalY
  }

  return true
}

function constrainToStaticGeometry(
  body: TilePhysicsBody,
  bounds: TilePhysicsBounds,
  obstacles: readonly TilePhysicsObstacle[],
  wallRestitution: number,
  obstacleRestitution: number,
  isDragged: boolean,
) {
  constrainToBounds(body, bounds, wallRestitution, isDragged)

  const passes = Math.min(
    MAX_STATIC_GEOMETRY_PASSES,
    Math.max(1, obstacles.length * 2),
  )

  for (let pass = 0; pass < passes; pass += 1) {
    let corrected = false

    obstacles.forEach((obstacle) => {
      corrected =
        resolveObstacle(body, obstacle, bounds, obstacleRestitution) || corrected
      constrainToBounds(body, bounds, wallRestitution, isDragged)
    })

    if (!corrected) break
  }
}

function resolveCollision(
  first: TilePhysicsBody,
  second: TilePhysicsBody,
  firstIndex: number,
  secondIndex: number,
  draggedIndex: number,
  restitution: number,
) {
  const deltaX = second.x - first.x
  const deltaY = second.y - first.y
  const minimumDistance = first.radius + second.radius
  const distanceSquared = deltaX * deltaX + deltaY * deltaY

  if (distanceSquared >= minimumDistance * minimumDistance) return

  const distance = Math.sqrt(distanceSquared)
  // Coincident centers need a stable, deterministic separation direction.
  const normalX = distance > 0 ? deltaX / distance : 1
  const normalY = distance > 0 ? deltaY / distance : 0
  const firstInverseMass = firstIndex === draggedIndex ? 0 : 1 / bodyMass(first)
  const secondInverseMass =
    secondIndex === draggedIndex ? 0 : 1 / bodyMass(second)
  const inverseMassSum = firstInverseMass + secondInverseMass

  if (inverseMassSum === 0) return

  const overlap = minimumDistance - distance
  const firstCorrection = overlap * (firstInverseMass / inverseMassSum)
  const secondCorrection = overlap * (secondInverseMass / inverseMassSum)
  first.x -= normalX * firstCorrection
  first.y -= normalY * firstCorrection
  second.x += normalX * secondCorrection
  second.y += normalY * secondCorrection

  const relativeVelocityX = second.vx - first.vx
  const relativeVelocityY = second.vy - first.vy
  const velocityAlongNormal =
    relativeVelocityX * normalX + relativeVelocityY * normalY

  // Positional correction still occurs when overlapping bodies are separating.
  if (velocityAlongNormal >= 0) return

  const impulseMagnitude =
    (-(1 + restitution) * velocityAlongNormal) / inverseMassSum
  const impulseX = impulseMagnitude * normalX
  const impulseY = impulseMagnitude * normalY

  first.vx -= impulseX * firstInverseMass
  first.vy -= impulseY * firstInverseMass
  second.vx += impulseX * secondInverseMass
  second.vy += impulseY * secondInverseMass
}

/**
 * Advances the tile simulation without mutating the supplied bodies.
 *
 * Bodies are circles for collision purposes, even when their DOM visuals are
 * rectangular. A dragged body is kinematic: its position is fixed to the
 * pointer, but its supplied pointer velocity participates in collision impulses
 * and is retained in the result so releasing it naturally produces a flick.
 */
export function stepTilePhysics(
  bodies: readonly TilePhysicsBody[],
  bounds: TilePhysicsBounds,
  deltaSeconds: number,
  options: TilePhysicsOptions = {},
): TilePhysicsBody[] {
  const safeBounds = {
    width: Math.max(0, finiteOr(bounds.width, 0)),
    height: Math.max(0, finiteOr(bounds.height, 0)),
  }
  const restitution = clamp(finiteOr(options.restitution ?? DEFAULT_RESTITUTION, DEFAULT_RESTITUTION), 0, 1)
  const wallRestitution = clamp(
    finiteOr(
      options.wallRestitution ?? DEFAULT_WALL_RESTITUTION,
      DEFAULT_WALL_RESTITUTION,
    ),
    0,
    1,
  )
  const obstacleRestitution = clamp(
    finiteOr(
      options.obstacleRestitution ?? wallRestitution,
      wallRestitution,
    ),
    0,
    1,
  )
  const linearDamping = Math.max(
    0,
    finiteOr(options.linearDamping ?? DEFAULT_LINEAR_DAMPING, DEFAULT_LINEAR_DAMPING),
  )
  const collisionPasses = clamp(
    Math.floor(
      finiteOr(
        options.collisionPasses ?? DEFAULT_COLLISION_PASSES,
        DEFAULT_COLLISION_PASSES,
      ),
    ),
    1,
    MAX_COLLISION_PASSES,
  )
  const delta = clampPhysicsDelta(
    deltaSeconds,
    options.maxDeltaSeconds ?? DEFAULT_MAX_DELTA_SECONDS,
  )
  const nextBodies = bodies.map((body) => ({
    ...body,
    x: finiteOr(body.x, 0),
    y: finiteOr(body.y, 0),
    vx: finiteOr(body.vx, 0),
    vy: finiteOr(body.vy, 0),
    radius: Math.max(MIN_RADIUS, finiteOr(body.radius, MIN_RADIUS)),
  }))
  const dragged = options.dragged
  const draggedIndex =
    dragged &&
    Number.isInteger(dragged.index) &&
    dragged.index >= 0 &&
    dragged.index < nextBodies.length
      ? dragged.index
      : -1
  const obstacles = (options.obstacles ?? [])
    .map(normalizeObstacle)
    .filter((obstacle): obstacle is TilePhysicsObstacle => obstacle !== null)
  const timeSubsteps = Math.ceil(delta / MAX_SUBSTEP_SECONDS)
  const smallestRadius = nextBodies.reduce(
    (smallest, body, index) =>
      index === draggedIndex ? smallest : Math.min(smallest, body.radius),
    Number.POSITIVE_INFINITY,
  )
  const maximumTravel = nextBodies.reduce(
    (maximum, body, index) =>
      index === draggedIndex
        ? maximum
        : Math.max(maximum, Math.hypot(body.vx, body.vy) * delta),
    0,
  )
  const travelSubsteps = Number.isFinite(smallestRadius)
    ? Math.ceil(maximumTravel / Math.max(1, smallestRadius * 0.5))
    : 1
  const substepCount = clamp(
    Math.max(1, timeSubsteps, travelSubsteps),
    1,
    MAX_SUBSTEPS,
  )
  const substepSeconds = delta / substepCount
  const dampingFactor = Math.exp(-linearDamping * substepSeconds)

  if (draggedIndex >= 0 && dragged) {
    const draggedBody = nextBodies[draggedIndex]
    draggedBody.x = finiteOr(dragged.x, draggedBody.x)
    draggedBody.y = finiteOr(dragged.y, draggedBody.y)
    draggedBody.vx = finiteOr(dragged.vx, 0)
    draggedBody.vy = finiteOr(dragged.vy, 0)
    constrainToStaticGeometry(
      draggedBody,
      safeBounds,
      obstacles,
      wallRestitution,
      obstacleRestitution,
      true,
    )
  }

  for (let substep = 0; substep < substepCount; substep += 1) {
    nextBodies.forEach((body, index) => {
      if (index === draggedIndex) return

      body.vx *= dampingFactor
      body.vy *= dampingFactor
      body.x += body.vx * substepSeconds
      body.y += body.vy * substepSeconds
      constrainToStaticGeometry(
        body,
        safeBounds,
        obstacles,
        wallRestitution,
        obstacleRestitution,
        false,
      )
    })

    for (let pass = 0; pass < collisionPasses; pass += 1) {
      for (let firstIndex = 0; firstIndex < nextBodies.length; firstIndex += 1) {
        for (
          let secondIndex = firstIndex + 1;
          secondIndex < nextBodies.length;
          secondIndex += 1
        ) {
          resolveCollision(
            nextBodies[firstIndex],
            nextBodies[secondIndex],
            firstIndex,
            secondIndex,
            draggedIndex,
            restitution,
          )
        }
      }

      nextBodies.forEach((body, index) => {
        constrainToStaticGeometry(
          body,
          safeBounds,
          obstacles,
          wallRestitution,
          obstacleRestitution,
          index === draggedIndex,
        )
      })
    }
  }

  return nextBodies
}
