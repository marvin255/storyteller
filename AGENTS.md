# AGENTS

## Project

- Node.js 24
- TypeScript
- Jest
- ESLint and Prettier
- Source code lives in `src/`.
- Unit tests live in `tests/`.
- Compiled output is written to `dist/`.

## Commands

- Run all development lifecycle commands inside the Docker container.
- Prefer `make` targets when they are available.
- Use raw Docker commands only when `make` is unavailable or a task is not exposed by the `Makefile`.
- Docker Compose is configured in `./docker-compose.yml`; the application service is `app`.
- Build and start the long-running containers with `make docker-build` and `make docker-up` before running commands that execute in the `app` container.
- Raw command pattern:
  `docker compose exec -u "$(id -u)" app npm run {{command}}`

| Task | Command |
| --- | --- |
| Build containers | `make docker-build` |
| Start containers | `make docker-up` |
| Stop containers | `make docker-down` |
| Restart containers | `make docker-restart` |
| Follow container logs | `make docker-logs` |
| Install | `make install` |
| Add package | `make install-package LIBRARY={{LIBRARY}}` |
| Add dev package | `make install-package-dev LIBRARY={{LIBRARY}}` |
| Remove package | `make remove-package LIBRARY={{LIBRARY}}` |
| Build | `make build` |
| Start application | `make start` |
| Watch application | `make watch` |
| Fix style | `make fixer` |
| Lint | `make linter` |
| Architecture | `make architecture` |
| Test | `make test` |
| Watch tests | `make test-watch` |
| Coverage | `make test-coverage` |
| Mutation testing | `make test-mutation` |
| Mutation testing dry run | `make test-mutation-dry` |
| Verify | `make verify` |
| Shell | `make shell` |

## Workflow

- Keep changes focused and follow existing project patterns.
- Add or update Jest tests for behavior changes; production code changes must be covered by unit tests.
- Avoid new dependencies unless clearly justified. If dependencies change, use the commands above and keep the lockfile in sync.
- Update `README.md` or other docs when setup, commands, behavior, or public usage changes.
- Prefer running `make verify` to perform all non-mutating checks in one command.
- If checking separately, run `make fixer`, then `make linter`, then `make architecture`, then `make test`.
- If any verification step fails, stop and fix the issue before continuing.
- Run mutation testing at the very end with `make test-mutation`, only after `make verify` is passing.
- `make fixer` can modify files; inspect the diff afterward before finalizing changes.

## Code conventions

- Contracts, interfaces, and shared data types live under `src/Contracts/`.
- Concrete implementations live outside `src/Contracts/`.
- Use `.js` extensions for local ESM imports in TypeScript files.
- Create branded values, such as `Id`, through their factory functions instead of direct type assertions outside the defining module.
- Keep public contracts small and UI-agnostic; put channel-specific behavior in implementation modules.

## Guardrails

- Do not revert or overwrite unrelated user changes.
- Check the existing diff before making broad edits.
- Keep unrelated refactors out of task-focused changes.
- Mention any verification command that was not run.
