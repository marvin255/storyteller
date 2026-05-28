## Development

Run project commands through the Docker-backed Makefile targets.

```sh
make test
make verify
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
