export type WindRotationMode =
  | 'non_dealer_and_draw'
  | 'non_dealer_only'
  | 'always'

export interface WindRotationSettings {
  mode: WindRotationMode
}

export const DEFAULT_WIND_ROTATION_SETTINGS: WindRotationSettings = {
  mode: 'non_dealer_and_draw',
}

export const WIND_ROTATION_MODE_OPTIONS: {
  mode: WindRotationMode
  label: string
  description: string
}[] = [
  {
    mode: 'non_dealer_and_draw',
    label: 'Non-dealer win + draw',
    description:
      'Rotate seat winds after a non-dealer win or a draw. Dealer (roller) wins keep the same winds.',
  },
  {
    mode: 'non_dealer_only',
    label: 'Non-dealer win only',
    description:
      'Rotate only after a non-dealer win. Dealer wins and draws keep the same winds.',
  },
  {
    mode: 'always',
    label: 'Always rotate',
    description: 'Rotate seat winds after every recorded win or draw.',
  },
]

const MODES = new Set<WindRotationMode>(
  WIND_ROTATION_MODE_OPTIONS.map((option) => option.mode),
)

export function validateWindRotationSettings(
  value: unknown,
): WindRotationSettings {
  const input = value as Partial<WindRotationSettings> | null
  const mode = input?.mode
  if (!mode || !MODES.has(mode)) {
    throw new Error('Choose a valid wind rotation mode.')
  }
  return { mode }
}

export function windRotationSettingsFromRow(
  row: Record<string, unknown> | null | undefined,
): WindRotationSettings {
  if (row?.wind_rotation_mode == null) return DEFAULT_WIND_ROTATION_SETTINGS
  try {
    return validateWindRotationSettings({ mode: row.wind_rotation_mode })
  } catch {
    return DEFAULT_WIND_ROTATION_SETTINGS
  }
}
