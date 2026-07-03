# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `example`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

**If you're looking for the `React README`, you can find it at [`dataconnect-generated/react/README.md`](./react/README.md)**

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*GetPlayerStats*](#getplayerstats)
  - [*ListGameResults*](#listgameresults)
- [**Mutations**](#mutations)
  - [*CreatePlayer*](#createplayer)
  - [*CreateSession*](#createsession)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `example`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@dataconnect/generated` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## GetPlayerStats
You can execute the `GetPlayerStats` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getPlayerStats(vars: GetPlayerStatsVariables, options?: ExecuteQueryOptions): QueryPromise<GetPlayerStatsData, GetPlayerStatsVariables>;

interface GetPlayerStatsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetPlayerStatsVariables): QueryRef<GetPlayerStatsData, GetPlayerStatsVariables>;
}
export const getPlayerStatsRef: GetPlayerStatsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getPlayerStats(dc: DataConnect, vars: GetPlayerStatsVariables, options?: ExecuteQueryOptions): QueryPromise<GetPlayerStatsData, GetPlayerStatsVariables>;

interface GetPlayerStatsRef {
  ...
  (dc: DataConnect, vars: GetPlayerStatsVariables): QueryRef<GetPlayerStatsData, GetPlayerStatsVariables>;
}
export const getPlayerStatsRef: GetPlayerStatsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getPlayerStatsRef:
```typescript
const name = getPlayerStatsRef.operationName;
console.log(name);
```

### Variables
The `GetPlayerStats` query requires an argument of type `GetPlayerStatsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetPlayerStatsVariables {
  playerId: UUIDString;
}
```
### Return Type
Recall that executing the `GetPlayerStats` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetPlayerStatsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetPlayerStatsData {
  clubStats: ({
    totalWins: number;
    totalPoints: number;
    rankPosition?: number | null;
  })[];
}
```
### Using `GetPlayerStats`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getPlayerStats, GetPlayerStatsVariables } from '@dataconnect/generated';

// The `GetPlayerStats` query requires an argument of type `GetPlayerStatsVariables`:
const getPlayerStatsVars: GetPlayerStatsVariables = {
  playerId: ..., 
};

// Call the `getPlayerStats()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getPlayerStats(getPlayerStatsVars);
// Variables can be defined inline as well.
const { data } = await getPlayerStats({ playerId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getPlayerStats(dataConnect, getPlayerStatsVars);

console.log(data.clubStats);

// Or, you can use the `Promise` API.
getPlayerStats(getPlayerStatsVars).then((response) => {
  const data = response.data;
  console.log(data.clubStats);
});
```

### Using `GetPlayerStats`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getPlayerStatsRef, GetPlayerStatsVariables } from '@dataconnect/generated';

// The `GetPlayerStats` query requires an argument of type `GetPlayerStatsVariables`:
const getPlayerStatsVars: GetPlayerStatsVariables = {
  playerId: ..., 
};

// Call the `getPlayerStatsRef()` function to get a reference to the query.
const ref = getPlayerStatsRef(getPlayerStatsVars);
// Variables can be defined inline as well.
const ref = getPlayerStatsRef({ playerId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getPlayerStatsRef(dataConnect, getPlayerStatsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.clubStats);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.clubStats);
});
```

## ListGameResults
You can execute the `ListGameResults` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listGameResults(vars: ListGameResultsVariables, options?: ExecuteQueryOptions): QueryPromise<ListGameResultsData, ListGameResultsVariables>;

interface ListGameResultsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListGameResultsVariables): QueryRef<ListGameResultsData, ListGameResultsVariables>;
}
export const listGameResultsRef: ListGameResultsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listGameResults(dc: DataConnect, vars: ListGameResultsVariables, options?: ExecuteQueryOptions): QueryPromise<ListGameResultsData, ListGameResultsVariables>;

interface ListGameResultsRef {
  ...
  (dc: DataConnect, vars: ListGameResultsVariables): QueryRef<ListGameResultsData, ListGameResultsVariables>;
}
export const listGameResultsRef: ListGameResultsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listGameResultsRef:
```typescript
const name = listGameResultsRef.operationName;
console.log(name);
```

### Variables
The `ListGameResults` query requires an argument of type `ListGameResultsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListGameResultsVariables {
  gameId: UUIDString;
}
```
### Return Type
Recall that executing the `ListGameResults` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListGameResultsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `ListGameResults`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listGameResults, ListGameResultsVariables } from '@dataconnect/generated';

// The `ListGameResults` query requires an argument of type `ListGameResultsVariables`:
const listGameResultsVars: ListGameResultsVariables = {
  gameId: ..., 
};

// Call the `listGameResults()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listGameResults(listGameResultsVars);
// Variables can be defined inline as well.
const { data } = await listGameResults({ gameId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listGameResults(dataConnect, listGameResultsVars);

console.log(data.results);

// Or, you can use the `Promise` API.
listGameResults(listGameResultsVars).then((response) => {
  const data = response.data;
  console.log(data.results);
});
```

### Using `ListGameResults`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listGameResultsRef, ListGameResultsVariables } from '@dataconnect/generated';

// The `ListGameResults` query requires an argument of type `ListGameResultsVariables`:
const listGameResultsVars: ListGameResultsVariables = {
  gameId: ..., 
};

// Call the `listGameResultsRef()` function to get a reference to the query.
const ref = listGameResultsRef(listGameResultsVars);
// Variables can be defined inline as well.
const ref = listGameResultsRef({ gameId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listGameResultsRef(dataConnect, listGameResultsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.results);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.results);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## CreatePlayer
You can execute the `CreatePlayer` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createPlayer(vars: CreatePlayerVariables): MutationPromise<CreatePlayerData, CreatePlayerVariables>;

interface CreatePlayerRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreatePlayerVariables): MutationRef<CreatePlayerData, CreatePlayerVariables>;
}
export const createPlayerRef: CreatePlayerRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createPlayer(dc: DataConnect, vars: CreatePlayerVariables): MutationPromise<CreatePlayerData, CreatePlayerVariables>;

interface CreatePlayerRef {
  ...
  (dc: DataConnect, vars: CreatePlayerVariables): MutationRef<CreatePlayerData, CreatePlayerVariables>;
}
export const createPlayerRef: CreatePlayerRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createPlayerRef:
```typescript
const name = createPlayerRef.operationName;
console.log(name);
```

### Variables
The `CreatePlayer` mutation requires an argument of type `CreatePlayerVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreatePlayerVariables {
  name: string;
  email: string;
  joinDate: DateString;
}
```
### Return Type
Recall that executing the `CreatePlayer` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreatePlayerData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreatePlayerData {
  player_insert: Player_Key;
}
```
### Using `CreatePlayer`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createPlayer, CreatePlayerVariables } from '@dataconnect/generated';

// The `CreatePlayer` mutation requires an argument of type `CreatePlayerVariables`:
const createPlayerVars: CreatePlayerVariables = {
  name: ..., 
  email: ..., 
  joinDate: ..., 
};

// Call the `createPlayer()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createPlayer(createPlayerVars);
// Variables can be defined inline as well.
const { data } = await createPlayer({ name: ..., email: ..., joinDate: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createPlayer(dataConnect, createPlayerVars);

console.log(data.player_insert);

// Or, you can use the `Promise` API.
createPlayer(createPlayerVars).then((response) => {
  const data = response.data;
  console.log(data.player_insert);
});
```

### Using `CreatePlayer`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createPlayerRef, CreatePlayerVariables } from '@dataconnect/generated';

// The `CreatePlayer` mutation requires an argument of type `CreatePlayerVariables`:
const createPlayerVars: CreatePlayerVariables = {
  name: ..., 
  email: ..., 
  joinDate: ..., 
};

// Call the `createPlayerRef()` function to get a reference to the mutation.
const ref = createPlayerRef(createPlayerVars);
// Variables can be defined inline as well.
const ref = createPlayerRef({ name: ..., email: ..., joinDate: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createPlayerRef(dataConnect, createPlayerVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.player_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.player_insert);
});
```

## CreateSession
You can execute the `CreateSession` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createSession(vars: CreateSessionVariables): MutationPromise<CreateSessionData, CreateSessionVariables>;

interface CreateSessionRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateSessionVariables): MutationRef<CreateSessionData, CreateSessionVariables>;
}
export const createSessionRef: CreateSessionRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createSession(dc: DataConnect, vars: CreateSessionVariables): MutationPromise<CreateSessionData, CreateSessionVariables>;

interface CreateSessionRef {
  ...
  (dc: DataConnect, vars: CreateSessionVariables): MutationRef<CreateSessionData, CreateSessionVariables>;
}
export const createSessionRef: CreateSessionRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createSessionRef:
```typescript
const name = createSessionRef.operationName;
console.log(name);
```

### Variables
The `CreateSession` mutation requires an argument of type `CreateSessionVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateSessionVariables {
  date: DateString;
  location: string;
  status: string;
}
```
### Return Type
Recall that executing the `CreateSession` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateSessionData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateSessionData {
  session_insert: Session_Key;
}
```
### Using `CreateSession`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createSession, CreateSessionVariables } from '@dataconnect/generated';

// The `CreateSession` mutation requires an argument of type `CreateSessionVariables`:
const createSessionVars: CreateSessionVariables = {
  date: ..., 
  location: ..., 
  status: ..., 
};

// Call the `createSession()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createSession(createSessionVars);
// Variables can be defined inline as well.
const { data } = await createSession({ date: ..., location: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createSession(dataConnect, createSessionVars);

console.log(data.session_insert);

// Or, you can use the `Promise` API.
createSession(createSessionVars).then((response) => {
  const data = response.data;
  console.log(data.session_insert);
});
```

### Using `CreateSession`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createSessionRef, CreateSessionVariables } from '@dataconnect/generated';

// The `CreateSession` mutation requires an argument of type `CreateSessionVariables`:
const createSessionVars: CreateSessionVariables = {
  date: ..., 
  location: ..., 
  status: ..., 
};

// Call the `createSessionRef()` function to get a reference to the mutation.
const ref = createSessionRef(createSessionVars);
// Variables can be defined inline as well.
const ref = createSessionRef({ date: ..., location: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createSessionRef(dataConnect, createSessionVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.session_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.session_insert);
});
```

