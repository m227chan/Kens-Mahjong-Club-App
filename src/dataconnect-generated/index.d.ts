import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise, DataConnectSettings } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;
export const dataConnectSettings: DataConnectSettings;

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

interface CreatePlayerRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreatePlayerVariables): MutationRef<CreatePlayerData, CreatePlayerVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreatePlayerVariables): MutationRef<CreatePlayerData, CreatePlayerVariables>;
  operationName: string;
}
export const createPlayerRef: CreatePlayerRef;

export function createPlayer(vars: CreatePlayerVariables): MutationPromise<CreatePlayerData, CreatePlayerVariables>;
export function createPlayer(dc: DataConnect, vars: CreatePlayerVariables): MutationPromise<CreatePlayerData, CreatePlayerVariables>;

interface GetPlayerStatsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetPlayerStatsVariables): QueryRef<GetPlayerStatsData, GetPlayerStatsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetPlayerStatsVariables): QueryRef<GetPlayerStatsData, GetPlayerStatsVariables>;
  operationName: string;
}
export const getPlayerStatsRef: GetPlayerStatsRef;

export function getPlayerStats(vars: GetPlayerStatsVariables, options?: ExecuteQueryOptions): QueryPromise<GetPlayerStatsData, GetPlayerStatsVariables>;
export function getPlayerStats(dc: DataConnect, vars: GetPlayerStatsVariables, options?: ExecuteQueryOptions): QueryPromise<GetPlayerStatsData, GetPlayerStatsVariables>;

interface CreateSessionRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateSessionVariables): MutationRef<CreateSessionData, CreateSessionVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateSessionVariables): MutationRef<CreateSessionData, CreateSessionVariables>;
  operationName: string;
}
export const createSessionRef: CreateSessionRef;

export function createSession(vars: CreateSessionVariables): MutationPromise<CreateSessionData, CreateSessionVariables>;
export function createSession(dc: DataConnect, vars: CreateSessionVariables): MutationPromise<CreateSessionData, CreateSessionVariables>;

interface ListGameResultsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListGameResultsVariables): QueryRef<ListGameResultsData, ListGameResultsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListGameResultsVariables): QueryRef<ListGameResultsData, ListGameResultsVariables>;
  operationName: string;
}
export const listGameResultsRef: ListGameResultsRef;

export function listGameResults(vars: ListGameResultsVariables, options?: ExecuteQueryOptions): QueryPromise<ListGameResultsData, ListGameResultsVariables>;
export function listGameResults(dc: DataConnect, vars: ListGameResultsVariables, options?: ExecuteQueryOptions): QueryPromise<ListGameResultsData, ListGameResultsVariables>;

