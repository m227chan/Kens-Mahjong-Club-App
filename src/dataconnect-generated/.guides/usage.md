# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.




### React
For each operation, there is a wrapper hook that can be used to call the operation.

Here are all of the hooks that get generated:
```ts
import { useCreatePlayer, useGetPlayerStats, useCreateSession, useListGameResults } from '@dataconnect/generated/react';
// The types of these hooks are available in react/index.d.ts

const { data, isPending, isSuccess, isError, error } = useCreatePlayer(createPlayerVars);

const { data, isPending, isSuccess, isError, error } = useGetPlayerStats(getPlayerStatsVars);

const { data, isPending, isSuccess, isError, error } = useCreateSession(createSessionVars);

const { data, isPending, isSuccess, isError, error } = useListGameResults(listGameResultsVars);

```

Here's an example from a different generated SDK:

```ts
import { useListAllMovies } from '@dataconnect/generated/react';

function MyComponent() {
  const { isLoading, data, error } = useListAllMovies();
  if(isLoading) {
    return <div>Loading...</div>
  }
  if(error) {
    return <div> An Error Occurred: {error} </div>
  }
}

// App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MyComponent from './my-component';

function App() {
  const queryClient = new QueryClient();
  return <QueryClientProvider client={queryClient}>
    <MyComponent />
  </QueryClientProvider>
}
```



## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { createPlayer, getPlayerStats, createSession, listGameResults } from '@dataconnect/generated';


// Operation CreatePlayer:  For variables, look at type CreatePlayerVars in ../index.d.ts
const { data } = await CreatePlayer(dataConnect, createPlayerVars);

// Operation GetPlayerStats:  For variables, look at type GetPlayerStatsVars in ../index.d.ts
const { data } = await GetPlayerStats(dataConnect, getPlayerStatsVars);

// Operation CreateSession:  For variables, look at type CreateSessionVars in ../index.d.ts
const { data } = await CreateSession(dataConnect, createSessionVars);

// Operation ListGameResults:  For variables, look at type ListGameResultsVars in ../index.d.ts
const { data } = await ListGameResults(dataConnect, listGameResultsVars);


```