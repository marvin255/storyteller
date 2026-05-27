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
- Raw command pattern:
  `docker-compose run --rm -u "$(user_id)" "app" npm run {{command}}`

| Task | Command |
| --- | --- |
| Install | `make install` |
| Add package | `make install-package LIBRARY={{LIBRARY}}` |
| Add dev package | `make install-package-dev LIBRARY={{LIBRARY}}` |
| Remove package | `make remove-package LIBRARY={{LIBRARY}}` |
| Build | `make build` |
| Fix style | `make fixer` |
| Lint | `make linter` |
| Test | `make test` |
| Coverage | `make test-coverage` |
| Verify | `make verify` |
| Shell | `make shell` |

## Workflow

- Keep changes focused and follow existing project patterns.
- Add or update Jest tests for behavior changes; production code changes must be covered by unit tests.
- Avoid new dependencies unless clearly justified. If dependencies change, use the commands above and keep the lockfile in sync.
- Update `README.md` or other docs when setup, commands, behavior, or public usage changes.
- Prefer running `make verify` to perform all non-mutating checks in one command.
- If checking separately, run `make fixer`, then `make linter`, then `make test`.
- If any verification step fails, stop and fix the issue before continuing.
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
