export interface ActivitySettings {
  activePlayerMonths: number
}

export const DEFAULT_ACTIVITY_SETTINGS: ActivitySettings = {
  activePlayerMonths: 3,
}

export function validateActivitySettings(value: unknown): ActivitySettings {
  const input = value as Partial<ActivitySettings> | null
  const months = Number(input?.activePlayerMonths)

  if (!Number.isInteger(months) || months < 1 || months > 36) {
    throw new Error('The active player window must be between 1 and 36 months.')
  }

  return { activePlayerMonths: months }
}

export function activitySettingsFromRow(
  row: Record<string, unknown> | null | undefined,
): ActivitySettings {
  if (row?.active_player_months == null) return DEFAULT_ACTIVITY_SETTINGS
  return validateActivitySettings({
    activePlayerMonths: row.active_player_months,
  })
}
