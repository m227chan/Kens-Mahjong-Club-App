import type { TileObservation, TileTrack } from '@/lib/coach-vision/types'
import type { NormalizedRect } from '@/lib/coach-vision/regions'

export interface ConsensusOptions {
  minimumObservations: number
  maximumMisses: number
  minimumConfidence: number
  minimumIou: number
}

export const DEFAULT_CONSENSUS: ConsensusOptions = {
  minimumObservations: 3,
  maximumMisses: 3,
  minimumConfidence: 0.72,
  minimumIou: 0.25,
}

export function intersectionOverUnion(a: NormalizedRect, b: NormalizedRect): number {
  const left = Math.max(a.x, b.x)
  const top = Math.max(a.y, b.y)
  const right = Math.min(a.x + a.width, b.x + b.width)
  const bottom = Math.min(a.y + a.height, b.y + b.height)
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top)
  const union = a.width * a.height + b.width * b.height - intersection
  return union > 0 ? intersection / union : 0
}

function blendBox(previous: NormalizedRect, next: NormalizedRect): NormalizedRect {
  const oldWeight = 0.65
  const newWeight = 1 - oldWeight
  return {
    x: previous.x * oldWeight + next.x * newWeight,
    y: previous.y * oldWeight + next.y * newWeight,
    width: previous.width * oldWeight + next.width * newWeight,
    height: previous.height * oldWeight + next.height * newWeight,
  }
}

export function updateTileTracks(
  previous: readonly TileTrack[],
  observations: readonly TileObservation[],
  options: ConsensusOptions = DEFAULT_CONSENSUS,
): TileTrack[] {
  const tracks = previous.map((track) => ({ ...track, misses: track.misses + 1 }))
  const used = new Set<number>()
  for (const observation of observations) {
    let match = -1
    let bestIou = options.minimumIou
    tracks.forEach((track, index) => {
      if (used.has(index) || track.region !== observation.region) return
      const iou = intersectionOverUnion(track.box, observation.box)
      if (iou >= bestIou) { bestIou = iou; match = index }
    })
    if (match < 0) {
      tracks.push({
        trackId: `track-${observation.frameId}-${observation.observationId}`,
        region: observation.region,
        box: observation.box,
        tile: observation.tile,
        confidence: observation.confidence,
        observations: 1,
        misses: 0,
        firstSeenAt: observation.capturedAt,
        lastSeenAt: observation.capturedAt,
        stable: false,
        committed: false,
      })
      used.add(tracks.length - 1)
      continue
    }
    const track = tracks[match]
    const agrees = track.tile === observation.tile
    const observationsSeen = agrees ? track.observations + 1 : 1
    tracks[match] = {
      ...track,
      tile: agrees || observation.confidence >= track.confidence ? observation.tile : track.tile,
      confidence: agrees ? (track.confidence * track.observations + observation.confidence) / observationsSeen : observation.confidence,
      observations: observationsSeen,
      misses: 0,
      lastSeenAt: observation.capturedAt,
      box: blendBox(track.box, observation.box),
      stable: observationsSeen >= options.minimumObservations && observation.confidence >= options.minimumConfidence,
    }
    used.add(match)
  }
  return tracks.filter((track) => track.misses <= options.maximumMisses)
}

export function newlyStableDiscardTracks(previous: readonly TileTrack[], next: readonly TileTrack[]): TileTrack[] {
  const priorStable = new Set(previous.filter((track) => track.stable || track.committed).map((track) => track.trackId))
  return next.filter((track) => track.region === 'discard' && track.stable && !track.committed && !priorStable.has(track.trackId))
}

