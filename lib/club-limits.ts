export const MAX_CREATED_CLUBS = 6

export const CREATED_CLUB_LIMIT_MESSAGE = `You have reached the limit of ${MAX_CREATED_CLUBS} clubs created. You can still join or manage existing clubs.`

export function hasReachedCreatedClubLimit(createdClubCount: number) {
  return createdClubCount >= MAX_CREATED_CLUBS
}
