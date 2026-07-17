import { BASE_TILE_IDS, BONUS_TILE_IDS, type TileId } from '@/lib/mahjong-hk/tiles'

export interface TileModelManifest {
  schemaVersion: 1
  available: boolean
  version: string
  architecture: string
  modelUrl: string | null
  sha256: string | null
  input: { width: number; height: number; layout: 'NCHW' }
  labels: readonly (TileId | 'tile_back')[]
  confidenceThreshold: number
  nmsThreshold: number
  outputFormat: 'yolox-decoded'
  metrics: { physicalSetExactHandAccuracy: number | null; discardEventPrecision: number | null }
}

export const EXPECTED_TILE_LABELS = [...BASE_TILE_IDS, ...BONUS_TILE_IDS, 'tile_back'] as const

export function validateModelManifest(value: unknown): TileModelManifest {
  if (!value || typeof value !== 'object') throw new Error('Tile model manifest is not an object.')
  const manifest = value as TileModelManifest
  if (manifest.schemaVersion !== 1) throw new Error('Unsupported tile model manifest schema.')
  if (!Array.isArray(manifest.labels) || manifest.labels.join('|') !== EXPECTED_TILE_LABELS.join('|')) throw new Error('Tile model labels do not match the coach tile contract.')
  if (manifest.available && (!manifest.modelUrl || !manifest.sha256)) throw new Error('Available models require a URL and SHA-256 hash.')
  if (manifest.input?.width < 224 || manifest.input?.height < 224) throw new Error('Tile model input is too small.')
  return manifest
}

