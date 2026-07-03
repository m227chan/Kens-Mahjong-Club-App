import { ConnectorConfig, DataConnect, OperationOptions, ExecuteOperationResponse } from 'firebase-admin/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;


export interface ClubStat_Key {
  id: UUIDString;
  __typename?: 'ClubStat_Key';
}

export interface CreatePlayerData {
  player_insert: Player_Key;
}

export interface CreatePlayerVariables {
  name: string;
  email: string;
  joinDate: DateString;
}

export interface CreateSessionData {
  session_insert: Session_Key;
}

export interface CreateSessionVariables {
  date: DateString;
  location: string;
  status: string;
}

export interface Game_Key {
  id: UUIDString;
  __typename?: 'Game_Key';
}

export interface GetPlayerStatsData {
  clubStats: ({
    totalWins: number;
    totalPoints: number;
    rankPosition?: number | null;
  })[];
}

export interface GetPlayerStatsVariables {
  playerId: UUIDString;
}

export interface ListGameResultsData {
  results: ({
    score: number;
    rank?: number | null;
    winningHandDetail?: string | null;
    player: {
      name: string;
    };
  })[];
}

export interface ListGameResultsVariables {
  gameId: UUIDString;
}

export interface Player_Key {
  id: UUIDString;
  __typename?: 'Player_Key';
}

export interface Result_Key {
  id: UUIDString;
  __typename?: 'Result_Key';
}

export interface Session_Key {
  id: UUIDString;
  __typename?: 'Session_Key';
}

/** Generated Node Admin SDK operation action function for the 'CreatePlayer' Mutation. Allow users to execute without passing in DataConnect. */
export function createPlayer(dc: DataConnect, vars: CreatePlayerVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreatePlayerData>>;
/** Generated Node Admin SDK operation action function for the 'CreatePlayer' Mutation. Allow users to pass in custom DataConnect instances. */
export function createPlayer(vars: CreatePlayerVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreatePlayerData>>;

/** Generated Node Admin SDK operation action function for the 'GetPlayerStats' Query. Allow users to execute without passing in DataConnect. */
export function getPlayerStats(dc: DataConnect, vars: GetPlayerStatsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetPlayerStatsData>>;
/** Generated Node Admin SDK operation action function for the 'GetPlayerStats' Query. Allow users to pass in custom DataConnect instances. */
export function getPlayerStats(vars: GetPlayerStatsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetPlayerStatsData>>;

/** Generated Node Admin SDK operation action function for the 'CreateSession' Mutation. Allow users to execute without passing in DataConnect. */
export function createSession(dc: DataConnect, vars: CreateSessionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateSessionData>>;
/** Generated Node Admin SDK operation action function for the 'CreateSession' Mutation. Allow users to pass in custom DataConnect instances. */
export function createSession(vars: CreateSessionVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateSessionData>>;

/** Generated Node Admin SDK operation action function for the 'ListGameResults' Query. Allow users to execute without passing in DataConnect. */
export function listGameResults(dc: DataConnect, vars: ListGameResultsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListGameResultsData>>;
/** Generated Node Admin SDK operation action function for the 'ListGameResults' Query. Allow users to pass in custom DataConnect instances. */
export function listGameResults(vars: ListGameResultsVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<ListGameResultsData>>;

