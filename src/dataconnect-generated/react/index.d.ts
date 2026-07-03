import { CreatePlayerData, CreatePlayerVariables, GetPlayerStatsData, GetPlayerStatsVariables, CreateSessionData, CreateSessionVariables, ListGameResultsData, ListGameResultsVariables } from '../';
import { UseDataConnectQueryResult, useDataConnectQueryOptions, UseDataConnectMutationResult, useDataConnectMutationOptions} from '@tanstack-query-firebase/react/data-connect';
import { UseQueryResult, UseMutationResult} from '@tanstack/react-query';
import { DataConnect } from 'firebase/data-connect';
import { FirebaseError } from 'firebase/app';


export function useCreatePlayer(options?: useDataConnectMutationOptions<CreatePlayerData, FirebaseError, CreatePlayerVariables>): UseDataConnectMutationResult<CreatePlayerData, CreatePlayerVariables>;
export function useCreatePlayer(dc: DataConnect, options?: useDataConnectMutationOptions<CreatePlayerData, FirebaseError, CreatePlayerVariables>): UseDataConnectMutationResult<CreatePlayerData, CreatePlayerVariables>;

export function useGetPlayerStats(vars: GetPlayerStatsVariables, options?: useDataConnectQueryOptions<GetPlayerStatsData>): UseDataConnectQueryResult<GetPlayerStatsData, GetPlayerStatsVariables>;
export function useGetPlayerStats(dc: DataConnect, vars: GetPlayerStatsVariables, options?: useDataConnectQueryOptions<GetPlayerStatsData>): UseDataConnectQueryResult<GetPlayerStatsData, GetPlayerStatsVariables>;

export function useCreateSession(options?: useDataConnectMutationOptions<CreateSessionData, FirebaseError, CreateSessionVariables>): UseDataConnectMutationResult<CreateSessionData, CreateSessionVariables>;
export function useCreateSession(dc: DataConnect, options?: useDataConnectMutationOptions<CreateSessionData, FirebaseError, CreateSessionVariables>): UseDataConnectMutationResult<CreateSessionData, CreateSessionVariables>;

export function useListGameResults(vars: ListGameResultsVariables, options?: useDataConnectQueryOptions<ListGameResultsData>): UseDataConnectQueryResult<ListGameResultsData, ListGameResultsVariables>;
export function useListGameResults(dc: DataConnect, vars: ListGameResultsVariables, options?: useDataConnectQueryOptions<ListGameResultsData>): UseDataConnectQueryResult<ListGameResultsData, ListGameResultsVariables>;
