import type { CalibrationProfile, NormalizedRect } from '@/lib/coach-vision/regions'
import type { BaseTileId, BonusTileId } from '@/lib/mahjong-hk/tiles'

export type SemanticRegion = 'hand' | 'discard'
export type ObservedTile = BaseTileId | BonusTileId | 'tile_back'

export interface TileObservation {
  observationId: string
  frameId: number
  capturedAt: number
  tile: ObservedTile
  confidence: number
  region: SemanticRegion
  box: NormalizedRect
}

export interface TileTrack {
  trackId: string
  region: SemanticRegion
  box: NormalizedRect
  tile: ObservedTile
  confidence: number
  observations: number
  misses: number
  firstSeenAt: number
  lastSeenAt: number
  stable: boolean
  committed: boolean
}

export type VisionWorkerRequest =
  | { v: 1; type: 'INIT'; manifestUrl: string; preferWebGpu: boolean }
  | { v: 1; type: 'FRAME'; frameId: number; capturedAt: number; bitmap: ImageBitmap; calibration: CalibrationProfile }
  | { v: 1; type: 'STOP' }

export type VisionWorkerResponse =
  | { v: 1; type: 'READY'; provider: string; modelVersion: string }
  | { v: 1; type: 'MODEL_UNAVAILABLE'; reason: string }
  | { v: 1; type: 'OBSERVATIONS'; frameId: number; observations: TileObservation[]; inferenceMs: number }
  | { v: 1; type: 'ERROR'; recoverable: boolean; code: string; message: string }

