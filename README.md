## Development

Run project commands through the Docker-backed Makefile targets.

```sh
make test-unit
make test-integration
make test
make verify
```

`make test-unit` runs only unit tests, and `make test-integration` runs only database
integration tests. `make test` runs both suites, as does `make verify` after linting,
architecture checks, and compilation. The corresponding npm commands are
`test:unit`, `test:integration`, and `test`.

TypeScript uses `skipLibCheck` because the AI SDK's declaration files reference browser
types and contain types incompatible with `exactOptionalPropertyTypes`. This skips
checking `.d.ts` files while keeping strict checking enabled for application code.

Run pending database migrations with `make migrate`. To revert every applied migration and
then migrate back to the latest version, pass the refresh flag directly to the migration script:

```sh
docker compose exec -u "$(id -u)" app npm run migrate -- -refresh
```

## Database Integration Tests

Start the existing application and PostgreSQL containers before running tests:

```sh
make docker-build
make docker-up
make test-integration
```

Unit tests and their fixtures live under `tests/unit/`. Integration tests live under
`tests/integration/`. Coverage, watch mode, and mutation testing run the unit suite.
Integration tests connect directly to the database specified in
`.config/storyteller.json`. The database and its schema must already be ready;
test setup does not create databases or run migrations. No additional container
is required.

Test inserts, updates, and deletions are rolled back after each test. Identity
sequences can still advance, so tests should use returned IDs instead of assuming
fixed values.

Reusable setup lives under `tests/helper/Database/`. Call `useTestDatabase()` inside
a `describe` block to register setup and cleanup hooks, then call the returned function
inside a test to obtain its transaction. Use that transaction for both fixture inserts
and the repository instance. Connections are destroyed after the suite, including when
tests fail. These suites use ordinary sequential tests rather than `test.concurrent`.

Use `createInsertHelper(database)` to bind fixture inserts to that same transaction.
Table names and insert values are checked against `KyselyDatabase`. Inserts return
the complete stored row, including generated IDs.

```ts
import { beforeEach, describe, expect, test } from '@jest/globals';

import { createDeleteHelper } from '../../../helper/Database/createDeleteHelper.js';
import { createInsertHelper } from '../../../helper/Database/createInsertHelper.js';
import { createSelectHelper } from '../../../helper/Database/createSelectHelper.js';
import { useTestDatabase } from '../../../helper/Database/useTestDatabase.js';

describe('story persistence', () => {
    const database = useTestDatabase();
    const createInDb = createInsertHelper(database);
    const deleteFromDb = createDeleteHelper(database);
    const selectFromDb = createSelectHelper(database);

    beforeEach(async () => {
        await deleteFromDb('story', { externalId: 'test' });
    });

    test('creates a story', async () => {
        const story = await createInDb('story', { status: 'new', externalId: 'test' });

        expect(story.status).toBe('new');
        await expect(selectFromDb('story', { id: story.id })).resolves.toEqual([story]);
    });
});
```

Await every `createInDb` call. Database errors propagate to the caller, and inserts
are rolled back by `useTestDatabase()` after each test.

`createDeleteHelper(database)` provides `deleteFromDb(table, filter)`, which deletes
rows matching all supplied column values and returns the deleted row count as a
`bigint`. Use it in `beforeEach`, after `useTestDatabase()` registers its hooks, to
clear rows for the suite's fixture IDs. Cleanup uses the current test transaction,
so those deletions are also rolled back afterward. Empty filters and undefined
filter values are rejected.

`createSelectHelper(database)` provides `selectFromDb(table, filter)`, which returns
the complete rows matching all supplied column values in the current test transaction.
Table names, filters, and returned rows are checked against `KyselyDatabase`. An empty
filter selects all rows, and no matches return an empty array. Use it to verify
persisted data independently of repository methods.

## Message Logging

Run `make migrate` to create the `io_message` table. Retrieve `LoggedIOMessageRepository`
from the entity manager and call `logMessageInbound(message)` with an
`IOMessageInbound` or `logMessageOutbound(message)` with an `IOMessageOutbound`.
Both methods initially set `storyId` to `null`. The table stores the base
`IOMessage` fields, so channel-specific fields such as inbound `createdAt` are
not persisted.

Returned `LoggedIOMessage` records retain the original `messageId` and expose
the database row ID as `id`. The repository explicitly sets `isHandled` to `false`
for inbound messages and `true` for outbound messages; the database has no default
for it. Call `markAllHandled(ids, story)` after successful processing of inbound
messages. Supply `number[]` or `LoggedIOMessage[]` and a `Story` object or its numeric
database ID. The method sets `isHandled: true` and links all selected logs to that
story in one update. Repeating the call is safe; empty lists and unknown log IDs
leave the table unchanged. The story must exist for matching rows to be updated.

`findAllInboundByExternalIdAndMessageId(externalId, messageIds)` returns inbound
logs matching the external ID and any ID in the supplied array, ordered by database
`id`. The array accepts either `Id[]` or `IOMessage[]`; message objects contribute
their `messageId` values. An empty array returns no logs. Each `externalId`/`messageId`
pair is unique across both directions and all stories; logging a duplicate pair fails.
The same message ID can be logged for different external IDs. Logging and marking
messages handled are explicit repository calls; the engine does not invoke them
automatically.

## Mutation Testing

Mutation testing is powered by StrykerJS with the Jest runner and TypeScript checker.
It uses `jest.config.js`, whose roots and test patterns select only `tests/unit/`;
it does not invoke the combined npm `test` command or connect to the database.

```sh
make test-mutation
```

For a quick configuration check that runs Stryker's initial dry run without testing mutants:

```sh
make test-mutation-dry
```

The HTML mutation report is written to `reports/mutation/index.html`.
