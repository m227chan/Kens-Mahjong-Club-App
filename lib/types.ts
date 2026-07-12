import type { Timestamp } from 'firebase/firestore'

export interface ClubDoc {
  id: string
  name: string
  managerUid: string
  managerEmail: string | null
  managerDisplayName: string | null
  createdAt: Timestamp
  activeSeasonNumber?: number
  active: boolean
  universal?: boolean
}

export interface ClubMembershipDoc {
  clubId: string
  clubName: string
  uid: string
  email: string | null
  displayName: string | null
  photoURL?: string | null
  role: 'manager' | 'member'
  universal?: boolean
  joinedAt: Timestamp
  active: boolean
}

export interface JoinRequestDoc {
  id: string
  clubId: string
  uid: string
  email: string | null
  displayName: string | null
  photoURL?: string | null
  status: 'pending' | 'approved' | 'declined'
  createdAt: Timestamp
  resolvedAt?: Timestamp | null
  resolvedBy?: string | null
}

export interface PlayerDoc {
  id: string
  displayName: string
  title: string
  icon: string
  iconKey?: string | null
  authUid: string | null
  createdAt: Timestamp
  active: boolean
}

export interface GameEntryDoc {
  playerId: string
  score: number
}

export interface GameDoc {
  id: string
  datetime: Timestamp
  createdBy: string
  seasonNumber?: number
  tableId: string | null
  entries: GameEntryDoc[]
  winType: 'self_draw' | 'discard' | 'draw'
  winnerPlayerId: string | null
  loserPlayerId: string | null
  fan: number | null
  notes: string | null
}

export interface EloEventDoc {
  id: string
  gameId: string
  playerId: string
  datetime: Timestamp
  seasonNumber?: number
  ratingBefore: number
  ratingAfter: number
  delta: number
  kFactor: number
  marginMultiplier: number
  opponents: Array<{
    playerId: string
    marginMultiplier: number
    expectedScore: number
    actualScore: number
    pairDelta: number
  }>
}

export interface PlayerStatsDoc {
  id?: string
  playerId: string
  seasonNumber?: number
  totalPoints: number
  gamesPlayed: number
  gamesWon: number
  gamesLost: number
  winLossRatio: number
  bestSingleGame: number
  worstSingleGame: number
  eloRating: number
  eloPeak: number
  eloRank: number
  pointsRank: number
  last5EloDelta: number
  playoffSeedScore?: number
  recentEloDeltas?: number[]
  daysAttended: number
  lastPlayedAt?: string | null
  updatedAt: Timestamp
}

export interface TableArrangementDoc {
  id: string
  createdAt: Timestamp
  tables: Record<string, string[]>
  sideline: string[]
}

export interface SessionDoc {
  id: string
  createdAt: Timestamp
  createdBy: string
  seasonNumber?: number
  isActive: boolean
  tableCount: number
  participants: string[]
  tables: Record<string, string[]>
  sideline: string[]
  closedAt?: Timestamp | null
}

export interface TitleBandDoc {
  minPoints: number
  maxPoints: number
  title: string
}

export interface AppConfigDoc {
  titleBands: TitleBandDoc[]
  eloBaseK: number
  eloVeteranGamesThreshold: number
  eloStartingRating: number
  eloNewPlayerK?: number
  eloIntermediateK?: number
  eloNewPlayerGamesThreshold?: number
}

export interface SeasonDoc {
  id: string
  seasonNumber: number
  name: string
  createdAt: Timestamp
  createdBy: string
  active: boolean
}
