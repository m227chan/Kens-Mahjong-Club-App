import type { CalibrationProfile } from '@/lib/coach-vision/regions'
import { validateCalibration } from '@/lib/coach-vision/regions'

const PREFIX = 'mahjong-coach-calibration-v1:'

export function loadCalibration(clubId: string): CalibrationProfile | null {
  try {
    const value = window.localStorage.getItem(`${PREFIX}${clubId}`)
    if (!value) return null
    const parsed = JSON.parse(value) as CalibrationProfile
    return parsed.v === 1 && validateCalibration(parsed).length === 0 ? parsed : null
  } catch {
    return null
  }
}

export function saveCalibration(profile: CalibrationProfile): void {
  const errors = validateCalibration(profile)
  if (errors.length) throw new Error(errors.join(' '))
  window.localStorage.setItem(`${PREFIX}${profile.clubId}`, JSON.stringify(profile))
}

export function removeCalibration(clubId: string): void {
  window.localStorage.removeItem(`${PREFIX}${clubId}`)
}

