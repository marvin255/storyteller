## Development

Run project commands through the Docker-backed Makefile targets.

```sh
make test
make verify
```

TypeScript uses `skipLibCheck` because the AI SDK's declaration files reference browser
types and contain types incompatible with `exactOptionalPropertyTypes`. This skips
checking `.d.ts` files while keeping strict checking enabled for application code.

Run pending database migrations with `make migrate`. To revert every applied migration and
then migrate back to the latest version, pass the refresh flag directly to the migration script:

```sh
docker compose exec -u "$(id -u)" app npm run migrate -- -refresh
```

## Mutation Testing

Mutation testing is powered by StrykerJS with the Jest runner and TypeScript checker.

```sh
make test-mutation
```

For a quick configuration check that runs Stryker's initial dry run without testing mutants:

```sh
make test-mutation-dry
```

The HTML mutation report is written to `reports/mutation/index.html`.
