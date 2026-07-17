export interface NormalizedPoint {
  x: number
  y: number
}

export interface NormalizedRect {
  x: number
  y: number
  width: number
  height: number
}

export interface CalibrationProfile {
  v: 1
  clubId: string
  cameraDeviceId?: string
  orientation: 'landscape' | 'portrait'
  tableCorners: [NormalizedPoint, NormalizedPoint, NormalizedPoint, NormalizedPoint]
  handRegion: NormalizedRect
  discardRegion: NormalizedRect
  savedAt: string
}

export function clampPoint(point: NormalizedPoint): NormalizedPoint {
  return { x: Math.max(0, Math.min(1, point.x)), y: Math.max(0, Math.min(1, point.y)) }
}

export function rectFromPoints(first: NormalizedPoint, second: NormalizedPoint): NormalizedRect {
  const a = clampPoint(first)
  const b = clampPoint(second)
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) }
}

export function validateCalibration(profile: CalibrationProfile): string[] {
  const errors: string[] = []
  const points = [...profile.tableCorners,
    { x: profile.handRegion.x, y: profile.handRegion.y },
    { x: profile.handRegion.x + profile.handRegion.width, y: profile.handRegion.y + profile.handRegion.height },
    { x: profile.discardRegion.x, y: profile.discardRegion.y },
    { x: profile.discardRegion.x + profile.discardRegion.width, y: profile.discardRegion.y + profile.discardRegion.height },
  ]
  if (points.some((point) => point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1)) errors.push('Calibration coordinates must remain inside the camera frame.')
  if (profile.handRegion.width < 0.15 || profile.handRegion.height < 0.05) errors.push('The hand region is too small.')
  if (profile.discardRegion.width < 0.15 || profile.discardRegion.height < 0.1) errors.push('The discard region is too small.')
  return errors
}

